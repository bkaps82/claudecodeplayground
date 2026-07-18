import { Peer } from 'peerjs';

// Room codes are 4 digits; the PeerJS broker ID namespaces them so we don't
// collide with unrelated apps on the public cloud.
const ID_PREFIX = 'pd-octagon-v1-';

// Phones on cellular sit behind carrier-grade NAT, where STUN hole-punching
// usually fails — a TURN relay is required. Configure several relays,
// including TCP/443 variants that survive strict firewalls, instead of
// relying on PeerJS's minimal defaults.
const ICE_SERVERS = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  {
    urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'],
    username: 'peerjs',
    credential: 'peerjsp',
  },
  {
    urls: [
      'turn:openrelay.metered.ca:80',
      'turn:openrelay.metered.ca:443',
      'turn:openrelay.metered.ca:443?transport=tcp',
    ],
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

const JOIN_TIMEOUT_MS = 25000;

function peerOptions() {
  // Allow pointing at a self-hosted peer server for development/testing:
  //   ?peerhost=127.0.0.1&peerport=9000&peerpath=/  (key optional)
  const params = new URLSearchParams(window.location.search);
  const iceConfig = { config: { iceServers: ICE_SERVERS } };
  const host = params.get('peerhost');
  if (!host) return iceConfig; // default: PeerJS public cloud
  return {
    host,
    port: Number(params.get('peerport') || 9000),
    path: params.get('peerpath') || '/',
    key: params.get('peerkey') || 'peerjs',
    secure: params.get('peersecure') === '1',
    ...iceConfig,
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
    this.onStatus = null;     // (status: 'signaling'|'room-found'|'negotiating'|'relaying') => void
    this._closedFired = false;
    this._joinTimer = null;
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
      this.onStatus?.('negotiating');
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
    this._onFailure = onFailure;
    this.peer = new Peer(peerOptions());
    this.onStatus?.('signaling');

    this.peer.on('open', () => {
      this.onStatus?.('room-found');
      const conn = this.peer.connect(ID_PREFIX + code, { reliable: true });
      this._bindConn(conn);
      // if the host code doesn't exist, peerjs surfaces a peer-unavailable error;
      // otherwise give ICE (incl. TURN relays on cellular) generous time
      this._joinTimer = setTimeout(() => {
        if (!this.connected) onFailure?.('timeout');
      }, JOIN_TIMEOUT_MS);
    });
    this.peer.on('error', (err) => {
      if (err.type === 'peer-unavailable') onFailure?.('no-such-room');
      else if (!this.connected) onFailure?.(err.type || 'network');
    });
  }

  _bindConn(conn) {
    this.conn = conn;
    conn.on('iceStateChanged', (state) => {
      if (state === 'checking') this.onStatus?.('negotiating');
      if (state === 'failed' && !this.connected) {
        if (this.isHost) {
          // failed join attempt: unbind so the joiner can retry against us
          try { this.conn?.close(); } catch (e) { /* already dead */ }
          this.conn = null;
          this._closedFired = false; // the aborted attempt must not eat the real close event
          this.onStatus?.('waiting');
        } else {
          // pre-open failure: report through the join failure path, since
          // onClosed handlers are only attached after a successful open
          if (this._joinTimer) clearTimeout(this._joinTimer);
          this._onFailure?.('ice-failed');
        }
      }
    });
    conn.on('open', () => {
      if (this._joinTimer) clearTimeout(this._joinTimer);
      this.onConnected?.();
    });
    conn.on('data', (data) => {
      this.onMessage?.(data);
    });
    conn.on('close', () => this._fireClosed('closed'));
    conn.on('error', () => this._fireClosed('error'));
  }

  /** 'relay' if the connection went through a TURN server, 'direct' otherwise. */
  async connectionPath() {
    try {
      const pc = this.conn?.peerConnection;
      if (!pc) return 'unknown';
      const stats = await pc.getStats();
      for (const report of stats.values()) {
        if (report.type === 'candidate-pair' && report.state === 'succeeded' && report.nominated) {
          const local = stats.get(report.localCandidateId);
          return local?.candidateType === 'relay' ? 'relay' : 'direct';
        }
      }
    } catch (e) {
      // stats unsupported - not important
    }
    return 'unknown';
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
    if (this._joinTimer) clearTimeout(this._joinTimer);
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
