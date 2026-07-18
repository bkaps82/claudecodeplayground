// Tiny procedural sound effects via WebAudio — no external audio assets needed.
const Sound = (() => {
  let ctx = null;
  function ensure() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function blip({ freq = 440, dur = 0.08, type = 'square', gain = 0.06, slide = 0 }) {
    try {
      const ac = ensure();
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ac.currentTime);
      if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), ac.currentTime + dur);
      g.gain.setValueAtTime(gain, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
      osc.connect(g).connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + dur);
    } catch (e) { /* audio not available - ignore */ }
  }

  return {
    unlock: () => ensure(),
    shoot: () => blip({ freq: 620, dur: 0.045, type: 'square', gain: 0.03, slide: -80 }),
    splatHit: () => blip({ freq: 220, dur: 0.12, type: 'sawtooth', gain: 0.08, slide: -120 }),
    ko: () => { blip({ freq: 180, dur: 0.28, type: 'sawtooth', gain: 0.1, slide: -140 }); },
    recruit: () => { blip({ freq: 520, dur: 0.09, gain: 0.07 }); setTimeout(() => blip({ freq: 780, dur: 0.12, gain: 0.07 }), 90); },
    powerup: () => { blip({ freq: 440, dur: 0.08, gain: 0.07 }); setTimeout(() => blip({ freq: 660, dur: 0.08, gain: 0.07 }), 70); setTimeout(() => blip({ freq: 880, dur: 0.14, gain: 0.07 }), 140); },
    respawn: () => blip({ freq: 300, dur: 0.18, type: 'triangle', gain: 0.06, slide: 220 }),
  };
})();
