// SubFlow - YouTube Subtitle Colorer (ULTRA-OPTIMIZED)
// Zero-latency subtitle processing with intelligent caching

const WORD_DETECTION_REGEX = /[\p{L}\d]+(?:['\u2019-][\p{L}\d]+)*/gu;

class SubtitleColorer {
  constructor() {
    // Core word lists
    this.knownWords = new Set();
    this.unknownWords = new Set();
    
    // State
    this.isActive = true;
    this.pauseOnHover = true;
    this.ctrlPressed = false;
    this.videoPaused = false;
    
    // SINGLE observer (no duplicate!)
    this.observer = null;
    
    // Smart text-based cache
    this.processedCache = new Map(); // key: textHash, value: processedHTML
    this.maxCacheSize = 100;
    
    // Event handlers (pre-bound)
    this.handleDocumentClick = this.handleDocumentClick.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    
    // Current menu
    this.currentMenu = null;
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
      
      console.log('🚀 SubFlow initialized (OPTIMIZED):', {
        knownWords: this.knownWords.size,
        unknownWords: this.unknownWords.size,
        isActive: this.isActive
      });
    } catch (error) {
      console.error('Init error:', error);
      this.knownWords = new Set();
      this.unknownWords = new Set();
    }

    this.setupObserver();
    this.setupEventListeners();
    this.watchUrlChanges();
  }

  setupObserver() {
    const ytPlayer = document.querySelector('#movie_player, .html5-video-player');
    if (!ytPlayer) {
      setTimeout(() => this.setupObserver(), 500);
      return;
    }

    const captionContainer = ytPlayer.querySelector('.ytp-caption-window-container');
    if (!captionContainer) {
      setTimeout(() => this.setupObserver(), 500);
      return;
    }

    // Process existing subtitles
    this.processContainer(captionContainer);

    // SINGLE OBSERVER - Caption container only (no mainObserver!)
    this.observer = new MutationObserver((mutations) => {
      if (!this.isActive) return;
      
      // NO DEBOUNCE - Process immediately!
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              this.processNode(node); // NO setTimeout!
            }
          });
        } else if (mutation.type === 'characterData') {
          const element = mutation.target.parentElement;
          if (element) {
            this.processNode(element);
          }
        }
      });
    });

    this.observer.observe(captionContainer, {
      childList: true,
      characterData: true,
      subtree: true
    });

    console.log('✅ Single observer active');
  }

  processContainer(container) {
    // Process all visible subtitle elements
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          return this.shouldProcessNode(node)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_SKIP;
        }
      }
    );

    const nodesToProcess = [];
    let node;
    while ((node = walker.nextNode())) {
      nodesToProcess.push(node);
    }

    nodesToProcess.forEach(n => this.processNode(n));
  }

  shouldProcessNode(node) {
    // Quick validation
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
    if (node.classList.contains('subtitle-word')) return false; // Already processed
    if (!node.textContent?.trim()) return false;
    
    // Check if this node has subtitle word children (skip if already processed)
    if (node.querySelector('.subtitle-word')) return false;
    
    // Check if this is a container with other elements (skip parent containers)
    // Process only if: has direct text content OR is a leaf element
    const hasDirectText = Array.from(node.childNodes).some(
      child => child.nodeType === Node.TEXT_NODE && child.textContent.trim()
    );
    
    const hasOnlyTextNodes = Array.from(node.childNodes).every(
      child => child.nodeType === Node.TEXT_NODE
    );
    
    return hasDirectText || hasOnlyTextNodes;
  }

  processNode(node) {
    if (!this.shouldProcessNode(node)) return;
    
    const text = node.textContent.trim();
    if (!text) return;
    
    // Check cache
    const textHash = this.hashText(text);
    
    if (this.processedCache.has(textHash)) {
      // Cache hit - reuse processed HTML
      node.innerHTML = this.processedCache.get(textHash);
      return;
    }
    
    // Process NOW - NO setTimeout, NO debounce!
    const html = this.createWordSpansHTML(text);
    
    // Update cache
    this.addToCache(textHash, html);
    
    // Apply to DOM
    node.innerHTML = html;
  }

  createWordSpansHTML(text) {
    const wordTokens = this.detectWords(text);
    if (wordTokens.length === 0) return text;

    let html = '';
    let lastIndex = 0;

    wordTokens.forEach(token => {
      // Add text before word
      if (token.start > lastIndex) {
        html += this.escapeHtml(text.slice(lastIndex, token.start));
      }

      // Create word span with instant coloring
      const cleanWord = token.word.toLowerCase();
      let colorClass = '';
      
      if (this.knownWords.has(cleanWord)) {
        colorClass = ' subtitle-known';
      } else if (this.unknownWords.has(cleanWord)) {
        colorClass = ' subtitle-unknown';
      }

      html += `<span class="subtitle-word${colorClass}" data-word="${cleanWord}">${this.escapeHtml(token.word)}</span>`;
      
      lastIndex = token.end;
    });

    // Add remaining text
    if (lastIndex < text.length) {
      html += this.escapeHtml(text.slice(lastIndex));
    }

    return html;
  }

  detectWords(text) {
    if (!text) return [];
    
    const tokens = [];
    const regex = new RegExp(WORD_DETECTION_REGEX);
    regex.lastIndex = 0;
    
    let match;
    while ((match = regex.exec(text)) !== null) {
      const word = match[0];
      
      // Ignore single-character punctuation
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

  hashText(text) {
    // Simple fast hash
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  addToCache(key, value) {
    // LRU cache - keep size limited
    if (this.processedCache.size >= this.maxCacheSize) {
      const firstKey = this.processedCache.keys().next().value;
      this.processedCache.delete(firstKey);
    }
    this.processedCache.set(key, value);
  }

  updateWordColors() {
    // NO requestAnimationFrame - update immediately!
    const container = document.querySelector('.ytp-caption-window-container');
    if (!container) return;
    
    // Only update visible subtitles
    container.querySelectorAll('.subtitle-word').forEach(span => {
      const word = span.dataset.word;
      if (!word) return;
      
      // Use classList API (native, fast)
      span.classList.remove('subtitle-known', 'subtitle-unknown');
      
      if (this.knownWords.has(word)) {
        span.classList.add('subtitle-known');
      } else if (this.unknownWords.has(word)) {
        span.classList.add('subtitle-unknown');
      }
    });
  }

  // Event Listeners
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

    if (this.pauseOnHover) {
      this.pauseVideo();
    }

    const menu = document.createElement('div');
    menu.className = 'subtitle-word-menu';
    
    const rect = wordSpan.getBoundingClientRect();
    const menuWidth = 180;
    const menuHeight = 110;
    
    let menuX = rect.left + (rect.width / 2) - (menuWidth / 2);
    let menuY = rect.top - menuHeight - 8;
    
    if (menuX < 10) menuX = 10;
    if (menuX + menuWidth > window.innerWidth - 10) {
      menuX = window.innerWidth - menuWidth - 10;
    }
    
    if (menuY < 10) {
      menuY = rect.bottom + 8;
    }
    
    menu.style.cssText = `left: ${menuX}px; top: ${menuY}px;`;

    const isKnown = this.knownWords.has(word);
    const isUnknown = this.unknownWords.has(word);

    // Word title
    const wordTitle = document.createElement('div');
    wordTitle.style.cssText = 'display: flex; align-items: center; justify-content: space-between; gap: 8px;';
    
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

    // Actions
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
    
    const handleClickOutside = (e) => {
      if (!menu.contains(e.target)) {
        this.hideWordMenu();
        document.removeEventListener('click', handleClickOutside);
      }
    };
    
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 100);
    
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

  watchUrlChanges() {
    let lastUrl = location.href;
    
    const checkUrlChange = () => {
      const currentUrl = location.href;
      if (currentUrl !== lastUrl) {
        console.log('📍 URL changed, reinitializing...');
        lastUrl = currentUrl;
        this.cleanup();
        setTimeout(() => this.setupObserver(), 1500);
      }
    };

    const observer = new MutationObserver(checkUrlChange);
    const titleElement = document.querySelector('title');
    if (titleElement) {
      observer.observe(titleElement, {
        childList: true,
        characterData: true
      });
    }

    setInterval(checkUrlChange, 2000);
  }

  cleanup() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    this.hideWordMenu();
    this.processedCache.clear();
    
    document.querySelectorAll('.subtitle-word').forEach(el => {
      const parent = el.parentElement;
      if (parent) {
        parent.innerHTML = parent.textContent;
      }
    });
  }
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
  initializeExtension();
}

async function initializeExtension() {
  console.log('🎬 SubFlow: Starting...');
  
  const waitForYouTube = () => {
    return new Promise((resolve) => {
      const check = () => {
        const player = document.querySelector('#movie_player, .html5-video-player');
        if (player) {
          console.log('✅ YouTube player found');
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
  
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sendResponse);
    return true;
  });
  
  console.log('✅ SubFlow ready!');
}

async function handleMessage(message, sendResponse) {
  if (!window.subtitleColorer) {
    sendResponse({ status: 'error', message: 'Not initialized' });
    return;
  }
  
  try {
    const { type } = message;
    
    switch (type) {
      case 'toggle':
        window.subtitleColorer.isActive = message.isActive;
        if (message.isActive) {
          const container = document.querySelector('.ytp-caption-window-container');
          if (container) window.subtitleColorer.processContainer(container);
        } else {
          document.querySelectorAll('.subtitle-known, .subtitle-unknown').forEach(el => {
            el.classList.remove('subtitle-known', 'subtitle-unknown');
          });
        }
        sendResponse({ status: 'ok', active: window.subtitleColorer.isActive });
        break;
        
      case 'wordsUpdated':
        if (message.knownWords) {
          window.subtitleColorer.knownWords = new Set(message.knownWords);
        }
        if (message.unknownWords) {
          window.subtitleColorer.unknownWords = new Set(message.unknownWords);
        }
        window.subtitleColorer.updateWordColors();
        sendResponse({ status: 'ok' });
        break;
        
      case 'refresh': {
        const data = await chrome.storage.local.get({
          knownWords: [],
          unknownWords: []
        });
        window.subtitleColorer.knownWords = new Set(data.knownWords || []);
        window.subtitleColorer.unknownWords = new Set(data.unknownWords || []);
        window.subtitleColorer.updateWordColors();
        sendResponse({ status: 'ok' });
        break;
      }
        
      case 'updateColors': {
        const colors = await chrome.storage.local.get({
          knownColor: '#10b981',
          learningColor: '#f59e0b'
        });
        document.documentElement.style.setProperty('--known-color', colors.knownColor);
        document.documentElement.style.setProperty('--learning-color', colors.learningColor);
        window.subtitleColorer.updateWordColors();
        sendResponse({ status: 'ok' });
        break;
      }
        
      case 'clearAllWords':
        window.subtitleColorer.knownWords.clear();
        window.subtitleColorer.unknownWords.clear();
        await chrome.storage.local.set({
          knownWords: [],
          unknownWords: []
        });
        window.subtitleColorer.updateWordColors();
        sendResponse({ status: 'ok' });
        break;
        
      case 'importData':
        if (message.data) {
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
        }
        sendResponse({ status: 'ok' });
        break;
        
      default:
        sendResponse({ status: 'error', message: 'Unknown type' });
    }
  } catch (error) {
    console.error('Message error:', error);
    sendResponse({ status: 'error', message: error.message });
  }
}
