import { auth, prisma } from "../auth";
import { hasRole, higherRole, type AccessRole } from "../lib/sharing";
import type { ShareRole } from "../src/generated/prisma/client";
import { json } from "./cors";

export const authenticate = async (req: Request) => {
  return auth.api.getSession({ headers: req.headers });
};

export interface SessionUser {
  id: string;
  name: string;
}

// A share matches a user either through the linked account or, for invitations that haven't
// been linked yet (added by Twitch name before the user ever signed in), by name. Twitch
// names are case-insensitive.
export const shareMatch = (user: SessionUser) => ({
  OR: [
    { userId: user.id },
    { userId: null, twitchName: { equals: user.name, mode: "insensitive" as const } },
  ],
});

export interface OverlayAccess {
  overlay: { id: string; userId: string };
  role: AccessRole;
  isOwner: boolean;
}

/**
 * Resolves what the user may do with an overlay: the owner can do everything, anyone else
 * gets the higher of the roles from a share of this overlay and from an account share of its
 * owner. Returns null when the overlay doesn't exist or the user has no access to it.
 */
export const getOverlayAccess = async (
  user: SessionUser,
  overlayId: string
): Promise<OverlayAccess | null> => {
  const overlay = await prisma.overlay.findUnique({
    where: { id: overlayId },
    select: { id: true, userId: true },
  });
  if (!overlay) return null;

  if (overlay.userId === user.id) {
    return { overlay, role: "OWNER", isOwner: true };
  }

  const [overlayShare, accountShare] = await Promise.all([
    prisma.overlayShare.findFirst({
      where: { overlayId, ...shareMatch(user) },
      select: { role: true },
    }),
    prisma.accountShare.findFirst({
      where: { ownerId: overlay.userId, ...shareMatch(user) },
      select: { role: true },
    }),
  ]);

  const roles = [overlayShare?.role, accountShare?.role].filter((r): r is ShareRole => !!r);
  if (roles.length === 0) return null;
  return { overlay, role: roles.reduce(higherRole), isOwner: false };
};

export type AccessCheck = { access: OverlayAccess; error?: never } | { error: Response };

/**
 * Checks that the user has at least `required` on the overlay. Without any access the
 * overlay answers 404, so ids can't be probed; with too little it answers 403.
 */
export const requireOverlayRole = async (
  user: SessionUser,
  overlayId: string,
  required: AccessRole,
  notFoundMessage = "Overlay not found"
): Promise<AccessCheck> => {
  const access = await getOverlayAccess(user, overlayId);
  if (!access) {
    return { error: json({ error: notFoundMessage }, 404) };
  }
  if (!hasRole(access.role, required)) {
    return { error: json({ error: forbiddenMessage(required), requiredRole: required }, 403) };
  }
  return { access };
};

export const forbiddenMessage = (required: AccessRole) => {
  switch (required) {
    case "OWNER":
      return "Only the owner can do this";
    case "EDITOR":
      return "You need editor access to change this overlay";
    case "CONTROLLER":
      return "You need control access to change this overlay";
    default:
      return "Forbidden";
  }
};

// The role the user has on every overlay shared with them, directly or through an account
// share of its owner.
export const getSharedOverlayRoles = async (user: SessionUser) => {
  const [overlayShares, accountShares] = await Promise.all([
    prisma.overlayShare.findMany({
      where: shareMatch(user),
      select: { overlayId: true, role: true },
    }),
    prisma.accountShare.findMany({
      where: { ...shareMatch(user), ownerId: { not: user.id } },
      select: { ownerId: true, role: true },
    }),
  ]);

  const roles = new Map<string, ShareRole>();
  const grant = (overlayId: string, role: ShareRole) => {
    const current = roles.get(overlayId);
    roles.set(overlayId, current ? higherRole(current, role) : role);
  };

  overlayShares.forEach((share) => grant(share.overlayId, share.role));

  if (accountShares.length > 0) {
    const roleByOwner = new Map(accountShares.map((share) => [share.ownerId, share.role]));
    const overlays = await prisma.overlay.findMany({
      where: { userId: { in: [...roleByOwner.keys()] } },
      select: { id: true, userId: true },
    });
    overlays.forEach((overlay) => grant(overlay.id, roleByOwner.get(overlay.userId)!));
  }

  return roles;
};
