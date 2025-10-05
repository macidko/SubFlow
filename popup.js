// SubFlow - Flat Design Popup UI
class PopupUI {
  constructor() {
    // State
    this.isActive = true;
    this.currentFilter = 'all';
    this.currentTab = 'home';
    this.knownWords = new Set();
    this.unknownWords = new Set();
    
    // Translation
    this.showTranslations = true;
    this.targetLang = 'tr';
    this.sourceLang = 'en';
    this.translationService = null;
    this.translations = new Map();
    
    // Search
    this.searchQuery = '';
    
    // DOM Elements - Main Tabs
    this.mainTabs = document.querySelectorAll('.main-tab');
    this.tabPanels = document.querySelectorAll('.tab-panel');
    
    // DOM Elements - Home Tab
    this.statusDot = document.getElementById('statusDot');
    this.statusText = document.getElementById('statusText');
    this.targetLangSelect = document.getElementById('targetLang');
    
    this.wordTabs = document.querySelectorAll('.word-tab');
    this.allCount = document.getElementById('allCount');
    this.knownCount = document.getElementById('knownCount');
    this.learningCount = document.getElementById('learningCount');
    
    this.searchInput = document.getElementById('searchInput');
    this.wordsList = document.getElementById('wordsList');
    
    // DOM Elements - Settings Tab
    this.toggleExtension = document.getElementById('toggleExtension');
    this.isActiveCheckbox = document.getElementById('isActiveCheckbox');
    this.toggleTranslations = document.getElementById('toggleTranslations');
    this.showTranslationsCheckbox = document.getElementById('showTranslationsCheckbox');
    
    this.knownColorInput = document.getElementById('knownColor');
    this.learningColorInput = document.getElementById('learningColor');
    
    this.refreshBtn = document.getElementById('refreshBtn');
    this.translateAllBtn = document.getElementById('translateAllBtn');
    this.exportBtn = document.getElementById('exportBtn');
    this.importBtn = document.getElementById('importBtn');
    this.clearBtn = document.getElementById('clearBtn');
    this.fileInput = document.getElementById('fileInput');
  }

  static async create() {
    const instance = new PopupUI();
    await instance.init();
    return instance;
  }

  async init() {
    try {
      this.translationService = await TranslationService.create();
      await this.loadStoredData();
      await this.checkConnectionStatus();
      this.setupEventListeners();
      this.updateUI();
    } catch (error) {
      console.error('Init error:', error);
    }
  }

  async loadStoredData() {
    const data = await chrome.storage.local.get({
      knownWords: [],
      unknownWords: [],
      isActive: true,
      showTranslations: true,
      targetLang: 'tr',
      sourceLang: 'en',
      knownColor: '#10b981',
      learningColor: '#f59e0b'
    });
    
    this.knownWords = new Set(data.knownWords || []);
    this.unknownWords = new Set(data.unknownWords || []);
    this.isActive = data.isActive !== false;
    this.showTranslations = data.showTranslations !== false;
    this.targetLang = data.targetLang || 'tr';
    this.sourceLang = data.sourceLang || 'en';
    
    // Update UI
    this.targetLangSelect.value = this.targetLang;
    this.showTranslationsCheckbox.checked = this.showTranslations;
    this.isActiveCheckbox.checked = this.isActive;
    this.knownColorInput.value = data.knownColor;
    this.learningColorInput.value = data.learningColor;
    
    if (this.showTranslations) {
      this.toggleTranslations.classList.add('active');
    } else {
      this.toggleTranslations.classList.remove('active');
    }
    
    if (this.isActive) {
      this.toggleExtension.classList.add('active');
    } else {
      this.toggleExtension.classList.remove('active');
    }
  }

  async checkConnectionStatus() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const isYouTube = tab?.url?.includes('youtube.com/watch');
      
      if (isYouTube && this.isActive) {
        this.statusDot.classList.remove('inactive');
        this.statusText.textContent = 'Aktif';
      } else {
        this.statusDot.classList.add('inactive');
        this.statusText.textContent = 'Pasif';
      }
    } catch (error) {
      this.statusDot.classList.add('inactive');
      this.statusText.textContent = 'Bağlı değil';
    }
  }

  setupEventListeners() {
    // Main Tabs
    this.mainTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        this.switchMainTab(tabName);
      });
    });
    
    // Word Filter Tabs
    this.wordTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const filter = tab.dataset.filter;
        this.switchWordFilter(filter);
      });
    });
    
    // Search
    this.searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase().trim();
      this.updateWordsList();
    });
    
    // Language selector
    this.targetLangSelect.addEventListener('change', async (e) => {
      this.targetLang = e.target.value;
      await chrome.storage.local.set({ targetLang: this.targetLang });
      this.updateWordsList();
    });
    
    // Toggle Extension
    this.toggleExtension.addEventListener('click', async () => {
      this.isActive = !this.isActive;
      this.isActiveCheckbox.checked = this.isActive;
      
      if (this.isActive) {
        this.toggleExtension.classList.add('active');
      } else {
        this.toggleExtension.classList.remove('active');
      }
      
      await chrome.storage.local.set({ isActive: this.isActive });
      await this.sendMessageToContentScript({ action: 'toggle', enabled: this.isActive });
      await this.checkConnectionStatus();
    });
    
    // Toggle Translations
    this.toggleTranslations.addEventListener('click', async () => {
      this.showTranslations = !this.showTranslations;
      this.showTranslationsCheckbox.checked = this.showTranslations;
      
      if (this.showTranslations) {
        this.toggleTranslations.classList.add('active');
      } else {
        this.toggleTranslations.classList.remove('active');
      }
      
      await chrome.storage.local.set({ showTranslations: this.showTranslations });
      this.updateWordsList();
    });
    
    // Color pickers
    this.knownColorInput.addEventListener('change', async (e) => {
      const color = e.target.value;
      await chrome.storage.local.set({ knownColor: color });
      await this.sendMessageToContentScript({ action: 'updateColors' });
    });
    
    this.learningColorInput.addEventListener('change', async (e) => {
      const color = e.target.value;
      await chrome.storage.local.set({ learningColor: color });
      await this.sendMessageToContentScript({ action: 'updateColors' });
    });
    
    // Action Buttons
    this.refreshBtn.addEventListener('click', () => this.refreshYouTube());
    this.translateAllBtn.addEventListener('click', () => this.translateAllWords());
    this.exportBtn.addEventListener('click', () => this.exportWords());
    this.importBtn.addEventListener('click', () => this.fileInput.click());
    this.clearBtn.addEventListener('click', () => this.clearAllWords());
    
    this.fileInput.addEventListener('change', (e) => this.importWords(e));
  }

  switchMainTab(tabName) {
    this.currentTab = tabName;
    
    this.mainTabs.forEach(tab => {
      if (tab.dataset.tab === tabName) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });
    
    this.tabPanels.forEach(panel => {
      if (panel.id === tabName + 'Tab') {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });
  }

  switchWordFilter(filter) {
    this.currentFilter = filter;
    
    this.wordTabs.forEach(tab => {
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
    const total = this.knownWords.size + this.unknownWords.size;
    this.allCount.textContent = total;
    this.knownCount.textContent = this.knownWords.size;
    this.learningCount.textContent = this.unknownWords.size;
  }

  updateWordsList() {
    // Get filtered words
    let words = [];
    
    if (this.currentFilter === 'all') {
      words = [
        ...Array.from(this.knownWords).map(w => ({ word: w, status: 'known' })),
        ...Array.from(this.unknownWords).map(w => ({ word: w, status: 'learning' }))
      ];
    } else if (this.currentFilter === 'known') {
      words = Array.from(this.knownWords).map(w => ({ word: w, status: 'known' }));
    } else if (this.currentFilter === 'learning') {
      words = Array.from(this.unknownWords).map(w => ({ word: w, status: 'learning' }));
    }
    
    // Apply search filter
    if (this.searchQuery) {
      words = words.filter(w => w.word.toLowerCase().includes(this.searchQuery));
    }
    
    // Sort alphabetically
    words.sort((a, b) => a.word.localeCompare(b.word));
    
    // Render
    if (words.length === 0) {
      this.wordsList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📚</div>
          <div class="empty-text">
            ${this.searchQuery ? 'Kelime bulunamadı' : 'Henüz kelime yok<br>YouTube\'da Ctrl+Tık ile başlayın'}
          </div>
        </div>
      `;
    } else {
      this.wordsList.innerHTML = words.map(w => this.createWordElement(w)).join('');
      
      // Add click listeners to word items
      this.wordsList.querySelectorAll('.word-item').forEach(item => {
        item.addEventListener('click', () => {
          const word = item.dataset.word;
          this.toggleWordStatus(word);
        });
      });
    }
  }

  createWordElement({ word, status }) {
    const translationHTML = this.showTranslations 
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
    if (this.showTranslations) {
      setTimeout(() => this.fetchAndDisplayTranslation(word), 50);
    }
    
    return item;
  }

  async fetchAndDisplayTranslation(word) {
    try {
      const translation = await this.translationService.translate(word, this.sourceLang, this.targetLang);
      
      const elements = document.querySelectorAll(`[data-word="${word}"] .word-translation`);
      elements.forEach(el => {
        el.textContent = translation;
        el.classList.remove('loading');
      });
      
      this.translations.set(word, translation);
    } catch (error) {
      const elements = document.querySelectorAll(`[data-word="${word}"] .word-translation`);
      elements.forEach(el => {
        el.textContent = '❌';
        el.classList.remove('loading');
      });
    }
  }

  async toggleWordStatus(word) {
    if (this.knownWords.has(word)) {
      // Known -> Learning
      this.knownWords.delete(word);
      this.unknownWords.add(word);
    } else if (this.unknownWords.has(word)) {
      // Learning -> Remove
      this.unknownWords.delete(word);
    }
    
    await chrome.storage.local.set({
      knownWords: Array.from(this.knownWords),
      unknownWords: Array.from(this.unknownWords)
    });
    
    await this.sendMessageToContentScript({ action: 'refresh' });
    this.updateUI();
  }

  async translateAllWords() {
    const allWords = [...this.knownWords, ...this.unknownWords];
    
    if (allWords.length === 0) {
      alert('Henüz kelime yok!');
      return;
    }
    
    this.translateAllBtn.textContent = '⏳ Çevriliyor...';
    this.translateAllBtn.disabled = true;
    
    try {
      await this.translationService.translateBatch(allWords, this.sourceLang, this.targetLang);
      this.updateWordsList();
      alert(`${allWords.length} kelime çevrildi!`);
    } catch (error) {
      alert('Çeviri hatası!');
    } finally {
      this.translateAllBtn.textContent = '🌐 Tüm Kelimeleri Çevir';
      this.translateAllBtn.disabled = false;
    }
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

  async exportWords() {
    const data = {
      knownWords: Array.from(this.knownWords),
      unknownWords: Array.from(this.unknownWords),
      translations: Object.fromEntries(this.translations),
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
        this.knownWords = new Set([...this.knownWords, ...data.knownWords]);
      }
      if (data.unknownWords) {
        this.unknownWords = new Set([...this.unknownWords, ...data.unknownWords]);
      }
      if (data.translations) {
        this.translations = new Map([...this.translations, ...Object.entries(data.translations)]);
      }
      
      await chrome.storage.local.set({
        knownWords: Array.from(this.knownWords),
        unknownWords: Array.from(this.unknownWords)
      });
      
      await this.sendMessageToContentScript({ action: 'refresh' });
      this.updateUI();
      
      alert('Kelimeler başarıyla içe aktarıldı!');
    } catch (error) {
      alert('İçe aktarma hatası!');
    }
    
    event.target.value = '';
  }

  async clearAllWords() {
    if (!confirm('Tüm kelimeler silinecek. Emin misiniz?')) {
      return;
    }
    
    this.knownWords.clear();
    this.unknownWords.clear();
    this.translations.clear();
    
    await chrome.storage.local.set({
      knownWords: [],
      unknownWords: []
    });
    
    await this.sendMessageToContentScript({ action: 'refresh' });
    this.updateUI();
  }

  async sendMessageToContentScript(message) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        // Convert action to type for content script
        const msg = { ...message, type: message.action };
        delete msg.action;
        await chrome.tabs.sendMessage(tab.id, msg);
      }
    } catch (error) {
      console.error('Message error:', error);
    }
  }
}

// Initialize
PopupUI.create();
