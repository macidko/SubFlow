// 🎭 UI Manager - Popup UI state management and DOM operations

// Make class globally available
window.UiManager = class UiManager {
  constructor(popupUI) {
    this.popupUI = popupUI;
  }

  switchMainTab(tabName) {
    this.popupUI.currentTab = tabName;

    this.popupUI.mainTabs.forEach(tab => {
      if (tab.dataset.tab === tabName) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    this.popupUI.tabPanels.forEach(panel => {
      if (panel.id === tabName + 'Tab') {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });
  }

  switchWordFilter(filter) {
    this.popupUI.currentFilter = filter;

    this.popupUI.wordTabs.forEach(tab => {
      if (tab.dataset.filter === filter) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    this.updateWordsList();
  }

  updateUI() {
    this.updateCounts();
    this.updateWordsList();
  }

  updateCounts() {
    const total = this.popupUI.knownWords.size + this.popupUI.unknownWords.size;
    this.popupUI.allCount.textContent = total;
    this.popupUI.knownCount.textContent = this.popupUI.knownWords.size;
    this.popupUI.learningCount.textContent = this.popupUI.unknownWords.size;
  }

  updateWordsList() {
    // Get filtered words
    let words = [];

    if (this.popupUI.currentFilter === 'all') {
      words = [
        ...Array.from(this.popupUI.knownWords).map(w => ({ word: w, status: 'known' })),
        ...Array.from(this.popupUI.unknownWords).map(w => ({ word: w, status: 'learning' }))
      ];
    } else if (this.popupUI.currentFilter === 'known') {
      words = Array.from(this.popupUI.knownWords).map(w => ({ word: w, status: 'known' }));
    } else if (this.popupUI.currentFilter === 'learning') {
      words = Array.from(this.popupUI.unknownWords).map(w => ({ word: w, status: 'learning' }));
    }

    // Apply search filter
    if (this.popupUI.searchQuery) {
      words = words.filter(w => w.word.toLowerCase().includes(this.popupUI.searchQuery));
    }

    // Sort alphabetically
    words.sort((a, b) => a.word.localeCompare(b.word));

    // Render
    if (words.length === 0) {
      this.popupUI.wordsList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📚</div>
          <div class="empty-text">
            ${this.popupUI.searchQuery ? 'Kelime bulunamadı' : 'Henüz kelime yok<br>YouTube\'da Ctrl+Tık ile başlayın'}
          </div>
        </div>
      `;
    } else {
      this.popupUI.wordsList.innerHTML = words.map(w => this.createWordElement(w)).join('');

      // Add click listeners to word items
      this.popupUI.wordsList.querySelectorAll('.word-item').forEach(item => {
        item.addEventListener('click', () => {
          const word = item.dataset.word;
          this.popupUI.dataManager.toggleWordStatus(word);
        });
      });
    }
  }

  createWordElement({ word, status }) {
    const translationHTML = this.popupUI.showTranslations
      ? `<div class="word-translation loading" data-word="${word}">Çeviriliyor...</div>`
      : '';

    const item = `
      <div class="word-item" data-word="${word}" data-status="${status}">
        <div class="word-dot ${status}"></div>
        <div class="word-info">
          <div class="word-text">${word}</div>
          ${translationHTML}
        </div>
      </div>
    `;

    // Load translation if needed
    if (this.popupUI.showTranslations) {
      setTimeout(() => this.popupUI.fetchAndDisplayTranslation(word), 50);
    }

    return item;
  }

  async checkConnectionStatus() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const isYouTube = tab?.url?.includes('youtube.com/watch');

      if (isYouTube && this.popupUI.isActive) {
        this.popupUI.statusDot.classList.remove('inactive');
        this.popupUI.statusText.textContent = 'Aktif';
      } else {
        this.popupUI.statusDot.classList.add('inactive');
        this.popupUI.statusText.textContent = 'Pasif';
      }
    } catch (error) {
      this.popupUI.statusDot.classList.add('inactive');
      this.popupUI.statusText.textContent = 'Bağlı değil';
    }
  }
};