import { auth, prisma } from "./auth";
import dotenv from "dotenv";

dotenv.config();

const server = Bun.serve({
  port: 3000,
  async fetch(req, server) {
    const url = new URL(req.url);
    const path = url.pathname;

    console.log(`\n[SERVER LOG] =========== New Request ===========`);
    console.log(`[SERVER LOG] Path & Method: ${req.method} ${path}`);

    const corsHeaders = {
      "Access-Control-Allow-Origin": "http://localhost:5173",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Credentials": "true",
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (path.startsWith("/api/auth/")) {
      console.log(`[SERVER LOG] Twitch Client ID: ${process.env.AUTH_TWITCH_ID}`);
      console.log(
        `[SERVER LOG] Twitch Client Secret: ${
          process.env.AUTH_TWITCH_SECRET ? "********" : "Not Set"
        }`
      );
      const response = await auth.handler(req);
      for (const key in corsHeaders) {
        response.headers.set(key, corsHeaders[key as keyof typeof corsHeaders]);
      }
      return response;
    }

    const overlayIdMatch = path.match(/^\/api\/overlays\/([a-zA-Z0-9_-]+)$/);
    if (overlayIdMatch) {
      const session = await auth.api.getSession({ headers: req.headers });
      if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const overlayId = overlayIdMatch[1];
      const overlay = await prisma.overlay.findUnique({
        where: { id: overlayId },
      });

      if (!overlay || overlay.userId !== session.user.id) {
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

      if (req.method === "PATCH") {
        try {
          const { counter } = await req.json();
          if (typeof counter !== "number") {
            return new Response(JSON.stringify({ error: "Invalid 'counter' value" }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          const updatedOverlay = await prisma.overlay.update({
            where: { id: overlayId },
            data: { counter },
          });
          return new Response(JSON.stringify(updatedOverlay), {
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
        await prisma.overlay.delete({ where: { id: overlayId } });
        return new Response(null, { status: 204, headers: corsHeaders });
      }

      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path === "/api/overlays") {
      const session = await auth.api.getSession({ headers: req.headers });
      if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (req.method === "GET") {
        const overlays = await prisma.overlay.findMany({ where: { userId: session.user.id } });
        return new Response(JSON.stringify(overlays), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (req.method === "POST") {
        try {
          const { name, description } = await req.json();
          if (!name) {
            return new Response(JSON.stringify({ error: "Name is required" }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          const newOverlay = await prisma.overlay.create({
            data: { name, description, userId: session.user.id },
          });
          return new Response(JSON.stringify(newOverlay), {
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

      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (server.upgrade(req)) {
      return;
    }

    console.log(`[SERVER LOG] No route matched. Responding with "Hello world!".`);
    return new Response("Hello world!");
  },
  websocket: {
    message(ws, message) {
      server.publish("counter", message);
    },
    open(ws) {
      ws.subscribe("counter");
    },
  },
});
