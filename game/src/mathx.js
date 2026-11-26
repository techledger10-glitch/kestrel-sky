// The maths the renderer and the flight model share: vectors in plain arrays, 4x4 matrices in
// column-major order as WebGL wants them, and just enough quaternion to carry an aircraft's
// attitude without gimbal lock. Small enough to read, so every transform in the game can be
// checked by eye.

export function clamp(value, lo, hi) {
  return value < lo ? lo : value > hi ? hi : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** A frame-rate independent approach to a target: the fraction of the way there in `dt` seconds. */
export function damp(current, target, halfLife, dt) {
  if (halfLife <= 0) return target;
  return target + (current - target) * Math.pow(2, -dt / halfLife);
}

export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export const DEG = Math.PI / 180;

export function wrapPi(angle) {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function wrapTau(angle) {
  let a = angle;
  while (a >= Math.PI * 2) a -= Math.PI * 2;
  while (a < 0) a += Math.PI * 2;
  return a;
}

// ---- vectors ---------------------------------------------------------------------------------

export const vec3 = (x = 0, y = 0, z = 0) => [x, y, z];

export function add(out, a, b) {
  out[0] = a[0] + b[0];
  out[1] = a[1] + b[1];
  out[2] = a[2] + b[2];
  return out;
}

export function sub(out, a, b) {
  out[0] = a[0] - b[0];
  out[1] = a[1] - b[1];
  out[2] = a[2] - b[2];
  return out;
}

export function scale(out, a, s) {
  out[0] = a[0] * s;
  out[1] = a[1] * s;
  out[2] = a[2] * s;
  return out;
}

export function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function cross(out, a, b) {
  const x = a[1] * b[2] - a[2] * b[1];
  const y = a[2] * b[0] - a[0] * b[2];
  const z = a[0] * b[1] - a[1] * b[0];
  out[0] = x;
  out[1] = y;
  out[2] = z;
  return out;
}

export function length(a) {
  return Math.hypot(a[0], a[1], a[2]);
}

export function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export function normalize(out, a) {
  const len = Math.hypot(a[0], a[1], a[2]) || 1;
  out[0] = a[0] / len;
  out[1] = a[1] / len;
  out[2] = a[2] / len;
  return out;
}

export function lerpVec3(out, a, b, t) {
  out[0] = lerp(a[0], b[0], t);
  out[1] = lerp(a[1], b[1], t);
  out[2] = lerp(a[2], b[2], t);
  return out;
}

// ---- matrices (column-major) -----------------------------------------------------------------

export function mat4() {
  const m = new Float32Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}

export function perspective(out, fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  out.fill(0);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) / (near - far);
  out[11] = -1;
  out[14] = (2 * far * near) / (near - far);
  return out;
}

export function lookAt(out, eye, target, up) {
  const zx = eye[0] - target[0];
  const zy = eye[1] - target[1];
  const zz = eye[2] - target[2];
  let zl = Math.hypot(zx, zy, zz) || 1;
  const z0 = zx / zl;
  const z1 = zy / zl;
  const z2 = zz / zl;

  let x0 = up[1] * z2 - up[2] * z1;
  let x1 = up[2] * z0 - up[0] * z2;
  let x2 = up[0] * z1 - up[1] * z0;
  let xl = Math.hypot(x0, x1, x2);
  if (xl < 1e-6) {
    x0 = 1; x1 = 0; x2 = 0; xl = 1;
  }
  x0 /= xl; x1 /= xl; x2 /= xl;

  const y0 = z1 * x2 - z2 * x1;
  const y1 = z2 * x0 - z0 * x2;
  const y2 = z0 * x1 - z1 * x0;

  out[0] = x0; out[1] = y0; out[2] = z0; out[3] = 0;
  out[4] = x1; out[5] = y1; out[6] = z1; out[7] = 0;
  out[8] = x2; out[9] = y2; out[10] = z2; out[11] = 0;
  out[12] = -(x0 * eye[0] + x1 * eye[1] + x2 * eye[2]);
  out[13] = -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2]);
  out[14] = -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2]);
  out[15] = 1;
  return out;
}

export function multiply(out, a, b) {
  for (let c = 0; c < 4; c += 1) {
    const b0 = b[c * 4];
    const b1 = b[c * 4 + 1];
    const b2 = b[c * 4 + 2];
    const b3 = b[c * 4 + 3];
    out[c * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
    out[c * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
    out[c * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
    out[c * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
  }
  return out;
}

/** A matrix that places a model: yaw about Y, then pitch about X, then roll about Z. */
export function fromYawPitchRoll(out, yaw, pitch, roll) {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);

  // R = Ry(yaw) * Rx(pitch) * Rz(roll); forward is -Z, up is +Y.
  out[0] = cy * cr + sy * sp * sr;
  out[1] = cp * sr;
  out[2] = -sy * cr + cy * sp * sr;
  out[3] = 0;

  out[4] = -cy * sr + sy * sp * cr;
  out[5] = cp * cr;
  out[6] = sy * sr + cy * sp * cr;
  out[7] = 0;

  out[8] = sy * cp;
  out[9] = -sp;
  out[10] = cy * cp;
  out[11] = 0;

  out[12] = 0; out[13] = 0; out[14] = 0; out[15] = 1;
  return out;
}

export function translation(out, x, y, z) {
  out.fill(0);
  out[0] = out[5] = out[10] = out[15] = 1;
  out[12] = x;
  out[13] = y;
  out[14] = z;
  return out;
}

export function uniformScale(out, s) {
  out.fill(0);
  out[0] = out[5] = out[10] = s;
  out[15] = 1;
  return out;
}

/** The model matrix for a body at `pos` turned by yaw/pitch/roll, scaled. */
export function modelMatrix(out, pos, yaw, pitch, roll, s) {
  fromYawPitchRoll(out, yaw, pitch, roll);
  out[0] *= s; out[1] *= s; out[2] *= s;
  out[4] *= s; out[5] *= s; out[6] *= s;
  out[8] *= s; out[9] *= s; out[10] *= s;
  out[12] = pos[0];
  out[13] = pos[1];
  out[14] = pos[2];
  return out;
}

/** Direction in world space for a heading (about Y, 0 = -Z) and a climb angle. */
export function headingVector(out, heading, climb) {
  const ch = Math.cos(heading);
  const sh = Math.sin(heading);
  const cc = Math.cos(climb);
  out[0] = sh * cc;
  out[1] = Math.sin(climb);
  out[2] = -ch * cc;
  return out;
}

/** The heading a direction points at, in the same convention (0 = -Z, clockwise positive). */
export function headingOf(dir) {
  return Math.atan2(dir[0], -dir[2]);
}

export function climbOf(dir) {
  return Math.asin(clamp(dir[1], -1, 1));
}
