// A small client for the Spotify Web API, with the app in SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET.
//
// Playback is private, so everything is read with a token of the listener, which they grant by
// connecting their Spotify account (routes/spotify.ts, stored as a SpotifyConnection).

const API_URL = "https://api.spotify.com/v1";
const ACCOUNTS_URL = "https://accounts.spotify.com";

// What connecting an account asks for: what is playing, and on which device at what volume.
export const CONNECTION_SCOPES = ["user-read-playback-state", "user-read-currently-playing"];

const clientId = () => process.env.SPOTIFY_CLIENT_ID ?? "";
const clientSecret = () => process.env.SPOTIFY_CLIENT_SECRET ?? "";

export const spotifyConfigured = () => !!clientId() && !!clientSecret();

export class SpotifyError extends Error {
  readonly status: number;
  // Seconds Spotify asks to wait after rate limiting (429).
  readonly retryAfter: number | null;

  constructor(message: string, status: number, retryAfter: number | null = null) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

// ---- User tokens ---------------------------------------------------------------------------

export interface UserToken {
  accessToken: string;
  // Spotify only sends a new one sometimes; null keeps the one stored.
  refreshToken: string | null;
  expiresAt: Date;
  scope: string[];
}

const tokenRequest = async (params: Record<string, string>): Promise<UserToken> => {
  const response = await fetch(`${ACCOUNTS_URL}/api/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId()}:${clientSecret()}`).toString("base64")}`,
    },
    body: new URLSearchParams(params),
  });
  if (!response.ok) {
    throw new SpotifyError(`Spotify token request failed (${response.status})`, response.status);
  }
  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
  };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
    scope: data.scope?.split(" ").filter(Boolean) ?? [],
  };
};

export const authorizeUrl = (redirectUri: string, state: string) =>
  `${ACCOUNTS_URL}/authorize?${new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: CONNECTION_SCOPES.join(" "),
    state,
    // Lets people pick which account to connect, instead of silently taking the one they happen
    // to be signed in to.
    show_dialog: "true",
  })}`;

export const exchangeCode = (code: string, redirectUri: string) =>
  tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri });

export const refreshUserToken = (refreshToken: string) =>
  tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });

// ---- Web API -------------------------------------------------------------------------------

const api = async (path: string, token: string) => {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const retryAfter = Number(response.headers.get("Retry-After"));
    throw new SpotifyError(
      `Spotify API ${path} failed (${response.status}): ${body}`,
      response.status,
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null
    );
  }
  // 204: nothing is playing.
  return response.status === 204 ? null : response.json();
};

// Whose token it is.
export const getProfile = async (token: string) => {
  const data = (await api("/me", token)) as { id: string; display_name: string | null };
  return { id: data.id, displayName: data.display_name || data.id };
};

interface SpotifyImage {
  url: string;
  width: number | null;
  height: number | null;
}

interface PlaybackResponse {
  is_playing: boolean;
  progress_ms: number | null;
  shuffle_state: boolean;
  repeat_state: "off" | "track" | "context";
  device: { name: string; volume_percent: number | null } | null;
  currently_playing_type: string;
  item:
    | {
        type: "track";
        name: string;
        duration_ms: number;
        explicit: boolean;
        external_urls?: { spotify?: string };
        artists: { name: string }[];
        album: { name: string; images: SpotifyImage[] };
      }
    | {
        type: "episode";
        name: string;
        duration_ms: number;
        explicit: boolean;
        external_urls?: { spotify?: string };
        images: SpotifyImage[];
        show: { name: string; publisher: string; images: SpotifyImage[] };
      }
    | null;
}

export interface Playback {
  playing: boolean;
  progressMs: number;
  shuffle: boolean;
  repeat: "off" | "track" | "context";
  // Null when the device doesn't say (some speakers and cars).
  volume: number | null;
  device: string;
  // Null while an ad or something Spotify doesn't describe is playing.
  item: {
    kind: "track" | "episode";
    title: string;
    // Joined artists of a track, the show of an episode.
    artist: string;
    // The album of a track, the publisher of an episode.
    album: string;
    durationMs: number;
    explicit: boolean;
    url: string;
    // Largest first, as Spotify sends them (640, 300, 64 for albums).
    images: SpotifyImage[];
  } | null;
}

const byWidth = (images: SpotifyImage[]) =>
  [...images].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));

/** What the listener is playing right now, or null when nothing is (no active device). */
export const getPlayback = async (token: string): Promise<Playback | null> => {
  const data = (await api("/me/player?additional_types=episode", token)) as PlaybackResponse | null;
  if (!data) return null;
  const item = data.item;
  return {
    playing: data.is_playing,
    progressMs: data.progress_ms ?? 0,
    shuffle: data.shuffle_state,
    repeat: data.repeat_state,
    volume: data.device?.volume_percent ?? null,
    device: data.device?.name ?? "",
    item: !item
      ? null
      : item.type === "episode"
        ? {
            kind: "episode",
            title: item.name,
            artist: item.show.name,
            album: item.show.publisher,
            durationMs: item.duration_ms,
            explicit: item.explicit,
            url: item.external_urls?.spotify ?? "",
            images: byWidth(item.images.length > 0 ? item.images : item.show.images),
          }
        : {
            kind: "track",
            title: item.name,
            artist: item.artists.map((artist) => artist.name).join(", "),
            album: item.album.name,
            durationMs: item.duration_ms,
            explicit: item.explicit,
            url: item.external_urls?.spotify ?? "",
            images: byWidth(item.album.images),
          },
  };
};
