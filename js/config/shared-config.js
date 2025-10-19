/**
 * 🎯 SHARED CONFIGURATION
 * Single source of truth for all storage keys and defaults
 * Used by both popup.js and perfect-mimic.js
 */

// Use window to avoid redeclaration errors on hot reload
window.STORAGE_SCHEMA = window.STORAGE_SCHEMA || {
  // ===== WORD LISTS =====
  knownWords: [],       // Words user marked as "known"
  unknownWords: [],     // Words user is "learning"
  
  // ===== EXTENSION STATE =====
  isActive: true,       // Extension enabled/disabled
  
  // ===== SUBTITLE BEHAVIOR =====
  pauseOnHover: true,   // Pause video when hovering over words
  
  // ===== TRANSLATION SETTINGS =====
  showTranslations: true,  // Show translations in popup
  sourceLang: 'en',        // Source language code
  targetLang: 'tr',        // Target language code
  
  // ===== STYLING =====
  knownColor: '#10b981',      // Green for known words
  learningColor: '#f59e0b',   // Orange for learning words
  
  // ===== TRANSLATION CACHE =====
  translationCache: {},    // { "word": "translation" }
  cacheTimestamps: {}      // { "word": timestamp }
};

/**
 * Word states
 */
window.WORD_STATES = window.WORD_STATES || {
  UNMARKED: 'unmarked',  // Not in any list
  KNOWN: 'known',        // In knownWords list
  LEARNING: 'learning'   // In unknownWords list
};

/**
 * Get next state in cycle: unmarked → known → learning → unmarked
 */
window.getNextWordState = window.getNextWordState || function(currentState) {
  switch(currentState) {
    case window.WORD_STATES.UNMARKED:
      return window.WORD_STATES.KNOWN;
    case window.WORD_STATES.KNOWN:
      return window.WORD_STATES.LEARNING;
    case window.WORD_STATES.LEARNING:
      return window.WORD_STATES.UNMARKED;
    default:
      return window.WORD_STATES.KNOWN;
  }
};

/**
 * Get word state from word lists
 */
window.getWordState = window.getWordState || function(word, knownWords, unknownWords) {
  if (knownWords.has(word)) {
    return window.WORD_STATES.KNOWN;
  } else if (unknownWords.has(word)) {
    return window.WORD_STATES.LEARNING;
  } else {
    return window.WORD_STATES.UNMARKED;
  }
};

/**
 * CSS class names for word states
 */
window.WORD_CLASSES = window.WORD_CLASSES || {
  [window.WORD_STATES.UNMARKED]: 'unmarked-word',
  [window.WORD_STATES.KNOWN]: 'known-word',
  [window.WORD_STATES.LEARNING]: 'unknown-word'  // Keep 'unknown-word' for backward compatibility
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    STORAGE_SCHEMA: window.STORAGE_SCHEMA,
    WORD_STATES: window.WORD_STATES,
    WORD_CLASSES: window.WORD_CLASSES,
    getNextWordState: window.getNextWordState,
    getWordState: window.getWordState
  };
}
