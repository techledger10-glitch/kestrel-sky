// The aircraft: a high-wing monoplane in cream and teal, built from the same triangles as the
// islands. Nose at -Z, wings along X, up +Y. The wing sits on top of the cabin, so from a chase
// camera the eye sees its upper surface — which is where most of the paint goes.
import { MeshBuilder } from './mesh.js';

const CREAM = [0.945, 0.913, 0.831];
const CREAM_SHADE = [0.827, 0.796, 0.718];
const TEAL = [0.157, 0.396, 0.412];
const TEAL_DEEP = [0.114, 0.290, 0.310];
const AMBER = [0.957, 0.643, 0.259];
const GLASS = [0.129, 0.208, 0.251];
const STEEL = [0.560, 0.576, 0.592];
const DARK = [0.157, 0.157, 0.169];
const RED = [0.878, 0.239, 0.196];
const GREEN = [0.259, 0.780, 0.384];

/** A lofted tube: sections along Z with a width, a height and a centre height. */
function loft(mesh, sections) {
  const half = (s) => s.w / 2;
  for (let i = 0; i < sections.length - 1; i += 1) {
    const a = sections[i];
    const b = sections[i + 1];
    const a0 = [-half(a), a.y - a.h / 2, a.z];
    const a1 = [half(a), a.y - a.h / 2, a.z];
    const a2 = [half(a), a.y + a.h / 2, a.z];
    const a3 = [-half(a), a.y + a.h / 2, a.z];
    const b0 = [-half(b), b.y - b.h / 2, b.z];
    const b1 = [half(b), b.y - b.h / 2, b.z];
    const b2 = [half(b), b.y + b.h / 2, b.z];
    const b3 = [-half(b), b.y + b.h / 2, b.z];
    mesh.quad(a0, a1, b1, b0, CREAM_SHADE);
    mesh.quad(a1, a2, b2, b1, CREAM);
    mesh.quad(a2, a3, b3, b2, CREAM);
    mesh.quad(a3, a0, b0, b3, TEAL);
    if (i === 0) mesh.quad(a0, a3, a2, a1, DARK);
    if (i === sections.length - 2) mesh.quad(b0, b1, b2, b3, CREAM_SHADE);
  }
}

/** One wing panel between a root and a tip chord, with thickness at both ends. */
function panel(mesh, side, root, tip, colour, edge) {
  const s = side;
  const rf = [s * root.x, root.y, root.zFront];
  const rb = [s * root.x, root.y, root.zBack];
  const tf = [s * tip.x, tip.y, tip.zFront];
  const tb = [s * tip.x, tip.y, tip.zBack];
  const up = (p, t) => [p[0], p[1] + t, p[2]];
  const down = (p, t) => [p[0], p[1] - t, p[2]];
  mesh.quad(up(rf, 0), up(tf, 0), up(tb, 0), up(rb, 0), colour);
  mesh.quad(down(rb, 0), down(tb, 0), down(tf, 0), down(rf, 0), CREAM_SHADE);
  mesh.quad(up(rf, root.thick), up(tf, tip.thick), down(tf, tip.thick), down(rf, root.thick), edge);
  mesh.quad(down(rf, root.thick), down(tf, tip.thick), up(tf, tip.thick), up(rf, root.thick), edge);
  mesh.quad(down(rb, root.thick), down(tb, tip.thick), up(tb, tip.thick), up(rb, root.thick), edge);
  mesh.quad(up(rb, root.thick), up(tb, tip.thick), down(tb, tip.thick), down(rb, root.thick), edge);
  mesh.quad(up(tf, tip.thick), up(tb, tip.thick), down(tb, tip.thick), down(tf, tip.thick), edge);
}

/** A vertical fin: a quad in the YZ plane with thickness, raked back at the top. */
function fin(mesh, zFront, zBack, baseY, topY, rake, colour, band) {
  const t = 0.075;
  const s = [
    [-t, baseY, zFront], [t, baseY, zFront], [t, baseY, zBack], [-t, baseY, zBack],
    [-t, topY, zBack + rake], [t, topY, zBack + rake], [t, topY, zFront + rake * 1.9], [-t, topY, zFront + rake * 1.9],
  ];
  mesh.quad(s[0], s[1], s[5], s[4], colour);
  mesh.quad(s[3], s[7], s[6], s[2], colour);
  mesh.quad(s[0], s[4], s[7], s[3], colour);
  mesh.quad(s[1], s[2], s[6], s[5], colour);
  mesh.quad(s[4], s[5], s[6], s[7], band);
}

export function buildAircraftMeshes() {
  const body = new MeshBuilder();

  // Fuselage. The cabin is deepest at the wing; the tail post is thin.
  loft(body, [
    { z: -3.62, w: 0.30, h: 0.30, y: 0.10 },
    { z: -3.40, w: 0.62, h: 0.60, y: 0.10 },
    { z: -3.02, w: 0.90, h: 0.88, y: 0.10 },
    { z: -2.30, w: 1.02, h: 1.00, y: 0.12 },
    { z: -1.10, w: 1.06, h: 1.10, y: 0.16 },
    { z: 0.40, w: 1.02, h: 1.10, y: 0.18 },
    { z: 1.70, w: 0.82, h: 0.92, y: 0.24 },
    { z: 2.90, w: 0.52, h: 0.62, y: 0.32 },
    { z: 3.72, w: 0.22, h: 0.34, y: 0.40 },
  ]);

  // The teal cheat line along each flank, and the cowl detail at the nose.
  for (const s of [-1, 1]) {
    body.quad([s * 0.53, 0.20, -2.30], [s * 0.53, 0.20, 2.40], [s * 0.53, 0.56, 2.40], [s * 0.53, 0.56, -2.30], TEAL_DEEP);
    body.quad([s * 0.45, -0.02, -2.55], [s * 0.45, -0.02, -2.15], [s * 0.45, 0.34, -2.15], [s * 0.45, 0.34, -2.55], AMBER);
  }

  // The wing: 9.8 m span, mounted on the cabin roof.
  for (const s of [-1, 1]) {
    panel(body, s,
      { x: 0.36, y: 0.60, zFront: -1.38, zBack: 0.72, thick: 0.10 },
      { x: 4.90, y: 0.80, zFront: -1.02, zBack: 0.46, thick: 0.035 }, CREAM, CREAM_SHADE);
    body.quad([s * 4.52, 0.795, -1.06], [s * 4.90, 0.80, -1.02], [s * 4.90, 0.80, 0.46], [s * 4.52, 0.795, 0.44], AMBER);
    body.box([s * 4.97, 0.72, -0.28], [0.10, 0.10, 0.16], s > 0 ? GREEN : RED);
    // Wing struts: the detail that says "light aircraft" from any angle.
    body.box([s * 1.62, 0.30, 0.02], [0.05, 0.86, 0.05], STEEL);
    body.box([s * 2.72, 0.42, -0.10], [0.04, 0.40, 0.04], STEEL);
    body.quad([s * 0.40, 0.705, 0.36], [s * 4.44, 0.80, 0.20], [s * 4.44, 0.80, 0.44], [s * 0.40, 0.705, 0.68], CREAM_SHADE);
  }

  // Tailplane, then the fin with an amber tip.
  for (const s of [-1, 1]) {
    panel(body, s,
      { x: 0.10, y: 0.46, zFront: 2.90, zBack: 3.62, thick: 0.05 },
      { x: 1.82, y: 0.52, zFront: 3.10, zBack: 3.50, thick: 0.02 }, CREAM, CREAM_SHADE);
  }
  fin(body, 2.66, 3.60, 0.46, 2.30, -0.34, TEAL, AMBER);

  // Canopy: dark glass over four facets, with a cream frame.
  const canopy = [
    { z: -1.95, w: 0.66, y: 0.80 },
    { z: -1.25, w: 0.80, y: 1.12 },
    { z: -0.35, w: 0.76, y: 1.08 },
    { z: 0.30, w: 0.58, y: 0.90 },
  ];
  for (let i = 0; i < canopy.length - 1; i += 1) {
    const a = canopy[i];
    const b = canopy[i + 1];
    body.quad([-a.w / 2, 0.64, a.z], [a.w / 2, 0.64, a.z], [b.w / 2, 0.64, b.z], [-b.w / 2, 0.64, b.z], DARK);
    body.quad([-a.w / 2, 0.64, a.z], [0, a.y, a.z], [0, b.y, b.z], [-b.w / 2, 0.64, b.z], GLASS);
    body.quad([0, a.y, a.z], [a.w / 2, 0.64, a.z], [b.w / 2, 0.64, b.z], [0, b.y, b.z], GLASS);
  }
  body.quad([-0.33, 1.12, -1.25], [0.33, 1.12, -1.25], [0.30, 1.08, -0.35], [-0.30, 1.08, -0.35], GLASS);

  // Fixed gear, nose leg ahead of the wing.
  for (const s of [-1, 1]) {
    body.box([s * 1.02, -0.46, 0.10], [0.07, 0.46, 0.10], STEEL);
    body.box([s * 1.02, -0.86, 0.10], [0.17, 0.17, 0.26], DARK);
  }
  body.box([0, -0.66, -2.50], [0.065, 0.60, 0.065], STEEL);
  body.box([0, -0.98, -2.50], [0.13, 0.13, 0.20], DARK);

  // Exhaust stubs and cabin windows.
  for (const s of [-1, 1]) {
    body.box([s * 0.40, -0.02, -2.62], [0.06, 0.06, 0.20], DARK);
    body.quad([s * 0.53, 0.28, 0.62], [s * 0.53, 0.34, 1.55], [s * 0.53, 0.50, 1.55], [s * 0.53, 0.44, 0.62], GLASS);
  }

  // The propeller turns on its own matrix, so it is built at the origin and placed at the nose.
  const prop = new MeshBuilder();
  prop.box([0, 0, 0], [0.14, 0.14, 0.24], STEEL);
  for (const s of [-1, 1]) {
    prop.quad([-0.085, s * 0.14, 0.03], [0.085, s * 0.14, 0.03], [0.055, s * 1.95, 0.03], [-0.055, s * 1.95, 0.03], DARK);
    prop.quad([-0.085, s * 0.14, -0.03], [0.085, s * 0.14, -0.03], [0.055, s * 1.95, -0.03], [-0.055, s * 1.95, -0.03], DARK);
    prop.quad([-0.055, s * 1.95, 0.03], [0.055, s * 1.95, 0.03], [0.055, s * 1.95, -0.03], [-0.055, s * 1.95, -0.03], AMBER);
  }
  prop.quad([-0.14, -0.14, -0.12], [0.14, -0.14, -0.12], [0.14, 0.14, -0.12], [-0.14, 0.14, -0.12], STEEL);

  return { body: body.buffers(), prop: prop.buffers() };
}
