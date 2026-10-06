import { type FC, useMemo } from "react";
import type { BingoCrossStyle } from "@/lib/bingo";

interface BingoCrossProps {
  /** Size of the cell in pixels; the cross is drawn in the same units. */
  width: number;
  height: number;
  color: string;
  /** Stroke thickness in percent of the cell's shorter side. */
  thickness: number;
  /** 0–100. */
  opacity: number;
  variant: BingoCrossStyle;
  /** Varies the brush strokes, so the crosses on a card don't all look stamped on. */
  seed: number;
}

interface Point {
  x: number;
  y: number;
}

/** Small deterministic PRNG (mulberry32): every viewer sees the same strokes for a cell. */
const createRandom = (seed: number) => {
  let state = (seed * 0x9e3779b9) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const point = (x: number, y: number) => `${x.toFixed(1)} ${y.toFixed(1)}`;

/**
 * One dry brush stroke from `a` to `b`, `thickness` wide, as a list of bristle outlines.
 *
 * The stroke is made of thin bristles laid side by side. Each starts and ends at a slightly
 * different spot, more so towards the edges, which frays the ends; some break off for a
 * moment, which leaves the light streaks a brush running out of paint leaves; and a few stray
 * hairs fly past the ends.
 */
const brushStroke = (
  a: Point,
  b: Point,
  thickness: number,
  random: () => number,
): string[] => {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  const ux = (b.x - a.x) / length;
  const uy = (b.y - a.y) / length;
  // Across the stroke.
  const nx = -uy;
  const ny = ux;
  const at = (u: number, v: number) =>
    point(a.x + ux * u + nx * v, a.y + uy * u + ny * v);

  // A bristle from `start` to `end` along the stroke, `v` across it in the middle and `v0` /
  // `v1` at its ends, so bristles can splay out towards the ends like a pressed-down brush.
  // The ends are pointed, like the hairs of a brush.
  const bristle = (
    start: number,
    end: number,
    v0: number,
    v: number,
    v1: number,
    width: number,
  ) => {
    const span = end - start;
    if (span <= 0) return null;
    const middle = (start + end) / 2;
    const taper = Math.min(span * 0.12, thickness * 0.25);
    const vAt = (u: number) =>
      u < middle
        ? v0 + ((v - v0) * (u - start)) / (middle - start)
        : v + ((v1 - v) * (u - middle)) / (end - middle);
    const half = width / 2;
    return [
      `M ${at(start, v0)}`,
      `L ${at(start + taper, vAt(start + taper) - half)}`,
      `L ${at(middle, v - half)}`,
      `L ${at(end - taper, vAt(end - taper) - half)}`,
      `L ${at(end, v1)}`,
      `L ${at(end - taper, vAt(end - taper) + half)}`,
      `L ${at(middle, v + half)}`,
      `L ${at(start + taper, vAt(start + taper) + half)}`,
      "Z",
    ].join(" ");
  };

  const paths: string[] = [];
  const count = Math.round(Math.min(40, Math.max(12, thickness / 1.4)));
  const spacing = thickness / count;

  for (let i = 0; i < count; i++) {
    const offset = (i + 0.5) / count - 0.5;
    // 0 in the middle of the stroke, 1 at its edges.
    const edge = Math.abs(offset) * 2;
    const v = offset * thickness + (random() - 0.5) * spacing * 0.6;
    const width = spacing * (1.1 + random() * 0.6);
    const fray = () =>
      length * (0.005 + random() * 0.05 + edge * edge * random() * 0.16);
    const start = fray();
    const end = length - fray();
    // How far the bristle splays out at each end, more so at the edges of the stroke.
    const splay = () =>
      v * (1 + edge * (0.08 + random() * 0.22)) + (random() - 0.5) * spacing;
    const v0 = splay();
    const v1 = splay();

    // Some bristles run dry for a moment, more of them near the edges.
    if (random() < 0.12 + edge * 0.3) {
      const gapAt = start + (end - start) * (0.15 + random() * 0.7);
      const gap = length * (0.03 + random() * 0.12);
      const middle = (start + end) / 2;
      const vGap =
        gapAt < middle
          ? v0 + (v - v0) * ((gapAt - start) / (middle - start))
          : v + (v1 - v) * ((gapAt - middle) / (end - middle));
      for (const path of [
        bristle(start, gapAt - gap / 2, v0, (v0 + vGap) / 2, vGap, width),
        bristle(gapAt + gap / 2, end, vGap, (vGap + v1) / 2, v1, width),
      ]) {
        if (path) paths.push(path);
      }
    } else {
      const path = bristle(start, end, v0, v, v1, width);
      if (path) paths.push(path);
    }
  }

  // Stray hairs past both ends, a little off the stroke's direction.
  const strays = 3 + Math.floor(random() * 3);
  for (let i = 0; i < strays; i++) {
    const v = (random() - 0.5) * thickness * 1.1;
    const atStart = random() < 0.5;
    const reach = length * (0.08 + random() * 0.14);
    const overshoot = length * (0.01 + random() * 0.04);
    const tilt = (random() - 0.5) * thickness * 0.5;
    const width = spacing * (0.5 + random() * 0.5);
    const path = atStart
      ? bristle(-overshoot, reach, v + tilt, v + tilt / 2, v, width)
      : bristle(
          length - reach,
          length + overshoot,
          v,
          v + tilt / 2,
          v + tilt,
          width,
        );
    if (path) paths.push(path);
  }

  return paths;
};

/** The mark of a called cell. It sits behind the label, so it never hides the text. */
const BingoCross: FC<BingoCrossProps> = ({
  width,
  height,
  color,
  thickness,
  opacity,
  variant,
  seed,
}) => {
  const d = useMemo(() => {
    if (width <= 0 || height <= 0) return "";
    const size = Math.min(width, height);
    const stroke = Math.max(
      1,
      (size * Math.min(100, Math.max(1, thickness))) / 100,
    );

    if (variant === "line") {
      // Round caps reach past the line ends, so the inset makes room for them.
      const inset = size * 0.12 + stroke / 2;
      const [left, top, right, bottom] = [
        inset,
        inset,
        width - inset,
        height - inset,
      ];
      return `M ${left} ${top} L ${right} ${bottom} M ${right} ${top} L ${left} ${bottom}`;
    }

    // A brush stroke runs nearly corner to corner; its frayed ends fill the rest.
    const inset = size * 0.08;
    const [left, top, right, bottom] = [
      inset,
      inset,
      width - inset,
      height - inset,
    ];
    const random = createRandom(seed + 1);
    // Slightly off the corners, so the two strokes don't look ruled.
    const jitter = () => (random() - 0.5) * size * 0.06;
    return [
      ...brushStroke(
        { x: left + jitter(), y: top + jitter() },
        { x: right + jitter(), y: bottom + jitter() },
        stroke,
        random,
      ),
      ...brushStroke(
        { x: right + jitter(), y: top + jitter() },
        { x: left + jitter(), y: bottom + jitter() },
        stroke,
        random,
      ),
    ].join(" ");
  }, [width, height, thickness, variant, seed]);

  if (!d) return null;

  const stroke =
    (Math.min(width, height) * Math.min(100, Math.max(1, thickness))) / 100;

  return (
    <svg
      // Opacity on the whole drawing, so the spots where bristles overlap aren't darker.
      className="pointer-events-none absolute inset-0 animate-in fade-in zoom-in-90 duration-200"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ opacity: Math.min(100, Math.max(0, opacity)) / 100 }}
      aria-hidden="true"
      focusable="false"
    >
      {variant === "line" ? (
        <path
          d={d}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
        />
      ) : (
        <path d={d} fill={color} />
      )}
    </svg>
  );
};

export default BingoCross;
