import { useState } from "react";
import { formatDate } from "../../../lib/utils";
import { Icon } from "./Icons";

function ReminderItem({ reminder, onDismiss }) {
  const [dismissing, setDismissing] = useState(false);

  async function handleDismiss() {
    setDismissing(true);
    try {
      await onDismiss(reminder);
    } finally {
      setDismissing(false);
    }
  }

  return (
    <li className="reminder-alert">
      <span className="reminder-icon"><Icon name="reminderbell" /></span>
      <div className="reminder-copy">
        <div className="reminder-heading">
          <strong title={reminder.title}>{reminder.title}</strong>
          <time dateTime={reminder.reminderAt}>Due {formatDate(reminder.reminderAt)}</time>
        </div>
        {reminder.note && <p className="reminder-note" title={reminder.note}>{reminder.note}</p>}
      </div>
      <button
        className="reminder-close"
        type="button"
        onClick={handleDismiss}
        disabled={dismissing}
        aria-label={`Dismiss reminder for ${reminder.title}`}
        title="Dismiss reminder"
      >
        <Icon name="close" />
      </button>
    </li>
  );
}

export default function ReminderStack({ reminders, onDismiss }) {
  if (!reminders.length) return null;

  const remainingCount = reminders.length - 2;

  return (
    <section className="reminder-stack" aria-label="Due reminders">
      <div className="reminder-stack-heading">
        <span>Due reminders <span className="reminder-count">{reminders.length}</span></span>
      </div>
      <ul className="reminder-preview">
        {reminders.slice(0, 2).map((reminder) => <ReminderItem key={reminder.id} reminder={reminder} onDismiss={onDismiss} />)}
      </ul>
      {remainingCount > 0 && (
        <details className="reminder-overflow">
          <summary className="reminder-toggle">
            <span className="reminder-toggle-more">
              <span className="reminder-more-count">+{remainingCount}</span>
              more {remainingCount === 1 ? "reminder" : "reminders"}
            </span>
            <span className="reminder-toggle-less">Show fewer reminders</span>
            <Icon name="chevron-down" />
          </summary>
          <ul className="reminder-extra-list" tabIndex={0} aria-label="More due reminders">
            {reminders.slice(2).map((reminder) => <ReminderItem key={reminder.id} reminder={reminder} onDismiss={onDismiss} />)}
          </ul>
        </details>
      )}
    </section>
  );
}
