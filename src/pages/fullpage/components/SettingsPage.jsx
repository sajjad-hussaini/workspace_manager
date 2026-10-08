import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icons";
import "./LibraryPages.css";

export default function SettingsPage({ theme, onThemeChange, sortKey, onSortChange, openBehavior, onOpenBehaviorChange, tabWarning, onTabWarningChange, autoNameQuickSave, onAutoNameQuickSaveChange, activeCount, archivedCount, tabCount, onExport, onBackup, onImport }) {
  const fileInput = useRef(null);
  const [importing, setImporting] = useState(false);
  const [limitInput, setLimitInput] = useState(String(tabWarning.limit));

  useEffect(() => setLimitInput(String(tabWarning.limit)), [tabWarning.limit]);

  function changeLimit(value) {
    setLimitInput(value);
    const limit = Number(value);
    if (/^[1-9]\d*$/.test(value) && Number.isSafeInteger(limit)) onTabWarningChange({ ...tabWarning, limit });
  }

  async function importFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try { await onImport(file); } finally { setImporting(false); event.target.value = ""; }
  }

  return <section className="library-page settings-page" aria-labelledby="settings-title">
    <header className="library-page-header">
      <span className="modern-eyebrow">PREFERENCES</span>
      <h1 id="settings-title" className="modern-main-heading">Settings</h1>
      <p className="modern-subtitle">Make TabMorrow feel right for you and manage your saved data.</p>
    </header>
    <div className="settings-grid">
      <section className="settings-panel" aria-labelledby="appearance-title">
        <div className="settings-panel-heading"><span className="settings-panel-icon"><Icon name="sun" /></span><div><h2 id="appearance-title">Appearance</h2><p>Choose how your workspace library looks.</p></div></div>
        <div className="settings-theme-options" role="group" aria-label="Color theme">
          {[{ value: "light", label: "Light", icon: "sun" }, { value: "dark", label: "Dark", icon: "moon" }].map((option) => <button key={option.value} type="button" className={`settings-theme-option${theme === option.value ? " is-selected" : ""}`} aria-pressed={theme === option.value} onClick={() => onThemeChange(option.value)}><Icon name={option.icon} /><span>{option.label}</span>{theme === option.value && <Icon name="check" />}</button>)}
        </div>
        <div className="settings-control-row">
          <div><label htmlFor="settings-workspace-order">Workspace order</label><p>Choose how workspaces appear by default.</p></div>
          <select id="settings-workspace-order" value={sortKey} onChange={(event) => onSortChange(event.target.value)}>
            <option value="manual">My order</option>
            <option value="name-asc">Name A–Z</option>
            <option value="created-desc">Newest first</option>
            <option value="opened-desc">Recently opened</option>
          </select>
        </div>
        <div className="settings-control-row">
          <div>
            <label id="settings-open-behavior-label">Open button behavior</label>
            <p id="settings-open-behavior-description">Choose where links open when you use an Open button.</p>
          </div>
          <button
            type="button"
            className="settings-open-switch"
            role="switch"
            aria-labelledby="settings-open-behavior-label"
            aria-describedby="settings-open-behavior-description"
            aria-checked={openBehavior === "new-window"}
            onClick={() => onOpenBehaviorChange(openBehavior === "new-window" ? "current" : "new-window")}
          >
            <span className="settings-open-switch-track" aria-hidden="true"><span /></span>
            <span>{openBehavior === "new-window" ? "New window" : "Current window"}</span>
          </button>
        </div>
        <div className="settings-control-row">
          <div>
            <label id="settings-tab-warning-label">Tab opening warning</label>
            <p id="settings-tab-warning-description">Ask before opening more saved links than your limit at once.</p>
          </div>
          <button type="button" className="settings-open-switch" role="switch" aria-labelledby="settings-tab-warning-label" aria-describedby="settings-tab-warning-description" aria-checked={tabWarning.enabled} onClick={() => onTabWarningChange({ ...tabWarning, enabled: !tabWarning.enabled })}>
            <span className="settings-open-switch-track" aria-hidden="true"><span /></span>
            <span>{tabWarning.enabled ? "On" : "Off"}</span>
          </button>
        </div>
        <div className="settings-control-row">
          <div><label htmlFor="settings-tab-warning-limit">Warn when opening more than</label><p>Default: 20 tabs. The limit applies to each open action.</p></div>
          <div className="settings-number-control"><input id="settings-tab-warning-limit" type="number" min="1" step="1" inputMode="numeric" value={limitInput} onChange={(event) => changeLimit(event.target.value)} onBlur={() => setLimitInput(String(tabWarning.limit))} aria-label="Tab warning limit" /><span>tabs</span></div>
        </div>
        <div className="settings-control-row">
          <div>
            <label id="settings-auto-name-label">Auto-name quick saves</label>
            <p id="settings-auto-name-description">Use Current Browser names when saving current tabs. Turn off to enter a workspace name first.</p>
          </div>
          <button type="button" className="settings-open-switch" role="switch" aria-labelledby="settings-auto-name-label" aria-describedby="settings-auto-name-description" aria-checked={autoNameQuickSave} onClick={() => onAutoNameQuickSaveChange(!autoNameQuickSave)}>
            <span className="settings-open-switch-track" aria-hidden="true"><span /></span>
            <span>{autoNameQuickSave ? "On" : "Off"}</span>
          </button>
        </div>
      </section>
      <section className="settings-panel" aria-labelledby="data-title">
        <div className="settings-panel-heading"><span className="settings-panel-icon"><Icon name="download" /></span><div><h2 id="data-title">Your data</h2><p>A quick look at what you have saved.</p></div></div>
        <div className="settings-stats"><div><strong>{activeCount}</strong><span>Workspaces</span></div><div><strong>{archivedCount}</strong><span>Archived</span></div><div><strong>{tabCount}</strong><span>Saved links</span></div></div>
        <div className="settings-export"><div><strong>Export workspaces</strong><p>Download your workspace and link details as a CSV file.</p></div><button type="button" className="library-button is-primary" onClick={onExport} disabled={activeCount + archivedCount === 0}><Icon name="download" /> Export CSV</button></div>
        <div className="settings-export"><div><strong>Download backup</strong><p>Save all workspaces, archived items, notes and reminders in a JSON file.</p></div><button type="button" className="library-button" onClick={onBackup} disabled={activeCount + archivedCount === 0}><Icon name="download" /> Backup JSON</button></div>
        <div className="settings-export"><div><strong>Import backup</strong><p>Add workspaces from a TabMorrow JSON backup. Existing workspaces stay in place.</p></div><input ref={fileInput} className="settings-file-input" type="file" accept=".json,application/json" onChange={importFile} aria-label="Choose backup JSON file" /><button type="button" className="library-button" disabled={importing} onClick={() => fileInput.current?.click()}><Icon name="plus" /> {importing ? "Importing…" : "Import JSON"}</button></div>
      </section>
    </div>
  </section>;
}
