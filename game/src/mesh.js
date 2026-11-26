// A tiny mesh builder: push triangles with a flat normal and a colour, get back the three float
// arrays a draw call wants. Every solid in the game — islands, aircraft, rings, runway, trees,
// clouds — is made of these triangles, so one lit shader draws the whole world.
import { PALETTE } from './config.js';

export class MeshBuilder {
  constructor() {
    this.positions = [];
    this.normals = [];
    this.colours = [];
  }

  /** One triangle, wound counter-clockwise when seen from its front. */
  tri(a, b, c, colour) {
    const abx = b[0] - a[0];
    const aby = b[1] - a[1];
    const abz = b[2] - a[2];
    const acx = c[0] - a[0];
    const acy = c[1] - a[1];
    const acz = c[2] - a[2];
    let nx = aby * acz - abz * acy;
    let ny = abz * acx - abx * acz;
    let nz = abx * acy - aby * acx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    for (const p of [a, b, c]) {
      this.positions.push(p[0], p[1], p[2]);
      this.normals.push(nx, ny, nz);
      this.colours.push(colour[0], colour[1], colour[2]);
    }
    return this;
  }

  quad(a, b, c, d, colour) {
    this.tri(a, b, c, colour);
    this.tri(a, c, d, colour);
    return this;
  }

  /** An axis-aligned-ish box from a centre, three half-extents, and a colour per face (or one). */
  box(centre, half, colour, topColour = colour) {
    const [cx, cy, cz] = centre;
    const [hx, hy, hz] = half;
    const x0 = cx - hx, x1 = cx + hx;
    const y0 = cy - hy, y1 = cy + hy;
    const z0 = cz - hz, z1 = cz + hz;
    this.quad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], topColour);
    this.quad([x0, y0, z1], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], colour);
    this.quad([x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0], colour);
    this.quad([x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [x0, y0, z1], colour);
    this.quad([x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0], colour);
    this.quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], colour);
    return this;
  }

  /** A cone standing on `base`, for tree crowns and marker posts. */
  cone(base, radius, height, sides, colour) {
    const apex = [base[0], base[1] + height, base[2]];
    for (let i = 0; i < sides; i += 1) {
      const a0 = (i / sides) * Math.PI * 2;
      const a1 = ((i + 1) / sides) * Math.PI * 2;
      const p0 = [base[0] + Math.cos(a0) * radius, base[1], base[2] + Math.sin(a0) * radius];
      const p1 = [base[0] + Math.cos(a1) * radius, base[1], base[2] + Math.sin(a1) * radius];
      this.tri(p0, p1, apex, colour);
      this.tri(p1, p0, base, colour);
    }
    return this;
  }

  /** A ring standing in the XZ plane's vertical slice: the target the pilot flies through. */
  torus(centre, radius, tube, major, minor, colour, normal = [0, 0, 1]) {
    const n = normal;
    const helper = Math.abs(n[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    let u = [
      helper[1] * n[2] - helper[2] * n[1],
      helper[2] * n[0] - helper[0] * n[2],
      helper[0] * n[1] - helper[1] * n[0],
    ];
    const ul = Math.hypot(u[0], u[1], u[2]) || 1;
    u = [u[0] / ul, u[1] / ul, u[2] / ul];
    const v = [
      n[1] * u[2] - n[2] * u[1],
      n[2] * u[0] - n[0] * u[2],
      n[0] * u[1] - n[1] * u[0],
    ];
    const point = (i, j) => {
      const a = (i / major) * Math.PI * 2;
      const b = (j / minor) * Math.PI * 2;
      const ringX = Math.cos(a) * radius;
      const ringY = Math.sin(a) * radius;
      const r = tube;
      const px = centre[0] + u[0] * ringX + v[0] * ringY + n[0] * Math.cos(b) * r;
      const py = centre[1] + u[1] * ringX + v[1] * ringY + n[1] * Math.cos(b) * r;
      const pz = centre[2] + u[2] * ringX + v[2] * ringY + n[2] * Math.cos(b) * r;
      return [px, py, pz];
    };
    for (let i = 0; i < major; i += 1) {
      for (let j = 0; j < minor; j += 1) {
        const a = point(i, j);
        const b = point(i + 1, j);
        const c = point(i + 1, j + 1);
        const d = point(i, j + 1);
        this.quad(a, b, c, d, colour);
      }
    }
    return this;
  }

  get triangleCount() {
    return this.positions.length / 9;
  }

  buffers() {
    return {
      positions: new Float32Array(this.positions),
      normals: new Float32Array(this.normals),
      colours: new Float32Array(this.colours),
      count: this.positions.length / 3,
    };
  }
}

/** Clouds: a bank of flattened facets, one mesh, drawn once with a little transparency. */
export function buildCloudBank(banks, random) {
  const mesh = new MeshBuilder();
  const white = [0.98, 0.97, 0.95];
  const shade = [0.78, 0.78, 0.8];
  for (const bank of banks) {
    const puffs = bank.puffs;
    for (let p = 0; p < puffs; p += 1) {
      const cx = bank.x + random.range(-bank.spread, bank.spread);
      const cz = bank.z + random.range(-bank.spread, bank.spread);
      const cy = bank.y + random.range(-bank.spread * 0.12, bank.spread * 0.12);
      const r = random.range(0.55, 1.0) * bank.scale;
      const sides = 5;
      const rings = 2;
      const top = [cx, cy + r * 0.52, cz];
      const bottom = [cx, cy - r * 0.3, cz];
      for (let k = 0; k < sides; k += 1) {
        const a0 = (k / sides) * Math.PI * 2 + 0.4;
        const a1 = ((k + 1) / sides) * Math.PI * 2 + 0.4;
        const p0 = [cx + Math.cos(a0) * r, cy, cz + Math.sin(a0) * r];
        const p1 = [cx + Math.cos(a1) * r, cy, cz + Math.sin(a1) * r];
        mesh.tri(p0, top, p1, white);
        mesh.tri(p1, p0, bottom, shade);
      }
      for (let ring = 0; ring < rings; ring += 1) {
        const r0 = r * (1 - ring * 0.35);
        const y = cy + r * 0.1 * ring;
        const q = [];
        for (let k = 0; k < sides; k += 1) {
          const a = (k / sides) * Math.PI * 2 + 0.4;
          q.push([cx + Math.cos(a) * r0, y, cz + Math.sin(a) * r0]);
        }
        for (let k = 0; k < sides; k += 1) {
          mesh.tri(q[k], q[(k + 1) % sides], top, white);
        }
      }
    }
  }
  return mesh.buffers();
}

/** The sun's own disc is drawn by the sky shader; this is the set of banks and their placement. */
export function cloudBanks(random) {
  const banks = [];
  for (let i = 0; i < 9; i += 1) {
    const angle = random.range(0, Math.PI * 2);
    const dist = random.range(900, 4200);
    banks.push({
      x: Math.cos(angle) * dist,
      z: Math.sin(angle) * dist,
      y: random.range(620, 1080),
      spread: random.range(90, 200),
      scale: random.range(46, 88),
      puffs: random.int(9, 16),
    });
  }
  return banks;
}

export const CLOUD_WHITE = PALETTE.seaFoam;
