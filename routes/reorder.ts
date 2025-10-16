import { prisma } from "../auth";
import { authenticate } from "../middleware/authMiddleware";
import { corsHeaders } from "../middleware/cors";

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
      const { elements, overlayId } = await req.json();
      if (!elements || !Array.isArray(elements) || !overlayId) {
        return new Response(JSON.stringify({ error: "Invalid request body" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const overlay = await prisma.overlay.findUnique({ where: { id: overlayId } });

      if (!overlay) {
        return new Response(JSON.stringify({ error: "Overlay not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const isOwner = overlay.userId === session.user.id;
      const editors = await prisma.editor.findMany({ where: { ownerId: overlay.userId } });
      const isEditor = editors.some((editor) => editor.editorTwitchName === session.user.name);

      if (!isOwner && !isEditor) {
        return new Response(JSON.stringify({ error: "Overlay not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("--- DEBUG: /api/elements/reorder ---");
      console.log("Received elements:", JSON.stringify(elements, null, 2));

      for (const element of elements) {
        console.log(`Updating element with id: ${element.id}`);
        await prisma.element.update({
          where: { id: element.id },
          data: {
            position: element.position,
            parentId: element.parentId,
          },
        });
      }

      const updatedOverlay = await prisma.overlay.findUnique({
        where: { id: overlayId },
        include: {
          elements: {
            include: {
              title: true,
              counter: true,
              children: {
                include: {
                  title: true,
                  counter: true,
                  children: true,
                },
              },
            },
          },
        },
      });

      server.publish(`overlay-${overlayId}`, JSON.stringify(updatedOverlay));

      return new Response(JSON.stringify({ success: true }), {
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

  return null; // Return null if route doesn't match
};
