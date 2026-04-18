// ─── Data ────────────────────────────────────────────────────────────────────

const accounts = [
  { account_id: "acc_1", color: "#6366f1" },
  { account_id: "acc_2", color: "#8b5cf6" },
  { account_id: "acc_3", color: "#ec4899" },
  { account_id: "acc_4", color: "#06b6d4" },
];

const transactions = [
  { transaction_id: "t1",  account_id: "acc_3", amount: 4.95,   date: "2026-04-18", name: "Spotify",         category: ["Entertainment", "Music"] },
  { transaction_id: "t16", account_id: "acc_3", amount: 17.99,  date: "2026-04-18", name: "Hulu",            category: ["Entertainment", "Video Streaming"] },
  { transaction_id: "t9",  account_id: "acc_3", amount: 24.99,  date: "2026-04-18", name: "Netflix",         category: ["Entertainment", "Video Streaming"] },
  { transaction_id: "t17", account_id: "acc_3", amount: 13.99,  date: "2026-04-17", name: "Disney+",         category: ["Entertainment", "Video Streaming"] },
  { transaction_id: "t23", account_id: "acc_3", amount: 10.99,  date: "2026-04-17", name: "Apple Music",     category: ["Entertainment", "Music"] },
  { transaction_id: "t20", account_id: "acc_1", amount: 19.99,  date: "2026-04-17", name: "YouTube Premium", category: ["Entertainment", "Video Streaming"] },
  { transaction_id: "t2",  account_id: "acc_1", amount: 89.24,  date: "2026-04-17", name: "Whole Foods",     category: ["Food and Drink", "Groceries"] },
  { transaction_id: "t18", account_id: "acc_1", amount: 54.99,  date: "2026-04-16", name: "Adobe CC",        category: ["Service", "Subscription"] },
  { transaction_id: "t4",  account_id: "acc_1", amount: -3200,  date: "2026-04-15", name: "Direct Deposit",  category: ["Transfer", "Payroll"] },
  { transaction_id: "t8",  account_id: "acc_1", amount: 65.00,  date: "2026-04-15", name: "AT&T",            category: ["Service", "Telecommunication"] },
];

const balanceHistory = [
  { date: "Nov 1",  checking: 14200, savings: 52000, investments: 91000 },
  { date: "Nov 15", checking: 13600, savings: 51200, investments: 72000 },
  { date: "Dec 1",  checking: 12900, savings: 50100, investments: 51000 },
  { date: "Dec 15", checking: 11800, savings: 48700, investments: 28000 },
  { date: "Jan 1",  checking: 10400, savings: 47000, investments: 11000 },
  { date: "Jan 15", checking: 9100,  savings: 45200, investments: 0 },
  { date: "Feb 1",  checking: 7800,  savings: 43100, investments: 0 },
  { date: "Feb 15", checking: 6200,  savings: 40800, investments: 0 },
  { date: "Mar 1",  checking: 4900,  savings: 37500, investments: 0 },
  { date: "Mar 15", checking: 3400,  savings: 33200, investments: 0 },
  { date: "Apr 1",  checking: 2100,  savings: 28400, investments: 0 },
  { date: "Apr 15", checking: 847,   savings: 50,    investments: 0 },
];

const beforeProjectionData = [
  { month: "Apr '26", balance: 897 },
  { month: "May '26", balance: 832 },
  { month: "Jun '26", balance: 762 },
  { month: "Jul '26", balance: 687 },
  { month: "Aug '26", balance: 607 },
  { month: "Sep '26", balance: 522 },
  { month: "Oct '26", balance: 432 },
  { month: "Nov '26", balance: 337 },
  { month: "Dec '26", balance: 237 },
  { month: "Jan '27", balance: 132 },
  { month: "Feb '27", balance: 22 },
  { month: "Mar '27", balance: -93 },
];

const projectionData = [
  { month: "Nov '25", earned: 6400, spent: 4120 },
  { month: "Dec '25", earned: 7200, spent: 5340 },
  { month: "Jan '26", earned: 6400, spent: 5890 },
  { month: "Feb '26", earned: 6400, spent: 6240 },
  { month: "Mar '26", earned: 6400, spent: 6580 },
  { month: "Apr '26", earned: 6400, spent: 6820 },
  { month: "May '26", earned: 6400, spent: 7100, projected: true },
  { month: "Jun '26", earned: 6400, spent: 7390, projected: true },
  { month: "Jul '26", earned: 6400, spent: 7650, projected: true },
  { month: "Aug '26", earned: 6400, spent: 7940, projected: true },
  { month: "Sep '26", earned: 6400, spent: 8200, projected: true },
  { month: "Oct '26", earned: 6400, spent: 8480, projected: true },
];

// ─── State ────────────────────────────────────────────────────────────────────

const cancelled = new Set();
let activeView = 4;
let confirming = null;

const SUBS = ["Music", "Video Streaming", "Subscription", "Telecommunication", "Gyms", "Video Games"];

function isSubscription(t) {
  return t.category.some(c => SUBS.includes(c));
}

function getMonthlySavings() {
  return transactions
    .filter(t => cancelled.has(t.transaction_id))
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
}

// ─── Category colours ─────────────────────────────────────────────────────────

const catColors = {
  "Music":             { text: "#fb923c", bg: "rgba(251,146,60,0.14)" },
  "Video Streaming":   { text: "#c084fc", bg: "rgba(192,132,252,0.14)" },
  "Payroll":           { text: "#34d399", bg: "rgba(52,211,153,0.14)" },
  "Telecommunication": { text: "#22d3ee", bg: "rgba(34,211,238,0.14)" },
  "Subscription":      { text: "#22d3ee", bg: "rgba(34,211,238,0.14)" },
  "Groceries":         { text: "#fb923c", bg: "rgba(251,146,60,0.14)" },
  "Taxi":              { text: "#60a5fa", bg: "rgba(96,165,250,0.14)" },
  "Video Games":       { text: "#818cf8", bg: "rgba(129,140,248,0.14)" },
  "Gyms":              { text: "#4ade80", bg: "rgba(74,222,128,0.14)" },
};

function getCatStyle(category) {
  const sub = category[1] || category[0];
  return catColors[sub] || { text: "#94a3b8", bg: "rgba(148,163,184,0.14)" };
}

function getAccColor(id) {
  return (accounts.find(a => a.account_id === id) || {}).color || "#64748b";
}

// ─── SVG helpers ──────────────────────────────────────────────────────────────

const CW = 280, CH = 92;

function f(n) { return n.toFixed(1); }

function toY(val, min, max) {
  return CH - 2 - ((val - min) / (max - min || 1)) * (CH - 6);
}

function toX(i, n) {
  return (i / (n - 1)) * CW;
}

function smoothPath(pts) {
  let d = `M ${f(pts[0].x)} ${f(pts[0].y)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${f(cp1x)} ${f(cp1y)}, ${f(cp2x)} ${f(cp2y)}, ${f(p2.x)} ${f(p2.y)}`;
  }
  return d;
}

function areaPath(pts, baseY, linePath) {
  return `${linePath} L ${f(pts[pts.length - 1].x)} ${f(baseY)} L ${f(pts[0].x)} ${f(baseY)} Z`;
}

function grid() {
  let lines = '';
  for (let i = 1; i < 4; i++) {
    const y = f((i / 4) * CH);
    lines += `<line x1="0" y1="${y}" x2="${CW}" y2="${y}" stroke="rgba(0,0,0,0.08)" stroke-dasharray="3,3"/>`;
  }
  return lines;
}

function xLabel(text, x, anchor = 'middle') {
  return `<text x="${f(x)}" y="${CH + 12}" fill="#555555" font-size="7" text-anchor="${anchor}" font-family="Reactor7, sans-serif">${text}</text>`;
}

function refArea(x1, x2, fill) {
  return `<rect x="${f(x1)}" y="0" width="${f(x2 - x1)}" height="${CH}" fill="${fill}"/>`;
}

function refLine(x, label) {
  return `<line x1="${f(x)}" y1="0" x2="${f(x)}" y2="${CH}" stroke="rgba(0,0,0,0.25)" stroke-dasharray="4,3"/>
    <text x="${f(x + 3)}" y="10" fill="#555555" font-size="7" font-family="Reactor7, sans-serif">${label}</text>`;
}

function hRefLine(y) {
  return `<line x1="0" y1="${f(y)}" x2="${CW}" y2="${f(y)}" stroke="rgba(0,0,0,0.2)" stroke-dasharray="4,3"/>
    <text x="${CW - 2}" y="${f(y - 2)}" fill="#555555" font-size="7" text-anchor="end" font-family="Reactor7, sans-serif">$0</text>`;
}

// ─── Chart views ──────────────────────────────────────────────────────────────

function buildView4() {
  const n = balanceHistory.length;
  const allVals = balanceHistory.flatMap(d => [d.checking, d.savings, d.investments]);
  const maxV = Math.max(...allVals);

  const series = [
    { key: 'investments', stroke: '#a78bfa', gid: 'gI', gColor: '#a78bfa' },
    { key: 'savings',     stroke: '#6366f1', gid: 'gS', gColor: '#6366f1' },
    { key: 'checking',    stroke: '#10b981', gid: 'gC', gColor: '#10b981' },
  ];

  const defs = `<defs>${series.map(s =>
    `<linearGradient id="${s.gid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${s.gColor}" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="${s.gColor}" stop-opacity="0.02"/>
    </linearGradient>`
  ).join('')}</defs>`;

  let paths = series.map(s => {
    const pts = balanceHistory.map((d, i) => ({ x: toX(i, n), y: toY(d[s.key], 0, maxV) }));
    const line = smoothPath(pts);
    return `<path d="${areaPath(pts, CH, line)}" fill="url(#${s.gid})"/>
      <path d="${line}" fill="none" stroke="${s.stroke}" stroke-width="1.5" stroke-linejoin="round"/>`;
  }).join('');

  const xlabels = ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'].map((l, i) =>
    xLabel(l, toX(i * 2, n))
  ).join('');

  return svg(`${defs}${grid()}${paths}${xlabels}`);
}

function buildView1() {
  const savings = getMonthlySavings();
  const data = projectionData.map((d, i) => ({
    ...d,
    spent: (d.projected || i === 5) ? (d.spent - savings) : d.spent,
  }));
  const n = data.length;
  const allVals = data.flatMap(d => [d.earned, d.spent]);
  const minV = Math.min(...allVals), maxV = Math.max(...allVals);

  const todayX = toX(5, n); // Apr '26 is index 5

  const earnedPts = data.map((d, i) => ({ x: toX(i, n), y: toY(d.earned, minV, maxV) }));
  const spentPts  = data.map((d, i) => ({ x: toX(i, n), y: toY(d.spent,  minV, maxV) }));

  const areas = refArea(0, todayX, 'rgba(0,0,0,0.03)') +
    refArea(todayX, CW, 'rgba(239,68,68,0.07)') +
    refLine(todayX, 'Today');

  const lines = `<path d="${smoothPath(earnedPts)}" fill="none" stroke="#10b981" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="${smoothPath(spentPts)}" fill="none" stroke="#ef4444" stroke-width="1.5" stroke-linejoin="round"/>`;

  const xlabels = ["Nov '25", "Feb '26", "Apr '26", "Jul '26", "Oct '26"].map((l, i) => {
    const xi = [0, 3, 5, 8, 11][i];
    return xLabel(l, toX(xi, n));
  }).join('');

  return svg(`${grid()}${areas}${lines}${xlabels}`);
}

function buildView2() {
  const n = beforeProjectionData.length;
  const allVals = beforeProjectionData.map(d => d.balance);
  const minV = Math.min(...allVals), maxV = Math.max(...allVals);

  const nowEndX = toX(2, n); // Jun '26 is index 2
  const zeroY = toY(0, minV, maxV);
  const pts = beforeProjectionData.map((d, i) => ({ x: toX(i, n), y: toY(d.balance, minV, maxV) }));
  const linePath = smoothPath(pts);

  const defs = `<defs><linearGradient id="gBef" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#ef4444" stop-opacity="0.25"/>
    <stop offset="100%" stop-color="#ef4444" stop-opacity="0.02"/>
  </linearGradient></defs>`;

  const areas = refArea(0, nowEndX, 'rgba(0,0,0,0.03)') +
    refArea(nowEndX, CW, 'rgba(239,68,68,0.07)') +
    refLine(nowEndX, 'Debt') +
    hRefLine(zeroY);

  const path = `<path d="${areaPath(pts, CH, linePath)}" fill="url(#gBef)"/>
    <path d="${linePath}" fill="none" stroke="#ef4444" stroke-width="1.5" stroke-linejoin="round"/>`;

  const xlabels = ["Apr '26", "Jul '26", "Oct '26", "Jan '27", "Mar '27"].map((l, i) => {
    const xi = [0, 3, 6, 9, 11][i];
    return xLabel(l, toX(xi, n));
  }).join('');

  return svg(`${defs}${grid()}${areas}${path}${xlabels}`);
}

function buildView3() {
  const savings = getMonthlySavings();
  const data = beforeProjectionData.map((d, i) => ({
    ...d,
    balance: d.balance + savings * (i + 1),
  }));
  const n = data.length;
  const allVals = data.map(d => d.balance);
  const minV = Math.min(...allVals), maxV = Math.max(...allVals);

  const nowEndX = toX(2, n);
  const zeroY = toY(0, minV, maxV);
  const isAboveZero = minV >= 0;

  const pts = data.map((d, i) => ({ x: toX(i, n), y: toY(d.balance, minV, maxV) }));
  const linePath = smoothPath(pts);

  // Dynamic gradient: green above $0, red below
  const zeroPercent = isAboveZero ? 100 : maxV <= 0 ? 0 : (maxV / (maxV - minV)) * 100;
  const defs = `<defs>
    <linearGradient id="gAft" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#10b981" stop-opacity="0.25"/>
      <stop offset="${zeroPercent.toFixed(1)}%" stop-color="#10b981" stop-opacity="0.05"/>
      <stop offset="${zeroPercent.toFixed(1)}%" stop-color="#ef4444" stop-opacity="0.05"/>
      <stop offset="100%" stop-color="#ef4444" stop-opacity="0.25"/>
    </linearGradient>
    <linearGradient id="sAft" x1="0" y1="0" x2="0" y2="1">
      <stop offset="${(zeroPercent - 0.5).toFixed(1)}%" stop-color="#10b981"/>
      <stop offset="${(zeroPercent + 0.5).toFixed(1)}%" stop-color="#ef4444"/>
    </linearGradient>
  </defs>`;

  const areas = refArea(0, nowEndX, 'rgba(0,0,0,0.03)') +
    refArea(nowEndX, CW, 'rgba(0,0,0,0.02)') +
    refLine(nowEndX, '') +
    (minV < 0 ? hRefLine(zeroY) : '');

  const path = `<path d="${areaPath(pts, CH, linePath)}" fill="url(#gAft)"/>
    <path d="${linePath}" fill="none" stroke="url(#sAft)" stroke-width="1.5" stroke-linejoin="round"/>`;

  const xlabels = ["Apr '26", "Jul '26", "Oct '26", "Jan '27", "Mar '27"].map((l, i) => {
    const xi = [0, 3, 6, 9, 11][i];
    return xLabel(l, toX(xi, n));
  }).join('');

  return svg(`${defs}${grid()}${areas}${path}${xlabels}`);
}

function svg(inner) {
  return `<svg viewBox="0 0 ${CW} ${CH + 16}" class="balance-svg" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
}

function buildChart() {
  if (activeView === 4) return buildView4();
  if (activeView === 1) return buildView1();
  if (activeView === 2) return buildView2();
  return buildView3();
}

// ─── Top panel title/subtitle ─────────────────────────────────────────────────

function chartMeta() {
  const size = cancelled.size;
  const titles = {
    4: ["Balance History", "Nov 2025 – Apr 2026"],
    1: ["Spending Projection", "Nov 2025 – Oct 2026 (projected)"],
    2: ["Before: No Changes", "Apr 2026 – Mar 2027 (if unchanged)"],
    3: [`After: Cancelling ${size} Subscription${size !== 1 ? 's' : ''}`, `Saving $${getMonthlySavings().toFixed(2)}/mo starting Apr '26`],
  };
  return titles[activeView];
}

// ─── Transactions ─────────────────────────────────────────────────────────────

function buildTransactionRow(t) {
  const isDebit = t.amount > 0;
  const isCancelled = cancelled.has(t.transaction_id);
  const isConfirming = confirming === t.transaction_id;
  const isSub = isSubscription(t);
  const catStyle = getCatStyle(t.category);
  const accColor = getAccColor(t.account_id);
  const sub = t.category[1] || t.category[0];
  const dateStr = t.date.slice(5).replace('-', '/');
  const amount = Math.abs(t.amount);

  let actionBtn = '';
  if (isSub && !isCancelled) {
    if (isConfirming) {
      actionBtn = `<button class="tx-confirm-btn" data-id="${t.transaction_id}" title="Confirm cancel">✓</button>`;
    } else {
      actionBtn = `<button class="tx-cancel-btn" data-id="${t.transaction_id}" title="Cancel subscription">✕</button>`;
    }
  }

  const confirmText = isSub && isConfirming && !isCancelled
    ? `<span class="tx-confirm-text">Cancel?</span>`
    : '';

  return `<div class="tx-row${isCancelled ? ' tx-cancelled' : ''}${isConfirming ? ' tx-confirming' : ''}" data-id="${t.transaction_id}">
    <div class="tx-icon ${isDebit ? 'tx-debit-icon' : 'tx-credit-icon'}">${isDebit ? '↑' : '↓'}</div>
    
    <div class="tx-info">
      <div class="tx-info-main">
        <span class="tx-name${isCancelled ? ' tx-struck' : ''}">${t.name}${isCancelled ? '<span class="tx-cancelled-label"> cancelled</span>' : ''}</span>
        ${confirmText}
      </div>
      <span class="tx-cat" style="color:${catStyle.text};background:${catStyle.bg}">${sub}</span>
    </div>

    <div class="tx-right">
      <span class="tx-amount ${isDebit ? 'tx-debit-amt' : 'tx-credit-amt'}">${isDebit ? '-' : '+'}$${amount.toFixed(2)}</span>
      <div class="tx-date-row">
        <span class="tx-date">${dateStr}</span>
        <span class="tx-acc-dot" style="background:${accColor}"></span>
      </div>
    </div>
    
    <div class="tx-action-slot">
      ${actionBtn}
    </div>
  </div>`;
}

function buildTransactions() {
  return transactions.slice(0, 8).map(buildTransactionRow).join('');
}

// ─── Legend for top box ───────────────────────────────────────────────────────

function buildLegend() {
  if (activeView === 4) {
    return `<div class="panel-legend">
      <span class="leg-dot" style="background:#10b981"></span><span class="leg-label">Checking</span>
      <span class="leg-dot" style="background:#6366f1"></span><span class="leg-label">Savings</span>
      <span class="leg-dot" style="background:#a78bfa"></span><span class="leg-label">Invest</span>
    </div>`;
  }
  if (activeView === 1) {
    return `<div class="panel-legend">
      <span class="leg-dot" style="background:#10b981"></span><span class="leg-label">Earned</span>
      <span class="leg-dot" style="background:#ef4444"></span><span class="leg-label">Spent</span>
    </div>`;
  }
  return '';
}

// ─── Render helpers ───────────────────────────────────────────────────────────

function renderTopPanel(topBox) {
  const [title, sub] = chartMeta();

  const views = [
    { id: 4, label: 'Balance' },
    { id: 1, label: 'Projection' },
    { id: 2, label: 'Before' },
    { id: 3, label: 'After' },
  ];
  const tabs = views.map(v =>
    `<button class="chart-tab${activeView === v.id ? ' chart-tab-active' : ''}" data-view="${v.id}">${v.label}</button>`
  ).join('');

  topBox.innerHTML = `
    <div class="panel-inner">
      <div class="panel-header">
        <div class="panel-title-block">
          <p class="panel-title">${title}</p>
          <p class="panel-sub">${sub}</p>
        </div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
          <div class="chart-tabs">${tabs}</div>
          ${buildLegend()}
        </div>
      </div>
      ${buildChart()}
    </div>`;
}

function renderBottomPanel(bottomBox) {
  bottomBox.innerHTML = `
    <div class="panel-inner">
      <div class="panel-header">
        <div>
          <p class="panel-title">Recent Transactions</p>
          <p class="panel-sub">${transactions.length} transactions this month</p>
        </div>
        <button class="panel-view-all">View all</button>
      </div>
      <div class="tx-list">${buildTransactions()}</div>
    </div>`;
}

// ─── Init ─────────────────────────────────────────────────────────────────────

export function initPanels() {
  const topBox    = document.querySelector('.scene-side-box-top');
  const bottomBox = document.querySelector('.scene-side-box-bottom');

  renderTopPanel(topBox);
  renderBottomPanel(bottomBox);

  // Chart tab clicks
  topBox.addEventListener('click', e => {
    const tab = e.target.closest('[data-view]');
    if (tab) {
      activeView = Number(tab.dataset.view);
      renderTopPanel(topBox);
    }
  });

  // Transaction cancel / confirm clicks
  bottomBox.addEventListener('click', e => {
    const cancelBtn = e.target.closest('.tx-cancel-btn');
    const confirmBtn = e.target.closest('.tx-confirm-btn');

    if (cancelBtn) {
      e.stopPropagation();
      confirming = cancelBtn.dataset.id;
      renderBottomPanel(bottomBox);
      return;
    }

    if (confirmBtn) {
      e.stopPropagation();
      const id = confirmBtn.dataset.id;
      const row = bottomBox.querySelector(`.tx-row[data-id="${id}"]`);

      confirming = null;
      if (row) row.classList.add('tx-cancelling');

      setTimeout(() => {
        cancelled.add(id);
        if (activeView === 2) activeView = 3;
        renderBottomPanel(bottomBox);
        renderTopPanel(topBox);
        document.dispatchEvent(new CustomEvent('subscription-cancelled'));
      }, 450);
      return;
    }

    // Click outside any button dismisses confirming state
    if (confirming) {
      confirming = null;
      renderBottomPanel(bottomBox);
    }
  });

  // Global click dismisses confirming state
  document.addEventListener('click', () => {
    if (confirming) {
      confirming = null;
      renderBottomPanel(bottomBox);
    }
  });
}
