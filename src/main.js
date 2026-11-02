import './styles.css';
import { GAME } from './config/game.js';
import { ZONE_ORDER } from './data/zones.js';
import { SaveStore } from './core/SaveStore.js';
import { AudioManager } from './core/AudioManager.js';
import { AssetLibrary } from './render/AssetLibrary.js';
import { Game } from './core/Game.js';
import { UIManager } from './ui/UIManager.js';
import { mountFacingDebug } from './ui/FacingDebugPage.js';
import { translate } from './ui/strings.js';

function parseDevOptions() {
  if (!import.meta.env.DEV) return {};
  const params = new URLSearchParams(window.location.search);
  const rawZone = params.get('zone');
  const zone = ZONE_ORDER.includes(rawZone) ? rawZone : null;
  const rawSeed = Number(params.get('seed'));
  const seed = Number.isInteger(rawSeed) && rawSeed > 0 ? rawSeed : null;
  const gallery = params.get('debug') === 'gallery';
  const peacefulParam = params.get('peaceful') === '1';
  const flyParam = params.get('fly') === '1';
  return {
    zone,
    seed,
    gallery,
    peaceful: peacefulParam || gallery,
    fly: flyParam || gallery,
    autoStart: Boolean(zone || seed || peacefulParam || flyParam || gallery),
  };
}

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
  const facingDebug = new URLSearchParams(window.location.search).get('debug') === 'facing';
  setBoot(0.02, t('game.loading'));
  const audio = new AudioManager(save.settings);
  const assets = new AssetLibrary();
  await assets.loadAll((progress) => {
    setBoot(0.05 + progress * 0.62, t('game.assets'));
  });
  if (facingDebug) {
    const page = mountFacingDebug(assets);
    setBoot(1, 'Facing audit ready');
    const bootOverlay = document.getElementById('boot-overlay');
    bootOverlay?.classList.add('done');
    window.setTimeout(() => bootOverlay?.remove(), 900);
    window.HELLSHARD = { assets, facingDebug: page };
    return;
  }
  setBoot(0.7, t('game.loading'));
  await Promise.all(ZONE_ORDER.map((zoneId) => assets.loadZoneBackgrounds(zoneId)));
  setBoot(0.94, t('game.loading'));
  const canvas = document.getElementById('game');
  const devOptions = parseDevOptions();
  const game = new Game({ canvas, save, audio, assets, devOptions });
  const ui = new UIManager({ game, assets, save, audio });
  game.attachUI(ui);
  game.initialize();
  if (devOptions.autoStart) {
    const seed = devOptions.seed ?? Number(save.settings.seed ?? GAME.seed.default);
    game.startRun('kael', seed);
    if (devOptions.zone && devOptions.zone !== 'cemetery') {
      game.setZone(devOptions.zone, game.worlds[devOptions.zone].spawn);
    }
    if (game.devGallery) {
      game.player.devFly = true;
      game.player.immortal = true;
      game.player.x = game.activeWorld.spawn.x;
      game.player.y = game.activeWorld.surface + GAME.dev.galleryHeight;
      game.player.prevX = game.player.x;
      game.player.prevY = game.player.y;
      game.snapCameraToPlayer();
    }
  } else {
    ui.showMainMenu();
  }
  setBoot(1, t('game.assets'));
  game.start();
  ui.hideBoot();
  window.HELLSHARD = { game, ui, save, assets, audio };
}

boot().catch((error) => {
  console.error(error);
  const language = (() => {
    try {
      return JSON.parse(localStorage.getItem('hellshard.settings.v1'))?.language ?? 'en';
    } catch {
      return 'en';
    }
  })();
  const t = (key) => translate(language, key);
  setBoot(1, t('error.loadTitle'));
  const status = document.getElementById('boot-status');
  if (status) {
    status.style.color = '#d05155';
    status.textContent = `${t('error.loadTitle')} ${t('error.loadBody')}`;
  }
  const overlay = document.getElementById('boot-overlay');
  if (overlay) {
    const retry = document.createElement('button');
    retry.textContent = t('error.retry');
    retry.style.cssText = 'margin-top:14px;padding:6px 14px;background:#160b0d;border:1px solid #87343a;color:#e9ddc7;font-family:inherit;cursor:pointer;';
    retry.addEventListener('click', () => window.location.reload());
    overlay.appendChild(retry);
  }
});
