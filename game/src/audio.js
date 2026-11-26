// The sound of the evening: an engine whose note follows the throttle, wind that rises with
// airspeed, a chime when a ring is flown, a thud on touchdown and a warning horn. Everything is
// synthesised in Web Audio from oscillators and one noise buffer, so the game loads no sound file.
let context = null;
let master = null;
let engine = null;
let wind = null;
let muted = false;

function noiseBuffer(ctx, seconds) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1;
    last = 0.97 * last + 0.03 * white;
    data[i] = last * 3.2;
  }
  return buffer;
}

export function createAudio() {
  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return context;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    context = new Ctx();
    master = context.createGain();
    master.gain.value = muted ? 0 : 0.55;
    master.connect(context.destination);

    // Engine: two detuned saw oscillators through a low-pass, with a slow amplitude wobble.
    const engineGain = context.createGain();
    engineGain.gain.value = 0;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 620;
    filter.Q.value = 3.2;
    const a = context.createOscillator();
    a.type = 'sawtooth';
    a.frequency.value = 78;
    const b = context.createOscillator();
    b.type = 'square';
    b.frequency.value = 39;
    const bGain = context.createGain();
    bGain.gain.value = 0.4;
    b.connect(bGain);
    bGain.connect(filter);
    a.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(master);
    a.start();
    b.start();
    engine = { gain: engineGain, filter, a, b };

    // Wind: filtered noise, louder the faster the aircraft goes.
    const source = context.createBufferSource();
    source.buffer = noiseBuffer(context, 2.4);
    source.loop = true;
    const windFilter = context.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 900;
    windFilter.Q.value = 0.7;
    const windGain = context.createGain();
    windGain.gain.value = 0;
    source.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(master);
    source.start();
    wind = { gain: windGain, filter: windFilter };
    return context;
  }

  function update({ throttle, speed, stall, onGround }) {
    if (!context || !engine) return;
    const note = 48 + throttle * 92 + speed * 0.42;
    engine.a.frequency.setTargetAtTime(note, context.currentTime, 0.08);
    engine.b.frequency.setTargetAtTime(note * 0.5, context.currentTime, 0.08);
    engine.filter.frequency.setTargetAtTime(420 + throttle * 900, context.currentTime, 0.12);
    engine.gain.gain.setTargetAtTime(onGround ? 0.05 + throttle * 0.06 : 0.055 + throttle * 0.075, context.currentTime, 0.1);
    wind.gain.gain.setTargetAtTime(Math.min(0.14, speed * speed * 0.000016), context.currentTime, 0.2);
    wind.filter.frequency.setTargetAtTime(500 + speed * 12, context.currentTime, 0.2);
  }

  function tone(frequency, duration, type, gainValue, slideTo) {
    if (!context || muted) return;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, context.currentTime + duration);
    gain.gain.value = gainValue;
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(context.currentTime + duration + 0.02);
  }

  return {
    ensure,
    update,
    ring() {
      tone(880, 0.20, 'sine', 0.20, 1320);
      setTimeout(() => tone(1320, 0.16, 'sine', 0.12), 70);
    },
    miss() {
      tone(300, 0.22, 'triangle', 0.14, 180);
    },
    touchdown(soft) {
      tone(soft ? 120 : 80, 0.34, 'triangle', soft ? 0.18 : 0.32, 40);
    },
    crash() {
      tone(150, 0.7, 'sawtooth', 0.3, 32);
    },
    warn() {
      tone(760, 0.13, 'square', 0.07, 700);
    },
    complete() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.28, 'sine', 0.16), i * 130));
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.setTargetAtTime(muted ? 0 : 0.55, context.currentTime, 0.05);
      return muted;
    },
    get muted() { return muted; },
  };
}
