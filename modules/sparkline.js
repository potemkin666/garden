/**
 * sparkline.js — Stores score history in localStorage and renders inline SVG sparklines.
 * History is keyed by source ID and stores the last 24 data points (one per load/refresh).
 */

const HISTORY_KEY = 'signal-garden-score-history';
const MAX_POINTS = 24;

/**
 * Load the full history map from localStorage.
 * @returns {Object} Map of sourceId → { freshness: number[], reliability: number[], timestamps: string[] }
 */
function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Save the history map to localStorage.
 */
function saveHistory(history) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Storage full — silently discard
  }
}

/**
 * Record current scores for all sources. Call once per data load/refresh cycle.
 * @param {Array} sources - Array of source objects
 */
export function recordScoreSnapshot(sources) {
  const history = loadHistory();
  const now = new Date().toISOString();

  sources.forEach((s) => {
    if (!history[s.id]) {
      history[s.id] = { freshness: [], reliability: [], timestamps: [] };
    }
    const h = history[s.id];
    h.freshness.push(s.freshnessScore);
    h.reliability.push(s.reliabilityScore);
    h.timestamps.push(now);

    // Trim to MAX_POINTS
    if (h.freshness.length > MAX_POINTS) {
      h.freshness = h.freshness.slice(-MAX_POINTS);
      h.reliability = h.reliability.slice(-MAX_POINTS);
      h.timestamps = h.timestamps.slice(-MAX_POINTS);
    }
  });

  saveHistory(history);
}

/**
 * Get the score history for a single source.
 * @param {string} sourceId
 * @returns {{ freshness: number[], reliability: number[], timestamps: string[] } | null}
 */
export function getSourceHistory(sourceId) {
  const history = loadHistory();
  return history[sourceId] || null;
}

/**
 * Render an inline SVG sparkline from an array of numeric values.
 * @param {number[]} values - Data points (0–100 expected)
 * @param {Object} [opts]
 * @param {number} [opts.width=60] - SVG width
 * @param {number} [opts.height=16] - SVG height
 * @param {string} [opts.color='#5a9a4a'] - Stroke color
 * @param {string} [opts.label='Trend'] - Accessible label
 * @returns {string} SVG markup string
 */
export function renderSparkline(values, opts = {}) {
  const {
    width = 60,
    height = 16,
    color = '#5a9a4a',
    label = 'Trend',
  } = opts;

  if (!values || values.length < 2) {
    return `<svg class="sparkline" width="${width}" height="${height}" role="img" aria-label="${label}: insufficient data"><title>${label}: insufficient data</title></svg>`;
  }

  const padY = 2;
  const innerH = height - padY * 2;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const step = width / (values.length - 1);

  const points = values.map((v, i) => {
    const x = (i * step).toFixed(1);
    const y = (padY + innerH - ((v - min) / range) * innerH).toFixed(1);
    return `${x},${y}`;
  });

  const polyline = points.join(' ');

  return (
    `<svg class="sparkline" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" ` +
    `role="img" aria-label="${label}: ${values[values.length - 1]}">` +
    `<title>${label}: ${values.join(' → ')}</title>` +
    `<polyline points="${polyline}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />` +
    `</svg>`
  );
}
