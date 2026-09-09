import { useEffect, useState, useCallback } from "react";
import { getSessions, persistSession, onSessionsChanged, getTheme, persistTheme } from "../../lib/storage";
import { getCurrentTabs, getUniqueTabs, getLinkKey, sortSessions } from "../../lib/utils";

export default function App() {
  const [sessions, setSessions] = useState([]); const [loading, setLoading] = useState(true);
  const [tabCount, setTabCount] = useState(0); const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false); const [notice, setNotice] = useState(""); const [theme, setTheme] = useState("dark");
  const refresh = useCallback(async () => { setSessions(sortSessions(await getSessions(), "created-desc")); setLoading(false); }, []);
  useEffect(() => { refresh(); getTheme().then(setTheme); chrome.tabs.query({ currentWindow: true }).then((tabs) => setTabCount(tabs.length)); return onSessionsChanged(refresh); }, [refresh]);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(""), 2600); return () => clearTimeout(timer); }, [notice]);

  async function handleSave() {
    const trimmedTitle = title.trim(); if (!trimmedTitle) return setNotice("Enter a workspace name first."); setSaving(true);
    try {
      const tabs = await getCurrentTabs(); if (!tabs.length) return setNotice("No valid tabs were found in this window.");
      const uniqueTabs = getUniqueTabs(tabs); const existing = sessions.find((session) => session.title?.trim().toLowerCase() === trimmedTitle.toLowerCase());
      if (existing) { const keys = new Set((existing.tabs || []).map((tab) => getLinkKey(tab.url))); const newTabs = uniqueTabs.filter((tab) => !keys.has(getLinkKey(tab.url))); await persistSession({ ...existing, tabs: [...(existing.tabs || []), ...newTabs] }); setNotice(newTabs.length ? `${newTabs.length} link${newTabs.length === 1 ? "" : "s"} added to ${existing.title}.` : "All current links are already saved."); }
      else { await persistSession({ id: `sess_${Date.now()}`, title: trimmedTitle, note: "", reminderAt: "", tabs: uniqueTabs, createdAt: new Date().toISOString() }); setNotice(`${uniqueTabs.length} link${uniqueTabs.length === 1 ? "" : "s"} saved to your workspace.`); }
      setTitle(""); await refresh();
    } finally { setSaving(false); }
  }
  async function handleOpen(session) { const urls = session.tabs?.map((tab) => tab.url).filter(Boolean) || []; if (!urls.length) return setNotice("This workspace has no links."); await chrome.windows.create({ url: urls, focused: true }); }
  function openFullManager() { chrome.tabs.create({ url: chrome.runtime.getURL("src/pages/fullpage/index.html") }); window.close(); }
  async function toggleTheme() { const nextTheme = theme === "dark" ? "light" : "dark"; setTheme(nextTheme); await persistTheme(nextTheme); }

  return <div className="popup">
    <header className="popup-header"><div><h1>Workspace Saver</h1><p className="popup-subtitle">{tabCount} open tab{tabCount === 1 ? "" : "s"} in this window</p></div><button className="theme-toggle" onClick={toggleTheme} type="button" aria-label="Toggle color theme" title="Toggle color theme">{theme === "dark" ? "☀" : "☾"}</button></header>
    <div className="popup-save-row"><input className="input" placeholder="Workspace name" value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => event.key === "Enter" && handleSave()} autoFocus /><button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</button></div>
    {notice && <div className="popup-notice" role="status">{notice}</div>}
    <div className="popup-list">{loading && <div className="popup-empty">Loading...</div>}{!loading && sessions.length === 0 && <div className="popup-empty">No saved workspaces yet.</div>}{sessions.slice(0, 8).map((session) => <button className="popup-row" key={session.id} onClick={() => handleOpen(session)} type="button"><span className="popup-row-dot" data-area={session.storageArea} aria-hidden="true" /><span className="popup-row-text"><span className="popup-row-title">{session.title}</span><span className="popup-row-meta">{session.tabs?.length || 0} tabs</span></span><span className="popup-row-open">Open</span></button>)}</div>
    <button className="popup-footer" onClick={openFullManager} type="button">Open full manager →</button>
  </div>;
}
