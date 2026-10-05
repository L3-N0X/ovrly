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

// Sends the overlay's current state to every live viewer and editor. Returns it so routes
// can reuse it for their response.
export const publishOverlay = async (server: Publisher, overlayId: string) => {
  const overlay = await findOverlayWithElements(overlayId);
  if (overlay) {
    server.publish(`overlay-${overlayId}`, JSON.stringify(overlay));
  }
  return overlay;
};
