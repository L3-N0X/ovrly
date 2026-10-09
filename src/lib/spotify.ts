import { request } from "./sharing";

export interface SpotifyConnection {
  id: string;
  spotifyId: string;
  displayName: string;
  createdAt: string;
}

export interface SpotifyConnectionResponse {
  // False when the server has no Spotify app configured.
  available: boolean;
  connection: SpotifyConnection | null;
}

export const spotifyApi = {
  connection: () => request<SpotifyConnectionResponse>("/api/spotify/connection"),
  disconnect: () =>
    request<SpotifyConnectionResponse>("/api/spotify/connection", { method: "DELETE" }),
  // Starts connecting an account: Spotify asks to allow reading what is playing, then sends the
  // browser back to the settings.
  connectUrl: "/api/spotify/connect",
};
