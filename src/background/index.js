// src/background/index.js
// Manifest V3 service worker
// Note: chrome.action.onClicked not working because manifest into default_popup
// on install, open full manager page (src/pages/fullpage/index.html) in a new tab

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("src/pages/fullpage/index.html") });
  }
});
