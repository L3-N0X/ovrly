export interface WebSocketData {
  overlayId: string;
  // Set when the handshake carried a valid session. Anonymous viewers (OBS browser
  // sources) connect without one; the socket is receive-only either way.
  userId: string | null;
}
