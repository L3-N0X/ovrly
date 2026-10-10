import React, { useEffect, useRef, useState } from "react";
import {
  DEFAULT_BORDER_COLOR,
  DEFAULT_BORDER_WIDTH,
  DEFAULT_PROGRESS_BACKGROUND,
  DEFAULT_PROGRESS_FILL,
  DEFAULT_PROGRESS_HEIGHT,
  DEFAULT_PROGRESS_RADIUS,
  DEFAULT_PROGRESS_WIDTH,
  type PrismaElement,
  type ProgressMode,
  type ProgressStyle,
} from "@/lib/types";
import { progressFraction, progressMode, progressOf } from "@/lib/progress";
import { useFill } from "./fill";
import { useElementResize } from "./useElementResize";

const MIN_PROGRESS_SIZE = 1;
// How often a running bar moves on; its width glides between the steps.
const TICK_MS = 200;

const toNumber = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

// A step between two updates that strays this far from the pace is a jump (a seek, a new
// track), not rounding, and the pace is measured anew from there.
const JUMP_TOLERANCE = 0.5;
// Updates closer together than this say too little about the pace.
const MIN_STEP_MS = 1000;

type Point = { value: number; time: number };
// `seen` is the value last handled; `last` the last update that came in after the first render,
// which happened at some point between two updates and so can't be measured from.
type Pace = { seen: number; anchor: Point | null; last: Point | null; perSecond: number | null };

// How fast `value` moves, in units per second, measured across the updates since it last jumped.
// Only read in effects.
const usePace = (value: number) => {
  const pace = useRef<Pace>({ seen: value, anchor: null, last: null, perSecond: null });
  useEffect(() => {
    const current = pace.current;
    if (value === current.seen) return;
    current.seen = value;
    const point = { value, time: performance.now() };
    const { anchor, last, perSecond } = current;
    current.last = point;
    if (!anchor || !last) {
      current.anchor = point;
      return;
    }
    const elapsed = point.time - last.time;
    const step = ((value - last.value) / elapsed) * 1000;
    const jumped =
      elapsed < MIN_STEP_MS ||
      step <= 0 ||
      (perSecond !== null && Math.abs(step - perSecond) > perSecond * JUMP_TOLERANCE);
    if (jumped) current.anchor = point;
    // Measured from the anchor rather than the last step, so rounded values even out.
    else current.perSecond = ((value - anchor.value) / (point.time - anchor.time)) * 1000;
  }, [value]);
  return pace;
};

// `value`, moved on while `running`, counted from when the value last changed. Providers that are
// polled (a Spotify track's progress) send a new value every few seconds; in between, the bar keeps
// moving instead of jumping. In values mode the value is in seconds, so it moves one per second; a
// percentage moves at the pace it has been changing at (not at all until that is known).
const useAdvancingValue = (value: number, running: boolean, mode: ProgressMode) => {
  const pace = usePace(value);
  const [tick, setTick] = useState<{ from: number; by: number } | null>(null);
  useEffect(() => {
    if (!running) return;
    const perSecond = mode === "percent" ? (pace.current.perSecond ?? 0) : 1;
    if (perSecond === 0) return;
    const start = performance.now();
    const timer = setInterval(
      () => setTick({ from: value, by: ((performance.now() - start) / 1000) * perSecond }),
      TICK_MS
    );
    return () => {
      clearInterval(timer);
      setTick(null);
    };
  }, [value, running, mode, pace]);
  // A tick of an older value is never added to a newer one.
  return running && tick?.from === value ? value + tick.by : value;
};

// A bar filled from the left to how far along something is: `value` as a percentage, or out of
// `max` (style.mode).
const ProgressBar: React.FC<{ element: PrismaElement }> = ({ element }) => {
  const style = (element.style || {}) as ProgressStyle;
  const { value, max, running } = progressOf(element);
  const mode = progressMode(style);
  const shown = useAdvancingValue(value, running, mode);
  const fraction = progressFraction(shown, max, mode);

  const width = toNumber(style.width, DEFAULT_PROGRESS_WIDTH);
  const height = toNumber(style.height, DEFAULT_PROGRESS_HEIGHT);
  const borderWidth = toNumber(style.borderWidth, DEFAULT_BORDER_WIDTH);
  const borderRadius = toNumber(style.borderRadius, DEFAULT_PROGRESS_RADIUS);

  const fill = useFill(element);
  const { dragSize, handle } = useElementResize(element, MIN_PROGRESS_SIZE, {
    width: !fill.width,
    height: !fill.height,
  });
  const size = dragSize ?? { width, height };

  return (
    <div
      role="progressbar"
      aria-label={element.name}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(fraction * 100)}
      style={{
        position: "relative",
        width: `${size.width}px`,
        height: `${size.height}px`,
        flexShrink: 0,
        ...fill.style,
      }}
    >
      {/* Clipped on its own, so the resize handle can stick out of the bar. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          backgroundColor: style.backgroundColor || DEFAULT_PROGRESS_BACKGROUND,
          borderRadius: `${borderRadius}px`,
          border:
            borderWidth > 0
              ? `${borderWidth}px solid ${style.borderColor || DEFAULT_BORDER_COLOR}`
              : undefined,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${fraction * 100}%`,
            backgroundColor: style.fillColor || DEFAULT_PROGRESS_FILL,
            borderRadius: `${Math.max(0, borderRadius - borderWidth)}px`,
            transition: `width ${running ? TICK_MS : 300}ms linear`,
          }}
        />
      </div>
      {handle}
    </div>
  );
};

export default ProgressBar;
