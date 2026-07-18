// Procedural blocky forest world: tile grid, generation, collision, rendering.
const TILE = { GRASS: 0, WATER: 1, TREE: 2, PATH: 3, TALLGRASS: 4 };
const TILE_SIZE = 32;

class World {
  constructor(seed, cols = 60, rows = 45) {
    this.seed = seed;
    this.cols = cols;
    this.rows = rows;
    this.tiles = new Uint8Array(cols * rows);
    this.variant = new Uint8Array(cols * rows); // visual variety per tile
    this.width = cols * TILE_SIZE;
    this.height = rows * TILE_SIZE;
    this.spawnPoints = [];
    this.critterSpots = [];
    this.generate();
  }

  idx(cx, cy) { return cy * this.cols + cx; }

  inBounds(cx, cy) { return cx >= 0 && cy >= 0 && cx < this.cols && cy < this.rows; }

  tileAt(cx, cy) {
    if (!this.inBounds(cx, cy)) return TILE.TREE;
    return this.tiles[this.idx(cx, cy)];
  }

  generate() {
    const rng = Utils.mulberry32(this.seed);
    const { cols, rows, tiles, variant } = this;
    // base grass
    for (let i = 0; i < tiles.length; i++) {
      tiles[i] = TILE.GRASS;
      variant[i] = Math.floor(rng() * 3);
    }
    // border trees
    for (let x = 0; x < cols; x++) {
      tiles[this.idx(x, 0)] = TILE.TREE;
      tiles[this.idx(x, rows - 1)] = TILE.TREE;
    }
    for (let y = 0; y < rows; y++) {
      tiles[this.idx(0, y)] = TILE.TREE;
      tiles[this.idx(cols - 1, y)] = TILE.TREE;
    }
    // tree clusters
    const clusterCount = 22;
    for (let c = 0; c < clusterCount; c++) {
      const cx = 3 + Math.floor(rng() * (cols - 6));
      const cy = 3 + Math.floor(rng() * (rows - 6));
      const size = 1 + Math.floor(rng() * 3);
      for (let dx = -size; dx <= size; dx++) {
        for (let dy = -size; dy <= size; dy++) {
          if (rng() < 0.55 && Math.abs(dx) + Math.abs(dy) <= size + 1) {
            const x = cx + dx, y = cy + dy;
            if (this.inBounds(x, y)) tiles[this.idx(x, y)] = TILE.TREE;
          }
        }
      }
    }
    // lake
    const lx = 8 + Math.floor(rng() * (cols - 16));
    const ly = 8 + Math.floor(rng() * (rows - 16));
    const lakeR = 3 + Math.floor(rng() * 2);
    for (let dx = -lakeR; dx <= lakeR; dx++) {
      for (let dy = -lakeR; dy <= lakeR; dy++) {
        if (dx * dx + dy * dy <= lakeR * lakeR + rng() * 3) {
          const x = lx + dx, y = ly + dy;
          if (this.inBounds(x, y)) tiles[this.idx(x, y)] = TILE.WATER;
        }
      }
    }
    // tall grass patches (critter zones)
    const patchCount = 10;
    for (let p = 0; p < patchCount; p++) {
      const px = 3 + Math.floor(rng() * (cols - 6));
      const py = 3 + Math.floor(rng() * (rows - 6));
      const size = 2 + Math.floor(rng() * 2);
      let placed = false;
      for (let dx = -size; dx <= size; dx++) {
        for (let dy = -size; dy <= size; dy++) {
          const x = px + dx, y = py + dy;
          if (this.inBounds(x, y) && tiles[this.idx(x, y)] === TILE.GRASS && rng() < 0.7) {
            tiles[this.idx(x, y)] = TILE.TALLGRASS;
            placed = true;
          }
        }
      }
      if (placed) this.critterSpots.push({ x: (px + 0.5) * TILE_SIZE, y: (py + 0.5) * TILE_SIZE });
    }
    // winding dirt path from center outward (cosmetic)
    let px = Math.floor(cols / 2), py = Math.floor(rows / 2);
    for (let i = 0; i < 40; i++) {
      if (this.inBounds(px, py) && tiles[this.idx(px, py)] !== TILE.WATER && tiles[this.idx(px, py)] !== TILE.TREE) {
        tiles[this.idx(px, py)] = TILE.PATH;
      }
      const dir = Math.floor(rng() * 4);
      if (dir === 0) px++; else if (dir === 1) px--; else if (dir === 2) py++; else py--;
      px = Utils.clamp(px, 1, cols - 2);
      py = Utils.clamp(py, 1, rows - 2);
    }
    // corner spawn points (open areas, cleared of trees)
    const corners = [
      { x: 3, y: 3 }, { x: cols - 4, y: 3 }, { x: 3, y: rows - 4 }, { x: cols - 4, y: rows - 4 },
    ];
    for (const c of corners) {
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const x = c.x + dx, y = c.y + dy;
          if (this.inBounds(x, y) && tiles[this.idx(x, y)] !== TILE.WATER) tiles[this.idx(x, y)] = TILE.GRASS;
        }
      }
      this.spawnPoints.push({ x: (c.x + 0.5) * TILE_SIZE, y: (c.y + 0.5) * TILE_SIZE });
    }
  }

  isBlocked(cx, cy) {
    const t = this.tileAt(cx, cy);
    return t === TILE.TREE || t === TILE.WATER;
  }

  // Circle-vs-grid collision resolution, moves (x,y) by (dx,dy) respecting blocking tiles.
  resolveMove(x, y, dx, dy, radius) {
    let nx = x + dx;
    if (this.circleBlocked(nx, y, radius)) nx = x;
    let ny = y + dy;
    if (this.circleBlocked(nx, ny, radius)) ny = y;
    return { x: nx, y: ny };
  }

  circleBlocked(x, y, radius) {
    const minCx = Math.floor((x - radius) / TILE_SIZE);
    const maxCx = Math.floor((x + radius) / TILE_SIZE);
    const minCy = Math.floor((y - radius) / TILE_SIZE);
    const maxCy = Math.floor((y + radius) / TILE_SIZE);
    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        if (this.isBlocked(cx, cy)) {
          const tx = cx * TILE_SIZE, ty = cy * TILE_SIZE;
          const closeX = Utils.clamp(x, tx, tx + TILE_SIZE);
          const closeY = Utils.clamp(y, ty, ty + TILE_SIZE);
          if (Utils.dist(x, y, closeX, closeY) < radius) return true;
        }
      }
    }
    return false;
  }

  render(ctx, camX, camY, viewW, viewH) {
    const minCx = Math.max(0, Math.floor(camX / TILE_SIZE));
    const minCy = Math.max(0, Math.floor(camY / TILE_SIZE));
    const maxCx = Math.min(this.cols - 1, Math.ceil((camX + viewW) / TILE_SIZE));
    const maxCy = Math.min(this.rows - 1, Math.ceil((camY + viewH) / TILE_SIZE));

    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const t = this.tiles[this.idx(cx, cy)];
        const v = this.variant[this.idx(cx, cy)];
        const sx = cx * TILE_SIZE - camX;
        const sy = cy * TILE_SIZE - camY;
        this.renderGroundTile(ctx, t, v, sx, sy);
      }
    }
    // trees drawn after ground pass (as blocky cubes with height, so they overlap tiles below them)
    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const t = this.tiles[this.idx(cx, cy)];
        if (t === TILE.TREE) {
          const sx = cx * TILE_SIZE - camX;
          const sy = cy * TILE_SIZE - camY;
          this.renderTree(ctx, sx, sy);
        }
      }
    }
  }

  renderGroundTile(ctx, t, v, sx, sy) {
    let base;
    switch (t) {
      case TILE.WATER: base = '#3b6fa0'; break;
      case TILE.PATH: base = '#8a6642'; break;
      case TILE.TALLGRASS: base = '#4a8a2e'; break;
      case TILE.TREE: base = '#5b8f3d'; break; // ground under tree
      default: base = v === 0 ? '#5b8f3d' : v === 1 ? '#63983f' : '#578a39';
    }
    ctx.fillStyle = base;
    ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
    // blocky bevel
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(sx, sy, TILE_SIZE, 3);
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    ctx.fillRect(sx, sy + TILE_SIZE - 3, TILE_SIZE, 3);

    if (t === TILE.WATER) {
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(sx + 4, sy + 6, TILE_SIZE - 8, 2);
    }
    if (t === TILE.TALLGRASS) {
      ctx.fillStyle = '#3c7326';
      for (let i = 0; i < 3; i++) {
        const gx = sx + 5 + i * 9;
        ctx.fillRect(gx, sy + 6, 3, TILE_SIZE - 10);
      }
    }
  }

  renderTree(ctx, sx, sy) {
    const h = 22; // extra height drawn upward for blocky 3D feel
    // trunk
    ctx.fillStyle = '#6b4423';
    ctx.fillRect(sx + TILE_SIZE / 2 - 5, sy - h + 18, 10, h);
    // leaves cube: top face + front faces
    ctx.fillStyle = '#2f6b2f';
    ctx.fillRect(sx - 2, sy - h, TILE_SIZE + 4, TILE_SIZE - 6);
    ctx.fillStyle = '#265c26';
    ctx.fillRect(sx - 2, sy - h + TILE_SIZE - 10, TILE_SIZE + 4, 6);
    ctx.fillStyle = '#3d8a3d';
    ctx.fillRect(sx - 2, sy - h, TILE_SIZE + 4, 4);
  }
}
