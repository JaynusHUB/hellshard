import { describe, expect, it } from 'vitest';
import { AchievementSystem } from '../src/systems/AchievementSystem.js';

function createHarness() {
  const save = {
    meta: {
      achievements: [],
      achievementProgress: {},
      hellshards: 0,
    },
    settings: { language: 'en' },
    saveMeta() {},
  };
  const ui = { toast() {} };
  const audio = { play() {} };
  const system = new AchievementSystem({ game: {}, save, ui, audio });
  system.reset();
  return { save, system };
}

describe('achievements', () => {
  it('unlocks all 13 achievements from real gameplay events', () => {
    const { save, system } = createHarness();
    system.onKill(1);
    system.onKill(100);
    system.onShards(1);
    system.onShards(3);
    system.onLevel(10);
    system.onEvolution();
    system.onChest(5);
    system.onTime(600);
    system.onBoss('mourning_maw', true);
    system.onBoss('seraph_ash');
    system.onBoss('drowned_choir');
    system.onBoss('gate_warden');
    expect(save.meta.achievements.sort()).toEqual([
      'ascendant',
      'ashfall',
      'first_blood',
      'first_evolution',
      'hundred_souls',
      'maw_silenced',
      'shardbearer',
      'silent_choir',
      'survivor',
      'treasure_hunter',
      'trinity',
      'untouched',
      'warden_fallen',
    ]);
    expect(system.rewardTotal).toBeGreaterThan(0);
    expect(system.unlockedThisRun.length).toBe(13);
  });

  it('does not unlock an achievement twice', () => {
    const { save, system } = createHarness();
    system.onKill(1);
    system.onKill(900);
    const rewardAfterRepeats = system.rewardTotal;
    system.onKill(900);
    expect(system.rewardTotal).toBe(rewardAfterRepeats);
    expect(save.meta.achievements.filter((id) => id === 'first_blood')).toHaveLength(1);
    expect(new Set(save.meta.achievements).size).toBe(save.meta.achievements.length);
  });
});
