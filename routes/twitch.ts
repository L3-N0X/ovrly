import { prisma } from "../auth";
import { authenticate, requireOverlayRole } from "../middleware/authMiddleware";
import { corsHeaders, json } from "../middleware/cors";
import { refreshTwitchChannel } from "../services/twitch-variables";
import { listeningChannels, syncSubathonListeners } from "../services/twitch-events";
import {
  authorizeUrl,
  BITS_SCOPE,
  exchangeCode,
  findChannel,
  REQUIRED_SCOPES,
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
    select: { id: true, twitchId: true, login: true, displayName: true, createdAt: true, scope: true },
  }).then((connections) =>
    connections.map(({ scope, ...connection }) => ({
      ...connection,
      // Channels connected before subathons existed can't report cheers until connected again.
      bits: scope.split(" ").includes(BITS_SCOPE),
    }))
  ),
});

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
      if (!REQUIRED_SCOPES.every((scope) => token.scope.includes(scope))) {
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
      // Everyone who added the channel gets its subscriber stats (or loses them) right away.
      await refreshTwitchChannel(owner.id);
      // Subathons listen with the new token (and its scopes) from now on.
      syncSubathonListeners();
      return backToSettings({ connected: data.displayName });
    } catch (error) {
      console.error("[TWITCH] Connecting a channel failed:", error);
      return backToSettings({ error: "failed" });
    }
  }

  // The channels the subathons of an overlay can listen to: those connected by its owner or by
  // someone whose team the owner is on, and whether their events are coming in right now.
  const subathonMatch = path.match(/^\/api\/overlays\/([a-zA-Z0-9_-]+)\/subathon-channels$/);
  if (subathonMatch && req.method === "GET") {
    const session = await authenticate(req);
    if (!session) return json({ error: "Unauthorized" }, 401);
    const check = await requireOverlayRole(session.user, subathonMatch[1], "CONTROLLER");
    if (check.error) return check.error;
    const ownerId = check.access.overlay.userId;
    const teams = await prisma.accountShare.findMany({
      where: { userId: ownerId },
      select: { ownerId: true },
    });
    const connections = await prisma.twitchConnection.findMany({
      where: { userId: { in: [ownerId, ...teams.map((t) => t.ownerId)] } },
      orderBy: { createdAt: "asc" },
      select: { twitchId: true, login: true, displayName: true, scope: true },
    });
    const own = await prisma.account.findFirst({
      where: { userId: ownerId, providerId: "twitch" },
      select: { accountId: true },
    });
    const listening = listeningChannels();
    return json({
      available: twitchConfigured(),
      ownChannelId: own?.accountId ?? null,
      channels: connections.map(({ scope, ...channel }) => ({
        ...channel,
        bits: scope.split(" ").includes(BITS_SCOPE),
        listening: listening.has(channel.twitchId),
      })),
    });
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
    await refreshTwitchChannel(connection.twitchId);
    syncSubathonListeners();
    return json(await listConnections(session.user.id));
  }

  return null;
};
