// YouTube Subtitle Colorer - Compact Popup UI
class PopupUI {
  constructor() {
    this.isActive = true;
    this.currentTab = null;
    this.knownWords = new Set();
    this.unknownWords = new Set();
    
    // DOM elements for compact design
    this.elements = {
      statusIndicator: document.getElementById('statusIndicator'),
      toggleBtn: document.getElementById('toggleBtn'),
      refreshBtn: document.getElementById('refreshBtn'),
      knownCount: document.getElementById('knownCount'),
      unknownCount: document.getElementById('unknownCount'),
      wordsList: document.getElementById('wordsList'),
      emptyState: document.getElementById('emptyState'),
      knownSection: document.getElementById('knownSection'),
      unknownSection: document.getElementById('unknownSection'),
      knownWordsList: document.getElementById('knownWordsList'),
      unknownWordsList: document.getElementById('unknownWordsList'),
      knownSectionCount: document.getElementById('knownSectionCount'),
      unknownSectionCount: document.getElementById('unknownSectionCount'),
      importBtn: document.getElementById('importBtn'),
      exportBtn: document.getElementById('exportBtn'),
      clearBtn: document.getElementById('clearBtn'),
      fileInput: document.getElementById('fileInput')
    };
  }

  static async bootstrap() {
    const ui = new PopupUI();
    try {
      await ui.init();
    } catch (error) {
      console.error('Popup bootstrap failed:', error);
      ui.showNotification('Popup başlatılamadı', 'error');
    }
    return ui;
  }

  async init() {
    try {
      await this.loadStoredData();
      await this.checkConnection();
      this.setupEventListeners();
      this.updateUI();
      
      console.log('Compact popup UI initialized');
    } catch (error) {
      console.error('Failed to initialize popup UI:', error);
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

  async checkConnection() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentTab = tab;
      
      const isYouTube = tab?.url?.includes('youtube.com');
      const isActive = isYouTube && this.isActive;
      
      this.updateStatus(isActive);
      
      if (isYouTube && this.isActive) {
        try {
          await chrome.tabs.sendMessage(tab.id, { type: 'ping' });
        } catch (error) {
          console.warn('Content script not available:', error);
        }
      }
    } catch (error) {
      console.error('Connection check failed:', error);
      this.updateStatus(false);
    }
  }

  setupEventListeners() {
    // Toggle button
    if (this.elements.toggleBtn) {
      this.elements.toggleBtn.addEventListener('click', () => {
        this.toggleExtension();
      });
    }

    // Refresh button
    if (this.elements.refreshBtn) {
      this.elements.refreshBtn.addEventListener('click', () => {
        this.refreshPage();
      });
    }

    // Import button
    if (this.elements.importBtn) {
      this.elements.importBtn.addEventListener('click', () => {
        this.elements.fileInput.click();
      });
    }

    // Export button
    if (this.elements.exportBtn) {
      this.elements.exportBtn.addEventListener('click', () => {
        this.exportData();
      });
    }

    // Clear button
    if (this.elements.clearBtn) {
      this.elements.clearBtn.addEventListener('click', () => {
        this.clearAllWords();
      });
    }

    // File input
    if (this.elements.fileInput) {
      this.elements.fileInput.addEventListener('change', (e) => {
        this.importData(e.target.files[0]);
      });
    }

    // Storage changes
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' || namespace === 'sync') {
        void this.handleStorageChange(changes);
      }
    });

    // Periodic updates
    setInterval(() => {
      this.refreshData();
    }, 3000);
  }

  async toggleExtension() {
    try {
      this.isActive = !this.isActive;
      
      await chrome.storage.local.set({ isActive: this.isActive });
      this.updateStatus(this.isActive);
      
      if (this.currentTab?.id && this.currentTab.url?.includes('youtube.com')) {
        try {
          await chrome.tabs.sendMessage(this.currentTab.id, {
            type: 'toggle',
            isActive: this.isActive
          });
        } catch (error) {
          console.warn('Toggle message failed:', error);
        }
      }
    } catch (error) {
      console.error('Toggle failed:', error);
      this.isActive = !this.isActive;
      this.updateStatus(this.isActive);
    }
  }

  async refreshPage() {
    try {
      if (this.currentTab?.id) {
        await chrome.tabs.reload(this.currentTab.id);
        window.close();
      }
    } catch (error) {
      console.error('Refresh failed:', error);
    }
  }

  async clearAllWords() {
    if (!confirm('Tüm kelimeleri silmek istediğinizden emin misiniz?')) {
      return;
    }

    try {
      await chrome.storage.local.set({
        knownWords: [],
        unknownWords: []
      });
      
      this.knownWords.clear();
      this.unknownWords.clear();
      this.updateUI();
      
      if (this.currentTab?.id && this.currentTab.url?.includes('youtube.com')) {
        try {
          await chrome.tabs.sendMessage(this.currentTab.id, { type: 'clearAllWords' });
        } catch (error) {
          console.warn('Clear message failed:', error);
        }
      }
      
      this.showNotification('Tüm kelimeler temizlendi', 'success');
    } catch (error) {
      console.error('Clear failed:', error);
      this.showNotification('Temizleme hatası', 'error');
    }
  }

  async exportData() {
    try {
      const data = {
        knownWords: Array.from(this.knownWords),
        unknownWords: Array.from(this.unknownWords),
        exportDate: new Date().toISOString(),
        version: '1.5.0'
      };
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `subtitle-colorer-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      this.showNotification('Veriler dışa aktarıldı', 'success');
    } catch (error) {
      console.error('Export failed:', error);
      this.showNotification('Dışa aktarma hatası', 'error');
    }
  }

  async importData(file) {
    if (!file) return;
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!data.knownWords || !data.unknownWords) {
        throw new Error('Invalid file format');
      }
      
      const knownWords = Array.isArray(data.knownWords) ? data.knownWords : [];
      const unknownWords = Array.isArray(data.unknownWords) ? data.unknownWords : [];
      
      await chrome.storage.local.set({
        knownWords,
        unknownWords
      });
      
      this.knownWords = new Set(knownWords);
      this.unknownWords = new Set(unknownWords);
      this.updateUI();
      
      // Notify content script
      if (this.currentTab?.id && this.currentTab.url?.includes('youtube.com')) {
        try {
          await chrome.tabs.sendMessage(this.currentTab.id, { 
            type: 'importData',
            data: { knownWords, unknownWords }
          });
        } catch (error) {
          console.warn('Import message failed:', error);
        }
      }
      
      this.showNotification(`${knownWords.length + unknownWords.length} kelime içe aktarıldı`, 'success');
    } catch (error) {
      console.error('Import failed:', error);
      this.showNotification('İçe aktarma hatası', 'error');
    }
    
    // Clear file input
    this.elements.fileInput.value = '';
  }

  async refreshData() {
    try {
      const oldKnownSize = this.knownWords.size;
      const oldUnknownSize = this.unknownWords.size;
      
      await this.loadStoredData();
      
      if (this.knownWords.size !== oldKnownSize || this.unknownWords.size !== oldUnknownSize) {
        this.updateUI();
      }
    } catch (error) {
      console.error('Refresh failed:', error);
    }
  }

  updateStatus(isActive) {
    if (this.elements.statusIndicator) {
      this.elements.statusIndicator.classList.toggle('active', isActive);
    }
    
    if (this.elements.toggleBtn) {
      this.elements.toggleBtn.classList.toggle('active', isActive);
      this.elements.toggleBtn.textContent = isActive ? '⏸' : '▶';
      this.elements.toggleBtn.title = isActive ? 'Kapat' : 'Aç';
    }
  }

  updateUI() {
    this.updateCounts();
    this.updateWordsList();
  }

  updateCounts() {
    if (this.elements.knownCount) {
      this.elements.knownCount.textContent = this.knownWords.size;
    }
    
    if (this.elements.unknownCount) {
      this.elements.unknownCount.textContent = this.unknownWords.size;
    }
  }

  updateWordsList() {
    const totalWords = this.knownWords.size + this.unknownWords.size;
    
    if (!this.elements.wordsList) return;
    
    if (totalWords === 0) {
      this.elements.emptyState.style.display = 'flex';
      this.elements.knownSection.style.display = 'none';
      this.elements.unknownSection.style.display = 'none';
      return;
    }
    
    this.elements.emptyState.style.display = 'none';
    
    // Update known words section
    if (this.knownWords.size > 0) {
      this.elements.knownSection.style.display = 'block';
      this.elements.knownSectionCount.textContent = this.knownWords.size;
      
      const knownWordsArray = Array.from(this.knownWords)
        .sort((a, b) => a.localeCompare(b, 'tr'));
      
      this.elements.knownWordsList.innerHTML = knownWordsArray.map(word => `
        <div class="word-item">
          <div class="word-main">
            <span class="word-color known"></span>
            <span class="word-text">${this.escapeHtml(word)}</span>
          </div>
        </div>
      `).join('');
    } else {
      this.elements.knownSection.style.display = 'none';
    }
    
    // Update unknown words section
    if (this.unknownWords.size > 0) {
      this.elements.unknownSection.style.display = 'block';
      this.elements.unknownSectionCount.textContent = this.unknownWords.size;
      
      const unknownWordsArray = Array.from(this.unknownWords)
        .sort((a, b) => a.localeCompare(b, 'tr'));
      
      this.elements.unknownWordsList.innerHTML = unknownWordsArray.map(word => `
        <div class="word-item">
          <div class="word-main">
            <span class="word-color unknown"></span>
            <span class="word-text">${this.escapeHtml(word)}</span>
          </div>
        </div>
      `).join('');
    } else {
      this.elements.unknownSection.style.display = 'none';
    }
  }

  async handleStorageChange(changes) {
    let shouldUpdate = false;
    
    if (changes.hasOwnProperty('knownWords') || changes.hasOwnProperty('unknownWords')) {
      shouldUpdate = true;
    }
    
    if (changes.hasOwnProperty('isActive')) {
      this.isActive = changes.isActive.newValue !== false;
      this.updateStatus(this.isActive);
    }
    
    if (shouldUpdate) {
      await this.loadStoredData();
      this.updateUI();
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showNotification(message, type = 'info') {
    // Simple notification system
    const colors = {
      error: '#ef4444',
      success: '#10b981',
      info: '#2563eb'
    };
    
    const bgColor = colors[type] || colors.info;
    
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 16px;
      right: 16px;
      padding: 8px 12px;
      background: ${bgColor};
      color: white;
      border-radius: 6px;
      font-size: 12px;
      z-index: 1000;
      opacity: 0;
      transform: translateX(20px);
      transition: all 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateX(0)';
    }, 10);
    
    // Remove after delay
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(20px)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 2500);
  }
}

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  PopupUI.bootstrap();
});

// Cleanup
window.addEventListener('beforeunload', () => {
  console.log('Popup closing');
});