/**
 * app.js — Signal Garden entry point.
 * Wires data, filters, rendering, and panel modules together.
 *
 * Improvements:
 *  1. Auto-refresh with visible countdown timer
 *  2. Sparkline history recording
 *  3. Garden beds (grouping by category) as a third view mode
 *  7. Deep-linking / URL-based state
 */

import { loadSources, addUserSource, removeUserSource, isUserSource, exportSourcesJSON, exportHealthyJSON } from './modules/data.js';
import { applyFilters, applySorting, countByStatus, renderFilterBar } from './modules/filters.js';
import { renderGarden, renderListView, renderGardenBeds } from './modules/render-garden.js';
import { openPanel, closePanel } from './modules/detail-panel.js';
import { openAddSourceModal } from './modules/add-source.js';
import { STATUS_COLORS, STATUS_LEGEND, clearVisualCache } from './modules/state-map.js';
import { recordScoreSnapshot } from './modules/sparkline.js';

// ─── Constants ──────────────────────────────────────────────────────────────────

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// ─── State ──────────────────────────────────────────────────────────────────────

let allSources = [];
let activeFilters = {
  status: 'all',
  category: 'all',
  sort: 'risk',
  search: '',
};
let viewMode = 'garden'; // 'garden' | 'list' | 'beds'
let panelSource = null;
let refreshTimerId = null;
let refreshCountdownId = null;
let lastRefreshTime = null;

// ─── DOM refs ───────────────────────────────────────────────────────────────────

const gardenGrid = document.getElementById('garden-grid');
const listViewEl = document.getElementById('list-view');
const filterBarEl = document.getElementById('filter-bar');
const detailPanel = document.getElementById('detail-panel');
const panelOverlay = document.getElementById('panel-overlay');
const statusSummary = document.getElementById('status-summary');
const viewToggle = document.getElementById('view-toggle');
const legendBar = document.getElementById('legend-bar');
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error-message');
const addSourceBtn = document.getElementById('add-source-btn');
const exportBtn = document.getElementById('export-btn');
const exportHealthyBtn = document.getElementById('export-healthy-btn');
const refreshText = document.getElementById('refresh-text');

// ─── URL State (Deep-linking) ───────────────────────────────────────────────────

function readURLState() {
  const params = new URLSearchParams(window.location.search);
  if (params.has('status')) activeFilters.status = params.get('status');
  if (params.has('category')) activeFilters.category = params.get('category');
  if (params.has('sort')) activeFilters.sort = params.get('sort');
  if (params.has('search')) activeFilters.search = params.get('search');
  if (params.has('view')) viewMode = params.get('view');
}

function writeURLState() {
  const params = new URLSearchParams();
  if (activeFilters.status !== 'all') params.set('status', activeFilters.status);
  if (activeFilters.category !== 'all') params.set('category', activeFilters.category);
  if (activeFilters.sort !== 'risk') params.set('sort', activeFilters.sort);
  if (activeFilters.search) params.set('search', activeFilters.search);
  if (viewMode !== 'garden') params.set('view', viewMode);
  if (panelSource) params.set('source', panelSource.id);

  const qs = params.toString();
  const newURL = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
  window.history.replaceState(null, '', newURL);
}

// ─── Auto-refresh ───────────────────────────────────────────────────────────────

function startAutoRefresh() {
  stopAutoRefresh();
  lastRefreshTime = Date.now();
  updateCountdown();
  refreshCountdownId = setInterval(updateCountdown, 1000);
  refreshTimerId = setInterval(async () => {
    lastRefreshTime = Date.now();
    await reloadSources();
  }, REFRESH_INTERVAL_MS);
}

function stopAutoRefresh() {
  if (refreshTimerId) { clearInterval(refreshTimerId); refreshTimerId = null; }
  if (refreshCountdownId) { clearInterval(refreshCountdownId); refreshCountdownId = null; }
}

function updateCountdown() {
  if (!refreshText || !lastRefreshTime) return;
  const elapsed = Date.now() - lastRefreshTime;
  const remaining = Math.max(0, REFRESH_INTERVAL_MS - elapsed);
  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  refreshText.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ─── Rendering ──────────────────────────────────────────────────────────────────

function refresh() {
  clearVisualCache();
  const filtered = applyFilters(allSources, activeFilters);
  const sorted = applySorting(filtered, activeFilters.sort);

  renderFilterBar(filterBarEl, allSources, activeFilters, (newFilters) => {
    activeFilters = newFilters;
    refresh();
    writeURLState();
  });

  if (viewMode === 'beds') {
    gardenGrid.classList.remove('hidden');
    listViewEl.classList.add('hidden');
    renderGardenBeds(gardenGrid, sorted, selectSource);
  } else if (viewMode === 'list') {
    gardenGrid.classList.add('hidden');
    listViewEl.classList.remove('hidden');
    renderListView(listViewEl, sorted, selectSource);
  } else {
    gardenGrid.classList.remove('hidden');
    listViewEl.classList.add('hidden');
    renderGarden(gardenGrid, sorted, selectSource);
  }

  updateSummary(filtered);
  writeURLState();
}

function updateSummary(filtered) {
  const counts = countByStatus(filtered);
  const total = filtered.length;
  const atRisk = (counts.failing || 0) + (counts.blocked || 0) + (counts.dead || 0);
  statusSummary.innerHTML = `
    <span class="summary-total">${total} source${total !== 1 ? 's' : ''}</span>
    ${atRisk > 0 ? `<span class="summary-risk">${atRisk} at risk</span>` : '<span class="summary-ok">all clear</span>'}
  `;
}

// ─── Panel ───────────────────────────────────────────────────────────────────────

function selectSource(source) {
  panelSource = source;
  const userOwned = isUserSource(source.id);
  openPanel(source, detailPanel, panelOverlay, () => {
    panelSource = null;
    writeURLState();
  }, userOwned ? handleRemoveSource : null);
  writeURLState();
}

function handleClosePanel() {
  closePanel(detailPanel, panelOverlay, () => {
    panelSource = null;
    writeURLState();
  });
}

function handleRemoveSource(sourceId) {
  removeUserSource(sourceId);
  handleClosePanel();
  reloadSources();
}

// ─── Add source ─────────────────────────────────────────────────────────────────

function setupAddSource() {
  if (!addSourceBtn) return;
  addSourceBtn.addEventListener('click', () => {
    openAddSourceModal((newSource) => {
      addUserSource(newSource);
      reloadSources();
    });
  });
}

// ─── Mobile actions menu ────────────────────────────────────────────────────

function setupMobileMenu() {
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const headerActions = document.getElementById('header-actions');
  if (!mobileMenuBtn || !headerActions) return;

  const mq = window.matchMedia('(max-width: 640px)');
  function updateVisibility() {
    if (mq.matches) {
      mobileMenuBtn.classList.remove('hidden');
    } else {
      mobileMenuBtn.classList.add('hidden');
      headerActions.classList.remove('mobile-open');
    }
  }
  mq.addEventListener('change', updateVisibility);
  updateVisibility();

  mobileMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = headerActions.classList.toggle('mobile-open');
    mobileMenuBtn.setAttribute('aria-expanded', open);
  });

  document.addEventListener('click', (e) => {
    if (!headerActions.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
      headerActions.classList.remove('mobile-open');
      mobileMenuBtn.setAttribute('aria-expanded', 'false');
    }
  });
}

// ─── Export ──────────────────────────────────────────────────────────────────────

function setupExport() {
  if (exportBtn) {
    exportBtn.addEventListener('click', () => exportSourcesJSON(allSources));
  }
  if (exportHealthyBtn) {
    exportHealthyBtn.addEventListener('click', () => exportHealthyJSON(allSources));
  }
}

// ─── View toggle (garden → beds → list → garden) ───────────────────────────────

const VIEW_MODES = ['garden', 'beds', 'list'];
const VIEW_LABELS = { garden: 'Switch to beds view', beds: 'Switch to list view', list: 'Switch to garden view' };

function setupViewToggle() {
  if (!viewToggle) return;
  syncViewToggleLabel();
  viewToggle.addEventListener('click', () => {
    const idx = VIEW_MODES.indexOf(viewMode);
    viewMode = VIEW_MODES[(idx + 1) % VIEW_MODES.length];
    syncViewToggleLabel();
    refresh();
  });
}

function syncViewToggleLabel() {
  if (!viewToggle) return;
  viewToggle.textContent = VIEW_LABELS[viewMode] || '⊞ List view';
  viewToggle.setAttribute('aria-pressed', viewMode !== 'garden');
}

// ─── Legend ──────────────────────────────────────────────────────────────────────

function renderLegend() {
  if (!legendBar) return;
  legendBar.innerHTML = STATUS_LEGEND.map(
    (item) => `
    <div class="legend-item" title="${item.desc}" role="listitem">
      <span class="legend-dot" style="background:${STATUS_COLORS[item.status]}" aria-hidden="true"></span>
      <span class="legend-label">${item.label}</span>
    </div>`
  ).join('');
}

// ─── Ambient particles ──────────────────────────────────────────────────────────

function initAmbientParticles() {
  const canvas = document.getElementById('ambient-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w, h;
  const particles = [];
  const PARTICLE_COUNT = 40;
  let rafId = null;
  let running = false;

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }

  function createParticle() {
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -0.15 - Math.random() * 0.25,
      r: 1 + Math.random() * 2,
      opacity: 0.08 + Math.random() * 0.15,
      hue: 80 + Math.random() * 60,
    };
  }

  function init() {
    resize();
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push(createParticle());
    }
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.opacity *= 0.999;

      if (p.y < -10 || p.opacity < 0.02) {
        Object.assign(p, createParticle());
        p.y = h + 10;
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue}, 40%, 50%, ${p.opacity})`;
      ctx.fill();
    }
    rafId = requestAnimationFrame(draw);
  }

  function start() {
    if (running) return;
    running = true;
    draw();
  }

  function stop() {
    if (!running) return;
    running = false;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  // Respect reduced motion
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  init();
  window.addEventListener('resize', resize);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stop();
    } else {
      start();
    }
  });

  start();
}

// ─── Keyboard / overlay close ───────────────────────────────────────────────────

function setupGlobalListeners() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && detailPanel.classList.contains('open')) {
      handleClosePanel();
    }
  });

  panelOverlay.addEventListener('click', handleClosePanel);

  // Handle browser back/forward for deep-linking
  window.addEventListener('popstate', () => {
    readURLState();
    syncViewToggleLabel();
    refresh();
  });
}

// ─── Open source from URL deep link ─────────────────────────────────────────────

function openDeepLinkedSource() {
  const params = new URLSearchParams(window.location.search);
  const sourceId = params.get('source');
  if (sourceId) {
    const source = allSources.find((s) => s.id === sourceId);
    if (source) selectSource(source);
  }
}

// ─── Boot ────────────────────────────────────────────────────────────────────────

async function reloadSources() {
  allSources = await loadSources();
  recordScoreSnapshot(allSources);
  refresh();
}

async function init() {
  try {
    if (loadingEl) loadingEl.classList.remove('hidden');
    if (errorEl) errorEl.classList.add('hidden');

    // Read URL state before loading data
    readURLState();

    allSources = await loadSources();
    recordScoreSnapshot(allSources);

    if (loadingEl) loadingEl.classList.add('hidden');

    setupViewToggle();
    setupAddSource();
    setupExport();
    setupMobileMenu();
    renderLegend();
    setupGlobalListeners();
    initAmbientParticles();
    refresh();
    openDeepLinkedSource();

    // Start auto-refresh
    startAutoRefresh();
  } catch (err) {
    if (loadingEl) loadingEl.classList.add('hidden');
    if (errorEl) {
      errorEl.innerHTML = '';
      const msg = document.createElement('span');
      msg.textContent = `Failed to load garden data: ${err.message}`;
      errorEl.appendChild(msg);

      const retryBtn = document.createElement('button');
      retryBtn.className = 'retry-btn';
      retryBtn.textContent = '↻ Retry';
      retryBtn.addEventListener('click', () => {
        errorEl.classList.add('hidden');
        init();
      });
      errorEl.appendChild(retryBtn);

      errorEl.classList.remove('hidden');
    }
    console.error('[Signal Garden] Init error:', err);
  }
}

init();
