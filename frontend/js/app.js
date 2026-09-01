// CUET BMES Quiz Competition - Main Game Engine
const API_BASE = window.location.origin;

class QuizApp {
  constructor() {
    this.config = {
      competition_title: "CUET BMES 2-Minute Blitz Quiz",
      quiz_duration: 120,
      positive_points: 4,
      negative_points: 1,
      allow_negative: true,
      allow_retakes: false
    };

    this.session = null;
    this.questions = [];
    this.currentIndex = 0;
    this.timeLimit = 120;
    this.timeRemaining = 120;
    this.timerId = null;
    this.startTime = null;
    this.questionStartTime = null;
    this.isSubmitting = false;

    this.stats = {
      score: 0,
      correct: 0,
      incorrect: 0,
      totalAnswered: 0,
      currentStreak: 0,
      maxStreak: 0
    };

    this.hasTriggered60Alarm = false;

    this.leaderboardData = [];
    this.leaderboardInterval = null;

    this.init();
  }

  async init() {
    await this.fetchConfig();
    this.bindEvents();
    this.updateSoundButtonUI();
  }

  async fetchConfig() {
    try {
      const res = await fetch(`${API_BASE}/api/config`);
      if (res.ok) {
        this.config = await res.json();
        this.timeLimit = this.config.quiz_duration;
        this.timeRemaining = this.config.quiz_duration;
        document.querySelectorAll('.conf-title').forEach(el => el.textContent = this.config.competition_title);
        const durationText = this.config.quiz_duration >= 60 
          ? `${(this.config.quiz_duration / 60).toFixed(1).replace('.0', '')} Minutes (${this.config.quiz_duration}s)`
          : `${this.config.quiz_duration}s`;
        document.querySelectorAll('.conf-duration').forEach(el => el.textContent = durationText);
        document.querySelectorAll('.conf-points').forEach(el => el.textContent = `+${this.config.positive_points}`);
        document.querySelectorAll('.conf-neg').forEach(el => el.textContent = this.config.allow_negative ? `-${this.config.negative_points}` : '0');
      }
    } catch (e) {
      console.warn("Failed to fetch server config:", e);
    }
  }

  bindEvents() {
    // Sound Toggle
    const soundBtn = document.getElementById('btn-toggle-sound');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        const enabled = window.SFX.toggleSound();
        this.updateSoundButtonUI();
        if (enabled) window.SFX.playClick();
      });
    }

    // Navigation Links
    document.getElementById('nav-home')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.switchView('view-register');
    });

    document.getElementById('nav-leaderboard')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.switchView('view-leaderboard');
      this.loadLeaderboard();
    });

    document.getElementById('btn-hero-leaderboard')?.addEventListener('click', () => {
      this.switchView('view-leaderboard');
      this.loadLeaderboard();
    });

    // Rules Modal
    document.getElementById('btn-rules')?.addEventListener('click', () => this.showModal('modal-rules'));
    document.getElementById('btn-close-rules')?.addEventListener('click', () => this.hideModal('modal-rules'));

    // QR Code Modal
    document.getElementById('btn-show-qr')?.addEventListener('click', () => this.showModal('modal-qr'));
    document.getElementById('btn-close-qr')?.addEventListener('click', () => this.hideModal('modal-qr'));

    // Registration Form
    const regForm = document.getElementById('form-register');
    if (regForm) {
      regForm.addEventListener('submit', (e) => {
        e.preventDefault();
        window.SFX.playClick();
        this.handleRegistration();
      });
    }

    // Start Quiz Button in Instructions
    document.getElementById('btn-start-blitz')?.addEventListener('click', () => {
      window.SFX.playClick();
      this.beginQuiz();
    });

    // Skip Question Button
    document.getElementById('btn-skip-q')?.addEventListener('click', () => {
      this.handleAnswer('SKIP');
    });

    // Leave / Exit Quiz Buttons
    document.getElementById('btn-leave-quiz-top')?.addEventListener('click', () => {
      window.SFX.playClick();
      this.showModal('modal-confirm-exit');
    });

    document.getElementById('btn-leave-quiz-bottom')?.addEventListener('click', () => {
      window.SFX.playClick();
      this.showModal('modal-confirm-exit');
    });

    // Exit Modal Actions
    document.getElementById('btn-exit-submit')?.addEventListener('click', () => {
      window.SFX.playClick();
      this.hideModal('modal-confirm-exit');
      this.finishQuiz();
    });

    document.getElementById('btn-exit-discard')?.addEventListener('click', () => {
      window.SFX.playClick();
      this.hideModal('modal-confirm-exit');
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }
      this.switchView('view-register');
    });

    document.getElementById('btn-exit-cancel')?.addEventListener('click', () => {
      window.SFX.playClick();
      this.hideModal('modal-confirm-exit');
    });

    // 60+ Questions Milestone Alarm Actions
    document.getElementById('btn-alarm-submit-now')?.addEventListener('click', () => {
      document.getElementById('modal-60-alarm')?.classList.add('hidden');
      window.SFX.playClick();
      this.finishQuiz(false);
    });

    document.getElementById('btn-alarm-continue')?.addEventListener('click', () => {
      document.getElementById('modal-60-alarm')?.classList.add('hidden');
      window.SFX.playClick();
    });

    // Results Actions
    document.getElementById('btn-download-cert')?.addEventListener('click', () => {
      window.SFX.playClick();
      this.generateCertificate();
    });

    document.getElementById('btn-view-ranks-result')?.addEventListener('click', () => {
      this.switchView('view-leaderboard');
      this.loadLeaderboard();
    });

    document.getElementById('btn-play-again')?.addEventListener('click', () => {
      this.switchView('view-register');
    });

    // Leaderboard Search
    document.getElementById('search-leaderboard')?.addEventListener('input', (e) => {
      this.renderLeaderboardViews(e.target.value);
    });

    // Leaderboard Sort Change
    document.getElementById('sort-leaderboard')?.addEventListener('change', () => {
      const q = document.getElementById('search-leaderboard')?.value || '';
      this.renderLeaderboardViews(q);
    });

    // Leaderboard Refresh
    document.getElementById('btn-refresh-leaderboard')?.addEventListener('click', () => {
      window.SFX.playClick();
      this.loadLeaderboard();
    });

    // Keyboard Shortcuts (1-4, A-D, Space) with dynamic display mapping
    window.addEventListener('keydown', (e) => {
      const activeView = document.querySelector('.app-view:not(.hidden)');
      if (!activeView || activeView.id !== 'view-quiz' || this.isSubmitting) return;

      const key = e.key.toUpperCase();
      let targetDisplay = null;
      if (['1', 'A'].includes(key)) targetDisplay = 'A';
      else if (['2', 'B'].includes(key)) targetDisplay = 'B';
      else if (['3', 'C'].includes(key)) targetDisplay = 'C';
      else if (['4', 'D'].includes(key)) targetDisplay = 'D';
      else if (e.code === 'Space') {
        e.preventDefault();
        this.handleAnswer('SKIP');
        return;
      }

      if (targetDisplay && this.currentRenderedOptions) {
        const matched = this.currentRenderedOptions.find(o => o.displayKey === targetDisplay);
        if (matched) {
          const btn = document.querySelector(`[data-display-key="${targetDisplay}"]`);
          this.handleAnswer(matched.originalKey, btn);
        }
      }
    });

    // Anti-Cheat Tab-Switch & Focus Monitor
    document.addEventListener('visibilitychange', () => {
      const activeView = document.querySelector('.app-view:not(.hidden)');
      if (activeView && activeView.id === 'view-quiz' && document.hidden) {
        this.tabSwitchCount = (this.tabSwitchCount || 0) + 1;
        console.warn(`[Anti-Cheat Monitor] Tab switch #${this.tabSwitchCount} detected.`);
      }
    });
  }

  updateSoundButtonUI() {
    const soundBtn = document.getElementById('btn-toggle-sound');
    if (!soundBtn) return;
    const isMuted = !window.SFX.enabled;
    soundBtn.innerHTML = isMuted 
      ? `<i data-lucide="volume-x" class="w-5 h-5 text-rose-400"></i><span class="hidden sm:inline text-xs text-rose-300">Muted</span>`
      : `<i data-lucide="volume-2" class="w-5 h-5 text-cyan-400"></i><span class="hidden sm:inline text-xs text-cyan-300">Sound ON</span>`;
    if (window.lucide) lucide.createIcons();
  }

  switchView(viewId) {
    document.querySelectorAll('.app-view').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById(viewId);
    if (target) {
      target.classList.remove('hidden');
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (window.lucide) lucide.createIcons();

    // Auto-refresh leaderboard only when on leaderboard view
    if (viewId === 'view-leaderboard') {
      if (!this.leaderboardInterval) {
        this.leaderboardInterval = setInterval(() => this.loadLeaderboard(true), 8000);
      }
    } else {
      if (this.leaderboardInterval) {
        clearInterval(this.leaderboardInterval);
        this.leaderboardInterval = null;
      }
    }
  }

  showModal(modalId) {
    document.getElementById(modalId)?.classList.remove('hidden');
  }

  hideModal(modalId) {
    document.getElementById(modalId)?.classList.add('hidden');
  }

  async handleRegistration() {
    const nameInput = document.getElementById('reg-name');
    const idInput = document.getElementById('reg-id');
    const deptInput = document.getElementById('reg-dept');
    const batchInput = document.getElementById('reg-batch');
    const emailInput = document.getElementById('reg-email');
    const phoneInput = document.getElementById('reg-phone');
    const errorEl = document.getElementById('reg-error');

    errorEl.classList.add('hidden');

    const payload = {
      name: nameInput.value.trim(),
      student_id: idInput.value.trim(),
      department: deptInput.value.trim() || 'BME',
      batch: batchInput.value.trim(),
      email: emailInput.value.trim(),
      phone: phoneInput.value.trim()
    };

    if (!payload.name || !payload.student_id) {
      errorEl.textContent = "Please provide your Full Name and Student ID.";
      errorEl.classList.remove('hidden');
      return;
    }

    const btn = document.getElementById('btn-submit-reg');
    btn.disabled = true;
    btn.innerHTML = `<span class="inline-block animate-spin mr-2">⏳</span> Initializing...`;

    try {
      const res = await fetch(`${API_BASE}/api/quiz/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Registration failed. Please check details.");
      }

      this.session = data;
      this.timeLimit = data.time_limit_seconds;
      this.timeRemaining = data.time_limit_seconds;

      // Update instructions info
      document.getElementById('inst-name').textContent = data.participant_name;
      document.getElementById('inst-id').textContent = data.student_id;
      const durationFormatted = data.time_limit_seconds >= 60 
        ? `${(data.time_limit_seconds / 60).toFixed(1).replace('.0', '')} Minutes (${data.time_limit_seconds}s)`
        : `${data.time_limit_seconds} Seconds`;
      document.getElementById('inst-duration').textContent = durationFormatted;
      document.getElementById('inst-pos').textContent = `+${data.positive_points}`;
      document.getElementById('inst-neg').textContent = data.allow_negative ? `-${data.negative_points}` : '0';
      document.getElementById('inst-total-q').textContent = data.total_available_questions;

      this.switchView('view-instructions');
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `Continue to Quiz <i data-lucide="arrow-right" class="w-5 h-5 ml-1 inline"></i>`;
      if (window.lucide) lucide.createIcons();
    }
  }

  async beginQuiz() {
    // Fetch randomized questions for session
    try {
      const res = await fetch(`${API_BASE}/api/quiz/questions/${this.session.session_id}`);
      if (!res.ok) throw new Error("Could not load questions.");
      this.questions = await res.json();
    } catch (e) {
      alert("Error loading questions: " + e.message);
      return;
    }

    if (!this.questions.length) {
      alert("No questions available in question bank!");
      return;
    }

    // Randomize question sequence for this participant
    this.questions = this.shuffleArray(this.questions);

    // Reset game state
    this.currentIndex = 0;
    this.timeRemaining = this.timeLimit;
    this.stats = {
      score: 0,
      correct: 0,
      incorrect: 0,
      totalAnswered: 0,
      currentStreak: 0,
      maxStreak: 0
    };
    this.hasTriggered60Alarm = false;
    this.isSubmitting = false;
    document.getElementById('modal-60-alarm')?.classList.add('hidden');

    this.switchView('view-quiz');
    this.updateStatsUI();
    this.renderCurrentQuestion();
    this.startTimer();
  }

  startTimer() {
    this.startTime = performance.now();
    const timerMain = document.getElementById('timer-display-main');
    const timerCircle = document.getElementById('timer-progress-circle');
    const linearProgress = document.getElementById('top-linear-progress-bar');
    const circumference = 2 * Math.PI * 40; // r = 40 in SVG

    if (timerCircle) {
      timerCircle.style.strokeDasharray = `${circumference} ${circumference}`;
      timerCircle.style.strokeDashoffset = 0;
    }

    if (this.timerId) clearInterval(this.timerId);

    let lastTickSecond = this.timeLimit;

    this.timerId = setInterval(() => {
      const elapsed = (performance.now() - this.startTime) / 1000;
      this.timeRemaining = Math.max(0, this.timeLimit - elapsed);

      const secondsFloor = Math.ceil(this.timeRemaining);
      const mins = Math.floor(secondsFloor / 60);
      const secs = secondsFloor % 60;
      const formattedPad = `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;

      if (timerMain) {
        timerMain.textContent = formattedPad;
      }

      // Update Linear Progress Bar Width
      const pct = Math.max(0, Math.min(100, (this.timeRemaining / this.timeLimit) * 100));
      if (linearProgress) {
        linearProgress.style.width = `${pct}%`;
      }

      // Update SVG Circular Progress & Alert States
      if (timerCircle) {
        const offset = circumference - (this.timeRemaining / this.timeLimit) * circumference;
        timerCircle.style.strokeDashoffset = offset;

        if (this.timeRemaining <= 10) {
          timerCircle.setAttribute('stroke', '#f43f5e'); // red
          timerMain?.classList.remove('warning');
          timerMain?.classList.add('urgent');
          linearProgress?.classList.remove('warning');
          linearProgress?.classList.add('urgent');
          if (secondsFloor !== lastTickSecond) {
            window.SFX.playUrgentTick();
            lastTickSecond = secondsFloor;
          }
        } else if (this.timeRemaining <= 30) {
          timerCircle.setAttribute('stroke', '#f59e0b'); // amber
          timerMain?.classList.remove('urgent');
          timerMain?.classList.add('warning');
          linearProgress?.classList.remove('urgent');
          linearProgress?.classList.add('warning');
        } else {
          timerCircle.setAttribute('stroke', '#06b6d4'); // cyan
          timerMain?.classList.remove('warning', 'urgent');
          linearProgress?.classList.remove('warning', 'urgent');
        }
      }

      if (this.timeRemaining <= 0) {
        clearInterval(this.timerId);
        this.timerId = null;
        window.SFX.playTimeUp();
        this.finishQuiz();
      }
    }, 50);
  }

  renderCurrentQuestion() {
    if (this.currentIndex >= this.questions.length) {
      // Cycled through all questions, loop with fresh shuffle
      this.currentIndex = 0;
      this.questions = this.shuffleArray(this.questions);
    }

    const q = this.questions[this.currentIndex];
    this.questionStartTime = performance.now();

    document.getElementById('q-counter').textContent = `Q# ${this.stats.totalAnswered + 1}`;
    document.getElementById('q-category').textContent = q.category || 'Biomedical';
    document.getElementById('q-difficulty').textContent = q.difficulty || 'Medium';
    document.getElementById('q-text').textContent = q.question_text;

    const optionsContainer = document.getElementById('q-options-container');
    optionsContainer.innerHTML = '';

    // Original options with their database keys
    const rawOptions = [
      { originalKey: 'A', text: q.option_a },
      { originalKey: 'B', text: q.option_b },
      { originalKey: 'C', text: q.option_c },
      { originalKey: 'D', text: q.option_d }
    ];

    // Randomize / Shuffle options for this question
    const shuffledOptions = this.shuffleArray(rawOptions);
    const displayLabels = ['A', 'B', 'C', 'D'];
    this.currentRenderedOptions = [];

    shuffledOptions.forEach((opt, idx) => {
      const displayKey = displayLabels[idx];
      this.currentRenderedOptions.push({
        displayKey: displayKey,
        originalKey: opt.originalKey,
        text: opt.text
      });

      const btn = document.createElement('button');
      btn.className = `quiz-option-btn w-full p-4 rounded-xl text-left flex items-center justify-between group transition-all`;
      btn.dataset.displayKey = displayKey;
      btn.dataset.originalKey = opt.originalKey;
      btn.innerHTML = `
        <div class="flex items-center space-x-3.5 pointer-events-none">
          <span class="w-8 h-8 rounded-lg bg-slate-800/80 border border-slate-700 text-cyan-400 font-bold flex items-center justify-center text-sm group-hover:border-cyan-400 group-hover:bg-cyan-500/10 transition-colors">
            ${displayKey}
          </span>
          <span class="text-slate-200 text-sm sm:text-base font-medium">${this.escapeHtml(opt.text)}</span>
        </div>
        <i data-lucide="chevron-right" class="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-colors"></i>
      `;

      btn.addEventListener('click', () => {
        if (!this.isSubmitting) {
          this.handleAnswer(opt.originalKey, btn);
        }
      });

      optionsContainer.appendChild(btn);
    });

    if (window.lucide) lucide.createIcons();
  }

  handleAnswer(selectedOption, clickedBtn = null) {
    if (this.isSubmitting || this.timeRemaining <= 0) return;
    this.isSubmitting = true;

    const currentQ = this.questions[this.currentIndex];
    if (!currentQ) {
      this.isSubmitting = false;
      return;
    }

    const timeSpent = (performance.now() - (this.questionStartTime || performance.now())) / 1000;

    // Fast local click animation
    if (clickedBtn) {
      clickedBtn.classList.add('scale-95');
    }

    // 1. INSTANT LOCAL EVALUATION (Zero Network Delay / 60 FPS feedback!)
    const isSkip = (selectedOption === 'SKIP');
    const isCorrect = !isSkip && (selectedOption.toUpperCase() === (currentQ.correct_option || '').toUpperCase());

    this.stats.totalAnswered++;

    if (isSkip) {
      if (window.SFX) window.SFX.playClick();
      this.stats.currentStreak = 0;
    } else if (isCorrect) {
      this.stats.correct++;
      const posPts = this.config.positive_points || 4;
      this.stats.score += posPts;
      this.stats.currentStreak++;
      if (this.stats.currentStreak > this.stats.maxStreak) {
        this.stats.maxStreak = this.stats.currentStreak;
      }
      if (clickedBtn) clickedBtn.classList.add('selected-correct');
      if (window.SFX) {
        if (this.stats.currentStreak >= 3) {
          window.SFX.playStreak();
        } else {
          window.SFX.playCorrect();
        }
      }
    } else {
      this.stats.incorrect++;
      if (this.config.allow_negative) {
        const negPts = this.config.negative_points || 1;
        this.stats.score = Math.max(0, this.stats.score - negPts);
      }
      this.stats.currentStreak = 0;
      if (clickedBtn) clickedBtn.classList.add('selected-wrong');
      if (window.SFX) window.SFX.playWrong();
    }

    // Mobile Haptic Vibration Feedback
    if (navigator.vibrate) {
      if (isCorrect) {
        navigator.vibrate(this.stats.currentStreak >= 3 ? [40, 30, 70] : 40);
      } else if (!isSkip) {
        navigator.vibrate([80, 40, 80]);
      }
    }

    // Instant HUD stats refresh
    this.updateStatsUI();

    // 60+ Questions Milestone & Submission Alarm Alert
    if (this.stats.totalAnswered >= 60 && !this.hasTriggered60Alarm) {
      this.hasTriggered60Alarm = true;
      this.trigger60AlarmAlert();
    }

    // 2. DISPATCH ASYNC SERVER SYNC (Non-blocking background HTTP call)
    fetch(`${API_BASE}/api/quiz/submit-answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: this.session.session_id,
        question_id: currentQ.id,
        selected_option: selectedOption,
        time_spent_on_question: timeSpent
      })
    }).catch(err => console.warn("Background answer sync note:", err));

    // 3. SNAPPY 75ms QUESTION TRANSITION (Buttery smooth speed)
    setTimeout(() => {
      this.currentIndex++;
      this.isSubmitting = false;
      if (this.timeRemaining > 0 && this.currentIndex < this.questions.length) {
        this.renderCurrentQuestion();
      } else if (this.currentIndex >= this.questions.length) {
        this.finishQuiz();
      }
    }, 75);
  }

  trigger60AlarmAlert() {
    if (window.SFX) {
      window.SFX.playAlarm();
    }
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 300]);
    }
    const modal = document.getElementById('modal-60-alarm');
    const countEl = document.getElementById('alarm-q-count');
    if (countEl) countEl.textContent = this.stats.totalAnswered;
    if (modal) {
      modal.classList.remove('hidden');
      if (window.lucide) lucide.createIcons();
    }
  }

  updateStatsUI() {
    document.getElementById('live-score').textContent = this.stats.score;
    document.getElementById('live-correct').textContent = this.stats.correct;
    document.getElementById('live-total').textContent = this.stats.totalAnswered;

    const streakEl = document.getElementById('streak-indicator');
    const streakCount = document.getElementById('streak-count');
    if (this.stats.currentStreak >= 2) {
      streakEl.classList.remove('opacity-0', 'scale-75');
      streakEl.classList.add('opacity-100', 'scale-100');
      streakCount.textContent = `${this.stats.currentStreak}x Combo 🔥`;
    } else {
      streakEl.classList.add('opacity-0', 'scale-75');
      streakEl.classList.remove('opacity-100', 'scale-100');
    }
  }

  async finishQuiz() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }

    const elapsed = Math.min(this.timeLimit, (performance.now() - (this.startTime || performance.now())) / 1000);

    try {
      const res = await fetch(`${API_BASE}/api/quiz/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: this.session.session_id,
          time_used_seconds: elapsed
        })
      });

      if (!res.ok) throw new Error("Could not finalize score.");
      const summary = await res.json();
      this.renderResults(summary);
    } catch (e) {
      console.error(e);
      // Fallback display
      this.renderResults({
        participant_name: this.session.participant_name,
        student_id: this.session.student_id,
        score: this.stats.score,
        total_answered: this.stats.totalAnswered,
        correct_count: this.stats.correct,
        incorrect_count: this.stats.incorrect,
        max_streak: this.stats.maxStreak,
        accuracy_percentage: this.stats.totalAnswered ? Math.round((this.stats.correct / this.stats.totalAnswered) * 100) : 0,
        time_used_seconds: elapsed,
        current_rank: 1,
        total_participants: 1
      });
    }
  }

  renderResults(data) {
    this.latestResultSummary = data;
    this.switchView('view-results');

    document.getElementById('res-name').textContent = data.participant_name;
    document.getElementById('res-id').textContent = data.student_id;
    document.getElementById('res-score').textContent = data.score;
    document.getElementById('res-rank').textContent = `#${data.current_rank}`;
    document.getElementById('res-total-players').textContent = `out of ${data.total_participants} participants`;
    document.getElementById('res-accuracy').textContent = `${data.accuracy_percentage}%`;
    document.getElementById('res-correct').textContent = data.correct_count;
    document.getElementById('res-incorrect').textContent = data.incorrect_count;
    document.getElementById('res-answered').textContent = data.total_answered;
    document.getElementById('res-streak').textContent = `${data.max_streak} 🔥`;
    document.getElementById('res-time').textContent = `${Math.round(data.time_used_seconds)}s`;

    // Confetti celebration
    if (window.confetti) {
      window.SFX.playVictory();
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 }
      });
      setTimeout(() => {
        confetti({
          particleCount: 80,
          angle: 60,
          spread: 55,
          origin: { x: 0 }
        });
        confetti({
          particleCount: 80,
          angle: 120,
          spread: 55,
          origin: { x: 1 }
        });
      }, 300);
    }
  }

  generateCertificate() {
    const data = this.latestResultSummary || {
      participant_name: this.session?.participant_name || 'BMES Contestant',
      student_id: this.session?.student_id || '2211000',
      score: this.stats.score,
      current_rank: 1,
      total_participants: 1,
      accuracy_percentage: 100
    };

    const canvas = document.createElement('canvas');
    canvas.width = 1600;
    canvas.height = 1100;
    const ctx = canvas.getContext('2d');

    // 1. Background Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 1600, 1100);
    bgGrad.addColorStop(0, '#070d19');
    bgGrad.addColorStop(0.5, '#0b1329');
    bgGrad.addColorStop(1, '#070d19');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1600, 1100);

    // 2. Glowing Borders
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 10;
    ctx.strokeRect(30, 30, 1540, 1040);

    ctx.strokeStyle = '#0e7490';
    ctx.lineWidth = 3;
    ctx.strokeRect(45, 45, 1510, 1010);

    // Corner Ornaments
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(20, 20, 40, 40);
    ctx.fillRect(1540, 20, 40, 40);
    ctx.fillRect(20, 1040, 40, 40);
    ctx.fillRect(1540, 1040, 40, 40);

    // 3. Header Text
    ctx.textAlign = 'center';
    ctx.fillStyle = '#06b6d4';
    ctx.font = 'bold 28px "Space Grotesk", sans-serif';
    ctx.fillText('CHITTAGONG UNIVERSITY OF ENGINEERING & TECHNOLOGY (CUET)', 800, 130);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 36px "Space Grotesk", sans-serif';
    ctx.fillText('BIOMEDICAL ENGINEERING SOCIETY (BMES)', 800, 180);

    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 54px "Orbitron", "Space Grotesk", sans-serif';
    ctx.fillText('CERTIFICATE OF PARTICIPATION', 800, 280);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '24px "Space Grotesk", sans-serif';
    ctx.fillText('This certificate is proudly awarded to', 800, 350);

    // 4. Participant Name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 64px "Orbitron", sans-serif';
    ctx.fillText(data.participant_name.toUpperCase(), 800, 440);

    // Student ID & Department
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 30px monospace';
    ctx.fillText(`STUDENT ID: ${data.student_id}  |  DEPARTMENT OF BME`, 800, 500);

    // Description
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '22px "Space Grotesk", sans-serif';
    ctx.fillText('for extraordinary performance in the CUET BMES 2-Minute Blitz Speed Quiz Challenge,', 800, 580);
    ctx.fillText('demonstrating rapid analytical ability, speed, and accuracy across multidisciplinary questions.', 800, 615);

    // 5. Stat Badges Box
    ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(300, 680, 1000, 140, 20);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 36px "Orbitron", monospace';
    ctx.fillText(`SCORE: ${data.score} PTS`, 460, 755);

    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 36px "Orbitron", monospace';
    ctx.fillText(`RANK: #${data.current_rank}`, 800, 755);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 36px "Orbitron", monospace';
    ctx.fillText(`ACCURACY: ${data.accuracy_percentage}%`, 1140, 755);

    // 6. Signatures & Date
    const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    ctx.fillStyle = '#94a3b8';
    ctx.font = '20px "Space Grotesk", sans-serif';
    ctx.fillText(`Date: ${today}`, 450, 940);
    ctx.fillText('CUET BMES Executive Committee', 1150, 940);

    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(350, 910);
    ctx.lineTo(550, 910);
    ctx.moveTo(1000, 910);
    ctx.lineTo(1300, 910);
    ctx.stroke();

    // 7. Trigger Direct Download
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `CUET_BMES_Quiz_Certificate_${data.student_id}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async loadLeaderboard(silent = false) {
    const loader = document.getElementById('leaderboard-loader');
    const badge = document.getElementById('leaderboard-total-badge');

    if (!silent && loader) loader.classList.remove('hidden');

    try {
      const res = await fetch(`${API_BASE}/api/leaderboard`);
      if (!res.ok) throw new Error("Failed to load leaderboard");
      this.leaderboardData = await res.json();
      
      if (badge) {
        badge.textContent = `👥 Total Contestants: ${this.leaderboardData.length}`;
      }

      this.renderPodium();
      const currentQuery = document.getElementById('search-leaderboard')?.value || '';
      this.renderLeaderboardViews(currentQuery);
    } catch (e) {
      console.warn("Leaderboard error:", e);
    } finally {
      if (loader) loader.classList.add('hidden');
    }
  }

  renderPodium() {
    const top3 = this.leaderboardData.slice(0, 3);
    const podium1 = document.getElementById('podium-first');
    const podium2 = document.getElementById('podium-second');
    const podium3 = document.getElementById('podium-third');

    if (top3[0] && podium1) {
      podium1.querySelector('.podium-name').textContent = top3[0].name;
      podium1.querySelector('.podium-id').textContent = `${top3[0].student_id} (${top3[0].department || 'BME'})`;
      podium1.querySelector('.podium-score').textContent = `${top3[0].score} pts`;
      podium1.classList.remove('opacity-40');
    } else if (podium1) {
      podium1.querySelector('.podium-name').textContent = "Waiting for #1...";
      podium1.querySelector('.podium-id').textContent = "--";
      podium1.querySelector('.podium-score').textContent = "0 pts";
      podium1.classList.add('opacity-40');
    }

    if (top3[1] && podium2) {
      podium2.querySelector('.podium-name').textContent = top3[1].name;
      podium2.querySelector('.podium-id').textContent = `${top3[1].student_id} (${top3[1].department || 'BME'})`;
      podium2.querySelector('.podium-score').textContent = `${top3[1].score} pts`;
      podium2.classList.remove('opacity-40');
    } else if (podium2) {
      podium2.querySelector('.podium-name').textContent = "Waiting for #2...";
      podium2.querySelector('.podium-id').textContent = "--";
      podium2.querySelector('.podium-score').textContent = "0 pts";
      podium2.classList.add('opacity-40');
    }

    if (top3[2] && podium3) {
      podium3.querySelector('.podium-name').textContent = top3[2].name;
      podium3.querySelector('.podium-id').textContent = `${top3[2].student_id} (${top3[2].department || 'BME'})`;
      podium3.querySelector('.podium-score').textContent = `${top3[2].score} pts`;
      podium3.classList.remove('opacity-40');
    } else if (podium3) {
      podium3.querySelector('.podium-name').textContent = "Waiting for #3...";
      podium3.querySelector('.podium-id').textContent = "--";
      podium3.querySelector('.podium-score').textContent = "0 pts";
      podium3.classList.add('opacity-40');
    }
  }

  renderLeaderboardViews(filterQuery = "") {
    const tableBody = document.getElementById('leaderboard-tbody');
    const mobileList = document.getElementById('leaderboard-mobile-list');
    const sortMode = document.getElementById('sort-leaderboard')?.value || 'rank';

    const query = filterQuery.toLowerCase().trim();
    let list = [...this.leaderboardData].filter(item => 
      item.name.toLowerCase().includes(query) || 
      item.student_id.toLowerCase().includes(query) ||
      (item.department && item.department.toLowerCase().includes(query)) ||
      (item.batch && item.batch.toLowerCase().includes(query))
    );

    // Apply Sorting
    if (sortMode === 'accuracy') {
      list.sort((a, b) => b.accuracy_percentage - a.accuracy_percentage || b.score - a.score);
    } else if (sortMode === 'time') {
      list.sort((a, b) => a.time_used_seconds - b.time_used_seconds || b.score - a.score);
    } else {
      list.sort((a, b) => a.rank - b.rank);
    }

    // Render Empty State
    if (list.length === 0) {
      const emptyHtml = `
        <div class="text-center py-10 text-slate-400 font-medium">
          <i data-lucide="inbox" class="w-8 h-8 mx-auto mb-2 text-slate-500"></i>
          <p class="text-sm">No participant rankings found${query ? ` matching "${this.escapeHtml(query)}"` : ''}.</p>
        </div>
      `;
      if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="7">${emptyHtml}</td></tr>`;
      }
      if (mobileList) {
        mobileList.innerHTML = emptyHtml;
      }
      if (window.lucide) lucide.createIcons();
      return;
    }

    const currentStudentId = this.session?.student_id?.trim().toUpperCase();

    // 1. Render Desktop Table
    if (tableBody) {
      tableBody.innerHTML = '';
      list.forEach((item) => {
        const isCurrent = currentStudentId && item.student_id.trim().toUpperCase() === currentStudentId;
        const row = document.createElement('tr');
        row.className = `border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors text-sm ${isCurrent ? 'bg-cyan-500/10 border-cyan-500/40' : ''}`;

        let rankBadge = `<span class="font-bold text-slate-400 font-tech">#${item.rank}</span>`;
        if (item.rank === 1) rankBadge = `<span class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-yellow-500/20 text-yellow-300 font-bold border border-yellow-500/50 shadow-sm">🥇 1</span>`;
        else if (item.rank === 2) rankBadge = `<span class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-400/20 text-slate-200 font-bold border border-slate-400/50 shadow-sm">🥈 2</span>`;
        else if (item.rank === 3) rankBadge = `<span class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-700/20 text-amber-300 font-bold border border-amber-600/50 shadow-sm">🥉 3</span>`;

        row.innerHTML = `
          <td class="py-3.5 px-4 text-center">${rankBadge}</td>
          <td class="py-3.5 px-4">
            <div class="font-semibold text-white flex items-center space-x-2">
              <span>${this.escapeHtml(item.name)}</span>
              ${isCurrent ? '<span class="px-1.5 py-0.5 rounded bg-cyan-500 text-slate-950 text-[10px] font-black uppercase">You</span>' : ''}
            </div>
            <span class="text-xs text-slate-400 font-mono">${this.escapeHtml(item.student_id)}</span>
          </td>
          <td class="py-3.5 px-4 text-slate-300 hidden md:table-cell">
            <div class="flex items-center space-x-1.5">
              <span class="px-2 py-0.5 rounded bg-slate-800 text-xs text-cyan-300 font-medium">${this.escapeHtml(item.department || 'BME')}</span>
              ${item.batch && item.batch !== 'N/A' ? `<span class="text-xs text-slate-500">Batch '${this.escapeHtml(item.batch)}</span>` : ''}
            </div>
          </td>
          <td class="py-3.5 px-4 text-center font-tech font-black text-lg ${item.score > 0 ? 'text-cyan-400' : 'text-slate-400'}">${item.score} pts</td>
          <td class="py-3.5 px-4 text-center font-medium text-emerald-400 font-tech">${item.correct_count} / ${item.total_answered}</td>
          <td class="py-3.5 px-4 text-center text-slate-300 hidden lg:table-cell font-tech">${item.accuracy_percentage}%</td>
          <td class="py-3.5 px-4 text-center text-slate-400 hidden lg:table-cell font-tech">${item.time_used_seconds}s</td>
        `;

        tableBody.appendChild(row);
      });
    }

    // 2. Render Mobile Cards (for clean viewing on any smartphone)
    if (mobileList) {
      mobileList.innerHTML = '';
      list.forEach((item) => {
        const isCurrent = currentStudentId && item.student_id.trim().toUpperCase() === currentStudentId;
        const card = document.createElement('div');
        card.className = `p-4 rounded-2xl border transition-all ${
          item.rank === 1 ? 'bg-gradient-to-r from-yellow-950/40 to-slate-900/80 border-yellow-500/40 shadow-lg' :
          item.rank === 2 ? 'bg-gradient-to-r from-slate-800/60 to-slate-900/80 border-slate-400/40' :
          item.rank === 3 ? 'bg-gradient-to-r from-amber-950/40 to-slate-900/80 border-amber-700/40' :
          isCurrent ? 'bg-cyan-950/40 border-cyan-500/50' : 'bg-slate-900/60 border-slate-800'
        }`;

        let rankPill = `<span class="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold font-tech">#${item.rank}</span>`;
        if (item.rank === 1) rankPill = `<span class="px-2.5 py-0.5 rounded-full bg-yellow-500/20 border border-yellow-400 text-yellow-300 text-xs font-bold font-tech">🥇 #1 Champion</span>`;
        else if (item.rank === 2) rankPill = `<span class="px-2.5 py-0.5 rounded-full bg-slate-400/20 border border-slate-400 text-slate-200 text-xs font-bold font-tech">🥈 #2 Silver</span>`;
        else if (item.rank === 3) rankPill = `<span class="px-2.5 py-0.5 rounded-full bg-amber-700/20 border border-amber-600 text-amber-300 text-xs font-bold font-tech">🥉 #3 Bronze</span>`;

        card.innerHTML = `
          <div class="flex items-start justify-between gap-2 mb-2.5">
            <div>
              <div class="flex items-center space-x-2">
                ${rankPill}
                ${isCurrent ? '<span class="px-1.5 py-0.5 rounded bg-cyan-500 text-slate-950 text-[10px] font-black uppercase">You</span>' : ''}
              </div>
              <h4 class="font-bold text-white text-base mt-1.5">${this.escapeHtml(item.name)}</h4>
              <div class="flex items-center space-x-2 text-xs text-slate-400 font-mono mt-0.5">
                <span>ID: ${this.escapeHtml(item.student_id)}</span>
                <span>•</span>
                <span class="text-cyan-300">${this.escapeHtml(item.department || 'BME')} ${item.batch ? `('${this.escapeHtml(item.batch)})` : ''}</span>
              </div>
            </div>

            <div class="text-right">
              <span class="block text-[10px] uppercase font-bold text-slate-400">Score</span>
              <span class="font-tech font-black text-2xl ${item.score > 0 ? 'text-cyan-400' : 'text-slate-300'}">${item.score}</span>
              <span class="text-[11px] text-slate-500 block">pts</span>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-2 pt-2.5 border-t border-slate-800/80 text-center text-xs">
            <div class="p-1.5 rounded-lg bg-slate-950/60 border border-slate-800">
              <span class="block text-[9px] uppercase font-bold text-slate-500">Correct</span>
              <span class="font-tech font-bold text-emerald-400">${item.correct_count} / ${item.total_answered}</span>
            </div>
            <div class="p-1.5 rounded-lg bg-slate-950/60 border border-slate-800">
              <span class="block text-[9px] uppercase font-bold text-slate-500">Accuracy</span>
              <span class="font-tech font-bold text-cyan-300">${item.accuracy_percentage}%</span>
            </div>
            <div class="p-1.5 rounded-lg bg-slate-950/60 border border-slate-800">
              <span class="block text-[9px] uppercase font-bold text-slate-500">Time</span>
              <span class="font-tech font-bold text-slate-300">${item.time_used_seconds}s</span>
            </div>
          </div>
        `;

        mobileList.appendChild(card);
      });
    }

    if (window.lucide) lucide.createIcons();
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }

  shuffleArray(array) {
    if (!array || !Array.isArray(array)) return [];
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

// Initialize Application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new QuizApp();
});
