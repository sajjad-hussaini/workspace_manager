import { useEffect, useRef, useState } from "react";
import { getBrowserWindows } from "../../../lib/browserWindows";
import { getFaviconUrl } from "../../../lib/utils";
import { Icon, LinkFavicon } from "./Icons";
import "./BrowserWindowsCard.css";

function WindowRow({ browserWindow, workspaces, saving, onSave }) {
  const [expanded, setExpanded] = useState(false);
  const [excluded, setExcluded] = useState(() => new Set());
  const [targetId, setTargetId] = useState("");
  const selected = browserWindow.tabs.filter((tab) => !excluded.has(tab.id));
  const targetExists = !targetId || workspaces.some((workspace) => workspace.id === targetId);
  const panelId = `browser-window-${browserWindow.id}`;

  return (
    <div className="browser-window-row">
      <button className="browser-window-toggle" type="button" aria-expanded={expanded} aria-controls={panelId} onClick={() => setExpanded(!expanded)}>
        <Icon name="window" />
        <span className="browser-window-copy">
          <strong>{browserWindow.label}</strong>
          <span title={browserWindow.title}>{browserWindow.title || "Browser window"}</span>
        </span>
        <span className="browser-window-count">{browserWindow.tabs.length} tabs</span>
        <Icon name={expanded ? "chevron-up" : "chevron-down"} />
      </button>
      {expanded && <div id={panelId} className="browser-window-panel">
        {browserWindow.tabs.length ? <>
          <div className="browser-window-selection">
            <span>{selected.length} of {browserWindow.tabs.length} selected</span>
            <button type="button" disabled={saving} onClick={() => setExcluded(selected.length === browserWindow.tabs.length ? new Set(browserWindow.tabs.map((tab) => tab.id)) : new Set())}>
              {selected.length === browserWindow.tabs.length ? "Deselect all" : "Select all"}
            </button>
          </div>
          <div className="browser-window-tabs">
            {browserWindow.tabs.map((tab) => <label className="browser-window-tab" key={tab.id}>
              <input type="checkbox" checked={!excluded.has(tab.id)} disabled={saving} onChange={(event) => {
                const checked = event.target.checked;
                setExcluded((previous) => {
                  const next = new Set(previous);
                  if (checked) next.delete(tab.id);
                  else next.add(tab.id);
                  return next;
                });
              }} />
              <LinkFavicon tab={tab} getFaviconUrl={getFaviconUrl} />
              <span title={tab.url}>{tab.title || tab.url}</span>
            </label>)}
          </div>
          <label className="browser-window-destination">
            Save to
            <select value={targetExists ? targetId : ""} disabled={saving} onChange={(event) => setTargetId(event.target.value)}>
              <option value="">New workspace…</option>
              {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.title}</option>)}
            </select>
          </label>
          <button className="modern-browser-save-btn" type="button" disabled={saving || !selected.length} onClick={() => onSave({ windowId: browserWindow.id, tabIds: selected.map((tab) => tab.id), label: browserWindow.label }, targetExists ? targetId : "")}>
            <Icon name="plus" /> {saving ? "Saving…" : `Save ${selected.length} selected tab${selected.length === 1 ? "" : "s"}`}
          </button>
        </> : <p className="browser-window-empty">No saveable tabs in this window.</p>}
      </div>}
    </div>
  );
}

export default function BrowserWindowsCard({ workspaces, saving, onSaveCurrent, onSaveWindow }) {
  const [windows, setWindows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const dialogRef = useRef(null);
  const refreshRef = useRef(null);

  useEffect(() => {
    let disposed = false;
    let timer;
    let version = 0;
    const refresh = async () => {
      const request = ++version;
      try {
        const next = await getBrowserWindows();
        if (!disposed && request === version) { setWindows(next); setError(""); }
      } catch {
        if (!disposed && request === version) setError("Could not load browser windows. Try again.");
      } finally {
        if (!disposed && request === version) setLoading(false);
      }
    };
    const schedule = () => { clearTimeout(timer); timer = setTimeout(refresh, 120); };
    refreshRef.current = refresh;
    refresh();
    const events = [chrome.windows.onCreated, chrome.windows.onRemoved, chrome.windows.onFocusChanged,
      chrome.tabs.onCreated, chrome.tabs.onRemoved, chrome.tabs.onUpdated,
      chrome.tabs.onMoved, chrome.tabs.onAttached, chrome.tabs.onDetached, chrome.tabs.onActivated];
    events.forEach((event) => event.addListener(schedule));
    window.addEventListener("focus", schedule);
    return () => {
      disposed = true;
      clearTimeout(timer);
      events.forEach((event) => event.removeListener(schedule));
      window.removeEventListener("focus", schedule);
      refreshRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement;
    dialogRef.current?.querySelector("button")?.focus();
    return () => {
      if (!document.querySelector(".new-workspace-dialog:not(.browser-windows-dialog)")) previousFocus?.focus();
    };
  }, [open]);

  function showWindows() {
    setOpen(true);
    refreshRef.current?.();
  }

  function handleDialogKeyDown(event) {
    if (event.key === "Escape" && !saving) { event.stopPropagation(); setOpen(false); }
    if (event.key !== "Tab") return;
    const controls = [...dialogRef.current.querySelectorAll("button:not(:disabled), select:not(:disabled), input:not(:disabled)")];
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }

  const currentTabs = windows.find((browserWindow) => browserWindow.current)?.tabs || [];
  const detectedWindowsText = `${windows.length} window${windows.length === 1 ? "" : "s"} detected`;

  return <>
    <div className="browser-windows-card-wrap">
      <button className="browser-windows-badge" type="button" onClick={showWindows} aria-haspopup="dialog">
        <Icon name="window" /> {detectedWindowsText}
      </button>
    <div className="modern-summary-card is-browser">
      <div className="modern-browser-header">
        <strong>Current Window</strong>
        <div className="modern-browser-favicons">
          {currentTabs.slice(0, 5).map((tab) => (
            <LinkFavicon key={tab.id} tab={tab} getFaviconUrl={getFaviconUrl} />
          ))}
          {currentTabs.length > 5 && <span className="modern-favicons-extra">+{currentTabs.length - 5}</span>}
        </div>
      </div>
      <div className="modern-browser-meta browser-windows-meta">
        <span>{loading ? "Loading browser windows…" : error || `${currentTabs.length} tab${currentTabs.length === 1 ? "" : "s"} open · ${detectedWindowsText}`}</span>
      </div>
      <button className="modern-browser-save-btn" onClick={onSaveCurrent} disabled={saving || loading || !currentTabs.length} type="button">
        <Icon name="plus" /> {saving ? "Saving…" : "Save Current Window"}
      </button>
      <button className="browser-windows-more" type="button" onClick={showWindows} aria-haspopup="dialog">
        Save other windows <Icon name="chevron-down" />
      </button>
    </div>
    </div>
    {open && <div className="new-workspace-backdrop" role="presentation" onClick={() => { if (!saving) setOpen(false); }}>
      <section ref={dialogRef} className="new-workspace-dialog browser-windows-dialog" role="dialog" aria-modal="true" aria-labelledby="browser-windows-title" onClick={(event) => event.stopPropagation()} onKeyDown={handleDialogKeyDown}>
        <div className="new-workspace-title-row">
          <div><h2 id="browser-windows-title">Open Windows</h2><p>Choose a window, then save all or selected tabs.</p></div>
          <button type="button" disabled={saving} aria-label="Close windows" onClick={() => setOpen(false)}><Icon name="close" /></button>
        </div>
        {error ? <div className="browser-window-empty" role="alert">{error} <button type="button" onClick={() => refreshRef.current?.()}>Retry</button></div>
          : loading ? <p className="browser-window-empty">Loading windows…</p>
          : windows.length ? <div className="browser-windows-list">
            {windows.map((browserWindow) => <WindowRow key={browserWindow.id} browserWindow={browserWindow} workspaces={workspaces} saving={saving} onSave={async (source, targetId) => {
              const result = await onSaveWindow(source, targetId);
              if (result) setOpen(false);
            }} />)}
          </div> : <p className="browser-window-empty">No browser windows are open.</p>}
        <p className="browser-windows-hint">Browser settings and extension tabs are excluded. Your open tabs stay open.</p>
      </section>
    </div>}
  </>;
}
