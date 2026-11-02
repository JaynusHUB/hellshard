import { GAME } from '../config/game.js';
import { ANIMATION } from '../config/animations.js';
import { Animator } from '../render/Animator.js';
import { RNG, combineSeed, clamp } from '../core/RNG.js';

export class Boss {
  constructor({ data, assets, game, x, y }) {
    this.data = data;
    this.def = {
      ...data,
      elite: true,
      cost: 0,
      xp: data.xp ?? 160,
      deathEffect: data.deathEffect ?? 'soul',
    };
    this.id = data.id;
    this.isBoss = true;
    this.assets = assets;
    this.game = game;
    this.animator = new Animator(assets, data.sprite);
    this.width = data.width;
    this.height = data.height;
    this.x = x;
    this.y = y;
    this.prevX = x;
    this.prevY = y;
    this.vx = 0;
    this.vy = 0;
    this.facing = -1;
    this.flying = Boolean(data.flying);
    this.tintBase = data.tint ?? [1, 1, 1];
    this.maxHealth = data.maxHealth;
    this.health = data.maxHealth;
    this.phaseIndex = 0;
    this.phase = data.phases[0];
    this.state = 'intro';
    this.stateTimer = 1.4;
    this.pattern = null;
    this.patternCooldown = 2.5;
    this.cooldowns = {};
    for (const pattern of this.phase.patterns) this.cooldowns[pattern] = 1.2;
    this.flashTimer = 0;
    this.iframes = 0;
    this.invuln = 0;
    this.dead = false;
    this.events = [];
    this.playAnimation(data.animation ?? 'idle');
    this.rng = new RNG(combineSeed(game.seed ?? 1, data.id));
    this.hoverPhase = Math.random() * Math.PI * 2;
    this.attackCount = 0;
    this.contactCooldown = 0;
    this.strikeHit = false;
    this.slowTimer = 0;
    this.slowFactor = 1;
    this.tintBase = data.tint ?? [1, 1, 1];
    this.active = true;
    this.events.push({ type: 'roar', boss: this });
  }

  get isDamageable() {
    return !this.dead && this.state !== 'intro' && this.invuln <= 0;
  }

  get center() {
    return { x: this.x, y: this.y + this.height / 2 };
  }

  getBounds() {
    return { x: this.x - this.width / 2, y: this.y, w: this.width, h: this.height };
  }

  getRenderPosition(alpha) {
    return {
      x: Math.round(this.prevX + (this.x - this.prevX) * alpha),
      y: Math.round(this.prevY + (this.y - this.prevY) * alpha),
    };
  }

  update(dt, world, player, game) {
    if (this.dead) return;
    this.prevX = this.x;
    this.prevY = this.y;
    this.flashTimer = Math.max(0, this.flashTimer - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.iframes = Math.max(0, this.iframes - dt);
    this.slowTimer = Math.max(0, this.slowTimer - dt);
    if (this.slowTimer <= 0) this.slowFactor = 1;
    this.contactCooldown = Math.max(0, this.contactCooldown - dt);
    this.patternCooldown = Math.max(0, this.patternCooldown - dt);
    for (const key of Object.keys(this.cooldowns)) {
      this.cooldowns[key] = Math.max(0, this.cooldowns[key] - dt);
    }
    this.animator.update(dt);
    if (this.state === 'intro') {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        this.state = 'fight';
        this.events.push({ type: 'fightStart', boss: this });
      }
      return;
    }
    this.checkPhase();
    if (this.state === 'windup') {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) this.executePattern(game, player);
      return;
    }
    if (this.state === 'active') {
      this.updateActive(dt, world, player, game);
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) this.endAttack();
      return;
    }
    if (this.state === 'recover') {
      this.stateTimer -= dt;
      this.drift(dt, world, player);
      if (this.stateTimer <= 0) {
        this.state = 'fight';
        this.playAnimation(this.data.animation ?? 'idle');
      }
      return;
    }
    if (this.state === 'fight') {
      this.drift(dt, world, player);
      if (this.patternCooldown <= 0) this.choosePattern(player);
    }
    if (this.contactCooldown <= 0 && this.overlapsPlayer(player)) {
      game.combat.damagePlayer(this.phase.damage * 0.6, this, { element: 'boss' });
      this.contactCooldown = 0.9;
    }
  }

  checkPhase() {
    const next = this.data.phases[this.phaseIndex + 1];
    if (!next) return;
    if (this.health <= this.maxHealth * next.threshold && this.state !== 'phaseChange') {
      this.phaseIndex += 1;
      this.phase = next;
      this.state = 'recover';
      this.stateTimer = 1.2;
      this.invuln = 1.2;
      this.cooldowns = {};
      for (const pattern of next.patterns) this.cooldowns[pattern] = 1;
      this.events.push({ type: 'phase', boss: this, phase: this.phaseIndex + 1 });
      this.playAnimation(this.data.attackAnimation ?? this.data.animation, { restart: true });
    }
  }

  choosePattern(player) {
    const patterns = this.phase.patterns.filter((p) => (this.cooldowns[p] ?? 0) <= 0);
    let pattern = patterns.length ? this.rng.pick(patterns) : this.rng.pick(this.phase.patterns);
    if (pattern === 'summon' || pattern === 'summon_wisps') {
      const minions = this.game.enemies.filter((e) => e.bossMinion && !e.dead).length;
      if (minions >= 4) pattern = this.rng.pick(['shockwave', 'soul_burst', 'feather_volley'].filter((p) => this.phase.patterns.includes(p))) ?? pattern;
    }
    this.pattern = pattern;
    this.state = 'windup';
    this.attackCount++;
    this.facing = player.x < this.x ? -1 : 1;
    const telegraphTime = {
      lunge: 0.65,
      double_lunge: 0.55,
      shockwave: 0.7,
      summon: 0.65,
      summon_wisps: 0.6,
      feather_volley: 0.75,
      radial_volley: 0.8,
      dive: 0.6,
      pillars: 1.0,
      soul_burst: 0.7,
      spiral_souls: 0.9,
      tidal_wave: 0.75,
      blink: 0.5,
    }[pattern] ?? 0.7;
    this.stateTimer = telegraphTime;
    this.playAnimation(this.data.attackAnimation ?? this.data.animation, { restart: true });
    this.events.push({
      type: 'telegraph',
      boss: this,
      color: this.data.accent,
      duration: telegraphTime,
    });
  }

  executePattern(game, player) {
    const pattern = this.pattern;
    this.state = 'active';
    this.stateTimer = 0.42;
    this.strikeHit = false;
    const phase = this.phase;
    if (pattern === 'lunge' || pattern === 'double_lunge') {
      this.vx = this.facing * (pattern === 'double_lunge' ? 380 : 310);
      this.stateTimer = pattern === 'double_lunge' ? 0.75 : 0.5;
      this.events.push({ type: 'lunge', boss: this });
    } else if (pattern === 'shockwave') {
      this.stateTimer = 0.25;
      this.spawnShockwaves(game, phase);
      this.events.push({ type: 'slam', boss: this, color: this.data.accent });
    } else if (pattern === 'summon') {
      this.spawnMinions(game, 'cinder_hound', 2);
      this.stateTimer = 0.4;
    } else if (pattern === 'summon_wisps') {
      this.spawnMinions(game, 'wisp', 3);
      this.stateTimer = 0.4;
    } else if (pattern === 'feather_volley') {
      this.spawnSpreadProjectiles(game, player, 5, 0.18, this.data.accent);
      this.stateTimer = 0.65;
    } else if (pattern === 'radial_volley') {
      this.spawnRadialProjectiles(game, 10, this.data.accent);
      this.stateTimer = 0.5;
    } else if (pattern === 'soul_burst' || pattern === 'spiral_souls') {
      this.spawnRadialProjectiles(game, pattern === 'spiral_souls' ? 14 : 8, '#8fe0c2', 0.55);
      this.stateTimer = 0.6;
    } else if (pattern === 'tidal_wave') {
      this.spawnTidalWave(game);
      this.stateTimer = 0.5;
    } else if (pattern === 'dive') {
      const dx = player.x - this.x;
      const dy = player.y + player.height * 0.5 - (this.y + this.height * 0.5);
      const len = Math.hypot(dx, dy) || 1;
      this.vx = (dx / len) * 300;
      this.vy = (dy / len) * 300;
      this.stateTimer = 0.55;
      this.events.push({ type: 'dive', boss: this });
    } else if (pattern === 'pillars') {
      this.stateTimer = 0.3;
      for (let i = -1; i <= 1; i++) {
        game.bossController.queueHazard(player.x + i * 74, game.activeWorld.surface, 26, 130, 0.55 + i * 0.06, phase.damage);
      }
      this.events.push({ type: 'pillars', boss: this });
    } else if (pattern === 'blink') {
      const arena = game.activeWorld.arena;
      const target = player.x < (arena.left + arena.right) / 2 ? arena.left + 120 : arena.right - 120;
      this.events.push({ type: 'blink', boss: this, fromX: this.x, toX: target });
      this.x = target;
      this.stateTimer = 0.3;
    }
    this.cooldowns[pattern] = (phase.cooldowns[pattern] ?? 4) * (0.85 + Math.random() * 0.3);
    this.playAnimation(this.data.attackAnimation ?? this.data.animation, { restart: true });
  }

  playAnimation(name, { restart = false } = {}) {
    const isAttack = name === this.data.attackAnimation || name === 'attack';
    return this.animator.play(name, {
      restart,
      fps: isAttack ? ANIMATION.boss.attackFps : ANIMATION.boss.idleFps,
    });
  }

  updateActive(dt, world, player, game) {
    if (this.flying) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.vx *= Math.max(0, 1 - 1.5 * dt);
      this.vy *= Math.max(0, 1 - 1.5 * dt);
    } else {
      this.vx *= Math.max(0, 1 - 3.2 * dt);
      this.x += this.vx * dt;
      this.applyBounds(world);
    }
    if ((this.pattern === 'lunge' || this.pattern === 'double_lunge' || this.pattern === 'dive') && !this.strikeHit) {
      if (this.overlapsPlayer(player)) {
        this.strikeHit = true;
        game.combat.damagePlayer(this.phase.damage, this, { element: 'boss', heavy: true });
        game.camera.addShake(4.5);
      }
    }
    if (this.stateTimer <= 0) {
      if (this.pattern === 'lunge' || this.pattern === 'double_lunge' || this.pattern === 'tidal_wave') {
        this.spawnShockwaves(game, this.phase);
      }
      this.endAttack();
    }
    this.applyBounds(world);
  }

  endAttack() {
    this.state = 'recover';
    this.stateTimer = 0.65 + Math.random() * 0.35;
    this.vx = 0;
    this.vy = 0;
    this.pattern = null;
    this.patternCooldown = 1.1;
    this.strikeHit = false;
    this.playAnimation(this.data.animation ?? 'idle');
  }

  drift(dt, world, player) {
    const arena = world.arena;
    if (!arena) return;
    if (player) this.facing = player.x < this.x ? -1 : 1;
    const center = (arena.left + arena.right) / 2;
    if (this.flying) {
      this.hoverPhase += dt;
      const targetX = clamp(player.x - this.facing * 40, arena.left + 60, arena.right - 60);
      const targetY = world.surface + 112 + Math.sin(this.hoverPhase * 1.2) * 22;
      this.x += clamp((targetX - this.x) * 0.5, -50, 50) * dt;
      this.y += clamp((targetY - this.y) * 0.5, -40, 40) * dt;
    } else {
      const dx = player.x - this.x;
      if (Math.abs(dx) > 70) this.x += Math.sign(dx) * this.phase.speed * dt;
      this.y = world.surface;
    }
    this.applyBounds(world);
  }

  applyBounds(world) {
    const arena = world.arena;
    if (!arena) return;
    const half = this.width / 2 + 12;
    this.x = clamp(this.x, arena.left + half, arena.right - half);
    if (this.flying) {
      this.y = clamp(this.y, world.surface + 34, world.surface + 190);
    } else {
      this.y = world.surface;
    }
  }

  overlapsPlayer(player) {
    const a = this.getBounds();
    const b = player.getBounds();
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  spawnShockwaves(game, phase) {
    const y = this.game.activeWorld.surface + 8;
    for (const direction of [-1, 1]) {
      game.projectiles.spawnHostile({
        x: this.x + direction * 20,
        y,
        vx: direction * 190,
        vy: 0,
        damage: phase.damage * 0.75,
        color: this.data.accent,
        radius: 10,
        life: 2.2,
        source: this,
        sprite: 'fireball',
      });
    }
  }

  spawnSpreadProjectiles(game, player, count, spacing, color) {
    const originX = this.x;
    const originY = this.y + this.height * 0.55;
    const baseAngle = Math.atan2(player.y + player.height * 0.4 - originY, player.x - originX);
    for (let i = 0; i < count; i++) {
      const angle = baseAngle + (i - (count - 1) / 2) * 0.13;
      game.projectiles.spawnHostile({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * 170,
        vy: Math.sin(angle) * 170,
        damage: this.phase.damage * 0.7,
        color,
        radius: 5,
        life: 3,
        source: this,
        sprite: this.game.activeZoneId === 'church' ? 'fireball' : null,
      });
    }
  }

  spawnRadialProjectiles(game, count, color, speed = 130) {
    const originY = this.y + this.height * 0.55;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + this.attackCount * 0.35;
      game.projectiles.spawnHostile({
        x: this.x,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        damage: this.phase.damage * 0.65,
        color,
        radius: 5,
        life: 3.2,
        source: this,
        sprite: null,
      });
    }
  }

  spawnTidalWave(game) {
    const y = game.activeWorld.surface + 8;
    for (let i = 0; i < 6; i++) {
      game.projectiles.spawnHostile({
        x: this.x + (i - 2.5) * 24,
        y,
        vx: this.facing * (160 + i * 8),
        vy: (i - 2.5) * 12,
        damage: this.phase.damage * 0.6,
        color: '#84d9b2',
        radius: 7,
        life: 2.5,
        source: this,
        sprite: null,
      });
    }
  }

  spawnMinions(game, enemyId, count) {
    const arena = game.activeWorld.arena;
    for (let i = 0; i < count; i++) {
      const x = arena.left + 100 + ((i * 80) % (arena.right - arena.left - 200));
      const def = game.getEnemyDef(enemyId);
      const y = def?.flying ? game.activeWorld.surface + 110 : game.activeWorld.surface;
      const enemy = game.spawnEnemy(enemyId, x, y);
      if (enemy) enemy.bossMinion = true;
    }
    this.events.push({ type: 'summon', boss: this });
  }

  takeHit(amount, options = {}) {
    if (!this.isDamageable) return 0;
    this.health -= amount;
    this.flashTimer = GAME.combat.hitFlashDuration;
    this.events.push({ type: 'hit', boss: this, amount });
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
      this.state = 'dead';
      this.active = false;
      this.events.push({ type: 'death', boss: this });
      options.game?.onEnemyDefeated?.(this, options);
    }
    return amount;
  }

  applySlow(duration, factor) {
    this.slowTimer = Math.max(this.slowTimer, duration);
    this.slowFactor = Math.min(this.slowFactor, factor);
  }

  consumeEvents() {
    const events = this.events.slice();
    this.events.length = 0;
    return events;
  }
}
