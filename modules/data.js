/**
 * data.js — Data loading, persistence, and normalization for Signal Garden.
 * Fetches live source-health data from AlbertAlert and merges with
 * user-added sources from localStorage.
 */

const ALBERTALERT_LIVE_URL =
  'https://raw.githubusercontent.com/potemkin666/AlbertAlert/main/live-alerts.json';
const FALLBACK_DATA_PATH = './data/sources.json';
const STORAGE_KEY = 'signal-garden-user-sources';

/**
 * Fetch source-health data from AlbertAlert, falling back to local fixtures.
 * Always merges with user-added sources from localStorage.
 * @returns {Promise<Array>} Array of source objects
 */
export async function loadSources() {
  let base;
  try {
    base = await loadAlbertAlertSources();
  } catch (err) {
    console.warn('[Signal Garden] AlbertAlert fetch failed, using local fallback:', err.message);
    base = await loadLocalSources();
  }
  const user = getUserSources();
  return mergeSources(base, user);
}

/**
 * Fetch AlbertAlert live-alerts.json and extract per-source health data.
 * @returns {Promise<Array>} Array of normalized source objects
 */
async function loadAlbertAlertSources() {
  const response = await fetch(ALBERTALERT_LIVE_URL);
  if (!response.ok) {
    throw new Error(`AlbertAlert fetch failed: ${response.status} ${response.statusText}`);
  }
  const payload = await response.json();
  const healthSources = payload?.health?.sources;
  if (!healthSources || typeof healthSources !== 'object') {
    throw new Error('AlbertAlert payload missing health.sources');
  }
  return Object.entries(healthSources).map(([id, entry]) =>
    normalizeSource(transformAlbertAlertSource(id, entry))
  );
}

/**
 * Load local fallback data from data/sources.json.
 * @returns {Promise<Array>}
 */
async function loadLocalSources() {
  const response = await fetch(FALLBACK_DATA_PATH);
  if (!response.ok) {
    throw new Error(`Local fallback failed: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error('Local source data must be a JSON array.');
  }
  return data.map(normalizeSource);
}

/**
 * Transform an AlbertAlert health.sources entry into a Signal Garden source
 * object. Fields that don't exist in AlbertAlert are derived from available
 * health metrics.
 */
function transformAlbertAlertSource(id, h) {
  const status = deriveStatus(h);
  const totalRuns = (h.successfulRuns || 0) + (h.failedRuns || 0) + (h.emptyRuns || 0);
  const reliabilityScore = totalRuns > 0
    ? Math.round(((h.successfulRuns || 0) / totalRuns) * 100)
    : 50;

  return {
    id,
    name: h.provider || id,
    category: h.lane || 'uncategorized',
    status,
    lastSuccessAt: h.lastSuccessfulAt ?? null,
    lastFailureAt: h.lastFailureAt ?? null,
    failureCount: (h.consecutiveFailures || 0) + (h.failedRuns || 0),
    freshnessScore: h.healthScore ?? 50,
    reliabilityScore,
    blockedReason: status === 'blocked'
      ? (h.lastErrorMessage || h.quarantineReason || null)
      : null,
    quarantined: Boolean(h.quarantined),
    incidentCountRecent: h.recentErrors?.length || 0,
    incidentSeverity: deriveIncidentSeverity(h),
    notes: buildNotes(h),
  };
}

/**
 * Derive a Signal Garden status string from AlbertAlert health metrics.
 */
function deriveStatus(h) {
  if (h.quarantined) return 'quarantined';
  if ((h.consecutiveDeadUrlFailures || 0) > 0) return 'dead';
  const errCat = h.lastErrorCategory || '';
  if (
    (h.consecutiveBlockedFailures || 0) > 0 ||
    errCat === 'blocked-or-auth' ||
    errCat === 'anti-bot-protection'
  ) {
    return 'blocked';
  }
  const score = h.healthScore ?? 50;
  if ((h.consecutiveFailures || 0) > 2 || score < 20) return 'failing';
  if (score < 50) return 'stale';
  if (score < 80 && (h.successfulRuns || 0) > 0 && (h.failedRuns || 0) > 0) return 'recovering';
  return 'healthy';
}

/**
 * Map AlbertAlert error severity to Signal Garden incident severity.
 */
function deriveIncidentSeverity(h) {
  if (!h.recentErrors || h.recentErrors.length === 0) return null;
  const cat = h.lastErrorCategory || '';
  if (cat === 'blocked-or-auth' || cat === 'anti-bot-protection') return 'high';
  if (cat === 'not-found-404') return 'critical';
  if (cat === 'network-failure') return 'medium';
  return 'low';
}

/**
 * Build a human-readable notes string from AlbertAlert health metadata.
 */
function buildNotes(h) {
  const parts = [];
  if (h.kind) parts.push(`Kind: ${h.kind}`);
  if (h.quarantineReason) parts.push(h.quarantineReason);
  else if (h.lastErrorMessage) parts.push(h.lastErrorMessage);
  if (h.autoSkipReason) parts.push(`Skip reason: ${h.autoSkipReason}`);
  const total = (h.successfulRuns || 0) + (h.failedRuns || 0) + (h.emptyRuns || 0);
  if (total > 0) {
    parts.push(`Runs: ${h.successfulRuns || 0} ok, ${h.failedRuns || 0} fail, ${h.emptyRuns || 0} empty`);
  }
  return parts.join('. ') || '';
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
    (s) => (s.status === 'healthy' || s.status === 'flowering') && !s.quarantined
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
