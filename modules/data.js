/**
 * data.js — Data loading, persistence, and normalization for Signal Garden.
 * Loads base JSON fixtures + merges user-added sources from localStorage.
 */

const DATA_PATH = './data/sources.json';
const STORAGE_KEY = 'signal-garden-user-sources';

/**
 * Fetch base source data and merge with user-added sources from localStorage.
 * @returns {Promise<Array>} Array of source objects
 */
export async function loadSources() {
  const response = await fetch(DATA_PATH);
  if (!response.ok) {
    throw new Error(`Failed to load source data: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error('Source data must be a JSON array.');
  }
  const base = data.map(normalizeSource);
  const user = getUserSources();
  return mergeSources(base, user);
}

/**
 * Get user-added sources from localStorage.
 * @returns {Array}
 */
export function getUserSources() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeSource) : [];
  } catch {
    return [];
  }
}

/**
 * Save a new source to localStorage.
 * @param {Object} source - Source data object
 */
export function addUserSource(source) {
  const sources = getUserSources();
  const normalized = normalizeSource(source);
  // Prevent duplicate IDs
  const existing = sources.findIndex((s) => s.id === normalized.id);
  if (existing >= 0) {
    sources[existing] = normalized;
  } else {
    sources.push(normalized);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sources));
  return normalized;
}

/**
 * Remove a user-added source by ID.
 * @param {string} id
 */
export function removeUserSource(id) {
  const sources = getUserSources().filter((s) => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sources));
}

/**
 * Export all sources (base + user) as a downloadable JSON blob.
 * @param {Array} allSources
 */
export function exportSourcesJSON(allSources) {
  const json = JSON.stringify(allSources, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sources.json';
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export only healthy/flowering sources as JSON — for consumption by external repos.
 * @param {Array} allSources
 */
export function exportHealthyJSON(allSources) {
  const healthy = allSources.filter(
    (s) => s.status === 'healthy' && !s.quarantined
  );
  const json = JSON.stringify(healthy, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'healthy-sources.json';
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Check if a source ID belongs to a user-added source.
 * @param {string} id
 * @returns {boolean}
 */
export function isUserSource(id) {
  return getUserSources().some((s) => s.id === id);
}

/**
 * Merge base and user sources. User sources override base sources with same ID.
 */
function mergeSources(base, user) {
  const map = new Map();
  base.forEach((s) => map.set(s.id, s));
  user.forEach((s) => map.set(s.id, s));
  return Array.from(map.values());
}

/**
 * Normalize and fill in any missing/optional fields with safe defaults.
 */
function normalizeSource(raw) {
  return {
    id: raw.id ?? `src-${Math.random().toString(36).slice(2)}`,
    name: raw.name ?? 'Unnamed Source',
    category: raw.category ?? 'uncategorized',
    status: raw.status ?? 'unknown',
    lastSuccessAt: raw.lastSuccessAt ?? null,
    lastFailureAt: raw.lastFailureAt ?? null,
    failureCount: Number(raw.failureCount ?? 0),
    freshnessScore: Number(raw.freshnessScore ?? 50),
    reliabilityScore: Number(raw.reliabilityScore ?? 50),
    blockedReason: raw.blockedReason ?? null,
    quarantined: Boolean(raw.quarantined ?? false),
    incidentCountRecent: Number(raw.incidentCountRecent ?? 0),
    incidentSeverity: raw.incidentSeverity ?? null,
    notes: raw.notes ?? '',
  };
}
