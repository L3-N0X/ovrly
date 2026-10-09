// A small client for the Twitch Helix API, with the same app (AUTH_TWITCH_ID / AUTH_TWITCH_SECRET)
// that users sign in with.
//
// Most of what overlays show is public and read with an app access token: a channel's follower
// total, its stream, its title and category, and the user lookup. Subscriptions are private to the channel, so they are
// read with a token of the channel itself, which its owner grants by connecting the channel
// (routes/twitch.ts, stored as a TwitchConnection).

const HELIX_URL = "https://api.twitch.tv/helix";
const OAUTH_URL = "https://id.twitch.tv/oauth2";

// What connecting a channel asks for: reading its subscriptions (count and points, and each new
// one for subathons) and its cheers (for subathons).
export const SUBSCRIPTIONS_SCOPE = "channel:read:subscriptions";
export const BITS_SCOPE = "bits:read";
export const CONNECTION_SCOPES = [SUBSCRIPTIONS_SCOPE, BITS_SCOPE];
// Channels connected before bits were asked for still work for everything else.
export const REQUIRED_SCOPES = [SUBSCRIPTIONS_SCOPE];

const clientId = () => process.env.AUTH_TWITCH_ID ?? "";
const clientSecret = () => process.env.AUTH_TWITCH_SECRET ?? "";

export const twitchConfigured = () => !!clientId() && !!clientSecret();

// Twitch login names: 4 to 25 letters, digits and underscores (some old ones are shorter).
export const isTwitchLogin = (value: string) => /^[a-zA-Z0-9_]{1,25}$/.test(value);

// What someone typed to pick a channel: its name, "@name" or a link to it.
export const channelLoginFrom = (input: string) => {
  const value = input.trim();
  const link = value.match(/^(?:https?:\/\/)?(?:www\.|m\.)?twitch\.tv\/([^/?#\s]+)/i);
  return (link ? link[1] : value.replace(/^@/, "")).toLowerCase();
};

export class TwitchError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// ---- App access token ----------------------------------------------------------------------

let appToken: { token: string; expiresAt: number } | null = null;
let appTokenRequest: Promise<string> | null = null;

const requestAppToken = async () => {
  const response = await fetch(`${OAUTH_URL}/token`, {
    method: "POST",
    body: new URLSearchParams({
      client_id: clientId(),
      client_secret: clientSecret(),
      grant_type: "client_credentials",
    }),
  });
  if (!response.ok) {
    throw new TwitchError(`Could not get a Twitch app token (${response.status})`, response.status);
  }
  const data = (await response.json()) as { access_token: string; expires_in: number };
  // Renewed a minute early, so a request never goes out with a token about to expire.
  appToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return data.access_token;
};

const getAppToken = async () => {
  if (appToken && appToken.expiresAt > Date.now()) return appToken.token;
  // Requests that need a token at the same time share one.
  appTokenRequest ??= requestAppToken().finally(() => {
    appTokenRequest = null;
  });
  return appTokenRequest;
};

// ---- Helix ---------------------------------------------------------------------------------

const helixWithToken = async (path: string, token: string) => {
  const response = await fetch(`${HELIX_URL}${path}`, {
    headers: { "Client-Id": clientId(), Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new TwitchError(`Twitch API ${path} failed (${response.status}): ${body}`, response.status);
  }
  return response.json();
};

// With the app token. An expired or revoked one is replaced once.
const helix = async <T>(path: string): Promise<T> => {
  try {
    return (await helixWithToken(path, await getAppToken())) as T;
  } catch (error) {
    if (!(error instanceof TwitchError) || error.status !== 401) throw error;
    appToken = null;
    return (await helixWithToken(path, await getAppToken())) as T;
  }
};

export interface TwitchChannel {
  id: string;
  login: string;
  displayName: string;
  profileImageUrl: string;
}

// The channel with this login name, or null when there is none.
export const findChannel = async (login: string): Promise<TwitchChannel | null> => {
  if (!isTwitchLogin(login)) return null;
  const { data } = await helix<{ data: HelixUser[] }>(
    `/users?login=${encodeURIComponent(login.toLowerCase())}`
  );
  return data[0] ? toChannel(data[0]) : null;
};

interface HelixUser {
  id: string;
  login: string;
  display_name: string;
  profile_image_url: string;
}

const toChannel = (user: HelixUser): TwitchChannel => ({
  id: user.id,
  login: user.login,
  displayName: user.display_name,
  profileImageUrl: user.profile_image_url,
});

// Helix takes up to 100 ids per request: this asks for `path?<param>=<id>&...` a hundred ids at a
// time and joins the results.
const inHundreds = async <T>(path: string, param: string, ids: string[]) => {
  const results: T[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const query = ids
      .slice(i, i + 100)
      .map((id) => `${param}=${encodeURIComponent(id)}`)
      .join("&");
    const { data } = await helix<{ data: T[] }>(`${path}?${query}`);
    results.push(...data);
  }
  return results;
};

// The channels with these ids, by id. Ids of channels that don't exist (anymore) are missing.
export const getChannelsById = async (channelIds: string[]) => {
  const users = await inHundreds<HelixUser>("/users", "id", channelIds);
  return new Map(users.map((user) => [user.id, toChannel(user)]));
};

// The title and category of each channel, live or not, by channel id.
export const getChannelInformation = async (channelIds: string[]) => {
  const channels = await inHundreds<{ broadcaster_id: string; title: string; game_name: string }>(
    "/channels",
    "broadcaster_id",
    channelIds
  );
  return new Map(
    channels.map((channel) => [
      channel.broadcaster_id,
      { title: channel.title, category: channel.game_name },
    ])
  );
};

export const getFollowerTotal = async (channelId: string) => {
  const { total } = await helix<{ total: number }>(
    `/channels/followers?broadcaster_id=${encodeURIComponent(channelId)}&first=1`
  );
  return total;
};

// The viewer count of every channel that is live, by channel id. Channels that aren't live are
// missing from the result.
export const getViewerCounts = async (channelIds: string[]) => {
  const viewers = new Map<string, number>();
  // Up to 100 channels per request.
  for (let i = 0; i < channelIds.length; i += 100) {
    const query = channelIds
      .slice(i, i + 100)
      .map((id) => `user_id=${encodeURIComponent(id)}`)
      .join("&");
    const { data } = await helix<{ data: { user_id: string; viewer_count: number }[] }>(
      `/streams?type=live&first=100&${query}`
    );
    data.forEach((stream) => viewers.set(stream.user_id, stream.viewer_count));
  }
  return viewers;
};

// With a token of the channel itself (channel:read:subscriptions). `total` includes the
// broadcaster's own subscription, as on Twitch.
export const getSubscriptions = async (channelId: string, userToken: string) => {
  const { total, points } = (await helixWithToken(
    `/subscriptions?broadcaster_id=${encodeURIComponent(channelId)}&first=1`,
    userToken
  )) as { total: number; points: number };
  return { total, points };
};

// Subscribes the EventSub WebSocket session `sessionId` (services/twitch-events.ts) to events of
// the channel whose token this is. One that exists already counts as done.
export const createEventSubSubscription = async (
  userToken: string,
  sessionId: string,
  type: string,
  condition: Record<string, string>
) => {
  const response = await fetch(`${HELIX_URL}/eventsub/subscriptions`, {
    method: "POST",
    headers: {
      "Client-Id": clientId(),
      Authorization: `Bearer ${userToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type,
      version: "1",
      condition,
      transport: { method: "websocket", session_id: sessionId },
    }),
  });
  if (!response.ok && response.status !== 409) {
    const body = await response.text().catch(() => "");
    throw new TwitchError(`Subscribing to ${type} failed (${response.status}): ${body}`, response.status);
  }
};

// ---- User tokens (connected channels) ------------------------------------------------------

export interface UserToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope: string[];
}

const tokenRequest = async (params: Record<string, string>): Promise<UserToken> => {
  const response = await fetch(`${OAUTH_URL}/token`, {
    method: "POST",
    body: new URLSearchParams({ client_id: clientId(), client_secret: clientSecret(), ...params }),
  });
  if (!response.ok) {
    throw new TwitchError(`Twitch token request failed (${response.status})`, response.status);
  }
  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope?: string[];
  };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
    scope: data.scope ?? [],
  };
};

export const authorizeUrl = (redirectUri: string, state: string) =>
  `${OAUTH_URL}/authorize?${new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: CONNECTION_SCOPES.join(" "),
    state,
    // Lets people pick which Twitch account to connect, instead of silently taking the one
    // they happen to be signed in to.
    force_verify: "true",
  })}`;

export const exchangeCode = (code: string, redirectUri: string) =>
  tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri });

export const refreshUserToken = (refreshToken: string) =>
  tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });

// Whose token it is.
export const validateUserToken = async (accessToken: string) => {
  const response = await fetch(`${OAUTH_URL}/validate`, {
    headers: { Authorization: `OAuth ${accessToken}` },
  });
  if (!response.ok) {
    throw new TwitchError(`Twitch token validation failed (${response.status})`, response.status);
  }
  const data = (await response.json()) as { user_id: string; login: string };
  return { id: data.user_id, login: data.login };
};

export const revokeUserToken = async (accessToken: string) => {
  await fetch(`${OAUTH_URL}/revoke`, {
    method: "POST",
    body: new URLSearchParams({ client_id: clientId(), token: accessToken }),
  }).catch(() => undefined);
};
