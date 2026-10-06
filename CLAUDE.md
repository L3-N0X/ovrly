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

Web-based overlay editor for live streaming: users build overlays from elements (titles, counters, timers, images, bingo, groups) and share them with others by Twitch name.

- **Frontend:** React, TypeScript, Vite 8, Tailwind CSS (`src/`).
- **Backend:** Bun `Bun.serve` with plain handler functions in `routes/`, WebSockets for live updates (`server.ts`, `auth.ts`, `routes/`, `middleware/`, `lib/`, `services/`, `types/`).
- **Database:** Prisma 7 with PostgreSQL; **auth:** `better-auth` (Twitch).

### Commands

- `bun install`, then `bun run dev` (frontend `http://localhost:5173`, backend `http://localhost:3000`)
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
- **Docker:** the production stage copies the whole builder tree (`COPY --from=builder /app ./`); never turn it into a per-directory allowlist. The CI `docker` job smoke-tests the built image. The base image tracks `oven/bun:1` unpinned.
