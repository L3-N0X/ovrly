export const BINGO_MIN_SIZE = 1;
export const BINGO_MAX_SIZE = 10;
export const DEFAULT_BINGO_SIZE = 5;
export const BINGO_MAX_FIELD_LENGTH = 120;
export const FREE_SPACE_LABEL = "FREE";

export interface BingoState {
  rows: number;
  columns: number;
  freeMiddle: boolean;
  fields: string[];
  checked: boolean[];
}

export interface BingoDataUpdate {
  rows?: number;
  columns?: number;
  freeMiddle?: boolean;
  // An array replaces every cell, an object `{ "3": ... }` changes only the cells it names.
  fields?: string[] | Record<string, string>;
  checked?: boolean[] | Record<string, boolean>;
}

export type BingoUpdateResult =
  | { ok: true; value: BingoState }
  | { ok: false; error: string };

const BINGO_UPDATE_KEYS = ["rows", "columns", "freeMiddle", "fields", "checked"];

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isValidBingoSize = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= BINGO_MIN_SIZE &&
  value <= BINGO_MAX_SIZE;

export const bingoCellCount = (rows: number, columns: number) => rows * columns;

/** Only a card with an odd number of rows and columns has a centre cell. */
export const hasBingoMiddle = (rows: number, columns: number) => rows % 2 === 1 && columns % 2 === 1;

export const bingoMiddleIndex = (rows: number, columns: number) =>
  hasBingoMiddle(rows, columns) ? Math.floor(rows / 2) * columns + Math.floor(columns / 2) : -1;

/**
 * Turns any incoming value into a printable single-line cell label.
 * Newlines and other control characters would break the grid layout, so they
 * collapse into spaces and the result is length capped.
 */
export const sanitizeBingoField = (value: unknown): string => {
  if (typeof value !== "string") {
    return "";
  }
  return value
    .replace(/[\r\n\t\v\f]+/g, " ")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, BINGO_MAX_FIELD_LENGTH);
};

export const createBingoState = (
  rows: number = DEFAULT_BINGO_SIZE,
  columns: number = rows,
  freeMiddle = false
): BingoState => {
  const r = isValidBingoSize(rows) ? rows : DEFAULT_BINGO_SIZE;
  const c = isValidBingoSize(columns) ? columns : DEFAULT_BINGO_SIZE;
  return {
    rows: r,
    columns: c,
    freeMiddle: hasBingoMiddle(r, c) && freeMiddle === true,
    fields: Array.from({ length: bingoCellCount(r, c) }, () => ""),
    checked: Array.from({ length: bingoCellCount(r, c) }, () => false),
  };
};

/**
 * Moves row-major cells onto a card of another shape. Every cell keeps its row and column,
 * so adding a column doesn't shift the labels of the rows below; cells that no longer fit
 * are dropped and new ones are `blank`.
 */
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
 * Coerces a stored or user supplied bingo payload into a state that is safe to
 * render and persist. Anything malformed is replaced by a sensible default
 * instead of being propagated.
 */
export const normalizeBingoState = (raw: unknown, fallbackSize = DEFAULT_BINGO_SIZE): BingoState => {
  if (!isPlainObject(raw)) {
    return createBingoState(fallbackSize);
  }

  // `size` is the edge length of the square cards from before rows and columns existed;
  // presets and exports may still carry it.
  const legacySize = isValidBingoSize(raw.size) ? raw.size : fallbackSize;
  const rows = isValidBingoSize(raw.rows) ? raw.rows : legacySize;
  const columns = isValidBingoSize(raw.columns) ? raw.columns : legacySize;
  const cellCount = bingoCellCount(rows, columns);
  const sourceFields = Array.isArray(raw.fields) ? raw.fields : [];
  const sourceChecked = Array.isArray(raw.checked) ? raw.checked : [];

  return {
    rows,
    columns,
    freeMiddle: hasBingoMiddle(rows, columns) && raw.freeMiddle === true,
    fields: Array.from({ length: cellCount }, (_, index) => sanitizeBingoField(sourceFields[index])),
    checked: Array.from({ length: cellCount }, (_, index) => sourceChecked[index] === true),
  };
};

const parseFields = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }
  return value.map(sanitizeBingoField);
};

const parseChecked = (value: unknown): boolean[] | null => {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "boolean")) {
    return null;
  }
  return value.map((entry) => entry === true);
};

/**
 * Reads a `{ cellIndex: value }` patch. Patching single cells lets people edit or mark
 * different cells of the same card at once without one of them overwriting the other.
 */
const parseCellPatch = <T>(
  value: Record<string, unknown>,
  cellCount: number,
  parseValue: (entry: unknown) => T | null
): Map<number, T> | null => {
  const patch = new Map<number, T>();
  for (const [key, entry] of Object.entries(value)) {
    const index = Number(key);
    const parsed = parseValue(entry);
    if (!/^\d+$/.test(key) || index >= cellCount || parsed === null) return null;
    patch.set(index, parsed);
  }
  return patch;
};

const applyCellPatch = <T>(cells: T[], patch: Map<number, T>) => {
  const next = [...cells];
  patch.forEach((value, index) => (next[index] = value));
  return next;
};

/**
 * Validates a PATCH payload for a bingo element against its current state.
 *
 * The returned update is always complete: `rows`/`columns` changes are applied to
 * `fields`/`checked` here (each cell keeps its row and column) so callers never have to
 * resize arrays themselves, and `freeMiddle` is forced off for cards without a centre cell.
 */
export const parseBingoUpdate = (data: unknown, current: BingoState): BingoUpdateResult => {
  if (!isPlainObject(data)) {
    return { ok: false, error: "Bingo data must be an object" };
  }

  const keys = Object.keys(data);
  if (keys.length === 0 || keys.some((key) => !BINGO_UPDATE_KEYS.includes(key))) {
    return {
      ok: false,
      error: "Bingo data accepts only rows, columns, freeMiddle, fields and checked",
    };
  }

  const rows = data.rows === undefined ? current.rows : data.rows;
  const columns = data.columns === undefined ? current.columns : data.columns;
  if (!isValidBingoSize(rows) || !isValidBingoSize(columns)) {
    return {
      ok: false,
      error: `rows and columns must be integers between ${BINGO_MIN_SIZE} and ${BINGO_MAX_SIZE}`,
    };
  }

  const cellCount = bingoCellCount(rows, columns);
  const shape = `${rows}x${columns}`;
  const isResize = rows !== current.rows || columns !== current.columns;
  const next = { rows, columns };

  let fields = isResize ? resizeBingoCells(current.fields, current, next, "") : undefined;
  let checked = isResize ? resizeBingoCells(current.checked, current, next, false) : undefined;

  if (isPlainObject(data.fields)) {
    const patch = parseCellPatch(data.fields, cellCount, (entry) =>
      typeof entry === "string" ? sanitizeBingoField(entry) : null
    );
    if (!patch) {
      return { ok: false, error: "fields must map cell indexes on the card to strings" };
    }
    fields = applyCellPatch(fields ?? current.fields, patch);
  } else if (data.fields !== undefined) {
    const parsed = parseFields(data.fields);
    if (!parsed) {
      return { ok: false, error: "fields must be an array of strings" };
    }
    if (parsed.length !== cellCount) {
      return {
        ok: false,
        error: `fields must contain exactly ${cellCount} entries for a ${shape} card`,
      };
    }
    fields = parsed;
  }

  if (isPlainObject(data.checked)) {
    const patch = parseCellPatch(data.checked, cellCount, (entry) =>
      typeof entry === "boolean" ? entry : null
    );
    if (!patch) {
      return { ok: false, error: "checked must map cell indexes on the card to booleans" };
    }
    checked = applyCellPatch(checked ?? current.checked, patch);
  } else if (data.checked !== undefined) {
    const parsed = parseChecked(data.checked);
    if (!parsed) {
      return { ok: false, error: "checked must be an array of booleans" };
    }
    if (parsed.length !== cellCount) {
      return {
        ok: false,
        error: `checked must contain exactly ${cellCount} entries for a ${shape} card`,
      };
    }
    checked = parsed;
  }

  const requestedFreeMiddle = data.freeMiddle === undefined ? current.freeMiddle : data.freeMiddle;
  if (typeof requestedFreeMiddle !== "boolean") {
    return { ok: false, error: "freeMiddle must be a boolean" };
  }

  return {
    ok: true,
    value: {
      rows,
      columns,
      freeMiddle: hasBingoMiddle(rows, columns) && requestedFreeMiddle,
      fields: fields ?? current.fields,
      checked: checked ?? current.checked,
    },
  };
};

/** Fisher-Yates shuffle that does not mutate its input. */
export const shuffleBingoFields = (fields: string[]): string[] => {
  const shuffled = [...fields];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};
