// Colour conversions for the colour picker. Colours are stored as hex (`#rrggbb`, or
// `#rrggbbaa` when they aren't opaque); everything else is only for showing and entering them.
//
// Ranges: r/g/b 0-255, h 0-360, s/v/a 0-1, OKLab/OKLCH L 0-1.

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface Hsva {
  h: number;
  s: number;
  v: number;
  a: number;
}

export interface Oklab {
  l: number;
  a: number;
  b: number;
}

export interface Oklch {
  l: number;
  c: number;
  h: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const hsvaToRgba = ({ h, s, v, a }: Hsva): Rgba => {
  const channel = (n: number) => {
    const k = (n + h / 60) % 6;
    return (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255;
  };
  return { r: channel(5), g: channel(3), b: channel(1), a };
};

// Grey and black have no hue (and black no saturation either); `previous` keeps the ones the
// picker had, so dragging through black doesn't throw the hue back to red.
export const rgbaToHsva = ({ r, g, b, a }: Rgba, previous?: Hsva): Hsva => {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const delta = max - Math.min(rn, gn, bn);

  let h = previous?.h ?? 0;
  if (delta > 1e-6) {
    if (max === rn) h = 60 * (((gn - bn) / delta) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / delta + 2);
    else h = 60 * ((rn - gn) / delta + 4);
    if (h < 0) h += 360;
  }
  const s = max > 1e-6 ? delta / max : (previous?.s ?? 0);
  return { h, s, v: max, a };
};

const hslToRgb = (h: number, s: number, l: number) => {
  const v = l + s * Math.min(l, 1 - l);
  return hsvaToRgba({ h, s: v === 0 ? 0 : 2 * (1 - l / v), v, a: 1 });
};

const toHexByte = (value: number) =>
  Math.round(clamp(value, 0, 255))
    .toString(16)
    .padStart(2, "0");

/** `#rrggbb`, with an alpha byte only when the colour isn't opaque. */
export const rgbaToHex = ({ r, g, b, a }: Rgba) => {
  const alpha = Math.round(clamp(a, 0, 1) * 255);
  return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}${alpha === 255 ? "" : toHexByte(alpha)}`;
};

export const hsvaToHex = (hsva: Hsva) => rgbaToHex(hsvaToRgba(hsva));

// --- OKLab (https://bottosson.github.io/posts/oklab/) ---

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLinear = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export const rgbToOklab = ({ r, g, b }: Rgba): Oklab => {
  const [lr, lg, lb] = [toLinear(r / 255), toLinear(g / 255), toLinear(b / 255)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return {
    l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
};

// Linear sRGB, which may be out of gamut.
const oklabToLinearRgb = ({ l: L, a, b }: Oklab) => {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
};

const inGamut = (channels: number[]) => channels.every((c) => c >= -1e-4 && c <= 1 + 1e-4);

export const oklabToOklch = ({ l, a, b }: Oklab): Oklch => {
  const c = Math.hypot(a, b);
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l, c, h: c < 1e-4 ? 0 : h };
};

export const oklchToOklab = ({ l, c, h }: Oklch): Oklab => {
  const rad = (h * Math.PI) / 180;
  return { l, a: c * Math.cos(rad), b: c * Math.sin(rad) };
};

/**
 * The sRGB colour for an OKLab one. Colours sRGB can't show keep their lightness and hue and
 * lose chroma until they fit, which looks far closer than clipping the channels.
 */
export const oklabToRgb = (lab: Oklab, alpha = 1): Rgba => {
  const lightness = clamp(lab.l, 0, 1);
  let linear = oklabToLinearRgb({ ...lab, l: lightness });
  if (!inGamut(linear)) {
    const { h, c } = oklabToOklch(lab);
    let [low, high] = [0, c];
    for (let i = 0; i < 24; i++) {
      const mid = (low + high) / 2;
      if (inGamut(oklabToLinearRgb(oklchToOklab({ l: lightness, c: mid, h })))) low = mid;
      else high = mid;
    }
    linear = oklabToLinearRgb(oklchToOklab({ l: lightness, c: low, h }));
  }
  const [r, g, b] = linear.map((channel) => clamp(fromLinear(clamp(channel, 0, 1)), 0, 1) * 255);
  return { r, g, b, a: alpha };
};

// --- Parsing ---

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FUNCTION = /^(rgba?|hsla?|hsva?|hsb|oklch|oklab)\((.*)\)$/i;

const parseHex = (input: string): Rgba | null => {
  const match = HEX.exec(input);
  if (!match) return null;
  let digits = match[1];
  if (digits.length <= 4) digits = [...digits].map((d) => d + d).join("");
  const byte = (i: number) => parseInt(digits.slice(i, i + 2), 16);
  return { r: byte(0), g: byte(2), b: byte(4), a: digits.length === 8 ? byte(6) / 255 : 1 };
};

// A number, or a percentage of `percentOf`.
const parseNumber = (token: string | undefined, percentOf: number) => {
  if (token === undefined || token === "none") return 0;
  const value = parseFloat(token);
  if (Number.isNaN(value)) return NaN;
  return token.endsWith("%") ? (value / 100) * percentOf : value;
};

const parseHue = (token: string | undefined) => {
  if (token === undefined) return NaN;
  const value = parseFloat(token);
  if (token.endsWith("turn")) return value * 360;
  if (token.endsWith("rad")) return (value * 180) / Math.PI;
  return value;
};

const parseFunction = (input: string): Rgba | null => {
  const match = FUNCTION.exec(input);
  if (!match) return null;
  const name = match[1].toLowerCase();
  const [channels, alphaPart] = match[2].split("/");
  const tokens = channels.split(/[\s,]+/).filter(Boolean);
  if (alphaPart !== undefined) tokens[3] = alphaPart.trim();
  if (tokens.length < 3) return null;
  const alpha = tokens[3] === undefined ? 1 : clamp(parseNumber(tokens[3], 1), 0, 1);

  let rgba: Rgba;
  if (name.startsWith("rgb")) {
    const [r, g, b] = tokens.map((token) => parseNumber(token, 255));
    rgba = { r, g, b, a: alpha };
  } else if (name.startsWith("hsl")) {
    const rgb = hslToRgb(
      parseHue(tokens[0]),
      parseNumber(tokens[1], 100) / 100,
      parseNumber(tokens[2], 100) / 100
    );
    rgba = { ...rgb, a: alpha };
  } else if (name === "oklch") {
    rgba = oklabToRgb(
      oklchToOklab({
        l: parseNumber(tokens[0], 1),
        c: parseNumber(tokens[1], 0.4),
        h: parseHue(tokens[2]),
      }),
      alpha
    );
  } else if (name === "oklab") {
    rgba = oklabToRgb(
      {
        l: parseNumber(tokens[0], 1),
        a: parseNumber(tokens[1], 0.4),
        b: parseNumber(tokens[2], 0.4),
      },
      alpha
    );
  } else {
    rgba = hsvaToRgba({
      h: parseHue(tokens[0]),
      s: parseNumber(tokens[1], 100) / 100,
      v: parseNumber(tokens[2], 100) / 100,
      a: alpha,
    });
  }
  const { r, g, b } = rgba;
  if ([r, g, b].some(Number.isNaN)) return null;
  return { r: clamp(r, 0, 255), g: clamp(g, 0, 255), b: clamp(b, 0, 255), a: rgba.a };
};

// Named colours ("rebeccapurple") and anything else the browser understands, via a canvas,
// which normalizes what it is given to hex or rgba().
let probe: CanvasRenderingContext2D | null | undefined;
const parseWithBrowser = (input: string): Rgba | null => {
  if (typeof document === "undefined") return null;
  probe ??= document.createElement("canvas").getContext("2d");
  if (!probe) return null;
  // Two different sentinels: an invalid colour leaves either one untouched.
  probe.fillStyle = "#000";
  probe.fillStyle = input;
  const first = probe.fillStyle;
  probe.fillStyle = "#fff";
  probe.fillStyle = input;
  if (first !== probe.fillStyle) return null;
  return parseHex(first) ?? parseFunction(first);
};

/**
 * Reads a colour the way people paste them: hex with or without `#`, the CSS functions
 * (rgb, hsl, oklch, oklab, plus hsv), bare "255, 0, 128" triples and colour names.
 */
export const parseColor = (raw: string): Rgba | null => {
  const input = raw.trim().replace(/;$/, "");
  if (!input) return null;
  if (input.toLowerCase() === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  // Hex first: "123456" is a hex colour, not three numbers.
  const hex = parseHex(input);
  if (hex) return hex;
  const bare = /^[\d.\s,%/]+$/.test(input) ? `rgb(${input})` : input;
  return parseFunction(bare) ?? parseWithBrowser(input);
};

/** The hex form of any colour `parseColor` reads, or null. */
export const normalizeColor = (raw: string) => {
  const rgba = parseColor(raw);
  return rgba ? rgbaToHex(rgba) : null;
};
