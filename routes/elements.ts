import { prisma } from "../auth";
import { authenticate, authorize } from "../middleware/authMiddleware";
import { corsHeaders } from "../middleware/cors";
import { publishOverlay } from "../services/overlay-query";
import type { Prisma, PrismaClient } from "@prisma/client";

const ELEMENT_TYPES = ["TITLE", "COUNTER", "TIMER", "IMAGE", "CONTAINER", "GROUP"];

async function getAllDescendantIds(prisma: PrismaClient, initialIds: string[]): Promise<string[]> {
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
    if (!(await authorize(session.user, overlayId))) {
      return new Response(JSON.stringify({ error: "Overlay not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      const { name, type } = await req.json();
      if (typeof name !== "string" || !name.trim() || !ELEMENT_TYPES.includes(type)) {
        return new Response(JSON.stringify({ error: "Name and a valid type are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // New elements are appended to the root level.
      const maxPosition = await prisma.element.aggregate({
        where: { overlayId: overlayId, parentId: null },
        _max: { position: true },
      });

      const elementCreateData: Prisma.ElementUncheckedCreateInput = {
        name: name,
        type: type,
        overlayId: overlayId,
        style: {}, // Initialize with empty style object instead of null
        position: (maxPosition._max.position ?? -1) + 1,
      } as Prisma.ElementUncheckedCreateInput;

      if (type === "TITLE") {
        elementCreateData.title = { create: { text: "New Title" } };
      } else if (type === "COUNTER") {
        elementCreateData.counter = { create: { value: 0 } };
      } else if (type === "TIMER") {
        elementCreateData.timer = { create: { startedAt: null, pausedAt: null } };
      } else if (type === "IMAGE") {
        elementCreateData.image = { create: { src: "" } };
      } else if (type === "CONTAINER") {
        // No specific data needed for container, it's just a grouping element
      } else if (type === "GROUP") {
        // Children are positioned freely inside it; it starts out covering the whole canvas.
        elementCreateData.style = { width: 800, height: 600 };
      } else {
        return new Response(JSON.stringify({ error: "Invalid element type" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await prisma.element.create({
        data: elementCreateData,
      });

      const updatedOverlay = await publishOverlay(server, overlayId);

      return new Response(JSON.stringify(updatedOverlay), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (e) {
      console.error(e);
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      const { ids } = await req.json();
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

      if (!(await authorize(session.user, firstElement.overlayId))) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

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
      for (const level of sortedLevels) {
        const levelIds = levels.get(level)!;
        await prisma.element.deleteMany({ where: { id: { in: levelIds } } });
      }

      await publishOverlay(server, firstElement.overlayId);

      return new Response(null, { status: 204, headers: corsHeaders });
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
    const element = await prisma.element.findUnique({ where: { id: elementId } });

    if (!element || !(await authorize(session.user, element.overlayId))) {
      return new Response(JSON.stringify({ error: "Element not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "PATCH") {
      try {
        const { name, style, data, position, parentId } = await req.json();
        const elementUpdateData: Prisma.ElementUncheckedUpdateInput =
          {} as Prisma.ElementUncheckedUpdateInput;
        if (typeof name === "string" && name.trim()) elementUpdateData.name = name.trim();
        if (style && typeof style === "object" && !Array.isArray(style)) {
          const existingStyle = (element.style || {}) as Prisma.JsonObject;
          const newStyle = style as Prisma.JsonObject;
          const mergedStyle = { ...existingStyle, ...newStyle };
          elementUpdateData.style = mergedStyle;
        }
        // Checked against undefined so that position 0 and moving back to the root (null) work.
        if (Number.isInteger(position)) elementUpdateData.position = position;
        if (parentId === null) {
          elementUpdateData.parentId = null;
        } else if (parentId !== undefined) {
          // The new parent must live in the same overlay (and must not be the element itself
          // or one of its descendants), otherwise this could graft elements into another overlay.
          const descendantIds =
            typeof parentId === "string" ? await getAllDescendantIds(prisma, [elementId]) : [];
          const parent =
            typeof parentId === "string" && !descendantIds.includes(parentId)
              ? await prisma.element.findFirst({
                  where: { id: parentId, overlayId: element.overlayId },
                  select: { id: true },
                })
              : null;
          if (!parent) {
            return new Response(JSON.stringify({ error: "Invalid parent element" }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          elementUpdateData.parentId = parentId;
        }

        if (data) {
          if (element.type === "TITLE" && typeof data.text === "string") {
            elementUpdateData.title = { update: { text: data.text } };
          }
          if (element.type === "COUNTER" && Number.isInteger(data.value)) {
            elementUpdateData.counter = { update: { value: data.value } };
          }
          if (element.type === "IMAGE" && typeof data.src === "string") {
            elementUpdateData.image = { update: { src: data.src } };
          }
          if (element.type === "TIMER") {
            const { startedAt, pausedAt, duration, countDown } = data;
            const timerUpdateData: Prisma.TimerUpdateInput = {};
            if (startedAt !== undefined) {
              timerUpdateData.startedAt = startedAt ? new Date(startedAt) : null;
            }
            if (pausedAt !== undefined) {
              timerUpdateData.pausedAt = pausedAt ? new Date(pausedAt) : null;
            }
            if (duration !== undefined) {
              timerUpdateData.duration = duration;
            }
            if (countDown !== undefined) {
              timerUpdateData.countDown = countDown;
            }
            elementUpdateData.timer = {
              update: timerUpdateData,
            };
          }
        }

        const updatedElement = await prisma.element.update({
          where: { id: elementId },
          data: elementUpdateData,
          include: { title: true, counter: true, timer: true, image: true },
        });

        await publishOverlay(server, element.overlayId);

        return new Response(JSON.stringify(updatedElement), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
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
      // Children go with it through the parent relation's cascade.
      await prisma.element.delete({ where: { id: elementId } });
      await publishOverlay(server, element.overlayId);

      return new Response(null, { status: 204, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return null; // Return null if route doesn't match
};
