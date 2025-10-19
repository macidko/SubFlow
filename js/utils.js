// 🎭 Subtitle System Utils
// Helper functions and utilities

// Make functions globally available
window.SubtitleUtils = {
  /**
   * Helper function to safely access window properties
   * This ensures scripts are loaded in correct order
   */
  waitForGlobals() {
    return new Promise((resolve) => {
      const check = () => {
        if (window.storageManager && window.STORAGE_SCHEMA && window.MESSAGE_TYPES) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  },

  /**
   * Escape HTML special characters
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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