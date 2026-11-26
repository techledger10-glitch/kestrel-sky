// Every tuning number and colour in one place: the flight model, the world, the camera and the
// palette. Units are metres, seconds, radians and kilograms throughout, so a number here reads the
// same way it reads in the physics.

/** The logical frame the HUD is laid out in; the renderer scales it to the window. */
export const VIEW = { width: 1280, height: 720 };

/** The simulation's fixed step: the world advances 120 times a second, whatever the display does. */
export const STEP = 1 / 120;
export const MAX_CATCH_UP = 0.25;

/** The archipelago: a 6 km square of sea, islands and one graded plateau for the airstrip. */
export const WORLD = {
  size: 6000,
  /** Heightfield resolution: cells across, so a cell is size / (cells - 1) metres. */
  cells: 168,
  seaLevel: 0,
  /** Where the airstrip plateau is cut into the north island. */
  airfield: { x: -1050, z: -420, elevation: 30, radius: 520 },
};

export const AIRCRAFT = {
  /** Empty mass plus pilot, kg. */
  mass: 1150,
  /** Maximum thrust at full throttle, newtons. */
  maxThrust: 12400,
  /** Zero-lift drag coefficient term: drag = q * (cd0 + induced). */
  cd0: 0.031,
  /** Induced drag per unit of load factor squared. */
  induced: 0.021,
  /** Wing reference area, m^2 (only used to scale the drag terms). */
  wingArea: 16.2,
  /** Air density at sea level on a cool evening. */
  rho: 1.225,
  gravity: 9.81,
  /** Speeds, m/s. Below stall the wing stops carrying the aircraft. */
  stallSpeed: 27,
  /** Never-exceed speed. */
  vne: 108,
  /** Best climb and best glide, used by the HUD's advisory needle. */
  bestClimb: 52,
  bestGlide: 46,
  /** Roll rate the ailerons give at cruise, rad/s. */
  rollRate: 1.85,
  /** Pitch authority: the most the elevator can bend the flight path, rad/s. */
  pitchRate: 0.46,
  /** Rudder: yaw authority, rad/s. */
  yawRate: 0.30,
  /** Fuel, kg, and the burn at full throttle, kg/s. */
  fuelCapacity: 128,
  fuelBurnFull: 0.86,
  fuelBurnIdle: 0.13,
  /** How far the nose sits above the flight path, radians, in level flight. */
  trimAngleOfAttack: 0.055,
  /** Load-factor limits: above the positive limit the airframe takes damage. */
  gLimit: 7.4,
  /** Seconds from touchdown to a full stop with the brakes held. */
  brakeDecel: 4.2,
  /** Height of the wheels above the model's origin, metres. */
  gearHeight: 1.62,
  /** The touchdown window that counts as a landing rather than a crash. */
  landing: { maxSink: 4.2, maxBank: 0.30, minSpeed: 21, maxSpeed: 62 },
};

export const CAMERA = {
  chase: { back: 13.2, up: 3.3, side: 1.5, lookAhead: 30, fov: 64, rollFollow: 0.46, lag: 5.4 },
  cockpit: { eye: [0, 1.16, -1.05], fov: 74, lag: 14 },
  far: 12000,
  near: 0.6,
};

/** The ring course and survey markers live in missions.js; these are the shared ring numbers. */
export const RING = {
  radius: 34,
  tube: 3.0,
  /** How far off the centre line still counts as through the ring. */
  passRadius: 32,
  score: 120,
};

/** Golden hour on the Alder Isles: warm horizon, deep sea, one light from the west. */
export const PALETTE = {
  skyZenith: [0.106, 0.196, 0.353],
  skyHorizon: [0.965, 0.741, 0.514],
  skyLow: [0.812, 0.588, 0.435],
  sun: [1.0, 0.945, 0.78],
  sunGlow: [1.0, 0.741, 0.412],
  fog: [0.859, 0.706, 0.573],
  seaDeep: [0.043, 0.169, 0.243],
  seaShallow: [0.153, 0.451, 0.514],
  seaFoam: [0.847, 0.918, 0.914],
  sand: [0.847, 0.780, 0.596],
  grass: [0.318, 0.435, 0.271],
  grassDry: [0.443, 0.475, 0.286],
  forest: [0.157, 0.278, 0.204],
  rock: [0.365, 0.353, 0.333],
  peak: [0.792, 0.804, 0.792],
  runway: [0.243, 0.239, 0.247],
  runwayMark: [0.925, 0.914, 0.882],
  hud: [0.494, 0.878, 0.925],
  hudDim: [0.494, 0.878, 0.925, 0.42],
  hudWarn: [1.0, 0.741, 0.318],
  hudAlarm: [1.0, 0.353, 0.318],
  hudGood: [0.529, 0.925, 0.612],
  panel: '#0b1016',
  panelGlass: 'rgba(10, 18, 24, 0.72)',
  text: '#e8f1f4',
  muted: '#8fa6ad',
  mutedRgb: [0.561, 0.651, 0.678],
};

export const FONT = '"Inter", "Helvetica Neue", system-ui, -apple-system, "Segoe UI", sans-serif';
export const MONO = '"JetBrains Mono", "SF Mono", ui-monospace, Menlo, Consolas, monospace';

/** Where the best sortie score is kept between visits (this browser only). */
export const BEST_KEY = 'kestrel-sky.best';
export const SEEN_KEY = 'kestrel-sky.seen';
