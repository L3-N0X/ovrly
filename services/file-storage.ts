import { S3Client, type S3File } from "bun";
import { randomUUID } from "crypto";

export const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES) || 10 * 1024 * 1024;

export class UnsupportedFileError extends Error {}
export class StorageNotConfiguredError extends Error {}

// Content type -> extension. The extension (and therefore the content type we serve
// the object with) is derived from this table, never from the client-supplied name.
const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

const EXTENSION_TYPES: Record<string, string> = Object.fromEntries(
  Object.entries(ALLOWED_TYPES).map(([type, ext]) => [ext, type])
);

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((byte, i) => bytes[offset + i] === byte);

const matchesContent = (type: string, bytes: Uint8Array) => {
  switch (type) {
    case "image/png":
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/jpeg":
      return startsWith(bytes, [0xff, 0xd8, 0xff]);
    case "image/gif":
      return startsWith(bytes, [0x47, 0x49, 0x46, 0x38]);
    case "image/webp":
      return startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8);
    case "image/svg+xml": {
      const head = new TextDecoder().decode(bytes.slice(0, 1024));
      return /<svg[\s>]/i.test(head);
    }
    default:
      return false;
  }
};

const sanitizeBaseName = (name: string) => {
  const base = name.replace(/\.[^.]*$/, "").replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 80);
  return base.replace(/^_+|_+$/g, "") || "image";
};

export const contentTypeForKey = (key: string) =>
  EXTENSION_TYPES[key.slice(key.lastIndexOf(".") + 1).toLowerCase()] ?? "application/octet-stream";

export const isValidStorageKey = (key: string) =>
  /^[0-9a-f-]{36}\/[a-zA-Z0-9_-]+\.[a-z]+$/.test(key) && key.slice(key.lastIndexOf(".") + 1) in EXTENSION_TYPES;

const REQUIRED_ENV = ["S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const;

export const missingStorageConfig = () => REQUIRED_ENV.filter((name) => !process.env[name]);

let client: S3Client | null = null;

// Works with any S3-compatible service (RustFS, MinIO, Garage, SeaweedFS, AWS, R2, ...).
// Requests use path-style addressing against S3_ENDPOINT, which is what self-hosted
// services expect.
const getClient = () => {
  if (client) return client;
  const missing = missingStorageConfig();
  if (missing.length > 0) {
    throw new StorageNotConfiguredError(`Missing S3 configuration: ${missing.join(", ")}`);
  }
  client = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    bucket: process.env.S3_BUCKET,
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    region: process.env.S3_REGION || "us-east-1",
  });
  return client;
};

export interface FileStorage {
  save(file: File): Promise<{ url: string; filename: string }>;
  delete(filename: string): Promise<void>;
  get(filename: string): S3File;
}

export const fileStorage: FileStorage = {
  async save(file) {
    const type = file.type.split(";")[0].trim().toLowerCase();
    if (!(type in ALLOWED_TYPES)) {
      throw new UnsupportedFileError("Only PNG, JPEG, GIF, WebP and SVG images are allowed");
    }
    if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) {
      throw new UnsupportedFileError(
        `File must be between 1 byte and ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)} MB`
      );
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!matchesContent(type, bytes)) {
      throw new UnsupportedFileError("File content does not match its type");
    }

    const filename = `${randomUUID()}/${sanitizeBaseName(file.name)}.${ALLOWED_TYPES[type]}`;
    await getClient().write(filename, bytes, { type });
    return { url: `/uploads/${filename}`, filename };
  },

  async delete(filename) {
    // Deleting a missing key is a no-op on S3, so this is safe to retry.
    await getClient().delete(filename);
  },

  get(filename) {
    return getClient().file(filename);
  },
};
