import * as THREE from 'three';

const PLATFORM_RADIUS = 5;
export const PLAY_RADIUS = PLATFORM_RADIUS - 0.7;
const ROTATION_OFFSET = Math.PI / 8;

function buildFloorDetailTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.fillRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;

  // concentric danger rings
  for (let r = size * 0.08; r < size * 0.48; r += size * 0.07) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 90, 120, 0.14)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // radial spokes
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * size * 0.48, cy + Math.sin(a) * size * 0.48);
    ctx.strokeStyle = 'rgba(120, 180, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // outer warning octagon
  ctx.beginPath();
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const x = cx + Math.cos(a) * size * 0.47;
    const y = cy + Math.sin(a) * size * 0.47;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = 'rgba(255, 130, 90, 0.35)';
  ctx.lineWidth = 4;
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildVoidGlowTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(180, 40, 60, 0.55)');
  grad.addColorStop(0.5, 'rgba(90, 20, 50, 0.25)');
  grad.addColorStop(1, 'rgba(5, 6, 12, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

export function buildArena(scene) {
  const group = new THREE.Group();

  scene.background = new THREE.Color(0x05060c);
  scene.fog = new THREE.FogExp2(0x05060c, 0.045);

  // main octagonal platform
  const platformGeo = new THREE.CylinderGeometry(PLATFORM_RADIUS, PLATFORM_RADIUS * 1.05, 0.5, 8, 1);
  const platformMat = new THREE.MeshStandardMaterial({ color: 0x15161f, roughness: 0.55, metalness: 0.45 });
  const platform = new THREE.Mesh(platformGeo, platformMat);
  platform.position.y = -0.25;
  platform.rotation.y = ROTATION_OFFSET;
  platform.receiveShadow = true;
  platform.castShadow = false;
  group.add(platform);

  // detail overlay disc on the top surface
  const detailGeo = new THREE.CircleGeometry(PLATFORM_RADIUS - 0.05, 8);
  const detailMat = new THREE.MeshBasicMaterial({
    map: buildFloorDetailTexture(),
    transparent: true,
    depthWrite: false,
  });
  const detail = new THREE.Mesh(detailGeo, detailMat);
  detail.rotation.x = -Math.PI / 2;
  detail.rotation.z = ROTATION_OFFSET + Math.PI / 8;
  detail.position.y = 0.001;
  group.add(detail);

  // glowing rim outline
  const rimPoints = [];
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * Math.PI * 2 + ROTATION_OFFSET + Math.PI / 8;
    rimPoints.push(new THREE.Vector3(Math.cos(a) * PLATFORM_RADIUS, 0.01, Math.sin(a) * PLATFORM_RADIUS));
  }
  const rimGeo = new THREE.BufferGeometry().setFromPoints(rimPoints);
  const rimMat = new THREE.LineBasicMaterial({ color: 0xff5566, linewidth: 2 });
  const rim = new THREE.Line(rimGeo, rimMat);
  group.add(rim);

  // corner spikes for "octagon of death" flavor
  const spikeMat = new THREE.MeshStandardMaterial({ color: 0x1c1c26, roughness: 0.4, metalness: 0.7 });
  const spikeTipMat = new THREE.MeshBasicMaterial({ color: 0xff3355 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + ROTATION_OFFSET + Math.PI / 8;
    const x = Math.cos(a) * (PLATFORM_RADIUS - 0.15);
    const z = Math.sin(a) * (PLATFORM_RADIUS - 0.15);
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.1, 6), spikeMat);
    spike.position.set(x, 0.3, z);
    spike.castShadow = true;
    group.add(spike);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), spikeTipMat);
    tip.position.set(x, 0.85, z);
    group.add(tip);
  }

  // void glow beneath the platform
  const voidGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 24),
    new THREE.MeshBasicMaterial({ map: buildVoidGlowTexture(), transparent: true, depthWrite: false })
  );
  voidGlow.rotation.x = -Math.PI / 2;
  voidGlow.position.y = -3.2;
  group.add(voidGlow);

  scene.add(group);

  // ---------- lighting ----------
  const hemi = new THREE.HemisphereLight(0x9db8ff, 0x140a14, 0.45);
  scene.add(hemi);

  const ambient = new THREE.AmbientLight(0x223047, 0.22);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xfff2e0, 0.9);
  key.position.set(4.5, 8, 3.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -7;
  key.shadow.camera.right = 7;
  key.shadow.camera.top = 7;
  key.shadow.camera.bottom = -7;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 20;
  key.shadow.bias = -0.0025;
  scene.add(key);
  scene.add(key.target);

  const rimLightP1 = new THREE.PointLight(0x4fd3ff, 3.2, 9, 2);
  rimLightP1.position.set(-3, 2.2, -4.5);
  scene.add(rimLightP1);

  const rimLightP2 = new THREE.PointLight(0xff4f7d, 3.2, 9, 2);
  rimLightP2.position.set(3, 2.2, 4.5);
  scene.add(rimLightP2);

  return { group, playRadius: PLAY_RADIUS };
}
