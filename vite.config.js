import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import createManifest from "./manifest.config.js";

export default defineConfig(({ mode }) => ({
  plugins: [react(), crx({ manifest: createManifest(loadEnv(mode, process.cwd(), "GOOGLE_").GOOGLE_OAUTH_CLIENT_ID) })],
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
}));
