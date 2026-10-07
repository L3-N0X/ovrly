import type { PrismaElement, TwitchStatStyle, TwitchStatType } from "./types";
import { request } from "./sharing";

// Mirrors lib/twitchStats.ts on the server.

export const TWITCH_STATS: {
  value: TwitchStatType;
  label: string;
  description: string;
  // Only readable once the channel is connected (Settings → Twitch).
  private: boolean;
}[] = [
  {
    value: "FOLLOWERS",
    label: "Followers",
    description: "How many people follow the channel.",
    private: false,
  },
  {
    value: "VIEWERS",
    label: "Viewers",
    description: "Viewers of the current stream, 0 while offline.",
    private: false,
  },
  {
    value: "SUBSCRIBERS",
    label: "Subscribers",
    description: "Active subscriptions, the broadcaster's own included.",
    private: true,
  },
  {
    value: "SUB_POINTS",
    label: "Sub points",
    description: "Tier 1 counts 1, tier 2 counts 2, tier 3 counts 6.",
    private: true,
  },
];

export const twitchStatInfo = (stat: TwitchStatType) =>
  TWITCH_STATS.find((info) => info.value === stat) ?? TWITCH_STATS[0];

const fullFormat = new Intl.NumberFormat(undefined);
const compactFormat = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 1,
});

// What the overlay shows for a value; a dash while there is none.
export const formatStatValue = (
  value: number | null | undefined,
  format: TwitchStatStyle["numberFormat"]
) => {
  if (value === null || value === undefined) return "–";
  return (format === "compact" ? compactFormat : fullFormat).format(value);
};

type TwitchStatData = NonNullable<PrismaElement["twitchStat"]>;

// Why a stat shows no value, for the people running the overlay. Null when it is fine.
export const twitchStatProblem = (twitchStat: TwitchStatData): string | null => {
  const channel = twitchStat.channelName ?? twitchStat.channelLogin;
  if (!twitchStat.channelLogin) return "Pick a Twitch channel to show its stats.";
  switch (twitchStat.status) {
    case "NOT_CONNECTED":
      return `${channel} isn't connected to ovrly. Its subscriber numbers are private, so someone who can sign in to Twitch as ${channel} has to connect it under Settings → Twitch.`;
    case "NOT_ALLOWED":
      return `${channel} is connected, but its subscriber numbers are only shown in overlays of whoever connected it and of the people on their team. Ask them to add this overlay's owner to their team.`;
    default:
      return null;
  }
};

export interface TwitchConnection {
  id: string;
  twitchId: string;
  login: string;
  displayName: string;
  createdAt: string;
}

export interface TwitchConnectionsResponse {
  // False when the server has no Twitch app configured.
  available: boolean;
  connections: TwitchConnection[];
}

export const twitchApi = {
  connections: () => request<TwitchConnectionsResponse>("/api/twitch/connections"),
  disconnect: (id: string) =>
    request<TwitchConnectionsResponse>(`/api/twitch/connections/${id}`, { method: "DELETE" }),
  // Starts connecting a channel: Twitch asks to allow reading its subscriptions, then sends
  // the browser back to the settings.
  connectUrl: "/api/twitch/connect",
  updateStat: (elementId: string, data: { channel?: string; stat?: TwitchStatType }) =>
    request<PrismaElement>(`/api/elements/${elementId}`, { method: "PATCH", body: { data } }),
};
