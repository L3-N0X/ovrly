import { decode } from "jpeg-js";

// Picks an accent colour out of a cover image, so overlays can be styled after whatever is playing
// (services/spotify-variables.ts). Spotify serves covers as JPEGs in several sizes; the smallest
// (64x64) holds plenty of colour and decodes in well under a millisecond.

export interface CoverColors {
  // The most vivid colour of the cover that covers a fair part of it.
  accent: string;
  // The accent's hue, dark enough for a background behind white text.
  dark: string;
  // Darker still, close to black, for a background that should barely show the colour.
  darker: string;
  // Nearly white with a hint of the accent's hue, for text on the dark shades.
  light: string;
  // Black or white, whichever reads better on the accent.
  contrast: string;
}

const MAX_IMAGE_BYTES = 1024 * 1024;
const FETCH_TIMEOUT_MS = 5000;
const CACHE_SIZE = 500;

// Covers repeat (every poll of the same track, a whole album), so their colours are kept.
const cache = new Map<string, CoverColors>();

type Rgb = [number, number, number];
type Hsl = [number, number, number];

const toHsl = ([r, g, b]: Rgb): Hsl => {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === r ? ((g - b) / d + (g < b ? 6 : 0)) / 6 : max === g ? ((b - r) / d + 2) / 6 : ((r - g) / d + 4) / 6;
  return [h, s, l];
};

const toRgb = ([h, s, l]: Hsl): Rgb => {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [channel(h + 1 / 3) * 255, channel(h) * 255, channel(h - 1 / 3) * 255];
};

const toHex = (rgb: Rgb) =>
  `#${rgb.map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, "0")).join("")}`;

// WCAG relative luminance.
const luminance = (rgb: Rgb) => {
  const [r, g, b] = rgb.map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** The colours of an image's RGBA pixels. Exported for trying it out on images directly. */
export const colorsOfPixels = (data: Uint8Array, pixelCount: number): CoverColors => {
  // Pixels are put in buckets of similar colour (8 levels per channel), and each bucket remembers
  // the average of its pixels, so the result is a colour that is actually on the cover.
  const buckets = new Map<number, { count: number; r: number; g: number; b: number }>();
  const step = Math.max(1, Math.floor(pixelCount / 10_000));
  for (let i = 0; i < pixelCount; i += step) {
    const o = i * 4;
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.count++;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
    } else {
      buckets.set(key, { count: 1, r, g, b });
    }
  }

  let vivid: { score: number; rgb: Rgb; hsl: Hsl } | null = null;
  let common: { count: number; rgb: Rgb; hsl: Hsl } | null = null;
  for (const bucket of buckets.values()) {
    const rgb: Rgb = [bucket.r / bucket.count, bucket.g / bucket.count, bucket.b / bucket.count];
    const hsl = toHsl(rgb);
    const [, s, l] = hsl;
    // Saturated colours away from black and white win, weighted by how much of the cover they
    // cover, so a speck of red doesn't beat a sky of blue.
    const score = bucket.count * (0.05 + s) ** 2 * Math.max(0.05, 1 - Math.abs(l - 0.5) * 1.8);
    if (!vivid || score > vivid.score) vivid = { score, rgb, hsl };
    if (!common || bucket.count > common.count) common = { count: bucket.count, rgb, hsl };
  }
  // A black and white cover has no vivid colour; its most common grey is the accent then.
  const pick = vivid && vivid.hsl[1] >= 0.15 ? vivid : common;
  const [h, s, l] = pick?.hsl ?? [0, 0, 0.5];

  // An accent has to stand out on a dark overlay as well as a light one, so it is kept off the
  // extremes.
  const accent = toRgb([h, s, clamp(l, 0.3, 0.75)]);
  const dark = toRgb([h, Math.min(s, 0.55), 0.14]);
  const darker = toRgb([h, Math.min(s, 0.5), 0.07]);
  const light = toRgb([h, Math.min(s, 0.6), 0.9]);
  const contrast = luminance(accent) > 0.179 ? "#000000" : "#ffffff";
  return { accent: toHex(accent), dark: toHex(dark), darker: toHex(darker), light: toHex(light), contrast };
};

const download = async (url: string) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`Cover download failed (${response.status})`);
  if (Number(response.headers.get("Content-Length") ?? 0) > MAX_IMAGE_BYTES) {
    throw new Error("Cover is too large");
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > MAX_IMAGE_BYTES) throw new Error("Cover is too large");
  return bytes;
};

/** The colours of the JPEG at `url`. Throws when it can't be downloaded or isn't a JPEG. */
export const coverColors = async (url: string): Promise<CoverColors> => {
  const cached = cache.get(url);
  if (cached) return cached;
  const image = decode(await download(url), {
    useTArray: true,
    formatAsRGBA: true,
    maxResolutionInMP: 4,
    maxMemoryUsageInMB: 64,
  });
  const colors = colorsOfPixels(image.data, image.width * image.height);
  if (cache.size >= CACHE_SIZE) cache.delete(cache.keys().next().value!);
  cache.set(url, colors);
  return colors;
};
