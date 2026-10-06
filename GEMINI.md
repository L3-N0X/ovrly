# GEMINI.md

## Project Overview

This project is a web-based overlay editor for live streaming. It allows users to create, customize, and manage overlays with various elements like titles and counters. The application is built with a modern tech stack, featuring a React frontend with TypeScript and a Bun-based backend. It uses Prisma as the ORM for database interactions and `better-auth` for handling user authentication, specifically with Twitch.

### Key Technologies:

*   **Frontend:** React, TypeScript, Vite, Tailwind CSS
*   **Backend:** Bun (`Bun.serve`, no HTTP framework — routes are plain handler functions in `routes/`)
*   **Database:** Prisma (with SQLite)
*   **Authentication:** `better-auth` (with Twitch)

### Architecture:

The project is structured as a monorepo with a frontend and a backend.

*   The **frontend** is a React application built with Vite. It's responsible for the user interface, allowing users to design and interact with their overlays.
*   The **backend** is a Bun HTTP server that provides a RESTful API for the frontend. It handles data persistence, user authentication, and real-time updates using WebSockets.
*   The **database** schema is defined using Prisma and includes tables for users, overlays, elements, and shares (who has access to what).

## Building and Running

### Prerequisites:

*   Bun

### Development:

To run the project in development mode, use the following command:

```bash
bun install
bun run dev
```

This will start the Vite development server for the frontend and the Bun server for the backend concurrently. The frontend will be available at `http://localhost:5173`, and the backend will be at `http://localhost:3000`.

### Building:

To build the project for production, use the following command:

```bash
bun run build
```

This will create a `dist` directory with the optimized and minified frontend assets.

### Linting:

To lint the codebase, use the following command:

```bash
bun run lint
```

## Development Conventions

*   **Coding Style:** The project uses ESLint to enforce a consistent coding style. The configuration can be found in `eslint.config.js`.
*   **Testing:** There are no testing practices evident in the project.
*   **Commits:** There are no commit conventions evident in the project.
*   **TS Config:** Verbatim TS is used, we need to import types with `import type {}` syntax to avoid runtime imports.
*   **Backend Type Coverage:** `bun run typecheck` runs `tsc -b` across three projects: `tsconfig.app.json` (frontend `src`), `tsconfig.node.json` (`vite.config.ts`), and `tsconfig.server.json` (backend: `server.ts`, `auth.ts`, `routes/`, `middleware/`, `lib/`, `services/`, `types/`). All three are referenced from `tsconfig.json`, so `bun run build` typechecks the backend too. `src/generated` is excluded because the Prisma client is machine-written and ships `@ts-nocheck`.
*   **Prisma 7 (Rust-free client):** the client is generated to `src/generated/prisma` from the `prisma-client` generator (an `output` path is now mandatory). Import types and `PrismaClient` from `../src/generated/prisma/client`, **not** from `@prisma/client`. Backend code uses relative imports (not the `@/` alias), which is only mapped for the frontend.
*   **Prisma Connection:** every `new PrismaClient()` needs a driver adapter — `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })` in `auth.ts`. A single shared client is exported from `auth.ts`; do not construct extra clients (that was the old `routes/files.ts` behaviour, now removed).
*   **Prisma Config:** connection URLs moved out of `schema.prisma` into `prisma.config.ts`. That config only sets `datasource` when `DATABASE_URL` is present, so `prisma generate` still works offline/CI while `prisma migrate` fails with a clear error when it is missing. Env vars are no longer auto-loaded by the CLI, hence the `dotenv/config` import there.
*   **Prisma Client Generation:** no longer automatic in Prisma 7. A `postinstall` hook (`scripts/postinstall.ts`) runs `prisma generate`, skipping gracefully when the schema is absent (the Docker dependency layer installs before the schema is copied).
*   **Vite 8 (Rolldown):** builds use Rolldown/Oxc instead of esbuild/Rollup, so `build.rollupOptions` is now `build.rolldownOptions` and CSS minification uses Lightning CSS. Vite configs must use `import.meta.dirname` instead of `__dirname`.
*   **react-window 2:** `FixedSizeList` is gone. Use `<List rowComponent={Row} rowCount rowHeight rowProps style={{ height, width }} />`; the row receives `index`, `style`, and the values from `rowProps`. Height and width live in `style`, not as top-level props.
*   **Drag and drop 4:** `@atlaskit/pragmatic-drag-and-drop/element/preserve-offset-on-source` moved to `@atlaskit/pragmatic-drag-and-drop/utils/preserve-offset-on-source`. Other APIs (`combine`, `draggable`, `dropTargetForElements`, `setCustomNativeDragPreview`, hitbox `attachClosestEdge`/`extractClosestEdge`) are unchanged from 1.x.
*   **ESLint 10 + react-hooks 7:** flat config presets moved under `configs.flat` (`reactHooks.configs.flat.recommended`). `react-hooks/set-state-in-effect` is downgraded to a warning in `eslint.config.js` because the codebase intentionally fetches on mount; revisit when the data layer moves to a query library.
*   **Sharing and roles:** `OverlayShare` grants access to one overlay, `AccountShare` to every overlay of its owner (the Settings page's "team"). Each carries a `ShareRole`: `VIEWER` (watch), `CONTROLLER` (change content: counter values, timers, titles, images, bingo fields and marks) or `EDITOR` (also design: elements, styles, layout). Someone with both kinds of share gets the higher role. Only the owner shares and deletes. Routes check access with `requireOverlayRole` from `middleware/authMiddleware.ts`; `PATCH /api/elements/:id` decides between controller and editor from the fields it is sent. Role helpers live in `lib/sharing.ts`, mirrored client side in `src/lib/sharing.ts`. Sharing routes (`routes/sharing.ts`) publish `{ "type": "access" }` on the overlay's WebSocket channel so open editors re-read their role right away.
*   **Docker packaging:** the production stage copies the whole builder tree in one `COPY --from=builder /app ./`. Do **not** turn this back into a per-directory allowlist. An allowlist has to be edited whenever server code is added or moved, and when it is missed the image still builds and only fails at runtime with `Cannot find module` — that is how `lib/` (added for the bingo feature) shipped broken once. New backend directories are picked up automatically.
*   **Docker smoke test:** the `docker` job in `.github/workflows/ci.yml` boots the built image against a throwaway Postgres and waits for an HTTP response. Typechecking cannot catch packaging mistakes (it only sees a full checkout), so this is the check that proves the image actually runs. Run `docker compose up --build` locally to reproduce a deployment.
*   **Base image tag:** the Dockerfile tracks `oven/bun:1`, not a pinned version, so the Bun version in CI and in production can differ between builds.
