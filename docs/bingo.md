# Bingo Element

Reference for the `BINGO` element type. For user-facing instructions see the
README; this file covers the data model, API and rendering behaviour.

## Data model

`Bingo` is a one-to-one companion of `Element` (`prisma/schema.prisma`):

| Field         | Type      | Notes                                                       |
| ------------- | --------- | ----------------------------------------------------------- |
| `rows`        | `Int`     | Number of rows. 1–10, defaults to 5.                                  |
| `columns`     | `Int`     | Number of columns. 1–10, defaults to 5. Cards need not be square.     |
| `freeMiddle`  | `Boolean` | Marks the centre cell as permanently called. Odd rows and columns only. |
| `fields`      | `Json`    | Row-major `string[]` of `rows * columns` labels. Max 120 chars each.  |
| `checked`     | `Json`    | Row-major `boolean[]` of `rows * columns` mark states.                |

Migrations: `prisma/migrations/20251216145651_add_bingo`, and
`20261006150000_bingo_rows_columns`, which turned the old square `size` into
`rows` and `columns`. `normalizeBingoState` / `normalizeBingoData` still accept a
legacy `size` (used for both dimensions) from presets and older exports.

The array lengths are a function of `rows` and `columns`, so they are always
rewritten together — see [Validation](#validation) for the rules.

### Shared modules

Bingo rules live in two mirrored modules, because the server must not trust the
client and the client must not crash on a partially applied edit:

- `lib/bingo.ts` — server side. `normalizeBingoState`, `parseBingoUpdate`,
  `resizeBingoCells`, `shuffleBingoFields`, `sanitizeBingoField`.
- `src/lib/bingo.ts` — client side. Same normalisation plus `resolveBingoStyle`
  (style defaults) and `applyBingoDataUpdate` (optimistic local update).

Both use the same `sanitizeBingoField` rules so what the editor shows matches
what gets persisted: newlines and control characters are stripped, runs of
whitespace collapse to a single space, and the label is trimmed.

## Validation

`parseBingoUpdate(data, currentState)` is the single gate for every write. It
returns either an error message or a **complete** update, and it:

- rejects unknown keys and empty payloads;
- requires `rows` and `columns` to be integers in 1–10;
- resizes `fields` and `checked` when either dimension changes, keeping every
  cell in its row and column (cells that no longer fit are dropped, new ones are
  blank and unmarked), so callers never resize arrays themselves;
- requires `fields` to be an array of strings and `checked` an array of booleans,
  each exactly `rows * columns` long for the *resulting* shape, or a
  `{ index: value }` patch of single cells;
- forces `freeMiddle` to `false` unless both dimensions are odd, which prevents a
  dangling flag when a card is resized.

`routes/elements.ts` (`PATCH /api/elements/:id`) and
`routes/overlays.ts` (preset import and overlay duplication, via
`normalizeBingoState`) both go through these helpers, so a malformed preset or a
hand-crafted request cannot produce a permanently broken card.

## API

| Method | Path                            | Purpose                                     |
| ------ | ------------------------------- | ------------------------------------------- |
| `POST` | `/api/bingo/:elementId/toggle`  | Flip `checked[index]`. Body `{ "index": n }`. |
| `POST` | `/api/bingo/:elementId/shuffle` | Shuffle `fields`.                           |
| `PATCH`| `/api/elements/:elementId`      | Update `data.rows` / `columns` / `freeMiddle` / `fields` / `checked`. |

Conventions shared with the rest of the API:

- `401` when unauthenticated.
- `404` both when the element does not exist **and** when it belongs to another
  user, so the endpoints cannot be used to enumerate element IDs.
- `405` for a matched path with the wrong method.
- `400` with a JSON `{ "error": ... }` body for invalid input.
- Every mutation re-reads the overlay and publishes it to the
  `overlay-<id>` WebSocket channel, then returns the full overlay.

## Rendering

- `src/components/overlay/Bingo.tsx` draws the card. Its width is
  `BingoStyle.width` (default 320) and its height is computed by
  `bingoCardHeight`, so every cell is square whatever the rows and columns; a
  stored `height` from older cards is ignored. Grid tracks use `minmax(0, 1fr)` so cells
  can shrink below their content. An optional background image sits between the
  background colour and the cells.
- With `gridLines` on, the gap becomes `gridLineWidth`, the padding is dropped
  and lines are drawn in the gaps from edge to edge, so the cells form a table
  whose outer edge is the card's outline.
- `src/components/overlay/BingoCell.tsx` renders one cell and autofits the label:
  a binary search for the largest size up to `BingoStyle.fontSize` at which the
  label fits while wrapping only between words (a word that is too long makes
  the label overflow the cell's width, so the size shrinks). Only if even the
  minimum size can't fit a word does it allow breaking inside words. Sizes are
  measured with layout sizes (`clientWidth`, `scrollWidth`), which the editor's
  zoom transform doesn't affect. It refits when the cell resizes, the label,
  family or weight changes, a web font finishes loading, and while typing.
- `src/components/overlay/BingoCross.tsx` draws the mark of a called cell
  *behind* the label, without changing the cell background, as an SVG in the
  cell's pixel coordinates. Two styles: `brush` (default) and `line` (two
  straight, round-capped strokes). The brush is a dry-brush X: each diagonal is
  a bundle of thin bristles with ragged starts and ends (more ragged towards
  the edges), occasional gaps that leave light streaks, and a few stray hairs
  past the ends. The randomness comes from a seeded PRNG keyed by the cell's
  index, so every viewer sees the same strokes and the crosses on a card
  differ from each other. `crossOpacity` applies to the whole drawing, so
  overlapping bristles aren't darker.
- Cells are read-only unless the canvas was mounted as the editor.
  `OverlayCanvas` takes an `isEditor` prop (set by `OverlayPreview`) and
  `Bingo` additionally requires a `BingoDataProvider` to be present, so the
  public OBS page cannot mutate a card.
- In the editor: click toggles, double-click (or `F2`) renames inline, `Enter`
  commits, `Escape` cancels, `Enter`/`Space` toggles from the keyboard. A click
  is only committed as a toggle after a short delay, so a double-click never
  also marks the cell.
- The centre cell of a `freeMiddle` card renders the label `FREE`, is drawn
  marked, and is rejected by the toggle endpoint.

## Style

`BingoStyle` (see `src/lib/types.ts`) is stored on `Element.style` and merged over
the defaults in `src/lib/bingo.ts` (`resolveBingoStyle`):

- Card: `width` (the height follows from it), `backgroundColor`, `backgroundImage` (URL),
  `backgroundImageFit` (`cover` / `contain` / `fill`), `backgroundImageOpacity`
  (0–100), `borderColor`, `borderWidth`, `borderRadius`, `padding`, `gap`.
- Grid lines: `gridLines`, `gridLineColor`, `gridLineWidth`. Off by default so
  cards saved before they existed keep their look.
- Text: `color`, `fontFamily`, `fontWeight`, `fontSize` (the maximum the autofit
  may use).
- Cross: `checkedCrossColor`, `crossThickness` (percent of the cell size),
  `crossOpacity` (0–100), `crossStyle` (`brush` / `line`). Cards saved earlier may
  carry a pixel `crossWidth`, which is ignored.

## Editing

- Labels are edited and cells marked in the **Content** controls
  (`BingoControl.tsx`, a mark button on every field plus **Clear Marks**) and
  inline on the canvas. All of it goes through
  `useOverlayData.handleBingoDataChange`, which applies the change
  optimistically and then persists it (debounced per element). Clearing only
  unmarks the cells that are marked, as a cell patch.
- Rows, columns and the free-middle switch live in **Appearance → Elements**
  (`BingoEditor.tsx`), which forwards through
  `OverlayPage → StyleEditor → ElementListEditor → ElementListItem`. It receives
  the same handler plus `ws`, so slider drags update the OBS preview live.
- `useSyncedSlider` mirrors numeric controls across clients over the editor
  WebSocket channel.
- `BingoControl` shows a pending state on the shuffle button and surfaces API
  errors inline; `Bingo` shows a toggle error under the card in the editor only.

## Local setup note

After pulling a change that touches `prisma/schema.prisma`, run:

```bash
bunx prisma generate
bunx prisma migrate deploy
```

The generated client is not committed, and a client built from an older schema
lacks the `bingo` relation, which makes every bingo query throw. The Docker
build already does this (`Dockerfile`); local development has to do it by hand.
