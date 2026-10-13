import { useEffect, useState } from "react";
import { twitchApi, type SubathonChannel, type SubathonChannelsResponse } from "@/lib/twitch";
import type { SubathonState } from "@/lib/subathon";

// Fetched again this often, so the status follows the server connecting to Twitch.
const REFRESH_MS = 15_000;

// The channels the overlay's subathons can listen to, kept up to date. Null until loaded, or
// when they can't be (no access, no overlay id on preset previews).
export const useSubathonChannels = (overlayId: string | undefined) => {
  const [data, setData] = useState<SubathonChannelsResponse | null>(null);

  useEffect(() => {
    if (!overlayId) return;
    let disposed = false;
    const load = () =>
      twitchApi
        .subathonChannels(overlayId)
        .then((next) => !disposed && setData(next))
        .catch(() => undefined);
    void load();
    const interval = window.setInterval(load, REFRESH_MS);
    return () => {
      disposed = true;
      clearInterval(interval);
    };
  }, [overlayId]);

  return data;
};

export type SubathonStatus =
  | { kind: "unavailable" }
  | { kind: "noChannel" }
  | { kind: "notConnected" }
  | { kind: "connecting"; channel: SubathonChannel }
  | { kind: "listening"; channel: SubathonChannel };

// Whether the subathon's events are coming in, and if not, why.
export const subathonStatus = (
  subathon: Pick<SubathonState, "channelId">,
  data: SubathonChannelsResponse
): SubathonStatus => {
  if (!data.available) return { kind: "unavailable" };
  const channelId = subathon.channelId ?? data.ownChannelId;
  if (!channelId) return { kind: "noChannel" };
  const channel = data.channels.find((c) => c.twitchId === channelId);
  if (!channel) return { kind: "notConnected" };
  return { kind: channel.listening ? "listening" : "connecting", channel };
};
