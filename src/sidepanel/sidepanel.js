// XQuiz Side Panel Logic

class XQuizPanel {
  constructor() {
    this.currentQuiz = null;
    this.answered = false;

    this.elements = {
      notificationDot: document.getElementById('notification-dot'),
      settingsBtn: document.getElementById('settings-btn'),
      settingsModal: document.getElementById('settings-modal'),
      closeSettings: document.getElementById('close-settings'),
      saveSettings: document.getElementById('save-settings'),
      apiKeyInput: document.getElementById('gemini-api-key'),
      tweetsPerQuizSlider: document.getElementById('tweets-per-quiz'),
      tweetsValue: document.getElementById('tweets-value'),
      viewTimeSlider: document.getElementById('view-time-seconds'),
      viewTimeValue: document.getElementById('view-time-value'),
      resetStats: document.getElementById('reset-stats'),
      clearHistory: document.getElementById('clear-history'),
      shareBtn: document.getElementById('share-btn'),
      shareModal: document.getElementById('share-modal'),
      closeShare: document.getElementById('close-share'),
      shareLoading: document.getElementById('share-loading'),
      shareResult: document.getElementById('share-result'),
      shareError: document.getElementById('share-error'),
      shareErrorText: document.getElementById('share-error-text'),
      scorecardImage: document.getElementById('scorecard-image'),
      downloadScorecard: document.getElementById('download-scorecard'),
      postToX: document.getElementById('post-to-x'),
      retryShare: document.getElementById('retry-share'),
      score: document.getElementById('score'),
      streak: document.getElementById('streak'),
      accuracy: document.getElementById('accuracy'),
      emptyState: document.getElementById('empty-state'),
      quizCard: document.getElementById('quiz-card'),
      quizType: document.getElementById('quiz-type'),
      quizQuestion: document.getElementById('quiz-question'),
      optionsContainer: document.getElementById('options-container'),
      fillBlankContainer: document.getElementById('fill-blank-container'),
      fillBlankInput: document.getElementById('fill-blank-input'),
      submitFillBlank: document.getElementById('submit-fill-blank'),
      result: document.getElementById('result'),
      resultIcon: document.getElementById('result-icon'),
      resultText: document.getElementById('result-text'),
      explanation: document.getElementById('explanation'),
      nextBtn: document.getElementById('next-btn'),
      tweetCounter: document.getElementById('tweet-counter'),
      counterBar: document.getElementById('counter-bar'),
      tweetsSeen: document.getElementById('tweets-seen'),
      tweetsNeeded: document.getElementById('tweets-needed'),
      removeVideosToggle: document.getElementById('remove-videos-toggle'),
      historyList: document.getElementById('history-list'),
      clearQuizHistory: document.getElementById('clear-quiz-history')
    };

    this.tweetsPerQuiz = 5;
    this.history = [];
    this.init();
  }

  async safeMessage(message, fallback = null) {
    if (!chrome.runtime?.id) {
      console.warn('[XQuiz] Extension context invalidated. Skipping message:', message.type);
      return fallback;
    }
    try {
      const response = await chrome.runtime.sendMessage(message);
      return response ?? fallback;
    } catch (error) {
      console.warn(`[XQuiz] Failed to send message ${message.type}:`, error);
      return fallback;
    }
  }

  async init() {
    this.setupEventListeners();
    await this.loadSettings();
    await this.loadStats();
    await this.loadHistory();
    await this.checkForQuiz();
  }

  setupEventListeners() {
    // Settings modal
    this.elements.settingsBtn.addEventListener('click', () => this.openSettings());
    this.elements.closeSettings.addEventListener('click', () => this.closeSettings());
    this.elements.settingsModal.addEventListener('click', (e) => {
      if (e.target === this.elements.settingsModal) this.closeSettings();
    });

    // Settings controls
    this.elements.tweetsPerQuizSlider.addEventListener('input', (e) => {
      this.elements.tweetsValue.textContent = e.target.value;
    });
    if (this.elements.viewTimeSlider) {
      this.elements.viewTimeSlider.addEventListener('input', (e) => {
        this.elements.viewTimeValue.textContent = `${e.target.value}s`;
      });
    }
    this.elements.saveSettings.addEventListener('click', () => this.saveSettings());
    this.elements.resetStats.addEventListener('click', () => this.resetStats());
    this.elements.clearHistory.addEventListener('click', () => this.clearTweetHistory());
    if (this.elements.clearQuizHistory) {
      this.elements.clearQuizHistory.addEventListener('click', () => this.clearQuizHistory());
    }

    // Share modal
    this.elements.shareBtn.addEventListener('click', () => this.openShare());
    this.elements.closeShare.addEventListener('click', () => this.closeShare());
    this.elements.shareModal.addEventListener('click', (e) => {
      if (e.target === this.elements.shareModal) this.closeShare();
    });
    this.elements.downloadScorecard.addEventListener('click', () => this.downloadScorecard());
    this.elements.postToX.addEventListener('click', () => this.postToX());
    this.elements.retryShare.addEventListener('click', () => this.generateScorecard());

    // Fill blank submit
    this.elements.submitFillBlank.addEventListener('click', () => this.submitFillBlank());
    this.elements.fillBlankInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.submitFillBlank();
    });

    // Next question
    this.elements.nextBtn.addEventListener('click', () => this.nextQuestion());

    // Listen for messages from background
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'QUIZ_READY') {
        this.showNotification();
        this.updateTweetCounter(0, this.tweetsPerQuiz); // Reset counter
        // If no quiz currently displayed, fetch and show it
        if (!this.currentQuiz) {
          this.fetchAndDisplayQuiz();
        }
      } else if (message.type === 'TWEET_PROGRESS') {
        this.updateTweetCounter(message.current, message.total);
      } else if (message.type === 'QUIZ_ERROR') {
        this.showError(message.message || 'Unable to generate quiz. Check your settings.');
      }
    });
  }

  async loadSettings() {
    const response = await this.safeMessage({ type: 'GET_SETTINGS' }, {});
    if (!response) return;

    this.elements.apiKeyInput.value = response.apiKey || '';
    this.tweetsPerQuiz = response.tweetsPerQuiz || 5;
    if (this.elements.tweetsPerQuizSlider) {
      this.elements.tweetsPerQuizSlider.value = this.tweetsPerQuiz;
    }
    if (this.elements.tweetsValue) {
      this.elements.tweetsValue.textContent = this.tweetsPerQuiz;
    }
    if (this.elements.tweetsNeeded) {
      this.elements.tweetsNeeded.textContent = this.tweetsPerQuiz;
    }
    if (this.elements.viewTimeSlider) {
      const seconds = Math.round((response.viewTimeMs || 2000) / 1000);
      const clampedSeconds = Math.min(Math.max(seconds, 1), 6);
      this.elements.viewTimeSlider.value = clampedSeconds;
      this.elements.viewTimeValue.textContent = `${clampedSeconds}s`;
    }
    if (this.elements.removeVideosToggle) {
      this.elements.removeVideosToggle.checked = !!response.removeVideos;
    }
  }

  updateTweetCounter(current, total) {
    this.elements.tweetsSeen.textContent = current;
    this.elements.tweetsNeeded.textContent = total;
    const percentage = Math.min((current / total) * 100, 100);
    this.elements.counterBar.style.width = `${percentage}%`;

    // Show counter when collecting, hide when quiz is active
    if (this.currentQuiz) {
      this.elements.tweetCounter.classList.add('hidden');
    } else {
      this.elements.tweetCounter.classList.remove('hidden');
    }
  }

  async loadStats() {
    const fallbackStats = {
      totalQuestions: 0,
      correctAnswers: 0,
      currentStreak: 0,
      bestStreak: 0
    };
    const response = await this.safeMessage({ type: 'GET_STATS' }, { stats: fallbackStats });
    if (response?.stats) {
      this.updateStatsDisplay(response.stats);
    }
  }

  updateStatsDisplay(stats) {
    this.elements.score.textContent = `${stats.correctAnswers}/${stats.totalQuestions}`;
    this.elements.streak.textContent = stats.currentStreak;

    if (stats.totalQuestions > 0) {
      const accuracy = Math.round((stats.correctAnswers / stats.totalQuestions) * 100);
      this.elements.accuracy.textContent = `${accuracy}%`;
    } else {
      this.elements.accuracy.textContent = '--%';
    }

    // Add glow effect for high streak
    if (stats.currentStreak >= 3) {
      this.elements.streak.style.textShadow = '0 0 10px var(--accent)';
    } else {
      this.elements.streak.style.textShadow = 'none';
    }
  }

  async checkForQuiz() {
    await this.fetchAndDisplayQuiz();
  }

  async fetchAndDisplayQuiz() {
    const response = await this.safeMessage({ type: 'REQUEST_QUIZ' }, { quiz: null });
    if (response?.quiz) {
      this.displayQuiz(response.quiz);
      await this.loadHistory();
    } else if (response?.message) {
      const isWaitingMessage = /keep scrolling/i.test(response.message);
      this.showError(
        response.message,
        isWaitingMessage ? 'Keep scrolling' : 'Error'
      );
    }
  }

  showNotification() {
    this.elements.notificationDot.classList.remove('hidden');
  }

  hideNotification() {
    this.elements.notificationDot.classList.add('hidden');
  }

  displayQuiz(quiz) {
    if (quiz.error) {
      this.showError(quiz.error);
      return;
    }

    this.currentQuiz = quiz;
    this.answered = false;
    this.hideNotification();

    // Hide empty state and counter, show quiz
    this.elements.emptyState.classList.add('hidden');
    this.elements.tweetCounter.classList.add('hidden');
    this.elements.quizCard.classList.remove('hidden');
    this.elements.result.classList.add('hidden');

    // Set quiz type label
    const typeLabels = {
      'multiple_choice': 'Multiple Choice',
      'true_false': 'True or False',
      'fill_blank': 'Fill in the Blank'
    };
    this.elements.quizType.textContent = typeLabels[quiz.type] || quiz.type;

    // Set question
    this.elements.quizQuestion.textContent = quiz.question;

    // Clear previous options
    this.elements.optionsContainer.innerHTML = '';
    this.elements.fillBlankContainer.classList.add('hidden');
    this.elements.fillBlankInput.value = '';

    // Render based on type
    if (quiz.type === 'fill_blank') {
      this.elements.fillBlankContainer.classList.remove('hidden');
      this.elements.fillBlankInput.focus();
    } else {
      this.renderOptions(quiz.options);
    }
  }

  renderOptions(options) {
    options.forEach((option, index) => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.textContent = option;
      btn.addEventListener('click', () => this.selectOption(index, btn));
      this.elements.optionsContainer.appendChild(btn);
    });
  }

  async selectOption(index, btnElement) {
    if (this.answered) return;
    this.answered = true;

    const quiz = this.currentQuiz;
    let isCorrect = false;

    // Determine correct answer based on type
    if (quiz.type === 'multiple_choice') {
      const correctLetter = quiz.answer.toLowerCase().charAt(0);
      const selectedLetter = ['a', 'b', 'c', 'd'][index];
      isCorrect = selectedLetter === correctLetter;
    } else if (quiz.type === 'true_false') {
      const selectedAnswer = quiz.options[index].toLowerCase();
      isCorrect = selectedAnswer === quiz.answer.toLowerCase();
    }

    // Update button styles
    const allBtns = this.elements.optionsContainer.querySelectorAll('.option-btn');
    allBtns.forEach((btn, i) => {
      btn.disabled = true;
      if (quiz.type === 'multiple_choice') {
        const letter = ['a', 'b', 'c', 'd'][i];
        if (letter === quiz.answer.toLowerCase().charAt(0)) {
          btn.classList.add('reveal');
        }
      } else if (quiz.type === 'true_false') {
        if (quiz.options[i].toLowerCase() === quiz.answer.toLowerCase()) {
          btn.classList.add('reveal');
        }
      }
    });

    if (isCorrect) {
      btnElement.classList.add('correct');
    } else {
      btnElement.classList.add('incorrect');
    }

    await this.showResult(isCorrect);
  }

  async submitFillBlank() {
    if (this.answered) return;
    this.answered = true;

    const userAnswer = this.elements.fillBlankInput.value.trim().toLowerCase();
    const correctAnswer = this.currentQuiz.answer.toLowerCase();

    // Simple fuzzy match - check if answer contains the key word
    const isCorrect = userAnswer.includes(correctAnswer) ||
      correctAnswer.includes(userAnswer) ||
      this.levenshteinDistance(userAnswer, correctAnswer) <= 2;

    this.elements.fillBlankInput.disabled = true;
    this.elements.submitFillBlank.disabled = true;

    await this.showResult(isCorrect);
  }

  levenshteinDistance(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  async showResult(isCorrect) {
    // Update stats
    const response = await chrome.runtime.sendMessage({
      type: 'SUBMIT_ANSWER',
      isCorrect
    });
    this.updateStatsDisplay(response.stats);

    // Show result
    this.elements.result.classList.remove('hidden');
    this.elements.resultIcon.textContent = isCorrect ? '✓' : '✗';
    this.elements.resultIcon.style.color = isCorrect ? 'var(--success)' : 'var(--error)';
    this.elements.resultText.textContent = isCorrect ? 'Correct!' : 'Not quite';
    this.elements.resultText.className = `result-text ${isCorrect ? 'correct' : 'incorrect'}`;

    // Show explanation with correct answer
    let explanationText = this.currentQuiz.explanation;
    if (!isCorrect && this.currentQuiz.type === 'fill_blank') {
      explanationText = `The answer was: "${this.currentQuiz.answer}"\n\n${explanationText}`;
    }
    this.elements.explanation.textContent = explanationText;
  }

  async nextQuestion() {
    this.currentQuiz = null;
    this.answered = false;

    // Reset UI
    this.elements.quizCard.classList.add('hidden');
    this.elements.result.classList.add('hidden');
    this.elements.fillBlankInput.disabled = false;
    this.elements.submitFillBlank.disabled = false;

    // Check for next quiz from queue
    const response = await chrome.runtime.sendMessage({ type: 'REQUEST_QUIZ' });
    if (response.quiz) {
      this.displayQuiz(response.quiz);
    } else {
      // No more quizzes - show empty state and counter
      this.elements.emptyState.classList.remove('hidden');
      this.elements.tweetCounter.classList.remove('hidden');
      this.updateTweetCounter(0, this.tweetsPerQuiz);
    }
  }

  showError(message, title = 'Error') {
    this.elements.emptyState.classList.remove('hidden');
    this.elements.quizCard.classList.add('hidden');
    this.elements.emptyState.querySelector('.empty-text').textContent = title;
    this.elements.emptyState.querySelector('.empty-subtext').textContent = message;
  }

  openSettings() {
    this.elements.settingsModal.classList.remove('hidden');
  }

  closeSettings() {
    this.elements.settingsModal.classList.add('hidden');
  }

  async saveSettings() {
    const tweetsSetting = this.elements.tweetsPerQuizSlider
      ? parseInt(this.elements.tweetsPerQuizSlider.value, 10)
      : this.tweetsPerQuiz;
    const viewTimeSetting = this.elements.viewTimeSlider
      ? parseInt(this.elements.viewTimeSlider.value, 10) * 1000
      : 2000;

    await this.safeMessage({
      type: 'UPDATE_SETTINGS',
      apiKey: this.elements.apiKeyInput.value,
      tweetsPerQuiz: tweetsSetting,
      removeVideos: this.elements.removeVideosToggle?.checked || false,
      viewTimeMs: viewTimeSetting
    });
    this.closeSettings();
  }

  async resetStats() {
    if (confirm('Reset all stats? This cannot be undone.')) {
      const response = await this.safeMessage({ type: 'RESET_STATS' });
      if (response?.stats) {
        this.updateStatsDisplay(response.stats);
      }
      this.closeSettings();
    }
  }

  async clearTweetHistory() {
    if (confirm('Clear tweet history? You may see quizzes about tweets you\'ve already been tested on.')) {
      await this.safeMessage({ type: 'CLEAR_TWEET_HISTORY' });
      this.closeSettings();
    }
  }

  async loadHistory() {
    const response = await this.safeMessage({ type: 'GET_QUIZ_HISTORY' }, { history: [] });
    this.history = response?.history || [];
    this.renderHistory();
  }

  renderHistory() {
    if (!this.elements.historyList) return;
    this.elements.historyList.innerHTML = '';

    if (!this.history.length) {
      this.elements.historyList.innerHTML = '<p class="history-empty">No past questions yet.</p>';
      if (this.elements.clearQuizHistory) {
        this.elements.clearQuizHistory.disabled = true;
      }
      return;
    }

    if (this.elements.clearQuizHistory) {
      this.elements.clearQuizHistory.disabled = false;
    }

    const typeLabels = {
      'multiple_choice': 'Multiple Choice',
      'true_false': 'True/False',
      'fill_blank': 'Fill in the Blank'
    };

    this.history.forEach((entry) => {
      const item = document.createElement('div');
      item.className = 'history-item';

      const formattedDate = new Date(entry.timestamp).toLocaleString();
      const optionsText = Array.isArray(entry.options) ? entry.options.join(' • ') : null;

      const meta = document.createElement('div');
      meta.className = 'history-meta';

      const typeLabel = document.createElement('span');
      typeLabel.className = 'history-type';
      typeLabel.textContent = typeLabels[entry.type] || entry.type;

      const timeLabel = document.createElement('span');
      timeLabel.className = 'history-time';
      timeLabel.textContent = formattedDate;

      meta.appendChild(typeLabel);
      meta.appendChild(timeLabel);

      const question = document.createElement('p');
      question.className = 'history-question';
      question.textContent = entry.question;

      item.appendChild(meta);
      item.appendChild(question);

      if (optionsText) {
        const optionsEl = document.createElement('p');
        optionsEl.className = 'history-options';
        optionsEl.textContent = optionsText;
        item.appendChild(optionsEl);
      }

      const answer = document.createElement('p');
      answer.className = 'history-answer';
      answer.textContent = `Answer: ${entry.answer}`;
      item.appendChild(answer);

      this.elements.historyList.appendChild(item);
    });
  }

  async clearQuizHistory() {
    if (!this.history.length) {
      return;
    }

    if (confirm('Clear all saved quiz questions?')) {
      await this.safeMessage({ type: 'CLEAR_QUIZ_HISTORY' });
      await this.loadHistory();
    }
  }

  // Share functionality
  openShare() {
    this.elements.shareModal.classList.remove('hidden');
    this.generateScorecard();
  }

  closeShare() {
    this.elements.shareModal.classList.add('hidden');
  }

  async generateScorecard() {
    // Show loading briefly for effect
    this.elements.shareLoading.classList.remove('hidden');
    this.elements.shareResult.classList.add('hidden');
    this.elements.shareError.classList.add('hidden');

    // Get current stats
    const fallbackStats = {
      totalQuestions: 0,
      correctAnswers: 0,
      currentStreak: 0,
      bestStreak: 0
    };
    const response = await this.safeMessage({ type: 'GET_STATS' }, { stats: fallbackStats });
    const stats = response?.stats || fallbackStats;

    const accuracy = stats.totalQuestions > 0
      ? Math.round((stats.correctAnswers / stats.totalQuestions) * 100)
      : 0;

    // Generate scorecard with canvas
    try {
      const imageData = await this.createScorecardCanvas(accuracy, stats.currentStreak, stats.bestStreak);

      // Small delay for UX
      await new Promise(r => setTimeout(r, 500));

      this.elements.shareLoading.classList.add('hidden');
      this.elements.shareResult.classList.remove('hidden');
      this.elements.scorecardImage.src = imageData;
      this.currentScorecardData = imageData;
      this.currentStats = { accuracy, streak: stats.currentStreak };
    } catch (error) {
      this.elements.shareLoading.classList.add('hidden');
      this.elements.shareError.classList.remove('hidden');
      this.elements.shareErrorText.textContent = error.message;
    }
  }

  createScorecardCanvas(accuracy, streak, bestStreak) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // Card dimensions (2x for retina)
      const width = 600;
      const height = 400;
      canvas.width = width;
      canvas.height = height;

      // Background gradient
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, '#0a0a0a');
      gradient.addColorStop(1, '#141414');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Subtle grid pattern
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.03)';
      ctx.lineWidth = 1;
      for (let i = 0; i < width; i += 30) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, height);
        ctx.stroke();
      }
      for (let i = 0; i < height; i += 30) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(width, i);
        ctx.stroke();
      }

      // Accent glow in corner
      const glowGradient = ctx.createRadialGradient(width - 50, 50, 0, width - 50, 50, 200);
      glowGradient.addColorStop(0, 'rgba(59, 130, 246, 0.15)');
      glowGradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
      ctx.fillStyle = glowGradient;
      ctx.fillRect(0, 0, width, height);

      // XQuiz logo
      ctx.fillStyle = '#3b82f6';
      ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('XQuiz', 40, 50);

      // Tagline
      ctx.fillStyle = '#71717a';
      ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('Attention & Retention Tracker', 40, 75);

      // Main stats
      ctx.fillStyle = '#fafafa';
      ctx.font = 'bold 72px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`${accuracy}%`, 40, 180);

      ctx.fillStyle = '#71717a';
      ctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('RETENTION ACCURACY', 40, 210);

      // Streak with fire emoji effect
      ctx.fillStyle = '#fafafa';
      ctx.font = 'bold 48px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`${streak}`, 40, 290);

      ctx.fillStyle = '#f97316';
      ctx.font = '48px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('🔥', 40 + ctx.measureText(`${streak}`).width + 10, 290);

      ctx.fillStyle = '#71717a';
      ctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('CURRENT STREAK', 40, 320);

      // Best streak badge
      if (bestStreak > 0) {
        ctx.fillStyle = '#27272a';
        this.roundRect(ctx, width - 160, height - 70, 120, 40, 8);
        ctx.fill();

        ctx.fillStyle = '#71717a';
        ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('BEST', width - 145, height - 45);

        ctx.fillStyle = '#fafafa';
        ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(`${bestStreak} 🏆`, width - 100, height - 45);
      }

      // Border accent
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
      ctx.lineWidth = 2;
      this.roundRect(ctx, 1, 1, width - 2, height - 2, 12);
      ctx.stroke();

      // Bottom text
      ctx.fillStyle = '#52525b';
      ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('Testing attention on X/Twitter', 40, height - 30);

      resolve(canvas.toDataURL('image/png'));
    });
  }

  roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  downloadScorecard() {
    if (!this.currentScorecardData) return;

    const link = document.createElement('a');
    link.href = this.currentScorecardData;
    link.download = `xquiz-scorecard-${Date.now()}.png`;
    link.click();
  }

  async postToX() {
    const { accuracy, streak } = this.currentStats || { accuracy: 0, streak: 0 };

    const tweetText = `🧠 Testing my attention span on X with XQuiz!

📊 ${accuracy}% retention accuracy
🔥 ${streak} question streak

Are you actually reading your feed or just scrolling? Find out 👇`;

    // Try Web Share API with image first
    if (navigator.share && navigator.canShare && this.currentScorecardData) {
      try {
        // Convert base64 to blob
        const response = await fetch(this.currentScorecardData);
        const blob = await response.blob();
        const file = new File([blob], 'xquiz-scorecard.png', { type: 'image/png' });

        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            text: tweetText,
            files: [file]
          });
          return;
        }
      } catch (err) {
        console.log('[XQuiz] Web Share failed, falling back to intent URL:', err);
      }
    }

    // Fallback: Copy image to clipboard and open Twitter
    if (this.currentScorecardData) {
      try {
        const response = await fetch(this.currentScorecardData);
        const blob = await response.blob();
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        alert('Scorecard copied to clipboard! Paste it into your tweet.');
      } catch (err) {
        console.log('[XQuiz] Could not copy to clipboard:', err);
      }
    }

    // Open Twitter intent
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    window.open(tweetUrl, '_blank');
  }
}

// Initialize when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  new XQuizPanel();
});
