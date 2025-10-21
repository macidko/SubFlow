// 🎭 Perfect Mimic System - Main Entry Point
// Modular YouTube Subtitle DOM Cloning System

// Wait for all modules to load, then initialize
function waitForModules() {
  return new Promise((resolve) => {
    const check = () => {
      if (window.PerfectMimicSubtitleSystem && window.WordManager && window.MenuSystem && window.SubtitleUtils) {
        resolve();
      } else {
        setTimeout(check, 50);
      }
    };
    check();
  });
}

// Initialize the system
async function initPerfectMimic() {
  // Wait for all modules to load
  await waitForModules();

  const waitForYouTube = () => {
    if (window.location.hostname === 'www.youtube.com' && document.querySelector('#movie_player')) {
      console.log('🎬 YouTube detected, initializing Perfect Mimic...');

      // If an existing instance exists, destroy it to avoid leaks
      if (window.perfectMimic && typeof window.perfectMimic.destroy === 'function') {
        try { window.perfectMimic.destroy(); } catch (e) { console.warn('Error destroying previous PerfectMimic', e); }
      }

      window.perfectMimic = new window.PerfectMimicSubtitleSystem();

      // Extend with managers
      window.perfectMimic.wordManager = new window.WordManager(window.perfectMimic);
      window.perfectMimic.menuSystem = new window.MenuSystem(window.perfectMimic);

      // Override methods to use managers
      const originalSetupWordClickHandlers = window.perfectMimic.setupWordClickHandlers;
      window.perfectMimic.setupWordClickHandlers = function(mimicLine) {
        const wordSpans = mimicLine.querySelectorAll('.mimic-word');

        wordSpans.forEach(span => {
          // Attach back-reference to instance so handlers can resolve the correct system
          try { span.__perfectMimicInstance = this; } catch (e) { /* ignore */ }

          // Prefer the tracked listener helper when available
          if (typeof this._addTrackedListener === 'function') {
            this._addTrackedListener(span, 'click', function (e) {
              e.stopPropagation();
              console.debug('🖱️ mimic-word clicked (span.dataset.word):', this.dataset.word, this);
              (this.__perfectMimicInstance || window.perfectMimic)?.menuSystem?.showWordMenu(this, e);
            }.bind(span));

            if (this.pauseOnHover) {
              this._addTrackedListener(span, 'mouseenter', () => this.pauseVideo());
              this._addTrackedListener(span, 'mouseleave', () => this.resumeVideo());
            }
          } else {
            span.addEventListener('click', (e) => {
              e.stopPropagation();
              this.menuSystem.showWordMenu(span, e);
            });

            if (this.pauseOnHover) {
              span.addEventListener('mouseenter', () => this.pauseVideo());
              span.addEventListener('mouseleave', () => this.resumeVideo());
            }
          }
        });
      };

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

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initPerfectMimic());
} else {
  initPerfectMimic();
}
