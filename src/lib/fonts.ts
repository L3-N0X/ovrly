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

const API_KEY = import.meta.env.VITE_GOOGLE_FONTS_API_KEY;
const API_URL = "https://www.googleapis.com/webfonts/v1/webfonts";

const loadedFonts = new Set<string>();

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
    const customFontsData = await response.json();

    return customFontsData.map((font: any) => ({
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

  const googleFonts = await fetchGoogleFonts();
  const customFonts = await fetchCustomFonts();

  const combined = [...googleFonts, ...customFonts];
  combined.sort((a, b) => a.family.localeCompare(b.family));

  allFontsCache = combined;
  allFontsCacheTimestamp = Date.now();

  return allFontsCache;
}

export async function loadFont(fontFamily: string, variant = "regular"): Promise<void> {
  const allFonts = await fetchAllFonts();
  const fontInfo = allFonts.find((f) => f.family === fontFamily);

  if (fontInfo && "urls" in fontInfo) {
    const customFont = fontInfo as CustomFont;
    const fontKey = `${fontFamily}-${variant}`;
    if (loadedFonts.has(fontKey)) return;

    const fontWeight = variant === "regular" ? "normal" : variant;
    const fontUrl = customFont.urls[variant] || customFont.urls.regular;

    if (!fontUrl) {
      return Promise.reject(
        new Error(`Variant ${variant} not found for custom font ${fontFamily}`)
      );
    }

    const fontFace = new FontFace(fontFamily, `url(${fontUrl})`, { weight: fontWeight });
    return fontFace
      .load()
      .then((loadedFace) => {
        document.fonts.add(loadedFace);
        loadedFonts.add(fontKey);
      })
      .catch((err) => {
        console.error(`Failed to load custom font: ${fontFamily}`, err);
        throw err;
      });
  } else {
    if (loadedFonts.has(fontFamily)) return;

    const formattedFontFamily = fontFamily.replace(/\s+/g, "+");
    const fontVariant = variant === "regular" ? "400" : variant;
    const href = `https://fonts.googleapis.com/css2?family=${formattedFontFamily}:wght@${fontVariant}&display=swap`;

    return new Promise((resolve, reject) => {
      const link = document.createElement("link");
      link.href = href;
      link.rel = "stylesheet";

      link.onload = () => {
        loadedFonts.add(fontFamily);
        resolve();
      };

      link.onerror = () => {
        reject(new Error(`Failed to load font: ${fontFamily}`));
      };

      document.head.appendChild(link);
    });
  }
}

export interface FontPickerProps {
  onFontSelect?: (font: GoogleFont) => void;
  value?: string;
}

export const FONT_CATEGORIES = [
  "serif",
  "sans-serif",
  "display",
  "handwriting",
  "monospace",
] as const;

export type FontCategory = (typeof FONT_CATEGORIES)[number];

export const FONT_WEIGHTS = [
  "100",
  "200",
  "300",
  "400",
  "500",
  "600",
  "700",
  "800",
  "900",
] as const;

export type FontWeight = (typeof FONT_WEIGHTS)[number];
