import { prisma } from "../auth";
import type { VariableType, VariableValue } from "../lib/variables";
import {
  channelLoginFrom,
  findChannel,
  getChannelInformation,
  getChannelsById,
  getFollowerTotal,
  getSubscriptions,
  getViewerCounts,
  isTwitchLogin,
  refreshUserToken,
  twitchConfigured,
  TwitchError,
} from "./twitch";
import { deleteVariables, setVariables, VariableError, variablesChannel, type VariableWrite } from "./variables";

// Twitch as a variable provider: every channel a user adds (a VariableSource "twitch:<login>")
// gets variables with its stats, which any element can be bound to. Twitch only pushes follows
// and subscriptions (EventSub) to channels that authorized the app, so every channel is polled
// instead, which works the same for any channel. Only the channels of users who have an overlay
// open somewhere (the editor, a control view or OBS) are polled; the rest are fetched again when
// one of their overlays is opened.

// Twitch itself updates follower and viewer counts about once a minute.
const POLL_INTERVAL_MS = 30_000;
// An overlay opened again right after (a reload, a second tab) shows what was just fetched.
const OPEN_COOLDOWN_MS = 15_000;
// Follower and subscription requests go out per channel; this many at once.
const CONCURRENCY = 8;

export const MAX_TWITCH_SOURCES_PER_USER = 20;

// The variables of every channel, and their types. Subscriber stats are private to the channel,
// so they only exist while the channel is connected (TwitchConnection) for the user's team.
export const TWITCH_VARIABLES = {
  name: "STRING",
  avatar: "IMAGE",
  followers: "INTEGER",
  live: "BOOLEAN",
  viewers: "INTEGER",
  title: "STRING",
  category: "STRING",
  subscribers: "INTEGER",
  "sub-points": "INTEGER",
} as const satisfies Record<string, VariableType>;
type TwitchKey = keyof typeof TWITCH_VARIABLES;
const SUBSCRIBER_KEYS: TwitchKey[] = ["subscribers", "sub-points"];

// Why a source has no subscriber variables.
export type TwitchProblem =
  // Nobody connected the channel to ovrly.
  | "NOT_CONNECTED"
  // Someone did, but the source's user isn't them or on their team.
  | "NOT_ALLOWED";

export const twitchSourceName = (login: string) => `twitch:${login.toLowerCase()}`;

type Publisher = { publish: (channel: string, message: string) => unknown | Promise<unknown> };

let publisher: Publisher | null = null;
// When the channels of a user were last fetched.
const lastRefresh = new Map<string, number>();

const inBatches = async <T>(items: T[], run: (item: T) => Promise<void>) => {
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    await Promise.all(items.slice(i, i + CONCURRENCY).map(run));
  }
};

const logError = (what: string, error: unknown) =>
  console.error(`[TWITCH] ${what}:`, error instanceof Error ? error.message : error);

// Runs `fetch`, logging instead of throwing: whatever can't be fetched right now (Twitch is down,
// rate limits) keeps its last value.
const attempt = async <T>(what: string, fetch: () => Promise<T>): Promise<T | undefined> => {
  try {
    return await fetch();
  } catch (error) {
    logError(what, error);
    return undefined;
  }
};

// A token of the connected channel that works right now, refreshed when it is about to expire.
// Null when the channel's owner revoked it; the connection is removed then.
export const connectionToken = async (
  connection: { id: string; accessToken: string; refreshToken: string; expiresAt: Date },
  force = false
) => {
  if (!force && connection.expiresAt.getTime() > Date.now() + 60_000) return connection.accessToken;
  try {
    const token = await refreshUserToken(connection.refreshToken);
    await prisma.twitchConnection.update({
      where: { id: connection.id },
      data: {
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        expiresAt: token.expiresAt,
      },
    });
    return token.accessToken;
  } catch (error) {
    if (error instanceof TwitchError && (error.status === 400 || error.status === 401)) {
      await prisma.twitchConnection.deleteMany({ where: { id: connection.id } });
      console.warn(`[TWITCH] Removed connection ${connection.id}: its access was revoked`);
      return null;
    }
    throw error;
  }
};

/**
 * Who may use what these connected channels share (subscriber stats, subathon events): whoever
 * connected it and the people they added to their team (an account share). By channel id.
 */
export const allowedUsersByChannel = async (connections: { twitchId: string; userId: string }[]) => {
  const teams = await prisma.accountShare.findMany({
    where: { ownerId: { in: connections.map((c) => c.userId) }, userId: { not: null } },
    select: { ownerId: true, userId: true },
  });
  return new Map(
    connections.map((c) => [
      c.twitchId,
      new Set([c.userId, ...teams.filter((t) => t.ownerId === c.userId).map((t) => t.userId!)]),
    ])
  );
};

type SubResult = { total: number; points: number } | "NOT_CONNECTED";

const fetchSubscriptions = async (
  connection: Parameters<typeof connectionToken>[0] & { twitchId: string }
): Promise<SubResult> => {
  let token = await connectionToken(connection);
  if (!token) return "NOT_CONNECTED";
  try {
    return await getSubscriptions(connection.twitchId, token);
  } catch (error) {
    if (!(error instanceof TwitchError) || error.status !== 401) throw error;
    // Revoked before it expired, or the scope was taken away.
    token = await connectionToken(connection, true);
    if (!token) return "NOT_CONNECTED";
    return getSubscriptions(connection.twitchId, token);
  }
};

/**
 * Fetches the Twitch channels of these users and writes their variables. Only values that
 * changed are written, and only overlays bound to them are broadcast (services/variables.ts).
 */
export const refreshTwitchVariables = async (userIds: string[]) => {
  if (userIds.length === 0 || !twitchConfigured() || !publisher) return;
  const server = publisher;
  userIds.forEach((id) => lastRefresh.set(id, Date.now()));

  const sources = await prisma.variableSource.findMany({
    where: { provider: "TWITCH", userId: { in: userIds } },
    select: { id: true, userId: true, name: true, externalId: true, config: true, problem: true },
  });
  if (sources.length === 0) return;
  const channelIds = [...new Set(sources.map((source) => source.externalId))];

  const connections = await prisma.twitchConnection.findMany({
    where: { twitchId: { in: channelIds } },
  });
  const allowedUsers = await allowedUsersByChannel(connections);
  const problemOf = (source: (typeof sources)[number]): TwitchProblem | null => {
    const allowed = allowedUsers.get(source.externalId);
    if (!allowed) return "NOT_CONNECTED";
    return allowed.has(source.userId) ? null : "NOT_ALLOWED";
  };

  const [channels, information, viewers] = await Promise.all([
    attempt("Could not fetch channels", () => getChannelsById(channelIds)),
    attempt("Could not fetch channel information", () => getChannelInformation(channelIds)),
    attempt("Could not fetch streams", () => getViewerCounts(channelIds)),
  ]);

  const followers = new Map<string, number>();
  await inBatches(channelIds, async (channelId) => {
    const total = await attempt(`Could not fetch followers of ${channelId}`, () =>
      getFollowerTotal(channelId)
    );
    if (total !== undefined) followers.set(channelId, total);
  });

  // Only fetched where at least one source may show them.
  const subChannels = new Set(
    sources.filter((source) => problemOf(source) === null).map((source) => source.externalId)
  );
  const subscriptions = new Map<string, SubResult>();
  await inBatches(
    connections.filter((c) => subChannels.has(c.twitchId)),
    async (connection) => {
      const result = await attempt(`Could not fetch subscriptions of ${connection.twitchId}`, () =>
        fetchSubscriptions(connection)
      );
      if (result !== undefined) subscriptions.set(connection.twitchId, result);
    }
  );

  for (const source of sources) {
    const channelId = source.externalId;
    const values: Partial<Record<TwitchKey, VariableValue>> = {};
    const channel = channels?.get(channelId);
    if (channel) {
      values.name = channel.displayName;
      values.avatar = channel.profileImageUrl;
    }
    const info = information?.get(channelId);
    if (info) {
      values.title = info.title;
      values.category = info.category;
    }
    if (viewers) {
      values.live = viewers.has(channelId);
      values.viewers = viewers.get(channelId) ?? 0;
    }
    if (followers.has(channelId)) values.followers = followers.get(channelId)!;

    let problem = problemOf(source);
    const subs = subscriptions.get(channelId);
    if (subs === "NOT_CONNECTED") problem = "NOT_CONNECTED";
    else if (subs && !problem) {
      values.subscribers = subs.total;
      values["sub-points"] = subs.points;
    }

    const writes: VariableWrite[] = Object.entries(values).map(([key, value]) => ({
      key,
      type: TWITCH_VARIABLES[key as TwitchKey],
      value: value!,
    }));
    try {
      if (writes.length > 0) await setVariables(server, source.userId, source.name, writes);
      // Subscriber stats that can't be read any more aren't left showing their last value.
      if (problem) await deleteVariables(server, source.userId, source.name, SUBSCRIBER_KEYS);
      const displayName = channel?.displayName;
      const config = source.config as { displayName?: string } | null;
      if (problem !== source.problem || (displayName && displayName !== config?.displayName)) {
        await prisma.variableSource.updateMany({
          where: { id: source.id },
          data: { problem, ...(displayName ? { config: { ...config, displayName } } : {}) },
        });
        server.publish(variablesChannel(source.userId), JSON.stringify({ type: "variables" }));
      }
    } catch (error) {
      // A source deleted in the meantime, or an account that is full.
      logError(`Could not write the variables of ${source.name}`, error);
    }
  }
};

// Runs a refresh without letting its errors escape: it is never awaited by a request.
const runRefresh = (userIds: string[]) =>
  refreshTwitchVariables(userIds).catch((error) => logError("Refresh failed", error));

/** For an overlay of `ownerId` that was just opened. Skipped when it was refreshed a moment ago. */
export const refreshOpenedOverlay = (ownerId: string) => {
  if (Date.now() - (lastRefresh.get(ownerId) ?? 0) < OPEN_COOLDOWN_MS) return;
  void runRefresh([ownerId]);
};

/** For a user whose channels just changed: fetches them right away. */
export const refreshUserNow = (userId: string) => void runRefresh([userId]);

/** For a channel that was just connected or disconnected: everyone who added it sees it now. */
export const refreshTwitchChannel = async (channelId: string) => {
  const sources = await prisma.variableSource.findMany({
    where: { provider: "TWITCH", externalId: channelId },
    select: { userId: true },
    distinct: ["userId"],
  });
  if (sources.length > 0) void runRefresh(sources.map((source) => source.userId));
};

const createSource = async (userId: string, channel: { id: string; login: string; displayName: string }) => {
  const name = twitchSourceName(channel.login);
  const existing = await prisma.variableSource.findUnique({
    where: { userId_name: { userId, name } },
  });
  if (existing) return existing;
  if ((await prisma.variableSource.count({ where: { userId, provider: "TWITCH" } })) >= MAX_TWITCH_SOURCES_PER_USER) {
    throw new VariableError(`You can add at most ${MAX_TWITCH_SOURCES_PER_USER} Twitch channels`, 409);
  }
  const source = await prisma.variableSource.upsert({
    where: { userId_name: { userId, name } },
    create: {
      userId,
      provider: "TWITCH",
      name,
      externalId: channel.id,
      config: { displayName: channel.displayName },
    },
    update: {},
  });
  publisher?.publish(variablesChannel(userId), JSON.stringify({ type: "variables" }));
  refreshUserNow(userId);
  return source;
};

/**
 * Adds the variables of a Twitch channel to the account of `userId`. `input` is what was typed:
 * a name, "@name" or a link. Adding a channel twice returns the one added before.
 */
export const addTwitchSource = async (userId: string, input: string) => {
  if (!twitchConfigured()) throw new VariableError("Twitch is not set up on this server", 503);
  const login = channelLoginFrom(input);
  if (!login || !isTwitchLogin(login)) {
    throw new VariableError(`“${login || input}” is not a Twitch channel name`, 400);
  }
  let channel;
  try {
    channel = await findChannel(login);
  } catch (error) {
    logError("Channel lookup failed", error);
    throw new VariableError("Could not reach Twitch, try again in a moment", 502);
  }
  if (!channel) throw new VariableError(`There is no Twitch channel called “${login}”`, 400);
  return createSource(userId, channel);
};

/**
 * The source of the user's own channel, the one they sign in with, added when it isn't yet.
 * Null when they didn't sign in with Twitch or Twitch can't be reached.
 */
export const ownTwitchSource = async (userId: string) => {
  if (!twitchConfigured()) return null;
  const account = await prisma.account.findFirst({
    where: { userId, providerId: "twitch" },
    select: { accountId: true },
  });
  if (!account) return null;
  const channel = (
    await attempt("Could not look up the own channel", () => getChannelsById([account.accountId]))
  )?.get(account.accountId);
  return channel ? createSource(userId, channel) : null;
};

/**
 * Starts polling. `openOverlayOwners` lists the owners of the overlays someone has open; their
 * channels are kept current, everything else waits until one of their overlays is opened.
 */
export const startTwitchVariables = (server: Publisher, openOverlayOwners: () => Iterable<string>) => {
  publisher = server;
  if (!twitchConfigured()) {
    console.warn("[TWITCH] AUTH_TWITCH_ID / AUTH_TWITCH_SECRET are not set, Twitch variables are off");
    return;
  }
  let running = false;
  setInterval(async () => {
    // A slow round (Twitch taking its time) isn't stacked up on.
    if (running) return;
    running = true;
    for (const [userId, at] of lastRefresh) {
      if (Date.now() - at > OPEN_COOLDOWN_MS) lastRefresh.delete(userId);
    }
    try {
      await refreshTwitchVariables([...new Set(openOverlayOwners())]);
    } catch (error) {
      logError("Poll failed", error);
    } finally {
      running = false;
    }
  }, POLL_INTERVAL_MS);
};
