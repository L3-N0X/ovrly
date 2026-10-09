import { prisma } from "../auth";
import { authenticate } from "../middleware/authMiddleware";
import { corsHeaders, json } from "../middleware/cors";
import { connectSpotifySource, removeSpotifySource } from "../services/spotify-variables";
import {
  authorizeUrl,
  CONNECTION_SCOPES,
  exchangeCode,
  getProfile,
  spotifyConfigured,
  SpotifyError,
} from "../services/spotify";

// Connecting a Spotify account lets ovrly read what its listener is playing, which becomes the
// variables of their "spotify:player" source (services/spotify-variables.ts). Each ovrly user
// connects one account; connecting another replaces it.

const STATE_COOKIE = "ovrly_spotify_state";
const CALLBACK_PATH = "/api/spotify/callback";

const appBaseUrl = () => (process.env.APP_BASE_URL ?? "").replace(/\/$/, "");
// Has to be added to the Spotify app's Redirect URIs. Spotify refuses "localhost" there; locally,
// APP_BASE_URL has to use http://127.0.0.1:<port> instead.
export const spotifyRedirectUri = () => `${appBaseUrl()}${CALLBACK_PATH}`;

const redirect = (location: string, headers: Record<string, string> = {}) =>
  new Response(null, { status: 302, headers: { ...corsHeaders, Location: location, ...headers } });

// Back to the Spotify tab of the settings, with what happened.
const backToSettings = (params: Record<string, string>) =>
  redirect(`${appBaseUrl()}/settings?${new URLSearchParams({ tab: "spotify", ...params })}`, {
    "Set-Cookie": stateCookie("", 0),
  });

const stateCookie = (value: string, maxAge: number) =>
  [
    `${STATE_COOKIE}=${value}`,
    "Path=/api/spotify",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
    ...(appBaseUrl().startsWith("https://") ? ["Secure"] : []),
  ].join("; ");

const readCookie = (req: Request, name: string) =>
  req.headers
    .get("Cookie")
    ?.split(";")
    .map((part) => part.trim().split("="))
    .find(([key]) => key === name)?.[1] ?? null;

const connectionOf = async (userId: string) => ({
  available: spotifyConfigured(),
  connection: await prisma.spotifyConnection.findUnique({
    where: { userId },
    select: { id: true, spotifyId: true, displayName: true, createdAt: true },
  }),
});

export const handleSpotifyRoutes = async (req: Request, path: string) => {
  if (path === "/api/spotify/connect" && req.method === "GET") {
    const session = await authenticate(req);
    if (!session) return redirect(`${appBaseUrl()}/`);
    if (!spotifyConfigured()) return backToSettings({ error: "not_configured" });
    const state = crypto.randomUUID();
    return redirect(authorizeUrl(spotifyRedirectUri(), state), {
      "Set-Cookie": stateCookie(state, 10 * 60),
    });
  }

  if (path === CALLBACK_PATH && req.method === "GET") {
    const url = new URL(req.url);
    const session = await authenticate(req);
    if (!session) return redirect(`${appBaseUrl()}/`);

    // Spotify sends people back with an error when they cancel.
    if (url.searchParams.get("error")) return backToSettings({ error: "cancelled" });
    const state = url.searchParams.get("state");
    const code = url.searchParams.get("code");
    if (!state || !code || state !== readCookie(req, STATE_COOKIE)) {
      return backToSettings({ error: "invalid_state" });
    }

    try {
      const token = await exchangeCode(code, spotifyRedirectUri());
      if (!token.refreshToken || !CONNECTION_SCOPES.every((scope) => token.scope.includes(scope))) {
        return backToSettings({ error: "missing_scope" });
      }
      const profile = await getProfile(token.accessToken);
      const data = {
        spotifyId: profile.id,
        displayName: profile.displayName,
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        expiresAt: token.expiresAt,
        scope: token.scope.join(" "),
      };
      await prisma.spotifyConnection.upsert({
        where: { userId: session.user.id },
        create: { userId: session.user.id, ...data },
        update: data,
      });
      await connectSpotifySource(session.user.id, profile);
      return backToSettings({ connected: profile.displayName });
    } catch (error) {
      console.error("[SPOTIFY] Connecting an account failed:", error);
      // A Spotify app in development mode only lets in the accounts on its user list.
      if (error instanceof SpotifyError && error.status === 403) {
        return backToSettings({ error: "not_registered" });
      }
      return backToSettings({ error: "failed" });
    }
  }

  if (path === "/api/spotify/connection" && req.method === "GET") {
    const session = await authenticate(req);
    if (!session) return json({ error: "Unauthorized" }, 401);
    return json(await connectionOf(session.user.id));
  }

  if (path === "/api/spotify/connection" && req.method === "DELETE") {
    const session = await authenticate(req);
    if (!session) return json({ error: "Unauthorized" }, 401);
    // Spotify has no endpoint to revoke a token; people remove ovrly under their account's
    // "Manage apps" to take its access away for good.
    await prisma.spotifyConnection.deleteMany({ where: { userId: session.user.id } });
    await removeSpotifySource(session.user.id);
    return json(await connectionOf(session.user.id));
  }

  return null;
};
