// src/lib/storage.js
// Har session apni alag key me store hoti hai taake sync ki 8KB per-item limit
// zyada se zyada sessions ke liye fit ho sake. Chhoti sessions "sync" me jati hain
// (agar user Google se signed-in hai to dusre devices pe bhi milengi), badi ya
// sync-fail hone wali sessions "local" me chali jati hain.

const PREFIX = "session_";
const THEME_KEY = "tabWorkspacesTheme";
const SYNC_ITEM_LIMIT_BYTES = 7500; // Chrome ki 8192 hard limit se thora neeche

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

// chrome.storage change events sunta hai taake dono pages (popup + fullpage)
// hamesha latest data dikhayen, chahe change kahin se bhi hui ho
export function onSessionsChanged(callback) {
  const listener = (changes, areaName) => {
    if (areaName !== "sync" && areaName !== "local") return;
    const relevant = Object.keys(changes).some((k) => k.startsWith(PREFIX));
    if (relevant) callback();
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
