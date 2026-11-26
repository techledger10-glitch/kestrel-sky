// What stands on the land: the forest that gives the islands their texture and the rocky outcrops
// that break up the beaches. All of it is merged into one mesh, so the whole of it is one draw call.
import { MeshBuilder } from './mesh.js';
import { PALETTE } from './config.js';
import { fbm } from './random.js';

const TRUNK = [0.242, 0.188, 0.145];
const CROWN_DARK = [0.098, 0.196, 0.149];
const CROWN_LIGHT = [0.169, 0.318, 0.208];

export function buildScenery(terrain, random) {
  const mesh = new MeshBuilder();
  const half = 2900;
  let planted = 0;
  for (let attempt = 0; attempt < 4200 && planted < 1150; attempt += 1) {
    const x = random.range(-half, half);
    const z = random.range(-half, half);
    const y = terrain.heightAt(x, z);
    if (y < 7 || y > 196) continue;
    const n = terrain.normalAt(x, z);
    if (n[1] < 0.86) continue;
    const forest = fbm(x * 0.0021, z * 0.0021, terrain.seed + 77, 3);
    if (forest < 0.47 && random.next() > 0.16) continue;
    const scale = random.range(0.75, 1.5) * (forest > 0.62 ? 1.25 : 1.0);
    const height = random.range(9, 17) * scale;
    const radius = random.range(2.4, 3.8) * scale;
    mesh.box([x, y + height * 0.16, z], [radius * 0.16, height * 0.32, radius * 0.16], TRUNK);
    const colour = forest > 0.58 ? CROWN_LIGHT : CROWN_DARK;
    mesh.cone([x, y + height * 0.24, z], radius, height * 0.56, 5, colour);
    mesh.cone([x, y + height * 0.52, z], radius * 0.68, height * 0.42, 5, colour);
    planted += 1;
  }

  // Beach boulders and cliff outcrops: a handful of grey facets at the waterline and on the slopes.
  for (let i = 0; i < 90; i += 1) {
    const x = random.range(-half, half);
    const z = random.range(-half, half);
    const y = terrain.heightAt(x, z);
    if (y < 1.5 || y > 230) continue;
    const size = random.range(3, 11);
    const base = [x, y - size * 0.35, z];
    const sides = random.int(4, 6);
    const apex = [x + random.range(-2, 2), y + size * random.range(0.5, 1.1), z + random.range(-2, 2)];
    for (let k = 0; k < sides; k += 1) {
      const a0 = (k / sides) * Math.PI * 2;
      const a1 = ((k + 1) / sides) * Math.PI * 2;
      const p0 = [base[0] + Math.cos(a0) * size, base[1], base[2] + Math.sin(a0) * size];
      const p1 = [base[0] + Math.cos(a1) * size, base[1], base[2] + Math.sin(a1) * size];
      mesh.tri(p0, p1, apex, PALETTE.rock);
    }
  }

  return mesh.buffers();
}
