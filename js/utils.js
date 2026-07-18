// Shared math/random/color helpers used across the game.
const Utils = (() => {
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function dist(ax, ay, bx, by) {
    return Math.hypot(ax - bx, ay - by);
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function angleTo(ax, ay, bx, by) {
    return Math.atan2(by - ay, bx - ax);
  }

  function shadeColor(hex, percent) {
    const num = parseInt(hex.slice(1), 16);
    let r = (num >> 16) + Math.round(255 * percent);
    let g = ((num >> 8) & 0x00ff) + Math.round(255 * percent);
    let b = (num & 0x0000ff) + Math.round(255 * percent);
    r = clamp(r, 0, 255); g = clamp(g, 0, 255); b = clamp(b, 0, 255);
    return `rgb(${r},${g},${b})`;
  }

  function randChoice(rng, arr) {
    return arr[Math.floor(rng() * arr.length)];
  }

  function genCode(rng) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < 5; i++) out += chars[Math.floor((rng ? rng() : Math.random()) * chars.length)];
    return out;
  }

  const PLAYER_COLORS = [
    { name: 'Cyan', hex: '#29c5f6' },
    { name: 'Magenta', hex: '#ff3ea5' },
    { name: 'Orange', hex: '#ffb703' },
    { name: 'Lime', hex: '#8ac926' },
  ];

  const CRITTER_TYPES = [
    { name: 'Leafling', color: '#5cd15c', accent: '#2e8b2e' },
    { name: 'Emberpup', color: '#ff7a45', accent: '#c43e1c' },
    { name: 'Splashkit', color: '#4aa3ff', accent: '#1c5fa8' },
    { name: 'Sparkbit', color: '#ffe14a', accent: '#c9a30b' },
    { name: 'Rockle', color: '#a68a6d', accent: '#6b563e' },
  ];

  return { mulberry32, dist, clamp, lerp, angleTo, shadeColor, randChoice, genCode, PLAYER_COLORS, CRITTER_TYPES };
})();
