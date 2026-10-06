import test from "node:test";
import assert from "node:assert/strict";
import { getNoteSearchExcerpt } from "./search.js";
import { workspaceMatchesSearch, tabMatchesSearch } from "./utils.js";

test("short matching notes remain complete and preserve their casing", () => {
  assert.equal(getNoteSearchExcerpt("Discuss the Launch plan tomorrow.", " launch "), "Discuss the Launch plan tomorrow.");
});

test("a fourth-line match starts at that line with a leading ellipsis", () => {
  const note = "First line\nSecond line\nThird line\nReview the Launch plan\nSend it tomorrow";
  assert.equal(getNoteSearchExcerpt(note, "launch"), "… Review the Launch plan\nSend it tomorrow");
  assert.equal(workspaceMatchesSearch({ note }, "launch"), true);
  assert.equal(tabMatchesSearch({ note }, "launch"), true);
});

test("long paragraphs keep the whole match visible with context on both sides", () => {
  const note = `${"earlier words ".repeat(50)}Launch checklist${" later words".repeat(50)}`;
  const excerpt = getNoteSearchExcerpt(note, "launch checklist");
  assert.ok(excerpt.startsWith("… "));
  assert.ok(excerpt.endsWith(" …"));
  assert.ok(excerpt.includes("Launch checklist"));
  assert.ok(excerpt.length < 240);
});

test("a long search phrase is never cut off", () => {
  const term = "important ".repeat(30).trim();
  assert.ok(getNoteSearchExcerpt(`Before ${term} after`, term).includes(term));
});

test("empty, unmatched and tag searches do not show misleading note excerpts", () => {
  assert.equal(getNoteSearchExcerpt(null, "launch"), "");
  assert.equal(getNoteSearchExcerpt("Launch", ""), "");
  assert.equal(getNoteSearchExcerpt("Launch", "missing"), "");
  assert.equal(getNoteSearchExcerpt("#Launch", "#launch"), "");
});
