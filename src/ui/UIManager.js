import { GAME } from '../config/game.js';
import { CHARACTER_BY_ID } from '../data/characters.js';

import { formatTime, translate } from './strings.js';
import { HUD } from './HUD.js';
import { FeedbackLayer } from './FeedbackLayer.js';
import { SettingsViews } from './SettingsViews.js';
import {
  mainMenuHtml,
  characterSelectHtml,
  levelUpHtml,
  resultHtml,
  creditsHtml,
} from './MenuScreens.js';

export class UIManager {
  constructor({ game, assets, save, audio }) {
    this.game = game;
    this.assets = assets;
    this.save = save;
    this.audio = audio;
    this.root = document.getElementById('ui-root');
    this.toastLayer = document.getElementById('toast-layer');
    this.damageLayer = document.getElementById('damage-layer');
    this.fadeLayer = document.getElementById('fade-layer');
    this.stage = document.getElementById('stage');
    this.screenRoot = document.createElement('div');
    this.screenRoot.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:15;';
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
    this.screenContext.inRun = false;
    this.hud = new HUD(this.root, this);
    this.settingsViews = new SettingsViews(this);
    this.feedback = new FeedbackLayer({
      root: this.root,
      stage: this.stage,
      save: this.save,
      audio: this.audio,
      language: save.settings.language,
      t: (key, vars) => this.t(key, vars),
      damageLayer: this.damageLayer,
      toastLayer: this.toastLayer,
      fadeLayer: this.fadeLayer,
    });

    this.boundKeydown = (event) => this.handleKeyDown(event);
    window.addEventListener('keydown', this.boundKeydown);
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
        this.showSettings({ inRun: this.settingsViews.currentInRun, from: this.settingsViews.settingsReturn });
        break;
      case 'achievements':
        this.showAchievements({ from: this.settingsViews.achievementsReturn });
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
      runs: this.save.meta.runs ?? 0,
      zonesSeen: Math.min(3, new Set(this.save.meta.seenZones ?? []).size),
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
      achievements: () => this.showAchievements({ from: 'menu' }),
      settings: () => this.showSettings({ inRun: false, from: 'menu' }),
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
            this.save.meta.selectedCharacter = id;
            this.save.saveMeta();
            this.showCharacterSelect();
          } else {
            this.toast('char.select.notEnough', {}, { error: true });
          }
          return;
        }
        if (this.selectedCharacterId === id) return;
        this.selectedCharacterId = id;
        this.save.meta.selectedCharacter = id;
        this.save.saveMeta();
        this.audio?.play('ui');
        this.showCharacterSelect();
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
    const maxW = canvas.width - 14;
    const maxH = canvas.height - 14;
    const scale = Math.max(1, Math.min(3, Math.floor(maxW / Math.max(1, box.w)), Math.floor(maxH / Math.max(1, box.h))));
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
      settings: () => this.showSettings({ inRun: true, from: 'pause' }),
      achievements: () => this.showAchievements({ from: 'pause' }),
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

  showSettings(options) {
    this.settingsViews.showSettings(options);
  }

  showAchievements(options) {
    this.settingsViews.showAchievements(options);
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
    const typing = event.target?.closest?.('input, select, textarea');
    if (!typing && this.currentScreenName === 'menu' && /^Digit[1-4]$/.test(event.code)) {
      const action = ['start', 'achievements', 'settings', 'credits'][Number(event.code.slice(-1)) - 1];
      this.screenRoot.querySelector(`[data-action="${action}"]`)?.click();
      event.preventDefault();
      return;
    }
    if (!typing && this.currentScreenName === 'characters') {
      if (/^Digit[1-4]$/.test(event.code)) {
        const index = Number(event.code.slice(-1)) - 1;
        this.screenRoot.querySelectorAll('[data-char]')[index]?.click();
        event.preventDefault();
        return;
      }
      if (event.code === 'Enter') {
        this.screenRoot.querySelector('[data-action="start"]')?.click();
        event.preventDefault();
        return;
      }
      if (event.code === 'Escape') {
        this.showMainMenu();
        event.preventDefault();
        return;
      }
    }
    if (event.code === 'Escape') {
      if (this.currentScreenName === 'pause') {
        this.clearScreen();
        this.game.setPaused?.(false);
        event.preventDefault();
        return;
      }
      if (['settings', 'achievements', 'credits'].includes(this.currentScreenName)) {
        if (this.currentScreenName === 'settings') this.settingsViews.backFromSettings();
        else if (this.currentScreenName === 'achievements') {
          this.settingsViews.backFromAchievements();
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

  setZoneTheme(zone) { this.feedback.setZoneTheme(zone); }

  setFade(active) { this.feedback.setFade(active); }

  setVignetteOpacity(value) { this.feedback.setVignetteOpacity(value); }

  flashHurt(critical = false) { this.feedback.flashHurt(critical); }

  clearToasts() { this.feedback.clearToasts(); }

  toast(key, vars = {}, options = {}) { this.feedback.toast(key, vars, options); }

  toastText(text, options = {}) { this.feedback.toastText(text, options); }

  spawnDamageNumber(worldX, worldY, text, kind = 'normal') {
    this.feedback.spawnDamageNumber(worldX, worldY, text, kind);
  }

  updateDamageNumbers(dt, camera) { this.feedback.updateDamageNumbers(dt, camera); }

  clearDamageNumbers() { this.feedback.clearDamageNumbers(); }

  updateDebug(info) { this.feedback.updateDebug(info); }

  hideDebug() { this.feedback.hideDebug(); }

  destroy() {
    window.removeEventListener('keydown', this.boundKeydown);
    this.stopPreviewAnimation();
    this.feedback.dispose();
    this.screenRoot.innerHTML = '';
    this.hud.root.remove();
  }
}

