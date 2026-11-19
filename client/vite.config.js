import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const api = loadEnv(mode, process.cwd(), "").API_PROXY_TARGET || "http://localhost:5000";
  return {
  plugins: [react()],
  server: {
    port: 5173,
    // Listen on the local network too, so a phone on the same Wi-Fi can open it.
    host: true,
    // The API runs on 5000, so the browser only ever talks to one origin
    // in development and the refresh cookie behaves like it will in
    // production.
    proxy: {
      "/api": { target: api, changeOrigin: true },
      "/uploads": { target: api, changeOrigin: true },
      "/socket.io": { target: api, changeOrigin: true, ws: true },
    },
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        // Split the heavy, rarely-changing libraries out of the app bundle.
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          bootstrap: ["react-bootstrap"],
        },
      },
    },
  },
};
});
