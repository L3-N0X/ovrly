import { prisma } from "../auth";
import { authenticate, requireOverlayRole } from "../middleware/authMiddleware";
import { json } from "../middleware/cors";
import { generateApiKey, MAX_API_KEYS_PER_USER } from "../services/api-keys";
import { addTwitchSource } from "../services/twitch-variables";
import {
  deleteVariables,
  deleteVariableSource,
  listVariables,
  listVariableSources,
  setVariables,
  setVariableValue,
  VariableError,
} from "../services/variables";
import { isVariableName, parseVariableType, parseVariableValue } from "../lib/variables";

// What the app itself calls about variables: the variables tab of the editor, and the API keys
// and variables in the settings. The public API is routes/publicApi.ts.
//
// The editor works on the variables of the overlay's owner, whoever has it open, with the role
// they have on the overlay: controllers change values (that is running the overlay), editors
// also create and delete variables and add providers.

type Publisher = { publish: (channel: string, message: string) => unknown | Promise<unknown> };

const listApiKeys = (userId: string) =>
  prisma.apiKey.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, prefix: true, lastUsedAt: true, createdAt: true },
  });

const listAll = async (userId: string) => ({
  variables: await listVariables(userId),
  sources: await listVariableSources(userId),
});

const readBody = async (req: Request) =>
  ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;

export const handleVariablesRoutes = async (req: Request, server: Publisher, path: string) => {
  const isApiKeys = path === "/api/api-keys" || path.startsWith("/api/api-keys/");
  const isVariables = path === "/api/variables" || path.startsWith("/api/variables/");
  const overlayMatch = path.match(
    /^\/api\/overlays\/([a-zA-Z0-9_-]+)\/(variables|variable-sources)(?:\/([a-zA-Z0-9_-]+))?$/
  );
  if (!isApiKeys && !isVariables && !overlayMatch) return null;

  const session = await authenticate(req);
  if (!session) return json({ error: "Unauthorized" }, 401);
  const userId = session.user.id;

  try {
    if (path === "/api/api-keys" && req.method === "GET") {
      return json({ apiKeys: await listApiKeys(userId) });
    }

    if (path === "/api/api-keys" && req.method === "POST") {
      const body = await readBody(req);
      const name = typeof body.name === "string" ? body.name.trim().slice(0, 50) : "";
      if (!name) return json({ error: "Give the key a name" }, 400);
      if ((await prisma.apiKey.count({ where: { userId } })) >= MAX_API_KEYS_PER_USER) {
        return json({ error: `You can have at most ${MAX_API_KEYS_PER_USER} API keys` }, 409);
      }
      const { key, prefix, hash } = generateApiKey();
      await prisma.apiKey.create({ data: { userId, name, prefix, hash } });
      // The only time the key itself is sent; it can't be looked up again.
      return json({ key, apiKeys: await listApiKeys(userId) }, 201);
    }

    const apiKeyMatch = path.match(/^\/api\/api-keys\/([a-zA-Z0-9_-]+)$/);
    if (apiKeyMatch && req.method === "DELETE") {
      await prisma.apiKey.deleteMany({ where: { id: apiKeyMatch[1], userId } });
      return json({ apiKeys: await listApiKeys(userId) });
    }

    if (path === "/api/variables" && req.method === "GET") {
      return json(await listAll(userId));
    }

    const variableMatch = path.match(/^\/api\/variables\/([a-zA-Z0-9_-]+)$/);
    if (variableMatch && req.method === "DELETE") {
      const variable = await prisma.variable.findFirst({
        where: { id: variableMatch[1], userId },
        select: { source: true, key: true },
      });
      if (variable) await deleteVariables(server, userId, variable.source, [variable.key]);
      return json(await listAll(userId));
    }

    if (!overlayMatch) return json({ error: "Method not allowed" }, 405);
    const [, overlayId, collection, itemId] = overlayMatch;
    const method = req.method;
    const required = method === "GET" || (method === "PATCH" && collection === "variables")
      ? "CONTROLLER"
      : "EDITOR";
    const check = await requireOverlayRole(session.user, overlayId, required);
    if (check.error) return check.error;
    const ownerId = check.access.overlay.userId;

    if (collection === "variables") {
      if (!itemId && method === "GET") return json(await listAll(ownerId));

      // A new variable, created in the editor.
      if (!itemId && method === "POST") {
        const body = await readBody(req);
        const type = parseVariableType(body.type);
        if (!isVariableName(body.source) || !isVariableName(body.key)) {
          return json(
            { error: 'Names are 1-64 letters, digits, ".", "_" and "-", starting with a letter or digit' },
            400
          );
        }
        if (!type) return json({ error: "Pick a type" }, 400);
        const value = parseVariableValue(type, body.value);
        if (!value.ok) return json({ error: value.error }, 400);
        const [variable] = await setVariables(
          server,
          ownerId,
          body.source,
          [{ key: body.key, type, value: value.value }],
          { onlyNew: true }
        );
        return json({ variable, ...(await listAll(ownerId)) }, 201);
      }

      if (itemId && method === "PATCH") {
        const body = await readBody(req);
        return json({ variable: await setVariableValue(server, ownerId, itemId, body.value) });
      }

      if (itemId && method === "DELETE") {
        const variable = await prisma.variable.findFirst({
          where: { id: itemId, userId: ownerId },
          select: { source: true, key: true },
        });
        if (variable) await deleteVariables(server, ownerId, variable.source, [variable.key]);
        return json(await listAll(ownerId));
      }
    }

    if (collection === "variable-sources") {
      // A provider that is added by name. Spotify is added by connecting it (routes/spotify.ts).
      if (!itemId && method === "POST") {
        const body = await readBody(req);
        if (body.provider !== "twitch" || typeof body.channel !== "string") {
          return json({ error: 'Send { "provider": "twitch", "channel": "<name>" }' }, 400);
        }
        const source = await addTwitchSource(ownerId, body.channel);
        return json({ source, ...(await listAll(ownerId)) }, 201);
      }

      if (itemId && method === "DELETE") {
        // Spotify is removed by disconnecting it, which only its owner can do; a source whose
        // access was revoked is just left over and can go.
        const source = await prisma.variableSource.findFirst({
          where: { id: itemId, userId: ownerId },
          select: { provider: true },
        });
        if (
          source?.provider === "SPOTIFY" &&
          (await prisma.spotifyConnection.count({ where: { userId: ownerId } })) > 0
        ) {
          return json({ error: "Disconnect Spotify under Settings → Spotify to remove it" }, 409);
        }
        await deleteVariableSource(server, ownerId, itemId);
        return json(await listAll(ownerId));
      }
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (error) {
    if (error instanceof VariableError) return json({ error: error.message }, error.status);
    throw error;
  }
};
