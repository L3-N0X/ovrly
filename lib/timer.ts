// Timer changes are sent as actions ("pause", "add a minute") instead of the state a client
// computed from what it saw, so two people using the same timer at once both get what they
// clicked: the server applies each action to the state it actually has. Mirrored by
// src/lib/timer.ts for the optimistic update in the editor. Timers count up; counting down
// is lib/countdown.ts.

export interface TimerState {
  startedAt: Date | null;
  // The elapsed time accumulated before `startedAt`, stored as a timestamp relative to the epoch.
  pausedAt: Date | null;
}

export type TimerAction =
  | { type: "start" }
  | { type: "pause" }
  | { type: "reset" }
  | { type: "addTime"; ms: number };

// More than enough for any burst of clicks that gets coalesced into one request.
const MAX_ACTIONS = 100;
// A hundred years, so the dates stay representable.
const MAX_MS = 100 * 365 * 24 * 60 * 60 * 1000;

const elapsedMs = ({ startedAt, pausedAt }: TimerState, now: number) => {
  let elapsed = pausedAt ? pausedAt.getTime() : 0;
  if (startedAt) elapsed += now - startedAt.getTime();
  return elapsed;
};

export const applyTimerAction = (
  timer: TimerState,
  action: TimerAction,
  now: number
): TimerState => {
  switch (action.type) {
    case "start":
      return timer.startedAt ? timer : { ...timer, startedAt: new Date(now) };
    case "pause":
      return timer.startedAt
        ? { ...timer, startedAt: null, pausedAt: new Date(elapsedMs(timer, now)) }
        : timer;
    case "reset":
      return { startedAt: null, pausedAt: new Date(0) };
    case "addTime": {
      const paused = timer.pausedAt ? timer.pausedAt.getTime() : 0;
      return { ...timer, pausedAt: new Date(Math.max(0, paused + action.ms)) };
    }
  }
};

const parseTimerAction = (value: unknown): TimerAction | null => {
  if (!value || typeof value !== "object") return null;
  const action = value as Record<string, unknown>;
  switch (action.type) {
    case "start":
    case "pause":
    case "reset":
      return { type: action.type };
    case "addTime":
      return Number.isInteger(action.ms) && Math.abs(action.ms as number) <= MAX_MS
        ? { type: "addTime", ms: action.ms as number }
        : null;
    default:
      return null;
  }
};

export const parseTimerActions = (value: unknown): TimerAction[] | null => {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_ACTIONS) return null;
  const actions = value.map(parseTimerAction);
  return actions.every((action) => action !== null) ? (actions as TimerAction[]) : null;
};
