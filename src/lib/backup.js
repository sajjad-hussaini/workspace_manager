export function parseWorkspaceBackup(text) {
  let backup;
  try { backup = JSON.parse(text); } catch { throw new Error("Choose a valid JSON backup file."); }
  if (backup?.format !== "tabmorrow-backup" || backup.version !== 1 || !Array.isArray(backup.workspaces)) {
    throw new Error("This is not a supported TabMorrow backup file.");
  }
  if (backup.workspaces.some((session) => !session || typeof session !== "object" || typeof session.title !== "string" || !session.title.trim() || !Array.isArray(session.tabs) || session.tabs.some((tab) => !tab || typeof tab !== "object" || typeof tab.url !== "string"))) {
    throw new Error("The backup contains an invalid workspace or link.");
  }
  return backup.workspaces;
}
