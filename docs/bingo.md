# Bingo Element

Reference for the `BINGO` element type. For user-facing instructions see the
README; this file covers the data model, API and rendering behaviour.

## Data model

`Bingo` is a one-to-one companion of `Element` (`prisma/schema.prisma`):

| Field         | Type      | Notes                                                       |
| ------------- | --------- | ----------------------------------------------------------- |
| `size`        | `Int`     | Edge length of the square grid. 3–7, defaults to 5.          |
| `freeMiddle`  | `Boolean` | Marks the centre cell as permanently called. Odd sizes only. |
| `fields`      | `Json`    | `string[]` of `size * size` labels. Max 120 chars each.      |
| `checked`     | `Json`    | `boolean[]` of `size * size` mark states.                    |

Migration: `prisma/migrations/20251216145651_add_bingo`.

The array lengths are a function of `size`, so they are always rewritten
together — see [Validation](#validation) for the rules.

### Shared modules

Bingo rules live in two mirrored modules, because the server must not trust the
client and the client must not crash on a partially applied edit:

- `lib/bingo.ts` — server side. `normalizeBingoState`, `parseBingoUpdate`,
  `shuffleBingoFields`, `sanitizeBingoField`.
- `src/lib/bingo.ts` — client side. Same normalisation plus `resolveBingoStyle`
  (style defaults) and `applyBingoDataUpdate` (optimistic local update).

Both use the same `sanitizeBingoField` rules so what the editor shows matches
what gets persisted: newlines and control characters are stripped, runs of
whitespace collapse to a single space, and the label is trimmed.

## Validation

`parseBingoUpdate(data, currentState)` is the single gate for every write. It
returns either an error message or a **complete** update, and it:

- rejects unknown keys and empty payloads;
- requires `size` to be an integer in 3–7;
- resizes `fields` (positionally, blanking new cells) and clears `checked` when
  `size` changes, so callers never resize arrays themselves;
- requires `fields` to be an array of strings and `checked` an array of booleans,
  each exactly `size * size` long for the *resulting* size;
- forces `freeMiddle` to `false` for even sizes, which prevents a dangling flag
  when a card is resized.

`routes/elements.ts` (`PATCH /api/elements/:id`) and
`routes/overlays.ts` (preset import and overlay duplication, via
`normalizeBingoState`) both go through these helpers, so a malformed preset or a
hand-crafted request cannot produce a permanently broken card.

## API

| Method | Path                            | Purpose                                     |
| ------ | ------------------------------- | ------------------------------------------- |
| `POST` | `/api/bingo/:elementId/toggle`  | Flip `checked[index]`. Body `{ "index": n }`. |
| `POST` | `/api/bingo/:elementId/shuffle` | Shuffle `fields`.                           |
| `PATCH`| `/api/elements/:elementId`      | Update `data.size` / `freeMiddle` / `fields` / `checked`. |

Conventions shared with the rest of the API:

- `401` when unauthenticated.
- `404` both when the element does not exist **and** when it belongs to another
  user, so the endpoints cannot be used to enumerate element IDs.
- `405` for a matched path with the wrong method.
- `400` with a JSON `{ "error": ... }` body for invalid input.
- Every mutation re-reads the overlay and publishes it to the
  `overlay-<id>` WebSocket channel, then returns the full overlay.

## Rendering

- `src/components/overlay/Bingo.tsx` draws the grid. The card is sized in pixels
  from `BingoStyle.width` / `height` (default 320×320) so it fits inside the
  800×600 canvas instead of filling it. Grid tracks use `minmax(0, 1fr)` so cells
  can shrink below their content.
- `src/components/overlay/BingoCell.tsx` renders one cell and autofits the label
  with a binary search that never exceeds `BingoStyle.fontSize`. It searches with
  `white-space: nowrap` first so a long label does not register as "fits" merely
  because it is already broken across lines, then falls back to wrapping if even
  the minimum size does not fit on one line.
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
the defaults in `src/lib/bingo.ts`:

`width`, `height`, `backgroundColor`, `borderColor`, `borderWidth`,
`borderRadius`, `padding`, `gap`, `color`, `checkedBackgroundColor`,
`checkedColor`, `checkedCrossColor`, `crossWidth`, `fontFamily`, `fontSize`.

`checkedCrossColor` is separate from `checkedColor` so the cross stays legible
over the cell background. The cross is drawn as an SVG using
`vectorEffect="non-scaling-stroke"`, which keeps its width in pixels even though
the viewBox is stretched to fit non-square cells.

## Editing

- Labels are edited in **Data Controls** (`BingoControl.tsx`) and inline on the
  canvas. Both go through `useOverlayData.handleBingoDataChange`, which applies
  the change optimistically and then persists it (debounced per element).
- Card size and the free-middle switch live in **Appearance → Elements**
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
