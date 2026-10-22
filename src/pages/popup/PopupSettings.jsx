import { useRef, useState } from "react";
import { Icon } from "../fullpage/components/Icons";

function SettingIcon({ name }) {
  return <span className="popup-settings-icon"><Icon name={name} /></span>;
}

export default function PopupSettings({
  theme, onThemeChange, sortKey, onSortChange, openBehavior, onOpenBehaviorChange,
  tabWarning, onTabWarningChange, onExport, onBackup, onImport, onAdvancedSettings, onBack,
  driveStatus, driveBusy, onDriveConnect, onDriveSync
}) {
  const [showBackup, setShowBackup] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInput = useRef(null);

  async function importFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try { await onImport(file); }
    finally { setImporting(false); event.target.value = ""; }
  }

  const header = <header className="popup-settings-header">
    <button type="button" className="popup-settings-back" aria-label={showBackup ? "Back to settings" : "Back to workspaces"} onClick={() => showBackup ? setShowBackup(false) : onBack()}><Icon name="arrowLeft" /></button>
    <h1>{showBackup ? "Backup & Restore" : "Settings"}</h1>
    <button type="button" className="popup-settings-open" aria-label="Open advanced settings" title="Open advanced settings" onClick={onAdvancedSettings}><Icon name="external" /></button>
  </header>;

  if (showBackup) return <section className="popup-settings-screen popup-backup-screen" aria-label="Backup and restore">
    {header}
    <div className="popup-backup-intro">
      <div className="popup-backup-art" aria-hidden="true">
        <span className="popup-backup-art-tile"><Icon name="upload" /></span>
        <span className="popup-backup-art-document"><i /><i /><i /></span>
        <span className="popup-backup-art-orbit is-left"><Icon name="link" /></span>
        <span className="popup-backup-art-orbit is-right"><Icon name="tabs" /></span>
        <span className="popup-backup-art-spark">✦</span>
      </div>
      <h2>Backup &amp; Restore</h2>
      <p>Keep a copy of your saved workspaces<br />and data.</p>
    </div>
    <div className="popup-backup-actions">
      <div className="popup-backup-action-card">
        <SettingIcon name="download" />
        <span className="popup-settings-copy"><strong>Export workspaces</strong><small>Download workspace and saved<br />tab details as a CSV file.</small></span>
        <button type="button" className="popup-backup-button is-primary" onClick={onExport}>Export</button>
      </div>
      <div className="popup-backup-action-card">
        <SettingIcon name="database" />
        <span className="popup-settings-copy"><strong>Create backup</strong><small>Save workspaces, archived<br />items, notes and reminders as a<br />JSON file.</small></span>
        <button type="button" className="popup-backup-button" onClick={onBackup}>Download</button>
      </div>
      <div className="popup-backup-action-card">
        <SettingIcon name="upload" />
        <span className="popup-settings-copy"><strong>Import backup</strong><small>Restore data from a TabMorrow<br />backup file.</small></span>
        <button type="button" className="popup-backup-button" disabled={importing} onClick={() => fileInput.current?.click()}>{importing ? "Importing…" : "Import"}</button>
        <input ref={fileInput} className="popup-settings-file-input" type="file" accept=".json,application/json" onChange={importFile} aria-label="Choose backup JSON file" />
      </div>
    </div>
    <p className="popup-backup-note"><span className="popup-backup-note-icon" aria-hidden="true">i</span><span>Your existing data will remain unchanged when you<br />import a backup.</span></p>
  </section>;

  return <section className="popup-settings-screen" aria-label="Popup settings">
    {header}
    <div className="popup-settings-section-title">APPEARANCE</div>
    <div className="popup-settings-card">
      <div className="popup-settings-row popup-settings-theme-row">
        <SettingIcon name="sun" />
        <span className="popup-settings-copy"><strong>Theme</strong><small>Customize your popup<br />appearance</small></span>
        <span className="popup-settings-theme-control" role="group" aria-label="Theme">
          <button type="button" className={theme === "light" ? "is-active" : ""} aria-label="Light theme" aria-pressed={theme === "light"} onClick={() => onThemeChange("light")}><Icon name="sun" /></button>
          <button type="button" className={theme === "dark" ? "is-active" : ""} aria-label="Dark theme" aria-pressed={theme === "dark"} onClick={() => onThemeChange("dark")}><Icon name="moon" /></button>
        </span>
      </div>
    </div>

    <div className="popup-settings-section-title">WORKSPACE PREFERENCES</div>
    <div className="popup-settings-card">
      <div className="popup-settings-row">
        <SettingIcon name="sort" />
        <span className="popup-settings-copy"><strong><label htmlFor="popup-workspace-order">Workspace order</label></strong><small>How your workspaces<br />are listed</small></span>
        <span className="popup-settings-select-wrap"><select id="popup-workspace-order" value={sortKey} onChange={(event) => onSortChange(event.target.value)}><option value="created-desc">Newest first</option><option value="opened-desc">Recently opened</option><option value="name-asc">Name A–Z</option><option value="manual">My order</option></select><Icon name="chevron-down" /></span>
      </div>
      <div className="popup-settings-row">
        <SettingIcon name="window" />
        <span className="popup-settings-copy"><strong><label htmlFor="popup-open-tabs">Open tabs in</label></strong><small>Choose where your<br />tabs open</small></span>
        <span className="popup-settings-select-wrap"><select id="popup-open-tabs" value={openBehavior} onChange={(event) => onOpenBehaviorChange(event.target.value)}><option value="current">Current window</option><option value="new-window">New window</option></select><Icon name="chevron-down" /></span>
      </div>
      <div className="popup-settings-row popup-settings-confirm-row">
        <SettingIcon name="shield" />
        <span className="popup-settings-copy" id="popup-confirm-label"><strong>Confirm opening tabs</strong><small>Ask before opening multiple tabs</small></span>
        <button type="button" className="popup-settings-switch" role="switch" aria-labelledby="popup-confirm-label" aria-checked={tabWarning.enabled} onClick={() => onTabWarningChange({ ...tabWarning, enabled: !tabWarning.enabled })}><span /></button>
      </div>
    </div>

    <div className="popup-settings-section-title">DATA &amp; BACKUP</div>
    <div className="popup-settings-card">
      <div className="popup-settings-row">
        <SettingIcon name="database" />
        <span className="popup-settings-copy"><strong>Google Drive</strong><small>{driveStatus.error || (driveStatus.connected ? "Connected and syncing" : driveStatus.configured ? "Store your data in Drive" : "Setup required")}</small></span>
        <button type="button" className="popup-backup-button" disabled={driveBusy || !driveStatus.configured} onClick={driveStatus.connected && !driveStatus.error ? onDriveSync : onDriveConnect}>{driveBusy ? "Please wait…" : driveStatus.error ? "Reconnect" : driveStatus.connected ? "Sync" : "Connect"}</button>
      </div>
      <button type="button" className="popup-settings-action" onClick={onExport}>
        <SettingIcon name="download" /><span className="popup-settings-copy"><strong>Export workspaces</strong><small>Download a CSV file</small></span><span className="popup-settings-chevron">›</span>
      </button>
      <button type="button" className="popup-settings-action" onClick={() => setShowBackup(true)}>
        <SettingIcon name="database" /><span className="popup-settings-copy"><strong>Backup &amp; restore</strong><small>Manage your saved data</small></span><span className="popup-settings-chevron">›</span>
      </button>
    </div>

    <button type="button" className="popup-settings-advanced" onClick={onAdvancedSettings}>
      <SettingIcon name="grid" /><span className="popup-settings-copy"><strong>Advanced Settings</strong><small>Manage all settings in your dashboard</small></span><Icon name="external" />
    </button>
  </section>;
}
