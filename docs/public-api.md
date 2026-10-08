# Public API

The public API lets other applications send **variables** to an ovrly account. A
variable is a named value (a text, a number, a yes/no value, a colour or an
image) that fields of overlay elements are bound to: a title's text, a
counter's value, a colour, a size. Everything bound to a variable updates live
whenever the application sends a new value.

Typical integrations:

- a game server sending team scores (`minecraft-tournament` → `red.points`)
- a Stream Deck button adding or subtracting points
- a bot or script posting the current song, the next match, a poll result, ...

How it is built is described in [variables.md](variables.md).

## Quick start

1. In ovrly, open **Settings → API**, create an API key and copy it. It is only
   shown once.
2. Send a variable:

   ```sh
   curl -X PUT https://<your-ovrly-host>/api/v1/sources/minecraft-tournament/variables/red.points \
     -H "Authorization: Bearer ovrly_..." \
     -H "Content-Type: application/json" \
     -d '{ "type": "integer", "value": 12 }'
   ```

3. In an overlay, hover a field that takes a number (a counter's **Value**, a
   font size, ...), click the variable button next to its label and pick
   `red.points` under `minecraft-tournament`. The **Variables** tab next to the
   editor lists every variable of the account.
4. Every following request updates the overlay live, in the editor and in OBS.

## Concepts

| Term     | Meaning                                                                                       |
| -------- | --------------------------------------------------------------------------------------------- |
| API key  | Belongs to one ovrly account. Everything sent with it is stored on that account.             |
| Source   | Names the application sending the variables, e.g. `minecraft-tournament` or `streamdeck`.    |
| Key      | Names one variable within its source, e.g. `red.points`.                                     |
| Variable | `source` + `key` + `type` + `value`. Unique per account by `source` and `key`.               |
| Provider | Something ovrly keeps up to date itself, e.g. a Twitch channel (source `twitch:<channel>`).   |

Variables belong to the **account**, not to an overlay: every overlay of the
account can show them, and so can people the account's overlays are shared
with (they see the owner's variables). Several keys of one account all write
the same variables; use one key per application so you can revoke them
separately.

### Names

Sources and keys are 1–64 characters long, start with a letter or digit, and
may contain letters, digits, `.`, `_` and `-`. They are case-sensitive. Dots
are a convention for grouping (`red.points`, `red.name`), nothing more.

Sources of providers have a `:` in them (`twitch:shroud`), which names sent by
applications never do. Their variables can be read like any other (write the
`:` as is or as `%3A`), but not written: ovrly keeps them up to date, and
writes answer `409 read_only`. See [Provider variables](#provider-variables).

### Types

| Type      | JSON value                                                  | Example         | Can be bound to                       |
| --------- | ----------------------------------------------------------- | --------------- | ------------------------------------- |
| `string`  | string, at most 1000 characters                             | `"Team Red"`    | texts                                 |
| `integer` | whole number (safe JS integer)                              | `12`            | numbers (sizes, counters), texts      |
| `double`  | finite number                                               | `1.5`           | numbers, texts                        |
| `boolean` | `true` or `false`                                           | `true`          | switches (group clipping, grid lines) |
| `color`   | hex colour `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa`        | `"#ff8800"`     | colours                               |
| `image`   | http(s) URL, at most 2048 characters; `""` for no image     | `"https://…"`   | images                                |

Numbers bound to a text are shown in the viewer's locale format (`1,234`).

Types are sent in lowercase; uppercase is accepted as well. Colours are stored
in lowercase. Sending a variable with a different type than before replaces
it, type and all.

## Requests

Base URL: `https://<your-ovrly-host>/api/v1`

Every request needs the key in the `Authorization` header:

```
Authorization: Bearer ovrly_...
```

Request bodies are JSON. The API answers any origin (CORS `*`), so it can be
called from a browser too, but never put a key into a page other people can
open: anyone with the key can change the account's variables.

### Errors

Errors come with an HTTP status and a body like:

```json
{ "error": { "code": "invalid_value", "message": "“red.points”: An integer variable needs a whole number value" } }
```

| Status | `code`               | When                                                        |
| ------ | -------------------- | ----------------------------------------------------------- |
| 400    | `invalid_name`       | A source or key doesn't follow the [naming rules](#names).  |
| 400    | `invalid_type`       | Unknown type.                                               |
| 400    | `invalid_value`      | The value doesn't match its type.                           |
| 400    | `invalid_body`       | The body is missing or malformed.                           |
| 400    | `invalid_request`    | An increment would leave the type's range.                  |
| 401    | `unauthorized`       | No key, or a key that doesn't exist (anymore).              |
| 404    | `not_found`          | No such variable, or no such endpoint.                      |
| 405    | `method_not_allowed` | The endpoint exists, the method doesn't.                    |
| 409    | `conflict`           | Incrementing a non-number variable, or the account is full. |
| 409    | `read_only`          | Writing to a [provider's](#provider-variables) source.      |
| 429    | `rate_limited`       | Too many requests; wait `Retry-After` seconds.              |

### Limits

- **Rate:** bursts of 30 requests, then 10 requests per second, per key.
- **Variables:** 1000 per account, 100 per batch request.
- **API keys:** 20 per account.

Prefer one batch request over many single ones, and don't worry about sending
unchanged values: only variables whose value actually changed are written and
broadcast.

### Variable object

Responses describe variables like this:

```json
{
  "source": "minecraft-tournament",
  "key": "red.points",
  "type": "integer",
  "value": 12,
  "updatedAt": "2026-10-07T11:05:43.030Z"
}
```

`updatedAt` is when the value last changed.

## Endpoints

### `GET /me`

Checks a key. Returns the account and key name.

```json
{ "user": { "name": "some_streamer" }, "key": { "name": "Minecraft server" } }
```

### `GET /variables`

Lists all variables of the account. `?source=<source>` limits it to one source.

```json
{ "variables": [ { "source": "...", "key": "...", "type": "...", "value": ..., "updatedAt": "..." } ] }
```

### `GET /sources/{source}/variables`

Lists the variables of one source. Same response as `GET /variables`.

### `PUT /sources/{source}/variables`

Creates or replaces several variables of one source at once, atomically. The
body maps keys to `{ type, value }`:

```json
{
  "variables": {
    "red.points":  { "type": "integer", "value": 12 },
    "blue.points": { "type": "integer", "value": 7 },
    "leader":      { "type": "string",  "value": "Team Red" },
    "red.color":   { "type": "color",   "value": "#ff0000" }
  }
}
```

Returns the written variables: `{ "variables": [...] }`. If any entry is
invalid, nothing is written.

Variables of the source that are not in the body are left as they are. To
start over (a new tournament), `DELETE /sources/{source}` first.

### `PUT /sources/{source}/variables/{key}`

Creates or replaces one variable.

```json
{ "type": "string", "value": "Team Red" }
```

Returns `{ "variable": {...} }`.

### `GET /sources/{source}/variables/{key}`

Returns `{ "variable": {...} }`, or 404.

### `POST /sources/{source}/variables/{key}/increment`

Adds to an `integer` or `double` variable on the server, so increments sent at
the same moment (two Stream Deck buttons, two moderators) all count. The
variable has to exist already.

```json
{ "by": 5 }
```

`by` may be negative, and defaults to 1 when the body is left out. Integers only
take whole numbers. Returns `{ "variable": {...} }`.

### `DELETE /sources/{source}/variables/{key}`

Deletes one variable. `204` on success, `404` if it didn't exist.

### `DELETE /sources/{source}`

Deletes every variable of a source. Returns `{ "deleted": <count> }`.

Fields bound to a deleted variable stay bound and show their own value until
the variable is sent again.

## Provider variables

ovrly keeps some variables up to date itself. They show up in `GET /variables`
like any other and can be read, but not written.

### Twitch

Each Twitch channel added in an overlay's Variables tab gets the source
`twitch:<channel>` (lowercase login) with:

| Key           | Type      | Value                                                  |
| ------------- | --------- | ------------------------------------------------------ |
| `name`        | `string`  | Display name                                           |
| `avatar`      | `image`   | Profile picture                                        |
| `followers`   | `integer` | Followers                                              |
| `live`        | `boolean` | Whether the channel is live                            |
| `viewers`     | `integer` | Viewers, 0 while offline                               |
| `title`       | `string`  | Stream title                                           |
| `category`    | `string`  | Game or category                                       |
| `subscribers` | `integer` | Only for channels connected under Settings → Twitch    |
| `sub-points`  | `integer` | Tier 1 counts 1, tier 2 counts 2, tier 3 counts 6; same |

They are refreshed about every 30 seconds while one of the account's overlays
is open.

## Examples

### Stream Deck

Use any "web request" / "API request" action that can send a POST with a
header. One button per direction:

- URL: `https://<your-ovrly-host>/api/v1/sources/streamdeck/variables/deaths/increment`
- Method: `POST`
- Header: `Authorization: Bearer ovrly_...`
- Body: `{ "by": 1 }` (or `{ "by": -1 }` for the other button)

Create the variable once with a `PUT` (`{ "type": "integer", "value": 0 }`),
which also resets it.

### Game server (JavaScript)

```js
const OVRLY = "https://<your-ovrly-host>/api/v1";
const headers = {
  Authorization: `Bearer ${process.env.OVRLY_API_KEY}`,
  "Content-Type": "application/json",
};

async function publishScores(teams) {
  const variables = {};
  for (const team of teams) {
    variables[`${team.id}.points`] = { type: "integer", value: team.points };
    variables[`${team.id}.name`] = { type: "string", value: team.name };
  }
  const response = await fetch(`${OVRLY}/sources/minecraft-tournament/variables`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ variables }),
  });
  if (!response.ok) console.error(await response.json());
}
```

### Python

```python
import os, requests

requests.put(
    "https://<your-ovrly-host>/api/v1/sources/my-bot/variables/now-playing",
    headers={"Authorization": f"Bearer {os.environ['OVRLY_API_KEY']}"},
    json={"type": "string", "value": "Daft Punk – Around the World"},
    timeout=5,
)
```

## Versioning

Everything lives under `/api/v1`. Additions (new endpoints, new fields in
responses, new types) can happen within `v1`; clients should ignore fields
they don't know. Breaking changes get a new prefix.
