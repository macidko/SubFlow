// Chrome Extension Storage Manager for Subtitle Colorer
// Pure Chrome Storage - NO IndexedDB
class StorageManager {
  constructor() {
    // Pure chrome.storage implementation
    this.storageKey = 'subtitleColorer';
  }

  async init() {
    // No initialization needed for chrome.storage
    console.log('StorageManager: Using Chrome Extension Storage');
  }

  async saveWord(word, type) {
    if (!word || typeof word !== 'string') return;
    
    const cleanWord = word.toLowerCase().trim();
    if (cleanWord.length < 2) return;
    
    const data = await chrome.storage.local.get({
      knownWords: [],
      unknownWords: []
    });
    
    const knownWords = new Set(data.knownWords || []);
    const unknownWords = new Set(data.unknownWords || []);
    
    if (type === 'known') {
      knownWords.add(cleanWord);
      unknownWords.delete(cleanWord);
    } else if (type === 'unknown') {
      unknownWords.add(cleanWord);
      knownWords.delete(cleanWord);
    }
    
    await chrome.storage.local.set({
      knownWords: Array.from(knownWords),
      unknownWords: Array.from(unknownWords)
    });
    
    return { word: cleanWord, type };
  }

  async removeWord(word, type) {
    if (!word || typeof word !== 'string') return;
    
    const cleanWord = word.toLowerCase().trim();
    if (!cleanWord) return;
    
    const data = await chrome.storage.local.get({
      knownWords: [],
      unknownWords: []
    });
    
    const knownWords = new Set(data.knownWords || []);
    const unknownWords = new Set(data.unknownWords || []);
    
    if (type === 'known' || !type) {
      knownWords.delete(cleanWord);
    }
    if (type === 'unknown' || !type) {
      unknownWords.delete(cleanWord);
    }
    
    await chrome.storage.local.set({
      knownWords: Array.from(knownWords),
      unknownWords: Array.from(unknownWords)
    });
  }

  async addKnownWord(word) {
    return this.saveWord(word, 'known');
  }

  async addUnknownWord(word) {
    return this.saveWord(word, 'unknown');
  }

  async getAllWords() {
    const data = await chrome.storage.local.get({
      knownWords: [],
      unknownWords: []
    });
    
    return {
      knownWords: data.knownWords || [],
      unknownWords: data.unknownWords || []
    };
  }

  async getWordsByType(type) {
    const data = await chrome.storage.local.get({
      knownWords: [],
      unknownWords: []
    });
    
    if (type === 'known') {
      return data.knownWords || [];
    } else if (type === 'unknown') {
      return data.unknownWords || [];
    }
    
    return [];
  }

  async clearAll() {
    await chrome.storage.local.set({
      knownWords: [],
      unknownWords: []
    });
  }

  async clearWordsByType(type) {
    const data = await chrome.storage.local.get({
      knownWords: [],
      unknownWords: []
    });
    
    if (type === 'known') {
      await chrome.storage.local.set({
        knownWords: [],
        unknownWords: data.unknownWords || []
      });
    } else if (type === 'unknown') {
      await chrome.storage.local.set({
        knownWords: data.knownWords || [],
        unknownWords: []
      });
    }
  }

  async saveWords(words, type) {
    if (!Array.isArray(words)) return;
    
    const cleanWords = words
      .map(word => typeof word === 'string' ? word.toLowerCase().trim() : '')
      .filter(word => word.length >= 2);
    
    const data = await chrome.storage.local.get({
      knownWords: [],
      unknownWords: []
    });
    
    const knownWords = new Set(data.knownWords || []);
    const unknownWords = new Set(data.unknownWords || []);
    
    if (type === 'known') {
      cleanWords.forEach(word => {
        knownWords.add(word);
        unknownWords.delete(word);
      });
    } else if (type === 'unknown') {
      cleanWords.forEach(word => {
        unknownWords.add(word);
        knownWords.delete(word);
      });
    }
    
    await chrome.storage.local.set({
      knownWords: Array.from(knownWords),
      unknownWords: Array.from(unknownWords)
    });
    
    return cleanWords;
  }

  async exportData() {
    const data = await this.getAllWords();
    return {
      knownWords: data.knownWords || [],
      unknownWords: data.unknownWords || [],
      exportDate: new Date().toISOString(),
      source: 'chrome-storage',
      version: '2.0'
    };
  }

  async importData(importData) {
    try {
      if (!importData || typeof importData !== 'object') {
        throw new Error('Invalid import data format');
      }

      const knownWords = Array.isArray(importData.knownWords) ? importData.knownWords : [];
      const unknownWords = Array.isArray(importData.unknownWords) ? importData.unknownWords : [];

      console.log(`Importing ${knownWords.length} known words and ${unknownWords.length} unknown words`);

      // Clear existing data first
      await this.clearAll();

      // Filter valid words
      const validKnownWords = knownWords.filter(word => 
        typeof word === 'string' && word.trim().length >= 2
      );
      
      const validUnknownWords = unknownWords.filter(word => 
        typeof word === 'string' && word.trim().length >= 2
      );

      // Save the imported words
      await chrome.storage.local.set({
        knownWords: validKnownWords,
        unknownWords: validUnknownWords
      });

      console.log(`Import completed: ${validKnownWords.length} known, ${validUnknownWords.length} unknown words imported`);
    } catch (error) {
      console.error('Import data error:', error);
      throw new Error(`Failed to import data: ${error.message}`);
    }
  }

  async getStats() {
    const data = await this.getAllWords();
    return {
      knownCount: data.knownWords.length,
      unknownCount: data.unknownWords.length,
      totalWords: data.knownWords.length + data.unknownWords.length
    };
  }
}

// Export for use in other files if needed
if (typeof window !== 'undefined') {
  window.StorageManager = StorageManager;
}