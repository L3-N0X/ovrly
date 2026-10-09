import React, { useEffect, useState } from "react";
import {
  DEFAULT_BORDER_COLOR,
  DEFAULT_BORDER_WIDTH,
  DEFAULT_PROGRESS_BACKGROUND,
  DEFAULT_PROGRESS_FILL,
  DEFAULT_PROGRESS_HEIGHT,
  DEFAULT_PROGRESS_RADIUS,
  DEFAULT_PROGRESS_WIDTH,
  type PrismaElement,
  type ProgressStyle,
} from "@/lib/types";
import { progressFraction, progressMode, progressOf } from "@/lib/progress";
import { useElementResize } from "./useElementResize";

const MIN_PROGRESS_SIZE = 1;
// How often a running bar moves on; its width glides between the steps.
const TICK_MS = 200;

const toNumber = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

// `value`, moved on by one per second while `running`, counted from when the value last changed.
// Providers that are polled (a Spotify track's progress, in seconds) send a new value every few
// seconds; in between, the bar keeps moving instead of jumping.
const useAdvancingValue = (value: number, running: boolean) => {
  const [tick, setTick] = useState<{ from: number; seconds: number } | null>(null);
  useEffect(() => {
    if (!running) return;
    const start = performance.now();
    const timer = setInterval(
      () => setTick({ from: value, seconds: (performance.now() - start) / 1000 }),
      TICK_MS
    );
    return () => {
      clearInterval(timer);
      setTick(null);
    };
  }, [value, running]);
  // A tick of an older value is never added to a newer one.
  return running && tick?.from === value ? value + tick.seconds : value;
};

// A bar filled from the left to how far along something is: `value` as a percentage, or out of
// `max` (style.mode).
const ProgressBar: React.FC<{ element: PrismaElement }> = ({ element }) => {
  const style = (element.style || {}) as ProgressStyle;
  const { value, max, running } = progressOf(element);
  const mode = progressMode(style);
  const shown = useAdvancingValue(value, running);
  const fraction = progressFraction(shown, max, mode);

  const width = toNumber(style.width, DEFAULT_PROGRESS_WIDTH);
  const height = toNumber(style.height, DEFAULT_PROGRESS_HEIGHT);
  const borderWidth = toNumber(style.borderWidth, DEFAULT_BORDER_WIDTH);
  const borderRadius = toNumber(style.borderRadius, DEFAULT_PROGRESS_RADIUS);

  const { dragSize, handle } = useElementResize(element, MIN_PROGRESS_SIZE);
  const size = dragSize ?? { width, height };

  return (
    <div
      role="progressbar"
      aria-label={element.name}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(fraction * 100)}
      style={{ position: "relative", width: `${size.width}px`, height: `${size.height}px`, flexShrink: 0 }}
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
