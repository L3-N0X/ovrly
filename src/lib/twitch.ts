import { request } from "./sharing";

export interface TwitchConnection {
  id: string;
  twitchId: string;
  login: string;
  displayName: string;
  createdAt: string;
  // Allowed to read cheers too; channels connected before subathons existed aren't.
  bits: boolean;
}

// A channel the subathons of an overlay can listen to.
export interface SubathonChannel {
  twitchId: string;
  login: string;
  displayName: string;
  // Its cheers can be read.
  bits: boolean;
  // Its events are coming in right now.
  listening: boolean;
}

export interface SubathonChannelsResponse {
  available: boolean;
  // The channel the overlay's owner signs in with, which subathons without a channel listen to.
  ownChannelId: string | null;
  channels: SubathonChannel[];
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
  subathonChannels: (overlayId: string) =>
    request<SubathonChannelsResponse>(`/api/overlays/${overlayId}/subathon-channels`),
};
