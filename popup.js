// YouTube Subtitle Colorer - Popup UI Script
class PopupUI {
  constructor() {
    this.isActive = true;
    // Use chrome.storage instead of IndexedDB for popup
    this.storageManager = null;
    this.currentTab = null;
    this.knownWords = new Set();
    this.unknownWords = new Set();
    
    // DOM elements
    this.elements = {
      statusDot: document.getElementById('statusDot'),
      statusText: document.getElementById('statusText'),
      toggleSwitch: document.getElementById('toggleSwitch'),
      refreshBtn: document.getElementById('refreshBtn'),
      wordCount: document.getElementById('wordCount'),
      wordsContainer: document.getElementById('wordsContainer'),
      emptyState: document.getElementById('emptyState'),
      clearBtn: document.getElementById('clearBtn')
    };
    
    this.init();
  }

  async init() {
    try {
      // Load saved data directly from chrome.storage
      await this.loadStoredData();
      
      // Check current tab and connection
      await this.checkConnection();
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Update UI
      this.updateWordsList();
      this.updateToggleState();
      
      console.log('Popup UI initialized successfully');
    } catch (error) {
      console.error('Failed to initialize popup UI:', error);
      this.showError('Başlatma hatası');
    }
  }

  async loadStoredData() {
    try {
      // Load words from chrome.storage (managed by content script)
      const data = await chrome.storage.local.get({
        knownWords: [],
        unknownWords: [],
        isActive: true
      });
      
      this.knownWords = new Set(data.knownWords || []);
      this.unknownWords = new Set(data.unknownWords || []);
      this.isActive = data.isActive !== false;
      
      console.log(`Loaded ${this.knownWords.size} known and ${this.unknownWords.size} unknown words`);
    } catch (error) {
      console.error('Failed to load stored data:', error);
      this.knownWords = new Set();
      this.unknownWords = new Set();
    }
  }

  async checkConnection() {
    try {
      // Get current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentTab = tab;
      
      // Check if we're on YouTube
      const isYouTube = tab?.url?.includes('youtube.com');
      
      if (isYouTube) {
        this.updateStatus('connected', 'YouTube\'a bağlı');
        
        // Try to communicate with content script
        try {
          await chrome.tabs.sendMessage(tab.id, { type: 'ping' });
          this.updateStatus('connected', 'Altyazı renklendirici aktif');
        } catch (error) {
          this.updateStatus('disconnected', 'YouTube sayfasını yenileyin');
        }
      } else {
        this.updateStatus('disconnected', 'YouTube sayfasına gidin');
      }
    } catch (error) {
      console.error('Connection check failed:', error);
      this.updateStatus('disconnected', 'Bağlantı hatası');
    }
  }

  setupEventListeners() {
    // Toggle switch
    this.elements.toggleSwitch.addEventListener('click', () => {
      this.toggleExtension();
    });

    // Refresh button
    this.elements.refreshBtn.addEventListener('click', () => {
      this.refreshPage();
    });

    // Clear button
    this.elements.clearBtn.addEventListener('click', () => {
      this.clearAllWords();
    });

    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' || namespace === 'sync') {
        this.handleStorageChange(changes);
      }
    });

    // Periodically refresh data
    setInterval(() => {
      this.refreshData();
    }, 2000);

    // Periodically check connection
    setInterval(() => {
      this.checkConnection();
    }, 5000);
  }

  async toggleExtension() {
    try {
      this.isActive = !this.isActive;
      
      // Save state
      await chrome.storage.local.set({ isActive: this.isActive });
      
      // Update UI
      this.updateToggleState();
      
      // Notify content script
      if (this.currentTab?.id && this.currentTab.url?.includes('youtube.com')) {
        try {
          await chrome.tabs.sendMessage(this.currentTab.id, {
            type: 'toggle',
            isActive: this.isActive
          });
          
          this.updateStatus(
            this.isActive ? 'connected' : 'disconnected',
            this.isActive ? 'Renklendirme aktif' : 'Renklendirme kapalı'
          );
        } catch (error) {
          console.log('Content script not available, state saved');
        }
      }
      
      console.log(`Extension ${this.isActive ? 'activated' : 'deactivated'}`);
    } catch (error) {
      console.error('Failed to toggle extension:', error);
      // Revert state on error
      this.isActive = !this.isActive;
      this.updateToggleState();
    }
  }

  async refreshPage() {
    try {
      if (this.currentTab?.id) {
        await chrome.tabs.reload(this.currentTab.id);
        
        // Show feedback
        this.elements.refreshBtn.textContent = '🔄 Sayfa yenileniyor...';
        this.elements.refreshBtn.style.opacity = '0.7';
        
        setTimeout(() => {
          this.elements.refreshBtn.textContent = '🔄 Sayfayı Yenile ve Yeniden Bağlan';
          this.elements.refreshBtn.style.opacity = '1';
          window.close(); // Close popup after refresh
        }, 1000);
      }
    } catch (error) {
      console.error('Failed to refresh page:', error);
    }
  }

  async clearAllWords() {
    if (!confirm('Tüm kayıtlı kelimeleri silmek istediğinizden emin misiniz?')) {
      return;
    }

    try {
      // Clear from chrome.storage
      await chrome.storage.local.set({
        knownWords: [],
        unknownWords: []
      });
      
      // Clear local sets
      this.knownWords.clear();
      this.unknownWords.clear();
      
      // Update UI
      this.updateWordsList();
      
      // Notify content script to clear IndexedDB too
      if (this.currentTab?.id && this.currentTab.url?.includes('youtube.com')) {
        try {
          await chrome.tabs.sendMessage(this.currentTab.id, { 
            type: 'clearAllWords' 
          });
        } catch (error) {
          console.log('Content script not available for clear');
        }
      }
      
      // Show feedback
      this.showTemporaryMessage('Tüm kelimeler temizlendi', 'success');
      
    } catch (error) {
      console.error('Failed to clear words:', error);
      this.showTemporaryMessage('Temizleme hatası', 'error');
    }
  }

  async refreshData() {
    try {
      const oldKnownSize = this.knownWords.size;
      const oldUnknownSize = this.unknownWords.size;
      
      await this.loadStoredData();
      
      if (this.knownWords.size !== oldKnownSize || this.unknownWords.size !== oldUnknownSize) {
        this.updateWordsList();
      }
    } catch (error) {
      console.error('Failed to refresh data:', error);
    }
  }

  updateStatus(status, message) {
    const isConnected = status === 'connected';
    
    this.elements.statusDot.className = `status-dot ${isConnected ? 'status-connected' : 'status-disconnected'}`;
    this.elements.statusText.textContent = message;
  }

  updateToggleState() {
    this.elements.toggleSwitch.classList.toggle('active', this.isActive);
  }

  updateWordsList() {
    const totalWords = this.knownWords.size + this.unknownWords.size;
    this.elements.wordCount.textContent = totalWords.toString();
    
    if (totalWords === 0) {
      this.elements.emptyState.style.display = 'block';
      this.elements.clearBtn.style.display = 'none';
      this.elements.wordsContainer.innerHTML = this.elements.emptyState.outerHTML;
      return;
    }

    this.elements.emptyState.style.display = 'none';
    this.elements.clearBtn.style.display = 'block';

    // Create words list
    const wordsHtml = this.createWordsListHTML();
    this.elements.wordsContainer.innerHTML = wordsHtml;
  }

  createWordsListHTML() {
    let html = '';
    
    // Sort words alphabetically
    const allWords = [
      ...Array.from(this.knownWords).map(word => ({ word, type: 'known' })),
      ...Array.from(this.unknownWords).map(word => ({ word, type: 'unknown' }))
    ].sort((a, b) => a.word.localeCompare(b.word, 'tr', { sensitivity: 'accent' }));
    
    // Group by first letter for better organization
    const groupedWords = {};
    allWords.forEach(({ word, type }) => {
      const firstLetter = word.charAt(0).toUpperCase();
      if (!groupedWords[firstLetter]) {
        groupedWords[firstLetter] = [];
      }
      groupedWords[firstLetter].push({ word, type });
    });

    // Render grouped words
    Object.keys(groupedWords).sort().forEach(letter => {
      if (Object.keys(groupedWords).length > 3) {
        html += `<div style="font-size: 11px; font-weight: 600; opacity: 0.6; margin: 10px 0 5px 0; padding-left: 5px;">${letter}</div>`;
      }
      
      groupedWords[letter].forEach(({ word, type }) => {
        const colorStyle = this.getWordColorStyle(type);
        
        html += `
          <div class="word-item" data-word="${this.escapeHtml(word)}" data-type="${type}">
            <span class="word-text">${this.escapeHtml(word)}</span>
            <div class="word-color" style="background-color: ${colorStyle}"></div>
          </div>
        `;
      });
    });

    return html;
  }

  getWordColorStyle(type) {
    // Match the colors from content script
    return type === 'known' ? '#2ecc71' : '#f39c12';
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  handleStorageChange(changes) {
    let shouldUpdateWords = false;

    // Check if word data changed
    if (changes.hasOwnProperty('knownWords') || changes.hasOwnProperty('unknownWords')) {
      shouldUpdateWords = true;
    }

    // Check if active state changed
    if (changes.hasOwnProperty('isActive')) {
      this.isActive = changes.isActive.newValue !== false;
      this.updateToggleState();
    }

    if (shouldUpdateWords) {
      // Reload words and update UI
      this.loadStoredData().then(() => {
        this.updateWordsList();
      });
    }
  }

  showTemporaryMessage(message, type = 'info') {
    // Create or update temporary message element
    let msgElement = document.getElementById('tempMessage');
    
    if (!msgElement) {
      msgElement = document.createElement('div');
      msgElement.id = 'tempMessage';
      msgElement.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        padding: 8px 16px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
        z-index: 1000;
        transition: all 0.3s ease;
      `;
      document.body.appendChild(msgElement);
    }
    
    const colors = {
      success: { bg: 'rgba(46, 204, 113, 0.9)', border: '#2ecc71' },
      error: { bg: 'rgba(231, 76, 60, 0.9)', border: '#e74c3c' },
      info: { bg: 'rgba(52, 152, 219, 0.9)', border: '#3498db' }
    };
    
    const color = colors[type] || colors.info;
    msgElement.style.backgroundColor = color.bg;
    msgElement.style.border = `1px solid ${color.border}`;
    msgElement.textContent = message;
    msgElement.style.opacity = '1';
    
    // Auto hide after 3 seconds
    setTimeout(() => {
      msgElement.style.opacity = '0';
      setTimeout(() => {
        if (msgElement.parentNode) {
          msgElement.parentNode.removeChild(msgElement);
        }
      }, 300);
    }, 3000);
  }

  showError(message) {
    this.updateStatus('disconnected', message);
    console.error(message);
  }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new PopupUI();
});

// Handle popup close
window.addEventListener('beforeunload', () => {
  console.log('Popup closing');
});