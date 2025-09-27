// YouTube Subtitle Colorer Popup UI
class PopupUI {
  constructor() {
    this.isActive = true;
    this.currentTab = 'all';
    this.currentTabData = null;
    this.knownWords = new Set();
    this.unknownWords = new Set();
    
    // Pagination and search
    this.currentPage = 0;
    this.itemsPerPage = 20;
    this.searchQuery = '';
    this.filteredWords = [];
    
    // DOM Elements
    this.elements = {
      statusDot: document.getElementById('statusDot'),
      statusText: document.getElementById('statusText'),
      knownCount: document.getElementById('knownCount'),
      learningCount: document.getElementById('learningCount'),
      totalCount: document.getElementById('totalCount'),
      knownTabCount: document.getElementById('knownTabCount'),
      learningTabCount: document.getElementById('learningTabCount'),
      
      // Tab buttons
      allTab: document.getElementById('allTab'),
      knownTab: document.getElementById('knownTab'),
      learningTab: document.getElementById('learningTab'),
      
      wordsList: document.getElementById('wordsList'),
      emptyState: document.getElementById('emptyState'),
      
      // Search and pagination
      searchInput: document.getElementById('searchInput'),
      paginationInfo: document.getElementById('paginationInfo'),
      loadMoreBtn: document.getElementById('loadMoreBtn'),
      
      // Action buttons
      refreshBtn: document.getElementById('refreshBtn'),
      toggleBtn: document.getElementById('toggleBtn'),
      toggleIcon: document.getElementById('toggleIcon'),
      toggleText: document.getElementById('toggleText'),
      importBtn: document.getElementById('importBtn'),
      exportBtn: document.getElementById('exportBtn'),
      clearBtn: document.getElementById('clearBtn'),
      fileInput: document.getElementById('fileInput')
    };
  }

  static async create() {
    const instance = new PopupUI();
    await instance.init();
    return instance;
  }

  async init() {
    try {
      await this.loadStoredData();
      await this.checkConnectionStatus();
      this.setupEventListeners();
      this.updateUI();
      
      
    } catch (error) {
      this.showNotification('Başlatma hatası', 'error');
    }
  }

  async loadStoredData() {
    try {
      const data = await chrome.storage.local.get({
        knownWords: [],
        unknownWords: [],
        isActive: true
      });
      
      this.knownWords = new Set(data.knownWords || []);
      this.unknownWords = new Set(data.unknownWords || []);
      this.isActive = data.isActive !== false;
      
    } catch (error) {
      console.error('Failed to load stored data:', error);
      this.knownWords = new Set();
      this.unknownWords = new Set();
    }
  }

  async checkConnectionStatus() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentTabData = tab;
      
      const isYouTube = tab?.url?.includes('youtube.com');
      const isConnected = isYouTube && this.isActive;
      
      this.updateConnectionStatus(isConnected, isYouTube);
      
      // Try to ping content script
      if (isYouTube && this.isActive) {
        try {
          await chrome.tabs.sendMessage(tab.id, { type: 'ping' });
        } catch (error) {
          console.warn('Content script not responding:', error);
        }
      }
    } catch (error) {
      console.error('Connection check failed:', error);
      this.updateConnectionStatus(false, false);
    }
  }

  updateConnectionStatus(isConnected, isYouTube) {
    if (isConnected) {
      this.elements.statusDot.classList.remove('inactive');
      this.elements.statusText.textContent = 'Aktif';
    } else if (isYouTube && !this.isActive) {
      this.elements.statusDot.classList.add('inactive');
      this.elements.statusText.textContent = 'Duraklatıldı';
    } else {
      this.elements.statusDot.classList.add('inactive');
      this.elements.statusText.textContent = 'YouTube\'da değil';
    }
    
    this.updateToggleButton();
  }

  setupEventListeners() {
    // Tab navigation
    [this.elements.allTab, this.elements.knownTab, this.elements.learningTab].forEach(tab => {
      tab.addEventListener('click', () => {
        const tabType = tab.getAttribute('data-tab');
        this.switchTab(tabType);
      });
    });

    // Toggle functionality
    this.elements.toggleBtn.addEventListener('click', () => {
      this.toggleExtension();
    });

    // Refresh YouTube
    this.elements.refreshBtn.addEventListener('click', () => {
      this.refreshYouTube();
    });

    // Import/Export
    this.elements.importBtn.addEventListener('click', () => {
      this.elements.fileInput.click();
    });

    this.elements.exportBtn.addEventListener('click', () => {
      this.exportWords();
    });

    this.elements.fileInput.addEventListener('change', (e) => {
      this.importWords(e.target.files[0]);
    });

    // Clear all
    this.elements.clearBtn.addEventListener('click', () => {
      this.clearAllWords();
    });
    
    // Search functionality
    this.elements.searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase().trim();
      this.currentPage = 0;
      this.renderWordsList();
    });
    
    // Load more functionality
    this.elements.loadMoreBtn.addEventListener('click', () => {
      this.currentPage++;
      this.renderWordsList(true); // append mode
    });
  }

  switchTab(tabType) {
    // Update active tab
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    
    this.elements[`${tabType}Tab`].classList.add('active');
    this.currentTab = tabType;
    
    // Reset pagination when switching tabs
    this.currentPage = 0;
    this.renderWordsList();
  }

  async toggleExtension() {
    try {
      this.isActive = !this.isActive;
      
      await chrome.storage.local.set({ isActive: this.isActive });
      
      // Notify content script
      if (this.currentTabData?.url?.includes('youtube.com')) {
        try {
          await chrome.tabs.sendMessage(this.currentTabData.id, {
            type: 'toggle',
            isActive: this.isActive
          });
        } catch (error) {
          console.warn('Could not notify content script:', error);
        }
      }
      
      this.updateConnectionStatus(
        this.isActive && this.currentTabData?.url?.includes('youtube.com'),
        this.currentTabData?.url?.includes('youtube.com')
      );
      
    } catch (error) {
      console.error('Toggle failed:', error);
      this.showNotification('Durum değiştirilirken hata oluştu', 'error');
    }
  }

  updateToggleButton() {
    if (this.isActive) {
      this.elements.toggleIcon.textContent = '⏸';
      this.elements.toggleText.textContent = 'Duraklat';
    } else {
      this.elements.toggleIcon.textContent = '▶';
      this.elements.toggleText.textContent = 'Başlat';
    }
  }

  async refreshYouTube() {
    try {
      if (this.currentTabData?.url?.includes('youtube.com')) {
        await chrome.tabs.reload(this.currentTabData.id);
        
        // Show feedback
        this.elements.refreshBtn.style.transform = 'rotate(360deg)';
        setTimeout(() => {
          this.elements.refreshBtn.style.transform = 'rotate(0deg)';
        }, 500);
        
      } else {
        this.showNotification('YouTube sekmesi bulunamadı', 'warning');
      }
    } catch (error) {
      console.error('Refresh failed:', error);
      this.showNotification('Sayfa yenilenemedi', 'error');
    }
  }

  updateUI() {
    this.updateCounts();
    this.renderWordsList();
  }

  updateCounts() {
    const knownCount = this.knownWords.size;
    const learningCount = this.unknownWords.size;
    const totalCount = knownCount + learningCount;
    
    this.elements.knownCount.textContent = knownCount;
    this.elements.learningCount.textContent = learningCount;
    this.elements.totalCount.textContent = totalCount;
    this.elements.knownTabCount.textContent = knownCount;
    this.elements.learningTabCount.textContent = learningCount;
  }

  collectAndFilterWords() {
    let allWords = [];
    
    // Collect words based on current tab
    if (this.currentTab === 'known') {
      allWords = Array.from(this.knownWords).map(word => ({ word, type: 'known' }));
    } else if (this.currentTab === 'learning') {
      allWords = Array.from(this.unknownWords).map(word => ({ word, type: 'unknown' }));
    } else {
      // All tab
      const knownWords = Array.from(this.knownWords).map(word => ({ word, type: 'known' }));
      const unknownWords = Array.from(this.unknownWords).map(word => ({ word, type: 'unknown' }));
      allWords = [...knownWords, ...unknownWords];
    }
    
    // Apply search filter
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      allWords = allWords.filter(item => item.word.toLowerCase().includes(query));
    }
    
    // Sort alphabetically
    allWords.sort((a, b) => a.word.localeCompare(b.word));
    
    this.filteredWords = allWords;
  }

  renderWordsList(appendMode = false) {
    const isEmpty = this.knownWords.size === 0 && this.unknownWords.size === 0;
    
    if (isEmpty) {
      this.elements.emptyState.classList.remove('hidden');
      this.elements.wordsList.innerHTML = '';
      this.elements.wordsList.appendChild(this.elements.emptyState);
      this.elements.loadMoreBtn.classList.add('hidden');
      this.elements.paginationInfo.textContent = '0 kelime';
      return;
    }
    
    this.elements.emptyState.classList.add('hidden');
    
    // Collect and filter words
    this.collectAndFilterWords();
    
    // Calculate pagination
    const startIndex = appendMode ? (this.currentPage * this.itemsPerPage) : 0;
    const endIndex = startIndex + this.itemsPerPage;
    const wordsToShow = this.filteredWords.slice(0, endIndex);
    const hasMore = endIndex < this.filteredWords.length;
    
    // Update pagination info
    this.elements.paginationInfo.textContent = 
      this.filteredWords.length + ' kelime' + (this.searchQuery ? ' ("' + this.searchQuery + '" için)' : '');
    
    // Show/hide load more button
    if (hasMore) {
      this.elements.loadMoreBtn.classList.remove('hidden');
      this.elements.loadMoreBtn.textContent = 
        `${this.filteredWords.length - endIndex} kelime daha yükle`;
    } else {
      this.elements.loadMoreBtn.classList.add('hidden');
    }
    
    // Render words
    if (!appendMode) {
      this.elements.wordsList.innerHTML = '';
    }
    
    const fragment = document.createDocumentFragment();
    const newWords = appendMode ? 
      this.filteredWords.slice(startIndex, endIndex) : 
      wordsToShow;
    
    newWords.forEach((item, index) => {
      const wordElement = this.createWordElement(item, startIndex + index);
      fragment.appendChild(wordElement);
    });
    
    this.elements.wordsList.appendChild(fragment);
  }

  createWordElement(item, index) {
    const { word, type } = item;
    
    const element = document.createElement('div');
    element.className = `word-item animate ${type === 'known' ? 'known-word' : 'unknown-word'}`;
    element.style.setProperty('--index', index);
    element.setAttribute('data-word', word);
    
    element.innerHTML = `
      <div class="word-indicator ${type === 'known' ? 'known' : 'learning'}"></div>
      <div class="word-content">
        <div class="word-text">${this.escapeHtml(word)}</div>
        <div class="word-meta">Tıkla ve durumu değiştir</div>
      </div>
    `;
    
    // Add click handler for word status toggle
    element.addEventListener('click', () => {
      this.toggleWordStatus(word);
    });
    
    return element;
  }

  async toggleWordStatus(word) {
    try {
      let moved = false;
      
      if (this.knownWords.has(word)) {
        this.knownWords.delete(word);
        this.unknownWords.add(word);
        moved = true;
      } else if (this.unknownWords.has(word)) {
        this.unknownWords.delete(word);
        this.knownWords.add(word);
        moved = true;
      }
      
      if (moved) {
        await this.saveWords();
        
        // Instead of partial update, refresh the current view
        // because words might move between tabs
        this.collectAndFilterWords();
        this.renderWordsList();
        
        // Update tab badges
        this.updateTabBadges();
        
        // Notify content script
        if (this.currentTabData?.url?.includes('youtube.com')) {
          try {
            await chrome.tabs.sendMessage(this.currentTabData.id, {
              type: 'wordsUpdated',
              knownWords: Array.from(this.knownWords),
              unknownWords: Array.from(this.unknownWords)
            });
          } catch (error) {
            // Content script might not be ready
          }
        }
      }
      
    } catch (error) {
      this.showNotification('Kelime durumu değiştirilemedi', 'error');
    }
  }

  updateTabBadges() {
    const knownCount = this.knownWords.size;
    const learningCount = this.unknownWords.size;
    const totalCount = knownCount + learningCount;
    
    this.elements.totalCount.textContent = totalCount;
    this.elements.knownTabCount.textContent = knownCount;
    this.elements.learningTabCount.textContent = learningCount;
  }

  async saveWords() {
    try {
      await chrome.storage.local.set({
        knownWords: Array.from(this.knownWords),
        unknownWords: Array.from(this.unknownWords)
      });
    } catch (error) {
      throw error;
    }
  }

  async exportWords() {
    try {
      const data = {
        knownWords: Array.from(this.knownWords),
        unknownWords: Array.from(this.unknownWords),
        exportDate: new Date().toISOString(),
        version: '2.0'
      };
      
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `subtitle-colorer-words-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      
      URL.revokeObjectURL(url);
      
      this.showNotification('Kelimeler dışa aktarıldı', 'success');
      
    } catch (error) {
      console.error('Export failed:', error);
      this.showNotification('Dışa aktarma başarısız', 'error');
    }
  }

  async importWords(file) {
    if (!file) return;
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (data.knownWords && Array.isArray(data.knownWords)) {
        data.knownWords.forEach(word => this.knownWords.add(word));
      }
      
      if (data.unknownWords && Array.isArray(data.unknownWords)) {
        data.unknownWords.forEach(word => this.unknownWords.add(word));
      }
      
      await this.saveWords();
      this.updateUI();
      
      this.showNotification('Kelimeler başarıyla içe aktarıldı', 'success');
      
      // Reset file input
      this.elements.fileInput.value = '';
      
    } catch (error) {
      console.error('Import failed:', error);
      this.showNotification('İçe aktarma başarısız', 'error');
    }
  }

  async clearAllWords() {
    if (!confirm('Tüm kelimeleri silmek istediğinizden emin misiniz?')) {
      return;
    }
    
    try {
      this.knownWords.clear();
      this.unknownWords.clear();
      
      await chrome.storage.local.set({
        knownWords: [],
        unknownWords: []
      });
      
      this.updateUI();
      this.showNotification('Tüm kelimeler silindi', 'success');
      
      // Notify content script
      if (this.currentTabData?.url?.includes('youtube.com')) {
        try {
          await chrome.tabs.sendMessage(this.currentTabData.id, {
            type: 'wordsCleared'
          });
        } catch (error) {
          console.warn('Could not notify content script:', error);
        }
      }
      
    } catch (error) {
      console.error('Clear failed:', error);
      this.showNotification('Temizleme başarısız', 'error');
    }
  }

  showNotification(message, type = 'info') {
    // Simple notification using the browser's built-in notification
    // Could be enhanced with a custom notification system
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize the popup when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  window.popupInstance = await PopupUI.create();
});

// Listen for storage changes to update UI in real-time
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    if (window.popupInstance && (changes.knownWords || changes.unknownWords)) {
      window.popupInstance.loadStoredData().then(() => {
        window.popupInstance.updateUI();
      }).catch(error => {
        console.error('Failed to update UI from storage changes:', error);
      });
    }
  }
});
