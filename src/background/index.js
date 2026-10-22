// src/background/index.js
// Manifest V3 service worker
// Note: chrome.action.onClicked not working because manifest into default_popup
// on install, open full manager page (src/pages/fullpage/index.html) in a new tab
import { DRIVE_DIRTY_KEY, syncDriveIfConnected } from "../lib/driveSync.js";

let syncTimer;

function scheduleDriveSync() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => { void syncDriveIfConnected(); }, 500);
  chrome.alarms.create("tabmorrow-drive-pending", { when: Date.now() + 30_000 });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[DRIVE_DIRTY_KEY]) scheduleDriveSync();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name.startsWith("tabmorrow-drive-")) void syncDriveIfConnected();
});

chrome.runtime.onInstalled.addListener((details) => {
  chrome.alarms.create("tabmorrow-drive-periodic", { periodInMinutes: 5 });
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("src/pages/fullpage/index.html") });
  }
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create("tabmorrow-drive-periodic", { periodInMinutes: 5 });
  void syncDriveIfConnected();
});
