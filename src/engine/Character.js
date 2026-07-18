import * as THREE from 'three';
import { createToonPart, createFaceTexture, getSplatTexture } from './ToonUtils.js';

const PART_RADIUS = {
  head: 0.3,
  torso: 0.4,
  leftArm: 0.2,
  rightArm: 0.2,
  leftLeg: 0.24,
  rightLeg: 0.24,
};

const PART_LABELS = {
  head: '○', // head
  torso: '■', // torso
  leftArm: '↙',
  rightArm: '↘',
  leftLeg: '↓',
  rightLeg: '↓',
};

let uidCounter = 0;

export class Character {
  constructor({
    name,
    outfitColor,
    skinColor = 0xffe0c9,
    hairColor,
    irisColor,
    paintColor,
    spawnZ,
  }) {
    this.id = uidCounter++;
    this.name = name;
    this.paintColor = paintColor;
    this.skinColor = new THREE.Color(skinColor);

    this.attackCooldown = 0;
    this.attackState = null;
    this.attackReady = true;
    this.defeated = false;
    this.defeatT = 0;
    this.walkPhase = Math.random() * 10;
    this.breatheT = Math.random() * 10;

    this.root = new THREE.Group();
    this.root.position.z = spawnZ;
    this.root.rotation.y = spawnZ > 0 ? Math.PI : 0;

    this.visual = new THREE.Group();
    this.root.add(this.visual);

    this.hips = new THREE.Group();
    this.hips.position.y = 0.82;
    this.visual.add(this.hips);

    this.parts = new Map();

    this._buildLegs(skinColor, outfitColor);
    this._buildTorso(outfitColor);
    this._buildHead(skinColor, hairColor, irisColor);
    this._buildArms(skinColor, outfitColor);
    this._buildSword();

    this._tmpVec = new THREE.Vector3();
    this._tmpVec2 = new THREE.Vector3();
    this._tmpMat = new THREE.Matrix4();
    this._tmpQuatA = new THREE.Quaternion();
    this._tmpQuatB = new THREE.Quaternion();
  }

  _registerPart(name, group, mesh, material, baseColorHex) {
    this.parts.set(name, {
      group,
      mesh,
      material,
      baseColor: new THREE.Color(baseColorHex),
      coverage: 0,
      decals: [],
      flinch: 0,
      radius: PART_RADIUS[name],
    });
  }

  _buildLegs(skinColor, outfitColor) {
    const pantsColor = new THREE.Color(outfitColor).multiplyScalar(0.4).getHex();
    const legGeo = new THREE.CapsuleGeometry(0.16, 0.62, 4, 8);

    this.leftHip = new THREE.Group();
    this.leftHip.position.set(0.16, 0, 0);
    this.hips.add(this.leftHip);
    const leftLeg = createToonPart(legGeo, pantsColor);
    leftLeg.group.position.y = -0.43;
    this.leftHip.add(leftLeg.group);
    this._registerPart('leftLeg', this.leftHip, leftLeg.mesh, leftLeg.material, pantsColor);

    this.rightHip = new THREE.Group();
    this.rightHip.position.set(-0.16, 0, 0);
    this.hips.add(this.rightHip);
    const rightLeg = createToonPart(legGeo, pantsColor);
    rightLeg.group.position.y = -0.43;
    this.rightHip.add(rightLeg.group);
    this._registerPart('rightLeg', this.rightHip, rightLeg.mesh, rightLeg.material, pantsColor);

    // small boots for silhouette read
    const bootGeo = new THREE.BoxGeometry(0.19, 0.14, 0.28);
    [this.leftHip, this.rightHip].forEach((hip) => {
      const boot = new THREE.Mesh(bootGeo, new THREE.MeshToonMaterial({ color: 0x1a1a22 }));
      boot.position.set(0, -0.79, 0.05);
      boot.castShadow = true;
      hip.add(boot);
    });
  }

  _buildTorso(outfitColor) {
    this.torsoGroup = new THREE.Group();
    this.torsoGroup.position.y = 0.02;
    this.hips.add(this.torsoGroup);

    const torsoGeo = new THREE.CapsuleGeometry(0.3, 0.42, 4, 8);
    const torso = createToonPart(torsoGeo, outfitColor);
    torso.group.position.y = 0.42;
    this.torsoGroup.add(torso.group);
    this._registerPart('torso', this.torsoGroup, torso.mesh, torso.material, outfitColor);

    // belt / sash accent
    const sash = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.035, 6, 16),
      new THREE.MeshToonMaterial({ color: this.paintColor })
    );
    sash.rotation.x = Math.PI / 2;
    sash.position.y = 0.22;
    sash.castShadow = true;
    this.torsoGroup.add(sash);

    this.neck = new THREE.Group();
    this.neck.position.y = 0.78;
    this.torsoGroup.add(this.neck);
  }

  _buildHead(skinColor, hairColor, irisColor) {
    this.headGroup = new THREE.Group();
    this.headGroup.position.y = 0.2;
    this.neck.add(this.headGroup);

    const headGeo = new THREE.SphereGeometry(0.26, 20, 16);
    const head = createToonPart(headGeo, skinColor);
    this.headGroup.add(head.group);
    this._registerPart('head', this.headGroup, head.mesh, head.material, skinColor);
    this._headExtra = [];

    // anime spiky hair
    const hairMat = new THREE.MeshToonMaterial({ color: hairColor });
    const hairGroup = new THREE.Group();
    const spikeCount = 9;
    for (let i = 0; i < spikeCount; i++) {
      const a = (i / spikeCount) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.32, 5), hairMat);
      const r = 0.16;
      spike.position.set(Math.cos(a) * r, 0.12 + Math.random() * 0.05, Math.sin(a) * r);
      spike.rotation.z = Math.cos(a) * 0.9;
      spike.rotation.x = -Math.sin(a) * 0.9 + 0.3;
      spike.lookAt(spike.position.clone().multiplyScalar(2).add(new THREE.Vector3(0, 0.5, 0)));
      spike.rotateX(Math.PI / 2);
      spike.castShadow = true;
      hairGroup.add(spike);
    }
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
    crown.position.y = 0.08;
    hairGroup.add(crown);
    this.headGroup.add(hairGroup);
    this._headExtra.push(hairMat);

    // face plate
    const faceTex = createFaceTexture({ irisColor });
    const faceMat = new THREE.MeshBasicMaterial({ map: faceTex, transparent: true, depthWrite: false });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), faceMat);
    face.position.set(0, -0.02, 0.235);
    this.headGroup.add(face);
  }

  _buildArms(skinColor, outfitColor) {
    const sleeveColor = new THREE.Color(outfitColor).multiplyScalar(0.75).getHex();
    const armGeo = new THREE.CapsuleGeometry(0.1, 0.5, 4, 8);
    const handGeo = new THREE.SphereGeometry(0.09, 10, 8);

    this.leftShoulder = new THREE.Group();
    this.leftShoulder.position.set(0.36, 0.72, 0);
    this.torsoGroup.add(this.leftShoulder);
    const leftArm = createToonPart(armGeo, sleeveColor);
    leftArm.group.position.y = -0.28;
    this.leftShoulder.add(leftArm.group);
    this._registerPart('leftArm', this.leftShoulder, leftArm.mesh, leftArm.material, sleeveColor);
    const leftHand = new THREE.Mesh(handGeo, new THREE.MeshToonMaterial({ color: skinColor }));
    leftHand.position.y = -0.56;
    leftArm.group.add(leftHand);

    this.rightShoulder = new THREE.Group();
    this.rightShoulder.position.set(-0.36, 0.72, 0);
    this.rightShoulder.rotation.x = -0.4;
    this.torsoGroup.add(this.rightShoulder);
    const rightArm = createToonPart(armGeo, sleeveColor);
    rightArm.group.position.y = -0.28;
    this.rightShoulder.add(rightArm.group);
    this._registerPart('rightArm', this.rightShoulder, rightArm.mesh, rightArm.material, sleeveColor);
    const rightHand = new THREE.Mesh(handGeo, new THREE.MeshToonMaterial({ color: skinColor }));
    rightHand.position.y = -0.56;
    rightArm.group.add(rightHand);

    this.rightHand = rightHand;
  }

  _buildSword() {
    const sword = new THREE.Group();

    const hiltMat = new THREE.MeshStandardMaterial({ color: 0x2b2b33, roughness: 0.4, metalness: 0.6 });
    const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.18, 8), hiltMat);
    hilt.position.y = 0.09;
    sword.add(hilt);

    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.05), hiltMat);
    guard.position.y = 0.19;
    sword.add(guard);

    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0xe8f4ff,
      metalness: 0.9,
      roughness: 0.15,
      emissive: new THREE.Color(this.paintColor),
      emissiveIntensity: 0.15,
    });
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.66, 4), bladeMat);
    blade.rotation.y = Math.PI / 4;
    blade.position.y = 0.56;
    blade.castShadow = true;
    sword.add(blade);

    // glowing paint channel down the center of the blade - sells "shoots paint"
    const glowMat = new THREE.MeshBasicMaterial({ color: this.paintColor, transparent: true, opacity: 0.85 });
    glowMat.color.multiplyScalar(1.8);
    const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.62, 6), glowMat);
    glow.position.y = 0.56;
    sword.add(glow);
    this.swordGlow = glowMat;

    const orbMat = new THREE.MeshBasicMaterial({ color: this.paintColor });
    orbMat.color.multiplyScalar(1.8);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), orbMat);
    orb.position.y = 0.9;
    sword.add(orb);
    this.swordOrb = orb;

    sword.rotation.x = Math.PI * 0.06;
    sword.rotation.z = Math.PI * 0.08;
    sword.position.set(0, -0.58, 0.03);
    this.rightHand.add(sword);
    this.sword = sword;

    this.swordTip = new THREE.Object3D();
    this.swordTip.position.set(0, 0.92, 0);
    sword.add(this.swordTip);
  }

  getPartWorldPosition(name, target = new THREE.Vector3()) {
    const part = this.parts.get(name);
    part.group.getWorldPosition(target);
    return target;
  }

  getSwordTipWorldPosition(target = new THREE.Vector3()) {
    this.swordTip.getWorldPosition(target);
    return target;
  }

  getCenterWorldPosition(target = new THREE.Vector3()) {
    this.torsoGroup.getWorldPosition(target);
    return target;
  }

  /** Picks a world-space point on a currently-uncovered part (falls back to any part) so
   * incoming paint eventually reaches every part instead of always hitting the torso. */
  getAimPoint(target = new THREE.Vector3()) {
    const entries = [...this.parts.entries()];
    const uncovered = entries.filter(([, part]) => part.coverage < 0.999);
    const pool = uncovered.length ? uncovered : entries;
    const [, part] = pool[Math.floor(Math.random() * pool.length)];
    part.group.getWorldPosition(target);
    const jitter = part.radius * 0.5;
    target.x += (Math.random() - 0.5) * jitter;
    target.y += (Math.random() - 0.5) * jitter;
    target.z += (Math.random() - 0.5) * jitter;
    return target;
  }

  startAttack() {
    if (this.defeated || this.attackState || this.attackCooldown > 0) return false;
    this.attackState = { t: 0, duration: 0.34, spawned: false };
    this.attackCooldown = 0.5;
    return true;
  }

  isFullyCovered() {
    for (const part of this.parts.values()) {
      if (part.coverage < 0.999) return false;
    }
    return true;
  }

  getOverallCoverage() {
    let sum = 0;
    for (const part of this.parts.values()) sum += part.coverage;
    return sum / this.parts.size;
  }

  getPartsCoverage() {
    const out = {};
    for (const [name, part] of this.parts.entries()) out[name] = part.coverage;
    return out;
  }

  triggerDefeat() {
    if (this.defeated) return;
    this.defeated = true;
    this.defeatT = 0;
    this.attackState = null;
  }

  reset(spawnZ) {
    this.root.position.set(0, 0, spawnZ);
    this.root.rotation.y = spawnZ > 0 ? Math.PI : 0;
    this.visual.rotation.set(0, 0, 0);
    this.visual.position.set(0, 0, 0);
    this.defeated = false;
    this.defeatT = 0;
    this.attackState = null;
    this.attackCooldown = 0;
    for (const part of this.parts.values()) {
      part.coverage = 0;
      part.flinch = 0;
      part.material.color.copy(part.baseColor);
      part.mesh.scale.setScalar(1);
      for (const d of part.decals) {
        part.group.remove(d);
        d.geometry.dispose();
      }
      part.decals.length = 0;
    }
  }

  /** Applies a paint hit; worldPoint/worldNormal are THREE.Vector3 in world space. */
  applyPaintHit(name, worldPoint, worldNormal, colorHex, amount = 0.2) {
    const part = this.parts.get(name);
    if (!part || part.coverage >= 0.999) return;

    part.coverage = Math.min(1, part.coverage + amount);
    part.material.color.copy(part.baseColor).lerp(new THREE.Color(colorHex), part.coverage);
    part.flinch = 1;

    part.group.updateWorldMatrix(true, false);
    const invMatrix = this._tmpMat.copy(part.group.matrixWorld).invert();

    const localPoint = this._tmpVec.copy(worldPoint).applyMatrix4(invMatrix);
    const worldNormalTip = this._tmpVec2.copy(worldPoint).add(worldNormal);
    worldNormalTip.applyMatrix4(invMatrix);
    const localNormal = worldNormalTip.sub(localPoint).normalize();

    const up = Math.abs(localNormal.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const qAlign = this._tmpQuatA.setFromUnitVectors(new THREE.Vector3(0, 0, 1), localNormal);
    const qSpin = this._tmpQuatB.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.random() * Math.PI * 2);
    void up;

    const splatSize = part.radius * (1.1 + Math.random() * 0.6);
    const splatMat = new THREE.MeshBasicMaterial({
      map: getSplatTexture(colorHex),
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      opacity: 0.97,
    });
    const splat = new THREE.Mesh(new THREE.PlaneGeometry(splatSize, splatSize), splatMat);
    splat.position.copy(localPoint).addScaledVector(localNormal, 0.012);
    splat.quaternion.copy(qAlign).multiply(qSpin);
    part.group.add(splat);
    part.decals.push(splat);
    if (part.decals.length > 9) {
      const old = part.decals.shift();
      part.group.remove(old);
      old.geometry.dispose();
      old.material.dispose();
    }
  }

  update(dt, { moveInput = 0, speedFactor = 0 } = {}) {
    if (this.defeated) {
      this.defeatT += dt;
      const p = Math.min(this.defeatT / 0.8, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      this.visual.rotation.x = ease * (Math.PI * 0.46);
      this.visual.position.y = -ease * 0.15;
      for (const part of this.parts.values()) this._updateFlinch(part, dt);
      return;
    }

    this.breatheT += dt;
    const breathe = Math.sin(this.breatheT * 2) * 0.012;

    if (this.attackCooldown > 0) this.attackCooldown -= dt;

    let spawnTip = null;

    if (this.attackState) {
      const st = this.attackState;
      st.t += dt;
      const p = Math.min(st.t / st.duration, 1);
      const swing = Math.sin(p * Math.PI);
      this.rightShoulder.rotation.x = -0.4 - swing * 2.15;
      this.rightShoulder.rotation.z = -0.1 + swing * 0.65;
      this.torsoGroup.rotation.y = swing * 0.3;
      const glowPulse = 0.6 + swing * 1.2;
      this.swordGlow.opacity = Math.min(1, glowPulse);
      this.swordOrb.scale.setScalar(1 + swing * 0.8);

      if (!st.spawned && p >= 0.4) {
        st.spawned = true;
        spawnTip = this.getSwordTipWorldPosition();
      }
      if (p >= 1) this.attackState = null;
    } else {
      this.walkPhase += dt * (2 + speedFactor * 7);
      const swingAmt = 0.16 + speedFactor * 0.55;
      this.leftHip.rotation.x = Math.sin(this.walkPhase) * swingAmt;
      this.rightHip.rotation.x = -Math.sin(this.walkPhase) * swingAmt;
      this.leftShoulder.rotation.x = -Math.sin(this.walkPhase) * (swingAmt * 0.7);
      this.rightShoulder.rotation.x = Math.sin(this.walkPhase) * (swingAmt * 0.5) - 0.4;
      this.torsoGroup.rotation.y += (0 - this.torsoGroup.rotation.y) * Math.min(1, dt * 8);
      this.swordGlow.opacity += (0.85 - this.swordGlow.opacity) * Math.min(1, dt * 4);
      this.swordOrb.scale.setScalar(1 + Math.sin(this.breatheT * 3) * 0.08);
    }

    this.hips.position.y = 0.82 + breathe + Math.abs(Math.sin(this.walkPhase * 2)) * 0.03 * speedFactor;

    // lean slightly into movement direction for weight/feel
    const targetLean = THREE.MathUtils.clamp(moveInput, -1, 1) * 0.12;
    this.visual.rotation.z += (targetLean - this.visual.rotation.z) * Math.min(1, dt * 6);

    for (const part of this.parts.values()) this._updateFlinch(part, dt);

    return spawnTip;
  }

  _updateFlinch(part, dt) {
    if (part.flinch > 0) {
      part.flinch = Math.max(0, part.flinch - dt * 5);
      const s = 1 + Math.sin(part.flinch * Math.PI) * 0.18;
      part.mesh.scale.setScalar(s);
    }
  }
}

export { PART_RADIUS, PART_LABELS };
