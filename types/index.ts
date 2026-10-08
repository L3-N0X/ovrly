export interface WebSocketData {
  overlayId: string;
  // Set when the handshake carried a valid session. Anonymous viewers (OBS browser
  // sources) connect without one; the socket is receive-only either way.
  userId: string | null;
  // Whose overlay it is: their Twitch channels are polled while it is open.
  ownerId: string;
  // Set for people with access to the overlay, who are told when the owner's variables change
  // (services/variables.ts) so their list of variables stays current.
  seesVariables: boolean;
}
