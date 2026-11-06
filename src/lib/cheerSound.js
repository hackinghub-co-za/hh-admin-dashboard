// A short crowd cheer for the New Recent Wins "Celebrate" button
// (NewWinsModal). Made on the fly with the Web Audio API instead of a
// recorded file, so there is no audio asset to license or download: a swell
// of filtered noise for the crowd, a scatter of short noise bursts for
// claps, and a few rising whistles. About 2.5 seconds long.
//
// Must be called from a click (browsers only allow sound after the person
// interacts with the page). Fails silently where Web Audio is unavailable.

let ctx = null;

function noiseBuffer(audio, seconds) {
  const buf = audio.createBuffer(1, Math.floor(audio.sampleRate * seconds), audio.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

export function playCheer() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    ctx = ctx || new AudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
    const t0 = ctx.currentTime + 0.02;

    const master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);

    // Crowd: two bands of noise that swell in and fade out.
    const crowdBuf = noiseBuffer(ctx, 2.8);
    [[700, 0.6], [1600, 0.4]].forEach(([freq, level]) => {
      const src = ctx.createBufferSource();
      src.buffer = crowdBuf;
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = freq;
      band.Q.value = 0.8;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(level, t0 + 0.35);
      g.gain.setValueAtTime(level, t0 + 1.2);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.7);
      src.connect(band).connect(g).connect(master);
      src.start(t0);
      src.stop(t0 + 2.8);
    });

    // Claps: short bright bursts at random moments.
    const clapBuf = noiseBuffer(ctx, 0.05);
    for (let i = 0; i < 28; i++) {
      const at = t0 + 0.1 + Math.random() * 2;
      const src = ctx.createBufferSource();
      src.buffer = clapBuf;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 1200 + Math.random() * 800;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.5 + Math.random() * 0.4, at);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.045);
      src.connect(hp).connect(g).connect(master);
      src.start(at);
      src.stop(at + 0.05);
    }

    // Whistles: a few rising "woo"s.
    for (let i = 0; i < 3; i++) {
      const at = t0 + 0.2 + i * 0.45 + Math.random() * 0.15;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(700 + Math.random() * 200, at);
      osc.frequency.exponentialRampToValueAtTime(1500 + Math.random() * 400, at + 0.35);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.12, at + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.45);
      osc.connect(g).connect(master);
      osc.start(at);
      osc.stop(at + 0.5);
    }
  } catch {
    // No sound is fine - the falling emojis still play.
  }
}
