import { useEffect, useMemo, useState } from "react";
import { Icon, LinkFavicon } from "./Icons";
import TabIndicators from "./TabIndicators";
import TagList from "./TagList";
import "./WorkspaceDetail.css";

const SORT_OPTIONS = [
  ["manual", "Manual order"],
  ["date", "Date saved"],
  ["name", "Name"],
  ["lastOpened", "Last opened"],
  ["tags", "Tags"],
  ["notes", "Notes"],
  ["reminder", "Reminder"],
];

function getDomain(url = "") {
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch { return url; }
}

function formatUpdated(session) {
  const value = session.lastOpenedAt || session.createdAt;
  if (!value || !Number.isFinite(Date.parse(value))) return "";
  const days = Math.floor((Date.now() - Date.parse(value)) / 86400000);
  if (days <= 0) return "Updated today";
  if (days === 1) return "Updated yesterday";
  if (days < 7) return `Updated ${days} days ago`;
  return `Updated ${new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

export default function WorkspaceDetail({
  session, selectedIndexes, openMenuId, setOpenMenuId, openBehavior,
  onBack, onOpenAll, onOpenAllCurrent, onOpenAllNewWindow,
  onAddCurrentLinks, onAddLink, onEditSession, onDuplicateSession,
  onExportSession, onArchiveSession, onDeleteSession,
  onToggleTabSelection, onClearSelection, onOpenTab, onEditTab, onDeleteTab,
  onOpenSelected, onOpenSelectedNewWindow, onDeleteSelected, onReorder,
  getFaviconUrl,
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("manual");
  const [filter, setFilter] = useState("all");
  const [menu, setMenu] = useState(null);
  const [dragIndex, setDragIndex] = useState(null);
  const tabs = Array.isArray(session.tabs) ? session.tabs : [];
  const selectedCount = tabs.filter((_, index) => selectedIndexes.has(index)).length;
  const allVisible = useMemo(() => {
    const search = query.trim().toLowerCase();
    const rows = tabs.map((tab, index) => ({ tab, index })).filter(({ tab }) => {
      if (filter === "tagged" && !tab.tags?.length) return false;
      if (filter === "notes" && !tab.note?.trim()) return false;
      if (filter === "reminders" && !Number.isFinite(Date.parse(tab.reminderAt))) return false;
      if (!search) return true;
      return [tab.title, tab.url, tab.note, ...(tab.tags || [])].some((part) => String(part || "").toLowerCase().includes(search));
    });
    if (sort === "name") rows.sort((a, b) => (a.tab.title || a.tab.url || "").localeCompare(b.tab.title || b.tab.url || ""));
    if (sort === "date") rows.sort((a, b) => (Date.parse(b.tab.createdAt || b.tab.savedAt) || 0) - (Date.parse(a.tab.createdAt || a.tab.savedAt) || 0) || b.index - a.index);
    if (sort === "lastOpened") rows.sort((a, b) => (Date.parse(b.tab.lastVisitedAt) || 0) - (Date.parse(a.tab.lastVisitedAt) || 0));
    if (sort === "tags") rows.sort((a, b) => (a.tab.tags || []).join(", ").localeCompare((b.tab.tags || []).join(", ")));
    if (sort === "notes") rows.sort((a, b) => (a.tab.note || "").localeCompare(b.tab.note || ""));
    if (sort === "reminder") rows.sort((a, b) => (Date.parse(a.tab.reminderAt) || Infinity) - (Date.parse(b.tab.reminderAt) || Infinity));
    return rows;
  }, [tabs, query, sort, filter]);

  useEffect(() => {
    if (!menu) return;
    const close = (event) => { if (!event.target.closest(".workspace-detail-menu-anchor")) setMenu(null); };
    const escape = (event) => { if (event.key === "Escape") setMenu(null); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [menu]);

  function choose(action) { setMenu(null); action(); }
  function toggle(name) { setMenu((previous) => previous === name ? null : name); }

  return <section className="workspace-detail" aria-labelledby="workspace-detail-title">
    <button className="workspace-detail-back" type="button" onClick={onBack}><span aria-hidden="true">←</span> Back to All Workspaces</button>

    <div className="workspace-detail-heading">
      <div className="workspace-detail-heading-text">
        <h1 id="workspace-detail-title">{session.title}</h1>
        <p>{tabs.length} tab{tabs.length === 1 ? "" : "s"}{formatUpdated(session) && <> <span aria-hidden="true">·</span> {formatUpdated(session)}</>}</p>
        {session.tags?.length > 0 && <div className="workspace-detail-workspace-tags">{session.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
        {session.note && <p className="workspace-detail-note">{session.note}</p>}
      </div>
      <div className="workspace-detail-heading-actions">
        <div className="workspace-detail-menu-anchor">
          <div className="workspace-detail-split">
            <button className="workspace-detail-primary" type="button" onClick={onOpenAll}>Open All</button>
            <button className="workspace-detail-primary workspace-detail-split-arrow" type="button" aria-label="Open all options" aria-expanded={menu === "open"} onClick={() => toggle("open")}><Icon name="chevron-down" /></button>
          </div>
          {menu === "open" && <div className="workspace-detail-menu" role="menu">
            <button type="button" role="menuitem" onClick={() => choose(onOpenAllCurrent)}><Icon name="external" /> Open in current window</button>
            <button type="button" role="menuitem" onClick={() => choose(onOpenAllNewWindow)}><Icon name="window" /> Open in new window</button>
          </div>}
        </div>
        <button className="workspace-detail-button" type="button" onClick={onAddCurrentLinks}><Icon name="restore" /> Update With Current Tabs</button>
        <button className="workspace-detail-button" type="button" onClick={onAddLink}><Icon name="plus" /> Add Tab</button>
        <div className="workspace-detail-menu-anchor">
          <button className="workspace-detail-icon-button" type="button" aria-label="Workspace options" aria-expanded={menu === "workspace"} onClick={() => toggle("workspace")}><Icon name="more" /></button>
          {menu === "workspace" && <div className="workspace-detail-menu" role="menu">
            <button type="button" role="menuitem" onClick={() => choose(onEditSession)}><Icon name="edit" /> Edit workspace</button>
            <button type="button" role="menuitem" onClick={() => choose(onDuplicateSession)}><Icon name="copy" /> Duplicate</button>
            <button type="button" role="menuitem" onClick={() => choose(onExportSession)}><Icon name="download" /> Export CSV</button>
            <button type="button" role="menuitem" onClick={() => choose(onArchiveSession)}><Icon name="archive" /> Archive workspace</button>
            <button className="is-danger" type="button" role="menuitem" onClick={() => choose(onDeleteSession)}><Icon name="trash" /> Delete workspace</button>
          </div>}
        </div>
      </div>
    </div>

    <div className="workspace-detail-tools">
      <label className="workspace-detail-search"><Icon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this Workspace" aria-label="Search this workspace" />{query && <button type="button" aria-label="Clear workspace search" onClick={() => setQuery("")}><Icon name="close" /></button>}</label>
      <div className="workspace-detail-tool-actions">
        <label className="workspace-detail-select"><Icon name="sliders" /><span>Sort</span><select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort workspace tabs">{SORT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="workspace-detail-select"><Icon name="sliders" /><span>Filter</span><select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter workspace tabs"><option value="all">All tabs</option><option value="tagged">Tagged</option><option value="notes">With notes</option><option value="reminders">With reminders</option></select></label>
      </div>
    </div>

    <div className="workspace-detail-list">
      {selectedCount > 0 && <div className="workspace-detail-selection" role="group" aria-label="Selected tab actions">
        <span className="workspace-detail-selection-count"><span className="workspace-detail-selection-mark">−</span>{selectedCount} selected</span>
        <div className="workspace-detail-selection-actions">
          <div className="workspace-detail-menu-anchor">
            <button className="workspace-detail-primary" type="button" onClick={openBehavior === "new-window" ? onOpenSelectedNewWindow : onOpenSelected}>Open Selected</button>
            <button className="workspace-detail-primary workspace-detail-split-arrow" type="button" aria-label="Open selected options" aria-expanded={menu === "selected"} onClick={() => toggle("selected")}><Icon name="chevron-down" /></button>
            {menu === "selected" && <div className="workspace-detail-menu" role="menu"><button type="button" role="menuitem" onClick={() => choose(onOpenSelected)}><Icon name="external" /> Open in current window</button><button type="button" role="menuitem" onClick={() => choose(onOpenSelectedNewWindow)}><Icon name="window" /> Open in new window</button></div>}
          </div>
          <button className="workspace-detail-button is-danger" type="button" onClick={onDeleteSelected}><Icon name="trash" /> Delete Selected</button>
          <button className="workspace-detail-clear" type="button" onClick={onClearSelection}>Clear selection</button>
        </div>
      </div>}
      {allVisible.length === 0 ? <div className="workspace-detail-empty">{tabs.length ? "No tabs match your search or filter." : "No tabs saved in this workspace yet."}</div> : allVisible.map(({ tab, index }) => <div key={`${session.id}-${index}`}
        className={`workspace-detail-row${selectedIndexes.has(index) ? " is-selected" : ""}${dragIndex === index ? " is-dragging" : ""}`}
        onDragOver={(event) => { if (dragIndex !== null && sort === "manual" && !query && filter === "all") event.preventDefault(); }}
        onDrop={(event) => { event.preventDefault(); if (dragIndex !== null && dragIndex !== index) void onReorder(dragIndex, index); setDragIndex(null); }}>
        <input type="checkbox" checked={selectedIndexes.has(index)} onChange={(event) => onToggleTabSelection(index, event.target.checked)} aria-label={`Select ${tab.title || tab.url}`} />
        <button className="workspace-detail-drag" type="button" draggable={sort === "manual" && !query && filter === "all"} disabled={sort !== "manual" || Boolean(query) || filter !== "all"} onDragStart={(event) => { setDragIndex(index); event.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => setDragIndex(null)} aria-label={`Drag to reorder ${tab.title || tab.url}`} title="Drag to reorder tabs in manual order"><Icon name="grip" /></button>
        <button className="workspace-detail-link" type="button" onClick={() => onOpenTab(index)} title={`Open ${tab.title || tab.url}`}><LinkFavicon tab={tab} getFaviconUrl={getFaviconUrl} /><span className="workspace-detail-link-text"><strong>{tab.title || tab.url}</strong><small>{getDomain(tab.url)}</small></span></button>
        <TabIndicators tab={tab} />
        {tab.tags?.length > 0 && <TagList tags={tab.tags} className="workspace-detail-tags" label="Link tags" />}
        <button className="workspace-detail-row-action" type="button" aria-label={`Edit ${tab.title || tab.url}`} title="Edit tab" onClick={() => onEditTab(index)}><Icon name="edit" /></button>
        <div className="workspace-detail-menu-anchor modern-more-menu-container">
          <button className="workspace-detail-row-action" type="button" aria-label={`More options for ${tab.title || tab.url}`} aria-expanded={openMenuId === `detail:${session.id}:${index}`} onClick={() => setOpenMenuId(openMenuId === `detail:${session.id}:${index}` ? null : `detail:${session.id}:${index}`)}><Icon name="more" /></button>
          {openMenuId === `detail:${session.id}:${index}` && <div className="workspace-detail-menu workspace-detail-row-menu" role="menu"><button className="is-danger" type="button" role="menuitem" onClick={() => { setOpenMenuId(null); onDeleteTab(index); }}><Icon name="trash" /> Delete tab</button></div>}
        </div>
      </div>)}
    </div>
    <p className="workspace-detail-footer">Showing {allVisible.length} of {tabs.length} tabs</p>
  </section>;
}
