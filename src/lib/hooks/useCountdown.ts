import { useState, useEffect } from "react";
import { isCountdownRunning, remainingMs, type CountdownState } from "@/lib/countdown";

// The time a countdown has left, kept up to date while it runs. Rounded up to whole seconds,
// the way countdowns are read: it shows 00:00:01 until it has actually run out, and 05:00
// for the whole first second after starting from five minutes.
export const useCountdown = (countdown: CountdownState | null | undefined): number => {
  const [left, setLeft] = useState(0);
  // Depending on the fields rather than the object keeps the interval from being restarted
  // each time the element is replaced by an equal one.
  const mode = countdown?.mode ?? null;
  const remaining = countdown?.remaining ?? 0;
  const endsAt = countdown?.endsAt ?? null;
  const targetAt = countdown?.targetAt ?? null;

  useEffect(() => {
    if (!mode) return;
    const timing = { mode, remaining, endsAt, targetAt };
    const update = () => setLeft(Math.ceil(remainingMs(timing) / 1000) * 1000);

    update();
    if (!isCountdownRunning(timing)) return;
    // Ticks more often than once per second so the display doesn't skip a second when the
    // interval drifts.
    const intervalId = window.setInterval(update, 250);
    return () => clearInterval(intervalId);
  }, [mode, remaining, endsAt, targetAt]);

  return mode ? left : 0;
};
