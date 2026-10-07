import { useState, useEffect } from "react";

interface UseTimerProps {
  startedAt: Date | null;
  pausedAt: Date | null;
}

// The elapsed time of a timer, kept up to date while it runs.
export const useTimer = ({ startedAt, pausedAt }: UseTimerProps): number => {
  const [displayTime, setDisplayTime] = useState(0);
  // Callers create new Date objects on every render; depending on the timestamps instead
  // keeps the interval from being torn down and restarted each time the parent re-renders.
  const startedAtMs = startedAt ? startedAt.getTime() : null;
  const pausedAtMs = pausedAt ? pausedAt.getTime() : null;

  useEffect(() => {
    const calculateAndUpdate = () => {
      const paused = pausedAtMs ?? 0;
      setDisplayTime(startedAtMs !== null ? paused + Date.now() - startedAtMs : paused);
    };

    calculateAndUpdate(); // Initial calculation

    if (startedAtMs === null) return;
    // Ticks more often than once per second so the display doesn't skip a second when
    // the interval drifts.
    const intervalId = window.setInterval(calculateAndUpdate, 250);
    return () => clearInterval(intervalId);
  }, [startedAtMs, pausedAtMs]);

  return displayTime;
};
