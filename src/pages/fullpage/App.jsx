import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { moveWorkspace, moveLink } from "../../lib/dragDrop";
import { beginPointerDrag } from "../../lib/pointerDrag";
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
import TagInput from "./components/TagInput";
import { normalizeTag, parseTags } from "../../lib/tags";
import SearchResults from "./components/SearchResults";
import ConfirmDialog from "./components/ConfirmDialog";
import Toast from "./components/Toast";
import ReminderStack from "./components/ReminderStack";
import ReminderSummary from "./components/ReminderSummary";
import RemindersPage from "./components/RemindersPage";
import { collectReminders, toLocalDateTime, getReminderMinDate, isValidReminderDate } from "../../lib/reminders";
import { Icon, LinkFavicon } from "./components/Icons";

export default function App({ popup = false }) {
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
  const [sortKey, setSortKey] = useState("manual");

  // UI state
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [selectedByWorkspace, setSelectedByWorkspace] = useState(() => new Map());
  const [openMenuId, setOpenMenuId] = useState(null);
  const [theme, setTheme] = useState("light");
  const [now, setNow] = useState(Date.now);
  const reminderMinDate = getReminderMinDate(now);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = setInterval(tick, 15000);
    window.addEventListener("focus", tick);
    return () => { clearInterval(timer); window.removeEventListener("focus", tick); };
  }, []);

  // Drag & drop
  const [dragItem, setDragItem] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const dragRef = useRef(null);
  const dropRef = useRef(null);
  const movingRef = useRef(false);
  const pointerCleanup = useRef(null);

  useEffect(() => () => pointerCleanup.current?.(), []);

  // New / Edit workspace modal
  const [newWorkspaceOpen, setNewWorkspaceOpen] = useState(false);
  const [editingSession, setEditingSession] = useState(null);

  // Edit link modal
  const [editingLink, setEditingLink] = useState(null);
  const isAddingLink = editingLink?.tabIndex === -1;
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
    if (movingRef.current) return;
    const data = await getSessions();
    if (movingRef.current) return;
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
    const isTagSearch = trimmed.startsWith("#") && normalizeTag(trimmed).length > 0;
    if (trimmed.length < 3 && !isTagSearch) {
      const t = setTimeout(() => setActiveSearch(""), 0);
      return () => clearTimeout(t);
    }
    if (trimmed.length >= 3 || isTagSearch) {
      const t = setTimeout(() => setActiveSearch(trimmed.toLowerCase()), 220);
      return () => clearTimeout(t);
    }
  }, [searchInput]);

  // Close 3-dot menu on outside click
  useEffect(() => {
    if (!openMenuId) return undefined;
    function close(event) {
      if (!event.target.closest(".modern-more-menu-container")) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [openMenuId]);

  const dueReminders = useMemo(() => {
    return sessions
      .filter((s) => s.reminderAt && Date.parse(s.reminderAt) <= now)
      .sort((a, b) => Date.parse(b.reminderAt) - Date.parse(a.reminderAt));
  }, [sessions, now]);

  const reminders = useMemo(() => collectReminders(sessions), [sessions]);

  async function updateReminder(reminder, nextTime) {
    try {
      const session = sessions.find((item) => item.id === reminder.session.id);
      if (!session) return;
      const updated = reminder.tabIndex === null
        ? { ...session, reminderAt: nextTime }
        : { ...session, tabs: session.tabs.map((tab, index) => index === reminder.tabIndex ? { ...tab, reminderAt: nextTime } : tab) };
      await persistSession(updated);
      await refresh();
      setNow(Date.now());
      showToast(nextTime ? "Reminder snoozed for 1 hour." : "Reminder removed.");
    } catch (error) {
      console.error("Could not update reminder:", error);
      showToast("Could not update reminder. Please try again.");
    }
  }

  async function openReminder(reminder) {
    try {
      if (reminder.tabIndex === null) await handleOpenAll(reminder.session);
      else await handleOpenTab(reminder.session, reminder.tabIndex);
    } catch (error) {
      console.error("Could not open reminder:", error);
      showToast("Could not open saved links. Please try again.");
    }
  }

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

  function validateReminder(value) {
    if (isValidReminderDate(value)) return true;
    showToast("Choose a reminder date of today or later.");
    return false;
  }

  async function handleSave() {
    if (!validateReminder(reminderAt)) return;
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
      const parsedTags = parseTags(tags);
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

  async function handleAddCurrentLinks(session) {
    try {
      const current = await getCurrentTabs();
      const existingKeys = new Set((session.tabs || []).map((tab) => getLinkKey(tab.url)));
      const added = getUniqueTabs(current).filter((tab) => !existingKeys.has(getLinkKey(tab.url)));
      if (!added.length) {
        showToast(current.length ? "All open links are already in this workspace." : "No valid links are open in this window.");
        return;
      }
      await persistSession({ ...session, tabs: [...(session.tabs || []), ...added] });
      await refresh();
      showToast(`${added.length} link${added.length === 1 ? "" : "s"} added to "${session.title}".`);
    } catch (error) {
      console.error("Could not add current links:", error);
      showToast("Could not add current links. Please try again.");
    }
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

  function requestDeleteSelected(session) {
    const selected = new Set(selectedByWorkspace.get(session.id) || []);
    const tabs = session.tabs || [];
    const count = tabs.filter((_, index) => selected.has(index)).length;
    if (!count) return showToast("Select at least one link first.");

    let deleting = false;
    setConfirmState({
      title: `Delete ${count} selected link${count === 1 ? "" : "s"}?`,
      message: `The selected links will be permanently removed from "${session.title}".`,
      onConfirm: async () => {
        if (deleting) return;
        deleting = true;
        try {
          await persistSession({ ...session, tabs: tabs.filter((_, index) => !selected.has(index)) });
          setSelectedByWorkspace((prev) => {
            const next = new Map(prev);
            next.delete(session.id);
            return next;
          });
          setOpenMenuId(null);
          setConfirmState(null);
          await refresh();
          showToast(`${count} link${count === 1 ? "" : "s"} deleted.`);
        } catch (error) {
          console.error("Failed to delete selected links:", error);
          showToast("Could not delete selected links. Please try again.");
        } finally {
          deleting = false;
        }
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
    if (!validateReminder(reminderAt)) return;
    const nextTitle = title.trim();
    if (!nextTitle) {
      showToast("Enter a workspace name first.");
      return;
    }
    const reminderIso = reminderAt ? new Date(reminderAt).toISOString() : "";
    const parsedTags = parseTags(tags);

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
    setReminderAt(toLocalDateTime(session.reminderAt));
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
    setLinkReminderAt(toLocalDateTime(tab.reminderAt));
  }

  function closeLinkEditor() {
    setEditingLink(null);
  }

  async function saveLinkEditor() {
    if (!editingLink) return;
    if (!validateReminder(linkReminderAt)) return;
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
        tags: parseTags(linkTags),
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
      tags: parseTags(linkTags),
      reminderAt: linkReminderAt ? new Date(linkReminderAt).toISOString() : ""
    };
    await persistSession({ ...session, tabs: updatedTabs });
    await refresh();
    closeLinkEditor();
    showToast("Link updated.");
  }

  // ── Drag & drop ───────────────────────────────────────────────────────────

  function endDrag() {
    dragRef.current = null;
    dropRef.current = null;
    setDragItem(null);
    setDropTarget(null);
  }

  function startDrag(event, item, label) {
    event.stopPropagation();
    if (movingRef.current) { event.preventDefault(); return; }
    dragRef.current = item;
    setDragItem(item);
    setOpenMenuId(null);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-workspace-manager", JSON.stringify(item));
    const preview = document.createElement("div");
    preview.className = "modern-drag-preview";
    preview.textContent = `${item.type === "workspace" ? "Workspace" : "Link"} · ${label}`;
    document.body.appendChild(preview);
    event.dataTransfer.setDragImage(preview, 24, 22);
    setTimeout(() => preview.remove(), 0);
  }

  function startPointerDrag(event, item, label) {
    if (movingRef.current || event.button !== 0 || event.isPrimary === false) return;
    event.stopPropagation();
    pointerCleanup.current?.();
    pointerCleanup.current = beginPointerDrag(event, {
      item,
      label,
      onStart: () => {
        dragRef.current = item;
        setDragItem(item);
        setOpenMenuId(null);
      },
      onTarget: (target) => {
        dropRef.current = target;
        setDropTarget(target);
      },
      onFinish: (target) => {
        endDrag();
        if (target) void commitDrop(item, target);
      },
    });
  }

  function hoverDrop(event, sessionId, tabIndex) {
    const item = dragRef.current;
    if (!item) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    const rect = event.currentTarget.getBoundingClientRect();
    const after = event.clientY > rect.top + rect.height / 2;
    const target = item.type === "workspace"
      ? { sessionId, edge: after ? "after" : "before" }
      : { sessionId, index: tabIndex == null
        ? (sessions.find((session) => session.id === sessionId)?.tabs?.length || 0)
        : tabIndex + (after ? 1 : 0) };
    dropRef.current = target;
    setDropTarget((previous) => previous?.sessionId === target.sessionId && previous?.edge === target.edge && previous?.index === target.index ? previous : target);
  }

  async function commitDrop(item, target) {
    if (!item || !target || movingRef.current) return;
    let updates;
    let moved;
    if (item.type === "workspace") {
      const ordered = activeNav === "recent"
        ? [...sessions].sort((a, b) => Date.parse(b.lastOpenedAt || b.createdAt || 0) - Date.parse(a.lastOpenedAt || a.createdAt || 0))
        : sortSessions(sessions, sortKey);
      updates = moveWorkspace(ordered, displayedSessions.map((session) => session.id), item.sessionId, target.sessionId, target.edge);
    } else {
      moved = moveLink(sessions, selectedByWorkspace, item.sessionId, item.index, target.sessionId, target.index);
      updates = moved?.updates;
    }
    if (!updates) return;
    movingRef.current = true;
    const updateMap = new Map(updates.map((session) => [session.id, session]));
    setSessions((previous) => previous.map((session) => updateMap.get(session.id) || session));
    if (moved) {
      setSelectedByWorkspace(moved.selections);
      setExpandedIds((previous) => new Set([...previous, target.sessionId]));
    } else {
      setSortKey("manual");
      setActiveNav("all");
    }
    try {
      // Save the destination first: a failed write must never lose a moved link.
      for (const session of updates) await persistSession(session);
      showToast(moved
        ? item.sessionId === target.sessionId ? "Link order saved." : `Link moved to "${updateMap.get(target.sessionId).title}".`
        : "Workspace order saved.");
      return true;
    } catch (error) {
      console.error("Could not save movement:", error);
      setSelectedByWorkspace(new Map());
      showToast("Could not finish saving the move. Please check the saved order and destination.");
    } finally {
      movingRef.current = false;
      try {
        await refresh();
      } catch (error) {
        console.error("Could not reload saved workspaces:", error);
        showToast("Could not reload saved workspaces. Please reload the page.");
      }
    }
  }

  function handleDrop(event) {
    if (!dragRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    const item = dragRef.current;
    const target = dropRef.current;
    endDrag();
    void commitDrop(item, target);
  }

  async function keyboardMove(event, session, tabIndex) {
    if (!event.altKey || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const direction = event.key === "ArrowUp" ? -1 : 1;
    if (tabIndex != null) {
      const card = event.currentTarget.closest(".modern-ws-card");
      const index = tabIndex + (direction > 0 ? 2 : -1);
      const saved = await commitDrop({ type: "link", sessionId: session.id, index: tabIndex }, { sessionId: session.id, index });
      if (saved) requestAnimationFrame(() => card?.querySelectorAll(".modern-link-drag-handle")[tabIndex + direction]?.focus());
    } else {
      const neighbor = displayedSessions[displayedSessions.findIndex((entry) => entry.id === session.id) + direction];
      if (neighbor) void commitDrop({ type: "workspace", sessionId: session.id }, { sessionId: neighbor.id, edge: direction > 0 ? "after" : "before" });
    }
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

  async function openFullManager() {
    await chrome.tabs.create({ url: chrome.runtime.getURL("src/pages/fullpage/index.html") });
    window.close();
  }

  function searchByTag(tag) {
    const normalized = normalizeTag(tag);
    if (!normalized) return;
    const query = `#${normalized}`;
    setActiveNav("all");
    setSearchInput(query);
    setActiveSearch(query.toLowerCase());
    setOpenMenuId(null);
  }

  const renderWorkspace = (session, index) => (
    <WorkspaceCard
      key={session.id}
      session={session}
      popup={popup}
      searchQuery={!popup ? activeSearch : ""}
      onTagClick={searchByTag}
      index={index}
      expanded={expandedIds.has(session.id)}
      selectedIndexes={selectedByWorkspace.get(session.id) || new Set()}
      openMenuId={openMenuId}
      setOpenMenuId={setOpenMenuId}
      pointerDrag={popup}
      onPointerDragStart={(event, tabIndex) => startPointerDrag(event, tabIndex == null
        ? { type: "workspace", sessionId: session.id }
        : { type: "link", sessionId: session.id, index: tabIndex }, tabIndex == null ? session.title : session.tabs[tabIndex].title || session.tabs[tabIndex].url)}
      dragItem={dragItem}
      dropTarget={dropTarget?.sessionId === session.id ? dropTarget : null}
      onDragStart={(event, tabIndex) => startDrag(event, tabIndex == null
        ? { type: "workspace", sessionId: session.id }
        : { type: "link", sessionId: session.id, index: tabIndex }, tabIndex == null ? session.title : session.tabs[tabIndex].title || session.tabs[tabIndex].url)}
      onDragOver={(event, tabIndex) => hoverDrop(event, session.id, tabIndex)}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget) && dropRef.current?.sessionId === session.id) {
          dropRef.current = null;
          setDropTarget(null);
        }
      }}
      onDrop={handleDrop}
      onDragEnd={endDrag}
      onKeyboardMove={(event, tabIndex) => keyboardMove(event, session, tabIndex)}
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
      onDeleteSelected={() => requestDeleteSelected(session)}
      onAddCurrentLinks={() => handleAddCurrentLinks(session)}
      getFaviconUrl={getFaviconUrl}
    />
  );

  const searchField = (
    <div className="modern-topbar-search">
      <Icon name="search" />
      <input
        className="modern-search-input"
        aria-label={activeNav === "reminders" ? "Search reminders" : "Search workspaces and tabs"}
        placeholder={activeNav === "reminders" ? "Search reminders..." : "Search workspaces and tabs..."}
        value={searchInput}
        onChange={(event) => setSearchInput(event.target.value)}
      />
      {searchInput && <button className="search-clear" type="button" aria-label="Clear search" onClick={() => { setSearchInput(""); setActiveSearch(""); }}><Icon name="close" /></button>}
    </div>
  );

  return (
    <div className={`modern-app-shell${popup ? " modern-popup-shell" : ""}`}>
      {/* ── Left Sidebar ── */}
      <aside className="modern-sidebar">
        <div className="modern-brand">
          <span className="modern-brand-logo">W</span>
          <span className="modern-brand-text">TabMorrow</span>
          {popup && (
            <div className="modern-popup-header-actions">
              <button className="modern-theme-btn" type="button" onClick={toggleTheme} aria-label="Toggle theme" title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
                <Icon name="settings" />
              </button>
              <button className="modern-theme-btn" type="button" onClick={openFullManager} aria-label="Open full view" title="Open full view">
                <Icon name="external" />
              </button>
            </div>
          )}
        </div>

        {!popup && <nav className="modern-nav" aria-label="Workspace navigation">
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

          <button className={`modern-nav-item ${activeNav === "reminders" ? "is-active" : ""}`} onClick={() => { setActiveNav("reminders"); setSearchInput(""); setActiveSearch(""); }} type="button">
            <span className="modern-nav-icon"><Icon name="reminderbell" /></span>
            <span className="modern-nav-text">Reminders</span>
          </button>

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
        </nav>}

        {/* Bottom Extension Card */}
        {!popup && <div className="modern-sidebar-card">
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
        </div>}
      </aside>

      {/* ── Main Page Content ── */}
      <div className="modern-main-container">
        {/* Topbar */}
        {!popup && <header className="modern-topbar">
          {searchField}

          <div className="modern-topbar-actions">
            <button
              className="modern-btn-outline"
              onClick={openNewWorkspaceModal}
              type="button"
            >
              <Icon name="plus" /> New Workspace
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
        </header>}

        <main className="modern-content">
          {activeNav === "reminders" ? <RemindersPage
            reminders={reminders}
            now={now}
            search={searchInput.trim().toLowerCase()}
            loading={loading}
            onBack={() => { setActiveNav("all"); setSearchInput(""); setActiveSearch(""); }}
            onClearSearch={() => { setSearchInput(""); setActiveSearch(""); }}
            onOpen={openReminder}
            onSnooze={(reminder) => updateReminder(reminder, new Date(Date.now() + 60 * 60 * 1000).toISOString())}
            onRemove={(reminder) => updateReminder(reminder, "")}
            onEdit={(reminder) => reminder.tabIndex === null ? renameWorkspace(reminder.session) : openLinkEditor(reminder.session, reminder.tabIndex)}
          /> : !popup && activeSearch ? <SearchResults
            key={activeSearch}
            query={activeSearch}
            sessions={displayedSessions}
            loading={loading}
            renderWorkspace={renderWorkspace}
            onTagClick={searchByTag}
            onOpenTab={handleOpenTab}
            onShowWorkspace={(sessionId) => {
              setExpandedIds((previous) => new Set(previous).add(sessionId));
              requestAnimationFrame(() => {
                const card = [...document.querySelectorAll(".search-workspace-list [data-workspace-id]")].find((element) => element.dataset.workspaceId === sessionId);
                card?.scrollIntoView({ behavior: "smooth", block: "center" });
                card?.querySelector(".modern-ws-info")?.focus({ preventScroll: true });
              });
            }}
            getFaviconUrl={getFaviconUrl}
          /> : <>
          {/* Header */}
          {!popup && <div className="modern-page-header">
            <span className="modern-eyebrow">WORKSPACE LIBRARY</span>
            <h1 className="modern-main-heading">All Workspaces</h1>
            <p className="modern-subtitle">
              Save what you're doing now. Reopen it whenever you need it.
            </p>
          </div>}

          {/* Due Reminders */}
          {popup && <ReminderStack reminders={dueReminders} onDismiss={dismissReminder} />}

          {/* 3 Metric Summary Cards Row */}
          <section className="modern-summary-grid">
            {/* Card 1: Current Browser */}
            <div className="modern-summary-card is-browser">
              <div className="modern-browser-header">
                <strong>Current Browser</strong>
                <div className="modern-browser-favicons">
                  {currentTabs.slice(0, 5).map((tab, idx) => (
                    <LinkFavicon key={tab.url || tab.id || idx} tab={tab} getFaviconUrl={getFaviconUrl} />
                  ))}
                  {currentTabs.length > 5 && (
                    <span className="modern-favicons-extra">+{currentTabs.length - 5}</span>
                  )}
                </div>
              </div>

              <span className="modern-browser-meta">
                {currentTabs.length} tabs open{!popup && " · Ready to save"}
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
            {!popup && <>
            <div className="modern-summary-card">
              <span className="modern-card-stat-label">Workspaces</span>
              <div className="modern-card-stat-val">{sessions.length}</div>
              <span className="modern-card-stat-sub">
                {sessions.length === 0 ? "Ready for your first workspace" : `${updatedThisWeekCount} updated this week`}
              </span>
            </div>

            {/* Card 3: Saved tabs */}
            <div className="modern-summary-card">
              <span className="modern-card-stat-label">Saved tabs</span>
              <div className="modern-card-stat-val">{totalSavedTabs}</div>
              <span className="modern-card-stat-sub">Across all workspaces</span>
            </div>
            <ReminderSummary reminders={reminders} now={now} onOpen={() => { setActiveNav("reminders"); setSearchInput(""); setActiveSearch(""); }} />
            </>}
          </section>

          {popup && <div className="modern-popup-search">{searchField}</div>}

          {/* Workspaces Section */}
          <section className="modern-workspaces-section">
            <div className="modern-section-header">
              <div>
                <h2 className="modern-section-title">My Workspaces</h2>
                {!popup && <span className="modern-section-meta">
                  {displayedSessions.length} of {sessions.length} workspaces
                </span>}
              </div>

              {popup ? (
                <button className="modern-card-link" onClick={openFullManager} type="button">View all <Icon name="arrowRight" /></button>
              ) : <button
                className="modern-empty-ws-btn"
                onClick={openEmptyWorkspaceModal}
                type="button"
              >
                <Icon name="plus" /> Create Empty Workspace
              </button>}
            </div>

            {(!popup || dragItem) && <div className={`modern-drag-hint ${dragItem ? "is-active" : ""}`} role="status">
              <Icon name={dragItem ? "move" : "grip"} />
              <span>{dragItem?.type === "link" ? "Drop between links to reorder, or into another workspace to move." : dragItem ? "Drop above or below a workspace to reorder." : "Drag to organize workspaces and move links between them."}</span>
            </div>}
            {/* List */}
            <div className="modern-workspace-stack">
              {loading && <div className="final-empty">Loading workspaces…</div>}

              {!loading && sessions.length === 0 && (
                <section className="workspace-empty-state" aria-labelledby="workspace-empty-title">
                  <svg className="workspace-empty-art" viewBox="0 0 144 104" fill="none" aria-hidden="true">
                    <ellipse cx="72" cy="94" rx="53" ry="6" fill="var(--empty-art-shadow)" />
                    <rect x="12" y="29" width="91" height="61" rx="8" transform="rotate(-7 12 29)" fill="var(--empty-art-back)" stroke="var(--empty-art-border)" />
                    <g transform="rotate(6 83 46)">
                      <rect x="43" y="11" width="86" height="67" rx="8" fill="var(--empty-art-front)" stroke="var(--empty-art-border)" />
                      <path d="M44 29H128" stroke="var(--empty-art-border)" />
                      <rect x="52" y="18" width="16" height="4" rx="2" fill="#a78bfa" />
                      <rect x="73" y="18" width="12" height="4" rx="2" fill="#2dd4bf" />
                      <rect x="90" y="18" width="9" height="4" rx="2" fill="#fbbf24" />
                      <rect x="54" y="39" width="53" height="4" rx="2" fill="var(--empty-art-line)" />
                      <rect x="54" y="49" width="39" height="4" rx="2" fill="var(--empty-art-line)" />
                      <rect x="54" y="59" width="47" height="4" rx="2" fill="var(--empty-art-line)" />
                    </g>
                    <rect x="57" y="62" width="38" height="36" rx="11" fill="#8b5cf6" />
                    <rect x="67" y="72" width="18" height="15" rx="3" stroke="white" strokeWidth="1.5" />
                    <path d="M67 77H85M71 74.5H73" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <h3 id="workspace-empty-title">No workspaces yet</h3>
                  <p>Save your open tabs as a workspace, or create an empty one and add links later.</p>
                  <div className="workspace-empty-actions">
                    <button className="workspace-empty-save" onClick={handleQuickSave} disabled={saving} type="button">
                      <Icon name="plus" /> {saving ? "Saving…" : "Save Current Tabs"}
                    </button>
                    <button className="workspace-empty-create" onClick={openEmptyWorkspaceModal} type="button">
                      Create Workspace
                    </button>
                  </div>
                </section>
              )}

              {!loading && sessions.length > 0 && displayedSessions.length === 0 && (
                <div className="final-empty">No workspaces match your search.</div>
              )}

              {displayedSessions.map(renderWorkspace)}
            </div>
          </section>

          {popup && (
            <div className="modern-popup-create-actions">
              <button className="modern-btn-outline" onClick={openNewWorkspaceModal} type="button"><Icon name="plus" /> New Workspace</button>
              <button className="modern-empty-ws-btn" onClick={openEmptyWorkspaceModal} type="button"><Icon name="plus" /> Create Empty Workspace</button>
            </div>
          )}

          <footer className="modern-footer">
            <span>{sessions.length} workspace{sessions.length === 1 ? "" : "s"} · {totalSavedTabs} saved tabs</span>
          </footer>
          </>}
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
            <TagInput value={tags} onChange={setTags} />
            <label>Note <span>(optional)</span><textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What is this workspace for?" rows="3" /></label>
            <label>Reminder <span>(optional)</span><input type="datetime-local" min={reminderMinDate} value={reminderAt} onChange={(e) => setReminderAt(e.target.value)} /></label>
            <div className="new-workspace-actions">
              <button className="new-workspace-cancel" onClick={closeWorkspaceModal} type="button">Cancel</button>
              <button className="new-workspace-save" disabled={saving} type="submit">
                {saving ? "Saving…" : editingSession ? "Save Changes" : "Save Workspace"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Add / Edit link modal ── */}
      {editingLink && (
        <div className="new-workspace-backdrop" onClick={closeLinkEditor} role="presentation">
          <form
            className="new-workspace-dialog link-edit-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="link-dialog-title"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => { e.preventDefault(); saveLinkEditor(); }}
          >
            <div className="new-workspace-title-row">
              <div>
                <h2 id="link-dialog-title">{isAddingLink ? "Add Link" : "Edit Link"}</h2>
                <p>{isAddingLink ? `Add a new link to "${editingLink.session.title}".` : "Update this saved link's details."}</p>
              </div>
              <button onClick={closeLinkEditor} type="button" aria-label="Close"><Icon name="close" /></button>
            </div>
            <label>Title<input value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} placeholder="Link title" autoFocus /></label>
            <label>URL<input type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://example.com" /></label>
            <label>Notes <span>(optional)</span><textarea value={linkNote} onChange={(e) => setLinkNote(e.target.value)} placeholder="What is this link for?" rows="3" /></label>
            <TagInput key={`${editingLink.session.id}:${editingLink.tabIndex}`} value={linkTags} onChange={setLinkTags} />
            <label>Reminder <span>(optional)</span><input type="datetime-local" min={reminderMinDate} value={linkReminderAt} onChange={(e) => setLinkReminderAt(e.target.value)} /></label>
            <div className="new-workspace-actions">
              <button className="new-workspace-cancel" onClick={closeLinkEditor} type="button">Cancel</button>
              <button className="new-workspace-save" type="submit">{isAddingLink ? "Add Link" : "Save Changes"}</button>
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
