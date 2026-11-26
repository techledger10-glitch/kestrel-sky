// A waypoint autopilot: the same control axes a pilot has, computed from where the next gate is.
// The screenshot scenes fly with it, which means every posed frame is a frame the flight model
// actually produced a second or two earlier.
import { clamp, wrapPi, dot } from './mathx.js';

export function steer(aircraft, target, options = {}) {
  const [x, y, z] = target;
  const dx = x - aircraft.pos[0];
  const dz = z - aircraft.pos[2];
  const flat = Math.hypot(dx, dz);
  const bearing = Math.atan2(dx, -dz);
  const error = wrapPi(bearing - aircraft.heading);

  const roll = clamp(error * 1.7, -0.95, 0.95);

  const wantedClimb = flat > 140
    ? clamp((y - aircraft.pos[1]) / Math.max(140, flat) * 1.15, -0.22, 0.30)
    : clamp((y - aircraft.pos[1]) / Math.max(60, flat) * 0.9, -0.3, 0.3);
  const pitch = clamp((wantedClimb - aircraft.climb) * 3.4, -0.85, 0.9);

  const wantSpeed = options.speed ?? 62;
  const throttle = clamp(aircraft.throttle + (wantSpeed - aircraft.speed) * 0.035, 0, 1);

  return {
    pitch,
    roll,
    yaw: clamp(error * 0.4, -1, 1),
    throttleAxis: clamp((throttle - aircraft.throttle) * 2.2, -1, 1),
    brake: false,
  };
}

/**
 * Where to aim to fly a gate course. A light aircraft turns in 250 m or more, so a ring 30 m
 * across cannot be hit by homing on it: the autopilot lines up on the gate's axis from an
 * approach point, then drives straight through the ring.
 */
export function courseTarget(course, aircraft, options = {}) {
  const approach = options.approach ?? 380;
  const index = course.nextIndex();
  if (index >= course.rings.length) return null;
  const gate = course.rings[index];
  // Markers lie on the ground: aim to cross them 70 m up, not to fly into the hill.
  if (gate.type === 'marker') return [gate.pos[0], gate.pos[1] + 70, gate.pos[2]];
  const offset = [
    aircraft.pos[0] - gate.pos[0],
    aircraft.pos[1] - gate.pos[1],
    aircraft.pos[2] - gate.pos[2],
  ];
  const along = dot(offset, gate.normal);
  const flat = Math.hypot(offset[0], offset[2]);
  if (along < -approach && flat > 90) {
    return [
      gate.pos[0] - gate.normal[0] * approach,
      gate.pos[1] - gate.normal[1] * approach,
      gate.pos[2] - gate.normal[2] * approach,
    ];
  }
  return gate.pos;
}

/**
 * The height the ground ahead demands: the ridge line two to five seconds out, plus clearance.
 * Without it a course that dips behind a hill flies the aircraft into the hillside.
 */
export function terrainFloor(aircraft, terrain, clearance = 70) {
  let floor = -Infinity;
  for (const reach of [140, 340, 600]) {
    const x = aircraft.pos[0] + Math.sin(aircraft.heading) * reach;
    const z = aircraft.pos[2] - Math.cos(aircraft.heading) * reach;
    floor = Math.max(floor, terrain.heightAt(x, z) + clearance);
  }
  return floor;
}

/** Fly the next gate of a course. */
export function followCourse(aircraft, course, options = {}) {
  const target = courseTarget(course, aircraft, options);
  if (!target) return steer(aircraft, [0, 260, 0], options);
  const terrain = options.terrain;
  if (terrain && terrain.heightAt) {
    const floor = terrainFloor(aircraft, terrain, options.clearance ?? 70);
    // Only when the ground ahead genuinely rises into the flight path: lifting every aim point
    // would break the level run through a gate.
    if (floor > aircraft.pos[1] + 15 && target[1] < floor) target[1] = floor;
  }
  return steer(aircraft, target, options);
}

/** Fly toward a point at a chosen height above the ground beneath it. */
export function steerToPoint(aircraft, point, height, options = {}) {
  return steer(aircraft, [point[0], point[1] + height, point[2]], options);
}
