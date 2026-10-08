import { prisma } from "../auth";

// Keys for the public API. A key is "ovrly_" followed by 32 random bytes; only its SHA-256 is
// stored, which is enough because the keys are random (no salt or slow hash needed), and lets
// a key be looked up by its hash.

const KEY_PREFIX = "ovrly_";
// How much of the key the settings show, so people can tell their keys apart.
const VISIBLE_LENGTH = KEY_PREFIX.length + 6;
// lastUsedAt is only written this often, not on every request.
const LAST_USED_RESOLUTION_MS = 60_000;

export const MAX_API_KEYS_PER_USER = 20;

export const hashApiKey = (key: string) => new Bun.CryptoHasher("sha256").update(key).digest("hex");

export const generateApiKey = () => {
  const key = KEY_PREFIX + Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
  return { key, prefix: key.slice(0, VISIBLE_LENGTH), hash: hashApiKey(key) };
};

export interface ApiKeyOwner {
  keyId: string;
  keyName: string;
  user: { id: string; name: string };
}

// The key a request was sent with ("Authorization: Bearer ovrly_..."), and whose it is. Null
// when there is none or it isn't valid (anymore).
export const authenticateApiKey = async (req: Request): Promise<ApiKeyOwner | null> => {
  const header = req.headers.get("Authorization");
  const key = header?.match(/^Bearer\s+(ovrly_[A-Za-z0-9_-]{20,100})\s*$/)?.[1];
  if (!key) return null;

  const apiKey = await prisma.apiKey.findUnique({
    where: { hash: hashApiKey(key) },
    select: { id: true, name: true, lastUsedAt: true, user: { select: { id: true, name: true } } },
  });
  if (!apiKey) return null;

  if (!apiKey.lastUsedAt || Date.now() - apiKey.lastUsedAt.getTime() > LAST_USED_RESOLUTION_MS) {
    prisma.apiKey
      .updateMany({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
      .catch((error) => console.error("[API] Updating lastUsedAt failed:", error));
  }
  return { keyId: apiKey.id, keyName: apiKey.name, user: apiKey.user };
};

// A token bucket per key: bursts of BURST requests, then RATE per second. Kept in memory, so it
// is per server process, which is all ovrly runs as.
const RATE_PER_SECOND = 10;
const BURST = 30;
const buckets = new Map<string, { tokens: number; at: number }>();

// Null when the request may go ahead, otherwise how many seconds to wait.
export const takeRateLimit = (keyId: string): number | null => {
  const now = Date.now();
  const bucket = buckets.get(keyId) ?? { tokens: BURST, at: now };
  bucket.tokens = Math.min(BURST, bucket.tokens + ((now - bucket.at) / 1000) * RATE_PER_SECOND);
  bucket.at = now;
  buckets.set(keyId, bucket);
  if (bucket.tokens < 1) return Math.ceil((1 - bucket.tokens) / RATE_PER_SECOND);
  bucket.tokens -= 1;
  return null;
};

// Full buckets are the same as no bucket, so they are dropped now and then.
setInterval(() => {
  const now = Date.now();
  for (const [keyId, bucket] of buckets) {
    if (bucket.tokens + ((now - bucket.at) / 1000) * RATE_PER_SECOND >= BURST) buckets.delete(keyId);
  }
}, 60_000).unref();
