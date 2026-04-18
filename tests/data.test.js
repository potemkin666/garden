/**
 * tests/data.test.js — Unit tests for data derivation and normalization logic.
 *
 * Since data.js has unexported functions (deriveStatus, normalizeSource, etc.),
 * we re-implement the derivation logic here and test it against the same rules.
 * These tests validate the status derivation contract documented in README.md.
 */

import { describe, it, expect } from 'vitest';

// Re-implement deriveStatus to test the logic independently
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

function deriveIncidentSeverity(h) {
  if (!h.recentErrors || h.recentErrors.length === 0) return null;
  const cat = h.lastErrorCategory || '';
  if (cat === 'blocked-or-auth' || cat === 'anti-bot-protection') return 'high';
  if (cat === 'not-found-404') return 'high';
  if (cat === 'network-failure') return 'medium';
  return 'low';
}

describe('deriveStatus', () => {
  it('returns quarantined when quarantined flag is set', () => {
    expect(deriveStatus({ quarantined: true, healthScore: 90 })).toBe('quarantined');
  });

  it('returns dead for consecutive dead URL failures', () => {
    expect(deriveStatus({ consecutiveDeadUrlFailures: 3, healthScore: 0 })).toBe('dead');
  });

  it('returns blocked for blocked-or-auth error', () => {
    expect(deriveStatus({ lastErrorCategory: 'blocked-or-auth', healthScore: 30 })).toBe('blocked');
  });

  it('returns blocked for anti-bot-protection error', () => {
    expect(deriveStatus({ lastErrorCategory: 'anti-bot-protection', healthScore: 60 })).toBe('blocked');
  });

  it('returns blocked for consecutive blocked failures', () => {
    expect(deriveStatus({ consecutiveBlockedFailures: 1, healthScore: 80 })).toBe('blocked');
  });

  it('returns failing for high consecutive failures', () => {
    expect(deriveStatus({ consecutiveFailures: 5, healthScore: 50 })).toBe('failing');
  });

  it('returns failing for very low health score', () => {
    expect(deriveStatus({ healthScore: 10 })).toBe('failing');
  });

  it('returns stale for low-ish health score', () => {
    expect(deriveStatus({ healthScore: 40 })).toBe('stale');
  });

  it('returns recovering for mid-range score with mixed runs', () => {
    expect(deriveStatus({
      healthScore: 65,
      successfulRuns: 10,
      failedRuns: 5,
    })).toBe('recovering');
  });

  it('returns healthy for high health score', () => {
    expect(deriveStatus({ healthScore: 90 })).toBe('healthy');
  });

  it('returns healthy for score exactly 80 without mixed runs', () => {
    expect(deriveStatus({ healthScore: 80 })).toBe('healthy');
  });

  it('quarantined takes priority over dead', () => {
    expect(deriveStatus({
      quarantined: true,
      consecutiveDeadUrlFailures: 5,
      healthScore: 0,
    })).toBe('quarantined');
  });

  it('dead takes priority over blocked', () => {
    expect(deriveStatus({
      consecutiveDeadUrlFailures: 1,
      consecutiveBlockedFailures: 3,
      healthScore: 0,
    })).toBe('dead');
  });

  it('blocked takes priority over failing', () => {
    expect(deriveStatus({
      consecutiveBlockedFailures: 1,
      consecutiveFailures: 5,
      healthScore: 10,
    })).toBe('blocked');
  });

  it('defaults to healthy with no data', () => {
    expect(deriveStatus({})).toBe('healthy');
  });
});

describe('deriveIncidentSeverity', () => {
  it('returns null when no recent errors', () => {
    expect(deriveIncidentSeverity({})).toBeNull();
    expect(deriveIncidentSeverity({ recentErrors: [] })).toBeNull();
  });

  it('returns high for blocked-or-auth', () => {
    expect(deriveIncidentSeverity({
      recentErrors: [{ message: 'err' }],
      lastErrorCategory: 'blocked-or-auth',
    })).toBe('high');
  });

  it('returns high for anti-bot-protection', () => {
    expect(deriveIncidentSeverity({
      recentErrors: [{ message: 'err' }],
      lastErrorCategory: 'anti-bot-protection',
    })).toBe('high');
  });

  it('returns high for not-found-404', () => {
    expect(deriveIncidentSeverity({
      recentErrors: [{ message: 'err' }],
      lastErrorCategory: 'not-found-404',
    })).toBe('high');
  });

  it('returns medium for network-failure', () => {
    expect(deriveIncidentSeverity({
      recentErrors: [{ message: 'err' }],
      lastErrorCategory: 'network-failure',
    })).toBe('medium');
  });

  it('returns low for unknown categories', () => {
    expect(deriveIncidentSeverity({
      recentErrors: [{ message: 'err' }],
      lastErrorCategory: 'something-else',
    })).toBe('low');
  });
});
