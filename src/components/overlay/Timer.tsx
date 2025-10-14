import React, { useEffect, useState } from "react";
import moment from "moment";

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
  style: TimerStyle;
}

const Timer: React.FC<TimerProps> = ({ startedAt, pausedAt, style }) => {
  const [duration, setDuration] = useState(0);

  console.log("Timer props:", { startedAt, pausedAt });

  useEffect(() => {
    console.log("Timer useEffect triggered:", { startedAt, pausedAt });

    const pausedDuration = pausedAt ? new Date(pausedAt).getTime() : 0;

    if (startedAt) {
      const startTime = new Date(startedAt).getTime();

      // Set initial duration immediately
      setDuration(pausedDuration + (new Date().getTime() - startTime));

      const interval = setInterval(() => {
        setDuration(pausedDuration + (new Date().getTime() - startTime));
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setDuration(pausedDuration);
    }
  }, [startedAt, pausedAt]);

  console.log("Timer duration:", duration);

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

  const formatDuration = (duration: number) => {
    const durationMoment = moment.duration(duration);
    const format = safeStyle.format || "HH:mm:ss";
    return moment.utc(durationMoment.asMilliseconds()).format(format);
  };

  return <div style={timerStyle}>{formatDuration(duration)}</div>;
};

export default Timer;