import { useEffect, useState, useCallback, useMemo } from "react";
import { getSessions, persistSession, deleteSessionStorage, onSessionsChanged, getTheme, persistTheme } from "../../lib/storage";
import {
  getCurrentTabs,
  getUniqueTabs,
  getLinkKey,
  sortSessions,
  getFaviconUrl,
  exportWorkspacesToCsv,
  workspaceMatchesSearch
} from "../../lib/utils";
import WorkspaceCard from "./components/WorkspaceCard";
import ConfirmDialog from "./components/ConfirmDialog";
import Toast from "./components/Toast";
import ReminderStack from "./components/ReminderStack";
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
  const [theme, setTheme] = useState("light");

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

  async function dismissReminder(session) {
    try {
      await persistSession({ ...session, reminderAt: "" });
      await refresh();
    } catch (error) {
      console.error("Failed to dismiss reminder:", error);
      showToast("Could not dismiss reminder. Please try again.");
    }
  }

  const visibleSessions = useMemo(() => {
    const filtered = activeSearch
      ? sessions.filter((s) => workspaceMatchesSearch(s, activeSearch))
      : sessions;
    return sortSessions(filtered, sortKey);
  }, [sessions, activeSearch, sortKey]);

  const [activeNav, setActiveNav] = useState("all");
  const [isEmptyWorkspace, setIsEmptyWorkspace] = useState(false);

  // ── Metrics ───────────────────────────────────────────────────────────────
  const totalSavedTabs = useMemo(() => {
    return sessions.reduce((total, s) => total + (s.tabs?.length || 0), 0);
  }, [sessions]);

  const updatedThisWeekCount = useMemo(() => {
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return sessions.filter((s) => {
      const t = Date.parse(s.lastOpenedAt || s.createdAt);
      return !isNaN(t) && t >= oneWeekAgo;
    }).length;
  }, [sessions]);

  const displayedSessions = useMemo(() => {
    let list = visibleSessions;
    if (activeNav === "recent") {
      list = [...visibleSessions].sort((a, b) => {
        const timeA = Date.parse(a.lastOpenedAt || a.createdAt || 0);
        const timeB = Date.parse(b.lastOpenedAt || b.createdAt || 0);
        return timeB - timeA;
      });
    }
    return list;
  }, [visibleSessions, activeNav]);

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

  async function handleOpenTab(session, tabIndex) {
    const tab = session.tabs?.[tabIndex];
    if (!tab?.url) return;
    await markOpened(session.id, [tabIndex]);
    await chrome.tabs.create({ url: tab.url, active: false });
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
  
  // ── Delete ────────────────────────────────────────────────────────────────

  function requestDeleteSession(session) {
    setConfirmState({
      title: "Delete workspace?",
      message: `"${session.title}" and all of its saved links will be permanently deleted.`,
      onConfirm: async () => {
        await deleteSessionStorage(session.id);
        setSelectedByWorkspace((prev) => { const next = new Map(prev); next.delete(session.id); return next; });
        setExpandedIds((prev) => { const next = new Set(prev); next.delete(session.id); return next; });
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
          const selected = new Set(
            [...(next.get(session.id) || [])]
              .filter((index) => index !== tabIndex)
              .map((index) => index > tabIndex ? index - 1 : index)
          );
          if (selected.size) next.set(session.id, selected);
          else next.delete(session.id);
          return next;
        });
        await refresh();
        setConfirmState(null);
        showToast("Link deleted.");
      }
    });
  }

  // ── Expand ────────────────────────────────────────────────────────────────

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
    setIsEmptyWorkspace(false);
    setTitle("");
    setNote("");
    setTags("");
    setReminderAt("");
    setNewWorkspaceOpen(true);
  }

  function openEmptyWorkspaceModal() {
    setEditingSession(null);
    setIsEmptyWorkspace(true);
    setTitle("");
    setNote("");
    setTags("");
    setReminderAt("");
    setNewWorkspaceOpen(true);
  }

  function closeWorkspaceModal() {
    setNewWorkspaceOpen(false);
    setEditingSession(null);
    setIsEmptyWorkspace(false);
    setTitle("");
    setNote("");
    setTags("");
    setReminderAt("");
  }

  async function saveWorkspaceModal() {
    const nextTitle = title.trim();
    if (!nextTitle) {
      showToast("Enter a workspace name first.");
      return;
    }
    const reminderIso = reminderAt ? new Date(reminderAt).toISOString() : "";
    const parsedTags = tags.split(",").map((t) => t.trim()).filter(Boolean);

    if (editingSession) {
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
      return;
    }

    if (isEmptyWorkspace) {
      const newSession = {
        id: `sess_${Date.now()}`,
        title: nextTitle,
        note: note.trim(),
        tags: parsedTags,
        reminderAt: reminderIso,
        tabs: [],
        createdAt: new Date().toISOString(),
        order: sessions.length ? Math.max(...sessions.map((s) => s.order ?? 0)) + 1 : 0
      };
      await persistSession(newSession);
      await refresh();
      showToast(`Workspace "${nextTitle}" created.`);
      closeWorkspaceModal();
      return;
    }

    await handleSave();
    closeWorkspaceModal();
  }

  function renameWorkspace(session) {
    setEditingSession(session);
    setIsEmptyWorkspace(false);
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

  // ── Edit / Add link modal ──────────────────────────────────────────────────

  function openAddLink(session) {
    setEditingLink({ session, tabIndex: -1 });
    setLinkTitle("");
    setLinkUrl("");
    setLinkNote("");
    setLinkTags("");
    setLinkReminderAt("");
  }

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
      showToast("Enter a valid link URL (e.g. https://example.com).");
      return;
    }
    const { session, tabIndex } = editingLink;
    const updatedTabs = [...(session.tabs || [])];

    if (tabIndex === -1) {
      const newTab = {
        title: linkTitle.trim() || trimmedUrl,
        url: trimmedUrl,
        note: linkNote.trim(),
        tags: linkTags.split(",").map((t) => t.trim()).filter(Boolean),
        reminderAt: linkReminderAt ? new Date(linkReminderAt).toISOString() : ""
      };
      await persistSession({ ...session, tabs: [...updatedTabs, newTab] });
      await refresh();
      closeLinkEditor();
      showToast("Link added.");
      return;
    }

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
    <div className="modern-app-shell">
      {/* ── Left Sidebar ── */}
      <aside className="modern-sidebar">
        <div className="modern-brand">
          <span className="modern-brand-logo">W</span>
          <span className="modern-brand-text">Workspace Manager</span>
        </div>

        <nav className="modern-nav" aria-label="Workspace navigation">
          <button
            className={`modern-nav-item ${activeNav === "all" ? "is-active" : ""}`}
            onClick={() => setActiveNav("all")}
            type="button"
          >
            <span className="modern-nav-icon"><Icon name="allspace" /></span>
            <span className="modern-nav-text">All Workspaces</span>
          </button>

          <button
            className={`modern-nav-item ${activeNav === "recent" ? "is-active" : ""}`}
            onClick={() => setActiveNav("recent")}
            type="button"
          >
            <span className="modern-nav-icon"><Icon name="clock" /></span>
            <span className="modern-nav-text">Recent</span>
          </button>

          <button
            className={`modern-nav-item ${activeNav === "archived" ? "is-active" : ""}`}
            onClick={() => {
              setActiveNav("archived");
              showToast("Archived workspaces coming soon.");
            }}
            type="button"
          >
            <span className="modern-nav-icon"><Icon name="archive" /></span>
            <span className="modern-nav-text">Archived</span>
          </button>

          <div className="modern-nav-divider" />

          <button
            className={`modern-nav-item ${activeNav === "settings" ? "is-active" : ""}`}
            onClick={() => {
              toggleTheme();
              showToast(`Theme switched to ${theme === "dark" ? "light" : "dark"} mode.`);
            }}
            type="button"
          >
            <span className="modern-nav-icon"><Icon name="settings" /></span>
            <span className="modern-nav-text">Settings</span>
          </button>
        </nav>

        {/* Bottom Extension Card */}
        <div className="modern-sidebar-card">
          <strong className="modern-card-title">Browser extension</strong>
          <p className="modern-card-desc">Save and restore tabs without leaving Chrome.</p>
          <button
            className="modern-card-link"
            onClick={() => {
              const url = chrome?.runtime?.getURL ? chrome.runtime.getURL("src/pages/popup/index.html") : "/src/pages/popup/index.html";
              window.open(url, "_blank");
            }}
            type="button"
          >
            <span>Open popup preview</span>
            <Icon name="arrowRight" />
          </button>
        </div>
      </aside>

      {/* ── Main Page Content ── */}
      <div className="modern-main-container">
        {/* Topbar */}
        <header className="modern-topbar">
          <div className="modern-topbar-search">
            <Icon name="search" />
            <input
              className="modern-search-input"
              placeholder="Search workspaces..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>

          <div className="modern-topbar-actions">
            <button
              className="modern-btn-outline"
              onClick={openNewWorkspaceModal}
              type="button"
            >
              <Icon name="plus" /> New Workspace
            </button>

            <button
              className="modern-btn-purple"
              onClick={handleQuickSave}
              disabled={saving}
              type="button"
            >
              <Icon name="plus" /> {saving ? "Saving…" : "Save Current Tabs"}
            </button>

            <button
              className="modern-theme-btn"
              onClick={toggleTheme}
              type="button"
              aria-label="Toggle theme"
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              <Icon name={theme === "dark" ? "sun" : "moon"} />
            </button>
          </div>
        </header>

        <main className="modern-content">
          {/* Header */}
          <div className="modern-page-header">
            <span className="modern-eyebrow">WORKSPACE LIBRARY</span>
            <h1 className="modern-main-heading">All Workspaces</h1>
            <p className="modern-subtitle">
              Save what you're doing now. Reopen it whenever you need it.
            </p>
          </div>

          {/* Due Reminders */}
          <ReminderStack reminders={dueReminders} onDismiss={dismissReminder} />

          {/* 3 Metric Summary Cards Row */}
          <section className="modern-summary-grid">
            {/* Card 1: Current Browser */}
            <div className="modern-summary-card is-browser">
              <div className="modern-browser-header">
                <strong>Current Browser</strong>
                <div className="modern-browser-favicons">
                  {currentTabs.slice(0, 5).map((tab, idx) => {
                    const fallback = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(tab.url || tab.title)}&sz=24`;
                    return (
                      <img
                        key={tab.id ?? idx}
                        src={tab.favicon || fallback}
                        alt=""
                        className="modern-tab-dot-icon"
                        onError={(e) => {
                          if (e.currentTarget.src !== fallback) e.currentTarget.src = fallback;
                          else e.currentTarget.style.display = "none";
                        }}
                      />
                    );
                  })}
                  {currentTabs.length > 5 && (
                    <span className="modern-favicons-extra">+{currentTabs.length - 5}</span>
                  )}
                </div>
              </div>

              <span className="modern-browser-meta">
                {currentTabs.length} tabs open · Ready to save
              </span>

              <button
                className="modern-browser-save-btn"
                onClick={handleQuickSave}
                disabled={saving}
                type="button"
              >
                <Icon name="plus" /> {saving ? "Saving…" : "Save Current Tabs"}
              </button>
            </div>

            {/* Card 2: Workspaces */}
            <div className="modern-summary-card">
              <span className="modern-card-stat-label">Workspaces</span>
              <div className="modern-card-stat-val">{sessions.length}</div>
              <span className="modern-card-stat-sub">
                {updatedThisWeekCount} updated this week
              </span>
            </div>

            {/* Card 3: Saved tabs */}
            <div className="modern-summary-card">
              <span className="modern-card-stat-label">Saved tabs</span>
              <div className="modern-card-stat-val">{totalSavedTabs}</div>
              <span className="modern-card-stat-sub">Across all workspaces</span>
            </div>
          </section>

          {/* Workspaces Section */}
          <section className="modern-workspaces-section">
            <div className="modern-section-header">
              <div>
                <h2 className="modern-section-title">My Workspaces</h2>
                <span className="modern-section-meta">
                  {displayedSessions.length} of {sessions.length} workspaces
                </span>
              </div>

              <button
                className="modern-empty-ws-btn"
                onClick={openEmptyWorkspaceModal}
                type="button"
              >
                <Icon name="plus" /> Create Empty Workspace
              </button>
            </div>

            {/* List */}
            <div className="modern-workspace-stack">
              {loading && <div className="final-empty">Loading workspaces…</div>}

              {!loading && sessions.length === 0 && (
                <div className="final-empty-state">
                  <div className="empty-bars" aria-hidden="true"><i /><i /><i /><i /></div>
                  <strong>No workspaces yet</strong>
                  <span>Save your current browser tabs and come back to them anytime.</span>
                  <button className="empty-save" onClick={handleQuickSave} disabled={saving} type="button">
                    <Icon name="plus" /> Save Current Tabs
                  </button>
                  <button className="empty-create" onClick={openEmptyWorkspaceModal} type="button">
                    Create Empty Workspace
                  </button>
                </div>
              )}

              {!loading && sessions.length > 0 && displayedSessions.length === 0 && (
                <div className="final-empty">No workspaces match your search.</div>
              )}

              {displayedSessions.map((session, index) => (
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
                  onExportSession={() => {
                    exportWorkspacesToCsv([session]);
                    showToast("Workspace exported as CSV.");
                  }}
                  onDeleteSession={() => requestDeleteSession(session)}
                  onToggleTabSelection={(tabIndex, checked) => toggleTabSelection(session.id, tabIndex, checked)}
                  onOpenTab={(url, tabIndex) => handleOpenTab(session, tabIndex)}
                  onEditTab={(tabIndex) => openLinkEditor(session, tabIndex)}
                  onDeleteTab={(tabIndex) => requestDeleteTab(session, tabIndex)}
                  onAddLink={() => openAddLink(session)}
                  onOpenAll={() => handleOpenAll(session)}
                  onOpenNewWindow={() => handleOpenNewWindow(session)}
                  onOpenSelected={() => handleOpenSelected(session)}
                  onOpenSelectedNewWindow={() => handleOpenSelectedNewWindow(session)}
                  onAddCurrentLinks={() => handleAddCurrentLinks(session)}
                  getFaviconUrl={getFaviconUrl}
                />
              ))}
            </div>
          </section>

          <footer className="modern-footer">
            <span>{sessions.length} workspace{sessions.length === 1 ? "" : "s"} · {totalSavedTabs} saved tabs</span>
          </footer>
        </main>
      </div>

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
