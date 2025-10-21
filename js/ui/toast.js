// Simple ToastManager for non-blocking notifications
(function () {
  class ToastManager {
    constructor() {
      this.container = this._createContainer();
    }

    _createContainer() {
      let container = document.getElementById('subflow-toast-container');
      if (container) return container;

      container = document.createElement('div');
      container.id = 'subflow-toast-container';
      container.style.cssText = `
        position: fixed;
        top: 18px;
        right: 18px;
        z-index: 2147483647;
        display: flex;
        flex-direction: column;
        gap: 10px;
        pointer-events: none;
      `;
      document.body.appendChild(container);
      return container;
    }

    show(message, type = 'info', duration = 3500) {
      const toast = document.createElement('div');
      toast.className = `subflow-toast subflow-toast-${type}`;
      toast.style.cssText = `
        pointer-events: auto;
        min-width: 260px;
        max-width: 420px;
        background: rgba(30,30,30,0.95);
        color: white;
        padding: 10px 14px;
        border-radius: 10px;
        display: flex;
        gap: 10px;
        align-items: center;
        box-shadow: 0 6px 20px rgba(0,0,0,0.4);
        transform: translateX(10px);
        opacity: 0;
        transition: transform 240ms ease, opacity 240ms ease;
      `;

      const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
      const icon = document.createElement('div');
      icon.textContent = icons[type] || icons.info;
      icon.style.cssText = 'font-size:18px; flex:0 0 auto;';

      const text = document.createElement('div');
      text.textContent = message;
      text.style.cssText = 'flex:1 1 auto; font-size:14px; line-height:1.2;';

      const close = document.createElement('button');
      close.textContent = '✕';
      close.style.cssText = `
        background: transparent;
        border: none;
        color: rgba(255,255,255,0.7);
        cursor: pointer;
        font-size: 14px;
        flex:0 0 auto;
      `;

      close.addEventListener('click', () => this._remove(toast));

      toast.appendChild(icon);
      toast.appendChild(text);
      toast.appendChild(close);

      this.container.appendChild(toast);

      // Force layout
      requestAnimationFrame(() => {
        toast.style.transform = 'translateX(0)';
        toast.style.opacity = '1';
      });

      if (duration > 0) {
        setTimeout(() => this._remove(toast), duration);
      }
    }

    _remove(toast) {
      toast.style.transform = 'translateX(10px)';
      toast.style.opacity = '0';
      setTimeout(() => {
        try { toast.remove(); } catch (e) { /* ignore */ }
      }, 260);
    }

    success(msg, d) { this.show(msg, 'success', d); }
    error(msg, d) { this.show(msg, 'error', d); }
    info(msg, d) { this.show(msg, 'info', d); }
    warning(msg, d) { this.show(msg, 'warning', d); }
    
    // Non-blocking confirmation dialog — returns a Promise<boolean>
    confirmAsync(message, opts = { confirmText: 'Evet', cancelText: 'Hayır', duration: 0 }) {
      return new Promise((resolve) => {
        const toast = document.createElement('div');
        toast.className = 'subflow-toast subflow-toast-confirm';
        toast.style.cssText = `
          pointer-events: auto;
          min-width: 320px;
          max-width: 520px;
          background: rgba(30,30,30,0.96);
          color: white;
          padding: 12px 14px;
          border-radius: 10px;
          display: flex;
          gap: 12px;
          align-items: center;
          box-shadow: 0 6px 20px rgba(0,0,0,0.4);
        `;

        const text = document.createElement('div');
        text.textContent = message;
        text.style.cssText = 'flex:1 1 auto; font-size:14px; line-height:1.2;';

        const buttons = document.createElement('div');
        buttons.style.cssText = 'display:flex; gap:8px;';

        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = opts.confirmText || 'Yes';
        confirmBtn.style.cssText = 'background:#10b981;color:white;border:none;padding:6px 10px;border-radius:6px;cursor:pointer;';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = opts.cancelText || 'No';
        cancelBtn.style.cssText = 'background:transparent;color:white;border:1px solid rgba(255,255,255,0.12);padding:6px 10px;border-radius:6px;cursor:pointer;';

        confirmBtn.addEventListener('click', () => {
          this._remove(toast);
          resolve(true);
        });

        cancelBtn.addEventListener('click', () => {
          this._remove(toast);
          resolve(false);
        });

        buttons.appendChild(confirmBtn);
        buttons.appendChild(cancelBtn);

        toast.appendChild(text);
        toast.appendChild(buttons);

        this.container.appendChild(toast);

        requestAnimationFrame(() => {
          toast.style.transform = 'translateX(0)';
          toast.style.opacity = '1';
        });
      });
    }
  }

  // Expose global instance
  window.toast = window.toast || new ToastManager();

})();
