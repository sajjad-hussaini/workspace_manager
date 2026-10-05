import test from "node:test";
import assert from "node:assert/strict";
import { normalizeTag, parseTags, tagsMatchSearch } from "./tags.js";
import { workspaceMatchesSearch, tabMatchesSearch } from "./utils.js";

test("tag entry accepts hashtags and comma-separated input without empty or duplicate tags", () => {
  assert.deepEqual(parseTags(" #Design, design, ##Research, , #, UI UX "), ["Design", "Research", "UI UX"]);
  assert.deepEqual(parseTags(["Design", "#design", "Research"]), ["Design", "Research"]);
  assert.equal(normalizeTag(" ##Work "), "Work");
  assert.deepEqual(parseTags(""), []);
});

test("hashtag searches match tags, including short and legacy tags, without matching unrelated text", () => {
  assert.equal(tagsMatchSearch(["#AI", "UI UX"], "#ai"), true);
  assert.equal(tagsMatchSearch("Design, Research", "#research"), true);
  assert.equal(tagsMatchSearch(["Designer"], "#design"), false);
  assert.equal(tagsMatchSearch(["Design"], "#"), false);
  assert.equal(tabMatchesSearch({ title: "Design", url: "https://design.example" }, "#design"), false);
  assert.equal(tabMatchesSearch({ tags: ["Design"] }, "#DESIGN"), true);
  assert.equal(tabMatchesSearch({ title: "Design notes" }, "design"), true);
});

test("tag searches find matching workspaces and the parents of matching saved tabs", () => {
  const session = { title: "Design notes", tags: ["Work"], tabs: [{ title: "Reference", tags: ["AI"] }] };
  assert.equal(workspaceMatchesSearch(session, "#work"), true);
  assert.equal(workspaceMatchesSearch(session, "#ai"), true);
  assert.equal(workspaceMatchesSearch(session, "#design"), false);
  assert.equal(workspaceMatchesSearch(session, "design"), true);
  assert.equal(workspaceMatchesSearch({}, "#work"), false);
});
