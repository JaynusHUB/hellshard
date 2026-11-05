import { GAME } from '../config/game.js';
import { DIFFICULTY, getDifficultyPhase } from '../config/difficulty.js';
import { RNG, combineSeed, clamp } from '../core/RNG.js';

export class SpawnDirector {
  constructor(game) {
    this.game = game;
    this.rng = new RNG(1);
    this.budget = 0;
    this.maxActive = 10;
    this.spawnTimer = 0;
    this.eventTimer = 0;
    this.event = null;
    this.budgetScale = 1;
    this.lowFpsTime = 0;
    this.recoveryTime = 0;
    this.lastPhase = null;
    this.zoneId = 'cemetery';
  }

  reset(seed, zoneId) {
    this.rng = new RNG(combineSeed(seed, 'spawns', zoneId));
    this.zoneId = zoneId;
    this.budget = 2.5;
    this.spawnTimer = 0.2;
    this.eventTimer = getDifficultyPhase(0).eventInterval || 70;
    this.event = null;
    this.budgetScale = 1;
    this.lowFpsTime = 0;
    this.recoveryTime = 0;
    this.lastPhase = getDifficultyPhase(this.game.run?.elapsed ?? 0).id;
  }

  get activeCount() {
    return this.game.enemies?.length ?? 0;
  }

  update(dt) {
    const game = this.game;
    if (game.peaceful) return;
    if (!game.player || !game.activeWorld) return;
    if (game.activeWorld.noAmbientSpawns) return;
    if (game.boss && !game.boss.dead) return;
    const arena = game.activeWorld.arena;
    if (arena && game.player.x > arena.left && game.player.x < arena.right) return;
    const elapsed = game.run.elapsed;
    const phase = getDifficultyPhase(elapsed);
    if (this.lastPhase !== phase.id) {
      this.lastPhase = phase.id;
      const phaseKey = game.activeZone?.phaseKeys?.[phase.id] ?? phase.labelKey;
      game.ui?.toast(phaseKey, {}, { icon: '☠', duration: 1600 });
    }
    this.updateAdaptive(dt);
    if (this.event) {
      this.event.timer -= dt;
      if (this.event.timer <= 0) this.event = null;
    } else {
      this.eventTimer -= dt;
      if (this.eventTimer <= 0 && phase.events?.length) {
        this.eventTimer = phase.eventInterval;
        this.triggerEvent(phase);
      }
    }
    const eventMultiplier = this.event?.budgetMultiplier ?? 1;
    const eventMaxAdd = this.event?.maxAdd ?? 0;
    const eliteBonus = this.event?.eliteBonus ?? 0;
    this.maxActive = Math.max(
      4,
      Math.round((phase.maxActive + eventMaxAdd) * this.budgetScale),
    );
    if (this.activeCount >= this.maxActive) {
      this.budget = Math.min(this.budget, 4);
      return;
    }
    this.budget += phase.spawnBudgetPerSecond * eventMultiplier * this.budgetScale * dt;
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0 || this.budget <= 0) return;
    this.spawnTimer = 0.26;
    const eliteChance = phase.eliteChance + eliteBonus * 0.22;
    const isElite = this.rng.chance(eliteChance);
    const enemyId = isElite ? this.pickElite(phase) : this.pickEnemy(phase);
    if (!enemyId) return;
    const cost = this.getCost(enemyId) * (isElite ? 1.4 : 1);
    if (this.budget < cost) return;
    const position = this.findSpawnPosition(enemyId, phase);
    if (!position) return;
    this.budget -= cost;
    game.spawnEnemy(enemyId, position.x, position.y, {
      health: phase.hpScale * this.timeHealthScale(elapsed),
      damage: phase.damageScale * this.timeDamageScale(elapsed),
      speed: phase.speedScale,
      elite: isElite,
    });
  }

  refund(cost) {
    const value = Number(cost);
    if (Number.isFinite(value) && value > 0) this.budget += value;
  }

  timeHealthScale(elapsed) {
    if (elapsed < 600) return 1;
    return 1 + ((elapsed - 600) / 60) * DIFFICULTY.timeScale.hpPerMinuteAfter10;
  }

  timeDamageScale(elapsed) {
    if (elapsed < 600) return 1;
    return 1 + ((elapsed - 600) / 60) * DIFFICULTY.timeScale.damagePerMinuteAfter10;
  }

  updateAdaptive(dt) {
    const adaptive = DIFFICULTY.adaptive;
    if (!adaptive.enabled) return;
    const fps = this.game.loop.fpsAverage;
    if (fps < adaptive.lowFps && this.activeCount > 12) {
      this.lowFpsTime += dt;
      if (this.lowFpsTime > 1.5) {
        this.budgetScale = clamp(this.budgetScale - adaptive.step, adaptive.minBudgetScale, 1);
        this.lowFpsTime = 0;
        this.recoveryTime = adaptive.recoveryDelay;
      }
    } else if (fps > adaptive.highFps) {
      this.lowFpsTime = 0;
      if (this.recoveryTime > 0) this.recoveryTime -= dt;
      else this.budgetScale = clamp(this.budgetScale + adaptive.step * 0.5, adaptive.minBudgetScale, 1);
    }
  }

  countSameTypeOnScreen(enemyId) {
    const game = this.game;
    const player = game.player;
    if (!player) return 0;
    const halfScreen = GAME.internalWidth / 2;
    let count = 0;
    for (const enemy of game.enemies ?? []) {
      if (enemy.dead || enemy.isBoss || enemy.id !== enemyId) continue;
      if (Math.abs(enemy.x - player.x) <= halfScreen) count++;
    }
    return count;
  }

  isTypeAtCrowdLimit(enemyId) {
    return this.countSameTypeOnScreen(enemyId) >= GAME.enemyAI.crowd.maxSameTypePerScreen;
  }

  pickEnemy(phase) {
    const zone = this.game.activeZone;
    const available = zone.enemyPool.filter((id) => phase.pool.includes(id));
    const candidates = available.length ? available : zone.enemyPool;
    const pool = candidates.filter((id) => !this.isTypeAtCrowdLimit(id));
    if (!pool.length) return null;
    const weighted = pool.map((id) => {
      const count = pool.filter((other) => other === id).length;
      return { value: id, weight: count };
    });
    return this.rng.weighted(weighted);
  }

  pickElite(phase) {
    const zone = this.game.activeZone;
    const elites = zone.elitePool.filter((id) => phase.pool.includes(id));
    const fallback = zone.elitePool;
    const candidates = elites.length ? elites : fallback;
    const pool = candidates.filter((id) => !this.isTypeAtCrowdLimit(id));
    return pool.length ? this.rng.pick(pool) : null;
  }

  getCost(enemyId) {
    return this.game.getEnemyCost(enemyId);
  }

  findSpawnPosition(enemyId, phase) {
    const game = this.game;
    const player = game.player;
    const world = game.activeWorld;
    const def = game.getEnemyDef(enemyId);
    if (!def) return null;
    if (this.isTypeAtCrowdLimit(enemyId)) return null;
    const side = this.rng.chance(0.5) ? -1 : 1;
    const baseDistance = GAME.internalWidth / 2 + 40 + this.rng.float(0, 170);
    const choices = [side, -side];
    for (const direction of choices) {
      for (let attempt = 0; attempt < 8; attempt++) {
        const x = player.x + direction * (baseDistance + attempt * 40);
        if (x < 32 || x > world.width * GAME.tile - 32) continue;
        const nearChest = world.interactions.some((interaction) => (
          interaction.type === 'chest' && Math.abs(interaction.x - x) < 4 * GAME.tile
        ));
        if (nearChest) continue;
        const groundY = this.findGround(world, x, world.surface);
        if (groundY === null) continue;
        if (!def.flying && !this.isBaseFloorSpawn(world, x, groundY)) continue;
        const tileX = Math.floor(x / GAME.tile);
        const standable = world.map.isStandableTile(tileX, Math.ceil(groundY / GAME.tile));
        if (!standable) continue;
        const y = def.flying ? groundY + 38 + this.rng.float(0, 80) : groundY;
        if (def.flying && y < groundY + 20) continue;
        return { x, y };
      }
    }
    return null;
  }

  isBaseFloorSpawn(world, x, groundY) {
    if (Math.abs(groundY - world.surface) > 0.5) return false;
    const map = world.map;
    const tx = Math.floor(x / GAME.tile);
    for (let dx = -1; dx <= 1; dx++) {
      if (!map.isSolidAt(tx + dx, map.surfaceRow)) return false;
    }
    return true;
  }

  findGround(world, x, referenceY = world.surface) {
    const top = Math.min(world.height - 2, Math.floor(referenceY / GAME.tile) + 14);
    return world.map.getGroundYAtWorld(x, top * GAME.tile);
  }

  triggerEvent(phase) {
    if (!phase.events.length) return;
    const type = this.rng.pick(phase.events);
    const config = DIFFICULTY.events[type];
    if (!config) return;
    this.event = {
      type,
      timer: config.duration,
      budgetMultiplier: config.budgetMultiplier,
      maxAdd: config.maxAdd,
      eliteBonus: config.eliteBonus ?? 0,
    };
    this.game.ui?.toast(config.nameKey, {}, { icon: '☠', achievement: true });
    this.game.audio.play(type === 'surge' ? 'boss' : 'elite');
    if (type === 'elite_pack') {
      this.spawnElitePack(phase);
    } else if (type === 'ambush') {
      this.spawnAmbush(phase, 4);
    }
  }

  spawnAmbush(phase, count) {
    for (let i = 0; i < count; i++) {
      const enemyId = this.pickEnemy(phase);
      if (!enemyId) continue;
      const position = this.findSpawnPosition(enemyId, phase);
      if (position) this.game.spawnEnemy(enemyId, position.x, position.y, {
        health: phase.hpScale,
        damage: phase.damageScale,
        speed: phase.speedScale,
      });
    }
  }

  spawnElitePack(phase) {
    const count = 2 + this.rng.int(0, 2);
    for (let i = 0; i < count; i++) {
      const enemyId = this.pickElite(phase);
      if (!enemyId) continue;
      const position = this.findSpawnPosition(enemyId, phase);
      if (position) this.game.spawnEnemy(enemyId, position.x, position.y, {
        health: phase.hpScale,
        damage: phase.damageScale,
        speed: phase.speedScale,
        elite: true,
      });
    }
  }
}
