import { GAME } from '../config/game.js';
import { COLORS } from '../render/ParticleSystem.js';

export class ProjectileSystem {
  constructor({ maxProjectiles = 256, particles, glowParticles }) {
    this.maxProjectiles = maxProjectiles;
    this.particles = particles;
    this.glowParticles = glowParticles;
    this.items = new Array(maxProjectiles);
    for (let i = 0; i < maxProjectiles; i++) {
      this.items[i] = {
        active: false,
        x: 0, y: 0, prevX: 0, prevY: 0,
        vx: 0, vy: 0,
        damage: 0,
        radius: 3,
        life: 0,
        age: 0,
        owner: 'player',
        element: 'physical',
        color: COLORS.white,
        trailColor: COLORS.frost,
        pierce: 0,
        aoe: 0,
        knockback: 0,
        sprite: null,
        animTime: 0,
        source: null,
        heavy: false,
        evolved: false,
        ricochet: 0,
        hit: new Set(),
        trailTimer: 0,
        isEnemy: false,
      };
    }
    this.count = 0;
  }

  acquire() {
    for (let i = 0; i < this.maxProjectiles; i++) {
      if (!this.items[i].active) return this.items[i];
    }
    return null;
  }

  spawnPlayer(config) {
    const p = this.acquire();
    if (!p) return null;
    this.reset(p, config);
    p.owner = 'player';
    p.isEnemy = false;
    p.damage = config.damage;
    p.pierce = config.pierce ?? 0;
    p.aoe = config.aoe ?? 0;
    p.element = config.element ?? 'physical';
    p.color = config.color ?? COLORS.frost;
    p.trailColor = config.trailColor ?? p.color;
    p.knockback = config.knockback ?? 40;
    p.heavy = Boolean(config.heavy);
    p.evolved = Boolean(config.evolved);
    p.ricochet = config.ricochet ?? 0;
    p.characterId = config.characterId ?? null;
    p.speed = config.vx;
    this.items.active = true;
    return p;
  }

  spawnHostile(config) {
    const p = this.acquire();
    if (!p) return null;
    this.reset(p, config);
    p.owner = 'enemy';
    p.isEnemy = true;
    p.damage = config.damage;
    p.sprite = config.sprite ?? null;
    p.radius = config.radius ?? 6;
    p.source = config.source ?? null;
    p.color = config.color ?? COLORS.soul;
    this.spawnBurst(config.x, config.y, p.color);
    return p;
  }

  reset(p, config) {
    p.active = true;
    p.x = config.x;
    p.y = config.y;
    p.prevX = p.x;
    p.prevY = p.y;
    p.vx = config.vx;
    p.vy = config.vy ?? 0;
    p.life = config.life ?? 1;
    p.age = 0;
    p.radius = config.radius ?? 3;
    p.hit.clear();
    p.trailTimer = 0;
    p.animTime = 0;
    p.sprite = config.sprite ?? null;
    p.pierce = 0;
    p.aoe = 0;
    p.ricochet = 0;
    p.element = 'physical';
    p.color = config.color ?? COLORS.white;
    p.owner = 'player';
    p.isEnemy = false;
    p.source = null;
    p.heavy = false;
    p.evolved = false;
    p.characterId = null;
    p.knockback = 0;
  }

  update(dt, game) {
    const world = game.activeWorld;
    const player = game.player;
    const enemies = game.enemies;
    const hash = game.spatialHash;
    for (let i = 0; i < this.maxProjectiles; i++) {
      const p = this.items[i];
      if (!p.active) continue;
      p.age += dt;
      p.prevX = p.x;
      p.prevY = p.y;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.animTime += dt;
      if (p.sprite) {
        p.trailTimer -= dt;
        if (p.trailTimer <= 0) {
          p.trailTimer = 0.045;
          this.emitTrail(p, true);
        }
      } else {
        p.trailTimer -= dt;
        if (p.trailTimer <= 0) {
          p.trailTimer = 0.032;
          this.emitTrail(p, false);
        }
      }
      if (p.age >= p.life) {
        this.expire(p, game);
        continue;
      }
      if (p.x < 0 || p.x > world.width * GAME.tile || p.y < GAME.world.fallDeathY || p.y > world.height * GAME.tile) {
        p.active = false;
        continue;
      }
      if (world.map.pointHitsSolid(p.x, p.y)) {
        const tx = Math.floor(p.x / GAME.tile);
        const ty = Math.floor(p.y / GAME.tile);
        if (!p.isEnemy && world.map.getType(tx, ty) === 4) {
          game.combatDirector.breakTileAt(tx, ty, p.x, p.y);
        }
        this.impact(p, game, null);
        continue;
      }
      if (p.isEnemy) {
        if (player && !player.dead) {
          const bounds = player.getBounds();
          if (
            p.x + p.radius > bounds.x &&
            p.x - p.radius < bounds.x + bounds.w &&
            p.y + p.radius > bounds.y &&
            p.y - p.radius < bounds.y + bounds.h
          ) {
            game.combat.damagePlayer(p.damage, p.source, { element: p.element, projectile: true });
            this.impact(p, game, null);
            continue;
          }
        }
      } else if (hash) {
        const qx = p.x - p.radius;
        const qy = p.y - p.radius;
        const qw = p.radius * 2;
        const qh = p.radius * 2;
        let hitSomething = false;
        hash.query(qx, qy, qw, qh, (index) => {
          if (hitSomething) return;
          const enemy = enemies[index];
          if (!enemy || enemy.dead || p.hit.has(index)) return;
          const bounds = enemy.getBounds();
          if (
            p.x + p.radius > bounds.x &&
            p.x - p.radius < bounds.x + bounds.w &&
            p.y + p.radius > bounds.y &&
            p.y - p.radius < bounds.y + bounds.h
          ) {
            p.hit.add(index);
            game.combat.damageEnemy(enemy, p.damage, {
              direction: Math.sign(p.vx) || 1,
              knockback: p.knockback,
              element: p.element,
              critBonus: 0,
              projectile: p,
              heavy: p.heavy,
              sourceX: p.x,
              sourceY: p.y,
            });
            this.emitHit(p, p.x, p.y);
            if (p.evolved && p.characterId === 'seraphine') {
              enemy.applySlow?.(1.4, 0.45);
            }
            if (p.aoe > 0) {
              game.combat.areaDamage(p.x, p.y, p.aoe, p.damage * 0.7, {
                direction: Math.sign(p.vx) || 1,
                knockback: p.knockback * 0.5,
                element: p.element,
                exclude: p.hit,
              });
            }
            hitSomething = true;
            if (p.pierce > 0) p.pierce--;
            else p.shouldDie = true;
          }
        });
        if (p.shouldDie) {
          p.shouldDie = false;
          if (p.ricochet > 0) {
            const next = game.findNearestEnemy(p.x, p.y, 100, p.hit);
            if (next) {
              p.ricochet--;
              p.hit.clear();
              const dx = next.x - p.x;
              const dy = next.y + next.height / 2 - p.y;
              const len = Math.hypot(dx, dy) || 1;
              const speed = Math.hypot(p.vx, p.vy);
              p.vx = (dx / len) * speed;
              p.vy = (dy / len) * speed;
              continue;
            }
          }
          this.impact(p, game, null);
        }
      }
    }
  }

  emitTrail(p, fire) {
    const palette = p.isEnemy ? [COLORS.soul, COLORS.shadow] : [p.color, p.trailColor];
    const size = fire ? 2 : p.heavy ? 3 : 2;
    if (!fire) {
      const horizontal = Math.abs(p.vx) >= Math.abs(p.vy);
      this.glowParticles?.emit({
        x: p.x,
        y: p.y,
        vx: 0,
        vy: 0,
        gravity: 0,
        drag: 0,
        life: 0.06,
        sizeX: horizontal ? (p.heavy ? 9 : 7) : 2,
        sizeY: horizontal ? 2 : (p.heavy ? 9 : 7),
        color: COLORS.white,
        alpha: 0.95,
      });
    }
    this.glowParticles?.emit({
      x: p.x,
      y: p.y,
      vx: -p.vx * 0.04 + (Math.random() - 0.5) * 8,
      vy: -p.vy * 0.04 + (Math.random() - 0.5) * 8,
      gravity: 0,
      drag: 2,
      life: fire ? 0.15 : 0.22,
      sizeX: size,
      sizeY: size,
      color: palette[Math.floor(Math.random() * palette.length)],
      alpha: 0.55,
    });
    if (!fire) {
      this.particles?.emit({
        x: p.x + (Math.random() - 0.5) * 2,
        y: p.y + (Math.random() - 0.5) * 2,
        vx: -p.vx * 0.06,
        vy: (Math.random() - 0.5) * 12,
        gravity: 40,
        drag: 1.5,
        life: 0.28,
        sizeX: 1,
        sizeY: Math.random() < 0.3 ? 4 : 1,
        color: p.trailColor,
        alpha: 0.8,
      });
    }
  }

  emitHit(p, x, y) {
    this.glowParticles?.burst([p.color, COLORS.white, p.trailColor], x, y, 8, {
      speed: 65,
      spread: Math.PI * 2,
      life: 0.22,
      gravity: 20,
      drag: 3,
      size: 2,
      endSize: 0,
    });
    this.particles?.burst([p.trailColor, p.color], x, y, 4, {
      speed: 40,
      spread: Math.PI * 2,
      life: 0.32,
      gravity: 140,
      drag: 1,
      size: 1,
    });
  }

  spawnBurst(x, y, color) {
    this.glowParticles?.burst([color, COLORS.white], x, y, 6, {
      speed: 35,
      spread: Math.PI * 2,
      life: 0.2,
      gravity: 0,
      drag: 2,
      size: 1,
    });
  }

  impact(p, game, hitEnemy) {
    if (!p.active) return;
    if (p.aoe > 0 && !p.isEnemy) {
      game.combat.areaDamage(p.x, p.y, p.aoe, p.damage * 0.7, {
        direction: Math.sign(p.vx) || 1,
        knockback: p.knockback * 0.4,
        element: p.element,
        exclude: p.hit,
      });
    }
    if (p.isEnemy) {
      this.glowParticles?.burst([p.color, COLORS.soul], p.x, p.y, 6, {
        speed: 40, life: 0.25, gravity: 30, drag: 1, size: 2,
      });
    }
    p.active = false;
  }

  expire(p, game) {
    if (p.aoe > 0 && !p.isEnemy) {
      game.combat.areaDamage(p.x, p.y, p.aoe, p.damage * 0.7, {
        direction: Math.sign(p.vx) || 1,
        knockback: p.knockback * 0.4,
        element: p.element,
        exclude: p.hit,
      });
    }
    p.active = false;
  }

  render(batch, assets, alpha) {
    for (const p of this.items) {
      if (!p.active || !p.sprite) continue;
      const anim = assets.getAnimation(p.sprite, 'fly');
      if (!anim) continue;
      const frame = anim.frames[Math.floor((p.animTime * anim.fps) % anim.frames.length)];
      const x = Math.round(p.prevX + (p.x - p.prevX) * alpha);
      const y = Math.round(p.prevY + (p.y - p.prevY) * alpha);
      batch.draw(frame, x, y, {
        anchorY: 0.5,
        anchorX: 0.5,
        tint: p.isEnemy ? [1.25, 0.8, 1.4] : [1.2, 1.2, 1.3],
      });
    }
  }

  getActiveCount() {
    let count = 0;
    for (const p of this.items) if (p.active) count++;
    return count;
  }

  clear() {
    for (const p of this.items) p.active = false;
  }
}
