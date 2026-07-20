import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

import './style.css';
import { World, WORLD_DEFS, applyAtmosphere } from './game/World.js';
import { MonsterManager, MONSTER_TYPES } from './game/Monsters.js';
import { Player } from './game/Player.js';
import { AnimeCharacter } from './game/AnimeCharacter.js';
import { Progression, TIERS, MAX_TIER } from './game/Progression.js';
import { Input, IS_TOUCH } from './game/Input.js';
import { UI } from './game/UI.js';
import { SFX } from './game/Audio.js';
import { Net, generateCode } from './game/Net.js';

const PVP_KO_XP = 50;

/* ================= renderer / scene ================= */

const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !IS_TOUCH });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = !IS_TOUCH;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(78, window.innerWidth / window.innerHeight, 0.08, 400);
scene.add(camera);

const lights = {
  hemi: new THREE.HemisphereLight(0xbfe8ff, 0x4a7a3a, 0.9),
  sun: new THREE.DirectionalLight(0xfff2cc, 1.5),
};
scene.add(lights.hemi, lights.sun, lights.sun.target);
lights.sun.castShadow = !IS_TOUCH;
lights.sun.shadow.mapSize.set(2048, 2048);
const sc = lights.sun.shadow.camera;
sc.left = -95; sc.right = 95; sc.top = 95; sc.bottom = -95;
sc.near = 5; sc.far = 250;

// bloom makes lava, portals and the bedrock sword glow — skipped on touch
// devices to keep phones at 60fps
let composer = null;
if (!IS_TOUCH) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight), 0.45, 0.65, 0.82
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer?.setSize(window.innerWidth, window.innerHeight);
});

/* ================= persistent helpers ================= */

const ui = new UI();
const sfx = new SFX();
const input = new Input(canvas);

/* ================= game session state ================= */

let mode = null;          // 'solo' | 'host' | 'client'
let world = null;
let monsters = null;
let player = null;
let remote = null;        // AnimeCharacter for the other player
let prog = null;
let net = null;
let myName = 'Hero';
let peerName = 'Friend';
let currentWorldId = 0;
let portalCooldown = 0;
let respawnTimer = 0;
let sendAcc = 0, snapAcc = 0;
let running = false;

function clearSession() {
  running = false;
  input.disable();
  if (net) { net.dispose(); net = null; }
  if (remote) { remote.dispose(); remote = null; }
  if (world) scene.remove(world.group);
  // wipe every non-persistent object (monsters, effects) in one sweep
  for (const obj of [...scene.children]) {
    if (obj !== camera && obj !== lights.hemi && obj !== lights.sun && obj !== lights.sun.target) {
      scene.remove(obj);
    }
  }
  if (player) {
    camera.remove(player.viewmodel);
    player = null;
  }
  world = null; monsters = null; prog = null;
  ui.setNetBadge(null);
}

function startSession({ asMode, seed }) {
  mode = asMode;
  world = new World(seed);
  scene.add(world.group);

  prog = new Progression();
  player = new Player(camera, world, input);
  player.spawnAt(world.spawnPoint(0, mode === 'client' ? 1 : 0));
  currentWorldId = 0;
  portalCooldown = 0;
  applyAtmosphere(scene, lights, 0);
  ui.setWorldLabel(WORLD_DEFS[0].name);

  monsters = new MonsterManager({
    scene,
    world,
    authoritative: mode !== 'client',
    onMonsterKilled: (m, killerId) => {
      if (killerId === 'local') {
        grantXP(m.type.xp, m.type.name);
      } else if (mode === 'host') {
        net?.send({ t: 'mkill', xp: m.type.xp, name: m.typeKey });
      }
      sfx.monsterDie();
    },
    onPlayerHit: (playerId, dmg, fromPos) => {
      if (playerId === 'local') {
        hitLocalPlayer(dmg);
      } else if (mode === 'host') {
        net?.send({ t: 'phit', dmg });
      }
    },
  });

  prog.onChange = () => {
    ui.updateProgression(prog);
  };

  player.onSwing = () => {
    const dir = player.lookDir;
    const origin = camera.position.clone();
    // monsters first
    const hit = monsters.findHit(origin, dir, { range: 3.0 + prog.swordTier * 0.12 });
    if (hit) {
      monsters.spawnDamageNumber(hit.group.position, prog.swordDamage);
      sfx.hit();
      if (mode === 'client') {
        net?.send({ t: 'hitm', id: hit.id, dmg: prog.swordDamage });
      } else {
        monsters.damage(hit.id, prog.swordDamage, 'local', player.position);
      }
    }
    // PvP: friend within the same swing cone
    if (remote && !remote.dead) {
      const to = remote.group.position.clone().add(new THREE.Vector3(0, 1, 0)).sub(origin);
      const d = to.length();
      if (d < 3.2 && to.normalize().dot(dir) > 0.7) {
        net?.send({ t: 'pvp', dmg: prog.swordDamage });
        sfx.hit();
      }
    }
  };
  player.onSwingStart = () => sfx.swing();
  player.onDamaged = (dmg) => {
    ui.damageFlash();
    sfx.hurt();
  };

  ui.updateProgression(prog);
  ui.updateHp(player.hp, player.maxHp);
  ui.showGame();
  ui.hideKO();
  input.enable();
  running = true;
}

function grantXP(xp, sourceName) {
  prog.addXP(xp);
  sfx.xp();
  ui.feed(`+${xp} XP — ${sourceName} defeated!`, 'gold');
}

function hitLocalPlayer(dmg) {
  if (!player || player.dead) return;
  player.takeDamage(dmg, prog.damageReduction);
  ui.updateHp(player.hp, player.maxHp);
  if (player.dead) {
    respawnTimer = 2.6;
    ui.showKO('Respawning…');
    net?.send({ t: 'ko' });
  }
}

/* ================= upgrades ================= */

// Desktop plays with pointer lock, so mouse clicks can't reach the HUD —
// upgrades are on hotkeys there. (Touch players just tap the buttons.)
window.addEventListener('keydown', (e) => {
  if (!running) return;
  if (e.code === 'Digit1') ui.onUpgrade?.('sword');
  if (e.code === 'Digit2') ui.onUpgrade?.('armor');
});

ui.onUpgrade = (kind) => {
  if (!prog || !prog.upgrade(kind)) return;
  const tierIdx = kind === 'sword' ? prog.swordTier : prog.armorTier;
  const tier = TIERS[tierIdx];
  sfx.upgrade();
  if (kind === 'sword') player.setSwordTier(tierIdx);
  const label = kind === 'sword' ? 'Sword' : 'Armor';
  if (tierIdx === MAX_TIER) {
    ui.feed(`🟪 BEDROCK ${label.toUpperCase()}!!! MAXIMUM POWER!!!`, 'epic');
  } else {
    ui.feed(`⬆️ ${tier.name} ${label} unlocked!`, 'gold');
  }
};

/* ================= menu flow ================= */

ui.onSolo = () => {
  sfx.unlock();
  clearSession();
  startSession({ asMode: 'solo', seed: (Math.random() * 0xffffffff) >>> 0 });
};

ui.onHost = (name) => {
  sfx.unlock();
  clearSession();
  myName = name;
  net = new Net();
  const tryHost = () => {
    const code = generateCode();
    ui.setHostCode(code);
    ui.setHostStatus('Waiting for a friend to join…');
    net.host(code, {
      onFailure: (why) => {
        if (why === 'code-taken') tryHost();
        else ui.setHostStatus('Connection trouble — check your internet.');
      },
    });
  };
  const seed = (Math.random() * 0xffffffff) >>> 0;
  net.onConnected = () => {
    net.send({ t: 'init', seed, name: myName });
    startSession({ asMode: 'host', seed });
    spawnRemote();
    ui.setNetBadge('🟢 Friend connected');
  };
  net.onMessage = handleNetMessage;
  net.onClosed = () => onPeerLost();
  tryHost();
};

ui.onJoin = (name, code) => {
  sfx.unlock();
  clearSession();
  myName = name;
  net = new Net();
  ui.setJoinStatus('Connecting…');
  net.onStatus = (s) => {
    const msgs = {
      signaling: 'Contacting matchmaking…',
      'room-found': 'Room found, connecting…',
      negotiating: 'Linking up with the host…',
    };
    if (msgs[s]) ui.setJoinStatus(msgs[s]);
  };
  net.onConnected = () => {
    ui.setJoinStatus('Connected! Waiting for the world…');
    net.send({ t: 'hello', name: myName });
  };
  net.onMessage = handleNetMessage;
  net.onClosed = () => onPeerLost();
  net.join(code, {
    onFailure: (why) => {
      const msgs = {
        'no-such-room': 'No room with that code!',
        timeout: 'Could not reach the host — try again.',
        'ice-failed': 'Connection blocked — try different WiFi.',
      };
      ui.setJoinStatus(msgs[why] || 'Connection trouble — try again.');
    },
  });
};

ui.onBackToMenu = () => {
  clearSession();
  ui.showMenu();
};

function onPeerLost() {
  if (!running) return;
  ui.showDisconnect();
  running = false;
  input.disable();
}

function spawnRemote() {
  remote = new AnimeCharacter(scene, {
    name: peerName,
    hairColor: mode === 'host' ? 0x4a6cff : 0xff5d8f,
    outfit: mode === 'host' ? 0xd93a5f : 0x4a6cff,
  });
  remote.netPos.copy(world.spawnPoint(0, mode === 'host' ? 1 : 0));
  remote.group.position.copy(remote.netPos);
}

/* ================= network protocol ================= */

function handleNetMessage(msg) {
  switch (msg.t) {
    case 'hello': // host learns the joiner's name
      peerName = msg.name || 'Friend';
      remote?.setName(peerName);
      break;
    case 'init': // client receives the world
      peerName = msg.name || 'Friend';
      startSession({ asMode: 'client', seed: msg.seed });
      spawnRemote();
      ui.setNetBadge('🟢 Playing with ' + peerName);
      break;
    case 'p': // other player's state
      if (remote) remote.applyState(msg);
      break;
    case 'm': // monster snapshot (client only)
      if (mode === 'client' && monsters) monsters.applySnapshot(msg.list);
      break;
    case 'hitm': // client hit a monster (host only)
      if (mode === 'host' && monsters) {
        monsters.damage(msg.id, msg.dmg, 'remote', remote?.group.position);
      }
      break;
    case 'mkill': // you (the client) killed a monster
      if (mode === 'client') {
        grantXP(msg.xp, MONSTER_TYPES[msg.name]?.name || 'Monster');
        sfx.monsterDie();
      }
      break;
    case 'phit': // a monster hit you (client)
      if (mode === 'client') hitLocalPlayer(msg.dmg);
      break;
    case 'pvp': // the other player's sword hit you
      hitLocalPlayer(msg.dmg);
      break;
    case 'ko': // you KO'd the other player
      grantXP(PVP_KO_XP, peerName);
      ui.feed(`⚔️ You bonked ${peerName}! +${PVP_KO_XP} XP`, 'epic');
      break;
  }
}

function sendState() {
  if (!net?.connected || !player) return;
  net.send({
    t: 'p',
    x: +player.position.x.toFixed(2),
    y: +player.position.y.toFixed(2),
    z: +player.position.z.toFixed(2),
    yaw: +player.yaw.toFixed(2),
    hp: Math.round(player.hp),
    sword: prog.swordTier,
    armor: prog.armorTier,
    swing: player.swinging > 0 ? 1 : 0,
    dead: player.dead ? 1 : 0,
  });
}

/* ================= portals ================= */

function checkPortal(dt) {
  portalCooldown -= dt;
  const nearPortal = world.portalNear(player.position, 6);
  const atPortal = world.portalNear(player.position, 2.1);
  ui.showPortalHint(!!nearPortal && !atPortal && portalCooldown <= 0);
  if (portalCooldown > 0 || !atPortal) return;
  const portal = atPortal;
  const target = portal.userData.targetWorld;
  portalCooldown = 3;
  currentWorldId = target;
  player.spawnAt(world.spawnPoint(target, mode === 'client' ? 1 : 0));
  player.hp = Math.max(player.hp, 40); // arriving somewhere new shouldn't be instant death
  applyAtmosphere(scene, lights, target);
  ui.setWorldLabel(WORLD_DEFS[target].name);
  ui.feed(target === 1 ? '🌋 Welcome to the VOLCANO WORLD!' : '🌾 Back to the Plains!', 'epic');
  ui.updateHp(player.hp, player.maxHp);
  sfx.portal();
}

/* ================= main loop ================= */

const clock = new THREE.Clock();

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  if (running && player) {
    player.update(dt);
    world.update(dt, time);

    if (player.dead && respawnTimer > 0) {
      respawnTimer -= dt;
      if (respawnTimer <= 0) {
        player.spawnAt(world.spawnPoint(currentWorldId, mode === 'client' ? 1 : 0));
        ui.hideKO();
        ui.updateHp(player.hp, player.maxHp);
      }
    }

    const combatants = [player];
    if (remote && net?.connected && mode !== 'client') combatants.push(remote);
    monsters.update(dt, time, combatants);
    remote?.update(dt);

    checkPortal(dt);

    // hp regen display
    ui.updateHp(player.hp, player.maxHp);

    // network send cadence
    if (net?.connected) {
      sendAcc += dt;
      if (sendAcc > 0.05) { sendAcc = 0; sendState(); }
      if (mode === 'host') {
        snapAcc += dt;
        if (snapAcc > 0.12) { snapAcc = 0; net.send({ t: 'm', list: monsters.snapshot() }); }
      }
    }

    // keep the shadow camera centered on the world you're in
    lights.sun.target.updateMatrixWorld();
  }

  if (composer) composer.render();
  else renderer.render(scene, camera);
}

ui.showMenu();
tick();

// Tiny debug handle so automated smoke tests can verify combat/progression
// without simulating perfect mouse aim. Does nothing unless poked.
window.__sq = {
  get state() {
    return {
      mode, running,
      worldId: currentWorldId,
      xp: prog?.xp ?? -1,
      swordTier: prog?.swordTier ?? -1,
      armorTier: prog?.armorTier ?? -1,
      hp: player ? Math.round(player.hp) : -1,
      monsters: monsters ? monsters.monsters.size : -1,
      pos: player ? player.position.toArray().map((v) => +v.toFixed(1)) : null,
    };
  },
  // walk the player right up to the nearest living monster and face it
  gotoNearestMonster() {
    if (!player || !monsters) return false;
    let best = null, bd = Infinity;
    for (const m of monsters.monsters.values()) {
      if (m.state === 'dead') continue;
      if (world.worldIdAt(m.group.position.x) !== currentWorldId) continue;
      const d = m.group.position.distanceTo(player.position);
      if (d < bd) { bd = d; best = m; }
    }
    if (!best) return false;
    const p = best.group.position;
    player.position.set(p.x + 1.6, world.heightAt(p.x + 1.6, p.z), p.z);
    player.yaw = Math.atan2(-(p.x - player.position.x), -(p.z - player.position.z));
    player.pitch = 0;
    return true;
  },
  swing() { if (player) { player.swinging = 0.0001; player._swingHitDone = false; player.onSwing?.(); } },
  addXP(n) { prog?.addXP(n); },
  teleportToPortal() {
    if (!player || !world) return false;
    const portal = world.portals.find((p) => p.userData.targetWorld !== currentWorldId && world.worldIdAt(p.position.x) === currentWorldId);
    if (!portal) return false;
    player.position.set(portal.position.x, world.heightAt(portal.position.x, portal.position.z), portal.position.z);
    return true;
  },
};
