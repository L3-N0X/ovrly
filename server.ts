import dotenv from "dotenv";
import { handleCors } from "./middleware/cors";
import { handleAuthRoutes } from "./routes/auth";
import { handlePresetsRoutes } from "./routes/presets";
import { handlePublicOverlaysRoutes } from "./routes/publicOverlays";
import { handleEditorsRoutes } from "./routes/editors";
import { handleFilesRoutes } from './routes/files';
import { handleElementsRoutes } from "./routes/elements";
import { handleOverlaysRoutes } from "./routes/overlays";
import { handleReorderRoutes } from "./routes/reorder";
import { handleOverlayEditorsRoutes } from "./routes/overlay-editors";
import { WebSocketData } from "./types";

dotenv.config();

const server = Bun.serve({
  port: 3000,
  async fetch(req, server) {
    const url = new URL(req.url);
    const path = url.pathname;

    console.log(`\n[SERVER LOG] =========== New Request ==========`);
    console.log(`[SERVER LOG] Path & Method: ${req.method} ${path}`);

    // Handle CORS preflight
    const corsResponse = handleCors(req);
    if (corsResponse) {
      return corsResponse;
    }

    // Handle WebSocket upgrade
    if (path === "/ws") {
      const url = new URL(req.url);
      const overlayId = url.searchParams.get("overlayId");
      if (overlayId) {
        const upgraded = server.upgrade(req, {
          data: { overlayId },
        });
        if (upgraded) {
          console.log(`[SERVER LOG] WebSocket connection upgraded for overlay ${overlayId}`);
          return new Response(null, { status: 101 });
        }
      }
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    // Handle auth routes
    const authResponse = await handleAuthRoutes(req);
    if (authResponse) {
      return authResponse;
    }

    // Handle overlay routes
    const overlayResponse = await handleOverlaysRoutes(req, server, path);
    if (overlayResponse) {
      return overlayResponse;
    }

    // Handle element routes
    const elementResponse = await handleElementsRoutes(req, server, path);
    if (elementResponse) {
      return elementResponse;
    }

    // Handle reorder routes
    const reorderResponse = await handleReorderRoutes(req, server, path);
    if (reorderResponse) {
      return reorderResponse;
    }

    // Handle public overlay routes
    const publicOverlayResponse = await handlePublicOverlaysRoutes(req, path);
    if (publicOverlayResponse) {
      return publicOverlayResponse;
    }

    // Handle editor routes
    const editorResponse = await handleEditorsRoutes(req, path);
    if (editorResponse) {
      return editorResponse;
    }

    // Handle overlay editor routes
    const overlayEditorResponse = await handleOverlayEditorsRoutes(req, path);
    if (overlayEditorResponse) {
      return overlayEditorResponse;
    }

    // Handle preset routes
    const presetResponse = await handlePresetsRoutes(req, path);
    if (presetResponse) {
      return presetResponse;
    }

    // Handle files routes
    const filesResponse = await handleFilesRoutes(req, path);
    if (filesResponse) {
      return filesResponse;
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

console.log(`Server running on port ${server.port}`);
