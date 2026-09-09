import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json";

export default defineManifest({
  manifest_version: 3,
  name: "Workspace Saver",
  version: pkg.version,
  description: "Save open tabs as organized workspaces and reopen them whenever you need them.",
  permissions: ["tabs", "storage", "windows"],
  action: {
    default_title: "Workspace Saver",
    default_popup: "src/pages/popup/index.html"
  },
  background: {
    service_worker: "src/background/index.js",
    type: "module"
  },
  icons: {
    16: "public/icons/icon16.jpeg",
    48: "public/icons/icon48.jpeg",
    128: "public/icons/icon128.jpeg"
  },
  web_accessible_resources: [
    {
      resources: ["src/pages/fullpage/index.html"],
      matches: ["<all_urls>"]
    }
  ]
});
