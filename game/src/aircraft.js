// The flight model: a light aircraft flown as a wing, not as a car. Thrust and drag set the speed,
// the bank angle sets the turn, and the elevator bends the flight path; because a turn costs speed
// through induced drag and a climb trades speed for height, throttle and bank discipline are the
// whole game. Damage, fuel and gear all feed the same handful of numbers.
import { AIRCRAFT, WORLD } from './config.js';
import { clamp, headingVector, lerp, damp } from './mathx.js';
import { onRunway, stripOffset, RUNWAY } from './airfield.js';

export const WARN = {
  STALL: 'stall',
  OVERSPEED: 'overspeed',
  PULL_UP: 'pull-up',
  FUEL: 'fuel',
  DAMAGE: 'damage',
  GEAR: 'gear',
};

export function createAircraft(terrain, spawn) {
  const state = {
    pos: [...spawn.pos],
    speed: spawn.speed ?? 0,
    heading: spawn.heading ?? 0,
    climb: spawn.climb ?? 0,
    bank: spawn.bank ?? 0,
    throttle: spawn.throttle ?? 0.8,
    fuel: spawn.fuel ?? AIRCRAFT.fuelCapacity,
    damage: spawn.damage ?? 0,
    gear: spawn.gear ?? 1,
    flap: 0,
    onGround: spawn.onGround ?? false,
    crashed: false,
    stopped: false,
    elapsed: 0,
    gLoad: 1,
    sinkRate: 0,
    agl: 0,
    surface: 0,
    stallFactor: 0,
    warnings: new Set(),
    engineNote: 0.5,
    touchdown: null,
    distanceFlown: 0,
  };

  function surfaceAt(x, z) {
    const runway = onRunway(x, z);
    const ground = terrain.heightAt(x, z);
    return runway ? Math.max(ground, RUNWAY.elevation) : ground;
  }

  /** One fixed step. `controls` is the raw stick: pitch, roll, yaw in [-1, 1], plus throttle axis. */
  function step(dt, controls) {
    if (state.crashed) return state;
    state.elapsed += dt;

    const fuelFactor = state.fuel > 0 ? 1 : 0;
    const damageFactor = 1 - state.damage * 0.55;

    if (controls.throttleAxis !== 0) {
      state.throttle = clamp(state.throttle + controls.throttleAxis * dt * 0.55, 0, 1);
    }

    // --- ground roll -------------------------------------------------------------------------
    if (state.onGround) {
      const runway = onRunway(state.pos[0], state.pos[1] === 0 ? state.pos[2] : state.pos[2]);
      const rollSurface = surfaceAt(state.pos[0], state.pos[2]);
      state.pos[1] = rollSurface + AIRCRAFT.gearHeight * state.gear;
      state.climb = 0;
      state.bank = damp(state.bank, controls.roll * 0.06, 0.12, dt);
      state.heading += controls.yaw * AIRCRAFT.yawRate * 0.55 * dt * clamp(state.speed / 12, 0, 1);

      const thrust = state.throttle * AIRCRAFT.maxThrust * fuelFactor * damageFactor;
      const brake = controls.brake ? AIRCRAFT.brakeDecel * AIRCRAFT.mass : 0;
      const rolling = state.speed > 0.2 ? 55 * AIRCRAFT.mass * 0.02 : 0;
      state.speed += ((thrust - brake - rolling) / AIRCRAFT.mass) * dt;
      if (state.speed < 0) state.speed = 0;
      if (state.speed < 0.35 && state.throttle < 0.05) {
        state.speed = 0;
        state.stopped = true;
      }
      const dir = headingVector([0, 0, 0], state.heading, 0);
      state.pos[0] += dir[0] * state.speed * dt;
      state.pos[2] += dir[2] * state.speed * dt;
      state.distanceFlown += state.speed * dt;
      state.agl = 0;
      state.gLoad = 1;
      state.sinkRate = 0;
      state.stallFactor = 0;

      if (state.speed > AIRCRAFT.stallSpeed + 6 && controls.pitch > 0.35) {
        state.onGround = false;
        state.climb = 0.1;
      }
      updateFuel(dt);
      updateWarnings();
      return state;
    }

    // --- flying ------------------------------------------------------------------------------
    // Roll: the ailerons, with a gentle self-levelling hand so the camera never fights the pilot.
    const rollAuthority = clamp(state.speed / 38, 0.35, 1.15) * (1 - state.damage * 0.3);
    const levelling = controls.roll === 0 ? -state.bank * 0.55 : 0;
    state.bank += (controls.roll * AIRCRAFT.rollRate * rollAuthority + levelling) * dt;
    state.bank = clamp(state.bank, -1.48, 1.48);

    // Load factor follows the bank: a 60-degree bank pulls 2 g and drags hard.
    const load = 1 / Math.max(0.22, Math.cos(state.bank));
    const pull = clamp(controls.pitch, -1, 1);
    const pitchAuthority = clamp(state.speed / 40, 0.3, 1.2) * (1 - state.damage * 0.35);
    state.gLoad = load * (1 + Math.max(0, pull) * 0.55);

    // Turning: the horizontal component of lift bends the flight path. Slow and banked turns hard.
    const turnRate = clamp((AIRCRAFT.gravity * Math.tan(state.bank)) / Math.max(state.speed, 14), -0.95, 0.95);
    state.heading += turnRate * dt + controls.yaw * AIRCRAFT.yawRate * 0.5 * dt;

    // Pitch: the elevator bends the flight path; gravity and the wing decide the rest.
    state.climb += pull * AIRCRAFT.pitchRate * pitchAuthority * dt;

    // Flying too slowly, the wing stops carrying: the nose falls and the ailerons go soft.
    const margin = (state.speed - AIRCRAFT.stallSpeed) / AIRCRAFT.stallSpeed;
    state.stallFactor = clamp(1 - margin * 2.2, 0, 1);
    if (state.speed < AIRCRAFT.stallSpeed) {
      const sag = (1 - state.speed / AIRCRAFT.stallSpeed) * 1.35;
      state.climb -= sag * dt;
      state.bank += Math.sin(state.elapsed * 3.1) * 0.35 * sag * dt;
    }
    state.climb = clamp(state.climb, -1.35, 1.05);

    // Speed: thrust against drag and gravity along the flight path.
    const q = 0.5 * AIRCRAFT.rho * state.speed * state.speed;
    const gearDrag = state.gear * 0.011;
    const brakeDrag = controls.brake ? 0.06 : 0;
    const dragCoefficient = AIRCRAFT.cd0 + AIRCRAFT.induced * load * load + gearDrag + brakeDrag + state.damage * 0.012;
    const drag = q * AIRCRAFT.wingArea * dragCoefficient;
    const thrust = state.throttle * AIRCRAFT.maxThrust * fuelFactor * damageFactor * (1 - state.damage * 0.25);
    const along = (thrust - drag) / AIRCRAFT.mass - AIRCRAFT.gravity * Math.sin(state.climb);
    state.speed = Math.max(0, state.speed + along * dt);
    state.speed = Math.min(state.speed, AIRCRAFT.vne + 24);

    if (state.gLoad > AIRCRAFT.gLimit) state.damage = clamp(state.damage + (state.gLoad - AIRCRAFT.gLimit) * dt * 0.05, 0, 1);

    // Where the nose points: the flight path plus the angle of attack the wing is carrying.
    const trim = AIRCRAFT.trimAngleOfAttack * clamp(1 - state.speed / 120, 0.25, 1.4) + Math.max(0, pull) * 0.05;

    const dir = headingVector([0, 0, 0], state.heading, state.climb);
    state.pos[0] += dir[0] * state.speed * dt;
    state.pos[1] += dir[1] * state.speed * dt;
    state.pos[2] += dir[2] * state.speed * dt;
    state.distanceFlown += state.speed * dt;
    state.sinkRate = -dir[1] * state.speed;

    const ground = surfaceAt(state.pos[0], state.pos[2]);
    const clearance = state.pos[1] - ground;
    state.surface = ground;
    state.agl = clearance - AIRCRAFT.gearHeight;
    state.trim = trim;

    // --- the ground --------------------------------------------------------------------------
    if (clearance <= AIRCRAFT.gearHeight * Math.max(state.gear, 0.15)) {
      const runway = onRunway(state.pos[0], state.pos[2], 4);
      const gentle = state.sinkRate < AIRCRAFT.landing.maxSink && Math.abs(state.bank) < AIRCRAFT.landing.maxBank;
      if (runway && state.gear > 0.85 && state.speed > AIRCRAFT.landing.minSpeed && gentle) {
        state.touchdown = gradeOnStrip(state);
        state.onGround = true;
        state.pos[1] = ground + AIRCRAFT.gearHeight;
        state.bank = 0;
        state.climb = 0;
      } else {
        state.crashed = true;
        state.crashReason = runway ? 'ran off the paved surface' : ground < 1 ? 'ditched in the sea' : 'flew into the ground';
      }
    }

    updateFuel(dt);
    updateWarnings();
    return state;
  }

  function gradeOnStrip(st) {
    const { across } = stripOffset(st.pos[0], st.pos[2]);
    return { sink: st.sinkRate, bank: st.bank, speed: st.speed, across };
  }

  function updateFuel(dt) {
    const burn = AIRCRAFT.fuelBurnIdle + (AIRCRAFT.fuelBurnFull - AIRCRAFT.fuelBurnIdle) * state.throttle;
    state.fuel = Math.max(0, state.fuel - burn * dt);
    state.engineNote = damp(state.engineNote, 0.22 + state.throttle * 0.78, 0.12, dt);
  }

  function updateWarnings() {
    state.warnings.clear();
    if (state.speed < AIRCRAFT.stallSpeed + 3.5) state.warnings.add(WARN.STALL);
    if (state.speed > AIRCRAFT.vne) state.warnings.add(WARN.OVERSPEED);
    if (state.agl < 55 && state.sinkRate > 6.5) state.warnings.add(WARN.PULL_UP);
    if (state.fuel < AIRCRAFT.fuelCapacity * 0.16) state.warnings.add(WARN.FUEL);
    if (state.damage > 0.45) state.warnings.add(WARN.DAMAGE);
    if (!state.onGround && state.agl < 70 && state.gear < 0.5 && onRunway(state.pos[0], state.pos[2], 430)) state.warnings.add(WARN.GEAR);
  }

  function reset(spawn2) {
    Object.assign(state, {
      pos: [...spawn2.pos],
      speed: spawn2.speed ?? 0,
      heading: spawn2.heading ?? 0,
      climb: spawn2.climb ?? 0,
      bank: spawn2.bank ?? 0,
      throttle: spawn2.throttle ?? 0.8,
      fuel: spawn2.fuel ?? AIRCRAFT.fuelCapacity,
      damage: spawn2.damage ?? 0,
      gear: spawn2.gear ?? 1,
      onGround: spawn2.onGround ?? false,
      crashed: false,
      stopped: false,
      crashReason: null,
      touchdown: null,
      elapsed: 0,
      gLoad: 1,
      sinkRate: 0,
      agl: 0,
      stallFactor: 0,
      distanceFlown: 0,
    });
  }

  return { state, step, reset, surfaceAt, terrain };
}

/** The attitude the model is drawn at: the flight path plus the wing's angle of attack. */
export function attitude(state) {
  return {
    yaw: -state.heading,
    pitch: state.climb + (state.trim ?? AIRCRAFT.trimAngleOfAttack),
    roll: -state.bank,
  };
}

export function altitudeAboveGround(terrain, x, y, z) {
  return y - Math.max(terrain.heightAt(x, z), WORLD.seaLevel);
}

export function lerpGear(state, dt, target) {
  state.gear = lerp(state.gear, target, clamp(dt * 2.2, 0, 1));
}
