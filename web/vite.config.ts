import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Use the Docker service name if running in Docker, otherwise fallback to localhost
const apiTarget = process.env.VITE_API_PROXY || "http://localhost:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0", // Ensures Vite listens to all interfaces inside the container
    port: 5173,
    proxy: Object.fromEntries(
      ["/orders", "/menu", "/staff", "/devices", "/payments", "/health", "/reports"].map(
        (p) => [p, { target: apiTarget, changeOrigin: true }],
      ),
    ),
  },
});