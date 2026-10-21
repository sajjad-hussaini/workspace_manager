import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { getBrowserWindows, getSaveableTabs, getSelectedWindowTabs } from "../src/lib/browserWindows.js";
import { getCurrentTabs, getUniqueTabs } from "../src/lib/utils.js";

const originalChrome = globalThis.chrome;
afterEach(() => { globalThis.chrome = originalChrome; });

test("lists three normal windows, puts this view's window first, and groups their tabs", async () => {
  globalThis.chrome = {
    windows: {
      getCurrent: async () => ({ id: 20 }),
      getAll: async (options) => {
        assert.deepEqual(options, { populate: true, windowTypes: ["normal"] });
        return [
          { id: 10, tabs: [{ id: 1, url: "https://one.example/", title: "Research", active: true }] },
          { id: 30, tabs: [{ id: 3, url: "https://three.example/", title: "Planning" }] },
          { id: 20, tabs: [{ id: 2, url: "https://two.example/", title: "Work", active: true }, { id: 4, url: "chrome-extension://id/dashboard" }] }
        ];
      }
    }
  };
  const windows = await getBrowserWindows();
  assert.equal(windows.length, 3);
  assert.deepEqual(windows.map(({ id, current, label, tabs }) => ({ id, current, label, tabIds: tabs.map((tab) => tab.id) })), [
    { id: 20, current: true, label: "Current Window", tabIds: [2] },
    { id: 10, current: false, label: "Window 2", tabIds: [1] },
    { id: 30, current: false, label: "Window 3", tabIds: [3] }
  ]);
  assert.equal(windows[0].title, "Work");
});

test("filters internal tabs, keeps browser tab order and tolerates missing metadata", () => {
  assert.deepEqual(getSaveableTabs([
    { id: 2, index: 5, url: "https://second.example/" },
    { id: 3, url: "chrome://settings" },
    { id: 4, url: "chrome-extension://id/index.html" },
    { id: 5, url: "about:blank" },
    { id: 6, url: "edge://settings" },
    { id: 7, url: "devtools://devtools" },
    { id: 8 },
    { id: 1, index: 0, url: "https://first.example/", title: "First", favIconUrl: "https://first.example/icon.png" }
  ]), [
    { id: 1, url: "https://first.example/", title: "First", favicon: "https://first.example/icon.png" },
    { id: 2, url: "https://second.example/", title: "", favicon: "" }
  ]);
  assert.deepEqual(getSaveableTabs(), []);
});

test("saves only selected tabs from the chosen window even after focus changes", async () => {
  globalThis.chrome = { tabs: { query: async (query) => {
    assert.deepEqual(query, { windowId: 30 });
    return [
      { id: 301, index: 0, url: "https://selected.example/", title: "Selected" },
      { id: 302, index: 1, url: "https://unchecked.example/" },
      { id: 304, index: 2, url: "https://new-tab.example/" }
    ];
  } } };
  // Tab 303 closed since selection; tab 304 was opened after selection.
  const tabs = await getSelectedWindowTabs({ windowId: 30, tabIds: [301, 303] });
  assert.deepEqual(tabs, [{ url: "https://selected.example/", title: "Selected", favicon: "" }]);
  assert.equal("id" in tabs[0], false, "Chrome tab IDs must not be stored in workspaces");
});

test("a closed source window fails instead of falling back to the current window", async () => {
  globalThis.chrome = { tabs: { query: async (query) => {
    assert.deepEqual(query, { windowId: 99 });
    throw new Error("No window with id: 99");
  } } };
  await assert.rejects(getSelectedWindowTabs({ windowId: 99, tabIds: [1] }), /No window/);
});

test("no selected or remaining tabs produces an empty save source", async () => {
  globalThis.chrome = { tabs: { query: async () => [{ id: 1, url: "https://example.com/" }] } };
  assert.deepEqual(await getSelectedWindowTabs({ windowId: 10, tabIds: [] }), []);
  assert.deepEqual(await getSelectedWindowTabs({ windowId: 10, tabIds: [99] }), []);
});

test("current-window quick save uses the same filtering and strips live tab IDs", async () => {
  globalThis.chrome = { tabs: { query: async (query) => {
    assert.deepEqual(query, { currentWindow: true });
    return [{ id: 1, url: "chrome://newtab/" }, { id: 2, url: "https://example.com/", title: "Example" }];
  } } };
  assert.deepEqual(await getCurrentTabs(), [{ url: "https://example.com/", title: "Example", favicon: "" }]);
});

test("selected window links use existing duplicate detection when saving", async () => {
  globalThis.chrome = { tabs: { query: async () => [
    { id: 1, url: "https://example.com/page#one" },
    { id: 2, url: "https://example.com/page#two" },
    { id: 3, url: "https://other.example/" }
  ] } };
  const selected = await getSelectedWindowTabs({ windowId: 10, tabIds: [1, 2, 3] });
  const existing = { url: "https://example.com/page", title: "Saved title", note: "Keep notes" };
  const merged = getUniqueTabs([existing, ...selected]);
  assert.equal(merged.length, 2);
  assert.deepEqual(merged[0], existing);
  assert.equal(merged[1].url, "https://other.example/");
});
