export function collectReminders(sessions) {
  return sessions.flatMap((session) => {
    const entries = [{ item: session, tabIndex: null }, ...(session.tabs || []).map((item, tabIndex) => ({ item, tabIndex }))];
    return entries.filter(({ item }) => Number.isFinite(Date.parse(item.reminderAt))).map(({ item, tabIndex }) => ({
      id: `${session.id}:${tabIndex ?? "workspace"}`,
      session,
      tabIndex,
      title: item.title || item.url || "Untitled workspace",
      note: item.note || "",
      reminderAt: item.reminderAt,
      dueAt: Date.parse(item.reminderAt)
    }));
  }).sort((a, b) => a.dueAt - b.dueAt);
}

export function reminderGroup(dueAt, now) {
  if (dueAt <= now) return "Overdue";
  const today = new Date(now);
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const dayAfter = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2);
  if (dueAt < tomorrow.getTime()) return "Today";
  if (dueAt < dayAfter.getTime()) return "Tomorrow";
  return "Later";
}

export function formatReminderDate(value, now = Date.now()) {
  const date = new Date(value);
  const today = new Date(now);
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const day = date.toDateString() === today.toDateString() ? "Today"
    : date.toDateString() === tomorrow.toDateString() ? "Tomorrow"
    : date.toDateString() === yesterday.toDateString() ? "Yesterday"
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric", ...(date.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}) });
  return `${day}, ${date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

export function toLocalDateTime(value) {
  const date = new Date(value);
  if (!value || !Number.isFinite(date.getTime())) return "";
  const pad = (part) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
