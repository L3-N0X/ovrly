import { prisma } from "../auth";
import { corsHeaders } from "../middleware/cors";

export const handlePublicOverlaysRoutes = async (req: Request, path: string) => {
  const publicOverlayIdMatch = path.match(/^\/api\/public\/overlays\/([a-zA-Z0-9_-]+)$/);
  if (publicOverlayIdMatch) {
    const overlayId = publicOverlayIdMatch[1];
    const overlay = await prisma.overlay.findUnique({
      where: { id: overlayId },
      include: {
        elements: {
          include: {
            title: true,
            counter: true,
          },
        },
      },
    });

    if (!overlay) {
      return new Response(JSON.stringify({ error: "Overlay not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "GET") {
      return new Response(JSON.stringify(overlay), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  
  return null; // Return null if route doesn't match
};