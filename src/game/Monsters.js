import * as THREE from 'three';
import { toonMat, createToonPart, createGooglyEye, makeTextSprite } from './ToonUtils.js';
import { WORLD_DEFS } from './World.js';

// The monster roster, as specified by the design team (ages 6 and 8).
export const MONSTER_TYPES = {
  googlyBlob: {
    name: 'Googly Blob', world: 0, xp: 8, hp: 20, dmg: 6, speed: 2.2,
    aggro: 10, reach: 1.6, scale: 1,
  },
  zombieChicken: {
    name: 'Zombie Chicken', world: 0, xp: 12, hp: 30, dmg: 8, speed: 3.4,
    aggro: 12, reach: 1.7, scale: 1,
  },
  spikeBall: {
    name: 'Spike Ball Meanie', world: 0, xp: 15, hp: 40, dmg: 10, speed: 4.2,
    aggro: 14, reach: 1.5, scale: 1,
  },
  boogerGoblin: {
    name: 'Booger Goblin', world: 0, xp: 20, hp: 55, dmg: 12, speed: 3.0,
    aggro: 13, reach: 1.8, scale: 1,
  },
  flamingMeatball: {
    name: 'Flaming Meatball', world: 1, xp: 25, hp: 70, dmg: 14, speed: 2.6,
    aggro: 13, reach: 1.8, scale: 1.15,
  },
  fireSkeleton: {
    name: 'Fire Skeleton Ninja', world: 1, xp: 35, hp: 90, dmg: 18, speed: 4.6,
    aggro: 16, reach: 1.8, scale: 1,
  },
  volcanoGolem: {
    name: 'Volcano Golem', world: 1, xp: 45, hp: 140, dmg: 22, speed: 1.8,
    aggro: 12, reach: 2.2, scale: 1.5,
  },
  lavaDragon: {
    name: 'Lava Dragon', world: 1, xp: 60, hp: 200, dmg: 26, speed: 3.2,
    aggro: 18, reach: 2.6, scale: 1.7,
  },
};

const PLAINS_KEYS = Object.keys(MONSTER_TYPES).filter((k) => MONSTER_TYPES[k].world === 0);
const VOLCANO_KEYS = Object.keys(MONSTER_TYPES).filter((k) => MONSTER_TYPES[k].world === 1);

/* ============ procedural monster bodies ============ */

function bodyGooglyBlob() {
  const g = new THREE.Group();
  const blob = createToonPart(new THREE.SphereGeometry(0.7, 16, 12), 0x5fe07a);
  blob.group.position.y = 0.62;
  blob.group.scale.y = 0.85;
  g.add(blob.group);
  const e1 = createGooglyEye(0.24); e1.position.set(-0.26, 1.05, 0.5);
  const e2 = createGooglyEye(0.31); e2.position.set(0.28, 1.12, 0.46); // mismatched = funnier
  g.add(e1, e2);
  g.userData.anim = 'bounce';
  return g;
}

function bodyZombieChicken() {
  const g = new THREE.Group();
  const body = createToonPart(new THREE.SphereGeometry(0.62, 12, 10), 0x86b04a);
  body.group.position.y = 0.85;
  body.group.scale.set(1, 0.92, 1.25);
  g.add(body.group);
  const head = createToonPart(new THREE.SphereGeometry(0.34, 10, 8), 0x9cc45a);
  head.group.position.set(0, 1.65, 0.5);
  g.add(head.group);
  const beak = createToonPart(new THREE.ConeGeometry(0.14, 0.35, 6), 0xffb300);
  beak.group.rotation.x = Math.PI / 2;
  beak.group.position.set(0, 1.62, 0.9);
  g.add(beak.group);
  const comb = createToonPart(new THREE.SphereGeometry(0.12, 6, 5), 0xd93a3a);
  comb.group.position.set(0, 1.98, 0.48);
  g.add(comb.group);
  const e1 = createGooglyEye(0.13, { bloodshot: true }); e1.position.set(-0.18, 1.72, 0.72);
  const e2 = createGooglyEye(0.13, { bloodshot: true }); e2.position.set(0.18, 1.72, 0.72);
  g.add(e1, e2);
  [-1, 1].forEach((s) => {
    const leg = createToonPart(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 5), 0xffb300);
    leg.group.position.set(s * 0.22, 0.25, 0);
    g.add(leg.group);
  });
  g.userData.anim = 'waddle';
  return g;
}

function bodySpikeBall() {
  const g = new THREE.Group();
  const ball = createToonPart(new THREE.SphereGeometry(0.62, 14, 11), 0x7a6df0);
  ball.group.position.y = 0.66;
  g.add(ball.group);
  const spikeGeo = new THREE.ConeGeometry(0.1, 0.4, 5);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const b = ((i % 3) - 1) * 0.7;
    const dir = new THREE.Vector3(Math.cos(a) * Math.cos(b), Math.sin(b), Math.sin(a) * Math.cos(b));
    const spike = createToonPart(spikeGeo, 0xffd94d);
    spike.group.position.copy(dir).multiplyScalar(0.6).add(new THREE.Vector3(0, 0.66, 0));
    spike.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    g.add(spike.group);
  }
  const e1 = createGooglyEye(0.16); e1.position.set(-0.2, 0.82, 0.52);
  const e2 = createGooglyEye(0.16); e2.position.set(0.2, 0.82, 0.52);
  g.add(e1, e2);
  // angry brows
  [-1, 1].forEach((s) => {
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.06, 0.05), new THREE.MeshBasicMaterial({ color: 0x1a1030 }));
    brow.position.set(s * 0.2, 0.99, 0.6);
    brow.rotation.z = -s * 0.5;
    g.add(brow);
  });
  g.userData.anim = 'roll';
  g.userData.rollBall = ball.group;
  return g;
}

function bodyBoogerGoblin() {
  const g = new THREE.Group();
  const body = createToonPart(new THREE.CapsuleGeometry(0.42, 0.6, 6, 10), 0x8fd435);
  body.group.position.y = 0.95;
  g.add(body.group);
  const head = createToonPart(new THREE.SphereGeometry(0.4, 12, 9), 0x9fe23f);
  head.group.position.y = 1.75;
  g.add(head.group);
  // one giant nostril, per spec-by-giggling
  const nose = createToonPart(new THREE.SphereGeometry(0.18, 8, 6), 0x6faa22);
  nose.group.position.set(0, 1.68, 0.36);
  g.add(nose.group);
  const nostril = new THREE.Mesh(new THREE.CircleGeometry(0.07, 8), new THREE.MeshBasicMaterial({ color: 0x2a4a08 }));
  nostril.position.set(0, 1.66, 0.53);
  g.add(nostril);
  const e1 = createGooglyEye(0.14); e1.position.set(-0.19, 1.88, 0.32);
  const e2 = createGooglyEye(0.18); e2.position.set(0.2, 1.9, 0.3);
  g.add(e1, e2);
  [-1, 1].forEach((s) => {
    const ear = createToonPart(new THREE.ConeGeometry(0.1, 0.42, 5), 0x9fe23f);
    ear.group.position.set(s * 0.44, 1.92, 0);
    ear.group.rotation.z = -s * 1.25;
    g.add(ear.group);
    const arm = createToonPart(new THREE.CapsuleGeometry(0.09, 0.5, 4, 6), 0x8fd435);
    arm.group.position.set(s * 0.5, 1.05, 0);
    arm.group.rotation.z = s * 0.5;
    g.add(arm.group);
    // green drips
    const drip = createToonPart(new THREE.SphereGeometry(0.07, 6, 5), 0xb8f04a);
    drip.group.position.set(s * 0.1, 1.5, 0.42);
    drip.group.scale.y = 1.8;
    g.add(drip.group);
  });
  g.userData.anim = 'waddle';
  return g;
}

function bodyFlamingMeatball() {
  const g = new THREE.Group();
  const ball = createToonPart(new THREE.SphereGeometry(0.85, 16, 12), 0x8a3a22, { emissive: 0x441100 });
  ball.group.position.y = 0.9;
  g.add(ball.group);
  // flame tufts
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 0.55, 5),
      new THREE.MeshBasicMaterial({ color: i % 2 ? 0xff7a1f : 0xffd94d })
    );
    flame.position.set(Math.cos(a) * 0.7, 1.45 + Math.sin(i) * 0.1, Math.sin(a) * 0.7);
    flame.userData.flicker = true;
    g.add(flame);
  }
  // tiny useless arms (crucial detail)
  [-1, 1].forEach((s) => {
    const arm = createToonPart(new THREE.CapsuleGeometry(0.06, 0.25, 4, 6), 0x6a2a18);
    arm.group.position.set(s * 0.88, 0.95, 0.15);
    arm.group.rotation.z = s * 1.2;
    g.add(arm.group);
  });
  const e1 = createGooglyEye(0.17); e1.position.set(-0.25, 1.15, 0.72);
  const e2 = createGooglyEye(0.17); e2.position.set(0.25, 1.15, 0.72);
  g.add(e1, e2);
  g.userData.anim = 'bounce';
  return g;
}

function bodyFireSkeleton() {
  const g = new THREE.Group();
  const bone = 0xe8e4d8;
  const torso = createToonPart(new THREE.CapsuleGeometry(0.3, 0.5, 6, 8), bone);
  torso.group.position.y = 1.15;
  g.add(torso.group);
  // rib lines
  for (let i = 0; i < 3; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.03, 5, 12), new THREE.MeshBasicMaterial({ color: 0x8a8578 }));
    rib.position.y = 1.05 + i * 0.16;
    rib.rotation.x = Math.PI / 2.3;
    g.add(rib);
  }
  const skull = createToonPart(new THREE.SphereGeometry(0.3, 12, 9), bone);
  skull.group.position.y = 1.85;
  g.add(skull.group);
  // flame hair
  for (let i = 0; i < 5; i++) {
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.09, 0.4, 5),
      new THREE.MeshBasicMaterial({ color: i % 2 ? 0xff5a1f : 0xffb300 })
    );
    flame.position.set((i - 2) * 0.11, 2.2, 0);
    flame.userData.flicker = true;
    g.add(flame);
  }
  // glowing eye sockets
  [-1, 1].forEach((s) => {
    const eye = new THREE.Mesh(new THREE.CircleGeometry(0.07, 8), new THREE.MeshBasicMaterial({ color: 0xff3a00 }));
    eye.position.set(s * 0.11, 1.9, 0.28);
    g.add(eye);
  });
  // ninja headband (obviously)
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.08, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xd93a3a }));
  band.position.y = 2.0;
  g.add(band);
  [-1, 1].forEach((s) => {
    const arm = createToonPart(new THREE.CapsuleGeometry(0.07, 0.5, 4, 6), bone);
    arm.group.position.set(s * 0.42, 1.2, 0);
    arm.group.rotation.z = s * 0.35;
    g.add(arm.group);
    const leg = createToonPart(new THREE.CapsuleGeometry(0.08, 0.5, 4, 6), bone);
    leg.group.position.set(s * 0.16, 0.45, 0);
    g.add(leg.group);
  });
  g.userData.anim = 'waddle';
  return g;
}

function bodyVolcanoGolem() {
  const g = new THREE.Group();
  const rock = 0x453433;
  const torso = createToonPart(new THREE.BoxGeometry(1.0, 1.0, 0.7), rock, { emissive: 0x3a0d00 });
  torso.group.position.y = 1.3;
  g.add(torso.group);
  // lava crack lines
  for (let i = 0; i < 4; i++) {
    const crack = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4 + i * 0.1, 0.02), new THREE.MeshBasicMaterial({ color: 0xff5a1f }));
    crack.position.set((i - 1.5) * 0.2, 1.3, 0.37);
    crack.rotation.z = (i % 2 ? 1 : -1) * 0.4;
    g.add(crack);
  }
  const head = createToonPart(new THREE.BoxGeometry(0.5, 0.45, 0.5), rock);
  head.group.position.y = 2.1;
  g.add(head.group);
  const e1 = createGooglyEye(0.11); e1.position.set(-0.13, 2.14, 0.28);
  const e2 = createGooglyEye(0.11); e2.position.set(0.13, 2.14, 0.28);
  g.add(e1, e2);
  [-1, 1].forEach((s) => {
    const arm = createToonPart(new THREE.BoxGeometry(0.3, 0.95, 0.3), 0x574140);
    arm.group.position.set(s * 0.72, 1.25, 0);
    g.add(arm.group);
    const fist = createToonPart(new THREE.BoxGeometry(0.38, 0.34, 0.38), 0x2f2322);
    fist.group.position.set(s * 0.72, 0.7, 0);
    g.add(fist.group);
    const leg = createToonPart(new THREE.BoxGeometry(0.34, 0.7, 0.34), 0x2f2322);
    leg.group.position.set(s * 0.26, 0.4, 0);
    g.add(leg.group);
  });
  g.userData.anim = 'stomp';
  return g;
}

function bodyLavaDragon() {
  const g = new THREE.Group();
  const scale = 0xb02a1a;
  const body = createToonPart(new THREE.CapsuleGeometry(0.55, 0.9, 8, 12), scale, { emissive: 0x330800 });
  body.group.position.y = 1.35;
  body.group.rotation.x = Math.PI / 2.4;
  g.add(body.group);
  const head = createToonPart(new THREE.SphereGeometry(0.4, 12, 9), 0xc93a22);
  head.group.position.set(0, 2.0, 0.75);
  g.add(head.group);
  const snout = createToonPart(new THREE.BoxGeometry(0.35, 0.24, 0.5), 0xc93a22);
  snout.group.position.set(0, 1.92, 1.15);
  g.add(snout.group);
  // nostril smoke dots + horns + wings + tail
  [-1, 1].forEach((s) => {
    const horn = createToonPart(new THREE.ConeGeometry(0.09, 0.4, 5), 0xffd94d);
    horn.group.position.set(s * 0.2, 2.35, 0.55);
    horn.group.rotation.x = -0.4;
    g.add(horn.group);
    const wing = createToonPart(new THREE.ConeGeometry(0.5, 1.3, 3), 0x7a1408);
    wing.group.position.set(s * 0.8, 1.9, 0);
    wing.group.rotation.z = s * 1.9;
    wing.group.userData.wing = s;
    g.add(wing.group);
    g.userData['wing' + (s > 0 ? 'R' : 'L')] = wing.group;
  });
  const e1 = createGooglyEye(0.13); e1.position.set(-0.18, 2.12, 1.05);
  const e2 = createGooglyEye(0.13); e2.position.set(0.18, 2.12, 1.05);
  g.add(e1, e2);
  const tail = createToonPart(new THREE.ConeGeometry(0.2, 1.1, 6), scale);
  tail.group.position.set(0, 0.9, -1.0);
  tail.group.rotation.x = 1.9;
  g.add(tail.group);
  // fire breath glow
  const glow = new THREE.PointLight(0xff5a1f, 4, 6);
  glow.position.set(0, 1.9, 1.3);
  g.add(glow);
  g.userData.anim = 'fly';
  return g;
}

const BODY_BUILDERS = {
  googlyBlob: bodyGooglyBlob,
  zombieChicken: bodyZombieChicken,
  spikeBall: bodySpikeBall,
  boogerGoblin: bodyBoogerGoblin,
  flamingMeatball: bodyFlamingMeatball,
  fireSkeleton: bodyFireSkeleton,
  volcanoGolem: bodyVolcanoGolem,
  lavaDragon: bodyLavaDragon,
};

/* ============ HP bar sprite ============ */

function makeHpBar() {
  const g = new THREE.Group();
  const bg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x330a12, depthWrite: false }));
  bg.scale.set(1.1, 0.14, 1);
  const fg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x46e060, depthWrite: false }));
  fg.scale.set(1.04, 0.09, 1);
  fg.position.z = 0.001;
  g.add(bg, fg);
  g.userData.fg = fg;
  return g;
}

/* ============ the manager ============ */

const COUNT_PER_WORLD = 11;
const RESPAWN_SECONDS = 9;

export class MonsterManager {
  /**
   * @param {object} opts
   *  - scene, world (World instance)
   *  - authoritative: run AI + damage (solo & host). If false we just render
   *    what snapshots tell us (client in an online game).
   *  - onMonsterKilled(monster, killerId): XP/event hook ('local'|'remote')
   *  - onPlayerHit(playerId, dmg, fromPos): monster hit a player
   */
  constructor(opts) {
    this.scene = opts.scene;
    this.world = opts.world;
    this.authoritative = opts.authoritative;
    this.onMonsterKilled = opts.onMonsterKilled || (() => {});
    this.onPlayerHit = opts.onPlayerHit || (() => {});
    this.rng = Math.random;
    this.monsters = new Map(); // id -> monster record
    this.effects = [];         // floating text / poof particles
    this._nextId = 1;

    if (this.authoritative) {
      for (let w = 0; w <= 1; w++) {
        for (let i = 0; i < COUNT_PER_WORLD; i++) this._spawn(w);
      }
    }
  }

  _pickType(worldId) {
    const keys = worldId === 0 ? PLAINS_KEYS : VOLCANO_KEYS;
    // big ones are rarer
    const weights = keys.map((k) => 1 / Math.sqrt(MONSTER_TYPES[k].hp));
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = this.rng() * total;
    for (let i = 0; i < keys.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return keys[i];
    }
    return keys[keys.length - 1];
  }

  _spawnPos(worldId) {
    const def = WORLD_DEFS[worldId];
    const a = this.rng() * Math.PI * 2;
    const r = 14 + this.rng() * (def.radius - 22);
    const x = def.center.x + Math.cos(a) * r;
    const z = def.center.z + Math.sin(a) * r;
    return new THREE.Vector3(x, this.world.heightAt(x, z), z);
  }

  _spawn(worldId, id = null, typeKey = null) {
    typeKey = typeKey || this._pickType(worldId);
    const type = MONSTER_TYPES[typeKey];
    const pos = this._spawnPos(worldId);
    return this._create(id ?? this._nextId++, typeKey, pos, type.hp);
  }

  _create(id, typeKey, pos, hp) {
    const type = MONSTER_TYPES[typeKey];
    const group = new THREE.Group();
    const body = BODY_BUILDERS[typeKey]();
    body.scale.setScalar(type.scale);
    group.add(body);

    const hpBar = makeHpBar();
    hpBar.position.y = 2.6 * type.scale;
    group.add(hpBar);

    const tag = makeTextSprite(type.name, { color: '#ffd94d', size: 40, scale: 0.55 });
    tag.position.y = 2.95 * type.scale;
    group.add(tag);

    group.position.copy(pos);
    this.scene.add(group);

    const m = {
      id, typeKey, type, group, body, hpBar,
      hp, maxHp: type.hp,
      worldId: this.world.worldIdAt(pos.x),
      state: 'wander',
      target: null,            // player record while chasing
      wanderGoal: pos.clone(),
      wanderTimer: 0,
      attackCd: 0,
      knockback: new THREE.Vector3(),
      hitFlash: 0,
      deadTimer: 0,
      animT: this.rng() * 10,
      yaw: this.rng() * Math.PI * 2,
      // client-side interpolation targets
      netPos: pos.clone(),
      netYaw: 0,
    };
    this.monsters.set(id, m);
    return m;
  }

  /** Apply damage locally (authoritative side). Returns true if it died. */
  damage(id, amount, killerId, fromPos) {
    const m = this.monsters.get(id);
    if (!m || m.state === 'dead') return false;
    m.hp -= amount;
    m.hitFlash = 0.18;
    this.spawnDamageNumber(m.group.position, amount);
    if (fromPos) {
      m.knockback.copy(m.group.position).sub(fromPos).setY(0).normalize().multiplyScalar(7);
    }
    // getting smacked is an excellent reason to fight back
    if (m.state === 'wander') m.state = 'chase';
    if (m.hp <= 0) {
      this._kill(m, killerId);
      return true;
    }
    return false;
  }

  _kill(m, killerId) {
    m.state = 'dead';
    m.deadTimer = RESPAWN_SECONDS;
    m.hp = 0;
    this.spawnPoof(m.group.position, m.type.scale);
    this.spawnXpText(m.group.position, m.type.xp);
    this.onMonsterKilled(m, killerId);
  }

  /** Sword swing hit test: cone in front of the attacker. */
  findHit(origin, dir, { range = 3.0, dot = 0.62 } = {}) {
    let best = null, bestD = Infinity;
    const to = new THREE.Vector3();
    for (const m of this.monsters.values()) {
      if (m.state === 'dead') continue;
      to.copy(m.group.position).add(new THREE.Vector3(0, 1, 0)).sub(origin);
      const d = to.length();
      if (d > range + m.type.scale * 0.6) continue;
      to.normalize();
      if (to.dot(dir) < dot && d > 1.2) continue;
      if (d < bestD) { bestD = d; best = m; }
    }
    return best;
  }

  /* ---- effects (run on every machine, purely cosmetic) ---- */

  spawnDamageNumber(pos, amount) {
    const sprite = makeTextSprite(`${Math.round(amount)}`, { color: '#ffd94d', outline: '#5a1400', size: 54, scale: 1.3 });
    sprite.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 1.7, (Math.random() - 0.5) * 0.8));
    this.scene.add(sprite);
    this.effects.push({ obj: sprite, vel: new THREE.Vector3(0, 2.2, 0), life: 0.8, fade: true });
  }

  spawnXpText(pos, xp) {
    const sprite = makeTextSprite(`+${xp} XP`, { color: '#9be7ff', outline: '#082a4a', size: 58, scale: 1.6 });
    sprite.position.copy(pos).add(new THREE.Vector3(0, 2.1, 0));
    this.scene.add(sprite);
    this.effects.push({ obj: sprite, vel: new THREE.Vector3(0, 1.6, 0), life: 1.3, fade: true });
  }

  spawnPoof(pos, scale = 1) {
    for (let i = 0; i < 14; i++) {
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(0.12 + Math.random() * 0.16, 6, 5),
        new THREE.MeshBasicMaterial({ color: Math.random() > 0.5 ? 0xffffff : 0xffe9a8, transparent: true })
      );
      puff.position.copy(pos).add(new THREE.Vector3(0, 0.8, 0));
      this.scene.add(puff);
      const vel = new THREE.Vector3((Math.random() - 0.5) * 5, Math.random() * 4.5, (Math.random() - 0.5) * 5).multiplyScalar(scale);
      this.effects.push({ obj: puff, vel, life: 0.55 + Math.random() * 0.3, fade: true, gravity: true });
    }
  }

  /* ---- per-frame update ---- */

  update(dt, time, players) {
    for (const m of this.monsters.values()) {
      if (this.authoritative) this._updateAI(m, dt, players);
      else this._updateNet(m, dt);
      this._updateVisual(m, dt, time);
    }
    // effects
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.life -= dt;
      if (e.life <= 0) {
        this.scene.remove(e.obj);
        e.obj.material?.dispose?.();
        this.effects.splice(i, 1);
        continue;
      }
      if (e.gravity) e.vel.y -= 9 * dt;
      e.obj.position.addScaledVector(e.vel, dt);
      if (e.fade && e.obj.material) e.obj.material.opacity = Math.min(1, e.life * 2.4);
    }
  }

  _updateAI(m, dt, players) {
    if (m.state === 'dead') {
      m.deadTimer -= dt;
      m.group.visible = false;
      if (m.deadTimer <= 0) {
        // respawn as a fresh random monster of the same world, same id
        const typeKey = this._pickType(m.worldId);
        const pos = this._spawnPos(m.worldId);
        this.scene.remove(m.group);
        this.monsters.delete(m.id);
        this._create(m.id, typeKey, pos, MONSTER_TYPES[typeKey].hp);
      }
      return;
    }
    m.group.visible = true;

    // nearest living player in the same world
    let target = null, tDist = Infinity;
    for (const p of players) {
      if (p.dead) continue;
      if (this.world.worldIdAt(p.position.x) !== m.worldId) continue;
      const d = m.group.position.distanceTo(p.position);
      if (d < tDist) { tDist = d; target = p; }
    }

    const speed = m.type.speed;
    const pos = m.group.position;

    if (target && tDist < m.type.aggro) m.state = 'chase';
    else if (m.state === 'chase' && (!target || tDist > m.type.aggro * 1.8)) m.state = 'wander';

    let moveDir = null;
    if (m.state === 'chase' && target) {
      if (tDist > m.type.reach * 0.85) {
        moveDir = new THREE.Vector3().subVectors(target.position, pos).setY(0).normalize();
      }
      m.attackCd -= dt;
      if (tDist < m.type.reach && m.attackCd <= 0) {
        m.attackCd = 1.15;
        m.attackAnim = 0.3;
        this.onPlayerHit(target.id, m.type.dmg, pos.clone());
      }
      m.yaw = Math.atan2(target.position.x - pos.x, target.position.z - pos.z);
    } else {
      // wander
      m.wanderTimer -= dt;
      if (m.wanderTimer <= 0 || pos.distanceTo(m.wanderGoal) < 1.5) {
        m.wanderTimer = 2.5 + Math.random() * 4;
        const def = WORLD_DEFS[m.worldId];
        const a = Math.random() * Math.PI * 2;
        const r = 10 + Math.random() * (def.radius - 18);
        m.wanderGoal.set(def.center.x + Math.cos(a) * r, 0, def.center.z + Math.sin(a) * r);
      }
      moveDir = new THREE.Vector3().subVectors(m.wanderGoal, pos).setY(0);
      if (moveDir.lengthSq() > 0.1) {
        moveDir.normalize();
        m.yaw = Math.atan2(moveDir.x, moveDir.z);
      } else moveDir = null;
    }

    const effSpeed = m.state === 'chase' ? speed : speed * 0.45;
    if (moveDir) pos.addScaledVector(moveDir, effSpeed * dt);

    // knockback decay
    if (m.knockback.lengthSq() > 0.01) {
      pos.addScaledVector(m.knockback, dt);
      m.knockback.multiplyScalar(Math.max(0, 1 - dt * 6));
    }

    this.world.clampToWorld(pos);
    pos.y = this.world.heightAt(pos.x, pos.z);
  }

  _updateNet(m, dt) {
    if (m.state === 'dead') { m.group.visible = false; return; }
    m.group.visible = true;
    // smooth toward the last snapshot
    m.group.position.lerp(m.netPos, Math.min(1, dt * 10));
    let dy = m.netYaw - m.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    m.yaw += dy * Math.min(1, dt * 10);
  }

  _updateVisual(m, dt, time) {
    if (m.state === 'dead') return;
    m.animT += dt;
    m.group.rotation.y = m.yaw;

    const b = m.body;
    switch (b.userData.anim) {
      case 'bounce': {
        const s = Math.abs(Math.sin(m.animT * 5));
        b.position.y = s * 0.35;
        b.scale.y = m.type.scale * (0.9 + (1 - s) * 0.18);
        break;
      }
      case 'waddle':
        b.rotation.z = Math.sin(m.animT * 7) * 0.12;
        b.position.y = Math.abs(Math.sin(m.animT * 7)) * 0.08;
        break;
      case 'roll':
        if (b.userData.rollBall) b.userData.rollBall.rotation.x += dt * 6;
        break;
      case 'stomp':
        b.position.y = Math.abs(Math.sin(m.animT * 3)) * 0.12;
        b.rotation.z = Math.sin(m.animT * 3) * 0.05;
        break;
      case 'fly': {
        b.position.y = 0.5 + Math.sin(m.animT * 2.4) * 0.25;
        const flap = Math.sin(m.animT * 8) * 0.5;
        if (m.body.userData.wingL) m.body.userData.wingL.rotation.z = -1.9 - flap;
        if (m.body.userData.wingR) m.body.userData.wingR.rotation.z = 1.9 + flap;
        break;
      }
    }
    // attack lunge
    if (m.attackAnim > 0) {
      m.attackAnim -= dt;
      b.rotation.x = Math.sin(m.attackAnim / 0.3 * Math.PI) * 0.5;
    } else b.rotation.x = 0;

    // flicker flames
    b.traverse((o) => {
      if (o.userData.flicker) o.scale.y = 0.85 + Math.sin(time * 17 + o.position.x * 9) * 0.25;
    });

    // hp bar + hit flash
    const frac = Math.max(0, m.hp / m.maxHp);
    m.hpBar.userData.fg.scale.x = 1.04 * frac;
    m.hpBar.userData.fg.position.x = -(1.04 * (1 - frac)) / 2;
    m.hpBar.userData.fg.material.color.setHex(frac > 0.5 ? 0x46e060 : frac > 0.25 ? 0xffb300 : 0xff3355);
    if (m.hitFlash > 0) {
      m.hitFlash -= dt;
      const flash = m.hitFlash > 0;
      b.traverse((o) => {
        if (o.material?.isMeshToonMaterial) {
          o.material.emissive.setHex(flash ? 0xff2222 : (o.material.userData.baseEmissive ?? 0x000000));
        }
      });
    }
  }

  /* ---- network serialization (host → client) ---- */

  snapshot() {
    const list = [];
    for (const m of this.monsters.values()) {
      list.push([
        m.id, m.typeKey,
        +m.group.position.x.toFixed(2), +m.group.position.y.toFixed(2), +m.group.position.z.toFixed(2),
        +m.yaw.toFixed(2), Math.round(m.hp), m.state === 'dead' ? 1 : 0,
      ]);
    }
    return list;
  }

  applySnapshot(list) {
    const seen = new Set();
    for (const [id, typeKey, x, y, z, yaw, hp, dead] of list) {
      seen.add(id);
      let m = this.monsters.get(id);
      if (!m || m.typeKey !== typeKey) {
        if (m) { this.scene.remove(m.group); this.monsters.delete(id); }
        m = this._create(id, typeKey, new THREE.Vector3(x, y, z), hp);
      }
      const wasAlive = m.state !== 'dead';
      m.netPos.set(x, y, z);
      m.netYaw = yaw;
      if (hp < m.hp && wasAlive) m.hitFlash = 0.18;
      m.hp = hp;
      m.state = dead ? 'dead' : 'chase-or-wander';
      if (dead && wasAlive) this.spawnPoof(m.group.position, m.type.scale);
    }
    for (const [id, m] of this.monsters) {
      if (!seen.has(id)) { this.scene.remove(m.group); this.monsters.delete(id); }
    }
  }
}
