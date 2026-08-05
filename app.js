(() => {
  const STORAGE_KEY = 'expenses';
  const LIMIT_STORAGE_KEY = 'dailyLimit';
  const DEFAULT_DAILY_LIMIT = 25;
  const CATEGORY_LABELS = {
    Food: 'Food',
    Transport: 'Transport / Uber',
    Cinema: 'Cinema / Entertainment',
    Shopping: 'Shopping',
    Other: 'Other',
  };
  const CATEGORY_COLORS = {
    Food: '#f2a541',
    Transport: '#3d6fd1',
    Cinema: '#8b5cf6',
    Shopping: '#2dd4bf',
    Other: '#94a3b8',
  };

  let expenses = loadExpenses();
  let dailyLimit = loadDailyLimit();
  let editingId = null;
  let currentWeekChart = null;
  let previousWeekChart = null;
  let categoryChart = null;

  // ---------- elements ----------
  const form = document.getElementById('expenseForm');
  const formTitle = document.getElementById('formTitle');
  const dateInput = document.getElementById('date');
  const categoryInput = document.getElementById('category');
  const descriptionInput = document.getElementById('description');
  const amountInput = document.getElementById('amount');
  const submitBtn = document.getElementById('submitBtn');
  const cancelEditBtn = document.getElementById('cancelEditBtn');
  const entriesList = document.getElementById('entriesList');
  const weekAvgEl = document.getElementById('weekAvg');
  const allTimeAvgEl = document.getElementById('allTimeAvg');
  const exportBtn = document.getElementById('exportBtn');
  const importInput = document.getElementById('importInput');
  const dailyLimitDisplay = document.getElementById('dailyLimitDisplay');
  const formCard = document.getElementById('formCard');
  const settingsForm = document.getElementById('settingsForm');
  const dailyLimitInput = document.getElementById('dailyLimitInput');
  const categoryEmptyState = document.getElementById('categoryEmptyState');

  // ---------- storage ----------
  function loadExpenses() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveExpenses() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
  }

  function loadDailyLimit() {
    const raw = parseFloat(localStorage.getItem(LIMIT_STORAGE_KEY));
    return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_DAILY_LIMIT;
  }

  function saveDailyLimit() {
    localStorage.setItem(LIMIT_STORAGE_KEY, String(dailyLimit));
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // ---------- date helpers ----------
  function toISODate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }

  function startOfWeek(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay(); // 0 = Sun ... 6 = Sat
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d;
  }

  function weekDates(monday) {
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  }

  function formatEUR(n) {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n || 0);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  // ---------- data queries ----------
  function dailyTotal(dateStr) {
    return expenses
      .filter((e) => e.date === dateStr)
      .reduce((sum, e) => sum + e.amount, 0);
  }

  // ---------- rendering: entries ----------
  function renderEntries() {
    const monday = startOfWeek(new Date());
    const dates = weekDates(monday);
    const todayStr = toISODate(new Date());

    entriesList.innerHTML = dates.map((d) => {
      const dateStr = toISODate(d);
      const dayExpenses = expenses
        .filter((e) => e.date === dateStr)
        .sort((a, b) => a.id < b.id ? 1 : -1);
      const total = dailyTotal(dateStr);
      const overClass = total > dailyLimit ? 'over' : 'under';
      const isToday = dateStr === todayStr;
      const weekdayLabel = d.toLocaleDateString('en-GB', { weekday: 'short' });
      const dateLabel = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

      const itemsHtml = dayExpenses.length
        ? dayExpenses.map((e) => `
            <li class="entry-item" data-id="${e.id}">
              <span class="entry-category">${escapeHtml(CATEGORY_LABELS[e.category] || e.category)}</span>
              <span class="entry-amount">${formatEUR(e.amount)}</span>
              <span class="entry-desc">${escapeHtml(e.description)}</span>
              <span class="entry-actions">
                <button type="button" class="edit-btn" data-id="${e.id}">Edit</button>
                <button type="button" class="delete-btn" data-id="${e.id}">Delete</button>
              </span>
            </li>`).join('')
        : '<li class="empty">No expenses</li>';

      return `
        <div class="day-block ${isToday ? 'today' : ''}">
          <div class="day-header ${overClass}">
            <span>${weekdayLabel} ${dateLabel}${isToday ? ' (today)' : ''}</span>
            <span>${formatEUR(total)} / ${formatEUR(dailyLimit)}</span>
          </div>
          <ul class="entry-list">${itemsHtml}</ul>
        </div>`;
    }).join('');
  }

  // ---------- rendering: stats ----------
  function renderStats() {
    const monday = startOfWeek(new Date());
    const dates = weekDates(monday).map(toISODate);
    const totals = dates.map(dailyTotal);
    const weekAvg = totals.reduce((a, b) => a + b, 0) / totals.length;

    const byDate = {};
    expenses.forEach((e) => {
      byDate[e.date] = (byDate[e.date] || 0) + e.amount;
    });
    const activeTotals = Object.values(byDate);
    const allTimeAvg = activeTotals.length
      ? activeTotals.reduce((a, b) => a + b, 0) / activeTotals.length
      : 0;

    weekAvgEl.textContent = formatEUR(weekAvg);
    allTimeAvgEl.textContent = formatEUR(allTimeAvg);
  }

  // ---------- rendering: charts ----------
  function buildChartConfig(dates) {
    const labels = dates.map((d) => {
      const weekday = d.toLocaleDateString('en-GB', { weekday: 'short' });
      const dateLabel = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      return `${weekday} ${dateLabel}`;
    });
    const totals = dates.map((d) => dailyTotal(toISODate(d)));
    const barColors = totals.map((t) => (t > dailyLimit ? '#d1495b' : '#3d6fd1'));

    return {
      data: {
        labels,
        datasets: [
          {
            type: 'bar',
            label: 'Daily spend',
            data: totals,
            backgroundColor: barColors,
            borderRadius: 4,
            order: 2,
          },
          {
            type: 'line',
            label: `Daily limit (${formatEUR(dailyLimit)})`,
            data: labels.map(() => dailyLimit),
            borderColor: '#d1495b',
            borderDash: [6, 4],
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
            order: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${formatEUR(ctx.parsed.y)}`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: (v) => formatEUR(v) },
          },
        },
      },
    };
  }

  function buildCategoryChartConfig(dates) {
    const dateSet = new Set(dates.map(toISODate));
    const totalsByCategory = {};
    expenses
      .filter((e) => dateSet.has(e.date))
      .forEach((e) => {
        totalsByCategory[e.category] = (totalsByCategory[e.category] || 0) + e.amount;
      });

    const categories = Object.keys(CATEGORY_LABELS).filter((c) => totalsByCategory[c] > 0);
    if (categories.length === 0) return null;

    return {
      type: 'doughnut',
      data: {
        labels: categories.map((c) => CATEGORY_LABELS[c]),
        datasets: [{
          data: categories.map((c) => totalsByCategory[c]),
          backgroundColor: categories.map((c) => CATEGORY_COLORS[c]),
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: ${formatEUR(ctx.parsed)}`,
            },
          },
        },
      },
    };
  }

  function renderCharts() {
    const monday = startOfWeek(new Date());
    const currentDates = weekDates(monday);
    const previousDates = weekDates(addDays(monday, -7));

    const currentCtx = document.getElementById('currentWeekChart').getContext('2d');
    const previousCtx = document.getElementById('previousWeekChart').getContext('2d');
    const categoryCtx = document.getElementById('categoryChart').getContext('2d');

    if (currentWeekChart) currentWeekChart.destroy();
    if (previousWeekChart) previousWeekChart.destroy();
    if (categoryChart) { categoryChart.destroy(); categoryChart = null; }

    currentWeekChart = new Chart(currentCtx, buildChartConfig(currentDates));
    previousWeekChart = new Chart(previousCtx, buildChartConfig(previousDates));

    const categoryConfig = buildCategoryChartConfig(currentDates);
    if (categoryConfig) {
      categoryCtx.canvas.classList.remove('hidden');
      categoryEmptyState.classList.add('hidden');
      categoryChart = new Chart(categoryCtx, categoryConfig);
    } else {
      categoryCtx.canvas.classList.add('hidden');
      categoryEmptyState.classList.remove('hidden');
    }
  }

  function renderAll() {
    renderEntries();
    renderStats();
    renderCharts();
  }

  // ---------- form handling ----------
  function resetForm() {
    editingId = null;
    form.reset();
    dateInput.value = toISODate(new Date());
    submitBtn.textContent = 'Add Expense';
    cancelEditBtn.classList.add('hidden');
    formTitle.textContent = 'Add Expense';
  }

  function startEdit(id) {
    const entry = expenses.find((e) => e.id === id);
    if (!entry) return;
    dateInput.value = entry.date;
    categoryInput.value = entry.category;
    descriptionInput.value = entry.description || '';
    amountInput.value = entry.amount;
    editingId = id;
    submitBtn.textContent = 'Update Expense';
    cancelEditBtn.classList.remove('hidden');
    formTitle.textContent = 'Edit Expense';
    formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function deleteExpense(id) {
    if (!confirm('Delete this expense?')) return;
    expenses = expenses.filter((e) => e.id !== id);
    saveExpenses();
    if (editingId === id) resetForm();
    renderAll();
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const date = dateInput.value;
    const category = categoryInput.value;
    const description = descriptionInput.value.trim();
    const amount = parseFloat(amountInput.value);

    if (!date || !category || Number.isNaN(amount) || amount <= 0) return;

    if (editingId) {
      const idx = expenses.findIndex((x) => x.id === editingId);
      if (idx > -1) {
        expenses[idx] = { ...expenses[idx], date, category, description, amount };
      }
    } else {
      expenses.push({ id: uid(), date, category, description, amount });
    }

    saveExpenses();
    resetForm();
    renderAll();
  });

  cancelEditBtn.addEventListener('click', resetForm);

  entriesList.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.edit-btn');
    const delBtn = e.target.closest('.delete-btn');
    if (editBtn) startEdit(editBtn.dataset.id);
    if (delBtn) deleteExpense(delBtn.dataset.id);
  });

  // ---------- settings ----------
  settingsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = parseFloat(dailyLimitInput.value);
    if (!Number.isFinite(value) || value <= 0) return;
    dailyLimit = value;
    saveDailyLimit();
    dailyLimitDisplay.textContent = formatEUR(dailyLimit);
    renderAll();
  });

  // ---------- backup: export / import ----------
  exportBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(expenses, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses-backup-${toISODate(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  importInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target.result);
        if (!Array.isArray(data)) throw new Error('File must contain a list of expenses');
        const valid = data.every((x) => x && typeof x.date === 'string'
          && typeof x.amount === 'number' && typeof x.category === 'string');
        if (!valid) throw new Error('File format not recognized');

        if (confirm(`Import ${data.length} expense(s)? This will replace all current data.`)) {
          expenses = data.map((x) => ({
            id: x.id || uid(),
            date: x.date,
            category: x.category,
            description: x.description || '',
            amount: x.amount,
          }));
          saveExpenses();
          resetForm();
          renderAll();
        }
      } catch (err) {
        alert(`Failed to import: ${err.message}`);
      }
    };
    reader.readAsText(file);
    importInput.value = '';
  });

  // ---------- phone sync (GitHub Gist relay) ----------
  // The iPhone Shortcut PATCHes a gist file with one JSON-encoded expense per
  // save, so each save becomes a new commit. We never read the gist's current
  // content directly — we walk commits newer than the last one we've already
  // applied, oldest first, and merge each as one expense entry.
  const SYNC_GIST_KEY = 'expenseSyncGistId';
  const SYNC_TOKEN_KEY = 'expenseSyncToken';
  const SYNC_LASTSHA_KEY = 'expenseSyncLastSha';
  const SYNC_POLL_MS = 20000;

  const syncGistIdInput = document.getElementById('syncGistId');
  const syncTokenInput = document.getElementById('syncToken');
  const syncStatusEl = document.getElementById('syncStatus');
  const syncSaveBtn = document.getElementById('syncSaveBtn');
  const syncNowBtn = document.getElementById('syncNowBtn');
  let syncTimer = null;

  function syncSettings() {
    return {
      gistId: localStorage.getItem(SYNC_GIST_KEY) || '',
      token: localStorage.getItem(SYNC_TOKEN_KEY) || '',
    };
  }

  function showSyncStatus(msg, isError) {
    syncStatusEl.textContent = msg;
    syncStatusEl.style.color = isError ? 'var(--over)' : '';
  }

  function ghFetch(url) {
    const s = syncSettings();
    return fetch(url, {
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${s.token}` },
    });
  }

  function applySyncedEntry(entry) {
    if (!entry || typeof entry.date !== 'string' || !CATEGORY_LABELS[entry.category]) return false;
    const amount = parseFloat(entry.amount);
    if (!Number.isFinite(amount) || amount <= 0) return false;
    expenses.push({
      id: uid(),
      date: entry.date,
      category: entry.category,
      description: entry.description || '',
      amount,
    });
    saveExpenses();
    return true;
  }

  function runSync() {
    const s = syncSettings();
    if (!s.gistId || !s.token) { showSyncStatus('Set Gist ID + token first.', true); return; }
    showSyncStatus('Syncing…', false);
    ghFetch(`https://api.github.com/gists/${s.gistId}/commits?per_page=100`)
      .then((res) => {
        if (!res.ok) throw new Error(`commits fetch failed (${res.status})`);
        return res.json();
      })
      .then((commits) => {
        if (!Array.isArray(commits) || !commits.length) { showSyncStatus('No entries yet.', false); return; }
        const lastSha = localStorage.getItem(SYNC_LASTSHA_KEY);
        const idx = lastSha ? commits.findIndex((c) => c.version === lastSha) : -1;
        const fresh = (idx === -1 ? commits.slice() : commits.slice(0, idx)).reverse();
        if (!fresh.length) { showSyncStatus('Up to date.', false); return; }

        let applied = 0;
        const next = (i) => {
          if (i >= fresh.length) {
            localStorage.setItem(SYNC_LASTSHA_KEY, commits[0].version);
            resetForm();
            renderAll();
            showSyncStatus(`${applied} new expense(s) synced.`, false);
            return;
          }
          const sha = fresh[i].version;
          ghFetch(`https://api.github.com/gists/${s.gistId}/${sha}`)
            .then((r) => r.json())
            .then((data) => {
              const file = data.files && data.files['queue.json'];
              if (file && file.content) {
                try {
                  if (applySyncedEntry(JSON.parse(file.content))) applied += 1;
                } catch { /* placeholder or malformed revision, skip */ }
              }
              next(i + 1);
            })
            .catch(() => next(i + 1));
        };
        next(0);
      })
      .catch((err) => showSyncStatus(`Sync failed: ${err.message}`, true));
  }

  function restartSyncTimer() {
    if (syncTimer) clearInterval(syncTimer);
    const s = syncSettings();
    if (!s.gistId || !s.token) return;
    syncTimer = setInterval(() => {
      if (document.visibilityState === 'visible') runSync();
    }, SYNC_POLL_MS);
  }

  syncSaveBtn.addEventListener('click', () => {
    localStorage.setItem(SYNC_GIST_KEY, syncGistIdInput.value.trim());
    localStorage.setItem(SYNC_TOKEN_KEY, syncTokenInput.value.trim());
    showSyncStatus('Saved.', false);
    restartSyncTimer();
    runSync();
  });
  syncNowBtn.addEventListener('click', runSync);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') runSync();
  });

  (function initSync() {
    const s = syncSettings();
    syncGistIdInput.value = s.gistId;
    syncTokenInput.value = s.token;
    restartSyncTimer();
    if (s.gistId && s.token) runSync();
  })();

  // ---------- init ----------
  dailyLimitDisplay.textContent = formatEUR(dailyLimit);
  dailyLimitInput.value = dailyLimit;
  dateInput.value = toISODate(new Date());
  renderAll();
})();
