/**
 * 📨 MESSAGE PROTOCOL
 * Standardized message format for popup ↔ content script communication
 */

window.MESSAGE_TYPES = window.MESSAGE_TYPES || {
  // ===== STATUS QUERIES =====
  PING: 'ping',                    // Check if content script is alive
  GET_STATUS: 'getStatus',         // Get current extension state
  
  // ===== CONTROL =====
  TOGGLE: 'toggle',                // Toggle extension on/off
  REFRESH: 'refresh',              // Refresh subtitle display
  
  // ===== DATA SYNC =====
  WORDS_UPDATED: 'wordsUpdated',           // Word lists changed
  SETTINGS_UPDATED: 'settingsUpdated',     // Settings changed (colors, language, etc)
  STORAGE_CHANGED: 'storageChanged',       // Generic storage change notification
  
  // ===== ACTIONS =====
  MARK_WORD: 'markWord',           // Mark word as known/learning
  REMOVE_WORD: 'removeWord',       // Remove word from lists
  
  // ===== RESPONSES =====
  SUCCESS: 'success',              // Operation succeeded
  ERROR: 'error'                   // Operation failed
};

/**
 * Create a standardized message
 * @param {string} type - Message type from MESSAGE_TYPES
 * @param {*} payload - Message data
 * @returns {Object} Formatted message
 */
window.createMessage = window.createMessage || function(type, payload = null) {
  return {
    type,
    payload,
    timestamp: Date.now()
  };
};

/**
 * Create a success response
 * @param {*} data - Response data
 * @returns {Object} Success message
 */
window.createSuccessResponse = window.createSuccessResponse || function(data = null) {
  return window.createMessage(window.MESSAGE_TYPES.SUCCESS, data);
};

/**
 * Create an error response
 * @param {string} error - Error message
 * @returns {Object} Error message
 */
window.createErrorResponse = window.createErrorResponse || function(error) {
  return window.createMessage(window.MESSAGE_TYPES.ERROR, { error });
};

/**
 * Send message to content script
 * @param {number} tabId - Tab ID
 * @param {string} type - Message type
 * @param {*} payload - Message data
 * @returns {Promise<*>} Response from content script
 */
window.sendToContentScript = window.sendToContentScript || async function(tabId, type, payload = null) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, window.createMessage(type, payload));
    return response;
  } catch (error) {
    console.error('[MessageProtocol] Failed to send message:', error);
    throw error;
  }
};

/**
 * Send message to all tabs
 * @param {string} type - Message type
 * @param {*} payload - Message data
 */
window.broadcastToAllTabs = window.broadcastToAllTabs || async function(type, payload = null) {
  const tabs = await chrome.tabs.query({});
  const message = window.createMessage(type, payload);
  
  const promises = tabs.map(tab => 
    chrome.tabs.sendMessage(tab.id, message).catch(() => {
      // Ignore errors for tabs without content script
    })
  );
  
  await Promise.all(promises);
};

/**
 * Setup message listener in content script
 * @param {Object} handlers - Map of message types to handler functions
 */
window.setupMessageListener = window.setupMessageListener || function(handlers) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Validate message format
    if (!message || !message.type) {
      console.warn('[MessageProtocol] Invalid message format:', message);
      sendResponse(window.createErrorResponse('Invalid message format'));
      return false;
    }

    console.log('[MessageProtocol] Received:', message.type, message.payload);

    // Find handler for this message type
    const handler = handlers[message.type];
    if (!handler) {
      console.warn('[MessageProtocol] No handler for:', message.type);
      sendResponse(window.createErrorResponse(`No handler for type: ${message.type}`));
      return false;
    }

    // Execute handler
    try {
      // If handler returns a promise, handle it asynchronously
      const result = handler(message.payload, sender);
      
      if (result instanceof Promise) {
        result
          .then(data => sendResponse(window.createSuccessResponse(data)))
          .catch(error => sendResponse(window.createErrorResponse(error.message)));
        return true; // Keep channel open for async response
      } else {
        sendResponse(window.createSuccessResponse(result));
        return false;
      }
    } catch (error) {
      console.error('[MessageProtocol] Handler error:', error);
      sendResponse(window.createErrorResponse(error.message));
      return false;
    }
  });
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MESSAGE_TYPES: window.MESSAGE_TYPES,
    createMessage: window.createMessage,
    createSuccessResponse: window.createSuccessResponse,
    createErrorResponse: window.createErrorResponse,
    sendToContentScript: window.sendToContentScript,
    broadcastToAllTabs: window.broadcastToAllTabs,
    setupMessageListener: window.setupMessageListener
  };
}
