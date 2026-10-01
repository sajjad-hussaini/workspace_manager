import { useState } from "react";
import { formatReminderDate } from "../../../lib/reminders";
import { Icon } from "./Icons";

export default function ReminderSummary({ reminders, now, onOpen }) {
  const [previewHidden, setPreviewHidden] = useState(false);
  const overdue = reminders.filter((reminder) => reminder.dueAt <= now).length;

  return (
    <div className="reminder-summary" onMouseEnter={() => setPreviewHidden(false)} onFocus={() => setPreviewHidden(false)} onKeyDown={(event) => { if (event.key === "Escape") setPreviewHidden(true); }}>
      <button className="modern-summary-card reminder-summary-button" type="button" onClick={onOpen} aria-label={`View reminders: ${reminders.length} total, ${overdue} overdue`}>
        <span className="reminder-summary-label modern-card-stat-label">Reminders <Icon name="reminderbell" /></span>
        <span className="modern-card-stat-val">{reminders.length}</span>
        <span className="modern-card-stat-sub reminder-summary-meta">
          <span>Total reminders</span>
          <span className={overdue ? "reminder-overdue-text" : ""}>{overdue} overdue</span>
        </span>
      </button>
      {reminders.length > 0 && !previewHidden && <div className="reminder-summary-preview" aria-hidden="true">
        {reminders.slice(0, 3).map((reminder) => <div className="reminder-summary-preview-row" key={reminder.id}>
          <strong>{reminder.title}</strong>
          <span className={reminder.dueAt <= now ? "reminder-overdue-text" : ""}>{reminder.dueAt <= now ? "Overdue · " : ""}{formatReminderDate(reminder.reminderAt, now)}</span>
        </div>)}
        <span className="reminder-summary-hint">View all reminders <Icon name="arrowRight" /></span>
      </div>}
    </div>
  );
}
