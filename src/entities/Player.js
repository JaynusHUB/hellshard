import { GAME } from '../config/game.js';
import { CHARACTER_BY_ID } from '../data/characters.js';
import { clamp } from '../core/RNG.js';
import { Animator } from '../render/Animator.js';
import { handleActions, pickAnim, basicAttackClip, heavyAttackClip, emitBasicStrike, emitProjectiles, emitHeavyStrike, useSpecial } from './PlayerCombat.js';

export class Player {
  constructor(characterId, assets, modifiers = {}) {
    this.character = CHARACTER_BY_ID[characterId];
    if (!this.character) throw new Error(`Unknown character: ${characterId}`);
    this.characterId = characterId;
    this.assets = assets;
    this.animator = new Animator(assets, this.character.sprite);
    this.x = 0;
    this.y = 0;
    this.prevX = 0;
    this.prevY = 0;
    this.width = GAME.player.width;
    this.height = GAME.player.height;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.onGround = false;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.dropThrough = 0;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.dashDirection = 1;
    this.iframes = 0;
    this.hurtTimer = 0;
    this.dead = false;
    this.devFly = false;
    this.immortal = false;
    this.spawnGrace = 1;
    this.specialCooldown = 0;
    this.specialActiveTimer = 0;
    this.heavyPhase = 'none';
    this.heavyTimer = 0;
    this.heavyCooldown = 0;
    this.heavyStrikeFired = false;
    this.basicCooldown = 0;
    this.basicAnimTimer = 0;
    this.attackAnim = 0;
    this.attackKind = 'ground';
    this.attackPressed = false;
    this.attackHeld = false;
    this.events = [];
    this.afterimages = [];
    this.afterimageTimer = 0;
    this.animTime = 0;
    this.rageTimer = 0;
    this.flashTimer = 0;
    this.hazardCooldown = 0;
    this.metaModifiers = modifiers;
    this.stats = this.computeStats({}, modifiers);
    this.health = this.stats.maxHealth;
    this.maxHealth = this.stats.maxHealth;
    this.enemyHitCount = 0;
    this.lastDamageAt = 0;
    this.timeAlive = 0;
    this.weaponLevel = 1;
    this.evolved = false;
    this.upgradeLevels = {};
    this.upgrades = {};
    this.magnetRange = this.character.stats.pickupMagnet;
  }

  setWorld(world) {
    this.world = world;
    this.map = world.map;
    this.animator.play('idle');
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
    this.prevX = x;
    this.prevY = y;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
  }

  computeStats(upgradeLevels, modifiers = this.metaModifiers) {
    const c = this.character;
    const base = this.stats ?? null;
    const level = this.weaponLevel ?? 1;
    const bonus = this.upgrades ?? {};
    const meta = modifiers ?? {};
    const maxHealth = c.stats.maxHealth + (bonus.maxHealthBonus ?? 0) + (meta.vitality ?? 0) * 5;
    const moveSpeed = GAME.player.walkSpeed * c.stats.moveSpeed * (1 + (bonus.moveSpeedBonus ?? 0));
    const attackSpeed = 1 + (bonus.attackSpeedBonus ?? 0);
    const critChance = Math.min(
      GAME.power.critChanceCap,
      c.stats.critChance + (bonus.critChanceBonus ?? 0),
    );
    const critDamage = c.stats.critDamage + (bonus.critDamageBonus ?? 0);
    const frostPower = 1 + (bonus.frostPower ?? 0);
    const area = 1 + (bonus.areaBonus ?? 0);
    const armor = Math.min(GAME.power.armorCap, c.stats.armor + (bonus.armorBonus ?? 0));
    const dashReduction = Math.min(GAME.power.dashCooldownReductionCap, bonus.dashCooldownReduction ?? 0);
    const projectileCount = c.weapon.style === 'projectile'
      ? Math.min(GAME.power.projectileCountCap, c.weapon.projectileCount + (bonus.projectileCountBonus ?? 0))
      : 0;
    const xpMultiplier = 1 + (bonus.xpGainBonus ?? 0) + (meta.fortune ?? 0) * 0.04;
    const magnetRange = Math.min(
      GAME.power.magnetRangeCap,
      c.stats.pickupMagnet + (bonus.magnetRangeBonus ?? 0),
    );
    const lifeOnKill = bonus.lifeOnKillBonus ?? 0;
    const damageMultiplier = (1 + (meta.edge ?? 0) * 0.03) * (1 + (level - 1) * 0.06);
    return {
      maxHealth,
      moveSpeed,
      attackSpeed,
      critChance,
      critDamage,
      frostPower,
      area,
      armor,
      dashCooldown: c.stats.dashCooldown * (1 - dashReduction),
      specialCooldown: c.stats.specialCooldown,
      projectileCount,
      xpMultiplier,
      magnetRange,
      lifeOnKill,
      damageMultiplier,
      attackCooldown: c.weapon.cooldown / attackSpeed,
      heavyCooldown: c.weapon.heavy.cooldown,
      dashIFrames: GAME.player.dashIFrames,
    };
  }

  applyProgression(upgrades, evolved, metaModifiers) {
    const oldMax = this.maxHealth;
    this.upgrades = upgrades;
    this.evolved = evolved;
    this.metaModifiers = metaModifiers ?? this.metaModifiers;
    this.stats = this.computeStats(upgrades, this.metaModifiers);
    this.maxHealth = this.stats.maxHealth;
    this.magnetRange = this.stats.magnetRange;
    if (this.maxHealth > oldMax) this.health += this.maxHealth - oldMax;
    this.health = Math.min(this.health, this.maxHealth);
  }

  setWeaponLevel(level) {
    this.weaponLevel = level;
    this.stats = this.computeStats(this.upgrades, this.metaModifiers);
  }

  update(dt, world, input) {
    if (this.dead) return;
    this.world = world;
    this.map = world.map;
    this.prevX = this.x;
    this.prevY = this.y;
    if (this.devFly) {
      this.updateDevFlight(dt, world, input);
      return;
    }
    this._wasRiding = this.ridingPlatform;
    if (this.ridingPlatform) {
      this.x += this.ridingPlatform.dx ?? 0;
      this.y += this.ridingPlatform.dy ?? 0;
    }
    this.timeAlive += dt;
    this.animTime += dt;
    this.tickTimers(dt);
    this.handleDash(input, world);
    handleActions(this, input, world);
    this.handleHorizontal(dt, input);
    this.applyGravity(dt);
    this.integrate(dt, world);
    this.checkMovingPlatforms(world);
    this.handleHazards(dt, world);
    this.chooseAnimation();
    this.animator.update(dt);
    this.updateAfterimages(dt);
  }

  updateDevFlight(dt, world, input) {
    const axis = input.getAxis();
    const vertical = (input.isDown('jump') ? 1 : 0) - (input.isDown('down') ? 1 : 0);
    const speed = GAME.dev.flySpeed;
    this.vx = axis * speed;
    this.vy = vertical * speed;
    if (axis !== 0) this.facing = axis;
    this.x = clamp(this.x + this.vx * dt, 8, world.width * GAME.tile - 8);
    this.y = clamp(this.y + this.vy * dt, 8, world.height * GAME.tile - 8);
    this.onGround = false;
    this.animTime += dt;
    this.iframes = Math.max(this.iframes, 0.2);
    this.animator.play(axis !== 0 ? 'run' : 'idle');
    this.animator.update(dt);
  }

  tickTimers(dt) {
    this.iframes = Math.max(0, this.iframes - dt);
    this.spawnGrace = Math.max(0, this.spawnGrace - dt);
    this.specialCooldown = Math.max(0, this.specialCooldown - dt);
    this.basicCooldown = Math.max(0, this.basicCooldown - dt);
    this.basicAnimTimer = Math.max(0, this.basicAnimTimer - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    this.hazardCooldown = Math.max(0, this.hazardCooldown - dt);
    this.flashTimer = Math.max(0, this.flashTimer - dt);
    this.attackAnim = Math.max(0, this.attackAnim - dt);
    if (this.heavyPhase !== 'none') this.tickHeavy(dt);
    this.rageTimer = Math.max(0, this.rageTimer - dt);
    if (this.dashCooldown <= 0 && this.dashTimer <= 0) this.afterimages.length = 0;
  }

  tickHeavy(dt) {
    this.heavyTimer -= dt;
    const heavy = this.character.weapon.heavy;
    if (this.heavyPhase === 'windup' && this.heavyTimer <= 0) {
      this.heavyPhase = 'strike';
      this.heavyTimer = 0.08;
      if (!this.heavyStrikeFired) {
        this.heavyStrikeFired = true;
        emitHeavyStrike(this);
      }
    } else if (this.heavyPhase === 'strike' && this.heavyTimer <= 0) {
      this.heavyPhase = 'recover';
      this.heavyTimer = heavy.recover ?? 0.3;
    } else if (this.heavyPhase === 'recover' && this.heavyTimer <= 0) {
      this.heavyPhase = 'none';
      this.heavyCooldown = this.stats.heavyCooldown;
    }
  }

  handleDash(input, world) {
    if (input.wasPressed('dash') && this.dashCooldown <= 0 && this.heavyPhase === 'none') {
      const axis = input.getAxis();
      this.dashDirection = axis !== 0 ? axis : this.facing;
      this.facing = this.dashDirection;
      this.dashTimer = GAME.player.dashDuration;
      this.dashCooldown = this.stats.dashCooldown;
      this.iframes = Math.max(this.iframes, GAME.player.dashIFrames);
      this.ridingPlatform = null;
      this._wasRiding = null;
      this.vy = 0;
      this.emit({ type: 'dash', x: this.x, y: this.y, direction: this.dashDirection });
      this.afterimageTimer = 0;
    }
    if (this.dashTimer > 0) {
      this.dashTimer = Math.max(0, this.dashTimer - GAME.fixedStep);
      this.vx = this.dashDirection * GAME.player.dashSpeed;
      this.vy = 0;
      this.afterimageTimer -= GAME.fixedStep;
      if (this.afterimageTimer <= 0) {
        this.afterimageTimer = 0.028;
        this.afterimages.push({
          x: this.x,
          y: this.y,
          frame: this.animator.frame,
          facing: this.facing,
          life: 0.24,
          maxLife: 0.24,
        });
        if (this.afterimages.length > 7) this.afterimages.shift();
      }
      this.emit({ type: 'dashTrail', x: this.x, y: this.y, facing: this.facing });
    }
  }

  handleHorizontal(dt, input) {
    const axis = input.getAxis();
    const isDashing = this.dashTimer > 0;
    if (isDashing) {
      if (this.map.moveX(this, this.vx * dt)) {
        this.dashTimer = 0;
        this.vx = 0;
      }
      return;
    }
    const slow = this.heavyPhase === 'windup' ? 0.18 : this.attackAnim > 0 ? 0.65 : 1;
    const target = axis * this.stats.moveSpeed * slow;
    const accel = this.onGround ? GAME.player.groundAccel : GAME.player.airAccel;
    if (axis !== 0) {
      this.facing = axis;
      this.vx += clamp(target - this.vx, -accel * dt, accel * dt);
    } else {
      const friction = this.onGround ? GAME.player.groundFriction : GAME.player.airFriction;
      if (Math.abs(this.vx) <= friction * dt) this.vx = 0;
      else this.vx -= Math.sign(this.vx) * friction * dt;
    }
    this.vx = clamp(this.vx, -this.stats.moveSpeed, this.stats.moveSpeed);
    const moveX = this.vx * dt;
    if (this.map.moveX(this, moveX)) {
      this.vx = 0;
    }
    if (input.wasPressed('jump')) this.jumpBuffer = GAME.player.jumpBuffer;
    else this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    if (this.onGround) this.coyote = GAME.player.coyoteTime;
    else this.coyote = Math.max(0, this.coyote - dt);
    if (this.jumpBuffer > 0 && this.coyote > 0) {
      this.vy = GAME.player.jumpSpeed;
      this.jumpBuffer = 0;
      this.coyote = 0;
      this.onGround = false;
      this.ridingPlatform = null;
      this._wasRiding = null;
      this.emit({ type: 'jump', x: this.x, y: this.y });
    }
    if (!input.isDown('jump') && this.vy > 0) this.vy *= GAME.player.jumpCut;
    if (input.wasPressed('jump') && input.isDown('down')) this.dropThrough = 0.15;
    this.dropThrough = Math.max(0, this.dropThrough - dt);
  }

  applyGravity(dt) {
    if (this.dashTimer > 0) return;
    this.vy -= GAME.player.gravity * dt;
    this.vy = Math.max(this.vy, -GAME.player.maxFall);
  }

  integrate(dt, world) {
    const previousOnGround = this.onGround;
    this.onGround = false;
    const dy = this.vy * dt;
    if (dy !== 0) {
      const result = this.map.moveY(this, dy);
      if (result.grounded) this.onGround = true;
    }
    if (this.dashTimer <= 0) {
      const grounded = this.map.checkGround(this);
      this.onGround = grounded;
    }
    if (!previousOnGround && this.onGround) {
      this.emit({ type: 'land', x: this.x, y: this.y, velocity: Math.abs(this.vy) });
    }
  }

  checkMovingPlatforms(world) {
    const platforms = world.movingPlatforms;
    const previous = this._wasRiding;
    this.ridingPlatform = null;
    if (!platforms?.length) return;
    const halfW = this.width / 2;
    for (const platform of platforms) {
      const top = platform.y;
      const overlapX = this.x + halfW > platform.x - platform.w / 2 + 2 &&
        this.x - halfW < platform.x + platform.w / 2 - 2;
      if (!overlapX) continue;
      const wasOnThis = previous === platform;
      if (!wasOnThis && this.vy > 0) continue;
      if (!wasOnThis && this.prevY < top - 1) continue;
      if (wasOnThis || (this.y <= top + 2 && this.y >= top - 12)) {
        this.y = top;
        this.vy = 0;
        this.onGround = true;
        this.ridingPlatform = platform;
        break;
      }
    }
  }

  handleHazards(dt, world) {
    if (this.iframes > 0 || this.spawnGrace > 0) return;
    if (world.map.rectHitsHazard(this.x - this.width / 2, this.y, this.width, this.height)) {
      if (this.hazardCooldown <= 0) {
        this.hazardCooldown = 0.8;
        this.emit({ type: 'hazardHit', x: this.x, y: this.y });
      }
    }
    if (this.y < GAME.world.fallDeathY) {
      this.emit({ type: 'fell', x: this.x, y: this.y });
    }
  }

  takeDamage(amount, source = null) {
    if (this.immortal || this.dead || this.iframes > 0 || this.spawnGrace > 0) return 0;
    const reduced = amount * (1 - this.stats.armor);
    this.health = Math.max(0, this.health - reduced);
    this.iframes = GAME.player.hurtIFrames;
    this.hurtTimer = 0.25;
    this.flashTimer = 0.14;
    this.emit({ type: 'playerHurt', x: this.x, y: this.y + this.height * 0.5, amount: reduced, source });
    if (this.health <= 0) {
      this.dead = true;
      this.emit({ type: 'playerDeath', x: this.x, y: this.y });
    }
    return reduced;
  }

  heal(amount) {
    const before = this.health;
    this.health = Math.min(this.maxHealth, this.health + amount);
    const healed = this.health - before;
    if (healed > 0.5) this.emit({ type: 'heal', x: this.x, y: this.y + 24, amount: healed });
    return healed;
  }

  onEnemyKilled() {
    if (this.rageTimer > 0) this.heal(2);
    if (this.stats.lifeOnKill > 0) this.heal(this.stats.lifeOnKill);
  }

  chooseAnimation() {
    if (!this.animator.animation) this.animator.play('idle');
    if (this.hurtTimer > 0 && this.assets.getAnimation(this.character.sprite, 'hurt')) {
      this.animator.play('hurt');
      return;
    }
    if (this.heavyPhase !== 'none' || this.attackAnim > 0) {
      if (this.characterId === 'seraphine') this.animator.play('cast');
      else if (this.characterId === 'brakk') {
        if (this.heavyPhase !== 'none') this.animator.play(heavyAttackClip(this));
        else this.animator.play(basicAttackClip(this));
      } else if (this.heavyPhase !== 'none' && this.assets.getAnimation(this.character.sprite, 'heavy')) this.animator.play('heavy');
      else this.animator.play('attack');
      return;
    }
    if (!this.onGround) {
      if (this.characterId === 'seraphine') {
        this.animator.play('idle');
      } else if (this.vy > 0) this.animator.play(pickAnim(this, 'jump', 'run'));
      else this.animator.play(pickAnim(this, 'fall', 'jump', 'run'));
      return;
    }
    if (Math.abs(this.vx) > 10) {
      this.animator.play(pickAnim(this, 'run', 'idle'));
    } else {
      this.animator.play('idle');
    }
  }

  updateAfterimages(dt) {
    for (let i = this.afterimages.length - 1; i >= 0; i--) {
      const img = this.afterimages[i];
      img.life -= dt;
      if (img.life <= 0) this.afterimages.splice(i, 1);
    }
  }

  consumeEvents() {
    const events = this.events.slice();
    this.events.length = 0;
    return events;
  }

  emit(event) {
    this.events.push(event);
  }

  getRenderPosition(alpha) {
    return {
      x: Math.round(this.prevX + (this.x - this.prevX) * alpha),
      y: Math.round(this.prevY + (this.y - this.prevY) * alpha),
    };
  }

  getCenter() {
    return { x: this.x, y: this.y + this.height / 2 };
  }

  getBounds() {
    return {
      x: this.x - this.width / 2,
      y: this.y,
      w: this.width,
      h: this.height,
    };
  }
}
