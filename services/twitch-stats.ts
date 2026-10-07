import { prisma } from "../auth";
import { isPrivateStat } from "../lib/twitchStats";
import type { TwitchStatStatus } from "../src/generated/prisma/client";
import { publishOverlay } from "./overlay-query";
import {
  findChannel,
  getFollowerTotal,
  getSubscriptions,
  getViewerCounts,
  refreshUserToken,
  twitchConfigured,
  TwitchError,
} from "./twitch";

// Keeps the Twitch stats of open overlays up to date. Twitch only pushes follows and
// subscriptions (EventSub) to channels that authorized the app, so every stat is polled
// instead, which works the same for any channel. Only overlays someone has open (the editor, a
// control view or OBS) are polled; the rest are fetched again when they are opened.
//
// Stats are stored on their element, so they reach editors and OBS with the rest of the
// overlay: a changed value is written and the overlay is broadcast.

// Twitch itself updates follower and viewer counts about once a minute.
const POLL_INTERVAL_MS = 30_000;
// An overlay opened again right after (a reload, a second tab) shows what was just fetched.
const OPEN_COOLDOWN_MS = 15_000;
// Follower and subscription requests go out per channel; this many at once.
const CONCURRENCY = 8;

type Publisher = { publish: (channel: string, message: string) => unknown | Promise<unknown> };

let publisher: Publisher | null = null;
const lastRefresh = new Map<string, number>();

const inBatches = async <T>(items: T[], run: (item: T) => Promise<void>) => {
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    await Promise.all(items.slice(i, i + CONCURRENCY).map(run));
  }
};

const logError = (what: string, error: unknown) =>
  console.error(`[TWITCH] ${what}:`, error instanceof Error ? error.message : error);

// Elements whose channel was given by name only (presets, imports) get its id first.
const resolveChannels = async (overlayIds: string[]) => {
  const unresolved = await prisma.twitchStat.findMany({
    where: { channelId: null, channelLogin: { not: "" }, element: { overlayId: { in: overlayIds } } },
    select: { channelLogin: true },
    distinct: ["channelLogin"],
  });
  await inBatches(unresolved, async ({ channelLogin }) => {
    try {
      const channel = await findChannel(channelLogin);
      await prisma.twitchStat.updateMany({
        where: { channelLogin, channelId: null },
        data: channel
          ? { channelLogin: channel.login, channelId: channel.id, channelName: channel.displayName }
          : // Nothing to fetch for a channel that doesn't exist.
            { channelLogin: "" },
      });
    } catch (error) {
      logError(`Could not look up channel ${channelLogin}`, error);
    }
  });
};

// A token of the connected channel that works right now, refreshed when it is about to expire.
// Null when the channel's owner revoked it; the connection is removed then.
const connectionToken = async (connection: {
  id: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}, force = false) => {
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
 * Fetches the Twitch stats of these overlays and broadcasts every overlay one of them changed
 * in. A value that can't be fetched right now (Twitch is down, rate limits) is left as it is.
 */
export const refreshTwitchStats = async (overlayIds: string[]) => {
  if (overlayIds.length === 0 || !twitchConfigured()) return;
  overlayIds.forEach((id) => lastRefresh.set(id, Date.now()));

  await resolveChannels(overlayIds);
  const rows = await prisma.twitchStat.findMany({
    where: { channelId: { not: null }, element: { overlayId: { in: overlayIds } } },
    select: {
      id: true,
      stat: true,
      channelId: true,
      value: true,
      status: true,
      element: { select: { overlayId: true, overlay: { select: { userId: true } } } },
    },
  });
  if (rows.length === 0) return;

  const channelsWith = (match: (row: (typeof rows)[number]) => boolean) => [
    ...new Set(rows.filter(match).map((row) => row.channelId!)),
  ];

  // Subscriber stats of a connected channel may be shown in overlays of whoever connected it,
  // and of the people they added to their team (an account share).
  const connections = await prisma.twitchConnection.findMany({
    where: { twitchId: { in: channelsWith((row) => isPrivateStat(row.stat)) } },
  });
  const teams = await prisma.accountShare.findMany({
    where: { ownerId: { in: connections.map((c) => c.userId) }, userId: { not: null } },
    select: { ownerId: true, userId: true },
  });
  const allowedOwners = new Map(
    connections.map((c) => [
      c.twitchId,
      new Set([c.userId, ...teams.filter((t) => t.ownerId === c.userId).map((t) => t.userId!)]),
    ])
  );
  const isAllowed = (row: (typeof rows)[number]) =>
    !!allowedOwners.get(row.channelId!)?.has(row.element.overlay.userId);

  const followers = new Map<string, number>();
  const viewers = new Map<string, number>();
  const subscriptions = new Map<string, SubResult>();

  await inBatches(
    channelsWith((row) => row.stat === "FOLLOWERS"),
    async (channelId) => {
      try {
        followers.set(channelId, await getFollowerTotal(channelId));
      } catch (error) {
        logError(`Could not fetch followers of ${channelId}`, error);
      }
    }
  );

  const viewerChannels = channelsWith((row) => row.stat === "VIEWERS");
  if (viewerChannels.length > 0) {
    try {
      const live = await getViewerCounts(viewerChannels);
      viewerChannels.forEach((id) => viewers.set(id, live.get(id) ?? 0));
    } catch (error) {
      logError("Could not fetch streams", error);
    }
  }

  // Only fetched where at least one overlay may show them.
  const subChannels = new Set(channelsWith((row) => isPrivateStat(row.stat) && isAllowed(row)));
  await inBatches(
    connections.filter((c) => subChannels.has(c.twitchId)),
    async (connection) => {
      try {
        subscriptions.set(connection.twitchId, await fetchSubscriptions(connection));
      } catch (error) {
        logError(`Could not fetch subscriptions of ${connection.twitchId}`, error);
      }
    }
  );

  const nextState = (
    row: (typeof rows)[number]
  ): { value: number | null; status: TwitchStatStatus } | undefined => {
    const channelId = row.channelId!;
    switch (row.stat) {
      case "FOLLOWERS":
        return followers.has(channelId)
          ? { value: followers.get(channelId)!, status: "OK" }
          : undefined;
      case "VIEWERS":
        return viewers.has(channelId) ? { value: viewers.get(channelId)!, status: "OK" } : undefined;
      case "SUBSCRIBERS":
      case "SUB_POINTS": {
        if (!allowedOwners.has(channelId)) return { value: null, status: "NOT_CONNECTED" };
        if (!isAllowed(row)) return { value: null, status: "NOT_ALLOWED" };
        const result = subscriptions.get(channelId);
        if (result === undefined) return undefined;
        if (result === "NOT_CONNECTED") return { value: null, status: "NOT_CONNECTED" };
        return { value: row.stat === "SUBSCRIBERS" ? result.total : result.points, status: "OK" };
      }
    }
  };

  const changedOverlays = new Set<string>();
  const now = new Date();
  for (const row of rows) {
    const next = nextState(row);
    if (!next || (next.value === row.value && next.status === row.status)) continue;
    // Matched on what was fetched, so a channel or stat picked in the meantime isn't
    // overwritten with the old one's value.
    const { count } = await prisma.twitchStat.updateMany({
      where: { id: row.id, channelId: row.channelId, stat: row.stat },
      data: { ...next, fetchedAt: now },
    });
    if (count > 0) changedOverlays.add(row.element.overlayId);
  }

  if (publisher) {
    for (const overlayId of changedOverlays) {
      await publishOverlay(publisher, overlayId);
    }
  }
};

// Runs a refresh without letting its errors escape: it is never awaited by a request.
const runRefresh = (overlayIds: string[]) =>
  refreshTwitchStats(overlayIds).catch((error) => logError("Refresh failed", error));

/** For an overlay that was just opened. Skipped when it was refreshed a moment ago. */
export const refreshOpenedOverlay = (overlayId: string) => {
  if (Date.now() - (lastRefresh.get(overlayId) ?? 0) < OPEN_COOLDOWN_MS) return;
  void runRefresh([overlayId]);
};

/** For an overlay whose Twitch stat was just changed: fetches it right away. */
export const refreshOverlayNow = (overlayId: string) => void runRefresh([overlayId]);

/**
 * Starts polling. `openOverlays` lists the overlays someone has open; their stats are kept
 * current, everything else waits until it is opened again.
 */
export const startTwitchStats = (server: Publisher, openOverlays: () => Iterable<string>) => {
  publisher = server;
  if (!twitchConfigured()) {
    console.warn("[TWITCH] AUTH_TWITCH_ID / AUTH_TWITCH_SECRET are not set, Twitch stats are off");
    return;
  }
  let running = false;
  setInterval(async () => {
    // A slow round (Twitch taking its time) isn't stacked up on.
    if (running) return;
    running = true;
    for (const [overlayId, at] of lastRefresh) {
      if (Date.now() - at > OPEN_COOLDOWN_MS) lastRefresh.delete(overlayId);
    }
    try {
      await refreshTwitchStats([...new Set(openOverlays())]);
    } catch (error) {
      logError("Poll failed", error);
    } finally {
      running = false;
    }
  }, POLL_INTERVAL_MS);
};
