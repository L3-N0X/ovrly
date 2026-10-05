import { useState, useEffect } from "react";

interface UseTimerProps {
  startedAt: Date | null;
  pausedAt: Date | null;
  duration: number | null;
  countDown: boolean | null;
}

export const useTimer = ({ startedAt, pausedAt, duration, countDown }: UseTimerProps): number => {
  const [displayTime, setDisplayTime] = useState(0);
  // Callers create new Date objects on every render; depending on the timestamps instead
  // keeps the interval from being torn down and restarted each time the parent re-renders.
  const startedAtMs = startedAt ? startedAt.getTime() : null;
  const pausedAtMs = pausedAt ? pausedAt.getTime() : null;

  useEffect(() => {
    const getPausedDuration = () => pausedAtMs ?? 0;

    let intervalId: number | undefined;

    const calculateAndUpdate = () => {
      let newDisplayTime;
      if (startedAtMs !== null) {
        const elapsed = Date.now() - startedAtMs;
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

    if (startedAtMs !== null) {
      // Ticks more often than once per second so the display doesn't skip a second when
      // the interval drifts.
      intervalId = window.setInterval(calculateAndUpdate, 250);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [startedAtMs, pausedAtMs, duration, countDown]);

  return displayTime;
};
