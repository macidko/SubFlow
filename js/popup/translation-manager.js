// 🎭 Translation Manager - Translation functionality

// Make class globally available
window.TranslationManager = class TranslationManager {
  constructor(popupUI) {
    this.popupUI = popupUI;
  }

  async fetchAndDisplayTranslation(word) {
    try {
      const translation = await this.popupUI.translationService.translate(word, this.popupUI.sourceLang, this.popupUI.targetLang);

      const elements = document.querySelectorAll(`[data-word="${word}"] .word-translation`);
      elements.forEach(el => {
        el.textContent = translation;
        el.classList.remove('loading');
      });

      this.popupUI.translations.set(word, translation);
    } catch (error) {
      const elements = document.querySelectorAll(`[data-word="${word}"] .word-translation`);
      elements.forEach(el => {
        el.textContent = '❌';
        el.classList.remove('loading');
      });
    }
  }

  async translateBatch(words, sourceLang, targetLang) {
    return await this.popupUI.translationService.translateBatch(words, sourceLang, targetLang);
  }

  getTranslation(word) {
    return this.popupUI.translations.get(word);
  }

  hasTranslation(word) {
    return this.popupUI.translations.has(word);
  }

  clearTranslations() {
    this.popupUI.translations.clear();
  }
};