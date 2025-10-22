import { prisma } from "../auth";
import { authenticate } from "../middleware/authMiddleware";
import { corsHeaders } from "../middleware/cors";

export const handleEditorsRoutes = async (req: Request, path: string) => {
  const editorRouteRegex = /^\/api\/editors(?:\/([^/]+))?$/;
  const match = path.match(editorRouteRegex);

  if (!match) {
    return null; // Not an editors route
  }

  const [, editorIdentifier] = match;

  const session = await authenticate(req);
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method === "GET" && !editorIdentifier) {
    if (req.method === "GET") {
      const editors = await prisma.editor.findMany({ where: { ownerId: session.user.id } });
      return new Response(JSON.stringify(editors), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST" && !editorIdentifier) {
      try {
        const { twitchName } = await req.json();
        if (!twitchName) {
          return new Response(JSON.stringify({ error: "Twitch name is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const editorUser = await prisma.user.findFirst({ where: { name: twitchName } });

        const newEditor = await prisma.editor.create({
          data: {
            ownerId: session.user.id,
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

    if (req.method === "DELETE" && editorIdentifier) {
      try {
        await prisma.editor.delete({
          where: {
            ownerId_editorTwitchName: {
              ownerId: session.user.id,
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
  }
};
