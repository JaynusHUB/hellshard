import { GAME } from '../config/game.js';
import { RNG, combineSeed } from '../core/RNG.js';
import { COLORS } from '../render/ParticleSystem.js';

const DEATH_COLORS = {
  bone: COLORS.bone,
  ember: COLORS.ember,
  soul: COLORS.soul,
  fire: COLORS.ember,
  frost: COLORS.frost,
  venom: COLORS.venom,
  mud: COLORS.mud,
  shadow: COLORS.shadow,
};

export class CombatSystem {
  constructor({ game, particles, glowParticles, audio, ui }) {
    this.game = game;
    this.particles = particles;
    this.glowParticles = glowParticles;
    this.audio = audio;
    this.ui = ui;
    this.rng = new RNG(combineSeed(game.seed ?? 1, 'combat'));
  }

  setSeed(seed) {
    this.rng = new RNG(combineSeed(seed, 'combat'));
  }

  damageEnemy(enemy, rawDamage, options = {}) {
    if (!enemy || enemy.dead || !enemy.isDamageable) return 0;
    const player = this.game.player;
    if (!player) return 0;
    const crit = options.crit ?? this.rng.chance(player.stats.critChance);
    const damage = Math.max(1, rawDamage * (crit ? player.stats.critDamage : 1));
    const actual = enemy.takeHit(damage, {
      direction: options.direction ?? (Math.sign(enemy.x - (options.sourceX ?? player.x)) || 1),
      knockback: (options.knockback ?? 60) * (crit ? 1.3 : 1),
      crit,
      game: this.game,
      element: options.element ?? 'physical',
    });
    if (actual > 0) {
      if (this.game.player.evolved && this.game.player.characterId === 'brakk') {
        this.game.player.heal(actual * 0.075);
      }
      this.onHitFeedback(enemy, actual, crit, options);
      if (options.noHitstop !== true) {
        const frames = crit
          ? GAME.combat.hitstopCrit
          : options.heavy
            ? GAME.combat.hitstopHeavy
            : GAME.combat.hitstopNormal;
        this.game.addHitstop(frames);
      }
    }
    return actual;
  }

  onHitFeedback(enemy, damage, crit, options) {
    const isFrost = options.element === 'frost';
    const primary = isFrost ? COLORS.frost : enemy.def.deathEffect === 'shadow' ? COLORS.shadow : COLORS.gold;
    const y = options.sourceY ?? enemy.y + Math.min(enemy.height * 0.6, 22);
    const x = options.sourceX ?? enemy.x - Math.sign(enemy.x - (this.game.player?.x ?? 0)) * 4;
    this.glowParticles.emit({
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.09,
      sizeX: crit ? 15 : 10,
      sizeY: crit ? 15 : 10,
      endSize: 0,
      color: crit ? COLORS.white : primary,
      alpha: 0.85,
    });
    this.particles.burst([primary, COLORS.bone, COLORS.white], x, y, crit ? 16 : 8, {
      speed: crit ? 105 : 70,
      spread: Math.PI * 2,
      life: crit ? 0.42 : 0.28,
      gravity: 240,
      drag: 1.2,
      size: crit ? 2.6 : 2,
      radius: 5,
    });
    this.glowParticles.burst([primary, COLORS.white], x, y, crit ? 12 : 5, {
      speed: crit ? 130 : 75,
      spread: Math.PI * 2,
      life: 0.22,
      gravity: 20,
      drag: 3,
      size: 1.5,
    });
    this.game.camera.addShake(crit ? 3.4 : options.heavy ? 2.4 : 1.2);
    this.ui?.spawnDamageNumber(
      enemy.x + (Math.random() - 0.5) * 8,
      enemy.y + enemy.height,
      Math.round(damage),
      crit ? 'crit' : 'normal',
    );
    this.audio.play(crit ? 'crit' : 'hit', { pitch: 0.9 + Math.random() * 0.22 });
  }

  damagePlayer(amount, source = null, options = {}) {
    const player = this.game.player;
    if (!player || player.dead) return 0;
    const before = player.health;
    const actual = player.takeDamage(amount, source);
    if (actual > 0) {
      const direction = source ? Math.sign(player.x - source.x) || 1 : 1;
      player.vx = direction * GAME.player.knockbackX;
      player.vy = Math.max(player.vy, GAME.player.knockbackY);
      this.game.camera.addShake(options.heavy ? 4.5 : 2.6);
      this.game.addHitstop(2);
      if (this.game.boss && !this.game.boss.dead) this.game.bossDamageTaken += actual;
    }
    return { actual, before };
  }

  areaDamage(x, y, radius, damage, options = {}) {
    const game = this.game;
    if (!game.spatialHash) return;
    let hitCount = 0;
    let anyCrit = false;
    game.spatialHash.query(x - radius, y - radius, radius * 2, radius * 2, (index) => {
      if (options.exclude?.has(index)) return;
      const enemy = game.enemies[index];
      if (!enemy || enemy.dead) return;
      const dx = enemy.x - x;
      const dy = enemy.y + enemy.height / 2 - y;
      if (dx * dx + dy * dy > (radius + enemy.width * 0.5) ** 2) return;
      const before = enemy.health;
      const dealt = this.damageEnemy(enemy, damage, {
        ...options,
        noHitstop: true,
        sourceX: x,
        sourceY: y,
      });
      if (dealt > 0 && before > 0) {
        hitCount++;
        anyCrit = anyCrit || enemy.flashTimer > 0;
      }
    });
    if (hitCount > 0) {
      game.addHitstop(anyCrit ? GAME.combat.hitstopCrit : GAME.combat.hitstopHeavy);
      game.camera.addShake(2.2 + Math.min(3, hitCount * 0.25));
      this.glowParticles.burst([COLORS.frost, COLORS.violet ?? COLORS.shadow, COLORS.white], x, y, 12 + hitCount * 2, {
        speed: 140,
        spread: Math.PI * 2,
        life: 0.35,
        gravity: 0,
        drag: 2.2,
        size: 2,
      });
    }
  }

  enemyDeath(enemy) {
    const frame = enemy.animator.frame;
    const family = this.game.assets.getSpriteAtlas(enemy.sprite ?? enemy.data?.sprite);
    const palette = this.game.assets.getPalette(family, frame, 8);
    const effectColor = DEATH_COLORS[enemy.def.deathEffect] ?? COLORS.bone;
    const x = enemy.x;
    const y = enemy.y + enemy.height * 0.55;
    const base = [...palette, effectColor];
    if (enemy.def.deathEffect === 'soul' || enemy.def.deathEffect === 'frost') {
      this.glowParticles.burst(base, x, y, 24, {
        speed: 55,
        spread: Math.PI,
        direction: Math.PI / 2,
        life: 0.8,
        gravity: -18,
        drag: 1.5,
        size: 2.5,
        endSize: 0.5,
      });
    } else if (enemy.def.deathEffect === 'ember' || enemy.def.deathEffect === 'fire') {
      this.glowParticles.burst(base, x, y, 30, {
        speed: 130,
        spread: Math.PI * 2,
        life: 0.6,
        gravity: 80,
        drag: 1.8,
        size: 2.7,
        endSize: 0.4,
      });
    } else if (enemy.def.deathEffect === 'venom' || enemy.def.deathEffect === 'mud') {
      this.particles.burst(base, x, y, 28, {
        speed: 95,
        spread: Math.PI * 2,
        life: 0.65,
        gravity: 360,
        drag: 0.8,
        size: 2.2,
      });
    } else {
      this.particles.burst(base, x, y, 30, {
        speed: 110,
        spread: Math.PI * 2,
        life: 0.7,
        gravity: 330,
        drag: 0.8,
        size: 2.2,
      });
    }
    this.glowParticles.emit({
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.14,
      sizeX: 22,
      sizeY: 22,
      endSize: 0,
      color: effectColor,
      alpha: 0.6,
    });
    this.audio.play('death', { volume: enemy.elite ? 1.25 : 1 });
    this.game.camera.addShake(enemy.elite ? 4 : 1.5);
  }

  meleeArc({ x, y, facing, range, height, color, heavy }) {
    const count = heavy ? 26 : 14;
    const baseAngle = facing > 0 ? -0.6 : Math.PI + 0.6;
    const spread = facing > 0 ? 1.4 : -1.4;
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const angle = baseAngle + spread * t;
      const distance = range * (0.55 + 0.45 * Math.sin(t * Math.PI));
      this.glowParticles.emit({
        x: x + Math.cos(angle) * distance,
        y: y + 16 + Math.sin(angle) * distance * 0.55,
        vx: Math.cos(angle) * (heavy ? 45 : 22),
        vy: Math.sin(angle) * (heavy ? 35 : 18),
        gravity: 0,
        drag: 2.5,
        life: 0.16 + t * 0.08,
        sizeX: heavy ? 3 : 2,
        sizeY: heavy ? 1 : 1,
        color,
        alpha: 0.75,
      });
    }
    this.particles.burst([color, COLORS.white], x + facing * range * 0.4, y + height * 0.5, heavy ? 12 : 6, {
      speed: 80,
      spread: 1.2,
      direction: facing > 0 ? 0 : Math.PI,
      life: 0.25,
      gravity: 80,
      size: 1.5,
    });
  }

  shockwave({ x, y, color, heavy }) {
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2;
      this.glowParticles.emit({
        x,
        y: y + 12,
        vx: Math.cos(angle) * (heavy ? 150 : 100),
        vy: Math.abs(Math.sin(angle)) * 40,
        gravity: 0,
        drag: 2.2,
        life: 0.35,
        sizeX: 2,
        sizeY: 2,
        color,
        alpha: 0.7,
      });
    }
  }
}
