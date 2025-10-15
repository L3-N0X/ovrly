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
  duration: number | null;
  countDown: boolean | null;
  style: TimerStyle;
}

const Timer: React.FC<TimerProps> = ({ startedAt, pausedAt, duration, countDown, style }) => {
  const [displayTime, setDisplayTime] = useState(0);

  useEffect(() => {
    const getPausedDuration = () => (pausedAt ? new Date(pausedAt).getTime() : 0);

    let intervalId: number | undefined;

    const calculateAndUpdate = () => {
      let newDisplayTime;
      if (startedAt) {
        const startTime = new Date(startedAt).getTime();
        const elapsed = Date.now() - startTime;
        if (countDown) {
          newDisplayTime = (duration || 0) - (getPausedDuration() + elapsed);
        } else {
          newDisplayTime = getPausedDuration() + elapsed;
        }
      } else {
        if (countDown) {
          newDisplayTime = (duration || 0) - getPausedDuration();
        } else {
          newDisplayTime = getPausedDuration();
        }
      }
      setDisplayTime(newDisplayTime);
    };

    calculateAndUpdate(); // Initial calculation

    if (startedAt) {
      intervalId = window.setInterval(calculateAndUpdate, 1000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [startedAt, pausedAt, duration, countDown]);

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