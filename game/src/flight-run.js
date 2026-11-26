// The rules of a sortie: the clock, the gates, the landing, the points, and the point at which a
// run is over. The flight model never knows about score; this does, and the HUD reads it.
import { RING } from './config.js';
import { gradeTouchdown, onRunway, stripOffset } from './airfield.js';

const TIME_BONUS = 3;
const DAMAGE_PENALTY = 260;

export function createRun(mission, course) {
  const run = {
    mission,
    score: 0,
    elapsed: 0,
    ringsPassed: 0,
    ringsMissed: 0,
    markers: [],
    landing: null,
    status: 'flying',
    events: [],
    timeLimit: mission.timeLimit,
    reason: null,
  };

  function finish(status, reason) {
    if (run.status !== 'flying') return;
    run.status = status;
    run.reason = reason ?? null;
    if (status === 'landed' && run.landing) {
      run.score += run.landing.score;
    }
    if (status === 'crashed') run.score = Math.round(run.score * 0.25);
    run.finalScore = Math.max(0, Math.round(run.score));
  }

  function update(dt, aircraft, previous) {
    if (run.status !== 'flying') return run.events;
    run.events = [];
    if (run.timeLimit) {
      run.elapsed += dt;
      if (run.elapsed > run.timeLimit) {
        run.events.push({ kind: 'timeout' });
        finish('timeout', 'the light went before the sortie did');
        return run.events;
      }
    } else {
      run.elapsed += dt;
    }

    if (aircraft.crashed) {
      run.events.push({ kind: 'crash', reason: aircraft.crashReason });
      finish('crashed', aircraft.crashReason ?? 'the aircraft did not survive');
      return run.events;
    }

    const altitude = aircraft.pos[1] - Math.max(aircraft.surface ?? 0, 0);
    const ring = course.check(previous, aircraft.pos, aircraft.agl);
    if (ring) {
      run.ringsPassed += 1;
      run.score += RING.score;
      let detail = '';
      if (ring.type === 'marker') {
        const low = 1 - Math.min(1, aircraft.agl / 130);
        const level = 1 - Math.min(1, Math.abs(aircraft.bank) / 0.52);
        const bonus = Math.round(low * 90 + level * 60);
        run.score += bonus;
        run.markers.push({ agl: aircraft.agl, bank: aircraft.bank, bonus, low: aircraft.agl < 80, level: Math.abs(aircraft.bank) < 0.26 });
        detail = `${Math.round(aircraft.agl)} m up, ${Math.round((aircraft.bank * 180) / Math.PI)}° of bank`;
      }
      run.events.push({ kind: 'ring', ring, detail, score: RING.score });
    }

    // Rings that the pilot flew past are known to the course; count them once.
    let missed = 0;
    for (const item of course.rings) if (item.missed) missed += 1;
    run.ringsMissed = missed;
    if (missed > run.ringsPassed && missed > 0 && run.markers.length === 0) {
      // A gate missed in a gate course ends the clean run but not the sortie.
      run.lastMiss = missed;
    }

    // The aircraft is down: grade the arrival, and end the sortie if it asked for a landing.
    if (aircraft.onGround && !run.landing) {
      const { across } = stripOffset(aircraft.pos[0], aircraft.pos[2]);
      const grade = gradeTouchdown({
        sink: aircraft.sinkRate,
        bank: aircraft.bank,
        speed: aircraft.speed,
        across,
      });
      run.landing = { ...grade, sink: aircraft.sinkRate, across, speed: aircraft.speed };
      run.events.push({ kind: 'touchdown', grade: run.landing });
      if (mission.landing) finish('landed', 'down on the strand');
    }

    // A gate course ends when every gate has been passed or missed.
    const done = course.rings.length > 0 && course.rings.every((item) => item.passed || item.missed);
    if (done && !mission.landing) {
      const flown = course.rings.every((item) => item.passed);
      run.objectiveMet = flown;
      if (flown && run.timeLimit) run.score += Math.max(0, run.timeLimit - run.elapsed) * TIME_BONUS;
      finish(flown ? 'complete' : 'missed', flown ? 'every gate flown' : 'gates missed: the course beat you');
    }
    if (mission.landing && done && course.rings.length > 0) {
      run.awaitingLanding = true;
    }

    return run.events;
  }

  function breakdown() {
    const penalty = Math.round(260 * Math.min(1, run.crashDamage ?? 0));
    return {
      gates: run.ringsPassed * RING.score,
      bonus: run.markers.reduce((sum, m) => sum + m.bonus, 0),
      landing: run.landing ? run.landing.score : 0,
      time: run.objectiveMet && run.timeLimit ? Math.round(Math.max(0, run.timeLimit - run.elapsed) * TIME_BONUS) : 0,
      penalty,
      total: run.finalScore ?? Math.round(run.score),
    };
  }

  /** S / A / B / C / D, against what a clean run of this sortie is worth. */
  function grade() {
    const max = (course.rings.length * (RING.score + 60)) + 330 + (run.timeLimit ? run.timeLimit * TIME_BONUS : 0);
    const ratio = (run.finalScore ?? run.score) / Math.max(1, max);
    if (run.status === 'crashed') return 'D';
    if (run.status === 'missed') return 'D';
    if (ratio > 0.74) return 'S';
    if (ratio > 0.56) return 'A';
    if (ratio > 0.38) return 'B';
    if (ratio > 0.18) return 'C';
    return 'D';
  }

  return {
    run,
    update,
    breakdown,
    grade,
    finish,
    get status() { return run.status; },
    onRunway: (x, z) => onRunway(x, z),
  };
}
