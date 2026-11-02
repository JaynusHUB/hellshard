import { GAME } from '../config/game.js';
import { getDifficultyPhase } from '../config/difficulty.js';
import { ZONES } from '../data/zones.js';
import { ENEMY_BY_ID } from '../data/enemies.js';
import { Enemy } from '../entities/Enemy.js';
import { Renderer } from '../render/Renderer.js';
import { CameraRig } from '../render/CameraRig.js';
import { ParticleSystem, COLORS } from '../render/ParticleSystem.js';
import { Input } from './Input.js';
import { FixedLoop } from './Loop.js';
import { clamp } from './RNG.js';
import { EnemySpatialHash } from '../world/SpatialHash.js';
import { ProjectileSystem } from '../systems/ProjectileSystem.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { SpawnDirector } from '../systems/SpawnDirector.js';
import { XPOrbSystem } from '../systems/XPOrbSystem.js';
import { AchievementSystem } from '../systems/AchievementSystem.js';
import { EVOLUTIONS } from '../config/upgrades.js';
import { WorldRenderer } from '../render/WorldRenderer.js';
import { InteractionSystem } from '../systems/InteractionSystem.js';
import { CombatDirector } from '../systems/CombatDirector.js';
import { BossController } from '../systems/BossController.js';
import { RunController } from '../systems/RunController.js';
import { WorldLifeSystem } from '../systems/WorldLifeSystem.js';
import { ZoneSceneManager } from '../world/ZoneSceneManager.js';
import { CollisionDebugOverlay } from '../render/CollisionDebugOverlay.js';

export class Game {
  constructor({ canvas, save, audio, assets }) {
    this.canvas = canvas;
    this.save = save;
    this.audio = audio;
    this.assets = assets;
    this.renderer = new Renderer(canvas);
    this.camera = new CameraRig();
    this.camera.setShakeSetting(save.settings.shake ?? 0.7);
    this.input = new Input(window);
    this.input.onFirstGesture = () => {
      this.audio.ensure();
      if (this.state === 'playing') this.audio.startAmbient(this.activeZoneId);
    };
    this.ui = null;
    this.state = 'boot';
    this.seed = Number(save.settings.seed ?? GAME.seed.default);
    this.activeZoneId = 'cemetery';
    this.activeZone = ZONES.cemetery;
    this.activeWorld = null;
    this.run = null;
    this.player = null;
    this.enemies = [];
    this.projectiles = new ProjectileSystem({ particles: null, glowParticles: null });
    this.spatialHash = null;
    this.hitstopFrames = 0;
    this.combat = null;
    this.traps = [];
    this.progression = null;
    this.spawnDirector = new SpawnDirector(this);
    this.zoneStates = {};
    this.currentInteraction = null;
    this.prompt = null;
    this.transition = null;
    this.lastRoom = -1;
    this.boss = null;
    this.bossHazards = [];
    this.bossDamageTaken = 0;
    this.arenaGatePositions = [];
    this.menuAmbientTimer = 0;
    this.time = 0;
    this.menuTime = 0;
    this.lastFrameDelta = 1 / 60;
    this.debugVisible = false;
    this.sceneVersion = 0;
    this.createEffects();
    this.worldRenderer = new WorldRenderer(this);
    this.collisionDebug = new CollisionDebugOverlay(this);
    this.interactions = new InteractionSystem(this);
    this.combatDirector = new CombatDirector(this);
    this.bossController = new BossController(this);
    this.runController = new RunController(this);
    this.worldLife = new WorldLifeSystem(this);
    this.sceneManager = new ZoneSceneManager(this);
    this.loop = new FixedLoop({
      step: GAME.fixedStep,
      maxDelta: GAME.maxFrameDelta,
      maxSubSteps: GAME.maxSubSteps,
      update: (dt) => this.update(dt),
      render: (alpha, dt) => this.render(alpha, dt),
    });
  }

  createEffects() {
    this.particles = new ParticleSystem({
      scene: this.renderer.scene,
      maxParticles: GAME.rendering.maxParticles,
      additive: false,
    });
    this.glowParticles = new ParticleSystem({
      scene: this.renderer.scene,
      maxParticles: 500,
      additive: true,
    });
    this.projectiles = new ProjectileSystem({
      maxProjectiles: 256,
      particles: this.particles,
      glowParticles: this.glowParticles,
    });
    this.xpOrbs = new XPOrbSystem({
      scene: this.renderer.scene,
      particles: this.particles,
      glowParticles: this.glowParticles,
      maxOrbs: 220,
    });
  }

  attachUI(ui) {
    this.ui = ui;
    this.combat = new CombatSystem({
      game: this,
      particles: this.particles,
      glowParticles: this.glowParticles,
      audio: this.audio,
      ui,
    });
    this.gameAchievements = new AchievementSystem({
      game: this,
      save: this.save,
      ui,
      audio: this.audio,
    });
  }

  initialize() {
    this.buildMenuScene();
    this.state = 'menu';
  }

  start() {
    this.loop.start();
  }

  enterMenuMode() {
    if (this.state === 'playing' || this.state === 'paused') {
      if (!['result'].includes(this.state)) this.returnToMenu();
    }
    this.state = 'menu';
    const desiredSeed = Number(this.save.settings.seed ?? this.seed);
    if (!this.menuWorld || this.menuSeed !== desiredSeed) {
      this.seed = desiredSeed;
      this.menuSeed = desiredSeed;
      this.buildMenuScene();
    }
    this.ui?.showHUD(false);
    this.ui?.clearDamageNumbers();
    this.ui?.setFade(false);
  }

  buildMenuScene() {
    this.sceneManager.buildMenuScene();
  }

  startRun(characterId, seed) {
    this.runController.startRun(characterId, seed);
  }

  spawnEnemy(enemyId, x, y, modifiers = {}) {
    const def = ENEMY_BY_ID[enemyId];
    if (!def) return null;
    const world = this.activeWorld;
    const px = clamp(x, 8, world.width * GAME.tile - 8);
    const zoneTint = this.assets.getPresentation().zoneTints[this.activeZoneId] ?? [1, 1, 1];
    const enemy = new Enemy(def, this.assets, px, y, {
      health: modifiers.health ?? 1,
      damage: modifiers.damage ?? 1,
      speed: modifiers.speed ?? 1,
      zoneTint,
    });
    this.enemies.push(enemy);
    this.glowParticles.burst([COLORS.soul, COLORS.shadow], px, y + enemy.height / 2, 10, {
      speed: 45,
      life: 0.4,
      gravity: 20,
      drag: 2,
      size: 2,
    });
    return enemy;
  }

  initSpatialHash() {
    if (!this.activeWorld) return;
    this.spatialHash = new EnemySpatialHash(
      this.activeWorld.width * GAME.tile,
      this.activeWorld.height * GAME.tile,
      GAME.spatial.cellSize,
      512,
    );
  }

  addHitstop(frames) {
    this.hitstopFrames = Math.max(this.hitstopFrames, frames);
  }

  getMetaModifiers() {
    return this.runController.getMetaModifiers();
  }

  setZone(zoneId, spawn = null) {
    this.sceneManager.setZone(zoneId, spawn);
  }

  snapCameraToPlayer() {
    this.sceneManager.snapCameraToPlayer();
  }

  disposeScene() {
    this.sceneManager.dispose();
  }

  update(dt) {
    this.time += dt;
    if (this.input.wasPressed('debug')) this.debugVisible = !this.debugVisible;
    if (this.state === 'playing') {
      if (this.input.wasPressed('pause')) {
        this.state = 'paused';
        this.input.clearPressed();
        this.ui?.showPause();
        this.audio.play('ui');
        return;
      }
      this.updatePlaying(dt);
    } else if (this.state === 'menu') {
      this.updateMenuAmbience(dt);
    } else if (this.state === 'transition') {
      this.interactions.updateTransition(dt);
    }
    this.input.clearPressed();
  }

  updateMenuAmbience(dt) {
    this.menuAmbientTimer -= dt;
    if (this.menuAmbientTimer <= 0) {
      this.menuAmbientTimer = 0.16;
      const x = this.camera.x + (Math.random() - 0.5) * GAME.internalWidth;
      const y = this.camera.y - 120 + Math.random() * 240;
      this.glowParticles.emit({
        x,
        y,
        vx: (Math.random() - 0.5) * 8,
        vy: 8 + Math.random() * 10,
        gravity: -2,
        drag: 0.1,
        life: 2.5 + Math.random() * 2,
        sizeX: Math.random() < 0.2 ? 2 : 1,
        sizeY: Math.random() < 0.2 ? 2 : 1,
        color: Math.random() < 0.5 ? COLORS.ember : COLORS.gold,
        alpha: 0.35,
      });
    }
    this.particles.update(dt);
    this.glowParticles.update(dt);
  }

  updatePlaying(dt) {
    const player = this.player;
    if (!player) return;
    if (this.hitstopFrames > 0) {
      this.hitstopFrames -= 1;
      return;
    }
    this.run.elapsed += dt;
    this.worldLife.updateMovingPlatforms();
    player.update(dt, this.activeWorld, this.input);
    this.bossController.checkTrigger();
    const playerEvents = player.consumeEvents();
    for (const enemy of this.enemies) {
      enemy.update(dt, this.activeWorld, player, this);
    }
    this.separateEnemies();
    this.combatDirector.handlePlayerEvents(player.consumeEvents());
    this.buildSpatialHash();
    this.combatDirector.handlePlayerEvents(playerEvents);
    this.projectiles.update(dt, this);
    this.combatDirector.updateTraps(dt);
    this.bossController.updateHazards(dt);
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      this.combatDirector.handleEnemyEvents(enemy.consumeEvents());
    }
    this.spawnDirector.update(dt);
    this.worldLife.emitAmbient(dt);
    this.xpOrbs.update(dt, player, this.activeWorld.map, (value, orb) => {
      this.progression.addXp(value);
      this.audio.play('xp', { pitch: orb?.value >= 20 ? 0.8 : 1, throttle: 40 });
    });
    const second = Math.floor(this.run.elapsed);
    if (second !== this.lastAchievementSecond) {
      this.lastAchievementSecond = second;
      this.gameAchievements?.onTime(second);
    }
    this.particles.update(dt);
    this.glowParticles.update(dt);
    this.cleanupEnemies();
    if (player.dead) {
      this.endRun('death');
      return;
    }
    if (this.state !== 'playing') return;
    this.interactions.updateCheckpoint();
    this.interactions.updatePrompt();
    if (this.currentInteraction && this.input.wasPressed('interact')) {
      this.interactions.interactWith(this.currentInteraction);
      return;
    }
    this.camera.follow(player.x, player.y, player.facing, dt);
  }

  onPlayerLeveledUp() {
    if (this.state !== 'playing') return;
    this.state = 'levelup';
    this.gameAchievements?.onLevel(this.progression.level);
    this.audio.play('levelUp');
    const offers = this.progression.buildOffers();
    this.ui?.showLevelUp(offers, {
      level: this.progression.level,
      playerUpgrades: this.progression.upgradeLevels,
    });
  }

  chooseUpgrade(index) {
    if (this.state !== 'levelup' || !this.progression) return;
    this.progression.chooseOffer(index);
    if (this.progression.hasPendingLevelUps()) {
      const offers = this.progression.buildOffers();
      this.ui?.showLevelUp(offers, {
        level: this.progression.level,
        playerUpgrades: this.progression.upgradeLevels,
      });
      return;
    }
    this.state = 'playing';
    this.ui?.clearScreen();
    this.input.clear();
  }

  onEvolution(evolutionId) {
    this.gameAchievements?.onEvolution?.(evolutionId);
  }

  getEnemyCost(enemyId) {
    return ENEMY_BY_ID[enemyId]?.cost ?? 1;
  }

  getEnemyDef(enemyId) {
    return ENEMY_BY_ID[enemyId];
  }

  buildSpatialHash() {
    if (!this.spatialHash) this.initSpatialHash();
    if (!this.spatialHash) return;
    this.spatialHash.clear();
    for (let i = 0; i < this.enemies.length; i++) {
      const enemy = this.enemies[i];
      if (!enemy.dead) this.spatialHash.insert(i, enemy);
    }
  }

  cleanupEnemies() {
    if (!this.enemies.some((enemy) => enemy.dead)) return;
    this.enemies = this.enemies.filter((enemy) => !enemy.dead || enemy.deathTimer > 0);
    this.buildSpatialHash();
  }

  separateEnemies() {
    const world = this.activeWorld;
    if (!world || this.enemies.length < 2) return;
    const minX = 12;
    const maxX = world.width * GAME.tile - 12;
    for (let i = 0; i < this.enemies.length; i++) {
      const a = this.enemies[i];
      if (a.dead || a.isBoss) continue;
      for (let j = i + 1; j < this.enemies.length; j++) {
        const b = this.enemies[j];
        if (b.dead || b.isBoss) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const rangeX = (a.width + b.width) * 0.5 + 2;
        const rangeY = Math.min(a.height, b.height) * 0.58;
        if (Math.abs(dx) >= rangeX || Math.abs(dy) >= rangeY) continue;
        const overlap = rangeX - Math.abs(dx);
        const direction = Math.sign(dx) || (i % 2 === 0 ? 1 : -1);
        const shift = Math.min(overlap * 0.5, 3);
        const oldAX = a.x;
        const oldBX = b.x;
        const nextAX = clamp(a.x - direction * shift, minX, maxX);
        const nextBX = clamp(b.x + direction * shift, minX, maxX);
        if (this.canSeparateTo(a, nextAX)) a.x = nextAX;
        if (this.canSeparateTo(b, nextBX)) b.x = nextBX;
        if (a.x === oldAX && b.x === oldBX) {
          // Both blocked by geometry: let the faster actor yield if the tile permits.
          const faster = Math.abs(a.vx) > Math.abs(b.vx) ? a : b;
          const base = faster === a ? oldAX : oldBX;
          const candidate = clamp(base + (faster === a ? direction : -direction), minX, maxX);
          if (this.canSeparateTo(faster, candidate)) faster.x = candidate;
        }
        if (a.flying && b.flying && Math.abs(dy) < rangeY * 0.5) {
          const pushY = Math.sign(dy) || 1;
          a.y -= pushY * Math.min(0.5, overlap * 0.1);
          b.y += pushY * Math.min(0.5, overlap * 0.1);
        }
      }
    }
  }

  canSeparateTo(enemy, x) {
    if (enemy.flying) return true;
    const half = enemy.width / 2;
    const map = this.activeWorld?.map;
    if (!map) return false;
    return !map.rectHitsSolid(x - half + 1, enemy.y + 2, enemy.width - 2, Math.max(1, enemy.height - 4));
  }

  onEnemyDefeated(enemy) {
    this.combatDirector.onEnemyDefeated(enemy);
  }

  onBossDefeated(boss) {
    this.bossController.onDefeated(boss);
  }

  findNearestEnemy(x, y, radius, exclude = null) {
    return this.combatDirector.findNearestEnemy(x, y, radius, exclude);
  }

  respawnFromFall() {
    const cp = this.run.checkpoint;
    this.player.setPosition(cp.x, cp.y);
    this.player.health = Math.max(1, this.player.health - this.player.maxHealth * 0.1);
    this.player.iframes = 1.2;
    this.player.spawnGrace = 1.2;
    this.snapCameraToPlayer();
    this.ui?.toast('toast.checkpoint');
    this.audio.play('playerHurt');
  }

  setPaused(paused) {
    if (!paused && this.state === 'paused') {
      this.state = 'playing';
      this.input.clear();
    } else if (paused && this.state === 'playing') {
      this.state = 'paused';
    }
  }

  updateSettings(settings, applyAudio = true) {
    if (applyAudio) {
      this.audio.setSettings(settings);
      this.camera.setShakeSetting(Number(settings.shake ?? 0.7));
    }
    if (Number(settings.seed ?? this.seed) !== this.seed) {
      this.seed = Number(settings.seed);
    }
  }

  unlockCharacter(id, cost) {
    return this.save.unlockCharacter(id, cost);
  }

  buyPermanentBonus(id, cost) {
    const meta = this.save.meta;
    const rank = meta.permanent[id] ?? 0;
    if (rank >= 3) return false;
    if (!this.save.spendShards(cost)) return false;
    meta.permanent[id] = rank + 1;
    this.save.saveMeta();
    if (this.progression) this.progression.recalculatePlayer();
    return true;
  }

  getHudInfo() {
    if (!this.player || !this.run) return null;
    const difficulty = getDifficultyPhase(this.run.elapsed);
    const evolution = EVOLUTIONS[this.player.characterId];
    return {
      player: this.player,
      run: {
        ...this.run,
        specialCooldown: this.player.specialCooldown,
        specialMax: this.player.character.special.cooldown,
        specialNameKey: this.player.character.special.nameKey,
        dashCooldown: this.player.dashCooldown,
        dashMax: this.player.stats.dashCooldown,
        weaponNameKey: this.run.evolved && evolution
          ? evolution.nameKey
          : this.player.character.weapon.nameKey,
      },
      elapsed: this.run.elapsed,
      difficulty,
      seed: this.seed,
      zone: this.activeZone,
      boss: this.boss ? {
        active: !this.boss.dead,
        nameKey: this.boss.def.nameKey,
        phase: this.boss.phaseIndex + 1,
        health: this.boss.health,
        maxHealth: this.boss.maxHealth,
      } : null,
      prompt: this.prompt,
      shards: this.run.shards.length,
      activeEnemies: this.enemies.length,
    };
  }

  render(alpha, dt) {
    this.lastFrameDelta = dt;
    this.camera.updateShake(dt, this.time);
    const menuMode = this.state === 'menu' || this.state === 'characters';
    if (menuMode) {
      this.menuTime += dt;
      const worldW = this.menuWorld.width * GAME.tile;
      const drift = Math.sin(this.menuTime * 0.035) * 90;
      const x = clamp(this.menuWorld.spawn.x + 280 + drift, 320, worldW - 320);
      const y = 214 + Math.sin(this.menuTime * 0.05) * 8;
      this.camera.x = x;
      this.camera.y = y;
      this.camera.shakeX = 0;
      this.camera.shakeY = 0;
    }
    this.worldRenderer.prepare(alpha, dt, !menuMode && this.state !== 'result');
    this.renderer.render(this.camera, alpha, this.time);
    const hudInfo = this.getHudInfo();
    if (hudInfo && this.state !== 'menu' && this.state !== 'characters' && this.state !== 'result') {
      this.ui?.updateHUD(hudInfo);
    }
    this.ui?.updateDamageNumbers(dt, this.camera);
    this.updateDebugOverlay(alpha);
  }

  updateDebugOverlay(alpha = 0) {
    this.collisionDebug?.setVisible(this.debugVisible);
    this.collisionDebug?.render(alpha);
    if (!this.debugVisible || !this.ui) {
      this.ui?.updateDebug(null);
      return;
    }
    const info = this.renderer.getInfo();
    const player = this.player;
    const budget = this.spawnDirector?.budget ?? 0;
    this.ui.updateDebug({
      fps: this.loop.fpsAverage,
      frameMs: this.loop.frameMs,
      drawCalls: info.calls,
      entities: (player ? 1 : 0) + (this.enemies?.length ?? 0) + this.projectiles.getActiveCount(),
      particles: (this.particles?.count ?? 0) + (this.glowParticles?.count ?? 0),
      spawnBudget: budget,
      zone: this.activeZoneId,
      seed: this.seed,
      x: player?.x ?? 0,
      y: player?.y ?? 0,
      state: this.state,
      activeEnemies: this.enemies?.length ?? 0,
      boss: this.boss?.id ?? null,
    });
  }

  endRun(reason) {
    this.runController.endRun(reason);
  }

  abandonRun() {
    this.runController.abandonRun();
  }

  restartRun() {
    this.runController.restartRun();
  }

  returnToMenu() {
    this.runController.returnToMenu();
  }

  destroy() {
    this.loop.destroy();
    this.input.destroy();
    this.disposeScene();
    this.particles.dispose();
    this.glowParticles.dispose();
    this.xpOrbs.dispose();
    this.worldRenderer.dispose();
    this.collisionDebug?.dispose();
    this.renderer.dispose();
    this.audio.destroy();
  }
}
