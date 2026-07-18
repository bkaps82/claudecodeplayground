import { PART_LABELS } from './Character.js';

const PART_ORDER = ['head', 'torso', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'];

export class UI {
  constructor() {
    this.hud = document.getElementById('hud');
    this.menuScreen = document.getElementById('menu-screen');
    this.gameoverScreen = document.getElementById('gameover-screen');
    this.loadingScreen = document.getElementById('loading-screen');
    this.countdownEl = document.getElementById('countdown');
    this.startBtn = document.getElementById('start-btn');
    this.restartBtn = document.getElementById('restart-btn');
    this.winnerTitle = document.getElementById('winner-title');
    this.winnerSub = document.getElementById('winner-sub');
    this.p1Fill = document.getElementById('p1-fill');
    this.p2Fill = document.getElementById('p2-fill');
    this.roundTimerEl = document.getElementById('round-timer');

    this._icons = { p1: {}, p2: {} };
    this._buildPartIcons(document.getElementById('p1-parts'), 'p1');
    this._buildPartIcons(document.getElementById('p2-parts'), 'p2');
  }

  _buildPartIcons(container, cls) {
    container.innerHTML = '';
    for (const name of PART_ORDER) {
      const el = document.createElement('div');
      el.className = 'part-icon';
      el.textContent = PART_LABELS[name];
      container.appendChild(el);
      this._icons[cls][name] = el;
    }
  }

  updateCoverage(p1Overall, p1Parts, p2Overall, p2Parts) {
    this.p1Fill.style.width = `${Math.round(p1Overall * 100)}%`;
    this.p2Fill.style.width = `${Math.round(p2Overall * 100)}%`;
    this._applyPartIcons('p1', p1Parts);
    this._applyPartIcons('p2', p2Parts);
  }

  _applyPartIcons(cls, parts) {
    for (const name of PART_ORDER) {
      const el = this._icons[cls][name];
      if (!el) continue;
      const covered = parts[name] >= 0.999;
      el.classList.toggle('covered', covered);
      el.classList.toggle(cls, covered);
    }
  }

  setRoundTimer(text) {
    this.roundTimerEl.textContent = text;
  }

  showLoading() {
    this.loadingScreen.classList.remove('hidden');
  }

  hideLoading() {
    this.loadingScreen.classList.add('hidden');
  }

  showMenu() {
    this.menuScreen.classList.remove('hidden');
  }

  hideMenu() {
    this.menuScreen.classList.add('hidden');
  }

  showHUD() {
    this.hud.classList.remove('hidden');
  }

  hideHUD() {
    this.hud.classList.add('hidden');
  }

  showGameOver(winnerName, colorClass) {
    this.winnerTitle.textContent = `${winnerName} WINS!`;
    this.winnerTitle.className = 'game-title';
    this.winnerTitle.style.webkitTextFillColor = '';
    this.winnerTitle.style.color = colorClass === 'p1' ? 'var(--p1)' : 'var(--p2)';
    this.winnerTitle.style.filter = `drop-shadow(0 0 30px ${colorClass === 'p1' ? 'var(--p1-glow)' : 'var(--p2-glow)'})`;
    this.winnerSub.textContent = 'Painted head to toe. Nowhere left to hide.';
    this.gameoverScreen.classList.remove('hidden');
  }

  hideGameOver() {
    this.gameoverScreen.classList.add('hidden');
  }

  showCountdown(text) {
    this.countdownEl.style.animation = 'none';
    this.countdownEl.textContent = text;
    this.countdownEl.classList.remove('hidden');
    // force reflow so the pulse animation retriggers on repeated calls
    void this.countdownEl.offsetWidth;
    this.countdownEl.style.animation = '';
  }

  hideCountdown() {
    this.countdownEl.classList.add('hidden');
  }
}
