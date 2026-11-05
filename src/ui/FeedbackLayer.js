import { GAME } from '../config/game.js';

const DAMAGE_POOL_SIZE = 36;

export class FeedbackLayer {
  constructor({ root, stage, save, audio, language, t, damageLayer, toastLayer, fadeLayer }) {
    this.root = root;
    this.stage = stage;
    this.save = save;
    this.audio = audio;
    this.language = language;
    this.t = t;
    this.toastLayer = toastLayer;
    this.damageLayer = damageLayer;
    this.fadeLayer = fadeLayer;
    this.toastQueue = [];
    this.activeToast = null;
    this.toastTimer = 0;
    this.damageNumbers = [];
    this.damagePool = [];
    this.debugOverlay = document.createElement('div');
    this.debugOverlay.className = 'debug-overlay hidden';
    root.appendChild(this.debugOverlay);
    this.flashOverlay = document.createElement('div');
    this.flashOverlay.className = 'hit-flash';
    this.damageLayer.appendChild(this.flashOverlay);
    for (let i = 0; i < DAMAGE_POOL_SIZE; i++) {
      const el = document.createElement('div');
      el.className = 'damage-number hidden';
      this.damageLayer.appendChild(el);
      this.damagePool.push(el);
    }
  }

  setLanguage(language, t) {
    this.language = language;
    this.t = t;
  }

  clearToasts() {
    this.toastQueue.length = 0;
    window.clearTimeout(this.toastTimer);
    if (this.activeToast) {
      this.activeToast.node.remove();
      this.activeToast = null;
    }
    this.toastLayer.innerHTML = '';
  }

  toast(key, vars = {}, options = {}) {
    const text = key.includes('.') ? this.t(key, vars) : key;
    this.queueToast(text, options);
  }

  toastText(text, options = {}) {
    this.queueToast(String(text ?? ''), options);
  }

  queueToast(text, options = {}) {
    this.toastQueue.push({
      text,
      icon: options.icon ?? '◆',
      kind: options.achievement ? 'achievement' : 'normal',
      fadeAfter: options.duration ?? 1900,
    });
    if (!this.activeToast) this.showNextToast();
  }

  showNextToast() {
    if (this.activeToast) return;
    const entry = this.toastQueue.shift();
    if (!entry) return;
    const node = document.createElement('div');
    node.className = `game-toast ${entry.kind === 'achievement' ? 'achievement' : ''}`;
    const iconNode = document.createElement('span');
    iconNode.className = 'toast-icon';
    iconNode.textContent = entry.icon;
    const textNode = document.createElement('span');
    textNode.textContent = entry.text;
    node.append(iconNode, textNode);
    this.toastLayer.appendChild(node);
    requestAnimationFrame(() => node.classList.add('show'));
    this.activeToast = { node, entry };
    this.toastTimer = window.setTimeout(() => {
      node.classList.remove('show');
      window.setTimeout(() => {
        node.remove();
        this.activeToast = null;
        this.showNextToast();
      }, 260);
    }, entry.fadeAfter);
  }

  spawnDamageNumber(worldX, worldY, text, kind = 'normal') {
    if (!this.save.settings.damageNumbers) return;
    const el = this.damagePool.find((node) => node.classList.contains('hidden'));
    if (!el) return;
    el.classList.remove('hidden', 'crit', 'player', 'heal');
    if (kind === 'crit') el.classList.add('crit');
    else if (kind === 'player') el.classList.add('player');
    else if (kind === 'heal') el.classList.add('heal');
    el.textContent = String(text);
    el.style.opacity = '1';
    el.style.transform = 'translate(-1000px,-1000px)';
    el.dataset.age = '0';
    el.dataset.life = String(GAME.combat.damageNumberLife);
    el.dataset.x = String(worldX);
    el.dataset.y = String(worldY);
    el.dataset.wobble = String((Math.random() - 0.5) * 7);
    el.dataset.kind = kind;
    el.style.display = 'block';
    el.classList.remove('hidden');
    el.classList.add('active');
    el.dataset.used = '1';
  }

  updateDamageNumbers(dt, camera) {
    if (!this.save.settings.damageNumbers) return;
    const cam = camera.getRenderPosition(0);
    const zoom = camera.zoom || 1;
    for (const el of this.damagePool) {
      if (!el.dataset.used) continue;
      const life = Number(el.dataset.life);
      const age = Number(el.dataset.age) + dt;
      el.dataset.age = String(age);
      if (age >= life) {
        el.dataset.used = '';
        el.classList.add('hidden');
        el.style.display = 'none';
        continue;
      }
      const t = age / life;
      const x = (Number(el.dataset.x) - cam.x) * zoom + GAME.internalWidth / 2 + Number(el.dataset.wobble) * t;
      const y = (cam.y - Number(el.dataset.y)) * zoom + GAME.internalHeight / 2 - 8 - t * 18;
      el.style.opacity = String(t < 0.65 ? 1 : 1 - (t - 0.65) / 0.35);
      el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -100%)`;
    }
  }

  clearDamageNumbers() {
    for (const el of this.damagePool) {
      el.dataset.used = '';
      el.classList.add('hidden');
      el.style.display = 'none';
    }
  }

  updateDebug(info) {
    if (!info) {
      this.debugOverlay.classList.add('hidden');
      return;
    }
    this.debugOverlay.classList.remove('hidden');
    const lines = [
      `<div class="debug-title">${this.t('debug.title')} <span style="float:right;color:#6d806e">${this.t('debug.hint')}</span></div>`,
      `FPS <b>${info.fps.toFixed(0)}</b>  ${this.t('debug.frame')} <b>${info.frameMs.toFixed(1)}ms</b>`,
      `Draw <b>${info.drawCalls}</b>  ${this.t('debug.entities')} <b>${info.entities}</b>`,
      `Particles <b>${info.particles}</b>  Budget <b>${info.spawnBudget.toFixed(1)}</b>`,
      `${this.t('debug.zone')} <b>${info.zone}</b>  Seed <b>${info.seed}</b>`,
      `${this.t('debug.pos')} <b>${info.x.toFixed(0)}, ${info.y.toFixed(0)}</b>  ${this.t('debug.state')} <b>${info.state}</b>`,
      `Enemies <b>${info.activeEnemies}</b>  Boss <b>${info.boss ?? '—'}</b>`,
    ];
    this.debugOverlay.innerHTML = lines.join('\n');
  }

  hideDebug() {
    this.debugOverlay.classList.add('hidden');
  }

  setZoneTheme(zone) {
    if (!zone?.palette) return;
    const p = zone.palette;
    this.stage.dataset.zone = zone.id;
    this.stage.style.background = `
      radial-gradient(ellipse at 50% 86%, ${hexToRgba(p.accent, 0.075)}, transparent 48%),
      linear-gradient(180deg, ${p.sky} 0%, #08070c 52%, #0c0909 100%)
    `;
    const wash = document.getElementById('zone-wash');
    if (wash) wash.style.background = p.fog;
    const ambient = document.getElementById('ambient-layer');
    if (ambient) {
      ambient.style.background = zone.ambientColor ?? 'transparent';
      ambient.style.opacity = String(zone.ambientColor ? (zone.ambientStrength ?? 0.25) : 0);
    }
    this.setVignetteOpacity(zone.id === 'dungeon' ? 0.92 : 0.95);
    this.stage.classList.toggle('is-critical', false);
  }

  setFade(active) {
    this.fadeLayer?.classList.toggle('active', Boolean(active));
  }

  setVignetteOpacity(value) {
    const vignette = document.getElementById('vignette');
    if (vignette) vignette.style.opacity = String(value);
  }

  dispose() {
    this.clearToasts();
    this.debugOverlay.remove();
    for (const el of this.damagePool) el.remove();
    this.flashOverlay.remove();
  }

  flashHurt(critical = false) {
    this.stage.classList.remove('is-hurt');
    void this.stage.offsetWidth;
    this.stage.classList.add('is-hurt');
    this.stage.classList.toggle('is-critical', critical);
    const intensity = (this.save.settings.flash ?? 0.75) * (critical ? 0.26 : 0.16);
    this.flashOverlay.style.background = `rgba(136, 22, 32, ${intensity})`;
    this.flashOverlay.style.opacity = '1';
    setTimeout(() => {
      this.flashOverlay.style.opacity = '0';
      this.stage.classList.remove('is-hurt');
    }, 120);
    setTimeout(() => this.stage.classList.remove('is-critical'), 280);
  }
}

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const value = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
