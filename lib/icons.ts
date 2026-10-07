// What an icon element shows: one icon of one icon library. The libraries and their icons are
// bundled with the editor (src/lib/icons.ts); the server only keeps the two names, so it checks
// that they are well formed rather than that the icon exists.

export const ICON_LIBRARIES = ["lucide", "phosphor", "pixelarticons", "tabler"] as const;
export type IconLibrary = (typeof ICON_LIBRARIES)[number];

export const DEFAULT_ICON = { library: "lucide", name: "star" } as const;

export const isIconLibrary = (value: unknown): value is IconLibrary =>
  typeof value === "string" && (ICON_LIBRARIES as readonly string[]).includes(value);

// Every library spells its icons in lowercase words joined by hyphens ("arrow-up-right").
export const isIconName = (value: unknown): value is string =>
  typeof value === "string" && value.length <= 64 && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value);

// The icon of an element copied from presets, imports and duplicates, which may be user
// supplied: a valid icon is taken over, anything else becomes the default one.
export const iconSeed = (value: unknown) => {
  const seed = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return isIconLibrary(seed.library) && isIconName(seed.name)
    ? { library: seed.library, name: seed.name }
    : { ...DEFAULT_ICON };
};
