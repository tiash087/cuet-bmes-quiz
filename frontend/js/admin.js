// CUET BMES Quiz - Admin Dashboard Controller
const API_BASE = window.location.origin;

class AdminApp {
  constructor() {
    this.token = sessionStorage.getItem('admin_token') || '';
    this.questions = [];
    this.editingQuestionId = null;

    this.init();
  }

  init() {
    this.bindEvents();
    if (this.token) {
      this.showDashboard();
    } else {
      this.showLogin();
    }
  }

  bindEvents() {
    // Login Form
    document.getElementById('form-admin-login')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleLogin();
    });

    // Logout
    document.getElementById('btn-admin-logout')?.addEventListener('click', () => {
      this.logout();
    });

    // QR Codes Modal
    document.getElementById('btn-admin-qr')?.addEventListener('click', () => {
      document.getElementById('modal-admin-qr')?.classList.remove('hidden');
    });

    // Tab Switching
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        this.switchTab(tab);
      });
    });

    // Add Question Button
    document.getElementById('btn-open-add-q')?.addEventListener('click', () => {
      this.openQuestionModal();
    });

    // Save Question Form
    document.getElementById('form-question-modal')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveQuestion();
    });

    // Close Question Modal
    document.getElementById('btn-close-q-modal')?.addEventListener('click', () => {
      this.closeQuestionModal();
    });

    // Bulk Import Modal
    document.getElementById('btn-open-bulk-import')?.addEventListener('click', () => {
      document.getElementById('modal-bulk-import')?.classList.remove('hidden');
    });

    document.getElementById('btn-close-bulk-modal')?.addEventListener('click', () => {
      document.getElementById('modal-bulk-import')?.classList.add('hidden');
    });

    document.getElementById('btn-submit-bulk-import')?.addEventListener('click', () => {
      this.handleBulkImport();
    });

    // Search / Filter Questions
    document.getElementById('search-admin-q')?.addEventListener('input', () => this.renderQuestions());
    document.getElementById('filter-category')?.addEventListener('change', () => this.renderQuestions());

    // Settings Form
    document.getElementById('form-admin-settings')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveSettings();
    });

    // Reset Leaderboard
    document.getElementById('btn-reset-leaderboard')?.addEventListener('click', () => {
      this.resetLeaderboard();
    });

    // Purge All Data (Permanent Clean Slate)
    document.getElementById('btn-purge-all')?.addEventListener('click', () => {
      this.purgeAllData();
    });

    // Undo Leaderboard Wipe / Restore
    document.getElementById('btn-undo-leaderboard')?.addEventListener('click', () => {
      this.undoLeaderboard();
    });

    // Toast Undo & Close
    document.getElementById('toast-undo-btn')?.addEventListener('click', () => {
      this.undoLeaderboard();
      this.hideToast();
    });

    document.getElementById('toast-close-btn')?.addEventListener('click', () => {
      this.hideToast();
    });

    // Export CSV
    document.getElementById('btn-export-csv')?.addEventListener('click', () => {
      this.exportCsv();
    });

    // Manual Entry / Restore Modal
    document.getElementById('btn-open-manual-entry')?.addEventListener('click', () => {
      document.getElementById('modal-manual-entry')?.classList.remove('hidden');
    });

    document.getElementById('btn-close-manual-entry')?.addEventListener('click', () => {
      document.getElementById('modal-manual-entry')?.classList.add('hidden');
    });

    document.getElementById('btn-cancel-manual-entry')?.addEventListener('click', () => {
      document.getElementById('modal-manual-entry')?.classList.add('hidden');
    });

    document.getElementById('form-manual-entry')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleManualEntry();
    });
  }

  async handleLogin() {
    const pass = document.getElementById('admin-pass-input').value;
    const errorEl = document.getElementById('admin-login-error');
    errorEl.classList.add('hidden');

    try {
      const res = await fetch(`${API_BASE}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pass })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Authentication failed");

      this.token = data.token;
      sessionStorage.setItem('admin_token', this.token);
      this.showDashboard();
    } catch (e) {
      errorEl.textContent = e.message;
      errorEl.classList.remove('hidden');
    }
  }

  logout() {
    this.token = '';
    sessionStorage.removeItem('admin_token');
    this.showLogin();
  }

  showLogin() {
    document.getElementById('admin-login-view')?.classList.remove('hidden');
    document.getElementById('admin-dashboard-view')?.classList.add('hidden');
  }

  showDashboard() {
    document.getElementById('admin-login-view')?.classList.add('hidden');
    document.getElementById('admin-dashboard-view')?.classList.remove('hidden');
    this.switchTab('tab-questions');
    this.loadQuestions();
    this.loadSettings();
    this.loadResults();
  }

  switchTab(tabId) {
    document.querySelectorAll('.admin-tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
      btn.classList.remove('bg-cyan-500/20', 'text-cyan-300', 'border-cyan-500/40');
      btn.classList.add('text-slate-400');
    });

    const activeBtn = document.querySelector(`.admin-tab-btn[data-tab="${tabId}"]`);
    if (activeBtn) {
      activeBtn.classList.add('bg-cyan-500/20', 'text-cyan-300', 'border-cyan-500/40');
      activeBtn.classList.remove('text-slate-400');
    }

    const content = document.getElementById(tabId);
    if (content) content.classList.remove('hidden');

    if (tabId === 'tab-results') this.loadResults();
    if (window.lucide) lucide.createIcons();
  }

  // --- QUESTIONS CRUD ---

  async loadQuestions() {
    try {
      const res = await fetch(`${API_BASE}/api/admin/questions`, {
        headers: { 'X-Admin-Token': this.token }
      });
      if (!res.ok) {
        if (res.status === 401) return this.logout();
        throw new Error("Failed to fetch questions");
      }
      this.questions = await res.json();
      document.getElementById('stat-total-q').textContent = this.questions.length;
      this.renderQuestions();
    } catch (e) {
      console.error(e);
    }
  }

  renderQuestions() {
    const tbody = document.getElementById('admin-questions-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const query = (document.getElementById('search-admin-q')?.value || '').toLowerCase().trim();
    const cat = document.getElementById('filter-category')?.value || 'ALL';

    const filtered = this.questions.filter(q => {
      const matchesText = q.question_text.toLowerCase().includes(query) || (q.category && q.category.toLowerCase().includes(query));
      const matchesCat = cat === 'ALL' || q.category === cat;
      return matchesText && matchesCat;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-8 text-slate-500 text-sm">
            No questions found matching criteria.
          </td>
        </tr>
      `;
      return;
    }

    filtered.forEach((q, idx) => {
      const row = document.createElement('tr');
      row.className = "border-b border-slate-800/80 hover:bg-slate-800/30 text-xs sm:text-sm";
      row.innerHTML = `
        <td class="py-3 px-4 text-center font-mono text-slate-500">#${q.id}</td>
        <td class="py-3 px-4 max-w-md">
          <p class="font-semibold text-slate-200 line-clamp-2">${this.escapeHtml(q.question_text)}</p>
          <div class="grid grid-cols-2 gap-1 text-[11px] text-slate-400 mt-1">
            <span>A: ${this.escapeHtml(q.option_a)}</span>
            <span>B: ${this.escapeHtml(q.option_b)}</span>
            <span>C: ${this.escapeHtml(q.option_c)}</span>
            <span>D: ${this.escapeHtml(q.option_d)}</span>
          </div>
        </td>
        <td class="py-3 px-4 text-center">
          <span class="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40">
            ${q.correct_option}
          </span>
        </td>
        <td class="py-3 px-4">
          <span class="px-2 py-0.5 rounded-full bg-slate-800 text-[11px] text-cyan-300 border border-slate-700 font-medium">
            ${this.escapeHtml(q.category || 'General')}
          </span>
        </td>
        <td class="py-3 px-4 text-center">
          <span class="px-2 py-0.5 rounded text-[11px] ${q.difficulty === 'Easy' ? 'bg-emerald-500/10 text-emerald-400' : q.difficulty === 'Hard' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'}">
            ${q.difficulty}
          </span>
        </td>
        <td class="py-3 px-4 text-right space-x-2">
          <button class="btn-edit-q p-1.5 rounded-lg bg-slate-800 hover:bg-cyan-500/20 text-slate-400 hover:text-cyan-300 transition-colors" data-id="${q.id}">
            <i data-lucide="edit-3" class="w-4 h-4 pointer-events-none"></i>
          </button>
          <button class="btn-delete-q p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors" data-id="${q.id}">
            <i data-lucide="trash-2" class="w-4 h-4 pointer-events-none"></i>
          </button>
        </td>
      `;

      tbody.appendChild(row);
    });

    if (window.lucide) lucide.createIcons();

    // Bind Edit/Delete buttons
    tbody.querySelectorAll('.btn-edit-q').forEach(btn => {
      btn.addEventListener('click', () => this.openQuestionModal(parseInt(btn.dataset.id)));
    });

    tbody.querySelectorAll('.btn-delete-q').forEach(btn => {
      btn.addEventListener('click', () => this.deleteQuestion(parseInt(btn.dataset.id)));
    });
  }

  openQuestionModal(qId = null) {
    this.editingQuestionId = qId;
    const title = document.getElementById('q-modal-title');
    const form = document.getElementById('form-question-modal');

    if (qId) {
      title.textContent = `Edit Question #${qId}`;
      const q = this.questions.find(item => item.id === qId);
      if (q) {
        document.getElementById('modal-q-text').value = q.question_text;
        document.getElementById('modal-opt-a').value = q.option_a;
        document.getElementById('modal-opt-b').value = q.option_b;
        document.getElementById('modal-opt-c').value = q.option_c;
        document.getElementById('modal-opt-d').value = q.option_d;
        document.getElementById('modal-correct-opt').value = q.correct_option;
        document.getElementById('modal-category').value = q.category || 'General BMES';
        document.getElementById('modal-difficulty').value = q.difficulty || 'Medium';
        document.getElementById('modal-explanation').value = q.explanation || '';
      }
    } else {
      title.textContent = "Add New Question";
      form.reset();
    }

    document.getElementById('modal-question')?.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  }

  closeQuestionModal() {
    document.getElementById('modal-question')?.classList.add('hidden');
    this.editingQuestionId = null;
  }

  async saveQuestion() {
    const payload = {
      question_text: document.getElementById('modal-q-text').value.trim(),
      option_a: document.getElementById('modal-opt-a').value.trim(),
      option_b: document.getElementById('modal-opt-b').value.trim(),
      option_c: document.getElementById('modal-opt-c').value.trim(),
      option_d: document.getElementById('modal-opt-d').value.trim(),
      correct_option: document.getElementById('modal-correct-opt').value,
      category: document.getElementById('modal-category').value.trim(),
      difficulty: document.getElementById('modal-difficulty').value,
      explanation: document.getElementById('modal-explanation').value.trim(),
      is_active: 1
    };

    try {
      let res;
      if (this.editingQuestionId) {
        res = await fetch(`${API_BASE}/api/admin/questions/${this.editingQuestionId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-Admin-Token': this.token },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch(`${API_BASE}/api/admin/questions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Admin-Token': this.token },
          body: JSON.stringify(payload)
        });
      }

      if (!res.ok) throw new Error("Failed to save question");
      this.closeQuestionModal();
      this.loadQuestions();
    } catch (e) {
      alert("Error saving: " + e.message);
    }
  }

  async deleteQuestion(qId) {
    if (!confirm(`Are you sure you want to delete Question #${qId}?`)) return;

    try {
      const res = await fetch(`${API_BASE}/api/admin/questions/${qId}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Token': this.token }
      });
      if (!res.ok) throw new Error("Delete failed");
      this.loadQuestions();
    } catch (e) {
      alert("Error deleting question: " + e.message);
    }
  }

  async handleBulkImport() {
    const rawText = document.getElementById('bulk-import-textarea').value.trim();
    if (!rawText) return;

    try {
      const parsed = JSON.parse(rawText);
      if (!Array.isArray(parsed)) throw new Error("Input must be a JSON Array of questions.");

      const res = await fetch(`${API_BASE}/api/admin/questions/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': this.token },
        body: JSON.stringify(parsed)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Import failed");

      alert(`Success: ${data.imported_count} questions imported!`);
      document.getElementById('modal-bulk-import')?.classList.add('hidden');
      document.getElementById('bulk-import-textarea').value = '';
      this.loadQuestions();
    } catch (e) {
      alert("Import error: " + e.message);
    }
  }

  // --- SETTINGS ---

  async loadSettings() {
    try {
      const res = await fetch(`${API_BASE}/api/admin/settings`, {
        headers: { 'X-Admin-Token': this.token }
      });
      if (!res.ok) return;
      const s = await res.json();

      document.getElementById('set-title').value = s.competition_title || "CUET BMES 2-Minute Blitz Quiz";
      document.getElementById('set-duration').value = s.quiz_duration || "120";
      document.getElementById('set-positive').value = s.positive_points || "4";
      document.getElementById('set-negative').value = s.negative_points || "1";
      document.getElementById('set-allow-negative').checked = (s.allow_negative === "true");
      document.getElementById('set-allow-retakes').checked = (s.allow_retakes === "true");
    } catch (e) {
      console.error(e);
    }
  }

  async saveSettings() {
    const payload = {
      competition_title: document.getElementById('set-title').value.trim(),
      quiz_duration: parseInt(document.getElementById('set-duration').value),
      positive_points: parseInt(document.getElementById('set-positive').value),
      negative_points: parseInt(document.getElementById('set-negative').value),
      allow_negative: document.getElementById('set-allow-negative').checked,
      allow_retakes: document.getElementById('set-allow-retakes').checked,
    };

    const newPass = document.getElementById('set-new-pass').value.trim();
    if (newPass) {
      payload.admin_password = newPass;
    }

    try {
      const res = await fetch(`${API_BASE}/api/admin/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': this.token },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Failed to update settings");
      alert("Settings saved successfully!");
      if (newPass) {
        this.token = newPass;
        sessionStorage.setItem('admin_token', this.token);
      }
    } catch (e) {
      alert("Settings error: " + e.message);
    }
  }

  // --- RESULTS & LEADERBOARD ---

  async loadResults() {
    try {
      const res = await fetch(`${API_BASE}/api/leaderboard`);
      if (!res.ok) return;
      const rows = await res.json();
      
      document.getElementById('stat-total-participants').textContent = rows.length;

      const tbody = document.getElementById('admin-results-tbody');
      if (!tbody) return;
      tbody.innerHTML = '';

      if (rows.length === 0) {
        tbody.innerHTML = `
          <tr><td colspan="10" class="text-center py-8 text-slate-500 font-medium">No active participant quiz sessions recorded.</td></tr>
        `;
        this.checkBackupStatus();
        return;
      }

      rows.forEach(r => {
        const tr = document.createElement('tr');
        tr.className = "border-b border-slate-800/80 hover:bg-slate-800/30 text-xs sm:text-sm";
        
        let rankBadge = `<span class="font-bold text-slate-400">#${r.rank}</span>`;
        if (r.rank === 1) rankBadge = `<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-500/20 text-yellow-300 font-bold border border-yellow-500/40">🥇 1</span>`;
        else if (r.rank === 2) rankBadge = `<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-400/20 text-slate-200 font-bold border border-slate-400/40">🥈 2</span>`;
        else if (r.rank === 3) rankBadge = `<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-700/20 text-amber-400 font-bold border border-amber-700/40">🥉 3</span>`;

        tr.innerHTML = `
          <td class="py-3 px-4 text-center">${rankBadge}</td>
          <td class="py-3 px-4 font-semibold text-white">${this.escapeHtml(r.name)}</td>
          <td class="py-3 px-4 font-mono text-slate-300">${this.escapeHtml(r.student_id)}</td>
          <td class="py-3 px-4 text-slate-400">
            <span class="px-2 py-0.5 rounded bg-slate-800 text-xs text-cyan-300">${this.escapeHtml(r.department || 'BME')} ${r.batch && r.batch !== 'N/A' ? `('${this.escapeHtml(r.batch)})` : ''}</span>
          </td>
          <td class="py-3 px-4 text-center font-tech font-extrabold text-amber-400 text-base">${r.score} pts</td>
          <td class="py-3 px-4 text-center text-emerald-400">${r.correct_count} / ${r.total_answered}</td>
          <td class="py-3 px-4 text-center text-slate-300">${r.accuracy_percentage}%</td>
          <td class="py-3 px-4 text-center text-slate-400">${r.time_used_seconds}s</td>
          <td class="py-3 px-4 text-slate-400 text-xs">${r.completed_at || '--'}</td>
          <td class="py-3 px-4 text-right">
            ${r.session_id ? `
              <button class="btn-delete-session p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors" data-session-id="${r.session_id}" title="Delete session (Archived for undo)">
                <i data-lucide="trash-2" class="w-4 h-4 pointer-events-none"></i>
              </button>
            ` : ''}
          </td>
        `;
        tbody.appendChild(tr);
      });

      // Bind individual delete buttons
      tbody.querySelectorAll('.btn-delete-session').forEach(btn => {
        btn.addEventListener('click', () => this.deleteSession(btn.dataset.sessionId));
      });

      if (window.lucide) lucide.createIcons();
      this.checkBackupStatus();
    } catch (e) {
      console.error("loadResults error:", e);
    }
  }

  async checkBackupStatus() {
    try {
      const res = await fetch(`${API_BASE}/api/admin/backup-status`, {
        headers: { 'X-Admin-Token': this.token }
      });
      if (!res.ok) return;
      const data = await res.json();
      
      const undoBtn = document.getElementById('btn-undo-leaderboard');
      const badge = document.getElementById('backup-badge');
      
      if (undoBtn) {
        undoBtn.disabled = !data.has_backup;
      }
      if (badge) {
        if (data.has_backup && data.archived_count > 0) {
          badge.textContent = data.archived_count;
          badge.classList.remove('hidden');
        } else {
          badge.classList.add('hidden');
        }
      }
    } catch (e) {
      console.warn("checkBackupStatus error:", e);
    }
  }

  async resetLeaderboard() {
    if (!confirm("⚠️ WARNING: Wipe Leaderboard?\n\nAll current scores will be cleared, but safely saved in the archive. You can restore them anytime using the 'Undo Wipe / Restore' button.\n\nProceed?")) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/admin/reset-leaderboard`, {
        method: 'POST',
        headers: { 'X-Admin-Token': this.token }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Reset failed");

      this.loadResults();
      this.showToast(`🗑️ Leaderboard wiped. ${data.archived_count || 0} scores archived safely.`, true);
    } catch (e) {
      alert("Error resetting: " + e.message);
    }
  }

  async undoLeaderboard() {
    try {
      const res = await fetch(`${API_BASE}/api/admin/undo-reset-leaderboard`, {
        method: 'POST',
        headers: { 'X-Admin-Token': this.token }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Undo failed");

      this.loadResults();
      this.showToast(`↩️ Undo successful! ${data.restored_count} participant scores restored.`, false);
    } catch (e) {
      alert("Undo error: " + e.message);
    }
  }

  async deleteSession(sessionId) {
    if (!confirm("Are you sure you want to delete this participant submission?")) {
      return;
    }

    try {
      const token = this.token || sessionStorage.getItem('admin_token') || 'BME_2122';
      const res = await fetch(`${API_BASE}/api/admin/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Token': token }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Delete failed");

      this.loadResults();
      this.showToast("🗑️ Participant submission permanently deleted.", false);
    } catch (e) {
      alert("Delete session error: " + e.message);
    }
  }

  async purgeAllData() {
    if (!confirm("⚠️ PERMANENT PURGE:\n\nAre you sure you want to permanently delete ALL participant records, registrations, and leaderboard scores from the database?\n\nThis will completely reset the tournament leaderboard to 0.")) {
      return;
    }

    try {
      const token = this.token || sessionStorage.getItem('admin_token') || 'BME_2122';
      const res = await fetch(`${API_BASE}/api/admin/purge-all-data`, {
        method: 'POST',
        headers: { 'X-Admin-Token': token }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Purge failed");

      this.loadResults();
      this.showToast("💣 All leaderboard data permanently purged! Ready for tournament.", false);
    } catch (e) {
      alert("Purge error: " + e.message);
    }
  }

  showToast(message, showUndo = false) {
    const toast = document.getElementById('admin-toast');
    const msgEl = document.getElementById('toast-message');
    const undoBtn = document.getElementById('toast-undo-btn');
    if (!toast || !msgEl) return;

    msgEl.textContent = message;
    if (undoBtn) {
      if (showUndo) undoBtn.classList.remove('hidden');
      else undoBtn.classList.add('hidden');
    }

    toast.classList.remove('translate-y-24', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');

    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => this.hideToast(), 7000);
  }

  hideToast() {
    const toast = document.getElementById('admin-toast');
    if (!toast) return;
    toast.classList.add('translate-y-24', 'opacity-0');
    toast.classList.remove('translate-y-0', 'opacity-100');
  }

  async exportCsv() {
    const token = this.token || sessionStorage.getItem('admin_token') || 'BME_2122';
    try {
      const res = await fetch(`${API_BASE}/api/admin/export-csv?token=${encodeURIComponent(token)}`, {
        headers: {
          'X-Admin-Token': token
        }
      });
      if (!res.ok) {
        window.open(`${API_BASE}/api/admin/export-csv?token=${encodeURIComponent(token)}`, '_blank');
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CUET_BMES_Leaderboard_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      this.showToast('📥 CSV Leaderboard exported successfully!');
    } catch (e) {
      window.open(`${API_BASE}/api/admin/export-csv?token=${encodeURIComponent(token)}`, '_blank');
    }
  }

  async handleManualEntry() {
    const name = document.getElementById('manual-name')?.value?.trim();
    const student_id = document.getElementById('manual-student-id')?.value?.trim();
    const department = document.getElementById('manual-dept')?.value?.trim() || 'BME';
    const batch = document.getElementById('manual-batch')?.value?.trim();
    const score = parseInt(document.getElementById('manual-score')?.value, 10);
    const correct_count = parseInt(document.getElementById('manual-correct')?.value, 10) || 0;
    const total_answered = parseInt(document.getElementById('manual-total')?.value, 10) || correct_count;
    const time_used_seconds = parseFloat(document.getElementById('manual-time')?.value) || 120.0;

    if (!name || !student_id || isNaN(score)) {
      alert('Please enter Name, Student ID, and Score.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/admin/manual-entry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': this.token
        },
        body: JSON.stringify({
          name,
          student_id,
          department,
          batch,
          score,
          correct_count,
          incorrect_count: Math.max(0, total_answered - correct_count),
          total_answered,
          time_used_seconds
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to add/restore participant');

      document.getElementById('modal-manual-entry')?.classList.add('hidden');
      document.getElementById('form-manual-entry')?.reset();
      this.loadResults();
      this.showToast(`✅ ${name} (${student_id}) restored with ${score} pts!`);
    } catch (e) {
      alert('Error: ' + e.message);
    }
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.adminApp = new AdminApp();
});
