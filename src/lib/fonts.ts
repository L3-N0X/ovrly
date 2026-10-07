export interface GoogleFont {
  family: string;
  variants: string[];
  subsets: string[];
  version: string;
  lastModified: string;
  files: Record<string, string>;
  category: string;
  kind: string;
}

export interface CustomFont {
  family: string;
  category: string;
  variants: string[];
  urls: Record<string, string>;
  subsets: string[];
  version: string;
  lastModified: string;
  files: Record<string, string>;
  kind: string;
}

export type Font = GoogleFont | CustomFont;

type CustomFontSource = Pick<CustomFont, "family" | "category" | "variants" | "urls">;

const API_KEY = import.meta.env.VITE_GOOGLE_FONTS_API_KEY;
const API_URL = "https://www.googleapis.com/webfonts/v1/webfonts";

// Fonts already asked for, by family and weight, so a family is only ever fetched once per
// weight. A rejected entry is dropped again, to leave a later retry possible.
const loadedFonts = new Map<string, Promise<void>>();

let fontsCache: GoogleFont[] | null = null;
let fontsCacheTimestamp: number | null = null;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export async function fetchGoogleFonts(): Promise<GoogleFont[]> {
  if (fontsCache && fontsCacheTimestamp && Date.now() - fontsCacheTimestamp < CACHE_DURATION) {
    return fontsCache;
  }

  if (!API_KEY) {
    throw new Error("Google Fonts API key is not configured");
  }

  try {
    const response = await fetch(`${API_URL}?key=${API_KEY}&sort=popularity`);
    if (!response.ok) {
      throw new Error("Failed to fetch Google Fonts");
    }
    const data = await response.json();
    fontsCache = data.items;
    fontsCacheTimestamp = Date.now();
    return data.items;
  } catch (error) {
    if (fontsCache) {
      return fontsCache;
    }
    console.error("Error fetching Google Fonts:", error);
    throw error;
  }
}

export async function fetchCustomFonts(): Promise<CustomFont[]> {
  try {
    const response = await fetch("/custom-fonts.json");
    if (!response.ok) {
      console.error("Failed to fetch custom fonts, status:", response.status);
      return [];
    }
    const customFontsData = (await response.json()) as CustomFontSource[];

    return customFontsData.map((font: Pick<CustomFont, "family" | "category" | "variants" | "urls">) => ({
      family: font.family,
      category: font.category,
      variants: font.variants,
      urls: font.urls,
      subsets: [],
      version: "custom",
      lastModified: new Date().toISOString().split("T")[0],
      files: {},
      kind: "webfont#custom",
    }));
  } catch (error) {
    console.error("Error fetching custom fonts:", error);
    return [];
  }
}

let allFontsCache: Font[] | null = null;
let allFontsCacheTimestamp: number | null = null;

export async function fetchAllFonts(): Promise<Font[]> {
  if (
    allFontsCache &&
    allFontsCacheTimestamp &&
    Date.now() - allFontsCacheTimestamp < CACHE_DURATION
  ) {
    return allFontsCache;
  }

  // Without a Google Fonts key (or when Google is unreachable) the custom fonts are still
  // worth having, so a failure there costs the Google half of the catalog and no more.
  const [googleFonts, customFonts] = await Promise.all([
    fetchGoogleFonts().catch((error) => {
      console.error("Error fetching Google Fonts:", error);
      return [];
    }),
    fetchCustomFonts(),
  ]);

  const combined = [...googleFonts, ...customFonts];
  combined.sort((a, b) => a.family.localeCompare(b.family));

  allFontsCache = combined;
  allFontsCacheTimestamp = Date.now();

  return allFontsCache;
}

/** The weights a font can be asked for, as CSS font-weight numbers. */
export const FONT_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const;

export type FontWeight = (typeof FONT_WEIGHTS)[number];

/** The weight a Google font is asked for when the requested one it does not have. */
const GOOGLE_FALLBACK_WEIGHT: FontWeight = 400;

export const FONT_CATEGORIES = [
  "serif",
  "sans-serif",
  "display",
  "handwriting",
  "monospace",
] as const;

export type FontCategory = (typeof FONT_CATEGORIES)[number];

/** What an element's text looks like when its style names no font: the app's own sans. */
export const DEFAULT_FONT_FAMILY = "Inter";

/** The weight an element's text uses when its style names none. */
export const DEFAULT_FONT_WEIGHT: FontWeight = 700;

export const isFontWeight = (value: unknown): value is FontWeight =>
  typeof value === "number" && (FONT_WEIGHTS as readonly number[]).includes(value);

/**
 * The weight an element renders with. Anything that is not one of `FONT_WEIGHTS` (a missing
 * value, or a weight written by an older version) falls back to the default, so a bad style
 * can't ask the browser for a weight no font has.
 */
export const fontWeightOf = (style: { fontWeight?: number } | null | undefined): FontWeight =>
  isFontWeight(style?.fontWeight) ? style.fontWeight : DEFAULT_FONT_WEIGHT;

/** The family an element renders with, filling in the default when its style names none. */
export const fontFamilyOf = (style: { fontFamily?: string } | null | undefined): string =>
  style?.fontFamily || DEFAULT_FONT_FAMILY;

/**
 * Loads a font at a weight, so it is ready before the element that asks for it is painted.
 *
 * A custom font (see public/custom-fonts.json) is registered with the `FontFace` API, which
 * lets one file answer for several weights: the Minecraft fonts ship a single face each, so
 * asking for 700 shows that face rather than a synthesised bold. A Google font is requested
 * from the CSS API, which only serves the weights a family actually has, so an unavailable
 * weight falls back to the closest one it does have.
 */
export function loadFont(
  fontFamily: string,
  weight: FontWeight = DEFAULT_FONT_WEIGHT
): Promise<void> {
  const fontKey = `${fontFamily}:${weight}`;
  const pending = loadedFonts.get(fontKey);
  if (pending) return pending;

  const load = (async () => {
    const allFonts = await fetchAllFonts();
    const fontInfo = allFonts.find((f) => f.family === fontFamily);

    if (fontInfo && "urls" in fontInfo) {
      const fontUrl = fontInfo.urls[String(weight)] || fontInfo.urls.regular;
      if (!fontUrl) {
        throw new Error(`No file for custom font ${fontFamily}`);
      }
      const fontFace = new FontFace(fontFamily, `url(${fontUrl})`, { weight: String(weight) });
      document.fonts.add(await fontFace.load());
      return;
    }

    // A family that isn't in either catalog (an old preset naming a font that has since been
    // removed, say) is still worth a request: Google serves the CSS for any family it knows.
    try {
      await loadGoogleFont(fontFamily, weight);
    } catch (error) {
      // Not every family has every weight, and the CSS API answers an unavailable one with a
      // 400. The regular cut is the one every family has; the browser then derives the rest,
      // which is what it would have done with the file anyway.
      if (weight === GOOGLE_FALLBACK_WEIGHT) throw error;
      console.warn(`Font ${fontFamily} has no weight ${weight}, loading it regular instead`);
      await loadGoogleFont(fontFamily, GOOGLE_FALLBACK_WEIGHT);
    }
  })();

  loadedFonts.set(fontKey, load);
  load.catch(() => loadedFonts.delete(fontKey));
  return load;
}

/** Asks the Google CSS API for one weight of a family and waits for the stylesheet. */
function loadGoogleFont(fontFamily: string, weight: FontWeight): Promise<void> {
  const href = `https://fonts.googleapis.com/css2?family=${fontFamily
    .replace(/\s+/g, "+")
    .replace(/[()'"]/g, encodeURIComponent)}:wght@${weight}&display=swap`;

  return new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.href = href;
    link.rel = "stylesheet";
    link.onload = () => resolve();
    link.onerror = () => {
      link.remove();
      reject(new Error(`Failed to load font: ${fontFamily} ${weight}`));
    };
    document.head.appendChild(link);
  });
}
