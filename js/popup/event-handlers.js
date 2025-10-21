// 🎭 Event Handlers - Popup event management

// Make class globally available
window.EventHandlers = class EventHandlers {
  constructor(popupUI) {
    this.popupUI = popupUI;
  }

  setupEventListeners() {
    // Main Tabs
    this.popupUI.mainTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        this.popupUI.uiManager.switchMainTab(tabName);
      });
    });

    // Word Filter Tabs
    this.popupUI.wordTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const filter = tab.dataset.filter;
        this.popupUI.uiManager.switchWordFilter(filter);
      });
    });

    // Search
    this.popupUI.searchInput.addEventListener('input', (e) => {
      this.popupUI.searchQuery = e.target.value.toLowerCase().trim();
      this.popupUI.uiManager.updateWordsList();
    });

    // Language selector
    this.popupUI.targetLangSelect.addEventListener('change', async (e) => {
  this.popupUI.targetLang = e.target.value;
  await window.delegateStorageOp('set', { targetLang: this.popupUI.targetLang });
      this.popupUI.uiManager.updateWordsList();
    });

    // Toggle Extension
    this.popupUI.toggleExtension.addEventListener('click', async () => {
      this.popupUI.isActive = !this.popupUI.isActive;
      this.popupUI.isActiveCheckbox.checked = this.popupUI.isActive;

      if (this.popupUI.isActive) {
        this.popupUI.toggleExtension.classList.add('active');
      } else {
        this.popupUI.toggleExtension.classList.remove('active');
      }

  await window.delegateStorageOp('set', { isActive: this.popupUI.isActive });
      await broadcastToAllTabs(MESSAGE_TYPES.TOGGLE, { isActive: this.popupUI.isActive });
      await this.popupUI.uiManager.checkConnectionStatus();
    });

    // Toggle Translations
    this.popupUI.toggleTranslations.addEventListener('click', async () => {
      this.popupUI.showTranslations = !this.popupUI.showTranslations;
      this.popupUI.showTranslationsCheckbox.checked = this.popupUI.showTranslations;

      if (this.popupUI.showTranslations) {
        this.popupUI.toggleTranslations.classList.add('active');
      } else {
        this.popupUI.toggleTranslations.classList.remove('active');
      }

  await window.delegateStorageOp('set', { showTranslations: this.popupUI.showTranslations });
      this.popupUI.uiManager.updateWordsList();
    });

    // Toggle Pause on Hover
    this.popupUI.togglePauseOnHover.addEventListener('click', async () => {
      this.popupUI.pauseOnHover = !this.popupUI.pauseOnHover;
      this.popupUI.pauseOnHoverCheckbox.checked = this.popupUI.pauseOnHover;
      this.popupUI.togglePauseOnHover.classList.toggle('active', this.popupUI.pauseOnHover);

  await window.delegateStorageOp('set', { pauseOnHover: this.popupUI.pauseOnHover });
      await broadcastToAllTabs(MESSAGE_TYPES.SETTINGS_UPDATED, {
        pauseOnHover: this.popupUI.pauseOnHover
      });

      console.log('⏸ Pause on hover:', this.popupUI.pauseOnHover);
    });

    // Color pickers
    this.popupUI.knownColorInput.addEventListener('change', async (e) => {
  this.popupUI.knownColor = e.target.value;
  await window.delegateStorageOp('set', { knownColor: this.popupUI.knownColor });
      await broadcastToAllTabs(MESSAGE_TYPES.SETTINGS_UPDATED, {
        knownColor: this.popupUI.knownColor,
        learningColor: this.popupUI.learningColor
      });
    });

    this.popupUI.learningColorInput.addEventListener('change', async (e) => {
  this.popupUI.learningColor = e.target.value;
  await window.delegateStorageOp('set', { learningColor: this.popupUI.learningColor });
      await broadcastToAllTabs(MESSAGE_TYPES.SETTINGS_UPDATED, {
        knownColor: this.popupUI.knownColor,
        learningColor: this.popupUI.learningColor
      });
    });

    // Action Buttons
    this.popupUI.refreshBtn.addEventListener('click', () => this.refreshYouTube());
    this.popupUI.translateAllBtn.addEventListener('click', () => this.translateAllWords());
    this.popupUI.exportBtn.addEventListener('click', () => this.exportWords());
    this.popupUI.importBtn.addEventListener('click', () => this.popupUI.fileInput.click());
    this.popupUI.clearBtn.addEventListener('click', () => this.popupUI.dataManager.clearAllWords());

    this.popupUI.fileInput.addEventListener('change', (e) => this.importWords(e));
  }

  async refreshYouTube() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.url?.includes('youtube.com')) {
        await chrome.tabs.reload(tab.id);
      }
    } catch (error) {
      console.error('Refresh error:', error);
    }
  }

  async translateAllWords() {
    const allWords = [...this.popupUI.knownWords, ...this.popupUI.unknownWords];

    if (allWords.length === 0) {
      window.toast.info('Henüz kelime yok!');
      return;
    }

    this.popupUI.translateAllBtn.textContent = '⏳ Çevriliyor...';
    this.popupUI.translateAllBtn.disabled = true;

    try {
      await this.popupUI.translationService.translateBatch(allWords, this.popupUI.sourceLang, this.popupUI.targetLang);
      this.popupUI.uiManager.updateWordsList();
  window.toast.success(`${allWords.length} kelime çevrildi!`);
    } catch (error) {
  window.toast.error('Çeviri hatası!');
    } finally {
      this.popupUI.translateAllBtn.textContent = '🌐 Tüm Kelimeleri Çevir';
      this.popupUI.translateAllBtn.disabled = false;
    }
  }

  async exportWords() {
    const data = {
      knownWords: Array.from(this.popupUI.knownWords),
      unknownWords: Array.from(this.popupUI.unknownWords),
      translations: Object.fromEntries(this.popupUI.translations),
      exportDate: new Date().toISOString(),
      version: '2.1.0'
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subflow-words-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async importWords(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (data.knownWords) {
        this.popupUI.knownWords = new Set([...this.popupUI.knownWords, ...data.knownWords]);
      }
      if (data.unknownWords) {
        this.popupUI.unknownWords = new Set([...this.popupUI.unknownWords, ...data.unknownWords]);
      }
      if (data.translations) {
        this.popupUI.translations = new Map([...this.popupUI.translations, ...Object.entries(data.translations)]);
      }

      await window.delegateStorageOp('set', {
        knownWords: Array.from(this.popupUI.knownWords),
        unknownWords: Array.from(this.popupUI.unknownWords)
      });

      await broadcastToAllTabs(MESSAGE_TYPES.REFRESH);
      this.popupUI.uiManager.updateUI();

      window.toast.success('Kelimeler başarıyla içe aktarıldı!');
    } catch (error) {
      window.toast.error('İçe aktarma hatası!');
    }

    event.target.value = '';
  }
};