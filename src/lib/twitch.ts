import { request } from "./sharing";

export interface TwitchConnection {
  id: string;
  twitchId: string;
  login: string;
  displayName: string;
  createdAt: string;
}

export interface TwitchConnectionsResponse {
  // False when the server has no Twitch app configured.
  available: boolean;
  connections: TwitchConnection[];
}

export const twitchApi = {
  connections: () => request<TwitchConnectionsResponse>("/api/twitch/connections"),
  disconnect: (id: string) =>
    request<TwitchConnectionsResponse>(`/api/twitch/connections/${id}`, { method: "DELETE" }),
  // Starts connecting a channel: Twitch asks to allow reading its subscriptions, then sends
  // the browser back to the settings.
  connectUrl: "/api/twitch/connect",
};
