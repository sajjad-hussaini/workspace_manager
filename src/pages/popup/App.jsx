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
  const [tags, setTags] = useState("");
  const [reminderAt, setReminderAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [sortKey, setSortKey] = useState("manual");
  const [selectedByWorkspace, setSelectedByWorkspace] = useState(() => new Map());
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState("success");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [newWorkspaceOpen, setNewWorkspaceOpen] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [editingLink, setEditingLink] = useState(null);
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkNote, setLinkNote] = useState("");
  const [linkTags, setLinkTags] = useState("");
  const [linkReminderAt, setLinkReminderAt] = useState("");
  const [theme, setTheme] = useState("light");
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [currentTabs, setCurrentTabs] = useState([]);

  useEffect(() => {
    getCurrentTabs().then(setCurrentTabs);
  }, []);

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

  useEffect(() => {
    if (!openMenuId) return undefined;

    function closeMenuOnOutsideClick(event) {
      if (!event.target.closest(".final-card-actions, .final-menu")) {
        setOpenMenuId(null);
      }
    }

    document.addEventListener("pointerdown", closeMenuOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeMenuOnOutsideClick);
  }, [openMenuId]);

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

  function showNotice(message, tone = "success") {
    setNoticeTone(tone);
    setNotice(message);
  }

  async function handleSave() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      showNotice("Enter a workspace name first.", "error");
      return;
    }

    setSaving(true);

    try {
      const tabs = await getCurrentTabs();
      if (!tabs.length) {
        showNotice("No valid tabs were found in this window.", "error");
        return;
      }

      const reminderIso = reminderAt ? new Date(reminderAt).toISOString() : "";
      const parsedTags = tags.split(",").map((tag) => tag.trim()).filter(Boolean);
      const uniqueTabs = getUniqueTabs(tabs);
      const existing = sessions.find((session) => session.title?.trim().toLowerCase() === trimmedTitle.toLowerCase());

      if (existing) {
        const existingKeys = new Set((existing.tabs || []).map((tab) => getLinkKey(tab.url)));
        const newTabs = uniqueTabs.filter((tab) => !existingKeys.has(getLinkKey(tab.url)));
        const mergedTags = parsedTags.length > 0 ? Array.from(new Set([...(existing.tags || []), ...parsedTags])) : (existing.tags || []);
        await persistSession({
          ...existing,
          note: note.trim() || existing.note,
          tags: mergedTags,
          reminderAt: reminderIso || existing.reminderAt,
          tabs: [...(existing.tabs || []), ...newTabs]
        });
        showNotice(newTabs.length ? `${newTabs.length} link${newTabs.length === 1 ? "" : "s"} added to ${existing.title}.` : "All current links are already saved.");
      } else {
        await persistSession({
          id: `sess_${Date.now()}`,
          title: trimmedTitle,
          note: note.trim(),
          tags: parsedTags,
          reminderAt: reminderIso,
          tabs: uniqueTabs,
          createdAt: new Date().toISOString(),
          order: sessions.length ? Math.max(...sessions.map((s) => s.order ?? 0)) + 1 : 0
        });
        showNotice(`${uniqueTabs.length} link${uniqueTabs.length === 1 ? "" : "s"} saved to your workspace.`);
      }

      setTitle("");
      setNote("");
      setTags("");
      setReminderAt("");
      setNewWorkspaceOpen(false);
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
    return (session.tabs || []).map((tab, index) => ({ tab, index })).filter(({ tab, index }) => selected.has(index) && Boolean(tab.url));
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
    setDeleteTarget({ type: "workspace", session });
  }

  function requestDeleteTab(session, tabIndex) {
    setDeleteTarget({ type: "link", session, tabIndex });
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
    try {
      new URL(trimmedUrl);
    } catch {
      showNotice("Enter a valid link URL.", "error");
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
      tags: linkTags.split(",").map((tag) => tag.trim()).filter(Boolean),
      reminderAt: linkReminderAt ? new Date(linkReminderAt).toISOString() : ""
    };

    await persistSession({ ...session, tabs: updatedTabs });
    await refresh();
    closeLinkEditor();
    showNotice("Link updated.");
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    const { type, session, tabIndex } = deleteTarget;
    setDeleteTarget(null);

    try {
      if (type === "workspace") {
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
        showNotice(`“${session.title}” deleted.`, "delete");
        return;
      }

      const updatedTabs = (session.tabs || []).filter((_, index) => index !== tabIndex);
      await persistSession({ ...session, tabs: updatedTabs });
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
      showNotice("Link deleted.", "delete");
    } catch (error) {
      console.error(error);
      showNotice(type === "workspace" ? "Unable to delete this workspace." : "Unable to delete this link.", "error");
    }
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

  async function handleQuickSave() {
    setSaving(true);
    try {
      const tabs = getUniqueTabs(await getCurrentTabs());
      if (!tabs.length) {
        showNotice("No valid tabs are open in this window.", "error");
        return;
      }

     const uniqueTitle = getUniqueWorkspaceName("Current Browser", sessions);

      await persistSession({
        id: `sess_${Date.now()}`,
        title: uniqueTitle,
        note: "",
        tabs,
        createdAt: new Date().toISOString(),
        order: sessions.length ? Math.max(...sessions.map((s) => s.order ?? 0)) + 1 : 0
      });

      showNotice(`${tabs.length} tabs saved as "${uniqueTitle}".`);
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  function getUniqueWorkspaceName(baseName, sessions) {
    const existingTitles = new Set(sessions.map((s) => s.title));

    if (!existingTitles.has(baseName)) {
      return baseName;
    }

    let counter = 1;
    let newName = `${baseName} ${counter}`;
    while (existingTitles.has(newName)) {
      counter += 1;
      newName = `${baseName} ${counter}`;
    }
    return newName;
  }

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
      showNotice("Enter a workspace name first.", "error");
      return;
    }

    const reminderIso = reminderAt ? new Date(reminderAt).toISOString() : "";
    const parsedTags = tags.split(",").map((tag) => tag.trim()).filter(Boolean);
    await persistSession({
      ...editingSession,
      title: nextTitle,
      note: note.trim(),
      tags: parsedTags,
      reminderAt: reminderIso
    });
    await refresh();
    showNotice("Workspace updated.");
    closeWorkspaceModal();
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
    showNotice(`“${session.title}” duplicated.`);
  }

  function renameWorkspace(session) {
    setEditingSession(session);
    setTitle(session.title || "");
    setNote(session.note || "");
    setTags(Array.isArray(session.tags) ? session.tags.join(", ") : session.tags || "");
    setReminderAt(session.reminderAt ? session.reminderAt.slice(0, 16) : "");
    setNewWorkspaceOpen(true);
  }

  async function handleReorder(sourceId, targetId) {
    if (!sourceId || !targetId || sourceId === targetId) return;

    const currentOrder = filteredSessions.map((s) => s.id);
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

  return (
    <div className="workspace-manager-popup">
      <div className="final-popup">
        <header className="final-header">
          <div className="final-brand"><span className="final-logo">W</span><strong>Workspace Manager</strong></div>
          <div className="final-header-actions">
            <button onClick={toggleTheme} type="button" aria-label="Toggle theme"><Icon name={theme === "dark" ? "sun" : "moon"} /></button>
            {/* add tooltip */}
            <button onClick={openFullManager} type="button" aria-label="Open dashboard" title="Open dashboard"><Icon name="external" /></button>
          </div>
        </header>

        <section className="current-browser">
        <div className="current-browser-row">
          <strong>Current Browser</strong>
          <span className="tab-dots">
            {currentTabs.slice(0, 3).map((tab, index) => {
              const fallback = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(
                tab.url || tab.title
              )}&sz=24`;

              return (
                <img
                  key={tab.id ?? index}
                  src={tab.favicon || fallback}
                  alt=""
                  className="tab-favicon"
                  onError={(e) => {
                    // agar original favicon fail ho, google's favicon service try karo
                    if (e.currentTarget.src !== fallback) {
                      e.currentTarget.src = fallback;
                    } else {
                      // fallback bhi fail ho to hi hide karo
                      e.currentTarget.style.display = "none";
                    }
                  }}
                />
              );
            })}

            {currentTabs.length > 3 && <small>+{currentTabs.length - 3}</small>}
          </span>
        </div>
          <span>{currentTabs.length} tabs open · Ready to save your current tabs</span>
          <button onClick={handleQuickSave} disabled={saving} type="button"><Icon name="plus" /> {saving ? "Saving…" : "Save Current Tabs"}</button>
        </section>

        <label className="final-search"><span><Icon name="search" /></span><input type="search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search workspaces, tabs, tags, notes... " /></label>

        <div className="final-section-heading"><span>My Workspaces</span><button onClick={openFullManager} type="button">View all →</button></div>
        <div className="final-workspace-list">
          {/* {loading && <div className="final-empty">Loading workspaces…</div>} */}
          {!loading && sessions.length === 0 && (
            <div className="final-empty-state">
              <div className="empty-bars" aria-hidden="true"><i /><i /><i /><i /></div>
              <strong>No workspaces yet</strong>
              <span>Save your current browser tabs and come back to them anytime.</span>
              {/* <button className="empty-save" onClick={handleQuickSave} disabled={saving} type="button"><Icon name="plus" /> Save Current Tabs</button>
              <button className="empty-create" onClick={openNewWorkspaceModal} type="button">Create New Workspace</button> */}
            </div>
          )}
          {!loading && sessions.length > 0 && filteredSessions.length === 0 && <div className="final-empty">No workspaces match your search.</div>}
          {filteredSessions.map((session, index) => (
            <article
                className={`final-workspace accent-${index % 6} ${expandedIds.has(session.id) ? "is-expanded" : ""} ${draggedId === session.id ? "is-dragging" : ""} ${dragOverId === session.id && draggedId !== session.id ? "is-drag-over" : ""}`}
                key={session.id}
                draggable
                onDragStart={() => setDraggedId(session.id)}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (dragOverId !== session.id) setDragOverId(session.id);
                }}
                onDragLeave={() => setDragOverId((current) => (current === session.id ? null : current))}
                onDrop={(event) => {
                  event.preventDefault();
                  handleReorder(draggedId, session.id);
                  setDraggedId(null);
                  setDragOverId(null);
                }}
                onDragEnd={() => {
                  setDraggedId(null);
                  setDragOverId(null);
                }}
              >
              <button
                className="final-workspace-trigger"
                onClick={() => toggleExpanded(session.id)}
                type="button"
                aria-expanded={expandedIds.has(session.id)}
              >
                <span className={`final-chevron ${expandedIds.has(session.id) ? "is-open" : ""}`} aria-hidden="true" />
                <span className="final-folder"><FolderIcon /></span>
                <span className="final-workspace-copy">
                  <strong>{session.title}</strong>
                  <span className="final-workspace-meta">{session.tabs?.length || 0} tabs · {session.lastOpenedAt ? `Updated ${formatDate(session.lastOpenedAt)}` : `Saved ${formatDate(session.createdAt)}`}</span>
                  {Array.isArray(session.tags) && session.tags.length > 0 && (
                    <span className="final-workspace-tags">
                      {session.tags.map((tag, tagIndex) => (
                        <span key={tagIndex} className="final-workspace-tag">#{tag}</span>
                      ))}
                    </span>
                  )}
                </span>
              </button>
              <div className="final-card-actions">
                <button className="final-delete" onClick={() => setOpenMenuId((current) => current === session.id ? null : session.id)} type="button" aria-label="Workspace actions"><Icon name="more" /></button>
              </div>
              {openMenuId === session.id && (
                <div className="final-menu" role="menu">
                  <button onClick={() => { setOpenMenuId(null); renameWorkspace(session); }} type="button"><Icon name="edit" /> <span>Edit Workspace</span></button>
                  <button onClick={() => { setOpenMenuId(null); duplicateWorkspace(session); }} type="button"><Icon name="copy" /> <span>Duplicate</span></button>
                  <button onClick={() => { setOpenMenuId(null); exportWorkspacesToCsv([session]); showNotice("Workspace exported as CSV."); }} type="button"><Icon name="download" /> <span>Export CSV</span></button>
                  <button className="is-danger" onClick={() => { setOpenMenuId(null); requestDeleteSession(session); }} type="button"><Icon name="trash" /> <span>Delete</span></button>
                </div>
              )}
              {expandedIds.has(session.id) && (
                <>
                  <div className="final-expanded-links">
                    {(session.tabs || []).length === 0 && <span className="final-no-links">No saved links in this workspace.</span>}
                    {(session.tabs || []).map((tab, tabIndex) => (
                      <div className="final-link-row" key={`${session.id}-${tabIndex}`}>
                        <input
                          type="checkbox"
                          checked={(selectedByWorkspace.get(session.id) || new Set()).has(tabIndex)}
                          onChange={(event) => toggleTabSelection(session.id, tabIndex, event.target.checked)}
                          aria-label={`Select ${tab.title || tab.url}`}
                        />
                        <button className="final-link-open" onClick={() => chrome.tabs.create({ url: tab.url, active: false })} type="button">
                          <LinkFavicon tab={tab} />
                          <span><strong>{tab.title || tab.url}</strong><small>{tab.url}</small></span>
                        </button>
                        <button className="final-link-edit" onClick={() => openLinkEditor(session, tabIndex)} type="button" aria-label="Edit link"><Icon name="edit" /></button>
                        <button className="final-link-delete" onClick={() => requestDeleteTab(session, tabIndex)} type="button" aria-label="Delete link"><Icon name="close" /></button>
                      </div>
                    ))}
                  </div>
                  <div className="final-expanded-actions">
                    <button className="is-primary" onClick={() => handleOpenAll(session)} type="button"><Icon name="external" /> Open All</button>
                    <button onClick={() => handleOpenNewWindow(session)} type="button"><Icon name="window" /> New Window</button>
                    <button onClick={() => handleOpenSelected(session)} type="button">Open Selected</button>
                    <button onClick={() => handleOpenSelectedNewWindow(session)} type="button">Selected New Window</button>
                    <button onClick={() => handleAddCurrentLinks(session)} type="button"><Icon name="plus" /> Add Current Links</button>
                    <button className="is-danger" onClick={() => requestDeleteSession(session)} type="button"><Icon name="trash" /> Delete Workspace</button>
                  </div>
                </>
              )}
            </article>
          ))}
        </div>

        {sessions.length > 0 && <button className="final-new-workspace" onClick={openNewWorkspaceModal} type="button"><Icon name="plus" /> New Workspace</button>}
        <footer className="final-footer"><span>{sessions.length} Workspaces</span></footer>
      </div>

      <header className="manager-header">
        <div className="manager-title-wrap">
          <div className="manager-icon" aria-hidden="true"><FolderIcon /></div>
          <h1>Workspace Manager</h1>
        </div>
        <div className="manager-header-actions">
          <span className="manager-count">{sessions.length}</span>
          <button className="theme-toggle" onClick={toggleTheme} type="button" aria-label="Toggle theme">
            <Icon name={theme === "dark" ? "sun" : "moon"} />
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

        <input
          className="manager-input"
          type="text"
          value={tags}
          onChange={(event) => setTags(event.target.value)}
          placeholder="Tags (comma separated, optional)..."
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

      {notice && <div className={`manager-notice is-${noticeTone}`} role="status">{notice}</div>}

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
                  {Array.isArray(session.tags) && session.tags.length > 0 && (
                    <span className="workspace-tags-row">
                      {session.tags.map((tag, tIdx) => (
                        <span key={tIdx} className="workspace-tag-chip">#{tag}</span>
                      ))}
                    </span>
                  )}
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
                        <button className="link-delete" onClick={() => requestDeleteTab(session, index)} type="button" aria-label="Delete link"><Icon name="close" /></button>
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

      {deleteTarget && (
        <div className="confirm-backdrop" onClick={() => setDeleteTarget(null)} role="presentation">
          <section className="confirm-dialog" onClick={(event) => event.stopPropagation()} role="alertdialog" aria-modal="true" aria-labelledby="delete-dialog-title">
            <h2 id="delete-dialog-title">Delete {deleteTarget.type === "workspace" ? "workspace" : "link"}?</h2>
            <p>
              {deleteTarget.type === "workspace"
                ? `“${deleteTarget.session.title}” and all its saved links will be permanently removed.`
                : "This saved link will be permanently removed from the workspace."}
            </p>
            <div className="confirm-actions">
              <button className="confirm-cancel" onClick={() => setDeleteTarget(null)} type="button">Cancel</button>
              <button className="confirm-delete" onClick={confirmDelete} type="button">Delete</button>
            </div>
          </section>
        </div>
      )}

      {newWorkspaceOpen && (
        <div className="new-workspace-backdrop" onClick={closeWorkspaceModal} role="presentation">
          <form className="new-workspace-dialog" onClick={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); saveWorkspaceModal(); }}>
            <div className="new-workspace-title-row">
              <div><h2>{editingSession ? "Edit Workspace" : "New Workspace"}</h2><p>{editingSession ? "Update this workspace’s details." : "Save your current browser tabs in one place."}</p></div>
              <button onClick={closeWorkspaceModal} type="button" aria-label="Close"><Icon name="close" /></button>
            </div>
            <label>Workspace name<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Design research" autoFocus /></label>
            <label>Tags <span>(comma separated, optional)</span><input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="e.g. work, research, urgent" /></label>
            <label>Note <span>(optional)</span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="What is this workspace for?" rows="3" /></label>
            <label>Reminder <span>(optional)</span><input type="datetime-local" value={reminderAt} onChange={(event) => setReminderAt(event.target.value)} /></label>
            <div className="new-workspace-actions">
              <button className="new-workspace-cancel" onClick={closeWorkspaceModal} type="button">Cancel</button>
              <button className="new-workspace-save" disabled={saving} type="submit">{saving ? "Saving…" : editingSession ? "Save Changes" : "Save Workspace"}</button>
            </div>
          </form>
        </div>
      )}

      {editingLink && (
        <div className="new-workspace-backdrop" onClick={closeLinkEditor} role="presentation">
          <form className="new-workspace-dialog link-edit-dialog" onClick={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); saveLinkEditor(); }}>
            <div className="new-workspace-title-row">
              <div><h2>Edit Link</h2><p>Update this saved link's details.</p></div>
              <button onClick={closeLinkEditor} type="button" aria-label="Close"><Icon name="close" /></button>
            </div>
            <label>Title<input value={linkTitle} onChange={(event) => setLinkTitle(event.target.value)} placeholder="Link title" autoFocus /></label>
            <label>URL<input type="url" value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder="https://example.com" /></label>
            <label>Notes <span>(optional)</span><textarea value={linkNote} onChange={(event) => setLinkNote(event.target.value)} placeholder="What is this link for?" rows="3" /></label>
            <label>Tags <span>(comma separated)</span><input value={linkTags} onChange={(event) => setLinkTags(event.target.value)} placeholder="research, priority" /></label>
            <label>Reminder <span>(optional)</span><input type="datetime-local" value={linkReminderAt} onChange={(event) => setLinkReminderAt(event.target.value)} /></label>
            <div className="new-workspace-actions">
              <button className="new-workspace-cancel" onClick={closeLinkEditor} type="button">Cancel</button>
              <button className="new-workspace-save" type="submit">Save Changes</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Icon({ name }) {
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
    window: <><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M4 9h16M8 7h.01" /></>
  };

  return <svg className="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
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
