// src/lib/utils.js

export function getLinkKey(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.href;
  } catch {
    return String(url || "");
  }
}

export function getUniqueTabs(tabs) {
  const seen = new Set();
  return tabs.filter((tab) => {
    const key = getLinkKey(tab.url);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}


export async function getCurrentTabs() {
  const tabs = await chrome.tabs.query({ currentWindow: true });

  console.log(tabs.map(tab => ({
    title: tab.title,
    favicon: tab.favIconUrl
  })));

  return tabs
    .filter(
      (tab) =>
        tab.url &&
        !tab.url.startsWith("chrome://") &&
        !tab.url.startsWith("chrome-extension://")
    )
    .map((tab) => ({
      url: tab.url,
      title: tab.title || "",
      favicon: tab.favIconUrl || "",
    }));
}

export function formatDate(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function getFaviconUrl(pageUrl) {
  if (!pageUrl) return "";
  const faviconUrl = new URL(chrome.runtime.getURL("/_favicon/"));
  faviconUrl.searchParams.set("pageUrl", pageUrl);
  faviconUrl.searchParams.set("size", "32");
  return faviconUrl.toString();
}

function escapeCsvValue(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export function exportWorkspacesToCsv(sessions) {
  const header = [
    "Workspace Name",
    "Workspace Tags",
    "Workspace Note",
    "Workspace Created At",
    "Workspace Last Opened At",
    "Link Title",
    "Link URL",
    "Link Tags",
    "Link Last Opened At"
  ];
  const rows = [header];

  sessions.forEach((session) => {
    const wsTags = Array.isArray(session.tags) ? session.tags.join(", ") : (session.tags || "");
    const workspaceColumns = [session.title || "", wsTags, session.note || "", session.createdAt || "", session.lastOpenedAt || ""];
    const tabs = Array.isArray(session.tabs) ? session.tabs : [];
    if (!tabs.length) {
      rows.push([...workspaceColumns, "", "", "", ""]);
      return;
    }
    tabs.forEach((tab) => {
      const tabTags = Array.isArray(tab.tags) ? tab.tags.join(", ") : (tab.tags || "");
      rows.push([...workspaceColumns, tab.title || "", tab.url || "", tabTags, tab.lastVisitedAt || ""]);
    });
  });

  const csv = "\uFEFF" + rows.map((row) => row.map(escapeCsvValue).join(",")).join("\r\n");
  const blobUrl = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  const exportDate = new Date().toISOString().slice(0, 10);
  link.href = blobUrl;
  link.download = `tab-workspaces-${exportDate}.csv`;
  link.click();
  URL.revokeObjectURL(blobUrl);
}

export function sortSessions(sessions, sortKey) {
  const list = [...sessions];
  const compareNames = (a, b) => String(a.title || "").localeCompare(String(b.title || ""), undefined, { sensitivity: "base" });

  switch (sortKey) {
    case "manual":
      return list.sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || compareNames(a, b));
    case "opened-desc":
      return list.sort((a, b) => (Date.parse(b.lastOpenedAt) || 0) - (Date.parse(a.lastOpenedAt) || 0) || compareNames(a, b));
    case "name-asc":
      return list.sort(compareNames);
    case "created-desc":
    default:
      return list.sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0) || compareNames(a, b));
  }
}

export function workspaceMatchesSearch(session, term) {
  const tagsText = Array.isArray(session.tags) ? session.tags.join(" ") : (session.tags || "");
  const workspaceText = [session.title, session.note, tagsText].filter(Boolean).join(" ").toLowerCase();
  const linkText = (session.tabs || []).map((t) => {
    const linkTags = Array.isArray(t.tags) ? t.tags.join(" ") : (t.tags || "");
    return `${t.title || ""} ${t.url || ""} ${t.note || ""} ${linkTags}`;
  }).join(" ").toLowerCase();
  return workspaceText.includes(term) || linkText.includes(term);
}
