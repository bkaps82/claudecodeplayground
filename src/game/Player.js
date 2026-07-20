import * as THREE from 'three';
import { buildSword } from './Sword.js';
import { createToonPart } from './ToonUtils.js';

const EYE_HEIGHT = 1.6;
const MOVE_SPEED = 6.2;
const JUMP_SPEED = 6.5;
const GRAVITY = 18;
const SWING_TIME = 0.42;
const SWING_HIT_AT = 0.35; // fraction of the swing when the hit lands
const REGEN_DELAY = 4.5;
const REGEN_RATE = 9;

// First-person controller: movement, look, jumping, swing timing, health.
// The visible right arm + sword ("viewmodel") hangs off the camera so it
// bobs and swings with your view like a proper FPS.
export class Player {
  constructor(camera, world, input) {
    this.camera = camera;
    this.world = world;
    this.input = input;   // { move:{x,z}, consumeLook():{x,y}, attackPressed(), jumpPressed() }

    this.id = 'local';
    this.position = new THREE.Vector3();
    this.velY = 0;
    this.grounded = true;
    this.yaw = 0;
    this.pitch = 0;

    this.maxHp = 100;
    this.hp = this.maxHp;
    this.dead = false;
    this.sinceDamage = 99;

    this.swinging = 0;      // countdown; >0 means mid-swing
    this._swingHitDone = false;
    this.onSwing = null;    // fired at the moment the swing should hit-test
    this.onDamaged = null;  // (dmg) => void, HUD hook

    this._buildViewmodel();
  }

  _buildViewmodel() {
    this.viewmodel = new THREE.Group();
    // anchored bottom-right of the view
    this.viewmodel.position.set(0.42, -0.42, -0.75);
    this.camera.add(this.viewmodel);

    const arm = createToonPart(new THREE.CapsuleGeometry(0.07, 0.4, 4, 8), 0xf0c8a0, { outlineScale: 1.04 });
    arm.group.rotation.x = -Math.PI / 2.6;
    arm.group.position.set(0, -0.1, 0.18);
    this.viewmodel.add(arm.group);

    this.swordMount = new THREE.Group();
    this.swordMount.position.set(0, 0.12, -0.05);
    this.swordMount.rotation.set(-0.5, 0, -0.15);
    this.viewmodel.add(this.swordMount);
    this.setSwordTier(0);

    // viewmodel must render on top of the world but still light like it
    this.viewmodel.traverse((o) => { o.frustumCulled = false; });
  }

  setSwordTier(tierIdx) {
    if (this._swordObj) this.swordMount.remove(this._swordObj);
    this._swordObj = buildSword(tierIdx);
    this._swordObj.traverse((o) => { o.frustumCulled = false; });
    this.swordMount.add(this._swordObj);
  }

  spawnAt(pos) {
    this.position.copy(pos);
    this.velY = 0;
    this.hp = this.maxHp;
    this.dead = false;
    this.sinceDamage = 99;
  }

  takeDamage(amount, reduction, fromPos) {
    if (this.dead) return;
    const dmg = Math.max(1, Math.round(amount * (1 - reduction)));
    this.hp -= dmg;
    this.sinceDamage = 0;
    this.onDamaged?.(dmg, fromPos);
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
    }
  }

  get lookDir() {
    const d = new THREE.Vector3();
    this.camera.getWorldDirection(d);
    return d;
  }

  update(dt) {
    // look
    const look = this.input.consumeLook();
    this.yaw -= look.x;
    this.pitch = THREE.MathUtils.clamp(this.pitch - look.y, -1.45, 1.45);

    if (!this.dead) {
      // move relative to yaw
      const mv = this.input.move;
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      const dx = (mv.x * cos - mv.z * sin);
      const dz = (-mv.x * sin - mv.z * cos);
      const len = Math.hypot(dx, dz);
      const boost = len > 0 ? 1 / Math.max(1, len) : 0;
      this.position.x += dx * boost * MOVE_SPEED * dt;
      this.position.z += dz * boost * MOVE_SPEED * dt;
      this.moving = len > 0.05;

      // jump + gravity, terrain as the floor
      const ground = this.world.heightAt(this.position.x, this.position.z);
      if (this.input.jumpPressed() && this.grounded) {
        this.velY = JUMP_SPEED;
        this.grounded = false;
      }
      this.velY -= GRAVITY * dt;
      this.position.y += this.velY * dt;
      if (this.position.y <= ground) {
        this.position.y = ground;
        this.velY = 0;
        this.grounded = true;
      }
      this.world.clampToWorld(this.position);

      // attack
      if (this.swinging <= 0 && this.input.attackPressed()) {
        this.swinging = SWING_TIME;
        this._swingHitDone = false;
        this.onSwingStart?.();
      }
    }

    if (this.swinging > 0) {
      this.swinging -= dt;
      const t = 1 - this.swinging / SWING_TIME; // 0 → 1
      if (!this._swingHitDone && t >= SWING_HIT_AT) {
        this._swingHitDone = true;
        this.onSwing?.();
      }
      // wind up then slash down-across
      const arc = Math.sin(t * Math.PI);
      this.swordMount.rotation.x = -0.5 - arc * 1.9;
      this.swordMount.rotation.z = -0.15 + arc * 0.9;
      this.viewmodel.position.z = -0.75 - arc * 0.22;
    } else {
      this.swordMount.rotation.x = -0.5;
      this.swordMount.rotation.z = -0.15;
    }

    // health regen out of combat
    this.sinceDamage += dt;
    if (!this.dead && this.sinceDamage > REGEN_DELAY && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + REGEN_RATE * dt);
    }

    // camera follows
    const t = performance.now() / 1000;
    const bob = this.moving && this.grounded ? Math.sin(t * 9.5) * 0.045 : 0;
    this.camera.position.set(this.position.x, this.position.y + EYE_HEIGHT + bob, this.position.z);
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotateY(this.yaw);
    this.camera.rotateX(this.pitch);

    // gentle viewmodel sway
    this.viewmodel.position.x = 0.42 + Math.sin(t * 4.4) * 0.006 + look.x * 0.3;
    this.viewmodel.position.y = -0.42 + Math.cos(t * 8.8) * 0.008 - (this.moving ? Math.abs(Math.sin(t * 9.5)) * 0.02 : 0);
  }
}
