import { prisma } from "../auth";
import { authenticate } from "../middleware/authMiddleware";
import { corsHeaders, json } from "../middleware/cors";
import { refreshOverlayNow } from "../services/twitch-stats";
import {
  authorizeUrl,
  CONNECTION_SCOPES,
  exchangeCode,
  findChannel,
  revokeUserToken,
  twitchConfigured,
  validateUserToken,
} from "../services/twitch";

// Connecting a Twitch channel lets ovrly read its subscriptions, which Twitch only gives to the
// channel itself. It is its own OAuth flow rather than a scope on the sign-in, because whoever
// signs in to ovrly isn't always the channel (a mod connects the streamer's), and better-auth
// replaces the sign-in token, scopes and all, every time someone signs in.

const STATE_COOKIE = "ovrly_twitch_state";
const CALLBACK_PATH = "/api/twitch/callback";

const appBaseUrl = () => (process.env.APP_BASE_URL ?? "").replace(/\/$/, "");
// Has to be added to the Twitch app's OAuth Redirect URLs, next to the sign-in callback.
export const twitchRedirectUri = () => `${appBaseUrl()}${CALLBACK_PATH}`;

const redirect = (location: string, headers: Record<string, string> = {}) =>
  new Response(null, { status: 302, headers: { ...corsHeaders, Location: location, ...headers } });

// Back to the Twitch tab of the settings, with what happened.
const backToSettings = (params: Record<string, string>) =>
  redirect(`${appBaseUrl()}/settings?${new URLSearchParams({ tab: "twitch", ...params })}`, {
    "Set-Cookie": stateCookie("", 0),
  });

const stateCookie = (value: string, maxAge: number) =>
  [
    `${STATE_COOKIE}=${value}`,
    "Path=/api/twitch",
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

const listConnections = async (userId: string) => ({
  available: twitchConfigured(),
  connections: await prisma.twitchConnection.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { id: true, twitchId: true, login: true, displayName: true, createdAt: true },
  }),
});

// Open overlays showing this channel get its new state right away instead of with the next poll.
const refreshChannel = async (twitchId: string) => {
  const elements = await prisma.element.findMany({
    where: { twitchStat: { channelId: twitchId } },
    select: { overlayId: true },
    distinct: ["overlayId"],
  });
  elements.forEach(({ overlayId }) => refreshOverlayNow(overlayId));
};

export const handleTwitchRoutes = async (req: Request, path: string) => {
  if (path === "/api/twitch/connect" && req.method === "GET") {
    const session = await authenticate(req);
    if (!session) return redirect(`${appBaseUrl()}/`);
    if (!twitchConfigured()) return backToSettings({ error: "not_configured" });
    const state = crypto.randomUUID();
    return redirect(authorizeUrl(twitchRedirectUri(), state), {
      "Set-Cookie": stateCookie(state, 10 * 60),
    });
  }

  if (path === CALLBACK_PATH && req.method === "GET") {
    const url = new URL(req.url);
    const session = await authenticate(req);
    if (!session) return redirect(`${appBaseUrl()}/`);

    // Twitch sends people back with an error when they cancel.
    if (url.searchParams.get("error")) return backToSettings({ error: "cancelled" });
    const state = url.searchParams.get("state");
    const code = url.searchParams.get("code");
    if (!state || !code || state !== readCookie(req, STATE_COOKIE)) {
      return backToSettings({ error: "invalid_state" });
    }

    try {
      const token = await exchangeCode(code, twitchRedirectUri());
      if (!CONNECTION_SCOPES.every((scope) => token.scope.includes(scope))) {
        await revokeUserToken(token.accessToken);
        return backToSettings({ error: "missing_scope" });
      }
      const owner = await validateUserToken(token.accessToken);
      const channel = await findChannel(owner.login);
      const data = {
        userId: session.user.id,
        login: owner.login,
        displayName: channel?.displayName ?? owner.login,
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        expiresAt: token.expiresAt,
        scope: token.scope.join(" "),
      };
      // Whoever can sign in to Twitch as the channel decides who it is connected for, so
      // connecting it again moves it to them.
      const previous = await prisma.twitchConnection.findUnique({
        where: { twitchId: owner.id },
        select: { accessToken: true },
      });
      await prisma.twitchConnection.upsert({
        where: { twitchId: owner.id },
        create: { twitchId: owner.id, ...data },
        update: data,
      });
      if (previous) await revokeUserToken(previous.accessToken);
      await refreshChannel(owner.id);
      return backToSettings({ connected: data.displayName });
    } catch (error) {
      console.error("[TWITCH] Connecting a channel failed:", error);
      return backToSettings({ error: "failed" });
    }
  }

  if (path === "/api/twitch/connections" && req.method === "GET") {
    const session = await authenticate(req);
    if (!session) return json({ error: "Unauthorized" }, 401);
    return json(await listConnections(session.user.id));
  }

  const connectionMatch = path.match(/^\/api\/twitch\/connections\/([a-zA-Z0-9_-]+)$/);
  if (connectionMatch && req.method === "DELETE") {
    const session = await authenticate(req);
    if (!session) return json({ error: "Unauthorized" }, 401);
    const connection = await prisma.twitchConnection.findFirst({
      where: { id: connectionMatch[1], userId: session.user.id },
    });
    if (!connection) return json({ error: "Connection not found" }, 404);
    await prisma.twitchConnection.deleteMany({ where: { id: connection.id } });
    await revokeUserToken(connection.accessToken);
    await refreshChannel(connection.twitchId);
    return json(await listConnections(session.user.id));
  }

  return null;
};
