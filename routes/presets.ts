import { corsHeaders } from "../middleware/cors";

export const handlePresetsRoutes = async (req: Request, path: string) => {
  if (path === "/api/presets/overlays") {
    if (req.method === "GET") {
      try {
        // Read the presets file
        const presetsPath = `${process.cwd()}/public/presets/overlay-presets.json`;
        const presetsContent = await Bun.file(presetsPath).text();
        const presets = JSON.parse(presetsContent);

        return new Response(JSON.stringify(presets), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("Error reading presets:", error);
        return new Response(JSON.stringify({ error: "Failed to load presets" }), {
          status: 500,
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