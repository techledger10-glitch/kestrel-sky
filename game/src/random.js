// Seeded randomness, so a sortie is the same sortie every time it is flown: the island shapes, the
// tree cover, the cloud banks and the screenshot scenes all come from one seed, and a replay from
// the same seed builds the same archipelago.

/** Mulberry32: a small, fast, well spread 32-bit generator. Returns floats in [0, 1). */
export function createRandom(seed) {
  let a = seed >>> 0;
  function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  next.range = (lo, hi) => lo + next() * (hi - lo);
  next.int = (lo, hi) => Math.floor(lo + next() * (hi - lo + 1));
  next.pick = (list) => list[Math.floor(next() * list.length)];
  next.next = next;
  return next;
}

function hash2(ix, iy, seed) {
  let h = (ix * 374761393 + iy * 668265263 + seed * 144665) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

/** Value noise on a lattice: smooth, cheap, and enough for hills that read as hills. */
export function valueNoise(x, y, seed) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
}

/** Fractal noise: `octaves` layers of value noise, each half the size and half the weight. */
export function fbm(x, y, seed, octaves = 4, lacunarity = 2.03, gain = 0.5) {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let fx = x;
  let fy = y;
  for (let i = 0; i < octaves; i += 1) {
    sum += valueNoise(fx, fy, seed + i * 977) * amp;
    norm += amp;
    amp *= gain;
    fx *= lacunarity;
    fy *= lacunarity;
  }
  return sum / norm;
}

/** A smooth ridge shape: sharp crests rather than rolling blobs, for the island spines. */
export function ridge(x, y, seed, octaves = 4) {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let fx = x;
  let fy = y;
  for (let i = 0; i < octaves; i += 1) {
    const n = 1 - Math.abs(valueNoise(fx, fy, seed + i * 613) * 2 - 1);
    sum += n * n * amp;
    norm += amp;
    amp *= 0.52;
    fx *= 2.07;
    fy *= 2.07;
  }
  return sum / norm;
}
