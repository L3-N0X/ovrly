import { prisma } from "../auth";
import type { VariableType, VariableValue } from "../lib/variables";
import { coverColors } from "./cover-colors";
import { getPlayback, refreshUserToken, spotifyConfigured, SpotifyError, type Playback } from "./spotify";
import { deleteVariableSource, setVariables, variablesChannel, type VariableWrite } from "./variables";

// Spotify as a variable provider: a user who connected their Spotify account (SpotifyConnection,
// routes/spotify.ts) gets a "spotify:player" source with what they are listening to. Spotify has
// no push API for playback, so it is polled, like Twitch: every few seconds for the users who have
// an overlay open somewhere, right away when one is opened, and right when a track should end.

// Fast enough for a progress text to look alive; Progress elements move on by themselves between
// polls (Progress.running).
const POLL_INTERVAL_MS = 5_000;
// An overlay opened again right after (a reload, a second tab) shows what was just fetched.
const OPEN_COOLDOWN_MS = 3_000;
// Requests go out per user; this many at once.
const CONCURRENCY = 8;
// The next poll is brought forward to just after the track ends, when that's sooner.
const TRACK_END_GRACE_MS = 750;

// Every user has at most one Spotify account connected, so the source has the same name for
// everyone: an overlay bound to it shows the Spotify of whoever owns it, also after it was
// duplicated or created from a preset.
export const SPOTIFY_SOURCE = "spotify:player";

// The variables of the source, and their types. Times are in whole seconds.
export const SPOTIFY_VARIABLES = {
  track: "STRING",
  artist: "STRING",
  album: "STRING",
  cover: "IMAGE",
  accent: "COLOR",
  "accent-dark": "COLOR",
  "accent-contrast": "COLOR",
  playing: "BOOLEAN",
  active: "BOOLEAN",
  progress: "INTEGER",
  duration: "INTEGER",
  "progress-percent": "DOUBLE",
  "progress-text": "STRING",
  "duration-text": "STRING",
  "remaining-text": "STRING",
  volume: "INTEGER",
  device: "STRING",
  shuffle: "BOOLEAN",
  repeat: "STRING",
  explicit: "BOOLEAN",
} as const satisfies Record<string, VariableType>;
type SpotifyKey = keyof typeof SPOTIFY_VARIABLES;

// Why a source has no current values.
export type SpotifyProblem =
  // The listener took ovrly's access away on Spotify; connecting again fixes it.
  | "REVOKED";

type Publisher = { publish: (channel: string, message: string) => unknown | Promise<unknown> };

let publisher: Publisher | null = null;
// When each user was last fetched.
const lastRefresh = new Map<string, number>();
// Polls brought forward to the end of the playing track, by user.
const trackEndTimers = new Map<string, ReturnType<typeof setTimeout>>();
// Spotify rate limits the whole app; nothing is sent before this.
let pausedUntil = 0;

const inBatches = async <T>(items: T[], run: (item: T) => Promise<void>) => {
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    await Promise.all(items.slice(i, i + CONCURRENCY).map(run));
  }
};

const logError = (what: string, error: unknown) =>
  console.error(`[SPOTIFY] ${what}:`, error instanceof Error ? error.message : error);

// "1:05", or "1:02:05" past an hour (podcasts).
export const formatTrackTime = (seconds: number) => {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
};

type Connection = {
  id: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
};

class RevokedError extends Error {}

// A token that works right now, refreshed when it is about to expire.
const connectionToken = async (connection: Connection, force = false) => {
  if (!force && connection.expiresAt.getTime() > Date.now() + 60_000) return connection.accessToken;
  try {
    const token = await refreshUserToken(connection.refreshToken);
    const data = {
      accessToken: token.accessToken,
      refreshToken: token.refreshToken ?? connection.refreshToken,
      expiresAt: token.expiresAt,
    };
    await prisma.spotifyConnection.updateMany({ where: { id: connection.id }, data });
    Object.assign(connection, data);
    return token.accessToken;
  } catch (error) {
    // invalid_grant: the listener removed ovrly from their Spotify account.
    if (error instanceof SpotifyError && (error.status === 400 || error.status === 401)) {
      throw new RevokedError("Access was revoked");
    }
    throw error;
  }
};

const fetchPlayback = async (connection: Connection) => {
  try {
    return await getPlayback(await connectionToken(connection));
  } catch (error) {
    if (!(error instanceof SpotifyError) || error.status !== 401) throw error;
    // Revoked or expired before its time: one more try with a fresh token.
    return getPlayback(await connectionToken(connection, true));
  }
};

// The variables for what is playing. Nothing playing empties the texts and the cover, so an
// overlay doesn't keep showing a song that ended an hour ago; the accent keeps its last colour.
const valuesOf = async (playback: Playback | null) => {
  const item = playback?.item ?? null;
  const progress = item ? Math.min(playback!.progressMs, item.durationMs) / 1000 : 0;
  const duration = item ? item.durationMs / 1000 : 0;
  const values: Partial<Record<SpotifyKey, VariableValue>> = {
    track: item?.title ?? "",
    artist: item?.artist ?? "",
    album: item?.album ?? "",
    // Largest first; the overlay may show it big.
    cover: item?.images[0]?.url ?? "",
    playing: !!playback?.playing && !!item,
    active: !!item,
    progress: Math.round(progress),
    duration: Math.round(duration),
    "progress-percent": duration > 0 ? Math.round((progress / duration) * 1000) / 10 : 0,
    "progress-text": formatTrackTime(progress),
    "duration-text": formatTrackTime(duration),
    "remaining-text": formatTrackTime(duration - progress),
    shuffle: playback?.shuffle ?? false,
    repeat: playback?.repeat ?? "off",
    explicit: item?.explicit ?? false,
    device: playback?.device ?? "",
  };
  if (playback?.volume != null) values.volume = playback.volume;
  // The smallest cover is plenty to pick a colour from.
  const small = item?.images.at(-1)?.url;
  if (small) {
    try {
      const colors = await coverColors(small);
      values.accent = colors.accent;
      values["accent-dark"] = colors.dark;
      values["accent-contrast"] = colors.contrast;
    } catch (error) {
      logError("Could not read the colours of a cover", error);
    }
  }
  return values;
};

// Polls again right after the playing track ends, so the next one shows up without waiting for
// the regular poll.
const scheduleTrackEnd = (userId: string, playback: Playback | null) => {
  clearTimeout(trackEndTimers.get(userId));
  trackEndTimers.delete(userId);
  if (!playback?.playing || !playback.item) return;
  const left = playback.item.durationMs - playback.progressMs;
  if (left < 0 || left >= POLL_INTERVAL_MS) return;
  trackEndTimers.set(
    userId,
    setTimeout(() => {
      trackEndTimers.delete(userId);
      void runRefresh([userId]);
    }, left + TRACK_END_GRACE_MS)
  );
};

const setProblem = async (server: Publisher, userId: string, problem: SpotifyProblem) => {
  await prisma.variableSource.updateMany({
    where: { userId, name: SPOTIFY_SOURCE },
    data: { problem },
  });
  server.publish(variablesChannel(userId), JSON.stringify({ type: "variables" }));
};

/**
 * Fetches what these users are playing and writes their variables. Only values that changed are
 * written, and only overlays bound to them are broadcast (services/variables.ts).
 */
export const refreshSpotifyVariables = async (userIds: string[]) => {
  if (userIds.length === 0 || !spotifyConfigured() || !publisher) return;
  if (Date.now() < pausedUntil) return;
  const server = publisher;
  userIds.forEach((id) => lastRefresh.set(id, Date.now()));

  const connections = await prisma.spotifyConnection.findMany({
    where: { userId: { in: userIds } },
    select: { id: true, userId: true, accessToken: true, refreshToken: true, expiresAt: true },
  });

  await inBatches(connections, async (connection) => {
    let playback: Playback | null;
    try {
      playback = await fetchPlayback(connection);
    } catch (error) {
      if (error instanceof RevokedError) {
        // Kept, so the Variables tab can say why nothing updates, until they connect again or
        // remove it. Its values stay what they were.
        await prisma.spotifyConnection.deleteMany({ where: { id: connection.id } });
        await setProblem(server, connection.userId, "REVOKED");
        console.warn(`[SPOTIFY] Removed connection ${connection.id}: its access was revoked`);
      } else if (error instanceof SpotifyError && error.status === 429) {
        pausedUntil = Date.now() + (error.retryAfter ?? 30) * 1000;
        logError(`Rate limited, pausing until ${new Date(pausedUntil).toISOString()}`, error);
      } else {
        // Spotify being down keeps the last values.
        logError(`Could not fetch the playback of ${connection.userId}`, error);
      }
      return;
    }

    scheduleTrackEnd(connection.userId, playback);
    const writes: VariableWrite[] = Object.entries(await valuesOf(playback)).map(([key, value]) => ({
      key,
      type: SPOTIFY_VARIABLES[key as SpotifyKey],
      value: value!,
    }));
    try {
      await setVariables(server, connection.userId, SPOTIFY_SOURCE, writes);
    } catch (error) {
      // An account that is full.
      logError(`Could not write the variables of ${connection.userId}`, error);
    }
  });
};

// Runs a refresh without letting its errors escape: it is never awaited by a request.
const runRefresh = (userIds: string[]) =>
  refreshSpotifyVariables(userIds).catch((error) => logError("Refresh failed", error));

/** For an overlay of `ownerId` that was just opened. Skipped when it was refreshed a moment ago. */
export const refreshOpenedSpotify = (ownerId: string) => {
  if (Date.now() - (lastRefresh.get(ownerId) ?? 0) < OPEN_COOLDOWN_MS) return;
  void runRefresh([ownerId]);
};

/**
 * Adds (or renews) the Spotify source of a user who just connected an account, and fetches what
 * they are playing right away.
 */
export const connectSpotifySource = async (
  userId: string,
  account: { id: string; displayName: string }
) => {
  const config = { displayName: account.displayName };
  await prisma.variableSource.upsert({
    where: { userId_name: { userId, name: SPOTIFY_SOURCE } },
    create: { userId, provider: "SPOTIFY", name: SPOTIFY_SOURCE, externalId: account.id, config },
    update: { externalId: account.id, config, problem: null },
  });
  publisher?.publish(variablesChannel(userId), JSON.stringify({ type: "variables" }));
  void runRefresh([userId]);
};

/** Removes the source of a user who disconnected Spotify, with its variables. */
export const removeSpotifySource = async (userId: string) => {
  clearTimeout(trackEndTimers.get(userId));
  trackEndTimers.delete(userId);
  if (!publisher) return;
  const source = await prisma.variableSource.findUnique({
    where: { userId_name: { userId, name: SPOTIFY_SOURCE } },
    select: { id: true },
  });
  if (source) await deleteVariableSource(publisher, userId, source.id);
};

/**
 * Starts polling. `openOverlayOwners` lists the owners of the overlays someone has open; what
 * they play is kept current, everyone else waits until one of their overlays is opened.
 */
export const startSpotifyVariables = (server: Publisher, openOverlayOwners: () => Iterable<string>) => {
  publisher = server;
  if (!spotifyConfigured()) {
    console.warn("[SPOTIFY] SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET are not set, Spotify variables are off");
    return;
  }
  let running = false;
  setInterval(async () => {
    // A slow round (Spotify taking its time) isn't stacked up on.
    if (running) return;
    running = true;
    for (const [userId, at] of lastRefresh) {
      if (Date.now() - at > OPEN_COOLDOWN_MS) lastRefresh.delete(userId);
    }
    try {
      await refreshSpotifyVariables([...new Set(openOverlayOwners())]);
    } catch (error) {
      logError("Poll failed", error);
    } finally {
      running = false;
    }
  }, POLL_INTERVAL_MS);
};
