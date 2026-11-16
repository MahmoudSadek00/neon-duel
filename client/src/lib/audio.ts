/**
 * All sound is synthesised with the Web Audio API — zero audio files to download.
 * The ambient pad is a few oscillators through a low-pass filter (very low CPU).
 */
export interface AudioSettings { master: number; sfx: number; music: number; muted: boolean }

let ctx: AudioContext | null = null;
let masterGain: GainNode, sfxGain: GainNode, musicGain: GainNode;
let ambientNodes: AudioNode[] = [];
let settings: AudioSettings = { master: 0.8, sfx: 0.8, music: 0.35, muted: false };

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  masterGain = ctx.createGain();
  sfxGain = ctx.createGain();
  musicGain = ctx.createGain();
  sfxGain.connect(masterGain);
  musicGain.connect(masterGain);
  masterGain.connect(ctx.destination);
  apply();
  return ctx;
}

function apply() {
  if (!ctx) return;
  const t = ctx.currentTime;
  masterGain.gain.setTargetAtTime(settings.muted ? 0 : settings.master, t, 0.05);
  sfxGain.gain.setTargetAtTime(settings.sfx, t, 0.05);
  musicGain.gain.setTargetAtTime(settings.music * 0.5, t, 0.3);
  if (settings.music > 0 && !settings.muted) startAmbient();
  else stopAmbient();
}

export function setAudioSettings(s: AudioSettings) {
  settings = s;
  apply();
}

/** Must be called from a user gesture (browsers block audio before that). */
export function unlockAudio() {
  const c = ensure();
  if (c && c.state === 'suspended') c.resume();
  apply();
}

function tone(freq: number, dur: number, opts: { type?: OscillatorType; gain?: number; delay?: number; slideTo?: number } = {}) {
  const c = ensure();
  if (!c || settings.muted || settings.sfx === 0) return;
  const t0 = c.currentTime + (opts.delay ?? 0);
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = opts.type ?? 'sine';
  o.frequency.setValueAtTime(freq, t0);
  if (opts.slideTo) o.frequency.exponentialRampToValueAtTime(opts.slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.18, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(sfxGain);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

export const sfx = {
  click: () => tone(1320, 0.06, { type: 'triangle', gain: 0.08 }),
  digit: (d: number) => tone(520 + d * 55, 0.09, { type: 'sine', gain: 0.12 }),
  erase: () => tone(300, 0.08, { type: 'triangle', gain: 0.08, slideTo: 220 }),
  submit: () => { tone(400, 0.25, { type: 'sawtooth', gain: 0.05, slideTo: 1200 }); tone(1200, 0.15, { delay: 0.22, gain: 0.08 }); },
  lock: () => { tone(660, 0.12, { gain: 0.12 }); tone(990, 0.22, { delay: 0.1, gain: 0.12 }); },
  feedback: (n: number) => {
    if (n === 0) { tone(260, 0.3, { type: 'triangle', gain: 0.12, slideTo: 190 }); return; }
    const notes = [523, 659, 784];
    for (let i = 0; i < n; i++) tone(notes[i], 0.22, { delay: i * 0.11, gain: 0.13 });
  },
  turn: () => { tone(740, 0.12, { gain: 0.09 }); tone(1110, 0.18, { delay: 0.1, gain: 0.08 }); },
  tick: () => tone(1800, 0.035, { type: 'square', gain: 0.03 }),
  join: () => { tone(587, 0.15, { gain: 0.1 }); tone(880, 0.2, { delay: 0.12, gain: 0.1 }); },
  victory: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.5, { delay: i * 0.12, gain: 0.12 })),
  defeat: () => [440, 392, 330].forEach((f, i) => tone(f, 0.45, { delay: i * 0.18, gain: 0.1, type: 'triangle' })),
  error: () => tone(180, 0.18, { type: 'square', gain: 0.05 }),
};

function startAmbient() {
  const c = ensure();
  if (!c || ambientNodes.length) return;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 650;
  filter.Q.value = 0.7;
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  lfo.frequency.value = 0.05;
  lfoGain.gain.value = 260;
  lfo.connect(lfoGain).connect(filter.frequency);
  filter.connect(musicGain);
  const voices = [110, 164.81, 220.5, 329.6].map((f, i) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = i % 2 ? 'sine' : 'triangle';
    o.frequency.value = f;
    o.detune.value = (i - 1.5) * 6;
    g.gain.value = 0.06;
    o.connect(g).connect(filter);
    o.start();
    return o;
  });
  lfo.start();
  ambientNodes = [filter, lfo, ...voices];
}

function stopAmbient() {
  for (const n of ambientNodes) {
    try { (n as OscillatorNode).stop?.(); } catch { /* already stopped */ }
    n.disconnect();
  }
  ambientNodes = [];
}

// pause ambient while the tab is hidden (saves battery)
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend();
  else ctx.resume();
});
