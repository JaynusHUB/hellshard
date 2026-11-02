import { describe, expect, it, vi } from 'vitest';
import { GAME } from '../src/config/game.js';
import { CombatDirector } from '../src/systems/CombatDirector.js';
import { SpawnDirector } from '../src/systems/SpawnDirector.js';

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
});
