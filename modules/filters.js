/**
 * filters.js — Filter, sort, and search logic for source arrays.
 */

import { mapSourceToVisual } from './state-map.js';

/**
 * Apply all active filters to a sources array.
 * @param {Array} sources - All source records
 * @param {Object} filters - { status: string, category: string, search: string }
 * @returns {Array} filtered sources
 */
export function applyFilters(sources, filters) {
  let result = sources.slice();

  if (filters.status && filters.status !== 'all') {
    result = result.filter((s) => {
      const visual = mapSourceToVisual(s);
      return visual.status === filters.status;
    });
  }

  if (filters.category && filters.category !== 'all') {
    result = result.filter((s) => s.category === filters.category);
  }

  if (filters.search && filters.search.trim()) {
    const q = filters.search.trim().toLowerCase();
    result = result.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        (s.notes && s.notes.toLowerCase().includes(q))
    );
  }

  return result;
}

/**
 * Sort a sources array by the given key.
 * @param {Array} sources
 * @param {string} sortKey - 'risk' | 'freshness' | 'activity' | 'reliability' | 'name'
 * @returns {Array} sorted (new array)
 */
export function applySorting(sources, sortKey) {
  const sorted = sources.slice();

  const RISK_ORDER = {
    dead: 0,
    blocked: 1,
    failing: 2,
    quarantined: 3,
    stale: 4,
    recovering: 5,
    healthy: 6,
    flowering: 7,
  };

  switch (sortKey) {
    case 'risk':
      sorted.sort((a, b) => {
        const va = mapSourceToVisual(a);
        const vb = mapSourceToVisual(b);
        return (RISK_ORDER[va.status] ?? 5) - (RISK_ORDER[vb.status] ?? 5);
      });
      break;

    case 'freshness':
      sorted.sort((a, b) => b.freshnessScore - a.freshnessScore);
      break;

    case 'reliability':
      sorted.sort((a, b) => b.reliabilityScore - a.reliabilityScore);
      break;

    case 'activity':
      sorted.sort((a, b) => {
        const ta = a.lastSuccessAt ? new Date(a.lastSuccessAt).getTime() : 0;
        const tb = b.lastSuccessAt ? new Date(b.lastSuccessAt).getTime() : 0;
        return tb - ta;
      });
      break;

    case 'name':
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;

    default:
      break;
  }

  return sorted;
}

/**
 * Derive the list of unique categories from the sources array.
 */
export function getCategories(sources) {
  const cats = new Set(sources.map((s) => s.category));
  return ['all', ...Array.from(cats).sort()];
}

/**
 * Count sources per visual status.
 */
export function countByStatus(sources) {
  const counts = {};
  sources.forEach((s) => {
    const v = mapSourceToVisual(s);
    counts[v.status] = (counts[v.status] || 0) + 1;
  });
  return counts;
}

/**
 * Render the filter bar UI into the given container.
 * @param {HTMLElement} container
 * @param {Array} allSources
 * @param {Object} activeFilters
 * @param {Function} onChange - called with (newFilters) when any filter changes
 */
export function renderFilterBar(container, allSources, activeFilters, onChange) {
  const STATUS_FILTER_OPTIONS = [
    { value: 'all', label: 'All' },
    { value: 'healthy', label: 'Healthy' },
    { value: 'flowering', label: 'Flowering' },
    { value: 'stale', label: 'Stale' },
    { value: 'failing', label: 'Failing' },
    { value: 'blocked', label: 'Blocked' },
    { value: 'dead', label: 'Dead' },
    { value: 'recovering', label: 'Recovering' },
    { value: 'quarantined', label: 'Quarantined' },
  ];

  const SORT_OPTIONS = [
    { value: 'risk', label: 'Risk' },
    { value: 'freshness', label: 'Freshness' },
    { value: 'reliability', label: 'Reliability' },
    { value: 'activity', label: 'Activity' },
    { value: 'name', label: 'Name' },
  ];

  const categories = getCategories(allSources);

  container.innerHTML = `
    <div class="filter-group filter-status-group" role="group" aria-label="Filter by status">
      ${STATUS_FILTER_OPTIONS.map(
        (opt) =>
          `<button class="filter-btn status-filter ${activeFilters.status === opt.value ? 'active' : ''}"
            data-filter-status="${opt.value}"
            aria-pressed="${activeFilters.status === opt.value}">${opt.label}</button>`
      ).join('')}
    </div>
    <div class="filter-group filter-aux-group">
      <select class="filter-select" id="filter-category" aria-label="Filter by category">
        ${categories.map(
          (c) => `<option value="${c}" ${activeFilters.category === c ? 'selected' : ''}>${c === 'all' ? 'All categories' : c}</option>`
        ).join('')}
      </select>
      <select class="filter-select" id="filter-sort" aria-label="Sort by">
        ${SORT_OPTIONS.map(
          (opt) =>
            `<option value="${opt.value}" ${activeFilters.sort === opt.value ? 'selected' : ''}>Sort: ${opt.label}</option>`
        ).join('')}
      </select>
      <label class="filter-search-label" aria-label="Search sources">
        <input type="search" class="filter-search" id="filter-search"
          placeholder="Search…" value="${activeFilters.search || ''}" />
      </label>
    </div>
  `;

  // Status buttons
  container.querySelectorAll('.status-filter').forEach((btn) => {
    btn.addEventListener('click', () => {
      const newStatus = btn.dataset.filterStatus;
      onChange({ ...activeFilters, status: newStatus });
    });
  });

  // Category select
  container.querySelector('#filter-category').addEventListener('change', (e) => {
    onChange({ ...activeFilters, category: e.target.value });
  });

  // Sort select
  container.querySelector('#filter-sort').addEventListener('change', (e) => {
    onChange({ ...activeFilters, sort: e.target.value });
  });

  // Search input
  let searchTimer;
  container.querySelector('#filter-search').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      onChange({ ...activeFilters, search: e.target.value });
    }, 250);
  });
}
