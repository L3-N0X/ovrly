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

  // GET /api/editors - List all editors for the current user
  if (req.method === "GET" && !editorIdentifier) {
    const editors = await prisma.editor.findMany({ where: { ownerId: session.user.id } });
    return new Response(JSON.stringify(editors), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // POST /api/editors - Add a new editor
  if (req.method === "POST" && !editorIdentifier) {
    try {
      const { twitchName } = await req.json();
      if (!twitchName) {
        return new Response(JSON.stringify({ error: "Twitch name is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if the editor already exists for this owner
      const existingEditor = await prisma.editor.findFirst({
        where: {
          ownerId: session.user.id,
          editorTwitchName: twitchName,
        },
      });

      if (existingEditor) {
        return new Response(
          JSON.stringify({ error: "Editor with this Twitch name already exists" }),
          {
            status: 409, // Conflict
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
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
        JSON.stringify({ error: "Invalid request body or an unexpected error occurred" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  }

  // DELETE /api/editors/:editorIdentifier - Delete a specific editor
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
    } catch (e: any) {
      // Explicitly type 'e' for better type safety
      console.error(e);
      if (e.code === "P2025") {
        // Prisma error code for record not found
        return new Response(
          JSON.stringify({ error: "Editor not found or you don't have permission to delete it" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      return new Response(
        JSON.stringify({ error: "An unexpected error occurred during deletion" }),
        {
          status: 500, // Internal Server Error for other issues
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  }

  // If none of the above matched, it's a method not allowed or an unsupported route
  return new Response(JSON.stringify({ error: "Method not allowed or unsupported route" }), {
    status: 405,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
};
