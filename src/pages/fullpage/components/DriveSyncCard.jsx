import { Icon } from "./Icons";
import "./DriveSyncCard.css";

export default function DriveSyncCard({ status, busy, compact = false, onConnect, onSync, onDisconnect }) {
  const lastSynced = status.lastSyncedAt ? new Date(status.lastSyncedAt).toLocaleString() : "";
  return <section className={`drive-sync-card${compact ? " is-compact" : ""}`} aria-label="Google Drive sync" aria-busy={busy}>
    <div className="drive-sync-copy">
      <strong><Icon name={status.connected ? "check" : "database"} /> {status.connected ? "Google Drive sync is on" : "Keep your data with you"}</strong>
      <p>{status.connected
        ? "Your workspaces, tabs, notes, and reminders sync automatically."
        : "Want to sync your data? Sign in with Google to save and restore it across devices."}</p>
      {status.connected && lastSynced && <p className="drive-sync-meta">Last synced: {lastSynced}</p>}
      {!status.configured && <p className="drive-sync-meta">Google sign-in will be available once app setup is complete.</p>}
      {status.error && <p className="drive-sync-error" role="alert">{status.error}</p>}
    </div>
    <div className="drive-sync-actions">
      {status.connected ? <>
        <button type="button" className="drive-sync-button" onClick={status.error ? onConnect : onSync} disabled={busy}>{busy ? "Syncing…" : status.error ? "Reconnect Google" : "Sync now"}</button>
        {onDisconnect && <button type="button" className="drive-sync-button is-secondary" onClick={onDisconnect} disabled={busy}>Stop sync</button>}
      </> : <button type="button" className="drive-sync-button" onClick={onConnect} disabled={busy || !status.configured}>{busy ? "Connecting…" : "Sign in with Google"}</button>}
    </div>
    {!compact && <p className="drive-sync-meta">A copy stays on this device for offline use. Sync uses a private app folder in your Google Drive.</p>}
  </section>;
}
