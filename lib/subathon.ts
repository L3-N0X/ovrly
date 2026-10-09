// A subathon is a countdown that Twitch events add time to: every sub (by tier) and every cheer
// (per 100 bits) of a channel. It is run through actions like a countdown (see lib/countdown.ts),
// so two people using it at once both get what they clicked, and its settings are patched apart
// from them. Mirrored by src/lib/subathon.ts for the optimistic update in the editor; the Twitch
// events themselves arrive through services/twitch-events.ts.
//
// Events add to the time left, also while it is paused (unless switched off, e.g. to keep
// subs from before the stream from counting). Once it has run out, the subathon is over:
// events no longer add time, though adding it by hand still starts it again.

export interface SubathonState {
  duration: number;
  remaining: number;
  endsAt: Date | null;
  channelId: string | null;
  tier1Ms: number;
  tier2Ms: number;
  tier3Ms: number;
  bitsMs: number;
  multiplier: number;
  maxRemaining: number | null;
  countWhilePaused: boolean;
  subs: number;
  bits: number;
  addedMs: number;
  lastAddedMs: number;
  lastAddedAt: Date | null;
}

export type SubathonAction =
  | { type: "start" }
  | { type: "pause" }
  | { type: "reset" }
  | { type: "addTime"; ms: number }
  | { type: "setMultiplier"; value: number };

// Something that happened on the channel.
export type SubathonEvent = { kind: "sub"; tier: 1 | 2 | 3 } | { kind: "bits"; bits: number };

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

// More than enough for any burst of clicks that gets coalesced into one request.
const MAX_ACTIONS = 100;
// A year: longer than any subathon, short enough to keep dates representable.
export const MAX_SUBATHON_MS = 365 * 24 * 60 * 60 * 1000;
// What one sub or 100 bits may add, a day. The columns are Ints.
export const MAX_RATE_MS = 24 * 60 * 60 * 1000;
export const MAX_MULTIPLIER = 10;

// Only the stored state, without the row's ids, so it can be written back.
export const subathonColumns = (subathon: SubathonState): SubathonState => ({
  duration: subathon.duration,
  remaining: subathon.remaining,
  endsAt: subathon.endsAt,
  channelId: subathon.channelId,
  tier1Ms: subathon.tier1Ms,
  tier2Ms: subathon.tier2Ms,
  tier3Ms: subathon.tier3Ms,
  bitsMs: subathon.bitsMs,
  multiplier: subathon.multiplier,
  maxRemaining: subathon.maxRemaining,
  countWhilePaused: subathon.countWhilePaused,
  subs: subathon.subs,
  bits: subathon.bits,
  addedMs: subathon.addedMs,
  lastAddedMs: subathon.lastAddedMs,
  lastAddedAt: subathon.lastAddedAt,
});

const clamp = (ms: number) => Math.min(MAX_SUBATHON_MS, Math.max(0, Math.round(ms)));

// Whether it is running and has run out.
export const isSubathonOver = (subathon: Pick<SubathonState, "endsAt">, now: number) =>
  subathon.endsAt !== null && subathon.endsAt.getTime() <= now;

const timeLeft = (subathon: SubathonState, now: number) =>
  subathon.endsAt ? Math.max(0, subathon.endsAt.getTime() - now) : subathon.remaining;

// Sets the time left, whether it is running or paused.
const withTimeLeft = (subathon: SubathonState, left: number, now: number): SubathonState =>
  subathon.endsAt
    ? { ...subathon, endsAt: new Date(now + clamp(left)) }
    : { ...subathon, remaining: clamp(left) };

export const applySubathonAction = (
  subathon: SubathonState,
  action: SubathonAction,
  now: number
): SubathonState => {
  switch (action.type) {
    case "start":
      return subathon.endsAt || subathon.remaining <= 0
        ? subathon
        : { ...subathon, endsAt: new Date(now + subathon.remaining) };
    case "pause":
      return subathon.endsAt
        ? { ...subathon, endsAt: null, remaining: clamp(subathon.endsAt.getTime() - now) }
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
    case "addTime":
      // Time added after it ran out counts from now, not from when it ran out.
      return withTimeLeft(subathon, timeLeft(subathon, now) + action.ms, now);
    case "setMultiplier":
      return { ...subathon, multiplier: action.value };
  }
};

// The time an event is worth, before the cap.
export const eventMs = (subathon: SubathonState, event: SubathonEvent) => {
  const base =
    event.kind === "sub"
      ? { 1: subathon.tier1Ms, 2: subathon.tier2Ms, 3: subathon.tier3Ms }[event.tier]
      : (event.bits * subathon.bitsMs) / 100;
  return Math.round(base * subathon.multiplier);
};

// The subathon after an event, or null when the event doesn't count (it is over, or paused
// and not counting while paused).
export const applySubathonEvent = (
  subathon: SubathonState,
  event: SubathonEvent,
  now: number
): SubathonState | null => {
  if (isSubathonOver(subathon, now)) return null;
  if (!subathon.endsAt && !subathon.countWhilePaused) return null;
  const left = timeLeft(subathon, now);
  let next = left + eventMs(subathon, event);
  // The cap only keeps events from going past it; time added by hand may.
  if (subathon.maxRemaining !== null) next = Math.max(left, Math.min(next, subathon.maxRemaining));
  const added = clamp(next) - left;
  return {
    ...withTimeLeft(subathon, next, now),
    subs: subathon.subs + (event.kind === "sub" ? 1 : 0),
    bits: subathon.bits + (event.kind === "bits" ? event.bits : 0),
    addedMs: subathon.addedMs + added,
    ...(added > 0 ? { lastAddedMs: added, lastAddedAt: new Date(now) } : {}),
  };
};

// Applies settings. A new starting length also becomes the time left as long as the subathon
// hasn't started yet; after that it only applies from the next reset.
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

const isInteger = (value: unknown, min: number, max: number): value is number =>
  Number.isInteger(value) && (value as number) >= min && (value as number) <= max;

const parseSubathonAction = (value: unknown): SubathonAction | null => {
  if (!value || typeof value !== "object") return null;
  const action = value as Record<string, unknown>;
  switch (action.type) {
    case "start":
    case "pause":
    case "reset":
      return { type: action.type };
    case "addTime":
      return isInteger(action.ms, -MAX_SUBATHON_MS, MAX_SUBATHON_MS)
        ? { type: "addTime", ms: action.ms }
        : null;
    case "setMultiplier":
      return typeof action.value === "number" &&
        Number.isFinite(action.value) &&
        action.value > 0 &&
        action.value <= MAX_MULTIPLIER
        ? { type: "setMultiplier", value: action.value }
        : null;
    default:
      return null;
  }
};

export const parseSubathonActions = (value: unknown): SubathonAction[] | null => {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_ACTIONS) return null;
  const actions = value.map(parseSubathonAction);
  return actions.every((action) => action !== null) ? (actions as SubathonAction[]) : null;
};

// Twitch user ids are numeric.
const isChannelId = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9]{1,20}$/.test(value);

// The settings in a patch, or null when one of them is invalid. Keys left out stay as they are.
export const parseSubathonSettings = (value: unknown): SubathonSettings | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const settings: SubathonSettings = {};
  if (input.duration !== undefined) {
    if (!isInteger(input.duration, 0, MAX_SUBATHON_MS)) return null;
    settings.duration = input.duration;
  }
  if (input.channelId !== undefined) {
    if (input.channelId !== null && !isChannelId(input.channelId)) return null;
    settings.channelId = input.channelId;
  }
  for (const key of ["tier1Ms", "tier2Ms", "tier3Ms", "bitsMs"] as const) {
    if (input[key] === undefined) continue;
    if (!isInteger(input[key], 0, MAX_RATE_MS)) return null;
    settings[key] = input[key];
  }
  if (input.maxRemaining !== undefined) {
    if (input.maxRemaining !== null && !isInteger(input.maxRemaining, 1000, MAX_SUBATHON_MS)) {
      return null;
    }
    settings.maxRemaining = input.maxRemaining;
  }
  if (input.countWhilePaused !== undefined) {
    if (typeof input.countWhilePaused !== "boolean") return null;
    settings.countWhilePaused = input.countWhilePaused;
  }
  return settings;
};

const SEED_KEYS = [
  "duration",
  "tier1Ms",
  "tier2Ms",
  "tier3Ms",
  "bitsMs",
  "maxRemaining",
  "countWhilePaused",
] as const;

// The settings of a subathon copied from presets and duplicates, which may be user supplied:
// only valid values are taken over, and a copy starts out paused at its starting length with
// nothing counted yet. The channel isn't copied: copies listen to their owner's own channel.
export const subathonSeed = (value: unknown) => {
  const seed = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const settings: SubathonSettings = {};
  for (const key of SEED_KEYS) {
    if (seed[key] === undefined) continue;
    Object.assign(settings, parseSubathonSettings({ [key]: seed[key] }));
  }
  return { ...settings, remaining: settings.duration };
};
