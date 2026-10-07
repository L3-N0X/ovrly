import { useEffect, useSyncExternalStore } from "react";
import type { IconLibrary } from "./types";

// The icon libraries an icon element can use, mirrored by lib/icons.ts. Their icons come from
// the Iconify JSON packages: every set is one file of SVG bodies, so all libraries are drawn
// the same way, and each one is only downloaded (as its own chunk) once an icon of it is shown
// or the picker opens it.

// One icon in a set: the inside of an <svg>, drawn with `currentColor`.
interface IconifyIcon {
  body: string;
  width?: number;
  height?: number;
  left?: number;
  top?: number;
}

export interface IconSet {
  icons: Record<string, IconifyIcon>;
  // Older names of icons that were renamed, pointing at the current ones.
  aliases?: Record<string, { parent: string }>;
  width?: number;
  height?: number;
}

// Some libraries draw one icon in several styles, each a separate icon whose name ends in the
// style ("heart-bold"). The picker lets the user pick the style first, so the list isn't full
// of near duplicates.
export interface IconVariant {
  id: string;
  label: string;
  // Appended to the icon's name, with a hyphen; the plain style has none.
  suffix: string;
}

export interface IconLibraryInfo {
  id: IconLibrary;
  label: string;
  description: string;
  variants?: IconVariant[];
  load: () => Promise<IconSet>;
}

// The JSON of a set is about as large as the icons are many (Phosphor and Tabler are several
// megabytes), so the types of the imports are not inferred from it.
const loadSet = (set: Promise<{ default: unknown }>) => set.then((m) => m.default as IconSet);

export const ICON_LIBRARIES: IconLibraryInfo[] = [
  {
    id: "lucide",
    label: "Lucide",
    description: "Clean, consistent line icons.",
    load: () => loadSet(import("@iconify-json/lucide/icons.json")),
  },
  {
    id: "phosphor",
    label: "Phosphor",
    description: "A flexible family with six weights, from thin to filled.",
    variants: [
      { id: "regular", label: "Regular", suffix: "" },
      { id: "thin", label: "Thin", suffix: "thin" },
      { id: "light", label: "Light", suffix: "light" },
      { id: "bold", label: "Bold", suffix: "bold" },
      { id: "fill", label: "Fill", suffix: "fill" },
      { id: "duotone", label: "Duotone", suffix: "duotone" },
    ],
    load: () => loadSet(import("@iconify-json/ph/icons.json")),
  },
  {
    id: "tabler",
    label: "Tabler",
    description: "Over 6,000 line icons, many also filled.",
    variants: [
      { id: "outline", label: "Outline", suffix: "" },
      { id: "filled", label: "Filled", suffix: "filled" },
    ],
    load: () => loadSet(import("@iconify-json/tabler/icons.json")),
  },
  {
    id: "pixelarticons",
    label: "Pixelarticons",
    description: "Pixel art icons for retro and game overlays.",
    load: () => loadSet(import("@iconify-json/pixelarticons/icons.json")),
  },
];

export const iconLibraryInfo = (id: IconLibrary) =>
  ICON_LIBRARIES.find((library) => library.id === id) ?? ICON_LIBRARIES[0];

// The style of an icon: the variant whose suffix its name ends with, else the plain one.
export const iconVariant = (library: IconLibraryInfo, name: string) => {
  const variants = library.variants;
  if (!variants) return undefined;
  return (
    variants.find((variant) => variant.suffix && name.endsWith(`-${variant.suffix}`)) ??
    variants[0]
  );
};

// What the picker and the element show for an icon nobody picked.
export const DEFAULT_ICON = { library: "lucide", name: "star" } as const satisfies {
  library: IconLibrary;
  name: string;
};

// "arrow-up-right" -> "arrow up right", for showing and searching names.
export const readableIconName = (name: string) => name.replace(/-/g, " ");

// --- Loading ---

const sets = new Map<IconLibrary, IconSet>();
const loading = new Map<IconLibrary, Promise<void>>();
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

// Starts downloading a library, once. Components waiting for it update when it is there.
export const loadIconSet = (id: IconLibrary) => {
  let pending = loading.get(id);
  if (!pending) {
    pending = iconLibraryInfo(id)
      .load()
      .then((set) => {
        sets.set(id, set);
        listeners.forEach((listener) => listener());
      })
      .catch((error) => {
        // Forgotten, so the next component that needs it tries again.
        loading.delete(id);
        console.error(`Failed to load the ${id} icons`, error);
      });
    loading.set(id, pending);
  }
  return pending;
};

// The icons of a library: undefined until it has loaded (which this starts).
export const useIconSet = (id: IconLibrary) => {
  useEffect(() => {
    void loadIconSet(id);
  }, [id]);
  return useSyncExternalStore(subscribe, () => sets.get(id));
};

// The names of a library's icons, in the order the library lists them.
const namesCache = new WeakMap<IconSet, string[]>();
export const iconNames = (set: IconSet) => {
  let names = namesCache.get(set);
  if (!names) {
    names = Object.keys(set.icons);
    namesCache.set(set, names);
  }
  return names;
};

// An icon with what an <svg> needs to draw it, or null when the library has no such icon (any
// more): an older name is followed to the icon that replaced it.
export const resolveIcon = (set: IconSet, name: string) => {
  const icon = set.icons[name] ?? set.icons[set.aliases?.[name]?.parent ?? ""];
  if (!icon) return null;
  const width = icon.width ?? set.width ?? 16;
  const height = icon.height ?? set.height ?? 16;
  return {
    body: icon.body,
    viewBox: `${icon.left ?? 0} ${icon.top ?? 0} ${width} ${height}`,
  };
};
