// The course: rings to fly through and markers to pass over. Each ring is its own mesh with its own
// transform, so the next one can glow while the ones behind it fade; passing is decided by the
// aircraft actually crossing the ring's plane inside its mouth, not by being near it.
import { RING, PALETTE } from './config.js';
import { MeshBuilder } from './mesh.js';
import { normalize, dot, distance } from './mathx.js';

/** A model matrix that stands a local +Z ring at `position`, facing `normal`. */
function basisMatrix(normal, position, scale) {
  const n = normalize([0, 0, 0], normal);
  const helper = Math.abs(n[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = normalize([0, 0, 0], [
    helper[1] * n[2] - helper[2] * n[1],
    helper[2] * n[0] - helper[0] * n[2],
    helper[0] * n[1] - helper[1] * n[0],
  ]);
  const v = [
    n[1] * u[2] - n[2] * u[1],
    n[2] * u[0] - n[0] * u[2],
    n[0] * u[1] - n[1] * u[0],
  ];
  const m = new Float32Array(16);
  m[0] = u[0] * scale; m[1] = u[1] * scale; m[2] = u[2] * scale; m[3] = 0;
  m[4] = v[0] * scale; m[5] = v[1] * scale; m[6] = v[2] * scale; m[7] = 0;
  m[8] = n[0] * scale; m[9] = n[1] * scale; m[10] = n[2] * scale; m[11] = 0;
  m[12] = position[0]; m[13] = position[1]; m[14] = position[2]; m[15] = 1;
  return m;
}

export function buildCourseState(terrain, definition) {
  const rings = definition.map((item, index) => {
    const next = definition[Math.min(index + 1, definition.length - 1)];
    const prev = definition[Math.max(index - 1, 0)];
    const dir = normalize([0, 0, 0], [
      (next.x - prev.x) || 0.001,
      (next.y - prev.y) || 0.001,
      (next.z - prev.z) || 0.001,
    ]);
    const ground = Math.max(terrain.heightAt(item.x, item.z), 2);
    const y = item.y ?? ground + 90;
    const pos = [item.x, y, item.z];
    const normal = item.normal ?? [dir[0], dir[1] * 0.35, dir[2]];
    return {
      index,
      type: item.type ?? 'gate',
      pos,
      normal: normalize([0, 0, 0], normal),
      radius: item.radius ?? RING.radius,
      ground,
      passed: false,
      missed: false,
      side: 0,
      model: basisMatrix(normal, pos, 1),
      tint: 0,
    };
  });

  // Markers lie flat on the ground; gates stand in the air, aimed down the course.
  for (const ring of rings) {
    if (ring.type === 'marker') {
      ring.pos[1] = ring.ground + 0.4;
      ring.model = basisMatrix([0, 1, 0], ring.pos, 1);
    }
  }

  return {
    rings,
    count: rings.length,
    /** Reset every ring to unpassed, for a restart. */
    reset() {
      for (const ring of rings) {
        ring.passed = false;
        ring.missed = false;
        ring.side = 0;
        ring.tint = 0;
      }
    },
    nextIndex() {
      const found = rings.findIndex((ring) => !ring.passed && !ring.missed);
      return found === -1 ? rings.length : found;
    },
    lastIndex() {
      return rings.length - 1;
    },
    /**
     * Decide whether the aircraft flew the next ring or the next marker this frame. Returns the
     * ring passed, or null. `previous` is last frame's position, `current` this frame's.
     */
    check(previous, current, altitude) {
      const index = this.nextIndex();
      if (index >= rings.length) return null;
      const ring = rings[index];
      if (ring.type === 'marker') {
        const flat = Math.hypot(current[0] - ring.pos[0], current[2] - ring.pos[2]);
        if (flat < 34 && altitude < 130) {
          ring.passed = true;
          return ring;
        }
        if (flat < 34 && altitude >= 130) ring.missed = true;
        return null;
      }
      const before = dot([previous[0] - ring.pos[0], previous[1] - ring.pos[1], previous[2] - ring.pos[2]], ring.normal);
      const after = dot([current[0] - ring.pos[0], current[1] - ring.pos[1], current[2] - ring.pos[2]], ring.normal);
      ring.side = after;
      // The gate is a hole in the air, so the frame's own path is what goes through it: the
      // closest approach of the segment to the ring's centre, not just where the frame ended.
      const sweep = [current[0] - previous[0], current[1] - previous[1], current[2] - previous[2]];
      const sweepLen = dot(sweep, sweep);
      const toRing = [ring.pos[0] - previous[0], ring.pos[1] - previous[1], ring.pos[2] - previous[2]];
      const t = sweepLen > 0 ? Math.min(1, Math.max(0, dot(toRing, sweep) / sweepLen)) : 0;
      const nearest = [
        previous[0] + sweep[0] * t,
        previous[1] + sweep[1] * t,
        previous[2] + sweep[2] * t,
      ];
      const swept = distance(nearest, ring.pos);
      if (swept <= ring.radius + 12) {
        ring.passed = true;
        return ring;
      }
      if (before < 0 && after >= 0) {
        const radial = distance(current, ring.pos);
        if (radial <= ring.radius + 14) {
          ring.passed = true;
          return ring;
        }
        // A gate is only missed when the aircraft crosses its plane *at the gate*. The plane is
        // infinite, so a turn taken 300 m wide would otherwise write the gate off before arrival.
        if (radial <= ring.radius * 4) ring.missed = true;
      }
      // Flying well past a ring without going through it is a miss: the pilot may not circle back.
      if (after > 500) ring.missed = true;
      return null;
    },
    distanceToNext(from) {
      const index = this.nextIndex();
      return index >= rings.length ? 0 : distance(from, rings[index].pos);
    },
  };
}

export function createCourse(gl, GpuMeshClass, terrain, definition) {
  const state = buildCourseState(terrain, definition);

  const gateMesh = new GpuMeshClass(gl, (() => {
    const m = new MeshBuilder();
    m.torus([0, 0, 0], RING.radius, RING.tube, 24, 6, [1, 1, 1], [0, 0, 1]);
    return m.buffers();
  })());

  const markerMesh = new GpuMeshClass(gl, (() => {
    const m = new MeshBuilder();
    m.torus([0, 0, 0], 22, 1.5, 26, 4, [1, 1, 1], [0, 1, 0]);
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      m.box([Math.cos(a) * 11, 3.2, Math.sin(a) * 11], [0.5, 3.2, 0.5], [1, 1, 1]);
    }
    m.box([0, 16, 0], [0.6, 16, 0.6], [1, 1, 1]);
    m.box([0, 32, 0], [2.2, 1.6, 2.2], [1, 1, 1]);
    return m.buffers();
  })());

  return {
    ...state,
    draw(program, colourFor, alphaFor) {
      for (const ring of state.rings) {
        const matrix = ring.model;
        program.mat4('uModel', matrix);
        program.mat3('uNormalMatrix', normalMatrixFrom(matrix));
        const colour = colourFor(ring);
        program.vec3('uTint', colour);
        program.float('uTintMix', ring.type === 'marker' ? 1 : 0.82);
        program.float('uAlpha', alphaFor(ring));
        if (ring.type === 'marker') markerMesh.draw();
        else gateMesh.draw();
      }
    },
  };
}

/** The rotation part of a model matrix, for the lit shader's normal transform. */
export function normalMatrixFrom(m) {
  const out = new Float32Array(9);
  // All the game's model matrices are rotation-and-scale only, so the rotation part is the answer.
  out[0] = m[0]; out[1] = m[1]; out[2] = m[2];
  out[3] = m[4]; out[4] = m[5]; out[5] = m[6];
  out[6] = m[8]; out[7] = m[9]; out[8] = m[10];
  return out;
}

export const RING_COLOURS = {
  next: PALETTE.hudGood,
  ahead: PALETTE.hud,
  done: PALETTE.mutedRgb,
};
