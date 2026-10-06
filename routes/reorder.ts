import { prisma } from "../auth";
import { authenticate, requireOverlayRole } from "../middleware/authMiddleware";
import { corsHeaders } from "../middleware/cors";
import { publishOverlay } from "../services/overlay-query";

const MAX_REORDER_ELEMENTS = 1000;
// Only these render their children; anything placed under another type would vanish.
const PARENT_TYPES = new Set(["CONTAINER", "GROUP"]);

export const handleReorderRoutes = async (
  req: Request,
  server: { publish: (channel: string, message: string) => unknown | Promise<unknown> },
  path: string
) => {
  const reorderMatch = path.match(/^\/api\/elements\/reorder$/);
  if (reorderMatch && req.method === "POST") {
    const session = await authenticate(req);
    if (!session) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      const { elements, overlayId } = (await req.json()) as {
        elements?: unknown;
        overlayId?: unknown;
      };
      if (!Array.isArray(elements) || elements.length > MAX_REORDER_ELEMENTS || typeof overlayId !== "string" || !overlayId) {
        return new Response(JSON.stringify({ error: "Invalid request body" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const check = await requireOverlayRole(session.user, overlayId, "EDITOR");
      if (check.error) return check.error;

      // Every element being moved, and every parent it is moved under, must belong to the
      // overlay the caller was authorized for. Otherwise an editor of one overlay could
      // rewrite the element tree of any other overlay by id.
      const moves = new Map<string, { position?: number | null; parentId?: string | null }>();
      for (const element of elements) {
        const { id, position, parentId } = element ?? {};
        const validPosition =
          position === undefined || position === null || Number.isInteger(position);
        const validParent = parentId === undefined || parentId === null || typeof parentId === "string";
        if (typeof id !== "string" || !validPosition || !validParent || moves.has(id)) {
          return new Response(JSON.stringify({ error: "Invalid request body" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        moves.set(id, { position, parentId });
      }

      const overlayElements = await prisma.element.findMany({
        where: { overlayId },
        select: { id: true, parentId: true, type: true },
      });
      const parentOf = new Map(overlayElements.map((e) => [e.id, e.parentId]));
      const typeOf = new Map(overlayElements.map((e) => [e.id, e.type]));

      for (const [id, { parentId }] of moves) {
        if (!parentOf.has(id) || (parentId && !parentOf.has(parentId))) {
          return new Response(JSON.stringify({ error: "Element not found in overlay" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (parentId && !PARENT_TYPES.has(typeOf.get(parentId)!)) {
          return new Response(JSON.stringify({ error: "Parent element can't hold children" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (parentId !== undefined) parentOf.set(id, parentId);
      }

      // Reject moves that would put an element underneath itself.
      for (const id of moves.keys()) {
        const seen = new Set<string>();
        for (let cur: string | null | undefined = id; cur; cur = parentOf.get(cur)) {
          if (seen.has(cur)) {
            return new Response(JSON.stringify({ error: "Invalid element hierarchy" }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          seen.add(cur);
        }
      }

      // All-or-nothing: a failure part-way through must not leave a half-reordered tree.
      await prisma.$transaction(
        [...moves].map(([id, { position, parentId }]) =>
          prisma.element.update({
            where: { id },
            data: { position, parentId },
          })
        )
      );

      await publishOverlay(server, overlayId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (e) {
      console.error(e);
      if (e instanceof SyntaxError) {
        return new Response(JSON.stringify({ error: "Invalid request body" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Failed to reorder elements" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return null; // Return null if route doesn't match
};
