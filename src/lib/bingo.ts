import type { BingoStyle } from "./types";

export const BINGO_MIN_SIZE = 1;
export const BINGO_MAX_SIZE = 10;
export const DEFAULT_BINGO_SIZE = 5;
export const BINGO_MAX_FIELD_LENGTH = 120;
export const FREE_SPACE_LABEL = "FREE";

export interface BingoData {
  rows: number;
  columns: number;
  freeMiddle: boolean;
  fields: string[];
  checked: boolean[];
}

// An object `{ [cellIndex]: value }` for `fields` or `checked` changes only those cells, so
// people editing or marking different cells at the same time don't overwrite each other.
export type BingoCellPatch<T> = Record<number, T>;

export interface BingoDataUpdate {
  rows?: number;
  columns?: number;
  freeMiddle?: boolean;
  fields?: string[] | BingoCellPatch<string>;
  checked?: boolean[] | BingoCellPatch<boolean>;
}

export const bingoCellCount = (rows: number, columns: number) => rows * columns;

/** Only a card with an odd number of rows and columns has a centre cell. */
export const hasBingoMiddle = (rows: number, columns: number) =>
  rows % 2 === 1 && columns % 2 === 1;

export const bingoMiddleIndex = (rows: number, columns: number) =>
  hasBingoMiddle(rows, columns) ? Math.floor(rows / 2) * columns + Math.floor(columns / 2) : -1;

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

export const createBingoData = (
  rows: number = DEFAULT_BINGO_SIZE,
  columns: number = rows
): BingoData => ({
  rows,
  columns,
  freeMiddle: false,
  fields: Array.from({ length: bingoCellCount(rows, columns) }, () => ""),
  checked: Array.from({ length: bingoCellCount(rows, columns) }, () => false),
});

/** Mirrors `resizeBingoCells` on the server: every cell keeps its row and column. */
export const resizeBingoCells = <T>(
  cells: T[],
  from: { rows: number; columns: number },
  to: { rows: number; columns: number },
  blank: T
): T[] =>
  Array.from({ length: bingoCellCount(to.rows, to.columns) }, (_, index) => {
    const row = Math.floor(index / to.columns);
    const column = index % to.columns;
    return row < from.rows && column < from.columns
      ? (cells[row * from.columns + column] ?? blank)
      : blank;
  });

/**
 * Coerces whatever the API returned into a renderable card. Older rows and
 * partially applied edits can hold arrays of the wrong length, and a mismatched
 * array would otherwise make the grid render blank cells or throw.
 */
export const normalizeBingoData = (
  bingo: (Partial<BingoData> & { size?: number }) | null | undefined,
  fallbackSize = DEFAULT_BINGO_SIZE
): BingoData => {
  if (!bingo) {
    return createBingoData(fallbackSize);
  }

  // `size` is the edge length of the square cards from before rows and columns existed.
  const legacySize = isValidBingoSize(bingo.size) ? bingo.size : fallbackSize;
  const rows = isValidBingoSize(bingo.rows) ? bingo.rows : legacySize;
  const columns = isValidBingoSize(bingo.columns) ? bingo.columns : legacySize;
  const cellCount = bingoCellCount(rows, columns);
  const fields = Array.isArray(bingo.fields) ? bingo.fields : [];
  const checked = Array.isArray(bingo.checked) ? bingo.checked : [];

  return {
    rows,
    columns,
    freeMiddle: hasBingoMiddle(rows, columns) && bingo.freeMiddle === true,
    fields: Array.from({ length: cellCount }, (_, index) => fields[index] ?? ""),
    checked: Array.from({ length: cellCount }, (_, index) => checked[index] === true),
  };
};

/** Applies a partial data update locally so the editor stays responsive. */
export const applyBingoDataUpdate = (current: BingoData, update: BingoDataUpdate): BingoData => {
  const rows = isValidBingoSize(update.rows) ? update.rows : current.rows;
  const columns = isValidBingoSize(update.columns) ? update.columns : current.columns;
  const isResize = rows !== current.rows || columns !== current.columns;
  const next = { rows, columns };

  const fields = isResize ? resizeBingoCells(current.fields, current, next, "") : current.fields;
  const checked = isResize
    ? resizeBingoCells(current.checked, current, next, false)
    : current.checked;

  return {
    rows,
    columns,
    freeMiddle: hasBingoMiddle(rows, columns) && (update.freeMiddle ?? current.freeMiddle),
    fields: applyCells(fields, update.fields),
    checked: applyCells(checked, update.checked),
  };
};

const applyCells = <T>(cells: T[], update: T[] | BingoCellPatch<T> | undefined): T[] => {
  if (!update) return cells;
  if (Array.isArray(update)) return update;
  const next = [...cells];
  for (const [index, value] of Object.entries(update)) {
    if (Number(index) < next.length) next[Number(index)] = value;
  }
  return next;
};

export const BINGO_CROSS_STYLES = ["brush", "line"] as const;
export type BingoCrossStyle = (typeof BINGO_CROSS_STYLES)[number];

export const BINGO_IMAGE_FITS = ["cover", "contain", "fill"] as const;
export type BingoImageFit = (typeof BINGO_IMAGE_FITS)[number];

export const defaultBingoStyle = {
  width: 320,
  backgroundColor: "#121212",
  borderColor: "#ffffff",
  borderWidth: 1,
  borderRadius: 8,
  padding: 4,
  gap: 4,
  color: "#ffffff",
  fontFamily: "Roboto",
  fontSize: 32,
  checkedCrossColor: "#facc15",
  crossThickness: 40,
  crossOpacity: 45,
  crossStyle: "brush",
  // Off by default: cards saved before grid lines existed must keep their look.
  gridLines: false,
  gridLineColor: "#ffffff",
  gridLineWidth: 2,
  backgroundImageFit: "cover",
  backgroundImageOpacity: 100,
} satisfies BingoStyle;

export type ResolvedBingoStyle = BingoStyle &
  Required<Pick<BingoStyle, keyof typeof defaultBingoStyle>>;

export const BINGO_SIZE_RANGE = { min: 100, max: 1600 } as const;
export const BINGO_GAP_RANGE = { min: 0, max: 50 } as const;
export const BINGO_PADDING_RANGE = { min: 0, max: 48 } as const;
export const BINGO_BORDER_WIDTH_RANGE = { min: 0, max: 20 } as const;
export const BINGO_BORDER_RADIUS_RANGE = { min: 0, max: 200 } as const;
export const BINGO_GRID_LINE_WIDTH_RANGE = { min: 1, max: 20 } as const;
export const BINGO_CROSS_THICKNESS_RANGE = { min: 5, max: 60 } as const;
export const BINGO_FONT_SIZE_RANGE = { min: 6, max: 160 } as const;
export const BINGO_PERCENT_RANGE = { min: 0, max: 100 } as const;

/**
 * The card's height for its width: whatever makes every cell square. The width is split
 * into equal columns after the outline, padding and gaps, and the rows take the same size.
 */
export const bingoCardHeight = (style: ResolvedBingoStyle, rows: number, columns: number) => {
  const gap = style.gridLines ? style.gridLineWidth : style.gap;
  const frame = 2 * style.borderWidth + (style.gridLines ? 0 : 2 * style.padding);
  const cell = Math.max(0, (style.width - frame - (columns - 1) * gap) / columns);
  return frame + rows * cell + (rows - 1) * gap;
};

/** Merges a stored style over the defaults, ignoring keys that were never set. */
export const resolveBingoStyle = (style: BingoStyle | null | undefined): ResolvedBingoStyle => {
  const resolved: ResolvedBingoStyle = { ...defaultBingoStyle };
  if (!style) {
    return resolved;
  }

  for (const [key, value] of Object.entries(style)) {
    if (value !== undefined && value !== null) {
      (resolved as unknown as Record<string, unknown>)[key] = value;
    }
  }

  return resolved;
};
