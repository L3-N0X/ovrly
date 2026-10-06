import type { PrismaElement } from "./types";

// Mirrors lib/timer.ts on the server, which applies the same actions to the stored timer.
// Here they only update the editor right away, until the server's result arrives.

export type TimerState = NonNullable<PrismaElement["timer"]>;

export type TimerAction =
  | { type: "start" }
  | { type: "pause" }
  | { type: "reset" }
  | { type: "addTime"; ms: number }
  | { type: "setCountDown"; countDown: boolean };

const iso = (ms: number) => new Date(ms).toISOString();

// Pausing folds the running stretch into `pausedAt`, which stores the accumulated elapsed
// time as a timestamp relative to the epoch.
export const elapsedMs = ({ startedAt, pausedAt }: TimerState, now = Date.now()) => {
  let elapsed = pausedAt ? new Date(pausedAt).getTime() : 0;
  if (startedAt) elapsed += now - new Date(startedAt).getTime();
  return elapsed;
};

export const applyTimerAction = (
  timer: TimerState,
  action: TimerAction,
  now: number
): TimerState => {
  switch (action.type) {
    case "start":
      return timer.startedAt ? timer : { ...timer, startedAt: iso(now) };
    case "pause":
      return timer.startedAt
        ? { ...timer, startedAt: null, pausedAt: iso(elapsedMs(timer, now)) }
        : timer;
    case "reset":
      return { ...timer, startedAt: null, pausedAt: iso(0), duration: 0, countDown: false };
    case "addTime": {
      if (timer.countDown) {
        return { ...timer, duration: Math.max(0, (timer.duration ?? 0) + action.ms) };
      }
      const paused = timer.pausedAt ? new Date(timer.pausedAt).getTime() : 0;
      return { ...timer, pausedAt: iso(Math.max(0, paused + action.ms)) };
    }
    case "setCountDown": {
      if (action.countDown === timer.countDown) return timer;
      if (action.countDown) {
        // Count down from whatever the timer currently shows.
        return {
          ...timer,
          startedAt: null,
          pausedAt: iso(0),
          duration: elapsedMs(timer, now),
          countDown: true,
        };
      }
      // Count up from whatever time was left.
      const remaining = (timer.duration ?? 0) - elapsedMs(timer, now);
      return {
        ...timer,
        startedAt: null,
        pausedAt: iso(Math.max(0, remaining)),
        duration: 0,
        countDown: false,
      };
    }
  }
};
