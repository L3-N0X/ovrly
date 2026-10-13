import { prisma } from "../auth";
import {
  applySubathonEvent,
  subathonColumns,
  type SubathonEvent,
  type SubathonState,
} from "../lib/subathon";
import { lockElement } from "./locks";
import { publishOverlay } from "./overlay-query";
import { BITS_SCOPE, createEventSubSubscription, twitchConfigured, TwitchError } from "./twitch";
import { allowedUsersByChannel, connectionToken } from "./twitch-variables";

// Twitch events for subathons (lib/subathon.ts): subs, resubs and cheers of a connected channel,
// pushed by EventSub over a WebSocket. Polling, as the Twitch variables do, only tells how many
// subs there are, not who subbed with which tier or how many bits came in.
//
// Every channel gets its own socket, since EventSub sessions belong to a user token, and only
// while it is needed: a subathon on it is running, or one of its owner's overlays is open (so
// time counts before the stream when the subathon counts while paused). Twitch keeps nothing
// for a socket that isn't there, so events in between are lost.

const EVENTSUB_URL = "wss://eventsub.wss.twitch.tv/ws";
// How often the channels listened to are checked against the subathons that need them.
const SYNC_INTERVAL_MS = 30_000;
// Waited before connecting a channel again after its socket failed, by failures in a row.
const RETRY_DELAYS_MS = [2_000, 10_000, 30_000, 120_000];
// Extra time on top of the keepalive Twitch promises before a silent socket counts as dead.
const KEEPALIVE_GRACE_MS = 5_000;
// Notifications may be delivered more than once; this many message ids are remembered.
const SEEN_MESSAGES = 1000;

type Publisher = { publish: (channel: string, message: string) => unknown | Promise<unknown> };

interface Listener {
  channelId: string;
  // The connection's scopes when it was opened; a reconnected channel with others starts over.
  scope: string;
  socket: WebSocket;
  // The socket Twitch asked to move to, until it says welcome.
  next: WebSocket | null;
  keepalive: ReturnType<typeof setTimeout> | null;
  keepaliveMs: number;
  // Subscribed to its events, and to which.
  ready: boolean;
  bits: boolean;
  // Closed on purpose, so it isn't retried.
  stopped: boolean;
}

let publisher: Publisher | null = null;
let openOverlayOwners: () => Iterable<string> = () => [];
const listeners = new Map<string, Listener>();
const failures = new Map<string, { count: number; retryAt: number }>();
const seen = new Set<string>();

const log = (message: string) => console.log(`[TWITCH EVENTS] ${message}`);
const logError = (what: string, error: unknown) =>
  console.error(`[TWITCH EVENTS] ${what}:`, error instanceof Error ? error.message : error);

// ---- Which channels are needed --------------------------------------------------------------

// The channels some subathon needs right now, with their connections. A subathon without a
// channel listens to its owner's own one; either way the owner has to be allowed to use it.
const wantedChannels = async () => {
  const owners = [...new Set(openOverlayOwners())];
  const subathons = await prisma.subathon.findMany({
    where: {
      OR: [{ endsAt: { gt: new Date() } }, { element: { overlay: { userId: { in: owners } } } }],
    },
    select: { channelId: true, element: { select: { overlay: { select: { userId: true } } } } },
  });
  const ownersOfOwnChannel = subathons
    .filter((s) => s.channelId === null)
    .map((s) => s.element.overlay.userId);
  const ownChannels = new Map(
    (
      await prisma.account.findMany({
        where: { providerId: "twitch", userId: { in: ownersOfOwnChannel } },
        select: { userId: true, accountId: true },
      })
    ).map((account) => [account.userId, account.accountId])
  );
  const pairs = subathons.flatMap((s) => {
    const ownerId = s.element.overlay.userId;
    const channelId = s.channelId ?? ownChannels.get(ownerId);
    return channelId ? [{ channelId, ownerId }] : [];
  });

  const connections = await prisma.twitchConnection.findMany({
    where: { twitchId: { in: [...new Set(pairs.map((p) => p.channelId))] } },
  });
  const allowed = await allowedUsersByChannel(connections);
  const wanted = new Map<string, (typeof connections)[number]>();
  for (const { channelId, ownerId } of pairs) {
    const connection = connections.find((c) => c.twitchId === channelId);
    if (connection && allowed.get(channelId)?.has(ownerId)) wanted.set(channelId, connection);
  }
  return wanted;
};

let syncing = false;
let syncAgain = false;

const sync = async () => {
  if (!publisher || !twitchConfigured()) return;
  if (syncing) {
    syncAgain = true;
    return;
  }
  syncing = true;
  try {
    const wanted = await wantedChannels();
    for (const listener of listeners.values()) {
      const connection = wanted.get(listener.channelId);
      if (!connection || connection.scope !== listener.scope) stop(listener);
    }
    const now = Date.now();
    for (const [channelId, connection] of wanted) {
      if (listeners.has(channelId)) continue;
      if ((failures.get(channelId)?.retryAt ?? 0) > now) continue;
      start(channelId, connection.scope);
    }
    for (const channelId of failures.keys()) {
      if (!wanted.has(channelId)) failures.delete(channelId);
    }
  } catch (error) {
    logError("Sync failed", error);
  } finally {
    syncing = false;
    if (syncAgain) {
      syncAgain = false;
      void sync();
    }
  }
};

/** For a subathon that was just started, paused or moved to another channel, or a channel that
 * was connected or disconnected: listens to what is needed now. */
export const syncSubathonListeners = () => void sync();

/** The channels whose events are coming in, and whether that includes cheers. */
export const listeningChannels = () =>
  new Map(
    [...listeners.values()]
      .filter((listener) => listener.ready)
      .map((listener) => [listener.channelId, { bits: listener.bits }])
  );

// ---- Sockets --------------------------------------------------------------------------------

const start = (channelId: string, scope: string) => {
  const listener: Listener = {
    channelId,
    scope,
    socket: null as unknown as WebSocket,
    next: null,
    keepalive: null,
    keepaliveMs: 10_000,
    ready: false,
    bits: false,
    stopped: false,
  };
  listener.socket = connect(listener, EVENTSUB_URL);
  listeners.set(channelId, listener);
};

const stop = (listener: Listener) => {
  listener.stopped = true;
  if (listener.keepalive) clearTimeout(listener.keepalive);
  listener.socket.close();
  listener.next?.close();
  if (listeners.get(listener.channelId) === listener) listeners.delete(listener.channelId);
};

// Gives up on the socket and tries again later, longer the more often it failed.
const fail = (listener: Listener, reason: string) => {
  if (listener.stopped) return;
  stop(listener);
  const count = (failures.get(listener.channelId)?.count ?? 0) + 1;
  const delay = RETRY_DELAYS_MS[Math.min(count, RETRY_DELAYS_MS.length) - 1];
  failures.set(listener.channelId, { count, retryAt: Date.now() + delay });
  log(`Channel ${listener.channelId}: ${reason}, trying again in ${delay / 1000}s`);
  setTimeout(() => void sync(), delay);
};

const connect = (listener: Listener, url: string) => {
  const socket = new WebSocket(url);
  socket.onmessage = (message) => {
    if (listener.stopped) return;
    handleMessage(listener, socket, String(message.data)).catch((error) =>
      logError(`Message on channel ${listener.channelId}`, error)
    );
  };
  socket.onclose = (event) => {
    if (listener.next === socket) listener.next = null;
    // Closing the socket that was moved away from is expected.
    if (socket === listener.socket) fail(listener, `socket closed (${event.code})`);
  };
  return socket;
};

// Twitch sends something (at least a keepalive) every few seconds; silence means the
// connection is gone without having been closed.
const resetKeepalive = (listener: Listener) => {
  if (listener.keepalive) clearTimeout(listener.keepalive);
  listener.keepalive = setTimeout(
    () => fail(listener, "no keepalive"),
    listener.keepaliveMs + KEEPALIVE_GRACE_MS
  );
};

interface EventSubMessage {
  metadata: { message_id: string; message_type: string; subscription_type?: string };
  payload: {
    session?: { id: string; keepalive_timeout_seconds: number | null; reconnect_url: string | null };
    subscription?: { type: string; status?: string };
    event?: Record<string, unknown>;
  };
}

const handleMessage = async (listener: Listener, socket: WebSocket, data: string) => {
  const message = JSON.parse(data) as EventSubMessage;
  const { message_id: id, message_type: type } = message.metadata;
  if (socket === listener.socket) resetKeepalive(listener);

  switch (type) {
    case "session_welcome": {
      const session = message.payload.session!;
      listener.keepaliveMs = (session.keepalive_timeout_seconds ?? 10) * 1000;
      if (socket === listener.next) {
        // Moved to a new server: the subscriptions came along, the old socket can go.
        const old = listener.socket;
        listener.socket = socket;
        listener.next = null;
        old.close();
        resetKeepalive(listener);
        return;
      }
      await subscribe(listener, session.id);
      return;
    }
    case "session_reconnect": {
      const url = message.payload.session?.reconnect_url;
      if (url && !listener.next) listener.next = connect(listener, url);
      return;
    }
    case "revocation":
      // The channel took its permission back (or lost a scope). Starting over finds out which.
      fail(listener, `${message.payload.subscription?.type} was revoked (${message.payload.subscription?.status})`);
      return;
    case "notification": {
      if (seen.has(id)) return;
      seen.add(id);
      if (seen.size > SEEN_MESSAGES) seen.delete(seen.values().next().value!);
      const event = toSubathonEvent(message.payload.subscription?.type, message.payload.event);
      if (event) await addToSubathons(listener.channelId, event);
      return;
    }
  }
};

// Twitch closes a session that isn't subscribed to anything within ten seconds of its welcome.
const subscribe = async (listener: Listener, sessionId: string) => {
  const connection = await prisma.twitchConnection.findUnique({
    where: { twitchId: listener.channelId },
  });
  if (!connection) return fail(listener, "not connected any more");
  const bits = connection.scope.split(" ").includes(BITS_SCOPE);
  const types = ["channel.subscribe", "channel.subscription.message", ...(bits ? ["channel.cheer"] : [])];

  try {
    let token = await connectionToken(connection);
    for (const type of types) {
      if (!token) return fail(listener, "its access was revoked");
      try {
        await createEventSubSubscription(token, sessionId, type, {
          broadcaster_user_id: listener.channelId,
        });
      } catch (error) {
        if (!(error instanceof TwitchError) || error.status !== 401) throw error;
        // Revoked before it expired: one more time with a fresh token.
        token = await connectionToken(connection, true);
        if (!token) return fail(listener, "its access was revoked");
        await createEventSubSubscription(token, sessionId, type, {
          broadcaster_user_id: listener.channelId,
        });
      }
    }
  } catch (error) {
    logError(`Subscribing to channel ${listener.channelId}`, error);
    return fail(listener, "could not subscribe");
  }
  listener.ready = true;
  listener.bits = bits;
  failures.delete(listener.channelId);
  log(`Listening to ${connection.login}${bits ? "" : " (without cheers, connect it again for those)"}`);
};

// ---- Events ---------------------------------------------------------------------------------

const TIERS: Record<string, 1 | 2 | 3> = { "1000": 1, "2000": 2, "3000": 3 };

// New subs (also every gifted one: Twitch reports each sub of a gift bomb on its own), resubs
// shared in chat, and cheers. Prime subs are reported as tier 1.
const toSubathonEvent = (
  type: string | undefined,
  event: Record<string, unknown> | undefined
): SubathonEvent | null => {
  if (!event) return null;
  if (type === "channel.subscribe" || type === "channel.subscription.message") {
    const tier = TIERS[String(event.tier)];
    return tier ? { kind: "sub", tier } : null;
  }
  if (type === "channel.cheer") {
    const bits = Number(event.bits);
    return Number.isInteger(bits) && bits > 0 ? { kind: "bits", bits } : null;
  }
  return null;
};

// Adds the event to every subathon on the channel whose owner may use it.
const addToSubathons = async (channelId: string, event: SubathonEvent) => {
  const server = publisher;
  if (!server) return;
  const connection = await prisma.twitchConnection.findUnique({ where: { twitchId: channelId } });
  if (!connection) return;
  const allowed = [...((await allowedUsersByChannel([connection])).get(channelId) ?? [])];
  const subathons = await prisma.subathon.findMany({
    where: {
      element: { overlay: { userId: { in: allowed } } },
      OR: [
        { channelId },
        {
          channelId: null,
          element: {
            overlay: { user: { Account: { some: { providerId: "twitch", accountId: channelId } } } },
          },
        },
      ],
    },
    select: { elementId: true, element: { select: { overlayId: true } } },
  });

  for (const { elementId, element } of subathons) {
    try {
      const changed = await prisma.$transaction(async (tx) => {
        await lockElement(tx, elementId);
        const current = await tx.subathon.findUnique({ where: { elementId } });
        if (!current) return false;
        const next = applySubathonEvent(current as SubathonState, event, Date.now());
        if (!next) return false;
        await tx.subathon.update({ where: { elementId }, data: subathonColumns(next) });
        return true;
      });
      if (changed) await publishOverlay(server, element.overlayId);
    } catch (error) {
      logError(`Could not add to subathon ${elementId}`, error);
    }
  }
};

/**
 * Starts listening. `owners` lists the owners of the overlays someone has open; paused
 * subathons of theirs count events too.
 */
export const startTwitchEvents = (server: Publisher, owners: () => Iterable<string>) => {
  publisher = server;
  openOverlayOwners = owners;
  if (!twitchConfigured()) return;
  void sync();
  setInterval(() => void sync(), SYNC_INTERVAL_MS);
};
