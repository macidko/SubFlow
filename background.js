// Background service worker for YouTube Subtitle Colorer
chrome.runtime.onInstalled.addListener(() => {
  console.log('YouTube Subtitle Colorer extension installed');
});

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'wordUpdate') {
    // Forward the update to popup if it's open
    chrome.runtime.sendMessage(request).catch(() => {
      // Popup might not be open, that's okay
    });
  }
});

// Keep the service worker alive
chrome.runtime.onStartup.addListener(() => {
  console.log('YouTube Subtitle Colorer extension started');
});