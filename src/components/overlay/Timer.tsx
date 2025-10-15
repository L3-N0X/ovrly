import React from "react";
import moment from "moment";
import { useTimer } from "@/lib/hooks/useTimer";

// Define a more specific type for timer styles
interface TimerStyle {
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  backgroundColor?: string;
  radius?: number;
  padding?: number;
  format?: string;
}

interface TimerProps {
  startedAt: Date | null;
  pausedAt: Date | null;
  duration: number | null;
  countDown: boolean | null;
  style: TimerStyle;
}

const Timer: React.FC<TimerProps> = ({ startedAt, pausedAt, duration, countDown, style }) => {
  const displayTime = useTimer({ startedAt, pausedAt, duration, countDown });

  const safeStyle = style || {};
  const timerStyle: React.CSSProperties = {
    fontSize: typeof safeStyle.fontSize === "number" ? `${safeStyle.fontSize}px` : "128px",
    lineHeight: 1,
    fontWeight: "700", // font-bold
    fontFamily: safeStyle.fontFamily,
    color: safeStyle.color || "#ffffff",
    backgroundColor: safeStyle.backgroundColor,
    borderRadius: typeof safeStyle.radius === "number" ? `${safeStyle.radius}px` : undefined,
    padding: typeof safeStyle.padding === "number" ? `${safeStyle.padding}px` : undefined,
  };

  const formatDuration = (time: number) => {
    if (time < 0) time = 0;
    const durationMoment = moment.duration(time);
    const format = safeStyle.format || "HH:mm:ss";
    return moment.utc(durationMoment.asMilliseconds()).format(format);
  };

  return <div style={timerStyle}>{formatDuration(displayTime)}</div>;
};

export default Timer;