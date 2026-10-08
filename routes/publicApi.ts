import { authenticateApiKey, takeRateLimit, type ApiKeyOwner } from "../services/api-keys";
import {
  deleteVariables,
  incrementVariable,
  listVariables,
  setVariables,
  VariableError,
  type VariableWrite,
} from "../services/variables";
import {
  isProviderSource,
  isSourceName,
  isVariableName,
  MAX_VARIABLES_PER_REQUEST,
  parseVariableType,
  parseVariableValue,
} from "../lib/variables";

// The public API: what other applications (game servers, Stream Deck plugins, bots) call with
// an API key to keep variables of an account up to date. Documented in docs/public-api.md;
// keep both in sync.
//
// It is called with a key rather than a session cookie, so any origin may call it.

type Publisher = { publish: (channel: string, message: string) => unknown | Promise<unknown> };

const PREFIX = "/api/v1";

const publicCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

const send = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: {
      ...publicCorsHeaders,
      ...(body === null ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
  });

const fail = (status: number, code: string, message: string, headers?: Record<string, string>) =>
  send({ error: { code, message } }, status, headers);

type StoredVariable = Awaited<ReturnType<typeof listVariables>>[number];

// Types go out in lowercase, the way they are documented.
const present = ({ source, key, type, value, updatedAt }: StoredVariable) => ({
  source,
  key,
  type: type.toLowerCase(),
  value,
  updatedAt,
});

const readJson = async (req: Request): Promise<unknown> => {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
};

type Parsed<T> = { ok: true; value: T } | { ok: false; response: Response };

const parseWrite = (key: string, body: unknown): Parsed<VariableWrite> => {
  const input = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const type = parseVariableType(input.type);
  if (!type) {
    return {
      ok: false,
      response: fail(
        400,
        "invalid_type",
        `“${key}”: type must be string, integer, double, boolean, color or image`
      ),
    };
  }
  const value = parseVariableValue(type, input.value);
  if (!value.ok) {
    return { ok: false, response: fail(400, "invalid_value", `“${key}”: ${value.error}`) };
  }
  return { ok: true, value: { key, type, value: value.value } };
};

const invalidName = (what: string) =>
  fail(
    400,
    "invalid_name",
    `The ${what} must be 1-64 characters: letters, digits, ".", "_" and "-", starting with a letter or digit`
  );

const handle = async (
  req: Request,
  server: Publisher,
  path: string,
  owner: ApiKeyOwner
): Promise<Response> => {
  const userId = owner.user.id;
  const method = req.method;

  if (path === "/me" && method === "GET") {
    return send({ user: { name: owner.user.name }, key: { name: owner.keyName } });
  }

  if (path === "/variables" && method === "GET") {
    const source = new URL(req.url).searchParams.get("source") ?? undefined;
    if (source !== undefined && !isSourceName(source)) return invalidName("source");
    const variables = await listVariables(userId, { source });
    return send({ variables: variables.map(present) });
  }

  const sourceMatch = path.match(/^\/sources\/([^/]+)(\/variables(?:\/([^/]+)(\/increment)?)?)?$/);
  if (!sourceMatch) return fail(404, "not_found", "No such endpoint");
  const [, rawSource, variablesPath, key, increment] = sourceMatch;
  // Provider sources contain a ":", which clients may send encoded.
  const source = rawSource.replace(/%3a/gi, ":");
  if (!isSourceName(source)) return invalidName("source");
  if (key !== undefined && !isVariableName(key)) return invalidName("key");
  // Providers (Twitch) keep their variables up to date themselves: they can be read, not written.
  if (method !== "GET" && isProviderSource(source)) {
    return fail(409, "read_only", `The variables of ${source} are kept up to date by ovrly and can't be changed`);
  }

  // /sources/:source
  if (!variablesPath) {
    if (method === "DELETE") {
      const deleted = await deleteVariables(server, userId, source);
      return send({ deleted });
    }
    return fail(405, "method_not_allowed", "Use DELETE");
  }

  // /sources/:source/variables
  if (key === undefined) {
    if (method === "GET") {
      const variables = await listVariables(userId, { source });
      return send({ variables: variables.map(present) });
    }
    if (method === "PUT") {
      const body = await readJson(req);
      const map = (body as { variables?: unknown } | undefined)?.variables;
      if (!map || typeof map !== "object" || Array.isArray(map)) {
        return fail(400, "invalid_body", 'Send { "variables": { "<key>": { "type": ..., "value": ... } } }');
      }
      const entries = Object.entries(map);
      if (entries.length === 0 || entries.length > MAX_VARIABLES_PER_REQUEST) {
        return fail(400, "invalid_body", `Send 1-${MAX_VARIABLES_PER_REQUEST} variables at a time`);
      }
      const writes: VariableWrite[] = [];
      for (const [entryKey, entry] of entries) {
        if (!isVariableName(entryKey)) return invalidName(`key “${entryKey}”`);
        const parsed = parseWrite(entryKey, entry);
        if (!parsed.ok) return parsed.response;
        writes.push(parsed.value);
      }
      const variables = await setVariables(server, userId, source, writes);
      return send({ variables: variables.map(present) });
    }
    return fail(405, "method_not_allowed", "Use GET or PUT");
  }

  // /sources/:source/variables/:key/increment
  if (increment) {
    if (method !== "POST") return fail(405, "method_not_allowed", "Use POST");
    const body = await readJson(req);
    const by = body === undefined ? 1 : (body as { by?: unknown } | null)?.by ?? 1;
    if (typeof by !== "number" || !Number.isFinite(by)) {
      return fail(400, "invalid_body", 'Send { "by": <number> }, or nothing to add 1');
    }
    const variable = await incrementVariable(server, userId, source, key, by);
    return send({ variable: variable ? present(variable) : null });
  }

  // /sources/:source/variables/:key
  if (method === "GET") {
    const [variable] = await listVariables(userId, { source, keys: [key] });
    return variable ? send({ variable: present(variable) }) : fail(404, "not_found", "Variable not found");
  }
  if (method === "PUT") {
    const parsed = parseWrite(key, await readJson(req));
    if (!parsed.ok) return parsed.response;
    const [variable] = await setVariables(server, userId, source, [parsed.value]);
    return send({ variable: present(variable) });
  }
  if (method === "DELETE") {
    const deleted = await deleteVariables(server, userId, source, [key]);
    return deleted ? send(null, 204) : fail(404, "not_found", "Variable not found");
  }
  return fail(405, "method_not_allowed", "Use GET, PUT or DELETE");
};

export const handlePublicApiRoutes = async (req: Request, server: Publisher, path: string) => {
  if (path !== PREFIX && !path.startsWith(`${PREFIX}/`)) return null;
  if (req.method === "OPTIONS") return send(null, 204);

  const owner = await authenticateApiKey(req);
  if (!owner) {
    return fail(401, "unauthorized", "Send a valid API key as “Authorization: Bearer <key>”", {
      "WWW-Authenticate": "Bearer",
    });
  }
  const retryAfter = takeRateLimit(owner.keyId);
  if (retryAfter !== null) {
    return fail(429, "rate_limited", "Too many requests, slow down", {
      "Retry-After": String(retryAfter),
    });
  }

  try {
    return await handle(req, server, path.slice(PREFIX.length), owner);
  } catch (error) {
    if (error instanceof VariableError) {
      const code = error.status === 404 ? "not_found" : error.status === 409 ? "conflict" : "invalid_request";
      return fail(error.status, code, error.message);
    }
    console.error("[API] Request failed:", error);
    return fail(500, "internal_error", "Something went wrong");
  }
};
