# Variables

Variables are named values of an account (a text, a number, a yes/no value, a
colour, an image) that fields of elements can be **bound** to, like Figma
variables: a counter's value, a title's text, a colour, a width. Whoever
changes a variable changes everything bound to it, in every overlay, live.

Variables come from three places:

- **The editor:** the Variables tab of an overlay creates them and changes their
  values.
- **Applications**, through the public API with an API key
  ([public-api.md](public-api.md)): a game server, a Stream Deck, a bot.
- **Providers**, which ovrly keeps up to date itself. Twitch is the first: each
  channel a user adds gets its followers, viewers, title and so on as
  variables. Spotify (track, artist, cover) is the obvious next one.

This file covers the data model, the request flow and the reasoning behind it.

## Overview

```
 editor (Variables tab)    application (/api/v1)    provider (Twitch poller)
            │                       │                         │
            └───────────────┬───────┴─────────────────────────┘
                            ▼
 services/variables.ts ── writes Variable rows of the account (only changed ones),
            │             finds the overlays with elements bound to them
            ▼
 WebSocket overlay-<id>    ── each bound overlay is published again; its payload
            │                 carries the values of the variables it is bound to
 WebSocket variables-<user> ── `{ "type": "variables" }` for open Variables tabs
            ▼
 OverlayCanvas ── resolveOverlay() puts the values into the bound properties
                  before anything is drawn (editor, control view, OBS)
```

## Data model

All in `prisma/schema.prisma`, migration `20261008120000_variables_foundation`.

### `Variable`

One value of one account: `userId` + `source` + `key` (unique together),
`type` (`VariableType`: `STRING`, `INTEGER`, `DOUBLE`, `BOOLEAN`, `COLOR`,
`IMAGE`) and `value` (`Json`, a bare JSON string, number or boolean).

`Json` keeps the column generic across types; `parseVariableValue` in
`lib/variables.ts` is the single gate for every write. Images are URLs: http(s)
anywhere, or `/uploads/...` on this server; empty means no image.

**Sources** group variables. Names the API and the editor accept
(`isVariableName`: letters, digits, `.`, `_`, `-`) never contain a `:`, so
`"<provider>:<name>"` (`twitch:shroud`) is reserved for providers
(`isProviderSource`). That is what makes provider variables read only: the
public API answers `409 read_only` for writes to them, and the editor shows
them without an input.

### `VariableSource`

A provider instance a user added: `provider` (`VariableProvider`: `TWITCH`),
`name` (the source of its variables, `twitch:<login>`), `externalId` (the
Twitch user id), `config` (`{ displayName }`) and `problem`, why some of its
variables are missing (`NOT_CONNECTED`, `NOT_ALLOWED`; see below). Unique per
user by `name`. Removing it deletes its variables.

Sources that are just a name (`variables`, `minecraft-tournament`) have no
row; they exist as long as variables use them.

### `VariableBinding`

One bound property of one element: `elementId`, `property`, and the
`source` + `key` of the variable. Unique by `[elementId, property]`.

**Properties** are named as in `lib/bindings.ts` (`BINDABLE_PROPERTIES`, the
same catalogue as `src/lib/bindings.ts`): `text` (title), `value` (counter),
`src` (image), and `style.<key>` for any style key the element's type lets be
bound (`style.color`, `style.width`, `style.x`, ...). Each has a **kind** that
decides which variable types fit:

| Kind      | Variable types                 | Examples                                   |
| --------- | ------------------------------ | ------------------------------------------ |
| `text`    | string, integer, double        | title text                                 |
| `number`  | integer, double                | counter value, font size, width, x/y       |
| `color`   | color                          | text colour, background, stroke            |
| `image`   | image                          | image source, bingo background image       |
| `boolean` | boolean                        | group clipping, bingo grid lines           |

**Bound by name, not by id.** A binding can point at a variable that doesn't
exist (yet, or anymore): the field then shows its own value, and the editor
marks the binding. Applications can delete their variables and send them again
(a new tournament) without breaking anything, and copies of overlays (presets,
imports, duplicates, also into another account) carry only the names and pick
up the variables of their new owner.

**The element keeps its own value.** Binding doesn't touch the stored title
text or counter value; detaching shows it again.

**Whose variables:** always those of the overlay's **owner**
(`Overlay.userId`), whoever is looking at or editing it. Team members see and
bind the owner's variables, never their own.

## Reading: what overlays carry

`overlayElementsInclude` (`services/overlay-query.ts`) includes each element's
`bindings`, and `withVariables` adds `variables` to the overlay: the owner's
variables its elements are bound to, and only those, because the OBS URL is
public. Every overlay payload goes through it (HTTP, WebSocket,
`publishOverlay`), so a variable change reaches OBS the same way a counter
click does, including the revision mechanism.

The client resolves the bindings in one place: `OverlayCanvas` renders
`resolveOverlay(overlay)` (`src/lib/bindings.ts`), which puts each fitting
variable's value into the bound property. Renderers never know whether a value
was bound. Edits still go to the stored overlay, so the inspector keeps
showing the element's own values while the canvas shows the variables'.

A `text` property shows numbers formatted for the viewer's locale
(`formatVariableValue`). A variable whose type stopped fitting (an application
changed it) is skipped, and the property shows its own value.

## Writing

### `services/variables.ts`

`setVariables(server, userId, source, writes)`:

1. In one transaction: lock the existing rows of the written keys
   (`SELECT … FOR UPDATE`, sorted by key so two batches can't deadlock), read
   them, and enforce the per-account limit for new ones.
2. Skip writes whose type and value are unchanged. Applications and providers
   may send their whole state every time without causing writes or broadcasts.
3. Upsert the rest and collect the overlays bound to them.
4. After commit, `publishOverlay` each of those overlays once, and publish
   `{ "type": "variables" }` on `variables-<userId>`.

`setVariableValue` (the editor; refuses provider sources), `incrementVariable`
(read-add-write under the same row lock, so concurrent Stream Deck presses all
count) and `deleteVariables` build on the same steps.

### Binding a field (`routes/elements.ts`)

`PATCH /api/elements/:id` with
`bindings: { "<property>": { source, key } | null }` creates, replaces or
removes bindings (null removes). Properties are checked against the element's
type. Content properties (`text`, `value`, `src`) need the `CONTROLLER` role,
style properties `EDITOR`, like editing them directly.

### Routes

| Route                                                  | Auth                  | Purpose                                         |
| ------------------------------------------------------ | --------------------- | ----------------------------------------------- |
| `/api/v1/*`                                            | API key               | Public API (`routes/publicApi.ts`)              |
| `GET/POST /api/api-keys`, `DELETE /api/api-keys/:id`   | session               | API keys (`routes/variables.ts`)                |
| `GET /api/variables`                                   | session               | The user's own variables and sources            |
| `DELETE /api/variables/:id`                            | session               | Delete one of them                              |
| `GET /api/overlays/:id/variables`                      | `CONTROLLER`          | The owner's variables and sources               |
| `POST /api/overlays/:id/variables`                     | `EDITOR`              | Create one: `{ source, key, type, value }`      |
| `PATCH /api/overlays/:id/variables/:variableId`        | `CONTROLLER`          | Change its value: `{ value }`                   |
| `DELETE /api/overlays/:id/variables/:variableId`       | `EDITOR`              | Delete it                                       |
| `POST /api/overlays/:id/variable-sources`              | `EDITOR`              | Add a provider: `{ provider: "twitch", channel }` |
| `DELETE /api/overlays/:id/variable-sources/:sourceId`  | `EDITOR`              | Remove it with its variables                    |

The overlay routes act on the **owner's** variables, so team members manage
them from the overlay they share. Controllers run the show (change values,
bind content); editors shape it (create and delete variables, add providers,
bind style). Every list response is `{ variables, sources }`.

`/api/v1` is routed in `server.ts` **before** the app's CORS handling: it
answers its own preflights with `Access-Control-Allow-Origin: *`, which is safe
because it authenticates with a header, never with cookies.

### Live updates

Sockets of an overlay subscribe to `overlay-<id>`, and, when the user has
access to the overlay (editor and control view, not the public OBS page), to
`variables-<ownerId>` as well (`middleware/wsAuth.ts`, `server.ts`). A
`variables` message bumps `variablesVersion` in `useOverlayData`, and
`VariablesProvider` fetches the list again.

## Twitch (`services/twitch-variables.ts`)

Each channel a user adds (Variables tab → New → Twitch channel) becomes a
`VariableSource` `twitch:<login>` with these variables:

| Key          | Type    | Notes                                                    |
| ------------ | ------- | -------------------------------------------------------- |
| `name`       | string  | Display name                                             |
| `avatar`     | image   | Profile picture                                          |
| `followers`  | integer |                                                          |
| `live`       | boolean |                                                          |
| `viewers`    | integer | 0 while offline                                          |
| `title`      | string  | Stream title                                             |
| `category`   | string  | Game or category                                         |
| `subscribers`| integer | Only while the channel is connected (see below)          |
| `sub-points` | integer | Tier 1 counts 1, tier 2 counts 2, tier 3 counts 6        |

Twitch only pushes events (EventSub) to channels that authorized the app, so
every channel is **polled**: every 30 s for the owners of overlays that are
open somewhere (any socket), and right away when an overlay is opened (with a
15 s cooldown) or a channel is added, connected or disconnected. Public data
uses the app token, batched 100 channels per request.

**Subscriber numbers** are private on Twitch. They need a `TwitchConnection`
(Settings → Twitch, own OAuth flow in `routes/twitch.ts`), and are only written
for the connecting user and their account-share team. Otherwise the source's
`problem` says why (`NOT_CONNECTED`, `NOT_ALLOWED`) and the Variables tab
explains it; the two variables are removed.

**Presets** bind to `twitch:@me` (`OWN_TWITCH_SOURCE`), which overlay creation
replaces with the creator's own channel, adding it as a source if needed
(`ownTwitchSource`).

### Adding a provider

1. Add it to `VariableProvider` and pick a source prefix (`spotify:<name>`).
2. Write its variables with `setVariables` under that source; never let it
   write sources of other providers.
3. Add it to the "New" menu of `VariablesPanel` and to `sourceLabel`
   (`src/lib/variables.ts`).

## Shared modules

- `lib/variables.ts` (server): types, name rules, `parseVariableValue`, limits.
- `lib/bindings.ts` (server): bindable properties, `bindingSeeds` for
  presets and imports, `OWN_TWITCH_SOURCE`.
- `src/lib/variables.ts` (client): labels, `formatVariableValue`,
  `sourceLabel`, API calls.
- `src/lib/bindings.ts` (client): the same property catalogue, `resolveOverlay`.
- `src/lib/variablesContext.ts`, `src/components/variables/`: the Variables tab
  (`VariablesPanel`), `VariablesProvider`, and `BindableField`, which turns a
  labelled field into one that can be bound.

### Making a field bindable

1. Add the property and its kind to `BINDABLE_PROPERTIES` in both
   `lib/bindings.ts` and `src/lib/bindings.ts`.
2. Wrap the field in `<BindableField property="style.foo" label="Foo">`
   (`NumberProp` and `ColorProp` in `editor/fields.tsx` take a `property`
   prop and use its compact mode). The field needs `BindingElementContext`, which the inspector and the
   control view provide.
3. For a content property, teach `resolveElement` where the value goes.

## What's next

- **Visibility:** bind whether an element is shown to a boolean variable.
- **Text templates:** titles mixing text and variables
  (`"{{red.name}}: {{red.points}}"`).
- **Writable bindings:** counter +/- on a bound counter increments the
  variable instead of being hidden.
- **Formatting:** compact numbers (12.4K), decimals, prefix/suffix.
- **Renaming** variables and sources, updating the bindings with them.
- **Imports into another account** could add the Twitch channels the overlay
  is bound to.
- **More providers:** Spotify, StreamElements, a timer as a variable.
- **Scoped keys:** limit a key to one source, or to read-only access.
- **Coalescing broadcasts:** a source changing many times a second publishes an
  overlay per change; debouncing `publishOverlay` per overlay would bound that.
