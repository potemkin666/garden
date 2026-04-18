/**
 * tests/sparkline.test.js — Unit tests for modules/sparkline.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderSparkline } from '../modules/sparkline.js';

describe('renderSparkline', () => {
  it('returns SVG markup with sparkline class', () => {
    const svg = renderSparkline([10, 20, 30]);
    expect(svg).toContain('<svg');
    expect(svg).toContain('class="sparkline"');
    expect(svg).toContain('<polyline');
  });

  it('returns "insufficient data" for less than 2 points', () => {
    const svg = renderSparkline([42]);
    expect(svg).toContain('insufficient data');
    expect(svg).not.toContain('<polyline');
  });

  it('returns "insufficient data" for empty array', () => {
    const svg = renderSparkline([]);
    expect(svg).toContain('insufficient data');
  });

  it('returns "insufficient data" for null', () => {
    const svg = renderSparkline(null);
    expect(svg).toContain('insufficient data');
  });

  it('uses custom color option', () => {
    const svg = renderSparkline([10, 20, 30], { color: '#ff0000' });
    expect(svg).toContain('stroke="#ff0000"');
  });

  it('uses custom dimensions', () => {
    const svg = renderSparkline([10, 20, 30], { width: 120, height: 32 });
    expect(svg).toContain('width="120"');
    expect(svg).toContain('height="32"');
  });

  it('includes accessible title element', () => {
    const svg = renderSparkline([10, 20, 30], { label: 'Test trend' });
    expect(svg).toContain('<title>');
    expect(svg).toContain('Test trend');
  });

  it('shows the final value in aria-label', () => {
    const svg = renderSparkline([10, 20, 30], { label: 'Score' });
    expect(svg).toContain('aria-label="Score: 30"');
  });

  it('handles all-zero values', () => {
    const svg = renderSparkline([0, 0, 0]);
    expect(svg).toContain('<polyline');
  });

  it('handles all-same values', () => {
    const svg = renderSparkline([50, 50, 50]);
    expect(svg).toContain('<polyline');
  });
});
