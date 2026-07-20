// Unified input: keyboard + pointer-lock mouse on desktop, twin-zone touch
// on phones (left = move joystick, right = look drag + attack/jump buttons).
export const IS_TOUCH = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

const MOUSE_SENS = 0.0024;
const TOUCH_LOOK_SENS = 0.006;

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.move = { x: 0, z: 0 };       // x: strafe (+right), z: forward (+forward)
    this._look = { x: 0, y: 0 };      // accumulated since last consume
    this._attackQueued = false;
    this._attackHeld = false;
    this._jumpQueued = false;
    this.enabled = false;

    this._keys = new Set();
    this._bindKeyboardMouse();
    if (IS_TOUCH) this._bindTouch();
  }

  enable() {
    this.enabled = true;
    if (!IS_TOUCH) this._lock();
  }

  // requestPointerLock throws/rejects if the tab isn't focused or the user
  // just pressed Esc — never fatal, the next canvas click retries.
  _lock() {
    try {
      const r = this.canvas.requestPointerLock?.();
      r?.catch?.(() => {});
    } catch (e) { /* retried on next click */ }
  }

  disable() {
    this.enabled = false;
    document.exitPointerLock?.();
    this._keys.clear();
    this.move.x = 0; this.move.z = 0;
  }

  consumeLook() {
    const l = { x: this._look.x, y: this._look.y };
    this._look.x = 0; this._look.y = 0;
    return l;
  }

  attackPressed() {
    // holding the button auto-swings, a click queues exactly one swing
    if (this._attackQueued) { this._attackQueued = false; return true; }
    return this._attackHeld;
  }

  jumpPressed() {
    if (this._jumpQueued) { this._jumpQueued = false; return true; }
    return this._keys.has('Space');
  }

  /* ---------- desktop ---------- */

  _bindKeyboardMouse() {
    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      this._keys.add(e.code);
      this._syncMoveFromKeys();
      if (e.code === 'Space') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      this._keys.delete(e.code);
      this._syncMoveFromKeys();
    });
    window.addEventListener('blur', () => {
      this._keys.clear();
      this._syncMoveFromKeys();
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.enabled || document.pointerLockElement !== this.canvas) return;
      this._look.x += e.movementX * MOUSE_SENS;
      this._look.y += e.movementY * MOUSE_SENS;
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled || IS_TOUCH) return;
      if (document.pointerLockElement !== this.canvas) {
        this._lock();
        return;
      }
      if (e.button === 0) { this._attackHeld = true; this._attackQueued = true; }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this._attackHeld = false;
    });
  }

  _syncMoveFromKeys() {
    const k = this._keys;
    let x = 0, z = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) z += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) z -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    this.move.x = x; this.move.z = z;
  }

  /* ---------- touch ---------- */

  _bindTouch() {
    const joyZone = document.getElementById('joystick-zone');
    const lookZone = document.getElementById('look-zone');
    const attackBtn = document.getElementById('btn-attack-touch');
    const jumpBtn = document.getElementById('btn-jump-touch');
    document.getElementById('touch-ui').classList.remove('hidden');

    // -- virtual joystick (appears where the finger lands)
    const base = document.createElement('div');
    base.className = 'stick-base hidden';
    const nub = document.createElement('div');
    nub.className = 'stick-nub hidden';
    joyZone.appendChild(base);
    joyZone.appendChild(nub);

    let joyId = null, joyOrigin = null;
    const setStick = (x, y) => {
      const max = 46;
      const dx = x - joyOrigin.x, dy = y - joyOrigin.y;
      const d = Math.hypot(dx, dy) || 1;
      const cl = Math.min(d, max);
      const nx = (dx / d) * cl, ny = (dy / d) * cl;
      nub.style.left = joyOrigin.x + nx + 'px';
      nub.style.top = joyOrigin.y + ny + 'px';
      this.move.x = (nx / max);
      this.move.z = -(ny / max);
    };

    joyZone.addEventListener('touchstart', (e) => {
      if (!this.enabled) return;
      const t = e.changedTouches[0];
      joyId = t.identifier;
      joyOrigin = { x: t.clientX, y: t.clientY };
      base.style.left = t.clientX + 'px';
      base.style.top = t.clientY + 'px';
      base.classList.remove('hidden');
      nub.classList.remove('hidden');
      setStick(t.clientX, t.clientY);
      e.preventDefault();
    }, { passive: false });

    joyZone.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === joyId) setStick(t.clientX, t.clientY);
      }
      e.preventDefault();
    }, { passive: false });

    const joyEnd = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === joyId) {
          joyId = null;
          this.move.x = 0; this.move.z = 0;
          base.classList.add('hidden');
          nub.classList.add('hidden');
        }
      }
    };
    joyZone.addEventListener('touchend', joyEnd);
    joyZone.addEventListener('touchcancel', joyEnd);

    // -- look drag
    let lookId = null, lookLast = null;
    lookZone.addEventListener('touchstart', (e) => {
      if (!this.enabled || lookId !== null) return;
      const t = e.changedTouches[0];
      lookId = t.identifier;
      lookLast = { x: t.clientX, y: t.clientY };
      e.preventDefault();
    }, { passive: false });

    lookZone.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === lookId) {
          this._look.x += (t.clientX - lookLast.x) * TOUCH_LOOK_SENS;
          this._look.y += (t.clientY - lookLast.y) * TOUCH_LOOK_SENS;
          lookLast = { x: t.clientX, y: t.clientY };
        }
      }
      e.preventDefault();
    }, { passive: false });

    const lookEnd = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === lookId) lookId = null;
      }
    };
    lookZone.addEventListener('touchend', lookEnd);
    lookZone.addEventListener('touchcancel', lookEnd);

    // -- buttons
    attackBtn.addEventListener('touchstart', (e) => {
      this._attackHeld = true; this._attackQueued = true;
      e.preventDefault();
    }, { passive: false });
    attackBtn.addEventListener('touchend', () => { this._attackHeld = false; });
    jumpBtn.addEventListener('touchstart', (e) => {
      this._jumpQueued = true;
      e.preventDefault();
    }, { passive: false });
  }
}
