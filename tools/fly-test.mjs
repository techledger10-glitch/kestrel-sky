// Headless flight test: flies a sortie with the autopilot and prints what the rules made of it.
// Runs in Node with no browser, so it is a fast check of the flight model, the course and scoring.
//
//   node tools/fly-test.mjs [missionId] [seed]
import { STEP } from '../game/src/config.js';
import { createTerrain } from '../game/src/terrain.js';
import { MISSIONS, missionById, spawnFor } from '../game/src/missions.js';
import { createAircraft } from '../game/src/aircraft.js';
import { createRun } from '../game/src/flight-run.js';
import { buildCourseState } from '../game/src/rings.js';
import { followCourse } from '../game/src/autopilot.js';

const missionId = process.argv[2] ?? 'ridge';
const seed = Number(process.argv[3] ?? 1);

const terrain = createTerrain(seed);
const mission = missionById(missionId);
if (!mission) {
  console.error(`unknown mission: ${missionId} (have ${MISSIONS.map((m) => m.id).join(', ')})`);
  process.exit(2);
}
const course = buildCourseState(terrain, mission.course);
const aircraft = createAircraft(terrain, spawnFor(mission, terrain));
const run = createRun(mission, course);

const closest = new Map();
let previous = [...aircraft.state.pos];
let steps = 0;
const limit = 260 * 120;

while (run.status === 'flying' && steps < limit) {
  const controls = followCourse(aircraft.state, course, { speed: mission.autopilotSpeed ?? 66, terrain });
  previous = [...aircraft.state.pos];
  aircraft.step(STEP, controls);
  aircraft.state.propAngle = (aircraft.state.propAngle ?? 0) + STEP * 40;
  run.update(STEP, aircraft.state, previous);

  for (let i = 0; i < course.rings.length; i += 1) {
    const ring = course.rings[i];
    const d = Math.hypot(ring.pos[0] - aircraft.state.pos[0], ring.pos[1] - aircraft.state.pos[1], ring.pos[2] - aircraft.state.pos[2]);
    if (!closest.has(i) || d < closest.get(i)) closest.set(i, d);
  }
  steps += 1;
}
if (run.status === 'flying') run.finish('timeout', 'the light went before the sortie did');

const rows = course.rings.map((ring, i) => ({
  gate: i + 1,
  result: ring.passed ? 'passed' : ring.missed ? 'MISSED' : 'not reached',
  closest: `${(closest.get(i) ?? 0).toFixed(1)} m`,
}));
const breakdown = run.breakdown();
const passed = course.rings.filter((r) => r.passed).length;

console.log(`mission      ${mission.name} (${mission.id}) seed ${seed}`);
console.log(`status       ${run.status}${run.reason ? ` - ${run.reason}` : ''}`);
console.log(`gates        ${passed} / ${course.rings.length}`);
console.table(rows);
console.log('breakdown   ', breakdown);
console.log('grade       ', run.grade());
console.log('simulated    ', `${(steps * STEP).toFixed(1)} s of flight`);

const ok = run.status !== 'flying' && run.status !== 'crashed';
process.exit(ok ? 0 : 1);
