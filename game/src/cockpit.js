// The cockpit: canopy frame, glare shield and an instrument panel that is lit, because it is dusk.
// Six dials in the classic arrangement, an engine cluster to the right, and a radio stack with the
// field's frequency on it. Drawn on the overlay canvas, so it sits over the world like the real
// panel sits over the nose.
import { AIRCRAFT, PALETTE, FONT, MONO } from './config.js';

const KT = 1.94384;
const FT = 3.28084;

function dial(ctx, x, y, radius, options) {
  const { title = '', face = '#0e151a', tick = PALETTE.hud } = options;
  ctx.save();
  // Bezel.
  const bezel = ctx.createLinearGradient(x - radius, y - radius, x + radius, y + radius);
  bezel.addColorStop(0, '#3b4247');
  bezel.addColorStop(0.45, '#20262a');
  bezel.addColorStop(1, '#121719');
  ctx.fillStyle = bezel;
  ctx.beginPath();
  ctx.arc(x, y, radius + 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Face.
  const faceGrad = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.35, radius * 0.1, x, y, radius);
  faceGrad.addColorStop(0, '#162026');
  faceGrad.addColorStop(1, face);
  ctx.fillStyle = faceGrad;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  return { x, y, radius, tick };
}

function ticks(ctx, x, y, radius, count, inner, colour, alpha = 0.65) {
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = 1.2;
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2 - Math.PI / 2;
    const major = i % 5 === 0;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * radius * 0.96, y + Math.sin(a) * radius * 0.96);
    ctx.lineTo(x + Math.cos(a) * radius * (major ? inner - 0.14 : inner), y + Math.sin(a) * radius * (major ? inner - 0.14 : inner));
    ctx.stroke();
  }
  ctx.restore();
}

function needle(ctx, x, y, length, angle, colour, width = 2.4, tail = 0.22) {
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.shadowColor = colour;
  ctx.shadowBlur = 8;
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(-length * tail, 0);
  ctx.lineTo(length, 0);
  ctx.stroke();
  ctx.restore();
}

function plate(ctx, x, y, w, h, colour = 'rgba(6, 12, 15, 0.9)') {
  ctx.save();
  ctx.fillStyle = colour;
  ctx.beginPath();
  const r = 3;
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function createCockpit(canvas) {
  const ctx = canvas.getContext('2d');

  function canopy() {
    // A soft vignette and two slim pillars: enough to say "inside", never enough to hide the view.
    const vign = ctx.createRadialGradient(640, 300, 420, 640, 340, 980);
    vign.addColorStop(0, 'rgba(0,0,0,0)');
    vign.addColorStop(1, 'rgba(3,6,8,0.5)');
    ctx.fillStyle = vign;
    ctx.fillRect(0, 0, 1280, 720);

    ctx.save();
    const topBar = ctx.createLinearGradient(0, 0, 0, 30);
    topBar.addColorStop(0, 'rgba(6,10,13,0.9)');
    topBar.addColorStop(1, 'rgba(6,10,13,0)');
    ctx.fillStyle = topBar;
    ctx.fillRect(0, 0, 1280, 30);
    ctx.restore();
  }

  function panel(aircraft) {
    const top = 512;
    const grad = ctx.createLinearGradient(0, top, 0, 720);
    grad.addColorStop(0, '#161c1f');
    grad.addColorStop(0.12, '#1b2226');
    grad.addColorStop(1, '#0b0f11');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, top + 26);
    ctx.quadraticCurveTo(120, top - 8, 340, top);
    ctx.lineTo(940, top);
    ctx.quadraticCurveTo(1160, top - 8, 1280, top + 26);
    ctx.lineTo(1280, 720);
    ctx.lineTo(0, 720);
    ctx.closePath();
    ctx.fill();

    // Glare shield edge.
    ctx.strokeStyle = 'rgba(140, 160, 168, 0.25)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, top + 26);
    ctx.quadraticCurveTo(120, top - 8, 340, top);
    ctx.lineTo(940, top);
    ctx.quadraticCurveTo(1160, top - 8, 1280, top + 26);
    ctx.stroke();

    const cy = 606;
    // Airspeed.
    dial(ctx, 168, cy, 52, {});
    ticks(ctx, 168, cy, 52, 25, 0.86, PALETTE.hud);
    needle(ctx, 168, cy, 44, ((Math.min(aircraft.speed * KT, 200) / 200) * Math.PI * 2) - Math.PI / 2, PALETTE.hud, 2.6);
    ctx.save();
    ctx.fillStyle = rgbaText(PALETTE.hud, 0.9);
    ctx.font = `600 11px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.fillText(String(Math.round(aircraft.speed * KT)), 168, cy + 22);
    ctx.font = `700 9px ${FONT}`;
    ctx.fillText('KNOTS', 168, cy + 38);
    ctx.restore();

    // Attitude: sky over ground, rolled and pitched with the aircraft. The face is drawn first so
    // the horizon ball sits inside it, not under it.
    const adiX = 300;
    dial(ctx, adiX, cy, 52, { face: '#0a0f12' });
    ctx.save();
    ctx.beginPath();
    ctx.arc(adiX, cy, 48, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(adiX, cy);
    ctx.rotate(-aircraft.bank);
    const pitch = (aircraft.climb * 180) / Math.PI;
    ctx.translate(0, pitch * 1.6);
    ctx.fillStyle = '#1d4a68';
    ctx.fillRect(-140, -220, 280, 220);
    ctx.fillStyle = '#5b4632';
    ctx.fillRect(-140, 0, 280, 220);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-140, 0);
    ctx.lineTo(140, 0);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.32)';
    ctx.lineWidth = 1;
    for (let p = -20; p <= 20; p += 5) {
      if (p === 0) continue;
      const y = -p * 1.6;
      const w = p % 10 === 0 ? 28 : 14;
      ctx.beginPath();
      ctx.moveTo(-w, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.restore();

    // Fixed aircraft symbol over the ball.
    ctx.save();
    ctx.strokeStyle = PALETTE.hudWarn;
    ctx.lineWidth = 2.6;
    ctx.shadowColor = PALETTE.hudWarn;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(adiX - 26, cy);
    ctx.lineTo(adiX - 10, cy);
    ctx.moveTo(adiX + 10, cy);
    ctx.lineTo(adiX + 26, cy);
    ctx.moveTo(adiX - 4, cy);
    ctx.lineTo(adiX + 4, cy);
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.fillStyle = rgbaText(PALETTE.hud, 0.8);
    ctx.font = `700 9px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('ATTITUDE', adiX, cy + 44);
    ctx.restore();

    // Altimeter: two hands, hundreds and thousands of feet.
    const altX = 432;
    dial(ctx, altX, cy, 52, {});
    ticks(ctx, altX, cy, 52, 50, 0.86, PALETTE.hud, 0.5);
    const feet = Math.max(0, aircraft.agl) * FT;
    needle(ctx, altX, cy, 42, ((feet % 1000) / 1000) * Math.PI * 2 - Math.PI / 2, PALETTE.hud, 2.2, 0.1);
    needle(ctx, altX, cy, 26, ((feet % 10000) / 10000) * Math.PI * 2 - Math.PI / 2, PALETTE.hudGood, 2.6, 0.12);
    ctx.save();
    ctx.fillStyle = rgbaText(PALETTE.hud, 0.9);
    ctx.font = `600 11px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.fillText(String(Math.round(feet / 10) * 10), altX, cy + 22);
    ctx.font = `700 9px ${FONT}`;
    ctx.fillText('FEET AGL', altX, cy + 38);
    ctx.restore();

    // Turn coordinator.
    const turnX = 564;
    dial(ctx, turnX, cy, 44, {});
    ticks(ctx, turnX, cy, 44, 12, 0.9, PALETTE.hud, 0.4);
    needle(ctx, turnX, cy, 34, -Math.PI / 2 + Math.max(-1, Math.min(1, Math.tan(aircraft.bank) * 2)) * 0.5, PALETTE.hud, 2.4);
    ctx.save();
    ctx.fillStyle = rgbaText(PALETTE.hud, 0.8);
    ctx.font = `700 9px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('TURN', turnX, cy + 36);
    ctx.restore();

    // Heading card.
    const hdgX = 690;
    dial(ctx, hdgX, cy, 52, { face: '#0a0f12' });
    ctx.save();
    ctx.translate(hdgX, cy);
    ctx.rotate(aircraft.heading);
    for (let i = 0; i < 36; i += 1) {
      const a = (i / 36) * Math.PI * 2;
      const major = i % 3 === 0;
      ctx.strokeStyle = rgbaText(PALETTE.hud, major ? 0.85 : 0.4);
      ctx.lineWidth = major ? 1.6 : 1;
      ctx.beginPath();
      ctx.moveTo(Math.sin(a) * 50, -Math.cos(a) * 50);
      ctx.lineTo(Math.sin(a) * (major ? 40 : 45), -Math.cos(a) * (major ? 40 : 45));
      ctx.stroke();
      if (major) {
        ctx.save();
        ctx.fillStyle = rgbaText(PALETTE.hud, 0.85);
        ctx.font = `600 9px ${MONO}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const label = ['N', '3', '6', 'E', '12', '15', 'S', '21', '24', 'W', '30', '33'][i / 3];
        ctx.translate(Math.sin(a) * 32, -Math.cos(a) * 32);
        ctx.rotate(-aircraft.heading);
        ctx.fillText(String(label), 0, 0);
        ctx.restore();
      }
    }
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = PALETTE.hudWarn;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hdgX, cy - 58);
    ctx.lineTo(hdgX - 5, cy - 48);
    ctx.lineTo(hdgX + 5, cy - 48);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = rgbaText(PALETTE.hud, 0.9);
    ctx.font = `600 11px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(((aircraft.heading * 180) / Math.PI + 360) % 360).toString().padStart(3, '0')}°`, hdgX, cy + 30);
    ctx.font = `700 9px ${FONT}`;
    ctx.fillText('HEADING', hdgX, cy + 42);
    ctx.restore();

    // Vertical speed.
    const vsX = 816;
    dial(ctx, vsX, cy, 44, {});
    ticks(ctx, vsX, cy, 44, 11, 0.9, PALETTE.hud, 0.45);
    const vs = -aircraft.sinkRate * 196.85;
    needle(ctx, vsX, cy, 34, Math.max(-1, Math.min(1, vs / 1500)) * Math.PI * 0.62 - Math.PI / 2, PALETTE.hudGood, 2.4);
    ctx.save();
    ctx.fillStyle = rgbaText(PALETTE.hud, 0.8);
    ctx.font = `700 9px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('CLIMB', vsX, cy + 36);
    ctx.restore();

    // Engine cluster: RPM and fuel, with the throttle position.
    const engX = 944;
    dial(ctx, engX, cy - 6, 40, {});
    const rpm = 0.24 + aircraft.throttle * 0.76;
    needle(ctx, engX, cy - 6, 30, rpm * Math.PI * 2 * 0.82 - Math.PI * 0.9, PALETTE.hudWarn, 2.2);
    ctx.save();
    ctx.strokeStyle = rgbaText(PALETTE.hudAlarm, 0.75);
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(engX, cy - 6, 32, -Math.PI * 0.42, -Math.PI * 0.12);
    ctx.stroke();
    ctx.fillStyle = rgbaText(PALETTE.hud, 0.85);
    ctx.font = `600 10px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(rpm * 2700)}`, engX, cy + 24);
    ctx.font = `700 9px ${FONT}`;
    ctx.fillText('RPM', engX, cy + 38);
    ctx.restore();

    // Fuel gauge, a small arc with a needle that lives in the red at the end of a sortie.
    const fuelX = 1042;
    dial(ctx, fuelX, cy - 6, 40, {});
    const fuelRatio = aircraft.fuel / AIRCRAFT.fuelCapacity;
    const start = Math.PI * 0.75;
    const sweep = Math.PI * 1.5;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(120, 140, 148, 0.35)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(fuelX, cy - 6, 30, start, start + sweep);
    ctx.stroke();
    ctx.strokeStyle = fuelRatio < 0.16 ? rgbaText(PALETTE.hudAlarm, 1) : rgbaText(PALETTE.hudGood, 0.95);
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(fuelX, cy - 6, 30, start, start + sweep * fuelRatio);
    ctx.stroke();
    ctx.fillStyle = rgbaText(PALETTE.hud, 0.85);
    ctx.font = `600 10px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(fuelRatio * 100)}%`, fuelX, cy + 24);
    ctx.font = `700 9px ${FONT}`;
    ctx.fillText('FUEL', fuelX, cy + 38);
    ctx.restore();

    // Radio stack: two boxes with lit digits, one carrying the field's frequency.
    plate(ctx, 1096, cy - 54, 132, 42);
    ctx.save();
    ctx.fillStyle = rgbaText(PALETTE.hudGood, 0.95);
    ctx.font = `600 15px ${MONO}`;
    ctx.textAlign = 'left';
    ctx.shadowColor = rgbaText(PALETTE.hudGood, 1);
    ctx.shadowBlur = 10;
    ctx.fillText('122.80', 1106, cy - 26);
    ctx.font = `700 8px ${FONT}`;
    ctx.fillStyle = rgbaText(PALETTE.hud, 0.6);
    ctx.shadowBlur = 0;
    ctx.fillText('CARROW INFO', 1106, cy - 16);
    ctx.restore();
    plate(ctx, 1096, cy + 0, 132, 34);
    labelSmall(ctx, 'XPDR 7000  ALT OFF', 1106, cy + 22, PALETTE.hudWarn);
    plate(ctx, 1096, cy + 44, 132, 34);
    labelSmall(ctx, aircraft.gear > 0.95 ? 'GEAR  DOWN 3 GREEN' : aircraft.gear > 0.05 ? 'GEAR  IN TRANSIT' : 'GEAR  UP', 1106, cy + 66,
      aircraft.gear > 0.95 ? PALETTE.hudGood : aircraft.gear > 0.05 ? PALETTE.hudWarn : PALETTE.muted);
  }

  function labelSmall(ctx2, text, x, y, colour) {
    ctx2.save();
    ctx2.fillStyle = typeof colour === 'string' ? colour : rgbaText(colour, 1);
    ctx2.font = `600 10px ${MONO}`;
    ctx2.textAlign = 'left';
    ctx2.fillText(text, x, y);
    ctx2.restore();
  }

  function draw(aircraft) {
    const scale = canvas.width / 1280;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, 1280, 720);
    canopy();
    panel(aircraft);
  }

  return { draw };
}

function rgbaText(colour, alpha) {
  if (typeof colour === 'string') {
    if (colour[0] !== '#') return colour;
    const hex = colour.slice(1);
    return `rgba(${Number.parseInt(hex.slice(0, 2), 16)}, ${Number.parseInt(hex.slice(2, 4), 16)}, ${Number.parseInt(hex.slice(4, 6), 16)}, ${alpha})`;
  }
  return `rgba(${Math.round(colour[0] * 255)}, ${Math.round(colour[1] * 255)}, ${Math.round(colour[2] * 255)}, ${alpha})`;
}

export { rgbaText };
