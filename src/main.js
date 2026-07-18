import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

import { Character } from './engine/Character.js';
import { PaintSystem, HIT_AMOUNT } from './engine/PaintSystem.js';
import { buildArena, PLAY_RADIUS } from './engine/Arena.js';
import { Controls } from './engine/Controls.js';
import { UI } from './engine/UI.js';
import { SFX } from './engine/Audio.js';
import { TouchPad, isTouchDevice } from './engine/TouchControls.js';
import { Net, generateCode } from './engine/Net.js';
import './style.css';

const MOVE_SPEED = 3.35;
const NET_SEND_INTERVAL = 0.05; // 20 Hz
const PAINT_COLORS = [0x4fd3ff, 0xff4f7d];

const touch = isTouchDevice();
if (touch) document.body.classList.add('touch');

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, touch ? 1.75 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.98;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 60);
camera.position.set(0, 6, 9);

buildArena(scene);

const p1 = new Character({
  name: 'SHIRO',
  outfitColor: 0x1c5f8a,
  skinColor: 0xffe0c9,
  hairColor: 0xeaf3ff,
  irisColor: '#4fd3ff',
  paintColor: PAINT_COLORS[0],
  spawnZ: -3,
});
const p2 = new Character({
  name: 'AKA',
  outfitColor: 0x7a1230,
  skinColor: 0xffe0c9,
  hairColor: 0x2a0a10,
  irisColor: '#ff4f7d',
  paintColor: PAINT_COLORS[1],
  spawnZ: 3,
});
scene.add(p1.root, p2.root);
const characters = [p1, p2];

const paintSystem = new PaintSystem(scene);
const controls = new Controls();
const ui = new UI();
const sfx = new SFX();

paintSystem.onHit = () => {
  sfx.splat();
  screenShake(0.16, 0.06);
};

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.55,
  0.4,
  0.86
);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  // widen the view in portrait so both fighters stay on screen on phones
  camera.fov = camera.aspect < 0.9 ? 58 : 42;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloomPass.setSize(w, h);
}
window.addEventListener('resize', onResize);
onResize();

// ---------- game state ----------
let state = 'menu'; // menu | hosting | countdown | playing | gameover
let netRole = null; // null (local) | 'host' | 'client'
let net = null;
let localIdx = 0;   // which fighter this device controls in online mode
let matchTime = 0;
let menuOrbit = 0;
let shakeTime = 0;
let shakeMag = 0;
let netSendTimer = 0;
let remoteMove = { x: 0, z: 0 };
let remoteAttackPending = false;
let snapshotTarget = null; // latest snapshot for client-side interpolation

const touchPads = [];

function screenShake(duration, magnitude) {
  shakeTime = duration;
  shakeMag = Math.max(shakeMag, magnitude);
}

function lerpAngle(a, b, t) {
  let diff = b - a;
  diff = ((diff + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + diff * t;
}

function faceOpponent(self, opponent, dt) {
  const dx = opponent.root.position.x - self.root.position.x;
  const dz = opponent.root.position.z - self.root.position.z;
  if (Math.hypot(dx, dz) < 0.001) return;
  const target = Math.atan2(dx, dz);
  self.root.rotation.y = lerpAngle(self.root.rotation.y, target, Math.min(1, dt * 10));
}

function moveCharacter(character, moveVec, dt) {
  const pos = character.root.position;
  let nx = pos.x + moveVec.x * MOVE_SPEED * dt;
  let nz = pos.z + moveVec.z * MOVE_SPEED * dt;
  const dist = Math.hypot(nx, nz);
  if (dist > PLAY_RADIUS) {
    const scale = PLAY_RADIUS / dist;
    nx *= scale;
    nz *= scale;
  }
  pos.x = nx;
  pos.z = nz;

  const rotY = character.root.rotation.y;
  const rightX = Math.cos(rotY);
  const rightZ = -Math.sin(rotY);
  const lateral = moveVec.x * rightX + moveVec.z * rightZ;

  return {
    speedFactor: Math.min(1, Math.hypot(moveVec.x, moveVec.z)),
    moveInput: lateral,
  };
}

// ---------- touch pads ----------

function clearTouchPads() {
  for (const pad of touchPads) pad.dispose();
  touchPads.length = 0;
  controls.touchSources[0] = null;
  controls.touchSources[1] = null;
}

function setupTouchPads() {
  clearTouchPads();
  if (!touch) return;
  const container = document.getElementById('touch-root');
  if (netRole === null) {
    const padL = new TouchPad({
      container, side: 'left', accentVar: '--p1',
      onAttack: () => controls.queueAttack(0),
    });
    const padR = new TouchPad({
      container, side: 'right', accentVar: '--p2',
      onAttack: () => controls.queueAttack(1),
    });
    touchPads.push(padL, padR);
    controls.touchSources[0] = padL;
    controls.touchSources[1] = padR;
  } else {
    const pad = new TouchPad({
      container, side: 'solo', accentVar: localIdx === 0 ? '--p1' : '--p2',
      onAttack: () => {
        if (netRole === 'client') sendClientAttack();
        else controls.queueAttack(0);
      },
    });
    touchPads.push(pad);
    controls.touchSources[localIdx === 0 ? 0 : 1] = pad;
  }
}

// ---------- online plumbing ----------

const _v3a = new THREE.Vector3();
const _v3b = new THREE.Vector3();
const _v3c = new THREE.Vector3();

function sendClientAttack() {
  if (!controls.enabled) return;
  net?.send({ t: 'atk' });
  // predict the swing locally so the button feels instant
  if (characters[localIdx].startAttack()) sfx.swing();
}

function hostBroadcastHooks() {
  paintSystem.onSpawn = ({ id, origin, dir, owner }) => {
    net?.send({ t: 'spawn', id, o: origin.toArray(), d: dir.toArray(), owner });
  };
  paintSystem.onHitInfo = (info) => {
    net?.send({ t: 'hit', ...info });
  };
}

function clearNetHooks() {
  paintSystem.onSpawn = null;
  paintSystem.onHitInfo = null;
}

function handleHostMessage(msg) {
  // messages arriving AT the host FROM the client
  if (msg.t === 'input') {
    remoteMove.x = msg.mx;
    remoteMove.z = msg.mz;
  } else if (msg.t === 'atk') {
    remoteAttackPending = true;
  } else if (msg.t === 'restart-req') {
    if (state === 'gameover') hostStartMatch();
  }
}

function handleClientMessage(msg) {
  // messages arriving AT the client FROM the host
  if (msg.t === 'snap') {
    snapshotTarget = msg;
  } else if (msg.t === 'atk') {
    const ch = characters[msg.p];
    if (!(msg.p === localIdx && ch.attackState)) {
      if (ch.startAttack()) sfx.swing();
    }
  } else if (msg.t === 'spawn') {
    paintSystem.spawn({
      origin: _v3a.fromArray(msg.o).clone(),
      dir: _v3b.fromArray(msg.d),
      color: PAINT_COLORS[msg.owner],
      owner: msg.owner,
      id: msg.id,
    });
  } else if (msg.t === 'hit') {
    paintSystem.removeById(msg.id);
    const target = characters[msg.targetIdx];
    const point = _v3a.fromArray(msg.point);
    const normal = _v3b.fromArray(msg.normal);
    target.applyPaintHit(msg.part, point, normal, PAINT_COLORS[msg.owner], HIT_AMOUNT);
    paintSystem.spawnBurst(point, normal, PAINT_COLORS[msg.owner]);
  } else if (msg.t === 'over') {
    characters[msg.loser].triggerDefeat();
    endRound(characters[1 - msg.loser], msg.loser === 0 ? 'p2' : 'p1');
  } else if (msg.t === 'start') {
    clientStartMatch();
  }
}

function teardownNet(showMessage) {
  net?.dispose();
  net = null;
  netRole = null;
  localIdx = 0;
  snapshotTarget = null;
  remoteMove = { x: 0, z: 0 };
  remoteAttackPending = false;
  paintSystem.applyHits = true;
  clearNetHooks();
  clearTouchPads();
  if (showMessage) {
    state = 'menu';
    controls.enabled = false;
    ui.hideHUD();
    ui.hideGameOver();
    ui.hideHostScreen();
    ui.hideCountdown();
    ui.showMenu();
    ui.setNetStatus(showMessage);
  }
}

function attachCommonNetHandlers() {
  net.onClosed = () => teardownNet('Opponent disconnected.');
}

// ---------- match flow ----------

function resetMatchState() {
  p1.reset(-3);
  p2.reset(3);
  paintSystem.clear();
  matchTime = 0;
  controls.enabled = false;
  controls.clearQueues();
  ui.hideGameOver();
  ui.hideHostScreen();
  ui.hideMenu();
  ui.showHUD();
  ui.updateCoverage(0, p1.getPartsCoverage(), 0, p2.getPartsCoverage());
}

function countdownStep(n, resolve) {
  if (n > 0) {
    ui.showCountdown(String(n));
    setTimeout(() => countdownStep(n - 1, resolve), 700);
  } else {
    ui.showCountdown('FIGHT!');
    setTimeout(() => {
      ui.hideCountdown();
      resolve();
    }, 550);
  }
}

function runCountdownThenPlay() {
  state = 'countdown';
  countdownStep(3, () => {
    controls.enabled = true;
    state = 'playing';
  });
}

function startLocalMatch() {
  netRole = null;
  setupTouchPads();
  resetMatchState();
  runCountdownThenPlay();
}

function hostStartMatch() {
  net?.send({ t: 'start' });
  setupTouchPads();
  resetMatchState();
  runCountdownThenPlay();
}

function clientStartMatch() {
  setupTouchPads();
  resetMatchState();
  runCountdownThenPlay();
}

function endRound(winner, colorClass) {
  state = 'gameover';
  controls.enabled = false;
  controls.clearQueues();
  sfx.victory();
  ui.showGameOver(winner.name, colorClass);
}

// ---------- per-frame updates ----------

function updatePlayingHostOrLocal(dt) {
  matchTime += dt;
  const mm = String(Math.floor(matchTime / 60)).padStart(2, '0');
  const ss = String(Math.floor(matchTime % 60)).padStart(2, '0');
  ui.setRoundTimer(`${mm}:${ss}`);

  const p1Move = controls.getMove(0);
  const p2Move = netRole === 'host' ? remoteMove : controls.getMove(1);
  const p1Anim = moveCharacter(p1, p1Move, dt);
  const p2Anim = moveCharacter(p2, p2Move, dt);

  faceOpponent(p1, p2, dt);
  faceOpponent(p2, p1, dt);

  const p1Attack = controls.consumeAttack(0) || (netRole === 'host' && controls.consumeAttack(1));
  if (p1Attack && p1.startAttack()) {
    sfx.swing();
    if (netRole === 'host') net?.send({ t: 'atk', p: 0 });
  }
  const p2Attack = netRole === 'host' ? remoteAttackPending : controls.consumeAttack(1);
  remoteAttackPending = false;
  if (p2Attack && p2.startAttack()) {
    sfx.swing();
    if (netRole === 'host') net?.send({ t: 'atk', p: 1 });
  }

  const p1Tip = p1.update(dt, p1Anim);
  const p2Tip = p2.update(dt, p2Anim);

  if (p1Tip) {
    paintSystem.spawn({ origin: p1Tip, targetPos: p2.getAimPoint(_v3c).clone(), color: p1.paintColor, owner: 0 });
  }
  if (p2Tip) {
    paintSystem.spawn({ origin: p2Tip, targetPos: p1.getAimPoint(_v3c).clone(), color: p2.paintColor, owner: 1 });
  }

  paintSystem.update(dt, characters);

  ui.updateCoverage(p1.getOverallCoverage(), p1.getPartsCoverage(), p2.getOverallCoverage(), p2.getPartsCoverage());

  if (netRole === 'host') {
    netSendTimer -= dt;
    if (netSendTimer <= 0) {
      netSendTimer = NET_SEND_INTERVAL;
      net?.send({
        t: 'snap',
        pl: characters.map((c, i) => ({
          x: c.root.position.x,
          z: c.root.position.z,
          ry: c.root.rotation.y,
          sf: i === 0 ? p1Anim.speedFactor : p2Anim.speedFactor,
        })),
        mt: matchTime,
      });
    }
  }

  let loser = -1;
  if (p1.isFullyCovered()) loser = 0;
  else if (p2.isFullyCovered()) loser = 1;
  if (loser >= 0) {
    characters[loser].triggerDefeat();
    if (netRole === 'host') net?.send({ t: 'over', loser });
    endRound(characters[1 - loser], loser === 0 ? 'p2' : 'p1');
  }
}

function updatePlayingClient(dt) {
  matchTime = snapshotTarget?.mt ?? matchTime + dt;
  const mm = String(Math.floor(matchTime / 60)).padStart(2, '0');
  const ss = String(Math.floor(matchTime % 60)).padStart(2, '0');
  ui.setRoundTimer(`${mm}:${ss}`);

  // send our input to the host
  netSendTimer -= dt;
  if (netSendTimer <= 0) {
    netSendTimer = NET_SEND_INTERVAL;
    const m0 = controls.getMove(0);
    const m1 = controls.getMove(1);
    const mx = m0.x || m1.x;
    const mz = m0.z || m1.z;
    net?.send({ t: 'input', mx, mz });
  }
  if (controls.consumeAttack(0) || controls.consumeAttack(1)) sendClientAttack();

  // interpolate toward the latest authoritative snapshot
  if (snapshotTarget) {
    const k = Math.min(1, dt * 12);
    snapshotTarget.pl.forEach((s, i) => {
      const c = characters[i];
      c.root.position.x += (s.x - c.root.position.x) * k;
      c.root.position.z += (s.z - c.root.position.z) * k;
      c.root.rotation.y = lerpAngle(c.root.rotation.y, s.ry, k);
      c.update(dt, { speedFactor: s.sf, moveInput: 0 });
    });
  } else {
    p1.update(dt, {});
    p2.update(dt, {});
  }

  paintSystem.update(dt, characters); // applyHits=false: visual flight only

  ui.updateCoverage(p1.getOverallCoverage(), p1.getPartsCoverage(), p2.getOverallCoverage(), p2.getPartsCoverage());
}

function updateIdle(dt) {
  faceOpponent(p1, p2, dt);
  faceOpponent(p2, p1, dt);
  p1.update(dt, { speedFactor: 0, moveInput: 0 });
  p2.update(dt, { speedFactor: 0, moveInput: 0 });
  paintSystem.update(dt, characters);
}

const _camTarget = new THREE.Vector3();
const _midPoint = new THREE.Vector3();
const _p1World = new THREE.Vector3();
const _p2World = new THREE.Vector3();

function updateCamera(dt) {
  if (state === 'menu' || state === 'hosting') {
    menuOrbit += dt * 0.12;
    const r = 7.5;
    _camTarget.set(Math.cos(menuOrbit) * r, 3.6, Math.sin(menuOrbit) * r);
    camera.position.lerp(_camTarget, Math.min(1, dt * 2));
    camera.lookAt(0, 1.1, 0);
  } else {
    p1.getCenterWorldPosition(_p1World);
    p2.getCenterWorldPosition(_p2World);
    _midPoint.addVectors(_p1World, _p2World).multiplyScalar(0.5);
    const spread = _p1World.distanceTo(_p2World);
    const portrait = camera.aspect < 0.9;
    const zoom = THREE.MathUtils.clamp(spread * 0.85 + (portrait ? 5.6 : 4.8), portrait ? 7.5 : 6.5, portrait ? 12 : 10.5);
    _camTarget.set(_midPoint.x * 0.55, 3.3 + zoom * 0.16, _midPoint.z * 0.55 + zoom);
    camera.position.lerp(_camTarget, Math.min(1, dt * 3.2));
    camera.lookAt(_midPoint.x, 1.05, _midPoint.z);
  }

  if (shakeTime > 0) {
    shakeTime -= dt;
    const s = shakeMag * (shakeTime > 0 ? 1 : 0);
    camera.position.x += (Math.random() - 0.5) * s;
    camera.position.y += (Math.random() - 0.5) * s;
    if (shakeTime <= 0) shakeMag = 0;
  }
}

// ---------- menu actions ----------

ui.startBtn.addEventListener('click', () => {
  sfx.unlock();
  ui.setNetStatus('');
  startLocalMatch();
});

ui.hostBtn.addEventListener('click', () => {
  sfx.unlock();
  ui.setNetStatus('');
  beginHosting();
});

function beginHosting(attempt = 0) {
  if (attempt > 4) {
    teardownNet('Could not claim a room code. Try again.');
    return;
  }
  net?.dispose();
  net = new Net();
  netRole = 'host';
  localIdx = 0;
  const code = generateCode();
  state = 'hosting';
  ui.hideMenu();
  ui.showHostScreen(code);

  net.host(code, {
    onFailure: (reason) => {
      if (reason === 'code-taken') {
        beginHosting(attempt + 1);
      } else {
        teardownNet(`Connection failed (${reason}). Online play needs an internet-hosted build.`);
      }
    },
  });
  net.onMessage = handleHostMessage;
  net.onConnected = () => {
    attachCommonNetHandlers();
    hostBroadcastHooks();
    paintSystem.applyHits = true;
    hostStartMatch();
  };
}

ui.joinBtn.addEventListener('click', () => {
  sfx.unlock();
  ui.setNetStatus('');
  ui.toggleJoinRow(!ui.joinRow.classList.contains('hidden') ? false : true);
});

ui.joinGoBtn.addEventListener('click', doJoin);
ui.joinCodeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.stopPropagation();
    doJoin();
  }
});

function doJoin() {
  const code = ui.joinCodeInput.value.trim();
  if (!/^\d{4}$/.test(code)) {
    ui.setNetStatus('Enter the 4-digit code from the host.');
    return;
  }
  net?.dispose();
  net = new Net();
  netRole = 'client';
  localIdx = 1;
  ui.setNetStatus('Connecting…');

  net.join(code, {
    onFailure: (reason) => {
      const msgs = {
        'no-such-room': 'No room with that code. Double-check with the host.',
        timeout: 'Could not reach the host. Both devices need internet.',
      };
      teardownNet(msgs[reason] || `Connection failed (${reason}).`);
    },
  });
  net.onMessage = handleClientMessage;
  net.onConnected = () => {
    attachCommonNetHandlers();
    clearNetHooks();
    paintSystem.applyHits = false;
    ui.setNetStatus('');
    // host sends {t:'start'} when ready; match begins on receipt
  };
}

ui.hostCancelBtn.addEventListener('click', () => {
  teardownNet('');
  state = 'menu';
  ui.hideHostScreen();
  ui.showMenu();
});

ui.restartBtn.addEventListener('click', () => {
  sfx.unlock();
  if (netRole === 'client') {
    net?.send({ t: 'restart-req' });
    ui.setNetStatus('');
    return; // host will send {t:'start'}
  }
  if (netRole === 'host') {
    hostStartMatch();
    return;
  }
  startLocalMatch();
});

// ---------- main loop ----------

const clock = new THREE.Clock();

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);

  if (state === 'playing') {
    if (netRole === 'client') updatePlayingClient(dt);
    else updatePlayingHostOrLocal(dt);
  } else {
    updateIdle(dt);
  }
  updateCamera(dt);

  composer.render();
}

renderer.setAnimationLoop(animate);

ui.hideLoading();
ui.showMenu();
