// Translation Service with Caching
class TranslationService {
  constructor() {
    this.cache = new Map();
    this.pendingRequests = new Map();
    this.cacheExpiry = 7 * 24 * 60 * 60 * 1000; // 7 days
    this.maxCacheSize = 2000;
    this.apiEndpoint = 'https://translate.googleapis.com/translate_a/single';
    this.requestDelay = 300; // ms between requests
    this.lastRequestTime = 0;
    this.storageManager = window.storageManager; // Use centralized storage
  }

  static async create() {
    const instance = new TranslationService();
    await instance.loadCache();
    return instance;
  }

  async loadCache() {
    try {
      // Use storage manager instead of direct chrome.storage
      const data = await this.storageManager.get(['translationCache', 'cacheTimestamps']);
      
      const now = Date.now();
      const validCache = {};
      
      // Load and validate cache entries
      for (const [key, value] of Object.entries(data.translationCache || {})) {
        const timestamp = data.cacheTimestamps?.[key];
        if (timestamp && (now - timestamp) < this.cacheExpiry) {
          validCache[key] = value;
          this.cache.set(key, {
            translation: value,
            timestamp: timestamp
          });
        }
      }
      
      console.log(`✅ [TranslationService] Loaded ${this.cache.size} cached translations`);
    } catch (error) {
      console.error('❌ [TranslationService] Failed to load cache:', error);
    }
  }

  async saveCache() {
    try {
      // Limit cache size
      if (this.cache.size > this.maxCacheSize) {
        await this.pruneCache();
      }

      const cacheObj = {};
      const timestampObj = {};
      
      for (const [key, data] of this.cache.entries()) {
        cacheObj[key] = data.translation;
        timestampObj[key] = data.timestamp;
      }
      
      // Use storage manager for atomic save
      await this.storageManager.set({
        translationCache: cacheObj,
        cacheTimestamps: timestampObj
      });
      
      console.log(`💾 [TranslationService] Saved ${this.cache.size} translations to cache`);
    } catch (error) {
      console.error('❌ [TranslationService] Failed to save cache:', error);
    }
  }

  async pruneCache() {
    // Remove oldest entries
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const toRemove = entries.slice(0, Math.floor(this.maxCacheSize * 0.2));
    toRemove.forEach(([key]) => this.cache.delete(key));
    
    console.log(`Pruned ${toRemove.length} old cache entries`);
  }

  getCacheKey(text, sourceLang, targetLang) {
    return `${sourceLang}:${targetLang}:${text.toLowerCase().trim()}`;
  }

  async translate(text, sourceLang = 'en', targetLang = 'tr') {
    if (!text?.trim()) {
      return null;
    }

    const cleanText = text.trim();
    const cacheKey = this.getCacheKey(cleanText, sourceLang, targetLang);
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      return cached.translation;
    }

    // Check if request is already pending
    if (this.pendingRequests.has(cacheKey)) {
      return await this.pendingRequests.get(cacheKey);
    }

    // Create new request
    const requestPromise = this.fetchTranslation(cleanText, sourceLang, targetLang, cacheKey);
    this.pendingRequests.set(cacheKey, requestPromise);

    try {
      const result = await requestPromise;
      return result;
    } finally {
      this.pendingRequests.delete(cacheKey);
    }
  }

  async fetchTranslation(text, sourceLang, targetLang, cacheKey) {
    try {
      // Rate limiting
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      if (timeSinceLastRequest < this.requestDelay) {
        await this.delay(this.requestDelay - timeSinceLastRequest);
      }

      const params = new URLSearchParams({
        client: 'gtx',
        sl: sourceLang,
        tl: targetLang,
        dt: 't',
        q: text
      });

      this.lastRequestTime = Date.now();
      
      const response = await fetch(`${this.apiEndpoint}?${params}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Translation API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Parse Google Translate response
      // Format: [[[translated_text, original_text, ...]]]
      let translatedText = '';
      if (data?.[0]) {
        for (const item of data[0]) {
          if (item[0]) {
            translatedText += item[0];
          }
        }
      }

      if (!translatedText) {
        return null;
      }

      // Cache the result
      this.cache.set(cacheKey, {
        translation: translatedText,
        timestamp: Date.now()
      });

      // Save cache periodically (debounced)
      this.debounceSaveCache();

      return translatedText;

    } catch (error) {
      console.error('Translation failed:', error);
      return null;
    }
  }

  debounceSaveCache() {
    if (this.saveCacheTimeout) {
      clearTimeout(this.saveCacheTimeout);
    }
    this.saveCacheTimeout = setTimeout(() => {
      this.saveCache();
    }, 2000);
  }

  async translateBatch(words, sourceLang = 'en', targetLang = 'tr', onProgress = null) {
    const results = new Map();
    const wordsToTranslate = [];
    
    // Check cache for all words first
    for (const word of words) {
      const cacheKey = this.getCacheKey(word, sourceLang, targetLang);
      if (this.cache.has(cacheKey)) {
        results.set(word, this.cache.get(cacheKey).translation);
      } else {
        wordsToTranslate.push(word);
      }
    }

    // Translate remaining words with progress tracking
    for (let i = 0; i < wordsToTranslate.length; i++) {
      const word = wordsToTranslate[i];
      const translation = await this.translate(word, sourceLang, targetLang);
      
      if (translation) {
        results.set(word, translation);
      }

      if (onProgress) {
        onProgress(i + 1, wordsToTranslate.length);
      }

      // Small delay between batch translations
      if (i < wordsToTranslate.length - 1) {
        await this.delay(this.requestDelay);
      }
    }

    return results;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async clearCache() {
    this.cache.clear();
    // Use storage manager for atomic clear
    await this.storageManager.set({
      translationCache: {},
      cacheTimestamps: {}
    });
    console.log('🗑️ [TranslationService] Cache cleared');
  }

  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      expiryDays: this.cacheExpiry / (24 * 60 * 60 * 1000)
    };
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TranslationService;
}