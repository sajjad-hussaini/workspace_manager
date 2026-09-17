import { useState } from "react";

export default function WorkspaceCard({
  session,
  expanded,
  selectedIndexes,
  onToggleExpanded,
  onOpenAll,
  onOpenNewWindow,
  onOpenSelected,
  onOpenSelectedNewWindow,
  onAddCurrentLinks,
  onDeleteSession,
  onDeleteTab,
  onToggleTabSelection,
  getFaviconUrl,
  formatDate
}) {
  const tabs = Array.isArray(session.tabs) ? session.tabs : [];
  const selectedCount = selectedIndexes.size;

  return (
    <div className={`workspace-card ${expanded ? "is-expanded" : ""}`}>
      <button className="workspace-summary" onClick={onToggleExpanded} type="button">
        <span className="workspace-mark" aria-hidden="true">
          <FolderIcon />
        </span>
        <span className="workspace-details">
          <span className="workspace-title">{session.title}</span>
          {session.note && <span className="workspace-note">{session.note}</span>}
          {Array.isArray(session.tags) && session.tags.length > 0 && (
            <span className="workspace-card-tags">
              {session.tags.map((t, idx) => (
                <span key={idx} className="workspace-card-tag">#{t}</span>
              ))}
            </span>
          )}
          <span className="workspace-meta">
            Saved {formatDate(session.createdAt)}
            {session.lastOpenedAt && ` · Opened ${formatDate(session.lastOpenedAt)}`}
            {session.reminderAt && ` · Reminder ${formatDate(session.reminderAt)}`}
            {" · "}
            {tabs.length} link{tabs.length === 1 ? "" : "s"}
            {" · "}
            <span className={`storage-pill ${session.storageArea === "sync" ? "is-sync" : "is-local"}`}>
              {session.storageArea === "sync" ? "Synced" : "Local"}
            </span>
          </span>
        </span>
        <span className={`chevron ${expanded ? "is-open" : ""}`} aria-hidden="true">
          ▾
        </span>
      </button>

      {expanded && (
        <div className="workspace-content">
          <div className="workspace-toolbar">
            <button className="btn btn-sm" onClick={onAddCurrentLinks} type="button">
              + Add Current Links
            </button>
          </div>

          <div className="tab-list">
            {tabs.length === 0 && <div className="empty-tabs">This workspace has no saved links.</div>}
            {tabs.map((tab, index) => (
              <TabRow
                key={`${tab.url}-${index}`}
                tab={tab}
                checked={selectedIndexes.has(index)}
                onCheck={(checked) => onToggleTabSelection(index, checked)}
                onOpen={() => chrome.tabs.create({ url: tab.url })}
                onDelete={() => onDeleteTab(index)}
                getFaviconUrl={getFaviconUrl}
                formatDate={formatDate}
              />
            ))}
          </div>

          <div className="workspace-actions">
            <button className="btn" onClick={onOpenAll} type="button">
              Open All
            </button>
            <button className="btn" onClick={onOpenNewWindow} type="button">
              New Window
            </button>
            <button
              className="btn"
              onClick={onOpenSelected}
              disabled={selectedCount === 0}
              type="button"
            >
              Open Selected{selectedCount ? ` (${selectedCount})` : ""}
            </button>
            <button
              className="btn"
              onClick={onOpenSelectedNewWindow}
              disabled={selectedCount === 0}
              type="button"
            >
              Selected → New Window{selectedCount ? ` (${selectedCount})` : ""}
            </button>
            <button className="btn btn-danger" onClick={onDeleteSession} type="button">
              Delete Workspace
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TabRow({ tab, checked, onCheck, onOpen, onDelete, getFaviconUrl, formatDate }) {
  const [faviconFailed, setFaviconFailed] = useState(false);

  return (
    <div className="tab-row">
      <label className="tab-select">
        <input type="checkbox" checked={checked} onChange={(e) => onCheck(e.target.checked)} />
      </label>

      <button className="tab-link" onClick={onOpen} type="button" title={tab.url}>
        <span className="tab-icon">
          {!faviconFailed && tab.favicon ? (
            <img src={tab.favicon} alt="" onError={() => setFaviconFailed(true)} />
          ) : !faviconFailed ? (
            <img src={getFaviconUrl(tab.url)} alt="" onError={() => setFaviconFailed(true)} />
          ) : (
            <span className="favicon-fallback">{(tab.title || tab.url || "T").charAt(0).toUpperCase()}</span>
          )}
        </span>
        <span className="tab-text">
          <span className="tab-title">{tab.title || "Untitled tab"}</span>
          <span className="tab-url">{tab.url}</span>
        </span>
      </button>

      <span className="tab-visited">{tab.lastVisitedAt ? formatDate(tab.lastVisitedAt) : "Not opened yet"}</span>

      <button className="tab-delete" onClick={onDelete} type="button" aria-label="Delete link" title="Delete link">
        ×
      </button>
    </div>
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2.5h6.5A2.5 2.5 0 0 1 21 10v7.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5Z" />
    </svg>
  );
}
