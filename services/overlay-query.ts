import { prisma } from "../auth";

// Every overlay payload (HTTP responses and WebSocket broadcasts) has the same shape: the
// flat list of all elements, nested ones included, ordered by position. Clients rebuild the
// tree from `parentId`, so there is no depth limit and no duplicated nested copies.
export const overlayElementsInclude = {
  elements: {
    orderBy: { position: "asc" as const },
    include: {
      title: true,
      counter: true,
      timer: true,
      countdown: true,
      image: true,
      bingo: true,
    },
  },
};

export const findOverlayWithElements = (overlayId: string) =>
  prisma.overlay.findUnique({
    where: { id: overlayId },
    include: overlayElementsInclude,
  });

type Publisher = { publish: (channel: string, message: string) => unknown | Promise<unknown> };

// Response header carrying the revision of the broadcast a change went out with. A client
// keeps showing its own change until it has received that revision (or a later one).
export const REVISION_HEADER = "X-Overlay-Revision";
// Request header naming a change; the broadcast it causes carries the same id, so the client
// that made it knows that broadcast (and every later one) already contains it.
const WRITE_ID_HEADER = "X-Write-Id";

export const writeIdOf = (req: Request) => {
  const writeId = req.headers.get(WRITE_ID_HEADER);
  return writeId && /^[a-zA-Z0-9_-]{1,64}$/.test(writeId) ? writeId : null;
};

// Sends the overlay's current state to every live viewer and editor. Returns it so routes
// can reuse it for their response.
//
// Bumping the revision takes the overlay's row lock, so publishes of the same overlay run one
// after another and each snapshot is read after every change published before it. A snapshot
// with a higher revision therefore never lacks a change that a lower one contained, even when
// two requests finish at the same time.
export const publishOverlay = async (
  server: Publisher,
  overlayId: string,
  writeId: string | null = null
) => {
  const overlay = await prisma.$transaction(async (tx) => {
    const bumped = await tx.overlay.updateMany({
      where: { id: overlayId },
      data: { revision: { increment: 1 } },
    });
    if (bumped.count === 0) return null;
    return tx.overlay.findUnique({ where: { id: overlayId }, include: overlayElementsInclude });
  });
  if (overlay) {
    server.publish(`overlay-${overlayId}`, JSON.stringify(writeId ? { ...overlay, writeId } : overlay));
  }
  return overlay;
};

export const revisionHeaders = (overlay: { revision: number } | null): Record<string, string> =>
  overlay ? { [REVISION_HEADER]: String(overlay.revision) } : {};
