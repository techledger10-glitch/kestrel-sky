// Carrow Strand: the graded plateau, the runway cut into it, and the rules that tell a landing from
// a crash. The strip is the mission's home, so its numbers are read by the flight model, the HUD's
// landing aid and the debrief alike.
import { WORLD, PALETTE } from './config.js';
import { MeshBuilder } from './mesh.js';

const LENGTH = 880;
const WIDTH = 38;
/** Runway 06/24: laid along a long diagonal of the plateau so approach is over the sea. */
const HEADING = 0.62;
const SURFACE = WORLD.airfield.elevation + 0.35;

const DIR = [Math.sin(HEADING), 0, -Math.cos(HEADING)];
const SIDE = [Math.cos(HEADING), 0, Math.sin(HEADING)];

export const RUNWAY = {
  centre: [WORLD.airfield.x, SURFACE, WORLD.airfield.z],
  heading: HEADING,
  length: LENGTH,
  width: WIDTH,
  elevation: SURFACE,
  dir: DIR,
  side: SIDE,
};

function point(along, across, lift = 0) {
  return [
    RUNWAY.centre[0] + DIR[0] * along + SIDE[0] * across,
    SURFACE + lift,
    RUNWAY.centre[2] + DIR[2] * along + SIDE[2] * across,
  ];
}

/** Where a world position sits on the strip, in metres along and across it. */
export function stripOffset(x, z) {
  const dx = x - RUNWAY.centre[0];
  const dz = z - RUNWAY.centre[2];
  return {
    along: dx * DIR[0] + dz * DIR[2],
    across: dx * SIDE[0] + dz * SIDE[2],
  };
}

export function onRunway(x, z, margin = 0) {
  const { along, across } = stripOffset(x, z);
  return Math.abs(along) <= LENGTH / 2 + margin && Math.abs(across) <= WIDTH / 2 + margin;
}

/** The threshold a landing starts from, and the point an aircraft lines up on. */
export function approachPoint(distance = 1400, height = 190) {
  return [
    RUNWAY.centre[0] - DIR[0] * distance,
    SURFACE + height,
    RUNWAY.centre[2] - DIR[2] * distance,
  ];
}

export function thresholdPoint(along = -LENGTH / 2 + 40) {
  return point(along, 0, 0.6);
}

/**
 * Judge a touchdown: sink rate, bank, speed and how near the centreline. Returns the grade the
 * debrief shows and whether the landing survived.
 */
export function gradeTouchdown({ sink, bank, speed, across }) {
  const limits = { maxSink: 4.2, maxBank: 0.30, minSpeed: 21, maxSpeed: 62 };
  const offCentre = Math.abs(across);
  if (speed < limits.minSpeed) return { ok: false, grade: 'STALLED ON', score: 0, reason: 'touched down below flying speed' };
  if (speed > limits.maxSpeed) return { ok: false, grade: 'OVERRUN', score: 0, reason: 'too fast to settle on the strip' };
  if (Math.abs(bank) > limits.maxBank) return { ok: false, grade: 'WING STRIKE', score: 0, reason: 'a wingtip caught the runway' };
  if (sink > limits.maxSink * 2.4) return { ok: false, grade: 'CRASHED', score: 0, reason: 'the gear could not take the sink rate' };
  if (sink > limits.maxSink) return { ok: false, grade: 'HARD LANDING', score: 40, reason: 'a heavy arrival, the gear took a beating' };
  if (offCentre > WIDTH / 2) return { ok: false, grade: 'RUNWAY EDGE', score: 30, reason: 'off the paved surface' };

  const softness = 1 - sink / limits.maxSink;
  const centre = 1 - offCentre / (WIDTH / 2);
  const slowness = 1 - Math.min(1, Math.abs(speed - 34) / 26);
  const score = Math.round(60 + softness * 120 + centre * 90 + slowness * 60);
  const grade = sink < 1.1 && offCentre < 7 ? 'GREASED' : sink < 2.2 ? 'SMOOTH' : 'FIRM';
  return { ok: true, grade, score, reason: `${sink.toFixed(1)} m/s sink, ${offCentre.toFixed(0)} m off centre` };
}

/** The strip, its paint, the apron, the hut and the windsock, as one mesh. */
export function buildAirfieldMesh(random) {
  const mesh = new MeshBuilder();
  const asphalt = PALETTE.runway;
  const paint = PALETTE.runwayMark;

  // A gravel shoulder, a shade wider and a touch lower than the pavement.
  mesh.quad(point(-LENGTH / 2 - 22, -WIDTH / 2 - 12, -0.12), point(LENGTH / 2 + 22, -WIDTH / 2 - 12, -0.12),
    point(LENGTH / 2 + 22, WIDTH / 2 + 12, -0.12), point(-LENGTH / 2 - 22, WIDTH / 2 + 12, -0.12),
    [0.412, 0.380, 0.322]);

  mesh.quad(point(-LENGTH / 2, -WIDTH / 2, 0), point(LENGTH / 2, -WIDTH / 2, 0),
    point(LENGTH / 2, WIDTH / 2, 0), point(-LENGTH / 2, WIDTH / 2, 0), asphalt);

  // Centreline dashes: thirty metres of paint every fifty-four.
  for (let along = -LENGTH / 2 + 40; along < LENGTH / 2 - 30; along += 54) {
    mesh.quad(point(along, -0.55, 0.05), point(along + 30, -0.55, 0.05),
      point(along + 30, 0.55, 0.05), point(along, 0.55, 0.05), paint);
  }

  // Threshold bars at both ends, four a side, the way a strip's numbers are painted.
  for (const end of [-1, 1]) {
    for (let bar = 0; bar < 4; bar += 1) {
      const across = -WIDTH / 2 + 5 + bar * 4.2;
      const a = end * (LENGTH / 2 - 26);
      const b = end * (LENGTH / 2 - 6);
      for (const mirror of [-1, 1]) {
        const off = mirror === 1 ? across : -across - 3;
        mesh.quad(point(Math.min(a, b), off, 0.05), point(Math.max(a, b), off, 0.05),
          point(Math.max(a, b), off + 3, 0.05), point(Math.min(a, b), off + 3, 0.05), paint);
      }
    }
    // The aiming point, two fat blocks a third of the way in from each threshold.
    const aim = end * (LENGTH / 2 - 210);
    for (const mirror of [-1, 1]) {
      const off = mirror * 7.5;
      mesh.quad(point(aim, off, 0.05), point(aim + end * 34, off, 0.05),
        point(aim + end * 34, off + mirror * 5, 0.05), point(aim, off + mirror * 5, 0.05), paint);
    }
  }

  // The apron and a low hut beside the threshold, so the field reads as somewhere people keep a plane.
  const apronAlong = -LENGTH / 2 + 150;
  const apronAcross = WIDTH / 2 + 46;
  mesh.quad(point(apronAlong - 60, apronAcross - 34, -0.05), point(apronAlong + 60, apronAcross - 34, -0.05),
    point(apronAlong + 60, apronAcross + 34, -0.05), point(apronAlong - 60, apronAcross + 34, -0.05),
    [0.365, 0.353, 0.333]);
  const hut = point(apronAlong - 30, apronAcross + 58, 0);
  mesh.box([hut[0], hut[1] + 2.6, hut[2]], [7.5, 2.6, 5.0], [0.541, 0.478, 0.400], [0.353, 0.325, 0.310]);
  mesh.box([hut[0], hut[1] + 5.6, hut[2]], [8.4, 0.4, 5.9], [0.298, 0.278, 0.271]);

  // A fuel bowser and a stack of drums: two boxes that give the apron scale.
  const bowser = point(apronAlong + 34, apronAcross + 60, 0);
  mesh.box([bowser[0], bowser[1] + 1.3, bowser[2]], [4.4, 1.3, 1.9], [0.451, 0.365, 0.216]);
  mesh.box([bowser[0] - 1.2, bowser[1] + 2.9, bowser[2]], [1.9, 0.9, 1.7], [0.361, 0.306, 0.204]);

  // The windsock: a pole and a tapered sleeve hanging in the evening breeze.
  const sockBase = point(-LENGTH / 2 + 60, WIDTH / 2 + 26, 0);
  mesh.box([sockBase[0], sockBase[1] + 3.4, sockBase[2]], [0.16, 3.4, 0.16], [0.706, 0.694, 0.667]);
  const into = [DIR[0] * 0.4 + SIDE[0] * 0.9, -0.22, DIR[2] * 0.4 + SIDE[2] * 0.9];
  const sockTip = [sockBase[0] + into[0] * 7, sockBase[1] + 6.4 + into[1] * 7, sockBase[2] + into[2] * 7];
  mesh.cone([sockBase[0], sockBase[1] + 6.4, sockBase[2]], 1.5, 0.1, 6, [0.945, 0.435, 0.239]);
  mesh.tri([sockBase[0] - 1.1, sockBase[1] + 6.4, sockBase[2] - 1.1], [sockBase[0] + 1.1, sockBase[1] + 6.4, sockBase[2] + 1.1], sockTip, [0.949, 0.529, 0.259]);

  return mesh.buffers();
}
