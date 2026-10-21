export function getSaveableTabs(tabs = []) {
  return tabs
    .filter((tab) => tab.url && !/^(chrome|chrome-extension|edge|about|devtools):/i.test(tab.url))
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((tab) => ({
      id: tab.id,
      url: tab.url,
      title: tab.title || "",
      favicon: tab.favIconUrl || ""
    }));
}

export async function getBrowserWindows() {
  const [currentWindow, windows] = await Promise.all([
    chrome.windows.getCurrent(),
    chrome.windows.getAll({ populate: true, windowTypes: ["normal"] })
  ]);
  return windows
    .sort((a, b) => Number(b.id === currentWindow.id) - Number(a.id === currentWindow.id) || a.id - b.id)
    .map((browserWindow, index) => ({
      id: browserWindow.id,
      current: browserWindow.id === currentWindow.id,
      label: browserWindow.id === currentWindow.id ? "Current Window" : `Window ${index + 1}`,
      title: browserWindow.tabs?.find((tab) => tab.active)?.title || "",
      tabs: getSaveableTabs(browserWindow.tabs)
    }));
}

export async function getSelectedWindowTabs({ windowId, tabIds }) {
  // Re-read the source window so switching focus never changes what gets saved.
  const tabs = getSaveableTabs(await chrome.tabs.query({ windowId }));
  const selectedIds = new Set(tabIds);
  return tabs.filter((tab) => selectedIds.has(tab.id))
    .map(({ id, ...tab }) => tab);
}
