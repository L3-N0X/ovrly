// What a progress bar shows: `value` out of `max`, and whether it moves on by itself between
// updates (Progress in prisma/schema.prisma). Mirrored by src/lib/progress.ts.

export const DEFAULT_PROGRESS = { value: 50, max: 100, running: false } as const;

// Big enough for any count or length of time in seconds, small enough to stay exact.
const LIMIT = 1e12;

const isAmount = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= LIMIT;

export type ProgressPatch = { value?: number; max?: number; running?: boolean };

// The changes a controller sends; null when one of them is invalid. `max` has to be above 0,
// since the bar is filled to value / max.
export const parseProgressPatch = (data: Record<string, unknown>): ProgressPatch | null => {
  const patch: ProgressPatch = {};
  if (data.value !== undefined) {
    if (!isAmount(data.value)) return null;
    patch.value = data.value;
  }
  if (data.max !== undefined) {
    if (!isAmount(data.max) || data.max <= 0) return null;
    patch.max = data.max;
  }
  if (data.running !== undefined) {
    if (typeof data.running !== "boolean") return null;
    patch.running = data.running;
  }
  return patch;
};

// The progress of an element copied from presets, imports and duplicates, which may be user
// supplied: valid values are taken over, anything else is the default.
export const progressSeed = (value: unknown) => {
  const seed = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const patch = parseProgressPatch({
    value: isAmount(seed.value) ? seed.value : undefined,
    max: isAmount(seed.max) && seed.max > 0 ? seed.max : undefined,
    running: typeof seed.running === "boolean" ? seed.running : undefined,
  });
  return { ...DEFAULT_PROGRESS, ...patch };
};
