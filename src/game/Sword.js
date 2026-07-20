import * as THREE from 'three';
import { createToonPart, toonMat } from './ToonUtils.js';
import { TIERS } from './Progression.js';

// One builder for every sword tier — same silhouette, escalating material.
// Origin at the grip, blade pointing +Y. Used by the first-person viewmodel
// AND the remote player's avatar, so both always match the real tier.
export function buildSword(tierIdx) {
  const tier = TIERS[tierIdx];
  const g = new THREE.Group();

  const grip = createToonPart(new THREE.CylinderGeometry(0.035, 0.045, 0.28, 8), 0x3a2a1a);
  grip.group.position.y = 0.0;
  g.add(grip.group);

  const pommel = createToonPart(new THREE.SphereGeometry(0.05, 8, 6), tier.accent);
  pommel.group.position.y = -0.16;
  g.add(pommel.group);

  const guard = createToonPart(new THREE.BoxGeometry(0.26, 0.05, 0.07), tier.accent);
  guard.group.position.y = 0.16;
  g.add(guard.group);

  const bladeLen = 0.78 + tierIdx * 0.045;
  const blade = createToonPart(
    new THREE.BoxGeometry(0.1, bladeLen, 0.028),
    tier.color,
    { emissive: tier.emissive, outlineScale: 1.05 }
  );
  blade.group.position.y = 0.16 + bladeLen / 2;
  g.add(blade.group);

  const tip = createToonPart(new THREE.ConeGeometry(0.055, 0.16, 4), tier.color, { emissive: tier.emissive });
  tip.group.scale.z = 0.5;
  tip.group.position.y = 0.16 + bladeLen + 0.08;
  g.add(tip.group);

  // tier-specific flair
  if (tier.key === 'paper') {
    // floppy paper blade: fold line + slight bend
    blade.group.rotation.z = 0.06;
    tip.group.rotation.z = 0.12;
  }
  if (tier.key === 'diamond') {
    const sparkle = new THREE.PointLight(0x8ef0ff, 2.5, 3);
    sparkle.position.y = 0.6;
    g.add(sparkle);
  }
  if (tier.key === 'bedrock') {
    // glowing purple cracks down the blade
    for (let i = 0; i < 4; i++) {
      const crack = new THREE.Mesh(
        new THREE.BoxGeometry(0.02, 0.14, 0.032),
        new THREE.MeshBasicMaterial({ color: 0xb44dff })
      );
      crack.position.set((i % 2 ? 0.02 : -0.02), 0.35 + i * 0.18, 0);
      crack.rotation.z = (i % 2 ? 1 : -1) * 0.5;
      g.add(crack);
    }
    const aura = new THREE.PointLight(0x8a2be2, 4, 4);
    aura.position.y = 0.6;
    g.add(aura);
  }
  return g;
}

// Chest plate + helmet + shoulder pads matching an armor tier, sized for the
// anime avatar in AnimeCharacter.js. Paper tier is literally a cardboard box.
export function buildArmorSet(tierIdx) {
  const tier = TIERS[tierIdx];
  const set = new THREE.Group();

  const chest = createToonPart(
    new THREE.BoxGeometry(0.5, 0.5, 0.34),
    tier.color,
    { emissive: tier.emissive, outlineScale: 1.05 }
  );
  chest.group.position.y = 0.95;
  set.add(chest.group);

  [-1, 1].forEach((s) => {
    const pad = createToonPart(new THREE.SphereGeometry(0.13, 8, 6), tier.accent);
    pad.group.position.set(s * 0.3, 1.18, 0);
    pad.group.scale.y = 0.7;
    set.add(pad.group);
  });

  const helm = createToonPart(
    new THREE.SphereGeometry(0.26, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    tier.color,
    { emissive: tier.emissive }
  );
  helm.group.position.y = 1.62;
  set.add(helm.group);

  return set;
}
