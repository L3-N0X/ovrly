import fs from "node:fs";
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  envPrefix: "VITE_",
  resolve: {
    alias: [
      {
        find: "@",
        replacement: path.resolve(import.meta.dirname, "./src"),
      },
    ],
  },
  server: {
    // Spotify requires the loopback IP literal in its OAuth redirect URI. Vite's
    // default "localhost" bind resolves to IPv6 on this machine, so 127.0.0.1
    // otherwise refuses the connection.
    host: "127.0.0.1",
    https: {
      cert: fs.readFileSync(path.resolve(import.meta.dirname, ".certs/127.0.0.1.pem")),
      key: fs.readFileSync(path.resolve(import.meta.dirname, ".certs/127.0.0.1-key.pem")),
    },
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      // Uploaded images are served by the backend out of S3.
      "/uploads": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:3000",
        ws: true,
      },
    },
  },
});
