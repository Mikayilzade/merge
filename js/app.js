import {
  ARENA_SKINS,
  CARD_UPGRADE_COSTS,
  MAX_CARD_LEVEL,
  RARITY,
  STAT_HELP,
  TRAITS,
  UNIT_DEFS,
  UNIT_IDS
} from './data.js';
import { unitArt, wizardArt } from './art.js';
import {
  activeTraits,
  applyWizardXp,
  calculateTeamPower,
  calculateUnitStats,
  canMerge,
  countTraits,
  createBattle,
  createMetaOffers,
  createShop,
  experienceToNextWizardLevel,
  generateEnemyTeam,
  incomeForRound,
  mergeUnits,
  shopOddsForRound,
  statMultipliers,
  teamCapForRound
} from './engine.js';

const STORAGE_KEY = 'merge-arcana-save-v1';
const screen = document.querySelector('#screen');
const modalRoot = document.querySelector('#modal-root');
const toastRoot = document.querySelector('#toast-root');
const topCoins = document.querySelector('#top-coins');
const topLevel = document.querySelector('#top-level');
const bottomNav = document.querySelector('#bottom-nav');
const adBanner = document.querySelector('#ad-banner');
const appShell = document.querySelector('#app');

let currentScreen = 'home';
let selection = null;
let battleRunning = false;
let uidCounter = Date.now();
let audioContext = null;

function defaultCards() {
  return Object.fromEntries(UNIT_IDS.map((id) => [id, {
    level: 1,
    shards: UNIT_DEFS[id].rarity === 'common' ? 8 : UNIT_DEFS[id].rarity === 'rare' ? 4 : 2
  }]));
}

function defaultSave() {
  return {
    version: 2,
    onboarded: false,
    profile: {
      wizardLevel: 1,
      wizardXp: 0,
      coins: 180,
      artifactStock: 8,
      premiumPreview: false,
      selectedSkin: 'violet',
      ownedSkins: ['violet']
    },
    cards: defaultCards(),
    stats: { matches: 0, wins: 0, bestRound: 0, totalMerges: 0, roundsWon: 0, totalDamage: 0 },
    settings: { sound: true, haptics: true, reducedMotion: false },
    shop: { purchasedOfferIds: [] },
    match: null
  };
}

function loadSave() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!parsed) return defaultSave();
    const base = defaultSave();
    const selectedSkin = parsed.profile?.selectedSkin || parsed.profile?.skin || 'violet';
    const ownedSkins = Array.from(new Set(['violet', ...(parsed.profile?.ownedSkins || []), selectedSkin]));
    const cards = { ...base.cards };
    for (const id of UNIT_IDS) cards[id] = { ...base.cards[id], ...(parsed.cards?.[id] || {}) };
    return {
      ...base,
      ...parsed,
      version: 2,
      profile: { ...base.profile, ...parsed.profile, selectedSkin, ownedSkins },
      cards,
      stats: { ...base.stats, ...parsed.stats },
      settings: { ...base.settings, ...parsed.settings },
      shop: { ...base.shop, ...parsed.shop }
    };
  } catch {
    return defaultSave();
  }
}

let save = loadSave();

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(save)); } catch { /* private mode */ }
  updateChrome();
}

function newUid(prefix = 'unit') {
  uidCounter += 1;
  return `${prefix}-${uidCounter}`;
}

function makeUnit(unitId, star = 1, slot = 0) {
  return { uid: newUid(unitId), unitId, star, slot };
}

function cardLevels() {
  return Object.fromEntries(Object.entries(save.cards).map(([id, card]) => [id, card.level]));
}

function boardUnits() {
  return (save.match?.board || []).map((unit, slot) => unit ? { ...unit, slot } : null).filter(Boolean);
}

function updateChrome() {
  topCoins.textContent = save.profile.coins;
  topLevel.textContent = save.profile.wizardLevel;
  appShell.classList.toggle('premium', save.profile.premiumPreview);
  appShell.dataset.arenaSkin = save.profile.selectedSkin || 'violet';
  adBanner.classList.toggle('hidden', save.profile.premiumPreview || currentScreen === 'match');
  bottomNav.classList.toggle('hidden', currentScreen === 'match');
  bottomNav.querySelectorAll('button').forEach((button) => {
    button.classList.toggle('active', button.dataset.action === currentScreen);
  });
}

function toast(message) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  toastRoot.append(el);
  setTimeout(() => el.remove(), 2800);
}

function haptic(pattern = 15) {
  if (save.settings.haptics && navigator.vibrate) navigator.vibrate(pattern);
}

function tone(frequency = 420, duration = 0.06, volume = 0.035) {
  if (!save.settings.sound) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = frequency < 250 ? 'sawtooth' : 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.value = volume;
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
    oscillator.stop(audioContext.currentTime + duration);
  } catch { /* optional */ }
}

function showModal(content, { dismissible = true, wide = false } = {}) {
  modalRoot.innerHTML = `<div class="modal-backdrop" ${dismissible ? 'data-action="modal-backdrop"' : ''}><section class="modal ${wide ? 'modal-wide' : ''}">${content}</section></div>`;
}

function closeModal() { modalRoot.innerHTML = ''; }
function stars(star) { return '★'.repeat(star); }
function percent(value, digits = 0) { return `${(value * 100).toFixed(digits)}%`; }
function number(value, digits = 0) { return Number(value).toFixed(digits).replace('.0', ''); }

function rarityPill(rarity) {
  const item = RARITY[rarity];
  return `<span class="rarity-pill rarity-${rarity}">${item.icon} ${item.name}</span>`;
}

function statCell(icon, label, value, key = '') {
  return `<button class="stat-cell" ${key ? `data-action="stat-help" data-stat="${key}"` : 'disabled'}><span>${icon}</span><small>${label}</small><b>${value}</b></button>`;
}

function effectiveOptions(unit, { includeMatch = true } = {}) {
  const units = includeMatch && save.match ? boardUnits() : [];
  return {
    cardLevel: save.cards[unit.unitId]?.level || 1,
    wizardLevel: save.profile.wizardLevel,
    artifactActive: Boolean(includeMatch && save.match?.artifactActive),
    activeTraits: activeTraits(units)
  };
}

function statsGrid(unit, options) {
  const stats = calculateUnitStats(unit, options);
  const powerLabel = stats.heal ? `${stats.heal} леч.` : `${stats.attack}`;
  return `<div class="stats-grid">
    ${statCell('❤', 'Здоровье', stats.maxHp, 'hp')}
    ${statCell(stats.heal ? '✚' : '⚔', stats.heal ? 'Лечение' : 'Удар', powerLabel, stats.heal ? 'heal' : 'attack')}
    ${statCell('⌁', stats.heal ? 'Поддержка/с' : 'Урон/с', number(stats.dps, 1), 'dps')}
    ${statCell('⏱', 'Атак/с', number(stats.attackSpeed, 2), 'attackSpeed')}
    ${statCell('➜', 'Движение', number(stats.moveSpeed, 1), 'moveSpeed')}
    ${statCell('◎', 'Дальность', stats.range, 'range')}
    ${statCell('⬢', 'Броня', percent(stats.armor), 'armor')}
    ${statCell('✸', 'Крит', `${percent(stats.critChance)} ×${number(stats.critMultiplier, 2)}`, 'crit')}
  </div>`;
}

function unitToken(unit, zone, index) {
  const def = UNIT_DEFS[unit.unitId];
  const level = save.cards[unit.unitId]?.level || 1;
  const isSelected = selection?.zone === zone && selection?.index === index;
  const selectedUnit = getSelectedUnit();
  const mergeTarget = selectedUnit && canMerge(selectedUnit, unit) && !isSelected;
  return `<button class="unit-token rarity-${def.rarity} ${isSelected ? 'selected' : ''} ${mergeTarget ? 'merge-target' : ''}" data-action="select-unit" data-zone="${zone}" data-index="${index}" aria-label="${def.name}, ${unit.star} звезда">
    ${unitArt(unit.unitId, { decorative: true })}
    <span class="unit-level">ур.${level}</span><span class="unit-stars">${stars(unit.star)}</span>
  </button>`;
}

function homeTemplate() {
  const hasMatch = Boolean(save.match?.active);
  const winRate = save.stats.matches ? Math.round(save.stats.wins / save.stats.matches * 100) : 0;
  const bonus = ((save.profile.wizardLevel - 1) * 0.1).toFixed(1);
  return `<section class="hero hero-v2">
    <div class="hero-copy-wrap">
      <p class="eyebrow">ПРОТОТИП 0.2 · ВЕКТОРНАЯ 2,5D ГРАФИКА</p>
      <h1>Merge<br>Arcana</h1>
      <p class="hero-copy">Собирай отряд, считай характеристики, активируй синергии и наблюдай, как расстановка оживает на арене.</p>
      <div class="hero-actions">
        <button class="primary" data-action="${hasMatch ? 'continue-match' : 'new-match'}">${hasMatch ? 'Продолжить забег' : 'Начать забег'}</button>
        <button class="secondary" data-action="show-guide">Правила</button>
      </div>
    </div>
    <div class="hero-wizard">${wizardArt({ className: 'hero-wizard-art' })}<span class="floating-rune rune-a">✦</span><span class="floating-rune rune-b">◇</span></div>
  </section>
  <div class="section-title"><h2>Твой прогресс</h2><span>сохраняется автоматически</span></div>
  <div class="card-grid progress-cards">
    <article class="info-card"><strong>${save.profile.wizardLevel}</strong><small>уровень Архонта<br>+${bonus}% ко всем статам</small></article>
    <article class="info-card"><strong>${save.stats.bestRound}/10</strong><small>лучший достигнутый<br>раунд</small></article>
    <article class="info-card"><strong>${save.stats.totalMerges}</strong><small>объединений<br>за всё время</small></article>
    <article class="info-card"><strong>${winRate}%</strong><small>полных побед<br>в забегах</small></article>
  </div>
  <article class="feature-card" data-action="collection">
    <div class="feature-icon">♜</div><div><b>8 персонажей с точными статами</b><p>Здоровье, броня, DPS, скорость, дальность, крит, способности и история каждого героя.</p></div><span>›</span>
  </article>
  <article class="feature-card" data-action="store">
    <div class="feature-icon">◇</div><div><b>Внешняя лавка</b><p>Осколки, артефакты и визуальные темы арены за постоянные монеты.</p></div><span>›</span>
  </article>
  <article class="premium-card">
    <span class="icon">♛</span><div><strong>Предпросмотр подписки</strong><p>Убирает рекламу, расширяет экран и выдаёт 100 тестовых артефактов.</p></div>
    <button class="switch ${save.profile.premiumPreview ? 'on' : ''}" data-action="premium-preview" aria-label="Предпросмотр подписки"></button>
  </article>`;
}

function renderHome() {
  currentScreen = 'home';
  selection = null;
  screen.className = 'screen';
  screen.innerHTML = homeTemplate();
  updateChrome();
}

function collectionCard(id) {
  const def = UNIT_DEFS[id];
  const card = save.cards[id];
  const cost = CARD_UPGRADE_COSTS[card.level];
  const maxed = card.level >= MAX_CARD_LEVEL;
  const progress = maxed ? 100 : Math.min(100, card.shards / cost.shards * 100);
  const canUpgrade = !maxed && card.shards >= cost.shards && save.profile.coins >= cost.coins;
  const stats = calculateUnitStats({ unitId: id, star: 1 }, {
    cardLevel: card.level,
    wizardLevel: save.profile.wizardLevel,
    activeTraits: {}
  });
  return `<article class="hero-card rarity-${def.rarity}">
    <button class="hero-card-main" data-action="show-unit-info" data-unit="${id}">
      <div class="hero-card-art">${unitArt(id, { decorative: true })}</div>
      <div class="hero-card-copy">
        <div class="hero-card-top">${rarityPill(def.rarity)}<span>ур. ${card.level}</span></div>
        <h3>${def.shortName}</h3>
        <p>${def.role} · ${TRAITS[def.trait].shortName}</p>
        <div class="mini-stats"><span>❤ ${stats.maxHp}</span><span>${stats.heal ? '✚' : '⚔'} ${stats.heal || stats.attack}</span><span>⌁ ${number(stats.dps, 1)}</span></div>
      </div>
    </button>
    <div class="card-upgrade"><div><div class="progress"><i style="width:${progress}%"></i></div><small>${maxed ? 'Максимальный уровень' : `${card.shards}/${cost.shards} осколков`}</small></div>
      <button data-action="upgrade-card" data-unit="${id}" ${canUpgrade ? '' : 'disabled'}>${maxed ? 'MAX' : `${cost.coins} 🪙`}</button></div>
  </article>`;
}

function renderCollection() {
  currentScreen = 'collection';
  selection = null;
  screen.className = 'screen';
  const cards = UNIT_IDS.map(collectionCard).join('');
  const synergies = Object.entries(TRAITS).map(([id, trait]) => `<button class="synergy-guide" data-action="show-synergy" data-trait="${id}">
    <span class="synergy-emblem">${trait.icon}</span><div><b>${trait.name}</b><small>Нужно ${trait.threshold} разных героя · ${trait.description}</small></div><span>›</span>
  </button>`).join('');
  screen.innerHTML = `<div class="page-heading"><div><p class="eyebrow">АРХИВ ОСКОЛКОВ</p><h2>Персонажи</h2></div><button class="round-info" data-action="show-stats-help">?</button></div>
    <p class="small-note">Показаны характеристики героя 1★ с текущим уровнем карты и бонусом Архонта, но без синергии и артефакта. Нажми героя для полной формулы.</p>
    <div class="collection-grid">${cards}</div>
    <div class="section-title"><h2>Синергии</h2><span>считаются по разным героям</span></div>
    <div class="synergy-guide-list">${synergies}</div>`;
  updateChrome();
}

function metaOfferCard(offer) {
  const purchased = save.shop.purchasedOfferIds.includes(offer.id);
  if (offer.type === 'artifacts') {
    return `<article class="offer-card"><div class="offer-visual artifact-crystal">◇</div><div><span class="offer-label">ЕЖЕДНЕВНО</span><h3>${offer.amount} артефактов</h3><p>Каждый даёт +10% ко всем характеристикам на один выбранный раунд.</p></div><button data-action="buy-meta-offer" data-offer="${offer.id}" ${purchased || save.profile.coins < offer.price ? 'disabled' : ''}>${purchased ? 'Куплено' : `${offer.price} 🪙`}</button></article>`;
  }
  const def = UNIT_DEFS[offer.unitId];
  return `<article class="offer-card rarity-${def.rarity}"><div class="offer-visual">${unitArt(offer.unitId, { decorative: true })}</div><div><span class="offer-label">ОСКОЛКИ · ${RARITY[def.rarity].name.toUpperCase()}</span><h3>${def.shortName} ×${offer.amount}</h3><p>Осколки остаются между забегами и нужны для конечной прокачки карты.</p></div><button data-action="buy-meta-offer" data-offer="${offer.id}" ${purchased || save.profile.coins < offer.price ? 'disabled' : ''}>${purchased ? 'Куплено' : `${offer.price} 🪙`}</button></article>`;
}

function renderStore() {
  currentScreen = 'store';
  selection = null;
  screen.className = 'screen';
  const offers = createMetaOffers();
  const skins = Object.values(ARENA_SKINS).map((skin) => {
    const owned = save.profile.ownedSkins.includes(skin.id);
    const selected = save.profile.selectedSkin === skin.id;
    return `<article class="skin-card skin-${skin.id} ${selected ? 'selected' : ''}"><div class="skin-preview"><span>${skin.icon}</span><i></i><i></i><i></i></div><div><h3>${skin.name}</h3><p>${skin.description}</p></div><button data-action="skin-action" data-skin="${skin.id}" ${!owned && save.profile.coins < skin.price ? 'disabled' : ''}>${selected ? 'Выбрано' : owned ? 'Выбрать' : `${skin.price} 🪙`}</button></article>`;
  }).join('');
  screen.innerHTML = `<div class="page-heading"><div><p class="eyebrow">ВНЕШНЯЯ ЛАВКА</p><h2>Базар Осколков</h2></div><span class="coin-badge">${save.profile.coins} 🪙</span></div>
    <p class="small-note">Здесь тратятся постоянные монеты аккаунта. Внутри забега используется отдельное золото, которое после забега исчезает.</p>
    <div class="offer-list">${offers.map(metaOfferCard).join('')}</div>
    <div class="section-title"><h2>Облик арены</h2><span>только графика, без силы</span></div>
    <div class="skin-list">${skins}</div>
    <article class="premium-panel"><div><span class="offer-label">МАКЕТ МОНЕТИЗАЦИИ</span><h3>Подписка · $5/месяц</h3><p>Убирает баннер, даёт больше пространства, косметику и 100 артефактов. Сейчас это только переключатель для теста.</p></div><button class="switch ${save.profile.premiumPreview ? 'on' : ''}" data-action="premium-preview"></button></article>`;
  updateChrome();
}

function renderWizard() {
  currentScreen = 'wizard';
  selection = null;
  screen.className = 'screen';
  const level = save.profile.wizardLevel;
  const required = experienceToNextWizardLevel(level);
  const progress = Math.min(100, save.profile.wizardXp / required * 100);
  const bonus = ((level - 1) * 0.1).toFixed(1);
  screen.innerHTML = `<section class="wizard-profile"><div class="wizard-stage">${wizardArt()}</div><div><p class="eyebrow">ЗАКЛИНАТЕЛЬ</p><h2>Архонт · уровень ${level}</h2><p>Архонт связывает осколки существ в устойчивые формы. Его уровень бесконечен и усиливает каждую характеристику на 0,1% за уровень после первого.</p></div></section>
    <div class="progress xp-progress"><i style="width:${progress}%"></i></div><p class="small-note centered">${save.profile.wizardXp} / ${required} опыта до следующего уровня</p>
    <div class="stat-list">
      <div class="stat-row"><span>Постоянный множитель</span><b>×${number(1 + (level - 1) * .001, 3)} · +${bonus}%</b></div>
      <div class="stat-row"><span>Артефакты</span><b>${save.profile.artifactStock}</b></div>
      <div class="stat-row"><span>Победы в раундах</span><b>${save.stats.roundsWon}</b></div>
      <div class="stat-row"><span>Звук</span><button class="switch ${save.settings.sound ? 'on' : ''}" data-action="toggle-sound"></button></div>
      <div class="stat-row"><span>Вибрация</span><button class="switch ${save.settings.haptics ? 'on' : ''}" data-action="toggle-haptics"></button></div>
      <div class="stat-row"><span>Уменьшить анимации</span><button class="switch ${save.settings.reducedMotion ? 'on' : ''}" data-action="toggle-motion"></button></div>
    </div>
    <button class="feature-card full-button" data-action="show-formulas"><div class="feature-icon">∑</div><div><b>Все формулы игры</b><p>Уровни, звёзды, броня, крит, DPS, сила команды и экономика.</p></div><span>›</span></button>
    <button class="feature-card full-button" data-action="show-guide"><div class="feature-icon">?</div><div><b>Подробные правила</b><p>Внешний и внутренний магазин, расстановка, объединение и доход.</p></div><span>›</span></button>
    <button class="danger full-width" data-action="reset-progress">Сбросить тестовый прогресс</button>`;
  updateChrome();
}

function createInitialMatch() {
  const board = Array(9).fill(null);
  const bench = Array(5).fill(null);
  board[1] = makeUnit('guardian', 1, 1);
  board[7] = makeUnit('ranger', 1, 7);
  bench[0] = makeUnit('duelist', 1, 0);
  save.match = {
    active: true, round: 1, lives: 3, wins: 0, streak: 0, gold: 10,
    board, bench, shop: createShop(1), locked: false, artifactActive: false,
    enemyTeam: null, lastIncome: 0
  };
  ensureEnemyTeam();
  persist();
}

function ensureEnemyTeam() {
  if (!save.match || save.match.enemyTeam) return;
  const playerPower = Math.max(230, calculateTeamPower(boardUnits(), cardLevels(), save.profile.wizardLevel, save.match.artifactActive));
  save.match.enemyTeam = generateEnemyTeam({ round: save.match.round, playerPower });
}

function getZoneArray(zone) { return zone === 'board' ? save.match.board : save.match.bench; }
function getSelectedUnit() { return selection && save.match ? getZoneArray(selection.zone)[selection.index] : null; }

function selectOrMove(zone, index) {
  if (!save.match || battleRunning) return;
  const targetArray = getZoneArray(zone);
  const targetUnit = targetArray[index];
  if (!selection) {
    if (!targetUnit) return;
    selection = { zone, index };
    tone(350, .04);
    renderMatch();
    return;
  }
  if (selection.zone === zone && selection.index === index) {
    showUnitDetails(targetUnit, { zone, index, includeMatch: true });
    return;
  }
  const sourceArray = getZoneArray(selection.zone);
  const sourceUnit = sourceArray[selection.index];
  if (!sourceUnit) { selection = null; renderMatch(); return; }

  if (targetUnit && canMerge(sourceUnit, targetUnit)) {
    const merged = mergeUnits(sourceUnit, targetUnit);
    merged.slot = index;
    targetArray[index] = merged;
    sourceArray[selection.index] = null;
    save.stats.totalMerges += 1;
    selection = null;
    tone(720, .12, .05);
    haptic([20, 35, 35]);
    toast(`${UNIT_DEFS[merged.unitId].shortName}: теперь ${merged.star}★`);
    refreshEnemyForPowerChange();
    persist();
    renderMatch();
    return;
  }

  if (selection.zone === 'bench' && zone === 'board' && !targetUnit && boardUnits().length >= teamCapForRound(save.match.round)) {
    toast('Лимит отряда заполнен. Объедини или убери бойца на скамью.');
    return;
  }
  sourceArray[selection.index] = targetUnit ? { ...targetUnit, slot: selection.index } : null;
  targetArray[index] = { ...sourceUnit, slot: index };
  selection = null;
  tone(430, .04);
  refreshEnemyForPowerChange();
  persist();
  renderMatch();
}

function refreshEnemyForPowerChange() {
  if (save.match?.round <= 2) return;
  save.match.enemyTeam = null;
  ensureEnemyTeam();
}

function showUnitDetails(unit, { zone = null, index = null, includeMatch = false } = {}) {
  const def = UNIT_DEFS[unit.unitId];
  const options = effectiveOptions(unit, { includeMatch });
  const stats = calculateUnitStats(unit, options);
  const mult = statMultipliers(unit, options);
  const sellPrice = zone ? Math.max(1, Math.floor(def.cost * Math.pow(2, unit.star - 1) * 0.65)) : 0;
  const synergyActive = options.activeTraits[def.trait];
  showModal(`<div class="unit-detail-hero rarity-${def.rarity}"><div class="unit-detail-art">${unitArt(unit.unitId)}</div><div><div>${rarityPill(def.rarity)}</div><h2>${def.name}</h2><p>${def.role} · ${TRAITS[def.trait].name} · ${stars(unit.star)}</p></div></div>
    <p class="unit-description">${def.description}</p>
    ${statsGrid(unit, options)}
    <section class="ability-box"><span>УНИКАЛЬНАЯ СПОСОБНОСТЬ</span><h3>${def.abilityName}</h3><p>${def.abilityDescription}</p></section>
    <section class="formula-box"><b>Как получены цифры</b><p>База × звезда <strong>×${number(mult.star, 2)}</strong> × карта <strong>×${number(mult.card, 2)}</strong> × Архонт <strong>×${number(mult.wizard, 3)}</strong>${mult.artifact > 1 ? ` × артефакт <strong>×${mult.artifact}</strong>` : ''}. ${synergyActive ? `Синергия <strong>${TRAITS[def.trait].shortName}</strong> активна.` : `Синергия <strong>${TRAITS[def.trait].shortName}</strong> не активна.`}</p></section>
    <blockquote>«${def.quote}»</blockquote><p class="lore-copy">${def.lore}</p>
    <div class="modal-actions">${zone ? `<button class="danger" data-action="sell-unit" data-zone="${zone}" data-index="${index}">Продать за ${sellPrice} 🪙</button>` : ''}<button class="secondary" data-action="close-modal">Закрыть</button></div>`, { wide: true });
}

function buyShop(index) {
  if (!save.match || battleRunning) return;
  const unitId = save.match.shop[index];
  if (!unitId) return;
  const def = UNIT_DEFS[unitId];
  if (save.match.gold < def.cost) return toast('Не хватает золота забега.');
  let zone = 'bench';
  let slot = save.match.bench.findIndex((unit) => !unit);
  if (slot < 0 && boardUnits().length < teamCapForRound(save.match.round)) {
    zone = 'board';
    slot = save.match.board.findIndex((unit) => !unit);
  }
  if (slot < 0) return toast('Нет места. Объедини или продай бойца.');
  save.match.gold -= def.cost;
  getZoneArray(zone)[slot] = makeUnit(unitId, 1, slot);
  save.match.shop[index] = null;
  tone(560, .05);
  haptic();
  refreshEnemyForPowerChange();
  persist();
  renderMatch();
}

function rerollShop() {
  if (save.match.gold < 1) return toast('Для обновления нужен 1 золотой.');
  save.match.gold -= 1;
  save.match.shop = createShop(save.match.round);
  tone(500, .06);
  persist();
  renderMatch();
}

function renderSynergies(units) {
  const actives = activeTraits(units);
  const counts = countTraits(units);
  return Object.entries(TRAITS).map(([id, trait]) => `<button class="synergy ${actives[id] ? 'active' : ''}" data-action="show-synergy" data-trait="${id}">${trait.icon} ${trait.shortName} <b>${counts[id] || 0}/${trait.threshold}</b></button>`).join('');
}

function internalShopCard(unitId, index, gold) {
  if (!unitId) return `<article class="shop-card sold"><span>Продано</span></article>`;
  const def = UNIT_DEFS[unitId];
  const stats = calculateUnitStats({ unitId, star: 1 }, { cardLevel: save.cards[unitId].level, wizardLevel: save.profile.wizardLevel, activeTraits: {} });
  return `<article class="shop-card rarity-${def.rarity}">
    <button class="shop-info" data-action="show-shop-unit" data-index="${index}" aria-label="Характеристики ${def.name}">i</button>
    <button class="shop-buy" data-action="buy-shop" data-index="${index}" ${gold < def.cost ? 'disabled' : ''}>
      <div class="shop-art">${unitArt(unitId, { decorative: true })}</div><span class="shop-rarity">${RARITY[def.rarity].icon} ${RARITY[def.rarity].name}</span><b>${def.shortName}</b><small>${def.role}</small>
      <div class="shop-mini-stats"><span>❤${stats.maxHp}</span><span>${stats.heal ? '✚' : '⚔'}${stats.heal || stats.attack}</span></div><strong>${def.cost} 🪙</strong>
    </button>
  </article>`;
}

function renderMatch() {
  currentScreen = 'match';
  ensureEnemyTeam();
  const match = save.match;
  const units = boardUnits();
  const cap = teamCapForRound(match.round);
  const power = calculateTeamPower(units, cardLevels(), save.profile.wizardLevel, match.artifactActive);
  const enemyPower = calculateTeamPower(match.enemyTeam, {}, Math.max(1, Math.floor(save.profile.wizardLevel * .65)), false);
  const selectedUnit = getSelectedUnit();
  const board = match.board.map((unit, index) => {
    const isSelected = selection?.zone === 'board' && selection.index === index;
    const mergeTarget = unit && selectedUnit && canMerge(selectedUnit, unit) && !isSelected;
    return `<div class="board-slot row-${Math.floor(index / 3)} ${index < 3 ? 'front' : ''} ${isSelected ? 'selected' : ''} ${mergeTarget ? 'merge-target' : ''}" data-action="slot" data-zone="board" data-index="${index}">${unit ? unitToken(unit, 'board', index) : '<span class="slot-rune">◇</span>'}</div>`;
  }).join('');
  const bench = match.bench.map((unit, index) => `<div class="bench-slot ${selection?.zone === 'bench' && selection.index === index ? 'selected' : ''}" data-action="slot" data-zone="bench" data-index="${index}">${unit ? unitToken(unit, 'bench', index) : ''}</div>`).join('');
  const shop = match.shop.map((unitId, index) => internalShopCard(unitId, index, match.gold)).join('');
  const enemy = match.enemyTeam.map((unit) => `<span class="mini-unit rarity-${UNIT_DEFS[unit.unitId].rarity}">${unitArt(unit.unitId, { decorative: true })}<b>${unit.star}★</b></span>`).join('');
  const hearts = '♥'.repeat(match.lives) + '♡'.repeat(3 - match.lives);
  const odds = shopOddsForRound(match.round);
  screen.className = 'screen match-screen';
  screen.innerHTML = `<div class="match-header"><div class="life-row">${hearts}</div><div class="round-pill">Раунд <b>${match.round}</b>/10</div><button class="match-info" data-action="show-match-help">?</button><div class="match-economy"><b>${match.gold}</b> 🪙 <span>сила ${power}</span></div></div>
    <section class="arena-wrap" id="arena">
      <div class="arena-sky"><i></i><i></i><i></i></div><div class="arena-floor"></div>
      <div class="enemy-preview"><span class="enemy-title">Соперник · сила ~${enemyPower}</span><div class="enemy-icons">${enemy}</div></div>
      <div class="plan-board">${board}</div><span class="team-cap">Отряд ${units.length}/${cap}</span><div id="battle-layer" class="battle-layer"></div>
    </section>
    <section class="deploy-panel"><div class="synergies">${renderSynergies(units)}</div><div class="bench-label"><span>Скамья</span><small>нажми героя → клетку</small></div><div class="bench">${bench}</div>
      <div class="internal-shop-head"><div><b>Магазин забега</b><small>Шансы: ${odds.common}% / ${odds.rare}% / ${odds.epic}%</small></div><button class="lock-button ${match.locked ? 'active' : ''}" data-action="toggle-shop-lock">${match.locked ? '🔒' : '🔓'}</button></div>
      <div class="shop-row">${shop}</div></section>
    <div class="match-controls">
      <button class="icon-button" data-action="reroll" ${battleRunning ? 'disabled' : ''}>↻<small>1 🪙</small></button>
      <button class="icon-button artifact-button ${match.artifactActive ? 'active' : ''}" data-action="toggle-artifact" ${battleRunning || save.profile.artifactStock <= 0 ? 'disabled' : ''}>◇<small>${save.profile.artifactStock}</small></button>
      <button class="battle-button" data-action="start-battle" ${battleRunning || !units.length ? 'disabled' : ''}>${battleRunning ? 'БОЙ ИДЁТ…' : 'НАЧАТЬ БОЙ'}</button>
    </div>`;
  updateChrome();
}

function toggleArtifact() {
  if (!save.match || save.profile.artifactStock <= 0) return;
  save.match.artifactActive = !save.match.artifactActive;
  save.match.enemyTeam = null;
  ensureEnemyTeam();
  tone(save.match.artifactActive ? 760 : 380, .07);
  persist();
  renderMatch();
  if (save.match.artifactActive) toast('Артефакт готов: ×1,10 ко всем базовым статам этого раунда.');
}

async function startBattle() {
  if (battleRunning || !save.match) return;
  const playerUnits = boardUnits();
  if (!playerUnits.length) return toast('Сначала выставь хотя бы одного бойца.');
  battleRunning = true;
  selection = null;
  if (save.match.artifactActive) save.profile.artifactStock = Math.max(0, save.profile.artifactStock - 1);
  persist();
  renderMatch();
  const battle = createBattle({ playerUnits, enemyUnits: save.match.enemyTeam, cardLevels: cardLevels(), wizardLevel: save.profile.wizardLevel, artifactActive: save.match.artifactActive });
  const layer = document.querySelector('#battle-layer');
  document.querySelector('.plan-board')?.classList.add('battle-hidden');
  document.querySelector('.enemy-preview')?.classList.add('battle-hidden');
  for (const unit of battle.units) {
    const def = UNIT_DEFS[unit.unitId];
    const el = document.createElement('div');
    el.id = `combat-${unit.combatId}`;
    el.className = `combatant ${unit.side} rarity-${def.rarity}`;
    el.dataset.unit = unit.unitId;
    el.innerHTML = `<div class="combat-shadow"></div><div class="combat-art">${unitArt(unit.unitId, { decorative: true })}</div><span class="combat-name">${def.shortName}</span><div class="hpbar"><i></i></div>`;
    layer.append(el);
  }

  let last = performance.now();
  let accumulator = 0;
  const speedFactor = save.settings.reducedMotion ? 2.25 : 1.45;
  const result = await new Promise((resolve) => {
    function frame(now) {
      const rawDt = Math.min(.05, (now - last) / 1000);
      last = now;
      accumulator += rawDt * speedFactor;
      let snapshot;
      while (accumulator >= .04) {
        snapshot = battle.step(.04);
        accumulator -= .04;
        processBattleEvents(snapshot.events, battle.units, layer);
      }
      updateCombatants(battle.units);
      if (battle.finished) resolve(battle.winner);
      else requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
  await new Promise((resolve) => setTimeout(resolve, save.settings.reducedMotion ? 180 : 650));
  battleRunning = false;
  finishRound(result === 'player');
}

function updateCombatants(units) {
  for (const unit of units) {
    const el = document.querySelector(`#combat-${CSS.escape(unit.combatId)}`);
    if (!el) continue;
    el.style.left = `${unit.x}%`;
    el.style.top = `${unit.y}%`;
    const depthScale = 0.72 + unit.y * 0.0042;
    el.style.setProperty('--depth-scale', depthScale.toFixed(3));
    el.style.zIndex = String(Math.round(unit.y * 10));
    el.classList.toggle('dead', unit.dead);
    el.classList.toggle('face-left', unit.facing === 'left');
    el.classList.toggle('burning', unit.burnRemaining > 0);
    el.querySelector('.hpbar i').style.width = `${Math.max(0, unit.hp / unit.maxHp * 100)}%`;
  }
}

function flashClass(el, className, duration = 220) {
  if (!el) return;
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
  setTimeout(() => el.classList.remove(className), duration);
}

function createProjectile(from, to, style, layer) {
  const arena = layer.getBoundingClientRect();
  const x1 = from.x / 100 * arena.width;
  const y1 = from.y / 100 * arena.height;
  const x2 = to.x / 100 * arena.width;
  const y2 = to.y / 100 * arena.height;
  const length = Math.hypot(x2 - x1, y2 - y1);
  const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
  const el = document.createElement('span');
  el.className = `projectile projectile-${style || 'magic'}`;
  el.style.left = `${x1}px`;
  el.style.top = `${y1}px`;
  el.style.width = `${length}px`;
  el.style.transform = `rotate(${angle}deg)`;
  layer.append(el);
  setTimeout(() => el.remove(), 360);
}

function createImpact(target, kind, layer) {
  const el = document.createElement('span');
  el.className = `impact impact-${kind}`;
  el.style.left = `${target.x}%`;
  el.style.top = `${target.y}%`;
  layer.append(el);
  setTimeout(() => el.remove(), 520);
}

function processBattleEvents(events, units, layer) {
  for (const event of events) {
    const source = units.find((unit) => unit.combatId === event.from);
    const target = units.find((unit) => unit.combatId === event.to);
    const sourceEl = source ? document.querySelector(`#combat-${CSS.escape(source.combatId)}`) : null;
    const targetEl = target ? document.querySelector(`#combat-${CSS.escape(target.combatId)}`) : null;
    if (event.type === 'hit' || event.type === 'heal' || event.type === 'burn') {
      if (!target) continue;
      if (sourceEl) flashClass(sourceEl, event.type === 'heal' ? 'casting' : 'attacking', 260);
      if (targetEl) flashClass(targetEl, event.type === 'heal' ? 'healed' : 'hurt', 220);
      if (event.ranged && source) createProjectile(source, target, event.style, layer);
      createImpact(target, event.type === 'heal' ? 'heal' : event.type === 'burn' ? 'burn' : event.critical ? 'critical' : event.splash ? 'splash' : 'hit', layer);
      const pop = document.createElement('span');
      pop.className = `damage-pop ${event.type === 'heal' ? 'heal' : ''} ${event.critical ? 'critical' : ''}`;
      pop.style.left = `${target.x}%`;
      pop.style.top = `${target.y}%`;
      pop.textContent = `${event.type === 'heal' ? '+' : '-'}${event.amount}${event.critical ? '!' : ''}`;
      layer.append(pop);
      setTimeout(() => pop.remove(), 760);
      if (event.special && source) {
        const label = document.createElement('span');
        label.className = 'ability-pop';
        label.style.left = `${source.x}%`;
        label.style.top = `${source.y}%`;
        label.textContent = event.special;
        layer.append(label);
        setTimeout(() => label.remove(), 900);
      }
      if (event.type === 'hit' && Math.random() < .16) tone(event.critical ? 260 : 185, .025, .012);
    }
    if (event.type === 'status' && target) createImpact(target, event.status, layer);
    if (event.type === 'death') {
      const deadEl = document.querySelector(`#combat-${CSS.escape(event.target)}`);
      flashClass(deadEl, 'death-burst', 500);
    }
  }
}

function finishRound(won) {
  const match = save.match;
  if (won) {
    match.wins += 1;
    match.streak = match.streak >= 0 ? match.streak + 1 : 1;
    save.stats.roundsWon += 1;
    tone(790, .18, .05); haptic([25, 50, 25]);
  } else {
    match.lives -= 1;
    match.streak = match.streak <= 0 ? match.streak - 1 : -1;
    tone(170, .22, .04); haptic(80);
  }
  const completedRound = match.round;
  save.stats.bestRound = Math.max(save.stats.bestRound, completedRound);
  const gameOver = match.lives <= 0;
  const victory = won && completedRound >= 10;
  if (gameOver || victory) { concludeMatch(victory); return; }
  const base = 5;
  const interest = Math.min(3, Math.floor(match.gold / 5));
  const streakBonus = Math.abs(match.streak) >= 2 ? Math.min(2, Math.floor(Math.abs(match.streak) / 2)) : 0;
  const income = incomeForRound(match.gold, match.streak);
  match.lastIncome = income;
  match.gold += income;
  match.round += 1;
  match.artifactActive = false;
  match.enemyTeam = null;
  if (!match.locked) match.shop = createShop(match.round);
  ensureEnemyTeam();
  persist();
  showModal(`<div class="round-result ${won ? 'won' : 'lost'}"><div class="result-emblem">${won ? '♛' : '◒'}</div><h2>${won ? 'Раунд выигран' : 'Раунд проигран'}</h2><p>${won ? 'Твоя расстановка и расчёт силы сработали.' : `Осталось жизней: ${match.lives}. Изучи статы врага, перестрой переднюю линию или собери синергию.`}</p></div>
    <div class="income-breakdown"><div><span>База</span><b>+${base}</b></div><div><span>Проценты</span><b>+${interest}</b></div><div><span>Серия</span><b>+${streakBonus}</b></div><div><span>Итого</span><b>+${income} 🪙</b></div></div>
    <div class="modal-actions"><button class="primary" data-action="next-round">К раунду ${match.round}</button></div>`, { dismissible: false });
}

function concludeMatch(victory) {
  const match = save.match;
  const reached = match.round;
  const coinReward = 28 + reached * 7 + match.wins * 8 + (victory ? 90 : 0);
  const xpReward = 18 + reached * 5 + match.wins * 4 + (victory ? 55 : 0);
  const shardRewards = [];
  const shuffled = [...UNIT_IDS].sort(() => Math.random() - .5).slice(0, 3);
  for (const id of shuffled) {
    const amount = 2 + Math.floor(reached / 3) + (victory ? 4 : 0);
    save.cards[id].shards += amount;
    shardRewards.push({ id, amount });
  }
  save.profile.coins += coinReward;
  save.profile = applyWizardXp(save.profile, xpReward);
  save.stats.matches += 1;
  if (victory) save.stats.wins += 1;
  save.match.active = false;
  persist();
  const shards = shardRewards.map(({ id, amount }) => `<span class="reward">${UNIT_DEFS[id].shortName} +${amount}</span>`).join('');
  showModal(`<div class="round-result won"><div class="result-emblem">${victory ? '♛' : '◒'}</div><h2>${victory ? 'Арена покорена!' : 'Забег завершён'}</h2><p>${victory ? 'Ты пережил все десять раундов.' : `Ты дошёл до ${reached}-го раунда. Постоянные награды уже добавлены.`}</p></div>
    <div class="reward-row"><span class="reward">+${coinReward} 🪙</span><span class="reward">+${xpReward} опыта</span>${shards}</div>
    <div class="modal-actions"><button class="primary" data-action="finish-match">На главную</button><button class="secondary" data-action="new-match">Ещё забег</button></div>`, { dismissible: false });
}

function upgradeCard(unitId) {
  const card = save.cards[unitId];
  if (card.level >= MAX_CARD_LEVEL) return;
  const cost = CARD_UPGRADE_COSTS[card.level];
  if (card.shards < cost.shards || save.profile.coins < cost.coins) return;
  card.shards -= cost.shards;
  save.profile.coins -= cost.coins;
  card.level += 1;
  tone(800, .15, .05); haptic([20, 30, 20]);
  persist();
  toast(`${UNIT_DEFS[unitId].shortName} улучшен до ${card.level} уровня.`);
  renderCollection();
}

function buyMetaOffer(offerId) {
  const offer = createMetaOffers().find((item) => item.id === offerId);
  if (!offer || save.shop.purchasedOfferIds.includes(offer.id) || save.profile.coins < offer.price) return;
  save.profile.coins -= offer.price;
  if (offer.type === 'shards') save.cards[offer.unitId].shards += offer.amount;
  if (offer.type === 'artifacts') save.profile.artifactStock += offer.amount;
  save.shop.purchasedOfferIds.push(offer.id);
  tone(760, .1, .045); haptic([15, 25, 15]); persist(); renderStore(); toast('Покупка добавлена к постоянному прогрессу.');
}

function skinAction(skinId) {
  const skin = ARENA_SKINS[skinId];
  if (!skin) return;
  const owned = save.profile.ownedSkins.includes(skinId);
  if (!owned) {
    if (save.profile.coins < skin.price) return;
    save.profile.coins -= skin.price;
    save.profile.ownedSkins.push(skinId);
  }
  save.profile.selectedSkin = skinId;
  persist(); renderStore(); toast(`Арена «${skin.name}» выбрана.`);
}

function togglePremiumPreview() {
  save.profile.premiumPreview = !save.profile.premiumPreview;
  if (save.profile.premiumPreview) {
    save.profile.artifactStock = Math.max(100, save.profile.artifactStock);
    toast('Подписка включена для теста: баннер скрыт, выдано 100 артефактов.');
  } else toast('Бесплатный интерфейс включён. Тестовые артефакты остаются.');
  persist(); renderCurrent();
}

function showSynergy(traitId) {
  const trait = TRAITS[traitId];
  const members = trait.members.map((id) => `<button class="member-chip" data-action="show-unit-info" data-unit="${id}">${unitArt(id, { decorative: true })}<span>${UNIT_DEFS[id].shortName}</span></button>`).join('');
  showModal(`<div class="synergy-modal"><div class="synergy-large-icon">${trait.icon}</div><p class="eyebrow">СИНЕРГИЯ</p><h2>${trait.name}</h2><p class="synergy-effect">${trait.description}</p></div><div class="member-row">${members}</div><section class="ability-box"><span>КАК АКТИВИРОВАТЬ</span><p>Выставь на поле ${trait.threshold} <b>разных</b> персонажа этой фракции. Две копии одного героя считаются как один вид; звёздность не меняет порог.</p></section><p class="lore-copy">${trait.lore}</p><div class="modal-actions"><button class="secondary" data-action="close-modal">Закрыть</button></div>`);
}

function showStatsHelp(statKey = null) {
  const entries = statKey ? [[statKey, STAT_HELP[statKey]]] : Object.entries(STAT_HELP);
  showModal(`<div class="page-heading"><div><p class="eyebrow">СПРАВОЧНИК</p><h2>${statKey ? entries[0][1].name : 'Характеристики'}</h2></div></div><div class="help-list">${entries.map(([id, stat]) => `<article><span>${stat.icon}</span><div><b>${stat.name}</b><p>${stat.description}</p></div></article>`).join('')}</div><div class="modal-actions"><button class="secondary" data-action="close-modal">Закрыть</button></div>`);
}

function showFormulas() {
  showModal(`<p class="eyebrow">ПРОЗРАЧНАЯ МАТЕМАТИКА</p><h2>Формулы силы</h2>
    <div class="formula-list">
      <article><b>Звёзды</b><p>1★ ×1,00 · 2★ ×1,82 · 3★ ×3,28. Объединение требует двух одинаковых героев той же звезды.</p></article>
      <article><b>Уровень карты</b><p>Каждый уровень после первого даёт +6%. Уровень 10 = ×1,54. Карты имеют конечный максимум.</p></article>
      <article><b>Уровень Архонта</b><p>Каждый уровень после первого даёт +0,1%. Формула: 1 + (уровень − 1) × 0,001. Максимума нет.</p></article>
      <article><b>Артефакт</b><p>×1,10 к здоровью, атаке и лечению в выбранном раунде. Один артефакт расходуется при начале боя.</p></article>
      <article><b>Броня</b><p>Полученный урон = сырой урон × (1 − броня). Например 100 урона против 20% брони превращаются в 80.</p></article>
      <article><b>DPS</b><p>Сила удара × атак в секунду × средний коэффициент крита. Это ориентир, а не гарантия: движение и выбор цели меняют реальный результат.</p></article>
      <article><b>Сила команды</b><p>Сводный показатель из эффективного здоровья, DPS, лечения, дальности и урона по области. ИИ ориентируется на него, но расстановка может победить более сильную цифру.</p></article>
    </div><div class="modal-actions"><button class="secondary" data-action="close-modal">Закрыть</button></div>`, { wide: true });
}

function showGuide() {
  showModal(`<p class="eyebrow">ПОДРОБНЫЕ ПРАВИЛА</p><h2>Два магазина и один забег</h2>
    <div class="guide-steps">
      <article><span>1</span><div><b>Внешняя лавка</b><p>На главном экране тратятся постоянные монеты: покупай осколки карт, артефакты и косметические темы. Всё остаётся между забегами.</p></div></article>
      <article><span>2</span><div><b>Магазин забега</b><p>Внутри матча используется временное золото. Нажатие на карту покупает героя 1★. Кнопка i показывает точные характеристики до покупки. Обновление стоит 1 золото.</p></div></article>
      <article><span>3</span><div><b>Расстановка</b><p>Выбери героя, затем клетку. Верхний ряд ближе к противнику: туда обычно идут танки. Стрелков и поддержку выгодно держать сзади.</p></div></article>
      <article><span>4</span><div><b>Объединение</b><p>Два одинаковых героя одной звезды объединяются: 1★ + 1★ → 2★, затем 2★ + 2★ → 3★. Максимум — 3★.</p></div></article>
      <article><span>5</span><div><b>Синергии</b><p>Два разных героя одной фракции активируют числовой бонус. Нажми значок синергии над скамьёй, чтобы увидеть точный эффект.</p></div></article>
      <article><span>6</span><div><b>Экономика</b><p>После раунда: 5 базового дохода, +1 за каждые сохранённые 5 золотых (максимум +3) и до +2 за серию побед или поражений.</p></div></article>
      <article><span>7</span><div><b>Замок магазина</b><p>Закрытый замок сохраняет текущие предложения на следующий раунд. Купленные места останутся пустыми, пока не обновишь магазин.</p></div></article>
    </div><div class="modal-actions"><button class="primary" data-action="close-modal">Понятно</button></div>`, { wide: true });
}

function showMatchHelp() {
  const match = save.match;
  const odds = shopOddsForRound(match.round);
  showModal(`<p class="eyebrow">ТЕКУЩИЙ ЗАБЕГ</p><h2>Раунд ${match.round}</h2><div class="stat-list compact"><div class="stat-row"><span>Лимит поля</span><b>${teamCapForRound(match.round)} героев</b></div><div class="stat-row"><span>Шансы магазина</span><b>${odds.common}% / ${odds.rare}% / ${odds.epic}%</b></div><div class="stat-row"><span>Проценты от золота</span><b>+${Math.min(3, Math.floor(match.gold / 5))}</b></div><div class="stat-row"><span>Текущая серия</span><b>${match.streak > 0 ? `+${match.streak} побед` : match.streak < 0 ? `${Math.abs(match.streak)} пораж.` : 'нет'}</b></div></div><p class="small-note">Серый / синий / фиолетовый проценты выше соответствуют обычным, редким и эпическим героям.</p><div class="modal-actions"><button class="secondary" data-action="show-guide">Полные правила</button><button class="secondary" data-action="close-modal">Закрыть</button></div>`);
}

function showOnboarding() {
  showModal(`<div class="onboarding-step"><div class="onboarding-icon">✦</div><p class="eyebrow">ОБНОВЛЕНИЕ 0.2</p><h2>Теперь видно, почему герой побеждает</h2><p>У каждого персонажа есть точные характеристики, способность, история и собственная векторная 2,5D модель. Внешняя лавка отделена от магазина внутри забега.</p></div><div class="reward-row"><span class="reward">❤ Статы</span><span class="reward">♜ 8 героев</span><span class="reward">◇ 2 магазина</span><span class="reward">✦ 2,5D бой</span></div><div class="modal-actions"><button class="primary" data-action="onboarding-done">Открыть игру</button><button class="secondary" data-action="show-guide">Прочитать правила</button></div>`, { dismissible: false });
}

function resetProgress() {
  showModal(`<h2>Сбросить прогресс?</h2><p>Удалятся уровни, монеты, покупки, статистика и текущий забег.</p><div class="modal-actions"><button class="danger" data-action="reset-progress-confirm">Да, удалить всё</button><button class="secondary" data-action="close-modal">Отмена</button></div>`);
}

function renderCurrent() {
  if (currentScreen === 'collection') renderCollection();
  else if (currentScreen === 'store') renderStore();
  else if (currentScreen === 'wizard') renderWizard();
  else if (currentScreen === 'match' && save.match?.active) renderMatch();
  else renderHome();
}

function handleAction(action, element) {
  switch (action) {
    case 'home': battleRunning ? toast('Сначала дождись конца боя.') : renderHome(); break;
    case 'collection': renderCollection(); break;
    case 'store': renderStore(); break;
    case 'wizard': renderWizard(); break;
    case 'new-match': closeModal(); createInitialMatch(); renderMatch(); break;
    case 'continue-match': currentScreen = 'match'; renderMatch(); break;
    case 'slot': case 'select-unit': selectOrMove(element.dataset.zone, Number(element.dataset.index)); break;
    case 'buy-shop': buyShop(Number(element.dataset.index)); break;
    case 'show-shop-unit': {
      const unitId = save.match.shop[Number(element.dataset.index)];
      if (unitId) showUnitDetails({ unitId, star: 1 }, { includeMatch: false });
      break;
    }
    case 'reroll': rerollShop(); break;
    case 'toggle-shop-lock': save.match.locked = !save.match.locked; persist(); renderMatch(); toast(save.match.locked ? 'Магазин сохранится после раунда.' : 'Магазин снова будет обновляться.'); break;
    case 'toggle-artifact': toggleArtifact(); break;
    case 'start-battle': startBattle(); break;
    case 'next-round': closeModal(); renderMatch(); break;
    case 'close-modal': closeModal(); break;
    case 'modal-backdrop': closeModal(); break;
    case 'sell-unit': {
      const zone = element.dataset.zone;
      const index = Number(element.dataset.index);
      const arr = getZoneArray(zone);
      const unit = arr[index];
      if (unit) {
        const def = UNIT_DEFS[unit.unitId];
        const price = Math.max(1, Math.floor(def.cost * Math.pow(2, unit.star - 1) * .65));
        arr[index] = null; save.match.gold += price; selection = null; closeModal(); refreshEnemyForPowerChange(); persist(); renderMatch(); toast(`Продано за ${price} 🪙`);
      }
      break;
    }
    case 'upgrade-card': upgradeCard(element.dataset.unit); break;
    case 'show-unit-info': showUnitDetails({ unitId: element.dataset.unit, star: 1 }, { includeMatch: false }); break;
    case 'show-synergy': showSynergy(element.dataset.trait); break;
    case 'show-stats-help': showStatsHelp(); break;
    case 'stat-help': showStatsHelp(element.dataset.stat); break;
    case 'show-formulas': showFormulas(); break;
    case 'show-guide': showGuide(); break;
    case 'show-match-help': showMatchHelp(); break;
    case 'buy-meta-offer': buyMetaOffer(element.dataset.offer); break;
    case 'skin-action': skinAction(element.dataset.skin); break;
    case 'premium-preview': togglePremiumPreview(); break;
    case 'toggle-sound': save.settings.sound = !save.settings.sound; persist(); renderWizard(); break;
    case 'toggle-haptics': save.settings.haptics = !save.settings.haptics; persist(); renderWizard(); break;
    case 'toggle-motion': save.settings.reducedMotion = !save.settings.reducedMotion; persist(); renderWizard(); break;
    case 'onboarding-done': save.onboarded = true; persist(); closeModal(); break;
    case 'finish-match': closeModal(); save.match = null; persist(); renderHome(); break;
    case 'reset-progress': resetProgress(); break;
    case 'reset-progress-confirm': save = defaultSave(); persist(); closeModal(); renderHome(); showOnboarding(); break;
  }
}

document.addEventListener('click', (event) => {
  const element = event.target.closest('[data-action]');
  if (!element || element.disabled) return;
  if (element.dataset.action === 'modal-backdrop' && event.target !== element) return;
  handleAction(element.dataset.action, element);
});

document.addEventListener('contextmenu', (event) => event.preventDefault());
window.addEventListener('beforeunload', persist);
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));

renderHome();
if (!save.onboarded || save.version < 2) showOnboarding();
