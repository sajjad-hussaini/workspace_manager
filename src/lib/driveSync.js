const DRIVE_FILE_NAME = "tabmorrow-data.json";
const DRIVE_API = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3/files";
const SESSION_PREFIX = "session_";
const DELETED_PREFIX = "tabmorrowDriveDeleted_";
const SETTING_TIME_PREFIX = "tabmorrowDriveUpdated_";
const DRIVE_STATE_KEY = "tabmorrowDriveState";
export const DRIVE_DIRTY_KEY = "tabmorrowDriveDirtyAt";

export const DRIVE_SETTING_KEYS = [
  "tabWorkspacesTheme",
  "tabWorkspacesSort",
  "tabWorkspacesOpenBehavior",
  "tabWorkspacesTabWarning",
  "tabWorkspacesAutoNameQuickSave",
  "tabWorkspacesShowSavedTabCount"
];

let pendingSync = Promise.resolve();
let refreshedToken = null;

function isConfigured() {
  return Boolean(chrome.runtime.getManifest().oauth2?.client_id);
}

function configuredClientId() {
  return chrome.runtime.getManifest().oauth2?.client_id || "";
}

function queue(task) {
  const result = pendingSync.catch(() => {}).then(task);
  pendingSync = result.catch(() => {});
  return result;
}

async function updateState(patch) {
  const stored = await chrome.storage.local.get(DRIVE_STATE_KEY);
  const next = { ...(stored[DRIVE_STATE_KEY] || {}), ...patch };
  await chrome.storage.local.set({ [DRIVE_STATE_KEY]: next });
  return next;
}

export async function getDriveStatus() {
  const stored = await chrome.storage.local.get(DRIVE_STATE_KEY);
  const state = { connected: false, lastSyncedAt: "", error: "", ...(stored[DRIVE_STATE_KEY] || {}) };
  return { ...state, configured: isConfigured(), connected: state.connected && state.clientId === configuredClientId() };
}

export function onDriveStatusChanged(callback) {
  const listener = (changes, area) => {
    if (area === "local" && changes[DRIVE_STATE_KEY]) callback();
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

export async function markDriveDirty() {
  await chrome.storage.local.set({ [DRIVE_DIRTY_KEY]: crypto.randomUUID() });
}

export async function markSettingUpdated(key) {
  await chrome.storage.local.set({ [`${SETTING_TIME_PREFIX}${key}`]: Date.now() });
  await markDriveDirty();
}

export async function markWorkspaceDeleted(id) {
  await chrome.storage.local.set({ [`${DELETED_PREFIX}${id}`]: Date.now() });
}

export async function clearWorkspaceDeletion(id) {
  await chrome.storage.local.remove(`${DELETED_PREFIX}${id}`);
}

async function authToken(interactive) {
  if (!isConfigured()) throw new Error("Google Drive OAuth is not configured for this extension build.");
  const result = await chrome.identity.getAuthToken({ interactive });
  if (!result?.token) throw new Error("Google sign-in did not return an access token.");
  return result.token;
}

async function driveRequest(url, options = {}, token) {
  let currentToken = refreshedToken || token;
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch(url, {
      ...options,
      headers: { ...(options.headers || {}), Authorization: `Bearer ${currentToken}` }
    });
    if (response.status === 401 && attempt === 0) {
      await chrome.identity.removeCachedAuthToken({ token: currentToken });
      currentToken = await authToken(false);
      refreshedToken = currentToken;
      continue;
    }
    if (!response.ok) {
      let detail = "";
      try { detail = (await response.json())?.error?.message || ""; } catch { /* Empty error body. */ }
      throw new Error(detail || `Google Drive request failed (${response.status}).`);
    }
    return response;
  }
  throw new Error("Google Drive authorization expired. Reconnect your account.");
}

function sessionTime(session) {
  return Date.parse(session?.updatedAt || session?.createdAt || "") || 0;
}

function cleanSession(session) {
  const { storageArea, ...data } = session;
  return data;
}

async function readLocalSnapshot() {
  const [syncData, localData] = await Promise.all([
    chrome.storage.sync.get(null),
    chrome.storage.local.get(null)
  ]);
  const workspaces = {};
  for (const data of [syncData, localData]) {
    for (const [key, value] of Object.entries(data)) {
      if (!key.startsWith(SESSION_PREFIX) || !value?.id) continue;
      if (!workspaces[value.id] || sessionTime(value) >= sessionTime(workspaces[value.id])) {
        workspaces[value.id] = cleanSession(value);
      }
    }
  }
  const deleted = {};
  const settings = {};
  for (const [key, value] of Object.entries(localData)) {
    if (key.startsWith(DELETED_PREFIX)) deleted[key.slice(DELETED_PREFIX.length)] = Number(value) || 0;
  }
  for (const key of DRIVE_SETTING_KEYS) {
    if (Object.hasOwn(localData, key)) {
      settings[key] = { value: localData[key], updatedAt: Number(localData[`${SETTING_TIME_PREFIX}${key}`]) || 1 };
    }
  }
  return { format: "tabmorrow-drive", version: 1, workspaces, deleted, settings };
}

export function mergeDriveSnapshots(local, remote) {
  const workspaces = {};
  const deleted = {};
  const settings = {};
  const ids = new Set([...Object.keys(local.workspaces), ...Object.keys(remote.workspaces), ...Object.keys(local.deleted), ...Object.keys(remote.deleted)]);
  for (const id of ids) {
    const left = local.workspaces[id];
    const right = remote.workspaces[id];
    const newest = !left ? right : !right ? left : sessionTime(left) > sessionTime(right) ? left : right;
    const deletedAt = Math.max(Number(local.deleted[id]) || 0, Number(remote.deleted[id]) || 0);
    if (deletedAt && deletedAt >= sessionTime(newest)) deleted[id] = deletedAt;
    else if (newest) workspaces[id] = newest;
  }
  for (const key of DRIVE_SETTING_KEYS) {
    const left = local.settings[key];
    const right = remote.settings[key];
    if (left || right) settings[key] = !left ? right : !right ? left : Number(left.updatedAt) > Number(right.updatedAt) ? left : right;
  }
  return { format: "tabmorrow-drive", version: 1, workspaces, deleted, settings };
}

function parseRemoteSnapshot(value) {
  const isRecord = (item) => item !== null && typeof item === "object" && !Array.isArray(item);
  if (value?.format !== "tabmorrow-drive" || value.version !== 1 ||
      !isRecord(value.workspaces) || !isRecord(value.settings) || !isRecord(value.deleted) ||
      Object.entries(value.workspaces).some(([id, session]) => !isRecord(session) || session.id !== id || !Array.isArray(session.tabs)) ||
      Object.values(value.settings).some((setting) => !isRecord(setting) || !Object.hasOwn(setting, "value"))) {
    throw new Error("Google Drive contains an unsupported TabMorrow data file. Nothing was overwritten.");
  }
  return value;
}

async function findDriveFile(token) {
  const url = new URL(DRIVE_API);
  url.searchParams.set("spaces", "appDataFolder");
  url.searchParams.set("q", `name = '${DRIVE_FILE_NAME}' and trashed = false`);
  url.searchParams.set("fields", "nextPageToken,files(id,name,modifiedTime)");
  url.searchParams.set("pageSize", "100");
  const response = await driveRequest(url, {}, token);
  const result = await response.json();
  return (result.files || []).sort((a, b) => String(b.modifiedTime).localeCompare(String(a.modifiedTime)))[0] || null;
}

async function readRemoteSnapshot(fileId, token) {
  if (!fileId) return { format: "tabmorrow-drive", version: 1, workspaces: {}, deleted: {}, settings: {} };
  const response = await driveRequest(`${DRIVE_API}/${encodeURIComponent(fileId)}?alt=media`, {}, token);
  return parseRemoteSnapshot(await response.json());
}

async function writeRemoteSnapshot(fileId, snapshot, token) {
  const content = JSON.stringify(snapshot);
  const data = new Blob([content], { type: "application/json" });
  if (data.size > 5 * 1024 * 1024) {
    const endpoint = fileId ? `${DRIVE_UPLOAD_API}/${encodeURIComponent(fileId)}` : DRIVE_UPLOAD_API;
    const metadata = fileId ? {} : { name: DRIVE_FILE_NAME, mimeType: "application/json", parents: ["appDataFolder"] };
    const started = await driveRequest(`${endpoint}?uploadType=resumable`, {
      method: fileId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": "application/json", "X-Upload-Content-Length": String(data.size) },
      body: JSON.stringify(metadata)
    }, token);
    const location = started.headers.get("Location");
    if (!location || new URL(location).origin !== "https://www.googleapis.com") throw new Error("Google Drive did not return a valid upload URL.");
    const uploaded = await driveRequest(location, { method: "PUT", headers: { "Content-Type": "application/json" }, body: data }, token);
    const id = fileId || (await uploaded.json()).id;
    if (!id) throw new Error("Google Drive did not return a file ID.");
    return id;
  }
  if (fileId) {
    await driveRequest(`${DRIVE_UPLOAD_API}/${encodeURIComponent(fileId)}?uploadType=media`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: content
    }, token);
    return fileId;
  }
  const boundary = `tabmorrow-${crypto.randomUUID()}`;
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
    JSON.stringify({ name: DRIVE_FILE_NAME, mimeType: "application/json", parents: ["appDataFolder"] }),
    `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n`,
    content,
    `\r\n--${boundary}--\r\n`
  ]);
  const created = await driveRequest(`${DRIVE_UPLOAD_API}?uploadType=multipart&fields=id`, {
    method: "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body
  }, token);
  const id = (await created.json()).id;
  if (!id) throw new Error("Google Drive did not return a file ID.");
  return id;
}

async function applySnapshot(snapshot) {
  const [syncData, localData] = await Promise.all([chrome.storage.sync.get(null), chrome.storage.local.get(null)]);
  const values = {};
  for (const [id, session] of Object.entries(snapshot.workspaces)) values[`${SESSION_PREFIX}${id}`] = session;
  for (const [id, time] of Object.entries(snapshot.deleted)) values[`${DELETED_PREFIX}${id}`] = time;
  for (const [key, setting] of Object.entries(snapshot.settings)) {
    values[key] = setting.value;
    values[`${SETTING_TIME_PREFIX}${key}`] = setting.updatedAt;
  }
  const changed = Object.fromEntries(Object.entries(values).filter(([key, value]) => JSON.stringify(localData[key]) !== JSON.stringify(value)));
  if (Object.keys(changed).length) await chrome.storage.local.set(changed);
  const staleLocal = Object.keys(localData).filter((key) =>
    (key.startsWith(SESSION_PREFIX) || key.startsWith(DELETED_PREFIX) || key.startsWith(SETTING_TIME_PREFIX)) && !Object.hasOwn(values, key));
  if (staleLocal.length) await chrome.storage.local.remove(staleLocal);
  const syncKeys = Object.keys(syncData).filter((key) => key.startsWith(SESSION_PREFIX));
  if (syncKeys.length) await chrome.storage.sync.remove(syncKeys);
}

async function syncWithToken(token) {
  const file = await findDriveFile(token);
  const remote = await readRemoteSnapshot(file?.id, token);
  const local = await readLocalSnapshot();
  let merged = mergeDriveSnapshots(local, remote);
  let fileId = file?.id;
  if (!fileId || JSON.stringify(merged) !== JSON.stringify(remote)) fileId = await writeRemoteSnapshot(fileId, merged, token);
  // A workspace may change while the upload is in flight. Include that edit before updating the local cache.
  const latest = mergeDriveSnapshots(await readLocalSnapshot(), merged);
  if (JSON.stringify(latest) !== JSON.stringify(merged)) {
    fileId = await writeRemoteSnapshot(fileId, latest, token);
    merged = latest;
  }
  await applySnapshot(merged);
  await updateState({ connected: true, clientId: configuredClientId(), lastSyncedAt: new Date().toISOString(), error: "" });
  return merged;
}

export function connectGoogleDrive() {
  return queue(async () => {
    try {
      const token = await authToken(true);
      refreshedToken = token;
      return await syncWithToken(token);
    }
    catch (error) { await updateState({ error: error.message }); throw error; }
  });
}

export function syncDriveIfConnected() {
  return queue(async () => {
    const state = await getDriveStatus();
    if (!state.connected) return null;
    try { return await syncWithToken(await authToken(false)); }
    catch (error) { await updateState({ error: error.message }); return null; }
  });
}

export function disconnectGoogleDrive() {
  return queue(() => updateState({ connected: false, error: "" }));
}
