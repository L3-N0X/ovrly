// A wheel of fortune (the Wheel model). Its labels go around it clockwise from the top as equal
// segments, and the pointer sits at the top. Mirrored by src/lib/wheel.ts, which draws it.
//
// Like videos, wheels are run through actions. A spin is decided here, with the server's
// randomness, and stored as a turn from one rotation to another, so everyone watching sees the
// same spin land on the same segment.

export const WHEEL_MAX_FIELDS = 100;
export const WHEEL_MAX_FIELD_LENGTH = 80;
export const DEFAULT_WHEEL_FIELDS = ["Yes", "No", "Maybe", "Ask chat", "Try again", "Definitely"];

// How long a spin turns for, in seconds (`spinDuration` in the element's style).
const DEFAULT_SPIN_SECONDS = 5;
const MIN_SPIN_SECONDS = 1;
const MAX_SPIN_SECONDS = 30;

export interface WheelState {
  fields: string[];
  result: string | null;
  fromRotation: number;
  rotation: number;
  spunAt: Date | null;
  duration: number;
}

export type WheelAction =
  | { type: "spin" }
  // Hides the result; the wheel stays where it stopped.
  | { type: "clear" };

// More than enough for any burst of clicks that gets coalesced into one request.
const MAX_ACTIONS = 100;

/** A label on one line: newlines and control characters would break the wheel's text. */
export const sanitizeWheelField = (value: unknown): string =>
  typeof value === "string"
    ? value
        .replace(/[\r\n\t\v\f]+/g, " ")
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u001f\u007f]/g, "")
        .slice(0, WHEEL_MAX_FIELD_LENGTH)
    : "";

/** The labels, or null when `value` isn't a list of them. Empty ones are kept. */
export const parseWheelFields = (value: unknown): string[] | null =>
  Array.isArray(value) &&
  value.length <= WHEEL_MAX_FIELDS &&
  value.every((field) => typeof field === "string")
    ? value.map(sanitizeWheelField)
    : null;

/** The labels that get a segment, in order. */
export const wheelSegments = (fields: unknown): string[] =>
  (Array.isArray(fields) ? fields : [])
    .map((field) => sanitizeWheelField(field).trim())
    .filter((field) => field.length > 0);

const spinSecondsOf = (style: unknown) => {
  const value = (style as { spinDuration?: unknown } | null)?.spinDuration;
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(MAX_SPIN_SECONDS, Math.max(MIN_SPIN_SECONDS, value))
    : DEFAULT_SPIN_SECONDS;
};

// A uniform random number in [0, 1) from the system's secure source, so nobody can predict a spin.
const random = () => crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32;

/**
 * Applies an action at `now`. A spin picks one of the segments at random and works out the turn
 * that stops it under the pointer, a few full turns past where the wheel stands (more for longer
 * spins). It stops somewhere inside the segment, never right on an edge, so it can't look
 * undecided. Spinning while the wheel still turns, or without any labels, does nothing: it would
 * jump, and a click by someone else a moment earlier already started a spin.
 */
export const applyWheelAction = (
  wheel: WheelState,
  action: WheelAction,
  style: unknown,
  now: number
): WheelState => {
  if (action.type === "clear") return { ...wheel, result: null };

  const segments = wheelSegments(wheel.fields);
  const spinning = !!wheel.spunAt && wheel.spunAt.getTime() + wheel.duration > now;
  if (segments.length === 0 || spinning) return wheel;

  const seconds = spinSecondsOf(style);
  const index = Math.floor(random() * segments.length);
  const segment = 360 / segments.length;
  // Where in the segment it stops, clockwise from its start.
  const within = segment * (0.15 + random() * 0.7);
  // Turned by R degrees, the pointer at the top points at the angle -R of the wheel itself.
  const from = ((wheel.rotation % 360) + 360) % 360;
  const target = (((-(index * segment + within) - from) % 360) + 360) % 360;
  const turns = Math.max(2, Math.round(seconds * 1.2));

  return {
    ...wheel,
    result: segments[index]!,
    fromRotation: from,
    rotation: from + turns * 360 + target,
    spunAt: new Date(now),
    duration: Math.round(seconds * 1000),
  };
};

const WHEEL_ACTION_TYPES = new Set(["spin", "clear"]);

export const parseWheelActions = (value: unknown): WheelAction[] | null => {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_ACTIONS) return null;
  const actions = value.map((action) => {
    const type = (action as { type?: unknown } | null)?.type;
    return typeof type === "string" && WHEEL_ACTION_TYPES.has(type) ? ({ type } as WheelAction) : null;
  });
  return actions.every((action) => action !== null) ? (actions as WheelAction[]) : null;
};

// The labels of a wheel copied from presets, imports and duplicates, which may be user supplied.
// A copy keeps its labels but hasn't been spun yet.
export const wheelSeed = (value: unknown) => {
  const fields = parseWheelFields((value as { fields?: unknown } | null)?.fields);
  return { fields: fields ?? DEFAULT_WHEEL_FIELDS };
};
