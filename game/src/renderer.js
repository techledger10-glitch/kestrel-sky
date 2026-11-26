// The camera and the frame: a spring chase view that hangs behind and a little above the aircraft,
// a cockpit view that sits at the pilot's eye, and one render pass that draws the sky, the sea, the
// islands, the scenery, the course and the aircraft in that order.
import { CAMERA, PALETTE, VIEW } from './config.js';
import { perspective, lookAt, multiply, mat4, normalize, damp, lerpVec3, clamp, fromYawPitchRoll } from './mathx.js';
import { normalMatrixFrom } from './rings.js';

export function createCamera() {
  const camera = {
    eye: [0, 200, 0],
    target: [0, 0, 0],
    forward: [0, 0, -1],
    right: [1, 0, 0],
    up: [0, 1, 0],
    fov: CAMERA.chase.fov,
    aspect: VIEW.width / VIEW.height,
    projection: mat4(),
    view: mat4(),
    viewProjection: mat4(),
    mode: 'chase',
  };

  const desiredEye = [0, 0, 0];
  const desiredTarget = [0, 0, 0];
  const desiredUp = [0, 0, 0];
  let initialised = false;

  function update(dt, aircraft, mode) {
    camera.mode = mode;
    const level = clamp(Math.cos(aircraft.climb), 0.2, 1);
    const forward = normalize([0, 0, 0], [
      Math.sin(aircraft.heading) * level,
      Math.sin(aircraft.climb),
      -Math.cos(aircraft.heading) * level,
    ]);

    if (mode === 'cockpit') {
      const eye = [
        aircraft.pos[0] + forward[0] * 1.15 - Math.sin(aircraft.heading) * 0.0,
        aircraft.pos[1] + 1.12 + Math.sin(aircraft.climb) * 1.15,
        aircraft.pos[2] + forward[2] * 1.15,
      ];
      camera.eye = eye;
      camera.forward = forward;
      // Up rolls with the aircraft in the cockpit, as the pilot's head does.
      const up = normalize([0, 0, 0], [
        Math.cos(aircraft.heading) * -Math.sin(aircraft.bank),
        Math.cos(aircraft.bank) * Math.cos(aircraft.climb),
        -Math.sin(aircraft.heading) * -Math.sin(aircraft.bank),
      ]);
      camera.up = up;
      camera.right = normalize([0, 0, 0], [
        forward[1] * up[2] - forward[2] * up[1],
        forward[2] * up[0] - forward[0] * up[2],
        forward[0] * up[1] - forward[1] * up[0],
      ]);
      camera.fov = CAMERA.cockpit.fov;
      camera.target = [eye[0] + forward[0] * 10, eye[1] + forward[1] * 10, eye[2] + forward[2] * 10];
      initialised = true;
      return camera;
    }

    const cfg = CAMERA.chase;
    // Sit a little off the centre line so the aircraft is seen in three-quarter, not dead astern.
    const side = cfg.side ?? 0;
    const rightVec = normalize([0, 0, 0], [
      forward[1] * 0 - forward[2] * 1,
      0,
      forward[0] * 1 - forward[1] * 0,
    ]);
    desiredEye[0] = aircraft.pos[0] - forward[0] * cfg.back + rightVec[0] * side;
    desiredEye[1] = aircraft.pos[1] - forward[1] * cfg.back + cfg.up;
    desiredEye[2] = aircraft.pos[2] - forward[2] * cfg.back + rightVec[2] * side;
    desiredTarget[0] = aircraft.pos[0] + forward[0] * cfg.lookAhead;
    desiredTarget[1] = aircraft.pos[1] + forward[1] * cfg.lookAhead + 1.5;
    desiredTarget[2] = aircraft.pos[2] + forward[2] * cfg.lookAhead;

    // The camera rolls a fraction of the way with the aircraft: enough to feel the turn, never
    // enough to make the horizon a moving target.
    const follow = cfg.rollFollow;
    desiredUp[0] = -Math.cos(aircraft.heading) * Math.sin(aircraft.bank) * follow;
    desiredUp[1] = Math.cos(aircraft.bank) * follow + (1 - follow);
    desiredUp[2] = -Math.sin(aircraft.heading) * Math.sin(aircraft.bank) * follow;

    if (!initialised) {
      lerpVec3(camera.eye, desiredEye, desiredEye, 1);
      lerpVec3(camera.target, desiredTarget, desiredTarget, 1);
      initialised = true;
    } else {
      for (let i = 0; i < 3; i += 1) {
        camera.eye[i] = damp(camera.eye[i], desiredEye[i], cfg.lag, dt);
        camera.target[i] = damp(camera.target[i], desiredTarget[i], cfg.lag * 0.55, dt);
        camera.up[i] = damp(camera.up[i], desiredUp[i], cfg.lag * 0.5, dt);
      }
    }
    normalize(camera.up, camera.up);
    camera.forward = normalize([0, 0, 0], [
      camera.target[0] - camera.eye[0],
      camera.target[1] - camera.eye[1],
      camera.target[2] - camera.eye[2],
    ]);
    camera.right = normalize([0, 0, 0], [
      camera.forward[1] * camera.up[2] - camera.forward[2] * camera.up[1],
      camera.forward[2] * camera.up[0] - camera.forward[0] * camera.up[2],
      camera.forward[0] * camera.up[1] - camera.forward[1] * camera.up[0],
    ]);
    camera.up = normalize([0, 0, 0], [
      camera.right[1] * camera.forward[2] - camera.right[2] * camera.forward[1],
      camera.right[2] * camera.forward[0] - camera.right[0] * camera.forward[2],
      camera.right[0] * camera.forward[1] - camera.right[1] * camera.forward[0],
    ]);
    camera.fov = cfg.fov + clamp(aircraft.speed - 40, 0, 70) * 0.12;
    return camera;
  }

  function resize(width, height) {
    camera.aspect = width / height;
  }

  function compose() {
    perspective(camera.projection, camera.fov * (Math.PI / 180), camera.aspect, CAMERA.near, CAMERA.far);
    lookAt(camera.view, camera.eye, camera.target, camera.up);
    multiply(camera.viewProjection, camera.projection, camera.view);
  }

  /** World point to the HUD's 1280x720 frame. */
  function project(point) {
    const m = camera.viewProjection;
    const x = point[0];
    const y = point[1];
    const z = point[2];
    const cx = m[0] * x + m[4] * y + m[8] * z + m[12];
    const cy = m[1] * x + m[5] * y + m[9] * z + m[13];
    const cz = m[2] * x + m[6] * y + m[10] * z + m[14];
    const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (cw <= 0.001) return { x: 0, y: 0, visible: false, depth: cz };
    const ndcX = cx / cw;
    const ndcY = cy / cw;
    return {
      x: (ndcX * 0.5 + 0.5) * VIEW.width,
      y: (1 - (ndcY * 0.5 + 0.5)) * VIEW.height,
      visible: cw > 0.001 && Math.abs(ndcX) < 1.4 && Math.abs(ndcY) < 1.4,
      depth: cw,
    };
  }

  return { camera, update, compose, project, resize };
}

const IDENTITY9 = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);

/** The whole frame, in the order a pilot's eyes and a painter's brush agree on. */
export function createRenderer(gl, programs, sky) {
  return function render({
    camera,
    terrain,
    scenery,
    airfield,
    clouds,
    ocean,
    aircraft,
    aircraftMeshes,
    course,
    time,
    ringColours,
  }) {
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    sky.draw(programs.sky, camera);

    const eye = camera.eye;
    const light = sky.sunDirection;
    const fog = 0.00009;

    // --- the sea ------------------------------------------------------------------------------
    const water = programs.water.use();
    water.mat4('uProjection', camera.projection);
    water.mat4('uView', camera.view);
    water.vec3('uEye', eye);
    water.vec3('uLightDirection', light);
    water.vec3('uSunColour', PALETTE.sun);
    water.vec3('uDeep', PALETTE.seaDeep);
    water.vec3('uShallow', PALETTE.seaShallow);
    water.vec3('uHorizon', PALETTE.skyHorizon);
    water.vec3('uZenith', PALETTE.skyZenith);
    water.vec3('uFogColour', PALETTE.fog);
    water.float('uFogDensity', fog);
    water.float('uTime', time ?? 0);
    ocean.mesh.draw();

    // --- everything lit ----------------------------------------------------------------------
    const lit = programs.lit.use();
    lit.mat4('uProjection', camera.projection);
    lit.mat4('uView', camera.view);
    lit.vec3('uEye', eye);
    lit.vec3('uLightDirection', light);
    lit.vec3('uLightColour', [1.68, 1.28, 0.90]);
    lit.vec3('uSkyColour', [0.50, 0.47, 0.47]);
    lit.vec3('uGroundColour', [0.24, 0.21, 0.17]);
    lit.vec3('uFogColour', PALETTE.fog);
    lit.float('uFogDensity', fog);
    lit.vec3('uTint', [1, 1, 1]);
    lit.float('uTintMix', 0);
    lit.float('uAlpha', 1);
    lit.mat4('uModel', mat4Identity);
    lit.mat3('uNormalMatrix', IDENTITY9);
    terrain.draw();
    scenery.draw();
    if (airfield) airfield.draw();
    if (clouds) clouds.draw();

    // --- the aircraft -------------------------------------------------------------------------
    const matrix = new Float32Array(16);
    const propMatrix = new Float32Array(16);
    fromYawPitchRoll(matrix, camera.mode === 'cockpit' ? -aircraft.heading : -aircraft.heading,
      aircraft.climb + (aircraft.trim ?? 0.05), -aircraft.bank);
    matrix[12] = aircraft.pos[0];
    matrix[13] = aircraft.pos[1];
    matrix[14] = aircraft.pos[2];
    lit.mat4('uModel', matrix);
    lit.mat3('uNormalMatrix', normalMatrixFrom(matrix));
    // From the pilot's seat the aircraft's own skin would fill the frame: the cockpit is the view.
    if (camera.mode !== 'cockpit') aircraftMeshes.body.draw();

    // The propeller turns about its own hub: a translation out to the nose, then the spin.
    const spin = aircraft.propAngle ?? 0;
    const c = Math.cos(spin);
    const s = Math.sin(spin);
    propMatrix.fill(0);
    propMatrix[0] = c; propMatrix[1] = s; propMatrix[2] = 0; propMatrix[3] = 0;
    propMatrix[4] = -s; propMatrix[5] = c; propMatrix[6] = 0; propMatrix[7] = 0;
    propMatrix[8] = 0; propMatrix[9] = 0; propMatrix[10] = 1; propMatrix[11] = 0;
    propMatrix[12] = 0; propMatrix[13] = 0; propMatrix[14] = -3.72; propMatrix[15] = 1;
    const worldProp = new Float32Array(16);
    multiply(worldProp, matrix, propMatrix);
    lit.mat4('uModel', worldProp);
    lit.mat3('uNormalMatrix', normalMatrixFrom(worldProp));
    if (camera.mode !== 'cockpit') aircraftMeshes.prop.draw();

    // --- the course ---------------------------------------------------------------------------
    if (course) {
      course.draw(lit, (ring) => ringColours.colour(ring), (ring) => ringColours.alpha(ring));
      lit.float('uTintMix', 0);
      lit.float('uAlpha', 1);
    }
  };
}

const mat4Identity = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
