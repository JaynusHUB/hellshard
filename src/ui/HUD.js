import { GAME } from '../config/game.js';
import { formatTime } from './strings.js';

export class HUD {
  constructor(root, ui) {
    this.ui = ui;
    this.root = document.createElement('div');
    this.root.className = 'hud hidden';
    this.root.innerHTML = `
      <div class="hud-top-left">
        <div class="health-wrap">
          <div class="health-label-row">
            <span data-label="health"></span>
            <span class="health-value"><span data-hp-current>0</span>/<span data-hp-max>0</span><span class="health-armor" data-armor></span></span>
          </div>
          <div class="health-bar"><div class="damage-ghost" data-ghost></div><div class="health-fill" data-health></div></div>
          <div class="xp-row">
            <div class="level-chip" data-level>1</div>
            <div class="xp-bar"><div class="xp-fill" data-xp></div></div>
          </div>
        </div>
      </div>
      <div class="hud-top-center">
        <div class="hud-chip"><b data-zone>—</b></div>
        <div class="hud-chip"><b data-time>00:00</b></div>
        <div class="hud-chip"><b data-kills>0</b><span data-kills-label></span></div>
      </div>
      <div class="hud-top-right">
        <div class="hud-zone" data-zone-name></div>
        <div class="hud-time" data-difficulty></div>
        <div class="hud-kills" data-seed></div>
      </div>
      <div class="boss-hud" data-boss>
        <div class="boss-meta"><span class="boss-name"></span><span class="boss-phase"></span></div>
        <div class="boss-bar"><div class="boss-fill"></div></div>
      </div>
      <div class="hud-bottom-left">
        <div class="weapon-panel">
          <div class="weapon-icon" data-weapon-icon>✦</div>
          <div class="weapon-info">
            <span class="weapon-name" data-weapon-name></span>
            <span class="weapon-level" data-weapon-level></span>
          </div>
        </div>
        <div class="ability-row">
          <div class="ability-cell" data-special>
            <span class="ability-fill" data-special-fill></span>
            <span class="ability-key">L</span><span class="ability-name" data-special-name></span>
          </div>
          <div class="ability-cell" data-dash>
            <span class="ability-fill" data-dash-fill></span>
            <span class="ability-key">⇧</span><span class="ability-name" data-dash-label></span>
          </div>
        </div>
      </div>
      <div class="hud-bottom-right">
        <div class="shard-pips" data-shard-pips></div>
        <div class="control-hint" data-control-hint></div>
      </div>
      <div class="interact-prompt" data-prompt>
        <span class="keycap">E</span><span data-prompt-text></span>
      </div>
      <div class="elite-tag hidden" data-elite-tag></div>
    `;
    root.appendChild(this.root);
    this.refs = {};
    for (const node of this.root.querySelectorAll('[data-label]')) {
      this.refs[`label_${node.dataset.label}`] = node;
    }
    const ids = [
      'ghost', 'health', 'hp-current', 'hp-max', 'armor', 'level', 'xp', 'zone', 'time',
      'kills', 'kills-label', 'zone-name', 'difficulty', 'seed', 'boss', 'weapon-icon',
      'weapon-name', 'weapon-level', 'special', 'special-fill', 'special-name', 'dash',
      'dash-fill', 'dash-label', 'shard-pips', 'control-hint', 'prompt', 'prompt-text', 'elite-tag',
    ];
    for (const id of ids) {
      const prop = id.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      this.refs[prop] = this.root.querySelector(`[data-${id}]`);
    }
    this.refs.bossName = this.root.querySelector('.boss-name');
    this.refs.bossPhase = this.root.querySelector('.boss-phase');
    this.refs.bossFill = this.root.querySelector('.boss-fill');
    this.refs.bossHud = this.root.querySelector('[data-boss]');
    this.cache = {};
    this.localize();
    this.buildShardPips();
  }

  localize() {
    const t = this.ui.t.bind(this.ui);
    this.refs.label_health.textContent = t('hud.health');
    this.refs.zone.textContent = t('hud.empty');
    this.refs.killsLabel.textContent = t('hud.kills').replace('{count}', '').trim();
    this.refs.dashLabel.textContent = t('hud.dash');
    this.refs.specialName.textContent = t('hud.special');
    this.refs.controlHint.textContent = this.ui.settings.language === 'tr'
      ? 'J saldırı · K ağır · L yetenek'
      : 'J attack · K heavy · L ability';
    this.refs.seed.textContent = t('hud.seed', { seed: this.ui.game?.run?.seed ?? GAME.seed.default });
  }

  buildShardPips() {
    this.refs.shardPips.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const pip = document.createElement('div');
      pip.className = 'shard-pip';
      this.refs.shardPips.appendChild(pip);
    }
    this.shardPips = [...this.refs.shardPips.children];
  }

  setVisible(visible) {
    this.root.classList.toggle('hidden', !visible);
  }

  setZone(zone, difficultyLabel) {
    const t = this.ui.t.bind(this.ui);
    const name = t(zone.nameKey);
    this.refs.zone.textContent = name;
    this.refs.zoneName.textContent = name;
    this.refs.difficulty.textContent = difficultyLabel ?? '';
    this.refs.seed.textContent = t('hud.seed', { seed: this.ui.game?.run?.seed ?? GAME.seed.default });
  }

  update(info) {
    const { player, run, elapsed, difficulty, seed, zone, boss, prompt, shards } = info;
    const t = this.ui.t.bind(this.ui);
    const hp = Math.max(0, Math.ceil(player.health));
    const maxHp = Math.round(player.maxHealth);
    if (this.cache.hp !== hp || this.cache.maxHp !== maxHp) {
      this.refs.health.style.width = `${(hp / maxHp) * 100}%`;
      this.refs.ghost.style.transform = `scaleX(${Math.max(0, hp / maxHp)})`;
      this.refs.hpCurrent.textContent = String(hp);
      this.refs.hpMax.textContent = String(maxHp);
      this.refs.armor.textContent = player.armor > 0 ? ` ◈${Math.round(player.armor * 100)}%` : '';
      this.cache.hp = hp;
      this.cache.maxHp = maxHp;
    }
    if (this.cache.level !== run.level) {
      this.refs.level.textContent = String(run.level);
      this.cache.level = run.level;
    }
    const xpPct = Math.min(1, run.xp / run.xpToNext);
    this.refs.xp.style.width = `${xpPct * 100}%`;
    const timeText = formatTime(elapsed);
    if (this.cache.time !== timeText) {
      this.refs.time.textContent = timeText;
      this.cache.time = timeText;
    }
    if (this.cache.kills !== run.kills) {
      this.refs.kills.textContent = String(run.kills);
      this.cache.kills = run.kills;
    }
    this.refs.zone.textContent = t(zone.nameKey);
    this.refs.seed.textContent = t('hud.seed', { seed: seed ?? run.seed });
    if (difficulty) this.refs.difficulty.textContent = t(difficulty.labelKey);
    this.refs.weaponName.textContent = t(run.weaponNameKey ?? weaponNameKey(player.characterId));
    this.refs.weaponLevel.textContent = run.evolved
      ? t('evolution.already')
      : t('hud.weaponLevel', { level: run.weaponLevel });
    this.refs.weaponLevel.classList.toggle('weapon-evolved', run.evolved);
    this.refs.weaponIcon.textContent = run.evolved ? '❖' : '✦';

    const specialCooldown = run.specialCooldown ?? 0;
    const specialMax = run.specialMax ?? 1;
    this.refs.specialFill.style.width = `${Math.max(0, specialCooldown / specialMax) * 100}%`;
    this.refs.special.classList.toggle('active', specialCooldown <= 0);
    this.refs.specialName.textContent = run.specialNameKey ? t(run.specialNameKey) : t('hud.special');
    const dashCooldown = run.dashCooldown ?? 0;
    const dashMax = run.dashMax ?? 1;
    this.refs.dashFill.style.width = `${Math.max(0, dashCooldown / dashMax) * 100}%`;
    this.refs.dash.classList.toggle('active', dashCooldown <= 0);

    if (this.cache.shards !== shards) {
      this.shardPips.forEach((pip, i) => pip.classList.toggle('filled', i < shards));
      this.refs.zone.textContent = t(zone.nameKey);
      this.cache.shards = shards;
    }
    if (boss && boss.active) {
      this.refs.bossHud.classList.add('visible');
      this.refs.bossName.textContent = t(boss.nameKey);
      this.refs.bossPhase.textContent = t('boss.phase', { phase: boss.phase });
      this.refs.bossFill.style.width = `${Math.max(0, (boss.health / boss.maxHealth) * 100)}%`;
    } else {
      this.refs.bossHud.classList.remove('visible');
    }
    if (prompt?.text) {
      this.refs.prompt.classList.add('visible');
      this.refs.promptText.textContent = prompt.text;
    } else {
      this.refs.prompt.classList.remove('visible');
    }
  }
}

function weaponNameKey(characterId) {
  switch (characterId) {
    case 'kael': return 'weapon.frostArrows.name';
    case 'brakk': return 'weapon.berserkerCleave.name';
    case 'seraphine': return 'weapon.iceOrb.name';
    case 'nyx': return 'weapon.shadowBlades.name';
    default: return 'hud.weapon';
  }
}
