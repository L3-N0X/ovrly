// Formats a length of time for timers and countdowns. Formats use D for days, H for hours,
// m for minutes and s for seconds (doubled for a leading zero), and show text in [brackets]
// as written. The largest unit in the format holds everything above it, so "HH:mm:ss" shows
// 50:00:00 for two days and two hours instead of starting over at 00 each day.

const TOKEN = /\[([^\]]*)\]|D+|H+|h+|m+|s+/g;

const UNITS: [unit: string, ms: number][] = [
  ["D", 86_400_000],
  ["H", 3_600_000],
  ["m", 60_000],
  ["s", 1000],
];

export const DEFAULT_DURATION_FORMAT = "HH:mm:ss";

// h is read as H, as moment.js formats (which timers used before) knew both.
const unitOf = (token: string) => (token[0] === "h" ? "H" : token[0]);

export const formatDuration = (ms: number, format = DEFAULT_DURATION_FORMAT) => {
  const used = new Set(
    [...format.matchAll(TOKEN)].filter(([token]) => token[0] !== "[").map(([token]) => unitOf(token))
  );
  let rest = Math.max(0, Math.floor(ms / 1000) * 1000);
  const values: Record<string, number> = {};
  for (const [unit, unitMs] of UNITS) {
    if (!used.has(unit)) continue;
    values[unit] = Math.floor(rest / unitMs);
    rest -= values[unit] * unitMs;
  }
  return format.replace(TOKEN, (token, literal: string | undefined) =>
    literal !== undefined ? literal : String(values[unitOf(token)]).padStart(token.length, "0")
  );
};

// A length of time as entered in hours, minutes and seconds.
export type DurationParts = Record<"hours" | "minutes" | "seconds", number>;

export const ZERO_DURATION: DurationParts = { hours: 0, minutes: 0, seconds: 0 };

export const durationPartsToMs = ({ hours, minutes, seconds }: DurationParts) =>
  (hours * 3600 + minutes * 60 + seconds) * 1000;

export const msToDurationParts = (ms: number): DurationParts => {
  const total = Math.max(0, Math.round(ms / 1000));
  return {
    hours: Math.floor(total / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
};
