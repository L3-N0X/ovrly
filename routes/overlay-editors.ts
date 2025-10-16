
import { prisma } from "../auth";
import { authenticate, authorize } from "../middleware/authMiddleware";
import { corsHeaders } from "../middleware/cors";

export const handleOverlayEditorsRoutes = async (req: Request, path: string) => {
  const session = await authenticate(req);
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const overlayEditorRegex = /\/api\/overlays\/([^/]+)\/editors(?:\/([^/]+))?/;
  const match = path.match(overlayEditorRegex);

  if (!match) {
    return null;
  }

  const [, overlayId, editorId] = match;

  const authorized = await authorize(session.user.id, overlayId);
  if (!authorized) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method === "GET") {
    const editors = await prisma.overlayEditor.findMany({
      where: { overlayId },
      include: { editor: true },
    });
    return new Response(JSON.stringify(editors.map(e => e.editor)), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method === "POST") {
    try {
      const { twitchName } = await req.json();
      if (!twitchName) {
        return new Response(JSON.stringify({ error: "Twitch name is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const editorUser = await prisma.user.findFirst({ where: { name: twitchName } });
      if (!editorUser) {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const newEditor = await prisma.overlayEditor.create({
        data: { overlayId, editorId: editorUser.id },
      });
      return new Response(JSON.stringify(newEditor), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch {
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  if (req.method === "DELETE") {
    if (!editorId) {
      return new Response(JSON.stringify({ error: "Editor ID is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    await prisma.overlayEditor.delete({
      where: {
        overlayId_editorId: { overlayId, editorId },
      },
    });
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
};
