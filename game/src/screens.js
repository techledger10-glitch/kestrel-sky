// The boards around the flying: the title, the briefing, the pause card and the debrief. They are
// drawn on the same overlay canvas as the HUD, in the same palette and type, so the game reads as
// one piece of kit from the first screen to the last.
import { PALETTE, FONT, MONO } from './config.js';

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

function panel(ctx, x, y, w, h, alpha = 0.82) {
  ctx.save();
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, `rgba(12, 20, 26, ${alpha})`);
  grad.addColorStop(1, `rgba(6, 11, 14, ${alpha + 0.06})`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  const r = 8;
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(126, 224, 236, 0.18)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function text(ctx, str, x, y, size, colour, options = {}) {
  const { align = 'left', weight = 500, mono = false, alpha = 1, letter = 0, baseline = 'alphabetic' } = options;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = typeof colour === 'string' ? colour : rgba(colour, 1);
  ctx.font = `${weight} ${size}px ${mono ? MONO : FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  if (letter) ctx.letterSpacing = `${letter}px`;
  ctx.fillText(str, x, y);
  ctx.restore();
}

function scrim(ctx, alpha = 0.55) {
  const grad = ctx.createLinearGradient(0, 0, 0, 720);
  grad.addColorStop(0, `rgba(4, 9, 13, ${alpha + 0.2})`);
  grad.addColorStop(0.5, `rgba(4, 9, 13, ${alpha})`);
  grad.addColorStop(1, `rgba(4, 9, 13, ${alpha + 0.25})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1280, 720);
}

export function drawTitle(ctx, state) {
  const { missions, selected, best } = state;
  ctx.clearRect(0, 0, 1280, 720);
  scrim(ctx, 0.48);

  // Title block, left.
  text(ctx, 'ALDER ISLES  ·  18:40 LOCAL', 96, 178, 11, rgba(PALETTE.hud, 0.8), { weight: 700, letter: 3 });
  ctx.save();
  ctx.shadowColor = 'rgba(255, 189, 81, 0.35)';
  ctx.shadowBlur = 40;
  text(ctx, 'KESTREL', 92, 284, 96, '#f2f6f7', { weight: 800, letter: -2 });
  text(ctx, 'SKY', 92, 362, 96, rgba(PALETTE.hudWarn, 1), { weight: 800, letter: -2 });
  ctx.restore();
  text(ctx, 'A low-poly flight game of gates, survey passes and one long evening.', 96, 404, 15, rgba(PALETTE.text, 0.72), { weight: 400 });
  text(ctx, 'Fly the Alder Isles with throttle and turn discipline: every gate, every pass and', 96, 428, 13, rgba(PALETTE.text, 0.5), { weight: 400 });
  text(ctx, 'every landing is graded on how you flew it, not on how fast you got there.', 96, 448, 13, rgba(PALETTE.text, 0.5), { weight: 400 });

  // Sortie list, right.
  panel(ctx, 700, 150, 484, 372, 0.78);
  text(ctx, 'CHOOSE A SORTIE', 728, 186, 10, rgba(PALETTE.hud, 0.75), { weight: 700, letter: 2.4 });
  missions.forEach((mission, index) => {
    const y = 226 + index * 76;
    const active = index === selected;
    if (active) {
      ctx.save();
      ctx.fillStyle = 'rgba(126, 224, 236, 0.09)';
      ctx.fillRect(712, y - 30, 460, 62);
      ctx.fillStyle = rgba(PALETTE.hudGood, 1);
      ctx.fillRect(712, y - 30, 3, 62);
      ctx.restore();
    }
    text(ctx, mission.code, 730, y - 12, 9, active ? rgba(PALETTE.hudGood, 0.9) : rgba(PALETTE.hud, 0.45), { weight: 700, letter: 1.8 });
    text(ctx, mission.name, 730, y + 10, 21, active ? '#f2f6f7' : rgba(PALETTE.text, 0.62), { weight: 700 });
    text(ctx, mission.tagline, 730, y + 27, 11, active ? rgba(PALETTE.text, 0.62) : rgba(PALETTE.text, 0.32), { weight: 400 });
    if (active) {
      text(ctx, 'ENTER', 1150, y + 4, 10, rgba(PALETTE.hudGood, 0.95), { align: 'right', weight: 700, letter: 1.6 });
      text(ctx, '▶', 1166, y + 5, 11, rgba(PALETTE.hudGood, 0.95), { align: 'right' });
    }
  });
  if (best > 0) {
    text(ctx, `BEST SORTIE  ${best}`, 728, 492, 11, rgba(PALETTE.hudWarn, 0.85), { weight: 700, letter: 1.6 });
  }

  // Controls bar.
  panel(ctx, 92, 520, 500, 128, 0.7);
  text(ctx, 'CONTROLS', 116, 550, 9, rgba(PALETTE.hud, 0.62), { weight: 700, letter: 2 });
  const rows = [
    ['↑ ↓', 'Pitch / elevator'],
    ['← →', 'Roll / aileron'],
    ['A D', 'Rudder'],
    ['W S', 'Throttle'],
    ['SPACE', 'Wheel brakes'],
  ];
  rows.forEach(([key, action], i) => {
    text(ctx, key, 116, 578 + i * 16, 11, rgba(PALETTE.hud, 0.9), { weight: 600, mono: true });
    text(ctx, action, 176, 578 + i * 16, 11, rgba(PALETTE.text, 0.55), { weight: 400 });
  });
  const rows2 = [
    ['C', 'Chase / cockpit'],
    ['G', 'Landing gear'],
    ['P', 'Pause'],
    ['R', 'Restart sortie'],
    ['M', 'Sound on / off'],
  ];
  rows2.forEach(([key, action], i) => {
    text(ctx, key, 330, 578 + i * 16, 11, rgba(PALETTE.hud, 0.9), { weight: 600, mono: true });
    text(ctx, action, 372, 578 + i * 16, 11, rgba(PALETTE.text, 0.55), { weight: 400 });
  });
  text(ctx, 'Mouse: hold and move to fly · wheel for throttle', 116, 672, 11, rgba(PALETTE.text, 0.42), { weight: 400 });

  text(ctx, 'PRESS ENTER TO FLY', 640, 700, 12, rgba(PALETTE.hudGood, 0.9), { align: 'center', weight: 700, letter: 3 });
}

export function drawBrief(ctx, mission) {
  ctx.clearRect(0, 0, 1280, 720);
  scrim(ctx, 0.72);
  panel(ctx, 300, 168, 680, 384, 0.9);
  text(ctx, mission.code, 336, 216, 10, rgba(PALETTE.hudGood, 0.9), { weight: 700, letter: 2.6 });
  text(ctx, mission.name, 336, 262, 44, '#f2f6f7', { weight: 800 });
  text(ctx, mission.objective.toUpperCase(), 336, 292, 11, rgba(PALETTE.hudWarn, 0.95), { weight: 700, letter: 1.8 });
  mission.brief.forEach((line, i) => {
    text(ctx, line, 336, 340 + i * 24, 14, rgba(PALETTE.text, 0.68), { weight: 400 });
  });
  panel(ctx, 336, 430, 608, 52, 0.5);
  text(ctx, 'TIP', 352, 452, 9, rgba(PALETTE.hud, 0.6), { weight: 700, letter: 2 });
  text(ctx, mission.tip, 352, 470, 12, rgba(PALETTE.text, 0.72), { weight: 400 });
  const clock = mission.timeLimit ? `${Math.floor(mission.timeLimit / 60)}:${String(mission.timeLimit % 60).padStart(2, '0')} of light` : 'no clock';
  text(ctx, clock, 1000, 216, 11, rgba(PALETTE.text, 0.5), { align: 'right', weight: 500 });
  text(ctx, 'PRESS ENTER TO LAUNCH', 640, 528, 12, rgba(PALETTE.hudGood, 0.95), { align: 'center', weight: 700, letter: 2.4 });
}

export function drawDebrief(ctx, state) {
  const { mission, run, breakdown, grade, best, isBest } = state;
  ctx.clearRect(0, 0, 1280, 720);
  scrim(ctx, 0.72);
  panel(ctx, 250, 120, 780, 500, 0.92);

  const won = run.objectiveMet ?? (run.status === 'complete' || run.status === 'landed');
  text(ctx, mission.code, 290, 166, 10, rgba(PALETTE.hud, 0.6), { weight: 700, letter: 2.6 });
  text(ctx, won ? 'SORTIE COMPLETE' : run.status === 'timeout' ? 'LIGHT GONE' : run.status === 'missed' ? 'SORTIE INCOMPLETE' : 'SORTIE LOST', 290, 200, 30,
    won ? '#f2f6f7' : rgba(PALETTE.hudAlarm, 1), { weight: 800, letter: -0.5 });
  text(ctx, mission.name, 290, 226, 13, rgba(PALETTE.text, 0.55), { weight: 500 });
  if (run.reason) text(ctx, run.reason, 290, 248, 12, rgba(PALETTE.text, 0.42), { weight: 400 });

  // Grade badge.
  ctx.save();
  const badgeX = 940;
  const badgeY = 196;
  ctx.strokeStyle = won ? rgba(PALETTE.hudGood, 0.9) : rgba(PALETTE.hudAlarm, 0.8);
  ctx.lineWidth = 2;
  ctx.shadowColor = ctx.strokeStyle;
  ctx.shadowBlur = 24;
  ctx.beginPath();
  ctx.arc(badgeX, badgeY, 46, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  text(ctx, grade, badgeX, badgeY + 18, 52, won ? rgba(PALETTE.hudGood, 1) : rgba(PALETTE.hudAlarm, 1), { align: 'center', weight: 800 });
  text(ctx, 'GRADE', badgeX, badgeY + 66, 9, rgba(PALETTE.hud, 0.55), { align: 'center', weight: 700, letter: 2 });

  // Score table.
  const rows = [
    ['Gates flown', `${run.ringsPassed} / ${mission.course ? mission.course.length : 0}`, `+${breakdown.gates}`],
    ['Accuracy bonus', `${run.markers.length} passes`, `+${breakdown.bonus}`],
    ['Landing', run.landing ? run.landing.grade : '—', `+${breakdown.landing}`],
    ['Time in hand', `${Math.max(0, Math.round((run.timeLimit ?? 0) - run.elapsed))} s`, `+${breakdown.time}`],
    ['Airframe', `${Math.round((1 - (run.damage ?? 0)) * 100)}%`, breakdown.penalty ? `-${breakdown.penalty}` : '0'],
  ];
  rows.forEach(([label, mid, value], i) => {
    const y = 300 + i * 34;
    text(ctx, label, 290, y, 13, rgba(PALETTE.text, 0.62), { weight: 500 });
    text(ctx, mid, 560, y, 12, rgba(PALETTE.text, 0.45), { weight: 400, mono: true });
    text(ctx, value, 760, y, 13, rgba(PALETTE.text, 0.8), { align: 'right', weight: 600, mono: true });
    ctx.save();
    ctx.strokeStyle = 'rgba(126, 224, 236, 0.1)';
    ctx.beginPath();
    ctx.moveTo(290, y + 12);
    ctx.lineTo(760, y + 12);
    ctx.stroke();
    ctx.restore();
  });

  text(ctx, 'SCORE', 290, 496, 11, rgba(PALETTE.hud, 0.6), { weight: 700, letter: 2.4 });
  text(ctx, String(breakdown.total), 400, 512, 46, '#f2f6f7', { weight: 800, mono: true });
  if (isBest) text(ctx, 'NEW BEST', 560, 500, 11, rgba(PALETTE.hudWarn, 1), { weight: 700, letter: 2 });
  else text(ctx, `BEST  ${best}`, 560, 500, 11, rgba(PALETTE.text, 0.42), { weight: 600, letter: 1.4 });

  text(ctx, 'ENTER  fly again', 990, 494, 12, rgba(PALETTE.hudGood, 0.9), { align: 'right', weight: 600 });
  text(ctx, 'M  choose another sortie', 990, 516, 12, rgba(PALETTE.text, 0.5), { align: 'right', weight: 500 });
}

export function drawPaused(ctx) {
  scrim(ctx, 0.6);
  panel(ctx, 440, 280, 400, 150, 0.9);
  text(ctx, 'PAUSED', 640, 340, 34, '#f2f6f7', { align: 'center', weight: 800, letter: 4 });
  text(ctx, 'P or ESC to resume', 640, 374, 12, rgba(PALETTE.text, 0.55), { align: 'center', weight: 500 });
  text(ctx, 'R to restart the sortie', 640, 396, 12, rgba(PALETTE.text, 0.4), { align: 'center', weight: 500 });
}

export function drawCrashFlash(ctx, amount) {
  if (amount <= 0) return;
  ctx.save();
  ctx.fillStyle = `rgba(120, 20, 10, ${Math.min(0.55, amount * 0.55)})`;
  ctx.fillRect(0, 0, 1280, 720);
  ctx.restore();
}
