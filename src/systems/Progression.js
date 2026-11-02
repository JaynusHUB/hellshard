import { GAME } from '../config/game.js';
import {
  UPGRADES,
  UPGRADE_BY_ID,
  EVOLUTIONS,
  computeUpgradeBonuses,
} from '../config/upgrades.js';
import { RNG, combineSeed } from '../core/RNG.js';

export class Progression {
  constructor(game) {
    this.game = game;
    this.rng = new RNG(1);
    this.level = 1;
    this.xp = 0;
    this.xpToNext = GAME.progression.baseXpToLevel;
    this.xpEarned = 0;
    this.weaponLevel = 1;
    this.upgradeLevels = {};
    this.evolved = false;
    this.evolutionId = null;
    this.pendingLevelUps = 0;
    this.offers = [];
    this.reset(GAME.seed.default);
  }

  reset(seed, characterId = 'kael') {
    this.rng = new RNG(combineSeed(seed, 'progression', characterId));
    this.level = 1;
    this.xp = 0;
    this.xpToNext = GAME.progression.baseXpToLevel;
    this.xpEarned = 0;
    this.weaponLevel = 1;
    this.upgradeLevels = {};
    this.evolved = false;
    this.evolutionId = null;
    this.pendingLevelUps = 0;
    this.offers = [];
    this.syncRun();
  }

  get character() {
    return this.game.player?.character;
  }

  syncRun() {
    const run = this.game.run;
    if (!run) return;
    run.level = this.level;
    run.xp = this.xp;
    run.xpToNext = this.xpToNext;
    run.weaponLevel = this.weaponLevel;
    run.upgradeLevels = this.upgradeLevels;
    run.evolved = this.evolved;
    run.evolutionId = this.evolutionId;
  }

  addXp(rawAmount) {
    if (!this.game.player) return;
    const gained = Math.max(1, Math.round(rawAmount * this.game.player.stats.xpMultiplier));
    this.xp += gained;
    this.xpEarned += gained;
    this.game.run.xpEarned += gained;
    let leveled = false;
    while (this.xp >= this.xpToNext && this.level < GAME.progression.maxLevel) {
      this.xp -= this.xpToNext;
      this.level += 1;
      this.xpToNext = Math.round(GAME.progression.baseXpToLevel * Math.pow(GAME.progression.xpCurve, this.level - 1));
      this.pendingLevelUps += 1;
      leveled = true;
      if (GAME.progression.weaponLevelsAt.includes(this.level) && this.weaponLevel < 5) {
        this.weaponLevel += 1;
        this.game.player.setWeaponLevel(this.weaponLevel);
        this.game.ui?.toast('toast.weaponLevel', {
          weapon: this.game.ui.t(this.character.weapon.nameKey),
          level: this.weaponLevel,
        }, { icon: '✦' });
      }
    }
    this.syncRun();
    if (leveled) this.game.onPlayerLeveledUp();
  }

  applyUpgrade(id) {
    const upgrade = UPGRADE_BY_ID[id];
    if (!upgrade) return false;
    const level = this.upgradeLevels[id] ?? 0;
    if (level >= upgrade.maxLevel) return false;
    this.upgradeLevels[id] = level + 1;
    this.recalculatePlayer();
    this.syncRun();
    this.game.ui?.toast(upgrade.nameKey, {}, { icon: upgrade.icon });
    return true;
  }

  isEvolutionReady() {
    const evolution = EVOLUTIONS[this.game.player?.characterId];
    if (!evolution || this.evolved) return false;
    if (this.weaponLevel < evolution.weaponLevel) return false;
    return (this.upgradeLevels[evolution.requiresUpgrade] ?? 0) > 0;
  }

  buildOffers() {
    const offers = [];
    const evolution = EVOLUTIONS[this.game.player?.characterId];
    if (this.isEvolutionReady()) {
      offers.push({
        type: 'evolution',
        id: evolution.id,
        data: {
          id: evolution.id,
          nameKey: evolution.nameKey,
          descKey: evolution.descKey,
          icon: '❖',
          color: evolution.color,
          maxLevel: 1,
        },
      });
    }
    const characterId = this.game.player?.characterId;
    const available = UPGRADES.filter((u) =>
      (this.upgradeLevels[u.id] ?? 0) < u.maxLevel &&
      (!u.validFor || u.validFor.includes(characterId))
    );
    const pool = [...available];
    while (offers.length < GAME.progression.cardCount && pool.length > 0) {
      const index = this.rng.int(0, pool.length - 1);
      const data = pool.splice(index, 1)[0];
      offers.push({ type: 'upgrade', id: data.id, data });
    }
    this.offers = offers;
    return offers;
  }

  chooseOffer(index) {
    const offer = this.offers[index];
    if (!offer) return false;
    if (offer.type === 'evolution') {
      this.evolved = true;
      this.evolutionId = offer.id;
      this.recalculatePlayer();
      this.game.ui?.toast(offer.data.nameKey, {}, { icon: '❖', achievement: true });
      this.game.audio.play('shard');
      this.game.onEvolution?.(offer.id);
    } else {
      this.applyUpgrade(offer.id);
    }
    this.pendingLevelUps = Math.max(0, this.pendingLevelUps - 1);
    this.syncRun();
    this.offers = [];
    return true;
  }

  grantChestReward(guaranteedUpgrade = false) {
    const characterId = this.game.player?.characterId;
    const available = UPGRADES.filter((u) =>
      (this.upgradeLevels[u.id] ?? 0) < u.maxLevel &&
      (!u.validFor || u.validFor.includes(characterId))
    );
    if (available.length && (guaranteedUpgrade || this.rng.chance(0.62))) {
      const data = this.rng.pick(available);
      this.applyUpgrade(data.id);
      return { type: 'upgrade', data };
    }
    if (this.rng.chance(0.45)) {
      const amount = 10 + this.rng.int(0, 9);
      this.addXp(amount);
      return { type: 'xp', amount };
    }
    this.game.player.heal(Math.round(this.game.player.maxHealth * 0.25));
    return { type: 'heal' };
  }

  hasPendingLevelUps() {
    return this.pendingLevelUps > 0;
  }

  recalculatePlayer() {
    if (!this.game.player) return;
    const bonuses = computeUpgradeBonuses(this.upgradeLevels);
    this.game.player.applyProgression(bonuses, this.evolved, this.game.getMetaModifiers());
  }
}
