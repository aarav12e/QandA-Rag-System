// background.js — Service Worker for WebChat AI Extension
// Opens the side panel when the user clicks the extension icon

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(console.error);
