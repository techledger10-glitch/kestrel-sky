// The sea: one large grid of vertices handed to the water shader, which lifts it into a swell and
// colours it from the sky. It reaches far past the islands so the horizon is water, not an edge.
import { GpuPositions } from './gl.js';

const EXTENT = 15000;
const CELLS = 150;

export function createOcean(gl) {
  const positions = [];
  const step = (EXTENT * 2) / CELLS;
  for (let j = 0; j < CELLS; j += 1) {
    for (let i = 0; i < CELLS; i += 1) {
      const x0 = -EXTENT + i * step;
      const z0 = -EXTENT + j * step;
      const x1 = x0 + step;
      const z1 = z0 + step;
      positions.push(x0, 0, z0, x0, 0, z1, x1, 0, z0);
      positions.push(x1, 0, z0, x0, 0, z1, x1, 0, z1);
    }
  }
  const array = new Float32Array(positions);
  return {
    mesh: new GpuPositions(gl, array, array.length / 3),
    draw(program, time, eye) {
      program.use();
      program.float('uTime', time);
      program.vec3('uEye', eye);
      this.mesh.draw();
    },
  };
}
