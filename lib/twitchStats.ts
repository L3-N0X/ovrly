// What a Twitch stat element shows: one number of one Twitch channel. Mirrored by
// src/lib/twitchStats.ts.

export const TWITCH_STAT_TYPES = ["FOLLOWERS", "VIEWERS", "SUBSCRIBERS", "SUB_POINTS"] as const;
export type TwitchStatType = (typeof TWITCH_STAT_TYPES)[number];

export const isTwitchStatType = (value: unknown): value is TwitchStatType =>
  typeof value === "string" && (TWITCH_STAT_TYPES as readonly string[]).includes(value);

// Stats Twitch only gives to the channel itself, read with the token of a connected channel.
export const isPrivateStat = (stat: TwitchStatType) =>
  stat === "SUBSCRIBERS" || stat === "SUB_POINTS";

// The settings of a Twitch stat copied from presets, imports and duplicates, which may be user
// supplied: only valid values are taken over, and the value is fetched again for the copy.
export const twitchStatSeed = (value: unknown) => {
  const seed = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const login =
    typeof seed.channelLogin === "string" && /^[a-zA-Z0-9_]{1,25}$/.test(seed.channelLogin)
      ? seed.channelLogin.toLowerCase()
      : "";
  const channelId =
    login && typeof seed.channelId === "string" && /^\d{1,20}$/.test(seed.channelId)
      ? seed.channelId
      : null;
  return {
    stat: isTwitchStatType(seed.stat) ? seed.stat : ("FOLLOWERS" as const),
    channelLogin: login,
    channelId,
    channelName:
      channelId && typeof seed.channelName === "string" ? seed.channelName.slice(0, 50) : null,
  };
};

// What someone typed to pick a channel: its name, "@name" or a link to it.
export const channelLoginFrom = (input: string) => {
  const value = input.trim();
  const link = value.match(/^(?:https?:\/\/)?(?:www\.|m\.)?twitch\.tv\/([^/?#\s]+)/i);
  return (link ? link[1] : value.replace(/^@/, "")).toLowerCase();
};
