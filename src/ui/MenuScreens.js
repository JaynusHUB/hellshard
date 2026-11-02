import { CHARACTERS } from '../data/characters.js';
import { ACHIEVEMENTS, ACHIEVEMENT_BY_ID } from '../data/achievements.js';
import { formatTime } from './strings.js';

export function mainMenuHtml({ t, seed, shards, version, bestTime }) {
  return `
    <div class="screen menu-screen" data-screen="main-menu">
      <div class="menu-inner">
        <h1 class="game-title">HELL<span class="accent">SHARD</span></h1>
        <div class="title-rule">${t('game.tagline')}</div>
        <p class="game-subtitle">${t('menu.subtitle')}</p>
        <div class="menu-layout">
          <div class="menu-actions">
            <button class="btn primary" data-action="start">${t('menu.start')}</button>
            <button class="btn" data-action="achievements">${t('menu.achievements')}</button>
            <button class="btn" data-action="settings">${t('menu.settings')}</button>
            <button class="btn ghost" data-action="credits">${t('menu.credits')}</button>
          </div>
          <div class="menu-side">
            <div class="seed-box corner-frame">
              <label for="menu-seed">${t('menu.seed')}</label>
              <div class="seed-row">
                <input id="menu-seed" data-seed-input value="${seed}" inputmode="numeric" maxlength="10" autocomplete="off" />
                <button class="btn small" data-action="random-seed" title="${t('menu.reroll')}">↻</button>
              </div>
              <div class="seed-hint">${t('menu.seedHint')}</div>
            </div>
            <div class="menu-controls">
              <span><b>${t('controls.move.keys')}</b> ${t('controls.move')}</span>
              <span><b>${t('controls.jump.keys')}</b> ${t('controls.jump')}</span>
              <span><b>${t('controls.attack.keys')}</b> ${t('controls.attack')}</span>
              <span><b>${t('controls.heavy.keys')}</b> ${t('controls.heavy')}</span>
              <span><b>${t('controls.special.keys')}</b> ${t('controls.special')}</span>
              <span><b>${t('controls.dash.keys')}</b> ${t('controls.dash')}</span>
            </div>
            <div class="menu-meta">
              <span>${t('menu.shards', { count: shards })}</span>
              <span>${bestTime > 0 ? formatTime(bestTime) : '—'}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="menu-footer">
        <span>${t('menu.footer')}</span>
        <span>${t('game.version', { version })}</span>
      </div>
    </div>
  `;
}

function statBar(percent, color) {
  return `<div class="stat-bar"><div class="stat-fill" style="width:${Math.max(4, Math.min(100, Math.round(percent * 100)))}%;--stat-color:${color}"></div></div>`;
}

export function characterSelectHtml({ t, selectedId, meta, seed }) {
  const cards = CHARACTERS.map((character) => {
    const unlocked = meta.unlockedCharacters.includes(character.id);
    const selected = character.id === selectedId;
    const cost = character.unlock === 'shards' ? (character.id === 'seraphine' ? 1 : 2) : 0;
    const power = character.weapon.style === 'melee'
      ? character.weapon.damage * (1 / character.weapon.cooldown) * 0.14
      : character.weapon.damage * (1 / character.weapon.cooldown) * 0.1;
    const ability = 1 - Math.min(1, character.stats.specialCooldown / 14);
    return `
      <article class="char-card ${selected ? 'selected' : ''} ${unlocked ? '' : 'locked'}" data-char="${character.id}" style="--accent:${character.accent}">
        <div class="char-preview">
          <canvas class="char-canvas" width="134" height="94" data-preview="${character.id}"></canvas>
          ${unlocked ? '' : `<div class="char-lock"><b>◆ ${cost}</b><span>${t('char.select.clickUnseal')}</span></div>`}
        </div>
        <div class="char-info">
          <h3 class="char-name">${t(character.nameKey)}</h3>
          <div class="char-title">${t(character.titleKey)}</div>
          <p class="char-desc">${t(character.descKey)}</p>
          <div class="char-stats">
            <div class="stat-row"><span class="stat-label">${t('char.select.health')}</span>${statBar(character.stats.maxHealth / 150, '#b9575a')}</div>
            <div class="stat-row"><span class="stat-label">${t('char.select.stat.power')}</span>${statBar(power, character.accent)}</div>
            <div class="stat-row"><span class="stat-label">${t('char.select.stat.speed')}</span>${statBar(character.stats.moveSpeed / 1.25, '#91c6a0')}</div>
            <div class="stat-row"><span class="stat-label">${t('char.select.stat.ability')}</span>${statBar(ability, '#b8a1ea')}</div>
          </div>
          <div class="char-ability"><b>${t(character.weapon.nameKey)}</b> · ${t(character.special.nameKey)}</div>
          <div class="char-diff">${t('char.select.difficulty')}: ${t(character.difficultyKey)}</div>
        </div>
      </article>
    `;
  }).join('');

  return `
    <div class="screen char-screen" data-screen="character-select">
      <div class="screen-inner">
        <div class="header-band">
          <div>
            <h1>${t('char.select.title')}</h1>
            <p>${t('char.select.subtitle')}</p>
          </div>
          <div class="header-actions">
            <span class="shard-balance">${t('char.select.shardBalance', { count: meta.hellshards })}</span>
            <button class="btn small ghost" data-action="back">${t('char.select.back')}</button>
          </div>
        </div>
        <div class="char-grid">${cards}</div>
        <div class="char-footer">
          <span class="seed-chip">${t('hud.seed', { seed })}</span>
          <span class="char-selected-summary" data-selected-summary>${t('char.select.blurb', { name: t(CHARACTERS.find((c) => c.id === selectedId)?.nameKey ?? 'char.kael.name') })}</span>
          <span class="spacer"></span>
          <span class="seed-chip">A/D · Space · J/K/L</span>
          <button class="btn primary" data-action="start">${t('char.select.start')}</button>
        </div>
      </div>
    </div>
  `;
}

export function settingsHtml({ t, settings, meta, inRun, seed }) {
  const bonusRows = [
    ['vitality', 'settings.bonus.vitality', 'settings.bonus.vitalityDesc', 3, 2],
    ['fortune', 'settings.bonus.fortune', 'settings.bonus.fortuneDesc', 3, 3],
    ['edge', 'settings.bonus.edge', 'settings.bonus.edgeDesc', 3, 3],
  ].map(([id, name, desc, max, cost]) => {
    const rank = meta.permanent[id] ?? 0;
    const maxed = rank >= max;
    return `
      <div class="meta-bonus">
        <div class="meta-bonus-info">
          <div class="meta-bonus-name">${t(name)}</div>
          <div class="meta-bonus-desc">${t(desc)}</div>
        </div>
        <span class="meta-bonus-rank">${maxed ? t('settings.bonus.maxed') : t('settings.bonus.rank', { rank, max })}</span>
        <button class="btn small ${maxed ? '' : 'ghost'}" data-buy-bonus="${id}" data-cost="${cost}" ${maxed || inRun ? 'disabled' : ''}>
          ${maxed ? '◆' : t('settings.bonus.buy', { cost })}
        </button>
      </div>
    `;
  }).join('');

  return `
    <div class="screen modal-screen" data-screen="settings">
      <div class="modal-panel corner-frame settings-modal">
        <div class="modal-title">${t('settings.title')}</div>
        <div class="modal-subtitle">${t('settings.audio')} · ${t('settings.video')} · ${t('settings.meta')}</div>
        <div class="settings-grid">
          <div class="setting-section">${t('settings.audio')}</div>
          ${rangeRow(t('settings.master'), 'master', settings.master, 'settings.master')}
          ${rangeRow(t('settings.sfx'), 'sfx', settings.sfx, 'settings.sfx')}
          ${rangeRow(t('settings.music'), 'music', settings.music, 'settings.music')}
          <div class="setting-row"><label>${t('settings.music')}</label>${toggleHtml('musicEnabled', settings.musicEnabled)}</div>
          <div class="setting-section">${t('settings.video')}</div>
          ${rangeRow(t('settings.shake'), 'shake', settings.shake, 'settings.shake')}
          ${rangeRow(t('settings.flash'), 'flash', settings.flash, 'settings.flash')}
          <div class="setting-row"><label>${t('settings.damageNumbers')}</label>${toggleHtml('damageNumbers', settings.damageNumbers)}</div>
          <div class="setting-row">
            <label>${t('settings.language')}</label>
            <select data-setting="language">
              <option value="en" ${settings.language === 'en' ? 'selected' : ''}>${t('settings.language.en')}</option>
              <option value="tr" ${settings.language === 'tr' ? 'selected' : ''}>${t('settings.language.tr')}</option>
            </select>
          </div>
          <div class="setting-row">
            <label>${t('settings.seed')}</label>
            <input type="text" inputmode="numeric" maxlength="10" data-setting="seed" value="${seed}" ${inRun ? 'disabled' : ''} />
          </div>
          <div class="setting-section">${t('settings.bonus')}</div>
          ${bonusRows}
          <div class="menu-meta"><span>${t('common.metaShards')}: ◆ ${meta.hellshards}</span><span>${t('common.runs')}: ${meta.runs}</span></div>
        </div>
        <div class="levelup-footer" style="justify-content:center;margin-top:12px;">
          <button class="btn small ghost" data-action="reset-settings">${t('settings.reset')}</button>
          <button class="btn small" data-action="back">${t('settings.back')}</button>
          <button class="btn small primary" data-action="apply-settings">${t('settings.apply')}</button>
        </div>
      </div>
    </div>
  `;
}

function rangeRow(label, key, value, labelKey) {
  const percent = Math.round(Number(value) * 100);
  return `
    <div class="setting-row">
      <label for="setting-${key}">${label}</label>
      <input id="setting-${key}" type="range" min="0" max="100" value="${percent}" data-setting="${key}" data-format="percent" />
      <output data-output="${key}">${percent}%</output>
    </div>
  `;
}

function toggleHtml(key, value) {
  return `<button class="toggle ${value ? 'on' : ''}" data-toggle="${key}" aria-pressed="${value}"></button>`;
}

export function achievementsHtml({ t, meta, inRun }) {
  const items = ACHIEVEMENTS.map((achievement) => {
    const unlocked = meta.achievements.includes(achievement.id);
    const progress = meta.achievementProgress[achievement.id] ?? 0;
    const target = achievement.condition.target;
    const showProgress = !unlocked && (achievement.condition.type === 'kills' || achievement.condition.type === 'chests' || achievement.condition.type === 'time');
    return `
      <div class="achievement-item ${unlocked ? 'unlocked' : ''}">
        <div class="achievement-icon">${unlocked ? achievement.icon : '◇'}</div>
        <div class="achievement-info">
          <div class="achievement-name">${t(achievement.nameKey)}</div>
          <div class="achievement-desc">${t(achievement.descKey)}</div>
          <div class="achievement-progress ${unlocked ? 'unlocked' : ''}">
            ${unlocked ? t('settings.bonus.maxed') : showProgress ? t('achievements.progress', { current: Math.min(progress, target), target }) : t('achievements.locked')}
          </div>
        </div>
      </div>
    `;
  }).join('');
  return `
    <div class="screen modal-screen" data-screen="achievements">
      <div class="modal-panel achievement-list corner-frame">
        <div class="modal-title">${t('achievements.title')}</div>
        <div class="modal-subtitle">${t('achievements.subtitle')}</div>
        <div class="achievement-grid">${items}</div>
        <div class="levelup-footer" style="justify-content:center;margin-top:13px;">
          ${inRun ? `<button class="btn small" data-action="back">${t('common.back')}</button>` : `<button class="btn small" data-action="back">${t('common.back')}</button>`}
        </div>
      </div>
    </div>
  `;
}

export function levelUpHtml({ t, offers, level, playerUpgrades }) {
  const cards = offers.map((offer, index) => {
    if (!offer) return '';
    const isEvolution = offer.type === 'evolution';
    const card = offer.data;
    const color = card.color ?? '#d4ae68';
    const currentLevel = isEvolution ? null : (playerUpgrades[card.id] ?? 0);
    const max = card.maxLevel ?? 1;
    return `
      <button class="level-card ${isEvolution ? 'evolution-card' : ''}" data-offer="${index}" style="--card-color:${color}">
        <span class="card-key">${index + 1}</span>
        <div class="card-type">${t(isEvolution ? 'levelup.cardType.evolution' : 'levelup.cardType.upgrade')}</div>
        <div class="card-icon">${card.icon ?? (isEvolution ? '❖' : '✧')}</div>
        <h2 class="card-title">${t(card.nameKey)}</h2>
        <p class="card-desc">${t(card.descKey)}</p>
        <div class="card-footer">
          <span>${isEvolution ? t('evolution.available') : t('common.level', { level: currentLevel + 1 })}</span>
          <span class="card-levels">${isEvolution ? t('evolution.already') : `${currentLevel}/${max}`}</span>
        </div>
      </button>
    `;
  }).join('');
  return `
    <div class="screen levelup-screen" data-screen="levelup">
      <div class="levelup-header">
        <h1>${t('levelup.title')}</h1>
        <p>${t('levelup.levelReached', { level })} · ${t('levelup.subtitle')}</p>
      </div>
      <div class="levelup-cards">${cards}</div>
      <div class="levelup-footer">
        <span>${t('levelup.key', { key: '1' })}</span><span>${t('levelup.key', { key: '2' })}</span><span>${t('levelup.key', { key: '3' })}</span>
      </div>
    </div>
  `;
}

export function resultHtml({ t, summary, victory, newBestTime }) {
  const top = summary.topUpgrades.length
    ? summary.topUpgrades.map((u) => `
        <div class="result-list-item">
          <span>${t(u.nameKey)}</span><b>${t('common.level', { level: u.level })}</b>
        </div>`).join('')
    : `<div class="result-list-item muted">${t('common.noUpgrade')}</div>`;
  const ach = summary.achievements.length
    ? summary.achievements.map((id) => {
        const data = ACHIEVEMENT_BY_ID[id];
        const name = data ? t(data.nameKey) : id;
        return `<span class="result-achievement">${name}</span>`;
      }).join('')
    : `<span class="result-list-item muted">${t('result.noAchievements')}</span>`;
  return `
    <div class="screen result-screen ${victory ? 'victory' : 'death'}" data-screen="result">
      <div class="result-header">
        <div>
          <h1>${t(victory ? 'result.victory' : 'result.death')}</h1>
          <p class="result-sub">${t(victory ? 'result.subtitleVictory' : 'result.subtitleDeath')}</p>
        </div>
        <div class="result-seed">${t('result.seed')}: ${summary.seed}${newBestTime ? ` · ${t('toast.newRecord', { time: formatTime(summary.elapsed) })}` : ''}</div>
      </div>
      <div class="result-body">
        <div class="result-stat-grid">
          <div class="result-stat"><span>${t('result.survived')}</span><b>${formatTime(summary.elapsed)}</b></div>
          <div class="result-stat"><span>${t('result.kills')}</span><b>${summary.kills}</b></div>
          <div class="result-stat"><span>${t('result.bosses')}</span><b>${summary.bosses.length}/3</b></div>
          <div class="result-stat"><span>${t('result.level')}</span><b>${summary.level}</b></div>
          <div class="result-stat"><span>${t('result.xp')}</span><b>${summary.xp}</b></div>
          <div class="result-stat gold"><span>${t('result.shards')}</span><b>+${summary.shardsEarned} ◆</b></div>
        </div>
        <div class="result-panel">
          <h3>${t('result.topUpgrades')}</h3>
          <div class="result-list">${top}</div>
          <h3 style="margin-top:10px;">${t('result.achievements')}</h3>
          <div class="result-achievements">${ach}</div>
          <h3 style="margin-top:10px;">${t('result.weapon')}</h3>
          <div class="result-list-item"><span>${summary.weaponName}</span><b>${summary.evolved ? t('evolution.already') : t('common.level', { level: summary.weaponLevel })}</b></div>
        </div>
      </div>
      <div class="result-footer">
        <button class="btn primary" data-action="restart">${t('result.restart')}</button>
        <button class="btn" data-action="menu">${t('result.menu')}</button>
      </div>
    </div>
  `;
}

export function creditsHtml({ t }) {
  return `
    <div class="screen modal-screen" data-screen="credits">
      <div class="modal-panel credits-panel corner-frame">
        <div class="modal-title">${t('credits.title')}</div>
        <div class="modal-subtitle">${t('game.title')}</div>
        <div class="credits-copy">
          <b>${t('credits.assets')}</b><br/>
          Gothicvania Cemetery · Church · Swamp — <b>ansimuz</b> (CC0)<br/>
          2D Medieval Castle Dungeon — <b>TPC / ThePixelist</b><br/>
          Fantasy Forest Pixel Tileset — <b>KilluaKage</b><br/>
          <br/>
          <b>${t('credits.code')}</b><br/>
          Three.js r187 · Vite · Vitest<br/>
          <br/>
          <b>${t('credits.audio')}</b><br/>
          ${t('credits.thanks')}<br/>
          <br/>
          <span>${t('credits.license')}</span>
        </div>
        <div class="levelup-footer" style="justify-content:center;margin-top:9px;">
          <button class="btn small" data-action="back">${t('credits.back')}</button>
        </div>
      </div>
    </div>
  `;
}
