import React from "react";
import { formatStatValue } from "@/lib/twitchStats";
import type { PrismaElement, TwitchStatStyle } from "@/lib/types";
import Counter from "./Counter";

interface TwitchStatProps {
  twitchStat: NonNullable<PrismaElement["twitchStat"]>;
  style: TwitchStatStyle;
}

// Looks like a counter; the value comes from Twitch (services/twitch-stats.ts on the server).
const TwitchStat: React.FC<TwitchStatProps> = ({ twitchStat, style }) => (
  <Counter value={formatStatValue(twitchStat.value, style?.numberFormat)} style={style} />
);

export default TwitchStat;
