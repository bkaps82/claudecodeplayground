import { Peer } from 'peerjs';

// Room codes are 4 digits; the PeerJS broker ID namespaces them so we don't
// collide with unrelated apps on the public cloud.
const ID_PREFIX = 'pd-octagon-v1-';

function peerOptions() {
  // Allow pointing at a self-hosted peer server for development/testing:
  //   ?peerhost=127.0.0.1&peerport=9000&peerpath=/  (key optional)
  const params = new URLSearchParams(window.location.search);
  const host = params.get('peerhost');
  if (!host) return {}; // default: PeerJS public cloud
  return {
    host,
    port: Number(params.get('peerport') || 9000),
    path: params.get('peerpath') || '/',
    key: params.get('peerkey') || 'peerjs',
    secure: params.get('peersecure') === '1',
  };
}

export function generateCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export class Net {
  constructor() {
    this.peer = null;
    this.conn = null;
    this.isHost = false;
    this.code = null;
    this.onMessage = null;    // (msg) => void
    this.onConnected = null;  // () => void
    this.onClosed = null;     // (reason) => void
    this._closedFired = false;
  }

  get connected() {
    return !!(this.conn && this.conn.open);
  }

  host(code, { onFailure } = {}) {
    this.isHost = true;
    this.code = code;
    this.peer = new Peer(ID_PREFIX + code, peerOptions());

    this.peer.on('open', () => {
      // id claimed; now wait for a joiner
    });
    this.peer.on('connection', (conn) => {
      if (this.conn) {
        conn.close();
        return;
      }
      this._bindConn(conn);
    });
    this.peer.on('error', (err) => {
      if (err.type === 'unavailable-id') {
        // code already in use on the broker - caller should retry with a new code
        onFailure?.('code-taken');
      } else if (!this.connected) {
        onFailure?.(err.type || 'network');
      }
    });
  }

  join(code, { onFailure } = {}) {
    this.isHost = false;
    this.code = code;
    this.peer = new Peer(peerOptions());

    this.peer.on('open', () => {
      const conn = this.peer.connect(ID_PREFIX + code, { reliable: true });
      this._bindConn(conn);
      // if the host code doesn't exist, peerjs surfaces a peer-unavailable error
      setTimeout(() => {
        if (!this.connected) onFailure?.('timeout');
      }, 8000);
    });
    this.peer.on('error', (err) => {
      if (err.type === 'peer-unavailable') onFailure?.('no-such-room');
      else if (!this.connected) onFailure?.(err.type || 'network');
    });
  }

  _bindConn(conn) {
    this.conn = conn;
    conn.on('open', () => {
      this.onConnected?.();
    });
    conn.on('data', (data) => {
      this.onMessage?.(data);
    });
    conn.on('close', () => this._fireClosed('closed'));
    conn.on('error', () => this._fireClosed('error'));
  }

  _fireClosed(reason) {
    if (this._closedFired) return;
    this._closedFired = true;
    this.onClosed?.(reason);
  }

  send(msg) {
    if (this.connected) this.conn.send(msg);
  }

  dispose() {
    this.onClosed = null;
    try {
      this.conn?.close();
      this.peer?.destroy();
    } catch (e) {
      // ignore teardown races
    }
    this.conn = null;
    this.peer = null;
  }
}
