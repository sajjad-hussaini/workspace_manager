# React Extension Starter (Manifest V3 + Vite + CRXJS)

## Setup

```bash
npm install
```

## Development (hot reload ke sath)

```bash
npm run dev
```

Phir Chrome me:
1. `chrome://extensions` kholo
2. "Developer mode" ON karo (top-right)
3. "Load unpacked" pe click karo
4. Is project ke andar generated `dist` folder select karo

Code me koi bhi change karoge, extension khud reload ho jayega (koi manual reload nahi chahiye).

## Production build

```bash
npm run build
```

Output `dist` folder me milega — yehi folder Chrome Web Store pe upload karne ke liye zip karna hai.

## Structure

```
manifest.config.js        -> Manifest ki config (JSON ki jagah JS, dynamic values allow karta hai)
vite.config.js             -> Vite + CRXJS plugin setup
src/background/index.js    -> Service worker (background script)
src/pages/fullpage/        -> Fullpage UI (React app) - toolbar icon click par khulta hai
  ├── index.html
  ├── main.jsx              -> React entry point
  ├── App.jsx                -> Main component (demo: save/list/restore tabs)
  └── App.css
src/lib/storage.js         -> chrome.storage.sync + local fallback helper
```

## Naya page (jaise popup) add karna ho to:

1. `src/pages/popup/` folder banao (index.html + main.jsx + App.jsx isi tarah)
2. `manifest.config.js` me `action.default_popup: "src/pages/popup/index.html"` add karo
