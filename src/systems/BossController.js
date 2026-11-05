import { BOSSES } from '../data/bosses.js';
import { Boss } from '../entities/Boss.js';
import { COLORS } from '../render/ParticleSystem.js';

export class BossController {
  constructor(game) {
    this.game = game;
  }

  checkTrigger() {
    const game = this.game;
    if (game.peaceful) return;
    const arena = game.activeWorld?.arena;
    const state = game.zoneStates[game.activeZoneId];
    if (!arena || !state || state.bossStarted || state.bossDefeated) return;
    if (!game.activeZone.boss) return;
    if (game.player.x < arena.triggerX) return;
    state.bossStarted = true;
    this.startFight();
  }

  startFight() {
    const game = this.game;
    const bossData = BOSSES[game.activeZoneId];
    const arena = game.activeWorld.arena;
    if (!bossData || !arena) return;
    game.enemies = [];
    game.projectiles.clear();
    game.bossHazards = [];
    game.bossDamageTaken = 0;
    const centerX = (arena.left + arena.right) / 2;
    const arenaFloor = arena.floorY ?? game.activeWorld.surface;
    const y = bossData.flying ? arenaFloor + 112 : arenaFloor;
    game.boss = new Boss({
      data: bossData,
      assets: game.assets,
      game,
      x: centerX,
      y,
    });
    game.enemies.push(game.boss);
    game.activeWorld.map.addBlocker(arena.left + 10, arenaFloor, 10, 260, { tag: 'arena' });
    game.activeWorld.map.addBlocker(arena.right - 20, arenaFloor, 10, 260, { tag: 'arena' });
    game.arenaGatePositions = [
      { x: arena.left + 10, y: arenaFloor },
      { x: arena.right - 20, y: arenaFloor },
    ];
    game.buildSpatialHash();
    game.camera.addShake(5);
    game.audio.play('boss');
    game.ui?.toast('boss.incoming', {}, { icon: '☠', achievement: true, duration: 2400 });
    game.prompt = null;
  }

  updateHazards(dt) {
    const game = this.game;
    for (let i = game.bossHazards.length - 1; i >= 0; i--) {
      const hazard = game.bossHazards[i];
      hazard.age += dt;
      if (hazard.age < hazard.delay) {
        if (Math.random() < 0.35) {
          game.glowParticles.emit({
            x: hazard.x + Math.random() * hazard.w,
            y: hazard.y + Math.random() * hazard.h,
            vx: 0,
            vy: 20,
            life: 0.35,
            sizeX: 1,
            sizeY: 3,
            color: COLORS.ember,
            alpha: 0.45,
          });
        }
        continue;
      }
      if (!hazard.triggered) {
        hazard.triggered = true;
        const p = game.player.getBounds();
        if (
          p.x < hazard.x + hazard.w &&
          p.x + p.w > hazard.x &&
          p.y < hazard.y + hazard.h &&
          p.y + p.h > hazard.y
        ) {
          game.combat.damagePlayer(hazard.damage, game.boss, { element: 'fire', heavy: true });
        }
        game.glowParticles.burst([COLORS.ember, COLORS.gold, COLORS.white], hazard.x + hazard.w / 2, hazard.y + 8, 30, {
          speed: 120,
          spread: Math.PI,
          direction: Math.PI / 2,
          life: 0.6,
          gravity: 260,
          drag: 1,
          size: 3,
        });
        game.camera.addShake(4);
        game.audio.play('swingHeavy');
      }
      if (hazard.age >= hazard.delay + 0.35) game.bossHazards.splice(i, 1);
    }
  }

  queueHazard(x, y, width, height, delay, damage) {
    const game = this.game;
    game.bossHazards.push({
      x: x - width / 2,
      y,
      w: width,
      h: height,
      delay,
      damage,
      age: 0,
      triggered: false,
    });
  }

  onDefeated(boss) {
    const game = this.game;
    const zoneState = game.zoneStates[game.activeZoneId];
    zoneState.bossDefeated = true;
    const def = boss.data;
    if (!game.run.bossIds.includes(def.id)) game.run.bossIds.push(def.id);
    if (!game.run.shardIds.includes(def.shard)) {
      game.run.shardIds.push(def.shard);
      game.run.shards.push(def.shard);
    }
    for (const enemy of game.enemies) {
      if (enemy !== boss && !enemy.dead && enemy.bossMinion) {
        enemy.dead = true;
        enemy.countedDeath = true;
      }
    }
    game.boss = null;
    game.bossHazards = [];
    game.arenaGatePositions = [];
    game.activeWorld.map.clearBlockers('arena');
    const chest = {
      id: `boss-chest-${def.id}`,
      type: 'chestBoss',
      x: boss.x,
      y: game.activeWorld.arena?.floorY ?? game.activeWorld.surface,
      opened: false,
    };
    if (!game.activeWorld.interactions.some((i) => i.id === chest.id)) {
      game.activeWorld.interactions.push(chest);
    }
    game.xpOrbs.spawn(40, boss.x - 10, boss.y + 16, { big: true });
    game.xpOrbs.spawn(40, boss.x + 10, boss.y + 16, { big: true });
    game.glowParticles.burst([COLORS.gold, COLORS.white, def.accent ?? COLORS.gold], boss.x, boss.y + 30, 60, {
      speed: 150,
      spread: Math.PI * 2,
      life: 1.1,
      gravity: -20,
      drag: 1.2,
      size: 3,
    });
    game.gameAchievements?.onShards(game.run.shards.length);
    game.gameAchievements?.onBoss(def.id, game.bossDamageTaken <= 0);
    game.audio.play('shard');
    const t = game.ui?.t ?? ((key) => key);
    game.ui?.toast('boss.defeated', { boss: t(def.nameKey) }, { icon: '☠', achievement: true, duration: 2600 });
    game.ui?.toast('boss.shard', {}, { icon: '◆', duration: 2600 });
    game.ui?.toast('boss.rewardChest', {}, { icon: '▣', duration: 2200 });
    if (game.run.shards.length >= 3) {
      game.ui?.toast('zone.finalGateOpen', {}, { icon: '◆', achievement: true, duration: 3000 });
    }
    game.lastRoom = -1;
    game.interactions.updatePrompt();
  }
}
