// 🎭 Perfect Mimic System - YouTube Subtitle DOM Cloning
// Mimics YouTube's subtitle behavior exactly with ZERO glitch

class PerfectMimicSubtitleSystem {
  constructor() {
    // Word lists
    this.knownWords = new Set();
    this.unknownWords = new Set();
    
    // Settings
    this.isActive = true;
    this.pauseOnHover = true;
    
    // Native YouTube elements
    this.nativeContainer = null;
    this.nativeLines = [];
    
    // Our mimic elements
    this.mimicContainer = null;
    this.mimicLines = [];
    
    // State tracking
    this.domState = {
      lineCount: 0,
      lineTexts: [],
      lineStyles: [],
      lastUpdate: 0
    };
    
    // Observers
    this.structureObserver = null; // Watch line add/remove
    this.textObserver = null; // Watch text changes
    this.attributeObserver = null; // Watch style changes
    
    // Performance
    this.updateQueue = [];
    this.isProcessing = false;
    
    // Menu management
    this.currentMenu = null;
    this.currentMenuClickHandler = null;
    this.menuTimeouts = [];
    
    console.log('🎭 Perfect Mimic System initialized');
  }

  async init() {
    try {
      // Load word lists
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
      
      console.log('📚 Word lists loaded:', {
        known: this.knownWords.size,
        unknown: this.unknownWords.size
      });
      
      // Start system
      this.startSystem();
      
    } catch (error) {
      console.error('❌ Init error:', error);
    }
  }

  startSystem() {
    // Wait for YouTube player
    const waitForPlayer = () => {
      const player = document.querySelector('#movie_player, .html5-video-player');
      if (!player) {
        setTimeout(waitForPlayer, 500);
        return;
      }
      
      console.log('🎬 YouTube player found');
      this.setupMimicSystem(player);
    };
    
    waitForPlayer();
  }

  setupMimicSystem(player) {
    console.log('🔧 Setting up mimic system...');
    
    // Step 1: Find native subtitle container
    this.findNativeContainer(player);
    
    // Step 2: Create our mimic container
    this.createMimicContainer(player);
    
    // Step 3: Hide native subtitles
    this.hideNativeSubtitles();
    
    // Step 4: Setup observers
    this.setupObservers();
    
    // Step 5: Initial scan and mirror
    this.scanAndMirror();
    
    console.log('✅ Perfect Mimic System active');
  }

  findNativeContainer(player) {
    // Find caption container
    const container = player.querySelector('.ytp-caption-window-container');
    if (!container) {
      setTimeout(() => this.findNativeContainer(player), 1000);
      return;
    }
    
    this.nativeContainer = container;
    console.log('📍 Native container found:', container);
  }

  createMimicContainer(player) {
    // Remove existing mimic if any
    const existing = player.querySelector('.mimic-subtitle-container');
    if (existing) existing.remove();
    
    // Create mimic container with exact same positioning
    this.mimicContainer = document.createElement('div');
    this.mimicContainer.className = 'mimic-subtitle-container';
    this.mimicContainer.style.cssText = `
      position: absolute;
      bottom: 60px;
      left: 0;
      right: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      z-index: 9999;
      pointer-events: auto;
    `;
    
    player.appendChild(this.mimicContainer);
    console.log('🎭 Mimic container created');
  }

  hideNativeSubtitles() {
    // Make native subtitles invisible but keep them for tracking
    if (!this.nativeContainer) return;
    
    this.nativeContainer.style.opacity = '0';
    this.nativeContainer.style.pointerEvents = 'none';
    
    console.log('👻 Native subtitles hidden');
  }

  setupObservers() {
    if (!this.nativeContainer) {
      setTimeout(() => this.setupObservers(), 500);
      return;
    }

    // Observer 1: Structure changes (lines added/removed)
    this.structureObserver = new MutationObserver((mutations) => {
      if (!this.isActive) return;
      
      let structureChanged = false;
      
      mutations.forEach(mutation => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          structureChanged = true;
        }
        if (mutation.type === 'childList' && mutation.removedNodes.length > 0) {
          structureChanged = true;
        }
      });
      
      if (structureChanged) {
        this.onStructureChange();
      }
    });

    // Observer 2: Text changes (word additions)
    this.textObserver = new MutationObserver((mutations) => {
      if (!this.isActive) return;
      
      mutations.forEach(mutation => {
        if (mutation.type === 'characterData' || 
            (mutation.type === 'childList' && mutation.target.nodeType === Node.TEXT_NODE)) {
          this.onTextChange(mutation.target);
        }
      });
    });

    // Observer 3: Attribute changes (style/class)
    this.attributeObserver = new MutationObserver((mutations) => {
      if (!this.isActive) return;
      
      mutations.forEach(mutation => {
        if (mutation.type === 'attributes' && 
            (mutation.attributeName === 'style' || mutation.attributeName === 'class')) {
          this.onAttributeChange(mutation.target);
        }
      });
    });

    // Start observing
    this.structureObserver.observe(this.nativeContainer, {
      childList: true,
      subtree: true
    });

    this.textObserver.observe(this.nativeContainer, {
      characterData: true,
      subtree: true,
      childList: true
    });

    this.attributeObserver.observe(this.nativeContainer, {
      attributes: true,
      subtree: true,
      attributeFilter: ['style', 'class']
    });

    console.log('👀 All observers active');
  }

  // Event Handlers

  onStructureChange() {
    console.log('🔄 Structure changed - rescanning...');
    this.scanAndMirror();
  }

  onTextChange(node) {
    // Find which line this text belongs to
    const lineElement = node.parentElement?.closest('.ytp-caption-segment, .caption-visual-line');
    if (!lineElement) return;
    
    const lineIndex = this.findNativeLineIndex(lineElement);
    if (lineIndex === -1) return;
    
    const newText = this.extractLineText(lineElement);
    this.updateMimicLineText(lineIndex, newText);
  }

  onAttributeChange(element) {
    // Find which line this belongs to
    const lineElement = element.closest('.caption-visual-line, .ytp-caption-segment');
    if (!lineElement) return;
    
    const lineIndex = this.findNativeLineIndex(lineElement);
    if (lineIndex === -1) return;
    
    this.mirrorLineStyles(lineIndex, lineElement);
  }

  // Core Mirroring Logic

  scanAndMirror() {
    // Scan native subtitle structure
    const nativeLines = this.scanNativeLines();
    
    console.log(`📊 Scanned ${nativeLines.length} native lines`);
    
    // Update our DOM state
    const lineCountChanged = nativeLines.length !== this.domState.lineCount;
    
    if (lineCountChanged) {
      console.log(`📈 Line count changed: ${this.domState.lineCount} -> ${nativeLines.length}`);
      this.rebuildMimicLines(nativeLines);
    } else {
      // Just update existing lines
      nativeLines.forEach((nativeLine, index) => {
        this.updateMimicLineText(index, nativeLine.text);
        this.mirrorLineStyles(index, nativeLine.element);
      });
    }
    
    this.domState.lineCount = nativeLines.length;
  }

  scanNativeLines() {
    if (!this.nativeContainer) return [];
    
    const lines = [];
    const seenTexts = new Set(); // Prevent duplicates
    
    // Find all caption lines - prefer .caption-visual-line (containers)
    const lineElements = this.nativeContainer.querySelectorAll('.caption-visual-line');
    
    if (lineElements.length === 0) {
      // Fallback to segments if no visual lines
      const segments = this.nativeContainer.querySelectorAll('.ytp-caption-segment');
      segments.forEach(element => {
        const text = this.extractLineText(element);
        if (text.trim() && !seenTexts.has(text)) {
          seenTexts.add(text);
          lines.push({
            element: element,
            text: text,
            styles: window.getComputedStyle(element)
          });
        }
      });
    } else {
      // Use visual lines (preferred)
      lineElements.forEach(element => {
        const text = this.extractLineText(element);
        if (text.trim() && !seenTexts.has(text)) {
          seenTexts.add(text);
          lines.push({
            element: element,
            text: text,
            styles: window.getComputedStyle(element)
          });
        }
      });
    }
    
    // Sort by vertical position (top to bottom)
    lines.sort((a, b) => {
      const rectA = a.element.getBoundingClientRect();
      const rectB = b.element.getBoundingClientRect();
      return rectA.top - rectB.top;
    });
    
    return lines;
  }

  extractLineText(element) {
    // Get all text content from element
    return element.textContent?.trim() || '';
  }

  findNativeLineIndex(element) {
    const lines = this.scanNativeLines();
    return lines.findIndex(line => 
      line.element === element || line.element.contains(element)
    );
  }

  rebuildMimicLines(nativeLines) {
    console.log('🏗️ Rebuilding mimic lines...');
    
    // Clear existing mimic lines
    this.mimicContainer.innerHTML = '';
    this.mimicLines = [];
    
    // Create mimic line for each native line
    nativeLines.forEach((nativeLine, index) => {
      const mimicLine = this.createMimicLine(nativeLine);
      this.mimicContainer.appendChild(mimicLine);
      this.mimicLines.push(mimicLine);
    });
    
    console.log(`✅ Created ${this.mimicLines.length} mimic lines`);
  }

  createMimicLine(nativeLine) {
    const mimicLine = document.createElement('div');
    mimicLine.className = 'mimic-line';
    mimicLine.style.cssText = `
      padding: 4px 12px;
      margin: 2px 0;
      background: rgba(0, 0, 0, 0.8);
      border-radius: 4px;
      transition: transform 0.3s ease, opacity 0.3s ease;
    `;
    
    // Set initial text with colorization
    this.setMimicLineContent(mimicLine, nativeLine.text);
    
    return mimicLine;
  }

  updateMimicLineText(lineIndex, newText) {
    if (lineIndex < 0 || lineIndex >= this.mimicLines.length) return;
    
    const mimicLine = this.mimicLines[lineIndex];
    const currentText = mimicLine.textContent;
    
    // Only update if text actually changed
    if (currentText === newText) return;
    
    console.log(`📝 Updating line ${lineIndex}: "${newText}"`);
    this.setMimicLineContent(mimicLine, newText);
  }

  setMimicLineContent(mimicLine, text) {
    // Create colorized HTML
    const colorizedHTML = this.createColorizedHTML(text);
    
    // Use DocumentFragment for atomic update
    const fragment = document.createDocumentFragment();
    const temp = document.createElement('div');
    temp.innerHTML = colorizedHTML;
    
    while (temp.firstChild) {
      fragment.appendChild(temp.firstChild);
    }
    
    // Atomic replace
    mimicLine.innerHTML = '';
    mimicLine.appendChild(fragment);
    
    // Setup click handlers
    this.setupWordClickHandlers(mimicLine);
  }

  mirrorLineStyles(lineIndex, nativeElement) {
    if (lineIndex < 0 || lineIndex >= this.mimicLines.length) return;
    
    const mimicLine = this.mimicLines[lineIndex];
    const computedStyle = window.getComputedStyle(nativeElement);
    
    // Mirror critical styles only
    const stylesToMirror = ['transform', 'opacity', 'transition'];
    
    stylesToMirror.forEach(prop => {
      mimicLine.style[prop] = computedStyle[prop];
    });
  }

  createColorizedHTML(text) {
    if (!text) return '';
    
    const words = this.extractWordsWithPositions(text);
    if (words.length === 0) return this.escapeHtml(text);
    
    let html = '';
    let lastIndex = 0;
    
    words.forEach(wordInfo => {
      // Add text before word
      if (wordInfo.start > lastIndex) {
        html += this.escapeHtml(text.slice(lastIndex, wordInfo.start));
      }
      
      // Check if word is marked
      const cleanWord = wordInfo.word.toLowerCase();
      const isKnown = this.knownWords.has(cleanWord);
      const isUnknown = this.unknownWords.has(cleanWord);
      
      if (isKnown || isUnknown) {
        // Word is marked - wrap in span with color class
        const wordClass = isKnown ? 'known-word' : 'unknown-word';
        html += `<span class="mimic-word ${wordClass}" data-word="${this.escapeHtml(cleanWord)}">${this.escapeHtml(wordInfo.text)}</span>`;
      } else {
        // Word is not marked - render as plain text (clickable for marking)
        html += `<span class="mimic-word unmarked-word" data-word="${this.escapeHtml(cleanWord)}">${this.escapeHtml(wordInfo.text)}</span>`;
      }
      
      lastIndex = wordInfo.end;
    });
    
    // Add remaining text
    if (lastIndex < text.length) {
      html += this.escapeHtml(text.slice(lastIndex));
    }
    
    return html;
  }

  extractWordsWithPositions(text) {
    const words = [];
    const wordRegex = /[\p{L}\d]+(?:['\u2019-][\p{L}\d]+)*/gu;
    let match;
    
    while ((match = wordRegex.exec(text)) !== null) {
      words.push({
        word: match[0].toLowerCase(),
        text: match[0],
        start: match.index,
        end: match.index + match[0].length
      });
    }
    
    return words;
  }

  getWordClass(word) {
    const cleanWord = word.toLowerCase();
    
    if (this.knownWords.has(cleanWord)) {
      return 'known-word';
    } else if (this.unknownWords.has(cleanWord)) {
      return 'unknown-word';
    } else {
      return 'neutral-word';
    }
  }

  setupWordClickHandlers(mimicLine) {
    const wordSpans = mimicLine.querySelectorAll('.mimic-word');
    
    wordSpans.forEach(span => {
      span.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showWordMenu(span, e);
      });
      
      if (this.pauseOnHover) {
        span.addEventListener('mouseenter', () => this.pauseVideo());
        span.addEventListener('mouseleave', () => this.resumeVideo());
      }
    });
  }

  handleWordClick(wordSpan) {
    const word = wordSpan.dataset.word;
    if (!word) return;
    
    // Animate click
    wordSpan.style.transform = 'scale(1.15)';
    setTimeout(() => {
      wordSpan.style.transform = 'scale(1)';
    }, 150);
    
    // Toggle word status: unmarked -> known -> unknown -> unmarked
    if (this.knownWords.has(word)) {
      // Known -> Unknown
      this.knownWords.delete(word);
      this.unknownWords.add(word);
      wordSpan.className = 'mimic-word unknown-word';
    } else if (this.unknownWords.has(word)) {
      // Unknown -> Unmarked
      this.unknownWords.delete(word);
      wordSpan.className = 'mimic-word unmarked-word';
    } else {
      // Unmarked -> Known
      this.knownWords.add(word);
      wordSpan.className = 'mimic-word known-word';
    }
    
    // Save and update all instances
    this.saveWordLists();
    this.updateAllWordInstances(word);
    
    const status = this.getWordStatus(word);
    console.log('📝 Word updated:', word, status);
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
    
    // Position menu above the word
    const rect = wordSpan.getBoundingClientRect();
    const menuWidth = 180;
    const menuHeight = 120;
    
    let menuX = rect.left + (rect.width / 2) - (menuWidth / 2);
    let menuY = rect.top - menuHeight - 8;
    
    // Keep menu in viewport
    const viewportWidth = window.innerWidth;
    if (menuX < 10) menuX = 10;
    if (menuX + menuWidth > viewportWidth - 10) menuX = viewportWidth - menuWidth - 10;
    if (menuY < 10) menuY = rect.bottom + 8;
    
    menu.style.cssText = `
      left: ${menuX}px;
      top: ${menuY}px;
    `;

    const isKnown = this.knownWords.has(word);
    const isUnknown = this.unknownWords.has(word);

    // Word title with status badge
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

    // Menu actions
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
    
    // Click outside handler
    const handleClickOutside = (e) => {
      if (!menu.contains(e.target)) {
        this.hideWordMenu();
        document.removeEventListener('click', handleClickOutside);
      }
    };
    
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 100);
    
    // Auto-hide after 6 seconds
    const autoHideTimeout = setTimeout(() => {
      if (this.currentMenu === menu) {
        this.hideWordMenu();
        document.removeEventListener('click', handleClickOutside);
      }
    }, 6000);
    
    this.menuTimeouts.push(autoHideTimeout);
  }

  hideWordMenu() {
    if (this.currentMenu) {
      this.currentMenu.remove();
      this.currentMenu = null;
    }
    
    // Clear all timeouts
    this.menuTimeouts.forEach(timeout => clearTimeout(timeout));
    this.menuTimeouts = [];
    
    // Resume video if it was paused
    if (this.pauseOnHover) {
      this.resumeVideo();
    }
  }

  async markAsKnown(word) {
    this.knownWords.add(word);
    this.unknownWords.delete(word);
    
    await this.saveWordLists();
    this.updateAllWordInstances(word);
    
    console.log('✅ Marked as known:', word);
  }

  async markAsUnknown(word) {
    this.unknownWords.add(word);
    this.knownWords.delete(word);
    
    await this.saveWordLists();
    this.updateAllWordInstances(word);
    
    console.log('⚠️ Marked as unknown:', word);
  }

  async removeFromList(word) {
    this.knownWords.delete(word);
    this.unknownWords.delete(word);
    
    await this.saveWordLists();
    this.updateAllWordInstances(word);
    
    console.log('🗑️ Removed from lists:', word);
  }

  getWordStatus(word) {
    if (this.knownWords.has(word)) return 'known';
    if (this.unknownWords.has(word)) return 'unknown';
    return 'neutral';
  }

  updateAllWordInstances(word) {
    // Update all instances of this word in all lines
    const allWords = this.mimicContainer.querySelectorAll(`.mimic-word[data-word="${word}"]`);
    
    // Determine new class based on current status
    let newClass = 'mimic-word unmarked-word';
    if (this.knownWords.has(word)) {
      newClass = 'mimic-word known-word';
    } else if (this.unknownWords.has(word)) {
      newClass = 'mimic-word unknown-word';
    }
    
    allWords.forEach(span => {
      span.className = newClass;
    });
  }

  async saveWordLists() {
    try {
      await chrome.storage.local.set({
        knownWords: Array.from(this.knownWords),
        unknownWords: Array.from(this.unknownWords)
      });
    } catch (error) {
      console.error('❌ Save error:', error);
    }
  }

  pauseVideo() {
    const video = document.querySelector('video');
    if (video && !video.paused) {
      video.pause();
    }
  }

  resumeVideo() {
    const video = document.querySelector('video');
    if (video && video.paused) {
      video.play();
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Debug methods
  getStats() {
    return {
      knownWords: this.knownWords.size,
      unknownWords: this.unknownWords.size,
      isActive: this.isActive,
      nativeLines: this.scanNativeLines().length,
      mimicLines: this.mimicLines.length,
      observers: {
        structure: !!this.structureObserver,
        text: !!this.textObserver,
        attribute: !!this.attributeObserver
      }
    };
  }

  toggle() {
    this.isActive = !this.isActive;
    this.mimicContainer.style.display = this.isActive ? 'flex' : 'none';
    console.log('🔄 Mimic system:', this.isActive ? 'ON' : 'OFF');
  }

  forceRescan() {
    console.log('🔄 Force rescan triggered');
    this.scanAndMirror();
  }
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPerfectMimic);
} else {
  initPerfectMimic();
}

function initPerfectMimic() {
  const waitForYouTube = () => {
    if (window.location.hostname === 'www.youtube.com' && document.querySelector('#movie_player')) {
      window.perfectMimic = new PerfectMimicSubtitleSystem();
      window.perfectMimic.init();
      
      // Setup message listener for popup communication
      setupMessageListener();
    } else {
      setTimeout(waitForYouTube, 500);
    }
  };
  
  waitForYouTube();
}

// Message handler for popup communication
function setupMessageListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!window.perfectMimic) {
      sendResponse({ status: 'error', message: 'System not initialized' });
      return;
    }
    
    try {
      switch (message.type) {
        case 'ping':
          sendResponse({ status: 'ok', active: window.perfectMimic.isActive });
          break;
          
        case 'toggle':
          window.perfectMimic.isActive = message.isActive;
          window.perfectMimic.mimicContainer.style.display = message.isActive ? 'flex' : 'none';
          sendResponse({ status: 'ok', active: window.perfectMimic.isActive });
          break;
          
        case 'getStatus':
          sendResponse({ 
            status: 'ok',
            active: window.perfectMimic.isActive,
            knownWords: window.perfectMimic.knownWords.size,
            unknownWords: window.perfectMimic.unknownWords.size
          });
          break;
        
        case 'wordsUpdated':
          if (message.knownWords) {
            window.perfectMimic.knownWords = new Set(message.knownWords);
          }
          if (message.unknownWords) {
            window.perfectMimic.unknownWords = new Set(message.unknownWords);
          }
          // Re-render all lines with new word status
          window.perfectMimic.scanAndMirror();
          sendResponse({ status: 'ok' });
          break;
          
        case 'clearAllWords':
          window.perfectMimic.knownWords.clear();
          window.perfectMimic.unknownWords.clear();
          window.perfectMimic.saveWordLists();
          window.perfectMimic.scanAndMirror();
          sendResponse({ status: 'ok' });
          break;
          
        case 'refresh':
          window.perfectMimic.scanAndMirror();
          sendResponse({ status: 'ok' });
          break;
          
        default:
          sendResponse({ status: 'error', message: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Message handler error:', error);
      sendResponse({ status: 'error', message: error.message });
    }
    
    return true; // Keep message channel open
  });
}

// Debug commands
console.log('🔧 Debug: window.perfectMimic.getStats(), window.perfectMimic.toggle(), window.perfectMimic.forceRescan()');