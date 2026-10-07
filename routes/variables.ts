import { prisma } from "../auth";
import { authenticate, requireOverlayRole } from "../middleware/authMiddleware";
import { json } from "../middleware/cors";
import { generateApiKey, MAX_API_KEYS_PER_USER } from "../services/api-keys";
import { deleteVariables, listVariables } from "../services/variables";

// What the app itself calls about the public API: managing API keys, and the variables they
// sent. The public API is routes/publicApi.ts.

type Publisher = { publish: (channel: string, message: string) => unknown | Promise<unknown> };

const listApiKeys = (userId: string) =>
  prisma.apiKey.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, prefix: true, lastUsedAt: true, createdAt: true },
  });

export const handleVariablesRoutes = async (req: Request, server: Publisher, path: string) => {
  const isApiKeys = path === "/api/api-keys" || path.startsWith("/api/api-keys/");
  const isVariables = path === "/api/variables" || path.startsWith("/api/variables/");
  const overlayVariablesMatch = path.match(/^\/api\/overlays\/([a-zA-Z0-9_-]+)\/variables$/);
  if (!isApiKeys && !isVariables && !overlayVariablesMatch) return null;

  const session = await authenticate(req);
  if (!session) return json({ error: "Unauthorized" }, 401);
  const userId = session.user.id;

  if (path === "/api/api-keys" && req.method === "GET") {
    return json({ apiKeys: await listApiKeys(userId) });
  }

  if (path === "/api/api-keys" && req.method === "POST") {
    const body = (await req.json().catch(() => null)) as { name?: unknown } | null;
    const name = typeof body?.name === "string" ? body.name.trim().slice(0, 50) : "";
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
    return json({ variables: await listVariables(userId) });
  }

  const variableMatch = path.match(/^\/api\/variables\/([a-zA-Z0-9_-]+)$/);
  if (variableMatch && req.method === "DELETE") {
    const variable = await prisma.variable.findFirst({
      where: { id: variableMatch[1], userId },
      select: { source: true, key: true },
    });
    if (variable) await deleteVariables(server, userId, variable.source, [variable.key]);
    return json({ variables: await listVariables(userId) });
  }

  // The variables an overlay's elements can show: those of its owner, whoever is asking.
  if (overlayVariablesMatch && req.method === "GET") {
    const check = await requireOverlayRole(session.user, overlayVariablesMatch[1], "CONTROLLER");
    if (check.error) return check.error;
    return json({ variables: await listVariables(check.access.overlay.userId) });
  }

  return json({ error: "Method not allowed" }, 405);
};
