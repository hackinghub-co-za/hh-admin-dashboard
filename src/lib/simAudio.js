// Tiny Web Audio cue player. Starts muted; sound only after the member turns it on.
let ctx = null;
const CUES = {
  alert: [[880, 0.08], [1175, 0.1]],
  critical: [[220, 0.18], [196, 0.18]],
  good: [[660, 0.07], [990, 0.1]],
  bad: [[200, 0.16]],
  tick: [[1400, 0.02]],
  boot: [[330, 0.08], [440, 0.08], [660, 0.12]],
};

export function playCue(name, enabled) {
  if (!enabled) return;
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    let t = ctx.currentTime;
    for (const [freq, dur] of CUES[name] || []) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.025, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur);
      t += dur;
    }
  } catch { /* audio unavailable */ }
}
