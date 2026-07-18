// Tiny synthesized SFX layer — no audio assets needed, and it degrades
// silently if the browser blocks autoplay/audio for any reason.
export class SFX {
  constructor() {
    this.ctx = null;
  }

  unlock() {
    try {
      if (!this.ctx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new Ctx();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) {
      // audio unsupported/blocked - fine, game still works
    }
  }

  _noiseBuffer(duration) {
    const ctx = this.ctx;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  swing() {
    if (!this.ctx) return;
    try {
      const ctx = this.ctx;
      const t0 = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = this._noiseBuffer(0.15);
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1800, t0);
      filter.frequency.exponentialRampToValueAtTime(600, t0 + 0.15);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.25, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.15);
      src.connect(filter).connect(gain).connect(ctx.destination);
      src.start(t0);
      src.stop(t0 + 0.16);
    } catch (e) {
      // ignore
    }
  }

  splat() {
    if (!this.ctx) return;
    try {
      const ctx = this.ctx;
      const t0 = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = this._noiseBuffer(0.18);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2200, t0);
      filter.frequency.exponentialRampToValueAtTime(200, t0 + 0.18);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.35, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18);
      src.connect(filter).connect(gain).connect(ctx.destination);
      src.start(t0);
      src.stop(t0 + 0.19);

      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, t0);
      osc.frequency.exponentialRampToValueAtTime(90, t0 + 0.12);
      const oGain = ctx.createGain();
      oGain.gain.setValueAtTime(0.18, t0);
      oGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);
      osc.connect(oGain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.13);
    } catch (e) {
      // ignore
    }
  }

  victory() {
    if (!this.ctx) return;
    try {
      const ctx = this.ctx;
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, i) => {
        const t0 = ctx.currentTime + i * 0.11;
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, t0);
        gain.gain.linearRampToValueAtTime(0.22, t0 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + 0.36);
      });
    } catch (e) {
      // ignore
    }
  }
}
