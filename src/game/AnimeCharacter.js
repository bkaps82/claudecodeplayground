import * as THREE from 'three';
import { createToonPart, createFaceTexture, makeTextSprite } from './ToonUtils.js';
import { buildSword, buildArmorSet } from './Sword.js';

// The other player, as seen in YOUR world: a chibi anime warrior with big
// eyes, spiky hair, visible armor tier, and their actual sword tier in hand.
export class AnimeCharacter {
  constructor(scene, { hairColor = 0xff5d8f, outfit = 0x4a6cff, name = 'Friend' } = {}) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.dead = false;
    this.id = 'remote';

    // interpolation targets
    this.netPos = new THREE.Vector3();
    this.netYaw = 0;
    this.position = this.group.position; // MonsterManager reads .position

    this._swingT = 0;
    this._walkT = 0;
    this._lastPos = new THREE.Vector3();

    this._build(hairColor, outfit, name);
    scene.add(this.group);
  }

  _build(hairColor, outfit, name) {
    const g = this.group;

    // legs
    [-1, 1].forEach((s) => {
      const leg = createToonPart(new THREE.CapsuleGeometry(0.09, 0.42, 4, 8), 0x2c2c44);
      leg.group.position.set(s * 0.13, 0.4, 0);
      g.add(leg.group);
      if (s < 0) this.legL = leg.group; else this.legR = leg.group;
    });

    // torso
    const torso = createToonPart(new THREE.CapsuleGeometry(0.22, 0.4, 6, 10), outfit);
    torso.group.position.y = 0.95;
    g.add(torso.group);

    // arms
    [-1, 1].forEach((s) => {
      const arm = createToonPart(new THREE.CapsuleGeometry(0.07, 0.38, 4, 8), 0xf0c8a0);
      arm.group.position.set(s * 0.32, 0.98, 0);
      arm.group.rotation.z = s * 0.15;
      g.add(arm.group);
      if (s < 0) this.armL = arm.group; else this.armR = arm.group;
    });

    // head + anime face
    const head = createToonPart(new THREE.SphereGeometry(0.27, 14, 11), 0xffdcb8);
    head.group.position.y = 1.62;
    g.add(head.group);
    this.head = head.group;

    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42, 0.42),
      new THREE.MeshBasicMaterial({ map: createFaceTexture(), transparent: true })
    );
    face.position.set(0, 1.6, 0.245);
    g.add(face);
    this.face = face;

    // spiky anime hair
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const spike = createToonPart(new THREE.ConeGeometry(0.09, 0.3 + (i % 3) * 0.1, 5), hairColor);
      spike.group.position.set(Math.cos(a) * 0.16, 1.85, Math.sin(a) * 0.16 - 0.04);
      spike.group.rotation.set(Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7);
      g.add(spike.group);
    }

    // sword in right hand
    this.swordMount = new THREE.Group();
    this.swordMount.position.set(0.42, 0.78, 0.05);
    this.swordMount.rotation.z = -0.4;
    g.add(this.swordMount);
    this._swordTier = -1;
    this.setSwordTier(0);

    // armor overlay
    this._armorTier = -1;
    this.armorMount = new THREE.Group();
    g.add(this.armorMount);
    this.setArmorTier(0);

    // name tag + hp bar
    this.tag = makeTextSprite(name, { color: '#9be7ff', size: 44, scale: 0.6 });
    this.tag.position.y = 2.35;
    g.add(this.tag);

    const hpBg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x330a12, depthWrite: false }));
    hpBg.scale.set(0.9, 0.1, 1);
    hpBg.position.y = 2.12;
    g.add(hpBg);
    this.hpFg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x46e060, depthWrite: false }));
    this.hpFg.scale.set(0.84, 0.06, 1);
    this.hpFg.position.y = 2.12;
    g.add(this.hpFg);
  }

  setName(name) {
    if (this.tag) this.group.remove(this.tag);
    this.tag = makeTextSprite(name, { color: '#9be7ff', size: 44, scale: 0.6 });
    this.tag.position.y = 2.35;
    this.group.add(this.tag);
  }

  setSwordTier(tierIdx) {
    if (tierIdx === this._swordTier) return;
    this._swordTier = tierIdx;
    this.swordMount.clear();
    this.swordMount.add(buildSword(tierIdx));
  }

  setArmorTier(tierIdx) {
    if (tierIdx === this._armorTier) return;
    this._armorTier = tierIdx;
    this.armorMount.clear();
    this.armorMount.add(buildArmorSet(tierIdx));
  }

  /** Called when a state packet arrives from the other machine. */
  applyState(s) {
    this.netPos.set(s.x, s.y, s.z);
    this.netYaw = s.yaw;
    this.setSwordTier(s.sword);
    this.setArmorTier(s.armor);
    this.dead = !!s.dead;
    this.group.visible = !this.dead;
    const frac = Math.max(0, Math.min(1, s.hp / 100));
    this.hpFg.scale.x = 0.84 * frac;
    this.hpFg.material.color.setHex(frac > 0.5 ? 0x46e060 : frac > 0.25 ? 0xffb300 : 0xff3355);
    if (s.swing && this._swingT <= 0) this._swingT = 0.4;
  }

  update(dt) {
    // smooth toward network position
    this.group.position.lerp(this.netPos, Math.min(1, dt * 12));
    let dy = this.netYaw - this.group.rotation.y;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.group.rotation.y += dy * Math.min(1, dt * 12);

    // walk cycle driven by actual movement
    const speed = this.group.position.distanceTo(this._lastPos) / Math.max(dt, 1e-4);
    this._lastPos.copy(this.group.position);
    if (speed > 0.5) this._walkT += dt * Math.min(speed, 8);
    const swing = speed > 0.5 ? Math.sin(this._walkT * 2.2) * 0.55 : 0;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.armL.rotation.x = -swing * 0.7;

    // sword swing animation
    if (this._swingT > 0) {
      this._swingT -= dt;
      const t = 1 - this._swingT / 0.4;
      const arc = Math.sin(t * Math.PI);
      this.armR.rotation.x = -arc * 2.1;
      this.swordMount.rotation.x = -arc * 2.1;
    } else {
      this.armR.rotation.x = swing * 0.7;
      this.swordMount.rotation.x = 0;
    }
  }

  dispose() {
    this.scene.remove(this.group);
  }
}
