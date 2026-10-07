# CLAUDE.md

Guidance for coding agents. `AGENTS.md` and `GEMINI.md` are symlinks to this file.

## Test user (local agent login)

Real users sign in with Twitch only (usernames are used for sharing, so there is no email sign-up in the UI). For agents there is an email/password account in the local dev database:

| Field    | Value                 |
| -------- | --------------------- |
| Email    | `test@ovrly.local`    |
| Password | `ovrly-test-password` |
| Name     | `ovrly_test`          |

- Email/password auth is `emailAndPassword` in `auth.ts`, enabled only when `AUTH_EMAIL_PASSWORD="true"` (set in the local `.env`, never in production). No frontend form exists; sign in with a POST to `/api/auth/sign-in/email` (`{ email, password }`, `Origin` must equal `APP_BASE_URL`) or `authClient.signIn.email(...)` from the browser console/tests.
- Create the user (idempotent): `bun run scripts/create-test-user.ts` (needs `.env` loaded and the DB running).
- The database exists on the user's machine only. Do not use this account anywhere else.

## Project summary

Web-based overlay editor for live streaming: users build overlays from elements (titles, counters, timers, countdowns, Twitch stats, images, bingo, groups) and share them with others by Twitch name.

- **Frontend:** React, TypeScript, Vite 8, Tailwind CSS (`src/`).
- **Backend:** Bun `Bun.serve` with plain handler functions in `routes/`, WebSockets for live updates (`server.ts`, `auth.ts`, `routes/`, `middleware/`, `lib/`, `services/`, `types/`).
- **Database:** Prisma 7 with PostgreSQL; **auth:** `better-auth` (Twitch).

### Commands

- `bun install`, then `bun run dev` (frontend `http://localhost:5173`, backend `http://localhost:3000`)
- `bun run dev` restarts the backend itself: `scripts/dev-server.ts` watches the paths in `tsconfig.server.json` plus `prisma/schema.prisma`, regenerates the Prisma client when the schema changes, then restarts a fresh `server.ts`. Run migrations yourself (`bunx prisma migrate dev`) — the watcher never touches the database. `bun run dev:server` runs the backend on its own; both it and `server.ts` honour `PORT`.
- `bun run build` (typechecks all three tsconfig projects, then Vite build), `bun run typecheck`, `bun run lint`
- `docker compose up --build` reproduces a deployment

### Conventions

- ESLint config in `eslint.config.js`; no tests or commit conventions exist yet.
- Verbatim TS: use `import type {}` for types. Backend uses relative imports; the `@/` alias is frontend only.
- `bun run typecheck` covers `tsconfig.app.json`, `tsconfig.node.json` and `tsconfig.server.json`. `src/generated` is excluded.
- **Prisma 7:** client generated to `src/generated/prisma` (import from `../src/generated/prisma/client`, not `@prisma/client`). Every client needs a driver adapter; use the single shared client exported from `auth.ts`. URLs live in `prisma.config.ts` (needs `DATABASE_URL` for migrate). Generation runs in `scripts/postinstall.ts`.
- **Library notes:** Vite 8 uses `build.rolldownOptions` and `import.meta.dirname`; react-window 2 uses `<List rowComponent rowCount rowHeight rowProps />`; pragmatic-drag-and-drop 4 moved `preserve-offset-on-source` to `utils/`; ESLint 10 presets are under `configs.flat`, and `react-hooks/set-state-in-effect` is a warning on purpose.
- **Sharing and roles:** `OverlayShare` (one overlay) and `AccountShare` (all of the owner's overlays) carry a `ShareRole`: `VIEWER` < `CONTROLLER` (content) < `EDITOR` (design); the higher role wins, only the owner shares/deletes. Check access with `requireOverlayRole` (`middleware/authMiddleware.ts`); helpers in `lib/sharing.ts` and `src/lib/sharing.ts`. `routes/sharing.ts` publishes `{ "type": "access" }` on the overlay's WebSocket channel.
- **Canvas:** the canvas is the overlay itself (`Overlay.width`/`height`, `canvasMode` `AUTO` or `FREE`), not an element; top-level elements keep `parentId: null` (`isPlacedFreely` in `tree.ts`). Settings UI is `editor/CanvasEditor.tsx` (`OVERLAY_SELECTION`).
- **Twitch stats:** `TWITCH_STAT` elements store their value on the element (`TwitchStat`); `services/twitch-stats.ts` polls Helix every 30s for overlays with an open WebSocket and broadcasts changes. Followers/viewers use the app token; subscriber stats need a `TwitchConnection` (own OAuth flow in `routes/twitch.ts`, redirect `<APP_BASE_URL>/api/twitch/callback`) and are only shown in overlays of the connecting user or their account-share team.
- **Public API / variables:** apps send `Variable`s (per account, by `source` + `key`) to `/api/v1` with an `ApiKey` (`routes/publicApi.ts`, own CORS, routed before `handleCors`); `VARIABLE` elements bind by name via `VariableBinding`, which holds a copy of the owner's value that `services/variables.ts` updates and broadcasts. Keep `docs/public-api.md` in sync with the routes; design in `docs/variables.md`.
- **Icons:** `ICON` elements store only `{ library, name }` (`Icon` model; `lib/icons.ts` validates, `routes/elements.ts` patches it as content). The drawings come from the `@iconify-json/*` packages (lucide, ph, tabler, pixelarticons), loaded lazily per library as separate chunks by `src/lib/icons.ts`; `IconPicker.tsx` browses them. Add a library by installing its `@iconify-json/<set>` package and adding it to both `lib/icons.ts` and `src/lib/icons.ts` (plus `IconLibrary` in `src/lib/types.ts`). Libraries that draw one icon in several styles (Phosphor weights, Tabler filled) list them as `variants` named by suffix.
- **Docker:** the production stage copies the whole builder tree (`COPY --from=builder /app ./`); never turn it into a per-directory allowlist. The CI `docker` job smoke-tests the built image. The base image tracks `oven/bun:1` unpinned.
