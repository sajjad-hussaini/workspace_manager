import test from "node:test";
import assert from "node:assert/strict";
import { collectReminders, reminderGroup, toLocalDateTime } from "./reminders.js";

test("counts workspace and link reminders, ignores invalid dates, and sorts by due time", () => {
  const sessions = [
    {
      id: "a", title: "Research", reminderAt: "2026-10-01T09:00:00Z", tabs: [
        { title: "Reference", reminderAt: "2026-09-30T09:00:00Z" },
        { title: "No reminder" },
        { title: "Invalid", reminderAt: "invalid" }
      ]
    },
    { id: "b", title: "Design", tabs: [{ title: "Reference", reminderAt: "2026-10-02T09:00:00Z" }] }
  ];
  const before = structuredClone(sessions);
  const reminders = collectReminders(sessions);
  assert.equal(reminders.length, 3);
  assert.deepEqual(reminders.map(({ id }) => id), ["a:0", "a:workspace", "b:0"]);
  assert.equal(reminders[0].tabIndex, 0);
  assert.equal(reminders[1].tabIndex, null);
  assert.equal(reminders[2].session.id, "b");
  assert.deepEqual(sessions, before);
  assert.deepEqual(collectReminders([]), []);
});

test("groups reminders at due time and local calendar boundaries", () => {
  const now = new Date(2026, 9, 1, 14).getTime();
  assert.equal(reminderGroup(now - 1, now), "Overdue");
  assert.equal(reminderGroup(now, now), "Overdue");
  assert.equal(reminderGroup(now + 1, now), "Today");
  assert.equal(reminderGroup(new Date(2026, 9, 1, 23, 59).getTime(), now), "Today");
  assert.equal(reminderGroup(new Date(2026, 9, 2, 0).getTime(), now), "Tomorrow");
  assert.equal(reminderGroup(new Date(2026, 9, 3, 0).getTime(), now), "Later");
});

test("editing a stored reminder preserves its local time and instant", () => {
  const local = new Date(2026, 9, 1, 17, 30);
  const input = toLocalDateTime(local.toISOString());
  assert.equal(input, "2026-10-01T17:30");
  assert.equal(new Date(input).getTime(), local.getTime());
  assert.equal(toLocalDateTime(""), "");
  assert.equal(toLocalDateTime("invalid"), "");
});
