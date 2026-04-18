/**
 * tests/utils.test.js — Unit tests for modules/utils.js
 */

import { describe, it, expect } from 'vitest';
import { hashCode, seededRng, clamp, lerp, formatDate, timeAgo, escapeHtml, scoreBar } from '../modules/utils.js';

describe('hashCode', () => {
  it('returns a non-negative number', () => {
    expect(hashCode('test')).toBeGreaterThanOrEqual(0);
  });

  it('returns the same hash for the same string', () => {
    expect(hashCode('src-001')).toBe(hashCode('src-001'));
  });

  it('returns different hashes for different strings', () => {
    expect(hashCode('a')).not.toBe(hashCode('b'));
  });

  it('handles empty string', () => {
    expect(hashCode('')).toBe(0);
  });
});

describe('seededRng', () => {
  it('returns consistent sequences for the same seed', () => {
    const rng1 = seededRng(42);
    const rng2 = seededRng(42);
    const seq1 = [rng1.next(), rng1.next(), rng1.next()];
    const seq2 = [rng2.next(), rng2.next(), rng2.next()];
    expect(seq1).toEqual(seq2);
  });

  it('returns values between 0 and 1', () => {
    const rng = seededRng(123);
    for (let i = 0; i < 100; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe('clamp', () => {
  it('clamps values below min', () => {
    expect(clamp(-5, 0, 100)).toBe(0);
  });

  it('clamps values above max', () => {
    expect(clamp(200, 0, 100)).toBe(100);
  });

  it('passes through values in range', () => {
    expect(clamp(50, 0, 100)).toBe(50);
  });

  it('handles edge values', () => {
    expect(clamp(0, 0, 100)).toBe(0);
    expect(clamp(100, 0, 100)).toBe(100);
  });
});

describe('lerp', () => {
  it('returns start at t=0', () => {
    expect(lerp(10, 20, 0)).toBe(10);
  });

  it('returns end at t=1', () => {
    expect(lerp(10, 20, 1)).toBe(20);
  });

  it('returns midpoint at t=0.5', () => {
    expect(lerp(0, 100, 0.5)).toBe(50);
  });

  it('clamps t to [0, 1]', () => {
    expect(lerp(0, 100, -1)).toBe(0);
    expect(lerp(0, 100, 2)).toBe(100);
  });
});

describe('formatDate', () => {
  it('returns — for null', () => {
    expect(formatDate(null)).toBe('—');
  });

  it('returns — for undefined', () => {
    expect(formatDate(undefined)).toBe('—');
  });

  it('formats a valid ISO string', () => {
    const result = formatDate('2026-04-17T19:40:00Z');
    expect(result).toContain('2026');
  });
});

describe('timeAgo', () => {
  it('returns "never" for null', () => {
    expect(timeAgo(null)).toBe('never');
  });

  it('returns "just now" for recent timestamps', () => {
    const now = new Date().toISOString();
    expect(timeAgo(now)).toBe('just now');
  });

  it('returns minutes for near-past', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60000).toISOString();
    expect(timeAgo(fiveMinAgo)).toBe('5m ago');
  });

  it('returns hours for further past', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 3600000).toISOString();
    expect(timeAgo(threeHoursAgo)).toBe('3h ago');
  });

  it('returns days for distant past', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();
    expect(timeAgo(twoDaysAgo)).toBe('2d ago');
  });
});

describe('escapeHtml', () => {
  it('escapes ampersands', () => {
    expect(escapeHtml('a&b')).toBe('a&amp;b');
  });

  it('escapes angle brackets', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes quotes', () => {
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
  });

  it('handles non-string input', () => {
    expect(escapeHtml(42)).toBe('42');
  });

  it('handles combined special chars', () => {
    expect(escapeHtml('<a href="x">&')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;');
  });
});

describe('scoreBar', () => {
  it('returns an HTML string with score-bar class', () => {
    const bar = scoreBar(75);
    expect(bar).toContain('score-bar');
    expect(bar).toContain('score-fill');
  });

  it('uses correct percentage', () => {
    const bar = scoreBar(50);
    expect(bar).toContain('width:50.0%');
  });

  it('clamps to 100%', () => {
    const bar = scoreBar(150);
    expect(bar).toContain('width:100.0%');
  });

  it('clamps to 0%', () => {
    const bar = scoreBar(-10);
    expect(bar).toContain('width:0.0%');
  });

  it('includes ARIA attributes for accessibility', () => {
    const bar = scoreBar(75, 100);
    expect(bar).toContain('role="meter"');
    expect(bar).toContain('aria-valuenow="75"');
    expect(bar).toContain('aria-valuemin="0"');
    expect(bar).toContain('aria-valuemax="100"');
  });
});
