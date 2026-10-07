import type { PrismaElement, VariableType } from "./types";
import { request } from "./sharing";

// Mirrors lib/variables.ts on the server. Variables are values other applications send to an
// account through the public API (docs/public-api.md); variable elements show them.

export const VARIABLE_TYPE_LABELS: Record<VariableType, string> = {
  STRING: "Text",
  INTEGER: "Integer",
  DOUBLE: "Decimal",
  BOOLEAN: "Yes/No",
  COLOR: "Color",
};

const integerFormat = new Intl.NumberFormat(undefined);
const doubleFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 });

// What the overlay shows for a value as text; a dash while there is none. Colors are drawn
// as a swatch instead (see components/overlay/Variable.tsx).
export const formatVariableValue = (
  type: VariableType | null,
  value: string | number | boolean | null | undefined
) => {
  if (type === null || value === null || value === undefined) return "–";
  switch (type) {
    case "INTEGER":
      return typeof value === "number" ? integerFormat.format(value) : String(value);
    case "DOUBLE":
      return typeof value === "number" ? doubleFormat.format(value) : String(value);
    case "BOOLEAN":
      return value ? "true" : "false";
    default:
      return String(value);
  }
};

// The name a variable is picked by: "minecraft-tournament / red.points".
export const variableLabel = (variable: { source: string; key: string }) =>
  `${variable.source} / ${variable.key}`;

export interface Variable {
  id: string;
  source: string;
  key: string;
  type: VariableType;
  value: string | number | boolean;
  updatedAt: string;
}

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
  variables: () => request<{ variables: Variable[] }>("/api/variables"),
  deleteVariable: (id: string) =>
    request<{ variables: Variable[] }>(`/api/variables/${id}`, { method: "DELETE" }),
  // The variables of the overlay's owner, which its variable elements can show.
  overlayVariables: (overlayId: string) =>
    request<{ variables: Variable[] }>(`/api/overlays/${overlayId}/variables`),
  // Empty strings clear it.
  bind: (elementId: string, data: { source: string; key: string }) =>
    request<PrismaElement>(`/api/elements/${elementId}`, { method: "PATCH", body: { data } }),
};
