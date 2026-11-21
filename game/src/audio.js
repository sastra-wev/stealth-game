// All sound is synthesised with WebAudio: no audio files, no network.
// Short blips for footsteps and pickups, a sting for the alarm, a little
// arpeggio for a cleared level. Muted until the player first interacts.

let context = null;
let muted = false;

function audioContext() {
  if (context === null) {
    const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextClass) return null;
    context = new AudioContextClass();
  }
  if (context.state === 'suspended') void context.resume();
  return context;
}

function tone(frequency, duration, type, volume, when = 0) {
  if (muted) return;
  const ctx = audioContext();
  if (ctx === null) return;
  const start = ctx.currentTime + when;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.05);
}

export function setMuted(value) {
  muted = value;
}

export function isMuted() {
  return muted;
}

/** A soft footstep; louder when a guard is near the player. */
export function playFootstep(nearGuard) {
  tone(nearGuard ? 210 : 150, 0.07, 'triangle', nearGuard ? 0.05 : 0.028);
}

/** Two-note chime when a relic is picked up. */
export function playPickup() {
  tone(660, 0.12, 'sine', 0.06);
  tone(990, 0.18, 'sine', 0.05, 0.07);
}

/** Rising alarm sting when a guard spots the player. */
export function playAlarm() {
  tone(220, 0.16, 'square', 0.045);
  tone(330, 0.16, 'square', 0.045, 0.12);
  tone(440, 0.24, 'square', 0.05, 0.24);
}

/** Low thud when the player is caught. */
export function playCaught() {
  tone(160, 0.3, 'sawtooth', 0.06);
  tone(90, 0.45, 'sawtooth', 0.06, 0.18);
}

/** Short arpeggio when a level is cleared. */
export function playLevelClear() {
  tone(523, 0.14, 'sine', 0.06);
  tone(659, 0.14, 'sine', 0.06, 0.1);
  tone(784, 0.22, 'sine', 0.06, 0.2);
}

/** A longer fanfare for finishing the whole vault. */
export function playWin() {
  tone(523, 0.16, 'sine', 0.06);
  tone(659, 0.16, 'sine', 0.06, 0.12);
  tone(784, 0.16, 'sine', 0.06, 0.24);
  tone(1047, 0.34, 'sine', 0.07, 0.36);
}
