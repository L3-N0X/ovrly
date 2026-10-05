import { prisma } from "../auth";
import { authenticate } from "./authMiddleware";
import type { WebSocketData } from "../types";

const OVERLAY_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

const toOrigin = (value: string | undefined) => {
  try {
    return value ? new URL(value).origin : null;
  } catch {
    return null;
  }
};

const extraOrigins = (process.env.WS_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((value) => toOrigin(value.trim()))
  .filter((origin): origin is string => origin !== null);

const configuredOrigins = new Set<string>([
  ...extraOrigins,
  ...[toOrigin(process.env.APP_BASE_URL)].filter((origin): origin is string => origin !== null),
  // Vite dev server, which proxies /ws to this process.
  ...(process.env.NODE_ENV === "production" ? [] : ["http://localhost:5173"]),
]);

// Browsers always send Origin on WebSocket handshakes, so this stops other websites from
// opening sockets from a visitor's browser. Clients that don't send one (curl, OBS
// internals, other servers) are not a cross-site risk and are let through.
export const isAllowedOrigin = (req: Request) => {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  if (configuredOrigins.has(origin)) return true;
  const host = req.headers.get("host");
  try {
    return host !== null && new URL(origin).host === host;
  } catch {
    return false;
  }
};

export type WebSocketHandshake =
  | { ok: true; data: WebSocketData }
  | { ok: false; status: number; message: string };

// Validates a /ws upgrade request. Overlays are public by id (the OBS URL carries no
// session), so a session is optional; when one is present its user is recorded.
export const authorizeWebSocket = async (req: Request): Promise<WebSocketHandshake> => {
  if (!isAllowedOrigin(req)) {
    return { ok: false, status: 403, message: "Origin not allowed" };
  }

  const overlayId = new URL(req.url).searchParams.get("overlayId");
  if (!overlayId || !OVERLAY_ID_PATTERN.test(overlayId)) {
    return { ok: false, status: 400, message: "Missing or invalid overlayId" };
  }

  const overlay = await prisma.overlay.findUnique({
    where: { id: overlayId },
    select: { id: true },
  });
  if (!overlay) {
    return { ok: false, status: 404, message: "Overlay not found" };
  }

  const session = req.headers.has("cookie") ? await authenticate(req).catch(() => null) : null;
  return { ok: true, data: { overlayId, userId: session?.user.id ?? null } };
};
