import { auth, prisma } from "../auth";

export const authenticate = async (req: Request) => {
  const session = await auth.api.getSession({ headers: req.headers });

  if (session?.user) {
    // Update Editor entries
    await prisma.editor.updateMany({
      where: {
        editorTwitchName: session.user.name,
        editorId: null,
      },
      data: {
        editorId: session.user.id,
      },
    });

    // Update OverlayEditor entries
    await prisma.overlayEditor.updateMany({
      where: {
        editorTwitchName: session.user.name,
        editorId: null,
      },
      data: {
        editorId: session.user.id,
      },
    });
  }

  return session;
};

export const authorize = async (userId: string, overlayId:string) => {
  const overlay = await prisma.overlay.findUnique({
    where: { id: overlayId },
    include: {
      editors: true,
    },
  });

  if (!overlay) {
    return false;
  }

  if (overlay.userId === userId) {
    return true;
  }

  const isOverlayEditor = overlay.editors.some(
    (editor) => editor.editorId === userId
  );

  return isOverlayEditor;
};