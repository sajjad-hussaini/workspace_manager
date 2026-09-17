import { useEffect, useMemo, useState, useCallback } from "react";
import { getSessions, persistSession, deleteSessionStorage, onSessionsChanged, getTheme, persistTheme } from "../../lib/storage";
import {
  getCurrentTabs,
  getUniqueTabs,
  getLinkKey,
  formatDate,
  getFaviconUrl,
  exportWorkspacesToCsv,
  sortSessions,
  workspaceMatchesSearch
} from "../../lib/utils";
import WorkspaceCard from "./components/WorkspaceCard";
import ConfirmDialog from "./components/ConfirmDialog";
import Toast from "./components/Toast";

export default function App() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTabCount, setCurrentTabCount] = useState(0);

  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [tags, setTags] = useState("");
  const [reminderAt, setReminderAt] = useState("");
  const [saving, setSaving] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [sortKey, setSortKey] = useState("created-desc");

  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [selectedByWorkspace, setSelectedByWorkspace] = useState(() => new Map());

  const [confirmState, setConfirmState] = useState(null); // { title, message, onConfirm }
  const [toast, setToast] = useState(null);
  const [theme, setTheme] = useState("dark");

  const showToast = useCallback((message) => setToast({ id: Date.now(), message }), []);

  const refresh = useCallback(async () => {
    const data = await getSessions();
    setSessions(data);
    setLoading(false);
  }, []);

  const refreshTabCount = useCallback(async () => {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    setCurrentTabCount(tabs.length);
  }, []);

  useEffect(() => {
    refresh();
    refreshTabCount();
    getTheme().then(setTheme);
    const unsubscribe = onSessionsChanged(refresh);
    return unsubscribe;
  }, [refresh, refreshTabCount]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // search debounce - 3 character minimum jaisa purane version me tha
  useEffect(() => {
    const trimmed = searchInput.trim();
    if (!trimmed) {
      const t = setTimeout(() => setActiveSearch(""), 0);
      return () => clearTimeout(t);
    }
    if (trimmed.length >= 3) {
      const t = setTimeout(() => setActiveSearch(trimmed.toLowerCase()), 220);
      return () => clearTimeout(t);
    }
  }, [searchInput]);

  const dueReminders = useMemo(() => {
    const now = Date.now();
    return sessions
      .filter((s) => s.reminderAt && Date.parse(s.reminderAt) <= now)
      .sort((a, b) => Date.parse(b.reminderAt) - Date.parse(a.reminderAt));
  }, [sessions]);

  const visibleSessions = useMemo(() => {
    const filtered = activeSearch ? sessions.filter((s) => workspaceMatchesSearch(s, activeSearch)) : sessions;
    return sortSessions(filtered, sortKey);
  }, [sessions, activeSearch, sortKey]);

  async function handleSave() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      showToast("Enter a workspace name first.");
      return;
    }

    setSaving(true);
    try {
      const tabs = await getCurrentTabs();
      if (!tabs.length) {
        showToast("No valid tabs were found in this window.");
        return;
      }

      const reminderIso = reminderAt ? new Date(reminderAt).toISOString() : "";
      const parsedTags = tags.split(",").map((t) => t.trim()).filter(Boolean);
      const uniqueTabs = getUniqueTabs(tabs);
      const existing = sessions.find((s) => s.title?.trim().toLowerCase() === trimmedTitle.toLowerCase());

      if (existing) {
        const existingKeys = new Set((existing.tabs || []).map((t) => getLinkKey(t.url)));
        const newTabs = uniqueTabs.filter((t) => !existingKeys.has(getLinkKey(t.url)));
        const mergedTags = parsedTags.length > 0 ? Array.from(new Set([...(existing.tags || []), ...parsedTags])) : (existing.tags || []);
        const updated = {
          ...existing,
          note: note.trim() || existing.note,
          tags: mergedTags,
          reminderAt: reminderIso || existing.reminderAt,
          tabs: [...(existing.tabs || []), ...newTabs]
        };
        await persistSession(updated);
        const ignored = tabs.length - newTabs.length;
        showToast(
          newTabs.length
            ? `${newTabs.length} new link${newTabs.length === 1 ? "" : "s"} added to “${existing.title}”.${ignored ? ` ${ignored} duplicate${ignored === 1 ? "" : "s"} skipped.` : ""}`
            : `All current links are already saved in “${existing.title}”.`
        );
      } else {
        const newSession = {
          id: `sess_${Date.now()}`,
          title: trimmedTitle,
          note: note.trim(),
          tags: parsedTags,
          reminderAt: reminderIso,
          tabs: uniqueTabs,
          createdAt: new Date().toISOString()
        };
        await persistSession(newSession);
        const ignored = tabs.length - uniqueTabs.length;
        showToast(`${uniqueTabs.length} link${uniqueTabs.length === 1 ? "" : "s"} saved to your workspace.${ignored ? ` ${ignored} duplicate${ignored === 1 ? "" : "s"} skipped.` : ""}`);
      }

      setTitle("");
      setNote("");
      setTags("");
      setReminderAt("");
      await refresh();
    } catch (error) {
      console.error(error);
      showToast(error.message || "The workspace could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function markOpened(sessionId, tabIndexes) {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;
    const openedAt = new Date().toISOString();
    const updatedTabs = [...session.tabs];
    tabIndexes.forEach((i) => {
      if (updatedTabs[i]) updatedTabs[i] = { ...updatedTabs[i], lastVisitedAt: openedAt };
    });
    await persistSession({ ...session, tabs: updatedTabs, lastOpenedAt: openedAt });
  }

  async function handleOpenAll(session) {
    if (!session.tabs?.length) return showToast("This workspace has no links.");
    await markOpened(session.id, session.tabs.map((_, i) => i));
    for (const tab of session.tabs) if (tab.url) await chrome.tabs.create({ url: tab.url, active: false });
    await refresh();
  }

  async function handleOpenNewWindow(session) {
    const urls = session.tabs?.map((t) => t.url).filter(Boolean) || [];
    if (!urls.length) return showToast("This workspace has no links.");
    await markOpened(session.id, session.tabs.map((_, i) => i));
    await chrome.windows.create({ url: urls, focused: true });
    await refresh();
  }

  function getSelected(session) {
    const selected = selectedByWorkspace.get(session.id) || new Set();
    return session.tabs.map((tab, index) => ({ tab, index })).filter(({ tab, index }) => selected.has(index) && tab.url);
  }

  async function handleOpenSelected(session) {
    const selected = getSelected(session);
    if (!selected.length) return showToast("Select at least one link first.");
    await markOpened(session.id, selected.map(({ index }) => index));
    for (const { tab } of selected) await chrome.tabs.create({ url: tab.url, active: false });
    await refresh();
  }

  async function handleOpenSelectedNewWindow(session) {
    const selected = getSelected(session);
    if (!selected.length) return showToast("Select at least one link first.");
    await markOpened(session.id, selected.map(({ index }) => index));
    await chrome.windows.create({ url: selected.map(({ tab }) => tab.url), focused: true });
    await refresh();
  }

  async function handleAddCurrentLinks(session) {
    const currentTabs = await getCurrentTabs();
    if (!currentTabs.length) return showToast("No valid links are open in this window.");
    const existingKeys = new Set((session.tabs || []).map((t) => getLinkKey(t.url)));
    const newTabs = getUniqueTabs(currentTabs).filter((t) => !existingKeys.has(getLinkKey(t.url)));
    if (!newTabs.length) return showToast("All open links are already in this workspace.");
    await persistSession({ ...session, tabs: [...session.tabs, ...newTabs] });
    showToast(`${newTabs.length} link${newTabs.length === 1 ? "" : "s"} added to “${session.title}”.`);
    await refresh();
  }

  function requestDeleteSession(session) {
    setConfirmState({
      title: "Delete workspace?",
      message: `“${session.title}” and all of its saved links will be permanently deleted.`,
      onConfirm: async () => {
        await deleteSessionStorage(session.id);
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
        setConfirmState(null);
      }
    });
  }

  function requestDeleteTab(session, tabIndex) {
    setConfirmState({
      title: "Delete saved link?",
      message: "This link will be permanently removed from the workspace.",
      onConfirm: async () => {
        const updatedTabs = session.tabs.filter((_, i) => i !== tabIndex);
        await persistSession({ ...session, tabs: updatedTabs });
        setSelectedByWorkspace((prev) => {
          const next = new Map(prev);
          const selected = next.get(session.id);
          if (selected) {
            const shifted = new Set();
            selected.forEach((i) => {
              if (i < tabIndex) shifted.add(i);
              if (i > tabIndex) shifted.add(i - 1);
            });
            if (shifted.size) next.set(session.id, shifted);
            else next.delete(session.id);
          }
          return next;
        });
        await refresh();
        setConfirmState(null);
      }
    });
  }

  function toggleExpanded(sessionId) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
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

  function handleExportCsv() {
    if (!sessions.length) return showToast("There are no workspaces to export.");
    exportWorkspacesToCsv(sessions);
    showToast(`${sessions.length} workspace${sessions.length === 1 ? "" : "s"} exported as CSV.`);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">W</span><span>Workspace <span>Saver</span></span></div>
        <button className="sidebar-save" onClick={handleSave} disabled={saving} type="button">▣ Save Current Tabs</button>
        <nav className="sidebar-nav" aria-label="Workspace navigation">
          <button className="sidebar-link is-active" type="button"><span>▰</span>All Collections <b>{sessions.length}</b></button>
          <button className="sidebar-link" type="button" onClick={() => showToast("Favorites will be available soon.")}><span>★</span>Favorites <b>0</b></button>
          <button className="sidebar-link" type="button" onClick={() => showToast(`${currentTabCount} tabs are open in this window.`)}><span>▣</span>Current Window <b>{currentTabCount}</b></button>
          <button className="sidebar-link" type="button" onClick={() => showToast("Recently closed tabs are managed by your browser.")}><span>◴</span>Recently Closed</button>
        </nav>
        <div className="sidebar-section">FOLDERS <button type="button" onClick={() => showToast("Folder creation is coming soon.")}>+</button></div>
        <div className="command-hint">⌕ <span>Command Palette</span><kbd>Ctrl+K</kbd></div>
        <div className="sidebar-stats"><div><strong>{sessions.length}</strong><span>Collections</span></div><div><strong>{sessions.reduce((total, session) => total + (session.tabs?.length || 0), 0)}</strong><span>Tabs</span></div></div>
      </aside>
      <main className="page">
      <header className="topbar">
        <div className="topbar-search">⌕ <input className="top-search-input" placeholder="Search collections, tabs, and URLs" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} /></div>
        <button className="topbar-icon" onClick={() => showToast("Your workspaces are safely stored.")} type="button" title="Workspace status">↔</button>
        <button className="theme-toggle" onClick={async () => {
          const nextTheme = theme === "dark" ? "light" : "dark";
          setTheme(nextTheme);
          await persistTheme(nextTheme);
        }} type="button" aria-label="Toggle color theme">{theme === "dark" ? "☀" : "☾"}</button>
      </header>
      <header className="page-header">
        <div>
          <span className="eyebrow">LIBRARY AREA</span>
          <h1>All Collections <span className="count-pill">{sessions.length} collections</span></h1>
          <p className="subtitle">A clean home for every tab group you want to keep.</p>
        </div>
      </header>

      {dueReminders.length > 0 && (
        <div className="reminder-stack">
          {dueReminders.map((s) => (
            <div className="reminder-alert" key={s.id}>
              <span className="reminder-dot" aria-hidden="true" />
              <div>
                <strong>{s.title}</strong> — reminder due {formatDate(s.reminderAt)}
                {s.note ? ` · ${s.note}` : ""}
              </div>
            </div>
          ))}
        </div>
      )}

      <section className="save-panel">
        <div className="panel-label">Save this window as a collection</div>
        <div className="save-panel-grid">
          <input
            className="input"
            placeholder="Workspace name (for example, Client research)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
          <input className="input" placeholder="Tags (comma separated, optional)" value={tags} onChange={(e) => setTags(e.target.value)} />
          <input className="input" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <input
            className="input"
            type="datetime-local"
            value={reminderAt}
            onChange={(e) => setReminderAt(e.target.value)}
            title="Reminder (optional)"
          />
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Current Window"}
          </button>
        </div>
      </section>

      <div className="toolbar">
        <span className="toolbar-label">{visibleSessions.length} collection{visibleSessions.length === 1 ? "" : "s"}</span>
        <select className="input toolbar-select" value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
          <option value="created-desc">Newest first</option>
          <option value="opened-desc">Recently opened</option>
          <option value="name-asc">Name (A–Z)</option>
        </select>
        <button className="btn" onClick={handleExportCsv}>
          Export CSV
        </button>
      </div>

      <div className="session-list">
        {loading && <div className="empty-state">Loading...</div>}

        {!loading && visibleSessions.length === 0 && (
          <div className="empty-state">
            {activeSearch ? "No matching workspaces found." : "No workspaces saved yet — start by saving this window."}
          </div>
        )}

        {visibleSessions.map((session) => (
          <WorkspaceCard
            key={session.id}
            session={session}
            expanded={expandedIds.has(session.id)}
            selectedIndexes={selectedByWorkspace.get(session.id) || new Set()}
            onToggleExpanded={() => toggleExpanded(session.id)}
            onOpenAll={() => handleOpenAll(session)}
            onOpenNewWindow={() => handleOpenNewWindow(session)}
            onOpenSelected={() => handleOpenSelected(session)}
            onOpenSelectedNewWindow={() => handleOpenSelectedNewWindow(session)}
            onAddCurrentLinks={() => handleAddCurrentLinks(session)}
            onDeleteSession={() => requestDeleteSession(session)}
            onDeleteTab={(tabIndex) => requestDeleteTab(session, tabIndex)}
            onToggleTabSelection={(tabIndex, checked) => toggleTabSelection(session.id, tabIndex, checked)}
            getFaviconUrl={getFaviconUrl}
            formatDate={formatDate}
          />
        ))}
      </div>

      {confirmState && (
        <ConfirmDialog
          title={confirmState.title}
          message={confirmState.message}
          onCancel={() => setConfirmState(null)}
          onConfirm={confirmState.onConfirm}
        />
      )}

      {toast && <Toast key={toast.id} message={toast.message} onDone={() => setToast(null)} />}
      </main>
    </div>
  );
}
