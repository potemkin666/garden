/**
 * render-garden.js — Renders source plants into the garden grid, beds, and list views.
 *
 * Improvements:
 *  3. Garden beds — groups plants by category with labeled section headers
 *  6. Virtualized rendering — lazy-loads off-screen cards with IntersectionObserver
 */

import { mapSourceToVisual, STATUS_COLORS } from './state-map.js';
import { generatePlantSVG } from './render-plant.js';
import { escapeHtml } from './utils.js';

/**
 * Lazy-rendering observer. Defers SVG generation until a card scrolls into view.
 */
const lazyObserver =
  typeof IntersectionObserver !== 'undefined'
    ? new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const card = entry.target;
              renderCardContent(card);
              lazyObserver.unobserve(card);
            }
          });
        },
        { rootMargin: '200px' }
      )
    : null;

/**
 * Render the SVG content of a card that was deferred.
 */
function renderCardContent(card) {
  if (card.dataset.rendered === 'true') return;
  const sourceJSON = card.dataset.source;
  if (!sourceJSON) return;
  try {
    const source = JSON.parse(sourceJSON);
    const visual = mapSourceToVisual(source);
    const svg = generatePlantSVG(source, visual);
    const visualEl = card.querySelector('.plant-visual');
    if (visualEl) visualEl.innerHTML = svg;
    card.dataset.rendered = 'true';
  } catch {
    // Silently skip render failures
  }
}

/**
 * Create a single plant card element.
 * If lazy=true, SVG rendering is deferred until the card is near the viewport.
 */
function buildPlantCard(source, lazy = false) {
  const visual = mapSourceToVisual(source);
  const statusColor = STATUS_COLORS[visual.status] || '#5a5048';

  const card = document.createElement('article');
  card.className = `plant-card status-${visual.status}`;
  card.dataset.id = source.id;
  card.dataset.status = visual.status;
  card.dataset.category = source.category;
  card.setAttribute('aria-label', `${source.name} — ${visual.status}`);
  card.setAttribute('tabindex', '0');
  card.setAttribute('role', 'listitem');

  if (lazy && lazyObserver) {
    // Store source data for deferred rendering
    card.dataset.source = JSON.stringify(source);
    card.dataset.rendered = 'false';
    card.innerHTML = `
      <div class="plant-visual" aria-hidden="true"></div>
      <div class="plant-info">
        <span class="plant-status-dot" style="background:${statusColor}" title="${visual.status}"></span>
        <span class="plant-name">${escapeHtml(source.name)}</span>
        <span class="plant-category">${escapeHtml(source.category)}</span>
      </div>
      ${source.incidentCountRecent > 0 ? `<span class="incident-badge" title="${source.incidentCountRecent} recent incident(s)">${source.incidentCountRecent}</span>` : ''}
    `;
  } else {
    const svg = generatePlantSVG(source, visual);
    card.innerHTML = `
      <div class="plant-visual" aria-hidden="true">${svg}</div>
      <div class="plant-info">
        <span class="plant-status-dot" style="background:${statusColor}" title="${visual.status}"></span>
        <span class="plant-name">${escapeHtml(source.name)}</span>
        <span class="plant-category">${escapeHtml(source.category)}</span>
      </div>
      ${source.incidentCountRecent > 0 ? `<span class="incident-badge" title="${source.incidentCountRecent} recent incident(s)">${source.incidentCountRecent}</span>` : ''}
    `;
  }

  return card;
}

// Threshold above which we use lazy rendering
const LAZY_THRESHOLD = 60;

/**
 * Render all plants into the garden grid container.
 * Uses lazy rendering with IntersectionObserver for large source sets.
 */
export function renderGarden(container, sources, onSelect) {
  container.innerHTML = '';

  if (!sources.length) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No sources match the current filters.</p>
      </div>`;
    return;
  }

  const useLazy = sources.length > LAZY_THRESHOLD && lazyObserver;
  const fragment = document.createDocumentFragment();
  const cards = [];

  sources.forEach((source, idx) => {
    const card = buildPlantCard(source, useLazy);
    card.setAttribute('tabindex', idx === 0 ? '0' : '-1');
    card.addEventListener('click', () => onSelect(source));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect(source);
      }
    });
    cards.push(card);
    fragment.appendChild(card);

    if (useLazy) lazyObserver.observe(card);
  });

  container.appendChild(fragment);

  // Arrow-key navigation across the grid
  container.addEventListener('keydown', (e) => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const focused = document.activeElement;
    const idx = cards.indexOf(focused);
    if (idx === -1) return;

    e.preventDefault();
    let next = idx;

    const cardWidth = cards[0]?.offsetWidth || 130;
    const cols = Math.max(1, Math.round(container.offsetWidth / cardWidth));

    switch (e.key) {
      case 'ArrowRight': next = Math.min(idx + 1, cards.length - 1); break;
      case 'ArrowLeft':  next = Math.max(idx - 1, 0); break;
      case 'ArrowDown':  next = Math.min(idx + cols, cards.length - 1); break;
      case 'ArrowUp':    next = Math.max(idx - cols, 0); break;
      case 'Home':       next = 0; break;
      case 'End':        next = cards.length - 1; break;
    }

    if (next !== idx) {
      cards[idx].setAttribute('tabindex', '-1');
      cards[next].setAttribute('tabindex', '0');
      cards[next].focus();
    }
  });
}

/**
 * Render plants grouped into category-based "garden beds".
 */
export function renderGardenBeds(container, sources, onSelect) {
  container.innerHTML = '';

  if (!sources.length) {
    container.innerHTML = `<div class="empty-state"><p>No sources match the current filters.</p></div>`;
    return;
  }

  // Group by category
  const groups = new Map();
  sources.forEach((s) => {
    const cat = s.category || 'uncategorized';
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push(s);
  });

  // Sort categories alphabetically
  const sortedCategories = Array.from(groups.keys()).sort();

  const fragment = document.createDocumentFragment();

  sortedCategories.forEach((category) => {
    const bed = document.createElement('section');
    bed.className = 'garden-bed';
    bed.setAttribute('aria-label', `${category} sources`);

    const header = document.createElement('h3');
    header.className = 'bed-header';
    header.textContent = category;
    const count = document.createElement('span');
    count.className = 'bed-count';
    count.textContent = ` (${groups.get(category).length})`;
    header.appendChild(count);
    bed.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'garden-grid bed-grid';
    grid.setAttribute('role', 'list');

    const useLazy = groups.get(category).length > LAZY_THRESHOLD && lazyObserver;

    groups.get(category).forEach((source) => {
      const card = buildPlantCard(source, useLazy);
      card.addEventListener('click', () => onSelect(source));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(source);
        }
      });
      grid.appendChild(card);
      if (useLazy) lazyObserver.observe(card);
    });

    bed.appendChild(grid);
    fragment.appendChild(bed);
  });

  container.appendChild(fragment);
}

/**
 * Render the diagnostic list view.
 */
export function renderListView(container, sources, onSelect) {
  container.innerHTML = '';

  if (!sources.length) {
    container.innerHTML = `<div class="empty-state"><p>No sources match the current filters.</p></div>`;
    return;
  }

  const table = document.createElement('table');
  table.className = 'diag-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Name</th>
        <th>Category</th>
        <th>Status</th>
        <th>Freshness</th>
        <th>Reliability</th>
        <th>Failures</th>
        <th>Incidents</th>
        <th>Last Success</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector('tbody');

  sources.forEach((source) => {
    const visual = mapSourceToVisual(source);
    const tr = document.createElement('tr');
    tr.className = `diag-row status-${visual.status}`;
    tr.setAttribute('tabindex', '0');
    tr.setAttribute('role', 'button');
    tr.innerHTML = `
      <td class="diag-name">${escapeHtml(source.name)}</td>
      <td class="diag-cat">${escapeHtml(source.category)}</td>
      <td class="diag-status">
        <span class="status-pill status-${visual.status}">${visual.status}</span>
      </td>
      <td class="diag-score">${source.freshnessScore}</td>
      <td class="diag-score">${source.reliabilityScore}</td>
      <td class="diag-score">${source.failureCount}</td>
      <td class="diag-score">${source.incidentCountRecent}</td>
      <td class="diag-date">${source.lastSuccessAt ? new Date(source.lastSuccessAt).toLocaleDateString('en-GB') : '—'}</td>
    `;
    tr.addEventListener('click', () => onSelect(source));
    tr.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect(source);
      }
    });
    tbody.appendChild(tr);
  });

  container.appendChild(table);
}
