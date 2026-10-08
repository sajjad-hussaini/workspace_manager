

const PREFIX = "session_";
const THEME_KEY = "tabWorkspacesTheme";
const SORT_KEY = "tabWorkspacesSort";
const OPEN_BEHAVIOR_KEY = "tabWorkspacesOpenBehavior";
const TAB_WARNING_KEY = "tabWorkspacesTabWarning";
const AUTO_NAME_QUICK_SAVE_KEY = "tabWorkspacesAutoNameQuickSave";
const SORT_OPTIONS = ["manual", "name-asc", "created-desc", "opened-desc"];
const OPEN_BEHAVIOR_OPTIONS = ["current", "new-window"];
const SYNC_ITEM_LIMIT_BYTES = 7500; // Chrome 8192 hard limit below which sync storage is guaranteed to work, but we leave some buffer for overhead

function keyOf(id) {
  return `${PREFIX}${id}`;
}

export async function getSessions() {
  const [syncData, localData] = await Promise.all([
    chrome.storage.sync.get(null),
    chrome.storage.local.get(null)
  ]);

  const sessions = [];
  for (const [key, value] of Object.entries(syncData)) {
    if (key.startsWith(PREFIX)) sessions.push({ ...value, storageArea: "sync" });
  }
  for (const [key, value] of Object.entries(localData)) {
    if (key.startsWith(PREFIX)) sessions.push({ ...value, storageArea: "local" });
  }
  return sessions;
}

export async function persistSession(session) {
  const key = keyOf(session.id);
  const payloadSize = new Blob([JSON.stringify({ [key]: session })]).size;

  if (payloadSize <= SYNC_ITEM_LIMIT_BYTES) {
    try {
      await chrome.storage.sync.set({ [key]: session });
      await chrome.storage.local.remove(key);
      return "sync";
    } catch (error) {
      console.warn("Sync save failed, falling back to local:", error);
    }
  }

  await chrome.storage.local.set({ [key]: session });
  await chrome.storage.sync.remove(key);
  return "local";
}

export async function deleteSessionStorage(sessionId) {
  const key = keyOf(sessionId);
  await Promise.all([chrome.storage.sync.remove(key), chrome.storage.local.remove(key)]);
}

export async function getTheme() {
  const stored = await chrome.storage.local.get(THEME_KEY);
  return stored[THEME_KEY] === "light" ? "light" : "dark";
}

export async function persistTheme(theme) {
  await chrome.storage.local.set({ [THEME_KEY]: theme === "light" ? "light" : "dark" });
}

export async function getSortPreference() {
  const stored = await chrome.storage.local.get(SORT_KEY);
  return SORT_OPTIONS.includes(stored[SORT_KEY]) ? stored[SORT_KEY] : "manual";
}

export async function persistSortPreference(value) {
  if (!SORT_OPTIONS.includes(value)) return;
  await chrome.storage.local.set({ [SORT_KEY]: value });
}

export async function getOpenBehaviorPreference() {
  const stored = await chrome.storage.local.get(OPEN_BEHAVIOR_KEY);
  return OPEN_BEHAVIOR_OPTIONS.includes(stored[OPEN_BEHAVIOR_KEY]) ? stored[OPEN_BEHAVIOR_KEY] : "current";
}

export async function persistOpenBehaviorPreference(value) {
  if (!OPEN_BEHAVIOR_OPTIONS.includes(value)) return;
  await chrome.storage.local.set({ [OPEN_BEHAVIOR_KEY]: value });
}

export async function getTabWarningPreference() {
  const stored = (await chrome.storage.local.get(TAB_WARNING_KEY))[TAB_WARNING_KEY];
  return {
    enabled: stored?.enabled === true,
    limit: Number.isInteger(stored?.limit) && stored.limit >= 1 ? stored.limit : 20
  };
}

export async function persistTabWarningPreference(value) {
  if (typeof value?.enabled !== "boolean" || !Number.isInteger(value.limit) || value.limit < 1) return;
  await chrome.storage.local.set({ [TAB_WARNING_KEY]: value });
}

export async function getAutoNameQuickSavePreference() {
  const stored = await chrome.storage.local.get(AUTO_NAME_QUICK_SAVE_KEY);
  return stored[AUTO_NAME_QUICK_SAVE_KEY] !== false;
}

export async function persistAutoNameQuickSavePreference(enabled) {
  await chrome.storage.local.set({ [AUTO_NAME_QUICK_SAVE_KEY]: enabled === true });
}

// session on change listerner only callback if the change is relevant to sessions (i.e. key starts with PREFIX)
export function onSessionsChanged(callback) {
  const listener = (changes, areaName) => {
    if (areaName !== "sync" && areaName !== "local") return;
    const relevant = Object.keys(changes).some((k) => k.startsWith(PREFIX));
    if (relevant) callback();
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
