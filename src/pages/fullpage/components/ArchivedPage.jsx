import { useMemo, useState } from "react";
import { workspaceMatchesSearch } from "../../../lib/utils";
import { Icon } from "./Icons";
import "./LibraryPages.css";

export default function ArchivedPage({ sessions, loading, search, onClearSearch, onBack, onRestore, onDelete, onOpen }) {
  const [busyId, setBusyId] = useState(null);
  const visible = useMemo(() => sessions
    .filter((session) => !search || workspaceMatchesSearch(session, search))
    .sort((a, b) => Date.parse(b.archivedAt) - Date.parse(a.archivedAt)), [sessions, search]);

  async function run(id, action) {
    if (busyId) return;
    setBusyId(id);
    try { await action(); } finally { setBusyId(null); }
  }

  return <section className="library-page" aria-labelledby="archived-title">
    <button type="button" className="library-back" onClick={onBack}><Icon name="arrowRight" /> Back to All Workspaces</button>
    <header className="library-page-header">
      <span className="modern-eyebrow">WORKSPACE LIBRARY</span>
      <h1 id="archived-title" className="modern-main-heading">Archived</h1>
      <p className="modern-subtitle">Keep finished workspaces out of your library. Restore them whenever you need them.</p>
      <span className="library-count">{sessions.length} archived workspace{sessions.length === 1 ? "" : "s"}</span>
    </header>
    {loading ? <div className="library-empty" role="status">Loading archived workspaces…</div> : visible.length ? <div className="library-card-list">
      {visible.map((session) => <article className="library-card" key={session.id}>
        <div className="library-card-symbol"><Icon name="archive" /></div>
        <div className="library-card-body">
          <h2>{session.title}</h2>
          <p>{session.note || "Saved workspace"}</p>
          <div className="library-card-meta"><span>{session.tabs?.length || 0} saved links</span><span aria-hidden="true">·</span><time dateTime={session.archivedAt}>Archived {new Date(session.archivedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</time></div>
        </div>
        <div className="library-card-actions">
          <button type="button" className="library-button" disabled={Boolean(busyId) || !session.tabs?.length} onClick={() => run(session.id, () => onOpen(session))}><Icon name="external" /> Open</button>
          <button type="button" className="library-button is-primary" disabled={Boolean(busyId)} onClick={() => run(session.id, () => onRestore(session))}><Icon name="restore" /> Restore</button>
          <button type="button" className="library-button is-danger" disabled={Boolean(busyId)} onClick={() => onDelete(session)} aria-label={`Delete ${session.title}`} title="Delete permanently"><Icon name="trash" /></button>
        </div>
      </article>)}
    </div> : <div className="library-empty">
      <span className="library-empty-icon"><Icon name={search ? "search" : "archive"} /></span>
      <h2>{search ? "No matching workspaces" : "Nothing archived yet"}</h2>
      <p>{search ? "Try another workspace name or link." : "Archived workspaces will appear here. You can restore them at any time."}</p>
      <button type="button" className="library-button is-primary" onClick={search ? onClearSearch : onBack}>{search ? "Clear search" : "Browse workspaces"}</button>
    </div>}
  </section>;
}
