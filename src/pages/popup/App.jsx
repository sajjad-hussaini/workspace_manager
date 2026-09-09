import { useEffect, useState, useCallback, useMemo } from "react";
import { getSessions, persistSession, deleteSessionStorage, onSessionsChanged, getTheme, persistTheme } from "../../lib/storage";
import {
  getCurrentTabs,
  getUniqueTabs,
  getLinkKey,
  sortSessions,
  getFaviconUrl,
  formatDate,
  exportWorkspacesToCsv,
  workspaceMatchesSearch
} from "../../lib/utils";

export default function App() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tabCount, setTabCount] = useState(0);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [reminderAt, setReminderAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [sortKey, setSortKey] = useState("created-desc");
  const [selectedByWorkspace, setSelectedByWorkspace] = useState(() => new Map());
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [notice, setNotice] = useState("");
  const [theme, setTheme] = useState("light");

  const refresh = useCallback(async () => {
    const data = await getSessions();
    setSessions(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    getTheme().then(setTheme);
    chrome.tabs.query({ currentWindow: true }).then((tabs) => setTabCount(tabs.length));
    const unsubscribe = onSessionsChanged(refresh);
    return unsubscribe;
  }, [refresh]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 2600);
    return () => clearTimeout(timer);
  }, [notice]);

  const dueReminders = useMemo(() => {
    const now = Date.now();
    return sessions
      .filter((session) => session.reminderAt && Date.parse(session.reminderAt) <= now)
      .sort((a, b) => Date.parse(b.reminderAt) - Date.parse(a.reminderAt))
      .slice(0, 2);
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    const term = searchInput.trim().toLowerCase();
    const base = term.length >= 3 ? sessions.filter((session) => workspaceMatchesSearch(session, term)) : sessions;
    return sortSessions(base, sortKey);
  }, [sessions, searchInput, sortKey]);

  async function handleSave() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setNotice("Enter a workspace name first.");
      return;
    }

    setSaving(true);

    try {
      const tabs = await getCurrentTabs();
      if (!tabs.length) {
        setNotice("No valid tabs were found in this window.");
        return;
      }

      const reminderIso = reminderAt ? new Date(reminderAt).toISOString() : "";
      const uniqueTabs = getUniqueTabs(tabs);
      const existing = sessions.find((session) => session.title?.trim().toLowerCase() === trimmedTitle.toLowerCase());

      if (existing) {
        const existingKeys = new Set((existing.tabs || []).map((tab) => getLinkKey(tab.url)));
        const newTabs = uniqueTabs.filter((tab) => !existingKeys.has(getLinkKey(tab.url)));
        await persistSession({
          ...existing,
          note: note.trim() || existing.note,
          reminderAt: reminderIso || existing.reminderAt,
          tabs: [...(existing.tabs || []), ...newTabs]
        });
        setNotice(newTabs.length ? `${newTabs.length} link${newTabs.length === 1 ? "" : "s"} added to ${existing.title}.` : "All current links are already saved.");
      } else {
        await persistSession({
          id: `sess_${Date.now()}`,
          title: trimmedTitle,
          note: note.trim(),
          reminderAt: reminderIso,
          tabs: uniqueTabs,
          createdAt: new Date().toISOString()
        });
        setNotice(`${uniqueTabs.length} link${uniqueTabs.length === 1 ? "" : "s"} saved to your workspace.`);
      }

      setTitle("");
      setNote("");
      setReminderAt("");
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleOpenWorkspace(session) {
    const urls = session.tabs?.map((tab) => tab.url).filter(Boolean) || [];
    if (!urls.length) {
      setNotice("This workspace has no links.");
      return;
    }

    await chrome.windows.create({ url: urls, focused: true });
  }

  async function handleOpenAll(session) {
    const urls = session.tabs?.map((tab) => tab.url).filter(Boolean) || [];
    if (!urls.length) {
      setNotice("This workspace has no links.");
      return;
    }

    const openedAt = new Date().toISOString();
    const updatedTabs = (session.tabs || []).map((tab, index) => (
      index >= 0 ? { ...tab, lastVisitedAt: openedAt } : tab
    ));
    await persistSession({ ...session, tabs: updatedTabs, lastOpenedAt: openedAt });
    for (const url of urls) {
      await chrome.tabs.create({ url, active: false });
    }
    await refresh();
  }

  async function handleOpenNewWindow(session) {
    const urls = session.tabs?.map((tab) => tab.url).filter(Boolean) || [];
    if (!urls.length) {
      setNotice("This workspace has no links.");
      return;
    }

    const openedAt = new Date().toISOString();
    const updatedTabs = (session.tabs || []).map((tab) => ({ ...tab, lastVisitedAt: openedAt }));
    await persistSession({ ...session, tabs: updatedTabs, lastOpenedAt: openedAt });
    await chrome.windows.create({ url: urls, focused: true });
    await refresh();
  }

  function getSelected(session) {
    const selected = selectedByWorkspace.get(session.id) || new Set();
    return (session.tabs || []).map((tab, index) => ({ tab, index })).filter(({ index }) => selected.has(index) && Boolean(tab.url));
  }

  async function handleOpenSelected(session) {
    const selected = getSelected(session);
    if (!selected.length) {
      setNotice("Select at least one link first.");
      return;
    }

    const openedAt = new Date().toISOString();
    const updatedTabs = [...(session.tabs || [])];
    selected.forEach(({ index }) => {
      if (updatedTabs[index]) updatedTabs[index] = { ...updatedTabs[index], lastVisitedAt: openedAt };
    });
    await persistSession({ ...session, tabs: updatedTabs, lastOpenedAt: openedAt });
    for (const { tab } of selected) {
      await chrome.tabs.create({ url: tab.url, active: false });
    }
    await refresh();
  }

  async function handleOpenSelectedNewWindow(session) {
    const selected = getSelected(session);
    if (!selected.length) {
      setNotice("Select at least one link first.");
      return;
    }

    const openedAt = new Date().toISOString();
    const updatedTabs = [...(session.tabs || [])];
    selected.forEach(({ index }) => {
      if (updatedTabs[index]) updatedTabs[index] = { ...updatedTabs[index], lastVisitedAt: openedAt };
    });
    await persistSession({ ...session, tabs: updatedTabs, lastOpenedAt: openedAt });
    await chrome.windows.create({ url: selected.map(({ tab }) => tab.url), focused: true });
    await refresh();
  }

  async function handleAddCurrentLinks(session) {
    const currentTabs = await getCurrentTabs();
    if (!currentTabs.length) {
      setNotice("No valid links are open in this window.");
      return;
    }

    const existingKeys = new Set((session.tabs || []).map((tab) => getLinkKey(tab.url)));
    const newTabs = getUniqueTabs(currentTabs).filter((tab) => !existingKeys.has(getLinkKey(tab.url)));
    if (!newTabs.length) {
      setNotice("All open links are already in this workspace.");
      return;
    }

    await persistSession({ ...session, tabs: [...(session.tabs || []), ...newTabs] });
    setNotice(`${newTabs.length} link${newTabs.length === 1 ? "" : "s"} added to “${session.title}”.`);
    await refresh();
  }

  function toggleExpanded(sessionId) {
    setExpandedIds((prev) => {
      // The popup is intentionally compact: keeping one workspace open prevents
      // several expanded cards from crowding the available space.
      return prev.has(sessionId) ? new Set() : new Set([sessionId]);
    });
  }

  function toggleTabSelection(sessionId, tabIndex, checked) {
    setSelectedByWorkspace((prev) => {
      const next = new Map(prev);
      const selected = new Set(next.get(sessionId) || []);
      if (checked) selected.add(tabIndex);
      else selected.delete(tabIndex);
      if (selected.size) next.set(sessionId, selected);
      else next.delete(sessionId);
      return next;
    });
  }

  function requestDeleteSession(session) {
    const confirmed = window.confirm(`Delete “${session.title}” and all its saved links?`);
    if (!confirmed) return;

    deleteSessionStorage(session.id)
      .then(async () => {
        setExpandedIds((prev) => {
          const next = new Set(prev);
          next.delete(session.id);
          return next;
        });
        setSelectedByWorkspace((prev) => {
          const next = new Map(prev);
          next.delete(session.id);
          return next;
        });
        await refresh();
      })
      .catch((error) => {
        console.error(error);
        setNotice("Unable to delete this workspace.");
      });
  }

  function requestDeleteTab(session, tabIndex) {
    const confirmed = window.confirm("Delete this link from the workspace?");
    if (!confirmed) return;

    const updatedTabs = (session.tabs || []).filter((_, index) => index !== tabIndex);
    persistSession({ ...session, tabs: updatedTabs })
      .then(async () => {
        setSelectedByWorkspace((prev) => {
          const next = new Map(prev);
          const selected = next.get(session.id);
          if (!selected) return next;

          const shifted = new Set();
          selected.forEach((index) => {
            if (index < tabIndex) shifted.add(index);
            if (index > tabIndex) shifted.add(index - 1);
          });

          if (shifted.size) next.set(session.id, shifted);
          else next.delete(session.id);
          return next;
        });
        await refresh();
      })
      .catch((error) => {
        console.error(error);
        setNotice("Unable to delete this link.");
      });
  }

  function handleExportCsv() {
    if (!sessions.length) {
      setNotice("There are no workspaces to export.");
      return;
    }

    exportWorkspacesToCsv(sessions);
    setNotice(`${sessions.length} workspace${sessions.length === 1 ? "" : "s"} exported as CSV.`);
  }

  function openFullManager() {
    chrome.tabs.create({ url: chrome.runtime.getURL("src/pages/fullpage/index.html") });
    window.close();
  }

  async function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    await persistTheme(nextTheme);
  }

  return (
    <div className="workspace-manager-popup">
      <header className="manager-header">
        <div className="manager-title-wrap">
          <div className="manager-icon" aria-hidden="true"><FolderIcon /></div>
          <h1>Workspace Manager</h1>
        </div>
        <div className="manager-header-actions">
          <span className="manager-count">{sessions.length}</span>
          <button className="theme-toggle" onClick={toggleTheme} type="button" aria-label="Toggle theme">
            {theme === "dark" ? "☀" : "☾"}
          </button>
        </div>
      </header>

      <div className="manager-form">
        <input
          className="manager-input"
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Workspace title..."
          onKeyDown={(event) => event.key === "Enter" && handleSave()}
          autoFocus
        />

        <input
          className="manager-input"
          type="text"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Add a short note (optional)..."
        />

        <div className="manager-input-row">
          <input
            className="manager-input"
            type="datetime-local"
            value={reminderAt}
            onChange={(event) => setReminderAt(event.target.value)}
            aria-label="Reminder date and time"
          />
        </div>

        <button className="manager-save-btn" onClick={handleSave} disabled={saving} type="button">
          {saving ? "Saving..." : "Save Workspace"}
        </button>
      </div>

      {notice && <div className="manager-notice" role="status">{notice}</div>}

      {dueReminders.length > 0 && (
        <div className="reminder-stack">
          {dueReminders.map((session) => (
            <div className="reminder-item" key={session.id}>
              <span className="reminder-dot" aria-hidden="true">◉</span>
              <div className="reminder-copy">
                <strong>Reminder:</strong> {session.title}
                <div>Due {formatDate(session.reminderAt)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="manager-toolbar">
        <span className="toolbar-label">Workspace Manager</span>
        <select className="manager-select" value={sortKey} onChange={(event) => setSortKey(event.target.value)}>
          <option value="created-desc">Latest created</option>
          <option value="opened-desc">Recently opened</option>
          <option value="name-asc">Name A-Z</option>
        </select>
        <button className="secondary-btn" onClick={handleExportCsv} type="button">Export CSV</button>
      </div>

      <div className="manager-search-wrap">
        <input
          className="manager-search"
          type="text"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Search (minimum 3 characters)..."
        />
      </div>

      <div className="manager-list">
        {loading && <div className="manager-empty">Loading...</div>}
        {!loading && filteredSessions.length === 0 && <div className="manager-empty">No matching workspaces found.</div>}

        {filteredSessions.map((session) => {
          const expanded = expandedIds.has(session.id);
          const selectedIndexes = selectedByWorkspace.get(session.id) || new Set();

          return (
            <div className={`workspace-card ${expanded ? "is-expanded" : ""}`} key={session.id}>
              <button className="workspace-summary" onClick={() => toggleExpanded(session.id)} type="button">
                <span className="workspace-mark" aria-hidden="true"><FolderIcon /></span>
                <span className="workspace-details">
                  <span className="workspace-title">{session.title}</span>
                  {session.note && <span className="workspace-note">{session.note}</span>}
                  <span className="workspace-meta">
                    Saved: {formatDate(session.createdAt)}
                    {session.lastOpenedAt ? ` · Last opened: ${formatDate(session.lastOpenedAt)}` : ""}
                    {session.reminderAt ? ` · Reminder: ${formatDate(session.reminderAt)}` : ""}
                    {` · ${session.tabs?.length || 0} links`}
                  </span>
                </span>
                <span className={`workspace-chevron ${expanded ? "is-open" : ""}`} aria-hidden="true">⌃</span>
              </button>

              {expanded && (
                <div className="workspace-body">
                  <div className="workspace-body-toolbar">
                    <span>{session.tabs?.length || 0} saved links</span>
                    <button className="add-links-btn" onClick={() => handleAddCurrentLinks(session)} type="button">
                      + Add current links
                    </button>
                  </div>
                  <div className="workspace-links">
                    {(session.tabs || []).length === 0 && <div className="workspace-empty-links">This workspace has no saved links.</div>}
                    {(session.tabs || []).map((tab, index) => (
                      <div className="link-row" key={`${session.id}-${index}`}>
                        <label className="link-select">
                          <input
                            type="checkbox"
                            checked={selectedIndexes.has(index)}
                            onChange={(event) => toggleTabSelection(session.id, index, event.target.checked)}
                          />
                        </label>
                        <button className="link-open" onClick={() => chrome.tabs.create({ url: tab.url, active: false })} type="button">
                          <LinkFavicon tab={tab} />
                          <span className="link-copy">
                            <span className="link-title">{tab.title || tab.url}</span>
                            <span className="link-url">{tab.url}</span>
                            <span className="link-date">Opened {tab.lastVisitedAt ? formatDate(tab.lastVisitedAt) : "recently"}</span>
                          </span>
                        </button>
                        <button className="link-delete" onClick={() => requestDeleteTab(session, index)} type="button" aria-label="Delete link">✕</button>
                      </div>
                    ))}
                  </div>

                  <div className="workspace-actions">
                    <button className="action-btn primary" onClick={() => handleOpenAll(session)} type="button">Open All</button>
                    <button className="action-btn" onClick={() => handleOpenNewWindow(session)} type="button">New Window</button>
                    <button className="action-btn" onClick={() => handleOpenSelected(session)} type="button">Open selected</button>
                    <button className="action-btn" onClick={() => handleOpenSelectedNewWindow(session)} type="button">Selected in new window</button>
                    <button className="action-btn danger" onClick={() => requestDeleteSession(session)} type="button">Delete workspace</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button className="full-manager-link" onClick={openFullManager} type="button">Open full manager →</button>
    </div>
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3.5 7.5A2.5 2.5 0 0 1 6 5h4l2 2.5h6A2.5 2.5 0 0 1 20.5 10v7.5A2.5 2.5 0 0 1 18 20H6a2.5 2.5 0 0 1-2.5-2.5Z" />
    </svg>
  );
}

function LinkFavicon({ tab }) {
  const [failed, setFailed] = useState(false);
  const source = tab.favicon || getFaviconUrl(tab.url);
  const fallback = (tab.title || tab.url || "L").trim().charAt(0).toUpperCase();

  if (!source || failed) return <span className="favicon favicon-fallback" aria-hidden="true">{fallback}</span>;

  return <img src={source} alt="" className="favicon" onError={() => setFailed(true)} />;
}
