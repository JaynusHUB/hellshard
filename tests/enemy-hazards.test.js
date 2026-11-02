import { describe, expect, it, vi } from 'vitest';
import { GAME } from '../src/config/game.js';
import { ENEMY_BY_ID } from '../src/data/enemies.js';
import { Enemy } from '../src/entities/Enemy.js';
import { CombatDirector } from '../src/systems/CombatDirector.js';
import { SpawnDirector } from '../src/systems/SpawnDirector.js';

function makeAssets() {
  const frame = { w: 16, h: 16, u0: 0, v0: 0, u1: 1, v1: 1, anchorY: 1 };
  const animation = { frames: [frame, frame], fps: 8, loop: true };
  return { getAnimation: () => animation };
}

describe('enemy hazards and spawn budget', () => {
  it('damages enemies standing on spikes using the configured multiplier', () => {
    const enemy = {
      dead: false,
      hazardCooldown: 0,
      x: 8,
      y: 8,
      width: 16,
      height: 16,
      getBounds: () => ({ x: 0, y: 0, w: 16, h: 16 }),
    };
    const damageEnemy = vi.fn();
    const game = {
      activeWorld: {
        hazards: [{ kind: 'spikes', x: 0, y: 0, w: 16, h: 16 }],
      },
      enemies: [enemy],
      combat: { damageEnemy },
    };
    const director = new CombatDirector(game);
    director.applySpikeDamage();
    expect(damageEnemy).toHaveBeenCalledOnce();
    expect(damageEnemy.mock.calls[0][1]).toBe(
      GAME.hazards.spikeDamage * GAME.hazards.enemyDamageMultiplier,
    );
    expect(enemy.hazardCooldown).toBe(GAME.hazards.enemyHitInterval);
  });

  it('refunds spawn budget when a despawn occurs', () => {
    const director = Object.create(SpawnDirector.prototype);
    director.budget = 1;
    director.refund(2);
    expect(director.budget).toBe(3);
  });

  it('damages the player with the configured spike damage', () => {
    const takeDamage = vi.fn();
    const director = new CombatDirector({
      player: { takeDamage },
      audio: { play() {} },
    });
    director.handlePlayerEvents([{ type: 'hazardHit' }]);
    expect(takeDamage).toHaveBeenCalledWith(GAME.hazards.spikeDamage, { type: 'hazard' });
  });
});

describe('enemy crowd variation', () => {
  it('varies animation phase, speed and tint per instance', () => {
    const assets = makeAssets();
    const def = ENEMY_BY_ID.bone_thrall;
    const variance = GAME.enemyAI.crowd.speedVariance;
    const enemies = Array.from({ length: 24 }, (_, index) => (
      new Enemy(def, assets, index * 10, 0)
    ));
    for (const enemy of enemies) {
      expect(enemy.speed).toBeGreaterThanOrEqual(def.speed * (1 - variance));
      expect(enemy.speed).toBeLessThanOrEqual(def.speed * (1 + variance));
      expect(enemy.animationPhase).toBeGreaterThanOrEqual(0);
      expect(enemy.animationPhase).toBeLessThan(1);
    }
    expect(new Set(enemies.map((enemy) => enemy.animationPhase)).size).toBeGreaterThan(1);
    expect(new Set(enemies.map((enemy) => enemy.speed)).size).toBeGreaterThan(1);
    expect(new Set(enemies.map((enemy) => enemy.tintBase[0])).size).toBeGreaterThan(1);
    const probe = enemies[0];
    probe.animationPhase = 0.5;
    probe.playAnimation('walk', { restart: true });
    expect(probe.animator.time).toBeGreaterThan(0);
  });

  it('caps same-type enemies inside one screen around the player', () => {
    const player = { x: 320 };
    const enemies = Array.from({ length: 3 }, (_, index) => ({
      id: 'bone_thrall',
      x: 100 + index * 40,
      dead: false,
    }));
    const director = Object.create(SpawnDirector.prototype);
    director.game = {
      player,
      enemies,
      activeZone: { enemyPool: ['bone_thrall'], elitePool: [] },
    };
    expect(director.countSameTypeOnScreen('bone_thrall')).toBe(3);
    expect(director.isTypeAtCrowdLimit('bone_thrall')).toBe(true);
    expect(director.isTypeAtCrowdLimit('wight')).toBe(false);
    expect(director.pickEnemy({ pool: ['bone_thrall'] })).toBeNull();
    enemies[0].x = -1000;
    expect(director.countSameTypeOnScreen('bone_thrall')).toBe(2);
    expect(director.isTypeAtCrowdLimit('bone_thrall')).toBe(false);
  });
});
