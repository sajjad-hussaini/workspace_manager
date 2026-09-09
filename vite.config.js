import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.config.js";

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  build: {
    rollupOptions: {
      input: {
        fullpage: "src/pages/fullpage/index.html",
        popup: "src/pages/popup/index.html"
      }
    }
  },
  server: {
    // CRXJS ke liye fixed port zaroori hota hai dev/hot-reload ke liye
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173
    }
  }
});
