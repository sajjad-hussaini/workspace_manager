import { Icon } from "./Icons";
import "./LibraryPages.css";

export default function SettingsPage({ theme, onThemeChange, activeCount, archivedCount, tabCount, onExport }) {
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
      </section>
      <section className="settings-panel" aria-labelledby="data-title">
        <div className="settings-panel-heading"><span className="settings-panel-icon"><Icon name="download" /></span><div><h2 id="data-title">Your data</h2><p>A quick look at what you have saved.</p></div></div>
        <div className="settings-stats"><div><strong>{activeCount}</strong><span>Workspaces</span></div><div><strong>{archivedCount}</strong><span>Archived</span></div><div><strong>{tabCount}</strong><span>Saved links</span></div></div>
        <div className="settings-export"><div><strong>Export workspaces</strong><p>Download your workspace and link details as a CSV file.</p></div><button type="button" className="library-button is-primary" onClick={onExport} disabled={activeCount + archivedCount === 0}><Icon name="download" /> Export CSV</button></div>
      </section>
    </div>
  </section>;
}
