# GEMINI.md

## Project Overview

This project is a web-based overlay editor for live streaming. It allows users to create, customize, and manage overlays with various elements like titles and counters. The application is built with a modern tech stack, featuring a React frontend with TypeScript and a Bun-based backend. It uses Prisma as the ORM for database interactions and `better-auth` for handling user authentication, specifically with Twitch.

### Key Technologies:

*   **Frontend:** React, TypeScript, Vite, Tailwind CSS
*   **Backend:** Bun, Hono
*   **Database:** Prisma (with SQLite)
*   **Authentication:** `better-auth` (with Twitch)

### Architecture:

The project is structured as a monorepo with a frontend and a backend.

*   The **frontend** is a React application built with Vite. It's responsible for the user interface, allowing users to design and interact with their overlays.
*   The **backend** is a Bun server that provides a RESTful API for the frontend. It handles data persistence, user authentication, and real-time updates using WebSockets.
*   The **database** schema is defined using Prisma and includes tables for users, overlays, elements, and editors.

## Building and Running

### Prerequisites:

*   Bun
*   Node.js and npm (for `concurrently`)

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
