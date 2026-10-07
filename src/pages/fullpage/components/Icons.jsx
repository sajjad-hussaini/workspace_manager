import { useEffect, useState } from "react";

export function Icon({ name }) {
  const paths = {
    note: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" /><path d="M14 3v6h6" /></>,
    grip: <>{[5, 12, 19].flatMap((y) => [8, 16].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.5" fill="currentColor" stroke="none" />))}</>,
    move: <><path d="M12 3v18M3 12h18M8 7l4-4 4 4M8 17l4 4 4-4M7 8l-4 4 4 4M17 8l4 4-4 4" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    copy: <><rect x="8" y="8" width="10" height="10" rx="1.5" /><path d="M6 15H5.5A1.5 1.5 0 0 1 4 13.5v-8A1.5 1.5 0 0 1 5.5 4h8A1.5 1.5 0 0 1 15 5.5V6" /></>,
    download: <><path d="M12 4v10M8 10l4 4 4-4M5 19h14" /></>,
    edit: <><path d="m5 16-.8 3.8L8 19l9.8-9.8a2.1 2.1 0 0 0-3-3Z" /><path d="m13.5 7.5 3 3" /></>,
    external: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" /></>,
    moon: <><path d="M20 15.5A8 8 0 0 1 8.5 4 8 8 0 1 0 20 15.5Z" /></>,
    more: <><circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" /><circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m16.5 16.5 4 4" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
    tabs: <><rect x="3" y="5" width="4" height="4" rx="1" fill="currentColor" /><rect x="10" y="5" width="4" height="4" rx="1" fill="currentColor" /><rect x="17" y="5" width="4" height="4" rx="1" fill="currentColor" /></>,
    trash: <><path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" /></>,
    window: <><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M4 9h16M8 7h.01" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><polyline points="12 6 12 12 16 14" /></>,
    archive: <><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" /><path d="M10 12h4" /></>,
    restore: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3 2" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></>,
    tag: <><path d="m20.59 13.41-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></>,
    check: <><polyline points="20 6 9 17 4 12" /></>,
    allspace: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></>,
    favorite: <><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></>,
    "chevron-down": <><polyline points="6 9 12 15 18 9" /></>,
    "chevron-up": <><polyline points="18 15 12 9 6 15" /></>,
    arrowRight: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    reminderbell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>,
  };

  return (
    <svg
      className="ui-icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.plus}
    </svg>
  );
}

export function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3.5 7.5A2.5 2.5 0 0 1 6 5h4l2 2.5h6A2.5 2.5 0 0 1 20.5 10v7.5A2.5 2.5 0 0 1 18 20H6a2.5 2.5 0 0 1-2.5-2.5Z" />
    </svg>
  );
}

const AVATAR_PALETTES = [
  { bg: "#dcfce7", text: "#166534" }, // green (e.g. ChatGPT)
  { bg: "#f3e8ff", text: "#6b21a8" }, // purple (e.g. Perplexity)
  { bg: "#e0f2fe", text: "#0369a1" }, // blue (e.g. Gemini)
  { bg: "#fef3c7", text: "#92400e" }, // amber/yellow (e.g. Notion)
  { bg: "#ffe4e6", text: "#9f1239" }, // rose
  { bg: "#ffedd5", text: "#9a3412" }, // orange
];

function getPaletteForText(str = "") {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[index];
}

export function LinkFavicon({ tab, getFaviconUrl }) {
  const [failedSources, setFailedSources] = useState([]);
  // Chrome's cached icon also works when a site's icon URL requires its session.
  const cachedSource = getFaviconUrl ? getFaviconUrl(tab.url) : "";
  const sources = [...new Set([cachedSource, tab.favicon, tab.favIconUrl].filter(Boolean))];
  const source = sources.find((candidate) => !failedSources.includes(candidate));
  useEffect(() => { setFailedSources([]); }, [cachedSource, tab.url, tab.favicon, tab.favIconUrl]);
  const title = (tab.title || tab.url || "Link").trim();
  const letter = title.charAt(0).toUpperCase();
  const palette = getPaletteForText(tab.url || title);

  if (!source) {
    return (
      <span
        className="link-avatar"
        style={{ backgroundColor: palette.bg, color: palette.text }}
        aria-hidden="true"
      >
        {letter}
      </span>
    );
  }

  return (
    <span className="link-avatar">
      <img
        key={source}
        src={source}
        alt=""
        className="link-avatar-img"
        onError={() => setFailedSources((previous) => [...previous, source])}
      />
    </span>
  );
}
