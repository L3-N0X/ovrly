import { auth, prisma } from "../auth";

export const authenticate = async (req: Request) => {
  return auth.api.getSession({ headers: req.headers });
};

export interface SessionUser {
  id: string;
  name: string;
}

// An editor entry matches a user either through the linked account or, for invitations that
// haven't been linked yet (added by Twitch name before the user ever signed in), by name.
// Twitch names are case-insensitive.
const editorMatch = (user: SessionUser) => ({
  OR: [
    { editorId: user.id },
    { editorId: null, editorTwitchName: { equals: user.name, mode: "insensitive" as const } },
  ],
});

/**
 * Resolves what the user may do with an overlay. Access is granted to the owner, to editors
 * the overlay was shared with directly, and to the owner's global editors (Settings page).
 * Returns null when the overlay doesn't exist or the user has no access to it.
 */
export const getOverlayAccess = async (user: SessionUser, overlayId: string) => {
  const overlay = await prisma.overlay.findUnique({
    where: { id: overlayId },
    select: { id: true, userId: true },
  });
  if (!overlay) return null;

  if (overlay.userId === user.id) {
    return { overlay, isOwner: true };
  }

  const [overlayEditor, globalEditor] = await Promise.all([
    prisma.overlayEditor.findFirst({
      where: { overlayId, ...editorMatch(user) },
      select: { id: true },
    }),
    prisma.editor.findFirst({
      where: { ownerId: overlay.userId, ...editorMatch(user) },
      select: { id: true },
    }),
  ]);

  return overlayEditor || globalEditor ? { overlay, isOwner: false } : null;
};

export const authorize = async (user: SessionUser, overlayId: string) => {
  return (await getOverlayAccess(user, overlayId)) !== null;
};

// Ids of every overlay shared with the user, directly or through a global editor entry.
export const getSharedOverlayIds = async (user: SessionUser) => {
  const [overlayEditors, globalEditors] = await Promise.all([
    prisma.overlayEditor.findMany({ where: editorMatch(user), select: { overlayId: true } }),
    prisma.editor.findMany({ where: editorMatch(user), select: { ownerId: true } }),
  ]);

  const ownerIds = globalEditors.map((e) => e.ownerId).filter((id) => id !== user.id);
  const ownedByOwners =
    ownerIds.length > 0
      ? await prisma.overlay.findMany({ where: { userId: { in: ownerIds } }, select: { id: true } })
      : [];

  return [...new Set([...overlayEditors.map((e) => e.overlayId), ...ownedByOwners.map((o) => o.id)])];
};
