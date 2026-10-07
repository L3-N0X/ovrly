# Variables and the Public API

How external applications feed values into overlays. The API itself, as
integrators see it, is documented in [public-api.md](public-api.md); this file
covers the data model, the request flow and the reasoning behind it.

## Overview

```
 game server / Stream Deck / bot
            │  PUT /api/v1/sources/minecraft-tournament/variables
            │  Authorization: Bearer ovrly_...
            ▼
 routes/publicApi.ts ── authenticates the key, rate limits, validates
            │
            ▼
 services/variables.ts ── writes Variable rows of the key's account,
            │             copies changed values into VariableBinding rows,
            │             publishes every overlay containing such a binding
            ▼
 WebSocket overlay-<id> ── editor, control view and OBS re-render
```

The user side:

1. **Settings → API** (`src/components/settings/ApiSettings.tsx`) creates and
   revokes API keys, and lists and deletes the variables apps sent.
2. A **Variable** element (`ElementType.VARIABLE`) is added like any other
   element. Its content control (`VariableControl.tsx`) lists the overlay
   owner's variables, grouped by source, and binds the element to one.
3. The canvas (`src/components/overlay/Variable.tsx`) draws the value as text,
   styled like a title, or as a swatch for colours.

## Data model

All in `prisma/schema.prisma`; migrations
`20261007170000_add_variable_element_type` and
`20261007170100_public_api_variables`.

### `ApiKey`

| Field        | Notes                                                              |
| ------------ | ------------------------------------------------------------------ |
| `userId`     | The account everything sent with the key is stored on.             |
| `name`       | Given by the user ("Minecraft server").                            |
| `prefix`     | First 12 characters (`ovrly_abc123`), to tell keys apart in the UI.|
| `hash`       | SHA-256 of the key, hex. Unique; requests are looked up by it.     |
| `lastUsedAt` | Written at most once a minute per key.                             |

Keys are `ovrly_` + 32 random bytes (base64url). Because they are random and
long, a plain SHA-256 is enough (no salt, no slow hash), and it allows the
lookup by hash. The key itself is only returned once, by `POST /api/api-keys`.

### `Variable`

One value of one account: `userId` + `source` + `key` (unique together),
`type` (`VariableType` enum: `STRING`, `INTEGER`, `DOUBLE`, `BOOLEAN`,
`COLOR`) and `value` (`Json`, a bare JSON string, number or boolean).

`Json` keeps the column generic across types; validation happens in
`lib/variables.ts` (`parseVariableValue`), the single gate for every write.

### `VariableBinding`

The companion row of a `VARIABLE` element, like `TwitchStat` is for
`TWITCH_STAT`:

| Field       | Notes                                                                |
| ----------- | -------------------------------------------------------------------- |
| `source`    | Which variable it shows; empty until one is picked.                  |
| `key`       |                                                                      |
| `type`      | Copy of the variable's type; null while the owner has no such one.   |
| `value`     | Copy of the variable's value; null likewise.                         |
| `updatedAt` | When the copy was last written.                                      |

**Bound by name, not by id.** An element can point at a variable before the
application ever sent it, and keeps working when the application deletes its
variables and sends them again (a new tournament). Copies of overlays (presets,
imports, duplicates, also into another account) carry only `source`/`key` and
pick up the values of their new owner (`fillOverlayBindings`).

**The value is copied onto the element** instead of being joined at read time.
That way every existing overlay payload (`overlayElementsInclude`, HTTP and
WebSocket) carries it with no changes to the clients' data flow, the revision
mechanism in `publishOverlay` keeps working, and a change reaches OBS the same
way as a counter click. The cost is one `updateMany` per changed variable,
which is cheap with the `[source, key]` index.

**Whose variables:** always those of the overlay's **owner**
(`Overlay.userId`), whoever is looking at or editing it. Team members thereby
see and can pick the owner's variables, but never expose their own.

## Request flow

### Writes (`services/variables.ts`)

`setVariables(server, userId, source, writes)`:

1. In one transaction: lock the existing rows of the written keys
   (`SELECT … FOR UPDATE`, sorted by key so two batches can't deadlock), read
   them, and enforce the per-account limit for new ones.
2. Skip writes whose type and value are unchanged. Applications may send their
   whole state on every tick without causing database writes or broadcasts.
3. Upsert the rest, and copy each into the bindings of the owner's overlays.
4. After commit, `publishOverlay` each affected overlay once.

`incrementVariable` does read-add-write under the same row lock, so concurrent
Stream Deck presses all count. `deleteVariables` removes rows and nulls the
bindings' copies (the binding itself stays).

### Binding an element (`routes/elements.ts`)

`PATCH /api/elements/:id` with `data: { source, key }` (empty strings clear it).
Needs the `CONTROLLER` role, like picking a Twitch stat's channel: it changes
what the element shows, not how it looks. `bindingState` reads the owner's
variable in the same transaction and stores the copy right away.

### Routes

| Route                                   | Auth    | Purpose                                       |
| --------------------------------------- | ------- | --------------------------------------------- |
| `/api/v1/*`                             | API key | Public API (`routes/publicApi.ts`)            |
| `GET/POST /api/api-keys`                | session | List / create keys (`routes/variables.ts`)    |
| `DELETE /api/api-keys/:id`              | session | Revoke a key                                  |
| `GET /api/variables`                    | session | The user's own variables                      |
| `DELETE /api/variables/:id`             | session | Delete one (and blank elements showing it)    |
| `GET /api/overlays/:id/variables`       | session, `CONTROLLER` | The owner's variables, for the picker |

`/api/v1` is routed in `server.ts` **before** the app's CORS handling: it
answers its own preflights with `Access-Control-Allow-Origin: *`, which is safe
because it authenticates with a header, never with cookies.

### Rate limiting

`services/api-keys.ts` keeps an in-memory token bucket per key (burst 30,
10/s). ovrly runs as a single process, so in-memory is enough; with several
instances it would have to move to shared storage (Redis, Postgres).

## Shared modules

- `lib/variables.ts` (server): type list, name rules, `parseVariableValue`,
  limits, `variableBindingSeed` for presets/imports.
- `src/lib/variables.ts` (client): labels, `formatVariableValue`, API calls.

## What's there and what's next

Working end to end for every type: API keys, all `/api/v1` endpoints, the
Variable element (text for strings, numbers and booleans; a swatch for
colours), the picker, live updates, export/import/duplicate, and the settings
page.

Ideas for building on it:

- **Variables in existing elements.** Bind a Counter's value, a Title's text
  (`"{{minecraft-tournament/red.name}}"` placeholders), an Image's URL or any
  colour style property to a variable. `VariableBinding` could grow an
  optional `target` (e.g. `"style.color"`) or titles could store a template
  that the server resolves when copying values.
- **Formatting options** for the Variable element: prefix/suffix, number of
  decimals, labels for `true`/`false`, compact numbers like Twitch stats.
- **Scoped keys:** limit a key to one source, or to read-only access.
- **Webhooks the other way:** let ovrly notify applications (a controller
  pressed a button), turning variables into two-way state.
- **Coalescing broadcasts:** a source changing many times a second publishes an
  overlay per change. Debouncing `publishOverlay` per overlay (e.g. 100 ms)
  would bound that if it ever matters.
- **Typed declarations:** let an application register its variables (name,
  type, description, default) up front, so users can pick them before the
  first value arrives.
