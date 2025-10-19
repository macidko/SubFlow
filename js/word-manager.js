// 🎭 Word Manager - Word state management and actions

// Make class globally available
window.WordManager = class WordManager {
  constructor(subtitleSystem) {
    this.system = subtitleSystem;
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
    const currentState = window.getWordState(word, this.system.knownWords, this.system.unknownWords);
    const nextState = window.getNextWordState(currentState);


    // Update state using storage manager (prevents race conditions!)
    switch (nextState) {
      case window.WORD_STATES.KNOWN:
        // Move to known
        await this.system.storage.removeFromSet('unknownWords', word);
        await this.system.storage.addToSet('knownWords', word);
        this.system.knownWords.add(word);
        this.system.unknownWords.delete(word);
        wordSpan.className = `mimic-word ${window.WORD_CLASSES[window.WORD_STATES.KNOWN]}`;
        break;

      case window.WORD_STATES.LEARNING:
        // Move to learning
        await this.system.storage.removeFromSet('knownWords', word);
        await this.system.storage.addToSet('unknownWords', word);
        this.system.unknownWords.add(word);
        this.system.knownWords.delete(word);
        wordSpan.className = `mimic-word ${window.WORD_CLASSES[window.WORD_STATES.LEARNING]}`;
        break;

      case window.WORD_STATES.UNMARKED:
        // Remove from both
        await this.system.storage.removeFromSet('knownWords', word);
        await this.system.storage.removeFromSet('unknownWords', word);
        this.system.knownWords.delete(word);
        this.system.unknownWords.delete(word);
        wordSpan.className = `mimic-word ${window.WORD_CLASSES[window.WORD_STATES.UNMARKED]}`;
        break;
    }

    // Update all instances of this word
    this.updateAllWordInstances(word);

  }

  async markAsKnown(word) {
    console.debug('[Action] markAsKnown invoked for', word);

    try {
      // ATOMIC OPERATION - Use moveToSet to prevent race conditions
      await this.system.storage.moveToSet('unknownWords', 'knownWords', word);

      // Update local sets
      this.system.knownWords.add(word);
      this.system.unknownWords.delete(word);

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
      await this.system.storage.moveToSet('knownWords', 'unknownWords', word);

      // Update local sets
      this.system.unknownWords.add(word);
      this.system.knownWords.delete(word);

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
      const knownArray = Array.from(this.system.knownWords).filter(w => w !== word);
      const unknownArray = Array.from(this.system.unknownWords).filter(w => w !== word);

      await this.system.storage.set({
        knownWords: knownArray,
        unknownWords: unknownArray
      });

      // Update local sets
      this.system.knownWords.delete(word);
      this.system.unknownWords.delete(word);

      // Update UI
      this.updateAllWordInstances(word);

      console.log('🗑️ Removed from lists:', word);
    } catch (err) {
      console.error('❌ [ERROR] removeFromList failed for', word, ':', err);
    }
  }

  getWordStatus(word) {
    return window.getWordState(word, this.system.knownWords, this.system.unknownWords);
  }

  updateAllWordInstances(word) {
    // Update all instances of this word in all lines
    const allWords = this.system.mimicContainer.querySelectorAll(`.mimic-word[data-word="${word}"]`);
    const state = window.getWordState(word, this.system.knownWords, this.system.unknownWords);
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
};