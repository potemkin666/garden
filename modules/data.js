/**
 * data.js — Data loading and parsing for Signal Garden.
 * Loads local JSON fixtures; can be adapted to accept live feed data later.
 */

const DATA_PATH = './data/mock-sources.json';

/**
 * Fetch and return source data from the JSON fixture.
 * Replace this function's implementation to connect a live pipeline.
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
  return data.map(normalizeSource);
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
