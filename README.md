# React Extension Starter (Manifest V3 + Vite + CRXJS)

## Setup

```bash
npm install
```

## Development (with hot reload)

```bash
npm run dev
```

Then open Chrome and do the following:
1. Go to `chrome://extensions`
2. Turn on "Developer mode" in the top-right corner
3. Click "Load unpacked"
4. Select the generated `dist` folder inside this project

Any code changes you make will automatically reload the extension without needing a manual reload.

## Production build

```bash
npm run build
```

The output will be generated in the `dist` folder. This is the folder you should zip before uploading to the Chrome Web Store.

## Google Drive sync

TabMorrow can save workspaces, archived items, links, notes, reminders, and preferences in Google Drive's private `appDataFolder`. A local copy remains available when offline. Existing local workspaces are merged into Drive on the first connection. Changes sync automatically while connected; Settings → Data & Backup shows the last successful sync or an error and offers **Sync now**.

Google OAuth requires a client ID for this extension ID:

1. Build and load the unpacked extension, then copy its ID from `chrome://extensions`. Keep the same extension ID for subsequent builds.
2. In Google Cloud Console, enable the Google Drive API and configure the OAuth consent screen. Add your Google account as a test user if the app is in testing mode.
3. Create an OAuth client of type **Chrome Extension** using the extension ID from step 1.
4. Create `.env.local` in the project root with `GOOGLE_OAUTH_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com`, then rebuild and reload the extension. No client secret is used in the extension.
5. Open **Settings → Data & Backup → Connect Google Drive** and sign in.

Without a configured OAuth client ID, the extension keeps using its existing Chrome storage and the Connect button stays disabled. Google Drive's app-data folder is hidden from the normal Drive file list; use **Download Backup** if you want a visible JSON copy. Stopping sync leaves both the local copy and the existing Drive data intact.

## Project structure

```
manifest.config.js        -> Manifest configuration (JS instead of JSON, supports dynamic values)
vite.config.js             -> Vite + CRXJS plugin setup
src/background/index.js    -> Service worker (background script)
src/pages/fullpage/        -> Full-page UI (React app) opened when the toolbar icon is clicked
  ├── index.html
  ├── main.jsx              -> React entry point
  ├── App.jsx                -> Main component (demo: save/list/restore tabs)
  └── App.css
src/lib/storage.js         -> chrome.storage.sync + local fallback helper
```

## Adding a new page (for example, a popup)

1. Create a new folder such as `src/pages/popup/` with files like `index.html`, `main.jsx`, and `App.jsx`
2. Add the following in `manifest.config.js`:

```js
action.default_popup: "src/pages/popup/index.html"
```

This will make the page open as the browser action popup.
