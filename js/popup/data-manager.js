// 🎭 Data Manager - Word lists and settings management

// Make class globally available
window.DataManager = class DataManager {
  constructor(popupUI) {
    this.popupUI = popupUI;
  }

  async loadStoredData() {
    const data = await storageManager.get(STORAGE_SCHEMA);

    this.popupUI.knownWords = new Set(data.knownWords || []);
    this.popupUI.unknownWords = new Set(data.unknownWords || []);
    this.popupUI.isActive = data.isActive !== false;
    this.popupUI.pauseOnHover = data.pauseOnHover !== false;
    this.popupUI.showTranslations = data.showTranslations !== false;
    this.popupUI.targetLang = data.targetLang || 'tr';
    this.popupUI.sourceLang = data.sourceLang || 'en';
    this.popupUI.knownColor = data.knownColor || '#10b981';
    this.popupUI.learningColor = data.learningColor || '#f59e0b';

    console.log('📦 Settings loaded:', {
      known: this.popupUI.knownWords.size,
      learning: this.popupUI.unknownWords.size,
      pauseOnHover: this.popupUI.pauseOnHover,
      colors: { known: this.popupUI.knownColor, learning: this.popupUI.learningColor }
    });

    // Update UI elements
    this.popupUI.targetLangSelect.value = this.popupUI.targetLang;
    this.popupUI.showTranslationsCheckbox.checked = this.popupUI.showTranslations;
    this.popupUI.isActiveCheckbox.checked = this.popupUI.isActive;
    this.popupUI.pauseOnHoverCheckbox.checked = this.popupUI.pauseOnHover;
    this.popupUI.knownColorInput.value = this.popupUI.knownColor;
    this.popupUI.learningColorInput.value = this.popupUI.learningColor;

    // Update toggle states
    this.popupUI.toggleTranslations.classList.toggle('active', this.popupUI.showTranslations);
    this.popupUI.toggleExtension.classList.toggle('active', this.popupUI.isActive);
    this.popupUI.togglePauseOnHover.classList.toggle('active', this.popupUI.pauseOnHover);
  }

  async toggleWordStatus(word) {
    // Use unified 3-state cycle
    const currentState = getWordState(word, this.popupUI.knownWords, this.popupUI.unknownWords);
    const nextState = getNextWordState(currentState);

    console.log(`🔄 Toggle: ${word} (${currentState} → ${nextState})`);

    // Update using storage manager (atomic operations!)
    switch (nextState) {
      case WORD_STATES.KNOWN:
        // Move to known
        await storageManager.removeFromSet('unknownWords', word);
        await storageManager.addToSet('knownWords', word);
        this.popupUI.knownWords.add(word);
        this.popupUI.unknownWords.delete(word);
        break;

      case WORD_STATES.LEARNING:
        // Move to learning
        await storageManager.removeFromSet('knownWords', word);
        await storageManager.addToSet('unknownWords', word);
        this.popupUI.unknownWords.add(word);
        this.popupUI.knownWords.delete(word);
        break;

      case WORD_STATES.UNMARKED:
        // Remove from both
        await storageManager.removeFromSet('knownWords', word);
        await storageManager.removeFromSet('unknownWords', word);
        this.popupUI.knownWords.delete(word);
        this.popupUI.unknownWords.delete(word);
        break;
    }

    // Notify content script using new protocol
    await broadcastToAllTabs(MESSAGE_TYPES.WORDS_UPDATED, {
      knownWords: Array.from(this.popupUI.knownWords),
      unknownWords: Array.from(this.popupUI.unknownWords)
    });

    this.popupUI.uiManager.updateUI();
  }

  async clearAllWords() {
    if (!confirm('Tüm kelimeler silinecek. Emin misiniz?')) {
      return;
    }

    this.popupUI.knownWords.clear();
    this.popupUI.unknownWords.clear();
    this.popupUI.translations.clear();

    await storageManager.set({
      knownWords: [],
      unknownWords: []
    });

    await broadcastToAllTabs(MESSAGE_TYPES.REFRESH);
    this.popupUI.uiManager.updateUI();
  }
};