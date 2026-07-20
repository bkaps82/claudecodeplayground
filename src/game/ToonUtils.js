import * as THREE from 'three';

let sharedGradientMap = null;

// A stepped grayscale ramp is what makes MeshToonMaterial read as flat
// cel-shaded anime lighting instead of smooth PBR shading.
export function getToonGradientMap() {
  if (sharedGradientMap) return sharedGradientMap;
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  const steps = [70, 140, 200, 255];
  steps.forEach((v, i) => {
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(i, 0, 1, 1);
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  sharedGradientMap = tex;
  return tex;
}

export function toonMat(color, { emissive = 0x000000, emissiveIntensity = 1 } = {}) {
  const mat = new THREE.MeshToonMaterial({
    color,
    gradientMap: getToonGradientMap(),
    emissive,
    emissiveIntensity,
  });
  mat.userData.baseEmissive = emissive;
  return mat;
}

/**
 * Builds a cel-shaded mesh plus a slightly-enlarged backface-only outline
 * mesh (the classic anime "inverted hull" outline trick), grouped together.
 */
export function createToonPart(geometry, color, { outlineColor = 0x120814, outlineScale = 1.06, emissive = 0x000000 } = {}) {
  const material = toonMat(color, { emissive });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const outlineMaterial = new THREE.MeshBasicMaterial({
    color: outlineColor,
    side: THREE.BackSide,
  });
  const outline = new THREE.Mesh(geometry, outlineMaterial);
  outline.scale.multiplyScalar(outlineScale);
  outline.renderOrder = -1;

  const group = new THREE.Group();
  group.add(outline, mesh);

  return { group, mesh, material, outline };
}

// Big googly anime monster eye: white sphere + iris/pupil decal texture on a
// flattened front. Returns a group; look direction is +Z.
export function createGooglyEye(radius, { irisColor = '#222', bloodshot = false } = {}) {
  const group = new THREE.Group();
  const white = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 14, 12),
    new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: getToonGradientMap() })
  );
  group.add(white);

  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (bloodshot) {
    ctx.strokeStyle = 'rgba(220,40,40,0.5)';
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(size / 2 + Math.cos(a) * size * 0.42, size / 2 + Math.sin(a) * size * 0.42);
      ctx.lineTo(size / 2 + Math.cos(a) * size * 0.2, size / 2 + Math.sin(a) * size * 0.2);
      ctx.stroke();
    }
  }
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = irisColor;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(size / 2 - size * 0.06, size / 2 - size * 0.06, size * 0.07, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  const pupil = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 0.62, 20),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true })
  );
  pupil.position.z = radius * 0.86;
  group.add(pupil);
  return group;
}

// Simple anime face plate: two big eyes + brow + mouth baked to a texture,
// applied to a flat plane so we avoid UV-mapping a sphere by hand.
export function createFaceTexture({ eyeColor = '#111', irisColor = '#4fd3ff', blush = '#ff8fab' } = {}) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  const eyeY = size * 0.48;
  const eyeDX = size * 0.19;
  const eyeW = size * 0.15;
  const eyeH = size * 0.19;

  [-1, 1].forEach((side) => {
    const ex = size / 2 + side * eyeDX;
    ctx.save();
    ctx.translate(ex, eyeY);

    ctx.beginPath();
    ctx.ellipse(0, 0, eyeW / 2, eyeH / 2, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(0, eyeH * 0.05, eyeW * 0.36, eyeH * 0.42, 0, 0, Math.PI * 2);
    ctx.fillStyle = irisColor;
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(0, eyeH * 0.1, eyeW * 0.16, eyeH * 0.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = eyeColor;
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(-eyeW * 0.12, -eyeH * 0.12, eyeW * 0.09, eyeH * 0.11, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(0, -eyeH * 0.06, eyeW / 2, eyeH / 2, 0, Math.PI * 1.05, Math.PI * 1.95);
    ctx.strokeStyle = eyeColor;
    ctx.lineWidth = size * 0.014;
    ctx.stroke();

    ctx.restore();

    ctx.beginPath();
    ctx.ellipse(ex, eyeY + eyeH * 1.05, eyeW * 0.42, eyeH * 0.22, 0, 0, Math.PI * 2);
    ctx.fillStyle = blush;
    ctx.globalAlpha = 0.35;
    ctx.fill();
    ctx.globalAlpha = 1;
  });

  // determined little battle grin
  ctx.beginPath();
  ctx.moveTo(size * 0.42, size * 0.72);
  ctx.quadraticCurveTo(size * 0.5, size * 0.79, size * 0.58, size * 0.72);
  ctx.strokeStyle = '#2a1420';
  ctx.lineWidth = size * 0.014;
  ctx.lineCap = 'round';
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Billboard sprite with outlined text — used for floating damage numbers,
// "+XP" popups, and monster name tags.
export function makeTextSprite(text, { color = '#ffffff', outline = '#000000', size = 48, scale = 1 } = {}) {
  const pad = 16;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = `900 ${size}px 'Segoe UI', system-ui, sans-serif`;
  const w = Math.ceil(ctx.measureText(text).width) + pad * 2;
  canvas.width = w;
  canvas.height = size + pad * 2;
  const c2 = canvas.getContext('2d');
  c2.font = `900 ${size}px 'Segoe UI', system-ui, sans-serif`;
  c2.textAlign = 'center';
  c2.textBaseline = 'middle';
  c2.lineWidth = size * 0.16;
  c2.strokeStyle = outline;
  c2.strokeText(text, w / 2, canvas.height / 2);
  c2.fillStyle = color;
  c2.fillText(text, w / 2, canvas.height / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  const aspect = w / canvas.height;
  sprite.scale.set(0.55 * aspect * scale, 0.55 * scale, 1);
  return sprite;
}
