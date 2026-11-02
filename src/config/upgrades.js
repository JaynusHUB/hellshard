import { GAME } from './game.js';

export const UPGRADES = [
  {
    id: 'attackSpeed',
    nameKey: 'upgrade.attackSpeed.name',
    descKey: 'upgrade.attackSpeed.desc',
    icon: '⏵',
    maxLevel: 5,
    stat: 'attackSpeedBonus',
    perLevel: 0.12,
    format: 'percent',
    color: '#e4b764',
  },
  {
    id: 'critChance',
    nameKey: 'upgrade.critChance.name',
    descKey: 'upgrade.critChance.desc',
    icon: '✦',
    maxLevel: 5,
    stat: 'critChanceBonus',
    perLevel: 0.1,
    format: 'percent',
    color: '#f0d179',
  },
  {
    id: 'critDamage',
    nameKey: 'upgrade.critDamage.name',
    descKey: 'upgrade.critDamage.desc',
    icon: '✸',
    maxLevel: 5,
    stat: 'critDamageBonus',
    perLevel: 0.25,
    format: 'percent',
    color: '#f5a56d',
  },
  {
    id: 'frostPower',
    nameKey: 'upgrade.frostPower.name',
    descKey: 'upgrade.frostPower.desc',
    icon: '❄',
    maxLevel: 5,
    stat: 'frostPower',
    perLevel: 0.2,
    format: 'percent',
    color: '#9fdcff',
  },
  {
    id: 'projectileCount',
    nameKey: 'upgrade.projectileCount.name',
    descKey: 'upgrade.projectileCount.desc',
    icon: '➶',
    maxLevel: 3,
    stat: 'projectileCountBonus',
    perLevel: 1,
    format: 'flat',
    color: '#b9e4ff',
  },
  {
    id: 'areaDamage',
    nameKey: 'upgrade.areaDamage.name',
    descKey: 'upgrade.areaDamage.desc',
    icon: '◉',
    maxLevel: 5,
    stat: 'areaBonus',
    perLevel: 0.2,
    format: 'percent',
    color: '#cfadff',
  },
  {
    id: 'movementSpeed',
    nameKey: 'upgrade.movementSpeed.name',
    descKey: 'upgrade.movementSpeed.desc',
    icon: '➤',
    maxLevel: 5,
    stat: 'moveSpeedBonus',
    perLevel: 0.06,
    format: 'percent',
    color: '#9fe2be',
  },
  {
    id: 'maxHealth',
    nameKey: 'upgrade.maxHealth.name',
    descKey: 'upgrade.maxHealth.desc',
    icon: '♥',
    maxLevel: 5,
    stat: 'maxHealthBonus',
    perLevel: 20,
    format: 'flat',
    color: '#e76f75',
  },
  {
    id: 'armor',
    nameKey: 'upgrade.armor.name',
    descKey: 'upgrade.armor.desc',
    icon: '◈',
    maxLevel: 5,
    stat: 'armorBonus',
    perLevel: 0.08,
    format: 'percent',
    color: '#c3cad7',
  },
  {
    id: 'lifeRecovery',
    nameKey: 'upgrade.lifeRecovery.name',
    descKey: 'upgrade.lifeRecovery.desc',
    icon: '✚',
    maxLevel: 5,
    stat: 'lifeOnKillBonus',
    perLevel: 1,
    format: 'flat',
    color: '#b6e88f',
  },
  {
    id: 'xpGain',
    nameKey: 'upgrade.xpGain.name',
    descKey: 'upgrade.xpGain.desc',
    icon: '✧',
    maxLevel: 5,
    stat: 'xpGainBonus',
    perLevel: 0.15,
    format: 'percent',
    color: '#b7a3ff',
  },
  {
    id: 'magnetRange',
    nameKey: 'upgrade.magnetRange.name',
    descKey: 'upgrade.magnetRange.desc',
    icon: '◎',
    maxLevel: 5,
    stat: 'magnetRangeBonus',
    perLevel: 20,
    format: 'flat',
    color: '#8fe3dd',
  },
  {
    id: 'dashCooldown',
    nameKey: 'upgrade.dashCooldown.name',
    descKey: 'upgrade.dashCooldown.desc',
    icon: '⇥',
    maxLevel: 6,
    stat: 'dashCooldownReduction',
    perLevel: 0.08,
    format: 'percent',
    color: '#d9b3ff',
  },
];

export const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

export const EVOLUTIONS = {
  kael: {
    id: 'piercingGlacier',
    nameKey: 'evolution.piercingGlacier.name',
    descKey: 'evolution.piercingGlacier.desc',
    requiresUpgrade: 'frostPower',
    weaponLevel: 5,
    color: '#bdecff',
  },
  brakk: {
    id: 'bloodstorm',
    nameKey: 'evolution.bloodstorm.name',
    descKey: 'evolution.bloodstorm.desc',
    requiresUpgrade: 'lifeRecovery',
    weaponLevel: 5,
    color: '#ff6d62',
  },
  seraphine: {
    id: 'frozenNova',
    nameKey: 'evolution.frozenNova.name',
    descKey: 'evolution.frozenNova.desc',
    requiresUpgrade: 'areaDamage',
    weaponLevel: 5,
    color: '#d7b7ff',
  },
  nyx: {
    id: 'voidReaper',
    nameKey: 'evolution.voidReaper.name',
    descKey: 'evolution.voidReaper.desc',
    requiresUpgrade: 'critChance',
    weaponLevel: 5,
    color: '#b59cff',
  },
};

export function computeUpgradeBonuses(upgradeLevels) {
  const bonuses = {};
  for (const upgrade of UPGRADES) {
    bonuses[upgrade.stat] = 0;
  }
  for (const [id, level] of Object.entries(upgradeLevels)) {
    const upgrade = UPGRADE_BY_ID[id];
    if (!upgrade) continue;
    const applied = Math.min(level, upgrade.maxLevel);
    bonuses[upgrade.stat] += applied * upgrade.perLevel;
  }
  bonuses.critChanceBonus = Math.min(bonuses.critChanceBonus, GAME.power.critChanceCap - GAME.power.critChanceBase);
  bonuses.armorBonus = Math.min(bonuses.armorBonus, GAME.power.armorCap);
  bonuses.dashCooldownReduction = Math.min(
    bonuses.dashCooldownReduction,
    GAME.power.dashCooldownReductionCap,
  );
  bonuses.projectileCountBonus = Math.min(
    bonuses.projectileCountBonus,
    GAME.power.projectileCountCap - 1,
  );
  bonuses.lifeOnKillBonus = Math.min(bonuses.lifeOnKillBonus, GAME.power.lifeRecoveryCap);
  return bonuses;
}

export function getAvailableUpgradeOffers(rng, upgradeLevels, count = GAME.progression.cardCount) {
  const available = UPGRADES.filter((u) => (upgradeLevels[u.id] ?? 0) < u.maxLevel);
  const offers = [];
  const pool = [...available];
  while (offers.length < count && pool.length > 0) {
    const index = rng.int(0, pool.length - 1);
    offers.push(pool.splice(index, 1)[0]);
  }
  return offers;
}
