import { GAME } from '../config/game.js';
import { CHARACTERS, CHARACTER_BY_ID } from '../data/characters.js';
import { UPGRADE_BY_ID } from '../config/upgrades.js';
import { ACHIEVEMENT_BY_ID } from '../data/achievements.js';
import { formatTime, translate } from './strings.js';
import { HUD } from './HUD.js';
import {
  mainMenuHtml,
  characterSelectHtml,
  settingsHtml,
  achievementsHtml,
  levelUpHtml,
  resultHtml,
  creditsHtml,
} from './MenuScreens.js';

const DAMAGE_POOL_SIZE = 36;

export class UIManager {
  constructor({ game, assets, save, audio }) {
    this.game = game;
    this.assets = assets;
    this.save = save;
    this.settings = save.settings;
    this.audio = audio;
    this.root = document.getElementById('ui-root');
    this.toastLayer = document.getElementById('toast-layer');
    this.damageLayer = document.getElementById('damage-layer');
    this.fadeLayer = document.getElementById('fade-layer');
    this.stage = document.getElementById('stage');
    this.screenRoot = document.createElement('div');
    this.screenRoot.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
    this.root.appendChild(this.screenRoot);
    this.currentScreen = null;
    this.currentScreenName = null;
    this.screenContext = {};
    this.previewRaf = 0;
    this.previewCanvases = [];
    this.previewStartedAt = performance.now();
    this.selectedCharacterId = CHARACTER_BY_ID[save.meta.selectedCharacter]
      ? save.meta.selectedCharacter
      : 'kael';
    this.achievementsReturn = 'menu';
    this.settingsReturn = 'menu';
    this.toastQueue = [];
    this.activeToast = null;
    this.toastTimer = 0;
    this.damageNumbers = [];
    this.damagePool = [];
    this.lastScreenPause = false;
    this.hud = new HUD(this.root, this);
    this.debugOverlay = document.createElement('div');
    this.debugOverlay.className = 'debug-overlay hidden';
    this.root.appendChild(this.debugOverlay);
    this.boundKeydown = (event) => this.handleKeyDown(event);
    window.addEventListener('keydown', this.boundKeydown);
    for (let i = 0; i < DAMAGE_POOL_SIZE; i++) {
      const el = document.createElement('div');
      el.className = 'damage-number hidden';
      this.damageLayer.appendChild(el);
      this.damagePool.push(el);
    }
    this.setLanguage(save.settings.language);
  }

  get t() {
    return (key, vars) => translate(this.language, key, vars);
  }

  setLanguage(lang) {
    this.language = lang === 'tr' ? 'tr' : 'en';
    this.hud.localize();
    document.documentElement.lang = this.language;
    if (this.currentScreenName) this.refreshCurrentScreen();
  }

  setBootProgress(progress, text) {
    const bar = document.getElementById('boot-progress');
    const status = document.getElementById('boot-status');
    if (bar) bar.style.width = `${Math.round(progress * 100)}%`;
    if (status && text) status.textContent = text;
  }

  hideBoot() {
    const boot = document.getElementById('boot-overlay');
    if (!boot) return;
    boot.classList.add('done');
    setTimeout(() => boot.remove(), 900);
  }

  mountScreen(name, html, handlers = {}) {
    this.stopPreviewAnimation();
    this.screenRoot.innerHTML = html;
    this.currentScreen = this.screenRoot.querySelector('.screen');
    this.currentScreenName = name;
    this.screenContext = handlers;
    if (!this.currentScreen) return null;
    this.currentScreen.style.pointerEvents = 'auto';
    for (const btn of this.screenRoot.querySelectorAll('[data-action]')) {
      btn.addEventListener('click', (event) => {
        const action = btn.dataset.action;
        this.audio?.play('ui');
        if (handlers[action]) handlers[action](event, btn);
      });
    }
    this.bindSeedInputs();
    return this.currentScreen;
  }

  bindSeedInputs() {
    const seedInput = this.screenRoot.querySelector('[data-seed-input]');
    if (seedInput) {
      seedInput.addEventListener('input', () => {
        seedInput.value = seedInput.value.replace(/[^0-9]/g, '').slice(0, GAME.seed.maxLength);
      });
    }
  }

  clearScreen() {
    this.stopPreviewAnimation();
    this.screenRoot.innerHTML = '';
    this.currentScreen = null;
    this.currentScreenName = null;
    this.screenContext = {};
  }

  refreshCurrentScreen() {
    if (!this.currentScreenName) return;
    switch (this.currentScreenName) {
      case 'menu':
        this.showMainMenu();
        break;
      case 'characters':
        this.showCharacterSelect();
        break;
      case 'settings':
        this.showSettings({ inRun: this.screenContext.inRun, from: this.settingsReturn });
        break;
      case 'achievements':
        this.showAchievements({ from: this.achievementsReturn });
        break;
      case 'pause':
        this.showPause();
        break;
      case 'credits':
        this.showCredits();
        break;
      default:
        break;
    }
  }

  setMenuVisible(visible) {
    this.hud.setVisible(false);
  }

  showMainMenu() {
    this.game.enterMenuMode?.();
    this.hud.setVisible(false);
    this.setFade(false);
    this.stage.classList.remove('is-critical');
    const seed = this.getSeedFromInputOrSettings();
    const html = mainMenuHtml({
      t: this.t,
      seed,
      shards: this.save.meta.hellshards,
      version: GAME.version,
      bestTime: this.save.meta.bestTime,
    });
    this.mountScreen('menu', html, {
      start: () => {
        const input = this.screenRoot.querySelector('[data-seed-input]');
        const seed = this.parseSeed(input?.value);
        if (seed === null) {
          this.toast('settings.seedInvalid', {}, { error: true });
          return;
        }
        this.save.updateSettings({ seed });
        this.game.updateSettings?.({ seed }, false);
        this.showCharacterSelect();
      },
      achievements: () => {
        this.achievementsReturn = 'menu';
        this.showAchievements();
      },
      settings: () => {
        this.settingsReturn = 'menu';
        this.showSettings({ inRun: false, from: 'menu' });
      },
      credits: () => this.showCredits(),
      'random-seed': () => {
        const input = this.screenRoot.querySelector('[data-seed-input]');
        const value = String(Math.floor(Math.random() * 8_999_999) + 1_000_000);
        if (input) input.value = value;
        this.save.updateSettings({ seed: Number(value) });
        this.game.updateSettings?.({ seed: Number(value) }, false);
        this.audio?.play('ui');
      },
    });
    this.bindSeedInputs();
  }

  getSeedFromInputOrSettings() {
    const input = this.screenRoot?.querySelector('[data-seed-input]');
    if (input && input.value) return input.value;
    return String(this.save.settings.seed ?? GAME.seed.default);
  }

  parseSeed(value) {
    const text = String(value ?? '').trim();
    if (!/^\d{1,10}$/.test(text)) return null;
    const seed = Number(text);
    if (seed < GAME.seed.min || seed > GAME.seed.max) return null;
    return seed;
  }

  showCharacterSelect() {
    this.stopPreviewAnimation();
    const seed = Number(this.save.settings.seed ?? GAME.seed.default);
    this.game.enterMenuMode?.();
    this.hud.setVisible(false);
    if (!this.save.isUnlocked(this.selectedCharacterId)) {
      this.selectedCharacterId = this.save.meta.unlockedCharacters[0] ?? 'kael';
    }
    const html = characterSelectHtml({
      t: this.t,
      selectedId: this.selectedCharacterId,
      meta: this.save.meta,
      seed,
    });
    this.mountScreen('characters', html, {
      back: () => this.showMainMenu(),
      start: () => {
        const character = CHARACTER_BY_ID[this.selectedCharacterId];
        if (!character || !this.save.isUnlocked(character.id)) {
          this.toast('char.select.locked', {}, { error: true });
          return;
        }
        const currentSeed = Number(this.save.settings.seed ?? GAME.seed.default);
        this.game.startRun(this.selectedCharacterId, currentSeed);
        this.hud.setVisible(true);
      },
    });
    this.bindCharacterCards();
    this.startPreviewAnimation();
  }

  bindCharacterCards() {
    for (const card of this.screenRoot.querySelectorAll('[data-char]')) {
      card.addEventListener('click', () => {
        const id = card.dataset.char;
        const character = CHARACTER_BY_ID[id];
        if (!character) return;
        const unlocked = this.save.isUnlocked(id);
        if (!unlocked) {
          const cost = GAME.meta.unlockCosts[id] ?? 1;
          if (this.game.unlockCharacter(id, cost)) {
            this.audio?.play('shard');
            this.toast('char.select.unlockedTitle', {}, { icon: '◆' });
            this.selectedCharacterId = id;
            this.showCharacterSelect();
          } else {
            this.toast('char.select.notEnough', {}, { error: true });
          }
          return;
        }
        this.selectedCharacterId = id;
        this.save.meta.selectedCharacter = id;
        this.save.saveMeta();
        for (const other of this.screenRoot.querySelectorAll('[data-char]')) {
          other.classList.toggle('selected', other.dataset.char === id);
        }
        const summary = this.screenRoot.querySelector('[data-selected-summary]');
        if (summary) summary.textContent = this.t('char.select.blurb', { name: this.t(character.nameKey) });
        this.audio?.play('ui');
      });
    }
  }

  startPreviewAnimation() {
    this.stopPreviewAnimation();
    this.previewCanvases = [...this.screenRoot.querySelectorAll('[data-preview]')];
    const draw = () => {
      if (!this.previewCanvases.length) return;
      const now = performance.now();
      for (const canvas of this.previewCanvases) {
        const character = CHARACTER_BY_ID[canvas.dataset.preview];
        if (!character) continue;
        const anim = this.assets.getAnimation(character.sprite, 'idle');
        if (!anim || !anim.frames.length) continue;
        const elapsed = ((now - this.previewStartedAt) / 1000) * anim.fps;
        const frame = anim.frames[Math.floor(elapsed) % anim.frames.length];
        this.drawPreview(canvas, frame);
      }
      this.previewRaf = requestAnimationFrame(draw);
    };
    this.previewStartedAt = performance.now();
    draw();
  }

  drawPreview(canvas, frame) {
    if (!frame) return;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const source = this.assets.atlases.gothic;
    if (!source) return;
    const box = frame.opaqueBox ?? { x: 0, y: 0, w: frame.w, h: frame.h };
    const scale = Math.max(1, Math.min(2, Math.floor(110 / Math.max(1, box.w)), Math.floor(78 / Math.max(1, box.h))));
    const drawW = box.w * scale;
    const drawH = box.h * scale;
    const x = Math.floor((canvas.width - drawW) / 2);
    const y = Math.floor(canvas.height - drawH - 6);
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.beginPath();
    ctx.ellipse(canvas.width / 2, canvas.height - 6, drawW * 0.42, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.drawImage(
      source.canvas,
      frame.sx + box.x,
      frame.sy + box.y,
      box.w,
      box.h,
      x,
      y,
      drawW,
      drawH,
    );
  }

  stopPreviewAnimation() {
    if (this.previewRaf) cancelAnimationFrame(this.previewRaf);
    this.previewRaf = 0;
    this.previewCanvases = [];
  }

  showPause() {
    this.game.setPaused?.(true);
    this.hud.setVisible(true);
    const html = `
      <div class="screen modal-screen" data-screen="pause">
        <div class="modal-panel corner-frame" style="width:310px;padding-bottom:14px;">
          <div class="modal-title">${this.t('pause.title')}</div>
          <div class="modal-subtitle">${this.t('pause.seed', { seed: this.game.seed })} · ${this.t('pause.level', { level: this.game.run?.level ?? 1 })}</div>
          <div class="pause-buttons">
            <button class="btn primary" data-action="resume">${this.t('pause.resume')}</button>
            <button class="btn" data-action="settings">${this.t('pause.settings')}</button>
            <button class="btn" data-action="achievements">${this.t('pause.achievements')}</button>
            <button class="btn ghost" data-action="abandon">${this.t('pause.abandon')}</button>
          </div>
          <div class="pause-meta">
            <span>${this.t('pause.time', { time: formatTime(this.game.run?.elapsed ?? 0) })}</span>
            <span>${this.t('hud.seed', { seed: this.game.seed })}</span>
          </div>
          <div class="pause-buttons hidden" data-abandon-confirm>
            <div class="modal-subtitle" style="margin:9px 0 5px;">${this.t('pause.confirmAbandon')}</div>
            <button class="btn small" data-action="confirm-abandon">${this.t('pause.confirm')}</button>
            <button class="btn small ghost" data-action="cancel-abandon">${this.t('pause.cancel')}</button>
          </div>
        </div>
      </div>
    `;
    this.mountScreen('pause', html, {
      resume: () => {
        this.clearScreen();
        this.game.setPaused?.(false);
      },
      settings: () => {
        this.settingsReturn = 'pause';
        this.showSettings({ inRun: true, from: 'pause' });
      },
      achievements: () => {
        this.achievementsReturn = 'pause';
        this.showAchievements({ from: 'pause' });
      },
      abandon: () => {
        const node = this.screenRoot.querySelector('[data-abandon-confirm]');
        node?.classList.toggle('hidden');
      },
      'cancel-abandon': () => {
        this.screenRoot.querySelector('[data-abandon-confirm]')?.classList.add('hidden');
      },
      'confirm-abandon': () => {
        this.game.abandonRun?.('abandon');
      },
    });
  }

  hidePause() {
    if (this.currentScreenName === 'pause') this.clearScreen();
  }

  showSettings({ inRun = false, from = 'menu' } = {}) {
    this.settingsReturn = from;
    const settings = this.save.settings;
    const seed = this.game.seed ?? settings.seed ?? GAME.seed.default;
    const html = settingsHtml({
      t: this.t,
      settings,
      meta: this.save.meta,
      inRun,
      seed,
    });
    this.mountScreen('settings', html, {
      back: () => this.settingsBack(from),
      'apply-settings': () => {
        const input = this.screenRoot.querySelector('[data-setting="seed"]');
        if (input && !inRun) {
          const seedValue = this.parseSeed(input.value);
          if (seedValue === null) {
            this.toast('settings.seedInvalid', {}, { error: true });
            return;
          }
          this.save.updateSettings({ seed: seedValue });
          this.game.updateSettings?.({ seed: seedValue }, false);
        }
        this.toast('settings.saved');
        this.settingsBack(from);
      },
      'reset-settings': () => {
        this.save.resetSettings();
        this.game.updateSettings?.(this.save.settings, true);
        this.setLanguage(this.save.settings.language);
        this.showSettings({ inRun, from });
      },
    });
    this.bindSettingsControls(inRun);
  }

  settingsBack(from) {
    if (from === 'pause') this.showPause();
    else this.showMainMenu();
  }

  bindSettingsControls(inRun) {
    for (const input of this.screenRoot.querySelectorAll('[data-setting]')) {
      const key = input.dataset.setting;
      if (key === 'seed') {
        input.addEventListener('input', () => {
          input.value = input.value.replace(/[^0-9]/g, '').slice(0, GAME.seed.maxLength);
        });
        continue;
      }
      input.addEventListener('input', () => {
        if (input.type === 'range') {
          const value = Number(input.value) / 100;
          const output = this.screenRoot.querySelector(`[data-output="${key}"]`);
          if (output) output.textContent = `${Math.round(value * 100)}%`;
          this.updateSettingLive(key, value);
        } else if (key === 'language') {
          this.updateSettingLive(key, input.value);
          this.setLanguage(input.value);
          this.showSettings({ inRun, from: this.settingsReturn });
        }
      });
    }
    for (const toggle of this.screenRoot.querySelectorAll('[data-toggle]')) {
      toggle.addEventListener('click', () => {
        const key = toggle.dataset.toggle;
        const value = !toggle.classList.contains('on');
        toggle.classList.toggle('on', value);
        toggle.setAttribute('aria-pressed', String(value));
        this.updateSettingLive(key, value);
      });
    }
    for (const buy of this.screenRoot.querySelectorAll('[data-buy-bonus]')) {
      buy.addEventListener('click', () => {
        const id = buy.dataset.buyBonus;
        const cost = Number(buy.dataset.cost);
        if (this.game.buyPermanentBonus(id, cost)) {
          this.audio?.play('shard');
          this.showSettings({ inRun, from: this.settingsReturn });
        } else {
          this.toast('char.select.notEnough', {}, { error: true });
        }
      });
    }
  }

  updateSettingLive(key, value) {
    this.save.updateSettings({ [key]: value });
    if (key === 'seed') this.game.updateSettings?.({ seed: Number(value) }, false);
    else this.game.updateSettings?.(this.save.settings, true);
    this.audio?.applyVolumes();
  }

  showAchievements({ from = 'menu' } = {}) {
    this.achievementsReturn = from;
    const inRun = from === 'pause';
    const html = achievementsHtml({ t: this.t, meta: this.save.meta, inRun });
    this.mountScreen('achievements', html, {
      back: () => (from === 'pause' ? this.showPause() : this.showMainMenu()),
    });
  }

  showCredits() {
    const html = creditsHtml({ t: this.t });
    this.mountScreen('credits', html, {
      back: () => this.showMainMenu(),
    });
  }

  showLevelUp(offers, { level, playerUpgrades }) {
    this.game.setPaused?.(true);
    const html = levelUpHtml({ t: this.t, offers, level, playerUpgrades });
    this.mountScreen('levelup', html, {});
    const choose = (index) => {
      if (!offers[index]) return;
      this.audio?.play('levelUp');
      this.clearScreen();
      this.game.chooseUpgrade?.(index);
    };
    for (const card of this.screenRoot.querySelectorAll('[data-offer]')) {
      card.addEventListener('click', () => choose(Number(card.dataset.offer)));
    }
    this.screenContext.choose = choose;
  }

  showResult(summary, victory, newBestTime) {
    this.stopPreviewAnimation();
    this.game.setPaused?.(true);
    this.hud.setVisible(false);
    const html = resultHtml({ t: this.t, summary, victory, newBestTime });
    this.mountScreen('result', html, {
      restart: () => {
        this.game.restartRun?.();
      },
      menu: () => {
        this.game.returnToMenu?.();
        this.showMainMenu();
      },
    });
  }

  handleKeyDown(event) {
    if (!this.currentScreenName) return;
    if (event.code === 'Escape') {
      if (this.currentScreenName === 'pause') {
        this.clearScreen();
        this.game.setPaused?.(false);
        event.preventDefault();
        return;
      }
      if (['settings', 'achievements', 'credits'].includes(this.currentScreenName)) {
        if (this.currentScreenName === 'settings') this.settingsBack(this.settingsReturn);
        else if (this.currentScreenName === 'achievements') {
          this.achievementsReturn === 'pause' ? this.showPause() : this.showMainMenu();
        } else this.showMainMenu();
        event.preventDefault();
      }
      return;
    }
    if (this.currentScreenName === 'levelup' && /^Digit[1-3]$/.test(event.code)) {
      const index = Number(event.code.slice(-1)) - 1;
      this.screenContext.choose?.(index);
      event.preventDefault();
    }
  }

  showHUD(visible) {
    this.hud.setVisible(visible);
  }

  updateHUD(info) {
    this.hud.update(info);
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
    this.stage.classList.toggle('is-critical', false);
  }

  setFade(active) {
    this.fadeLayer?.classList.toggle('active', Boolean(active));
  }

  setVignetteOpacity(value) {
    const vignette = document.getElementById('vignette');
    if (vignette) vignette.style.opacity = String(value);
  }

  flashHurt(critical = false) {
    this.stage.classList.remove('is-hurt');
    void this.stage.offsetWidth;
    this.stage.classList.add('is-hurt');
    this.stage.classList.toggle('is-critical', critical);
    setTimeout(() => this.stage.classList.remove('is-hurt'), 260);
  }

  toast(key, vars = {}, options = {}) {
    const text = key.includes('.') ? this.t(key, vars) : key;
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
    node.innerHTML = `<span class="toast-icon">${entry.icon}</span><span>${entry.text}</span>`;
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
    for (const el of this.damagePool) {
      if (!el.dataset.used) continue;
      const life = Number(el.dataset.life);
      let age = Number(el.dataset.age) + dt;
      el.dataset.age = String(age);
      if (age >= life) {
        el.dataset.used = '';
        el.classList.add('hidden');
        el.style.display = 'none';
        continue;
      }
      const t = age / life;
      const x = Number(el.dataset.x) - cam.x + GAME.internalWidth / 2 + Number(el.dataset.wobble) * t;
      const y = cam.y - Number(el.dataset.y) + GAME.internalHeight / 2 - 8 - t * 18;
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

  destroy() {
    window.removeEventListener('keydown', this.boundKeydown);
    this.stopPreviewAnimation();
    window.clearTimeout(this.toastTimer);
    this.toastLayer.innerHTML = '';
    this.screenRoot.innerHTML = '';
    this.hud.root.remove();
    this.debugOverlay.remove();
  }
}

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const value = h.length === 3
    ? h.split('').map((c) => c + c).join('')
    : h;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
