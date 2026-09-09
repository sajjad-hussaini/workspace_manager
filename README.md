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
