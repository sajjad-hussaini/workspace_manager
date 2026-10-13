import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icons";
import "./LibraryPages.css";
import "./SettingsPage.css";

const sections = [
  { id: "general", label: "General", icon: "sliders", description: "Control how TabMorrow works for you." },
  { id: "appearance", label: "Appearance", icon: "palette", description: "Customize the look and feel of your workspace." },
  { id: "workspace", label: "Workspace Preferences", icon: "window", description: "Adjust how your saved workspaces are displayed and opened." },
  { id: "data", label: "Data & Backup", icon: "database", description: "View your saved data and keep a secure copy of your workspaces." }
];

function SettingSwitch({ id, label, description, checked, onChange }) {
  return <div className="settings-list-row">
    <div className="settings-row-copy"><strong id={`${id}-label`}>{label}</strong><p id={`${id}-description`}>{description}</p></div>
    <button type="button" className="settings-toggle" role="switch" aria-labelledby={`${id}-label`} aria-describedby={`${id}-description`} aria-checked={checked} onClick={() => onChange(!checked)}><span /></button>
  </div>;
}

function ThemePreview({ dark }) {
  return <span className={`settings-theme-preview${dark ? " is-dark" : ""}`} aria-hidden="true">
    <span className="settings-preview-sidebar"><i /><i /><i /><i /></span>
    <span className="settings-preview-main"><i /><i /><span><b /><b /><b /><b /></span></span>
  </span>;
}

export default function SettingsPage({ theme, onThemeChange, onToggleTheme, sortKey, onSortChange, openBehavior, onOpenBehaviorChange, tabWarning, onTabWarningChange, autoNameQuickSave, onAutoNameQuickSaveChange, showSavedTabCount, onShowSavedTabCountChange, activeCount, archivedCount, tabCount, onExport, onBackup, onImport }) {
  const [section, setSection] = useState("general");
  const [importing, setImporting] = useState(false);
  const [limitInput, setLimitInput] = useState(String(tabWarning.limit));
  const fileInput = useRef(null);
  const activeSection = sections.find((item) => item.id === section);

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
    <header className="library-page-header settings-page-header">
      <div><span className="modern-eyebrow">PREFERENCES</span><h1 id="settings-title" className="modern-main-heading">Settings</h1><p className="modern-subtitle">Personalize your workspace experience and manage your data.</p></div>
      <button type="button" className="modern-theme-btn" onClick={onToggleTheme} aria-label="Toggle theme" title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}><Icon name={theme === "dark" ? "sun" : "moon"} /></button>
    </header>
    <div className="settings-layout">
      <nav className="settings-section-nav" aria-label="Settings sections">
        {sections.map((item) => <button key={item.id} type="button" className={`settings-section-link${section === item.id ? " is-active" : ""}`} aria-current={section === item.id ? "page" : undefined} onClick={() => setSection(item.id)}><Icon name={item.icon} /><span>{item.label}</span></button>)}
      </nav>
      <div className="settings-section-content">
        <div className="settings-section-heading"><h2>{activeSection.label}</h2><p>{activeSection.description}</p></div>
        {section === "general" && <div className="settings-list-card">
          <div className="settings-list-row"><div className="settings-row-copy"><strong id="settings-open-label">Open workspace in</strong><p>Choose where saved tabs open when you launch a workspace.</p></div><div className="settings-segmented" role="group" aria-labelledby="settings-open-label"><button type="button" className={openBehavior === "current" ? "is-active" : ""} aria-pressed={openBehavior === "current"} onClick={() => onOpenBehaviorChange("current")}>Current window</button><button type="button" className={openBehavior === "new-window" ? "is-active" : ""} aria-pressed={openBehavior === "new-window"} onClick={() => onOpenBehaviorChange("new-window")}>New window</button></div></div>
          <SettingSwitch id="settings-restore-warning" label="Confirm before restoring multiple tabs" description="Show a confirmation when the tab count exceeds your warning limit." checked={tabWarning.enabled} onChange={(enabled) => onTabWarningChange({ ...tabWarning, enabled })} />
        </div>}
        {section === "appearance" && <div className="settings-appearance-card"><div className="settings-card-intro"><strong>Theme</strong><p>Applies across the whole dashboard.</p></div><div className="settings-theme-options" role="group" aria-label="Color theme">{[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }].map((option) => <button key={option.value} type="button" className={`settings-theme-option${theme === option.value ? " is-selected" : ""}`} aria-pressed={theme === option.value} onClick={() => onThemeChange(option.value)}><ThemePreview dark={option.value === "dark"} /><span className="settings-theme-caption">{option.label}{theme === option.value && <span className="settings-theme-check"><Icon name="check" /></span>}</span></button>)}</div></div>}
        {section === "workspace" && <div className="settings-list-card">
          <div className="settings-list-row"><div className="settings-row-copy"><strong><label htmlFor="settings-workspace-order">Workspace sorting</label></strong><p>Choose how your workspaces are arranged in your library.</p></div><select id="settings-workspace-order" value={sortKey} onChange={(event) => onSortChange(event.target.value)}><option value="created-desc">Newest first</option><option value="opened-desc">Recently opened</option><option value="name-asc">Name A–Z</option><option value="manual">My order</option></select></div>
          <SettingSwitch id="settings-tab-count" label="Show saved tab count" description="Display the number of saved tabs on workspace cards." checked={showSavedTabCount} onChange={onShowSavedTabCountChange} />
          <SettingSwitch id="settings-tab-warning" label="Confirm before opening multiple tabs" description="Display a confirmation when the tab count exceeds your warning limit." checked={tabWarning.enabled} onChange={(enabled) => onTabWarningChange({ ...tabWarning, enabled })} />
          <div className="settings-list-row"><div className="settings-row-copy"><strong>Archived workspaces</strong><p>Archived workspaces stay saved until you restore or permanently delete them.</p></div><span className="settings-status"><Icon name="archive" /> Kept until removed</span></div>
          <details className="settings-more-preferences"><summary>More preferences</summary><div className="settings-list-row"><div className="settings-row-copy"><strong><label htmlFor="settings-tab-warning-limit">Warn when opening more than</label></strong><p>The limit applies to each open action.</p></div><div className="settings-number-control"><input id="settings-tab-warning-limit" type="number" min="1" step="1" inputMode="numeric" value={limitInput} onChange={(event) => changeLimit(event.target.value)} onBlur={() => setLimitInput(String(tabWarning.limit))} /><span>tabs</span></div></div><SettingSwitch id="settings-auto-name" label="Auto-name quick saves" description="Use Current Browser names when saving current tabs." checked={autoNameQuickSave} onChange={onAutoNameQuickSaveChange} /></details>
        </div>}
        {section === "data" && <><div className="settings-stats-card"><div className="settings-stats"><div><Icon name="window" /><strong>{activeCount}</strong><span>Active Workspaces</span></div><div><Icon name="archive" /><strong>{archivedCount}</strong><span>Archived Workspaces</span></div><div><Icon name="link" /><strong>{tabCount}</strong><span>Saved Tabs</span></div></div></div><div className="settings-export-heading"><h3>Export your data</h3><p>Download a copy of your workspace information.</p></div><div className="settings-list-card settings-export-list"><div className="settings-export"><span className="settings-action-icon"><Icon name="download" /></span><div><strong>Export Workspaces</strong><p>Download workspace and saved tab details in CSV format.</p></div><button type="button" className="library-button is-primary" onClick={onExport} disabled={activeCount + archivedCount === 0}>Export CSV</button></div><div className="settings-export"><span className="settings-action-icon"><Icon name="database" /></span><div><strong>Create Backup</strong><p>Save a complete JSON backup of your workspaces, archived items, notes, and reminders.</p></div><button type="button" className="library-button" onClick={onBackup} disabled={activeCount + archivedCount === 0}><Icon name="download" /> Download Backup</button></div><div className="settings-export"><span className="settings-action-icon"><Icon name="upload" /></span><div><strong>Import Backup</strong><p>Restore data from an existing TabMorrow backup file.</p></div><input ref={fileInput} className="settings-file-input" type="file" accept=".json,application/json" onChange={importFile} aria-label="Choose backup JSON file" /><button type="button" className="library-button" disabled={importing} onClick={() => fileInput.current?.click()}><Icon name="upload" /> {importing ? "Importing…" : "Import JSON"}</button></div></div></>}
      </div>
    </div>
  </section>;
}
