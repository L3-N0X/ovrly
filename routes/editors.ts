import { prisma } from "../auth";
import { authenticate } from "../middleware/authMiddleware";
import { corsHeaders } from "../middleware/cors";

export const handleEditorsRoutes = async (req: Request, path: string) => {
  if (path === "/api/editors") {
    const session = await authenticate(req);
    if (!session) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "GET") {
      const editors = await prisma.editor.findMany({ where: { ownerId: session.user.id } });
      return new Response(JSON.stringify(editors), {
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

        const editor = await prisma.user.findFirst({ where: { name: twitchName } });
        if (!editor) {
          return new Response(JSON.stringify({ error: "User not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const newEditor = await prisma.editor.create({
          data: { ownerId: session.user.id, editorId: editor.id, editorTwitchName: twitchName },
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
      try {
        const { twitchName } = await req.json();
        if (!twitchName) {
          return new Response(JSON.stringify({ error: "Twitch name is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const editor = await prisma.user.findFirst({ where: { name: twitchName } });
        if (!editor) {
          return new Response(JSON.stringify({ error: "User not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await prisma.editor.delete({
          where: {
            ownerId_editorId: { ownerId: session.user.id, editorId: editor.id },
          },
        });
        return new Response(null, { status: 204, headers: corsHeaders });
      } catch {
        return new Response(JSON.stringify({ error: "Invalid request body" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return null; // Return null if route doesn't match
};
