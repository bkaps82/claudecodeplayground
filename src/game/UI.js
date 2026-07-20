import { TIERS, MAX_TIER } from './Progression.js';

const $ = (id) => document.getElementById(id);

const SWORD_ICONS = ['📄', '🪵', '🥉', '🪨', '⚙️', '🗡️', '⚔️', '💎', '🟪'];
const ARMOR_ICONS = ['📦', '🪵', '🥉', '🪨', '🛡️', '🛡️', '🛡️', '💎', '🟪'];

// All DOM: menu flow, HUD numbers, upgrade buttons, feed messages.
export class UI {
  constructor() {
    this.onSolo = null;
    this.onHost = null;        // (name) => void
    this.onJoin = null;        // (name, code) => void
    this.onUpgrade = null;     // ('sword'|'armor') => void
    this.onBackToMenu = null;

    this._pendingMode = null;
    this._bindMenu();

    $('btn-upgrade-sword').addEventListener('click', () => this.onUpgrade?.('sword'));
    $('btn-upgrade-armor').addEventListener('click', () => this.onUpgrade?.('armor'));
    $('btn-dc-menu').addEventListener('click', () => this.onBackToMenu?.());
  }

  _bindMenu() {
    const pages = ['menu-main', 'menu-name', 'menu-host', 'menu-join'];
    const show = (id) => {
      pages.forEach((p) => $(p).classList.toggle('hidden', p !== id));
    };
    this._showPage = show;

    $('btn-solo').addEventListener('click', () => this.onSolo?.());
    $('btn-host').addEventListener('click', () => { this._pendingMode = 'host'; show('menu-name'); $('name-input').focus(); });
    $('btn-join').addEventListener('click', () => { this._pendingMode = 'join'; show('menu-name'); $('name-input').focus(); });

    $('btn-name-go').addEventListener('click', () => {
      const name = ($('name-input').value.trim() || 'Hero').slice(0, 12);
      if (this._pendingMode === 'host') {
        show('menu-host');
        this.onHost?.(name);
      } else {
        show('menu-join');
        $('join-code').focus();
      }
      this._name = name;
    });

    $('btn-join-go').addEventListener('click', () => {
      const code = $('join-code').value.trim();
      if (code.length !== 4) {
        this.setJoinStatus('Code is 4 digits!');
        return;
      }
      this.onJoin?.(this._name || 'Hero', code);
    });

    document.querySelectorAll('[data-back]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.onBackToMenu?.();
        show('menu-main');
      });
    });
  }

  showMenu() {
    $('menu').classList.remove('hidden');
    $('hud').classList.add('hidden');
    $('dc-overlay').classList.add('hidden');
    $('ko-overlay').classList.add('hidden');
    this._showPage('menu-main');
  }

  showGame() {
    $('menu').classList.add('hidden');
    $('hud').classList.remove('hidden');
  }

  setHostCode(code) { $('host-code').textContent = code; }
  setHostStatus(text) { $('host-status').textContent = text; }
  setJoinStatus(text) { $('join-status').textContent = text; }

  setNetBadge(text) {
    const el = $('net-badge');
    if (!text) el.classList.add('hidden');
    else { el.textContent = text; el.classList.remove('hidden'); }
  }

  /* ---- HUD ---- */

  updateHp(hp, maxHp) {
    const frac = Math.max(0, hp / maxHp);
    const bar = $('hp-bar');
    bar.style.width = frac * 100 + '%';
    bar.classList.toggle('low', frac < 0.35);
    $('hp-text').textContent = Math.ceil(hp);
  }

  updateProgression(prog) {
    $('xp-value').textContent = prog.xp;
    this._updateGear('sword', prog.swordTier, prog);
    this._updateGear('armor', prog.armorTier, prog);
  }

  _updateGear(kind, tierIdx, prog) {
    const tier = TIERS[tierIdx];
    const icons = kind === 'sword' ? SWORD_ICONS : ARMOR_ICONS;
    $(`${kind}-icon`).textContent = icons[tierIdx];
    $(`${kind}-name`).textContent = `${tier.name} ${kind === 'sword' ? 'Sword' : 'Armor'}`;
    const btn = $(`btn-upgrade-${kind}`);
    if (tierIdx >= MAX_TIER) {
      btn.textContent = 'MAX!';
      btn.className = 'upgrade-btn maxed';
    } else {
      const cost = TIERS[tierIdx + 1].cost;
      const key = kind === 'sword' ? '1' : '2';
      const hotkey = 'ontouchstart' in window ? '' : ` [${key}]`;
      btn.textContent = `▲ ${cost} XP${hotkey}`;
      btn.className = 'upgrade-btn' + (prog.xp >= cost ? ' ready' : '');
    }
  }

  setWorldLabel(text) { $('world-label').textContent = text; }

  showPortalHint(show) { $('portal-hint').classList.toggle('hidden', !show); }

  feed(text, cls = '') {
    const el = document.createElement('div');
    el.className = 'feed-msg ' + cls;
    el.textContent = text;
    $('feed').appendChild(el);
    setTimeout(() => el.remove(), 2700);
  }

  damageFlash() {
    const v = $('damage-vignette');
    v.style.opacity = '1';
    clearTimeout(this._vt);
    this._vt = setTimeout(() => { v.style.opacity = '0'; }, 220);
  }

  showKO(msg) {
    $('ko-msg').textContent = msg;
    $('ko-overlay').classList.remove('hidden');
  }
  hideKO() { $('ko-overlay').classList.add('hidden'); }

  showDisconnect() { $('dc-overlay').classList.remove('hidden'); }
}
