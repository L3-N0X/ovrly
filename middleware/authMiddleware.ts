import { auth, prisma } from "../auth";

export const authenticate = async (req: Request) => {
  const session = await auth.api.getSession({ headers: req.headers });
  return session;
};

export const authorize = async (userId: string, overlayId: string) => {
  const overlay = await prisma.overlay.findUnique({
    where: { id: overlayId },
    include: {
      user: {
        include: {
          globalEditors: true,
        },
      },
      editors: true,
    },
  });

  if (!overlay) {
    return false;
  }

  if (overlay.userId === userId) {
    return true;
  }

  const isGlobalEditor = overlay.user.globalEditors.some(
    (editor) => editor.editorId === userId
  );

  if (isGlobalEditor) {
    return true;
  }

  const isOverlayEditor = overlay.editors.some(
    (editor) => editor.editorId === userId
  );

  return isOverlayEditor;
};