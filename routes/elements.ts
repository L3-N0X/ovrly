import { prisma } from "../auth";
import { authenticate } from "../middleware/authMiddleware";
import { corsHeaders } from "../middleware/cors";
import type { Prisma } from "@prisma/client";

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
    const overlay = await prisma.overlay.findUnique({ where: { id: overlayId } });

    if (!overlay) {
      return new Response(JSON.stringify({ error: "Overlay not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isOwner = overlay.userId === session.user.id;
    const editors = await prisma.editor.findMany({ where: { userId: overlay.userId } });
    const isEditor = editors.some((editor) => editor.editorTwitchName === session.user.name);

    if (!isOwner && !isEditor) {
      return new Response(JSON.stringify({ error: "Overlay not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      const { name, type } = await req.json();
      if (!name || !type) {
        return new Response(JSON.stringify({ error: "Name and type are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const maxPosition = await prisma.element.aggregate({
        where: { overlayId: overlayId },
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
      } else if (type === "CONTAINER") {
        // No specific data needed for container, it's just a grouping element
      } else {
        return new Response(JSON.stringify({ error: "Invalid element type" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await prisma.element.create({
        data: elementCreateData,
      });

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

  const elementIdMatch = path.match(/^\/api\/elements\/(?!reorder)([a-zA-Z0-9_-]+)$/);
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
      include: { overlay: true },
    });

    if (!element) {
      return new Response(JSON.stringify({ error: "Element not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isOwner = element.overlay.userId === session.user.id;
    const editors = await prisma.editor.findMany({ where: { userId: element.overlay.userId } });
    const isEditor = editors.some((editor) => editor.editorTwitchName === session.user.name);

    if (!isOwner && !isEditor) {
      return new Response(JSON.stringify({ error: "Element not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "PATCH") {
      try {
        const { name, style, data, position, parentId } = await req.json();
        const elementUpdateData: Prisma.ElementUncheckedUpdateInput = {} as Prisma.ElementUncheckedUpdateInput;
        if (name) elementUpdateData.name = name;
        if (style) elementUpdateData.style = style;
        if (position) elementUpdateData.position = position;
        if (parentId) elementUpdateData.parentId = parentId;

        if (data) {
          if (element.type === "TITLE" && typeof data.text === "string") {
            elementUpdateData.title = { update: { text: data.text } };
          }
          if (element.type === "COUNTER" && typeof data.value === "number") {
            elementUpdateData.counter = { update: { value: data.value } };
          }
        }

        const updatedElement = await prisma.element.update({
          where: { id: elementId },
          data: elementUpdateData,
          include: { title: true, counter: true, children: true },
        });

        const updatedOverlay = await prisma.overlay.findUnique({
          where: { id: element.overlayId },
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
        server.publish(`overlay-${element.overlayId}`, JSON.stringify(updatedOverlay));

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
      if (!isOwner) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // const deletedElement =
      await prisma.element.delete({ where: { id: elementId } });

      const updatedOverlay = await prisma.overlay.findUnique({
        where: { id: element.overlayId },
        include: {
          elements: {
            include: {
              title: true,
              counter: true,
            },
          },
        },
      });
      server.publish(`overlay-${element.overlayId}`, JSON.stringify(updatedOverlay));

      return new Response(null, { status: 204, headers: corsHeaders });
    }
  }

  return null; // Return null if route doesn't match
};
