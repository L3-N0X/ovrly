import dotenv from "dotenv";
import { handleCors } from "./middleware/cors";
import { handleAuthRoutes } from "./routes/auth";
import { handlePresetsRoutes } from "./routes/presets";
import { handlePublicOverlaysRoutes } from "./routes/publicOverlays";
import { handleFilesRoutes, handleUploadsRoutes } from "./routes/files";
import { handleElementsRoutes } from "./routes/elements";
import { handleOverlaysRoutes } from "./routes/overlays";
import { handleReorderRoutes } from "./routes/reorder";
import { handleBingoRoutes } from "./routes/bingo";
import { handleSharingRoutes } from "./routes/sharing";
import { handleTwitchRoutes } from "./routes/twitch";
import { handleSpotifyRoutes } from "./routes/spotify";
import { handlePublicApiRoutes } from "./routes/publicApi";
import { handleVariablesRoutes } from "./routes/variables";
import { handleComponentsRoutes } from "./routes/components";
import { authorizeWebSocket } from "./middleware/wsAuth";
import { missingStorageConfig, MAX_UPLOAD_BYTES } from "./services/file-storage";
import { refreshOpenedOverlay, startTwitchVariables } from "./services/twitch-variables";
import { refreshOpenedSpotify, startSpotifyVariables } from "./services/spotify-variables";
import { startTwitchEvents, syncSubathonListeners } from "./services/twitch-events";
import { variablesChannel } from "./services/variables";
import type { WebSocketData } from "./types";
import path from "path";
import type { ServerWebSocket } from "bun";

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

// Sent on an interval so reverse proxies (nginx closes idle upstream connections after 60s)
// and the client's watchdog see traffic even when an overlay isn't changing.
const HEARTBEAT_INTERVAL_MS = 20_000;
const HEARTBEAT_MESSAGE = JSON.stringify({ type: "heartbeat" });
const sockets = new Set<ServerWebSocket<WebSocketData>>();

const server = Bun.serve<WebSocketData>({
  // Overridable so a second instance can run next to one on 3000 (dev tooling
  // uses this); the documented deployments all rely on the default.
  port: Number(process.env.PORT ?? 3000),
  // The multipart envelope adds a little on top of the file itself.
  maxRequestBodySize: MAX_UPLOAD_BYTES + 1024 * 1024,
  async fetch(req, server) {
    const url = new URL(req.url);
    const reqPath = url.pathname;

    // The public API answers its own preflights: it may be called from any origin.
    const publicApiResponse = await handlePublicApiRoutes(req, server, reqPath);
    if (publicApiResponse) {
      return publicApiResponse;
    }

    // Handle CORS preflight
    const corsResponse = handleCors(req);
    if (corsResponse) {
      return corsResponse;
    }

    // Handle WebSocket upgrade
    if (reqPath === "/ws") {
      const handshake = await authorizeWebSocket(req);
      if (!handshake.ok) {
        return new Response(handshake.message, { status: handshake.status });
      }
      if (server.upgrade(req, { data: handshake.data })) {
        // Bun completes the handshake itself; returning nothing is the documented success path.
        return;
      }
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    // Uploaded images, served out of S3
    const uploadResponse = await handleUploadsRoutes(req, reqPath);
    if (uploadResponse) {
      return uploadResponse;
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

      // Handle bingo routes
      const bingoResponse = await handleBingoRoutes(req, server, reqPath);
      if (bingoResponse) {
        return bingoResponse;
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

      // Handle sharing routes (who has access to what, and with which role)
      const sharingResponse = await handleSharingRoutes(req, server, reqPath);
      if (sharingResponse) {
        return sharingResponse;
      }

      // Handle API key and variable routes (what the public API writes)
      const variablesResponse = await handleVariablesRoutes(req, server, reqPath);
      if (variablesResponse) {
        return variablesResponse;
      }

      // Handle component routes (elements saved to add to any overlay)
      const componentsResponse = await handleComponentsRoutes(req, reqPath);
      if (componentsResponse) {
        return componentsResponse;
      }

      // Handle Twitch routes (connecting channels for their subscriber stats)
      const twitchResponse = await handleTwitchRoutes(req, reqPath);
      if (twitchResponse) {
        return twitchResponse;
      }

      // Handle Spotify routes (connecting an account for its playback)
      const spotifyResponse = await handleSpotifyRoutes(req, reqPath);
      if (spotifyResponse) {
        return spotifyResponse;
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
    // Clients never send anything, so keep the frame limit tiny.
    maxPayloadLength: 1024,
    // Protocol-level pings are answered by the browser automatically; a peer that stops
    // answering (half-open TCP connection) is dropped once it has been silent this long.
    idleTimeout: 60,
    open(ws) {
      const { overlayId, ownerId, seesVariables } = ws.data;
      sockets.add(ws);
      ws.subscribe(`overlay-${overlayId}`);
      if (seesVariables) ws.subscribe(variablesChannel(ownerId));
      // Twitch channels and Spotify playback are only polled while an overlay of their user is
      // open, so they may be out of date.
      refreshOpenedOverlay(ownerId);
      refreshOpenedSpotify(ownerId);
      // Paused subathons of the owner count Twitch events while one of their overlays is open.
      syncSubathonListeners();
      console.log(`[SERVER LOG] WebSocket subscribed to overlay-${overlayId}`);
    },
    message() {
      // Receive-only: overlay changes go through the HTTP API and are broadcast from there.
    },
    close(ws) {
      sockets.delete(ws);
      console.log(`[SERVER LOG] WebSocket connection closed for overlay ${ws.data.overlayId}`);
    },
  },
});

setInterval(() => {
  for (const ws of sockets) {
    ws.ping();
    ws.send(HEARTBEAT_MESSAGE);
  }
}, HEARTBEAT_INTERVAL_MS);

const openOverlayOwners = () => [...sockets].map((ws) => ws.data.ownerId);
startTwitchVariables(server, openOverlayOwners);
startSpotifyVariables(server, openOverlayOwners);
startTwitchEvents(server, openOverlayOwners);

console.log(`Server running on port ${server.port}`);
console.log(`App base URL from env: ${process.env.APP_BASE_URL}`);

const missingS3Config = missingStorageConfig();
if (missingS3Config.length > 0) {
  console.warn(
    `[SERVER WARNING] Image uploads are disabled, missing S3 configuration: ${missingS3Config.join(", ")}`
  );
}
