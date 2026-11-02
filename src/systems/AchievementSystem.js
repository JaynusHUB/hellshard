import { ACHIEVEMENTS } from '../data/achievements.js';
import { translate } from '../ui/strings.js';

export class AchievementSystem {
  constructor({ game, save, ui, audio }) {
    this.game = game;
    this.save = save;
    this.ui = ui;
    this.audio = audio;
    this.progress = this.emptyProgress();
    this.unlockedThisRun = [];
    this.rewardTotal = 0;
  }

  emptyProgress() {
    return {
      kills: 0,
      shards: 0,
      level: 1,
      chests: 0,
      time: 0,
      evolution: 0,
      bossIds: new Set(),
      bossNoHit: 0,
    };
  }

  reset() {
    this.progress = this.emptyProgress();
    this.unlockedThisRun = [];
    this.rewardTotal = 0;
  }

  current(target) {
    const p = this.progress;
    switch (target.type) {
      case 'kills': return p.kills;
      case 'shards': return p.shards;
      case 'level': return p.level;
      case 'chests': return p.chests;
      case 'time': return p.time;
      case 'evolution': return p.evolution;
      case 'boss': return p.bossIds.has(target.target) ? 1 : 0;
      case 'bossNoHit': return p.bossNoHit;
      default: return 0;
    }
  }

  checkAll() {
    const t = (key, vars) => translate(this.save.settings.language, key, vars);
    for (const achievement of ACHIEVEMENTS) {
      if (this.save.meta.achievements.includes(achievement.id)) continue;
      const value = this.current(achievement.condition);
      const target = achievement.condition.type === 'boss' ? 1 : achievement.condition.target;
      this.save.meta.achievementProgress[achievement.id] = Math.min(value, target);
      if (value < target) continue;
      this.save.meta.achievements.push(achievement.id);
      this.save.meta.achievementProgress[achievement.id] = target;
      this.rewardTotal += achievement.reward;
      this.unlockedThisRun.push(achievement.id);
      this.save.saveMeta();
      this.ui?.toast(t('achievements.unlocked', { name: t(achievement.nameKey) }), {}, {
        icon: achievement.icon,
        achievement: true,
        duration: 3000,
      });
      this.audio?.play('shard');
    }
  }

  persist() {
    this.save.saveMeta();
  }

  onKill(count) {
    this.progress.kills = count;
    this.checkAll();
  }

  onShards(count) {
    this.progress.shards = count;
    this.checkAll();
  }

  onLevel(level) {
    this.progress.level = level;
    this.checkAll();
  }

  onChest(count) {
    this.progress.chests = count;
    this.checkAll();
  }

  onTime(seconds) {
    this.progress.time = Math.floor(seconds);
    this.checkAll();
  }

  onEvolution() {
    this.progress.evolution += 1;
    this.checkAll();
  }

  onBoss(bossId, noHit = false) {
    this.progress.bossIds.add(bossId);
    if (noHit) this.progress.bossNoHit += 1;
    this.checkAll();
  }
}
