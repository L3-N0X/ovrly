// Variables are named values of an account that element properties can be bound to
// (lib/bindings.ts). They are created in the editor, sent by applications through the public API
// (docs/public-api.md), or kept up to date by a provider like Twitch. Mirrored by
// src/lib/variables.ts; the design is in docs/variables.md.

export const VARIABLE_TYPES = ["STRING", "INTEGER", "DOUBLE", "BOOLEAN", "COLOR", "IMAGE"] as const;
export type VariableType = (typeof VARIABLE_TYPES)[number];
export type VariableValue = string | number | boolean;

export const isVariableType = (value: unknown): value is VariableType =>
  typeof value === "string" && (VARIABLE_TYPES as readonly string[]).includes(value);

// The public API spells types in lowercase ("string"); the database in uppercase. Both are
// accepted wherever a type is sent.
export const parseVariableType = (value: unknown): VariableType | null => {
  const upper = typeof value === "string" ? value.toUpperCase() : null;
  return isVariableType(upper) ? upper : null;
};

export const MAX_STRING_LENGTH = 1000;
export const MAX_IMAGE_URL_LENGTH = 2048;
// Per account, so a runaway integration can't fill the database.
export const MAX_VARIABLES_PER_USER = 1000;
// Per request of the batch endpoint.
export const MAX_VARIABLES_PER_REQUEST = 100;

// Sources and keys end up in URLs, so they are kept to characters that need no escaping.
// Keys may use dots to group values ("red.points").
const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
export const isVariableName = (value: unknown): value is string =>
  typeof value === "string" && NAME_PATTERN.test(value);

// Sources of providers are "<provider>:<name>" ("twitch:shroud"). A name the API accepts never
// contains a ":", so applications and users can read these variables but never write them.
const PROVIDER_SOURCE_PATTERN = /^[a-z]+:[A-Za-z0-9._@-]{1,64}$/;
export const isProviderSource = (value: unknown): value is string =>
  typeof value === "string" && PROVIDER_SOURCE_PATTERN.test(value);

// Any source a variable can have, written by anyone or by a provider.
export const isSourceName = (value: unknown): value is string =>
  isVariableName(value) || isProviderSource(value);

const COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

// Images are shown by URL: from anywhere on the web, or uploaded to this server. Empty for none
// (nothing playing, no avatar).
const isImageUrl = (value: string) => {
  if (value === "") return true;
  if (value.length > MAX_IMAGE_URL_LENGTH) return false;
  if (/^\/uploads\/[A-Za-z0-9._-]+$/.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};

export type ParsedValue = { ok: true; value: VariableValue } | { ok: false; error: string };

// Checks that `value` is a valid value of `type` and returns it in its stored form.
export const parseVariableValue = (type: VariableType, value: unknown): ParsedValue => {
  switch (type) {
    case "STRING":
      if (typeof value !== "string") return { ok: false, error: "A string variable needs a string value" };
      if (value.length > MAX_STRING_LENGTH) {
        return { ok: false, error: `Strings can be at most ${MAX_STRING_LENGTH} characters long` };
      }
      return { ok: true, value };
    case "INTEGER":
      if (typeof value !== "number" || !Number.isSafeInteger(value)) {
        return { ok: false, error: "An integer variable needs a whole number value" };
      }
      return { ok: true, value };
    case "DOUBLE":
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return { ok: false, error: "A double variable needs a number value" };
      }
      return { ok: true, value };
    case "BOOLEAN":
      if (typeof value !== "boolean") return { ok: false, error: "A boolean variable needs true or false" };
      return { ok: true, value };
    case "COLOR":
      if (typeof value !== "string" || !COLOR_PATTERN.test(value)) {
        return { ok: false, error: 'A color variable needs a hex color like "#ff8800"' };
      }
      return { ok: true, value: value.toLowerCase() };
    case "IMAGE":
      if (typeof value !== "string" || !isImageUrl(value)) {
        return { ok: false, error: "An image variable needs an http(s) URL of an image" };
      }
      return { ok: true, value };
  }
};

export const isNumericType = (type: VariableType) => type === "INTEGER" || type === "DOUBLE";
