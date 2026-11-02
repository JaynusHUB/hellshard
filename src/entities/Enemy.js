import { GAME } from '../config/game.js';
import { ANIMATION } from '../config/animations.js';
import { ENEMY_BY_ID } from '../data/enemies.js';
import { Animator } from '../render/Animator.js';
import { clamp } from '../core/RNG.js';

const BEHAVIOR_LABELS = {
  walker: 'walker',
  charger: 'charger',
  flyer: 'flyer',
  ranged: 'ranged',
  kamikaze: 'kamikaze',
  swarm: 'swarm',
  tank: 'tank',
  bouncer: 'bouncer',
  teleporter: 'teleporter',
};

export class Enemy {
  constructor(def, assets, x, y, modifiers = {}) {
    this.def = def;
    this.id = def.id;
    this.sprite = def.sprite;
    this.assets = assets;
    this.animator = new Animator(assets, def.sprite);
    this.width = def.width;
    this.height = def.height;
    this.x = x;
    this.y = y;
    this.prevX = x;
    this.prevY = y;
    this.vx = 0;
    this.vy = 0;
    this.facing = -1;
    this.elite = Boolean(def.elite);
    this.behavior = def.behavior;
    this.flying = Boolean(def.flying);
    this.visualScale = def.visualScale ?? 1;
    this.healthScale = modifiers.health ?? 1;
    this.damageScale = modifiers.damage ?? 1;
    this.speedScale = modifiers.speed ?? 1;
    this.maxHealth = Math.round(def.health * this.healthScale);
    this.health = this.maxHealth;
    this.damage = def.damage * this.damageScale;
    this.projectileDamage = (def.projectileDamage ?? def.damage) * this.damageScale;
    this.speed = def.speed * this.speedScale;
    this.state = 'spawn';
    this.stateTimer = 0.45;
    this.cooldown = 0.5 + Math.random() * 0.9;
    this.attackFired = false;
    this.flashTimer = 0;
    this.hitstun = 0;
    this.iframes = 0;
    this.dead = false;
    this.touchingPlayer = false;
    this.contactCooldown = 0;
    this.flyingPhase = Math.random() * 6;
    this.events = [];
    this.onGround = false;
    this.idlePhase = Math.random() * Math.PI * 2;
    this.hoverBaseY = y;
    this.speedMultiplier = modifiers.speed ?? 1;
    this.bounceCooldown = 0;
    this.stuckTimer = 0;
    this.pendingAttack = false;
    this.lastHitAt = -1;
    this.spatialIndex = -1;
    this.tintBase = def.tint ?? [1, 1, 1];
    this.zoneTint = modifiers.zoneTint ?? [1, 1, 1];
    this.spawnGrace = 0.15;
    this.slowTimer = 0;
    this.slowFactor = 1;
    this.hurtTimer = 0;
    this.deathTimer = 0;
    this.paletteFrame = null;
    this.playAnimation('idle', { restart: true });
  }

  get isDamageable() {
    return !this.dead && this.state !== 'spawn';
  }

  get center() {
    return { x: this.x, y: this.y + this.height / 2 };
  }

  update(dt, world, player, game) {
    if (this.dead) {
      this.deathTimer = Math.max(0, this.deathTimer - dt);
      return;
    }
    this.prevX = this.x;
    this.prevY = this.y;
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    this.flashTimer = Math.max(0, this.flashTimer - dt);
    this.iframes = Math.max(0, this.iframes - dt);
    this.spawnGrace = Math.max(0, this.spawnGrace - dt);
    this.slowTimer = Math.max(0, this.slowTimer - dt);
    if (this.slowTimer <= 0) this.slowFactor = 1;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.bounceCooldown = Math.max(0, this.bounceCooldown - dt);
    this.contactCooldown = Math.max(0, this.contactCooldown - dt);
    this.chooseAnimation();
    if (this.hitstun > 0) {
      this.hitstun -= dt;
      this.applyPhysics(dt, world);
      this.animator.update(dt);
      return;
    }
    if (this.state === 'spawn') {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) this.setState('chase');
      this.animator.update(dt);
      return;
    }
    if (this.state === 'windup') {
      this.stateTimer -= dt;
      this.vx = 0;
      if (!this.flying) this.applyPhysics(dt, world);
      if (this.stateTimer <= 0) this.beginStrike(game, player);
      this.animator.update(dt);
      return;
    }
    if (this.state === 'strike') {
      this.updateStrike(dt, world, player, game);
      this.animator.update(dt);
      return;
    }
    if (this.state === 'recover') {
      this.stateTimer -= dt;
      if (!this.flying) this.applyPhysics(dt, world);
      else this.vx *= Math.max(0, 1 - 5 * dt);
      if (this.stateTimer <= 0) {
        this.cooldown = this.def.cooldown;
        this.setState('chase');
      }
      this.animator.update(dt);
      return;
    }
    this.updateChase(dt, world, player, game);
    this.animator.update(dt);
  }

  setState(state) {
    this.state = state;
    switch (state) {
      case 'chase':
        this.stateTimer = 0;
        this.attackFired = false;
        break;
      case 'windup':
        this.stateTimer = this.def.windup;
        this.attackFired = false;
        this.playAnimation('attack', { restart: true });
        this.events.push({ type: 'windup', enemy: this });
        break;
      case 'strike':
        this.stateTimer = this.def.active;
        this.strikeHit = false;
        break;
      case 'recover':
        this.stateTimer = this.def.recover;
        break;
      default:
        break;
    }
  }

  updateChase(dt, world, player, game) {
    if (!player || player.dead) {
      this.vx *= 0.8;
      this.applyPhysics(dt, world);
      return;
    }
    const dx = player.x - this.x;
    const dy = player.y + player.height / 2 - (this.y + this.height / 2);
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    this.facing = dx >= 0 ? 1 : -1;
    if (this.behavior === 'ranged') {
      this.updateRanged(dt, world, player, dx, absDx, absDy, game);
    } else if (this.behavior === 'flyer') {
      this.updateFlyer(dt, world, player, dx, dy, absDx, absDy);
    } else if (this.behavior === 'teleporter') {
      this.updateTeleporter(dt, world, player, absDx, absDy, game);
    } else if (this.behavior === 'bouncer') {
      this.updateBouncer(dt, world, player, dx, absDx, absDy);
    } else {
      this.updateGroundChase(dt, world, player, dx, absDx, absDy);
    }
    if (this.tryAttack(player, absDx, absDy)) {
      this.setState('windup');
    }
    this.applyPhysics(dt, world);
    this.checkContactDamage(player, game);
  }

  updateGroundChase(dt, world, player, dx, absDx, absDy) {
    if (absDx > 600) {
      this.vx *= 0.8;
      return;
    }
    const desired = clamp(dx, -1, 1) * this.speed * this.slowFactor;
    this.vx += clamp(desired - this.vx, -900 * dt, 900 * dt);
    const aheadX = this.x + this.facing * (this.width / 2 + 6);
    const gap = this.behavior !== 'walker' ? false : !this.hasGroundAhead(world, aheadX);
    if (gap && this.onGround) {
      if (absDx < 150 && this.behavior !== 'tank') {
        this.vy = GAME.player.jumpSpeed * 0.72;
        this.onGround = false;
      } else {
        this.vx = 0;
      }
    }
    if (Math.abs(absDx) > 220 && this.behavior !== 'tank' && absDy < 80 && this.onGround && this.cooldown <= 0.3) {
      if (Math.random() < 0.015) {
        this.vy = GAME.player.jumpSpeed * 0.65;
      }
    }
  }

  updateRanged(dt, world, player, dx, absDx, absDy, game) {
    const preferred = this.def.preferredRange ?? 130;
    const speed = this.speed * this.slowFactor;
    if (absDx < preferred - 24) this.vx = -Math.sign(dx) * speed;
    else if (absDx > preferred + 28) this.vx = Math.sign(dx) * speed;
    else this.vx *= 0.72;
    this.facing = dx >= 0 ? 1 : -1;
    if (absDy > 64) this.vx = 0;
  }

  updateFlyer(dt, world, player, dx, dy, absDx, absDy) {
    const hoverY = player.y + player.height * 0.7 + (this.def.hoverHeight ?? 40);
    const targetX = player.x - this.facing * 12;
    const targetY = hoverY;
    const speed = this.speed * this.slowFactor;
    this.vx = clamp((targetX - this.x) * 1.2, -speed, speed);
    this.vy = clamp((targetY - this.y) * 1.1, -speed, speed);
    this.flyingPhase = (this.flyingPhase ?? Math.random() * 6) + dt;
    const bob = Math.sin(this.flyingPhase * 3 + this.idlePhase) * 10;
    this.x += this.vx * dt;
    this.y += this.vy * dt + bob * dt;
    if (this.stateTimer > 0) this.stateTimer -= dt;
    this.touchingPlayer = absDx < 22 && absDy < 34;
  }

  updateTeleporter(dt, world, player, absDx, absDy, game) {
    if (this.cooldown <= 0 && absDx < 280 && absDx > 55) {
      const targetX = player.x - Math.sign(player.x - this.x) * 36;
      this.events.push({ type: 'teleport', enemy: this, fromX: this.x, toX: targetX, y: this.y });
      this.x = targetX;
      this.cooldown = this.def.cooldown * 1.4;
      this.iframes = 0.2;
      this.events.push({ type: 'teleportArrival', enemy: this });
    }
    const dx = player.x - this.x;
    this.vx = Math.abs(dx) > 30 ? Math.sign(dx) * this.speed * this.slowFactor : 0;
  }

  updateBouncer(dt, world, player, dx, absDx, absDy) {
    this.facing = dx >= 0 ? 1 : -1;
    if (this.onGround && this.bounceCooldown <= 0 && absDx < 260) {
      this.vy = this.def.jumpSpeed ?? 220;
      this.vx = Math.sign(dx) * Math.max(this.speed, Math.abs(dx) * 0.65);
      this.onGround = false;
      this.bounceCooldown = 0.8 + Math.random() * 0.5;
    }
  }

  tryAttack(player, absDx, absDy) {
    if (this.cooldown > 0 || this.state !== 'chase') return false;
    if (this.behavior === 'flyer' && this.touchingPlayer) return false;
    const range = this.behavior === 'charger'
      ? this.def.attackRange
      : this.behavior === 'ranged'
        ? this.def.attackRange
        : this.behavior === 'kamikaze'
          ? this.def.attackRange
          : this.def.attackRange;
    if (absDx <= range && absDy <= (this.flying ? 80 : 52)) return true;
    return false;
  }

  beginStrike(game, player) {
    this.setState('strike');
    const dx = player ? player.x - this.x : this.facing;
    this.facing = dx >= 0 ? 1 : -1;
    if (this.behavior === 'charger') {
      this.vx = this.facing * this.def.chargeSpeed;
      this.events.push({ type: 'charge', enemy: this });
    } else if (this.behavior === 'flyer') {
      const dirX = player ? player.x - this.x : this.facing * 60;
      const dirY = player ? (player.y + player.height * 0.4) - (this.y + this.height * 0.5) : 0;
      const length = Math.hypot(dirX, dirY) || 1;
      this.vx = (dirX / length) * this.def.diveSpeed;
      this.vy = (dirY / length) * this.def.diveSpeed;
      this.events.push({ type: 'dive', enemy: this });
    } else if (this.behavior === 'ranged') {
      this.fireProjectile(game, player);
      this.attackFired = true;
    } else if (this.behavior === 'kamikaze') {
      this.explode(game, player);
      this.attackFired = true;
    }
  }

  updateStrike(dt, world, player, game) {
    this.stateTimer -= dt;
    if (this.behavior === 'charger') {
      this.vx = this.facing * this.def.chargeSpeed;
      this.applyPhysics(dt, world);
      if (this.onGround === false && Math.random() < 0.05) {
        // Chargers snag on gaps; avoid flying off the world.
      }
    } else if (this.behavior === 'flyer') {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.vx *= Math.max(0, 1 - 2 * dt);
      this.vy *= Math.max(0, 1 - 2 * dt);
    } else {
      this.vx *= Math.max(0, 1 - 10 * dt);
      this.applyPhysics(dt, world);
    }
    const contactAttack = this.behavior === 'charger' || this.behavior === 'flyer';
    if (contactAttack) {
      if (!this.strikeHit && player && !player.dead) {
        const hitbox = this.getAttackHitbox();
        if (this.overlapsPlayer(player, hitbox)) {
          this.strikeHit = true;
          game.combat.damagePlayer(this.damage, this, { element: this.def.deathEffect, heavy: this.behavior === 'charger' });
        }
      }
    } else if (!this.attackFired) {
      this.attackFired = true;
      const hitbox = this.getAttackHitbox();
      if (player && !player.dead && this.overlapsPlayer(player, hitbox)) {
        game.combat.damagePlayer(this.damage, this, { element: this.def.deathEffect });
      }
      if (this.behavior === 'kamikaze') {
        this.explode(game, player);
      }
    }
    if (this.stateTimer <= 0) this.setState('recover');
  }

  checkContactDamage(player, game) {
    if (!player || player.dead || this.contactCooldown > 0) return;
    if (this.state !== 'chase') return;
    if (this.behavior === 'flyer' && this.touchingPlayer) {
      game.combat.damagePlayer(this.damage * 0.8, this, { element: 'contact' });
      this.contactCooldown = 0.7;
    }
  }

  getAttackHitbox() {
    const reach = this.behavior === 'charger' || this.behavior === 'flyer' ? 22 : 16;
    const w = this.width + reach;
    return {
      x: this.facing > 0 ? this.x : this.x - w,
      y: this.y,
      w,
      h: this.height,
    };
  }

  overlapsPlayer(player, box) {
    const p = player.getBounds();
    return p.x < box.x + box.w && p.x + p.w > box.x && p.y < box.y + box.h && p.y + p.h > box.y;
  }

  fireProjectile(game, player) {
    if (!player) return;
    const sx = this.x + this.facing * 16;
    const sy = this.y + this.height * 0.55;
    const dirX = player.x - sx;
    const dirY = player.y + player.height * 0.45 - sy;
    const len = Math.hypot(dirX, dirY) || 1;
    const speed = this.def.projectileSpeed ?? 150;
    this.events.push({ type: 'cast', enemy: this });
    game.projectiles.spawnHostile({
      x: sx,
      y: sy,
      vx: (dirX / len) * speed,
      vy: (dirY / len) * speed,
      damage: this.projectileDamage,
      color: [201, 149, 235],
      sprite: this.def.projectile ?? null,
      radius: 6,
      life: 2.8,
      source: this,
    });
  }

  explode(game, player) {
    if (player) {
      const dx = player.x - this.x;
      const dy = (player.y + player.height / 2) - (this.y + this.height / 2);
      if (Math.hypot(dx, dy) < 42) {
        game.combat.damagePlayer(this.damage, this, { element: 'fire', heavy: true });
      }
    }
    this.events.push({ type: 'explode', enemy: this });
    this.die(game, { selfDestruct: true });
  }

  applyPhysics(dt, world) {
    if (this.flying) return;
    const wasGround = this.onGround;
    this.onGround = false;
    this.vy -= GAME.player.gravity * dt;
    this.vy = Math.max(this.vy, -GAME.player.maxFall);
    if (this.vx !== 0) {
      const hit = world.map.moveX(this, this.vx * dt);
      if (hit) {
        this.vx = 0;
        if (this.state === 'strike' && this.behavior === 'charger') {
          this.stateTimer = 0;
          this.setState('recover');
        }
      }
    }
    world.map.moveY(this, this.vy * dt);
    if (!this.onGround) this.onGround = world.map.checkGround(this);
    if (wasGround && !this.onGround) this.vy = Math.max(this.vy, -20);
  }

  applySlow(duration, factor = 0.5) {
    this.slowTimer = Math.max(this.slowTimer, duration);
    this.slowFactor = Math.min(this.slowFactor, factor);
  }

  hasGroundAhead(world, worldX) {
    const groundY = world.map.getGroundYAtWorld(worldX, this.y + 20);
    if (groundY === null) return false;
    return Math.abs(groundY - this.y) < 40;
  }

  takeHit(amount, options = {}) {
    if (!this.isDamageable) return 0;
    this.health -= amount;
    this.flashTimer = GAME.combat.hitFlashDuration;
    this.lastHitAt = performance.now();
    const direction = options.direction ?? 1;
    const knock = options.knockback ?? 60;
    this.vx = direction * knock;
    if (!this.flying) this.vy = Math.max(this.vy, 40);
    this.hitstun = Math.max(this.hitstun, options.hitstun ?? 0.06);
    this.hurtTimer = Math.max(this.hurtTimer, ANIMATION.enemy.hurt.duration);
    this.playAnimation('hurt', { restart: true });
    this.events.push({ type: 'hit', enemy: this, amount, crit: options.crit });
    if (this.health <= 0) {
      this.die(options.game);
      return amount;
    }
    if (!this.def.cooldown || this.state === 'chase') this.cooldown = Math.max(this.cooldown, 0.35);
    return amount;
  }

  die(game, options = {}) {
    if (this.dead) return;
    this.dead = true;
    this.state = 'dead';
    this.deathTimer = ANIMATION.enemy.death.duration;
    this.vx = 0;
    this.vy = 0;
    this.events.push({ type: 'death', enemy: this, selfDestruct: Boolean(options.selfDestruct) });
    if (game) game.onEnemyDefeated?.(this, options);
  }

  getRenderPosition(alpha) {
    return {
      x: Math.round(this.prevX + (this.x - this.prevX) * alpha),
      y: Math.round(this.prevY + (this.y - this.prevY) * alpha),
    };
  }

  getBounds() {
    return { x: this.x - this.width / 2, y: this.y, w: this.width, h: this.height };
  }

  resolveAnimation(state) {
    const chains = {
      idle: this.flying
        ? ['idle', 'float', 'walk', 'run', 'bounce']
        : ['idle', 'walk', 'run', 'bounce', 'float'],
      walk: this.flying
        ? ['float', 'idle', 'walk', 'run', 'bounce']
        : ['walk', 'run', 'bounce', 'idle', 'float'],
      attack: this.flying
        ? ['attack', 'cast', 'float', 'idle', 'walk', 'run', 'bounce']
        : ['attack', 'cast', 'walk', 'run', 'bounce', 'idle', 'float'],
      hurt: ['hurt', 'idle', 'walk', 'float', 'bounce', 'cast'],
    };
    for (const clip of chains[state] ?? []) {
      if (this.assets.getAnimation(this.sprite, clip)) return clip;
    }
    return null;
  }

  playAnimation(state, { restart = false } = {}) {
    const clip = this.resolveAnimation(state);
    if (!clip) return false;
    const timing = ANIMATION.enemy[state] ?? ANIMATION.enemy.walk;
    return this.animator.play(clip, {
      restart,
      fps: timing.fps,
      loop: timing.loop,
    });
  }

  chooseAnimation() {
    if (this.hurtTimer > 0) {
      this.playAnimation('hurt');
      return;
    }
    if (this.state === 'windup' || this.state === 'strike') {
      this.playAnimation('attack');
      return;
    }
    const moving = Math.abs(this.vx) > 6;
    this.playAnimation(moving ? 'walk' : 'idle');
  }

  consumeEvents() {
    const events = this.events.slice();
    this.events.length = 0;
    return events;
  }
}
