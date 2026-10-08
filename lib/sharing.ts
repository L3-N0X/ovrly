import type { ShareRole } from "../src/generated/prisma/client";

// What someone can do with an overlay. The owner can do everything an editor can, and is the
// only one who decides who else gets access and who can delete it.
export type AccessRole = ShareRole | "OWNER";

export const SHARE_ROLES: readonly ShareRole[] = ["VIEWER", "CONTROLLER", "EDITOR"];

const RANK: Record<AccessRole, number> = { VIEWER: 1, CONTROLLER: 2, EDITOR: 3, OWNER: 4 };

export const hasRole = (role: AccessRole, required: AccessRole) => RANK[role] >= RANK[required];

// Someone shared both directly and through an account share gets whichever allows more.
export const higherRole = <T extends AccessRole>(a: T, b: T): T => (RANK[a] >= RANK[b] ? a : b);

export const parseShareRole = (value: unknown): ShareRole | null =>
  typeof value === "string" && (SHARE_ROLES as readonly string[]).includes(value)
    ? (value as ShareRole)
    : null;

// Twitch logins are letters, digits and underscores, display names can also hold non-latin
// letters. A leading "@" (as typed in chat) is dropped.
const TWITCH_NAME_PATTERN = /^[\p{L}\p{N}_]{1,50}$/u;

export const parseTwitchName = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/^@/, "");
  return TWITCH_NAME_PATTERN.test(name) ? name : null;
};

// Twitch names are case-insensitive, so people are told apart by the lower-cased name.
export const personKey = (name: string) => name.toLowerCase();
