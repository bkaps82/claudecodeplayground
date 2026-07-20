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

  _noise(duration) {
    const ctx = this.ctx;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  _safe(fn) {
    if (!this.ctx) return;
    try { fn(this.ctx, this.ctx.currentTime); } catch (e) { /* ignore */ }
  }

  swing() {
    this._safe((ctx, t0) => {
      const src = ctx.createBufferSource();
      src.buffer = this._noise(0.14);
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2000, t0);
      filter.frequency.exponentialRampToValueAtTime(500, t0 + 0.14);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.22, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.14);
      src.connect(filter).connect(gain).connect(ctx.destination);
      src.start(t0); src.stop(t0 + 0.15);
    });
  }

  hit() {
    this._safe((ctx, t0) => {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(240, t0);
      osc.frequency.exponentialRampToValueAtTime(70, t0 + 0.12);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.28, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.14);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0); osc.stop(t0 + 0.15);

      const src = ctx.createBufferSource();
      src.buffer = this._noise(0.08);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 1400;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.2, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.08);
      src.connect(f).connect(g).connect(ctx.destination);
      src.start(t0); src.stop(t0 + 0.09);
    });
  }

  hurt() {
    this._safe((ctx, t0) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, t0);
      osc.frequency.exponentialRampToValueAtTime(110, t0 + 0.2);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.22, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0); osc.stop(t0 + 0.23);
    });
  }

  monsterDie() {
    this._safe((ctx, t0) => {
      // descending goofy "bloop bloop"
      [420, 300, 180].forEach((f, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        const start = t0 + i * 0.07;
        osc.frequency.setValueAtTime(f, start);
        osc.frequency.exponentialRampToValueAtTime(f * 0.6, start + 0.08);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.2, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.09);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start); osc.stop(start + 0.1);
      });
    });
  }

  xp() {
    this._safe((ctx, t0) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, t0);
      osc.frequency.exponentialRampToValueAtTime(1400, t0 + 0.09);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.12, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0); osc.stop(t0 + 0.13);
    });
  }

  upgrade() {
    this._safe((ctx, t0) => {
      // triumphant little arpeggio
      [523, 659, 784, 1047].forEach((f, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        const start = t0 + i * 0.09;
        osc.frequency.setValueAtTime(f, start);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.18, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.24);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start); osc.stop(start + 0.25);
      });
    });
  }

  portal() {
    this._safe((ctx, t0) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(200, t0);
      osc.frequency.exponentialRampToValueAtTime(1200, t0 + 0.5);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.14, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.55);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0); osc.stop(t0 + 0.56);
    });
  }
}
