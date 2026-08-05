(() => {
  const STORAGE_KEY = 'expenses';
  const LIMIT_STORAGE_KEY = 'dailyLimit';
  const DEFAULT_DAILY_LIMIT = 25;
  const CATEGORIES = {
    Food: {
      label: 'Food',
      color: '#f2a541',
      subcategories: { Cafeteria: '#f2a541', 'Eating Outside': '#e8873a', 'Ordering Food': '#d9691f' },
    },
    Transport: {
      label: 'Transport',
      color: '#3d6fd1',
      subcategories: { 'Train/Bus': '#3d6fd1', Uber: '#5b8def', Scooter: '#2e5aa8' },
    },
    Lifestyle: {
      label: 'Lifestyle',
      color: '#8b5cf6',
      subcategories: { Drinks: '#8b5cf6', Dates: '#a78bfa', Tickets: '#7c3aed', Else: '#c4b5fd' },
    },
  };
  const LEGACY_CATEGORY_MAP = {
    Food: { category: 'Food', subcategory: 'Eating Outside' },
    Transport: { category: 'Transport', subcategory: 'Uber' },
    Cinema: { category: 'Lifestyle', subcategory: 'Tickets' },
    Shopping: { category: 'Lifestyle', subcategory: 'Else' },
    Other: { category: 'Lifestyle', subcategory: 'Else' },
  };
  const SUBSCRIPTIONS = [
    { name: 'Claude', amount: 22.17, day: 20 },
    { name: 'Spotify', amount: 13.99, day: 30 },
    { name: 'DAZN', amount: 44.99, day: 26 },
    { name: 'Viva Gym', amount: 33.90, day: 8 },
  ];

  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  function isValidCategory(category, subcategory) {
    return !!(CATEGORIES[category] && CATEGORIES[category].subcategories[subcategory]);
  }

  function isValidDate(date) {
    return typeof date === 'string' && DATE_RE.test(date);
  }

  function migrateExpenses(list) {
    let changed = false;
    const withValidDates = list.filter((e) => {
      if (isValidDate(e.date)) return true;
      changed = true;
      return false;
    });
    const migrated = withValidDates.map((e) => {
      if (isValidCategory(e.category, e.subcategory)) return e;
      changed = true;
      const fallback = LEGACY_CATEGORY_MAP[e.category] || { category: 'Lifestyle', subcategory: 'Else' };
      return { ...e, category: fallback.category, subcategory: fallback.subcategory };
    });
    return { migrated, changed };
  }

  let expenses = loadExpenses();
  {
    const { migrated, changed } = migrateExpenses(expenses);
    expenses = migrated;
    if (changed) saveExpenses();
  }
  let dailyLimit = loadDailyLimit();
  let currentScope = 'week';
  let currentPage = 'home';
  let editingId = null;
  let currentWeekChart = null;
  let previousWeekChart = null;
  let categoryChart = null;
  let subcategoryChart = null;
  let subscriptionsChart = null;
  let budgetGaugeChart = null;
  let ringCharts = {};

  // ---------- elements ----------
  const form = document.getElementById('expenseForm');
  const formTitle = document.getElementById('formTitle');
  const dateInput = document.getElementById('date');
  const categoryInput = document.getElementById('category');
  const subcategoryInput = document.getElementById('subcategory');
  const descriptionInput = document.getElementById('description');
  const amountInput = document.getElementById('amount');
  const submitBtn = document.getElementById('submitBtn');
  const cancelEditBtn = document.getElementById('cancelEditBtn');
  const entriesList = document.getElementById('entriesList');
  const scopeAvgEl = document.getElementById('scopeAvg');
  const scopeAvgLabel = document.getElementById('scopeAvgLabel');
  const scopeTotalEl = document.getElementById('scopeTotal');
  const scopeTotalLabel = document.getElementById('scopeTotalLabel');
  const mainChartTitle = document.getElementById('mainChartTitle');
  const previousWeekCard = document.getElementById('previousWeekCard');
  const exportBtn = document.getElementById('exportBtn');
  const importInput = document.getElementById('importInput');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const headerMood = document.getElementById('headerMood');
  const formCard = document.getElementById('formCard');
  const settingsForm = document.getElementById('settingsForm');
  const dailyLimitInput = document.getElementById('dailyLimitInput');
  const categoryEmptyState = document.getElementById('categoryEmptyState');
  const subcategoryChartSelect = document.getElementById('subcategoryChartSelect');
  const subcategoryEmptyState = document.getElementById('subcategoryEmptyState');
  const subscriptionsStat = document.getElementById('subscriptionsStat');
  const subscriptionsList = document.getElementById('subscriptionsList');
  const themeToggle = document.getElementById('themeToggle');
  const appNav = document.getElementById('appNav');

  // ---------- theme ----------
  const THEME_KEY = 'expenseTrackerTheme';

  function applyTheme(mode) {
    if (mode) document.documentElement.setAttribute('data-theme', mode);
    else document.documentElement.removeAttribute('data-theme');
    themeToggle.textContent = `Theme: ${mode ? mode.charAt(0).toUpperCase() + mode.slice(1) : 'Auto'}`;
  }

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  (function initTheme() {
    applyTheme(localStorage.getItem(THEME_KEY) || null);
  })();

  themeToggle.addEventListener('click', () => {
    const order = [null, 'dark', 'light'];
    const cur = localStorage.getItem(THEME_KEY);
    const idx = order.indexOf(cur) === -1 ? 0 : order.indexOf(cur);
    const next = order[(idx + 1) % order.length];
    if (next) localStorage.setItem(THEME_KEY, next);
    else localStorage.removeItem(THEME_KEY);
    applyTheme(next);
    renderAll();
  });

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

  function currentMonthDates() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1));
  }

  // Returns an array of Date objects for week/month scope, or null for "all time"
  // (unbounded — callers that need a Set for filtering treat null as "no filter").
  function scopeDates() {
    if (currentScope === 'week') return weekDates(startOfWeek(new Date()));
    if (currentScope === 'month') return currentMonthDates();
    return null;
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

  // ---------- category dropdowns ----------
  function populateCategoryOptions() {
    categoryInput.innerHTML = Object.keys(CATEGORIES)
      .map((c) => `<option value="${c}">${CATEGORIES[c].label}</option>`).join('');
  }

  function populateSubcategoryOptions(selected) {
    const cat = CATEGORIES[categoryInput.value];
    const subs = cat ? Object.keys(cat.subcategories) : [];
    subcategoryInput.innerHTML = subs.map((s) => `<option value="${s}">${s}</option>`).join('');
    if (selected && subs.includes(selected)) subcategoryInput.value = selected;
  }

  categoryInput.addEventListener('change', () => populateSubcategoryOptions());

  function populateSubcategoryChartSelect() {
    subcategoryChartSelect.innerHTML = Object.keys(CATEGORIES)
      .map((c) => `<option value="${c}">${CATEGORIES[c].label}</option>`).join('');
  }

  subcategoryChartSelect.addEventListener('change', renderCharts);

  // ---------- data queries ----------
  function dailyTotal(dateStr) {
    return expenses
      .filter((e) => e.date === dateStr)
      .reduce((sum, e) => sum + e.amount, 0);
  }

  // ---------- rendering: entries (always current week) ----------
  function renderEntries() {
    const todayStr = toISODate(new Date());
    const dateStrs = weekDates(startOfWeek(new Date())).map(toISODate);

    entriesList.innerHTML = dateStrs.map((dateStr) => {
      const d = new Date(`${dateStr}T00:00:00`);
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
              <span class="entry-category"><span class="category-dot" style="background:${(CATEGORIES[e.category] && CATEGORIES[e.category].subcategories[e.subcategory]) || (CATEGORIES[e.category] && CATEGORIES[e.category].color) || '#94a3b8'}"></span>${escapeHtml((CATEGORIES[e.category] && CATEGORIES[e.category].label) || e.category)} · ${escapeHtml(e.subcategory || '')}</span>
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
  const SCOPE_LABELS = { week: "This week's", month: "This month's", all: 'All-time' };

  function renderStats() {
    const dates = scopeDates();
    const dateSet = dates ? new Set(dates.map(toISODate)) : null;
    const relevant = expenses.filter((e) => !dateSet || dateSet.has(e.date));
    const total = relevant.reduce((sum, e) => sum + e.amount, 0);
    const activeDays = new Set(relevant.map((e) => e.date)).size;
    const avg = activeDays ? total / activeDays : 0;

    const label = SCOPE_LABELS[currentScope];
    scopeAvgLabel.textContent = `${label} average / day`;
    scopeTotalLabel.textContent = `${label} total`;
    scopeAvgEl.textContent = formatEUR(avg);
    scopeTotalEl.textContent = formatEUR(total);
  }

  // ---------- rendering: today's gauge + category rings ----------
  function moodSentence(pct) {
    if (pct <= 0) return 'Not a single euro spent today. Suspicious.';
    if (pct < 40) return 'Off to a light start — plenty of room to spare.';
    if (pct < 70) return 'Cruising along nicely, nothing to worry about.';
    if (pct < 90) return 'Getting close to the limit — maybe skip that extra coffee.';
    if (pct < 100) return 'So close to the edge you can smell the limit.';
    if (pct === 100) return 'Right on the limit. Precision budgeting at its finest.';
    if (pct <= 130) return 'A little over budget today... it happens to the best of us.';
    return "Well, today's budget left the chat entirely.";
  }

  // What the "Today" gauge card shows for the active scope tab. Week keeps the
  // literal daily snapshot; Month/Total scale (or drop) the limit accordingly.
  function gaugePeriodContext() {
    if (currentScope === 'week') {
      const todayStr = toISODate(new Date());
      return {
        title: 'Today',
        spent: dailyTotal(todayStr),
        limit: dailyLimit,
        limitLabel: 'daily limit',
        dateSet: new Set([todayStr]),
      };
    }
    if (currentScope === 'month') {
      const dateSet = new Set(currentMonthDates().map(toISODate));
      const spent = expenses.filter((e) => dateSet.has(e.date)).reduce((sum, e) => sum + e.amount, 0);
      return {
        title: 'This Month',
        spent,
        limit: dailyLimit * 30,
        limitLabel: 'monthly limit',
        dateSet,
      };
    }
    return {
      title: 'All Time',
      spent: expenses.reduce((sum, e) => sum + e.amount, 0),
      limit: null,
      limitLabel: null,
      dateSet: null,
    };
  }

  function renderGauge() {
    const todayStr = toISODate(new Date());
    const spentToday = dailyTotal(todayStr);
    const todayPct = dailyLimit > 0 ? Math.round((spentToday / dailyLimit) * 100) : 0;
    headerMood.textContent = moodSentence(todayPct);

    const { title, spent, limit, limitLabel } = gaugePeriodContext();
    document.getElementById('gaugeCardTitle').textContent = title;
    document.getElementById('gaugeSpentToday').textContent = formatEUR(spent);
    const pctEl = document.getElementById('gaugePct');

    const canvas = document.getElementById('budgetGauge');
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, canvas.clientWidth || 260, 0);

    let gaugeData;
    if (limit === null) {
      // No limit to gauge against (Total) — full decorative ring, no percentage text.
      pctEl.textContent = '';
      gradient.addColorStop(0, '#8b5cf6');
      gradient.addColorStop(1, '#f2a541');
      gaugeData = [1, 0];
    } else {
      const remaining = Math.max(limit - spent, 0);
      const over = spent > limit;
      const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
      pctEl.textContent = `${pct}% of ${formatEUR(limit)} ${limitLabel}`;
      if (over) {
        gradient.addColorStop(0, '#e0555f');
        gradient.addColorStop(1, '#c23f49');
      } else {
        gradient.addColorStop(0, '#8b5cf6');
        gradient.addColorStop(1, '#f2a541');
      }
      gaugeData = over ? [limit, 0] : [spent, remaining];
    }

    if (budgetGaugeChart) { budgetGaugeChart.destroy(); budgetGaugeChart = null; }
    budgetGaugeChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: gaugeData,
          backgroundColor: [gradient, cssVar('--surface-2')],
          borderWidth: 0,
          borderRadius: 20,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '90%',
        rotation: 270,
        circumference: 180,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
      },
    });
  }

  // Dedicated purple->orange accent colors for the Home rings only — CATEGORIES.color
  // stays as-is for charts/entry dots elsewhere, this is just the "stand out" treatment.
  const RING_COLORS = { Food: '#8b5cf6', Transport: '#bf819c', Lifestyle: '#f2a541' };

  function renderRings() {
    const { dateSet } = gaugePeriodContext();
    const periodExpenses = expenses.filter((e) => !dateSet || dateSet.has(e.date));
    const totalPeriod = periodExpenses.reduce((sum, e) => sum + e.amount, 0);
    const container = document.getElementById('categoryRings');

    Object.values(ringCharts).forEach((c) => c && c.destroy());
    ringCharts = {};

    container.innerHTML = Object.keys(CATEGORIES).map((c) => `
      <div class="ring-item">
        <div class="ring-canvas-wrap">
          <canvas id="ring${c}"></canvas>
          <span class="ring-value" id="ringValue${c}">€0</span>
        </div>
        <span class="ring-label">${CATEGORIES[c].label}</span>
      </div>
    `).join('');

    Object.keys(CATEGORIES).forEach((c) => {
      const amount = periodExpenses
        .filter((e) => e.category === c)
        .reduce((sum, e) => sum + e.amount, 0);
      const valueEl = document.getElementById(`ringValue${c}`);
      valueEl.textContent = formatEUR(amount).replace(/,00\s?€/, '€').replace('€', '');
      valueEl.style.color = RING_COLORS[c];
      const ctx = document.getElementById(`ring${c}`).getContext('2d');
      ringCharts[c] = new Chart(ctx, {
        type: 'doughnut',
        data: {
          datasets: [{
            data: totalPeriod > 0 ? [amount, Math.max(totalPeriod - amount, 0)] : [0, 1],
            backgroundColor: [RING_COLORS[c], cssVar('--surface-2')],
            borderWidth: 0,
            borderRadius: 10,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '88%',
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
        },
      });
    });
  }

  // ---------- exploded-donut leader-line plugin ----------
  const leaderLinePlugin = {
    id: 'leaderLines',
    afterDraw(chart) {
      const meta = chart.getDatasetMeta(0);
      if (!meta || !meta.data || !meta.data.length) return;
      const dataset = chart.data.datasets[0];
      const total = dataset.data.reduce((a, b) => a + b, 0);
      if (!total) return;
      const { ctx } = chart;
      ctx.save();
      ctx.font = '11px ' + (cssVar('--font-body') || 'sans-serif');
      meta.data.forEach((arc, i) => {
        const value = dataset.data[i];
        if (!value) return;
        const pct = Math.round((value / total) * 100);
        const angle = (arc.startAngle + arc.endAngle) / 2;
        const outerR = arc.outerRadius;
        const cx = arc.x;
        const cy = arc.y;
        const x1 = cx + Math.cos(angle) * (outerR + 3);
        const y1 = cy + Math.sin(angle) * (outerR + 3);
        const x2 = cx + Math.cos(angle) * (outerR + 11);
        const y2 = cy + Math.sin(angle) * (outerR + 11);
        ctx.strokeStyle = cssVar('--ink-muted') || '#999';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.fillStyle = cssVar('--ink-secondary') || '#666';
        ctx.textAlign = x2 >= cx ? 'left' : 'right';
        ctx.fillText(`${chart.data.labels[i]} ${pct}%`, x2 + (x2 >= cx ? 3 : -3), y2 + 3);
      });
      ctx.restore();
    },
  };

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
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 }, color: cssVar('--ink-secondary') } },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${formatEUR(ctx.parsed.y)}`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: (v) => formatEUR(v), color: cssVar('--ink-secondary') },
            grid: { color: cssVar('--rule') },
          },
          x: {
            ticks: { color: cssVar('--ink-secondary') },
            grid: { display: false },
          },
        },
      },
    };
  }

  function buildMonthlyTotalsChartConfig() {
    const totalsByMonth = {};
    expenses.forEach((e) => {
      const ym = e.date.slice(0, 7);
      totalsByMonth[ym] = (totalsByMonth[ym] || 0) + e.amount;
    });
    const months = Object.keys(totalsByMonth).sort();
    const labels = months.map((ym) => {
      const [y, m] = ym.split('-').map(Number);
      return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
    });
    const totals = months.map((ym) => totalsByMonth[ym]);
    const budgetLine = months.map((ym) => {
      const [y, m] = ym.split('-').map(Number);
      const daysInMonth = new Date(y, m, 0).getDate();
      return daysInMonth * dailyLimit;
    });
    const barColors = totals.map((t, i) => (t > budgetLine[i] ? '#d1495b' : '#3d6fd1'));

    return {
      data: {
        labels,
        datasets: [
          {
            type: 'bar',
            label: 'Monthly spend',
            data: totals,
            backgroundColor: barColors,
            borderRadius: 4,
            order: 2,
          },
          {
            type: 'line',
            label: 'Monthly budget (days × daily limit)',
            data: budgetLine,
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
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 }, color: cssVar('--ink-secondary') } },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${formatEUR(ctx.parsed.y)}`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: (v) => formatEUR(v), color: cssVar('--ink-secondary') },
            grid: { color: cssVar('--rule') },
          },
          x: {
            ticks: { color: cssVar('--ink-secondary') },
            grid: { display: false },
          },
        },
      },
    };
  }

  function buildCategoryChartConfig(dateSet) {
    const totalsByCategory = {};
    expenses
      .filter((e) => !dateSet || dateSet.has(e.date))
      .forEach((e) => {
        totalsByCategory[e.category] = (totalsByCategory[e.category] || 0) + e.amount;
      });

    const categories = Object.keys(CATEGORIES).filter((c) => totalsByCategory[c] > 0);
    if (categories.length === 0) return null;

    return {
      type: 'doughnut',
      data: {
        labels: categories.map((c) => CATEGORIES[c].label),
        datasets: [{
          data: categories.map((c) => totalsByCategory[c]),
          backgroundColor: categories.map((c) => CATEGORIES[c].color),
          offset: categories.map(() => 10),
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: 48 },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: ${formatEUR(ctx.parsed)}`,
            },
          },
        },
      },
      plugins: [leaderLinePlugin],
    };
  }

  function buildSubcategoryChartConfigForCategory(dateSet, categoryKey) {
    const subs = CATEGORIES[categoryKey].subcategories;
    const totals = {};
    expenses
      .filter((e) => (!dateSet || dateSet.has(e.date)) && e.category === categoryKey && subs[e.subcategory])
      .forEach((e) => {
        totals[e.subcategory] = (totals[e.subcategory] || 0) + e.amount;
      });

    const keys = Object.keys(subs).filter((s) => totals[s] > 0);
    if (keys.length === 0) return null;

    return {
      type: 'doughnut',
      data: {
        labels: keys,
        datasets: [{
          data: keys.map((s) => totals[s]),
          backgroundColor: keys.map((s) => subs[s]),
          offset: keys.map(() => 10),
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: 48 },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: ${formatEUR(ctx.parsed)}`,
            },
          },
        },
      },
      plugins: [leaderLinePlugin],
    };
  }

  function renderCharts() {
    const dates = scopeDates(); // Date[] for week/month, null for all
    const dateSet = dates ? new Set(dates.map(toISODate)) : null;

    const currentCtx = document.getElementById('currentWeekChart').getContext('2d');
    const categoryCtx = document.getElementById('categoryChart').getContext('2d');

    if (currentWeekChart) { currentWeekChart.destroy(); currentWeekChart = null; }
    if (previousWeekChart) { previousWeekChart.destroy(); previousWeekChart = null; }
    if (categoryChart) { categoryChart.destroy(); categoryChart = null; }

    currentWeekChart = new Chart(currentCtx, currentScope === 'all' ? buildMonthlyTotalsChartConfig() : buildChartConfig(dates));

    if (currentScope === 'week') {
      previousWeekCard.classList.remove('hidden');
      const monday = startOfWeek(new Date());
      const previousCtx = document.getElementById('previousWeekChart').getContext('2d');
      previousWeekChart = new Chart(previousCtx, buildChartConfig(weekDates(addDays(monday, -7))));
    } else {
      previousWeekCard.classList.add('hidden');
    }

    const categoryConfig = buildCategoryChartConfig(dateSet);
    if (categoryConfig) {
      categoryCtx.canvas.classList.remove('hidden');
      categoryEmptyState.classList.add('hidden');
      categoryChart = new Chart(categoryCtx, categoryConfig);
    } else {
      categoryCtx.canvas.classList.add('hidden');
      categoryEmptyState.classList.remove('hidden');
    }

    const subcategoryCtx = document.getElementById('subcategoryChart').getContext('2d');
    if (subcategoryChart) { subcategoryChart.destroy(); subcategoryChart = null; }
    const subcategoryConfig = buildSubcategoryChartConfigForCategory(dateSet, subcategoryChartSelect.value);
    if (subcategoryConfig) {
      subcategoryCtx.canvas.classList.remove('hidden');
      subcategoryEmptyState.classList.add('hidden');
      subcategoryChart = new Chart(subcategoryCtx, subcategoryConfig);
    } else {
      subcategoryCtx.canvas.classList.add('hidden');
      subcategoryEmptyState.classList.remove('hidden');
    }
  }

  // ---------- rendering: subscriptions ----------
  function renderSubscriptions() {
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const subscriptionTotal = SUBSCRIPTIONS.reduce((sum, s) => sum + s.amount, 0);
    const monthlyLoggedTotal = expenses
      .filter((e) => e.date.startsWith(currentYearMonth))
      .reduce((sum, e) => sum + e.amount, 0);
    const denom = subscriptionTotal + monthlyLoggedTotal;
    const pct = denom > 0 ? (subscriptionTotal / denom) * 100 : 0;

    subscriptionsStat.textContent = `${formatEUR(subscriptionTotal)}/mo · ${pct.toFixed(0)}% of this month's spending`;

    subscriptionsList.innerHTML = SUBSCRIPTIONS.map((s) => `
      <li class="subscription-item">
        <span class="subscription-name">${escapeHtml(s.name)}</span>
        <span class="subscription-day">day ${s.day}</span>
        <span class="subscription-amount">${formatEUR(s.amount)}</span>
      </li>`).join('');

    const subCtx = document.getElementById('subscriptionsChart').getContext('2d');
    if (subscriptionsChart) { subscriptionsChart.destroy(); subscriptionsChart = null; }
    subscriptionsChart = new Chart(subCtx, {
      type: 'doughnut',
      data: {
        labels: ['Subscriptions', 'Other spending'],
        datasets: [{
          data: [subscriptionTotal, monthlyLoggedTotal],
          backgroundColor: ['#d1495b', '#94a3b8'],
          offset: [10, 10],
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: 48 },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: ${formatEUR(ctx.parsed)}`,
            },
          },
        },
      },
      plugins: [leaderLinePlugin],
    });
  }

  function renderAll() {
    renderEntries();
    renderStats();
    renderCharts();
    renderSubscriptions();
    renderGauge();
    renderRings();
  }

  // ---------- scope tabs (Week/Month/Total) ----------
  function currentMonthLabel() {
    return new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  }

  function setScope(scope) {
    currentScope = scope;
    document.querySelectorAll('.scope-tab').forEach((btn) => {
      const active = btn.dataset.scope === scope;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
    });
    mainChartTitle.textContent = scope === 'week' ? 'This Week (Mon–Sun)' : scope === 'month' ? currentMonthLabel() : 'All Time';
    renderAll();
  }

  document.querySelectorAll('.scope-tab').forEach((btn) => {
    btn.addEventListener('click', () => setScope(btn.dataset.scope));
  });

  // ---------- page navigation ----------
  function setPage(page) {
    currentPage = page;
    document.querySelectorAll('.page').forEach((section) => {
      section.classList.toggle('hidden', section.dataset.page !== page);
    });
    appNav.querySelectorAll('.app-nav-item').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.page === page);
    });
    if (page === 'add') amountInput.focus();
    // Charts built while their page was display:none get created with a
    // zero-size canvas and never recover — rebuild once the page is visible.
    if (page === 'charts') { renderCharts(); renderSubscriptions(); }
    if (page === 'home') { renderCharts(); renderGauge(); renderRings(); }
  }

  appNav.querySelectorAll('.app-nav-item').forEach((btn) => {
    btn.addEventListener('click', () => setPage(btn.dataset.page));
  });

  // ---------- form handling ----------
  function resetForm() {
    editingId = null;
    form.reset();
    dateInput.value = toISODate(new Date());
    populateSubcategoryOptions();
    submitBtn.textContent = 'Add Expense';
    cancelEditBtn.classList.add('hidden');
    formTitle.textContent = 'Add Expense';
  }

  function startEdit(id) {
    const entry = expenses.find((e) => e.id === id);
    if (!entry) return;
    dateInput.value = entry.date;
    categoryInput.value = entry.category;
    populateSubcategoryOptions(entry.subcategory);
    descriptionInput.value = entry.description || '';
    amountInput.value = entry.amount;
    editingId = id;
    submitBtn.textContent = 'Update Expense';
    cancelEditBtn.classList.remove('hidden');
    formTitle.textContent = 'Edit Expense';
    setPage('add');
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
    const subcategory = subcategoryInput.value;
    const description = descriptionInput.value.trim();
    const amount = parseFloat(amountInput.value);

    if (!date || !isValidCategory(category, subcategory) || Number.isNaN(amount) || amount <= 0) return;

    if (editingId) {
      const idx = expenses.findIndex((x) => x.id === editingId);
      if (idx > -1) {
        expenses[idx] = { ...expenses[idx], date, category, subcategory, description, amount };
      }
    } else {
      expenses.push({ id: uid(), date, category, subcategory, description, amount });
    }

    saveExpenses();
    resetForm();
    renderAll();
    setPage('home');
  });

  cancelEditBtn.addEventListener('click', () => {
    resetForm();
    setPage('home');
  });

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
          const imported = data.map((x) => ({
            id: x.id || uid(),
            date: x.date,
            category: x.category,
            subcategory: x.subcategory,
            description: x.description || '',
            amount: x.amount,
          }));
          expenses = migrateExpenses(imported).migrated;
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

  clearAllBtn.addEventListener('click', () => {
    if (!confirm('Delete ALL expenses on this device? This cannot be undone.')) return;
    expenses = [];
    saveExpenses();
    resetForm();
    renderAll();
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
  const syncStatusTopEl = document.getElementById('syncStatusTop');
  const syncSaveBtn = document.getElementById('syncSaveBtn');
  const syncNowBtnTop = document.getElementById('syncNowBtnTop');
  let syncTimer = null;

  function syncSettings() {
    return {
      gistId: localStorage.getItem(SYNC_GIST_KEY) || '',
      token: localStorage.getItem(SYNC_TOKEN_KEY) || '',
    };
  }

  function showSyncStatus(msg, isError) {
    [syncStatusEl, syncStatusTopEl].forEach((el) => {
      el.textContent = msg;
      el.style.color = isError ? 'var(--bad)' : '';
    });
  }

  function ghFetch(url) {
    const s = syncSettings();
    return fetch(url, {
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${s.token}` },
    });
  }

  function applySyncedEntry(entry) {
    if (!entry || !isValidDate(entry.date) || !isValidCategory(entry.category, entry.subcategory)) return false;
    const amount = parseFloat(entry.amount);
    if (!Number.isFinite(amount) || amount <= 0) return false;
    expenses.push({
      id: uid(),
      date: entry.date,
      category: entry.category,
      subcategory: entry.subcategory,
      description: entry.description || '',
      amount,
    });
    saveExpenses();
    return true;
  }

  function runSync() {
    const s = syncSettings();
    if (!s.gistId || !s.token) { showSyncStatus('Set Gist ID + token first.', true); return; }
    syncNowBtnTop.classList.add('syncing');
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
      .catch((err) => showSyncStatus(`Sync failed: ${err.message}`, true))
      .finally(() => syncNowBtnTop.classList.remove('syncing'));
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
  syncNowBtnTop.addEventListener('click', runSync);
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
  populateCategoryOptions();
  populateSubcategoryOptions();
  populateSubcategoryChartSelect();
  dailyLimitInput.value = dailyLimit;
  dateInput.value = toISODate(new Date());
  setPage('home');
  renderAll();
})();
