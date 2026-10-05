import { useState, useRef, useEffect } from "react";
import { Icon, LinkFavicon } from "./Icons";
import TagList from "./TagList";
import SearchHighlight from "./SearchHighlight";

function SelectedOpenOptions({ onOpenCurrent, onOpenNewWindow }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const firstOptionRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    firstOptionRef.current?.focus();
    const closeOutside = (event) => {
      if (!containerRef.current?.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [isOpen]);

  function choose(action) {
    setIsOpen(false);
    triggerRef.current?.focus();
    action();
  }

  return (
    <div className="modern-selected-open" ref={containerRef}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false); }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && isOpen) {
          event.preventDefault();
          event.stopPropagation();
          setIsOpen(false);
          triggerRef.current?.focus();
        }
      }}>
      <button ref={triggerRef} className="modern-selection-btn modern-selected-open-trigger" type="button"
        aria-label="Open selected links" aria-expanded={isOpen}
        onClick={() => setIsOpen((previous) => !previous)}>
        Open <Icon name="chevron-down" />
      </button>
      {isOpen && <div className="modern-split-dropdown" role="group" aria-label="Open selected links options">
        <button ref={firstOptionRef} type="button" onClick={() => choose(onOpenCurrent)}><Icon name="external" /> Open in current window</button>
        <button type="button" onClick={() => choose(onOpenNewWindow)}><Icon name="window" /> Open in new window</button>
      </div>}
    </div>
  );
}

function LinkOptions({ menuId, label, openMenuId, setOpenMenuId, onDelete }) {
  const isOpen = openMenuId === menuId;
  const triggerRef = useRef(null);
  const deleteRef = useRef(null);

  useEffect(() => {
    if (isOpen) deleteRef.current?.focus();
  }, [isOpen]);

  return (
    <div
      className="modern-more-menu-container"
      onBlur={(event) => {
        if (isOpen && !event.currentTarget.contains(event.relatedTarget)) setOpenMenuId(null);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && isOpen) {
          event.preventDefault();
          setOpenMenuId(null);
          triggerRef.current?.focus();
        }
      }}
    >
      <button
        ref={triggerRef}
        className="modern-link-action-btn modern-link-more-btn"
        onClick={() => setOpenMenuId(isOpen ? null : menuId)}
        type="button"
        aria-label={`More options for ${label}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        title="Link options"
      >
        <Icon name="more" />
      </button>
      {isOpen && (
        <div className="modern-dropdown-menu modern-link-menu" id={menuId} role="menu" aria-label="Link options">
          <button
            ref={deleteRef}
            className="is-danger"
            type="button"
            role="menuitem"
            onClick={() => {
              setOpenMenuId(null);
              triggerRef.current?.focus();
              onDelete();
            }}
          >
            <Icon name="trash" /> Delete link
          </button>
        </div>
      )}
    </div>
  );
}

export default function WorkspaceCard({
  session,
  popup = false,
  searchQuery = "",
  index = 0,
  expanded = false,
  selectedIndexes = new Set(),
  openMenuId,
  setOpenMenuId,
  pointerDrag = false,
  onPointerDragStart,
  dragItem,
  dropTarget,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onKeyboardMove,
  onToggleExpanded,
  onEditSession,
  onDuplicateSession,
  onExportSession,
  onDeleteSession,
  onToggleTabSelection,
  onOpenTab,
  onEditTab,
  onDeleteTab,
  onAddLink,
  onAddCurrentLinks,
  onOpenAll,
  onOpenNewWindow,
  onOpenSelected,
  onOpenSelectedNewWindow,
  onDeleteSelected,
  getFaviconUrl,
}) {
  const tabs = Array.isArray(session.tabs) ? session.tabs : [];
  const selectedCount = tabs.filter((_, tabIndex) => selectedIndexes.has(tabIndex)).length;
  const isMenuOpen = openMenuId === session.id;
  const isLinkMenuOpen = tabs.some((_, tabIndex) => openMenuId === `link:${session.id}:${tabIndex}`);
  const [openDropdownActive, setOpenDropdownActive] = useState(false);
  const openMenuRef = useRef(null);
  const isDragging = dragItem?.type === "workspace" && dragItem.sessionId === session.id;
  const isLinkDrag = dragItem?.type === "link";
  const workspaceDropEdge = dragItem?.type === "workspace" && !isDragging ? dropTarget?.edge : null;
  const isLinkTarget = isLinkDrag && Boolean(dropTarget);

  useEffect(() => {
    if (dragItem) setOpenDropdownActive(false);
  }, [dragItem]);

  useEffect(() => {
    if (!openDropdownActive) return;
    function handleOutside(e) {
      if (openMenuRef.current && !openMenuRef.current.contains(e.target)) {
        setOpenDropdownActive(false);
      }
    }
    document.addEventListener("pointerdown", handleOutside);
    return () => document.removeEventListener("pointerdown", handleOutside);
  }, [openDropdownActive]);

  function formatRelativeDate(isoString) {
    if (!isoString) return "";
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "";
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Updated today";
    if (diffDays === 1) return "Updated yesterday";
    if (diffDays < 7) return `Updated ${diffDays} days ago`;

    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function getDomain(url = "") {
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace(/^www\./, "");
    } catch {
      return url;
    }
  }

  const updatedDateText = formatRelativeDate(session.lastOpenedAt || session.createdAt);

  return (
    <article
      data-workspace-id={session.id}
      data-link-count={tabs.length}
      className={`modern-ws-card ${expanded ? "is-expanded" : ""} ${isMenuOpen || isLinkMenuOpen || openDropdownActive ? "has-open-menu" : ""} ${isDragging ? "is-dragging" : ""} ${workspaceDropEdge ? `drop-${workspaceDropEdge}` : ""} ${isLinkTarget ? "is-link-drop-target" : ""}`}
      onDragOver={(event) => onDragOver(event)}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      {/* Top purple accent line */}
      {expanded && <div className="modern-ws-accent-bar" />}

      {/* Card Header */}
      <div className="modern-ws-header">
        <button
          className="modern-drag-handle modern-workspace-drag-handle"
          draggable={!pointerDrag}
          onPointerDown={pointerDrag ? (event) => onPointerDragStart(event) : undefined}
          type="button"
          aria-label={`Reorder ${session.title}`}
          title="Drag workspace to reorder · Alt + ↑ / ↓"
          onDragStart={(event) => onDragStart(event)}
          onKeyDown={(event) => onKeyboardMove(event)}
        ><Icon name="grip" /></button>
        <div className="modern-ws-info"
          onPointerDown={pointerDrag ? (event) => onPointerDragStart(event) : undefined}
          onClick={onToggleExpanded} onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onToggleExpanded(); }
        }} role="button" tabIndex={0}>
          <h3 className="modern-ws-title"><SearchHighlight text={session.title} query={searchQuery} /></h3>
          <div className="modern-ws-meta">
            <span>{tabs.length} tabs</span>
            {updatedDateText && (
              <>
                <span className="modern-meta-dot">·</span>
                <span>{updatedDateText}</span>
              </>
            )}
            {Array.isArray(session.tags) && session.tags.length > 0 && (
              <span className="modern-ws-tags">
                {session.tags.map((tag, i) => (
                  <span key={i} className="modern-ws-tag-badge">
                    <SearchHighlight text={tag} query={searchQuery} />
                  </span>
                ))}
              </span>
            )}
          </div>
        </div>

        {/* Right actions: Split Open Button, Chevron Toggle, More ⋮ Button */}
        <div className="modern-ws-actions">
          {/* Split Open Button */}
          <div className="modern-split-btn-container" ref={openMenuRef}>
            <button
              className="modern-split-main-btn"
              onClick={onOpenAll}
              type="button"
              title="Open all tabs"
            >
              Open
            </button>
            <button
              className={`modern-split-arrow-btn ${openDropdownActive ? "is-active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                setOpenDropdownActive((prev) => !prev);
              }}
              type="button"
              aria-label="More open options"
            >
              <Icon name="chevron-down" />
            </button>

            {openDropdownActive && (
              <div className="modern-split-dropdown" role="menu">
                <button
                  onClick={() => {
                    setOpenDropdownActive(false);
                    onOpenAll();
                  }}
                  type="button"
                >
                  <Icon name="external" /> Open in current window
                </button>
                <button
                  onClick={() => {
                    setOpenDropdownActive(false);
                    onOpenNewWindow();
                  }}
                  type="button"
                >
                  <Icon name="window" /> Open in new window
                </button>
              </div>
            )}
          </div>

          {/* Expand / Collapse Chevron */}
          <button
            className="modern-icon-toggle-btn"
            onClick={onToggleExpanded}
            type="button"
            aria-expanded={expanded}
            title={expanded ? "Collapse" : "Expand"}
          >
            <Icon name={expanded ? "chevron-up" : "chevron-down"} />
          </button>

          {/* 3-dots Menu Button */}
          <div className="modern-more-menu-container">
            <button
              className="modern-icon-more-btn"
              onClick={(e) => {
                e.stopPropagation();
                setOpenMenuId(isMenuOpen ? null : session.id);
              }}
              type="button"
              aria-label="Workspace options"
            >
              <Icon name="more" />
            </button>

            {isMenuOpen && (
              <div className="modern-dropdown-menu" role="menu">
                <button
                  onClick={() => {
                    setOpenMenuId(null);
                    onAddCurrentLinks();
                  }}
                  type="button"
                >
                  <Icon name="plus" /> <span>Add Current Links</span>
                </button>
                <button
                  onClick={() => {
                    setOpenMenuId(null);
                    onEditSession();
                  }}
                  type="button"
                >
                  <Icon name="edit" /> <span>Edit Workspace</span>
                </button>
                <button
                  onClick={() => {
                    setOpenMenuId(null);
                    onDuplicateSession();
                  }}
                  type="button"
                >
                  <Icon name="copy" /> <span>Duplicate</span>
                </button>
                <button
                  onClick={() => {
                    setOpenMenuId(null);
                    onExportSession();
                  }}
                  type="button"
                >
                  <Icon name="download" /> <span>Export CSV</span>
                </button>
                <button
                  className="is-danger"
                  onClick={() => {
                    setOpenMenuId(null);
                    onDeleteSession();
                  }}
                  type="button"
                >
                  <Icon name="trash" /> <span>Delete Workspace</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {!expanded && isLinkDrag && (
        <div className={`modern-link-drop-zone ${isLinkTarget ? "is-active" : ""}`}>
          <Icon name="move" /> Drop link into this workspace
        </div>
      )}

      {/* Expanded Links Section */}
      {expanded && (
        <div className="modern-ws-body">
          {/* Subsection Header */}
          <div className="modern-links-header">
            <span className="modern-links-count">
              SAVED LINKS · {tabs.length}
            </span>
            <button
              className="modern-add-link-btn"
              onClick={() => onAddLink && onAddLink(session)}
              type="button"
            >
              <Icon name="plus" /> Add Link
            </button>
          </div>
          {selectedCount > 0 && (
              <div className="modern-selection-actions" role="group" aria-label="Selected link actions">
                <button
                  className="modern-clear-selection"
                  type="button"
                  aria-label="Clear link selection"
                  title="Clear selection"
                  onClick={() => tabs.forEach((_, tabIndex) => {
                    if (selectedIndexes.has(tabIndex)) onToggleTabSelection(tabIndex, false);
                  })}
                >
                  <svg viewBox="0 0 14 14" aria-hidden="true">
                    <path d={popup ? "M4 4l6 6M10 4l-6 6" : "M4 7h6"} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
                <span className="modern-selection-count" role="status">{selectedCount} selected</span>
                {popup ? <SelectedOpenOptions onOpenCurrent={onOpenSelected} onOpenNewWindow={onOpenSelectedNewWindow} /> : <>
                <button className="modern-selection-btn" onClick={onOpenSelected} type="button">
                  <Icon name="external" />Open Current Window
                </button>
                <button className="modern-selection-btn" onClick={onOpenSelectedNewWindow} type="button">
                  <Icon name="window" />Open New Window
                </button>
                </>}
                <button className="modern-selection-btn is-danger" onClick={onDeleteSelected} type="button" aria-label="Delete selected links">
                  <Icon name="trash" />{!popup && " Delete Selected"}
                </button>
              </div>
            )}

          {/* Links List */}
          {tabs.length === 0 ? (
            <div className={`modern-no-links ${isLinkDrag ? "modern-link-drop-zone" : ""} ${isLinkTarget ? "is-active" : ""}`}>
              {isLinkDrag && <Icon name="move" />}
              <span>{isLinkDrag ? "Drop your link here" : "No links saved in this workspace yet."}</span>
            </div>
          ) : (
            <div className="modern-links-list">
              {tabs.map((tab, tabIndex) => (
                <div
                  data-link-index={tabIndex}
                  className={`modern-link-row${selectedIndexes.has(tabIndex) ? " is-selected" : ""}${isLinkDrag && dragItem.sessionId === session.id && dragItem.index === tabIndex ? " is-dragging" : ""}${isLinkTarget && dropTarget.index === tabIndex ? " drop-before" : ""}${isLinkTarget && dropTarget.index === tabs.length && tabIndex === tabs.length - 1 ? " drop-after" : ""}`}
                  key={`${session.id}-${tabIndex}`}
                  onDragOver={(event) => { if (isLinkDrag) onDragOver(event, tabIndex); }}
                >
                  <input
                    type="checkbox"
                    className="ws-link-check"
                    checked={selectedIndexes.has(tabIndex)}
                    onChange={(e) => onToggleTabSelection(tabIndex, e.target.checked)}
                    aria-label={`Select ${tab.title || tab.url}`}
                  />
                  <button
                    className="modern-drag-handle modern-link-drag-handle"
                    draggable={!pointerDrag}
                    onPointerDown={pointerDrag ? (event) => onPointerDragStart(event, tabIndex) : undefined}
                    type="button"
                    aria-label={`Move ${tab.title || tab.url}`}
                    title="Drag to reorder or move to another workspace · Alt + ↑ / ↓"
                    onDragStart={(event) => onDragStart(event, tabIndex)}
                    onKeyDown={(event) => onKeyboardMove(event, tabIndex)}
                  ><Icon name="grip" /></button>
                  <button
                    className="modern-link-main"
                    onPointerDown={pointerDrag ? (event) => onPointerDragStart(event, tabIndex) : undefined}
                    onDragStart={pointerDrag ? (event) => event.preventDefault() : undefined}
                    onClick={() => onOpenTab(tab.url, tabIndex)}
                    type="button"
                    title={`Open ${tab.title || tab.url}`}
                  >
                    <LinkFavicon tab={tab} getFaviconUrl={getFaviconUrl} />
                    <div className="modern-link-text">
                      <span className="modern-link-title">{tab.title || tab.url}</span>
                      <span className="modern-link-domain">{getDomain(tab.url)}</span>
                    </div>
                  </button>

                  {Array.isArray(tab.tags) && tab.tags.length > 0 && (
                    <TagList tags={tab.tags} className="modern-link-tags" label="Link tags" />
                  )}

                  <div className="modern-link-actions">
                    <button
                      className="modern-link-action-btn"
                      onClick={() => onEditTab(tabIndex)}
                      type="button"
                      aria-label="Edit link"
                      title="Edit link"
                    >
                      <Icon name="edit" />
                    </button>
                    <LinkOptions
                      menuId={`link:${session.id}:${tabIndex}`}
                      label={tab.title || tab.url}
                      openMenuId={openMenuId}
                      setOpenMenuId={setOpenMenuId}
                      onDelete={() => onDeleteTab(tabIndex)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
