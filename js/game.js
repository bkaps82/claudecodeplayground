// Orchestration: owns the live `state`, the game loop, input capture,
// and the solo / host / client mode wiring around Sim + Network.
const Game = (() => {
  let canvas, ctx;
  let state = null;
  let mode = 'menu'; // 'menu' | 'solo' | 'host' | 'client'
  let myName = 'Player';
  let lastTime = 0;
  let netAccum = 0;
  const NET_TICK_MS = 80; // ~12.5Hz snapshot / input rate
  let running = false;

  const keys = { up: false, down: false, left: false, right: false, shooting: false };
  let mouseWorld = { x: 0, y: 0 };
  let lastCam = { x: 0, y: 0 };

  function el(id) { return document.getElementById(id); }

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function init() {
    canvas = el('game');
    ctx = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    bindInput();
    bindMenu();
  }

  function bindInput() {
    window.addEventListener('keydown', (e) => {
      handleKey(e.code, true);
      if (e.code === 'KeyE') tryRecruitLocal();
    });
    window.addEventListener('keyup', (e) => handleKey(e.code, false));
    canvas.addEventListener('mousemove', (e) => {
      mouseWorld.x = e.clientX + lastCam.x;
      mouseWorld.y = e.clientY + lastCam.y;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      keys.shooting = true;
      Sound.unlock();
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) keys.shooting = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  function handleKey(code, down) {
    if (code === 'KeyW' || code === 'ArrowUp') keys.up = down;
    if (code === 'KeyS' || code === 'ArrowDown') keys.down = down;
    if (code === 'KeyA' || code === 'ArrowLeft') keys.left = down;
    if (code === 'KeyD' || code === 'ArrowRight') keys.right = down;
  }

  function myPlayer() { return state && state.players[state.myId]; }

  function tryRecruitLocal() {
    if (!state) return;
    const me = myPlayer();
    if (!me) return;
    if (mode === 'client') {
      Network.sendToHost({ type: 'recruit' });
    } else {
      Sim.tryRecruit(state, me);
    }
  }

  // ---------- state / world setup ----------
  function freshState(seed) {
    const world = new World(seed);
    return {
      world, seed,
      players: {}, critters: {}, powerups: {}, inks: {}, splats: {},
      matchTimeLeft: MATCH_DURATION, matchEnded: false,
      myId: null, now: performance.now(), powerupSpawnT: 3000,
      newSplats: [], events: [], broadcastEvents: [],
    };
  }

  function spawnCritters(st) {
    st.world.critterSpots.forEach((spot) => {
      if (Math.random() < 0.65) {
        const c = makeCritter(spot);
        st.critters[c.id] = c;
      }
    });
  }

  function addPlayerAt(st, id, name, colorIdx, isBot = false) {
    const spot = st.world.spawnPoints[colorIdx % st.world.spawnPoints.length];
    st.players[id] = makePlayer(id, name, colorIdx, spot.x, spot.y, isBot);
    return st.players[id];
  }

  function nextColorIdx(st) {
    const used = new Set(Object.values(st.players).map((p) => p.colorIdx));
    for (let i = 0; i < Utils.PLAYER_COLORS.length; i++) if (!used.has(i)) return i;
    return Object.keys(st.players).length % Utils.PLAYER_COLORS.length;
  }

  // ---------- SOLO ----------
  function startSolo(name) {
    teardownNetwork();
    myName = name || 'Player';
    mode = 'solo';
    state = freshState(Math.floor(Math.random() * 1e9));
    state.myId = 'me';
    addPlayerAt(state, 'me', myName, 0);
    addPlayerAt(state, 'bot1', 'Sprigg (Bot)', 1, true);
    addPlayerAt(state, 'bot2', 'Mossy (Bot)', 2, true);
    spawnCritters(state);
    enterGame();
  }

  // ---------- HOST ----------
  async function startHost(name) {
    teardownNetwork();
    myName = name || 'Player';
    mode = 'host';
    try {
      const code = await Network.hostGame(myName);
      state = freshState(Math.floor(Math.random() * 1e9));
      state.myId = Network.myId();
      addPlayerAt(state, state.myId, myName, 0);
      spawnCritters(state);
      el('roomCodeDisplay').textContent = code;
      el('hostLobby').style.display = 'block';
      Network.on('clientMessage', onHostReceive);
      Network.on('clientLeft', ({ id }) => {
        const p = state.players[id];
        if (p && p.companionId && state.critters[p.companionId]) {
          state.critters[p.companionId].state = 'wild';
          state.critters[p.companionId].ownerId = null;
        }
        delete state.players[id];
        renderLobbyList();
      });
      Network.on('error', (err) => showNetError(err));
      renderLobbyList();
    } catch (err) {
      showNetError(err);
    }
  }

  function renderLobbyList() {
    if (!state) return;
    const names = Object.values(state.players).map((p) => `<span class="lobby-chip" style="border-color:${p.color}">${p.name}</span>`).join('');
    el('lobbyPlayers').innerHTML = names;
  }

  function onHostReceive({ fromId, data }) {
    if (data.type === 'hello') {
      if (Object.keys(state.players).length >= Utils.PLAYER_COLORS.length) return; // lobby full
      const idx = nextColorIdx(state);
      addPlayerAt(state, fromId, (data.name || 'Player').slice(0, 14), idx);
      Network.sendTo(fromId, { type: 'welcome', seed: state.seed, yourId: fromId, matchTimeLeft: state.matchTimeLeft });
      renderLobbyList();
    } else if (data.type === 'input') {
      const p = state.players[fromId];
      if (p) p.input = data.input;
    } else if (data.type === 'recruit') {
      const p = state.players[fromId];
      if (p) Sim.tryRecruit(state, p);
    }
  }

  function startHostedMatch() {
    el('hostLobby').style.display = 'none';
    enterGame();
  }

  // ---------- CLIENT ----------
  async function startClient(code, name) {
    teardownNetwork();
    myName = name || 'Player';
    mode = 'client';
    try {
      await Network.joinGame(code, myName);
      Network.on('hostMessage', onClientReceive);
      Network.on('hostLeft', () => {
        alert('Lost connection to the host.');
        backToMenu();
      });
      Network.on('error', (err) => showNetError(err));
      el('joinStatus').textContent = 'Connecting…';
    } catch (err) {
      showNetError(err);
    }
  }

  function onClientReceive(data) {
    if (data.type === 'welcome') {
      state = freshState(data.seed);
      state.myId = data.yourId;
      state.matchTimeLeft = data.matchTimeLeft;
      enterGame();
    } else if (data.type === 'snapshot' && state) {
      applySnapshot(data);
    }
  }

  function applySnapshot(snap) {
    // Other players / critters / powerups / inks: take host's values directly.
    const myId = state.myId;
    const incomingIds = new Set(Object.keys(snap.players));
    for (const id in state.players) if (!incomingIds.has(id)) delete state.players[id];
    for (const id in snap.players) {
      const src = snap.players[id];
      if (id === myId && state.players[id]) {
        const mine = state.players[id];
        // gentle correction toward server truth, keep local predicted pos smooth
        mine.x = Utils.lerp(mine.x, src.x, 0.25);
        mine.y = Utils.lerp(mine.y, src.y, 0.25);
        mine.hp = src.hp; mine.ammo = src.ammo; mine.alive = src.alive;
        mine.kos = src.kos; mine.deaths = src.deaths;
        mine.powerup = src.powerup; mine.powerupUntil = src.powerupUntil;
        mine.companionId = src.companionId;
        if (!keys.up && !keys.down && !keys.left && !keys.right) mine.angle = src.angle;
      } else {
        state.players[id] = state.players[id] || {};
        Object.assign(state.players[id], src, { input: state.players[id].input || {} });
      }
    }
    state.critters = snap.critters;
    state.powerups = snap.powerups;
    state.inks = snap.inks;
    if (snap.newSplats) for (const s of snap.newSplats) state.splats[s.id] = s;
    trimSplats(state);
    state.matchTimeLeft = snap.matchTimeLeft;
    state.matchEnded = snap.matchEnded;
    if (snap.events) handleEvents(snap.events);
  }

  function trimSplats(st) {
    const keys2 = Object.keys(st.splats);
    if (keys2.length > MAX_SPLATS) {
      keys2.sort((a, b) => st.splats[a].t - st.splats[b].t);
      for (let i = 0; i < keys2.length - MAX_SPLATS; i++) delete st.splats[keys2[i]];
    }
  }

  // ---------- shared lifecycle ----------
  function enterGame() {
    el('menu').style.display = 'none';
    el('hud').style.display = 'block';
    el('endScreen').style.display = 'none';
    running = true;
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  function backToMenu() {
    running = false;
    teardownNetwork();
    state = null;
    el('menu').style.display = 'flex';
    el('hud').style.display = 'none';
    el('endScreen').style.display = 'none';
    el('hostLobby').style.display = 'none';
    showPane('mainMenu');
  }

  function teardownNetwork() {
    Network.teardown();
  }

  function showNetError(err) {
    console.error(err);
    const msg = (err && err.type) ? `Connection error: ${err.type}` : 'Connection error. Check the code and try again.';
    el('joinStatus').textContent = msg;
    el('hostLobby').style.display = 'none';
  }

  function handleEvents(events) {
    for (const e of events) {
      if (e.type === 'hit' && e.targetId === state.myId) Sound.splatHit();
      else if (e.type === 'shoot') { /* light footprint - only play for nearby shots to avoid noise spam */ }
      if (e.type === 'ko') Sound.ko();
      if (e.type === 'recruit') Sound.recruit();
      if (e.type === 'powerup') Sound.powerup();
      if (e.type === 'respawn' && e.playerId === state.myId) Sound.respawn();
    }
  }

  // ---------- per-frame ----------
  function captureLocalInput() {
    const me = myPlayer();
    if (!me) return null;
    return {
      up: keys.up, down: keys.down, left: keys.left, right: keys.right,
      mx: mouseWorld.x, my: mouseWorld.y, shooting: keys.shooting,
    };
  }

  function botThink(st, p, dt) {
    p.botTimer -= dt;
    const enemy = Sim ? nearestEnemyForBot(st, p) : null;
    if (enemy) {
      const ang = Utils.angleTo(p.x, p.y, enemy.x, enemy.y);
      const d = Utils.dist(p.x, p.y, enemy.x, enemy.y);
      p.input.mx = enemy.x; p.input.my = enemy.y;
      const preferred = 170;
      p.input.up = false; p.input.down = false; p.input.left = false; p.input.right = false;
      if (d > preferred + 20) {
        if (Math.cos(ang) > 0.3) p.input.right = true; else if (Math.cos(ang) < -0.3) p.input.left = true;
        if (Math.sin(ang) > 0.3) p.input.down = true; else if (Math.sin(ang) < -0.3) p.input.up = true;
      } else if (d < preferred - 30) {
        if (Math.cos(ang) > 0.3) p.input.left = true; else if (Math.cos(ang) < -0.3) p.input.right = true;
        if (Math.sin(ang) > 0.3) p.input.up = true; else if (Math.sin(ang) < -0.3) p.input.down = true;
      } else {
        if (p.botTimer <= 0) { p.input.left = Math.random() < 0.5; p.input.right = !p.input.left; }
      }
      p.input.shooting = d < 320;
    } else {
      p.input.shooting = false;
      if (p.botTimer <= 0) {
        p.botTimer = 1500 + Math.random() * 1500;
        p.input.up = Math.random() < 0.5;
        p.input.down = !p.input.up && Math.random() < 0.5;
        p.input.left = Math.random() < 0.5;
        p.input.right = !p.input.left && Math.random() < 0.5;
        p.input.mx = p.x + (Math.random() - 0.5) * 200;
        p.input.my = p.y + (Math.random() - 0.5) * 200;
      }
    }
  }

  function nearestEnemyForBot(st, p) {
    let best = null, bestD = SIGHT_RADIUS;
    for (const id in st.players) {
      if (id === p.id) continue;
      const o = st.players[id];
      if (!o.alive) continue;
      const d = Utils.dist(p.x, p.y, o.x, o.y);
      if (d < bestD) { bestD = d; best = o; }
    }
    return best;
  }

  function loop(now) {
    if (!running) return;
    const dt = Math.min(50, now - lastTime);
    lastTime = now;

    if (mode === 'solo' || mode === 'host') {
      const me = myPlayer();
      if (me) me.input = captureLocalInput();
      for (const id in state.players) {
        const p = state.players[id];
        if (p.isBot) botThink(state, p, dt);
      }
      Sim.step(state, dt, now);
      handleEvents(state.events);
      state.events.length = 0;
      if (mode === 'solo') { state.newSplats.length = 0; state.broadcastEvents.length = 0; }

      if (mode === 'host') {
        netAccum += dt;
        if (netAccum >= NET_TICK_MS) {
          netAccum = 0;
          Network.broadcast(buildSnapshot());
          state.newSplats.length = 0;
          state.broadcastEvents.length = 0;
        }
      }
    } else if (mode === 'client') {
      const me = myPlayer();
      if (me) {
        me.input = captureLocalInput();
        localPredict(me, dt); // light local prediction so movement feels instant
      }
      netAccum += dt;
      if (netAccum >= NET_TICK_MS) {
        netAccum = 0;
        if (me) Network.sendToHost({ type: 'input', input: me.input });
      }
    }

    render(now);
    requestAnimationFrame(loop);
  }

  function localPredict(me, dt) {
    if (!me.alive) return;
    let dx = 0, dy = 0;
    if (me.input.up) dy -= 1;
    if (me.input.down) dy += 1;
    if (me.input.left) dx -= 1;
    if (me.input.right) dx += 1;
    if (dx || dy) {
      const len = Math.hypot(dx, dy); dx /= len; dy /= len;
      const speed = Sim.playerSpeed(me);
      const step = speed * (dt / 1000);
      const res = state.world.resolveMove(me.x, me.y, dx * step, dy * step, PLAYER_RADIUS);
      me.x = res.x; me.y = res.y;
    }
    me.angle = Utils.angleTo(me.x, me.y, me.input.mx, me.input.my);
  }

  function buildSnapshot() {
    const players = {};
    for (const id in state.players) {
      const p = state.players[id];
      players[id] = {
        id: p.id, name: p.name, color: p.color, colorIdx: p.colorIdx,
        x: p.x, y: p.y, angle: p.angle, hp: p.hp, ammo: p.ammo, alive: p.alive,
        kos: p.kos, deaths: p.deaths, powerup: p.powerup, powerupUntil: p.powerupUntil,
        companionId: p.companionId,
      };
    }
    const critters = {};
    for (const id in state.critters) {
      const c = state.critters[id];
      critters[id] = { id: c.id, type: c.type, color: c.color, accent: c.accent, x: c.x, y: c.y, state: c.state, ownerId: c.ownerId };
    }
    const powerups = {};
    for (const id in state.powerups) {
      const pu = state.powerups[id];
      powerups[id] = { id: pu.id, type: pu.type, x: pu.x, y: pu.y, bobT: pu.bobT };
    }
    const inks = {};
    for (const id in state.inks) {
      const i = state.inks[id];
      inks[id] = { id: i.id, color: i.color, x: i.x, y: i.y };
    }
    const snap = {
      type: 'snapshot', players, critters, powerups, inks,
      newSplats: state.newSplats.slice(),
      matchTimeLeft: state.matchTimeLeft, matchEnded: state.matchEnded,
      events: state.broadcastEvents.slice(),
    };
    return snap;
  }

  function render(now) {
    if (!state) return;
    lastCam = Render.drawWorld(ctx, state, canvas.width, canvas.height, now);
    Render.updateHud(state);
    if (state.matchEnded) showEndScreen();
  }

  let endShown = false;
  function showEndScreen() {
    if (endShown) return;
    endShown = true;
    const ranked = Object.values(state.players).sort((a, b) => b.kos - a.kos);
    const rows = ranked.map((p, i) => `<div class="end-row">${i === 0 ? '\u{1F3C6}' : `${i + 1}.`} <span class="swatch" style="background:${p.color}"></span>${p.name} — ${p.kos} KOs</div>`).join('');
    el('endRows').innerHTML = rows;
    el('endScreen').style.display = 'flex';
  }

  function resetEndFlag() { endShown = false; }

  // ---------- menu wiring ----------
  function showPane(id) {
    ['mainMenu', 'soloPane', 'hostPane', 'joinPane'].forEach((p) => { el(p).style.display = p === id ? 'flex' : 'none'; });
  }

  function bindMenu() {
    el('btnSoloNav').onclick = () => showPane('soloPane');
    el('btnHostNav').onclick = () => showPane('hostPane');
    el('btnJoinNav').onclick = () => showPane('joinPane');
    [['backFromSolo'], ['backFromHost'], ['backFromJoin']].forEach(([id]) => { el(id).onclick = () => showPane('mainMenu'); });

    el('btnStartSolo').onclick = () => { resetEndFlag(); startSolo(el('soloName').value); };
    el('btnStartHost').onclick = () => { resetEndFlag(); startHost(el('hostName').value); };
    el('btnStartMatch').onclick = () => startHostedMatch();
    el('btnJoin').onclick = () => { resetEndFlag(); startClient(el('joinCode').value, el('joinName').value); };
    el('btnRematch').onclick = () => {
      resetEndFlag();
      if (mode === 'solo') startSolo(myName);
      else backToMenu();
    };
    el('btnEndToMenu').onclick = () => backToMenu();
  }

  return { init, get debugState() { return state; } };
})();
