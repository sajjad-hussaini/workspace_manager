import test from "node:test";
import assert from "node:assert/strict";
import { moveLink, moveWorkspace } from "./dragDrop.js";

const link = (title) => ({ title, url: `https://${title}.example`, note: "Keep my notes", tags: ["research"], reminderAt: "2027-01-01" });
const fixtures = () => [
  { id: "a", title: "Research", order: 0, tabs: [link("one"), link("two"), link("three")] },
  { id: "b", title: "Design", order: 1, tabs: [link("four")] },
  { id: "c", title: "Empty", order: 2, tabs: [] },
];
const titles = (session) => session.tabs.map((tab) => tab.title);

test("workspace drops use the before/after edge in both directions", () => {
  const sessions = fixtures();
  assert.deepEqual(moveWorkspace(sessions, ["a", "b", "c"], "a", "c", "after").map((s) => s.id), ["b", "c", "a"]);
  const upward = moveWorkspace(sessions, ["a", "b", "c"], "c", "a", "before");
  assert.deepEqual(upward.map((s) => s.id), ["c", "a", "b"]);
  assert.deepEqual(upward.map((s) => s.order), [0, 1, 2]);
  assert.deepEqual(sessions.map((s) => s.id), ["a", "b", "c"]);
});

test("reordering search results preserves hidden workspace slots and unique orders", () => {
  const updated = moveWorkspace(fixtures(), ["a", "c"], "c", "a");
  assert.deepEqual(updated.map((s) => s.id), ["c", "b", "a"]);
  assert.equal(new Set(updated.map((s) => s.order)).size, 3);
});

test("workspace no-op and stale targets are ignored", () => {
  for (const [from, to, edge] of [["a", "a"], ["a", "b", "before"], ["missing", "b"]]) {
    assert.equal(moveWorkspace(fixtures(), ["a", "b", "c"], from, to, edge), null);
  }
});

test("link reordering preserves metadata and selected links in both directions", () => {
  const sessions = fixtures();
  const selections = new Map([["a", new Set([0, 1])]]);
  const down = moveLink(sessions, selections, "a", 0, "a", 3);
  assert.deepEqual(titles(down.updates[0]), ["two", "three", "one"]);
  assert.deepEqual([...down.selections.get("a")].sort(), [0, 2]);
  assert.deepEqual(down.updates[0].tabs[2], sessions[0].tabs[0]);
  const up = moveLink(sessions, selections, "a", 2, "a", 0);
  assert.deepEqual(titles(up.updates[0]), ["three", "one", "two"]);
  assert.deepEqual([...up.selections.get("a")], [1, 2]);
  assert.deepEqual(titles(sessions[0]), ["one", "two", "three"]);
  assert.deepEqual([...selections.get("a")], [0, 1]);
});

test("cross-workspace moves save destination first and remap both selections", () => {
  const sessions = fixtures();
  const result = moveLink(sessions, new Map([["a", new Set([1, 2])], ["b", new Set([0])]]), "a", 1, "b", 0);
  assert.deepEqual(result.updates.map((s) => s.id), ["b", "a"]);
  assert.deepEqual(titles(result.updates[0]), ["two", "four"]);
  assert.deepEqual(titles(result.updates[1]), ["one", "three"]);
  assert.deepEqual([...result.selections.get("a")], [1]);
  assert.deepEqual([...result.selections.get("b")].sort(), [0, 1]);
  assert.equal(result.updates.reduce((sum, s) => sum + s.tabs.length, 0), 4);
});

test("links can move to empty workspaces or the end of a list", () => {
  const empty = moveLink(fixtures(), new Map(), "a", 0, "c", 0);
  assert.deepEqual(titles(empty.updates[0]), ["one"]);
  assert.equal(empty.selections.size, 0);
  const end = moveLink(fixtures(), new Map(), "a", 2, "b", 1);
  assert.deepEqual(titles(end.updates[0]), ["four", "three"]);
});

test("moving the last link leaves its source empty and moves its selection", () => {
  const result = moveLink(fixtures(), new Map([["b", new Set([0])]]), "b", 0, "c", 0);
  assert.deepEqual(result.updates[1].tabs, []);
  assert.equal(result.selections.has("b"), false);
  assert.deepEqual([...result.selections.get("c")], [0]);
});

test("duplicate URLs retain separate link metadata", () => {
  const sessions = fixtures();
  sessions[1].tabs = [{ ...sessions[0].tabs[0], note: "Different notes" }];
  const result = moveLink(sessions, new Map(), "a", 0, "b", 1);
  assert.equal(result.updates[0].tabs.length, 2);
  assert.deepEqual(result.updates[0].tabs.map((tab) => tab.note), ["Different notes", "Keep my notes"]);
});

test("invalid or unchanged link drops do not alter data", () => {
  for (const [source, index, destination, gap] of [
    ["a", 0, "a", 0], ["a", 0, "a", 1], ["a", 0, "b", -1],
    ["a", 0, "b", 2], ["a", 99, "b", 0], ["missing", 0, "b", 0],
    ["a", 0, "missing", 0], ["a", 0, "b", 0.5],
  ]) assert.equal(moveLink(fixtures(), new Map(), source, index, destination, gap), null);
});
