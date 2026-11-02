import { GAME } from '../config/game.js';
import { clamp } from '../core/RNG.js';

export class EntityRenderer {
  constructor(game) {
    this.game = game;
  }

  render(batchEntries, alpha) {
    const game = this.game;
    const families = new Map();
    for (const enemy of game.enemies) {
      if (enemy.dead) continue;
      if (Math.abs(enemy.x - game.camera.x) > GAME.internalWidth * 0.75) continue;
      const family = game.assets.getSpriteAtlas(enemy.sprite);
      if (!families.has(family)) families.set(family, []);
      families.get(family).push(enemy);
    }
    if (!families.has('gothic')) families.set('gothic', []);
    families.get('gothic').push(game.player);
    for (const [family, actors] of families) {
      const batch = batchEntries[family]?.actor;
      if (!batch || !actors.length) continue;
      batch.begin();
      actors.sort((a, b) => b.y - a.y);
      for (const actor of actors) {
        if (actor === game.player) this.drawPlayer(batch, alpha);
        else this.drawEnemy(batch, actor, alpha);
      }
      if (family === 'gothic') game.projectiles.render(batch, game.assets, alpha);
      batch.end();
    }
  }

  drawEnemy(batch, enemy, alpha) {
    if (enemy.isBoss) {
      this.drawBoss(batch, enemy, alpha);
      return;
    }
    const game = this.game;
    const frame = enemy.animator.frame;
    if (!frame) return;
    const pos = enemy.getRenderPosition(alpha);
    const zoneTint = game.assets.getPresentation().zoneTints[game.activeZoneId] ?? [1, 1, 1];
    let tint = [0, 1, 2].map((i) => (enemy.tintBase[i] ?? 1) * zoneTint[i]);
    let alphaValue = enemy.state === 'spawn' ? clamp(1 - enemy.stateTimer / 0.45, 0.15, 1) : 1;
    if (enemy.state === 'windup') {
      const pulse = 0.6 + Math.sin(game.time * 26) * 0.25;
      tint = [tint[0] * (1 + pulse * 0.5), tint[1] * (1 - pulse * 0.3), tint[2] * (1 - pulse * 0.25)];
    }
    if (enemy.slowTimer > 0) {
      tint = [tint[0] * 0.7, tint[1] * 1.08, tint[2] * 1.18];
    }
    const flash = enemy.flashTimer > 0
      ? 0.9 * (enemy.flashTimer / GAME.combat.hitFlashDuration) * (game.save.settings.flash ?? 0.75)
      : 0;
    if (enemy.elite) {
      batch.draw(frame, pos.x, pos.y, {
        anchorY: frame.anchorY ?? 1,
        flip: enemy.facing < 0,
        tint: [1.35, 1.1, 0.55],
        alpha: 0.14,
        offsetY: -2,
      });
    }
    batch.draw(frame, pos.x, pos.y, {
      anchorY: frame.anchorY ?? 1,
      flip: enemy.facing < 0,
      tint,
      flash,
      alpha: alphaValue,
    });
  }

  drawBoss(batch, boss, alpha) {
    const game = this.game;
    const frame = boss.animator.frame;
    if (!frame) return;
    const pos = boss.getRenderPosition(alpha);
    const zoneTint = game.assets.getPresentation().zoneTints[game.activeZoneId] ?? [1, 1, 1];
    const flash = boss.flashTimer > 0
      ? 0.9 * (boss.flashTimer / GAME.combat.hitFlashDuration) * (game.save.settings.flash ?? 0.75)
      : 0;
    let tint = [0, 1, 2].map((i) => (boss.tintBase[i] ?? 1) * zoneTint[i]);
    if (boss.state === 'windup') {
      const pulse = 0.55 + Math.sin(game.time * 22) * 0.25;
      tint = [tint[0] * (1 + pulse * 0.6), tint[1] * (1 - pulse * 0.35), tint[2] * (1 - pulse * 0.3)];
    }
    if (boss.id === 'drowned_choir') {
      const anim = game.assets.getAnimation('mire_wraith', 'float');
      const baseIndex = boss.animator.frameIndex;
      const offsets = [-28, 0, 28];
      offsets.forEach((offset, i) => {
        const frameIndex = (baseIndex + i * 2) % anim.frames.length;
        const ghost = anim.frames[frameIndex];
        batch.draw(ghost, pos.x + offset, pos.y + (i === 1 ? 0 : 10), {
          anchorY: ghost.anchorY ?? 1,
          flip: i === 2,
          tint: [tint[0] * (i === 1 ? 1 : 0.65), tint[1] * (i === 1 ? 1 : 0.8), tint[2]],
          flash,
          alpha: i === 1 ? 0.95 : 0.45,
        });
      });
    } else {
      batch.draw(frame, pos.x, pos.y, {
        anchorY: frame.anchorY ?? 1,
        flip: boss.facing < 0,
        tint,
        flash,
        alpha: boss.state === 'intro' ? 0.7 : 1,
      });
    }
    const aura = 0.12 + (boss.phaseIndex > 0 ? 0.08 : 0) + Math.sin(game.time * 4) * 0.03;
    batch.draw(frame, pos.x, pos.y, {
      anchorY: frame.anchorY ?? 1,
      flip: boss.facing < 0,
      tint: [tint[0] * 1.8, tint[1] * 1.5, tint[2] * 0.8],
      alpha: aura,
      offsetY: -2,
    });
  }

  drawPlayer(batch, alpha) {
    const game = this.game;
    const player = game.player;
    const pos = player.getRenderPosition(alpha);
    const frame = player.animator.frame;
    if (!frame) return;
    const zoneTint = game.assets.getPresentation().zoneTints[game.activeZoneId] ?? [1, 1, 1];
    const baseTint = player.character.tint;
    const tint = [0, 1, 2].map((i) => baseTint[i] * zoneTint[i]);
    for (const image of player.afterimages) {
      const t = image.life / image.maxLife;
      batch.draw(image.frame, Math.round(image.x), Math.round(image.y), {
        anchorY: image.frame.anchorY ?? 1,
        flip: image.facing < 0,
        tint: [0.55 * t + tint[0] * 0.2, 0.65 * t + tint[1] * 0.2, 1 * t],
        alpha: t * 0.3,
      });
    }
    const blink = player.hurtTimer > 0 && Math.floor(game.time * 22) % 2 === 0;
    if (blink) return;
    const hover = player.characterId === 'seraphine'
      ? Math.round(Math.sin(player.animTime * 3) * 1)
      : 0;
    const dashLean = player.dashTimer > 0 ? 1 : 0;
    batch.draw(frame, pos.x + dashLean * player.facing, pos.y + hover, {
      anchorY: frame.anchorY ?? 1,
      flip: player.facing < 0,
      tint,
      flash: player.flashTimer > 0
        ? 0.8 * (player.flashTimer / 0.12) * (game.save.settings.flash ?? 0.75)
        : 0,
    });
    if (player.characterId === 'brakk' && player.rageTimer > 0) {
      const aura = 0.5 + Math.sin(game.time * 10) * 0.2;
      batch.draw(frame, pos.x, pos.y + hover, {
        anchorY: frame.anchorY ?? 1,
        flip: player.facing < 0,
        tint: [1.6, 0.3, 0.2],
        alpha: aura * 0.18,
      });
    }
  }
}
