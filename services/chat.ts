import { prisma } from "../auth";
import {
  findChannel,
  getChannelsById,
  getChatBadges,
  twitchConfigured,
  type ChatBadge,
  type TwitchChannel,
} from "./twitch";

// What a chat element needs from Twitch besides the messages, which browsers read from Twitch
// chat themselves (src/lib/chat/irc.ts): which channel "the owner's" is, and the badge pictures,
// which only Helix knows. Anyone with an overlay's id can ask (OBS), so answers are cached and
// only channels the overlay's chats show are looked up (routes/publicOverlays.ts).

export interface ChatChannelInfo {
  // Null when the overlay's owner didn't sign in with Twitch and no other channel was picked.
  // `id` is null when Twitch can't be asked; the browser learns it from the chat then.
  channel: { id: string | null; login: string; displayName: string } | null;
  // By "<set>/<version>": the global badges, overridden by the channel's own.
  badges: Record<string, ChatBadge>;
}

const CACHE_MS = 10 * 60 * 1000;
const cache = new Map<string, { expiresAt: number; value: Promise<unknown> }>();

// The value under `key` while it is fresh, otherwise loaded again. Failures aren't kept.
const cached = <T>(key: string, load: () => Promise<T>): Promise<T> => {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.value as Promise<T>;
  for (const [stale, entry] of cache) if (entry.expiresAt <= now) cache.delete(stale);
  const value = load();
  cache.set(key, { expiresAt: now + CACHE_MS, value });
  value.catch(() => cache.delete(key));
  return value;
};

const ownChannel = async (ownerId: string): Promise<TwitchChannel | null> => {
  const account = await prisma.account.findFirst({
    where: { userId: ownerId, providerId: "twitch" },
    select: { accountId: true },
  });
  if (!account) return null;
  return cached(`id:${account.accountId}`, async () =>
    (await getChannelsById([account.accountId])).get(account.accountId) ?? null
  );
};

const badgesOf = (channelId?: string) =>
  cached(`badges:${channelId ?? "global"}`, () => getChatBadges(channelId)).catch((error) => {
    console.error("[CHAT] Could not load chat badges:", error);
    return {} as Record<string, ChatBadge>;
  });

/**
 * The channel a chat of `ownerId`'s shows: `login`, or with null the owner's own (the one they
 * sign in with), along with its badges.
 */
export const chatChannelInfo = async (
  ownerId: string,
  login: string | null
): Promise<ChatChannelInfo> => {
  const unresolved: ChatChannelInfo = {
    channel: login ? { id: null, login, displayName: login } : null,
    badges: {},
  };
  if (!twitchConfigured()) return unresolved;

  let channel: TwitchChannel | null;
  try {
    channel = login
      ? await cached(`login:${login}`, () => findChannel(login))
      : await ownChannel(ownerId);
  } catch (error) {
    console.error("[CHAT] Could not look up the chat's channel:", error);
    return unresolved;
  }
  if (!channel) return unresolved;

  const [global, own] = await Promise.all([badgesOf(), badgesOf(channel.id)]);
  return {
    channel: { id: channel.id, login: channel.login, displayName: channel.displayName },
    badges: { ...global, ...own },
  };
};
