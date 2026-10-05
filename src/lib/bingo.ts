import type { BingoStyle, PrismaElement } from "./types";

export const BINGO_MIN_SIZE = 3;
export const BINGO_MAX_SIZE = 7;
export const DEFAULT_BINGO_SIZE = 5;
export const BINGO_MAX_FIELD_LENGTH = 120;
export const FREE_SPACE_LABEL = "FREE";

export interface BingoData {
  size: number;
  freeMiddle: boolean;
  fields: string[];
  checked: boolean[];
}

export type BingoDataUpdate = Partial<BingoData>;

export const bingoCellCount = (size: number) => size * size;

export const bingoMiddleIndex = (size: number) =>
  size % 2 === 1 ? Math.floor(bingoCellCount(size) / 2) : -1;

export const isValidBingoSize = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= BINGO_MIN_SIZE &&
  value <= BINGO_MAX_SIZE;

export const bingoSizes = Array.from(
  { length: BINGO_MAX_SIZE - BINGO_MIN_SIZE + 1 },
  (_, index) => BINGO_MIN_SIZE + index
);

/** Mirrors `sanitizeBingoField` on the server so local edits match what is persisted. */
export const sanitizeBingoField = (value: string): string =>
  value
    .replace(/[\r\n\t\v\f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, BINGO_MAX_FIELD_LENGTH);

const blankCells = (size: number) => Array.from({ length: bingoCellCount(size) }, () => "");

export const createBingoData = (
  size: number = DEFAULT_BINGO_SIZE,
  freeMiddle = false
): BingoData => ({
  size,
  freeMiddle: size % 2 === 1 && freeMiddle,
  fields: blankCells(size),
  checked: blankCells(size).map(() => false),
});

export const resizeBingoFields = (fields: string[], nextSize: number): string[] =>
  Array.from({ length: bingoCellCount(nextSize) }, (_, index) => fields[index] ?? "");

/**
 * Coerces whatever the API returned into a renderable card. Older rows and
 * partially applied edits can hold arrays of the wrong length, and a mismatched
 * array would otherwise make the grid render blank cells or throw.
 */
export const normalizeBingoData = (
  bingo: PrismaElement["bingo"],
  fallbackSize = DEFAULT_BINGO_SIZE
): BingoData => {
  if (!bingo) {
    return createBingoData(fallbackSize);
  }

  const size = isValidBingoSize(bingo.size) ? bingo.size : fallbackSize;
  const cellCount = bingoCellCount(size);
  const fields = Array.isArray(bingo.fields) ? bingo.fields : [];
  const checked = Array.isArray(bingo.checked) ? bingo.checked : [];

  return {
    size,
    freeMiddle: size % 2 === 1 && bingo.freeMiddle === true,
    fields: Array.from({ length: cellCount }, (_, index) => fields[index] ?? ""),
    checked: Array.from({ length: cellCount }, (_, index) => checked[index] === true),
  };
};

/** Applies a partial data update locally so the editor stays responsive. */
export const applyBingoDataUpdate = (current: BingoData, update: BingoDataUpdate): BingoData => {
  const size = isValidBingoSize(update.size) ? update.size : current.size;
  const isResize = size !== current.size;

  return {
    size,
    freeMiddle: size % 2 === 1 && (update.freeMiddle ?? current.freeMiddle),
    fields: isResize ? resizeBingoFields(current.fields, size) : (update.fields ?? current.fields),
    checked: isResize ? new Array(bingoCellCount(size)).fill(false) : (update.checked ?? current.checked),
  };
};

export const defaultBingoStyle: Required<
  Pick<
    BingoStyle,
    | "width"
    | "height"
    | "backgroundColor"
    | "borderColor"
    | "borderWidth"
    | "borderRadius"
    | "padding"
    | "gap"
    | "color"
    | "checkedBackgroundColor"
    | "checkedColor"
    | "checkedCrossColor"
    | "crossWidth"
    | "fontFamily"
    | "fontSize"
  >
> = {
  width: 320,
  height: 320,
  backgroundColor: "#121212",
  borderColor: "#ffffff",
  borderWidth: 1,
  borderRadius: 8,
  padding: 4,
  gap: 4,
  color: "#ffffff",
  checkedBackgroundColor: "#A47C3A",
  checkedColor: "#E7B363",
  checkedCrossColor: "#ffffff",
  crossWidth: 4,
  fontFamily: "Roboto",
  fontSize: 16,
};

export const BINGO_SIZE_RANGE = { min: 100, max: 800 } as const;
export const BINGO_GAP_RANGE = { min: 0, max: 50 } as const;
export const BINGO_PADDING_RANGE = { min: 0, max: 48 } as const;
export const BINGO_BORDER_WIDTH_RANGE = { min: 0, max: 20 } as const;
export const BINGO_BORDER_RADIUS_RANGE = { min: 0, max: 200 } as const;
export const BINGO_CROSS_WIDTH_RANGE = { min: 1, max: 30 } as const;
export const BINGO_FONT_SIZE_RANGE = { min: 6, max: 100 } as const;

/** Merges a stored style over the defaults, ignoring keys that were never set. */
export const resolveBingoStyle = (style: BingoStyle | null | undefined): BingoStyle => {
  const resolved: BingoStyle = { ...defaultBingoStyle };
  if (!style) {
    return resolved;
  }

  for (const [key, value] of Object.entries(style)) {
    if (value !== undefined && value !== null) {
      (resolved as Record<string, unknown>)[key] = value;
    }
  }

  return resolved;
};
