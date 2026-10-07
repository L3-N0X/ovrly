import type { PrismaElement } from "./types";

// Mirrors lib/countdown.ts on the server, which applies the same actions to the stored
// countdown. Here they only update the editor right away, until the server's result arrives.

export type CountdownState = NonNullable<PrismaElement["countdown"]>;

export type CountdownAction =
  | { type: "start" }
  | { type: "pause" }
  | { type: "reset" }
  | { type: "addTime"; ms: number }
  | { type: "setDuration"; ms: number }
  | { type: "setTarget"; at: number };

// The most the server stores, about 24 days. Longer countdowns count down to a date.
export const MAX_DURATION_MS = 2_147_483_647;

const clampDuration = (ms: number) => Math.min(MAX_DURATION_MS, Math.max(0, ms));
const iso = (ms: number) => new Date(ms).toISOString();
const time = (date: string) => new Date(date).getTime();

// What the time left depends on.
type CountdownTiming = Pick<CountdownState, "mode" | "remaining" | "endsAt" | "targetAt">;

// Whether it is counting down right now. One counting down to a point in time always is.
export const isCountdownRunning = (countdown: CountdownTiming) =>
  countdown.mode === "TARGET" ? countdown.targetAt !== null : countdown.endsAt !== null;

// The time left, never below zero.
export const remainingMs = (countdown: CountdownTiming, now = Date.now()) => {
  if (countdown.mode === "TARGET") {
    return countdown.targetAt ? Math.max(0, time(countdown.targetAt) - now) : 0;
  }
  return countdown.endsAt ? Math.max(0, time(countdown.endsAt) - now) : countdown.remaining;
};

export const applyCountdownAction = (
  countdown: CountdownState,
  action: CountdownAction,
  now: number
): CountdownState => {
  switch (action.type) {
    case "start":
      return countdown.endsAt || countdown.remaining <= 0
        ? countdown
        : { ...countdown, endsAt: iso(now + countdown.remaining) };
    case "pause":
      return countdown.endsAt
        ? { ...countdown, endsAt: null, remaining: clampDuration(time(countdown.endsAt) - now) }
        : countdown;
    case "reset":
      return { ...countdown, endsAt: null, remaining: countdown.duration };
    case "addTime": {
      if (countdown.mode === "TARGET") {
        return countdown.targetAt
          ? { ...countdown, targetAt: iso(time(countdown.targetAt) + action.ms) }
          : countdown;
      }
      if (countdown.endsAt) {
        // Time added after it ran out counts from now, not from when it ran out.
        const left = Math.max(0, time(countdown.endsAt) - now);
        return { ...countdown, endsAt: iso(now + clampDuration(left + action.ms)) };
      }
      return { ...countdown, remaining: clampDuration(countdown.remaining + action.ms) };
    }
    case "setDuration": {
      const duration = clampDuration(action.ms);
      return { ...countdown, mode: "DURATION", duration, remaining: duration, endsAt: null };
    }
    case "setTarget":
      return { ...countdown, mode: "TARGET", targetAt: iso(action.at) };
  }
};
