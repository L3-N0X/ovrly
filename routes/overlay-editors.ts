import { prisma } from "../auth";
import { authenticate, getOverlayAccess } from "../middleware/authMiddleware";
import { corsHeaders } from "../middleware/cors";

export const handleOverlayEditorsRoutes = async (req: Request, path: string) => {
  const overlayEditorRegex = /^\/api\/overlays\/([a-zA-Z0-9_-]+)\/editors(?:\/([^/]+))?$/;
  const match = path.match(overlayEditorRegex);

  if (!match) {
    return null;
  }

  const [, overlayId, editorIdentifier] = match;

  const session = await authenticate(req);
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const access = await getOverlayAccess(session.user, overlayId);
  if (!access) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method === "GET") {
    // The owner's global editors can edit this overlay too, so they are listed alongside the
    // overlay's own editors. `canManage` tells the client whether to offer add/revoke.
    const [editors, globalEditors] = await Promise.all([
      prisma.overlayEditor.findMany({
        where: { overlayId },
        select: { editorId: true, editorTwitchName: true },
      }),
      prisma.editor.findMany({
        where: { ownerId: access.overlay.userId },
        select: { editorId: true, editorTwitchName: true },
      }),
    ]);
    return new Response(JSON.stringify({ editors, globalEditors, canManage: access.isOwner }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Editors may change the overlay, but only its owner decides who else gets access.
  if ((req.method === "POST" || req.method === "DELETE") && !access.isOwner) {
    return new Response(JSON.stringify({ error: "Only the owner can manage editors" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method === "POST") {
    try {
      const body = (await req.json()) as { twitchName?: unknown } | null;
      const twitchName = typeof body?.twitchName === "string" ? body.twitchName.trim() : "";
      if (!twitchName) {
        return new Response(JSON.stringify({ error: "Twitch name is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const existingEditor = await prisma.overlayEditor.findFirst({
        where: { overlayId, editorTwitchName: { equals: twitchName, mode: "insensitive" } },
        select: { id: true },
      });
      if (existingEditor) {
        return new Response(JSON.stringify({ error: "Editor with this Twitch name already exists" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const editorUser = await prisma.user.findFirst({
        where: { name: { equals: twitchName, mode: "insensitive" } },
      });

      const newEditor = await prisma.overlayEditor.create({
        data: {
          overlayId,
          editorId: editorUser?.id,
          editorTwitchName: twitchName,
        },
      });
      return new Response(JSON.stringify(newEditor), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (e) {
      console.error(e);
      return new Response(
        JSON.stringify({ error: "Invalid request body or twitch name already exists" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  }

  if (req.method === "DELETE") {
    if (!editorIdentifier) {
      return new Response(JSON.stringify({ error: "Editor twitch name is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    try {
      await prisma.overlayEditor.delete({
        where: {
          overlayId_editorTwitchName: {
            overlayId,
            editorTwitchName: decodeURIComponent(editorIdentifier),
          },
        },
      });
      return new Response(null, { status: 204, headers: corsHeaders });
    } catch (e) {
      console.error(e);
      return new Response(JSON.stringify({ error: "Editor not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
};
