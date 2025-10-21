// 🎭 Export Import Manager - Data export/import functionality

// Make class globally available
window.ExportImportManager = class ExportImportManager {
  constructor(popupUI) {
    this.popupUI = popupUI;
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