// 🎭 Menu System - Word action popup menus

// Make class globally available
window.MenuSystem = class MenuSystem {
  constructor(subtitleSystem) {
    this.system = subtitleSystem;
    this.currentMenu = null;
    this.currentMenuClickHandler = null;
    this.menuTimeouts = [];
  }

  showWordMenu(wordSpan, event) {
    const word = wordSpan.dataset.word;
    if (!word) return;

    this.hideWordMenu();

    // ALWAYS pause video when menu opens (critical fix!)
    const video = document.querySelector('video');
    const wasPlaying = video && !video.paused;
    if (wasPlaying) {
      this.system.pauseVideo();
    }

    const menu = document.createElement('div');
    menu.className = 'subtitle-word-menu';

    // Track if mouse is over menu or word
    let isOverMenu = false;
    let closeTimer = null;

    const keepPaused = () => {
      if (video && wasPlaying) {
        this.system.pauseVideo();
      }
    };

    const scheduleResume = () => {
      closeTimer = setTimeout(() => {
        if (!isOverMenu && wasPlaying) {
          this.system.resumeVideo();
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

    const isKnown = this.system.knownWords.has(word);
    const isUnknown = this.system.unknownWords.has(word);

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

    console.log('🎭 Word menu created and added to DOM:', menu);
    console.log('Menu position:', menuX, menuY);
    console.log('Menu style:', menu.style.cssText);
    console.log('Viewport size:', viewportWidth, 'x', viewportHeight);
    console.log('Word rect:', rect);

    // Click outside handler
    const handleClickOutside = (e) => {
      if (!menu.contains(e.target) && !wordSpan.contains(e.target)) {
        this.hideWordMenu();
        if (wasPlaying) {
          this.system.resumeVideo();
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
          this.system.resumeVideo();
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
    const wordManager = new WordManager(this.system);
    await wordManager.markAsKnown(word);
  }

  async markAsUnknown(word) {
    const wordManager = new WordManager(this.system);
    await wordManager.markAsUnknown(word);
  }

  async removeFromList(word) {
    const wordManager = new window.WordManager(this.system);
    await wordManager.removeFromList(word);
  }
};