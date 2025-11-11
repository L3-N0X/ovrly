import dotenv from "dotenv";
import { handleCors } from "./middleware/cors";
import { handleAuthRoutes } from "./routes/auth";
import { handlePresetsRoutes } from "./routes/presets";
import { handlePublicOverlaysRoutes } from "./routes/publicOverlays";
import { handleEditorsRoutes } from "./routes/editors";
import { handleFilesRoutes } from "./routes/files";
import { handleElementsRoutes } from "./routes/elements";
import { handleOverlaysRoutes } from "./routes/overlays";
import { handleReorderRoutes } from "./routes/reorder";
import { handleOverlayEditorsRoutes } from "./routes/overlay-editors";
import { WebSocketData } from "./types";
import path from "path";

dotenv.config();

const PUBLIC_PATH = path.join(import.meta.dir, "public");
const DIST_PATH = path.join(import.meta.dir, "dist");

const mimeTypes: { [key: string]: string } = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
  ".woff": "application/font-woff",
  ".ttf": "application/font-ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".otf": "application/font-otf",
  ".wasm": "application/wasm",
};

async function serveStaticFile(filePath: string): Promise<Response | null> {
  try {
    const file = Bun.file(filePath);
    if (await file.exists()) {
      const extension = path.extname(filePath);
      const contentType = mimeTypes[extension] || "application/octet-stream";
      return new Response(file, {
        headers: { "Content-Type": contentType },
      });
    }
  } catch (error) {
    console.error(`[SERVER LOG] Error serving static file ${filePath}:`, error);
  }
  return null;
}

const server = Bun.serve({
  port: 3000,
  async fetch(req, server) {
    const url = new URL(req.url);
    const reqPath = url.pathname;

    // Handle CORS preflight
    const corsResponse = handleCors(req);
    if (corsResponse) {
      return corsResponse;
    }

    // Handle WebSocket upgrade
    if (reqPath === "/ws") {
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

    // API Routes
    if (reqPath.startsWith("/api/")) {
      // Handle auth routes
      const authResponse = await handleAuthRoutes(req);
      if (authResponse) {
        return authResponse;
      }

      // Handle overlay routes
      const overlayResponse = await handleOverlaysRoutes(req, server, reqPath);
      if (overlayResponse) {
        return overlayResponse;
      }

      // Handle element routes
      const elementResponse = await handleElementsRoutes(req, server, reqPath);
      if (elementResponse) {
        return elementResponse;
      }

      // Handle reorder routes
      const reorderResponse = await handleReorderRoutes(req, server, reqPath);
      if (reorderResponse) {
        return reorderResponse;
      }

      // Handle public overlay routes
      const publicOverlayResponse = await handlePublicOverlaysRoutes(req, reqPath);
      if (publicOverlayResponse) {
        return publicOverlayResponse;
      }

      // Handle editor routes
      const editorResponse = await handleEditorsRoutes(req, reqPath);
      if (editorResponse) {
        return editorResponse;
      }

      // Handle overlay editor routes
      const overlayEditorResponse = await handleOverlayEditorsRoutes(req, reqPath);
      if (overlayEditorResponse) {
        return overlayEditorResponse;
      }

      // Handle preset routes
      const presetResponse = await handlePresetsRoutes(req, reqPath);
      if (presetResponse) {
        return presetResponse;
      }

      // Handle files routes
      const filesResponse = await handleFilesRoutes(req, reqPath);
      if (filesResponse) {
        return filesResponse;
      }
    }

    // Serve static files from public directory
    let staticResponse = await serveStaticFile(path.join(PUBLIC_PATH, reqPath));
    if (staticResponse) return staticResponse;

    // Serve static files from dist directory (frontend assets)
    staticResponse = await serveStaticFile(path.join(DIST_PATH, reqPath));
    if (staticResponse) return staticResponse;

    const spaIndex = await serveStaticFile(path.join(DIST_PATH, "index.html"));
    if (spaIndex) return spaIndex;

    return new Response("Not Found", { status: 404 });
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
console.log(`App base URL from env: ${process.env.APP_BASE_URL}`);
