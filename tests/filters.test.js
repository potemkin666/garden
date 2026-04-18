/**
 * tests/filters.test.js — Unit tests for modules/filters.js
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { applyFilters, applySorting, getCategories, countByStatus } from '../modules/filters.js';
import { clearVisualCache } from '../modules/state-map.js';

function makeSources() {
  return [
    {
      id: 's1', name: 'Reuters Wire', category: 'news', status: 'healthy',
      freshnessScore: 97, reliabilityScore: 99, failureCount: 0,
      incidentCountRecent: 0, incidentSeverity: null, quarantined: false,
      blockedReason: null, notes: 'Primary wire feed.',
    },
    {
      id: 's2', name: 'Bloomberg', category: 'finance', status: 'healthy',
      freshnessScore: 94, reliabilityScore: 100, failureCount: 0,
      incidentCountRecent: 2, incidentSeverity: 'high', quarantined: false,
      blockedReason: null, notes: 'Market events.',
    },
    {
      id: 's3', name: 'Dead Source', category: 'news', status: 'dead',
      freshnessScore: 0, reliabilityScore: 0, failureCount: 88,
      incidentCountRecent: 0, incidentSeverity: null, quarantined: false,
      blockedReason: null, notes: 'Removed.',
    },
    {
      id: 's4', name: 'Twitter', category: 'social', status: 'blocked',
      freshnessScore: 0, reliabilityScore: 12, failureCount: 182,
      incidentCountRecent: 0, incidentSeverity: null, quarantined: false,
      blockedReason: 'API key revoked', notes: 'Hostile.',
    },
    {
      id: 's5', name: 'Telegram', category: 'social', status: 'quarantined',
      freshnessScore: 71, reliabilityScore: 58, failureCount: 8,
      incidentCountRecent: 4, incidentSeverity: 'medium', quarantined: true,
      blockedReason: null, notes: 'Under review.',
    },
  ];
}

describe('applyFilters', () => {
  beforeEach(() => clearVisualCache());

  it('returns all sources with no filters', () => {
    const sources = makeSources();
    const result = applyFilters(sources, { status: 'all', category: 'all', search: '' });
    expect(result.length).toBe(5);
  });

  it('filters by status', () => {
    clearVisualCache();
    const sources = makeSources();
    const result = applyFilters(sources, { status: 'dead', category: 'all', search: '' });
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('s3');
  });

  it('filters by category', () => {
    const sources = makeSources();
    const result = applyFilters(sources, { status: 'all', category: 'social', search: '' });
    expect(result.length).toBe(2);
  });

  it('filters by search', () => {
    const sources = makeSources();
    const result = applyFilters(sources, { status: 'all', category: 'all', search: 'bloomberg' });
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('s2');
  });

  it('search matches notes', () => {
    const sources = makeSources();
    const result = applyFilters(sources, { status: 'all', category: 'all', search: 'hostile' });
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('s4');
  });

  it('combines status and category filters', () => {
    clearVisualCache();
    const sources = makeSources();
    const result = applyFilters(sources, { status: 'blocked', category: 'social', search: '' });
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('s4');
  });
});

describe('applySorting', () => {
  beforeEach(() => clearVisualCache());

  it('sorts by name alphabetically', () => {
    const sources = makeSources();
    const sorted = applySorting(sources, 'name');
    expect(sorted[0].name).toBe('Bloomberg');
    expect(sorted[sorted.length - 1].name).toBe('Twitter');
  });

  it('sorts by freshness descending', () => {
    const sources = makeSources();
    const sorted = applySorting(sources, 'freshness');
    expect(sorted[0].freshnessScore).toBeGreaterThanOrEqual(sorted[1].freshnessScore);
  });

  it('sorts by reliability descending', () => {
    const sources = makeSources();
    const sorted = applySorting(sources, 'reliability');
    expect(sorted[0].reliabilityScore).toBeGreaterThanOrEqual(sorted[1].reliabilityScore);
  });

  it('sorts by risk (worst status first)', () => {
    clearVisualCache();
    const sources = makeSources();
    const sorted = applySorting(sources, 'risk');
    // Dead and blocked should come before healthy
    const deadIdx = sorted.findIndex((s) => s.status === 'dead');
    const healthyIdx = sorted.findIndex((s) => s.status === 'healthy');
    expect(deadIdx).toBeLessThan(healthyIdx);
  });

  it('returns a new array (does not mutate original)', () => {
    const sources = makeSources();
    const sorted = applySorting(sources, 'name');
    expect(sorted).not.toBe(sources);
  });
});

describe('getCategories', () => {
  it('returns unique categories with "all" first', () => {
    const sources = makeSources();
    const cats = getCategories(sources);
    expect(cats[0]).toBe('all');
    expect(cats).toContain('news');
    expect(cats).toContain('finance');
    expect(cats).toContain('social');
    // Should not have duplicates
    expect(new Set(cats).size).toBe(cats.length);
  });
});

describe('countByStatus', () => {
  beforeEach(() => clearVisualCache());

  it('counts sources by visual status', () => {
    const sources = makeSources();
    const counts = countByStatus(sources);
    // s1 is healthy, s2 is flowering (healthy + high incidents), s3 is dead, s4 is blocked, s5 is quarantined
    expect(counts.dead).toBe(1);
    expect(counts.blocked).toBe(1);
    expect(counts.quarantined).toBe(1);
  });
});
