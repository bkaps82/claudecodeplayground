// Entity factories and shared constants. Entities are plain objects so
// the whole game state can be serialized straight into network snapshots.
const POWERUP_TYPES = {
  SPEED: { key: 'SPEED', label: 'Speed Boots', color: '#ffd23f', duration: 8000 },
  RAPID: { key: 'RAPID', label: 'Rapid Star', color: '#ffe14a', duration: 6000 },
  SHIELD: { key: 'SHIELD', label: 'Ink Shield', color: '#7fe0ff', duration: 10000 },
  BOMB: { key: 'BOMB', label: 'Ink Bomb', color: '#ff5252', duration: 0 },
};
const POWERUP_KEYS = Object.keys(POWERUP_TYPES);

const PLAYER_RADIUS = 14;
const CRITTER_RADIUS = 10;
const PLAYER_SPEED = 145; // px/sec
const PLAYER_MAX_HP = 100;
const PLAYER_MAX_AMMO = 100;
const SHOT_COOLDOWN = 90; // ms between ink shots
const SHOT_AMMO_COST = 6;
const INK_SPEED = 420;
const INK_RANGE = 340;
const INK_SPLAT_RADIUS = 16;
const INK_DAMAGE = 9;
const RESPAWN_TIME = 3000;

let _eid = 1;
function nextId(prefix) { return `${prefix}${_eid++}`; }

function makePlayer(peerId, name, colorIdx, x, y, isBot = false) {
  const c = Utils.PLAYER_COLORS[colorIdx % Utils.PLAYER_COLORS.length];
  return {
    id: peerId, name, colorIdx, color: c.hex, isBot,
    x, y, vx: 0, vy: 0, angle: 0,
    hp: PLAYER_MAX_HP, ammo: PLAYER_MAX_AMMO,
    alive: true, respawnAt: 0,
    kos: 0, deaths: 0, coveredTiles: 0,
    powerup: null, powerupUntil: 0,
    companionId: null,
    lastShot: 0,
    input: { up: false, down: false, left: false, right: false, mx: x + 40, my: y, shooting: false },
    botTimer: 0, botTarget: null,
  };
}

function makeCritter(spot) {
  const t = Utils.randChoice(Math.random, Utils.CRITTER_TYPES);
  return {
    id: nextId('c'), type: t.name, color: t.color, accent: t.accent,
    x: spot.x, y: spot.y, homeX: spot.x, homeY: spot.y,
    vx: 0, vy: 0, wanderTimer: 0, wanderDir: 0,
    ownerId: null, state: 'wild', attackCooldown: 0,
  };
}

function makePowerup(x, y) {
  const key = Utils.randChoice(Math.random, POWERUP_KEYS);
  return { id: nextId('p'), type: key, x, y, bobT: Math.random() * Math.PI * 2 };
}

function makeInk(ownerId, color, x, y, angle) {
  return {
    id: nextId('i'), ownerId, color, x, y,
    vx: Math.cos(angle) * INK_SPEED, vy: Math.sin(angle) * INK_SPEED,
    traveled: 0,
  };
}

function makeSplat(x, y, color, radius = INK_SPLAT_RADIUS) {
  return { id: nextId('s'), x, y, radius, color, t: performance.now() };
}
