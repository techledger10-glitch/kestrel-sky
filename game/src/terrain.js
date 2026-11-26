// The Alder Isles: where the land is, how high it stands, and the faceted mesh drawn for it. One
// heightfield answers every question the game asks about the ground — collision, camera clearance,
// tree and cloud placement — and the mesh is built from that same field, so what the aircraft hits
// is exactly what the pilot sees.
import { WORLD, PALETTE } from './config.js';
import { fbm, ridge } from './random.js';
import { clamp, smoothstep } from './mathx.js';

/** The islands, as radial spines: a rock, a peak and a size. */
export const ISLANDS = [
  { name: 'Alder', x: -260, z: -1180, radius: 1320, peak: 296, spine: 1.0 },
  { name: 'Bracken', x: -1780, z: -300, radius: 880, peak: 214, spine: 0.85 },
  { name: 'Cormorant', x: 1180, z: 940, radius: 1180, peak: 268, spine: 0.92 },
  { name: 'Dunlin', x: 940, z: -1520, radius: 720, peak: 168, spine: 0.7 },
  { name: 'Gannet', x: 1760, z: -420, radius: 520, peak: 120, spine: 0.6 },
];

const CELLS = WORLD.cells;
const SIZE = WORLD.size;
const HALF = SIZE / 2;

export function createTerrain(seed) {
  const stride = CELLS + 1;
  const step = SIZE / CELLS;
  const heights = new Float32Array(stride * stride);

  function rawHeight(x, z) {
    let best = -70;
    for (let i = 0; i < ISLANDS.length; i += 1) {
      const island = ISLANDS[i];
      const dx = (x - island.x) / island.radius;
      const dz = (z - island.z) / island.radius;
      const d = Math.hypot(dx, dz);
      if (d > 1.35) continue;
      // The coast is ragged, not a circle: the radius itself is bent by noise.
      const wobble = fbm(x * 0.00085 + 11.3, z * 0.00085 - 7.1, seed + i * 31, 3) * 0.34;
      const falloff = smoothstep(1.18, 0.06, d + wobble - 0.16);
      if (falloff <= 0) continue;
      const spine = ridge(x * 0.0014 + i * 2.7, z * 0.0014 - i * 1.9, seed + i * 71, 4);
      const bumps = fbm(x * 0.0042, z * 0.0042, seed + i * 53, 4);
      const shape = falloff * (0.34 + 0.9 * Math.pow(spine, 1.55) * island.spine + 0.22 * bumps);
      const h = island.peak * shape - 26;
      if (h > best) best = h;
    }
    const detail = (fbm(x * 0.013, z * 0.013, seed + 901, 3) - 0.5) * 12;
    return best + detail * (best > 6 ? 1 : 0.35);
  }

  // The airstrip plateau is graded flat, with a soft shoulder so it reads as cut into the hill.
  const af = WORLD.airfield;
  function shapedHeight(x, z) {
    const h = rawHeight(x, z);
    const d = Math.hypot(x - af.x, z - af.z);
    if (d > af.radius * 2.1) return h;
    const blend = smoothstep(af.radius * 2.0, af.radius * 0.92, d);
    return h + (af.elevation - h) * blend;
  }

  for (let j = 0; j < stride; j += 1) {
    for (let i = 0; i < stride; i += 1) {
      heights[j * stride + i] = shapedHeight(-HALF + i * step, -HALF + j * step);
    }
  }

  /** Bilinear sample of the heightfield; outside the field the sea floor slopes away. */
  function heightAt(x, z) {
    const fx = (x + HALF) / step;
    const fz = (z + HALF) / step;
    if (fx < 0 || fz < 0 || fx >= CELLS || fz >= CELLS) return -60;
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const tx = fx - i;
    const tz = fz - j;
    const h00 = heights[j * stride + i];
    const h10 = heights[j * stride + i + 1];
    const h01 = heights[(j + 1) * stride + i];
    const h11 = heights[(j + 1) * stride + i + 1];
    return (h00 * (1 - tx) + h10 * tx) * (1 - tz) + (h01 * (1 - tx) + h11 * tx) * tz;
  }

  function normalAt(x, z) {
    const e = step * 0.6;
    const hx = heightAt(x + e, z) - heightAt(x - e, z);
    const hz = heightAt(x, z + e) - heightAt(x, z - e);
    const len = Math.hypot(hx, 2 * e, hz);
    return [-hx / len, (2 * e) / len, -hz / len];
  }

  /** Height above the sea, for "low pass" rules and the HUD's radar altitude. */
  function altitudeAt(x, z) {
    return Math.max(0, heightAt(x, z) - WORLD.seaLevel);
  }

  const mesh = buildTerrainMesh(heights, stride, step, seed);
  return { heights, stride, step, heightAt, normalAt, altitudeAt, mesh, seed };
}

/** Colour a facet from its height and steepness, in the archipelago's one palette. */
function facetColour(out, height, slope, tint, lush) {
  const P = PALETTE;
  let base;
  if (height < 1.4) base = P.seaFoam;
  else if (height < 7) base = P.sand;
  else if (height < 210) base = lush > 0.52 ? P.forest : lush > 0.3 ? P.grass : P.grassDry;
  else if (height < 268) base = P.rock;
  else base = P.peak;

  if (slope > 0.42 && height > 8 && height < 262) {
    const t = smoothstep(0.42, 0.82, slope);
    const rock = height > 150 ? P.rock : P.grassDry;
    base = [base[0] + (rock[0] - base[0]) * t, base[1] + (rock[1] - base[1]) * t, base[2] + (rock[2] - base[2]) * t];
  }
  if (height > 6 && height < 12) {
    const t = smoothstep(6, 12, height);
    base = [base[0] + (P.grass[0] - base[0]) * t, base[1] + (P.grass[1] - base[1]) * t, base[2] + (P.grass[2] - base[2]) * t];
  }
  const shade = 0.9 + tint * 0.2;
  out[0] = clamp(base[0] * shade, 0, 1);
  out[1] = clamp(base[1] * shade, 0, 1);
  out[2] = clamp(base[2] * shade, 0, 1);
}

/**
 * One faceted mesh for the land: two triangles per cell, a flat normal for each so the low-poly
 * facets catch the light, and a colour per facet. Unused cells (deep sea) are skipped.
 */
function buildTerrainMesh(heights, stride, step, seed) {
  const positions = [];
  const normals = [];
  const colours = [];
  const tmp = [0, 0, 0];
  const ab = [0, 0, 0];
  const ac = [0, 0, 0];

  function pushTri(p0, p1, p2) {
    ab[0] = p1[0] - p0[0]; ab[1] = p1[1] - p0[1]; ab[2] = p1[2] - p0[2];
    ac[0] = p2[0] - p0[0]; ac[1] = p2[1] - p0[1]; ac[2] = p2[2] - p0[2];
    const nx = ab[1] * ac[2] - ab[2] * ac[1];
    const ny = ab[2] * ac[0] - ab[0] * ac[2];
    const nz = ab[0] * ac[1] - ab[1] * ac[0];
    const len = Math.hypot(nx, ny, nz) || 1;
    const ux = nx / len;
    const uy = ny / len;
    const uz = nz / len;
    const slope = 1 - Math.abs(uy);
    const cx = (p0[0] + p1[0] + p2[0]) / 3;
    const cz = (p0[2] + p1[2] + p2[2]) / 3;
    const height = (p0[1] + p1[1] + p2[1]) / 3;
    const tint = fbm(cx * 0.02, cz * 0.02, seed + 311, 2);
    const lush = fbm(cx * 0.004, cz * 0.004, seed + 421, 3);
    facetColour(tmp, height, slope, tint, lush);
    for (const p of [p0, p1, p2]) {
      positions.push(p[0], p[1], p[2]);
      normals.push(ux, uy, uz);
      colours.push(tmp[0], tmp[1], tmp[2]);
    }
  }

  const half = (stride - 1) * step * 0.5;
  for (let j = 0; j < stride - 1; j += 1) {
    for (let i = 0; i < stride - 1; i += 1) {
      const x0 = -half + i * step;
      const x1 = x0 + step;
      const z0 = -half + j * step;
      const z1 = z0 + step;
      const h00 = heights[j * stride + i];
      const h10 = heights[j * stride + i + 1];
      const h01 = heights[(j + 1) * stride + i];
      const h11 = heights[(j + 1) * stride + i + 1];
      if (Math.max(h00, h10, h01, h11) < -14) continue; // deep water: no land drawn
      const p00 = [x0, h00, z0];
      const p10 = [x1, h10, z0];
      const p01 = [x0, h01, z1];
      const p11 = [x1, h11, z1];
      pushTri(p00, p01, p10);
      pushTri(p10, p01, p11);
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    colours: new Float32Array(colours),
    count: positions.length / 3,
  };
}
