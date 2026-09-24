import { useState } from "react";

export function Icon({ name }) {
  const paths = {
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    copy: <><rect x="8" y="8" width="10" height="10" rx="1.5" /><path d="M6 15H5.5A1.5 1.5 0 0 1 4 13.5v-8A1.5 1.5 0 0 1 5.5 4h8A1.5 1.5 0 0 1 15 5.5V6" /></>,
    download: <><path d="M12 4v10M8 10l4 4 4-4M5 19h14" /></>,
    edit: <><path d="m5 16-.8 3.8L8 19l9.8-9.8a2.1 2.1 0 0 0-3-3Z" /><path d="m13.5 7.5 3 3" /></>,
    external: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" /></>,
    moon: <><path d="M20 15.5A8 8 0 0 1 8.5 4 8 8 0 1 0 20 15.5Z" /></>,
    more: <><circle cx="5" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="19" cy="12" r="1" fill="currentColor" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6" /><path d="m15 15 4 4" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
    tabs: <><rect x="3" y="5" width="4" height="4" rx="1" fill="currentColor" /><rect x="10" y="5" width="4" height="4" rx="1" fill="currentColor" /><rect x="17" y="5" width="4" height="4" rx="1" fill="currentColor" /></>,
    trash: <><path d="M5 7h14M10 4h4l1 3H9ZM7 7l1 13h8l1-13M10 10v7M14 10v7" /></>,
    window: <><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M4 9h16M8 7h.01" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><polyline points="12 6 12 12 16 14" /></>,
    tag: <><path d="m20.59 13.41-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></>,
    check: <><polyline points="20 6 9 17 4 12" /></>,
    all: <><path d="M3 3h18v18H3z" /></>,
    allspace: <><path d="M3 3h18v18H3z" /><path d="M7 7h10v10H7z" /></>,
    favorite: <><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></>,
    filleddropdowneuro: <><path d="M12 16l-6-6h12z" /></>,
    unfilleddropdowneuro:  <><polyline points="6 9 12 15 18 9" /></>,
    reminderbell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>,

  };

  return (
    <svg
      className="ui-icon"
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

export function LinkFavicon({ tab, getFaviconUrl }) {
  const [failed, setFailed] = useState(false);
  const source = tab.favicon || (getFaviconUrl ? getFaviconUrl(tab.url) : "");
  const fallback = (tab.title || tab.url || "L").trim().charAt(0).toUpperCase();

  if (!source || failed) {
    return (
      <span className="favicon favicon-fallback" aria-hidden="true">
        {fallback}
      </span>
    );
  }

  return (
    <img
      src={source}
      alt=""
      className="favicon"
      onError={() => setFailed(true)}
    />
  );
}

