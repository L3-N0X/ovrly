import { auth } from "../auth";
import { corsHeaders } from "../middleware/cors";

export const handleAuthRoutes = async (req: Request) => {
  const url = new URL(req.url);
  const path = url.pathname;
  
  if (path.startsWith("/api/auth/")) {
    console.log(`[SERVER LOG] Twitch Client ID: ${process.env.AUTH_TWITCH_ID}`);
    console.log(
      `[SERVER LOG] Twitch Client Secret: ${process.env.AUTH_TWITCH_SECRET ? "********" : "Not Set"}`
    );
    const response = await auth.handler(req);
    for (const key in corsHeaders) {
      response.headers.set(key, corsHeaders[key as keyof typeof corsHeaders]);
    }
    return response;
  }
  
  return null; // Return null if route doesn't match
};