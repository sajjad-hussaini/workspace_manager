import test from "node:test";
import assert from "node:assert/strict";
import { parseWorkspaceBackup } from "./backup.js";

test("accepts a backup with active and archived workspaces", () => {
  const workspaces = [
    { title: "Active", tabs: [{ url: "https://example.com" }] },
    { title: "Later", archivedAt: "2026-10-07T00:00:00.000Z", tabs: [] }
  ];
  assert.deepEqual(parseWorkspaceBackup(JSON.stringify({ format: "tabmorrow-backup", version: 1, workspaces })), workspaces);
});

test("rejects invalid backups before any workspaces are imported", () => {
  assert.throws(() => parseWorkspaceBackup("{"), /valid JSON/);
  assert.throws(() => parseWorkspaceBackup(JSON.stringify({ format: "other", version: 1, workspaces: [] })), /supported/);
  assert.throws(() => parseWorkspaceBackup(JSON.stringify({ format: "tabmorrow-backup", version: 1, workspaces: [{ title: "Bad", tabs: [null] }] })), /invalid workspace or link/);
});
