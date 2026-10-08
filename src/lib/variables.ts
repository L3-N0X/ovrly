import type { VariableType, VariableValue } from "./types";
import { request } from "./sharing";

// Mirrors lib/variables.ts on the server. Variables are named values of an account that element
// properties can be bound to (src/lib/bindings.ts): created in the editor's variables tab, sent by
// other applications through the public API (docs/public-api.md), or kept up to date by a
// provider like Twitch. The design is in docs/variables.md.

export const VARIABLE_TYPES: VariableType[] = ["STRING", "INTEGER", "DOUBLE", "BOOLEAN", "COLOR", "IMAGE"];

export const VARIABLE_TYPE_LABELS: Record<VariableType, string> = {
  STRING: "Text",
  INTEGER: "Integer",
  DOUBLE: "Decimal",
  BOOLEAN: "Yes/No",
  COLOR: "Color",
  IMAGE: "Image",
};

// What a new variable of each type starts out as.
export const DEFAULT_VARIABLE_VALUES: Record<VariableType, VariableValue> = {
  STRING: "",
  INTEGER: 0,
  DOUBLE: 0,
  BOOLEAN: false,
  COLOR: "#ffffff",
  IMAGE: "",
};

const integerFormat = new Intl.NumberFormat(undefined);
const doubleFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 });

// A value as text: how text properties show it, and how lists preview it.
export const formatVariableValue = (type: VariableType, value: VariableValue) => {
  switch (type) {
    case "INTEGER":
      return typeof value === "number" ? integerFormat.format(value) : String(value);
    case "DOUBLE":
      return typeof value === "number" ? doubleFormat.format(value) : String(value);
    case "BOOLEAN":
      return value ? "Yes" : "No";
    default:
      return String(value);
  }
};

// Names of sources and keys, as on the server.
const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
export const isVariableName = (value: string) => NAME_PATTERN.test(value);
export const NAME_RULES = 'Letters, digits, ".", "_" and "-", starting with a letter or digit.';

// Providers' sources are "<provider>:<name>"; their variables can't be changed by hand.
export const isProviderSource = (source: string) => source.includes(":");

// Identifies a variable within an account. Sources and keys never contain "/".
export const variableRef = (variable: { source: string; key: string }) =>
  `${variable.source}/${variable.key}`;

export interface Variable {
  id: string;
  source: string;
  key: string;
  type: VariableType;
  value: VariableValue;
  updatedAt: string;
}

export type VariableProvider = "TWITCH";

// A provider keeping variables of the account up to date.
export interface VariableSource {
  id: string;
  provider: VariableProvider;
  // The source its variables carry ("twitch:shroud").
  name: string;
  config: { displayName?: string } | null;
  // Why some of its variables are missing (see TWITCH_PROBLEMS).
  problem: string | null;
  createdAt: string;
}

export interface VariablesResponse {
  variables: Variable[];
  sources: VariableSource[];
}

// How a source is called in the editor: "Twitch · Shroud" for a provider, the name otherwise.
export const sourceLabel = (source: string, sources: VariableSource[] = []) => {
  const provider = sources.find((s) => s.name === source);
  if (provider?.provider === "TWITCH" || source.startsWith("twitch:")) {
    return `Twitch · ${provider?.config?.displayName ?? source.slice("twitch:".length)}`;
  }
  return source;
};

// What each variable of a Twitch channel holds (services/twitch-variables.ts).
export const TWITCH_VARIABLE_DESCRIPTIONS: Record<string, string> = {
  name: "The channel's display name.",
  avatar: "The channel's profile picture.",
  followers: "How many people follow the channel.",
  live: "Whether the channel is live right now.",
  viewers: "Viewers of the current stream, 0 while offline.",
  title: "The stream title.",
  category: "The game or category streamed.",
  subscribers: "Active subscriptions, the broadcaster's own included.",
  "sub-points": "Tier 1 counts 1, tier 2 counts 2, tier 3 counts 6.",
};

// Why a Twitch source has no subscriber variables.
export const twitchProblem = (source: VariableSource) => {
  const channel = source.config?.displayName ?? source.name.slice("twitch:".length);
  switch (source.problem) {
    case "NOT_CONNECTED":
      return `Subscriber stats are private. Someone who can sign in to Twitch as ${channel} has to connect it under Settings → Twitch.`;
    case "NOT_ALLOWED":
      return `${channel} is connected, but its subscriber stats are only shared with whoever connected it and their team.`;
    default:
      return null;
  }
};

export interface ApiKey {
  id: string;
  name: string;
  // The start of the key; the key itself is only shown once, when it is created.
  prefix: string;
  lastUsedAt: string | null;
  createdAt: string;
}

export const variablesApi = {
  apiKeys: () => request<{ apiKeys: ApiKey[] }>("/api/api-keys"),
  createApiKey: (name: string) =>
    request<{ key: string; apiKeys: ApiKey[] }>("/api/api-keys", { method: "POST", body: { name } }),
  deleteApiKey: (id: string) =>
    request<{ apiKeys: ApiKey[] }>(`/api/api-keys/${id}`, { method: "DELETE" }),
  // The signed in user's own variables, for the settings.
  variables: () => request<VariablesResponse>("/api/variables"),
  deleteVariable: (id: string) =>
    request<VariablesResponse>(`/api/variables/${id}`, { method: "DELETE" }),
};

// The variables of an overlay's owner, which its elements can be bound to.
export const overlayVariablesApi = (overlayId: string) => {
  const base = `/api/overlays/${overlayId}`;
  return {
    list: () => request<VariablesResponse>(`${base}/variables`),
    create: (variable: { source: string; key: string; type: VariableType; value: VariableValue }) =>
      request<VariablesResponse & { variable: Variable }>(`${base}/variables`, {
        method: "POST",
        body: variable,
      }),
    setValue: (id: string, value: VariableValue) =>
      request<{ variable: Variable }>(`${base}/variables/${id}`, { method: "PATCH", body: { value } }),
    remove: (id: string) => request<VariablesResponse>(`${base}/variables/${id}`, { method: "DELETE" }),
    addTwitchChannel: (channel: string) =>
      request<VariablesResponse & { source: VariableSource }>(`${base}/variable-sources`, {
        method: "POST",
        body: { provider: "twitch", channel },
      }),
    removeSource: (id: string) =>
      request<VariablesResponse>(`${base}/variable-sources/${id}`, { method: "DELETE" }),
  };
};
