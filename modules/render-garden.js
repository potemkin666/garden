/**
 * render-garden.js — Renders source plants into the garden grid.
 */

import { mapSourceToVisual, STATUS_COLORS } from './state-map.js';
import { generatePlantSVG } from './render-plant.js';
import { escapeHtml } from './utils.js';

/**
 * Create a single plant card element.
 */
function buildPlantCard(source) {
  const visual = mapSourceToVisual(source);
  const svg = generatePlantSVG(source, visual);
  const statusColor = STATUS_COLORS[visual.status] || '#5a5048';

  const card = document.createElement('article');
  card.className = `plant-card status-${visual.status}`;
  card.dataset.id = source.id;
  card.dataset.status = visual.status;
  card.dataset.category = source.category;
  card.setAttribute('aria-label', `${source.name} — ${visual.status}`);
  card.setAttribute('tabindex', '0');
  card.setAttribute('role', 'button');

  card.innerHTML = `
    <div class="plant-visual" aria-hidden="true">${svg}</div>
    <div class="plant-info">
      <span class="plant-status-dot" style="background:${statusColor}" title="${visual.status}"></span>
      <span class="plant-name">${escapeHtml(source.name)}</span>
      <span class="plant-category">${escapeHtml(source.category)}</span>
    </div>
    ${source.incidentCountRecent > 0 ? `<span class="incident-badge" title="${source.incidentCountRecent} recent incident(s)">${source.incidentCountRecent}</span>` : ''}
  `;

  return card;
}

/**
 * Render all plants into the garden grid container.
 * @param {HTMLElement} container - The grid container element
 * @param {Array} sources - Filtered/sorted source array
 * @param {Function} onSelect - Callback when a plant is selected (receives source object)
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

  const fragment = document.createDocumentFragment();

  sources.forEach((source) => {
    const card = buildPlantCard(source);
    card.addEventListener('click', () => onSelect(source));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect(source);
      }
    });
    fragment.appendChild(card);
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
    const statusColor = STATUS_COLORS[visual.status] || '#666';
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
