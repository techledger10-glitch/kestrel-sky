// The stick: keyboard for the aircraft and a mouse for the same axes, so the game is flown with
// either. Axes are smoothed a little and centred by a small dead zone, which is most of what makes
// a light aircraft feel like it answers instead of twitching.
import { clamp, damp } from './mathx.js';

const KEYMAP = {
  pitch: { up: ['ArrowUp', 'KeyI'], down: ['ArrowDown', 'KeyK'] },
  roll: { left: ['ArrowLeft', 'KeyJ'], right: ['ArrowRight', 'KeyL'] },
  yaw: { left: ['KeyA'], right: ['KeyD'] },
  throttle: { up: ['KeyW', 'ShiftLeft', 'ShiftRight'], down: ['KeyS', 'ControlLeft'] },
};

export function createInput(canvas, onCommand) {
  const held = new Set();
  const stick = { x: 0, y: 0 };
  const smoothed = { pitch: 0, roll: 0, yaw: 0, throttle: 0 };
  let mouseSteering = false;
  let pointerDown = false;

  function handleKey(event, down) {
    const code = event.code;
    const commands = {
      KeyC: 'camera',
      KeyG: 'gear',
      KeyR: 'restart',
      KeyP: 'pause',
      Escape: 'pause',
      Enter: 'confirm',
      Space: 'confirm',
      KeyM: 'mute',
      KeyH: 'help',
      KeyF: 'flap',
    };
    if (down && commands[code]) {
      if (code === 'Space') held.add('Space');
      onCommand(commands[code], event);
      event.preventDefault();
      return;
    }
    if (code === 'Space') {
      if (down) held.add('Space');
      else held.delete('Space');
      event.preventDefault();
      return;
    }
    if (down) held.add(code);
    else held.delete(code);
    if (down && code.startsWith('Arrow')) event.preventDefault();
  }

  window.addEventListener('keydown', (event) => handleKey(event, true));
  window.addEventListener('keyup', (event) => handleKey(event, false));
  window.addEventListener('blur', () => held.clear());

  canvas.addEventListener('pointerdown', (event) => {
    pointerDown = true;
    mouseSteering = true;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointerup', (event) => {
    pointerDown = false;
    stick.x = 0;
    stick.y = 0;
    canvas.releasePointerCapture?.(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!mouseSteering) return;
    stick.x = clamp(stick.x + event.movementX * 0.0055, -1, 1);
    stick.y = clamp(stick.y + event.movementY * 0.0055, -1, 1);
    if (!pointerDown) {
      stick.x *= 0.9;
      stick.y *= 0.9;
    }
  });
  canvas.addEventListener('wheel', (event) => {
    smoothed.throttle = clamp(smoothed.throttle - Math.sign(event.deltaY) * 0.08, -1, 1);
    event.preventDefault();
  }, { passive: false });

  const isHeld = (codes) => codes.some((code) => held.has(code));

  /** Read the axes for this frame, smoothed over `dt` so a key press ramps rather than snaps. */
  function axes(dt) {
    const keyboardPitch = (isHeld(KEYMAP.pitch.up) ? 1 : 0) - (isHeld(KEYMAP.pitch.down) ? 1 : 0);
    const keyboardRoll = (isHeld(KEYMAP.roll.right) ? 1 : 0) - (isHeld(KEYMAP.roll.left) ? 1 : 0);
    const keyboardYaw = (isHeld(KEYMAP.yaw.right) ? 1 : 0) - (isHeld(KEYMAP.yaw.left) ? 1 : 0);
    const throttleAxis = (isHeld(KEYMAP.throttle.up) ? 1 : 0) - (isHeld(KEYMAP.throttle.down) ? 1 : 0);

    const targetPitch = clamp(keyboardPitch + stick.y * 0.9, -1, 1);
    const targetRoll = clamp(keyboardRoll + stick.x * 0.9, -1, 1);
    const targetYaw = keyboardYaw;

    smoothed.pitch = damp(smoothed.pitch, targetPitch, 0.075, dt);
    smoothed.roll = damp(smoothed.roll, targetRoll, 0.075, dt);
    smoothed.yaw = damp(smoothed.yaw, targetYaw, 0.09, dt);
    smoothed.throttle = damp(smoothed.throttle, throttleAxis, 0.05, dt);

    if (Math.abs(smoothed.pitch) < 0.02) smoothed.pitch = 0;
    if (Math.abs(smoothed.roll) < 0.02) smoothed.roll = 0;

    return {
      pitch: smoothed.pitch,
      roll: smoothed.roll,
      yaw: smoothed.yaw,
      throttleAxis: Math.abs(smoothed.throttle) < 0.05 ? 0 : smoothed.throttle,
      brake: held.has('Space'),
    };
  }

  return { axes, isHeld, held, stick, resetStick() { stick.x = 0; stick.y = 0; } };
}
