const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter',
]);

export class Controls {
  constructor() {
    this.keys = new Set();
    this._attackQueue = [false, false];
    this.enabled = true;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  _onKeyDown(e) {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (!this.enabled) return;
    if (e.code === 'Space' && !this.keys.has('Space')) this._attackQueue[0] = true;
    if (e.code === 'Enter' && !this.keys.has('Enter')) this._attackQueue[1] = true;
    this.keys.add(e.code);
  }

  _onKeyUp(e) {
    this.keys.delete(e.code);
  }

  getMove(playerIndex) {
    const k = this.keys;
    let x = 0;
    let z = 0;
    if (!this.enabled) return { x: 0, z: 0 };
    if (playerIndex === 0) {
      if (k.has('KeyA')) x -= 1;
      if (k.has('KeyD')) x += 1;
      if (k.has('KeyW')) z -= 1;
      if (k.has('KeyS')) z += 1;
    } else {
      if (k.has('ArrowLeft')) x -= 1;
      if (k.has('ArrowRight')) x += 1;
      if (k.has('ArrowUp')) z -= 1;
      if (k.has('ArrowDown')) z += 1;
    }
    const len = Math.hypot(x, z);
    if (len > 1) {
      x /= len;
      z /= len;
    }
    return { x, z };
  }

  consumeAttack(playerIndex) {
    if (this._attackQueue[playerIndex]) {
      this._attackQueue[playerIndex] = false;
      return true;
    }
    return false;
  }

  clearQueues() {
    this._attackQueue[0] = false;
    this._attackQueue[1] = false;
    this.keys.clear();
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
  }
}
