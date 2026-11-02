const DEFAULT_META = {
  version: 1,
  hellshards: 0,
  unlockedCharacters: ['kael', 'brakk'],
  selectedCharacter: 'kael',
  permanent: { vitality: 0, fortune: 0, edge: 0 },
  achievements: [],
  achievementProgress: {},
  runs: 0,
  bestTime: 0,
  bestKills: 0,
  bestLevel: 1,
  bossKills: {},
  totalKills: 0,
  totalXp: 0,
  shardsFound: [],
  seenZones: ['cemetery'],
  lastSeed: 20261102,
};

const DEFAULT_SETTINGS = {
  version: 1,
  language: 'en',
  master: 0.8,
  sfx: 0.85,
  music: 0.35,
  shake: 0.7,
  flash: 0.75,
  damageNumbers: true,
  musicEnabled: true,
  seed: 20261102,
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export class SaveStore {
  constructor(keys = { metaKey: 'hellshard.meta.v1', settingsKey: 'hellshard.settings.v1' }) {
    this.metaKey = keys.metaKey;
    this.settingsKey = keys.settingsKey;
    this.meta = this.loadMeta();
    this.settings = this.loadSettings();
  }

  loadMeta() {
    const stored = readJson(this.metaKey);
    if (!stored || typeof stored !== 'object') return clone(DEFAULT_META);
    const merged = { ...clone(DEFAULT_META), ...stored };
    merged.permanent = { ...DEFAULT_META.permanent, ...(stored.permanent ?? {}) };
    merged.unlockedCharacters = Array.isArray(stored.unlockedCharacters)
      ? stored.unlockedCharacters
      : ['kael', 'brakk'];
    merged.achievements = Array.isArray(stored.achievements) ? stored.achievements : [];
    merged.achievementProgress = stored.achievementProgress ?? {};
    merged.bossKills = stored.bossKills ?? {};
    merged.shardsFound = Array.isArray(stored.shardsFound) ? stored.shardsFound : [];
    merged.seenZones = Array.isArray(stored.seenZones) ? stored.seenZones : ['cemetery'];
    return merged;
  }

  loadSettings() {
    const stored = readJson(this.settingsKey);
    if (!stored || typeof stored !== 'object') return clone(DEFAULT_SETTINGS);
    return { ...clone(DEFAULT_SETTINGS), ...stored };
  }

  saveMeta() {
    return writeJson(this.metaKey, this.meta);
  }

  saveSettings() {
    return writeJson(this.settingsKey, this.settings);
  }

  updateMeta(patch) {
    this.meta = { ...this.meta, ...patch };
    this.saveMeta();
    return this.meta;
  }

  updateSettings(patch) {
    this.settings = { ...this.settings, ...patch };
    this.saveSettings();
    return this.settings;
  }

  addShards(amount) {
    this.meta.hellshards = Math.max(0, (this.meta.hellshards ?? 0) + amount);
    this.saveMeta();
    return this.meta.hellshards;
  }

  spendShards(amount) {
    if (amount < 0 || (this.meta.hellshards ?? 0) < amount) return false;
    this.meta.hellshards -= amount;
    this.saveMeta();
    return true;
  }

  unlockCharacter(id, cost) {
    if (this.meta.unlockedCharacters.includes(id)) return true;
    if (!this.spendShards(cost)) return false;
    this.meta.unlockedCharacters.push(id);
    this.meta.selectedCharacter = id;
    this.saveMeta();
    return true;
  }

  isUnlocked(id) {
    return this.meta.unlockedCharacters.includes(id);
  }

  recordRun(summary) {
    const meta = this.meta;
    meta.runs += 1;
    meta.totalKills += summary.kills;
    meta.totalXp += summary.xp;
    meta.bestTime = Math.max(meta.bestTime, summary.elapsed);
    meta.bestKills = Math.max(meta.bestKills, summary.kills);
    meta.bestLevel = Math.max(meta.bestLevel, summary.level);
    meta.hellshards += summary.shardsEarned;
    meta.lastSeed = summary.seed;
    for (const bossId of summary.bosses) {
      meta.bossKills[bossId] = (meta.bossKills[bossId] ?? 0) + 1;
    }
    for (const shard of summary.shardIds) {
      if (!meta.shardsFound.includes(shard)) meta.shardsFound.push(shard);
    }
    meta.bestTime = meta.bestTime ?? 0;
    this.saveMeta();
    return meta;
  }

  resetMeta() {
    this.meta = clone(DEFAULT_META);
    this.saveMeta();
    return this.meta;
  }

  resetSettings() {
    this.settings = clone(DEFAULT_SETTINGS);
    this.saveSettings();
    return this.settings;
  }
}

export { DEFAULT_META, DEFAULT_SETTINGS };
