import { GAME } from '../config/game.js';
import { COLORS } from '../render/ParticleSystem.js';

export class CombatDirector {
  constructor(game) {
    this.game = game;
  }

  update(enemy, dt) {
    if (!enemy.dead) enemy.update(dt, this.game.activeWorld, this.game.player, this.game);
  }

  handleEnemyEvents(events) {
    const game = this.game;
    for (const event of events) {
      switch (event.type) {
        case 'windup': {
          const enemy = event.enemy;
          const color = enemy.behavior === 'ranged' ? COLORS.shadow : COLORS.ember;
          game.glowParticles.burst([color, COLORS.white], enemy.x, enemy.y + enemy.height + 4, 5, {
            speed: 18,
            spread: Math.PI,
            direction: Math.PI / 2,
            life: 0.45,
            gravity: -10,
            size: 1.6,
          });
          if (enemy.elite) game.audio.play('elite', { throttle: 350 });
          break;
        }
        case 'charge':
        case 'dive':
          game.audio.play('swingHeavy');
          game.particles.burst([COLORS.bone, COLORS.ember], event.enemy.x, event.enemy.y + 4, 8, {
            speed: 50,
            spread: 1.4,
            direction: -event.enemy.facing,
            life: 0.3,
            gravity: 20,
            size: 1.5,
          });
          break;
        case 'cast':
          game.glowParticles.burst([COLORS.shadow, COLORS.soul], event.enemy.x, event.enemy.y + 20, 7, {
            speed: 30,
            life: 0.3,
            gravity: -5,
            size: 2,
          });
          break;
        case 'teleport':
          game.glowParticles.burst([COLORS.shadow, COLORS.soul], event.fromX, event.enemy.y + 16, 12, {
            speed: 60,
            life: 0.35,
            gravity: 0,
            size: 2,
          });
          game.glowParticles.burst([COLORS.shadow, COLORS.soul], event.toX, event.enemy.y + 16, 12, {
            speed: 60,
            life: 0.35,
            gravity: 0,
            size: 2,
          });
          break;
        case 'explode':
          game.camera.addShake(4);
          game.glowParticles.burst([COLORS.ember, COLORS.blood, COLORS.gold], event.enemy.x, event.enemy.y + 14, 28, {
            speed: 150,
            life: 0.5,
            gravity: 80,
            size: 3,
          });
          break;
        case 'roar':
        case 'fightStart':
          game.camera.addShake(event.type === 'roar' ? 4 : 1.5);
          if (event.type === 'roar') game.audio.play('boss');
          break;
        case 'telegraph': {
          const boss = event.boss;
          game.glowParticles.burst(
            [event.color ?? COLORS.ember, COLORS.blood, COLORS.white],
            boss.x,
            boss.y + boss.height * 0.8,
            14,
            {
              speed: 55,
              spread: Math.PI,
              direction: Math.PI / 2,
              life: 0.55,
              gravity: -20,
              drag: 1.5,
              size: 2,
            },
          );
          break;
        }
        case 'lunge':
        case 'dive':
          game.audio.play('swingHeavy');
          break;
        case 'slam':
          game.camera.addShake(4);
          game.audio.play('hit', { pitch: 0.7 });
          break;
        case 'phase':
          game.camera.addShake(6);
          game.ui?.toast('boss.phase', { phase: event.phase }, { icon: '◆', achievement: true, duration: 2200 });
          game.glowParticles.burst([event.boss.data.accent, COLORS.white], event.boss.x, event.boss.y + 30, 30, {
            speed: 150,
            life: 0.7,
            gravity: 0,
            drag: 1.4,
            size: 3,
          });
          break;
        case 'pillars':
          game.audio.play('ability');
          break;
        case 'summon':
          game.glowParticles.burst([COLORS.shadow, COLORS.soul], event.boss.x, event.boss.y + 20, 20, {
            speed: 80,
            life: 0.6,
            gravity: 0,
            size: 2,
          });
          break;
        case 'blink':
          game.glowParticles.burst([COLORS.shadow, COLORS.soul], event.fromX, event.boss.y + 20, 15, {
            speed: 80,
            life: 0.4,
            gravity: 0,
            size: 2,
          });
          break;
        default:
          break;
      }
    }
  }

  handlePlayerEvents(events) {
    const game = this.game;
    for (const event of events) {
      switch (event.type) {
        case 'fell':
          game.respawnFromFall();
          break;
        case 'hazardHit':
          game.player.takeDamage(14, { type: 'hazard' });
          game.audio.play('playerHurt');
          break;
        case 'playerHurt':
          game.run.damageTaken += event.amount;
          game.ui?.flashHurt(game.player.health < game.player.maxHealth * 0.25);
          game.audio.play('playerHurt');
          game.ui?.spawnDamageNumber(game.player.x, game.player.y + 28, Math.round(event.amount), 'player');
          game.camera.addShake(2.5);
          break;
        case 'playerDeath':
          game.audio.play('death');
          game.camera.addShake(5);
          break;
        case 'jump':
          game.audio.play('jump');
          break;
        case 'land':
          if (event.velocity > 250) game.camera.addShake(0.8);
          break;
        case 'dash':
          game.audio.play('dash');
          game.camera.addShake(1.2);
          break;
        case 'dashTrail':
          if (Math.random() < 0.4) {
            game.glowParticles.emit({
              x: event.x - event.facing * 8,
              y: event.y + 12,
              vx: -event.facing * 18,
              vy: 2,
              gravity: 0,
              drag: 3,
              life: 0.24,
              sizeX: 3,
              sizeY: 2,
              color: game.player.character.accent,
              alpha: 0.35,
            });
          }
          break;
        case 'spawnProjectile':
          game.projectiles.spawnPlayer({ ...event, source: game.player });
          break;
        case 'meleeStrike':
          this.resolveMelee(event);
          break;
        case 'burst':
          game.combat.areaDamage(event.x, event.y, event.radius, event.damage, {
            direction: event.facing ?? 1,
            knockback: 120,
            element: event.element,
            heavy: event.heavy,
          });
          game.combat.shockwave({ x: event.x, y: event.y, color: event.color, heavy: event.heavy });
          game.camera.addShake(event.heavy ? 3.2 : 1.8);
          game.audio.play('ability');
          break;
        case 'specialTrap':
          this.addFrostTrap(event);
          game.audio.play('ability');
          break;
        case 'shock':
          game.combat.shockwave({ x: event.x, y: event.y, color: event.color, heavy: event.heavy });
          break;
        case 'heavyTrail':
          game.particles.burst([event.color, COLORS.white], event.x + event.facing * 14, event.y + 18, 10, {
            speed: 60,
            spread: 0.8,
            direction: event.facing > 0 ? 0 : Math.PI,
            life: 0.3,
            gravity: 20,
            size: 2,
          });
          break;
        case 'castBurst':
          game.glowParticles.burst([event.color, COLORS.frost, COLORS.white], event.x, event.y, 12, {
            speed: 55,
            life: 0.35,
            gravity: 0,
            drag: 2,
            size: 2,
          });
          break;
        case 'blink':
          game.glowParticles.burst([COLORS.frost, COLORS.shadow], event.fromX, event.y, 14, {
            speed: 65, life: 0.3, gravity: 0, size: 2,
          });
          game.glowParticles.burst([COLORS.frost, COLORS.white], event.toX, event.y, 16, {
            speed: 85, life: 0.35, gravity: 0, size: 2,
          });
          game.audio.play('blink');
          break;
        case 'rage':
          game.audio.play('ability');
          game.camera.addShake(3);
          game.glowParticles.burst([COLORS.blood, COLORS.ember], event.x, event.y + 14, 24, {
            speed: 100, life: 0.45, gravity: -20, size: 2,
          });
          break;
        case 'muzzle':
          game.audio.play('projectile');
          game.glowParticles.burst([event.color, COLORS.white], event.x, event.y, 5, {
            speed: 45,
            spread: event.facing > 0 ? 1 : Math.PI,
            direction: event.facing > 0 ? 0 : Math.PI,
            life: 0.18,
            gravity: 0,
            size: 1.5,
          });
          break;
        default:
          break;
      }
    }
  }

  resolveMelee(event) {
    const game = this.game;
    const x = event.facing > 0 ? event.x : event.x - event.range;
    const y = event.y - 2;
    const h = event.height ? event.height : game.player.height + event.arcHeight * 0.6;
    let hits = 0;
    if (game.spatialHash) {
      game.spatialHash.query(x, y, event.range, h, (index) => {
        const enemy = game.enemies[index];
        if (!enemy || enemy.dead) return;
        const bounds = enemy.getBounds();
        if (
          bounds.x < x + event.range &&
          bounds.x + bounds.w > x &&
          bounds.y < y + h &&
          bounds.y + bounds.h > y
        ) {
          const dealt = game.combat.damageEnemy(enemy, event.damage, {
            direction: event.facing,
            knockback: event.knockback,
            heavy: event.heavy,
            sourceX: event.x,
            sourceY: event.y + 16,
          });
          if (dealt > 0) hits++;
        }
      });
    }
    game.combat.meleeArc({
      x: event.x,
      y: event.y,
      facing: event.facing,
      range: event.range,
      height: h,
      color: event.color,
      heavy: event.heavy,
    });
    let broke = false;
    game.activeWorld.map.forEachTileInRect(x, y, event.range, h, (tx, ty, type) => {
      if (type === 4) {
        this.breakTileAt(tx, ty, tx * GAME.tile + GAME.tile / 2, ty * GAME.tile + 8);
        broke = true;
      }
    });
    if (broke) {
      game.addHitstop(2);
      game.audio.play('hit');
    }
    game.audio.play(event.heavy ? 'swingHeavy' : 'swing', { throttle: 30 });
    if (hits > 0) game.camera.addShake(event.heavy ? 3 : 1.2);
  }

  breakTileAt(tx, ty, hitX, hitY) {
    const game = this.game;
    const map = game.activeWorld.map;
    if (!map.breakTile(tx, ty)) return false;
    if (game.tileChunks) game.tileChunks.rebuildAtTile(tx, ty);
    for (const dy of [-1, 1]) {
      if (map.getType(tx, ty + dy) === 4) {
        map.breakTile(tx, ty + dy);
        if (game.tileChunks) game.tileChunks.rebuildAtTile(tx, ty + dy);
      }
    }
    game.particles.burst([COLORS.stone, [102, 83, 65], COLORS.bone], hitX, hitY, 12, {
      speed: 90,
      spread: Math.PI * 2,
      life: 0.55,
      gravity: 340,
      drag: 0.9,
      size: 2,
    });
    game.glowParticles.burst([COLORS.gold, COLORS.white], hitX, hitY, 5, {
      speed: 60,
      life: 0.3,
      gravity: 40,
      size: 1,
    });
    game.camera.addShake(1.8);
    return true;
  }

  addFrostTrap(event) {
    const game = this.game;
    game.traps.push({
      x: event.x,
      y: event.y,
      age: 0,
      duration: event.duration,
      damage: event.damage,
      radius: event.radius,
      tick: 0,
    });
    game.combat.areaDamage(event.x, event.y + 8, event.radius, event.damage, {
      direction: 1,
      knockback: 40,
      element: 'frost',
    });
    game.glowParticles.burst([COLORS.frost, COLORS.white], event.x, event.y + 8, 22, {
      speed: 60,
      spread: Math.PI * 2,
      life: 0.6,
      gravity: 0,
      drag: 2,
      size: 2,
    });
  }

  updateTraps(dt) {
    const game = this.game;
    for (let i = game.traps.length - 1; i >= 0; i--) {
      const trap = game.traps[i];
      trap.age += dt;
      trap.tick -= dt;
      if (trap.tick <= 0) {
        trap.tick = 0.35;
        game.glowParticles.burst([COLORS.frost, COLORS.frostDeep], trap.x, trap.y + 8, 2, {
          speed: 22,
          spread: Math.PI * 2,
          life: 0.6,
          gravity: -15,
          drag: 1,
          size: 1,
        });
      }
      if (game.spatialHash) {
        game.spatialHash.query(trap.x - trap.radius, trap.y, trap.radius * 2, 48, (index) => {
          const enemy = game.enemies[index];
          if (!enemy || enemy.dead) return;
          const dx = enemy.x - trap.x;
          if (Math.abs(dx) < trap.radius) enemy.applySlow?.(1.2, 0.45);
        });
      }
      if (trap.age >= trap.duration) {
        game.glowParticles.burst([COLORS.frost, COLORS.white], trap.x, trap.y + 8, 16, {
          speed: 80,
          life: 0.5,
          gravity: 40,
          size: 2,
        });
        game.traps.splice(i, 1);
      }
    }
  }

  onEnemyDefeated(enemy) {
    const game = this.game;
    if (enemy.countedDeath) return;
    enemy.countedDeath = true;
    game.combat.enemyDeath(enemy);
    game.run.kills += 1;
    game.xpOrbs.spawnFromEnemy(enemy.x, enemy.y + enemy.height * 0.5, enemy.def.xp);
    game.player.onEnemyKilled();
    game.gameAchievements?.onKill?.(game.run.kills);
    if (enemy.isBoss) {
      game.onBossDefeated(enemy);
      return;
    }
    if (enemy.elite) game.ui?.toast('toast.elite', {}, { icon: '✦' });
  }

  findNearestEnemy(x, y, radius, exclude = null) {
    const game = this.game;
    let best = null;
    let bestDist = radius * radius;
    for (let i = 0; i < game.enemies.length; i++) {
      if (exclude?.has(i)) continue;
      const enemy = game.enemies[i];
      if (!enemy || enemy.dead) continue;
      const dx = enemy.x - x;
      const dy = enemy.y + enemy.height / 2 - y;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        bestDist = dist;
        best = enemy;
      }
    }
    return best;
  }
}
