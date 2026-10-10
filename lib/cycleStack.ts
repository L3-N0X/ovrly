// Cycle stacks show one of their children at a time (CycleStack in prisma/schema.prisma). Like
// timers, they are changed through actions the server applies to the state it actually has, so
// two people switching layers at once both get what they clicked. Mirrored by
// src/lib/cycleStack.ts, which also works out which layer is shown.

export interface CycleStackState {
  index: number;
  // When the layer at `index` came up while it cycles; null while it is paused.
  startedAt: Date | null;
}

// `index` is the layer the client showed when it was clicked: the server doesn't know how many
// layers there are or how long each one is shown, since that may be bound to variables.
export type CycleStackAction =
  | { type: "play" }
  | { type: "pause"; index: number }
  | { type: "show"; index: number };

// More than enough for any burst of clicks that gets coalesced into one request.
const MAX_ACTIONS = 100;
// Far more layers than a stack will ever have.
export const MAX_CYCLE_STACK_INDEX = 10_000;

export const applyCycleStackAction = (
  stack: CycleStackState,
  action: CycleStackAction,
  now: number
): CycleStackState => {
  switch (action.type) {
    case "play":
      return stack.startedAt ? stack : { ...stack, startedAt: new Date(now) };
    case "pause":
      return { index: action.index, startedAt: null };
    case "show":
      // A layer picked while it cycles gets its full time before the next one comes up.
      return { index: action.index, startedAt: stack.startedAt ? new Date(now) : null };
  }
};

const isIndex = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 0 && (value as number) <= MAX_CYCLE_STACK_INDEX;

const parseCycleStackAction = (value: unknown): CycleStackAction | null => {
  if (!value || typeof value !== "object") return null;
  const action = value as Record<string, unknown>;
  switch (action.type) {
    case "play":
      return { type: "play" };
    case "pause":
    case "show":
      return isIndex(action.index) ? { type: action.type, index: action.index } : null;
    default:
      return null;
  }
};

export const parseCycleStackActions = (value: unknown): CycleStackAction[] | null => {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_ACTIONS) return null;
  const actions = value.map(parseCycleStackAction);
  return actions.every((action) => action !== null) ? (actions as CycleStackAction[]) : null;
};
