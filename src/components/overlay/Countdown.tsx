import React from "react";
import { useCountdown } from "@/lib/hooks/useCountdown";
import { formatDuration } from "@/lib/duration";
import type { PrismaElement, TimerStyle } from "@/lib/types";
import { timerStyle } from "./timerStyle";

interface CountdownProps {
  countdown: NonNullable<PrismaElement["countdown"]>;
  style: TimerStyle;
}

const Countdown: React.FC<CountdownProps> = ({ countdown, style }) => {
  const left = useCountdown(countdown);
  return <div style={timerStyle(style)}>{formatDuration(left, style?.format)}</div>;
};

export default Countdown;
