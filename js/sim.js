// Authoritative simulation step. Only the host (or a solo player acting as
// their own host) runs this; clients just render the latest snapshot plus a
// touch of local prediction for their own player (see net-client in game.js).
const MATCH_DURATION = 4 * 60 * 1000;
const MAX_SPLATS = 260;
const MAX_POWERUPS = 4;
const POWERUP_SPAWN_INTERVAL = 9000;
const SIGHT_RADIUS = 300;

const Sim = (() => {
  function playerSpeed(p) {
    let s = PLAYER_SPEED;
    if (p.powerup === 'SPEED') s *= 1.65;
    return s;
  }

  function standingOnOwnInk(state, p) {
    for (const id in state.splats) {
      const sp = state.splats[id];
      if (sp.color === p.color && Utils.dist(p.x, p.y, sp.x, sp.y) < sp.radius) return true;
    }
    return false;
  }

  function movePlayer(state, p, dt) {
    if (!p.alive) return;
    let dx = 0, dy = 0;
    if (p.input.up) dy -= 1;
    if (p.input.down) dy += 1;
    if (p.input.left) dx -= 1;
    if (p.input.right) dx += 1;
    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy);
      dx /= len; dy /= len;
    }
    const speed = playerSpeed(p);
    const onInk = standingOnOwnInk(state, p);
    const moveSpeed = speed * (onInk ? 1.12 : 1);
    const step = moveSpeed * (dt / 1000);
    const res = state.world.resolveMove(p.x, p.y, dx * step, dy * step, PLAYER_RADIUS);
    p.x = res.x; p.y = res.y;
    p.angle = Utils.angleTo(p.x, p.y, p.input.mx, p.input.my);

    // ammo regen
    const regen = onInk ? 26 : 9;
    p.ammo = Utils.clamp(p.ammo + regen * (dt / 1000), 0, PLAYER_MAX_AMMO);

    // shooting
    const now = state.now;
    const cooldown = p.powerup === 'RAPID' ? 35 : SHOT_COOLDOWN;
    const cost = p.powerup === 'RAPID' ? SHOT_AMMO_COST * 0.4 : SHOT_AMMO_COST;
    if (p.input.shooting && p.ammo >= cost && now - p.lastShot >= cooldown) {
      p.lastShot = now;
      p.ammo -= cost;
      const ink = makeInk(p.id, p.color, p.x + Math.cos(p.angle) * (PLAYER_RADIUS + 4), p.y + Math.sin(p.angle) * (PLAYER_RADIUS + 4), p.angle);
      state.inks[ink.id] = ink;
      fireEvent(state, { type: 'shoot', playerId: p.id });
    }

    // powerup expiry
    if (p.powerup && now > p.powerupUntil) p.powerup = null;
  }

  function addSplat(state, splat) {
    state.splats[splat.id] = splat;
    if (state.newSplats) state.newSplats.push(splat);
    const keys = Object.keys(state.splats);
    if (keys.length > MAX_SPLATS) {
      keys.sort((a, b) => state.splats[a].t - state.splats[b].t);
      delete state.splats[keys[0]];
    }
  }

  function fireEvent(state, evt) {
    if (state.events) state.events.push(evt);
    if (state.broadcastEvents) state.broadcastEvents.push(evt);
  }

  function damagePlayer(state, target, dmg, attackerId) {
    if (!target.alive) return;
    let d = dmg;
    if (target.powerup === 'SHIELD') d *= 0.3;
    target.hp -= d;
    fireEvent(state, { type: 'hit', targetId: target.id, attackerId });
    if (target.hp <= 0) {
      target.hp = 0;
      target.alive = false;
      target.respawnAt = state.now + RESPAWN_TIME;
      target.deaths++;
      fireEvent(state, { type: 'ko', targetId: target.id, attackerId });
      if (attackerId && state.players[attackerId] && attackerId !== target.id) {
        state.players[attackerId].kos++;
      }
    }
  }

  function stepInks(state, dt) {
    for (const id in state.inks) {
      const ink = state.inks[id];
      const step = dt / 1000;
      const nx = ink.x + ink.vx * step;
      const ny = ink.y + ink.vy * step;
      ink.traveled += Math.hypot(nx - ink.x, ny - ink.y);
      ink.x = nx; ink.y = ny;

      let hit = false;
      // wall collision
      if (state.world.circleBlocked(ink.x, ink.y, 3)) hit = true;

      // player collision
      if (!hit) {
        for (const pid in state.players) {
          if (pid === ink.ownerId) continue;
          const p = state.players[pid];
          if (!p.alive) continue;
          if (Utils.dist(ink.x, ink.y, p.x, p.y) < PLAYER_RADIUS) {
            damagePlayer(state, p, INK_DAMAGE, ink.ownerId);
            hit = true;
            break;
          }
        }
      }
      // critter collision (splats wild critters away, no real damage system needed)
      if (!hit) {
        for (const cid in state.critters) {
          const c = state.critters[cid];
          if (c.ownerId === ink.ownerId) continue;
          if (Utils.dist(ink.x, ink.y, c.x, c.y) < CRITTER_RADIUS) {
            hit = true;
            c.vx += ink.vx * 0.15; c.vy += ink.vy * 0.15;
            break;
          }
        }
      }

      if (hit || ink.traveled > INK_RANGE) {
        addSplat(state, makeSplat(ink.x, ink.y, ink.color));
        delete state.inks[id];
      }
    }
  }

  function nearestEnemy(state, p, radius) {
    let best = null, bestD = radius;
    for (const pid in state.players) {
      if (pid === p.id) continue;
      const o = state.players[pid];
      if (!o.alive) continue;
      const d = Utils.dist(p.x, p.y, o.x, o.y);
      if (d < bestD) { bestD = d; best = o; }
    }
    return best;
  }

  function stepCritters(state, dt, now) {
    const step = dt / 1000;
    for (const id in state.critters) {
      const c = state.critters[id];
      if (c.state === 'following' || c.state === 'battling') {
        const owner = state.players[c.ownerId];
        if (!owner || !owner.alive) {
          if (owner && owner.companionId === id) owner.companionId = null;
          c.state = 'wild'; c.ownerId = null; continue;
        }
        const enemy = nearestEnemy(state, owner, 220);
        if (enemy) {
          c.state = 'battling';
          const ang = Utils.angleTo(c.x, c.y, enemy.x, enemy.y);
          const d = Utils.dist(c.x, c.y, enemy.x, enemy.y);
          if (d > 40) {
            const res = state.world.resolveMove(c.x, c.y, Math.cos(ang) * 120 * step, Math.sin(ang) * 120 * step, CRITTER_RADIUS);
            c.x = res.x; c.y = res.y;
          }
          c.attackCooldown -= dt;
          if (c.attackCooldown <= 0 && d < 200) {
            c.attackCooldown = 700;
            const ink = makeInk(owner.id, owner.color, c.x, c.y, ang);
            ink.vx *= 0.7; ink.vy *= 0.7;
            state.inks[ink.id] = ink;
          }
        } else {
          c.state = 'following';
          const followX = owner.x - Math.cos(owner.angle) * 34;
          const followY = owner.y - Math.sin(owner.angle) * 34;
          const d = Utils.dist(c.x, c.y, followX, followY);
          if (d > 8) {
            const ang = Utils.angleTo(c.x, c.y, followX, followY);
            const res = state.world.resolveMove(c.x, c.y, Math.cos(ang) * 170 * step, Math.sin(ang) * 170 * step, CRITTER_RADIUS);
            c.x = res.x; c.y = res.y;
          }
        }
      } else {
        // wild wander near home
        c.wanderTimer -= dt;
        if (c.wanderTimer <= 0) {
          c.wanderTimer = 1200 + Math.random() * 1800;
          c.wanderDir = Math.random() * Math.PI * 2;
        }
        const homeD = Utils.dist(c.x, c.y, c.homeX, c.homeY);
        let ang = c.wanderDir;
        if (homeD > 60) ang = Utils.angleTo(c.x, c.y, c.homeX, c.homeY);
        const res = state.world.resolveMove(c.x, c.y, Math.cos(ang) * 40 * step, Math.sin(ang) * 40 * step, CRITTER_RADIUS);
        c.x = res.x; c.y = res.y;
      }
    }
  }

  function tryRecruit(state, player) {
    if (player.companionId) return false;
    for (const id in state.critters) {
      const c = state.critters[id];
      if (c.state !== 'wild') continue;
      if (Utils.dist(player.x, player.y, c.x, c.y) < 34) {
        c.state = 'following';
        c.ownerId = player.id;
        player.companionId = c.id;
        fireEvent(state, { type: 'recruit', playerId: player.id, critterId: c.id });
        return true;
      }
    }
    return false;
  }

  function stepPowerups(state, dt, now) {
    state.powerupSpawnT = (state.powerupSpawnT || 0) - dt;
    if (state.powerupSpawnT <= 0 && Object.keys(state.powerups).length < MAX_POWERUPS) {
      state.powerupSpawnT = POWERUP_SPAWN_INTERVAL;
      const spot = state.world.spawnableSpot ? state.world.spawnableSpot() : randomOpenSpot(state.world);
      if (spot) state.powerups[nextId('pu')] = makePowerup(spot.x, spot.y);
    }
    for (const id in state.powerups) {
      const pu = state.powerups[id];
      for (const pid in state.players) {
        const p = state.players[pid];
        if (!p.alive) continue;
        if (Utils.dist(p.x, p.y, pu.x, pu.y) < PLAYER_RADIUS + 12) {
          if (pu.type === 'BOMB') {
            addSplat(state, makeSplat(p.x, p.y, p.color, 70));
            for (const oid in state.players) {
              if (oid === pid) continue;
              const o = state.players[oid];
              if (o.alive && Utils.dist(o.x, o.y, p.x, p.y) < 70) damagePlayer(state, o, 40, pid);
            }
          } else {
            p.powerup = pu.type;
            p.powerupUntil = now + POWERUP_TYPES[pu.type].duration;
          }
          fireEvent(state, { type: 'powerup', playerId: pid, powerup: pu.type });
          delete state.powerups[id];
          break;
        }
      }
    }
  }

  function randomOpenSpot(world) {
    for (let tries = 0; tries < 30; tries++) {
      const cx = 2 + Math.floor(Math.random() * (world.cols - 4));
      const cy = 2 + Math.floor(Math.random() * (world.rows - 4));
      if (!world.isBlocked(cx, cy)) return { x: (cx + 0.5) * TILE_SIZE, y: (cy + 0.5) * TILE_SIZE };
    }
    return null;
  }

  function stepRespawns(state, now) {
    for (const id in state.players) {
      const p = state.players[id];
      if (!p.alive && now >= p.respawnAt) {
        const spot = state.world.spawnPoints[p.colorIdx % state.world.spawnPoints.length];
        p.x = spot.x; p.y = spot.y;
        p.alive = true; p.hp = PLAYER_MAX_HP; p.ammo = PLAYER_MAX_AMMO;
        p.powerup = null;
        fireEvent(state, { type: 'respawn', playerId: id });
      }
    }
  }

  function step(state, dt, now) {
    state.now = now;
    if (state.matchEnded) return;
    for (const id in state.players) movePlayer(state, state.players[id], dt);
    stepInks(state, dt);
    stepCritters(state, dt, now);
    stepPowerups(state, dt, now);
    stepRespawns(state, now);
    state.matchTimeLeft -= dt;
    if (state.matchTimeLeft <= 0) {
      state.matchTimeLeft = 0;
      state.matchEnded = true;
    }
  }

  return { step, tryRecruit, playerSpeed };
})();
