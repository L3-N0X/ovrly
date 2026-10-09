import type { PrismaElement } from "./types";

// Mirrors lib/subathon.ts on the server, which applies the same actions and settings to the
// stored subathon (and adds the Twitch events). Here they only update the editor right away,
// until the server's result arrives.

export type SubathonState = NonNullable<PrismaElement["subathon"]>;

export type SubathonAction =
  | { type: "start" }
  | { type: "pause" }
  | { type: "reset" }
  | { type: "addTime"; ms: number }
  | { type: "setMultiplier"; value: number };

export type SubathonSettings = Partial<
  Pick<
    SubathonState,
    | "duration"
    | "channelId"
    | "tier1Ms"
    | "tier2Ms"
    | "tier3Ms"
    | "bitsMs"
    | "maxRemaining"
    | "countWhilePaused"
  >
>;

// The longest the server stores, a year.
export const MAX_SUBATHON_MS = 365 * 24 * 60 * 60 * 1000;
// What one sub or 100 bits may add, a day.
export const MAX_RATE_MS = 24 * 60 * 60 * 1000;
// The multipliers offered for a happy hour.
export const MULTIPLIERS = [1, 2, 3] as const;
// How long an overlay shows what an event added.
export const ADDED_VISIBLE_MS = 4000;

const clamp = (ms: number) => Math.min(MAX_SUBATHON_MS, Math.max(0, Math.round(ms)));
const iso = (ms: number) => new Date(ms).toISOString();
const time = (date: string) => new Date(date).getTime();

// The timing in the shape useCountdown takes.
export const subathonTiming = (subathon: SubathonState | null | undefined) =>
  subathon
    ? {
        mode: "DURATION" as const,
        remaining: subathon.remaining,
        endsAt: subathon.endsAt,
        targetAt: null,
      }
    : null;

// Whether it is running and has run out.
export const isSubathonOver = (subathon: Pick<SubathonState, "endsAt">, now = Date.now()) =>
  subathon.endsAt !== null && time(subathon.endsAt) <= now;

export const applySubathonAction = (
  subathon: SubathonState,
  action: SubathonAction,
  now: number
): SubathonState => {
  switch (action.type) {
    case "start":
      return subathon.endsAt || subathon.remaining <= 0
        ? subathon
        : { ...subathon, endsAt: iso(now + subathon.remaining) };
    case "pause":
      return subathon.endsAt
        ? { ...subathon, endsAt: null, remaining: clamp(time(subathon.endsAt) - now) }
        : subathon;
    case "reset":
      return {
        ...subathon,
        endsAt: null,
        remaining: subathon.duration,
        subs: 0,
        bits: 0,
        addedMs: 0,
        lastAddedMs: 0,
        lastAddedAt: null,
      };
    case "addTime": {
      if (!subathon.endsAt) {
        return { ...subathon, remaining: clamp(subathon.remaining + action.ms) };
      }
      // Time added after it ran out counts from now, not from when it ran out.
      const left = Math.max(0, time(subathon.endsAt) - now);
      return { ...subathon, endsAt: iso(now + clamp(left + action.ms)) };
    }
    case "setMultiplier":
      return { ...subathon, multiplier: action.value };
  }
};

// A new starting length also becomes the time left as long as the subathon hasn't started yet.
export const applySubathonSettings = (
  subathon: SubathonState,
  settings: SubathonSettings
): SubathonState => {
  const untouched =
    !subathon.endsAt && subathon.remaining === subathon.duration && subathon.addedMs === 0;
  const next = { ...subathon, ...settings };
  if (settings.duration !== undefined && untouched) next.remaining = settings.duration;
  return next;
};

// A length of time as people say it: "+1h 30m", "+45s".
export const formatAdded = (ms: number) => {
  const total = Math.round(ms / 1000);
  const parts = [
    [Math.floor(total / 86_400), "d"],
    [Math.floor((total % 86_400) / 3600), "h"],
    [Math.floor((total % 3600) / 60), "m"],
    [total % 60, "s"],
  ] as const;
  const shown = parts.filter(([value]) => value > 0).map(([value, unit]) => `${value}${unit}`);
  return `+${shown.length > 0 ? shown.join(" ") : "0s"}`;
};
