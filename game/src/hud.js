// The head-up display: airspeed and altitude tapes, the compass ribbon, the gate marker, the
// mission card and the warnings. Everything is drawn on a 2D canvas over the world, laid out in a
// fixed 1280x720 frame so the same display scales to any window.
import { AIRCRAFT, PALETTE, FONT, MONO } from './config.js';

const KT = 1.94384;
const FT = 3.28084;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function rgba(colour, alpha) {
  if (typeof colour === 'string') {
    if (colour[0] !== '#') return colour;
    const hex = colour.slice(1);
    const r = Number.parseInt(hex.slice(0, 2), 16);
    const g = Number.parseInt(hex.slice(2, 4), 16);
    const b = Number.parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return `rgba(${Math.round(colour[0] * 255)}, ${Math.round(colour[1] * 255)}, ${Math.round(colour[2] * 255)}, ${alpha})`;
}

function glow(ctx, colour, blur) {
  ctx.shadowColor = colour;
  ctx.shadowBlur = blur;
}

export function createHud(canvas) {
  const ctx = canvas.getContext('2d');

  function resize(width, height, ratio) {
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }

  function label(str, x, y, options = {}) {
    const {
      size = 13,
      colour = PALETTE.text,
      align = 'left',
      weight = 600,
      mono = false,
      alpha = 1,
      baseline = 'alphabetic',
      letter = 0.5,
    } = options;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = colour;
    ctx.font = `${weight} ${size}px ${mono ? MONO : FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    if (letter) ctx.letterSpacing = `${letter}px`;
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  /** A vertical tape: ticks at `step`, the current value in a box at the reading line. */
  function tape(x, centreY, height, value, step, majorEvery, options) {
    const { align = 'left', colour = PALETTE.hud, title, warn } = options;
    const pixelsPerUnit = options.pixelsPerUnit ?? 2.1;
    const top = centreY - height / 2;
    ctx.save();
    ctx.strokeStyle = rgba(colour, 0.55);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, top + height);
    ctx.stroke();

    ctx.font = `500 12px ${MONO}`;
    ctx.fillStyle = rgba(colour, 0.78);
    ctx.textBaseline = 'middle';
    ctx.textAlign = align === 'left' ? 'right' : 'left';
    const direction = align === 'left' ? -1 : 1;

    const rangeUnits = height / pixelsPerUnit;
    const startTick = Math.floor((value - rangeUnits / 2) / step) * step;
    for (let tick = startTick; tick <= value + rangeUnits / 2; tick += step) {
      const dy = (value - tick) * pixelsPerUnit;
      if (Math.abs(dy) > height / 2) continue;
      const major = Math.abs(tick % majorEvery) < 1e-6;
      const length = major ? 11 : 5;
      ctx.strokeStyle = rgba(colour, major ? 0.7 : 0.36);
      ctx.beginPath();
      ctx.moveTo(x, centreY - dy);
      ctx.lineTo(x + direction * length, centreY - dy);
      ctx.stroke();
      if (major) {
        ctx.fillStyle = rgba(colour, 0.72);
        ctx.fillText(String(Math.round(tick)), x + direction * (length + 5), centreY - dy);
      }
    }

    // The value box, straddling the tape at the reading line.
    const boxW = 62;
    const boxH = 26;
    const boxX = align === 'left' ? x - 4 : x - boxW + 4;
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = 'rgba(6, 14, 20, 0.86)';
    roundRect(ctx, boxX, centreY - boxH / 2, boxW, boxH, 3);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = rgba(warn ? PALETTE.hudAlarm : colour, 0.9);
    ctx.lineWidth = 1.4;
    roundRect(ctx, boxX, centreY - boxH / 2, boxW, boxH, 3);
    ctx.stroke();

    glow(ctx, rgba(colour, 0.9), 10);
    ctx.fillStyle = warn ? rgba(PALETTE.hudAlarm, 1) : rgba(colour, 1);
    ctx.font = `600 19px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.fillText(String(Math.round(value)), boxX + boxW / 2, centreY + 1);
    ctx.restore();

    label(title, x, top - 14, {
      size: 10, colour: rgba(colour, 0.6), align: 'center', weight: 700, letter: 1.6,
    });
  }

  function compass(x, y, width, heading, nextRing) {
    const deg = ((heading * 180) / Math.PI + 360) % 360;
    const half = 52;
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = 'rgba(6, 14, 20, 0.7)';
    roundRect(ctx, x - width / 2, y - 15, width, 30, 4);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.rect(x - width / 2 + 2, y - 16, width - 4, 32);
    ctx.clip();
    const pxPerDeg = width / (half * 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const start = Math.ceil((deg - half) / 5) * 5;
    for (let d = start; d <= deg + half; d += 5) {
      const dx = (d - deg) * pxPerDeg;
      const norm = ((d % 360) + 360) % 360;
      const major = norm % 30 === 0;
      ctx.strokeStyle = rgba(PALETTE.hud, major ? 0.7 : 0.3);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + dx, y + 15);
      ctx.lineTo(x + dx, y + (major ? 6 : 10));
      ctx.stroke();
      if (major) {
        const cardinals = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
        const text = cardinals[norm] ?? String(norm / 10).padStart(2, '0');
        ctx.fillStyle = rgba(cardinals[norm] ? PALETTE.text : PALETTE.hud, cardinals[norm] ? 0.95 : 0.7);
        ctx.font = `${cardinals[norm] ? '700 12px' : '500 11px'} ${cardinals[norm] ? FONT : MONO}`;
        ctx.fillText(text, x + dx, y - 6);
      }
    }
    if (nextRing) {
      const bearing = ((Math.atan2(nextRing.bearing[0], -nextRing.bearing[2]) * 180) / Math.PI + 360) % 360;
      let delta = bearing - deg;
      while (delta > 180) delta -= 360;
      while (delta < -180) delta += 360;
      if (Math.abs(delta) <= half) {
        const dx = delta * pxPerDeg;
        ctx.fillStyle = rgba(PALETTE.hudGood, 1);
        glow(ctx, rgba(PALETTE.hudGood, 1), 8);
        ctx.beginPath();
        ctx.moveTo(x + dx, y + 4);
        ctx.lineTo(x + dx - 5, y + 12);
        ctx.lineTo(x + dx + 5, y + 12);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();

    // The bug: a fixed caret at the centre, and the reading in degrees.
    ctx.fillStyle = rgba(PALETTE.hudGood, 1);
    ctx.beginPath();
    ctx.moveTo(x, y + 17);
    ctx.lineTo(x - 4, y + 24);
    ctx.lineTo(x + 4, y + 24);
    ctx.closePath();
    ctx.fill();
    label(`${Math.round(deg).toString().padStart(3, '0')}°`, x, y + 44, {
      size: 15, colour: rgba(PALETTE.hud, 0.95), align: 'center', weight: 600, mono: true,
    });
  }

  function gateMarker(projected, ring, index, total) {
    if (!projected || !projected.visible) return;
    const { x, y } = projected;
    const clampedX = Math.max(180, Math.min(1100, x));
    const clampedY = Math.max(90, Math.min(600, y));
    ctx.save();
    ctx.strokeStyle = rgba(PALETTE.hudGood, 0.95);
    ctx.lineWidth = 1.6;
    glow(ctx, rgba(PALETTE.hudGood, 0.9), 10);
    const r = 13;
    ctx.beginPath();
    ctx.moveTo(clampedX, clampedY - r);
    ctx.lineTo(clampedX + r, clampedY);
    ctx.lineTo(clampedX, clampedY + r);
    ctx.lineTo(clampedX - r, clampedY);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
    label(`${Math.round(ring.distance)} m`, clampedX, clampedY + 36, {
      size: 13, colour: rgba(PALETTE.hudGood, 0.98), align: 'center', weight: 700, mono: true,
    });
    label(`${ring.type === 'marker' ? 'MARKER' : 'GATE'} ${index + 1}/${total}`, clampedX, clampedY + 55, {
      size: 10, colour: rgba(PALETTE.hud, 0.85), align: 'center', weight: 700, letter: 1.4,
    });
  }

  function missionCard(run, mission, score) {
    const x = 44;
    const y = 44;
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = PALETTE.panelGlass;
    roundRect(ctx, x, y, 268, 92, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(126, 224, 236, 0.22)';
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, 268, 92, 6);
    ctx.stroke();
    ctx.restore();

    label(mission.code, x + 16, y + 24, { size: 10, colour: rgba(PALETTE.hud, 0.72), weight: 700, letter: 2 });
    label(mission.name, x + 16, y + 46, { size: 19, colour: PALETTE.text, weight: 700 });
    label('SCORE', x + 252, y + 24, { size: 9, colour: rgba(PALETTE.hud, 0.6), align: 'right', weight: 700, letter: 1.4 });
    label(String(Math.round(score)), x + 252, y + 58, { size: 15, colour: PALETTE.text, align: 'right', weight: 600, mono: true });

    const counted = run.ringsPassed;
    const total = mission.course ? mission.course.length : 0;
    label(total ? `${counted} / ${total}` : '—', x + 252, y + 40, {
      size: 15, colour: rgba(PALETTE.hudGood, 1), align: 'right', weight: 700, mono: true,
    });

    ctx.save();
    ctx.font = `500 11px ${FONT}`;
    let objective = mission.objective;
    while (objective.length > 6 && ctx.measureText(objective).width > 232) objective = objective.slice(0, -2);
    ctx.restore();
    label(objective, x + 16, y + 72, { size: 11, colour: rgba(PALETTE.text, 0.62), weight: 500 });
  }

  function clock(run) {
    const x = 640;
    const y = 128;
    if (run.timeLimit) {
      const left = Math.max(0, run.timeLimit - run.elapsed);
      const urgent = left < 30;
      label('TIME', x, y - 14, { size: 9, colour: rgba(PALETTE.hud, 0.6), align: 'center', weight: 700, letter: 2 });
      label(`${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`, x, y + 8, {
        size: 24, colour: urgent ? rgba(PALETTE.hudAlarm, 1) : rgba(PALETTE.text, 0.95), align: 'center', weight: 600, mono: true,
      });
    } else {
      label('NO CLOCK', x, y - 6, { size: 10, colour: rgba(PALETTE.hud, 0.55), align: 'center', weight: 700, letter: 2 });
    }
  }

  function bars(aircraft) {
    const x = 44;
    const y = 640;
    const width = 200;
    // Throttle.
    label('THR', x, y - 10, { size: 9, colour: rgba(PALETTE.hud, 0.6), weight: 700, letter: 1.4 });
    ctx.fillStyle = 'rgba(6, 14, 20, 0.65)';
    roundRect(ctx, x, y, width, 8, 2);
    ctx.fill();
    ctx.fillStyle = rgba(PALETTE.hud, 0.9);
    roundRect(ctx, x, y, width * aircraft.throttle, 8, 2);
    ctx.fill();
    label(`${Math.round(aircraft.throttle * 100)}%`, x + width + 10, y + 8, { size: 11, colour: rgba(PALETTE.text, 0.8), weight: 600, mono: true });

    // Fuel, amber when it is time to think about the ground.
    const fuelRatio = aircraft.fuel / AIRCRAFT.fuelCapacity;
    const low = fuelRatio < 0.16;
    label('FUEL', x, y + 30, { size: 9, colour: rgba(PALETTE.hud, 0.6), weight: 700, letter: 1.4 });
    ctx.fillStyle = 'rgba(6, 14, 20, 0.65)';
    roundRect(ctx, x, y + 40, width, 8, 2);
    ctx.fill();
    ctx.fillStyle = low ? rgba(PALETTE.hudAlarm, 0.95) : rgba(PALETTE.hudGood, 0.9);
    roundRect(ctx, x, y + 40, width * fuelRatio, 8, 2);
    ctx.fill();
    label(`${Math.round(fuelRatio * 100)}%`, x + width + 10, y + 48, {
      size: 11, colour: low ? rgba(PALETTE.hudAlarm, 1) : rgba(PALETTE.text, 0.8), weight: 600, mono: true,
    });

    // Gear and flap state, right of centre.
    const gx = 1036;
    const gearColour = aircraft.gear > 0.95 ? PALETTE.hudGood : aircraft.gear > 0.05 ? PALETTE.hudWarn : 'rgba(120,140,150,0.5)';
    for (let i = 0; i < 3; i += 1) {
      ctx.fillStyle = typeof gearColour === 'string' ? gearColour : rgba(gearColour, 1);
      ctx.beginPath();
      ctx.arc(gx + i * 18, y + 4, 4.6, 0, Math.PI * 2);
      ctx.fill();
    }
    label('GEAR', gx + 62, y + 9, { size: 9, colour: rgba(PALETTE.hud, 0.6), weight: 700, letter: 1.4 });

    const integrity = 1 - aircraft.damage;
    label('AIRFRAME', gx + 12, y + 30, { size: 9, colour: rgba(PALETTE.hud, 0.6), weight: 700, letter: 1.4 });
    ctx.fillStyle = 'rgba(6, 14, 20, 0.65)';
    roundRect(ctx, gx + 12, y + 40, 160, 8, 2);
    ctx.fill();
    ctx.fillStyle = integrity < 0.6 ? rgba(PALETTE.hudAlarm, 0.95) : rgba(PALETTE.hudGood, 0.85);
    roundRect(ctx, gx + 12, y + 40, 160 * integrity, 8, 2);
    ctx.fill();
    label(`${Math.round(integrity * 100)}%`, gx + 182, y + 48, { size: 11, colour: rgba(PALETTE.text, 0.8), weight: 600, mono: true });
  }

  function warningBanner(aircraft) {
    const list = [];
    if (aircraft.warnings.has('stall')) list.push(['STALL', PALETTE.hudAlarm]);
    else if (aircraft.warnings.has('overspeed')) list.push(['OVERSPEED', PALETTE.hudAlarm]);
    if (aircraft.warnings.has('pull-up')) list.push(['PULL UP', PALETTE.hudAlarm]);
    if (aircraft.warnings.has('fuel')) list.push(['FUEL LOW', PALETTE.hudWarn]);
    if (aircraft.warnings.has('gear')) list.push(['GEAR UP', PALETTE.hudWarn]);
    if (aircraft.warnings.has('damage')) list.push(['AIRFRAME DAMAGE', PALETTE.hudWarn]);
    if (!list.length) return;
    let y = 168;
    for (const [text, colour] of list) {
      ctx.save();
      glow(ctx, rgba(colour, 1), 14);
      label(text, 640, y, { size: 22, colour: rgba(colour, 1), align: 'center', weight: 700, letter: 3 });
      ctx.restore();
      y += 34;
    }
  }

  function reticle(aircraft, camera, flightPath) {
    const centre = camera.project(aircraft.pos);
    if (!centre.visible) return;
    ctx.save();
    ctx.strokeStyle = rgba(PALETTE.hud, 0.55);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(centre.x, centre.y, 5, 0, Math.PI * 2);
    ctx.stroke();
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(centre.x + side * 5, centre.y);
      ctx.lineTo(centre.x + side * 17, centre.y);
      ctx.stroke();
    }
    ctx.restore();

    if (flightPath && flightPath.visible) {
      ctx.save();
      ctx.strokeStyle = rgba(PALETTE.hudGood, 0.9);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(flightPath.x, flightPath.y, 6, 0, Math.PI * 2);
      ctx.moveTo(flightPath.x - 16, flightPath.y);
      ctx.lineTo(flightPath.x - 7, flightPath.y);
      ctx.moveTo(flightPath.x + 7, flightPath.y);
      ctx.lineTo(flightPath.x + 16, flightPath.y);
      ctx.moveTo(flightPath.x, flightPath.y - 7);
      ctx.lineTo(flightPath.x, flightPath.y - 13);
      ctx.stroke();
      ctx.restore();
    }
  }

  function draw({ aircraft, run, course, camera, mission, score, cameraMode, hint, minimal = false }) {
    const { width, height } = canvas.getBoundingClientRect();
    const scale = canvas.width / 1280;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, 1280, 720);

    missionCard(run, mission, score);
    clock(run);
    compass(640, 48, 420, aircraft.heading, course && course.nextIndex() < course.rings.length
      ? {
        bearing: [
          course.rings[course.nextIndex()].pos[0] - aircraft.pos[0],
          course.rings[course.nextIndex()].pos[1] - aircraft.pos[1],
          course.rings[course.nextIndex()].pos[2] - aircraft.pos[2],
        ],
      }
      : null);

    if (minimal) {
      warningBanner(aircraft);
      if (course && course.nextIndex() < course.rings.length) {
        const ring = course.rings[course.nextIndex()];
        gateMarker(camera.project(ring.pos), {
          ...ring,
          distance: Math.hypot(ring.pos[0] - aircraft.pos[0], ring.pos[1] - aircraft.pos[1], ring.pos[2] - aircraft.pos[2]),
        }, course.nextIndex(), course.rings.length);
      }
      return;
    }

    const speedKt = aircraft.speed * KT;
    const altitudeFt = Math.max(0, aircraft.agl) * FT;
    tape(96, 330, 250, speedKt, 10, 50, {
      align: 'left', colour: PALETTE.hud, title: 'KNOTS', pixelsPerUnit: 1.55,
      warn: aircraft.speed < AIRCRAFT.stallSpeed + 3 || aircraft.speed > AIRCRAFT.vne,
    });
    tape(1184, 330, 250, altitudeFt, 100, 500, {
      align: 'right', colour: PALETTE.hud, title: 'FEET', pixelsPerUnit: 0.20,
      warn: aircraft.agl < 55 && aircraft.sinkRate > 5,
    });

    // Vertical speed: a bar beside the altitude tape.
    const vs = -aircraft.sinkRate * 196.85;
    ctx.save();
    ctx.strokeStyle = rgba(PALETTE.hud, 0.4);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(1210, 205);
    ctx.lineTo(1210, 455);
    ctx.stroke();
    const vsClamped = Math.max(-20, Math.min(20, vs / 100));
    ctx.strokeStyle = rgba(vsClamped >= 0 ? PALETTE.hudGood : PALETTE.hudWarn, 0.95);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(1210, 330);
    ctx.lineTo(1210, 330 - vsClamped * 6);
    ctx.stroke();
    ctx.restore();
    label('VS', 1210, 197, { size: 9, colour: rgba(PALETTE.hud, 0.6), align: 'center', weight: 700, letter: 1.2 });

    const nextIndex = course ? course.nextIndex() : -1;
    if (course && nextIndex < course.rings.length) {
      const ring = course.rings[nextIndex];
      const projected = camera.project(ring.pos);
      gateMarker(projected, { ...ring, distance: Math.hypot(ring.pos[0] - aircraft.pos[0], ring.pos[1] - aircraft.pos[1], ring.pos[2] - aircraft.pos[2]) }, nextIndex, course.rings.length);
    }

    reticle(aircraft, camera, camera.project([
      aircraft.pos[0] + Math.sin(aircraft.heading) * Math.cos(aircraft.climb) * 240,
      aircraft.pos[1] + Math.sin(aircraft.climb) * 240,
      aircraft.pos[2] - Math.cos(aircraft.heading) * Math.cos(aircraft.climb) * 240,
    ]));

    bars(aircraft);
    warningBanner(aircraft);

    if (hint) {
      label(hint, 640, 690, { size: 11, colour: rgba(PALETTE.hud, 0.55), align: 'center', weight: 500, letter: 1.2 });
    }
  }

  return { draw, resize, ctx };
}
