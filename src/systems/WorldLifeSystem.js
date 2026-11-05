import { GAME } from '../config/game.js';
import { COLORS } from '../render/ParticleSystem.js';

export class WorldLifeSystem {
  constructor(game) {
    this.game = game;
    this.ambientTimer = 0;
  }

  updateMovingPlatforms() {
    const game = this.game;
    const platforms = game.activeWorld?.movingPlatforms;
    if (!platforms?.length) return;
    const t = game.run.elapsed;
    for (const platform of platforms) {
      const offset = Math.sin(t * platform.speed + platform.phase) * platform.range;
      const nextX = platform.axis === 'x' ? platform.baseX + offset : platform.baseX;
      const nextY = platform.axis === 'y' ? platform.baseY + offset : platform.baseY;
      platform.dx = nextX - platform.x;
      platform.dy = nextY - platform.y;
      platform.x = nextX;
      platform.y = nextY;
    }
  }

  updateTriggers() {
    const game = this.game;
    const world = game.activeWorld;
    const player = game.player;
    if (!world?.triggers?.length || !player || player.dead) return;
    for (const trigger of world.triggers) {
      if (trigger.shown) continue;
      if (player.x < trigger.x || player.x > trigger.x + trigger.w) continue;
      if (player.y < trigger.y - 8 || player.y > trigger.y + trigger.h + 8) continue;
      trigger.shown = true;
      const text = trigger.textKey
        ? (game.ui?.t?.(trigger.textKey) ?? trigger.text)
        : trigger.text;
      game.ui?.toastText?.(text, { icon: '!', duration: 3200 });
      game.audio.play('ui');
    }
  }

  emitAmbient(dt) {
    const game = this.game;
    this.ambientTimer -= dt;
    if (this.ambientTimer > 0) return;
    this.ambientTimer = 0.18 + Math.random() * 0.18;
    const x = game.camera.x + (Math.random() - 0.5) * GAME.internalWidth;
    const y = game.camera.y + (Math.random() - 0.5) * GAME.internalHeight;
    let color = COLORS.ember;
    let vy = 8;
    let life = 2.6;
    if (game.activeZoneId === 'swamp') {
      color = Math.random() < 0.5 ? COLORS.venom : COLORS.gold;
      vy = Math.random() < 0.5 ? -6 : 7;
      life = 3.5;
    } else if (game.activeZoneId === 'forest') {
      color = COLORS.venom;
      vy = 5 + Math.random() * 9;
      life = 3.8;
    } else if (game.activeZoneId === 'church') {
      color = COLORS.bone;
      vy = 5;
      life = 3.4;
    } else if (game.activeZoneId === 'dungeon') {
      color = Math.random() < 0.35 ? COLORS.ember : COLORS.bone;
      vy = 3 + Math.random() * 5;
      life = 4.5;
    }
    game.glowParticles.emit({
      x,
      y,
      vx: (Math.random() - 0.5) * 9,
      vy,
      gravity: -1.5,
      drag: 0.08,
      life,
      sizeX: Math.random() < 0.12 ? 2 : 1,
      sizeY: Math.random() < 0.12 ? 2 : 1,
      color,
      alpha: 0.34,
    });
  }
}
