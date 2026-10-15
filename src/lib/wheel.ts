// Wheels of fortune: the labels go around clockwise from the top as equal segments, and a spin
// stops one of them under the pointer at the top. The server decides spins (lib/wheel.ts, which
// this mirrors); this works out how a wheel looks and where it is while it turns.

import {
  oklabToOklch,
  oklabToRgb,
  oklchToOklab,
  parseColor,
  rgbaToHex,
  rgbToOklab,
  type Oklch,
} from "./color";
import type { PrismaElement, WheelStyle } from "./types";

export const WHEEL_MAX_FIELDS = 100;
export const WHEEL_MAX_FIELD_LENGTH = 80;

export const DEFAULT_WHEEL_SIZE = 480;
// Blue round to purple. The two are close in lightness, so the gradient doesn't fade on the way.
export const DEFAULT_WHEEL_COLOR_FROM = "#3b82f6";
export const DEFAULT_WHEEL_COLOR_TO = "#a855f7";
export const DEFAULT_WHEEL_LIGHTNESS_STEP = 10;
export const DEFAULT_WHEEL_BORDER_WIDTH = 6;
export const DEFAULT_WHEEL_FONT_SIZE = 32;
export const DEFAULT_WHEEL_RESULT_FONT_SIZE = 56;
export const DEFAULT_SPIN_SECONDS = 5;

export const WHEEL_SIZE_RANGE = { min: 80, max: 2000 };
export const WHEEL_LIGHTNESS_STEP_RANGE = { min: 0, max: 40 };
export const SPIN_SECONDS_RANGE = { min: 1, max: 30 };

export type WheelState = NonNullable<PrismaElement["wheel"]>;

export type WheelAction = { type: "spin" } | { type: "clear" };

// The local change an action makes before the server answers. A spin is left to the server,
// which picks where it lands; the wheel starts turning once that arrives.
export const applyWheelAction = (wheel: WheelState, action: WheelAction): WheelState =>
  action.type === "clear" ? { ...wheel, result: null } : wheel;

/** A label on one line, as the server stores it. */
export const sanitizeWheelField = (value: string) =>
  // eslint-disable-next-line no-control-regex
  value.replace(/[\r\n\t\v\f]+/g, " ").replace(/[\u0000-\u001f\u007f]/g, "").slice(0, WHEEL_MAX_FIELD_LENGTH);

/** The labels that get a segment, in order: every one that isn't empty. */
export const wheelSegments = (fields: readonly string[] | null | undefined): string[] =>
  (fields ?? []).map((field) => field.trim()).filter((field) => field.length > 0);

const num = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** The style with every default filled in. Font and shadow keys are kept as they are. */
export const resolveWheelStyle = (style: WheelStyle | null | undefined) => ({
  ...style,
  width: Math.max(WHEEL_SIZE_RANGE.min, num(style?.width, DEFAULT_WHEEL_SIZE)),
  colorFrom: style?.colorFrom || DEFAULT_WHEEL_COLOR_FROM,
  colorTo: style?.colorTo || DEFAULT_WHEEL_COLOR_TO,
  lightnessStep: clamp(
    num(style?.lightnessStep, DEFAULT_WHEEL_LIGHTNESS_STEP),
    WHEEL_LIGHTNESS_STEP_RANGE.min,
    WHEEL_LIGHTNESS_STEP_RANGE.max
  ),
  color: style?.color || "#ffffff",
  fontSize: Math.max(1, num(style?.fontSize, DEFAULT_WHEEL_FONT_SIZE)),
  borderColor: style?.borderColor || "#ffffff",
  borderWidth: Math.max(0, num(style?.borderWidth, DEFAULT_WHEEL_BORDER_WIDTH)),
  pointerColor: style?.pointerColor || "#ffffff",
  spinDuration: clamp(
    num(style?.spinDuration, DEFAULT_SPIN_SECONDS),
    SPIN_SECONDS_RANGE.min,
    SPIN_SECONDS_RANGE.max
  ),
  showResult: style?.showResult !== false,
  resultFontSize: Math.max(1, num(style?.resultFontSize, DEFAULT_WHEEL_RESULT_FONT_SIZE)),
  resultDuration: Math.max(0, num(style?.resultDuration, 0)),
});

const toOklch = (color: string): Oklch & { alpha: number } => {
  const rgba = parseColor(color) ?? { r: 0, g: 0, b: 0, a: 1 };
  return { ...oklabToOklch(rgbToOklab(rgba)), alpha: rgba.a };
};

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

// Along the shorter way round the hue circle, so blue to purple doesn't pass through green.
const mixHue = (a: number, b: number, t: number) => {
  const delta = ((((b - a) % 360) + 540) % 360) - 180;
  return (a + delta * t + 360) % 360;
};

/**
 * The colour of every segment. The hue runs from `colorFrom` to `colorTo` halfway round the wheel
 * and back again, mixed in OKLCH so the steps look even and keep their vividness, and every other
 * segment is a little lighter or darker so neighbours stand apart. With an odd count the last
 * segment sits between two of the same shade, so it gets the unshifted one.
 */
export const wheelColors = (count: number, style: ReturnType<typeof resolveWheelStyle>) => {
  const from = toOklch(style.colorFrom);
  const to = toOklch(style.colorTo);
  // A grey has no hue of its own, so it takes the other colour's.
  const fromHue = from.c < 0.02 ? to.h : from.h;
  const toHue = to.c < 0.02 ? from.h : to.h;
  const step = style.lightnessStep / 100;

  return Array.from({ length: count }, (_, index) => {
    const t = count < 2 ? 0 : 1 - Math.abs(1 - (2 * index) / count);
    const unshifted = count % 2 === 1 && index === count - 1 && count > 1;
    const shade = unshifted ? 0 : index % 2 === 0 ? step / 2 : -step / 2;
    const color = oklabToRgb(
      oklchToOklab({
        l: clamp(mix(from.l, to.l, t) + shade, 0, 1),
        c: mix(from.c, to.c, t),
        h: mixHue(fromHue, toHue, t),
      }),
      mix(from.alpha, to.alpha, t)
    );
    return rgbaToHex(color);
  });
};

// Fast at first, then slowing down for a long while, the way a wheel spun by hand does.
const easeOut = (progress: number) => 1 - (1 - progress) ** 4;

/** Where the wheel is turned to at `now` (degrees clockwise), and whether it is still turning. */
export const wheelRotationAt = (
  spin: { fromRotation: number; rotation: number; duration: number },
  startedAt: number,
  now: number
) => {
  const progress = spin.duration > 0 ? clamp((now - startedAt) / spin.duration, 0, 1) : 1;
  return {
    rotation: spin.fromRotation + (spin.rotation - spin.fromRotation) * easeOut(progress),
    turning: progress < 1,
  };
};

/** The segment under the pointer at the top while the wheel is turned by `rotation` degrees. */
export const segmentAtPointer = (rotation: number, count: number) => {
  if (count === 0) return -1;
  const angle = (((-rotation % 360) + 360) % 360) / (360 / count);
  return Math.min(count - 1, Math.floor(angle));
};

/**
 * The one font size every label is drawn at: the largest (up to `maxSize`) at which the longest
 * label fits along its segment, between the hub and the rim, and the narrow inner end of the
 * segment is still tall enough for it. `widthAt1px` measures a label at a font size of 1.
 */
export const fitLabelSize = ({
  labels,
  widthAt1px,
  innerRadius,
  outerRadius,
  maxSize,
}: {
  labels: string[];
  widthAt1px: (label: string) => number;
  innerRadius: number;
  outerRadius: number;
  maxSize: number;
}) => {
  if (labels.length === 0) return maxSize;
  const room = Math.max(0, outerRadius - innerRadius);
  // Half the segment's angle; a segment wider than a half circle is as roomy as a half circle.
  const sine = Math.sin(Math.min(Math.PI / labels.length, Math.PI / 2));
  const LINE_HEIGHT = 1.2;
  let size = maxSize;
  for (const label of labels) {
    const k = widthAt1px(label);
    if (k <= 0) continue;
    // Its inner end sits k * size inside the rim, where the segment is 2 r sin(half angle) wide.
    const tall = (2 * outerRadius * sine) / (LINE_HEIGHT + 2 * k * sine);
    size = Math.min(size, room / k, tall);
  }
  return Math.max(4, Math.floor(size * 10) / 10);
};
