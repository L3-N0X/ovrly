// Countdowns are changed through actions, like timers (see lib/timer.ts), so two people using
// the same countdown at once both get what they clicked. Mirrored by src/lib/countdown.ts for
// the optimistic update in the editor.
//
// A countdown either counts down a length of time (DURATION), which is started, paused and
// reset, or counts down to a point in time (TARGET), which it always does. Adding or removing
// time works in both: it changes the time left, or moves the point in time.

export type CountdownMode = "DURATION" | "TARGET";

export interface CountdownState {
  mode: CountdownMode;
  duration: number;
  remaining: number;
  endsAt: Date | null;
  targetAt: Date | null;
}

export type CountdownAction =
  | { type: "start" }
  | { type: "pause" }
  | { type: "reset" }
  | { type: "addTime"; ms: number }
  | { type: "setDuration"; ms: number }
  | { type: "setTarget"; at: number };

// More than enough for any burst of clicks that gets coalesced into one request.
const MAX_ACTIONS = 100;
// The most the Int columns hold, about 24 days. Longer countdowns count down to a date.
export const MAX_DURATION_MS = 2_147_483_647;
// A hundred years, so the dates stay representable.
const MAX_MS = 100 * 365 * 24 * 60 * 60 * 1000;

const clampDuration = (ms: number) => Math.min(MAX_DURATION_MS, Math.max(0, ms));

export const applyCountdownAction = (
  countdown: CountdownState,
  action: CountdownAction,
  now: number
): CountdownState => {
  switch (action.type) {
    case "start":
      return countdown.endsAt || countdown.remaining <= 0
        ? countdown
        : { ...countdown, endsAt: new Date(now + countdown.remaining) };
    case "pause":
      return countdown.endsAt
        ? {
            ...countdown,
            endsAt: null,
            remaining: clampDuration(countdown.endsAt.getTime() - now),
          }
        : countdown;
    case "reset":
      return { ...countdown, endsAt: null, remaining: countdown.duration };
    case "addTime": {
      if (countdown.mode === "TARGET") {
        return countdown.targetAt
          ? { ...countdown, targetAt: new Date(countdown.targetAt.getTime() + action.ms) }
          : countdown;
      }
      if (countdown.endsAt) {
        // Time added after it ran out counts from now, not from when it ran out.
        const left = Math.max(0, countdown.endsAt.getTime() - now);
        return { ...countdown, endsAt: new Date(now + clampDuration(left + action.ms)) };
      }
      return { ...countdown, remaining: clampDuration(countdown.remaining + action.ms) };
    }
    case "setDuration": {
      const duration = clampDuration(action.ms);
      return { ...countdown, mode: "DURATION", duration, remaining: duration, endsAt: null };
    }
    case "setTarget":
      return { ...countdown, mode: "TARGET", targetAt: new Date(action.at) };
  }
};

const isInteger = (value: unknown, max: number): value is number =>
  Number.isInteger(value) && Math.abs(value as number) <= max;

const parseCountdownAction = (value: unknown): CountdownAction | null => {
  if (!value || typeof value !== "object") return null;
  const action = value as Record<string, unknown>;
  switch (action.type) {
    case "start":
    case "pause":
    case "reset":
      return { type: action.type };
    case "addTime":
      return isInteger(action.ms, MAX_MS) ? { type: "addTime", ms: action.ms } : null;
    case "setDuration":
      return isInteger(action.ms, MAX_DURATION_MS) && action.ms >= 0
        ? { type: "setDuration", ms: action.ms }
        : null;
    case "setTarget":
      return isInteger(action.at, MAX_MS) ? { type: "setTarget", at: action.at } : null;
    default:
      return null;
  }
};

export const parseCountdownActions = (value: unknown): CountdownAction[] | null => {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_ACTIONS) return null;
  const actions = value.map(parseCountdownAction);
  return actions.every((action) => action !== null) ? (actions as CountdownAction[]) : null;
};

// The settings of a countdown copied from presets and duplicates, which may be user
// supplied: only valid values are taken over, and a copy always starts out paused.
export const countdownSeed = (value: unknown) => {
  const seed = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const duration =
    typeof seed.duration === "number" && Number.isFinite(seed.duration)
      ? clampDuration(Math.round(seed.duration))
      : undefined;
  const targetAt =
    typeof seed.targetAt === "string" || seed.targetAt instanceof Date
      ? new Date(seed.targetAt)
      : null;
  return {
    mode: seed.mode === "TARGET" ? ("TARGET" as const) : ("DURATION" as const),
    duration,
    remaining: duration,
    targetAt: targetAt && !Number.isNaN(targetAt.getTime()) ? targetAt : null,
  };
};
