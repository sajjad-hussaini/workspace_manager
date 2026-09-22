

const PREFIX = "session_";
const THEME_KEY = "tabWorkspacesTheme";
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
