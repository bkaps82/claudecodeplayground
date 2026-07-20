import * as THREE from 'three';
import { toonMat, createToonPart } from './ToonUtils.js';

// Both worlds live in ONE coordinate space, 1000 units apart — that keeps
// multiplayer trivial (positions are just positions, no "which world" math
// beyond distance) and fog hides the gap. Portals teleport you between them.
export const WORLD_DEFS = [
  {
    id: 0,
    name: '🌾 Plains World',
    center: new THREE.Vector3(0, 0, 0),
    radius: 85,
    sky: 0x7ec8f0,
    fog: { color: 0x9fd8f5, near: 55, far: 160 },
    hemi: { sky: 0xbfe8ff, ground: 0x4a7a3a, intensity: 0.9 },
    sun: { color: 0xfff2cc, intensity: 1.5, pos: [40, 70, 25] },
  },
  {
    id: 1,
    name: '🌋 Volcano World',
    center: new THREE.Vector3(1000, 0, 0),
    radius: 85,
    sky: 0x2b0d12,
    fog: { color: 0x461116, near: 40, far: 140 },
    hemi: { sky: 0xff6a3a, ground: 0x1a0508, intensity: 0.55 },
    sun: { color: 0xff8855, intensity: 0.9, pos: [-30, 60, -20] },
  },
];

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Cheap layered value noise (sines) — plenty for rolling gameplay terrain,
// and identical on host & client given the same seed.
function makeHeightFn(seed, { amp, rough }) {
  const rng = mulberry32(seed);
  const ph = Array.from({ length: 6 }, () => rng() * Math.PI * 2);
  const fx = Array.from({ length: 6 }, () => 0.015 + rng() * 0.045 * rough);
  const fz = Array.from({ length: 6 }, () => 0.015 + rng() * 0.045 * rough);
  return (x, z) => {
    let h = 0;
    for (let i = 0; i < 6; i++) {
      h += Math.sin(x * fx[i] + ph[i]) * Math.cos(z * fz[i] + ph[(i + 3) % 6]);
    }
    return h * amp / 6;
  };
}

function buildTerrain(def, heightFn, colorFn) {
  const size = def.radius * 2.4;
  const segs = 110;
  const geo = new THREE.PlaneGeometry(size, size, segs, segs);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const y = heightFn(x + def.center.x, z + def.center.z);
    pos.setY(i, y);
    colorFn(c, x, z, y);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshToonMaterial({
    vertexColors: true,
    gradientMap: null,
  }));
  mesh.receiveShadow = true;
  mesh.position.copy(def.center);
  return mesh;
}

function buildTree(rng) {
  const g = new THREE.Group();
  const trunkH = 1.6 + rng() * 1.6;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.26, trunkH, 7),
    toonMat(0x6d4423)
  );
  trunk.position.y = trunkH / 2;
  trunk.castShadow = true;
  g.add(trunk);
  const blobs = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < blobs; i++) {
    const r = 0.8 + rng() * 0.9;
    const leaf = new THREE.Mesh(
      new THREE.IcosahedronGeometry(r, 1),
      toonMat(new THREE.Color().setHSL(0.3 + rng() * 0.06, 0.55, 0.32 + rng() * 0.12))
    );
    leaf.position.set((rng() - 0.5) * 1.2, trunkH + r * 0.5 + i * 0.55, (rng() - 0.5) * 1.2);
    leaf.castShadow = true;
    g.add(leaf);
  }
  return g;
}

function buildRock(rng, dark = false) {
  const r = 0.4 + rng() * 1.1;
  const rock = new THREE.Mesh(
    new THREE.DodecahedronGeometry(r, 0),
    toonMat(dark ? 0x3a2f33 : 0x8a8f96)
  );
  rock.scale.y = 0.6 + rng() * 0.5;
  rock.castShadow = true;
  return rock;
}

function buildFlower(rng) {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 4), toonMat(0x3f8f2f));
  stem.position.y = 0.2;
  g.add(stem);
  const colors = [0xff5d8f, 0xffd94d, 0xff8c42, 0xb28dff, 0xffffff];
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 6, 5),
    toonMat(colors[Math.floor(rng() * colors.length)])
  );
  head.position.y = 0.44;
  g.add(head);
  return g;
}

function buildVolcanoCone(rng, heightFn, def) {
  const g = new THREE.Group();
  const h = 7 + rng() * 8;
  const r = h * (0.9 + rng() * 0.4);
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(r, h, 9, 1),
    toonMat(0x4a2c28)
  );
  cone.position.y = h / 2 - 0.5;
  cone.castShadow = true;
  g.add(cone);
  // glowing crater lip
  const lip = new THREE.Mesh(
    new THREE.TorusGeometry(r * 0.22, r * 0.06, 6, 14),
    new THREE.MeshBasicMaterial({ color: 0xff5a1f })
  );
  lip.rotation.x = Math.PI / 2;
  lip.position.y = h - 0.4;
  g.add(lip);
  return g;
}

function buildLavaPool(rng) {
  const r = 2 + rng() * 3.5;
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(r, 22),
    new THREE.MeshBasicMaterial({ color: 0xff6a1f })
  );
  pool.rotation.x = -Math.PI / 2;
  pool.userData.lava = true;
  pool.userData.baseColor = new THREE.Color(0xff6a1f);
  return pool;
}

function buildCloud(rng) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  const blobs = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < blobs; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(1.6 + rng() * 2.4, 7, 6), mat);
    b.position.set(i * 2.4 - blobs * 1.1, (rng() - 0.5) * 0.8, (rng() - 0.5) * 2);
    b.scale.y = 0.5;
    g.add(b);
  }
  return g;
}

function buildPortal(colorA, colorB) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.6, 0.22, 10, 32),
    new THREE.MeshBasicMaterial({ color: colorA })
  );
  g.add(ring);
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(1.4, 28),
    new THREE.MeshBasicMaterial({ color: colorB, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
  );
  g.add(disc);
  const glow = new THREE.PointLight(colorA, 8, 12);
  g.add(glow);
  g.userData.spin = ring;
  return g;
}

export class World {
  constructor(seed) {
    this.seed = seed;
    this.group = new THREE.Group();
    this.portals = []; // { pos: Vector3, targetWorld: id }
    this.lavaPools = [];
    this.clouds = [];
    this.embers = null;

    // per-world height functions (world-space coordinates)
    this._heights = [
      makeHeightFn(seed ^ 0x1234, { amp: 2.2, rough: 0.8 }),
      makeHeightFn(seed ^ 0xbeef, { amp: 4.5, rough: 1.25 }),
    ];

    this._buildPlains();
    this._buildVolcano();
  }

  // Which world does a world-space position belong to?
  worldIdAt(x) {
    return x > 500 ? 1 : 0;
  }

  heightAt(x, z) {
    const def = WORLD_DEFS[this.worldIdAt(x)];
    const h = this._heights[def.id](x, z);
    // flatten near spawn so you don't start on a slope
    const d = Math.hypot(x - def.center.x, z - def.center.z);
    const flat = Math.max(0, 1 - d / 12);
    return h * (1 - flat * 0.8);
  }

  spawnPoint(worldId, idx = 0) {
    const def = WORLD_DEFS[worldId];
    const a = idx * 2.1 + 0.6;
    const x = def.center.x + Math.cos(a) * 3;
    const z = def.center.z + Math.sin(a) * 3;
    return new THREE.Vector3(x, this.heightAt(x, z), z);
  }

  _scatter(rng, def, count, minR, builder) {
    for (let i = 0; i < count; i++) {
      const a = rng() * Math.PI * 2;
      const r = minR + rng() * (def.radius - minR - 4);
      const x = def.center.x + Math.cos(a) * r;
      const z = def.center.z + Math.sin(a) * r;
      const obj = builder(rng);
      obj.position.set(x, this.heightAt(x, z), z);
      obj.rotation.y = rng() * Math.PI * 2;
      this.group.add(obj);
    }
  }

  _buildPlains() {
    const def = WORLD_DEFS[0];
    const rng = mulberry32(this.seed ^ 0x51ee7);
    const hf = (x, z) => this.heightAt(x, z);

    const terrain = buildTerrain(def, (x, z) => {
      // recreate the flattening near spawn
      const h = this._heights[0](x, z);
      const d = Math.hypot(x - def.center.x, z - def.center.z);
      const flat = Math.max(0, 1 - d / 12);
      return h * (1 - flat * 0.8);
    }, (c, x, z, y) => {
      const g = 0.42 + Math.sin(x * 0.4 + z * 0.31) * 0.05 + y * 0.03;
      c.setRGB(0.24 + y * 0.015, g, 0.2);
    });
    this.group.add(terrain);

    this._scatter(rng, def, 46, 10, (r) => buildTree(r));
    this._scatter(rng, def, 14, 8, (r) => buildRock(r));
    this._scatter(rng, def, 90, 4, (r) => buildFlower(r));

    // clouds
    for (let i = 0; i < 10; i++) {
      const cloud = buildCloud(rng);
      cloud.position.set(
        def.center.x + (rng() - 0.5) * 180,
        26 + rng() * 14,
        def.center.z + (rng() - 0.5) * 180
      );
      cloud.userData.drift = 0.4 + rng() * 0.7;
      this.clouds.push(cloud);
      this.group.add(cloud);
    }

    // portal to volcano world, a short walk from spawn
    const px = def.center.x + 22, pz = def.center.z + 6;
    const portal = buildPortal(0xff7a1f, 0xff3a10);
    portal.position.set(px, hf(px, pz) + 1.9, pz);
    portal.userData.targetWorld = 1;
    this.portals.push(portal);
    this.group.add(portal);
  }

  _buildVolcano() {
    const def = WORLD_DEFS[1];
    const rng = mulberry32(this.seed ^ 0x70cca);
    const hf = (x, z) => this.heightAt(x, z);

    const terrain = buildTerrain(def, (x, z) => {
      const h = this._heights[1](x, z);
      const d = Math.hypot(x - def.center.x, z - def.center.z);
      const flat = Math.max(0, 1 - d / 12);
      return h * (1 - flat * 0.8);
    }, (c, x, z, y) => {
      const heat = Math.max(0, -y * 0.06);
      c.setRGB(0.16 + heat * 0.9 + Math.sin(x * 0.3) * 0.015, 0.09 + heat * 0.25, 0.1);
    });
    this.group.add(terrain);

    this._scatter(rng, def, 22, 10, (r) => buildRock(r, true));

    // volcano cones around the rim
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + rng() * 0.5;
      const r = def.radius * (0.72 + rng() * 0.2);
      const x = def.center.x + Math.cos(a) * r;
      const z = def.center.z + Math.sin(a) * r;
      const cone = buildVolcanoCone(rng, hf, def);
      cone.position.set(x, hf(x, z) - 0.5, z);
      this.group.add(cone);
    }

    // lava pools
    for (let i = 0; i < 12; i++) {
      const a = rng() * Math.PI * 2;
      const r = 10 + rng() * (def.radius - 20);
      const x = def.center.x + Math.cos(a) * r;
      const z = def.center.z + Math.sin(a) * r;
      const pool = buildLavaPool(rng);
      pool.position.set(x, hf(x, z) + 0.06, z);
      this.lavaPools.push(pool);
      this.group.add(pool);
    }

    // drifting embers
    const emberCount = 240;
    const positions = new Float32Array(emberCount * 3);
    for (let i = 0; i < emberCount; i++) {
      positions[i * 3] = def.center.x + (rng() - 0.5) * def.radius * 2;
      positions[i * 3 + 1] = rng() * 24;
      positions[i * 3 + 2] = def.center.z + (rng() - 0.5) * def.radius * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.embers = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xffa54d, size: 0.22, transparent: true, opacity: 0.9, depthWrite: false,
    }));
    this.group.add(this.embers);

    // portal back to plains
    const px = def.center.x - 20, pz = def.center.z - 8;
    const portal = buildPortal(0x4dd2ff, 0x2fa8ff);
    portal.position.set(px, hf(px, pz) + 1.9, pz);
    portal.userData.targetWorld = 0;
    this.portals.push(portal);
    this.group.add(portal);
  }

  // Portal within reach of a position? Returns the portal or null.
  portalNear(pos, dist = 2.1) {
    for (const p of this.portals) {
      if (pos.distanceTo(p.position) < dist) return p;
    }
    return null;
  }

  clampToWorld(pos) {
    const def = WORLD_DEFS[this.worldIdAt(pos.x)];
    const dx = pos.x - def.center.x, dz = pos.z - def.center.z;
    const d = Math.hypot(dx, dz);
    const max = def.radius - 2;
    if (d > max) {
      pos.x = def.center.x + (dx / d) * max;
      pos.z = def.center.z + (dz / d) * max;
    }
  }

  update(dt, time) {
    for (const p of this.portals) {
      p.userData.spin.rotation.z += dt * 1.6;
      p.rotation.y += dt * 0.35;
    }
    for (const pool of this.lavaPools) {
      const pulse = 0.75 + 0.25 * Math.sin(time * 2.2 + pool.position.x);
      pool.material.color.copy(pool.userData.baseColor).multiplyScalar(pulse);
    }
    for (const cloud of this.clouds) {
      cloud.position.x += cloud.userData.drift * dt;
      if (cloud.position.x > 120) cloud.position.x = -120;
    }
    if (this.embers) {
      const pos = this.embers.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) + dt * (1.2 + (i % 5) * 0.3);
        if (y > 26) y = 0;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
    }
  }
}

// Applies a world's sky/fog to the scene; lights are created once by main.js
// and re-tuned here when the local player travels through a portal.
export function applyAtmosphere(scene, lights, worldId) {
  const def = WORLD_DEFS[worldId];
  scene.background = new THREE.Color(def.sky);
  scene.fog = new THREE.Fog(def.fog.color, def.fog.near, def.fog.far);
  lights.hemi.color.setHex(def.hemi.sky);
  lights.hemi.groundColor.setHex(def.hemi.ground);
  lights.hemi.intensity = def.hemi.intensity;
  lights.sun.color.setHex(def.sun.color);
  lights.sun.intensity = def.sun.intensity;
  lights.sun.position.set(
    def.center.x + def.sun.pos[0],
    def.sun.pos[1],
    def.center.z + def.sun.pos[2]
  );
  lights.sun.target.position.copy(def.center);
}
