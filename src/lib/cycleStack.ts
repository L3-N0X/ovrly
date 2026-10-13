import { useEffect, useState } from "react";
import {
  DEFAULT_CYCLE_STACK_INTERVAL,
  isElementVisible,
  type CycleStackStyle,
  type PrismaElement,
} from "./types";

// Mirrors lib/cycleStack.ts on the server, which applies the same actions to the stored stack.
// Here they only update the editor right away, until the server's result arrives. The rest
// works out which layer a stack shows, the same way in the editor, the controls and OBS.

export type CycleStackState = NonNullable<PrismaElement["cycleStack"]>;

// `index` is the layer that was shown when it was clicked (see layerShown).
export type CycleStackAction =
  | { type: "play" }
  | { type: "pause"; index: number }
  | { type: "show"; index: number };

const iso = (ms: number) => new Date(ms).toISOString();

export const applyCycleStackAction = (
  stack: CycleStackState,
  action: CycleStackAction,
  now: number
): CycleStackState => {
  switch (action.type) {
    case "play":
      return stack.startedAt ? stack : { ...stack, startedAt: iso(now) };
    case "pause":
      return { ...stack, index: action.index, startedAt: null };
    case "show":
      return { ...stack, index: action.index, startedAt: stack.startedAt ? iso(now) : null };
  }
};

// The layers of a stack, in order: its children that are drawn. Hidden ones are skipped, so the
// stack never shows nothing for a while. Takes the resolved elements, whose visibility may be
// bound to a variable.
export const cycleStackLayers = (elements: PrismaElement[], stackId: string) =>
  elements
    .filter((e) => e.parentId === stackId && isElementVisible(e))
    .sort((a, b) => (a.position || 0) - (b.position || 0));

// Milliseconds each layer is shown for. Never below a tenth of a second, which a bound variable
// could otherwise ask for.
export const cycleIntervalMs = (style: CycleStackStyle | null) => {
  const seconds = style?.interval;
  return (
    Math.max(0.1, typeof seconds === "number" && Number.isFinite(seconds) ? seconds : DEFAULT_CYCLE_STACK_INTERVAL) *
    1000
  );
};

const wrap = (index: number, count: number) => ((index % count) + count) % count;

// Which of `count` layers is shown at `now`, and when the next one comes up (null while paused).
export const layerShown = (
  stack: CycleStackState | null | undefined,
  count: number,
  intervalMs: number,
  now: number
): { index: number; nextAt: number | null } => {
  if (count === 0) return { index: 0, nextAt: null };
  const base = stack?.index ?? 0;
  const startedAt = stack?.startedAt ? new Date(stack.startedAt).getTime() : null;
  if (startedAt === null || count === 1) return { index: wrap(base, count), nextAt: null };
  // A clock behind the server's sees it start a moment in the future; it shows the layer at
  // `index` until then.
  const steps = Math.max(0, Math.floor((now - startedAt) / intervalMs));
  return { index: wrap(base + steps, count), nextAt: startedAt + (steps + 1) * intervalMs };
};

// The layer a stack shows, kept up to date while it cycles.
export const useLayerShown = (
  stack: CycleStackState | null | undefined,
  count: number,
  intervalMs: number
) => {
  const [now, setNow] = useState(() => Date.now());
  const { index, nextAt } = layerShown(stack, count, intervalMs, now);

  // `now` only moves on when the next layer is due, so it may be older than the state: a layer
  // picked since then started after it, which counts as no time having passed yet, and a switch
  // that is overdue is caught up on right away.
  useEffect(() => {
    if (nextAt === null) return;
    const timeout = window.setTimeout(() => setNow(Date.now()), Math.max(0, nextAt - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [nextAt]);

  return { index, running: !!stack?.startedAt && count > 1 };
};
