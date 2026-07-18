// All drawing: world camera pass, entities, and HUD overlay.
const Render = (() => {
  function camera(state, viewW, viewH) {
    const p = state.players[state.myId] || Object.values(state.players)[0];
    let cx = p ? p.x : state.world.width / 2;
    let cy = p ? p.y : state.world.height / 2;
    cx = Utils.clamp(cx - viewW / 2, 0, Math.max(0, state.world.width - viewW));
    cy = Utils.clamp(cy - viewH / 2, 0, Math.max(0, state.world.height - viewH));
    return { x: cx, y: cy };
  }

  function drawSplats(ctx, state, cam) {
    for (const id in state.splats) {
      const s = state.splats[id];
      const sx = s.x - cam.x, sy = s.y - cam.y;
      ctx.fillStyle = s.color;
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.arc(sx, sy, s.radius, 0, Math.PI * 2);
      ctx.fill();
      // blobby edge detail
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + s.id.length;
        const r = s.radius * (0.55 + 0.25 * Math.sin(i * 2.1 + s.id.length));
        ctx.arc(sx + Math.cos(a) * s.radius * 0.7, sy + Math.sin(a) * s.radius * 0.7, r * 0.35, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawInks(ctx, state, cam) {
    for (const id in state.inks) {
      const ink = state.inks[id];
      ctx.fillStyle = ink.color;
      ctx.beginPath();
      ctx.arc(ink.x - cam.x, ink.y - cam.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPowerups(ctx, state, cam, now) {
    for (const id in state.powerups) {
      const pu = state.powerups[id];
      const def = POWERUP_TYPES[pu.type];
      const bob = Math.sin(now / 260 + pu.bobT) * 4;
      const sx = pu.x - cam.x, sy = pu.y - cam.y + bob;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(sx, pu.y - cam.y + 12, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = def.color;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(Math.sin(now / 500 + pu.bobT) * 0.15);
      ctx.fillRect(-10, -10, 20, 20);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(-10, -10, 20, 5);
      ctx.restore();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(def.label.split(' ')[0], sx, sy - 14);
    }
  }

  function drawCritter(ctx, c, cam) {
    const sx = c.x - cam.x, sy = c.y - cam.y;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(sx, sy + 9, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = c.color;
    ctx.fillRect(sx - 9, sy - 7, 18, 16);
    ctx.fillStyle = c.accent;
    ctx.fillRect(sx - 9, sy - 7, 18, 4);
    // eyes
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(sx - 5, sy - 2, 3, 3);
    ctx.fillRect(sx + 2, sy - 2, 3, 3);
    if (c.state === 'wild') {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(c.type, sx, sy - 12);
    }
  }

  function drawPlayer(ctx, p, cam, now, isMe) {
    if (!p.alive) return;
    const sx = p.x - cam.x, sy = p.y - cam.y;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(sx, sy + 12, 13, 5, 0, 0, Math.PI * 2); ctx.fill();

    // shield bubble
    if (p.powerup === 'SHIELD') {
      ctx.strokeStyle = 'rgba(127,224,255,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(sx, sy, PLAYER_RADIUS + 6, 0, Math.PI * 2); ctx.stroke();
    }

    // body (blocky)
    ctx.fillStyle = p.color;
    ctx.fillRect(sx - PLAYER_RADIUS, sy - PLAYER_RADIUS, PLAYER_RADIUS * 2, PLAYER_RADIUS * 2);
    ctx.fillStyle = Utils.shadeColor(p.color, 0.25);
    ctx.fillRect(sx - PLAYER_RADIUS, sy - PLAYER_RADIUS, PLAYER_RADIUS * 2, 5);
    ctx.fillStyle = Utils.shadeColor(p.color, -0.25);
    ctx.fillRect(sx - PLAYER_RADIUS, sy + PLAYER_RADIUS - 5, PLAYER_RADIUS * 2, 5);

    // gun / facing indicator
    ctx.fillStyle = '#333';
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(p.angle);
    ctx.fillRect(6, -3, 16, 6);
    ctx.restore();

    // face
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(sx, sy - 2, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222';
    const ex = Math.cos(p.angle) * 3, ey = Math.sin(p.angle) * 3;
    ctx.beginPath(); ctx.arc(sx + ex, sy - 2 + ey, 3, 0, Math.PI * 2); ctx.fill();

    // name + hp bar
    ctx.textAlign = 'center';
    ctx.font = isMe ? 'bold 11px monospace' : '11px monospace';
    ctx.fillStyle = '#fff';
    ctx.fillText(p.name, sx, sy - 26);
    const barW = 34;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(sx - barW / 2, sy - 22, barW, 5);
    ctx.fillStyle = p.hp > 40 ? '#5cd15c' : '#ff5252';
    ctx.fillRect(sx - barW / 2, sy - 22, barW * (p.hp / PLAYER_MAX_HP), 5);
  }

  function drawWorld(ctx, state, viewW, viewH, now) {
    const cam = camera(state, viewW, viewH);
    ctx.fillStyle = '#274d17';
    ctx.fillRect(0, 0, viewW, viewH);
    state.world.render(ctx, cam.x, cam.y, viewW, viewH);
    drawSplats(ctx, state, cam);
    drawPowerups(ctx, state, cam, now);
    for (const id in state.critters) drawCritter(ctx, state.critters[id], cam);
    drawInks(ctx, state, cam);

    const order = Object.values(state.players).sort((a, b) => a.y - b.y);
    for (const p of order) drawPlayer(ctx, p, cam, now, p.id === state.myId);

    return cam;
  }

  function fmtTime(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, '0')}`;
  }

  function updateHud(state) {
    const me = state.players[state.myId];
    const $ = (id) => document.getElementById(id);
    $('timer').textContent = fmtTime(state.matchTimeLeft);

    if (me) {
      $('ammoFill').style.width = `${Utils.clamp(me.ammo, 0, 100)}%`;
      $('hpFill').style.width = `${Utils.clamp(me.hp, 0, 100)}%`;
      $('hpFill').style.background = me.hp > 40 ? '#5cd15c' : '#ff5252';

      const puEl = $('powerupBadge');
      if (me.powerup) {
        const def = POWERUP_TYPES[me.powerup];
        puEl.style.display = 'flex';
        puEl.style.background = def.color;
        $('powerupLabel').textContent = def.label;
      } else {
        puEl.style.display = 'none';
      }

      let nearCritter = false;
      if (!me.companionId) {
        for (const id in state.critters) {
          const c = state.critters[id];
          if (c.state === 'wild' && Utils.dist(me.x, me.y, c.x, c.y) < 34) { nearCritter = true; break; }
        }
      }
      $('recruitHint').style.display = nearCritter ? 'block' : 'none';
      $('splattedBanner').style.display = me.alive ? 'none' : 'block';
    }

    // scoreboard
    const board = $('scoreboard');
    const rows = Object.values(state.players)
      .sort((a, b) => b.kos - a.kos)
      .map((p) => `<div class="score-row"><span class="swatch" style="background:${p.color}"></span>${p.name}${p.id === state.myId ? ' (you)' : ''}<span class="score-val">${p.kos}</span></div>`)
      .join('');
    board.innerHTML = rows;
  }

  return { drawWorld, updateHud, camera };
})();
