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
import WorkspaceCard from "./components/WorkspaceCard";
import ConfirmDialog from "./components/ConfirmDialog";
import Toast from "./components/Toast";
import { Icon } from "./components/Icons";

export default function App() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTabs, setCurrentTabs] = useState([]);

  // Save form
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [tags, setTags] = useState("");
  const [reminderAt, setReminderAt] = useState("");
  const [saving, setSaving] = useState(false);

  // Search & sort
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [sortKey, setSortKey] = useState("created-desc");

  // UI state
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [selectedByWorkspace, setSelectedByWorkspace] = useState(() => new Map());
  const [openMenuId, setOpenMenuId] = useState(null);
  const [theme, setTheme] = useState("dark");

  // Drag & drop
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  // New / Edit workspace modal
  const [newWorkspaceOpen, setNewWorkspaceOpen] = useState(false);
  const [editingSession, setEditingSession] = useState(null);

  // Edit link modal
  const [editingLink, setEditingLink] = useState(null);
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkNote, setLinkNote] = useState("");
  const [linkTags, setLinkTags] = useState("");
  const [linkReminderAt, setLinkReminderAt] = useState("");

  // Confirm dialog & toast
  const [confirmState, setConfirmState] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message) => setToast({ id: Date.now(), message }), []);

  const refresh = useCallback(async () => {
    const data = await getSessions();
    setSessions(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    getTheme().then(setTheme);
    getCurrentTabs().then(setCurrentTabs);
    const unsubscribe = onSessionsChanged(refresh);
    return unsubscribe;
  }, [refresh]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Search debounce — 3-char minimum
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

  // Close 3-dot menu on outside click
  useEffect(() => {
    if (!openMenuId) return undefined;
    function close(event) {
      if (!event.target.closest(".final-card-actions, .final-menu")) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [openMenuId]);

  const dueReminders = useMemo(() => {
    const now = Date.now();
    return sessions
      .filter((s) => s.reminderAt && Date.parse(s.reminderAt) <= now)
      .sort((a, b) => Date.parse(b.reminderAt) - Date.parse(a.reminderAt));
  }, [sessions]);

  const visibleSessions = useMemo(() => {
    const filtered = activeSearch
      ? sessions.filter((s) => workspaceMatchesSearch(s, activeSearch))
      : sessions;
    return sortSessions(filtered, sortKey);
  }, [sessions, activeSearch, sortKey]);

  // ── Save ──────────────────────────────────────────────────────────────────

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
        const mergedTags = parsedTags.length > 0
          ? Array.from(new Set([...(existing.tags || []), ...parsedTags]))
          : (existing.tags || []);
        await persistSession({
          ...existing,
          note: note.trim() || existing.note,
          tags: mergedTags,
          reminderAt: reminderIso || existing.reminderAt,
          tabs: [...(existing.tabs || []), ...newTabs]
        });
        const ignored = tabs.length - newTabs.length;
        showToast(
          newTabs.length
            ? `${newTabs.length} new link${newTabs.length === 1 ? "" : "s"} added to "${existing.title}".${ignored ? ` ${ignored} duplicate${ignored === 1 ? "" : "s"} skipped.` : ""}`
            : `All current links are already saved in "${existing.title}".`
        );
      } else {
        const newSession = {
          id: `sess_${Date.now()}`,
          title: trimmedTitle,
          note: note.trim(),
          tags: parsedTags,
          reminderAt: reminderIso,
          tabs: uniqueTabs,
          createdAt: new Date().toISOString(),
          order: sessions.length ? Math.max(...sessions.map((s) => s.order ?? 0)) + 1 : 0
        };
        await persistSession(newSession);
        const ignored = tabs.length - uniqueTabs.length;
        showToast(`${uniqueTabs.length} link${uniqueTabs.length === 1 ? "" : "s"} saved.${ignored ? ` ${ignored} duplicate${ignored === 1 ? "" : "s"} skipped.` : ""}`);
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

  async function handleQuickSave() {
    setSaving(true);
    try {
      const tabs = getUniqueTabs(await getCurrentTabs());
      if (!tabs.length) {
        showToast("No valid tabs are open in this window.");
        return;
      }
      const uniqueTitle = getUniqueWorkspaceName("Current Browser", sessions);
      await persistSession({
        id: `sess_${Date.now()}`,
        title: uniqueTitle,
        note: "",
        tags: [],
        tabs,
        createdAt: new Date().toISOString(),
        order: sessions.length ? Math.max(...sessions.map((s) => s.order ?? 0)) + 1 : 0
      });
      showToast(`${tabs.length} tabs saved as "${uniqueTitle}".`);
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  function getUniqueWorkspaceName(baseName, list) {
    const existing = new Set(list.map((s) => s.title));
    if (!existing.has(baseName)) return baseName;
    let counter = 1;
    let name = `${baseName} ${counter}`;
    while (existing.has(name)) {
      counter += 1;
      name = `${baseName} ${counter}`;
    }
    return name;
  }

  // ── Open actions ──────────────────────────────────────────────────────────

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
    return (session.tabs || []).map((tab, index) => ({ tab, index })).filter(({ tab, index }) => selected.has(index) && tab.url);
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

  async function handleOpenTab(session, tabIndex) {
    const tab = session.tabs?.[tabIndex];
    if (!tab?.url) return;
    await markOpened(session.id, [tabIndex]);
    await chrome.tabs.create({ url: tab.url, active: false });
    await refresh();
  }

  async function handleAddCurrentLinks(session) {
    const tabs = await getCurrentTabs();
    if (!tabs.length) return showToast("No valid links are open in this window.");
    const existingKeys = new Set((session.tabs || []).map((t) => getLinkKey(t.url)));
    const newTabs = getUniqueTabs(tabs).filter((t) => !existingKeys.has(getLinkKey(t.url)));
    if (!newTabs.length) return showToast("All open links are already in this workspace.");
    await persistSession({ ...session, tabs: [...(session.tabs || []), ...newTabs] });
    showToast(`${newTabs.length} link${newTabs.length === 1 ? "" : "s"} added to "${session.title}".`);
    await refresh();
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  function requestDeleteSession(session) {
    setConfirmState({
      title: "Delete workspace?",
      message: `"${session.title}" and all of its saved links will be permanently deleted.`,
      onConfirm: async () => {
        await deleteSessionStorage(session.id);
        setExpandedIds((prev) => { const next = new Set(prev); next.delete(session.id); return next; });
        setSelectedByWorkspace((prev) => { const next = new Map(prev); next.delete(session.id); return next; });
        await refresh();
        setConfirmState(null);
        showToast(`"${session.title}" deleted.`);
      }
    });
  }

  function requestDeleteTab(session, tabIndex) {
    setConfirmState({
      title: "Delete saved link?",
      message: "This link will be permanently removed from the workspace.",
      onConfirm: async () => {
        const updatedTabs = (session.tabs || []).filter((_, i) => i !== tabIndex);
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
        showToast("Link deleted.");
      }
    });
  }

  // ── Expand / Select ────────────────────────────────────────────────────────

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

  // ── Workspace modal ────────────────────────────────────────────────────────

  function openNewWorkspaceModal() {
    setEditingSession(null);
    setTitle("");
    setNote("");
    setTags("");
    setReminderAt("");
    setNewWorkspaceOpen(true);
  }

  function closeWorkspaceModal() {
    setNewWorkspaceOpen(false);
    setEditingSession(null);
    setTitle("");
    setNote("");
    setTags("");
    setReminderAt("");
  }

  async function saveWorkspaceModal() {
    if (!editingSession) {
      await handleSave();
      return;
    }
    const nextTitle = title.trim();
    if (!nextTitle) {
      showToast("Enter a workspace name first.");
      return;
    }
    const reminderIso = reminderAt ? new Date(reminderAt).toISOString() : "";
    const parsedTags = tags.split(",").map((t) => t.trim()).filter(Boolean);
    await persistSession({
      ...editingSession,
      title: nextTitle,
      note: note.trim(),
      tags: parsedTags,
      reminderAt: reminderIso
    });
    await refresh();
    showToast("Workspace updated.");
    closeWorkspaceModal();
  }

  function renameWorkspace(session) {
    setEditingSession(session);
    setTitle(session.title || "");
    setNote(session.note || "");
    setTags(Array.isArray(session.tags) ? session.tags.join(", ") : session.tags || "");
    setReminderAt(session.reminderAt ? session.reminderAt.slice(0, 16) : "");
    setNewWorkspaceOpen(true);
  }

  async function duplicateWorkspace(session) {
    const copy = {
      ...session,
      id: `sess_${Date.now()}`,
      title: getUniqueWorkspaceName(`${session.title} (Copy)`, sessions),
      tags: Array.isArray(session.tags) ? [...session.tags] : [],
      createdAt: new Date().toISOString()
    };
    await persistSession(copy);
    await refresh();
    showToast(`"${session.title}" duplicated.`);
  }

  // ── Edit link modal ────────────────────────────────────────────────────────

  function openLinkEditor(session, tabIndex) {
    const tab = session.tabs?.[tabIndex];
    if (!tab) return;
    setEditingLink({ session, tabIndex });
    setLinkTitle(tab.title || "");
    setLinkUrl(tab.url || "");
    setLinkNote(tab.note || "");
    setLinkTags(Array.isArray(tab.tags) ? tab.tags.join(", ") : tab.tags || "");
    setLinkReminderAt(tab.reminderAt ? tab.reminderAt.slice(0, 16) : "");
  }

  function closeLinkEditor() {
    setEditingLink(null);
  }

  async function saveLinkEditor() {
    if (!editingLink) return;
    const trimmedUrl = linkUrl.trim();
    try { new URL(trimmedUrl); } catch {
      showToast("Enter a valid link URL.");
      return;
    }
    const { session, tabIndex } = editingLink;
    const updatedTabs = [...(session.tabs || [])];
    const currentTab = updatedTabs[tabIndex];
    if (!currentTab) return;
    updatedTabs[tabIndex] = {
      ...currentTab,
      title: linkTitle.trim(),
      url: trimmedUrl,
      note: linkNote.trim(),
      tags: linkTags.split(",").map((t) => t.trim()).filter(Boolean),
      reminderAt: linkReminderAt ? new Date(linkReminderAt).toISOString() : ""
    };
    await persistSession({ ...session, tabs: updatedTabs });
    await refresh();
    closeLinkEditor();
    showToast("Link updated.");
  }

  // ── Drag & drop ───────────────────────────────────────────────────────────

  async function handleReorder(sourceId, targetId) {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const currentOrder = visibleSessions.map((s) => s.id);
    const fromIndex = currentOrder.indexOf(sourceId);
    const toIndex = currentOrder.indexOf(targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    const reordered = [...currentOrder];
    reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, sourceId);
    const updated = reordered
      .map((id, index) => {
        const session = sessions.find((s) => s.id === id);
        return session ? { ...session, order: index } : null;
      })
      .filter(Boolean);
    setSessions((prev) => {
      const map = new Map(updated.map((s) => [s.id, s]));
      return prev.map((s) => map.get(s.id) || s);
    });
    await Promise.all(updated.map((s) => persistSession(s)));
  }

  // ── Export ─────────────────────────────────────────────────────────────────

  function handleExportCsv() {
    if (!sessions.length) return showToast("There are no workspaces to export.");
    exportWorkspacesToCsv(sessions);
    showToast(`${sessions.length} workspace${sessions.length === 1 ? "" : "s"} exported as CSV.`);
  }

  async function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    await persistTheme(next);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="app-shell">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">W</span>
          <span>Workspace <span>Manager</span></span>
        </div>

        {/* Current browser quick-save */}
        <div className="current-browser">
          <div className="current-browser-row">
            <strong>Current Browser</strong>
            <span className="tab-dots">
              {currentTabs.slice(0, 3).map((tab, index) => {
                const fallback = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(tab.url || tab.title)}&sz=24`;
                return (
                  <img
                    key={tab.id ?? index}
                    src={tab.favicon || fallback}
                    alt=""
                    className="tab-favicon"
                    onError={(e) => {
                      if (e.currentTarget.src !== fallback) e.currentTarget.src = fallback;
                      else e.currentTarget.style.display = "none";
                    }}
                  />
                );
              })}
              {currentTabs.length > 3 && <small>+{currentTabs.length - 3}</small>}
            </span>
          </div>
          <span>{currentTabs.length} tabs open · Ready to save</span>
          <button onClick={handleQuickSave} disabled={saving} type="button">
            <Icon name="plus" /> {saving ? "Saving…" : "Save Current Tabs"}
          </button>
        </div>

        {/* <div className="sidebar-section">TOOLS <button type="button" onClick={openNewWorkspaceModal}>+</button></div> */}
        <button className="sidebar-new-btn" onClick={openNewWorkspaceModal} type="button">
          <Icon name="plus" /> New Workspace
        </button>
        <button className="sidebar-export-btn" onClick={handleExportCsv} type="button">
          <Icon name="download" /> Export CSV
        </button>

        <nav className="sidebar-nav" aria-label="Workspace navigation">
          <button className="sidebar-link is-active" type="button">
            <span><Icon name="allspace" /></span>All Workspaces <b>{sessions.length}</b>
          </button>
          <button className="sidebar-link" type="button" onClick={() => showToast("Favorites coming soon.")}>
            <span><Icon name="favorite" /></span>Favorites <b>0</b>
          </button>
        </nav>

        <div className="sidebar-stats">
          {/* <div><strong>{sessions.length}</strong><span>Workspaces</span></div> */}
          {/* <div><strong>{sessions.reduce((total, s) => total + (s.tabs?.length || 0), 0)}</strong><span>Links</span></div> */}
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="page">
        {/* Topbar */}
        <header className="topbar">
          <label className="topbar-search">
            <Icon name="search" />
            <input
              className="top-search-input"
              placeholder="Search workspaces, tabs, tags, notes…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </label>
          <select className="toolbar-select input" value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
            <option value="created-desc">Newest first</option>
            <option value="opened-desc">Recently opened</option>
            <option value="name-asc">Name (A–Z)</option>
          </select>
          <button className="theme-toggle" onClick={toggleTheme} type="button" aria-label="Toggle theme">
            <Icon name={theme === "dark" ? "sun" : "moon"} />
          </button>
        </header>

        {/* Page header */}
        <header className="page-header">
          <div>
            <span className="eyebrow">WORKSPACE MANAGER</span>
            <h1>All Workspaces <span className="count-pill">{sessions.length}</span></h1>
            <p className="subtitle">Save, organise and reopen your tab groups at any time.</p>
          </div>
        </header>

        {/* Due reminders */}
        {dueReminders.length > 0 && (
          <div className="reminder-stack">
            {dueReminders.map((s) => (
              <div className="reminder-alert" key={s.id}>
                <span className="reminder-icon"><Icon name="reminderbell" /></span>
                <div>
                  <strong>{s.title}</strong> — reminder due {formatDate(s.reminderAt)}
                  {s.note ? ` · ${s.note}` : ""}
                </div>
                {/* <span className="reminder-close" ><Icon name="close" /></span> */}
              </div>
            ))}
          </div>
        )}

        {/* Session list */}
        <div className="final-workspace-list">
          {loading && <div className="final-empty">Loading…</div>}

          {!loading && sessions.length === 0 && (
            <div className="final-empty-state">
              <div className="empty-bars" aria-hidden="true"><i /><i /><i /><i /></div>
              <strong>No workspaces yet</strong>
              <span>Save your current browser tabs and come back to them anytime.</span>
              <button className="empty-save" onClick={handleQuickSave} disabled={saving} type="button">
                <Icon name="plus" /> Save Current Tabs
              </button>
              <button className="empty-create" onClick={openNewWorkspaceModal} type="button">Create New Workspace</button>
            </div>
          )}

          {!loading && sessions.length > 0 && visibleSessions.length === 0 && (
            <div className="final-empty">No workspaces match your search.</div>
          )}

          {visibleSessions.map((session, index) => (
            <WorkspaceCard
              key={session.id}
              session={session}
              index={index}
              expanded={expandedIds.has(session.id)}
              selectedIndexes={selectedByWorkspace.get(session.id) || new Set()}
              openMenuId={openMenuId}
              setOpenMenuId={setOpenMenuId}
              isDragging={draggedId === session.id}
              isDragOver={dragOverId === session.id && draggedId !== session.id}
              onDragStart={() => setDraggedId(session.id)}
              onDragOver={(e) => { e.preventDefault(); if (dragOverId !== session.id) setDragOverId(session.id); }}
              onDragLeave={() => setDragOverId((cur) => (cur === session.id ? null : cur))}
              onDrop={(e) => { e.preventDefault(); handleReorder(draggedId, session.id); setDraggedId(null); setDragOverId(null); }}
              onDragEnd={() => { setDraggedId(null); setDragOverId(null); }}
              onToggleExpanded={() => toggleExpanded(session.id)}
              onEditSession={() => renameWorkspace(session)}
              onDuplicateSession={() => duplicateWorkspace(session)}
              onExportSession={() => { exportWorkspacesToCsv([session]); showToast("Workspace exported as CSV."); }}
              onDeleteSession={() => requestDeleteSession(session)}
              onToggleTabSelection={(tabIndex, checked) => toggleTabSelection(session.id, tabIndex, checked)}
              onOpenTab={(url, tabIndex) => handleOpenTab(session, tabIndex)}
              onEditTab={(tabIndex) => openLinkEditor(session, tabIndex)}
              onDeleteTab={(tabIndex) => requestDeleteTab(session, tabIndex)}
              onOpenAll={() => handleOpenAll(session)}
              onOpenNewWindow={() => handleOpenNewWindow(session)}
              onOpenSelected={() => handleOpenSelected(session)}
              onOpenSelectedNewWindow={() => handleOpenSelectedNewWindow(session)}
              onAddCurrentLinks={() => handleAddCurrentLinks(session)}
              getFaviconUrl={getFaviconUrl}
              formatDate={formatDate}
            />
          ))}
        </div>

        {/* New workspace button */}
        {sessions.length > 0 && (
          <button className="final-new-workspace" onClick={openNewWorkspaceModal} type="button">
            <Icon name="plus" /> New Workspace
          </button>
        )}

        <footer className="final-footer">
          <span>{sessions.length} workspace{sessions.length === 1 ? "" : "s"}</span>
        </footer>
      </main>

      {/* ── New / Edit workspace modal ── */}
      {newWorkspaceOpen && (
        <div className="new-workspace-backdrop" onClick={closeWorkspaceModal} role="presentation">
          <form
            className="new-workspace-dialog"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => { e.preventDefault(); saveWorkspaceModal(); }}
          >
            <div className="new-workspace-title-row">
              <div>
                <h2>{editingSession ? "Edit Workspace" : "New Workspace"}</h2>
                <p>{editingSession ? "Update this workspace's details." : "Save your current browser tabs in one place."}</p>
              </div>
              <button onClick={closeWorkspaceModal} type="button" aria-label="Close"><Icon name="close" /></button>
            </div>
            <label>Workspace name<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Design research" autoFocus /></label>
            <label>Tags <span>(comma separated, optional)</span><input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="e.g. work, research, urgent" /></label>
            <label>Note <span>(optional)</span><textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What is this workspace for?" rows="3" /></label>
            <label>Reminder <span>(optional)</span><input type="datetime-local" value={reminderAt} onChange={(e) => setReminderAt(e.target.value)} /></label>
            <div className="new-workspace-actions">
              <button className="new-workspace-cancel" onClick={closeWorkspaceModal} type="button">Cancel</button>
              <button className="new-workspace-save" disabled={saving} type="submit">
                {saving ? "Saving…" : editingSession ? "Save Changes" : "Save Workspace"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Edit link modal ── */}
      {editingLink && (
        <div className="new-workspace-backdrop" onClick={closeLinkEditor} role="presentation">
          <form
            className="new-workspace-dialog link-edit-dialog"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => { e.preventDefault(); saveLinkEditor(); }}
          >
            <div className="new-workspace-title-row">
              <div><h2>Edit Link</h2><p>Update this saved link's details.</p></div>
              <button onClick={closeLinkEditor} type="button" aria-label="Close"><Icon name="close" /></button>
            </div>
            <label>Title<input value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} placeholder="Link title" autoFocus /></label>
            <label>URL<input type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://example.com" /></label>
            <label>Notes <span>(optional)</span><textarea value={linkNote} onChange={(e) => setLinkNote(e.target.value)} placeholder="What is this link for?" rows="3" /></label>
            <label>Tags <span>(comma separated)</span><input value={linkTags} onChange={(e) => setLinkTags(e.target.value)} placeholder="research, priority" /></label>
            <label>Reminder <span>(optional)</span><input type="datetime-local" value={linkReminderAt} onChange={(e) => setLinkReminderAt(e.target.value)} /></label>
            <div className="new-workspace-actions">
              <button className="new-workspace-cancel" onClick={closeLinkEditor} type="button">Cancel</button>
              <button className="new-workspace-save" type="submit">Save Changes</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Confirm dialog ── */}
      {confirmState && (
        <ConfirmDialog
          title={confirmState.title}
          message={confirmState.message}
          onCancel={() => setConfirmState(null)}
          onConfirm={confirmState.onConfirm}
        />
      )}

      {/* ── Toast ── */}
      {toast && <Toast key={toast.id} message={toast.message} onDone={() => setToast(null)} />}
    </div>
  );
}
