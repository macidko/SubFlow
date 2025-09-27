// IndexedDB Storage Manager for Subtitle Colorer
class StorageManager {
  constructor() {
    this.dbName = 'SubtitleColorerDB';
    this.dbVersion = 1;
    this.storeName = 'words';
    this.db = null;
  }

  async init() {
    try {
      await this.openDB();
      await this.migrateFromChromeStorage();
    } catch (error) {
      console.error('StorageManager initialization failed:', error);
      throw error;
    }
  }

  async openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create object store
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('word', 'word', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  async saveWord(word, type) {
    if (!this.db) await this.openDB();
    if (!word || typeof word !== 'string') return;
    
    const cleanWord = word.toLowerCase().trim();
    if (cleanWord.length < 2) return; // Skip very short words
    
    const transaction = this.db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    
    const wordData = {
      id: `${type}_${cleanWord}`,
      word: cleanWord,
      type: type, // 'known' or 'unknown'
      timestamp: Date.now()
    };
    
    // Save to IndexedDB
    await new Promise((resolve, reject) => {
      const request = store.put(wordData);
      request.onsuccess = () => resolve(wordData);
      request.onerror = () => reject(request.error);
    });
    
    // Also save to chrome.storage for popup access
    await this.syncToChromeStorage();
    
    return wordData;
  }

  async syncToChromeStorage() {
    try {
      const allWords = await this.getAllWords();
      await chrome.storage.local.set({
        knownWords: allWords.knownWords,
        unknownWords: allWords.unknownWords
      });
    } catch (error) {
      console.error('Failed to sync to chrome.storage:', error);
    }
  }

  // Batch save for better performance during import
  async saveWords(words, type) {
    if (!this.db) await this.openDB();
    if (!Array.isArray(words)) return;
    
    const transaction = this.db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);

    const uniqueWords = Array.from(new Set(words.map(word => word.toLowerCase().trim())));
    
    const promises = uniqueWords.map(cleanWord => {
      if (cleanWord.length < 2) return Promise.resolve();
      
      const wordData = {
        id: `${type}_${cleanWord}`,
        word: cleanWord,
        type: type,
        timestamp: Date.now()
      };
      
      return new Promise((resolve, reject) => {
        const request = store.put(wordData);
        request.onsuccess = () => resolve(wordData);
        request.onerror = () => reject(request.error);
      });
    });
    
    return Promise.all(promises);
  }

  async removeWord(word, type) {
    if (!this.db) await this.openDB();
    
    const transaction = this.db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.delete(`${type}_${word}`);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Add known word method
  async addKnownWord(word) {
    return this.saveWord(word, 'known');
  }

  // Add unknown word method  
  async addUnknownWord(word) {
    return this.saveWord(word, 'unknown');
  }

  async getWordsByType(type) {
    if (!this.db) await this.openDB();
    
    const transaction = this.db.transaction([this.storeName], 'readonly');
    const store = transaction.objectStore(this.storeName);
    const index = store.index('type');
    
    return new Promise((resolve, reject) => {
      const request = index.getAll(type);
      request.onsuccess = () => {
        const words = request.result.map(item => item.word);
        resolve(words);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getAllWords() {
    if (!this.db) await this.openDB();
    
    const [knownWords, unknownWords] = await Promise.all([
      this.getWordsByType('known'),
      this.getWordsByType('unknown')
    ]);
    
    return { knownWords, unknownWords };
  }

  async clearWordsByType(type) {
    if (!this.db) await this.openDB();
    
    const transaction = this.db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    const index = store.index('type');
    
    return new Promise((resolve, reject) => {
      const request = index.openCursor(type);
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async clearAll() {
    await this.clearWordsByType('known');
    await this.clearWordsByType('unknown');
    
    // Also clear chrome.storage
    await chrome.storage.local.set({
      knownWords: [],
      unknownWords: []
    });
  }

  async exportData() {
    try {
      const data = await this.getAllWords();
      return {
        knownWords: data.knownWords || [],
        unknownWords: data.unknownWords || [],
        exportDate: new Date().toISOString(),
        source: 'indexeddb',
        version: this.dbVersion
      };
    } catch (error) {
      console.error('Export data error:', error);
      throw new Error('Failed to export data from IndexedDB');
    }
  }

  async importData(importData) {
    try {
      if (!Array.isArray(importData.knownWords) || !Array.isArray(importData.unknownWords)) {
        throw new Error('Invalid import data format - arrays expected');
      }

      console.log(`Importing ${importData.knownWords.length} known words and ${importData.unknownWords.length} unknown words`);

      // Clear existing data first
      await this.clearWordsByType('known');
      await this.clearWordsByType('unknown');

      // Use batch operations for better performance
      const validKnownWords = importData.knownWords.filter(word => 
        typeof word === 'string' && word.trim().length >= 2
      );
      
      const validUnknownWords = importData.unknownWords.filter(word => 
        typeof word === 'string' && word.trim().length >= 2
      );

      await Promise.all([
        this.saveWords(validKnownWords, 'known'),
        this.saveWords(validUnknownWords, 'unknown')
      ]);

      console.log(`Import completed: ${validKnownWords.length} known, ${validUnknownWords.length} unknown words imported`);
    } catch (error) {
      console.error('Import data error:', error);
      throw new Error(`Failed to import data: ${error.message}`);
    }
  }

  // Migrate existing Chrome Storage data to IndexedDB (one-time)
  async migrateFromChromeStorage() {
    try {
      const data = await chrome.storage.local.get(['knownWords', 'unknownWords', 'migrated']);
      
      if (!data.migrated && data.knownWords && data.knownWords.length > 0) {
        console.log('Migrating existing data to IndexedDB...');
        
        for (const word of data.knownWords) {
          await this.saveWord(word.toLowerCase().trim(), 'known');
        }
        
        for (const word of data.unknownWords || []) {
          await this.saveWord(word.toLowerCase().trim(), 'unknown');
        }
        
        // Mark as migrated
        await chrome.storage.local.set({ migrated: true });
        console.log(`Migration completed: ${data.knownWords.length} known, ${(data.unknownWords || []).length} unknown words`);
      }
    } catch (error) {
      console.error('Migration failed:', error);
    }
  }

  // Get storage stats
  async getStats() {
    const data = await this.getAllWords();
    return {
      knownCount: data.knownWords.length,
      unknownCount: data.unknownWords.length,
      totalWords: data.knownWords.length + data.unknownWords.length
    };
  }
}