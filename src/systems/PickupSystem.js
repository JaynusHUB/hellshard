import { COLORS } from '../render/ParticleSystem.js';

/** Authored Tiled pickups: coins become XP, potions heal, keys unlock gates. */
export class PickupSystem {
  constructor(game) {
    this.game = game;
  }

  update() {
    const game = this.game;
    const world = game.activeWorld;
    const player = game.player;
    if (!world?.pickups?.length || !player || player.dead) return;
    for (const pickup of world.pickups) {
      if (pickup.collected) continue;
      const dx = pickup.x - player.x;
      const dy = (pickup.y + 6) - (player.y + player.height * 0.5);
      if (Math.abs(dx) > 18 || Math.abs(dy) > 24) continue;
      this.collect(pickup);
    }
  }

  collect(pickup) {
    const game = this.game;
    pickup.collected = true;
    if (pickup.type === 'health_potion') {
      const heal = Math.max(18, Math.round(game.player.maxHealth * 0.25));
      game.player.health = Math.min(game.player.maxHealth, game.player.health + heal);
      game.ui?.spawnDamageNumber(game.player.x, game.player.y + 28, heal, 'heal');
      game.ui?.toast('toast.heal', {}, { icon: '✚' });
      game.audio.play('ui');
      game.glowParticles.burst([COLORS.bone, COLORS.white], pickup.x, pickup.y, 14, {
        speed: 55,
        life: 0.6,
        gravity: -40,
        size: 2,
      });
      return;
    }
    if (pickup.type === 'dungeon_key') {
      game.run.flags = game.run.flags ?? {};
      game.run.flags.dungeon_key = true;
      game.ui?.toast('item.dungeonKey', {}, { icon: '⌘', achievement: true, duration: 2400 });
      game.audio.play('shard');
      game.glowParticles.burst([COLORS.gold, COLORS.white], pickup.x, pickup.y, 24, {
        speed: 80,
        life: 0.9,
        gravity: -30,
        size: 2.5,
      });
      return;
    }
    const value = Math.max(4, Math.round((pickup.value || 1) * 3));
    game.xpOrbs.spawn(value, pickup.x, pickup.y, { big: value >= 12, burst: false });
    game.audio.play('xp', { throttle: 40 });
    game.particles.burst([COLORS.gold], pickup.x, pickup.y, 4, {
      speed: 24,
      life: 0.35,
      gravity: 30,
      size: 1,
    });
  }
}
