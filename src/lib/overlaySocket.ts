import type { PrismaOverlay } from "@/lib/types";

// The server sends a heartbeat every 20s, so 2.5 missed beats means the connection is dead
// even if the browser hasn't noticed (idle proxy timeout, sleeping laptop, half-open TCP).
const STALE_AFTER_MS = 50_000;
const MIN_RETRY_MS = 1_000;
const MAX_RETRY_MS = 30_000;

interface OverlaySocketHandlers {
  onOverlay: (overlay: PrismaOverlay) => void;
  // Fired after the socket re-established following a drop. Updates broadcast while it was
  // down are lost, so callers should refetch the overlay here.
  onReconnect?: () => void;
}

/**
 * Keeps a WebSocket to the overlay's live channel open: reconnects with exponential
 * backoff, detects silent connections via the server heartbeat, and reconnects right away
 * when the network or tab comes back. Returns a function that tears everything down.
 */
export const connectOverlaySocket = (
  overlayId: string,
  { onOverlay, onReconnect }: OverlaySocketHandlers
) => {
  let ws: WebSocket | null = null;
  let disposed = false;
  let hasConnected = false;
  let attempt = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let staleTimer: ReturnType<typeof setTimeout> | undefined;

  const detach = () => {
    clearTimeout(staleTimer);
    if (!ws) return;
    ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
    ws.close();
    ws = null;
  };

  const scheduleReconnect = () => {
    if (disposed || retryTimer) return;
    const backoff = Math.min(MAX_RETRY_MS, MIN_RETRY_MS * 2 ** attempt++);
    retryTimer = setTimeout(connect, backoff / 2 + Math.random() * (backoff / 2));
  };

  const dropAndReconnect = () => {
    detach();
    scheduleReconnect();
  };

  const armStaleTimer = () => {
    clearTimeout(staleTimer);
    staleTimer = setTimeout(dropAndReconnect, STALE_AFTER_MS);
  };

  function connect() {
    retryTimer = undefined;
    if (disposed) return;
    detach();

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(
      `${protocol}//${window.location.host}/ws?overlayId=${encodeURIComponent(overlayId)}`
    );
    ws = socket;

    socket.onopen = () => {
      attempt = 0;
      armStaleTimer();
      if (hasConnected) onReconnect?.();
      hasConnected = true;
    };
    socket.onmessage = (event) => {
      armStaleTimer();
      try {
        const message = JSON.parse(event.data);
        if (message?.type === "heartbeat") return;
        onOverlay(message as PrismaOverlay);
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    };
    socket.onclose = dropAndReconnect;
  }

  // Skip the backoff wait when there's a reason to believe the connection can work now.
  const reconnectNow = () => {
    if (disposed || ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING) {
      return;
    }
    clearTimeout(retryTimer);
    attempt = 0;
    connect();
  };
  const onVisibility = () => {
    if (document.visibilityState === "visible") reconnectNow();
  };
  window.addEventListener("online", reconnectNow);
  document.addEventListener("visibilitychange", onVisibility);

  connect();

  return () => {
    disposed = true;
    clearTimeout(retryTimer);
    window.removeEventListener("online", reconnectNow);
    document.removeEventListener("visibilitychange", onVisibility);
    detach();
  };
};
