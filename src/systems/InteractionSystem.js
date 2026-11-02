import { GAME } from '../config/game.js';
import { ZONES } from '../data/zones.js';
import { COLORS } from '../render/ParticleSystem.js';

export class InteractionSystem {
  constructor(game) {
    this.game = game;
  }

  updateCheckpoint() {
    const game = this.game;
    const roomWidth = GAME.world.roomWidth * GAME.tile;
    const roomIndex = Math.floor(game.player.x / roomWidth);
    const room = game.activeWorld.rooms?.[roomIndex];
    if (!room || roomIndex === game.lastRoom) return;
    game.lastRoom = roomIndex;
    if (game.activeWorld.arena && !game.zoneStates[game.activeZoneId]?.bossDefeated) {
      return;
    }
    game.run.checkpoint = {
      x: Math.max(32, room.start * GAME.tile + 24),
      y: game.activeWorld.surface,
    };
  }

  updatePrompt() {
    const game = this.game;
    if (!game.player || !game.activeWorld) {
      game.currentInteraction = null;
      game.prompt = null;
      return;
    }
    const px = game.player.x;
    const py = game.player.y + game.player.height * 0.5;
    const candidates = [];
    for (const interaction of game.activeWorld.interactions) {
      if (!interaction.opened) candidates.push(interaction);
    }
    for (const transition of game.activeWorld.transitions) candidates.push(transition);
    if (game.activeWorld.finalGate) candidates.push(game.activeWorld.finalGate);
    let nearest = null;
    let bestDistance = GAME.interaction.promptRange;
    for (const candidate of candidates) {
      const dx = candidate.x - px;
      const dy = (candidate.y + 12) - py;
      const distance = Math.hypot(dx, dy);
      if (distance < bestDistance) {
        bestDistance = distance;
        nearest = candidate;
      }
    }
    game.currentInteraction = nearest;
    if (!nearest) {
      game.prompt = null;
      return;
    }
    const t = game.ui?.t ?? ((key) => key);
    let text = t('action.openChest');
    if (nearest.type === 'altar') text = t('action.touchAltar');
    else if (nearest.type === 'finalGate') text = t('action.enterGate');
    else if (nearest.type === 'chestBoss') text = t('action.openChest');
    else if (nearest.target) {
      const targetZone = ZONES[nearest.target];
      if (nearest.labelKey === 'zone.return') {
        text = t('zone.return', { zone: t(targetZone.nameKey) });
      } else {
        text = t('action.usePortal', { zone: t(targetZone.nameKey) });
      }
    }
    game.prompt = { text };
  }

  interactWith(interaction) {
    const game = this.game;
    if (!interaction) return;
    if (interaction.type === 'finalGate') {
      if (game.run.shards.length >= interaction.requiresShards) {
        game.audio.play('shard');
        game.endRun('victory');
      } else {
        game.ui?.toast('zone.finalGateLocked', {}, { icon: '◆' });
        game.audio.play('empty');
      }
      return;
    }
    if (interaction.type === 'altar') {
      this.useAltar(interaction);
      return;
    }
    if (interaction.type === 'chest' || interaction.type === 'chestBoss') {
      this.openChest(interaction);
      return;
    }
    if (interaction.target) {
      const state = game.zoneStates[game.activeZoneId];
      if (interaction.requiresBoss && !state?.bossDefeated) {
        game.ui?.toast('zone.sealed', {}, { icon: '▣' });
        game.audio.play('empty');
        return;
      }
      this.startTransition(interaction.target, interaction.id);
    }
  }

  openChest(interaction) {
    const game = this.game;
    if (interaction.opened) return;
    interaction.opened = true;
    game.run.chestsOpened += 1;
    game.gameAchievements?.onChest(game.run.chestsOpened);
    const guaranteed = interaction.type === 'chestBoss' || interaction.secret;
    const reward = game.progression.grantChestReward(guaranteed);
    game.audio.play('chest');
    game.camera.addShake(1.2);
    game.glowParticles.burst([COLORS.gold, COLORS.white], interaction.x, interaction.y + 14, 20, {
      speed: 80,
      spread: Math.PI * 2,
      life: 0.8,
      gravity: -50,
      drag: 1.4,
      size: 2,
    });
    if (reward.type === 'upgrade') {
      game.ui?.toast(reward.data.nameKey, {}, { icon: reward.data.icon, achievement: true });
    } else if (reward.type === 'xp') {
      game.xpOrbs.spawn(reward.amount, interaction.x, interaction.y + 12, { big: true });
      game.ui?.toast('toast.chest', {}, { icon: '✦' });
    } else {
      game.ui?.toast('toast.heal', {}, { icon: '✚' });
    }
  }

  useAltar(interaction) {
    const game = this.game;
    if (interaction.used) {
      game.ui?.toast('toast.nothing');
      return;
    }
    const cost = Math.ceil(game.player.maxHealth * 0.2);
    if (game.player.health <= cost + 1) {
      game.ui?.toast('toast.altarFull', {}, { icon: '✚' });
      return;
    }
    interaction.used = true;
    game.player.health -= cost;
    game.player.flashTimer = 0.2;
    game.ui?.spawnDamageNumber(game.player.x, game.player.y + 28, cost, 'player');
    const reward = game.progression.grantChestReward(true);
    game.audio.play('ability');
    game.camera.addShake(3);
    game.glowParticles.burst([COLORS.blood, COLORS.ember], interaction.x, interaction.y + 14, 24, {
      speed: 110,
      life: 0.6,
      gravity: 40,
      size: 2.5,
    });
    game.ui?.toast('toast.altar', {}, { icon: '☩' });
    if (reward.type === 'upgrade') game.ui?.toast(reward.data.nameKey, {}, { icon: reward.data.icon });
  }

  startTransition(targetZoneId, gateId = null) {
    const game = this.game;
    if (game.state !== 'playing') return;
    game.state = 'transition';
    game.transition = { target: targetZoneId, gateId, timer: 0.7, duration: 0.7 };
    game.ui?.clearToasts?.();
    game.ui?.setFade(true);
    game.audio.play('gate');
    game.audio.stopAmbient();
  }

  updateTransition(dt) {
    const game = this.game;
    if (!game.transition) return;
    game.transition.timer -= dt;
    if (game.transition.timer > 0) return;
    const target = game.transition.target;
    game.transition = null;
    this.performTransition(target);
    game.ui?.setFade(false);
    game.state = 'playing';
    game.input.clear();
  }

  performTransition(targetZoneId) {
    const game = this.game;
    const targetWorld = game.worlds[targetZoneId];
    if (!targetWorld) return;
    const sourceZoneId = game.activeZoneId;
    game.enemies.length = 0;
    game.projectiles.clear();
    game.xpOrbs.clear();
    game.traps = [];
    game.particles.clear();
    game.glowParticles.clear();
    game.bossHazards = [];
    game.boss = null;
    game.arenaGatePositions = [];
    const reciprocal = targetWorld.transitions.find((tr) => tr.target === sourceZoneId);
    let spawn = targetWorld.spawn;
    if (reciprocal) {
      const inward = reciprocal.x < targetWorld.width * GAME.tile * 0.5 ? 76 : -76;
      spawn = { x: reciprocal.x + inward, y: targetWorld.surface };
    }
    game.setZone(targetZoneId, spawn);
    game.zoneStates[targetZoneId].seen = true;
    if (!game.save.meta.seenZones.includes(targetZoneId)) {
      game.save.meta.seenZones.push(targetZoneId);
      game.save.saveMeta();
    }
    game.player.facing = spawn.x < targetWorld.width * GAME.tile * 0.5 ? 1 : -1;
    game.player.setPosition(spawn.x, spawn.y);
    game.run.checkpoint = { ...spawn };
    game.spawnDirector.reset(game.seed, targetZoneId);
    game.spatialHash = null;
    game.lastRoom = -1;
    game.ui?.setZoneTheme(game.activeZone);
    game.ui?.toast('zone.entered', { zone: game.ui.t(game.activeZone.nameKey) }, { duration: 1600 });
    game.audio.startAmbient(targetZoneId);
    game.snapCameraToPlayer();
    this.updatePrompt();
  }
}
