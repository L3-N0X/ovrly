import { prisma } from "../auth";
import {
  authenticate,
  forbiddenMessage,
  getOverlayAccess,
  requireOverlayRole,
} from "../middleware/authMiddleware";
import { corsHeaders, json } from "../middleware/cors";
import { hasRole } from "../lib/sharing";
import {
  overlayElementsInclude,
  publishOverlay,
  revisionHeaders,
  writeIdOf,
} from "../services/overlay-query";
import { buildElementCreates, toElementTree, usesOwnTwitch, type ElementSeed } from "./overlays";
import { parseComponentElements } from "../lib/components";
import { ownTwitchSource } from "../services/twitch-variables";
import { lockElement, lockOverlay } from "../services/locks";
import { createBingoState, normalizeBingoState, parseBingoUpdate } from "../lib/bingo";
import { isStyleObject, mergeStyle } from "../lib/style";
import { applyTimerAction, parseTimerActions, type TimerState } from "../lib/timer";
import {
  applyCountdownAction,
  parseCountdownActions,
  type CountdownState,
} from "../lib/countdown";
import { ELEMENT_TYPE_NAMES, nextDefaultName } from "../lib/naming";
import { isIconLibrary, isIconName } from "../lib/icons";
import { parseProgressPatch } from "../lib/progress";
import {
  applyCycleStackAction,
  parseCycleStackActions,
  type CycleStackState,
} from "../lib/cycleStack";
import {
  applySubathonAction,
  applySubathonSettings,
  parseSubathonActions,
  parseSubathonSettings,
  subathonColumns,
  type SubathonState,
} from "../lib/subathon";
import { syncSubathonListeners } from "../services/twitch-events";
import { isBindableProperty, isContentProperty, parseBindingTarget } from "../lib/bindings";
import type { ElementType, Prisma, PrismaClient } from "../src/generated/prisma/client";

const ELEMENT_TYPES = [
  "TITLE",
  "COUNTER",
  "TIMER",
  "COUNTDOWN",
  "IMAGE",
  "BINGO",
  "CONTAINER",
  "GROUP",
  "ICON",
  "RECTANGLE",
  "PROGRESS",
  "SUBATHON",
  "SCROLLER",
  "CYCLE_STACK",
];
const PARENT_TYPES: ElementType[] = ["CONTAINER", "GROUP", "SCROLLER", "CYCLE_STACK"];
// Copies are shifted by this much (when they are placed by x/y), so a pasted element doesn't
// hide the one it was copied from.
const PASTE_OFFSET = 16;
// Bingo data a controller may change while live. Rows, columns and the free middle cell shape the
// card, so they are part of its design.
const BINGO_CONTENT_KEYS = ["fields", "checked"];

// Controllers run an overlay: they change what elements show (`data`, and which variables their
// content is bound to), not how they look or where they are. Anything beyond that needs an editor.
const requiredRoleForPatch = (body: Record<string, unknown>, elementType: string) => {
  const designKeys = ["name", "style", "position", "parentId"];
  if (designKeys.some((key) => body[key] !== undefined)) return "EDITOR" as const;
  const bindings = body.bindings;
  if (
    bindings &&
    typeof bindings === "object" &&
    Object.keys(bindings).some((property) => !isContentProperty(property))
  ) {
    return "EDITOR" as const;
  }
  const data = body.data;
  // A subathon's settings (its channel, what events are worth) are part of its design; running
  // it, including a happy hour multiplier, is content.
  if (elementType === "SUBATHON" && data && typeof data === "object" && "settings" in data) {
    return "EDITOR" as const;
  }
  if (
    elementType === "BINGO" &&
    data &&
    typeof data === "object" &&
    Object.keys(data).some((key) => !BINGO_CONTENT_KEYS.includes(key))
  ) {
    return "EDITOR" as const;
  }
  return "CONTROLLER" as const;
};

async function getAllDescendantIds(
  prisma: PrismaClient | Prisma.TransactionClient,
  initialIds: string[]): Promise<string[]> {
  const allIds = new Set<string>(initialIds);
  let frontier = [...initialIds];
  while (frontier.length > 0) {
    const children = await prisma.element.findMany({
      where: { parentId: { in: frontier } },
      select: { id: true },
    });
    const childIds = children.map((c) => c.id);
    frontier = [];
    for (const childId of childIds) {
      if (!allIds.has(childId)) {
        allIds.add(childId);
        frontier.push(childId);
      }
    }
  }
  return Array.from(allIds);
}

// Adds element trees (seeds, see buildElementCreates) at the end of `parentId`, or of the canvas
// for null, and answers with the ids of all new elements, nested ones included. Locks the
// overlay, so it has to run in a transaction.
async function insertElementTrees(
  tx: Prisma.TransactionClient,
  overlayId: string,
  parentId: string | null,
  seeds: ElementSeed[],
  ownTwitch: string | null
): Promise<{ error: Response } | { added: string[] }> {
  await lockOverlay(tx, overlayId);
  const idsOf = async () =>
    (await tx.element.findMany({ where: { overlayId }, select: { id: true } })).map((el) => el.id);
  const before = new Set(await idsOf());
  if (parentId !== null) {
    const parent = await tx.element.findFirst({
      where: { id: parentId, overlayId, type: { in: PARENT_TYPES } },
      select: { id: true },
    });
    if (!parent) return { error: json({ error: "Invalid parent element" }, 400) };
  }
  const last = await tx.element.aggregate({
    where: { overlayId, parentId },
    _max: { position: true },
  });
  const first = (last._max.position ?? -1) + 1;
  const positioned = seeds.map((seed, index) => ({ ...seed, position: first + index }));
  for (const data of buildElementCreates(overlayId, positioned, ownTwitch)) {
    await tx.element.create({ data: { ...data, parentId } });
  }
  return { added: (await idsOf()).filter((id) => !before.has(id)) };
}

export const handleElementsRoutes = async (
  req: Request,
  server: { publish: (channel: string, message: string) => unknown | Promise<unknown> },
  path: string
) => {
  const addElementMatch = path.match(/^\/api\/overlays\/([a-zA-Z0-9_-]+)\/elements$/);
  if (addElementMatch && req.method === "POST") {
    const session = await authenticate(req);
    if (!session) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const overlayId = addElementMatch[1];
    const check = await requireOverlayRole(session.user, overlayId, "EDITOR");
    if (check.error) return check.error;

    try {
      const { name, type } = (await req.json()) as { name?: unknown; type?: unknown };
      if (
        (name !== undefined && typeof name !== "string") ||
        typeof type !== "string" ||
        !ELEMENT_TYPES.includes(type)
      ) {
        return new Response(JSON.stringify({ error: "A valid type is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Without a name, the element gets the next one in its type's series ("Counter 2"),
      // which is picked below under the overlay's lock.
      const elementCreateData: Prisma.ElementUncheckedCreateInput = {
        name: name?.trim() ?? "",
        type: type,
        overlayId: overlayId,
        style: {}, // Initialize with empty style object instead of null
      } as Prisma.ElementUncheckedCreateInput;

      if (type === "TITLE") {
        elementCreateData.title = { create: { text: "New Title" } };
      } else if (type === "COUNTER") {
        elementCreateData.counter = { create: { value: 0 } };
      } else if (type === "TIMER") {
        elementCreateData.timer = { create: { startedAt: null, pausedAt: null } };
      } else if (type === "COUNTDOWN") {
        elementCreateData.countdown = { create: {} };
      } else if (type === "SUBATHON") {
        // Listens to the owner's own channel until another one is picked.
        elementCreateData.subathon = { create: {} };
      } else if (type === "ICON") {
        elementCreateData.icon = { create: {} };
      } else if (type === "PROGRESS") {
        elementCreateData.progress = { create: {} };
      } else if (type === "IMAGE") {
        elementCreateData.image = { create: { src: "" } };
      } else if (type === "BINGO") {
        elementCreateData.bingo = { create: createBingoState() };
      } else if (type === "CONTAINER") {
        // No specific data needed for container, it's just a grouping element
      } else if (type === "SCROLLER") {
        // Lays its children out like a container; the size falls back to the defaults.
      } else if (type === "CYCLE_STACK") {
        // Starts cycling right away, at its first child.
        elementCreateData.cycleStack = { create: {} };
      } else if (type === "GROUP") {
        // Children are positioned freely inside it; it starts out covering the whole canvas,
        // whose size is filled in below, under the overlay's lock.
        elementCreateData.style = {};
      } else if (type === "RECTANGLE") {
        // Nothing to draw yet; the size falls back to the defaults until it is styled.
        elementCreateData.style = {};
      } else {
        return new Response(JSON.stringify({ error: "Invalid element type" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await prisma.$transaction(async (tx) => {
        // New elements are appended to the root level. Locked so two elements added at the
        // same time don't both get the last position.
        await lockOverlay(tx, overlayId);
        // A new group covers the whole canvas it is added to, so it needs the canvas size.
        const canvas =
          type === "GROUP"
            ? await tx.overlay.findUniqueOrThrow({
                where: { id: overlayId },
                select: { width: true, height: true },
              })
            : null;
        const maxPosition = await tx.element.aggregate({
          where: { overlayId: overlayId, parentId: null },
          _max: { position: true },
        });
        const siblingsOfType = elementCreateData.name
          ? []
          : await tx.element.findMany({
              where: { overlayId: overlayId, type: elementCreateData.type },
              select: { name: true },
            });
        await tx.element.create({
          data: {
            ...elementCreateData,
            name:
              elementCreateData.name ||
              nextDefaultName(
                ELEMENT_TYPE_NAMES[type],
                siblingsOfType.map((el) => el.name),
                { numberFirst: true }
              ),
            style: canvas ? { width: canvas.width, height: canvas.height } : elementCreateData.style,
            position: (maxPosition._max.position ?? -1) + 1,
          },
        });
      });

      const updatedOverlay = await publishOverlay(server, overlayId, writeIdOf(req));

      return new Response(JSON.stringify(updatedOverlay), {
        status: 201,
        headers: {
          ...corsHeaders,
          ...revisionHeaders(updatedOverlay),
          "Content-Type": "application/json",
        },
      });
    } catch (e) {
      console.error(e);
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const pasteMatch = path.match(/^\/api\/overlays\/([a-zA-Z0-9_-]+)\/elements\/paste$/);
  if (pasteMatch && req.method === "POST") {
    const session = await authenticate(req);
    if (!session) {
      return json({ error: "Unauthorized" }, 401);
    }

    const overlayId = pasteMatch[1];
    const check = await requireOverlayRole(session.user, overlayId, "EDITOR");
    if (check.error) return check.error;

    try {
      const { ids, parentId = null } = (await req.json()) as { ids?: unknown; parentId?: unknown };
      if (
        !Array.isArray(ids) ||
        ids.length === 0 ||
        ids.length > 1000 ||
        !ids.every((id) => typeof id === "string") ||
        (parentId !== null && typeof parentId !== "string")
      ) {
        return json({ error: "Element IDs are required" }, 400);
      }

      // The copied elements may belong to another overlay (also one of someone else's that is
      // shared with the user). Copying takes the design along, so that needs an editor too.
      const copied = await prisma.element.findMany({
        where: { id: { in: ids } },
        select: { overlayId: true },
      });
      if (copied.length === 0) return json({ error: "The copied elements no longer exist" }, 404);
      const sourceOverlayId = copied[0].overlayId;
      if (copied.some((el) => el.overlayId !== sourceOverlayId)) {
        return json({ error: "Cannot copy elements from different overlays" }, 400);
      }
      if (sourceOverlayId !== overlayId) {
        const sourceCheck = await requireOverlayRole(session.user, sourceOverlayId, "EDITOR");
        if (sourceCheck.error) return sourceCheck.error;
      }
      const source = await prisma.overlay.findUnique({
        where: { id: sourceOverlayId },
        include: overlayElementsInclude,
      });
      if (!source) return json({ error: "The copied elements no longer exist" }, 404);

      // Each copied element comes with everything nested in it; one that sits inside another
      // copied element is already part of that one.
      const picked: ElementSeed[] = [];
      const collect = (nodes: ElementSeed[], inside: boolean) => {
        for (const node of nodes) {
          const isCopied = ids.includes(node.id);
          if (isCopied && !inside) picked.push(node);
          collect(node.children, inside || isCopied);
        }
      };
      collect(toElementTree(source.elements), false);

      // Bindings point at variables by name, so they follow the copy to another account.
      const seeds = picked.map((node) => {
        const style = isStyleObject(node.style) ? node.style : {};
        const shifted = (key: string) =>
          typeof style[key] === "number" ? { [key]: (style[key] as number) + PASTE_OFFSET } : {};
        return { ...node, style: { ...style, ...shifted("x"), ...shifted("y") } };
      });
      const result = await prisma.$transaction((tx) =>
        insertElementTrees(tx, overlayId, parentId as string | null, seeds, null)
      );
      if ("error" in result) return result.error;

      const updatedOverlay = await publishOverlay(server, overlayId, writeIdOf(req));
      // `pasted` tells the client which of the elements are the new ones.
      return new Response(JSON.stringify({ ...updatedOverlay, pasted: result.added }), {
        status: 201,
        headers: {
          ...corsHeaders,
          ...revisionHeaders(updatedOverlay),
          "Content-Type": "application/json",
        },
      });
    } catch (e) {
      console.error(e);
      return json({ error: "Invalid request body" }, 400);
    }
  }

  // Adds one of the user's components (routes/components.ts): a copy of its elements, which
  // from then on are elements like any other.
  const componentMatch = path.match(/^\/api\/overlays\/([a-zA-Z0-9_-]+)\/elements\/component$/);
  if (componentMatch && req.method === "POST") {
    const session = await authenticate(req);
    if (!session) {
      return json({ error: "Unauthorized" }, 401);
    }

    const overlayId = componentMatch[1];
    const check = await requireOverlayRole(session.user, overlayId, "EDITOR");
    if (check.error) return check.error;

    try {
      const { componentId, parentId = null } = (await req.json()) as {
        componentId?: unknown;
        parentId?: unknown;
      };
      if (typeof componentId !== "string" || (parentId !== null && typeof parentId !== "string")) {
        return json({ error: "A component is required" }, 400);
      }
      const component = await prisma.component.findFirst({
        where: { id: componentId, userId: session.user.id },
      });
      if (!component) return json({ error: "Component not found" }, 404);
      const elements = parseComponentElements(component.elements);
      if (typeof elements === "string") return json({ error: elements }, 400);
      // A component of one element is that element, so it goes by the component's name.
      if (elements.length === 1) elements[0].name = component.name;

      // Bindings to "twitch:@me" show the channel of the overlay's owner, whose variables it shows.
      const ownTwitch = usesOwnTwitch(elements)
        ? ((await ownTwitchSource(check.access.overlay.userId))?.name ?? null)
        : null;
      const result = await prisma.$transaction((tx) =>
        insertElementTrees(tx, overlayId, parentId as string | null, elements, ownTwitch)
      );
      if ("error" in result) return result.error;

      const updatedOverlay = await publishOverlay(server, overlayId, writeIdOf(req));
      // `added` tells the client which of the elements are the new ones.
      return new Response(JSON.stringify({ ...updatedOverlay, added: result.added }), {
        status: 201,
        headers: {
          ...corsHeaders,
          ...revisionHeaders(updatedOverlay),
          "Content-Type": "application/json",
        },
      });
    } catch (e) {
      console.error(e);
      return json({ error: "Invalid request body" }, 400);
    }
  }

  const deleteBulkMatch = path.match(/^\/api\/elements\/delete$/);
  if (deleteBulkMatch && req.method === "DELETE") {
    const session = await authenticate(req);
    if (!session) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      const { ids } = (await req.json()) as { ids?: unknown };
      if (
        !Array.isArray(ids) ||
        ids.length === 0 ||
        ids.length > 1000 ||
        !ids.every((id) => typeof id === "string")
      ) {
        return new Response(JSON.stringify({ error: "Element IDs are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const firstElement = await prisma.element.findFirst({
        where: { id: { in: ids } },
      });

      if (!firstElement) {
        return new Response(null, { status: 204, headers: corsHeaders });
      }

      const check = await requireOverlayRole(session.user, firstElement.overlayId, "EDITOR");
      if (check.error) return check.error;

      const elements = await prisma.element.findMany({
        where: { id: { in: ids } },
        select: { overlayId: true },
      });

      if (elements.some((e) => e.overlayId !== firstElement.overlayId)) {
        return new Response(
          JSON.stringify({
            error: "Cannot delete elements from different overlays",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const allIdsToDelete = await getAllDescendantIds(prisma, ids);

      const elementsToDelete = await prisma.element.findMany({
        where: { id: { in: allIdsToDelete } },
        select: { id: true, parentId: true },
      });
      const elementMap = new Map(elementsToDelete.map((e) => [e.id, e]));

      const depths = new Map<string, number>();
      function getDepth(id: string): number {
        if (depths.has(id)) return depths.get(id)!;
        const element = elementMap.get(id);
        if (!element || !element.parentId || !elementMap.has(element.parentId)) {
          depths.set(id, 0);
          return 0;
        }
        const depth = getDepth(element.parentId) + 1;
        depths.set(id, depth);
        return depth;
      }

      elementsToDelete.forEach((e) => getDepth(e.id));

      const levels = new Map<number, string[]>();
      for (const [id, depth] of depths.entries()) {
        if (!levels.has(depth)) {
          levels.set(depth, []);
        }
        levels.get(depth)!.push(id);
      }

      const sortedLevels = Array.from(levels.keys()).sort((a, b) => b - a);
      // Under the overlay's lock, so a move that is being validated right now doesn't have
      // elements disappear underneath it.
      await prisma.$transaction(async (tx) => {
        await lockOverlay(tx, firstElement.overlayId);
        for (const level of sortedLevels) {
          const levelIds = levels.get(level)!;
          await tx.element.deleteMany({ where: { id: { in: levelIds } } });
        }
      });

      const overlay = await publishOverlay(server, firstElement.overlayId, writeIdOf(req));

      return new Response(null, {
        status: 204,
        headers: { ...corsHeaders, ...revisionHeaders(overlay) },
      });
    } catch (e) {
      console.error(e);
      return new Response(JSON.stringify({ error: "Invalid request" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const elementIdMatch = path.match(/^\/api\/elements\/(?!reorder|delete)([a-zA-Z0-9_-]+)$/);
  if (elementIdMatch) {
    const session = await authenticate(req);
    if (!session) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const elementId = elementIdMatch[1];
    const element = await prisma.element.findUnique({
      where: { id: elementId },
      include: { bingo: true },
    });

    const access = element ? await getOverlayAccess(session.user, element.overlayId) : null;
    if (!element || !access) {
      return json({ error: "Element not found" }, 404);
    }

    if (req.method === "PATCH") {
      try {
        const body = (await req.json()) as Record<string, unknown> | null;
        if (!body || typeof body !== "object") {
          return json({ error: "Invalid request body" }, 400);
        }
        const required = requiredRoleForPatch(body, element.type);
        if (!hasRole(access.role, required)) {
          return json({ error: forbiddenMessage(required), requiredRole: required }, 403);
        }
        const { name, style, data, position, parentId, bindings } = body as {
          name?: string;
          style?: unknown;
          data?: {
            text?: string;
            value?: number;
            increment?: number;
            src?: string;
            startedAt?: string | null;
            pausedAt?: string | null;
            actions?: unknown;
            [key: string]: unknown;
          };
          position?: unknown;
          parentId?: string | null;
          // Property → the variable it shows ({ source, key }), or null to show its own value
          // again. Properties left out keep their binding.
          bindings?: unknown;
        };

        // Everything that builds on the stored state (style merge, counter, timer, countdown,
        // bingo) is read and written under the element's row lock, so concurrent changes to the
        // same element are applied one after another instead of overwriting each other.
        const result = await prisma.$transaction(async (tx): Promise<{ error: Response } | { ok: true }> => {
          if (typeof parentId === "string") {
            // Concurrent moves are checked against each other's result, otherwise two moves
            // that are fine on their own could together put elements underneath themselves.
            await lockOverlay(tx, element.overlayId);
          }
          await lockElement(tx, elementId);
          const current = await tx.element.findUnique({
            where: { id: elementId },
            include: { bingo: true, timer: true, countdown: true, subathon: true, cycleStack: true },
          });
          if (!current) {
            return { error: json({ error: "Element not found" }, 404) };
          }

          const elementUpdateData: Prisma.ElementUncheckedUpdateInput =
            {} as Prisma.ElementUncheckedUpdateInput;
          if (typeof name === "string" && name.trim()) elementUpdateData.name = name.trim();
          if (isStyleObject(style)) {
            elementUpdateData.style = mergeStyle(current.style, style) as Prisma.InputJsonObject;
          }
          // Checked against undefined so that position 0 and moving back to the root (null) work.
          if (typeof position === "number" && Number.isInteger(position)) {
            elementUpdateData.position = position;
          }
          if (parentId === null) {
            elementUpdateData.parentId = null;
          } else if (parentId !== undefined) {
            // The new parent must live in the same overlay (and must not be the element itself
            // or one of its descendants), otherwise this could graft elements into another overlay.
            // It must also be a type that renders its children.
            const descendantIds =
              typeof parentId === "string" ? await getAllDescendantIds(tx, [elementId]) : [];
            const parent =
              typeof parentId === "string" && !descendantIds.includes(parentId)
                ? await tx.element.findFirst({
                    where: {
                      id: parentId,
                      overlayId: element.overlayId,
                      type: { in: PARENT_TYPES },
                    },
                    select: { id: true },
                  })
                : null;
            if (!parent) {
              return { error: json({ error: "Invalid parent element" }, 400) };
            }
            elementUpdateData.parentId = parentId;
          }

          if (data) {
            if (element.type === "TITLE" && typeof data.text === "string") {
              elementUpdateData.title = { update: { text: data.text } };
            }
            if (element.type === "COUNTER") {
              // `increment` adds to whatever the counter is at, so clicks by several people
              // all count. `value` sets it (typing a number), where the last one wins.
              if (Number.isInteger(data.value)) {
                elementUpdateData.counter = { update: { value: data.value } };
              } else if (Number.isInteger(data.increment)) {
                elementUpdateData.counter = { update: { value: { increment: data.increment } } };
              }
            }
            if (element.type === "IMAGE" && typeof data.src === "string") {
              elementUpdateData.image = { update: { src: data.src } };
            }
            if (
              element.type === "PROGRESS" &&
              (data.value !== undefined || data.max !== undefined || data.running !== undefined)
            ) {
              const patch = parseProgressPatch(data);
              if (!patch) return { error: json({ error: "Invalid progress" }, 400) };
              elementUpdateData.progress = { update: patch };
            }
            if (element.type === "ICON" && (data.library !== undefined || data.name !== undefined)) {
              if (!isIconLibrary(data.library) || !isIconName(data.name)) {
                return { error: json({ error: "Invalid icon" }, 400) };
              }
              elementUpdateData.icon = { update: { library: data.library, name: data.name } };
            }
            if (element.type === "TIMER") {
              const { startedAt, pausedAt, actions } = data;
              const timerUpdateData: Prisma.TimerUpdateInput = {};
              if (actions !== undefined) {
                const parsed = parseTimerActions(actions);
                if (!parsed || !current.timer) {
                  return { error: json({ error: "Invalid timer actions" }, 400) };
                }
                // Applied with the server's clock, so it doesn't matter whose clock is off.
                const now = Date.now();
                const next = parsed.reduce(
                  (timer, action) => applyTimerAction(timer, action, now),
                  current.timer as TimerState
                );
                Object.assign(timerUpdateData, {
                  startedAt: next.startedAt,
                  pausedAt: next.pausedAt,
                });
              }
              if (startedAt !== undefined) {
                timerUpdateData.startedAt = startedAt ? new Date(startedAt) : null;
              }
              if (pausedAt !== undefined) {
                timerUpdateData.pausedAt = pausedAt ? new Date(pausedAt) : null;
              }
              elementUpdateData.timer = {
                update: timerUpdateData,
              };
            }
            if (element.type === "COUNTDOWN") {
              const parsed = parseCountdownActions(data.actions);
              if (!parsed || !current.countdown) {
                return { error: json({ error: "Invalid countdown actions" }, 400) };
              }
              // Applied with the server's clock, so it doesn't matter whose clock is off.
              const now = Date.now();
              const { mode, duration, remaining, endsAt, targetAt } = parsed.reduce(
                (countdown, action) => applyCountdownAction(countdown, action, now),
                current.countdown as CountdownState
              );
              elementUpdateData.countdown = {
                update: { mode, duration, remaining, endsAt, targetAt },
              };
            }
            if (element.type === "CYCLE_STACK") {
              const parsed = parseCycleStackActions(data.actions);
              if (!parsed || !current.cycleStack) {
                return { error: json({ error: "Invalid cycle stack actions" }, 400) };
              }
              // Applied with the server's clock, so it doesn't matter whose clock is off.
              const now = Date.now();
              const { index, startedAt } = parsed.reduce(
                (stack, action) => applyCycleStackAction(stack, action, now),
                current.cycleStack as CycleStackState
              );
              elementUpdateData.cycleStack = { update: { index, startedAt } };
            }
            if (element.type === "SUBATHON" && (data.actions !== undefined || data.settings !== undefined)) {
              if (!current.subathon) {
                return { error: json({ error: "Subathon not found" }, 404) };
              }
              let next = current.subathon as SubathonState;
              if (data.settings !== undefined) {
                const settings = parseSubathonSettings(data.settings);
                if (!settings) return { error: json({ error: "Invalid subathon settings" }, 400) };
                next = applySubathonSettings(next, settings);
              }
              if (data.actions !== undefined) {
                const parsed = parseSubathonActions(data.actions);
                if (!parsed) return { error: json({ error: "Invalid subathon actions" }, 400) };
                // Applied with the server's clock, so it doesn't matter whose clock is off.
                const now = Date.now();
                next = parsed.reduce((subathon, action) => applySubathonAction(subathon, action, now), next);
              }
              elementUpdateData.subathon = { update: subathonColumns(next) };
            }
            if (element.type === "BINGO") {
              if (!current.bingo) {
                return { error: json({ error: "Bingo data not found" }, 404) };
              }

              const currentState = normalizeBingoState({
                rows: current.bingo.rows,
                columns: current.bingo.columns,
                freeMiddle: current.bingo.freeMiddle,
                fields: current.bingo.fields,
                checked: current.bingo.checked,
              });
              const parsed = parseBingoUpdate(data, currentState);

              if (!parsed.ok) {
                return { error: json({ error: parsed.error }, 400) };
              }

              const { rows, columns, freeMiddle, fields, checked } = parsed.value;
              elementUpdateData.bingo = {
                update: { rows, columns, freeMiddle, fields, checked },
              };
            }
          }

          if (bindings !== undefined) {
            if (!isStyleObject(bindings)) {
              return { error: json({ error: "Invalid bindings" }, 400) };
            }
            for (const [property, target] of Object.entries(bindings)) {
              if (!isBindableProperty(element.type, property)) {
                return { error: json({ error: `“${property}” can't be bound to a variable` }, 400) };
              }
              if (target === null) {
                await tx.variableBinding.deleteMany({ where: { elementId, property } });
                continue;
              }
              // Any name is fine, also of a variable that doesn't exist (yet): the element shows
              // its own value until it does.
              const variable = parseBindingTarget(target);
              if (!variable) return { error: json({ error: "Invalid variable" }, 400) };
              await tx.variableBinding.upsert({
                where: { elementId_property: { elementId, property } },
                create: { elementId, property, ...variable },
                update: variable,
              });
            }
          }

          await tx.element.update({ where: { id: elementId }, data: elementUpdateData });
          return { ok: true };
        });
        if ("error" in result) return result.error;
        // Started, paused or moved to another channel: the channels listened to may change.
        if (element.type === "SUBATHON" && data) syncSubathonListeners();

        const overlay = await publishOverlay(server, element.overlayId, writeIdOf(req));
        const updatedElement = overlay?.elements.find((el) => el.id === elementId) ?? null;

        return new Response(JSON.stringify(updatedElement), {
          headers: {
            ...corsHeaders,
            ...revisionHeaders(overlay),
            "Content-Type": "application/json",
          },
        });
      } catch (e) {
        console.error(e);
        return new Response(JSON.stringify({ error: "Invalid request body" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (req.method === "DELETE") {
      if (!hasRole(access.role, "EDITOR")) {
        return json({ error: forbiddenMessage("EDITOR"), requiredRole: "EDITOR" }, 403);
      }
      // Children go with it through the parent relation's cascade.
      await prisma.$transaction(async (tx) => {
        await lockOverlay(tx, element.overlayId);
        // deleteMany, because someone else may have deleted it already.
        await tx.element.deleteMany({ where: { id: elementId } });
      });
      const overlay = await publishOverlay(server, element.overlayId, writeIdOf(req));

      return new Response(null, {
        status: 204,
        headers: { ...corsHeaders, ...revisionHeaders(overlay) },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return null; // Return null if route doesn't match
};
