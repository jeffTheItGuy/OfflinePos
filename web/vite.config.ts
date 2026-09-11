import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev we proxy the API paths to the FastAPI backend on :8000.
// In production, Caddy routes the same paths to api:8000 directly,
// so no VITE_API_URL is needed — the SPA always talks to its own origin.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: Object.fromEntries(
      ["/orders", "/menu", "/staff", "/devices", "/payments", "/health"].map(
        (p) => [p, { target: "http://localhost:8000", changeOrigin: true }],
      ),
    ),
  },
});
