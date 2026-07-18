// Thin PeerJS wrapper: star topology, host is authoritative simulation owner,
// clients send input and receive full-state snapshots. Uses PeerJS's free
// public signaling broker for WebRTC — no game server required.
const Network = (() => {
  const listeners = {};
  let peer = null;
  let isHost = false;
  let hostConn = null; // client -> connection to host
  const clientConns = {}; // host -> map of peerId -> connection
  let roomCode = null;

  function on(evt, cb) {
    (listeners[evt] = listeners[evt] || []).push(cb);
  }
  function emit(evt, data) {
    (listeners[evt] || []).forEach((cb) => cb(data));
  }

  function fullId(code) { return `inkforest-${code}`; }

  function hostGame(name) {
    return new Promise((resolve, reject) => {
      roomCode = Utils.genCode();
      isHost = true;
      peer = new Peer(fullId(roomCode), { debug: 1 });
      peer.on('open', () => resolve(roomCode));
      peer.on('error', (err) => {
        if (err.type === 'unavailable-id') {
          // extremely rare collision - retry with a fresh code
          roomCode = Utils.genCode();
          peer.destroy();
          hostGame(name).then(resolve).catch(reject);
        } else {
          emit('error', err);
          reject(err);
        }
      });
      peer.on('connection', (conn) => {
        conn.on('open', () => {
          clientConns[conn.peer] = conn;
        });
        conn.on('data', (data) => emit('clientMessage', { fromId: conn.peer, data }));
        conn.on('close', () => {
          delete clientConns[conn.peer];
          emit('clientLeft', { id: conn.peer });
        });
      });
    });
  }

  function joinGame(code, name) {
    return new Promise((resolve, reject) => {
      isHost = false;
      peer = new Peer(undefined, { debug: 1 });
      peer.on('open', () => {
        hostConn = peer.connect(fullId(code.trim().toUpperCase()), { reliable: true });
        hostConn.on('open', () => {
          hostConn.send({ type: 'hello', name });
          resolve(peer.id);
        });
        hostConn.on('data', (data) => emit('hostMessage', data));
        hostConn.on('close', () => emit('hostLeft'));
        hostConn.on('error', (err) => { emit('error', err); reject(err); });
      });
      peer.on('error', (err) => { emit('error', err); reject(err); });
    });
  }

  function sendToHost(data) {
    if (hostConn && hostConn.open) hostConn.send(data);
  }

  function broadcast(data) {
    for (const id in clientConns) {
      const c = clientConns[id];
      if (c.open) c.send(data);
    }
  }

  function sendTo(id, data) {
    const c = clientConns[id];
    if (c && c.open) c.send(data);
  }

  function myId() { return peer ? peer.id : null; }

  function teardown() {
    Object.keys(listeners).forEach((k) => delete listeners[k]);
    if (peer) { try { peer.destroy(); } catch (e) { /* noop */ } peer = null; }
    hostConn = null;
    for (const k in clientConns) delete clientConns[k];
    isHost = false;
    roomCode = null;
  }

  return { on, emit, hostGame, joinGame, sendToHost, broadcast, sendTo, myId, teardown, get isHost() { return isHost; }, get roomCode() { return roomCode; } };
})();
