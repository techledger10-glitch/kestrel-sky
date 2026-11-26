// Kestrel Sky: boot, the one loop, and the four screens the game moves between. The world advances
// in fixed steps so a slow frame cannot bend the flight model; the renderer and the two overlay
// canvases are painted from whatever state that step left behind.
//
// ?seed=N fixes the archipelago and the scenes. ?shot=cover|panel|survey|debrief (with &seed=N)
// stages one of the four screenshot scenes instead of running the game.
import { BEST_KEY, STEP, MAX_CATCH_UP, VIEW, PALETTE, CAMERA } from './config.js';
import { createRandom } from './random.js';
import { createTerrain } from './terrain.js';
import { buildScenery } from './scenery.js';
import { buildAirfieldMesh, thresholdPoint, RUNWAY } from './airfield.js';
import { cloudBanks, buildCloudBank } from './mesh.js';
import { createContext, createPrograms, GpuMesh } from './gl.js';
import { createSky } from './sky.js';
import { createOcean } from './ocean.js';
import { createAircraft, attitude } from './aircraft.js';
import { buildAircraftMeshes } from './aircraft-model.js';
import { createCourse, RING_COLOURS } from './rings.js';
import { createCamera, createRenderer } from './renderer.js';
import { createHud } from './hud.js';
import { createCockpit } from './cockpit.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRun } from './flight-run.js';
import { MISSIONS, missionById, spawnFor } from './missions.js';
import { fromYawPitchRoll } from './mathx.js';
import { drawTitle, drawBrief, drawDebrief, drawPaused, drawCrashFlash } from './screens.js';
import { steer } from './autopilot.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261126;

const worldCanvas = document.getElementById('world');
const hudCanvas = document.getElementById('hud');
const overlayCanvas = document.getElementById('overlay');
const statusLine = document.getElementById('status');

const gl = createContext(worldCanvas);
const programs = createPrograms(gl);
const sky = createSky(gl);
const cameraRig = createCamera();
const hud = createHud(hudCanvas);
const overlay = overlayCanvas.getContext('2d');
const cockpit = createCockpit(hudCanvas);
const audio = createAudio();

const random = createRandom(seed);
const terrain = createTerrain(seed);
const terrainGpu = new GpuMesh(gl, terrain.mesh);
const scenery = new GpuMesh(gl, buildScenery(terrain, random));
const airfield = new GpuMesh(gl, buildAirfieldMesh(random));
const clouds = null; // high cloud lives in the sky shader; the boxy banks read as rocks at dusk
const ocean = createOcean(gl);
const aircraftMeshes = buildAircraftMeshes();
const aircraftGpu = { body: new GpuMesh(gl, aircraftMeshes.body), prop: new GpuMesh(gl, aircraftMeshes.prop) };

const ringColours = {
  colour(ring) {
    if (ring.passed) return RING_COLOURS.done;
    if (ring.missed) return PALETTE.hudAlarm;
    return ring.index === currentCourse?.nextIndex() ? RING_COLOURS.next : RING_COLOURS.ahead;
  },
  alpha(ring) {
    if (ring.passed) return 0.28;
    if (ring.missed) return 0.35;
    return 1;
  },
};

const render = createRenderer(gl, programs, sky);

let mode = 'title';
let selectedMission = 0;
let mission = MISSIONS[0];
let course = null;
let currentCourse = null;
let aircraft = null;
let run = null;
let prevPos = [0, 0, 0];
let accumulator = 0;
let elapsed = 0;
let cameraMode = 'chase';
let paused = false;
let crashFlash = 0;
let best = readBest();
let isNewBest = false;
let hint = '';
let propAngle = 0;
let lastFrame = performance.now();
let input = null;
let shotDone = false;
let shotCamera = false;
const rendererDebug = {
  nose: null,
  refresh(plane) {
    if (!plane) return;
    const m = new Float32Array(16);
    fromYawPitchRoll(m, -plane.state.heading, plane.state.climb + (plane.state.trim ?? 0.05), -plane.state.bank);
    this.nose = [-m[8], -m[9], -m[10]];
  },
};

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function writeBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off in a private window: the best then lasts this visit.
  }
}

function courseFor(target) {
  const definition = target.course.map((item) => ({
    x: item.x,
    z: item.z,
    y: terrain.heightAt(item.x, item.z) + item.clearance,
    type: item.type,
    radius: item.radius,
  }));
  return createCourse(gl, GpuMesh, terrain, definition);
}

function launch(index) {
  selectedMission = index;
  mission = MISSIONS[index];
  course = courseFor(mission);
  currentCourse = course;
  aircraft = createAircraft(terrain, spawnFor(mission, terrain));
  aircraft.state.propAngle = 0;
  run = createRun(mission, course);
  prevPos = [...aircraft.state.pos];
  accumulator = 0;
  crashFlash = 0;
  isNewBest = false;
  hint = mission.tip;
  mode = 'fly';
  paused = false;
  cameraMode = 'chase';
  if (statusLine) statusLine.textContent = `${mission.name}: ${mission.objective}`;
}

function startBrief(index) {
  selectedMission = index;
  mission = MISSIONS[index];
  mode = 'brief';
}

function finishRun() {
  const breakdown = run.breakdown();
  breakdown.penalty = Math.round(260 * Math.min(1, aircraft.state.damage));
  breakdown.total = Math.max(0, Math.round(breakdown.total - breakdown.penalty));
  run.run.finalScore = breakdown.total;
  isNewBest = breakdown.total > best;
  if (isNewBest) {
    best = breakdown.total;
    writeBest(best);
  }
  mode = 'debrief';
  audio.complete();
}

function updateFlight(dt) {
  const controls = input ? input.axes(dt) : { pitch: 0, roll: 0, yaw: 0, throttleAxis: 0, brake: false };
  prevPos = [...aircraft.state.pos];
  aircraft.step(dt, controls);
  aircraft.state.propAngle = (propAngle += dt * (6 + aircraft.state.throttle * 46)) % (Math.PI * 2);
  aircraft.state.propAngle = propAngle;

  const events = run.update(dt, aircraft.state, prevPos);
  for (const event of events) {
    if (event.kind === 'ring') {
      audio.ring();
      hint = event.detail || 'gate flown';
    } else if (event.kind === 'touchdown') {
      audio.touchdown(event.grade.ok);
      hint = `${event.grade.grade} — ${event.grade.reason}`;
    } else if (event.kind === 'crash') {
      audio.crash();
      crashFlash = 1.4;
    } else if (event.kind === 'timeout') {
      crashFlash = 0.6;
    }
  }
  if (run.status !== 'flying') finishRun();

  audio.update({
    throttle: aircraft.state.throttle,
    speed: aircraft.state.speed,
    stall: aircraft.state.warnings.has('stall'),
    onGround: aircraft.state.onGround,
  });
  if (aircraft.state.warnings.has('stall') || aircraft.state.warnings.has('pull-up')) audio.warn();
  if (crashFlash > 0) crashFlash = Math.max(0, crashFlash - dt * 0.9);
}

function drawOverlays(dt) {
  if (mode === 'title') {
    overlay.setTransform(overlayCanvas.width / 1280, 0, 0, overlayCanvas.height / 720, 0, 0);
    drawTitle(overlay, { missions: MISSIONS, selected: selectedMission, best });
    return;
  }
  if (mode === 'brief') {
    overlay.setTransform(overlayCanvas.width / 1280, 0, 0, overlayCanvas.height / 720, 0, 0);
    drawBrief(overlay, mission);
    return;
  }
  overlay.setTransform(1, 0, 0, 1, 0, 0);
  overlay.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

  // The cockpit panel lives on the HUD canvas, so it is drawn last, over the instruments.
  if (mode === 'fly' && !paused) {
    hud.draw({
      aircraft: aircraft.state,
      run: run.run,
      course,
      camera: cameraRig,
      mission,
      score: run.run.score,
      cameraMode,
      hint: cameraMode === 'cockpit' ? '' : hint,
      minimal: cameraMode === 'cockpit',
    });
    if (cameraMode === 'cockpit') cockpit.draw(aircraft.state);
  }

  if (crashFlash > 0) {
    overlay.setTransform(overlay.width / 1280, 0, 0, overlay.height / 720, 0, 0);
    drawCrashFlash(overlay, crashFlash);
  }

  if (paused) {
    overlay.setTransform(overlay.width / 1280, 0, 0, overlay.height / 720, 0, 0);
    drawPaused(overlay);
  }

  if (mode === 'debrief') {
    overlay.setTransform(overlay.width / 1280, 0, 0, overlay.height / 720, 0, 0);
    const breakdown = run.breakdown();
    breakdown.penalty = Math.round(260 * Math.min(1, aircraft.state.damage));
    breakdown.total = Math.max(0, Math.round(breakdown.total - breakdown.penalty));
    drawDebrief(overlay, {
      mission,
      run: { ...run.run, damage: aircraft.state.damage },
      breakdown,
      grade: run.grade(),
      best,
      isBest: isNewBest,
    });
  }
}

function frame(now) {
  const dt = Math.min((now - lastFrame) / 1000, MAX_CATCH_UP);
  lastFrame = now;
  elapsed += dt;

  if (shotName) {
    drawScene(0);
    drawOverlays(0);
    shotDone = true;
    window.__shotReady = true;
    requestAnimationFrame(frame);
    return;
  }

  if (mode === 'fly' && !paused) {
    accumulator += dt;
    let steps = 0;
    while (accumulator >= STEP && steps < 12) {
      updateFlight(STEP);
      accumulator -= STEP;
      steps += 1;
      if (mode !== 'fly') break;
    }
  } else if (mode === 'title' || mode === 'brief') {
    // The title screen's camera drifts around the airfield while the light does not move.
    accumulator += dt;
    const drift = accumulator * 0.05;
    if (!aircraft) {
      aircraft = createAircraft(terrain, spawnFor(MISSIONS[0], terrain));
      aircraft.state.pos = [RUNWAY.centre[0] + Math.cos(drift) * 620, RUNWAY.elevation + 240, RUNWAY.centre[2] + Math.sin(drift) * 620];
      aircraft.state.heading = drift + Math.PI;
      aircraft.state.speed = 0;
      aircraft.state.bank = 0.16;
      aircraft.state.climb = 0;
    }
  } else if (mode === 'debrief') {
    accumulator += dt;
  }

  drawScene(dt);
  drawOverlays(dt);
  requestAnimationFrame(frame);
}

function drawScene(dt) {
  if (!aircraft) return;
  if ((mode === 'title' || mode === 'brief') && !shotCamera) {
    const drift = accumulator * 0.05;
    const target = [RUNWAY.centre[0], RUNWAY.elevation + 30, RUNWAY.centre[2]];
    const eye = [
      RUNWAY.centre[0] + Math.cos(drift) * 900,
      RUNWAY.elevation + 330 + Math.sin(drift * 0.7) * 40,
      RUNWAY.centre[2] + Math.sin(drift) * 900,
    ];
    cameraRig.camera.eye = eye;
    cameraRig.camera.target = target;
    cameraRig.camera.forward = [
      (target[0] - eye[0]), (target[1] - eye[1]), (target[2] - eye[2]),
    ];
    const len = Math.hypot(...cameraRig.camera.forward) || 1;
    cameraRig.camera.forward = cameraRig.camera.forward.map((v) => v / len);
    cameraRig.camera.up = [0, 1, 0];
    cameraRig.camera.right = [
      cameraRig.camera.forward[1] * 0 - cameraRig.camera.forward[2] * 1,
      cameraRig.camera.forward[2] * 0 - cameraRig.camera.forward[0] * 0,
      cameraRig.camera.forward[0] * 1 - cameraRig.camera.forward[1] * 0,
    ];
    cameraRig.camera.fov = 58;
  } else {
    cameraRig.update(dt, aircraft.state, cameraMode);
  }
  cameraRig.compose();
  if (params.get('debug')) {
    let box = document.getElementById('dbg');
    if (!box) {
      box = document.createElement('pre');
      box.id = 'dbg';
      document.body.appendChild(box);
    }
    box.textContent = JSON.stringify({
      eye: cameraRig.camera.eye,
      target: cameraRig.camera.target,
      forward: cameraRig.camera.forward,
      right: cameraRig.camera.right,
      up: cameraRig.camera.up,
      fov: cameraRig.camera.fov,
      aspect: cameraRig.camera.aspect,
      pos: aircraft ? aircraft.state.pos : null,
      heading: aircraft ? aircraft.state.heading : null,
      climb: aircraft ? aircraft.state.climb : null,
      bank: aircraft ? aircraft.state.bank : null,
      nose: rendererDebug.nose,
      expected: aircraft ? [Math.sin(aircraft.state.heading), Math.sin(aircraft.state.climb), -Math.cos(aircraft.state.heading)] : null,
    }, null, 1);
  }
  rendererDebug.refresh(aircraft);
  render({
    camera: cameraRig.camera,
    terrain: terrainGpu,
    scenery,
    airfield,
    clouds,
    ocean,
    aircraft: aircraft.state,
    aircraftMeshes: aircraftGpu,
    course: mode === 'title' || mode === 'brief' ? null : course,
    time: elapsed,
    ringColours,
  });
}

function resize() {
  // Screenshot scenes always render the same 1280x720 frame, whatever chrome the browser adds.
  const ratio = shotName ? 1 : Math.min(2, window.devicePixelRatio || 1);
  const width = shotName ? VIEW.width : window.innerWidth;
  const height = shotName ? VIEW.height : window.innerHeight;
  worldCanvas.width = Math.round(width * ratio);
  worldCanvas.height = Math.round(height * ratio);
  worldCanvas.style.width = `${width}px`;
  worldCanvas.style.height = `${height}px`;
  const aspect = width / height;
  hud.resize(width, height, ratio);
  // The overlay canvas is kept at the window's own resolution; screens scale their 1280x720 layout.
  overlayCanvas.width = Math.round(width * ratio);
  overlayCanvas.height = Math.round(height * ratio);
  overlayCanvas.style.width = `${width}px`;
  overlayCanvas.style.height = `${height}px`;
  cameraRig.resize(width, height);
  void aspect;
}

function command(name) {
  if (name === 'confirm') {
    if (mode === 'title') startBrief(selectedMission);
    else if (mode === 'brief') launch(selectedMission);
    else if (mode === 'debrief') launch(selectedMission);
    audio.ensure();
  } else if (name === 'camera') {
    cameraMode = cameraMode === 'chase' ? 'cockpit' : 'chase';
  } else if (name === 'gear') {
    if (aircraft) aircraft.state.gear = aircraft.state.gear > 0.5 ? 0 : 1;
  } else if (name === 'restart') {
    if (mode === 'fly' || mode === 'debrief') launch(selectedMission);
  } else if (name === 'pause') {
    if (mode === 'fly') paused = !paused;
    else if (mode === 'debrief') mode = 'title';
  } else if (name === 'mute') {
    audio.ensure();
    audio.toggleMute();
  } else if (name === 'help') {
    if (mode === 'fly') hint = mission ? mission.tip : '';
  }
}

input = createInput(worldCanvas, command);
window.addEventListener('keydown', (event) => {
  if (mode === 'title' || mode === 'brief') {
    if (event.code === 'ArrowDown' || event.code === 'KeyS') {
      selectedMission = (selectedMission + 1) % MISSIONS.length;
      event.preventDefault();
    }
    if (event.code === 'ArrowUp' || event.code === 'KeyW') {
      selectedMission = (selectedMission + MISSIONS.length - 1) % MISSIONS.length;
      event.preventDefault();
    }
  }
  if (event.code === 'KeyM' && (mode === 'debrief')) {
    mode = 'title';
  }
});
window.addEventListener('resize', resize);

resize();

if (shotName) {
  stageShot(shotName, {
    seed,
    terrain,
    createAircraft,
    spawnFor,
    missionById,
    courseFor,
    createRun,
    cameraRig,
    setScene(scene) {
      mission = scene.mission;
      course = scene.course;
      currentCourse = course;
      aircraft = scene.aircraft;
      run = scene.run;
      mode = scene.mode ?? 'fly';
      shotCamera = Boolean(scene.freeCamera);
      cameraMode = scene.cameraMode ?? 'chase';
      hint = scene.hint ?? '';
      elapsed = scene.time ?? 12;
      if (scene.chase) Object.assign(CAMERA.chase, scene.chase);
      cameraRig.update(0.5, aircraft.state, cameraMode);
      if (scene.eye && scene.target) {
        const eye = scene.eye;
        const target = scene.target;
        cameraRig.camera.eye = [...eye];
        cameraRig.camera.target = [...target];
        const f = [target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]];
        const fl = Math.hypot(...f) || 1;
        cameraRig.camera.forward = f.map((v) => v / fl);
        cameraRig.camera.right = [-cameraRig.camera.forward[2], 0, cameraRig.camera.forward[0]];
        const rl = Math.hypot(...cameraRig.camera.right) || 1;
        cameraRig.camera.right = cameraRig.camera.right.map((v) => v / rl);
        cameraRig.camera.up = [
          cameraRig.camera.right[1] * cameraRig.camera.forward[2] - cameraRig.camera.right[2] * cameraRig.camera.forward[1],
          cameraRig.camera.right[2] * cameraRig.camera.forward[0] - cameraRig.camera.right[0] * cameraRig.camera.forward[2],
          cameraRig.camera.right[0] * cameraRig.camera.forward[1] - cameraRig.camera.right[1] * cameraRig.camera.forward[0],
        ];
        cameraRig.camera.fov = scene.fov ?? 58;
      }
      if (scene.closeUp) {
        const a = aircraft.state;
        const eye = [a.pos[0] + 11, a.pos[1] + 4.5, a.pos[2] - 13];
        const target = [a.pos[0], a.pos[1], a.pos[2]];
        cameraRig.camera.eye = eye;
        cameraRig.camera.target = target;
        const f = [target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]];
        const fl = Math.hypot(...f) || 1;
        cameraRig.camera.forward = f.map((v) => v / fl);
        const r = [
          cameraRig.camera.forward[1] * 0 - cameraRig.camera.forward[2] * 1,
          0,
          cameraRig.camera.forward[0] * 1 - cameraRig.camera.forward[1] * 0,
        ];
        const rl = Math.hypot(...r) || 1;
        cameraRig.camera.right = r.map((v) => v / rl);
        cameraRig.camera.up = [
          cameraRig.camera.right[1] * cameraRig.camera.forward[2] - cameraRig.camera.right[2] * cameraRig.camera.forward[1],
          cameraRig.camera.right[2] * cameraRig.camera.forward[0] - cameraRig.camera.right[0] * cameraRig.camera.forward[2],
          cameraRig.camera.right[0] * cameraRig.camera.forward[1] - cameraRig.camera.right[1] * cameraRig.camera.forward[0],
        ];
      }
      cameraRig.compose();
    },
    showDebrief(scene) {
      mission = scene.mission;
      aircraft = scene.aircraft;
      run = scene.run;
      mode = 'debrief';
      best = scene.best;
      isNewBest = scene.isBest;
    },
  });
}
requestAnimationFrame(frame);
