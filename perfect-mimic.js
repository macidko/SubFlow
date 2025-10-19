// 🎭 Perfect Mimic System - YouTube Subtitle DOM Cloning
// Mimics YouTube's subtitle behavior exactly with ZERO glitch

// Helper function to safely access window properties
// This ensures scripts are loaded in correct order
function waitForGlobals() {
  return new Promise((resolve) => {
    const check = () => {
      if (window.storageManager && window.STORAGE_SCHEMA && window.MESSAGE_TYPES) {
        resolve();
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });
}

class PerfectMimicSubtitleSystem {
  constructor() {
    // Storage manager instance (will be set in init)
    this.storage = null;
    
    // Word lists (Sets for fast lookup)
    this.knownWords = new Set();
    this.unknownWords = new Set();
    
    // Settings
    this.isActive = true;
    this.pauseOnHover = true;
    this.knownColor = '#10b981';
    this.learningColor = '#f59e0b';
    
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
    
  }

  async init() {
    try {
      // Wait for globals to load
      await waitForGlobals();
      
      // Now we can safely use window properties
      this.storage = window.storageManager;
      
      // Initialize storage manager
      await this.storage.initialize(window.STORAGE_SCHEMA);
      
      // Load all settings
      const data = await this.storage.get(window.STORAGE_SCHEMA);
      
      this.knownWords = new Set(data.knownWords || []);
      this.unknownWords = new Set(data.unknownWords || []);
      this.isActive = data.isActive !== false;
      this.pauseOnHover = data.pauseOnHover !== false;
      this.knownColor = data.knownColor || '#10b981';
      this.learningColor = data.learningColor || '#f59e0b';
      
      // Inject dynamic styles
      this.injectDynamicStyles();
      
      // Setup storage change listener
      this.setupStorageListener();
      
      // Setup message listener
      this.setupMessageHandler();
      
      // Start system
      this.startSystem();
      
    } catch (error) {
      console.error('❌ Init error:', error);
    }
  }

  /**
   * Inject dynamic styles based on user settings - ZERO LAYOUT SHIFT, GLOW EFFECT
   */
  injectDynamicStyles() {
    // Remove existing dynamic styles
    const existing = document.getElementById('mimic-dynamic-styles');
    if (existing) existing.remove();
    
    // Create style element - GLOW + BACKGROUND ON HOVER
    const style = document.createElement('style');
    style.id = 'mimic-dynamic-styles';
    style.textContent = `
      .mimic-word {
        display: inline;
        transition: none;
        cursor: pointer;
        position: relative;
      }
      
      .mimic-word:hover {
        background: rgba(255, 255, 255, 0.15);
        box-shadow: 0 0 8px rgba(255, 255, 255, 0.4);
        border-radius: 3px;
      }
      
      .known-word {
        color: ${this.knownColor} !important;
        font-weight: 700 !important;
        text-shadow: 0 0 10px ${this.knownColor}99 !important;
      }
      
      .known-word:hover {
        background: ${this.knownColor}33 !important;
        text-shadow: 0 0 15px ${this.knownColor}cc !important;
      }
      
      .unknown-word {
        color: ${this.learningColor} !important;
        font-weight: 700 !important;
        text-shadow: 0 0 10px ${this.learningColor}99 !important;
      }
      
      .unknown-word:hover {
        background: ${this.learningColor}33 !important;
        text-shadow: 0 0 15px ${this.learningColor}cc !important;
      }
      
      .unmarked-word {
        color: white !important;
        font-weight: inherit !important;
      }
    `;
    
    document.head.appendChild(style);
    console.log('🎨 Dynamic styles injected (glow effect):', { known: this.knownColor, learning: this.learningColor });
  }

  /**
   * Listen for storage changes from popup
   */
  setupStorageListener() {
    this.storage.onChanged((changes) => {
      
      // Update word lists
      if (changes.knownWords) {
        this.knownWords = new Set(changes.knownWords.newValue || []);
      }
      
      if (changes.unknownWords) {
        this.unknownWords = new Set(changes.unknownWords.newValue || []);
      }
      
      // Update settings
      if (changes.isActive) {
        this.isActive = changes.isActive.newValue;
      }
      
      if (changes.pauseOnHover) {
        this.pauseOnHover = changes.pauseOnHover.newValue;
      }
      
      // Update colors
      if (changes.knownColor || changes.learningColor) {
        this.knownColor = changes.knownColor?.newValue || this.knownColor;
        this.learningColor = changes.learningColor?.newValue || this.learningColor;
        this.injectDynamicStyles();
      }
      
      // Re-render subtitles
      this.scanAndMirror();
    });
  }

  /**
   * Setup message handler for popup communication
   */
  setupMessageHandler() {
    window.setupMessageListener({
      [window.MESSAGE_TYPES.PING]: () => {
        return { active: this.isActive, version: '2.0' };
      },
      
      [window.MESSAGE_TYPES.GET_STATUS]: () => {
        return {
          isActive: this.isActive,
          knownCount: this.knownWords.size,
          learningCount: this.unknownWords.size
        };
      },
      
      [window.MESSAGE_TYPES.TOGGLE]: async () => {
        this.isActive = !this.isActive;
        await this.storage.set({ isActive: this.isActive });
        
        if (this.isActive) {
          this.scanAndMirror();
        } else {
          this.clearMimicLines();
        }
        
        return { isActive: this.isActive };
      },
      
      [window.MESSAGE_TYPES.REFRESH]: () => {
        this.scanAndMirror();
        return { refreshed: true };
      },
      
      [window.MESSAGE_TYPES.WORDS_UPDATED]: async (payload) => {
        this.knownWords = new Set(payload.knownWords || []);
        this.unknownWords = new Set(payload.unknownWords || []);
        this.scanAndMirror();
        return { updated: true };
      },
      
      [window.MESSAGE_TYPES.SETTINGS_UPDATED]: async (payload) => {
        if (payload.knownColor) this.knownColor = payload.knownColor;
        if (payload.learningColor) this.learningColor = payload.learningColor;
        if (payload.pauseOnHover !== undefined) this.pauseOnHover = payload.pauseOnHover;
        
        this.injectDynamicStyles();
        this.scanAndMirror();
        return { updated: true };
      }
    });
    
  }

  startSystem() {
    // Wait for YouTube player
    const waitForPlayer = () => {
      const player = document.querySelector('#movie_player, .html5-video-player');
      if (!player) {
        setTimeout(waitForPlayer, 500);
        return;
      }
    
      this.setupMimicSystem(player);
    };
    
    waitForPlayer();
  }

  setupMimicSystem(player) {    
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
    
  }

  findNativeContainer(player) {
    // Find caption container
    const container = player.querySelector('.ytp-caption-window-container');
    if (!container) {
      setTimeout(() => this.findNativeContainer(player), 1000);
      return;
    }
    
    this.nativeContainer = container;
  }

  createMimicContainer(player) {
    // Remove existing mimic if any
    const existing = player.querySelector('.mimic-subtitle-container');
    if (existing) existing.remove();
    
    // Create mimic container - RESPONSIVE POSITIONING
    this.mimicContainer = document.createElement('div');
    this.mimicContainer.className = 'mimic-subtitle-container';
    
    // Calculate responsive bottom position
    const getResponsiveBottom = () => {
      const height = window.innerHeight;
      if (height < 480) return '8%';
      if (height < 768) return '10%';
      if (height < 1080) return '12%';
      return '14%';
    };
    
    this.mimicContainer.style.cssText = `
      position: absolute;
      bottom: ${getResponsiveBottom()};
      left: 50%;
      transform: translateX(-50%);
      width: 90%;
      max-width: min(1400px, 95vw);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      z-index: 9999;
      pointer-events: none;
      transition: none;
    `;
    
    player.appendChild(this.mimicContainer);
    
    // Update position on resize
    window.addEventListener('resize', () => {
      if (this.mimicContainer) {
        this.mimicContainer.style.bottom = getResponsiveBottom();
        this.mimicContainer.style.maxWidth = 'min(1400px, 95vw)';
      }
    });
  }

  hideNativeSubtitles() {
    // Make native subtitles invisible but keep them for tracking
    if (!this.nativeContainer) return;
    
    this.nativeContainer.style.opacity = '0';
    this.nativeContainer.style.pointerEvents = 'none';
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

  }

  // Event Handlers

  onStructureChange() {
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
    
    
    // Update our DOM state
    const lineCountChanged = nativeLines.length !== this.domState.lineCount;
    
    if (lineCountChanged) {
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
    
    // Clear existing mimic lines
    this.mimicContainer.innerHTML = '';
    this.mimicLines = [];
    
    // Create mimic line for each native line
    nativeLines.forEach((nativeLine, index) => {
      const mimicLine = this.createMimicLine(nativeLine);
      this.mimicContainer.appendChild(mimicLine);
      this.mimicLines.push(mimicLine);
    });
    
  }

  createMimicLine(nativeLine) {
    const mimicLine = document.createElement('div');
    mimicLine.className = 'mimic-line';
    
    // Get responsive values
    const getResponsiveValues = () => {
      const width = window.innerWidth;
      
      if (width < 576) {
        return { padding: '4px 12px 6px 12px', background: 'rgba(0, 0, 0, 0.8)' };
      } else if (width < 768) {
        return { padding: '5px 16px 7px 16px', background: 'rgba(0, 0, 0, 0.75)' };
      } else if (width < 992) {
        return { padding: '6px 18px 8px 18px', background: 'rgba(0, 0, 0, 0.75)' };
      } else if (width < 1200) {
        return { padding: '6px 20px 8px 20px', background: 'rgba(0, 0, 0, 0.75)' };
      } else {
        return { padding: '7px 22px 9px 22px', background: 'rgba(0, 0, 0, 0.7)' };
      }
    };
    
    const values = getResponsiveValues();
    
    // RESPONSIVE NETFLIX-STYLE SUBTITLES - LEFT ALIGNED, FIXED WIDTH
    mimicLine.style.cssText = `
      position: relative;
      display: block;
      padding: ${values.padding};
      margin: 0 auto;
      background: ${values.background};
      border-radius: 3px;
      font-family: Netflix Sans, Helvetica Neue, Segoe UI, Roboto, Ubuntu, sans-serif;
      font-weight: 500;
      line-height: 1.4;
      text-align: left;
      letter-spacing: 0.01em;
      color: #ffffff;
      text-shadow: 
        1px 1px 2px rgba(0, 0, 0, 0.9),
        0 0 4px rgba(0, 0, 0, 0.7);
      white-space: pre-wrap;
      word-wrap: break-word;
      word-break: break-word;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
      pointer-events: auto;
      transition: none;
      max-width: 85%;
      min-width: max-content;
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
        console.debug('🖱️ mimic-word clicked (span.dataset.word):', span.dataset.word, span);
        this.showWordMenu(span, e);
      });
      
      if (this.pauseOnHover) {
        span.addEventListener('mouseenter', () => this.pauseVideo());
        span.addEventListener('mouseleave', () => this.resumeVideo());
      }
    });
  }

  async handleWordClick(wordSpan) {
    const word = wordSpan.dataset.word;
    if (!word) return;
    
    // Animate click
    wordSpan.style.transform = 'scale(1.15)';
    setTimeout(() => {
      wordSpan.style.transform = 'scale(1)';
    }, 150);
    
    // Get current state
    const currentState = window.getWordState(word, this.knownWords, this.unknownWords);
    const nextState = window.getNextWordState(currentState);
    
    
    // Update state using storage manager (prevents race conditions!)
    switch (nextState) {
      case window.WORD_STATES.KNOWN:
        // Move to known
        await this.storage.removeFromSet('unknownWords', word);
        await this.storage.addToSet('knownWords', word);
        this.knownWords.add(word);
        this.unknownWords.delete(word);
        wordSpan.className = `mimic-word ${window.WORD_CLASSES[window.WORD_STATES.KNOWN]}`;
        break;
        
      case window.WORD_STATES.LEARNING:
        // Move to learning
        await this.storage.removeFromSet('knownWords', word);
        await this.storage.addToSet('unknownWords', word);
        this.unknownWords.add(word);
        this.knownWords.delete(word);
        wordSpan.className = `mimic-word ${window.WORD_CLASSES[window.WORD_STATES.LEARNING]}`;
        break;
        
      case window.WORD_STATES.UNMARKED:
        // Remove from both
        await this.storage.removeFromSet('knownWords', word);
        await this.storage.removeFromSet('unknownWords', word);
        this.knownWords.delete(word);
        this.unknownWords.delete(word);
        wordSpan.className = `mimic-word ${window.WORD_CLASSES[window.WORD_STATES.UNMARKED]}`;
        break;
    }
    
    // Update all instances of this word
    this.updateAllWordInstances(word);
    
  }

  showWordMenu(wordSpan, event) {
    const word = wordSpan.dataset.word;
    if (!word) return;

    this.hideWordMenu();

    // ALWAYS pause video when menu opens (critical fix!)
    const video = document.querySelector('video');
    const wasPlaying = video && !video.paused;
    if (wasPlaying) {
      this.pauseVideo();
    }

    const menu = document.createElement('div');
    menu.className = 'subtitle-word-menu';
    
    // Track if mouse is over menu or word
    let isOverMenu = false;
    let closeTimer = null;
    
    const keepPaused = () => {
      if (video && wasPlaying) {
        this.pauseVideo();
      }
    };
    
    const scheduleResume = () => {
      closeTimer = setTimeout(() => {
        if (!isOverMenu && wasPlaying) {
          this.resumeVideo();
        }
      }, 200);
    };
    
    menu.addEventListener('mouseenter', () => {
      isOverMenu = true;
      if (closeTimer) clearTimeout(closeTimer);
      keepPaused();
    });
    
    menu.addEventListener('mouseleave', () => {
      isOverMenu = false;
      scheduleResume();
    });
    
    // Smart menu positioning - VIEWPORT AWARE
    const rect = wordSpan.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Responsive menu size
    const isMobile = viewportWidth < 576;
    const menuWidth = isMobile ? Math.min(200, viewportWidth - 20) : 240;
    const estimatedMenuHeight = isMobile ? 220 : 180; // Estimate with buttons
    
    // Calculate position - prefer above, fallback to below
    let menuX = rect.left + (rect.width / 2) - (menuWidth / 2);
    let menuY = rect.top - estimatedMenuHeight - 12;
    
    // Horizontal boundary check
    const padding = 10;
    if (menuX < padding) {
      menuX = padding;
    } else if (menuX + menuWidth > viewportWidth - padding) {
      menuX = viewportWidth - menuWidth - padding;
    }
    
    // Vertical boundary check - flip if doesn't fit above
    if (menuY < padding) {
      // Position below instead
      menuY = rect.bottom + 12;
      
      // If still doesn't fit, put it in the middle
      if (menuY + estimatedMenuHeight > viewportHeight - padding) {
        menuY = Math.max(padding, (viewportHeight - estimatedMenuHeight) / 2);
      }
    }
    
    menu.style.cssText = `
      left: ${menuX}px;
      top: ${menuY}px;
      max-height: ${viewportHeight - 2 * padding}px;
      overflow-y: auto;
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
      if (!menu.contains(e.target) && !wordSpan.contains(e.target)) {
        this.hideWordMenu();
        if (wasPlaying) {
          this.resumeVideo();
        }
        document.removeEventListener('click', handleClickOutside);
      }
    };
    
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 100);
    
    // Auto-hide after 10 seconds (only if mouse not over menu)
    const autoHideTimer = setTimeout(() => {
      if (this.currentMenu === menu && !isOverMenu) {
        this.hideWordMenu();
        if (wasPlaying) {
          this.resumeVideo();
        }
        document.removeEventListener('click', handleClickOutside);
      }
    }, 10000);
    
    this.menuTimeouts.push(autoHideTimer);
  }

  hideWordMenu() {
    if (this.currentMenu) {
      // Smooth fade out
      this.currentMenu.style.opacity = '0';
      this.currentMenu.style.transform = 'translateY(-8px) scale(0.95)';
      
      setTimeout(() => {
        if (this.currentMenu) {
          this.currentMenu.remove();
          this.currentMenu = null;
        }
      }, 150);
    }
    
    // Clear all timeouts
    this.menuTimeouts.forEach(timeout => clearTimeout(timeout));
    this.menuTimeouts = [];
  }

  async markAsKnown(word) {
    console.debug('[Action] markAsKnown invoked for', word);
    
    try {
      // ATOMIC OPERATION - Use moveToSet to prevent race conditions
      await this.storage.moveToSet('unknownWords', 'knownWords', word);

      // Update local sets
      this.knownWords.add(word);
      this.unknownWords.delete(word);
      
      // Update UI
      this.updateAllWordInstances(word);

      console.log('✅ Marked as known:', word);
    } catch (err) {
      console.error('❌ [ERROR] markAsKnown failed for', word, ':', err);
      console.error('Error stack:', err.stack);
    }
  }

  async markAsUnknown(word) {
    console.debug('[Action] markAsUnknown invoked for', word);
    
    try {
      // ATOMIC OPERATION - Use moveToSet to prevent race conditions
      await this.storage.moveToSet('knownWords', 'unknownWords', word);

      // Update local sets
      this.unknownWords.add(word);
      this.knownWords.delete(word);
      
      // Update UI
      this.updateAllWordInstances(word);

      console.log('📖 Marked as learning:', word);
    } catch (err) {
      console.error('❌ [ERROR] markAsUnknown failed for', word, ':', err);
      console.error('Error stack:', err.stack);
      alert(`ERROR: ${err.message}`); // ALERT for visibility
    }
  }

  async removeFromList(word) {
    console.debug('[Action] removeFromList invoked for', word);
    
    try {
      // Remove from both lists atomically in one operation
      const knownArray = Array.from(this.knownWords).filter(w => w !== word);
      const unknownArray = Array.from(this.unknownWords).filter(w => w !== word);
      
      await this.storage.set({
        knownWords: knownArray,
        unknownWords: unknownArray
      });

      // Update local sets
      this.knownWords.delete(word);
      this.unknownWords.delete(word);
      
      // Update UI
      this.updateAllWordInstances(word);

      console.log('🗑️ Removed from lists:', word);
    } catch (err) {
      console.error('❌ [ERROR] removeFromList failed for', word, ':', err);
    }
  }

  getWordStatus(word) {
    return window.getWordState(word, this.knownWords, this.unknownWords);
  }

  updateAllWordInstances(word) {
    // Update all instances of this word in all lines
    const allWords = this.mimicContainer.querySelectorAll(`.mimic-word[data-word="${word}"]`);
    const state = window.getWordState(word, this.knownWords, this.unknownWords);
    const className = window.WORD_CLASSES[state];
    
    console.debug('🔁 updateAllWordInstances:', {
      word,
      found: allWords.length,
      state,
      className,
      WORD_CLASSES: window.WORD_CLASSES
    });
    
    allWords.forEach((span, index) => {
      const oldClass = span.className;
      span.className = `mimic-word ${className}`;
      console.debug(`  [${index}] Updated:`, oldClass, '→', span.className, span);
    });
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
      },
      storage: {
        initialized: this.storage?.initialized,
        cacheKeys: this.storage?.cache ? Object.keys(this.storage.cache) : null
      }
    };
  }

  // Console command: window.perfectMimic.testWord('hello')
  async testWord(word) {
    console.log('🧪 Testing word:', word);
    console.log('Before:', {
      knownWords: Array.from(this.knownWords),
      unknownWords: Array.from(this.unknownWords)
    });
    
    await this.markAsKnown(word);
    
    console.log('After:', {
      knownWords: Array.from(this.knownWords),
      unknownWords: Array.from(this.unknownWords)
    });
    
    const dump = await this.storage.export();
    console.log('Storage:', dump);
    
    return dump;
  }

  toggle() {
    this.isActive = !this.isActive;
    this.mimicContainer.style.display = this.isActive ? 'flex' : 'none';
  }

  forceRescan() {
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
      console.log('🎬 YouTube detected, initializing Perfect Mimic...');
      
      window.perfectMimic = new PerfectMimicSubtitleSystem();
      
      // Await init to ensure everything is ready
      window.perfectMimic.init().then(() => {
        console.log('✅ Perfect Mimic fully initialized and ready!');
      }).catch(err => {
        console.error('❌ Perfect Mimic initialization failed:', err);
      });
      
      // Message listener is already set up in setupMessageHandler()
    } else {
      setTimeout(waitForYouTube, 500);
    }
  };
  
  waitForYouTube();
}
