// Emotes chatters use besides Twitch's own: those of 7TV, BetterTTV and FrankerFaceZ, global
// and the channel's. Twitch messages only mark Twitch emotes, so these are found by name (a whole
// word of the message). All three APIs are public and allow browsers to call them.

export type EmoteProvider = "twitch" | "7tv" | "bttv" | "ffz";

export interface Emote {
  name: string;
  provider: EmoteProvider;
  // Pictures at about 2x and 4x the size chat shows them at (28px high).
  url: string;
  largeUrl: string;
  // Drawn on top of the emote before it (a hat, rain) instead of next to it.
  zeroWidth: boolean;
}

export type EmoteMap = Map<string, Emote>;

// How long emotes are kept before they are asked for again, so ones added mid-stream show up.
export const EMOTE_REFRESH_MS = 10 * 60 * 1000;

export const twitchEmote = (id: string, name: string): Emote => ({
  name,
  provider: "twitch",
  url: `https://static-cdn.jtvnw.net/emoticons/v2/${id}/default/dark/2.0`,
  largeUrl: `https://static-cdn.jtvnw.net/emoticons/v2/${id}/default/dark/3.0`,
  zeroWidth: false,
});

const getJson = async (url: string): Promise<unknown> => {
  const response = await fetch(url);
  // Channels that never set up a provider answer 404; they just have no emotes there.
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return response.json();
};

// ---- 7TV -----------------------------------------------------------------------------------

interface SevenTvEmote {
  name: string;
  flags?: number;
  data?: { flags?: number; host?: { url: string } } | null;
}

// Active emote flag 1 marks an emote as zero width in a set; emote flag 256 marks it everywhere.
const SEVEN_TV_ZERO_WIDTH = 1;
const SEVEN_TV_EMOTE_ZERO_WIDTH = 1 << 8;

const sevenTvEmotes = (emotes: SevenTvEmote[] | undefined): Emote[] =>
  (emotes ?? []).flatMap((emote) => {
    const host = emote.data?.host?.url;
    if (!host) return [];
    return [
      {
        name: emote.name,
        provider: "7tv" as const,
        url: `https:${host}/2x.webp`,
        largeUrl: `https:${host}/4x.webp`,
        zeroWidth:
          ((emote.flags ?? 0) & SEVEN_TV_ZERO_WIDTH) !== 0 ||
          ((emote.data?.flags ?? 0) & SEVEN_TV_EMOTE_ZERO_WIDTH) !== 0,
      },
    ];
  });

const loadSevenTv = async (channelId: string | null) => {
  if (!channelId) {
    const set = (await getJson("https://7tv.io/v3/emote-sets/global")) as { emotes?: SevenTvEmote[] } | null;
    return sevenTvEmotes(set?.emotes);
  }
  const user = (await getJson(`https://7tv.io/v3/users/twitch/${channelId}`)) as {
    emote_set?: { emotes?: SevenTvEmote[] } | null;
  } | null;
  return sevenTvEmotes(user?.emote_set?.emotes);
};

// ---- BetterTTV -----------------------------------------------------------------------------

interface BttvEmote {
  id: string;
  code: string;
}

// BTTV's global overlay emotes have no flag; these are the ones it draws on top of others.
const BTTV_ZERO_WIDTH = new Set([
  "SoSnowy",
  "IceCold",
  "SantaHat",
  "TopHat",
  "ReinDeer",
  "CandyCane",
  "cvMask",
  "cvHazmat",
]);

const bttvEmotes = (emotes: BttvEmote[] | undefined): Emote[] =>
  (emotes ?? []).map((emote) => ({
    name: emote.code,
    provider: "bttv" as const,
    url: `https://cdn.betterttv.net/emote/${emote.id}/2x`,
    largeUrl: `https://cdn.betterttv.net/emote/${emote.id}/3x`,
    zeroWidth: BTTV_ZERO_WIDTH.has(emote.code),
  }));

const loadBttv = async (channelId: string | null) => {
  if (!channelId) {
    return bttvEmotes((await getJson("https://api.betterttv.net/3/cached/emotes/global")) as BttvEmote[]);
  }
  const user = (await getJson(`https://api.betterttv.net/3/cached/users/twitch/${channelId}`)) as {
    channelEmotes?: BttvEmote[];
    sharedEmotes?: BttvEmote[];
  } | null;
  return [...bttvEmotes(user?.channelEmotes), ...bttvEmotes(user?.sharedEmotes)];
};

// ---- FrankerFaceZ (through BTTV's cache of it, which has the same shape for both) ----------

interface FfzEmote {
  code: string;
  images: { "1x"?: string | null; "2x"?: string | null; "4x"?: string | null };
}

const ffzEmotes = (emotes: FfzEmote[] | null): Emote[] =>
  (emotes ?? []).flatMap((emote) => {
    const url = emote.images["2x"] || emote.images["1x"];
    if (!url) return [];
    return [
      {
        name: emote.code,
        provider: "ffz" as const,
        url,
        largeUrl: emote.images["4x"] || url,
        zeroWidth: false,
      },
    ];
  });

const loadFfz = async (channelId: string | null) =>
  ffzEmotes(
    (await getJson(
      channelId
        ? `https://api.betterttv.net/3/cached/frankerfacez/users/twitch/${channelId}`
        : "https://api.betterttv.net/3/cached/frankerfacez/emotes/global"
    )) as FfzEmote[] | null
  );

// ---- All together --------------------------------------------------------------------------

const LOADERS: Record<Exclude<EmoteProvider, "twitch">, (channelId: string | null) => Promise<Emote[]>> = {
  "7tv": loadSevenTv,
  bttv: loadBttv,
  ffz: loadFfz,
};

// Shared by every chat on the page; global emotes are the same for all of them.
const cache = new Map<string, { loadedAt: number; emotes: Promise<Emote[]> }>();

const emotesOf = (provider: keyof typeof LOADERS, channelId: string | null) => {
  const key = `${provider}:${channelId ?? "global"}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.loadedAt < EMOTE_REFRESH_MS) return hit.emotes;
  const emotes = LOADERS[provider](channelId).catch((error) => {
    console.warn(`[chat] Could not load ${provider} emotes`, error);
    cache.delete(key);
    return [];
  });
  cache.set(key, { loadedAt: Date.now(), emotes });
  return emotes;
};

/**
 * The emotes of the providers asked for, global and of the channel with `channelId` (once it is
 * known). A channel's own emotes win over global ones of the same name, and 7TV over BTTV over
 * FFZ, the way the chat extensions resolve them.
 */
export const loadEmotes = async (
  providers: (keyof typeof LOADERS)[],
  channelId: string | null
): Promise<EmoteMap> => {
  // Lowest priority first, so later ones replace them.
  const order = (["ffz", "bttv", "7tv"] as const).filter((provider) => providers.includes(provider));
  const lists = await Promise.all([
    ...order.map((provider) => emotesOf(provider, null)),
    ...order.map((provider) => (channelId ? emotesOf(provider, channelId) : Promise.resolve([]))),
  ]);
  const map: EmoteMap = new Map();
  for (const list of lists) for (const emote of list) map.set(emote.name, emote);
  return map;
};
