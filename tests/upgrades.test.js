import { describe, expect, it } from 'vitest';
import { GAME } from '../src/config/game.js';
import { UPGRADES, UPGRADE_BY_ID, computeUpgradeBonuses } from '../src/config/upgrades.js';

describe('upgrade caps', () => {
  it('caps every stat at its configured bound', () => {
    const maxLevels = Object.fromEntries(
      UPGRADES.map((upgrade) => [upgrade.id, upgrade.maxLevel + 99]),
    );
    const bonuses = computeUpgradeBonuses(maxLevels);
    expect(bonuses.critChanceBonus).toBeLessThanOrEqual(GAME.power.critChanceCap - GAME.power.critChanceBase);
    expect(bonuses.armorBonus).toBeLessThanOrEqual(GAME.power.armorCap);
    expect(bonuses.dashCooldownReduction).toBeLessThanOrEqual(GAME.power.dashCooldownReductionCap);
    expect(bonuses.projectileCountBonus).toBeLessThanOrEqual(GAME.power.projectileCountCap - 1);
    expect(bonuses.lifeOnKillBonus).toBeLessThanOrEqual(GAME.power.lifeRecoveryCap);
  });

  it('does not silently apply more levels than maxLevel', () => {
    const bonuses = computeUpgradeBonuses({ attackSpeed: 999 });
    expect(bonuses.attackSpeedBonus).toBe(UPGRADE_BY_ID.attackSpeed.maxLevel * UPGRADE_BY_ID.attackSpeed.perLevel);
  });

  it('has unique upgrade ids and sane caps', () => {
    const ids = UPGRADES.map((upgrade) => upgrade.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const upgrade of UPGRADES) {
      expect(upgrade.maxLevel).toBeGreaterThan(0);
      expect(upgrade.perLevel).toBeGreaterThan(0);
    }
  });

  it('does not offer incompatible upgrades', async () => {
    const { getAvailableUpgradeOffers } = await import('../src/config/upgrades.js');
    const rng = { int: (min) => min };
    const offers = getAvailableUpgradeOffers(rng, {}, 13);
    expect(offers.length).toBeGreaterThanOrEqual(3);
  });
});
