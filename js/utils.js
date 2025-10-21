// 🎭 Subtitle System Utils
// Helper functions and utilities

// Make functions globally available
window.SubtitleUtils = {
  /**
   * Helper function to safely access window properties
   * This ensures scripts are loaded in correct order
   */
  waitForGlobals() {
    // Background-first readiness: prefer delegateStorageOp (background RPC) instead of
    // relying on a window.storageManager instance (which may not exist in content scripts).
    return new Promise((resolve) => {
      const check = () => {
        // If delegateStorageOp (message bridge) is available, consider globals ready.
        if (typeof window.delegateStorageOp === 'function' && window.STORAGE_SCHEMA && window.MESSAGE_TYPES) {
          resolve();
          return;
        }

        // Fallback: if window.storageManager exists (older contexts), accept that too.
        if (window.storageManager && window.STORAGE_SCHEMA && window.MESSAGE_TYPES) {
          resolve();
          return;
        }

        // Otherwise poll until one of the above becomes available.
        setTimeout(check, 100);
      };
      check();
    });
  },

  /**
   * Escape HTML special characters
   */
  escapeHtml(text) {
    if (text == null) return '';
    return String(text).replace(/[&<>"'`=\/]/g, function (s) {
      return ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
        '`': '&#96;',
        '=': '&#61;',
        '/': '&#x2F;'
      })[s];
    });
  },

  /**
   * Debounce function for performance optimization
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
};