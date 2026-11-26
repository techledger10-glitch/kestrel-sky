// The three sorties and the free flight: where each starts, what it asks for, how long the light
// lasts, and how it is scored. Missions are data; the rules that read them live in flight-run.js.
import { AIRCRAFT } from './config.js';
import { RUNWAY as STRIP } from './airfield.js';

/** A point on the course, given where it is over the ground rather than how high the ground is. */
const RIDGE_CENTRE = [-450, -1050];
const RIDGE_RADIUS = 620;

function over(x, z, clearance, extra = {}) {
  return { x, z, clearance, ...extra };
}

const START = STRIP.centre;

export const MISSIONS = [
  {
    id: 'ridge',
    code: 'SORTIE 01',
    name: 'Ridge Run',
    tagline: 'Eight gates down the Alder spine',
    brief: [
      'The ridge wind is steady out of the west and the gates are set down the spine of Alder.',
      'Fly all eight in order. The last of the light is your clock: every second you save is',
      'points, and every gate you fly clean is the difference between a sortie and a story.',
    ],
    objective: 'Fly all eight gates',
    tip: 'Bank, pull, and hold your speed. A hard turn costs height as well as time.',
    // Lined up 500 m short of the first gate, which sits dead ahead up the western shore.
    spawn: {
      pos: [-1205, 0, -380],
      speed: 66,
      heading: -0.09,
      climb: 0.01,
      gear: 0,
      onGround: false,
      fuel: AIRCRAFT.fuelCapacity,
    },
    timeLimit: 210,
    // A lap of the island: straight legs between gates, wide enough to turn at cruise.
    course: [
      over(-1250, -880, 150),
      over(-1180, -1450, 155),
      over(-700, -1780, 160),
      over(100, -1790, 165),
      over(700, -1450, 160),
      over(860, -900, 150),
      over(350, -520, 145),
      over(-620, -560, 145),
    ],
    landing: false,
  },
  {
    id: 'survey',
    code: 'SORTIE 02',
    name: 'Low Survey',
    tagline: 'Five passes for the coastal survey',
    brief: [
      'The survey office wants five passes over the north shore before the light goes:',
      'low, level and unhurried. Each marker must be crossed below four hundred feet',
      'with the wings within thirty degrees of level, or the photograph is no good.',
    ],
    objective: 'Pass over five survey markers, low and level',
    tip: 'Get down early: each pass is graded on height and on how level you are.',
    spawn: {
      pos: [-1150, 0, -260],
      speed: 58,
      heading: 0.5,
      climb: 0.0,
      gear: 0,
      onGround: false,
      fuel: AIRCRAFT.fuelCapacity,
    },
    spawnOnStrip: true,
    timeLimit: 250,
    course: [
      over(-820, -640, 60, { type: 'marker', radius: 30 }),
      over(-520, -880, 60, { type: 'marker', radius: 30 }),
      over(-30, -1030, 60, { type: 'marker', radius: 30 }),
      over(420, -900, 60, { type: 'marker', radius: 30 }),
      over(300, -560, 60, { type: 'marker', radius: 30 }),
    ],
    landing: true,
  },
  {
    id: 'dusk',
    code: 'SORTIE 03',
    name: 'Dusk Delivery',
    tagline: 'A leaking tank and a strip to find',
    brief: [
      'The ferry tank was patched this morning and the patch is holding about as well as',
      'you would expect. Take the four gates over Cormorant, then bring her home to',
      'Carrow Strand and put her down gently: the gear is the only set of wheels on the island.',
    ],
    objective: 'Fly four gates, then land at Carrow Strand',
    tip: 'You have one tank. Climb less, fly lean, and save your height for the approach.',
    spawn: {
      pos: [-980, 0, -300],
      speed: 66,
      heading: 0.62,
      climb: 0.03,
      gear: 0,
      onGround: false,
      fuel: AIRCRAFT.fuelCapacity * 0.42,
      damage: 0.06,
    },
    spawnOnStrip: true,
    timeLimit: 300,
    course: [
      over(120, -780, 150),
      over(560, -460, 150),
      over(820, 40, 160),
      over(420, 320, 130),
    ],
    landing: true,
    fuelAtSpawn: AIRCRAFT.fuelCapacity * 0.42,
  },
  {
    id: 'free',
    code: 'FREE FLIGHT',
    name: 'Free Flight',
    tagline: 'The islands, the light, and no clock',
    brief: [
      'No gates and no clock: the archipelago is yours. Fly where you like, come back to the',
      'strand when the light goes, and put her down on the numbers.',
    ],
    objective: 'Explore, then land at Carrow Strand',
    tip: 'Watch the fuel gauge. The tanks are full and there is nowhere else to land.',
    spawn: {
      pos: [-1180, 0, -120],
      speed: 60,
      heading: 0.62,
      climb: 0.0,
      gear: 0,
      onGround: false,
      fuel: AIRCRAFT.fuelCapacity,
    },
    spawnOnStrip: true,
    timeLimit: null,
    course: [],
    landing: true,
  },
];

export function missionById(id) {
  return MISSIONS.find((mission) => mission.id === id) ?? MISSIONS[0];
}

/** The point an aircraft starts a sortie at: on the runway, or lined up just after it. */
export function spawnFor(mission, terrain) {
  if (!mission.spawn.pos) return mission.spawn;
  const [x, , z] = mission.spawn.pos;
  const ground = terrain.heightAt(x, z);
  const onRunway = Math.abs(x - START[0]) < 460 && Math.abs(z - START[2]) < 460;
  return {
    ...mission.spawn,
    pos: [x, (onRunway ? START[1] : ground) + AIRCRAFT.gearHeight + (mission.spawn.onGround ? 0 : 170), z],
    gear: mission.spawn.onGround ? 1 : 0,
  };
}

export { START as RUNWAY_START };
