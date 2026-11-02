import { GAME } from '../config/game.js';
import { CHARACTER_BY_ID } from '../data/characters.js';
import { ZONES } from '../data/zones.js';
import { EVOLUTIONS } from '../config/upgrades.js';
import { generateWorld } from '../world/WorldGen.js';
import { Player } from '../entities/Player.js';
import { Progression } from '../systems/Progression.js';

export class RunController {
  constructor(game) {
    this.game = game;
  }

  startRun(characterId, seed) {
    const game = this.game;
    const character = CHARACTER_BY_ID[characterId];
    if (!character) return;
    if (!game.save.isUnlocked(characterId)) return;
    game.seed = seed >>> 0 || GAME.seed.default;
    game.save.updateSettings({ seed: game.seed });
    game.run = {
      seed: game.seed,
      elapsed: 0,
      level: 1,
      xp: 0,
      xpToNext: GAME.progression.baseXpToLevel,
      kills: 0,
      xpEarned: 0,
      bosses: [],
      bossIds: [],
      shards: [],
      shardIds: [],
      chestsOpened: 0,
      weaponLevel: 1,
      evolved: false,
      evolutionId: null,
      upgradeLevels: {},
      upgradeStats: {},
      damageTaken: 0,
      characterId,
      checkpoint: { x: 0, y: 0 },
      startTime: performance.now(),
      victory: false,
    };
    game.worlds = generateWorld(game.seed);
    game.player = new Player(characterId, game.assets, this.getMetaModifiers());
    game.player.devFly = Boolean(game.devFly);
    game.player.immortal = Boolean(game.devFly);
    game.progression = new Progression(game);
    game.progression.reset(game.seed, characterId);
    game.progression.recalculatePlayer();
    game.progression.syncRun();
    game.state = 'playing';
    game.enemies = [];
    game.projectiles.clear();
    game.traps = [];
    game.particles.clear();
    game.glowParticles.clear();
    game.xpOrbs.clear();
    game.xpOrbs.setSeed(game.seed);
    game.hitstopFrames = 0;
    game.runRecorded = false;
    game.lastAchievementSecond = 0;
    game.zoneStates = {};
    for (const id of Object.keys(ZONES)) {
      game.zoneStates[id] = { bossDefeated: false, bossStarted: false, seen: id === 'cemetery' };
    }
    game.currentInteraction = null;
    game.prompt = null;
    game.transition = null;
    game.lastRoom = -1;
    game.boss = null;
    game.bossHazards = [];
    game.bossDamageTaken = 0;
    game.arenaGatePositions = [];
    game.gameAchievements?.reset();
    game.combat.setSeed(game.seed);
    game.setZone('cemetery', game.worlds.cemetery.spawn);
    game.player.setPosition(game.activeWorld.spawn.x, game.activeWorld.spawn.y);
    game.run.checkpoint = { ...game.activeWorld.spawn };
    game.snapCameraToPlayer();
    game.spawnDirector.reset(game.seed, 'cemetery');
    game.interactions.updatePrompt();
    game.ui?.clearScreen();
    game.ui?.setZoneTheme(game.activeZone);
    game.ui?.showHUD(true);
    game.ui?.clearDamageNumbers();
    game.ui?.setFade(true);
    setTimeout(() => game.ui?.setFade(false), 300);
    game.audio.ensure();
    game.audio.startAmbient('cemetery');
    game.ui?.toast('zone.entered', { zone: game.ui.t(game.activeZone.nameKey) }, { duration: 1400 });
  }

  getMetaModifiers() {
    return { ...this.game.save.meta.permanent };
  }

  endRun(reason) {
    const game = this.game;
    if (game.state === 'result') return;
    game.state = 'result';
    if (game.player) game.player.dead = true;
    game.audio.stopAmbient();
    game.ui?.clearToasts?.();
    game.bossHazards = [];
    const oldBest = game.save.meta.bestTime ?? 0;
    const summary = this.buildSummary(reason === 'victory');
    summary.achievements = game.gameAchievements ? [...game.gameAchievements.unlockedThisRun] : [];
    if (!game.runRecorded) {
      game.runRecorded = true;
      game.gameAchievements?.persist();
      game.save.recordRun(summary);
    }
    const newBest = summary.elapsed > oldBest;
    game.ui?.showResult(summary, reason === 'victory', newBest);
    game.ui?.setFade(false);
    game.input.clear();
  }

  buildSummary(victory) {
    const game = this.game;
    const run = game.run;
    const character = CHARACTER_BY_ID[run.characterId];
    return {
      seed: game.seed,
      characterId: run.characterId,
      elapsed: run.elapsed,
      kills: run.kills,
      bosses: run.bossIds,
      bossIds: run.bossIds,
      xp: run.xpEarned,
      level: run.level,
      upgradeLevels: run.upgradeLevels,
      shardsEarned: run.shards.length * GAME.meta.bossShardReward + (game.gameAchievements?.rewardTotal ?? 0),
      shardIds: run.shardIds,
      achievements: [],
      topUpgrades: Object.entries(run.upgradeLevels)
        .map(([id, level]) => ({ id, level, nameKey: `upgrade.${id}.name` }))
        .sort((a, b) => b.level - a.level)
        .slice(0, 3),
      weaponNameKey: run.evolved
        ? EVOLUTIONS[run.characterId]?.nameKey ?? character.weapon.nameKey
        : character.weapon.nameKey,
      weaponLevel: run.weaponLevel,
      evolved: run.evolved,
      victory,
    };
  }

  abandonRun() {
    this.endRun('abandon');
  }

  restartRun() {
    const game = this.game;
    if (!game.run) return;
    const characterId = game.run.characterId;
    const seed = game.seed;
    game.ui?.clearDamageNumbers();
    this.startRun(characterId, seed);
  }

  returnToMenu() {
    const game = this.game;
    game.state = 'menu';
    game.audio.stopAmbient();
    game.ui?.clearToasts?.();
    game.disposeScene();
    game.player = null;
    game.run = null;
    game.enemies = [];
    game.projectiles.clear();
    game.traps = [];
    game.particles.clear();
    game.glowParticles.clear();
    game.xpOrbs.clear();
    game.progression = null;
    game.boss = null;
    game.buildMenuScene();
    game.ui?.showHUD(false);
    game.ui?.clearScreen();
    game.ui?.clearDamageNumbers();
  }
}
