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

/**
 * Builds a cel-shaded mesh plus a slightly-enlarged backface-only outline
 * mesh (the classic anime "inverted hull" outline trick), grouped together.
 */
export function createToonPart(geometry, color, { outlineColor = 0x120814, outlineScale = 1.06 } = {}) {
  const material = new THREE.MeshToonMaterial({
    color,
    gradientMap: getToonGradientMap(),
  });
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

let splatTextureCache = new Map();

// Procedural blob-with-drips splat sprite so paint hits have organic edges
// instead of perfect circles. Cached per color so we don't redraw canvases
// every single hit.
export function getSplatTexture(hexColor) {
  const key = hexColor.toString(16);
  if (splatTextureCache.has(key)) return splatTextureCache.get(key);

  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2;
  const cy = size / 2;

  const color = new THREE.Color(hexColor);
  const rgb = `${Math.round(color.r * 255)},${Math.round(color.g * 255)},${Math.round(color.b * 255)}`;

  ctx.clearRect(0, 0, size, size);

  // main blob - irregular polygon
  ctx.beginPath();
  const lobes = 10;
  for (let i = 0; i <= lobes; i++) {
    const a = (i / lobes) * Math.PI * 2;
    const r = size * 0.3 * (0.72 + Math.random() * 0.32);
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, size * 0.32);
  grad.addColorStop(0, `rgba(${rgb},1)`);
  grad.addColorStop(0.8, `rgba(${rgb},0.95)`);
  grad.addColorStop(1, `rgba(${rgb},0.55)`);
  ctx.fillStyle = grad;
  ctx.fill();

  // drip streaks
  for (let i = 0; i < 5; i++) {
    const a = Math.random() * Math.PI * 2;
    const len = size * (0.15 + Math.random() * 0.22);
    const startR = size * 0.24;
    const x0 = cx + Math.cos(a) * startR;
    const y0 = cy + Math.sin(a) * startR;
    const x1 = cx + Math.cos(a) * (startR + len);
    const y1 = cy + Math.sin(a) * (startR + len);
    ctx.strokeStyle = `rgba(${rgb},${0.5 + Math.random() * 0.4})`;
    ctx.lineWidth = 3 + Math.random() * 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x1, y1, ctx.lineWidth * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${rgb},0.6)`;
    ctx.fill();
  }

  // small satellite droplets
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = size * (0.32 + Math.random() * 0.16);
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    const dr = 2 + Math.random() * 4;
    ctx.beginPath();
    ctx.arc(x, y, dr, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${rgb},${0.5 + Math.random() * 0.4})`;
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  splatTextureCache.set(key, tex);
  return tex;
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

    // white
    ctx.beginPath();
    ctx.ellipse(0, 0, eyeW / 2, eyeH / 2, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // iris
    ctx.beginPath();
    ctx.ellipse(0, eyeH * 0.05, eyeW * 0.36, eyeH * 0.42, 0, 0, Math.PI * 2);
    ctx.fillStyle = irisColor;
    ctx.fill();

    // pupil
    ctx.beginPath();
    ctx.ellipse(0, eyeH * 0.1, eyeW * 0.16, eyeH * 0.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = eyeColor;
    ctx.fill();

    // highlight
    ctx.beginPath();
    ctx.ellipse(-eyeW * 0.12, -eyeH * 0.12, eyeW * 0.09, eyeH * 0.11, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // lash line
    ctx.beginPath();
    ctx.ellipse(0, -eyeH * 0.06, eyeW / 2, eyeH / 2, 0, Math.PI * 1.05, Math.PI * 1.95);
    ctx.strokeStyle = eyeColor;
    ctx.lineWidth = size * 0.014;
    ctx.stroke();

    ctx.restore();

    // blush
    ctx.beginPath();
    ctx.ellipse(ex, eyeY + eyeH * 1.05, eyeW * 0.42, eyeH * 0.22, 0, 0, Math.PI * 2);
    ctx.fillStyle = blush;
    ctx.globalAlpha = 0.35;
    ctx.fill();
    ctx.globalAlpha = 1;
  });

  // mouth
  ctx.beginPath();
  ctx.moveTo(size * 0.44, size * 0.72);
  ctx.quadraticCurveTo(size * 0.5, size * 0.76, size * 0.56, size * 0.72);
  ctx.strokeStyle = '#2a1420';
  ctx.lineWidth = size * 0.012;
  ctx.lineCap = 'round';
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
