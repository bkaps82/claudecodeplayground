// DOM-based virtual joystick + attack button pair. One pair per player in
// local mode (left/right halves), a single pair in online mode.
export class TouchPad {
  constructor({ container, side, accentVar, onAttack }) {
    this.onAttack = onAttack;
    this.move = { x: 0, z: 0 };
    this._joyTouchId = null;
    this._anchor = { x: 0, y: 0 };

    this.rootEl = document.createElement('div');
    this.rootEl.className = `touchpad touchpad-${side}`;

    this.zoneEl = document.createElement('div');
    this.zoneEl.className = 'joy-zone';
    this.baseEl = document.createElement('div');
    this.baseEl.className = 'joy-base';
    this.baseEl.style.setProperty('--accent', `var(${accentVar})`);
    this.knobEl = document.createElement('div');
    this.knobEl.className = 'joy-knob';
    this.baseEl.appendChild(this.knobEl);
    this.zoneEl.appendChild(this.baseEl);

    this.hintEl = document.createElement('div');
    this.hintEl.className = 'joy-hint';
    this.hintEl.style.setProperty('--accent', `var(${accentVar})`);
    this.hintEl.textContent = 'MOVE';
    this.zoneEl.appendChild(this.hintEl);

    this.attackEl = document.createElement('button');
    this.attackEl.className = 'attack-btn';
    this.attackEl.textContent = '⚔';
    this.attackEl.style.setProperty('--accent', `var(${accentVar})`);

    this.rootEl.appendChild(this.zoneEl);
    this.rootEl.appendChild(this.attackEl);
    container.appendChild(this.rootEl);

    this.zoneEl.addEventListener('touchstart', (e) => this._joyStart(e), { passive: false });
    this.zoneEl.addEventListener('touchmove', (e) => this._joyMove(e), { passive: false });
    this.zoneEl.addEventListener('touchend', (e) => this._joyEnd(e), { passive: false });
    this.zoneEl.addEventListener('touchcancel', (e) => this._joyEnd(e), { passive: false });

    this.attackEl.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.attackEl.classList.add('pressed');
      this.onAttack();
    }, { passive: false });
    this.attackEl.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.attackEl.classList.remove('pressed');
    }, { passive: false });
    // mouse fallback so the pads are testable on desktop too
    this.attackEl.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.onAttack();
    });
  }

  _joyStart(e) {
    e.preventDefault();
    if (this._joyTouchId !== null) return;
    const t = e.changedTouches[0];
    this._joyTouchId = t.identifier;
    this._anchor = { x: t.clientX, y: t.clientY };
    this.baseEl.style.left = `${t.clientX}px`;
    this.baseEl.style.top = `${t.clientY}px`;
    this.baseEl.classList.add('active');
    this.hintEl.classList.add('dimmed');
    this._applyKnob(0, 0);
  }

  _joyMove(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier !== this._joyTouchId) continue;
      const R = 52;
      let dx = t.clientX - this._anchor.x;
      let dy = t.clientY - this._anchor.y;
      const len = Math.hypot(dx, dy);
      if (len > R) {
        dx = (dx / len) * R;
        dy = (dy / len) * R;
      }
      this._applyKnob(dx, dy);
      this.move.x = dx / R;
      this.move.z = dy / R;
    }
  }

  _joyEnd(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier !== this._joyTouchId) continue;
      this._joyTouchId = null;
      this.move.x = 0;
      this.move.z = 0;
      this.baseEl.classList.remove('active');
      this._applyKnob(0, 0);
    }
  }

  _applyKnob(dx, dy) {
    this.knobEl.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }

  setVisible(visible) {
    this.rootEl.classList.toggle('hidden', !visible);
  }

  dispose() {
    this.rootEl.remove();
  }
}

export function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}
