import dotenv from "dotenv";
import { auth, prisma } from "./auth";

dotenv.config();

interface WebSocketData {
  overlayId: string;
}

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

      if (req.method === "GET") {
        return new Response(JSON.stringify(overlay), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (req.method === "PATCH") {
        try {
          const { counter, title, style } = await req.json();
          const dataToUpdate: { counter?: number; title?: string; style?: object } = {};

          if (typeof counter === "number") {
            dataToUpdate.counter = counter;
          }

          if (typeof title === "string") {
            dataToUpdate.title = title;
          }

          if (typeof style === "object" && style !== null) {
            dataToUpdate.style = style;
          }

          if (Object.keys(dataToUpdate).length === 0) {
            return new Response(JSON.stringify({ error: "No valid fields to update" }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          const updatedOverlay = await prisma.overlay.update({
            where: { id: overlayId },
            data: dataToUpdate,
          });

          server.publish(`overlay-${overlayId}`, JSON.stringify(updatedOverlay));

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
        if (!isOwner) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        await prisma.overlay.delete({ where: { id: overlayId } });
        return new Response(null, { status: 204, headers: corsHeaders });
      }

      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const publicOverlayIdMatch = path.match(/^\/api\/public\/overlays\/([a-zA-Z0-9_-]+)$/);
    if (publicOverlayIdMatch) {
      const overlayId = publicOverlayIdMatch[1];
      const overlay = await prisma.overlay.findUnique({
        where: { id: overlayId },
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

    if (path === "/api/overlays") {
      const session = await auth.api.getSession({ headers: req.headers });
      if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (req.method === "GET") {
        const userOverlays = await prisma.overlay.findMany({
          where: { userId: session.user.id },
        });

        const editors = await prisma.editor.findMany({
          where: { editorTwitchName: session.user.name },
        });

        const sharedOverlays = await prisma.overlay.findMany({
          where: {
            userId: {
              in: editors.map((v) => v.userId),
            },
          },
        });

        return new Response(JSON.stringify([...userOverlays, ...sharedOverlays]), {
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

    if (path === "/api/editors") {
      const session = await auth.api.getSession({ headers: req.headers });
      if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (req.method === "GET") {
        const editors = await prisma.editor.findMany({ where: { userId: session.user.id } });
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
          const newEditor = await prisma.editor.create({
            data: { userId: session.user.id, editorTwitchName: twitchName },
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
          await prisma.editor.delete({
            where: {
              userId_editorTwitchName: { userId: session.user.id, editorTwitchName: twitchName },
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

    if (path === "/ws") {
      const url = new URL(req.url);
      const overlayId = url.searchParams.get("overlayId");
      if (overlayId) {
        const upgraded = server.upgrade(req, {
          data: { overlayId },
        });
        if (upgraded) {
          console.log(`[SERVER LOG] WebSocket connection upgraded for overlay ${overlayId}`);
          return;
        }
      }
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    console.log(`[SERVER LOG] No route matched. Responding with "Hello world!".`);
    return new Response("Hello world!");
  },
  websocket: {
    open(ws) {
      const { overlayId } = ws.data as WebSocketData;
      ws.subscribe(`overlay-${overlayId}`);
      console.log(`[SERVER LOG] WebSocket subscribed to overlay-${overlayId}`);
    },
    message() {
      // Not used in this implementation, but good to have for future features
    },
    close(ws) {
      const { overlayId } = ws.data as WebSocketData;
      console.log(`[SERVER LOG] WebSocket connection closed for overlay ${overlayId}`);
    },
  },
});
