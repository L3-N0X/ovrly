import type { ProgressMode, PrismaElement, ProgressStyle } from "./types";

// Mirrors lib/progress.ts on the server: a progress bar shows `value` out of `max`.

export const DEFAULT_PROGRESS = { value: 50, max: 100, running: false } as const;

export const progressMode = (style: ProgressStyle | null | undefined): ProgressMode =>
  style?.mode === "values" ? "values" : "percent";

// How full the bar is, from 0 to 1. In percent mode `max` is ignored and `value` is a percentage.
export const progressFraction = (value: number, max: number, mode: ProgressMode) => {
  const total = mode === "percent" ? 100 : max;
  if (!(total > 0) || !Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value / total));
};

export const progressOf = (element: PrismaElement) => element.progress ?? DEFAULT_PROGRESS;
