import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // The API runs on 5000, so the browser only ever talks to one origin
    // in development and the refresh cookie behaves like it will in
    // production.
    proxy: {
      "/api": { target: "http://localhost:5000", changeOrigin: true },
      "/uploads": { target: "http://localhost:5000", changeOrigin: true },
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
});
