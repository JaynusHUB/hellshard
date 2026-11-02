import { GAME } from '../config/game.js';
import { getDifficultyPhase } from '../config/difficulty.js';
import { CHARACTER_BY_ID } from '../data/characters.js';
import { ZONES } from '../data/zones.js';
import { generateWorld, generateZone } from '../world/WorldGen.js';
import { Player } from '../entities/Player.js';
import { Renderer } from '../render/Renderer.js';
import { SpriteBatch } from '../render/SpriteBatch.js';
import { CameraRig } from '../render/CameraRig.js';
import { BackgroundLayers } from '../render/BackgroundLayers.js';
import { TileChunkManager } from '../render/TileChunks.js';
import { Input } from './Input.js';
import { FixedLoop } from './Loop.js';
import { clamp } from './RNG.js';

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
    this.time = 0;
    this.menuTime = 0;
    this.lastFrameDelta = 1 / 60;
    this.debugVisible = false;
    this.sceneVersion = 0;
    this.batchEntries = {};
    this.createBatches();
    this.loop = new FixedLoop({
      step: GAME.fixedStep,
      maxDelta: GAME.maxFrameDelta,
      maxSubSteps: GAME.maxSubSteps,
      update: (dt) => this.update(dt),
      render: (alpha, dt) => this.render(alpha, dt),
    });
  }

  createBatches() {
    for (const [family, atlas] of Object.entries(this.assets.atlases)) {
      const propBatch = new SpriteBatch(atlas.texture, GAME.rendering.maxSpriteInstances);
      propBatch.mesh.renderOrder = 1;
      this.renderer.scene.add(propBatch.mesh);
      const actorBatch = new SpriteBatch(atlas.texture, GAME.rendering.maxSpriteInstances);
      actorBatch.mesh.renderOrder = 2;
      this.renderer.scene.add(actorBatch.mesh);
      this.batchEntries[family] = { prop: propBatch, actor: actorBatch };
    }
  }

  attachUI(ui) {
    this.ui = ui;
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
    this.disposeScene();
    this.seed = Number(this.save.settings.seed ?? this.seed);
    this.menuSeed = this.seed;
    this.menuWorld = generateZone(this.seed, 'cemetery');
    this.activeZoneId = 'cemetery';
    this.activeZone = ZONES.cemetery;
    this.activeWorld = this.menuWorld;
    this.buildScenery('cemetery', this.menuWorld);
    this.ui?.setZoneTheme(this.activeZone);
    this.menuCameraBase = { x: this.menuWorld.spawn.x + 40, y: 190 };
    this.camera.setBounds(0, this.menuWorld.width * GAME.tile, 0, this.menuWorld.height * GAME.tile);
    this.camera.snapTo(this.menuCameraBase.x, this.menuCameraBase.y);
    this.time = 0;
  }

  startRun(characterId, seed) {
    const character = CHARACTER_BY_ID[characterId];
    if (!character) return;
    if (!this.save.isUnlocked(characterId)) return;
    this.seed = seed >>> 0 || GAME.seed.default;
    this.save.updateSettings({ seed: this.seed });
    this.run = {
      seed: this.seed,
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
    this.worlds = generateWorld(this.seed);
    this.player = new Player(characterId, this.assets, this.getMetaModifiers());
    this.player.applyProgression({}, false, this.getMetaModifiers());
    this.player.weaponLevel = 1;
    this.player.setWeaponLevel(1);
    this.state = 'playing';
    this.activeZoneId = character.id ? 'cemetery' : 'cemetery';
    this.setZone('cemetery', this.worlds.cemetery.spawn);
    this.player.setPosition(this.activeWorld.spawn.x, this.activeWorld.spawn.y);
    this.run.checkpoint = { ...this.activeWorld.spawn };
    this.snapCameraToPlayer();
    this.ui?.clearScreen();
    this.ui?.setZoneTheme(this.activeZone);
    this.ui?.showHUD(true);
    this.ui?.clearDamageNumbers();
    this.ui?.setFade(true);
    setTimeout(() => this.ui?.setFade(false), 300);
    this.audio.ensure();
    this.audio.startAmbient('cemetery');
    this.ui?.toast('zone.entered', { zone: this.ui.t(this.activeZone.nameKey) }, { duration: 1400 });
  }

  getMetaModifiers() {
    return { ...this.save.meta.permanent };
  }

  setZone(zoneId, spawn = null) {
    const world = this.worlds?.[zoneId];
    const zone = ZONES[zoneId];
    if (!world || !zone) return;
    if (this.tileChunks) this.disposeScene();
    this.activeZoneId = zoneId;
    this.activeZone = zone;
    this.activeWorld = world;
    this.buildScenery(zoneId, world);
    this.camera.setBounds(0, world.width * GAME.tile, 0, world.height * GAME.tile);
    const point = spawn ?? world.spawn;
    this.player.setWorld(world);
    this.player.setPosition(point.x, point.y);
    this.run.checkpoint = { x: point.x, y: point.y };
    this.snapCameraToPlayer();
    this.ui?.setZoneTheme(zone);
    this.audio.startAmbient(zoneId);
    this.sceneVersion++;
  }

  snapCameraToPlayer() {
    if (!this.player) return;
    const halfW = GAME.internalWidth / 2;
    const halfH = GAME.internalHeight / 2;
    const x = clamp(
      this.player.x + this.player.facing * GAME.camera.lookAhead,
      halfW,
      Math.max(halfW, this.activeWorld.width * GAME.tile - halfW),
    );
    const y = clamp(
      this.player.y + GAME.camera.offsetY,
      halfH,
      Math.max(halfH, this.activeWorld.height * GAME.tile - halfH),
    );
    this.camera.snapTo(x, y);
  }

  buildScenery(zoneId, world) {
    this.background = new BackgroundLayers({
      scene: this.renderer.scene,
      assets: this.assets,
      zoneId,
    });
    this.tileChunks = new TileChunkManager({
      scene: this.renderer.scene,
      map: world.map,
      atlas: this.assets.getAtlas(world.atlas),
      assets: this.assets,
      zoneId,
      chunkTiles: GAME.world.chunkTiles,
      tileSize: GAME.tile,
    });
    this.sceneryZoneId = zoneId;
    this.sceneryWorld = world;
  }

  disposeScene() {
    if (this.background) {
      this.background.dispose();
      this.background = null;
    }
    if (this.tileChunks) {
      this.tileChunks.dispose();
      this.tileChunks = null;
    }
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
    } else if (this.state === 'paused' || this.state === 'levelup' || this.state === 'result') {
      // Simulation is intentionally frozen. UI owns input while overlays are open.
    }
    this.input.clearPressed();
  }

  updatePlaying(dt) {
    const player = this.player;
    if (!player) return;
    this.run.elapsed += dt;
    player.update(dt, this.activeWorld, this.input);
    const events = player.consumeEvents();
    this.handlePlayerEvents(events);
    if (player.dead) {
      this.endRun('death');
      return;
    }
    this.camera.follow(player.x, player.y, player.facing, dt);
    if (this.ui?.hud) {
      this.ui.hud.refs.specialFill.style.width = `${(1 - player.specialCooldown / player.stats.specialCooldown) * 100}%`;
    }
  }

  handlePlayerEvents(events) {
    for (const event of events) {
      switch (event.type) {
        case 'fell':
          this.respawnFromFall();
          break;
        case 'hazardHit':
          this.player.takeDamage(14, { type: 'hazard' });
          this.ui?.flashHurt(this.player.health < this.player.maxHealth * 0.25);
          this.ui?.spawnDamageNumber(this.player.x, this.player.y + 26, 14, 'player');
          this.audio.play('playerHurt');
          break;
        case 'playerHurt':
          this.run.damageTaken += event.amount;
          this.ui?.flashHurt(this.player.health < this.player.maxHealth * 0.25);
          this.audio.play('playerHurt');
          this.ui?.spawnDamageNumber(this.player.x, this.player.y + 28, Math.round(event.amount), 'player');
          if (event.amount >= 1) this.camera.addShake(2.5);
          break;
        case 'playerDeath':
          this.audio.play('death');
          this.camera.addShake(5);
          break;
        case 'jump':
          this.audio.play('jump');
          break;
        case 'land':
          if (event.velocity > 250) this.camera.addShake(0.8);
          break;
        case 'dash':
          this.audio.play('dash');
          this.camera.addShake(1.2);
          break;
        case 'muzzle':
          this.audio.play('projectile');
          break;
        case 'specialUsed':
          this.audio.play('ability');
          break;
        default:
          break;
      }
    }
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
    if (this.player) this.player.applyProgression(this.run.upgradeLevels, this.run.evolved, this.getMetaModifiers());
    return true;
  }

  chooseUpgrade() {
    // Progression arrives in Phase 3.
    this.state = 'playing';
    this.ui?.clearScreen();
  }

  getHudInfo() {
    if (!this.player || !this.run) return null;
    const difficulty = getDifficultyPhase(this.run.elapsed);
    return {
      player: this.player,
      run: {
        ...this.run,
        specialCooldown: this.player.specialCooldown,
        specialMax: this.player.character.special.cooldown,
        specialNameKey: this.player.character.special.nameKey,
        dashCooldown: this.player.dashCooldown,
        dashMax: this.player.stats.dashCooldown,
        weaponNameKey: this.player.character.weapon.nameKey,
      },
      elapsed: this.run.elapsed,
      difficulty,
      seed: this.seed,
      zone: this.activeZone,
      boss: null,
      prompt: null,
      shards: this.run.shards.length,
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
    this.prepareWorld(alpha, dt, !menuMode && this.state !== 'result');
    this.renderer.render(this.camera, alpha, this.time);
    const hudInfo = this.getHudInfo();
    if (hudInfo && this.state !== 'menu' && this.state !== 'characters' && this.state !== 'result') {
      this.ui?.updateHUD(hudInfo);
    }
    this.ui?.updateDamageNumbers(dt, this.camera);
    this.updateDebugOverlay();
  }

  prepareWorld(alpha, dt, includePlayer) {
    if (!this.background || !this.tileChunks) return;
    const cameraPos = { x: this.camera.x, y: this.camera.y };
    this.background.update(cameraPos.x, cameraPos.y);
    this.tileChunks.cull(
      cameraPos.x - GAME.internalWidth / 2,
      cameraPos.x + GAME.internalWidth / 2,
      cameraPos.y - GAME.internalHeight / 2,
      cameraPos.y + GAME.internalHeight / 2,
    );
    for (const family of Object.keys(this.batchEntries)) {
      this.batchEntries[family].prop.mesh.visible = false;
      this.batchEntries[family].actor.mesh.visible = false;
    }
    const zoneAtlas = this.activeWorld.atlas;
    const propBatch = this.batchEntries[zoneAtlas]?.prop;
    if (propBatch) {
      propBatch.begin();
      this.drawDecorations(propBatch);
      propBatch.end();
    }
    if (includePlayer && this.player) {
      const actorBatch = this.batchEntries.gothic.actor;
      if (actorBatch) {
        actorBatch.begin();
        this.drawPlayer(actorBatch, alpha);
        actorBatch.end();
      }
    }
  }

  drawDecorations(batch) {
    const world = this.activeWorld;
    const zoneTint = this.assets.getPresentation().zoneTints[this.activeZoneId] ?? [1, 1, 1];
    const tint = zoneTint.map((v) => v * 0.84);
    const decorations = world.decorations;
    for (let i = 0; i < decorations.length; i++) {
      const decoration = decorations[i];
      let frame = this.assets.getPropFrame(this.activeZoneId, decoration.prop);
      if (!frame && decoration.prop.startsWith('torch')) {
        const torchIndex = Math.floor(this.time * 6) % 4;
        frame = this.assets.getFrame('dungeon', `prop:dungeon:torch${torchIndex}`);
      }
      if (!frame) continue;
      batch.draw(frame, Math.round(decoration.x), Math.round(decoration.y + (decoration.yOffset ?? 0)), {
        flip: decoration.flip,
        tint,
        alpha: decoration.alpha ?? 0.8,
      });
    }
  }

  drawPlayer(batch, alpha) {
    const player = this.player;
    const pos = player.getRenderPosition(alpha);
    const frame = player.animator.frame;
    if (!frame) return;
    const zoneTint = this.assets.getPresentation().zoneTints[this.activeZoneId] ?? [1, 1, 1];
    const baseTint = player.character.tint;
    const tint = [0, 1, 2].map((i) => baseTint[i] * zoneTint[i]);
    for (const image of player.afterimages) {
      const t = image.life / image.maxLife;
      batch.draw(image.frame, Math.round(image.x), Math.round(image.y), {
        anchorY: image.frame.anchorY ?? 1,
        flip: image.facing < 0,
        tint: [0.55 * t + tint[0] * 0.2, 0.65 * t + tint[1] * 0.2, 1 * t],
        alpha: t * 0.3,
      });
    }
    const blink = player.iframes > 0 && Math.floor(this.time * 22) % 2 === 0;
    if (blink) return;
    const hover = player.characterId === 'seraphine' ? Math.round(Math.sin(player.animTime * 3) * 1) : 0;
    const dashLean = player.dashTimer > 0 ? 1 : 0;
    batch.draw(frame, pos.x + dashLean * player.facing, pos.y + 1 + hover, {
      anchorY: frame.anchorY ?? 1,
      flip: player.facing < 0,
      tint,
      flash: player.flashTimer > 0 ? 0.8 * (player.flashTimer / 0.12) : 0,
    });
    if (player.characterId === 'brakk' && player.rageTimer > 0) {
      const aura = 0.5 + Math.sin(this.time * 10) * 0.2;
      batch.draw(frame, pos.x, pos.y + 1, {
        anchorY: frame.anchorY ?? 1,
        flip: player.facing < 0,
        tint: [1.6, 0.3, 0.2],
        alpha: aura * 0.18,
      });
    }
  }

  updateDebugOverlay() {
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
      entities: player ? 1 : 0,
      particles: this.particles?.activeCount ?? 0,
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
    if (this.state === 'result') return;
    this.state = 'result';
    this.player?.animator && (this.player.dead = true);
    this.audio.stopAmbient();
    const summary = this.buildSummary(reason === 'victory');
    this.ui?.showResult(summary, reason === 'victory', false);
    this.ui?.setFade(false);
    this.input.clear();
  }

  buildSummary(victory) {
    const run = this.run;
    const character = CHARACTER_BY_ID[run.characterId];
    return {
      seed: this.seed,
      characterId: run.characterId,
      elapsed: run.elapsed,
      kills: run.kills,
      bosses: run.bossIds,
      bossIds: run.bossIds,
      xp: run.xpEarned,
      level: run.level,
      shardsEarned: run.shards.length * GAME.meta.bossShardReward,
      shardIds: run.shardIds,
      achievements: [],
      topUpgrades: Object.entries(run.upgradeLevels)
        .map(([id, level]) => ({ id, level, nameKey: `upgrade.${id}.name` }))
        .sort((a, b) => b.level - a.level)
        .slice(0, 3),
      weaponNameKey: character.weapon.nameKey,
      weaponLevel: run.weaponLevel,
      evolved: run.evolved,
      victory,
    };
  }

  abandonRun() {
    this.endRun('abandon');
  }

  restartRun() {
    if (!this.run) return;
    const characterId = this.run.characterId;
    const seed = this.seed;
    this.ui?.clearDamageNumbers();
    this.startRun(characterId, seed);
  }

  returnToMenu() {
    this.state = 'menu';
    this.audio.stopAmbient();
    this.disposeScene();
    this.player = null;
    this.run = null;
    this.enemies = [];
    this.boss = null;
    this.buildMenuScene();
    this.ui?.showHUD(false);
    this.ui?.clearScreen();
    this.ui?.clearDamageNumbers();
  }

  destroy() {
    this.loop.destroy();
    this.input.destroy();
    this.disposeScene();
    this.renderer.dispose();
    for (const entry of Object.values(this.batchEntries)) {
      entry.prop.dispose();
      entry.actor.dispose();
    }
    this.audio.destroy();
  }
}
