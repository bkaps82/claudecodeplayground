import * as THREE from 'three';

const PROJECTILE_RADIUS = 0.1;
const PROJECTILE_SPEED = 13;
const MAX_LIFETIME = 1.4;
export const HIT_AMOUNT = 0.19;

const sphereGeo = new THREE.SphereGeometry(1, 10, 8);
const trailGeo = new THREE.SphereGeometry(1, 6, 5);
const burstGeo = new THREE.SphereGeometry(1, 6, 5);

export class PaintSystem {
  constructor(scene) {
    this.scene = scene;
    this.projectiles = [];
    this.trailBits = [];
    this.bursts = [];
    this.onHit = null; // (point, color) => void, hook for sfx/screenshake
    // networking hooks: authoritative side relays these, visual side replays them
    this.applyHits = true;
    this.onSpawn = null;   // ({id, origin, dir, owner}) => void
    this.onHitInfo = null; // ({id, targetIdx, part, point, normal, owner}) => void
    this._nextId = 1;
  }

  spawn({ origin, targetPos, color, owner, dir: explicitDir, id: explicitId }) {
    // full 3D aim: the y-component matters, otherwise paint flies at sword-tip
    // height forever and heads/legs can never be reached
    let dir;
    if (explicitDir) {
      dir = explicitDir.clone();
    } else {
      dir = targetPos.clone().sub(origin);
      if (dir.lengthSq() < 0.0001) dir.set(0, 0, owner === 0 ? -1 : 1);
      dir.normalize();
    }
    const id = explicitId ?? this._nextId++;

    const mat = new THREE.MeshBasicMaterial({ color });
    mat.color.multiplyScalar(1.7);
    const mesh = new THREE.Mesh(sphereGeo, mat);
    mesh.scale.setScalar(PROJECTILE_RADIUS);
    mesh.position.copy(origin);
    this.scene.add(mesh);

    const light = new THREE.PointLight(color, 2.2, 2.6, 2);
    light.position.copy(origin);
    this.scene.add(light);

    this.projectiles.push({
      id,
      mesh,
      light,
      dir,
      color,
      owner,
      life: MAX_LIFETIME,
      trailTimer: 0,
    });

    this.onSpawn?.({ id, origin: origin.clone(), dir: dir.clone(), owner });
    return id;
  }

  removeById(id) {
    const i = this.projectiles.findIndex((p) => p.id === id);
    if (i === -1) return;
    const p = this.projectiles[i];
    this.scene.remove(p.mesh, p.light);
    p.mesh.material.dispose();
    this.projectiles.splice(i, 1);
  }

  _spawnTrailBit(position, color, scale) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55 });
    mat.color.multiplyScalar(1.5);
    const mesh = new THREE.Mesh(trailGeo, mat);
    mesh.scale.setScalar(scale);
    mesh.position.copy(position);
    this.scene.add(mesh);
    this.trailBits.push({ mesh, life: 0.22, maxLife: 0.22 });
  }

  spawnBurst(position, normal, color) {
    const count = 9;
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
      mat.color.multiplyScalar(1.6);
      const mesh = new THREE.Mesh(burstGeo, mat);
      mesh.scale.setScalar(0.045 + Math.random() * 0.05);
      mesh.position.copy(position);
      this.scene.add(mesh);

      const dir = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        Math.random() * 1.4 + normal.y * 0.6,
        (Math.random() - 0.5) * 2
      ).addScaledVector(normal, 1.2).normalize();

      this.bursts.push({
        mesh,
        vel: dir.multiplyScalar(1.5 + Math.random() * 2.2),
        life: 0.4 + Math.random() * 0.2,
        maxLife: 0.6,
      });
    }
    if (this.onHit) this.onHit(position, color);
  }

  /** targets: array of { character, isOwnerOf(owner) => bool } simplified to [charA, charB] */
  update(dt, characters) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      const step = PROJECTILE_SPEED * dt;
      p.mesh.position.addScaledVector(p.dir, step);
      p.light.position.copy(p.mesh.position);
      p.mesh.rotation.x += dt * 10;

      p.trailTimer -= dt;
      if (p.trailTimer <= 0) {
        this._spawnTrailBit(p.mesh.position, p.color, PROJECTILE_RADIUS * 0.75);
        p.trailTimer = 0.018;
      }

      let hit = false;
      const target = characters[1 - p.owner];
      if (this.applyHits && target && !target.defeated) {
        let closestName = null;
        let closestDist = Infinity;
        for (const [name, part] of target.parts.entries()) {
          if (part.coverage >= 0.999) continue;
          const worldPos = target.getPartWorldPosition(name, _tmpA);
          const dist = worldPos.distanceTo(p.mesh.position);
          const threshold = part.radius + PROJECTILE_RADIUS;
          if (dist < threshold && dist < closestDist) {
            closestDist = dist;
            closestName = name;
          }
        }
        if (closestName) {
          const worldPos = target.getPartWorldPosition(closestName, _tmpA);
          const normal = _tmpB.subVectors(p.mesh.position, worldPos).normalize();
          if (normal.lengthSq() < 0.001) normal.set(0, 0, 1);
          const hitPoint = _tmpC.copy(worldPos).addScaledVector(normal, target.parts.get(closestName).radius);
          target.applyPaintHit(closestName, hitPoint, normal, p.color, HIT_AMOUNT);
          this.spawnBurst(hitPoint, normal, p.color);
          this.onHitInfo?.({
            id: p.id,
            targetIdx: 1 - p.owner,
            part: closestName,
            point: [hitPoint.x, hitPoint.y, hitPoint.z],
            normal: [normal.x, normal.y, normal.z],
            owner: p.owner,
          });
          hit = true;
        }
      }

      if (hit || p.life <= 0 || p.mesh.position.y < -0.05 || p.mesh.position.length() > 14) {
        this.scene.remove(p.mesh, p.light);
        p.mesh.material.dispose();
        this.projectiles.splice(i, 1);
      }
    }

    for (let i = this.trailBits.length - 1; i >= 0; i--) {
      const t = this.trailBits[i];
      t.life -= dt;
      const p = Math.max(0, t.life / t.maxLife);
      t.mesh.material.opacity = 0.55 * p;
      t.mesh.scale.multiplyScalar(1 - dt * 1.5);
      if (t.life <= 0) {
        this.scene.remove(t.mesh);
        t.mesh.material.dispose();
        this.trailBits.splice(i, 1);
      }
    }

    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.life -= dt;
      b.vel.multiplyScalar(1 - dt * 3);
      b.vel.y -= dt * 4;
      b.mesh.position.addScaledVector(b.vel, dt);
      const p = Math.max(0, b.life / b.maxLife);
      b.mesh.material.opacity = 0.9 * p;
      if (b.life <= 0) {
        this.scene.remove(b.mesh);
        b.mesh.material.dispose();
        this.bursts.splice(i, 1);
      }
    }
  }

  clear() {
    for (const p of this.projectiles) {
      this.scene.remove(p.mesh, p.light);
      p.mesh.material.dispose();
    }
    for (const t of this.trailBits) {
      this.scene.remove(t.mesh);
      t.mesh.material.dispose();
    }
    for (const b of this.bursts) {
      this.scene.remove(b.mesh);
      b.mesh.material.dispose();
    }
    this.projectiles.length = 0;
    this.trailBits.length = 0;
    this.bursts.length = 0;
  }
}

const _tmpA = new THREE.Vector3();
const _tmpB = new THREE.Vector3();
const _tmpC = new THREE.Vector3();
