import React from "react";
import { useTimer } from "@/lib/hooks/useTimer";
import { formatDuration } from "@/lib/duration";
import type { TimerStyle } from "@/lib/types";
import { timerStyle } from "./timerStyle";

interface TimerProps {
  startedAt: Date | null;
  pausedAt: Date | null;
  style: TimerStyle;
}

const Timer: React.FC<TimerProps> = ({ startedAt, pausedAt, style }) => {
  const displayTime = useTimer({ startedAt, pausedAt });
  return <div style={timerStyle(style)}>{formatDuration(displayTime, style?.format)}</div>;
};

export default Timer;
