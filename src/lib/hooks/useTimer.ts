import { useState, useEffect } from "react";

interface UseTimerProps {
  startedAt: Date | null;
  pausedAt: Date | null;
  duration: number | null;
  countDown: boolean | null;
}

export const useTimer = ({ startedAt, pausedAt, duration, countDown }: UseTimerProps): number => {
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
    } else {
      // Ensure displayTime is updated when timer is paused/reset
      calculateAndUpdate();
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [startedAt, pausedAt, duration, countDown]);

  return displayTime;
};
