import { FolderIcon, Icon, LinkFavicon } from "./Icons";

export default function WorkspaceCard({
  session,
  index = 0,
  expanded = false,
  selectedIndexes = new Set(),
  openMenuId,
  setOpenMenuId,
  isDragging = false,
  isDragOver = false,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onToggleExpanded,
  onEditSession,
  onDuplicateSession,
  onExportSession,
  onDeleteSession,
  onToggleTabSelection,
  onOpenTab,
  onEditTab,
  onDeleteTab,
  onOpenAll,
  onOpenNewWindow,
  onOpenSelected,
  onOpenSelectedNewWindow,
  onAddCurrentLinks,
  getFaviconUrl,
  formatDate
}) {
  const tabs = Array.isArray(session.tabs) ? session.tabs : [];
  const selectedCount = selectedIndexes.size;
  const isMenuOpen = openMenuId === session.id;

  // Preview: show up to 4 tabs in the 2-column grid
  const previewTabs = tabs.slice(0, 4);
  const extraCount = tabs.length - previewTabs.length;

  function getRelativeDate(isoString) {
    if (!isoString) return null;
    const diff = Date.now() - Date.parse(isoString);
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "today";
    if (days === 1) return "yesterday";
    return `${days} days ago`;
  }

  const lastActivity = session.lastOpenedAt || session.createdAt;
  const relativeDate = getRelativeDate(lastActivity);
  const activityLabel = session.lastOpenedAt ? "Updated" : "Saved";

  return (
    <article
      className={`ws-card accent-${index % 6} ${expanded ? "is-expanded" : ""} ${isDragging ? "is-dragging" : ""} ${isDragOver ? "is-drag-over" : ""}`}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      {/* ── Card header ── */}
      <div className="ws-card-header">
        <button
          className="ws-card-title-btn"
          onClick={onToggleExpanded}
          type="button"
          aria-expanded={expanded}
          title={expanded ? "Collapse" : "Expand workspace"}
        >
          <span className="ws-card-folder">
            <FolderIcon />
          </span>
          <span className="ws-card-name">{session.title}</span>
        </button>
        <button
          className="ws-card-menu-btn"
          onClick={() => setOpenMenuId(isMenuOpen ? null : session.id)}
          type="button"
          aria-label="Workspace actions"
        >
          <Icon name="more" />
        </button>
      </div>

      {/* ── Dropdown menu ── */}
      {isMenuOpen && (
        <div className="ws-card-menu" role="menu">
          <button onClick={() => { setOpenMenuId(null); onEditSession(); }} type="button">
            <Icon name="edit" /> <span>Edit Workspace</span>
          </button>
          <button onClick={() => { setOpenMenuId(null); onDuplicateSession(); }} type="button">
            <Icon name="copy" /> <span>Duplicate</span>
          </button>
          <button onClick={() => { setOpenMenuId(null); onExportSession(); }} type="button">
            <Icon name="download" /> <span>Export CSV</span>
          </button>
          <button className="is-danger" onClick={() => { setOpenMenuId(null); onDeleteSession(); }} type="button">
            <Icon name="trash" /> <span>Delete</span>
          </button>
        </div>
      )}

      {/* ── Tab preview grid (always visible when collapsed) ── */}
      {!expanded && (
        <>
          {tabs.length === 0 ? (
            <p className="ws-card-empty">No saved links yet.</p>
          ) : (
            <div className="ws-tab-grid">
              {previewTabs.map((tab, tabIndex) => (
                <button
                  key={`${session.id}-${tabIndex}`}
                  className="ws-tab-item"
                  onClick={() => onOpenTab(tab.url, tabIndex)}
                  type="button"
                  title={tab.url}
                >
                  <span className="ws-tab-favicon">
                    <LinkFavicon tab={tab} getFaviconUrl={getFaviconUrl} />
                  </span>
                  <span className="ws-tab-copy">
                    <span className="ws-tab-title">{tab.title || tab.url}</span>
                    <span className="ws-tab-url">{tab.url}</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {extraCount > 0 && (
            <button
              className="ws-more-tabs"
              onClick={onToggleExpanded}
              type="button"
            >
              +{extraCount} more tab{extraCount === 1 ? "" : "s"}
            </button>
          )}
        </>
      )}

      {/* ── Expanded: full link list + actions ── */}
      {expanded && (
        <>
          <div className="ws-expanded-links">
            {tabs.length === 0 && (
              <span className="ws-no-links">No saved links in this workspace.</span>
            )}
            {tabs.map((tab, tabIndex) => (
              <div className="ws-link-row" key={`${session.id}-${tabIndex}`}>
                <input
                  type="checkbox"
                  className="ws-link-check"
                  checked={selectedIndexes.has(tabIndex)}
                  onChange={(e) => onToggleTabSelection(tabIndex, e.target.checked)}
                  aria-label={`Select ${tab.title || tab.url}`}
                />
                <button
                  className="ws-link-open"
                  onClick={() => onOpenTab(tab.url, tabIndex)}
                  type="button"
                  title={tab.url}
                >
                  <span className="ws-tab-favicon">
                    <LinkFavicon tab={tab} getFaviconUrl={getFaviconUrl} />
                  </span>
                  <span className="ws-tab-copy">
                    <span className="ws-tab-title">{tab.title || tab.url}</span>
                    <span className="ws-tab-url">{tab.url}</span>
                    {tab.lastVisitedAt && (
                      <span className="ws-tab-visited">Opened {formatDate(tab.lastVisitedAt)}</span>
                    )}
                  </span>
                </button>
                <button className="ws-link-edit" onClick={() => onEditTab(tabIndex)} type="button" aria-label="Edit link" title="Edit link">
                  <Icon name="edit" />
                </button>
                <button className="ws-link-del" onClick={() => onDeleteTab(tabIndex)} type="button" aria-label="Delete link" title="Delete link">
                  <Icon name="close" />
                </button>
              </div>
            ))}
          </div>

          <div className="ws-expanded-actions">
            <button className="is-primary" onClick={onOpenAll} type="button">
              <Icon name="external" /> Open All ({tabs.length})
            </button>
            <button onClick={onOpenNewWindow} type="button">
              <Icon name="window" /> New Window
            </button>
            <button onClick={onOpenSelected} disabled={selectedCount === 0} type="button">
              Open Selected {selectedCount ? `(${selectedCount})` : ""}
            </button>
            <button onClick={onOpenSelectedNewWindow} disabled={selectedCount === 0} type="button">
              Selected → New Window {selectedCount ? `(${selectedCount})` : ""}
            </button>
            <button onClick={onAddCurrentLinks} type="button">
              <Icon name="plus" /> Add Current Links
            </button>
            <button className="is-danger" onClick={onDeleteSession} type="button">
              <Icon name="trash" /> Delete Workspace
            </button>
          </div>
        </>
      )}

      {/* ── Card footer ── */}
      <div className="ws-card-footer">
        <span>{tabs.length} tab{tabs.length === 1 ? "" : "s"}{relativeDate ? ` · ${activityLabel} ${relativeDate}` : ""}</span>
        {Array.isArray(session.tags) && session.tags.length > 0 && (
          <span className="ws-card-tags">
            {session.tags.map((tag, i) => (
              <span key={i} className="ws-card-tag">#{tag}</span>
            ))}
          </span>
        )}
      </div>
    </article>
  );
}
