import { prisma } from "../auth";
import type { Prisma } from "../src/generated/prisma/client";

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
      subathon: true,
      image: true,
      bingo: true,
      icon: true,
      progress: true,
      cycleStack: true,
      bindings: { select: { property: true, source: true, key: true } },
    },
  },
};

type Db = typeof prisma | Prisma.TransactionClient;

interface BoundOverlay {
  userId: string;
  elements: { bindings: { source: string; key: string }[] }[];
}

const variableSelect = { source: true, key: true, type: true, value: true } as const;

// Adds `variables` to each overlay: the variables of its owner that its elements are bound
// to, which the clients put in place of the bound properties (src/lib/bindings.ts). Only those,
// because anyone with an overlay's id can load it (OBS), and an account's other variables are
// none of their business.
export const withVariables = async <T extends BoundOverlay>(db: Db, overlays: T[]) => {
  const targetsOf = (overlay: BoundOverlay) =>
    new Set(overlay.elements.flatMap((el) => el.bindings.map((b) => `${b.source}/${b.key}`)));
  const byOwner = new Map<string, Set<string>>();
  for (const overlay of overlays) {
    const targets = byOwner.get(overlay.userId) ?? new Set<string>();
    targetsOf(overlay).forEach((target) => targets.add(target));
    byOwner.set(overlay.userId, targets);
  }

  const variables = new Map<string, Prisma.VariableGetPayload<{ select: typeof variableSelect }>[]>();
  for (const [userId, targets] of byOwner) {
    if (targets.size === 0) continue;
    // Sources and keys never contain "/" (lib/variables.ts), so this splits them apart again.
    const pairs = [...targets].map((target) => {
      const slash = target.lastIndexOf("/");
      return { source: target.slice(0, slash), key: target.slice(slash + 1) };
    });
    variables.set(
      userId,
      await db.variable.findMany({ where: { userId, OR: pairs }, select: variableSelect })
    );
  }

  return overlays.map((overlay) => {
    const targets = targetsOf(overlay);
    return {
      ...overlay,
      variables: (variables.get(overlay.userId) ?? []).filter((v) =>
        targets.has(`${v.source}/${v.key}`)
      ),
    };
  });
};

export const findOverlayWithElements = async (overlayId: string, db: Db = prisma) => {
  const overlay = await db.overlay.findUnique({
    where: { id: overlayId },
    include: overlayElementsInclude,
  });
  return overlay ? (await withVariables(db, [overlay]))[0] : null;
};

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
    return findOverlayWithElements(overlayId, tx);
  });
  if (overlay) {
    server.publish(`overlay-${overlayId}`, JSON.stringify(writeId ? { ...overlay, writeId } : overlay));
  }
  return overlay;
};

export const revisionHeaders = (overlay: { revision: number } | null): Record<string, string> =>
  overlay ? { [REVISION_HEADER]: String(overlay.revision) } : {};
