// YouTube Subtitle Colorer Content Script - Refactored
const WORD_DETECTION_REGEX = /[\p{L}\d]+(?:['\u2019-][\p{L}\d]+)*/gu;

class SubtitleColorer {
  constructor() {
    // Core data
    this.knownWords = new Set();
    this.unknownWords = new Set();
    
    // State management
    this.isActive = true;
    this.videoPaused = false;
    this.pauseOnHover = true;
    this.ctrlPressed = false;
    
    // Observers and timers
    this.mainObserver = null;
    this.captionObserver = null;
    this.urlObserver = null;
    this.periodicTimer = null;
    this.processTimeout = null;
    this.incrementalTimeout = null; // For debouncing incremental changes
    
    // Cache and tracking
    this.subtitleTextCache = new WeakMap();
    this.lastCaptionText = '';
    this.currentUrl = window.location.href;
    this.processedElements = new Set(); // Track processed elements
    this.lastCaptionStructure = ''; // Track caption DOM structure
    
    // Event handlers (pre-bound)
    this.handleDocumentClick = this.handleDocumentClick.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
  }

  async init() {
    try {
      const data = await chrome.storage.local.get({
        knownWords: [],
        unknownWords: [],
        isActive: true,
        pauseOnHover: true
      });
      
      this.knownWords = new Set(data.knownWords || []);
      this.unknownWords = new Set(data.unknownWords || []);
      this.isActive = data.isActive !== false;
      this.pauseOnHover = data.pauseOnHover !== false;
      
      console.log('📚 SubFlow initialized:', {
        knownWords: this.knownWords.size,
        unknownWords: this.unknownWords.size,
        isActive: this.isActive,
        pauseOnHover: this.pauseOnHover
      });
    } catch (error) {
      console.error('Failed to initialize SubtitleColorer:', error);
      this.knownWords = new Set();
      this.unknownWords = new Set();
    }

    this.setupObservers();
    this.setupEventListeners();
    this.watchUrlChanges();
  }

  setupObservers() {
    const ytPlayer = document.querySelector('#movie_player, .html5-video-player');
    if (!ytPlayer) {
      setTimeout(() => this.setupObservers(), 500);
      return;
    }

    // Main observer for subtitle changes
    this.mainObserver = new MutationObserver((mutations) => {
      if (!this.isActive) return;
      
      let shouldProcess = false;
      
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE && 
                this.isSubtitleElement(node)) {
              shouldProcess = true;
            }
          });
        }
        
        if (mutation.type === 'characterData') {
          const parent = mutation.target.parentElement;
          if (parent?.closest('.ytp-caption-segment, .ytp-caption-window-container')) {
            shouldProcess = true;
          }
        }
      });
      
      if (shouldProcess) {
        this.debounceProcessSubtitles(50);
      }
    });

    this.mainObserver.observe(ytPlayer, {
      childList: true,
      subtree: true,
      characterData: true
    });

    // Dedicated caption container observer
    this.setupCaptionObserver(ytPlayer);
    
    // Start periodic check
    this.startPeriodicCheck();
    
    // Process existing subtitles
    this.processSubtitles();
    

  }

  setupCaptionObserver(ytPlayer) {
    const captionContainer = ytPlayer.querySelector('.ytp-caption-window-container');
    if (!captionContainer) return;

    this.captionObserver = new MutationObserver((mutations) => {
      if (!this.isActive) return;
      
      const currentText = captionContainer.textContent?.trim() || '';
      const currentStructure = captionContainer.innerHTML;
      
      // Check if structure completely changed (caption cleared/reset)
      if (currentStructure !== this.lastCaptionStructure) {
        const isCompleteReset = currentText === '' || 
                               (!this.lastCaptionText && currentText) ||
                               (this.lastCaptionText && !currentText);
        
        // Only log significant changes to reduce noise
        const textLengthDiff = Math.abs(currentText.length - this.lastCaptionText.length);
        
        if (isCompleteReset) {
          this.processedElements.clear();
          this.debounceProcessSubtitles(20);
        } else if (textLengthDiff > 5) { // Only process if significant change
          this.processIncrementalChanges(captionContainer);
        }
        
        this.lastCaptionStructure = currentStructure;
        this.lastCaptionText = currentText;
      }
    });

    this.captionObserver.observe(captionContainer, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  startPeriodicCheck() {
    if (this.periodicTimer) clearInterval(this.periodicTimer);
    
    this.periodicTimer = setInterval(() => {
      if (!this.isActive) return;
      
      const ytPlayer = document.querySelector('#movie_player, .html5-video-player');
      if (!ytPlayer) return;

      // Only check for truly unprocessed elements  
      const unprocessedElements = Array.from(ytPlayer.querySelectorAll(
        '.ytp-caption-segment:not([data-processed]), ' +
        '.ytp-caption-window-container span:not([data-processed])'
      )).filter(el => {
        const text = el.textContent?.trim();
        return text && !this.processedElements.has(el);
      });
      
      if (unprocessedElements.length > 0) {

        this.processSubtitles();
      }
    }, 2000); // Less frequent since we're more accurate now
  }

  debounceProcessSubtitles(delay) {
    if (this.processTimeout) clearTimeout(this.processTimeout);
    this.processTimeout = setTimeout(() => {
      this.processSubtitles();
    }, delay);
  }

  processIncrementalChanges(container) {
    // Debounce incremental changes to prevent excessive processing
    if (this.incrementalTimeout) {
      clearTimeout(this.incrementalTimeout);
    }
    
    this.incrementalTimeout = setTimeout(() => {
      this.doIncrementalProcessing(container);
    }, 100);
  }

  doIncrementalProcessing(container) {
    // Find only new, unprocessed elements
    const newElements = [];
    
    const selectors = [
      '.ytp-caption-segment',
      '.ytp-caption-window-container .caption-visual-line',
      '.ytp-caption-window-container span',
      '.caption-line-container'
    ];
    
    selectors.forEach(selector => {
      try {
        const elements = container.querySelectorAll(selector);
        elements.forEach(el => {
          const text = el.textContent?.trim();
          if (text && 
              !this.processedElements.has(el) && 
              !el.dataset.processed &&
              !this.hasSubtitleChildren(el)) {
            newElements.push(el);
          }
        });
      } catch (error) {
        console.warn('Selector failed:', selector, error.message);
      }
    });
    
    if (newElements.length > 0) {
      newElements.forEach(element => {
        this.processElement(element);
        this.processedElements.add(element);
      });
    }
  }

  processSubtitles() {
    const ytPlayer = document.querySelector('#movie_player, .html5-video-player');
    if (!ytPlayer) return;

    // Comprehensive subtitle selectors
    const selectors = [
      '.ytp-caption-segment',
      '.ytp-caption-window-container .caption-visual-line',
      '.ytp-caption-window-container span',
      '.caption-line-container'
    ];

    const elements = this.findSubtitleElements(ytPlayer, selectors);
    if (elements.length === 0) return;

    // Filter to only new elements that need processing
    const elementsToProcess = elements.filter(element => {
      const text = element.textContent?.trim();
      if (!text) return false;
      
      // Skip if already processed and content hasn't changed
      const cachedText = this.subtitleTextCache.get(element);
      const alreadyProcessed = element.dataset.processed && 
                              cachedText === text && 
                              element.querySelector('.subtitle-word');
      
      if (alreadyProcessed) {
        this.syncWordClasses(element);
        return false;
      }
      
      return true;
    });
    
    if (elementsToProcess.length > 0) {
      console.log(`Processing ${elementsToProcess.length} subtitle elements (${elements.length - elementsToProcess.length} already processed)`);
      
      elementsToProcess.forEach(element => {
        if (!element.dataset.processing) {
          this.processElement(element);
          this.processedElements.add(element);
        }
      });
    }
  }

  findSubtitleElements(container, selectors) {
    const elements = [];
    const seenTexts = new Set();

    selectors.forEach(selector => {
      try {
        const found = container.querySelectorAll(selector);
        found.forEach(el => {
          const text = el.textContent?.trim();
          if (text && !seenTexts.has(text) && !this.hasSubtitleChildren(el)) {
            elements.push(el);
            seenTexts.add(text);
          }
        });
      } catch (error) {
        console.warn('Selector failed:', selector, error.message);
      }
    });

    return elements;
  }

  processElement(element) {
    element.dataset.processing = 'true';
    
    setTimeout(() => {
      try {
        this.makeWordsClickable(element);
        this.subtitleTextCache.set(element, element.textContent);
        element.dataset.processed = 'true';
      } catch (error) {
        console.error('Error processing element:', error);
      } finally {
        element.dataset.processing = '';
      }
    }, 25);
  }

  makeWordsClickable(element) {
    const text = element.textContent?.trim();
    if (!text) return;

    const wordTokens = this.detectWords(text);
    if (wordTokens.length === 0) return;

    const fragment = document.createDocumentFragment();
    let lastIndex = 0;

    wordTokens.forEach(token => {
      // Add text before word
      if (token.start > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, token.start)));
      }

      // Create clickable word
      const span = document.createElement('span');
      span.className = 'subtitle-word';
      span.textContent = token.word;
      span.dataset.word = token.word.toLowerCase();

      // Apply coloring
      const cleanWord = span.dataset.word;
      if (this.knownWords.has(cleanWord)) {
        span.classList.add('subtitle-known');
      } else if (this.unknownWords.has(cleanWord)) {
        span.classList.add('subtitle-unknown');
      }

      fragment.appendChild(span);
      lastIndex = token.end;
    });

    // Add remaining text
    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    // Replace content atomically
    element.innerHTML = '';
    element.appendChild(fragment);
  }

  detectWords(text) {
    if (!text) return [];
    
    const tokens = [];
    const regex = new RegExp(WORD_DETECTION_REGEX);
    regex.lastIndex = 0;
    
    let match;
    while ((match = regex.exec(text)) !== null) {
      const word = match[0];
      
      // Ignore single-character punctuation-like matches
      if (word.length === 1 && !/\p{L}/u.test(word)) {
        continue;
      }
      
      tokens.push({
        word: word,
        start: match.index,
        end: match.index + word.length
      });
    }
    
    return tokens;
  }

  syncWordClasses(element) {
    // Optimized sync to prevent glitches - only update changed classes
    element.querySelectorAll('.subtitle-word').forEach(span => {
      const word = span.dataset.word;
      if (!word) return;

      const currentClasses = span.className;
      let newClasses = 'subtitle-word';
      
      if (this.knownWords.has(word)) {
        newClasses += ' subtitle-known';
      } else if (this.unknownWords.has(word)) {
        newClasses += ' subtitle-unknown';
      }
      
      // Only update if classes actually changed to prevent glitch
      if (currentClasses !== newClasses) {
        span.className = newClasses;
      }
    });
  }

  setupEventListeners() {
    document.addEventListener('click', this.handleDocumentClick, true);
    document.addEventListener('keydown', this.handleKeyDown, true);
    document.addEventListener('keyup', this.handleKeyUp, true);
  }

  handleDocumentClick(event) {
    const target = event.target;
    
    if (target.classList.contains('subtitle-word')) {
      if (!this.ctrlPressed) return;
      
      event.preventDefault();
      event.stopPropagation();
      
      this.showWordMenu(target, event);
      return false;
    }
    
    // Hide menu if clicking elsewhere
    if (!target.closest('.subtitle-word-menu')) {
      this.hideWordMenu();
    }
  }

  handleKeyDown(event) {
    if (event.key === 'Control') {
      this.ctrlPressed = true;
      document.body.classList.add('ctrl-pressed');
    }
  }

  handleKeyUp(event) {
    if (event.key === 'Control') {
      this.ctrlPressed = false;
      document.body.classList.remove('ctrl-pressed');
    }
  }

  showWordMenu(wordSpan, event) {
    const word = wordSpan.dataset.word;
    if (!word) return;

    this.hideWordMenu();

    // Pause video if enabled
    if (this.pauseOnHover) {
      this.pauseVideo();
    }

    const menu = document.createElement('div');
    menu.className = 'subtitle-word-menu';
    
    // Position menu above the word with better positioning
    const rect = wordSpan.getBoundingClientRect();
    const menuWidth = 180; // Compact menu width
    const menuHeight = 110; // Approximate menu height
    
    // Calculate horizontal position (center above word)
    let menuX = rect.left + (rect.width / 2) - (menuWidth / 2);
    
    // Calculate vertical position (above word with some margin)
    let menuY = rect.top - menuHeight - 8;
    
    // Ensure menu stays in viewport
    const viewportWidth = window.innerWidth;
    
    // Adjust horizontal position if needed
    if (menuX < 10) menuX = 10;
    if (menuX + menuWidth > viewportWidth - 10) menuX = viewportWidth - menuWidth - 10;
    
    // If menu would go above viewport, show it below the word instead
    if (menuY < 10) {
      menuY = rect.bottom + 8;
    }
    
    menu.style.cssText = `
      left: ${menuX}px;
      top: ${menuY}px;
    `;

    const isKnown = this.knownWords.has(word);
    const isUnknown = this.unknownWords.has(word);

    // Add word title with status
    const wordTitle = document.createElement('div');
    wordTitle.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    `;
    
    const wordText = document.createElement('span');
    wordText.textContent = word;
    wordTitle.appendChild(wordText);
    
    if (isKnown || isUnknown) {
      const badge = document.createElement('span');
      badge.className = `word-status-badge ${isKnown ? 'known' : 'unknown'}`;
      badge.textContent = isKnown ? 'Bilinen' : 'Öğrenilecek';
      wordTitle.appendChild(badge);
    }
    
    menu.appendChild(wordTitle);

    const actions = [];
    if (!isKnown) {
      actions.push({ 
        text: 'Bilinen Olarak İşaretle',
        icon: '✓',
        className: 'known-action',
        action: () => this.markAsKnown(word)
      });
    }
    if (!isUnknown) {
      actions.push({ 
        text: 'Öğrenilecek Olarak İşaretle',
        icon: '?',
        className: 'unknown-action', 
        action: () => this.markAsUnknown(word)
      });
    }
    if (isKnown || isUnknown) {
      actions.push({ 
        text: 'Listeden Kaldır',
        icon: '✕',
        className: 'remove-action',
        action: () => this.removeFromList(word)
      });
    }

    actions.forEach(({ text, icon, className, action }) => {
      const button = document.createElement('button');
      button.className = className;
      button.setAttribute('type', 'button');
      
      const buttonIcon = document.createElement('span');
      buttonIcon.className = 'button-icon';
      buttonIcon.textContent = icon;
      button.appendChild(buttonIcon);
      
      const buttonText = document.createElement('span');
      buttonText.textContent = text;
      button.appendChild(buttonText);
      
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        action();
        this.hideWordMenu();
      });
      
      menu.appendChild(button);
    });

    document.body.appendChild(menu);
    this.currentMenu = menu;
    
    // Add click outside handler
    const handleClickOutside = (e) => {
      if (!menu.contains(e.target)) {
        this.hideWordMenu();
        document.removeEventListener('click', handleClickOutside);
      }
    };
    
    // Delay to prevent immediate hide
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 100);
    
    // Auto-hide after 6 seconds
    setTimeout(() => {
      if (this.currentMenu === menu) {
        this.hideWordMenu();
        document.removeEventListener('click', handleClickOutside);
      }
    }, 6000);
  }

  hideWordMenu() {
    if (this.currentMenu) {
      this.currentMenu.remove();
      this.currentMenu = null;
    }
    
    // Resume video if it was paused
    if (this.pauseOnHover && this.videoPaused) {
      this.resumeVideo();
    }
  }

  async markAsKnown(word) {
    this.knownWords.add(word);
    this.unknownWords.delete(word);
    
    await chrome.storage.local.set({
      knownWords: Array.from(this.knownWords),
      unknownWords: Array.from(this.unknownWords)
    });
    
    this.updateWordColors();
  }

  async markAsUnknown(word) {
    this.unknownWords.add(word);
    this.knownWords.delete(word);
    
    await chrome.storage.local.set({
      knownWords: Array.from(this.knownWords),
      unknownWords: Array.from(this.unknownWords)
    });
    
    this.updateWordColors();
  }

  async removeFromList(word) {
    this.knownWords.delete(word);
    this.unknownWords.delete(word);
    
    await chrome.storage.local.set({
      knownWords: Array.from(this.knownWords),
      unknownWords: Array.from(this.unknownWords)
    });
    
    this.updateWordColors();
  }

  updateWordColors() {
    // Batch update to prevent glitches
    const wordsToUpdate = document.querySelectorAll('.subtitle-word');
    
    // Use requestAnimationFrame for smooth updates
    requestAnimationFrame(() => {
      wordsToUpdate.forEach(span => {
        const word = span.dataset.word;
        if (!word) return;

        const currentClasses = span.className;
        let newClasses = 'subtitle-word';
        
        if (this.knownWords.has(word)) {
          newClasses += ' subtitle-known';
        } else if (this.unknownWords.has(word)) {
          newClasses += ' subtitle-unknown';
        }
        
        // Only update if classes actually changed
        if (currentClasses !== newClasses) {
          span.className = newClasses;
        }
      });
    });
  }

  watchUrlChanges() {
    let lastUrl = location.href;
    
    const checkUrlChange = () => {
      const currentUrl = location.href;
      if (currentUrl !== lastUrl) {

        lastUrl = currentUrl;
        this.cleanup();
        setTimeout(() => this.setupObservers(), 1500);
      }
    };

    // Watch for navigation
    const observer = new MutationObserver(checkUrlChange);
    observer.observe(document.querySelector('title'), {
      childList: true,
      characterData: true
    });

    // Periodic check
    setInterval(checkUrlChange, 2000);
  }

  cleanup() {
    // Clear observers
    if (this.mainObserver) {
      this.mainObserver.disconnect();
      this.mainObserver = null;
    }
    
    if (this.captionObserver) {
      this.captionObserver.disconnect();
      this.captionObserver = null;
    }

    // Clear timers
    if (this.periodicTimer) {
      clearInterval(this.periodicTimer);
      this.periodicTimer = null;
    }

    if (this.processTimeout) {
      clearTimeout(this.processTimeout);
      this.processTimeout = null;
    }

    if (this.incrementalTimeout) {
      clearTimeout(this.incrementalTimeout);
      this.incrementalTimeout = null;
    }

    // Clean up DOM
    document.querySelectorAll('[data-processed]').forEach(el => {
      el.removeAttribute('data-processed');
      el.removeAttribute('data-processing');
    });

    this.hideWordMenu();
    this.subtitleTextCache = new WeakMap();
    this.processedElements.clear(); // Clear processed elements tracking
    this.lastCaptionStructure = ''; // Reset structure tracking
  }

  // Helper methods
  isSubtitleElement(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;
    
    const className = element.className;
    const classString = typeof className === 'string' ? className : className?.baseVal || '';
    
    return classString.includes('ytp-caption-segment') ||
           classString.includes('ytp-caption-window-container') ||
           element.closest?.('.ytp-caption-window-container');
  }

  hasSubtitleChildren(element) {
    return element.querySelector('.ytp-caption-segment, .caption-visual-line');
  }

  // Debug methods for console testing
  debug() {
    const ytPlayer = document.querySelector('#movie_player, .html5-video-player');
    const captionContainer = ytPlayer?.querySelector('.ytp-caption-window-container');
    
    return {
      isActive: this.isActive,
      knownWords: this.knownWords.size,
      unknownWords: this.unknownWords.size,
      processedElements: this.processedElements.size,
      lastCaptionText: this.lastCaptionText,
      hasPlayer: !!ytPlayer,
      hasCaptionContainer: !!captionContainer,
      currentCaptionText: captionContainer?.textContent?.trim() || 'No captions',
      observers: {
        main: !!this.mainObserver,
        caption: !!this.captionObserver
      }
    };
  }

  forceProcessSubtitles() {
    this.processSubtitles();
  }

  clearProcessedElements() {
    this.processedElements.clear();
    this.processSubtitles();
  }

  pauseVideo() {
    const video = document.querySelector('video');
    if (video && !video.paused) {
      this.videoPaused = true;
      video.pause();
    }
  }

  resumeVideo() {
    const video = document.querySelector('video');
    if (video && this.videoPaused) {
      this.videoPaused = false;
      video.play();
    }
  }
}

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
  initializeExtension();
}

async function initializeExtension() {  
  // Wait for YouTube to load
  const waitForYouTube = () => {
    return new Promise((resolve) => {
      const check = () => {
        const player = document.querySelector('#movie_player, .html5-video-player');
        if (player) {
          resolve();
        } else {
          setTimeout(check, 500);
        }
      };
      check();
    });
  };

  await waitForYouTube();
  
  window.subtitleColorer = new SubtitleColorer();
  await window.subtitleColorer.init();
  
  // Setup message listener for popup communication
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sendResponse);
    return true; // Keep the message channel open for async responses
  });
  

}

// Message handler function - separated to reduce complexity
async function handleMessage(message, sendResponse) {
  if (!window.subtitleColorer) {
    sendResponse({ status: 'error', message: 'Extension not initialized' });
    return;
  }
  
  try {
    switch (message.type) {
      case 'ping':
        sendResponse({ status: 'ok', active: window.subtitleColorer.isActive });
        break;
        
      case 'toggle':
        await handleToggle(message, sendResponse);
        break;
        
      case 'clearColors':
        handleClearColors(sendResponse);
        break;
        
      case 'clearAllWords':
        await handleClearAllWords(sendResponse);
        break;
        
      case 'importData':
        await handleImportData(message, sendResponse);
        break;
        
      case 'wordsUpdated':
        handleWordsUpdated(message, sendResponse);
        break;
        
      case 'getStatus':
        handleGetStatus(sendResponse);
        break;
      
      case 'updateColors':
        await handleUpdateColors(sendResponse);
        break;
      
      case 'refresh':
        await handleRefresh(sendResponse);
        break;
        
      default:
        sendResponse({ status: 'error', message: 'Unknown message type' });
    }
  } catch (error) {
    console.error('Message handler error:', error);
    sendResponse({ status: 'error', message: error.message });
  }
}

async function handleToggle(message, sendResponse) {
  window.subtitleColorer.isActive = message.isActive;
  if (message.isActive) {
    window.subtitleColorer.processSubtitles();
  } else {
    document.querySelectorAll('.subtitle-known, .subtitle-unknown').forEach(el => {
      el.classList.remove('subtitle-known', 'subtitle-unknown');
    });
  }
  sendResponse({ status: 'ok', active: window.subtitleColorer.isActive });
}

function handleClearColors(sendResponse) {
  document.querySelectorAll('.subtitle-word').forEach(span => {
    span.className = 'subtitle-word';
  });
  sendResponse({ status: 'ok' });
}

async function handleClearAllWords(sendResponse) {
  window.subtitleColorer.knownWords.clear();
  window.subtitleColorer.unknownWords.clear();
  
  await chrome.storage.local.set({
    knownWords: [],
    unknownWords: []
  });
  
  window.subtitleColorer.updateWordColors();
  sendResponse({ status: 'ok' });
}

async function handleImportData(message, sendResponse) {
  if (!message.data) {
    sendResponse({ status: 'error', message: 'No data provided' });
    return;
  }
  
  if (message.data.knownWords) {
    window.subtitleColorer.knownWords = new Set(message.data.knownWords);
  }
  if (message.data.unknownWords) {
    window.subtitleColorer.unknownWords = new Set(message.data.unknownWords);
  }
  
  await chrome.storage.local.set({
    knownWords: Array.from(window.subtitleColorer.knownWords),
    unknownWords: Array.from(window.subtitleColorer.unknownWords)
  });
  
  window.subtitleColorer.updateWordColors();
  sendResponse({ status: 'ok' });
}

function handleWordsUpdated(message, sendResponse) {
  if (message.knownWords) {
    window.subtitleColorer.knownWords = new Set(message.knownWords);
  }
  if (message.unknownWords) {
    window.subtitleColorer.unknownWords = new Set(message.unknownWords);
  }
  window.subtitleColorer.updateWordColors();
  sendResponse({ status: 'ok' });
}

function handleGetStatus(sendResponse) {
  sendResponse({ 
    status: 'ok',
    active: window.subtitleColorer.isActive,
    knownWords: window.subtitleColorer.knownWords.size,
    unknownWords: window.subtitleColorer.unknownWords.size
  });
}

async function handleUpdateColors(sendResponse) {
  // Reload colors from storage and update subtitles
  const data = await chrome.storage.local.get({
    knownColor: '#10b981',
    learningColor: '#f59e0b'
  });
  
  // Update CSS variables
  document.documentElement.style.setProperty('--known-color', data.knownColor);
  document.documentElement.style.setProperty('--learning-color', data.learningColor);
  
  // Re-process subtitles to apply new colors
  window.subtitleColorer.updateWordColors();
  
  sendResponse({ status: 'ok' });
}

async function handleRefresh(sendResponse) {
  // Reload word data from storage
  const data = await chrome.storage.local.get({
    knownWords: [],
    unknownWords: []
  });
  
  window.subtitleColorer.knownWords = new Set(data.knownWords || []);
  window.subtitleColorer.unknownWords = new Set(data.unknownWords || []);
  window.subtitleColorer.updateWordColors();
  
  sendResponse({ status: 'ok' });
}

