import { settingsHtml, achievementsHtml } from './MenuScreens.js';

export class SettingsViews {
  constructor(ui) {
    this.ui = ui;
    this.game = ui.game;
    this.save = ui.save;
    this.audio = ui.audio;
    this.settingsReturn = 'menu';
    this.achievementsReturn = 'menu';
    this.currentInRun = false;
  }

  showSettings({ inRun = false, from = 'menu' } = {}) {
    const ui = this.ui;
    this.settingsReturn = from;
    this.currentInRun = inRun;
    const settings = this.save.settings;
    const seed = this.game.seed ?? settings.seed ?? 1;
    const html = settingsHtml({
      t: ui.t,
      settings,
      meta: this.save.meta,
      inRun,
      seed,
    });
    ui.mountScreen('settings', html, {
      back: () => this.backFromSettings(),
      'apply-settings': () => {
        const input = ui.screenRoot.querySelector('[data-setting="seed"]');
        if (input && !inRun) {
          const seedValue = ui.parseSeed(input.value);
          if (seedValue === null) {
            ui.toast('settings.seedInvalid', {}, { error: true });
            return;
          }
          this.save.updateSettings({ seed: seedValue });
          this.game.updateSettings?.({ seed: seedValue }, false);
        }
        ui.toast('settings.saved');
        this.backFromSettings();
      },
      fullscreen: () => {
        if (document.fullscreenElement) document.exitFullscreen?.();
        else document.documentElement.requestFullscreen?.();
      },
      'reset-settings': () => {
        this.save.resetSettings();
        ui.settings = this.save.settings;
        this.audio.setSettings(this.save.settings);
        this.game.updateSettings?.(this.save.settings, true);
        ui.setLanguage(this.save.settings.language);
        this.showSettings({ inRun, from });
      },
    });
    this.bindSettingsControls(inRun);
  }

  backFromSettings() {
    if (this.settingsReturn === 'pause') this.ui.showPause();
    else this.ui.showMainMenu();
  }

  bindSettingsControls(inRun) {
    const ui = this.ui;
    for (const input of ui.screenRoot.querySelectorAll('[data-setting]')) {
      const key = input.dataset.setting;
      if (key === 'seed') {
        input.addEventListener('input', () => {
          input.value = input.value.replace(/[^0-9]/g, '').slice(0, 10);
        });
        continue;
      }
      input.addEventListener('input', () => {
        if (input.type === 'range') {
          const value = Number(input.value) / 100;
          const output = ui.screenRoot.querySelector(`[data-output="${key}"]`);
          if (output) output.textContent = `${Math.round(value * 100)}%`;
          this.updateSettingLive(key, value);
        } else if (key === 'language') {
          this.updateSettingLive(key, input.value);
          ui.setLanguage(input.value);
        }
      });
    }
    for (const toggle of ui.screenRoot.querySelectorAll('[data-toggle]')) {
      toggle.addEventListener('click', () => {
        const key = toggle.dataset.toggle;
        const value = !toggle.classList.contains('on');
        toggle.classList.toggle('on', value);
        toggle.setAttribute('aria-pressed', String(value));
        this.updateSettingLive(key, value);
      });
    }
    for (const buy of ui.screenRoot.querySelectorAll('[data-buy-bonus]')) {
      buy.addEventListener('click', () => {
        const id = buy.dataset.buyBonus;
        const cost = Number(buy.dataset.cost);
        if (this.game.buyPermanentBonus(id, cost)) {
          this.audio.play('shard');
          this.showSettings({ inRun, from: this.settingsReturn });
        } else {
          ui.toast('char.select.notEnough', {}, { error: true });
        }
      });
    }
  }

  updateSettingLive(key, value) {
    this.save.updateSettings({ [key]: value });
    this.ui.settings = this.save.settings;
    if (key === 'seed') this.game.updateSettings?.({ seed: Number(value) }, false);
    else this.game.updateSettings?.(this.save.settings, true);
    this.audio.applyVolumes();
  }

  showAchievements({ from = 'menu' } = {}) {
    const ui = this.ui;
    this.achievementsReturn = from;
    const html = achievementsHtml({ t: ui.t, meta: this.save.meta, inRun: from === 'pause' });
    ui.mountScreen('achievements', html, {
      back: () => (from === 'pause' ? ui.showPause() : ui.showMainMenu()),
    });
  }

  backFromAchievements() {
    if (this.achievementsReturn === 'pause') this.ui.showPause();
    else this.ui.showMainMenu();
  }
}
