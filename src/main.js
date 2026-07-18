import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

import { Character } from './engine/Character.js';
import { PaintSystem } from './engine/PaintSystem.js';
import { buildArena, PLAY_RADIUS } from './engine/Arena.js';
import { Controls } from './engine/Controls.js';
import { UI } from './engine/UI.js';
import { SFX } from './engine/Audio.js';
import './style.css';

const MOVE_SPEED = 3.35;

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
  paintColor: 0x4fd3ff,
  spawnZ: -3,
});
const p2 = new Character({
  name: 'AKA',
  outfitColor: 0x7a1230,
  skinColor: 0xffe0c9,
  hairColor: 0x2a0a10,
  irisColor: '#ff4f7d',
  paintColor: 0xff4f7d,
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
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloomPass.setSize(w, h);
}
window.addEventListener('resize', onResize);

// ---------- game state ----------
let state = 'menu'; // menu | countdown | playing | gameover
let matchTime = 0;
let menuOrbit = 0;
let shakeTime = 0;
let shakeMag = 0;

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

const _targetPos = new THREE.Vector3();

function updatePlaying(dt) {
  matchTime += dt;
  const mm = String(Math.floor(matchTime / 60)).padStart(2, '0');
  const ss = String(Math.floor(matchTime % 60)).padStart(2, '0');
  ui.setRoundTimer(`${mm}:${ss}`);

  const p1Move = controls.getMove(0);
  const p2Move = controls.getMove(1);
  const p1Anim = moveCharacter(p1, p1Move, dt);
  const p2Anim = moveCharacter(p2, p2Move, dt);

  faceOpponent(p1, p2, dt);
  faceOpponent(p2, p1, dt);

  if (controls.consumeAttack(0) && p1.startAttack()) sfx.swing();
  if (controls.consumeAttack(1) && p2.startAttack()) sfx.swing();

  const p1Tip = p1.update(dt, p1Anim);
  const p2Tip = p2.update(dt, p2Anim);

  if (p1Tip) {
    paintSystem.spawn({
      origin: p1Tip,
      targetPos: p2.getAimPoint(_targetPos).clone(),
      color: p1.paintColor,
      owner: 0,
    });
  }
  if (p2Tip) {
    paintSystem.spawn({
      origin: p2Tip,
      targetPos: p1.getAimPoint(_targetPos).clone(),
      color: p2.paintColor,
      owner: 1,
    });
  }

  paintSystem.update(dt, characters);

  ui.updateCoverage(p1.getOverallCoverage(), p1.getPartsCoverage(), p2.getOverallCoverage(), p2.getPartsCoverage());

  if (p1.isFullyCovered()) {
    p1.triggerDefeat();
    endRound(p2, 'p2');
  } else if (p2.isFullyCovered()) {
    p2.triggerDefeat();
    endRound(p1, 'p1');
  }
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
  if (state === 'menu') {
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
    const zoom = THREE.MathUtils.clamp(spread * 0.85 + 4.8, 6.5, 10.5);
    _camTarget.set(_midPoint.x * 0.55, 3.3 + zoom * 0.16, _midPoint.z * 0.55 + zoom);
    camera.position.lerp(_camTarget, Math.min(1, dt * 3.2));

    let lookY = 1.05;
    camera.lookAt(_midPoint.x, lookY, _midPoint.z);
  }

  if (shakeTime > 0) {
    shakeTime -= dt;
    const s = shakeMag * (shakeTime > 0 ? 1 : 0);
    camera.position.x += (Math.random() - 0.5) * s;
    camera.position.y += (Math.random() - 0.5) * s;
    if (shakeTime <= 0) shakeMag = 0;
  }
}

function endRound(winner, colorClass) {
  state = 'gameover';
  controls.enabled = false;
  controls.clearQueues();
  sfx.victory();
  ui.showGameOver(winner.name === 'SHIRO' ? 'SHIRO' : 'AKA', colorClass);
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

function startMatch() {
  p1.reset(-3);
  p2.reset(3);
  paintSystem.clear();
  matchTime = 0;
  controls.enabled = false;
  controls.clearQueues();
  ui.hideGameOver();
  ui.showHUD();
  ui.updateCoverage(0, p1.getPartsCoverage(), 0, p2.getPartsCoverage());
  state = 'countdown';
  countdownStep(3, () => {
    controls.enabled = true;
    state = 'playing';
  });
}

ui.startBtn.addEventListener('click', () => {
  sfx.unlock();
  ui.hideMenu();
  startMatch();
});

ui.restartBtn.addEventListener('click', () => {
  sfx.unlock();
  ui.hideGameOver();
  ui.hideHUD();
  startMatch();
});

const clock = new THREE.Clock();

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);

  if (state === 'playing') {
    updatePlaying(dt);
  } else {
    updateIdle(dt);
  }
  updateCamera(dt);

  composer.render();
}

renderer.setAnimationLoop(animate);

// reveal menu once everything is constructed
ui.hideLoading();
ui.showMenu();
