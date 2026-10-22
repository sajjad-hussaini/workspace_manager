import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json";

export default function createManifest(googleClientId = "") {
  return defineManifest({
  manifest_version: 3,
  name: "TabMorrow",
  version: pkg.version,
  description: "Save open tabs as organized workspaces and reopen them whenever you need them.",
  permissions: ["tabs", "storage", "windows", "favicon", "identity", "alarms", "unlimitedStorage"],
  host_permissions: ["https://www.googleapis.com/*"],
  ...(googleClientId ? { oauth2: { client_id: googleClientId, scopes: ["https://www.googleapis.com/auth/drive.appdata"] } } : {}),
  action: {
    default_title: "TabMorrow",
    default_popup: "src/pages/popup/index.html",
    default_icon: {
      16: "public/icons/tabicon-16.png",
      32: "public/icons/tabicon-32.png",
      48: "public/icons/tabicon-48.png",
      128: "public/icons/tabicon-128.png"
    }
  },
  background: {
    service_worker: "src/background/index.js",
    type: "module"
  },
  icons: {
    16: "public/icons/tabicon-16.png",
    32: "public/icons/tabicon-32.png",
    48: "public/icons/tabicon-48.png",
    128: "public/icons/tabicon-128.png"
  },
  web_accessible_resources: [
    {
      resources: ["src/pages/fullpage/index.html"],
      matches: ["<all_urls>"]
    }
  ]
  });
}
