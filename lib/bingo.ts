export const BINGO_MIN_SIZE = 3;
export const BINGO_MAX_SIZE = 7;
export const DEFAULT_BINGO_SIZE = 5;
export const BINGO_MAX_FIELD_LENGTH = 120;
export const FREE_SPACE_LABEL = "FREE";

export interface BingoState {
  size: number;
  freeMiddle: boolean;
  fields: string[];
  checked: boolean[];
}

export interface BingoDataUpdate {
  size?: number;
  freeMiddle?: boolean;
  fields?: string[];
  checked?: boolean[];
}

export type BingoUpdateResult =
  | { ok: true; value: Required<BingoDataUpdate> }
  | { ok: false; error: string };

const BINGO_UPDATE_KEYS = ["size", "freeMiddle", "fields", "checked"];

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isValidBingoSize = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= BINGO_MIN_SIZE &&
  value <= BINGO_MAX_SIZE;

export const bingoCellCount = (size: number) => size * size;

export const bingoMiddleIndex = (size: number) =>
  size % 2 === 1 ? Math.floor(bingoCellCount(size) / 2) : -1;

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

const blankState = (size: number): BingoState => ({
  size,
  freeMiddle: false,
  fields: Array.from({ length: bingoCellCount(size) }, () => ""),
  checked: Array.from({ length: bingoCellCount(size) }, () => false),
});

export const createBingoState = (
  size: number = DEFAULT_BINGO_SIZE,
  freeMiddle = false
): BingoState => {
  const state = blankState(isValidBingoSize(size) ? size : DEFAULT_BINGO_SIZE);
  state.freeMiddle = state.size % 2 === 1 && freeMiddle === true;
  return state;
};

export const resizeBingoFields = (fields: unknown, nextSize: number): string[] => {
  const source = Array.isArray(fields) ? fields : [];
  return Array.from({ length: bingoCellCount(nextSize) }, (_, index) =>
    sanitizeBingoField(source[index])
  );
};

/**
 * Coerces a stored or user supplied bingo payload into a state that is safe to
 * render and persist. Anything malformed is replaced by a sensible default
 * instead of being propagated.
 */
export const normalizeBingoState = (raw: unknown, fallbackSize = DEFAULT_BINGO_SIZE): BingoState => {
  if (!isPlainObject(raw)) {
    return createBingoState(fallbackSize);
  }

  const size = isValidBingoSize(raw.size) ? raw.size : fallbackSize;
  const cellCount = bingoCellCount(size);
  const sourceFields = Array.isArray(raw.fields) ? raw.fields : [];
  const sourceChecked = Array.isArray(raw.checked) ? raw.checked : [];

  return {
    size,
    freeMiddle: size % 2 === 1 && raw.freeMiddle === true,
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
 * Validates a PATCH payload for a bingo element against its current state.
 *
 * The returned update is always complete: `size` changes are applied to
 * `fields`/`checked` here so callers never have to resize arrays themselves,
 * and `freeMiddle` is forced off for cards without a centre cell.
 */
export const parseBingoUpdate = (data: unknown, current: BingoState): BingoUpdateResult => {
  if (!isPlainObject(data)) {
    return { ok: false, error: "Bingo data must be an object" };
  }

  const keys = Object.keys(data);
  if (keys.length === 0 || keys.some((key) => !BINGO_UPDATE_KEYS.includes(key))) {
    return {
      ok: false,
      error: "Bingo data accepts only size, freeMiddle, fields and checked",
    };
  }

  const nextSize = data.size === undefined ? current.size : data.size;
  if (!isValidBingoSize(nextSize)) {
    return {
      ok: false,
      error: `size must be an integer between ${BINGO_MIN_SIZE} and ${BINGO_MAX_SIZE}`,
    };
  }

  const cellCount = bingoCellCount(nextSize);
  const isResize = nextSize !== current.size;

  let fields = isResize ? resizeBingoFields(current.fields, nextSize) : undefined;
  let checked = isResize ? new Array(cellCount).fill(false) : undefined;

  if (data.fields !== undefined) {
    const parsed = parseFields(data.fields);
    if (!parsed) {
      return { ok: false, error: "fields must be an array of strings" };
    }
    if (parsed.length !== cellCount) {
      return {
        ok: false,
        error: `fields must contain exactly ${cellCount} entries for a ${nextSize}x${nextSize} card`,
      };
    }
    fields = parsed;
  }

  if (data.checked !== undefined) {
    const parsed = parseChecked(data.checked);
    if (!parsed) {
      return { ok: false, error: "checked must be an array of booleans" };
    }
    if (parsed.length !== cellCount) {
      return {
        ok: false,
        error: `checked must contain exactly ${cellCount} entries for a ${nextSize}x${nextSize} card`,
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
      size: nextSize,
      freeMiddle: nextSize % 2 === 1 && requestedFreeMiddle,
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
