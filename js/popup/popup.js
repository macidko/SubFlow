// SubFlow - Flat Design Popup UI v2.0
// Uses StorageManager, SharedConfig, and MessageProtocol

// Import shared modules
const { STORAGE_SCHEMA, WORD_STATES, WORD_CLASSES, getNextWordState, getWordState } = window;
const { MESSAGE_TYPES, createMessage, sendToContentScript, broadcastToAllTabs } = window;

class PopupUI {
  constructor() {
    // State
    this.isActive = true;
    this.currentFilter = 'all';
    this.currentTab = 'home';
    this.knownWords = new Set();
    this.unknownWords = new Set();
    
    // Settings
    this.pauseOnHover = true;
    
    // Translation
    this.showTranslations = true;
    this.targetLang = 'tr';
    this.sourceLang = 'en';
    this.translationService = null;
    this.translations = new Map();
    
    // Colors
    this.knownColor = '#10b981';
    this.learningColor = '#f59e0b';
    
    // Search
    this.searchQuery = '';
    
    // Initialize managers (without DOM elements yet)
    this.uiManager = null;
    this.dataManager = null;
    this.eventHandlers = null;
    this.searchManager = null;
    this.translationManager = null;
    this.exportImportManager = null;
  }

  static async create() {
    const instance = new PopupUI();
    await instance.init();
    return instance;
  }

  async init() {
    try {
      // Wait for DOM to be ready
      if (document.readyState !== 'complete') {
        await new Promise(resolve => {
          if (document.readyState === 'complete') {
            resolve();
          } else {
            window.addEventListener('load', resolve);
          }
        });
      }

      // Initialize DOM elements
      this.initializeDOMElements();

      // Initialize managers
      this.uiManager = new window.UiManager(this);
      this.dataManager = new window.DataManager(this);
      this.eventHandlers = new window.EventHandlers(this);
      this.searchManager = new window.SearchManager(this);
      this.translationManager = new window.TranslationManager(this);
      this.exportImportManager = new window.ExportImportManager(this);

  // Initialize translation service
  this.translationService = await TranslationService.create();

  // Load all settings (reads are delegated to background via delegateStorageOp)
  await this.dataManager.loadStoredData();
      
      // Check connection
      await this.uiManager.checkConnectionStatus();
      
      // Setup UI
      this.eventHandlers.setupEventListeners();
      this.uiManager.updateUI();
      
      console.log('✅ Popup v2.0 initialized');
    } catch (error) {
      console.error('❌ Init error:', error);
      try { if (window && window.toast && typeof window.toast.error === 'function') window.toast.error('Popup başlatılamadı'); } catch(e) {}
    }
  }

  initializeDOMElements() {
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
    this.togglePauseOnHover = document.getElementById('togglePauseOnHover');
    this.pauseOnHoverCheckbox = document.getElementById('pauseOnHoverCheckbox');
    
    this.knownColorInput = document.getElementById('knownColor');
    this.learningColorInput = document.getElementById('learningColor');
    
    this.refreshBtn = document.getElementById('refreshBtn');
    this.translateAllBtn = document.getElementById('translateAllBtn');
    this.exportBtn = document.getElementById('exportBtn');
    this.importBtn = document.getElementById('importBtn');
    this.clearBtn = document.getElementById('clearBtn');
    this.fileInput = document.getElementById('fileInput');
  }

  // Delegate methods to managers
  switchMainTab(tabName) {
    this.uiManager.switchMainTab(tabName);
  }

  switchWordFilter(filter) {
    this.uiManager.switchWordFilter(filter);
  }

  updateUI() {
    this.uiManager.updateUI();
  }

  updateCounts() {
    this.uiManager.updateCounts();
  }

  updateWordsList() {
    this.uiManager.updateWordsList();
  }

  createWordElement(wordData) {
    return this.uiManager.createWordElement(wordData);
  }

  async checkConnectionStatus() {
    await this.uiManager.checkConnectionStatus();
  }

  async loadStoredData() {
    await this.dataManager.loadStoredData();
  }

  async toggleWordStatus(word) {
    await this.dataManager.toggleWordStatus(word);
  }

  async fetchAndDisplayTranslation(word) {
    await this.translationManager.fetchAndDisplayTranslation(word);
  }

  async translateAllWords() {
    await this.eventHandlers.translateAllWords();
  }

  async refreshYouTube() {
    await this.eventHandlers.refreshYouTube();
  }

  async exportWords() {
    await this.exportImportManager.exportWords();
  }

  async importWords(event) {
    await this.exportImportManager.importWords(event);
  }

  async clearAllWords() {
    await this.dataManager.clearAllWords();
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
      try { if (window && window.toast && typeof window.toast.error === 'function') window.toast.error('Mesaj gönderilemedi'); } catch(e) {}
    }
  }
}

// Initialize
PopupUI.create();
