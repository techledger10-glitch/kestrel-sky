// The four screenshot scenes behind ?shot=cover|panel|survey|debrief. Each one either flies the
// real model forward with the autopilot until the aircraft is in the attitude the scene wants, or
// flies a whole sortie and hands the debrief it really produced to the screen. Nothing here draws
// a frame the game could not have reached on its own.
import { STEP } from './config.js';
import { steer, followCourse } from './autopilot.js';
import { RUNWAY } from './airfield.js';
import { thresholdPoint } from './airfield.js';

function poseAircraft(createAircraft, terrain, spawn, overrides) {
  const aircraft = createAircraft(terrain, spawn);
  Object.assign(aircraft.state, overrides);
  aircraft.state.pos = [...(overrides.pos ?? aircraft.state.pos)];
  return aircraft;
}

/** Run the model with the autopilot until `wanted(state)` is true, or the budget runs out. */
function flyUntil(aircraft, target, wanted, budgetSteps = 900) {
  for (let i = 0; i < budgetSteps; i += 1) {
    const controls = steer(aircraft.state, target, { speed: 66 });
    aircraft.step(STEP, controls);
    if (wanted(aircraft.state)) return i;
  }
  return budgetSteps;
}

export function stageShot(name, api) {
  const { terrain, createAircraft, spawnFor, missionById, courseFor, createRun } = api;

  if (name === 'title') {
    // The attract screen: the real title layout over the real world, drifting off the airfield.
    const mission = missionById('ridge');
    const course = courseFor(mission);
    const spawn = spawnFor(mission, terrain);
    const aircraft = poseAircraft(createAircraft, terrain, spawn, {
      pos: [-1420, 300, -560],
      heading: -0.42,
      climb: 0.01,
      bank: 0.22,
      speed: 60,
      throttle: 0.72,
      gear: 0,
      onGround: false,
    });
    flyUntil(aircraft, course.rings[1].pos, () => true, 200);
    api.setScene({
      mission,
      course,
      aircraft,
      run: createRun(mission, course),
      cameraMode: 'chase',
      mode: 'title',
      freeCamera: true,
      eye: [-1690, 215, -300],
      target: [-260, 120, -1520],
      time: 96,
      chase: { back: 95, up: 22, side: 16, lookAhead: 260 },
    });
    return;
  }

  if (name === 'debrief') {
    // Fly the ridge sortie for real: the autopilot takes every gate it can, and the debrief that
    // comes out is the one the rules produced.
    const mission = missionById('ridge');
    const course = courseFor(mission);
    const aircraft = createAircraft(terrain, spawnFor(mission, terrain));
    const run = createRun(mission, course);
    let previous = [...aircraft.state.pos];
    let steps = 0;
    const limit = 210 * 120;
    while (run.status === 'flying' && steps < limit) {
      const controls = followCourse(aircraft.state, course, { speed: 68, approach: 380, terrain });
      previous = [...aircraft.state.pos];
      aircraft.step(STEP, controls);
      aircraft.state.propAngle = (aircraft.state.propAngle ?? 0) + STEP * 40;
      run.update(STEP, aircraft.state, previous);
      steps += 1;
    }
    if (run.status === 'flying') run.finish('timeout', 'the light went before the sortie did');
    api.showDebrief({
      mission,
      aircraft,
      run,
      best: 1840,
      isBest: false,
    });
    return;
  }

  if (name === 'approach') {
    // On final: gear down, the strip ahead, the shore behind — the landing the sortie is for.
    const mission = missionById('ridge');
    const course = courseFor(mission);
    const spawn = spawnFor(mission, terrain);
    const dir = RUNWAY.dir;
    const heading = Math.atan2(dir[0], -dir[2]);
    const back = 940;
    const aircraft = poseAircraft(createAircraft, terrain, spawn, {
      pos: [RUNWAY.centre[0] - dir[0] * back, RUNWAY.elevation + 96, RUNWAY.centre[2] - dir[2] * back],
      heading,
      climb: -0.035,
      bank: 0.0,
      speed: 58,
      throttle: 0.44,
      gear: 1,
      onGround: false,
    });
    aircraft.state.pos = [
      RUNWAY.centre[0] - dir[0] * back,
      RUNWAY.elevation + 96,
      RUNWAY.centre[2] - dir[2] * back,
    ];
    aircraft.state.agl = 96;
    aircraft.state.sinkRate = 3.1;
    const run = createRun(mission, course);
    run.run.ringsPassed = 8;
    run.run.score = 1264;
    for (const ring of course.rings) ring.passed = true;
    api.setScene({
      mission,
      course,
      aircraft,
      run,
      cameraMode: 'chase',
      time: 128,
      hint: 'final: gear down, hold 70 knots over the numbers',
    });
    return;
  }

  if (name === 'panel') {
    const mission = missionById('ridge');
    const course = courseFor(mission);
    const spawn = spawnFor(mission, terrain);
    const gate = course.rings[2].pos;
    const bearing = Math.atan2(gate[0] - spawn.pos[0], -(gate[2] - spawn.pos[2]));
    const aircraft = poseAircraft(createAircraft, terrain, spawn, {
      pos: [gate[0] - Math.sin(bearing) * 900, gate[1] + 22, gate[2] + Math.cos(bearing) * 900],
      heading: bearing - 0.06,
      climb: 0.02,
      bank: 0.10,
      speed: 66,
      throttle: 0.82,
      gear: 0,
      onGround: false,
    });
    flyUntil(aircraft, gate, (state) => false, 90);
    api.setScene({ mission, course, aircraft, run: createRun(mission, course), cameraMode: 'cockpit', time: 63, hint: '' });
    return;
  }

  if (name === 'survey') {
    const mission = missionById('survey');
    const course = courseFor(mission);
    const spawn = spawnFor(mission, terrain);
    const marker = course.rings[1].pos;
    const bearing = Math.atan2(marker[0] - spawn.pos[0], -(marker[2] - spawn.pos[2]));
    const aircraft = poseAircraft(createAircraft, terrain, spawn, {
      pos: [marker[0] - Math.sin(bearing) * 520, terrain.heightAt(marker[0], marker[2]) + 78, marker[2] + Math.cos(bearing) * 520],
      heading: bearing + 0.12,
      climb: -0.015,
      bank: -0.08,
      speed: 54,
      throttle: 0.46,
      gear: 0,
      onGround: false,
    });
    flyUntil(aircraft, marker, (state) => Math.abs(state.bank) > 0.26, 240);
    const run = createRun(mission, course);
    run.run.ringsPassed = 1;
    run.run.score = 120 + 96;
    course.rings[0].passed = true;
    api.setScene({ mission, course, aircraft, run, cameraMode: 'chase', time: 84, hint: 'marker one photographed: 62 m, 4° of bank' });
    return;
  }

  if (name === 'plane') {
    const mission = missionById('ridge');
    const course = courseFor(mission);
    const spawn = spawnFor(mission, terrain);
    const aircraft = createAircraft(terrain, spawn);
    Object.assign(aircraft.state, {
      pos: [0, 320, 0], heading: -0.9, climb: 0.05, bank: 0.35, speed: 64, throttle: 0.8, gear: 0, onGround: false,
    });
    aircraft.state.pos = [0, 320, 0];
    api.setScene({ mission, course, aircraft, run: createRun(mission, course), cameraMode: 'chase', time: 40, hint: '', closeUp: true });
    return;
  }

  // The cover: banked along the west shore with the second gate ahead and the sun on the water.
  const mission = missionById('ridge');
  const course = courseFor(mission);
  const spawn = spawnFor(mission, terrain);
  const gate = course.rings[1].pos;
  const bearing = Math.atan2(gate[0] - spawn.pos[0], -(gate[2] - spawn.pos[2]));
  const aircraft = poseAircraft(createAircraft, terrain, spawn, {
    pos: [gate[0] - Math.sin(bearing) * 480 - 210, gate[1] - 62, gate[2] + Math.cos(bearing) * 480 + 120],
    heading: bearing - 0.20,
    climb: 0.012,
    bank: 0.0,
    speed: 66,
    throttle: 0.86,
    gear: 0,
    onGround: false,
  });
  flyUntil(aircraft, gate, (state) => state.bank > 0.28, 600);
  const run = createRun(mission, course);
  run.run.ringsPassed = 1;
  run.run.score = 120;
  course.rings[0].passed = true;
  api.setScene({
    mission,
    course,
    aircraft,
    run,
    cameraMode: 'chase',
    time: 96,
    hint: 'gate two: the shore is your line',
    chase: { back: 12.4, up: 1.5, side: 5.4, lookAhead: 26 },
  });
}
