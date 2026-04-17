/**
 * app.js — Signal Garden entry point.
 * Wires data, filters, rendering, and panel modules together.
 */

import { loadSources, addUserSource, removeUserSource, isUserSource, exportSourcesJSON, exportHealthyJSON } from './modules/data.js';
import { applyFilters, applySorting, countByStatus, renderFilterBar } from './modules/filters.js';
import { renderGarden, renderListView } from './modules/render-garden.js';
import { openPanel, closePanel } from './modules/detail-panel.js';
import { openAddSourceModal } from './modules/add-source.js';
import { STATUS_COLORS, STATUS_LEGEND } from './modules/state-map.js';

// ─── State ──────────────────────────────────────────────────────────────────────

let allSources = [];
let activeFilters = {
  status: 'all',
  category: 'all',
  sort: 'risk',
  search: '',
};
let viewMode = 'garden'; // 'garden' | 'list'
let panelSource = null;

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

// ─── Rendering ──────────────────────────────────────────────────────────────────

function refresh() {
  const filtered = applyFilters(allSources, activeFilters);
  const sorted = applySorting(filtered, activeFilters.sort);

  renderFilterBar(filterBarEl, allSources, activeFilters, (newFilters) => {
    activeFilters = newFilters;
    refresh();
  });

  if (viewMode === 'garden') {
    gardenGrid.classList.remove('hidden');
    listViewEl.classList.add('hidden');
    renderGarden(gardenGrid, sorted, selectSource);
  } else {
    gardenGrid.classList.add('hidden');
    listViewEl.classList.remove('hidden');
    renderListView(listViewEl, sorted, selectSource);
  }

  updateSummary(filtered);
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
  }, userOwned ? handleRemoveSource : null);
}

function handleClosePanel() {
  closePanel(detailPanel, panelOverlay, () => {
    panelSource = null;
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

// ─── Export ──────────────────────────────────────────────────────────────────────

function setupExport() {
  if (exportBtn) {
    exportBtn.addEventListener('click', () => exportSourcesJSON(allSources));
  }
  if (exportHealthyBtn) {
    exportHealthyBtn.addEventListener('click', () => exportHealthyJSON(allSources));
  }
}

// ─── View toggle ────────────────────────────────────────────────────────────────

function setupViewToggle() {
  if (!viewToggle) return;
  viewToggle.addEventListener('click', () => {
    viewMode = viewMode === 'garden' ? 'list' : 'garden';
    viewToggle.textContent = viewMode === 'garden' ? '⊞ List view' : '🌿 Garden view';
    viewToggle.setAttribute('aria-pressed', viewMode === 'list');
    refresh();
  });
}

// ─── Legend ──────────────────────────────────────────────────────────────────────

function renderLegend() {
  if (!legendBar) return;
  legendBar.innerHTML = STATUS_LEGEND.map(
    (item) => `
    <div class="legend-item" title="${item.desc}">
      <span class="legend-dot" style="background:${STATUS_COLORS[item.status]}"></span>
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
    requestAnimationFrame(draw);
  }

  // Respect reduced motion
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  init();
  window.addEventListener('resize', resize);
  draw();
}

// ─── Keyboard / overlay close ───────────────────────────────────────────────────

function setupGlobalListeners() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && detailPanel.classList.contains('open')) {
      handleClosePanel();
    }
  });

  panelOverlay.addEventListener('click', handleClosePanel);
}

// ─── Boot ────────────────────────────────────────────────────────────────────────

async function reloadSources() {
  allSources = await loadSources();
  refresh();
}

async function init() {
  try {
    if (loadingEl) loadingEl.classList.remove('hidden');
    if (errorEl) errorEl.classList.add('hidden');

    allSources = await loadSources();

    if (loadingEl) loadingEl.classList.add('hidden');

    setupViewToggle();
    setupAddSource();
    setupExport();
    renderLegend();
    setupGlobalListeners();
    initAmbientParticles();
    refresh();
  } catch (err) {
    if (loadingEl) loadingEl.classList.add('hidden');
    if (errorEl) {
      errorEl.textContent = `Failed to load garden data: ${err.message}`;
      errorEl.classList.remove('hidden');
    }
    console.error('[Signal Garden] Init error:', err);
  }
}

init();
