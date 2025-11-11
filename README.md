# Ovrly 🎨

**Create custom, dynamic, and shareable overlays for your live streams. For free. Forever.**

Ovrly is a free and open-source web application that allows you to create highly customizable and versatile overlays for your live streams. Whether you need a simple timer, a subscriber counter, or a complex scene with multiple dynamic elements, Ovrly has you covered.

![Ovrly Logo](public/ovrly.svg)

## ✨ Why use Ovrly?

*   **Free & Open Source:** Self-host Ovrly and have complete control over your data and overlays. It will always be free.
*   **High Customizability:** Tailor every element to your needs. Change colors, fonts, sizes, and positions with an intuitive editor.
*   **Versatile Elements:** Create timers, counters, titles, images, and more. Combine them to build unique overlays.
*   **Real-time Collaboration:** Share your overlays with your broadcast team or moderators. Changes are reflected in real-time.
*   **Twitch Integration:** Secure login with your Twitch account. No extra passwords to remember.
*   **OBS Ready:** Easily export your overlays and use them as browser sources in OBS Studio, Streamlabs, or any other broadcasting software. The recommended size is 800x600px.

## 🚀 Project Status: Alpha

Ovrly is currently in an **alpha** state. This means it's under active development, and you might encounter bugs or breaking changes. We appreciate your feedback and contributions to make Ovrly better! The project may be discontinued at any time.

## 📋 Supported Elements

*   **Title:** Display static or dynamic text.
*   **Counter:** Keep track of numbers (e.g., wins, deaths, donations).
*   **Timer:** Count up or down for speedruns, events, or breaks.
*   **Image:** Add logos, sponsors, or any other image to your overlay.
*   **Container:** Group and organize elements within your overlay.

## ⚙️ Getting Started

### Prerequisites

*   [Bun](https://bun.sh/)

### Development

1.  Clone the repository.
2.  Install dependencies:
    ```bash
    bun install
    ```
3.  Create a `.env` file based on the environment variables below.
4.  Run the development server:
    ```bash
    bun run dev
    ```
    This will start the frontend at `http://localhost:5173` and the backend at `http://localhost:3000`.

### Building for Production

```bash
bun run build
```

This will create an optimized production build in the `dist` directory.

## 🐳 Docker Deployment

Ovrly comes with a `docker-compose.yml` file for easy deployment.

1.  Create a `.env` file with the required environment variables (see below).
2.  Run the following command:
    ```bash
    docker-compose up -d
    ```
This will build the application and start the app and a PostgreSQL database. The application will be available at `http://localhost:3000`.

## 🔒 Environment Variables

You need to set the following environment variables in a `.env` file in the root of the project.

| Variable               | Description                                                                 | Example                               |
| ---------------------- | --------------------------------------------------------------------------- | ------------------------------------- |
| `DATABASE_URL`         | The connection string for your database.                                    | `postgresql://user:password@db:5432/ovrly` |
| `AUTH_SECRET`          | A secret key for signing authentication tokens.                             | `a-very-secret-key`                   |
| `AUTH_TWITCH_ID`       | Your Twitch application's Client ID.                                        | `your-twitch-client-id`               |
| `AUTH_TWITCH_SECRET`   | Your Twitch application's Client Secret.                                    | `your-twitch-client-secret`           |

**Note:** For local development with the default SQLite database, you only need `AUTH_SECRET`, `AUTH_TWITCH_ID`, and `AUTH_TWITCH_SECRET`. The `DATABASE_URL` is primarily for the Docker setup with PostgreSQL.

## 📺 Usage in OBS

1.  Create and customize your overlay in the Ovrly web interface.
2.  Click the "Copy URL" button for your overlay.
3.  In OBS, add a new "Browser" source.
4.  Paste the copied URL into the "URL" field.
5.  Set the "Width" to `800` and "Height" to `600`.
6.  Click "OK" and position your new overlay in your scene.

## 🔮 Future Plans

*   More overlay elements and templates.
*   A publicly hosted instance for quick access.
*   Screenshots and better documentation.
*   Improved stability and performance.

## ❤️ Contributing

This project is open source and contributions are welcome. Feel free to open issues or pull requests.