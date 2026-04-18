/**
 * tests/state-map.test.js — Unit tests for modules/state-map.js
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { mapSourceToVisual, clearVisualCache, STATUS_COLORS, STATUS_LABELS, STATUS_LEGEND } from '../modules/state-map.js';

function makeSource(overrides = {}) {
  return {
    id: 'test-001',
    name: 'Test Source',
    category: 'test',
    status: 'healthy',
    freshnessScore: 90,
    reliabilityScore: 95,
    failureCount: 0,
    incidentCountRecent: 0,
    incidentSeverity: null,
    quarantined: false,
    blockedReason: null,
    ...overrides,
  };
}

describe('mapSourceToVisual', () => {
  beforeEach(() => clearVisualCache());

  it('maps healthy source to healthy visual', () => {
    const v = mapSourceToVisual(makeSource());
    expect(v.status).toBe('healthy');
    expect(v.animClass).toContain('anim-sway');
    expect(v.stemHealth).toBe(1.0);
  });

  it('promotes healthy source with critical incidents to flowering', () => {
    const v = mapSourceToVisual(makeSource({
      incidentCountRecent: 5,
      incidentSeverity: 'critical',
    }));
    expect(v.status).toBe('flowering');
    expect(v.flowerBloomed).toBe(1.0);
    expect(v.flowerGlow).toBe(true);
    expect(v.animClass).toContain('anim-glow');
  });

  it('maps stale source correctly', () => {
    const v = mapSourceToVisual(makeSource({ status: 'stale', freshnessScore: 30 }));
    expect(v.status).toBe('stale');
    expect(v.leafDroop).toBeGreaterThan(0.3);
    expect(v.animClass).toContain('anim-droop');
  });

  it('maps failing source with high failure count', () => {
    const v = mapSourceToVisual(makeSource({ status: 'failing', failureCount: 20 }));
    expect(v.status).toBe('failing');
    expect(v.decayLevel).toBeGreaterThan(0);
    expect(v.animClass).toContain('anim-droop');
  });

  it('maps blocked source to thorny visual', () => {
    const v = mapSourceToVisual(makeSource({ status: 'blocked' }));
    expect(v.status).toBe('blocked');
    expect(v.thorny).toBe(true);
    expect(v.animClass).toContain('anim-hostile');
  });

  it('maps dead source with no animation', () => {
    const v = mapSourceToVisual(makeSource({ status: 'dead', freshnessScore: 0, reliabilityScore: 0 }));
    expect(v.status).toBe('dead');
    expect(v.stemHealth).toBeLessThan(0.1);
    expect(v.animClass).toBe('');
  });

  it('maps recovering source with new shoots', () => {
    const v = mapSourceToVisual(makeSource({ status: 'recovering', reliabilityScore: 60 }));
    expect(v.status).toBe('recovering');
    expect(v.hasNewShoots).toBe(true);
    expect(v.animClass).toContain('anim-sway-slow');
  });

  it('maps quarantined source with bell jar', () => {
    const v = mapSourceToVisual(makeSource({ quarantined: true }));
    expect(v.status).toBe('quarantined');
    expect(v.quarantineJar).toBe(true);
  });

  it('caches results by source id', () => {
    const source = makeSource();
    const v1 = mapSourceToVisual(source);
    const v2 = mapSourceToVisual(source);
    expect(v1).toBe(v2); // Same object reference
  });

  it('cache is cleared by clearVisualCache', () => {
    const source = makeSource();
    const v1 = mapSourceToVisual(source);
    clearVisualCache();
    const v2 = mapSourceToVisual(source);
    expect(v1).not.toBe(v2); // Different reference after cache clear
    expect(v1).toEqual(v2);  // But same content
  });
});

describe('STATUS_COLORS', () => {
  it('has a color for every status', () => {
    const statuses = ['healthy', 'flowering', 'stale', 'failing', 'blocked', 'dead', 'recovering', 'quarantined'];
    statuses.forEach((s) => {
      expect(STATUS_COLORS[s]).toBeDefined();
      expect(STATUS_COLORS[s]).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });
});

describe('STATUS_LABELS', () => {
  it('has a label for every status', () => {
    const statuses = ['healthy', 'flowering', 'stale', 'failing', 'blocked', 'dead', 'recovering', 'quarantined'];
    statuses.forEach((s) => {
      expect(STATUS_LABELS[s]).toBeDefined();
      expect(typeof STATUS_LABELS[s]).toBe('string');
    });
  });
});

describe('STATUS_LEGEND', () => {
  it('covers all 8 statuses', () => {
    expect(STATUS_LEGEND.length).toBe(8);
    const legendStatuses = STATUS_LEGEND.map((l) => l.status);
    expect(legendStatuses).toContain('healthy');
    expect(legendStatuses).toContain('dead');
    expect(legendStatuses).toContain('quarantined');
  });

  it('each entry has required fields', () => {
    STATUS_LEGEND.forEach((entry) => {
      expect(entry).toHaveProperty('status');
      expect(entry).toHaveProperty('symbol');
      expect(entry).toHaveProperty('label');
      expect(entry).toHaveProperty('desc');
    });
  });
});
