import './styles.css';
import { GAME } from './config/game.js';
import { ZONE_ORDER } from './data/zones.js';
import { SaveStore } from './core/SaveStore.js';
import { AudioManager } from './core/AudioManager.js';
import { AssetLibrary } from './render/AssetLibrary.js';
import { Game } from './core/Game.js';
import { UIManager } from './ui/UIManager.js';
import { translate } from './ui/strings.js';

function setBoot(progress, text) {
  const bar = document.getElementById('boot-progress');
  const status = document.getElementById('boot-status');
  if (bar) bar.style.width = `${Math.round(progress * 100)}%`;
  if (status && text) status.textContent = text;
}

async function boot() {
  const save = new SaveStore();
  const language = save.settings.language ?? 'en';
  const t = (key, vars) => translate(language, key, vars);
  setBoot(0.02, t('game.loading'));
  const audio = new AudioManager(save.settings);
  const assets = new AssetLibrary();
  await assets.loadAll((progress) => {
    setBoot(0.05 + progress * 0.62, t('game.assets'));
  });
  setBoot(0.7, t('game.loading'));
  await Promise.all(ZONE_ORDER.map((zoneId) => assets.loadZoneBackgrounds(zoneId)));
  setBoot(0.94, t('game.loading'));
  const canvas = document.getElementById('game');
  const game = new Game({ canvas, save, audio, assets });
  const ui = new UIManager({ game, assets, save, audio });
  game.attachUI(ui);
  game.initialize();
  setBoot(1, t('game.assets'));
  ui.showMainMenu();
  game.start();
  ui.hideBoot();
  window.HELLSHARD = { game, ui, save, assets, audio };
}

boot().catch((error) => {
  console.error(error);
  setBoot(1, 'The abyss resisted. / Uçurum direndi.');
  const status = document.getElementById('boot-status');
  if (status) {
    status.style.color = '#d05155';
    status.textContent = 'The abyss resisted. Check the console and refresh.';
  }
  const overlay = document.getElementById('boot-overlay');
  if (overlay) {
    const retry = document.createElement('button');
    retry.textContent = 'Reload';
    retry.style.cssText = 'margin-top:14px;padding:6px 14px;background:#160b0d;border:1px solid #87343a;color:#e9ddc7;font-family:inherit;cursor:pointer;';
    retry.addEventListener('click', () => window.location.reload());
    overlay.appendChild(retry);
  }
});
