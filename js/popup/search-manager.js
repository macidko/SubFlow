// 🎭 Search Manager - Word search functionality

// Make class globally available
window.SearchManager = class SearchManager {
  constructor(popupUI) {
    this.popupUI = popupUI;
  }

  setSearchQuery(query) {
    this.popupUI.searchQuery = query.toLowerCase().trim();
    this.popupUI.uiManager.updateWordsList();
  }

  clearSearch() {
    this.popupUI.searchQuery = '';
    this.popupUI.searchInput.value = '';
    this.popupUI.uiManager.updateWordsList();
  }

  getFilteredWords(words) {
    if (!this.popupUI.searchQuery) return words;
    return words.filter(w => w.word.toLowerCase().includes(this.popupUI.searchQuery));
  }
};