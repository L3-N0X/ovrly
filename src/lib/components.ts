// Components: elements a user saved to add to any overlay, and the files they are shared with.
// The server side is lib/components.ts and routes/components.ts.

import type { PresetElement } from "./presets";
import type { PrismaOverlay } from "./types";

// What a component file says it is (COMPONENT_FORMAT in lib/components.ts).
const COMPONENT_FORMAT = "ovrly-component";
const COMPONENT_FORMAT_VERSION = 1;

export const MAX_COMPONENT_NAME_LENGTH = 100;
export const MAX_COMPONENT_DESCRIPTION_LENGTH = 500;

export interface OverlayComponent {
  id: string;
  name: string;
  description: string | null;
  // In the format templates use, with no ids, positions or running state.
  elements: PresetElement[];
  createdAt: string;
  updatedAt: string;
}

// What saving or importing answers with: the component, and how many of its images couldn't
// be copied and were left out.
export type SavedComponent = OverlayComponent & { droppedImages: number };

export const COMPONENTS_QUERY_KEY = ["components"] as const;

const request = async <T>(url: string, init: RequestInit = {}): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(url, {
      credentials: "include",
      ...init,
      headers: { "Content-Type": "application/json", ...init.headers },
    });
  } catch {
    throw new Error("Could not reach the server. Check your connection and try again.");
  }
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(typeof body?.error === "string" ? body.error : `Request failed (${response.status})`);
  }
  return body as T;
};

export const fetchComponents = () => request<OverlayComponent[]>("/api/components");

// Saves an element of an overlay, with everything nested in it, as a component.
export const saveComponent = (
  overlayId: string,
  elementId: string,
  details: { name: string; description: string | null }
) =>
  request<SavedComponent>("/api/components", {
    method: "POST",
    body: JSON.stringify({ overlayId, elementId, ...details }),
  });

export const updateComponent = (id: string, patch: { name?: string; description?: string | null }) =>
  request<OverlayComponent>(`/api/components/${id}`, { method: "PATCH", body: JSON.stringify(patch) });

export const deleteComponent = (id: string) =>
  request<void>(`/api/components/${id}`, { method: "DELETE" });

// Adds a component from a file someone exported.
export const importComponentFile = async (file: File) =>
  request<SavedComponent>("/api/components/import", { method: "POST", body: await file.text() });

// Adds a copy of a component's elements to the end of the overlay (or of `parentId`). Answers
// with the overlay and the ids of the new elements.
export const insertComponent = (overlayId: string, componentId: string, parentId: string | null = null) =>
  request<PrismaOverlay & { added: string[] }>(`/api/overlays/${overlayId}/elements/component`, {
    method: "POST",
    body: JSON.stringify({ componentId, parentId }),
  });

// Downloads a component as a file others can import. Uploaded images go along as links to this
// server; importing copies them into the importer's files.
export const exportComponent = (component: OverlayComponent) => {
  const file = {
    format: COMPONENT_FORMAT,
    version: COMPONENT_FORMAT_VERSION,
    name: component.name,
    description: component.description,
    elements: component.elements,
  };
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${component.name.replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "") || "component"}.ovrly-component.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// How many elements a component has, nested ones included.
export const countComponentElements = (elements: PresetElement[]): number =>
  elements.reduce((sum, element) => sum + 1 + countComponentElements(element.children ?? []), 0);

// Said after saving or importing, when some images had to be left out.
export const droppedImagesMessage = (count: number) =>
  count === 0
    ? null
    : `${count === 1 ? "One image" : `${count} images`} couldn't be copied and ${
        count === 1 ? "was" : "were"
      } left out. Pick ${count === 1 ? "it" : "them"} again once the component is in an overlay.`;
