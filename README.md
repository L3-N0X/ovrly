# Ovrly 🎨

**Create custom, dynamic, and shareable overlays for your live streams.**

Ovrly is a free and open-source web application that allows you to create highly customizable and versatile overlays for your live streams. Whether you need a simple timer, death counter, just text, or a complex scene with multiple dynamic elements, Ovrly has you covered.

![Ovrly Logo](public/ovrly.svg)

## ✨ Why use Ovrly?

* **Free & Open Source:** Self-host Ovrly and have complete control over your data and overlays.
* **High Customizability:** Tailor every element to your needs. Change colors, fonts, sizes, and positions with an intuitive editor.
* **Versatile Elements:** Create timers, countdowns, counters, titles, images, live Twitch stats, and more. Combine them to build unique overlays.
* **Real-time Collaboration:** Share your overlays with your broadcast team or moderators. Changes are reflected in real-time.
* **Twitch Integration:** Secure login with your Twitch account. No extra passwords to remember.
* **OBS Ready:** Easily export your overlays and use them as browser sources in OBS Studio, Streamlabs, or any other broadcasting software. Every overlay has its own canvas size (1920x1080 by default), set in the editor.

> [!IMPORTANT]  
> Ovrly is currently in an **alpha** state. This means it's under active development, and you might encounter bugs or breaking changes. We appreciate your feedback and contributions to make Ovrly better!

## 📋 Currently Supported Elements

All Elements are editable to change their content.

* **Title:** A simple Textbox.
* **Counter:** Keep track of numbers (e.g., wins, deaths, donations).
* **Timer:** Count up for speedruns, events, or breaks.
* **Countdown:** Count down from a set time, or to a date and time (e.g. your stream start).
* **Twitch Stat:** Followers, viewers, subscribers or sub points of any Twitch channel, updated live (about every 30 seconds while the overlay is open). Followers and viewers work for every channel; subscriber numbers are private on Twitch, so the channel has to be connected once under Settings → Twitch by someone who can sign in as it. They are then shown in the overlays of whoever connected it and of their team.
* **Image:** Add player photos, logos, or more.
* **Bingo:** A card of 1 to 10 rows and columns. Mark cells on the canvas or in the controls as the game is called, with an optional free middle, a shuffle button, grid lines and a background image.
* **Container:** Group and organize elements within your overlay, lining them up in a row or column.
* **Group:** An area whose elements are placed freely by dragging them, like the canvas itself.

## 📺 Usage in OBS

1. Create and customize your overlay in the Ovrly web interface.
2. Select the canvas to see its size, and change it if you like (see *The canvas* below).
3. Click the "Copy for OBS" button for your overlay.
4. In OBS, add a new "Browser" source.
5. Paste the copied URL into the "URL" field.
6. Set the "Width" and "Height" to the canvas size shown in the Ovrly canvas panel.
7. Click "OK" and position your new overlay in your scene.

## 🖼️ The canvas

Every overlay is drawn on a canvas, which is sized per overlay (1920×1080 for new ones) and
is also the group its elements live in. Select the canvas in the editor — click the empty
canvas, the frame label or the "Canvas" row — to change it:

* **Size** is what OBS is set to. Pick a preset (1080p, 720p, 1440p, 4K, vertical, the old
  800×600) or type any width and height.
* **Placement** decides how the elements directly on the canvas are positioned. *Auto layout*
  arranges them in a row or column, with the gap, padding and alignment from the layout
  settings. *Free placement* lets you drag every one of them to where you want it with the
  move tool (M), arrows nudge them, and they may stick out past the canvas edges.

Containers and groups still work inside either mode, for arranging a few elements while
everything else is placed freely.

## 🔮 Future Plans

* More overlay elements and templates.
* A publicly hosted instance for everyone to use.
* Screenshots and better documentation.

## 🐳 Docker Deployment

Ovrly comes with a `docker-compose.yml` file for easy deployment.

1. Create a `.env` file with the required environment variables (see below).
2. Run the following command:

    ```bash
    docker-compose up -d
    ```

This will build the application and start the app, a PostgreSQL database and a small S3-compatible object store ([RustFS](https://github.com/rustfs/rustfs)) that holds uploaded images. The application will be available at `http://localhost:3000`.

### 🖼️ Image storage (S3)

Uploaded images are stored in any S3-compatible service and served through the app itself (`/uploads/...`), so the storage service never has to be publicly reachable. The compose file bundles RustFS; to use something else (MinIO, Garage, SeaweedFS, AWS S3, Cloudflare R2, ...) remove the `s3` and `s3-init` services and point the `S3_*` variables at it. The bucket must already exist.

### 🔌 Reverse proxy

Live updates use a WebSocket on `/ws`, so your proxy has to forward upgrade requests. For nginx:

```nginx
location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
}
```

The server sends a heartbeat every 20 seconds and clients reconnect automatically, so the default 60 second `proxy_read_timeout` is fine.

## 🔒 Environment Variables

You need to set the following environment variables in a `.env` file in the root of the project.

| Variable               | Description                                                                 | Example                               |
| ---------------------- | --------------------------------------------------------------------------- | ------------------------------------- |
| `APP_BASE_URL`        | The base URL where your Ovrly instance will be accessible.                  | `http://localhost:3000`               |
| `DATABASE_URL`         | The connection string for your database.                                    | `postgresql://user:password@db:5432/ovrly` |
| `AUTH_SECRET`          | A secret key for signing authentication tokens.                             | `a-very-secret-key`                   |
| `AUTH_TWITCH_ID`       | Your Twitch application's Client ID.                                        | `your-twitch-client-id`               |
| `AUTH_TWITCH_SECRET`   | Your Twitch application's Client Secret.                                    | `your-twitch-client-secret`           |
| `S3_ENDPOINT`          | Endpoint of your S3-compatible storage (path-style addressing is used).     | `http://s3:9000`                      |
| `S3_BUCKET`            | Bucket for uploaded images. It must already exist.                          | `ovrly`                               |
| `S3_ACCESS_KEY_ID`     | Access key for the bucket.                                                  | `ovrly`                               |
| `S3_SECRET_ACCESS_KEY` | Secret key for the bucket.                                                  | `change-me-please`                    |
| `S3_REGION`            | Optional. Region used for request signing.                                  | `us-east-1` (default)                 |
| `MAX_UPLOAD_BYTES`     | Optional. Maximum image size in bytes.                                      | `10485760` (default, 10 MB)           |
| `WS_ALLOWED_ORIGINS`   | Optional. Extra comma-separated origins allowed to open the live-update WebSocket (`APP_BASE_URL` is always allowed). | `https://overlays.example.com` |
| `VITE_GOOGLE_FONTS_API_KEY` | Google Fonts API key used by the in-app font picker (optional).        | `your-google-fonts-api-key`           |

> [!NOTE]
> Twitch stats use the same Twitch application as the sign-in. For subscriber stats, add
> `<APP_BASE_URL>/api/twitch/callback` to the application's **OAuth Redirect URLs** in the
> [Twitch developer console](https://dev.twitch.tv/console/apps), next to the sign-in callback
> `<APP_BASE_URL>/api/auth/callback/twitch`.

> [!NOTE]
> The Google Fonts API key is compiled into the frontend bundle at build time.
> Without it the app still runs, but the font picker shows only the bundled
> Minecraft fonts and logs `Google Fonts API key is not configured`.

## ⚙️ Getting Started

### Prerequisites

* [Bun](https://bun.sh/)

### Development

1. Clone the repository.
2. Install dependencies:

    ```bash
    bun install
    ```

    This also generates the Prisma client into `src/generated/prisma`
    (git-ignored). Prisma 7 no longer does this automatically, so a
    `postinstall` hook runs `prisma generate` for you.

3. Create a `.env` file based on the environment variables below.
4. Run the development server:

    ```bash
    bun run dev
    ```

    This will start the frontend at `http://localhost:5173` and the backend at
    `http://localhost:3000`. The backend hot reloads: save any backend file and it
    is restarted automatically, and a change to `prisma/schema.prisma` regenerates
    the Prisma client before the restart.

5. Apply database migrations:

    ```bash
    bunx prisma migrate deploy
    ```

    The generated client is not committed to the repository. It is regenerated on
    install and whenever `prisma/schema.prisma` changes in dev, but migrations
    themselves are yours to apply.

### Type Checking

```bash
bun run typecheck
```

This checks the frontend, the Vite config, and the backend (`server.ts`,
`routes/`, `middleware/`, `lib/`, `services/`, `types/`). The backend is covered
by `tsconfig.server.json`; the generated Prisma client in `src/generated` is
excluded because it is machine-written.

### Building for Production

```bash
bun run build
```

This will create an optimized production build in the `dist` directory.

## 📚 Further Documentation

* [Bingo element](docs/bingo.md) — data model, API and rendering behaviour.

## ❤️ Contributing

This project is open source and contributions are welcome. Feel free to open issues or pull requests.
