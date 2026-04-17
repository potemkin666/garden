/**
 * render-plant.js — Generates SVG markup for each plant based on visual state.
 * Coordinate space: 0–100 wide, 0–200 tall. Plant grows from y=185 upward.
 */

import { hashCode, seededRng, clamp, lerp } from './utils.js';

const W = 100;
const H = 200;
const BASE_X = 50;
const BASE_Y = 185;

function f(n) {
  return parseFloat(n.toFixed(2));
}

/**
 * Generate an SVG leaf path (quadratic bezier lozenge shape).
 * angle: direction of leaf in degrees (0 = right, 90 = up, 180 = left, 270 = down)
 */
function leafPath(x, y, angle, length, width) {
  const rad = ((angle - 90) * Math.PI) / 180;
  const tipX = x + Math.cos(rad) * length;
  const tipY = y + Math.sin(rad) * length;
  const perpRad = rad + Math.PI / 2;
  const wX = Math.cos(perpRad) * width;
  const wY = Math.sin(perpRad) * width;
  const t = 0.55;
  const midX = x + (tipX - x) * t;
  const midY = y + (tipY - y) * t;
  return (
    `M ${f(x)} ${f(y)} ` +
    `Q ${f(midX + wX * 0.9)} ${f(midY + wY * 0.9)} ${f(tipX)} ${f(tipY)} ` +
    `Q ${f(midX - wX * 0.9)} ${f(midY - wY * 0.9)} ${f(x)} ${f(y)} Z`
  );
}

/**
 * A single petal positioned around a center point.
 */
function petalPath(cx, cy, angle, petalLen, petalW) {
  return leafPath(cx, cy, angle, petalLen, petalW);
}

/**
 * Flower SVG group (petals + center).
 */
function flowerSVG(cx, cy, petalCount, petalLen, petalW, centerR, flowerColor, centerColor, glassClass) {
  const petals = [];
  for (let i = 0; i < petalCount; i++) {
    const ang = (i / petalCount) * 360;
    petals.push(
      `<path d="${petalPath(cx, cy, ang, petalLen, petalW)}" fill="${flowerColor}" class="petal ${glassClass}" />`
    );
  }
  petals.push(
    `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(centerR)}" fill="${centerColor}" class="flower-center ${glassClass}" />`
  );
  return petals.join('');
}

/**
 * A thorn spike: small sharp triangle protruding from a stem point.
 */
function thornSVG(x, y, dir) {
  const sx = dir * 5;
  return `<path d="M ${f(x)} ${f(y)} L ${f(x + sx)} ${f(y - 4)} L ${f(x + sx * 0.4)} ${f(y + 2)} Z"
    fill="#1a1626" class="thorn" />`;
}

/**
 * Bell jar overlay for quarantined plants.
 */
function bellJarSVG(baseX, jarTop) {
  const jarH = BASE_Y - jarTop + 8;
  const jarW = 34;
  const rx = jarW / 2;
  // Dome arc + straight sides + base rim
  return `
    <ellipse cx="${f(baseX)}" cy="${f(jarTop)}" rx="${f(rx)}" ry="10"
      fill="none" stroke="#7a9aaa" stroke-width="1.2" opacity="0.55" class="jar-top" />
    <rect x="${f(baseX - rx)}" y="${f(jarTop)}" width="${f(jarW)}" height="${f(jarH - 4)}"
      fill="none" stroke="#7a9aaa" stroke-width="1.2" opacity="0.42" class="jar-body" />
    <ellipse cx="${f(baseX)}" cy="${f(BASE_Y + 2)}" rx="${f(rx + 2)}" ry="5"
      fill="none" stroke="#7a9aaa" stroke-width="1.5" opacity="0.55" class="jar-base" />
    <rect x="${f(baseX - rx)}" y="${f(jarTop)}" width="${f(jarW)}" height="${f(jarH - 4)}"
      fill="#8ab0c0" opacity="0.04" class="jar-glass" />`;
}

/**
 * Soil mound at the base.
 */
function soilSVG(status) {
  const col = status === 'dead' ? '#2a2520' : status === 'blocked' ? '#14121a' : '#1e1a0e';
  return `<ellipse cx="${BASE_X}" cy="${BASE_Y + 4}" rx="28" ry="7" fill="${col}" class="soil" />`;
}

/**
 * Upright healthy/recovering stem using cubic bezier.
 * Returns { stemEl, points } where points = [{x,y}] sampled along stem for leaf placement.
 */
function uprightStem(rng, stemColor, stemHealth, strokeWidth = 2.5) {
  const topY = lerp(BASE_Y - 30, BASE_Y - 158, stemHealth);
  const drift = (rng.next() - 0.5) * 14;
  const cp1x = BASE_X + drift * 0.3;
  const cp1y = lerp(BASE_Y, BASE_Y - 60, 0.35);
  const cp2x = BASE_X + drift * 0.7;
  const cp2y = lerp(BASE_Y, topY, 0.7);
  const topX = BASE_X + drift;

  const stemEl = `<path d="M ${BASE_X} ${BASE_Y} C ${f(cp1x)} ${f(cp1y)} ${f(cp2x)} ${f(cp2y)} ${f(topX)} ${f(topY)}"
    fill="none" stroke="${stemColor}" stroke-width="${strokeWidth}" stroke-linecap="round" class="stem" />`;

  // Sample points along cubic bezier
  const points = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const mt = 1 - t;
    const px =
      mt * mt * mt * BASE_X +
      3 * mt * mt * t * cp1x +
      3 * mt * t * t * cp2x +
      t * t * t * topX;
    const py =
      mt * mt * mt * BASE_Y +
      3 * mt * mt * t * cp1y +
      3 * mt * t * t * cp2y +
      t * t * t * topY;
    points.push({ x: px, y: py });
  }

  return { stemEl, points, topX, topY };
}

// ─── Per-state plant generators ────────────────────────────────────────────────

function renderHealthyPlant(rng, visual) {
  const parts = [];
  const { stemEl, points, topX, topY } = uprightStem(rng, visual.stemColor, visual.stemHealth);
  parts.push(stemEl);

  const leafPairs = 3;
  const startIdx = 1;
  const leafVigor = visual.leafVigor;
  const leafDroop = visual.leafDroop;

  for (let i = 0; i < leafPairs; i++) {
    const idx = startIdx + Math.floor((i / leafPairs) * (points.length - startIdx - 2));
    const p = points[idx];
    const sizeVar = 0.85 + rng.next() * 0.3;
    const len = 22 * leafVigor * sizeVar;
    const wid = 9 * leafVigor;
    const baseAngle = lerp(140, 90, leafDroop);
    const angL = baseAngle + (rng.next() - 0.5) * 15;
    const angR = 180 - angL + (rng.next() - 0.5) * 15;
    parts.push(
      `<path d="${leafPath(p.x, p.y, angL, len, wid)}" fill="${visual.leafColor}" class="leaf" />`,
      `<path d="${leafPath(p.x, p.y, angR, len, wid)}" fill="${visual.leafColor}" class="leaf" />`
    );
  }

  // Flowers
  if (visual.flowerBloomed > 0.3) {
    const bloom = visual.flowerBloomed;
    const pLen = 5 * bloom;
    const pW = 3 * bloom;
    const glassClass = visual.flowerGlow ? 'glow-target' : '';
    parts.push(flowerSVG(topX, topY, 6, pLen, pW, 3.5, visual.flowerColor, visual.flowerCenterColor, glassClass));
    if (bloom > 0.7) {
      const offX = (rng.next() - 0.5) * 10;
      parts.push(flowerSVG(topX + offX, topY + 14, 5, pLen * 0.8, pW * 0.8, 2.8, visual.flowerColor, visual.flowerCenterColor, glassClass));
    }
  }

  return parts;
}

function renderStalePlant(rng, visual) {
  const parts = [];
  const { stemEl, points, topX, topY } = uprightStem(rng, visual.stemColor, visual.stemHealth, 2.2);
  parts.push(stemEl);

  const leafVigor = visual.leafVigor;
  const leafDroop = visual.leafDroop;
  const leafCount = 2 + Math.floor(rng.next() * 2);

  for (let i = 0; i < leafCount; i++) {
    const idx = 1 + Math.floor((i / leafCount) * (points.length - 3));
    const p = points[idx];
    const len = 18 * leafVigor * (0.7 + rng.next() * 0.3);
    const wid = 7 * leafVigor;
    const angL = lerp(140, 200, leafDroop) + (rng.next() - 0.5) * 20;
    const angR = 180 - angL + (rng.next() - 0.5) * 20;
    parts.push(
      `<path d="${leafPath(p.x, p.y, angL, len, wid)}" fill="${visual.leafColor}" class="leaf" opacity="0.85" />`,
      `<path d="${leafPath(p.x, p.y, angR, len, wid)}" fill="${visual.leafColor}" class="leaf" opacity="0.85" />`
    );
  }

  // Withered bud if any bloom
  if (visual.flowerBloomed > 0) {
    parts.push(`<circle cx="${f(topX)}" cy="${f(topY)}" r="3" fill="${visual.stemColor}" opacity="0.7" class="bud" />`);
  }

  return parts;
}

function renderFailingPlant(rng, visual) {
  const parts = [];
  const { stemEl, points, topX, topY } = uprightStem(rng, visual.stemColor, visual.stemHealth, 2.0);
  parts.push(stemEl);

  const leafVigor = visual.leafVigor;
  const leafDroop = visual.leafDroop;
  const leafCount = 1 + Math.floor(rng.next() * 2);

  for (let i = 0; i < leafCount; i++) {
    const idx = 1 + Math.floor((i / (leafCount + 1)) * (points.length - 2));
    const p = points[idx];
    const len = 16 * leafVigor * (0.5 + rng.next() * 0.5);
    const wid = 6 * leafVigor;
    const angL = lerp(150, 220, leafDroop) + (rng.next() - 0.5) * 25;
    parts.push(
      `<path d="${leafPath(p.x, p.y, angL, len, wid)}" fill="${visual.leafColor}" class="leaf" opacity="0.7" />`
    );
    if (rng.next() > 0.4) {
      const angR = 180 - angL + (rng.next() - 0.5) * 25;
      parts.push(
        `<path d="${leafPath(p.x, p.y, angR, len * 0.7, wid * 0.7)}" fill="${visual.leafColor}" class="leaf" opacity="0.6" />`
      );
    }
  }

  // Decay spots
  for (let i = 0; i < 2; i++) {
    const idx = 1 + Math.floor(rng.next() * (points.length - 2));
    const p = points[idx];
    parts.push(
      `<circle cx="${f(p.x + (rng.next() - 0.5) * 8)}" cy="${f(p.y)}" r="${f(1.5 + rng.next() * 1.5)}"
        fill="#5a3a10" opacity="${(0.3 + rng.next() * 0.3).toFixed(2)}" class="decay-spot" />`
    );
  }

  return parts;
}

function renderBlockedPlant(rng, visual) {
  const parts = [];
  // Twisted vine stem
  const topY = BASE_Y - 110;
  const drift = (rng.next() - 0.5) * 20;
  const cp1x = BASE_X + drift * 1.5;
  const cp1y = BASE_Y - 40;
  const cp2x = BASE_X - drift;
  const cp2y = BASE_Y - 80;
  const topX = BASE_X + drift * 0.4;

  parts.push(
    `<path d="M ${BASE_X} ${BASE_Y} C ${f(cp1x)} ${f(cp1y)} ${f(cp2x)} ${f(cp2y)} ${f(topX)} ${f(topY)}"
      fill="none" stroke="${visual.stemColor}" stroke-width="3.5" stroke-linecap="round" class="stem vine" />`
  );

  // Sample points for thorns
  const thornYPositions = [BASE_Y - 25, BASE_Y - 50, BASE_Y - 75, BASE_Y - 95];
  thornYPositions.forEach((ty, i) => {
    const t = (BASE_Y - ty) / (BASE_Y - topY);
    const mt = 1 - t;
    const px =
      mt * mt * mt * BASE_X +
      3 * mt * mt * t * cp1x +
      3 * mt * t * t * cp2x +
      t * t * t * topX;
    // Alternate thorn directions
    parts.push(thornSVG(px, ty, i % 2 === 0 ? 1 : -1));
    parts.push(thornSVG(px, ty - 5, i % 2 === 0 ? -1 : 1));
  });

  // Minimal hostile leaf-like shapes
  if (rng.next() > 0.4) {
    parts.push(
      `<path d="${leafPath(cp1x, cp1y, 220, 12, 3)}" fill="#1a182a" opacity="0.6" class="leaf vine-leaf" />`
    );
  }

  return parts;
}

function renderDeadPlant(rng, visual) {
  const parts = [];
  // Collapsed stem — falls to the right
  const fallDir = rng.next() > 0.5 ? 1 : -1;
  const endX = BASE_X + fallDir * 35;
  const endY = BASE_Y - 10;
  const cp1x = BASE_X + fallDir * 10;
  const cp1y = BASE_Y - 30;
  const cp2x = BASE_X + fallDir * 25;
  const cp2y = BASE_Y - 15;

  parts.push(
    `<path d="M ${BASE_X} ${BASE_Y} C ${f(cp1x)} ${f(cp1y)} ${f(cp2x)} ${f(cp2y)} ${f(endX)} ${f(endY)}"
      fill="none" stroke="${visual.stemColor}" stroke-width="2" stroke-linecap="round" class="stem dead-stem" />`
  );

  // Dried leaf remnants
  for (let i = 0; i < 3; i++) {
    const t = (i + 1) / 4;
    const px = lerp(BASE_X, endX, t);
    const py = lerp(BASE_Y, endY, t);
    const ang = 180 + fallDir * 40 + (rng.next() - 0.5) * 60;
    parts.push(
      `<path d="${leafPath(px, py, ang, 10 * (0.4 + rng.next() * 0.5), 3.5)}"
        fill="${visual.leafColor}" opacity="${(0.4 + rng.next() * 0.3).toFixed(2)}" class="leaf dead-leaf" />`
    );
  }

  // Dust particles
  for (let i = 0; i < 4; i++) {
    const dx = BASE_X + (rng.next() - 0.5) * 25;
    const dy = BASE_Y - rng.next() * 20;
    parts.push(
      `<circle cx="${f(dx)}" cy="${f(dy)}" r="${f(0.8 + rng.next() * 1.2)}"
        fill="#5a5048" opacity="${(0.2 + rng.next() * 0.3).toFixed(2)}" class="dust" />`
    );
  }

  return parts;
}

function renderRecoveringPlant(rng, visual) {
  const parts = [];
  // Old damaged main stem
  const oldH = visual.stemHealth * 0.7;
  const topY = BASE_Y - lerp(50, 95, oldH);
  const drift = (rng.next() - 0.5) * 12;
  const cp1x = BASE_X + drift;
  const cp1y = BASE_Y - 30;
  const cp2x = BASE_X + drift * 0.6;
  const cp2y = topY + 20;
  const topX = BASE_X + drift * 0.5;

  parts.push(
    `<path d="M ${BASE_X} ${BASE_Y} C ${f(cp1x)} ${f(cp1y)} ${f(cp2x)} ${f(cp2y)} ${f(topX)} ${f(topY)}"
      fill="none" stroke="#5a4a2a" stroke-width="2.2" stroke-linecap="round" class="stem old-stem" />`
  );

  // A wilted leaf on the old stem
  const midY = (BASE_Y + topY) / 2;
  parts.push(
    `<path d="${leafPath(cp1x, midY + 10, 200, 14, 5)}" fill="#5a4a2a" opacity="0.55" class="leaf old-leaf" />`
  );

  // New fresh shoots from base
  const shootCount = 2;
  for (let i = 0; i < shootCount; i++) {
    const shootDir = i % 2 === 0 ? 1 : -1;
    const shootLen = 45 + rng.next() * 20;
    const sTopX = BASE_X + shootDir * (15 + rng.next() * 8);
    const sTopY = BASE_Y - shootLen;
    parts.push(
      `<path d="M ${f(BASE_X + shootDir * 4)} ${BASE_Y} Q ${f(BASE_X + shootDir * 20)} ${f(BASE_Y - shootLen * 0.5)} ${f(sTopX)} ${f(sTopY)}"
        fill="none" stroke="${visual.leafColor}" stroke-width="1.8" stroke-linecap="round" class="stem new-shoot" />`
    );
    // Small new leaf on shoot
    parts.push(
      `<path d="${leafPath(sTopX, sTopY, shootDir > 0 ? 140 : 40, 12, 5)}"
        fill="${visual.leafColor}" opacity="0.9" class="leaf new-leaf" />`
    );
    // Tiny bud tip
    parts.push(
      `<circle cx="${f(sTopX)}" cy="${f(sTopY - 3)}" r="2.5" fill="${visual.flowerColor || '#6a9a50'}" class="bud" />`
    );
  }

  return parts;
}

// ─── Main export ────────────────────────────────────────────────────────────────

/**
 * Generate full SVG plant markup.
 * @param {Object} source - Source data record
 * @param {Object} visual - Visual props from state-map.js
 * @returns {string} SVG markup string
 */
export function generatePlantSVG(source, visual) {
  const rng = seededRng(hashCode(source.id));
  const parts = [];

  // Soil base
  parts.push(soilSVG(visual.status));

  // Plant body by status
  switch (visual.status) {
    case 'healthy':
      parts.push(...renderHealthyPlant(rng, visual));
      break;
    case 'flowering':
      parts.push(...renderHealthyPlant(rng, visual));
      break;
    case 'stale':
      parts.push(...renderStalePlant(rng, visual));
      break;
    case 'failing':
      parts.push(...renderFailingPlant(rng, visual));
      break;
    case 'blocked':
      parts.push(...renderBlockedPlant(rng, visual));
      break;
    case 'dead':
      parts.push(...renderDeadPlant(rng, visual));
      break;
    case 'recovering':
      parts.push(...renderRecoveringPlant(rng, visual));
      break;
    case 'quarantined': {
      // Render a subdued healthy plant, then overlay the jar
      const subVisual = { ...visual, quarantineJar: false, animClass: '' };
      parts.push(...renderHealthyPlant(rng, subVisual));
      // Jar covers from near the top to the base
      const jarTop = BASE_Y - visual.stemHealth * 115;
      parts.push(bellJarSVG(BASE_X, jarTop));
      break;
    }
    default:
      parts.push(...renderHealthyPlant(rng, visual));
  }

  const animClasses = visual.animClass
    .split(' ')
    .filter(Boolean)
    .map((c) => c.trim())
    .join(' ');

  return (
    `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" ` +
    `class="plant-svg ${animClasses}" data-status="${visual.status}">` +
    parts.join('') +
    `</svg>`
  );
}
