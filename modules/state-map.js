/**
 * state-map.js — Maps source data to visual properties.
 * Central authority for all status → appearance rules.
 */

import { clamp, lerp } from './utils.js';

// ─── Visual cache ───────────────────────────────────────────────────────────────
// Keyed by source.id; invalidated each render cycle via clearVisualCache().
const _visualCache = new Map();

/**
 * Clear the visual cache. Call once at the start of each render cycle.
 */
export function clearVisualCache() {
  _visualCache.clear();
}

/**
 * @param {Object} source - Source data object from sources.json
 * @returns {Object} visual - Visual property bag consumed by render-plant.js
 */
export function mapSourceToVisual(source) {
  if (_visualCache.has(source.id)) {
    return _visualCache.get(source.id);
  }
  const visual = _computeVisual(source);
  _visualCache.set(source.id, visual);
  return visual;
}

function _computeVisual(source) {
  const {
    status,
    freshnessScore,
    reliabilityScore,
    failureCount,
    incidentCountRecent,
    incidentSeverity,
    quarantined,
  } = source;

  // Derive effective visual status
  let effectiveStatus = quarantined ? 'quarantined' : status;

  // Healthy sources with active high-priority incidents bloom
  if (
    status === 'healthy' &&
    !quarantined &&
    incidentCountRecent > 0 &&
    (incidentSeverity === 'high' || incidentSeverity === 'critical')
  ) {
    effectiveStatus = 'flowering';
  }

  const visual = {
    status: effectiveStatus,
    stemColor: '#2d5a27',
    leafColor: '#3a6b32',
    flowerColor: '#8b1a1a',
    flowerCenterColor: '#c94020',
    flowerBloomed: 0,
    flowerGlow: false,
    stemHealth: 1.0,
    leafVigor: 1.0,
    leafDroop: 0,
    decayLevel: 0,
    thorny: false,
    quarantineJar: false,
    hasNewShoots: false,
    animClass: '',
    statusLabel: effectiveStatus,
    statusDescription: '',
  };

  switch (effectiveStatus) {
    case 'healthy': {
      visual.stemColor = '#2d5a27';
      visual.leafColor = '#3a6b32';
      visual.flowerColor = '#7a1a1a';
      visual.flowerBloomed = clamp(0.5 + freshnessScore * 0.005, 0.5, 1.0);
      visual.stemHealth = 1.0;
      visual.leafVigor = 0.95;
      visual.leafDroop = 0.05;
      visual.animClass = 'anim-sway';
      visual.statusDescription = 'Source is active and reliable.';
      break;
    }

    case 'flowering': {
      visual.stemColor = '#3a6b32';
      visual.leafColor = '#4a8440';
      visual.flowerColor = '#d44030';
      visual.flowerCenterColor = '#f0c030';
      visual.flowerBloomed = 1.0;
      visual.flowerGlow = true;
      visual.stemHealth = 1.0;
      visual.leafVigor = 1.0;
      visual.leafDroop = 0.0;
      visual.animClass = 'anim-sway anim-glow';
      visual.statusDescription = `Blooming — ${incidentCountRecent} active ${incidentSeverity} incident(s).`;
      break;
    }

    case 'stale': {
      const staleness = 1 - clamp(freshnessScore / 100, 0, 1);
      visual.stemColor = '#5a6a1a';
      visual.leafColor = staleness > 0.5 ? '#7a7030' : '#5a6a22';
      visual.flowerColor = '#5a5a20';
      visual.flowerBloomed = clamp(0.15 - staleness * 0.1, 0, 0.2);
      visual.stemHealth = lerp(0.88, 0.62, staleness);
      visual.leafVigor = lerp(0.7, 0.35, staleness);
      visual.leafDroop = lerp(0.3, 0.7, staleness);
      visual.decayLevel = staleness * 0.3;
      visual.animClass = 'anim-droop';
      visual.statusDescription = `Stale — freshness score ${freshnessScore}. Last data may be outdated.`;
      break;
    }

    case 'failing': {
      const failRatio = clamp(failureCount / 25, 0, 1);
      visual.stemColor = failRatio > 0.5 ? '#7a3a10' : '#5a4a1a';
      visual.leafColor = failRatio > 0.5 ? '#7a4010' : '#6a5020';
      visual.flowerBloomed = 0;
      visual.stemHealth = lerp(0.72, 0.38, failRatio);
      visual.leafVigor = lerp(0.45, 0.15, failRatio);
      visual.leafDroop = lerp(0.55, 0.88, failRatio);
      visual.decayLevel = lerp(0.3, 0.75, failRatio);
      visual.animClass = 'anim-droop';
      visual.statusDescription = `Failing — ${failureCount} failures. Degraded or unavailable.`;
      break;
    }

    case 'blocked': {
      visual.stemColor = '#14121e';
      visual.leafColor = '#1a182a';
      visual.flowerBloomed = 0;
      visual.stemHealth = 0.7;
      visual.leafVigor = 0.08;
      visual.leafDroop = 0.4;
      visual.decayLevel = 0.6;
      visual.thorny = true;
      visual.animClass = 'anim-hostile';
      visual.statusDescription = source.blockedReason || 'Access blocked. Anti-bot or auth wall active.';
      break;
    }

    case 'dead': {
      visual.stemColor = '#3a3530';
      visual.leafColor = '#4a4440';
      visual.flowerBloomed = 0;
      visual.stemHealth = 0.08;
      visual.leafVigor = 0.05;
      visual.leafDroop = 1.0;
      visual.decayLevel = 1.0;
      visual.animClass = '';
      visual.statusDescription = 'Source is dead. Endpoint removed or permanently offline.';
      break;
    }

    case 'recovering': {
      const recov = clamp(reliabilityScore / 100, 0, 1);
      visual.stemColor = '#3a6030';
      visual.leafColor = '#5a8a4a';
      visual.flowerColor = '#5a7a30';
      visual.flowerBloomed = recov * 0.25;
      visual.stemHealth = lerp(0.52, 0.72, recov);
      visual.leafVigor = lerp(0.35, 0.6, recov);
      visual.leafDroop = lerp(0.4, 0.2, recov);
      visual.decayLevel = lerp(0.35, 0.1, recov);
      visual.hasNewShoots = true;
      visual.animClass = 'anim-sway-slow';
      visual.statusDescription = `Recovering — ${reliabilityScore}% reliability restored.`;
      break;
    }

    case 'quarantined': {
      visual.stemColor = '#4a5a3a';
      visual.leafColor = '#4a6a3a';
      visual.flowerColor = '#6a7a2a';
      visual.flowerBloomed = 0.3;
      visual.stemHealth = 0.78;
      visual.leafVigor = 0.5;
      visual.leafDroop = 0.25;
      visual.decayLevel = 0.15;
      visual.quarantineJar = true;
      visual.animClass = 'anim-sway-slow';
      visual.statusDescription = 'Quarantined — isolated pending investigation. Data not ingested.';
      break;
    }

    default:
      break;
  }

  return visual;
}

/**
 * Returns a hex color for a given status (used in legend, labels, etc.)
 */
export const STATUS_COLORS = {
  healthy: '#3a7a32',
  flowering: '#6ab030',
  stale: '#8a8a30',
  failing: '#8a5a1a',
  blocked: '#4a3a6a',
  dead: '#5a5048',
  recovering: '#5a9a4a',
  quarantined: '#7a6a3a',
};

/**
 * Human-readable label for each status
 */
export const STATUS_LABELS = {
  healthy: 'Healthy',
  flowering: 'Flowering',
  stale: 'Stale',
  failing: 'Failing',
  blocked: 'Blocked',
  dead: 'Dead',
  recovering: 'Recovering',
  quarantined: 'Quarantined',
};

/**
 * Legend descriptions
 */
export const STATUS_LEGEND = [
  {
    status: 'healthy',
    symbol: '🌿',
    label: 'Healthy',
    desc: 'Source is active, fresh, and reliable.',
  },
  {
    status: 'flowering',
    symbol: '🌸',
    label: 'Flowering',
    desc: 'Healthy with high-priority active incidents.',
  },
  {
    status: 'stale',
    symbol: '🍂',
    label: 'Stale',
    desc: 'No recent data. Source may be slow or idle.',
  },
  {
    status: 'failing',
    symbol: '🥀',
    label: 'Failing',
    desc: 'Repeated errors. Degraded or intermittent.',
  },
  {
    status: 'blocked',
    symbol: '🌑',
    label: 'Blocked',
    desc: 'Access wall. Anti-bot, auth failure, or hostile endpoint.',
  },
  {
    status: 'dead',
    symbol: '💀',
    label: 'Dead',
    desc: 'Source removed or permanently offline.',
  },
  {
    status: 'recovering',
    symbol: '🌱',
    label: 'Recovering',
    desc: 'Recently fixed. Regaining reliability.',
  },
  {
    status: 'quarantined',
    symbol: '🔔',
    label: 'Quarantined',
    desc: 'Isolated for review. Data held, not ingested.',
  },
];
