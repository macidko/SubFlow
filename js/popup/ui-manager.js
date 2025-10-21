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
    // Clear children safely
    this.popupUI.wordsList.textContent = '';
    if (words.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';

      const icon = document.createElement('div');
      icon.className = 'empty-icon';
      icon.textContent = '📚';

      const text = document.createElement('div');
      text.className = 'empty-text';
      if (this.popupUI.searchQuery) {
        text.textContent = 'Kelime bulunamadı';
      } else {
        // Create two text nodes with a line break element between them to avoid innerHTML
        const line1 = document.createElement('div');
        line1.textContent = 'Henüz kelime yok';
        const line2 = document.createElement('div');
        line2.textContent = "YouTube'da Ctrl+Tık ile başlayın";
        text.appendChild(line1);
        text.appendChild(line2);
      }

      empty.appendChild(icon);
      empty.appendChild(text);
      this.popupUI.wordsList.appendChild(empty);
    } else {
      for (const w of words) {
        const el = this.createWordElement(w);
        this.popupUI.wordsList.appendChild(el);
      }
    }
  }

  createWordElement({ word, status }) {
    const item = document.createElement('div');
    item.className = 'word-item';
    item.dataset.word = word;
    item.dataset.status = status;

    const dot = document.createElement('div');
    dot.className = `word-dot ${status}`;

    const info = document.createElement('div');
    info.className = 'word-info';

    const text = document.createElement('div');
    text.className = 'word-text';
    text.textContent = word;

    info.appendChild(text);

    if (this.popupUI.showTranslations) {
      const translation = document.createElement('div');
      translation.className = 'word-translation loading';
      translation.dataset.word = word;
      translation.textContent = 'Çeviriliyor...';
      info.appendChild(translation);

      // Load translation if needed
      setTimeout(() => this.popupUI.fetchAndDisplayTranslation(word), 50);
    }

    item.appendChild(dot);
    item.appendChild(info);

    // Click handler
    item.addEventListener('click', () => {
      this.popupUI.dataManager.toggleWordStatus(word);
    });

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