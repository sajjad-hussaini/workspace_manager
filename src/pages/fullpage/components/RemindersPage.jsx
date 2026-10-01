import { useEffect, useRef, useState } from "react";
import { formatReminderDate, reminderGroup } from "../../../lib/reminders";
import { Icon } from "./Icons";

function ReminderRow({ reminder, now, onOpen, onSnooze, onEdit, onRemove }) {
  const [busy, setBusy] = useState(false);
  const overdue = reminder.dueAt <= now;
  async function run(action) {
    if (busy) return;
    setBusy(true);
    try { await action(reminder); } finally { setBusy(false); }
  }
  return <article className={`reminders-row${overdue ? " is-overdue" : ""}`}>
    <span className="reminders-row-icon"><Icon name="reminderbell" /></span>
    <div className="reminders-row-copy">
      <div className="reminders-row-heading"><h3>{reminder.title}</h3>{overdue && <span className="reminders-badge">Overdue</span>}</div>
      {reminder.tabIndex !== null && <span className="reminders-workspace-name">Link in {reminder.session.title}</span>}
      <time dateTime={reminder.reminderAt} className={overdue ? "reminder-overdue-text" : ""}>{formatReminderDate(reminder.reminderAt, now)}</time>
      {reminder.note && <p>{reminder.note}</p>}
    </div>
    <div className="reminders-row-actions">
      <button type="button" className="reminders-open" disabled={busy} onClick={() => run(onOpen)} aria-label={`Open ${reminder.title}`}><Icon name="external" /> Open</button>
      <button type="button" disabled={busy} onClick={() => run(onSnooze)} title="Remind me in 1 hour" aria-label={`Snooze ${reminder.title} for 1 hour`}><Icon name="clock" /> Snooze <span className="reminders-snooze-duration">1h</span></button>
      <button type="button" disabled={busy} onClick={() => onEdit(reminder)} aria-label={`Edit reminder for ${reminder.title}`}><Icon name="edit" /> Edit</button>
      <button type="button" className="reminders-remove" disabled={busy} onClick={() => run(onRemove)} aria-label={`Remove reminder for ${reminder.title}`} title="Remove reminder"><Icon name="trash" /></button>
    </div>
  </article>;
}

export default function RemindersPage({ reminders, now, search, loading, onBack, onOpen, onSnooze, onEdit, onRemove, onClearSearch }) {
  const [filter, setFilter] = useState("all");
  const heading = useRef(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const matching = reminders.filter((reminder) => !search || [reminder.title, reminder.note, reminder.session.title, reminder.session.tabs?.[reminder.tabIndex]?.url].some((value) => value?.toLowerCase().includes(search)));
  const overdue = matching.filter((reminder) => reminder.dueAt <= now).length;
  const visible = matching.filter((reminder) => filter === "all" || (filter === "overdue" ? reminder.dueAt <= now : reminder.dueAt > now));
  const groups = ["Overdue", "Today", "Tomorrow", "Later"].map((name) => ({ name, items: visible.filter((reminder) => reminderGroup(reminder.dueAt, now) === name) }));

  return <section className="reminders-page" aria-labelledby="reminders-title">
    <button type="button" className="reminders-back" onClick={onBack}><Icon name="arrowRight" /> Back to All Workspaces</button>
    <header className="reminders-page-header">
      <h1 id="reminders-title" className="modern-main-heading" ref={heading} tabIndex={-1}>Reminders</h1>
      <p className="modern-subtitle">Keep track of upcoming and overdue workspace and link reminders.</p>
      <p className="reminders-count" role="status">{matching.length} reminder{matching.length === 1 ? "" : "s"}{search && " matching your search"}<span aria-hidden="true"> · </span><span className={overdue ? "reminder-overdue-text" : ""}>{overdue} overdue</span></p>
    </header>
    <div className="reminders-filters" role="group" aria-label="Filter reminders">
      {[["all", "All", matching.length], ["upcoming", "Upcoming", matching.length - overdue], ["overdue", "Overdue", overdue]].map(([value, label, count]) => <button key={value} type="button" aria-pressed={filter === value} className={filter === value ? "is-active" : ""} onClick={() => setFilter(value)}>{label}<span className={value === "overdue" && count ? "reminder-overdue-text" : ""}>{count}</span></button>)}
    </div>
    {loading ? <div className="reminders-empty" role="status">Loading reminders…</div> : !visible.length ? <div className="reminders-empty">
      <span className="reminders-empty-icon"><Icon name="reminderbell" /></span>
      <h2>{search ? "No matching reminders" : !reminders.length ? "No reminders yet" : filter === "overdue" ? "You're all caught up" : "No upcoming reminders"}</h2>
      <p>{search ? "Try another workspace name or reminder note." : !reminders.length ? "Add a reminder when creating or editing a workspace or saved link." : filter === "overdue" ? "You have no overdue reminders. Your next steps can wait." : "Scheduled reminders will appear here."}</p>
      {search ? <button type="button" className="modern-btn-outline" onClick={onClearSearch}>Clear search</button> : <button type="button" className="modern-btn-outline" onClick={onBack}>Back to workspaces</button>}
    </div> : <div className="reminders-groups">
      {groups.map(({ name, items }) => items.length > 0 && <section key={name} className="reminders-group" aria-label={name === "Overdue" ? "Overdue reminders" : `${name} reminders`}>
        {name === "Overdue" ? <h2 className="reminders-section-label">Overdue</h2> : <>{groups.find((group) => group.name !== "Overdue" && group.items.length)?.name === name && <h2 className="reminders-section-label">Upcoming</h2>}<h2 className="reminders-day-label">{name}</h2></>}
        <div className="reminders-list">{items.map((reminder) => <ReminderRow key={reminder.id} reminder={reminder} now={now} onOpen={onOpen} onSnooze={onSnooze} onEdit={onEdit} onRemove={onRemove} />)}</div>
      </section>)}
    </div>}
  </section>;
}
