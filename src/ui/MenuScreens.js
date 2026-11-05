import { CHARACTERS } from '../data/characters.js';
import { ACHIEVEMENTS, ACHIEVEMENT_BY_ID } from '../data/achievements.js';
import { GAME } from '../config/game.js';
import { formatTime } from './strings.js';

const ICON_PATHS = {
  sword: 'M12 1h3v3L8 11 5 8l7-7ZM4 9l1-1 3 3-1 1H4V9Zm-2 4h3v2H0v-3h2v1Z',
  trophy: 'M5 2h6v3h2v2c0 2-2 3-4 3v2h2v2H5v-2h2v-2C5 10 3 9 3 7V4h2V2Zm0 4H4v1c0 1 1 1 1 1V6Zm6 0v2s1 0 1-1V6h-1Z',
  gear: 'M7 1h2v2h2l1-1 1 2-1 1v2l1 1-1 2-1-1H9v3H7v-3H5l-1 1-1-2 1-1V5L3 4l1-2 1 1h2V1Zm1 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z',
  scroll: 'M3 2h10v12H3V2Zm2 3h6v1H5V5Zm0 3h6v1H5V8Zm0 3h4v1H5v-1Z',
  shard: 'M8 0l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6Z',
  arrow: 'M2 7h8V3l4 5-4 5V9H2V7Z',
  refresh: 'M3 8a5 5 0 0 1 8-4l1-1v4H8l1-1a3 3 0 1 0 0 4l2 1a5 5 0 0 1-8-3Z',
  lock: 'M4 7V5a4 4 0 0 1 8 0v2h1v7H3V7h1Zm2 0h4V5a2 2 0 0 0-4 0v2Z',
  flame: 'M8 0l1 4 3-2-1 4 3 2-4 1 1 4-3-2-3 2 1-4-4-1 3-2-1-4 3 2 1-4Z',
  skull: 'M4 1h8v2h2v6h-2v3h-2v2H6v-2H4v-3H2V3h2V1Zm2 4v3h1V5H6Zm4 0v3h1V5h-1ZM7 10h2v2H7v-2Z',
};

function icon(name, className = '') {
  return `<svg class="icon ${className}" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="${ICON_PATHS[name] ?? ICON_PATHS.shard}"/></svg>`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

export function mainMenuHtml({ t, seed, shards, version, bestTime, runs = 0, zonesSeen = 0 }) {
  return `
    <div class="screen menu-screen" data-screen="main-menu">
      <div class="menu-cinema" aria-hidden="true">
        <div class="menu-cinema__shade"></div>
        <div class="menu-constellation">
          <svg viewBox="0 0 460 460" fill="none">
            <circle class="orbit" cx="230" cy="230" r="208"></circle>
            <circle class="orbit orbit--dash" cx="230" cy="230" r="156"></circle>
            <circle class="orbit" cx="230" cy="230" r="104"></circle>
            <path class="shard-path" d="M230 22 438 230 230 438 22 230Z"></path>
            <path class="shard-path" d="M230 118 342 230 230 342 118 230Z"></path>
            <path class="orbit" d="M230 22v72M438 230h-72M230 438v-72M22 230h72"></path>
            <g transform="rotate(45 230 230)">
              <rect class="node" x="223" y="52" width="14" height="14"></rect>
              <rect class="node" x="217" y="217" width="26" height="26"></rect>
              <rect class="node" x="223" y="394" width="14" height="14"></rect>
            </g>
            <circle class="orbit orbit--dash" cx="230" cy="230" r="58"></circle>
          </svg>
        </div>
        <div class="menu-ghost">DESCEND</div>
        <div class="menu-fog menu-fog--one"></div>
        <div class="menu-fog menu-fog--two"></div>
        <div class="menu-embers">
          <span class="e1"></span><span class="e2"></span><span class="e3"></span><span class="e4"></span>
          <span class="e5"></span><span class="e6"></span><span class="e7"></span><span class="e8"></span>
        </div>
        <div class="menu-scanlines"></div>
      </div>
      <div class="menu-shell">
        <header class="menu-topbar">
          <div class="menu-brand"><span class="brand-glyph">${icon('shard')}</span><span>JAYNUS <i>/</i> HELLSHARD</span></div>
          <div class="menu-protocol"><span class="protocol-dot"></span>${t('menu.protocol')}<b>${t('menu.ready')}</b></div>
          <div class="menu-version">${t('game.version', { version })}</div>
        </header>
        <div class="menu-body">
          <section class="menu-hero">
            <div class="menu-kicker"><span></span>${t('game.tagline')}<span></span></div>
            <h1 class="game-title" aria-label="HELLSHARD">
              <span class="title-hell">HELL</span><span class="title-shard">${icon('shard')}</span><span class="title-shard-word">SHARD</span>
            </h1>
            <div class="title-rule">${t('menu.rule')}</div>
            <p class="game-subtitle">${t('menu.subtitle')}</p>
            <nav class="menu-actions" aria-label="${t('menu.controls')}">
              <button class="btn menu-btn menu-btn--primary" data-action="start" aria-keyshortcuts="1">
                <span class="btn-index">01</span>
                <span class="btn-icon">${icon('sword')}</span>
                <span class="btn-copy"><b>${t('menu.start')}</b><small>${t('menu.startHint')}</small></span>
                <span class="btn-key">1</span>
              </button>
              <button class="btn menu-btn" data-action="achievements" aria-keyshortcuts="2">
                <span class="btn-index">02</span>
                <span class="btn-icon">${icon('trophy')}</span>
                <span class="btn-copy"><b>${t('menu.achievements')}</b><small>${t('menu.meta')}</small></span>
                <span class="btn-key">2</span>
              </button>
              <button class="btn menu-btn" data-action="settings" aria-keyshortcuts="3">
                <span class="btn-index">03</span>
                <span class="btn-icon">${icon('gear')}</span>
                <span class="btn-copy"><b>${t('menu.settings')}</b><small>${t('settings.audio')} · ${t('settings.video')}</small></span>
                <span class="btn-key">3</span>
              </button>
              <button class="btn menu-btn menu-btn--ghost" data-action="credits" aria-keyshortcuts="4">
                <span class="btn-index">04</span>
                <span class="btn-icon">${icon('scroll')}</span>
                <span class="btn-copy"><b>${t('menu.credits')}</b><small>${t('menu.creditsHint')}</small></span>
                <span class="btn-key">4</span>
              </button>
            </nav>
          </section>
          <aside class="descent-ledger" aria-label="${t('menu.ledger')}">
            <div class="ledger-top">
              <span>${t('menu.ledger')}</span>
              <span class="ledger-mark">${icon('shard')}</span>
            </div>
            <div class="ledger-constellation" aria-hidden="true">
              <span class="fragment-line"></span>
              <span class="fragment f1"></span><span class="fragment f2"></span><span class="fragment f3"></span>
            </div>
            <div class="ledger-fragment-label">${t('menu.fragments')}</div>
            <div class="ledger-stats">
              <div class="ledger-stat">
                <span>${t('menu.hellshards')}</span>
                <b class="shard-count">${icon('shard')} ${shards}</b>
              </div>
              <div class="ledger-stat"><span>${t('menu.best')}</span><b>${bestTime > 0 ? formatTime(bestTime) : '—'}</b></div>
              <div class="ledger-stat"><span>${t('menu.runs')}</span><b>${runs}</b></div>
              <div class="ledger-stat"><span>${t('menu.zones')}</span><b>${zonesSeen}<em>/3</em></b></div>
            </div>
            <div class="seed-box">
              <label for="menu-seed">${t('menu.seed')}</label>
              <div class="seed-row">
                <input id="menu-seed" data-seed-input value="${escapeHtml(seed)}" inputmode="numeric" maxlength="10" autocomplete="off" aria-label="${t('menu.seed')}" />
                <button class="btn icon-btn" data-action="random-seed" title="${t('menu.reroll')}" aria-label="${t('menu.reroll')}">${icon('refresh')}</button>
              </div>
              <div class="seed-hint">${t('menu.seedHint')}</div>
            </div>
            <div class="ledger-note">
              <span class="ledger-note-icon">${icon('flame')}</span>
              <p>${t('menu.tip')}</p>
            </div>
          </aside>
        </div>
        <footer class="menu-footer">
          <span class="footer-controls">${t('menu.footer')}</span>
          <span class="footer-meta">${t('menu.originalWork')} <i>·</i> LICENSE</span>
        </footer>
      </div>
    </div>
  `;
}

function statBar(percent, color) {
  return `<div class="stat-bar"><div class="stat-fill" style="width:${Math.max(4, Math.min(100, Math.round(percent * 100)))}%;--stat-color:${color}"></div></div>`;
}

export function characterSelectHtml({ t, selectedId, meta, seed }) {
  const selectedIndex = Math.max(0, CHARACTERS.findIndex((character) => character.id === selectedId));
  const selected = CHARACTERS[selectedIndex] ?? CHARACTERS[0];
  const unlocked = meta.unlockedCharacters.includes(selected.id);
  const power = selected.weapon.style === 'melee'
    ? selected.weapon.damage * (1 / selected.weapon.cooldown) * 0.14
    : selected.weapon.damage * (1 / selected.weapon.cooldown) * 0.1;
  const ability = 1 - Math.min(1, selected.stats.specialCooldown / 14);
  const rows = CHARACTERS.map((character, index) => {
    const isUnlocked = meta.unlockedCharacters.includes(character.id);
    const isSelected = character.id === selectedId;
    const cost = character.unlock === 'shards' ? (GAME.meta.unlockCosts[character.id] ?? 1) : 0;
    return `
      <button type="button" class="char-row ${isSelected ? 'selected' : ''} ${isUnlocked ? '' : 'locked'}"
        data-char="${character.id}" style="--accent:${character.accent}"
        aria-pressed="${isSelected}"
        title="${isUnlocked ? t(character.nameKey) : `${t('char.select.locked')} — ${t('char.select.unlock', { cost })}`}">
        <span class="roster-index">${String(index + 1).padStart(2, '0')}</span>
        <span class="roster-portrait"><canvas class="char-canvas char-canvas-mini" width="42" height="38" data-preview="${character.id}"></canvas></span>
        <span class="roster-copy"><b>${t(character.nameKey)}</b><small>${t(character.titleKey)}</small></span>
        <span class="roster-state">${isUnlocked
          ? (isSelected ? `<span class="roster-chosen">${icon('shard')}</span>` : '')
          : `<span class="roster-cost">${icon('lock')}${cost}</span>`}</span>
      </button>
    `;
  }).join('');

  return `
    <div class="screen char-screen" data-screen="character-select">
      <div class="char-atmosphere" aria-hidden="true"></div>
      <div class="char-shell">
        <header class="char-header">
          <div class="char-heading">
            <span class="section-kicker">${t('char.select.kicker')}</span>
            <h1>${t('char.select.title')}</h1>
            <p>${t('char.select.subtitle')}</p>
          </div>
          <div class="header-actions">
            <span class="shard-balance">${icon('shard')} ${meta.hellshards}</span>
            <button class="btn small ghost" data-action="back">${icon('arrow')} ${t('char.select.back')}</button>
          </div>
        </header>
        <div class="char-body">
          <section class="char-showcase corner-frame" style="--accent:${selected.accent}">
            <div class="showcase-stage">
              <div class="showcase-halo" aria-hidden="true"></div>
              <canvas class="char-canvas char-canvas-hero" width="160" height="116" data-preview="${selected.id}" aria-label="${t(selected.nameKey)}"></canvas>
              <span class="showcase-index">${String(selectedIndex + 1).padStart(2, '0')}</span>
              <span class="showcase-line" aria-hidden="true"></span>
            </div>
            <div class="showcase-copy">
              <span class="char-role">${t(selected.titleKey)}</span>
              <h2 class="char-name">${t(selected.nameKey)}</h2>
              <p class="char-desc">${t(selected.descKey)}</p>
              <div class="char-kit">
                <span class="kit-chip"><small>${t('char.select.weapon')}</small><b>${t(selected.weapon.nameKey)}</b></span>
                <span class="kit-chip"><small>${t('char.select.special')}</small><b>${t(selected.special.nameKey)}</b></span>
              </div>
              <div class="char-stats">
                <div class="stat-row"><span class="stat-label">${t('char.select.health')}</span>${statBar(selected.stats.maxHealth / 150, '#b9575a')}</div>
                <div class="stat-row"><span class="stat-label">${t('char.select.stat.power')}</span>${statBar(power, selected.accent)}</div>
                <div class="stat-row"><span class="stat-label">${t('char.select.stat.speed')}</span>${statBar(selected.stats.moveSpeed / 1.25, '#91c6a0')}</div>
                <div class="stat-row"><span class="stat-label">${t('char.select.stat.ability')}</span>${statBar(ability, '#b8a1ea')}</div>
              </div>
              <div class="char-meta-row">
                <span>${t('char.select.difficulty')}</span><b>${t(selected.difficultyKey)}</b>
                ${unlocked ? '' : `<span class="sealed-note">${icon('lock')} ${t('char.select.unlock', { cost: GAME.meta.unlockCosts[selected.id] ?? 1 })}</span>`}
              </div>
            </div>
          </section>
          <aside class="char-roster" aria-label="${t('char.select.roster')}">
            <div class="roster-head">
              <span>${t('char.select.roster')}</span>
              <span>${meta.unlockedCharacters.length}<em>/4</em></span>
            </div>
            ${rows}
            <div class="roster-hint">${t('char.select.hint')}</div>
          </aside>
        </div>
        <footer class="char-footer">
          <span class="seed-chip">${t('hud.seed', { seed: escapeHtml(seed) })}</span>
          <span class="char-selected-summary" data-selected-summary>${t('char.select.blurb', { name: t(selected.nameKey) })}</span>
          <span class="spacer"></span>
          <span class="char-controls-hint">A/D · Space · J/K/L</span>
          <button class="btn primary char-start" data-action="start">${t('char.select.start')} ${icon('arrow')}</button>
        </footer>
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
        <div class="settings-heading">
          <div>
            <div class="section-kicker">${t('settings.audio')} · ${t('settings.video')} · ${t('settings.meta')}</div>
            <div class="modal-title">${t('settings.title')}</div>
          </div>
          <div class="settings-balance">
            <span>${t('common.metaShards')}</span><b>◆ ${meta.hellshards}</b>
          </div>
        </div>
        <div class="settings-grid">
          <section class="settings-col">
            <div class="setting-section">${t('settings.audio')}</div>
            ${rangeRow(t('settings.master'), 'master', settings.master, 'settings.master')}
            ${rangeRow(t('settings.sfx'), 'sfx', settings.sfx, 'settings.sfx')}
            ${rangeRow(t('settings.music'), 'music', settings.music, 'settings.music')}
            <div class="setting-row"><label>${t('settings.musicEnabled')}</label>${toggleHtml('musicEnabled', settings.musicEnabled, t('settings.musicEnabled'))}</div>
          </section>
          <section class="settings-col">
            <div class="setting-section">${t('settings.video')}</div>
            ${rangeRow(t('settings.shake'), 'shake', settings.shake, 'settings.shake')}
            ${rangeRow(t('settings.flash'), 'flash', settings.flash, 'settings.flash')}
            <div class="setting-row"><label>${t('settings.damageNumbers')}</label>${toggleHtml('damageNumbers', settings.damageNumbers, t('settings.damageNumbers'))}</div>
            <div class="setting-row">
              <label>${t('settings.language')}</label>
              <select data-setting="language" aria-label="${t('settings.language')}">
                <option value="en" ${settings.language === 'en' ? 'selected' : ''}>${t('settings.language.en')}</option>
                <option value="tr" ${settings.language === 'tr' ? 'selected' : ''}>${t('settings.language.tr')}</option>
              </select>
            </div>
            <div class="setting-row">
              <label>${t('settings.seed')}</label>
              <input type="text" inputmode="numeric" maxlength="10" data-setting="seed" value="${seed}" aria-label="${t('settings.seed')}" ${inRun ? 'disabled' : ''} />
            </div>
            <div class="setting-row">
              <label>${t('settings.fullscreen')}</label>
              <button class="btn small" data-action="fullscreen">${t('settings.fullscreenButton')}</button>
            </div>
          </section>
          <section class="settings-col settings-col--full">
            <div class="setting-section">${t('settings.bonus')}</div>
            <div class="meta-bonus-list">${bonusRows}</div>
          </section>
        </div>
        <div class="settings-actions">
          <button class="btn small ghost" data-action="reset-settings">${t('settings.reset')}</button>
          <span class="spacer"></span>
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

function toggleHtml(key, value, label = '') {
  return `<button class="toggle ${value ? 'on' : ''}" data-toggle="${key}" aria-pressed="${value}" aria-label="${label}"></button>`;
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
            ${unlocked ? t('achievements.unlockedShort') : showProgress ? t('achievements.progress', { current: Math.min(progress, target), target }) : t('achievements.locked')}
          </div>
        </div>
      </div>
    `;
  }).join('');
  const unlockedCount = ACHIEVEMENTS.filter((achievement) => meta.achievements.includes(achievement.id)).length;
  return `
    <div class="screen modal-screen" data-screen="achievements">
      <div class="modal-panel achievement-list corner-frame">
        <div class="achievement-heading">
          <div>
            <div class="section-kicker">${t('menu.meta')}</div>
            <div class="modal-title">${t('achievements.title')}</div>
            <div class="modal-subtitle">${t('achievements.subtitle')}</div>
          </div>
          <div class="achievement-count">
            <b>${unlockedCount}</b><span>/${ACHIEVEMENTS.length}</span>
            <small>${t('achievements.unlockedShort')}</small>
          </div>
        </div>
        <div class="achievement-grid">${items}</div>
        <div class="achievement-actions">
          <span class="achievement-progress-line"><span style="width:${(unlockedCount / ACHIEVEMENTS.length) * 100}%"></span></span>
          <button class="btn small" data-action="back">${t('common.back')}</button>
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
          <span>${isEvolution ? t('levelup.weaponLevel', { level: 5 }) : t('common.level', { level: currentLevel + 1 })}</span>
          <span class="card-levels">${isEvolution ? t('evolution.available') : `${currentLevel}/${max}`}</span>
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
          <div class="result-list-item"><span>${t(summary.weaponNameKey ?? 'hud.weapon')}</span><b>${summary.evolved ? t('evolution.already') : t('common.level', { level: summary.weaponLevel })}</b></div>
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
          Dungeon Gate map &amp; level design — <b>JAYNUS</b><br/>
          <br/>
          <b>${t('credits.code')}</b><br/>
          HELLSHARD — <b>JAYNUS</b><br/>
          Three.js r187 · Vite · Vitest<br/>
          <br/>
          <b>${t('credits.audio')}</b><br/>
          ${t('credits.thanks')}<br/>
          <br/>
          <span>${t('credits.license')}</span><br/>
          <span class="credits-license">© JAYNUS. Original work. See LICENSE.</span>
        </div>
        <div class="levelup-footer" style="justify-content:center;margin-top:9px;">
          <button class="btn small" data-action="back">${t('credits.back')}</button>
        </div>
      </div>
    </div>
  `;
}
