import {
  CARD_UPGRADE_COSTS,
  MAX_CARD_LEVEL,
  TRAITS,
  UNIT_DEFS,
  UNIT_IDS
} from './data.js';
import {
  activeTraits,
  applyWizardXp,
  calculateTeamPower,
  canMerge,
  createBattle,
  createShop,
  experienceToNextWizardLevel,
  generateEnemyTeam,
  incomeForRound,
  mergeUnits,
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
  return Object.fromEntries(UNIT_IDS.map((id, index) => [id, {
    level: 1,
    shards: index < 3 ? 8 : 4
  }]));
}

function defaultSave() {
  return {
    version: 1,
    onboarded: false,
    profile: {
      wizardLevel: 1,
      wizardXp: 0,
      coins: 180,
      artifactStock: 8,
      premiumPreview: false,
      skin: 'violet'
    },
    cards: defaultCards(),
    stats: { matches: 0, wins: 0, bestRound: 0, totalMerges: 0 },
    settings: { sound: true, haptics: true },
    match: null
  };
}

function loadSave() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!parsed || parsed.version !== 1) return defaultSave();
    const base = defaultSave();
    return {
      ...base,
      ...parsed,
      profile: { ...base.profile, ...parsed.profile },
      cards: { ...base.cards, ...parsed.cards },
      stats: { ...base.stats, ...parsed.stats },
      settings: { ...base.settings, ...parsed.settings }
    };
  } catch {
    return defaultSave();
  }
}

let save = loadSave();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  } catch {
    // The game still works when storage is unavailable (for example, strict private mode).
  }
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
  setTimeout(() => el.remove(), 2700);
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
    oscillator.frequency.value = frequency;
    gain.gain.value = volume;
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
    oscillator.stop(audioContext.currentTime + duration);
  } catch { /* Audio is optional. */ }
}

function showModal(content, { dismissible = true } = {}) {
  modalRoot.innerHTML = `<div class="modal-backdrop" ${dismissible ? 'data-action="modal-backdrop"' : ''}><section class="modal">${content}</section></div>`;
}

function closeModal() {
  modalRoot.innerHTML = '';
}

function stars(star) {
  return '★'.repeat(star);
}

function unitToken(unit, zone, index) {
  const def = UNIT_DEFS[unit.unitId];
  const level = save.cards[unit.unitId]?.level || 1;
  const isSelected = selection?.zone === zone && selection?.index === index;
  const selectedUnit = getSelectedUnit();
  const mergeTarget = selectedUnit && canMerge(selectedUnit, unit) && !isSelected;
  return `<button class="unit-token ${def.rarity}" data-action="select-unit" data-zone="${zone}" data-index="${index}" aria-label="${def.name}, ${unit.star} звезда">
    <span>${def.icon}</span><span class="unit-level">${level}</span><span class="unit-stars">${stars(unit.star)}</span>
  </button>`;
}

function homeTemplate() {
  const hasMatch = Boolean(save.match?.active);
  const winRate = save.stats.matches ? Math.round(save.stats.wins / save.stats.matches * 100) : 0;
  const bonus = ((save.profile.wizardLevel - 1) * 0.1).toFixed(1);
  return `<section class="hero">
    <p class="eyebrow">ПРОТОТИП 0.1 · ОДИНОЧНЫЙ ЗАБЕГ</p>
    <h1>Merge<br>Arcana</h1>
    <p class="hero-copy">Собирай отряд, объединяй одинаковых бойцов и переживи десять всё более опасных раундов.</p>
    <div class="hero-actions">
      <button class="primary" data-action="${hasMatch ? 'continue-match' : 'new-match'}">${hasMatch ? 'Продолжить забег' : 'Начать забег'}</button>
      ${hasMatch ? '<button class="secondary" data-action="new-match-confirm">Новый</button>' : ''}
    </div>
  </section>
  <div class="section-title"><h2>Твой прогресс</h2><span>сохраняется автоматически</span></div>
  <div class="card-grid">
    <article class="info-card"><strong>${save.profile.wizardLevel}</strong><small>уровень заклинателя<br>+${bonus}% ко всем статам</small></article>
    <article class="info-card"><strong>${save.stats.bestRound}/10</strong><small>лучший достигнутый<br>раунд</small></article>
    <article class="info-card"><strong>${save.stats.matches}</strong><small>завершённых<br>забегов</small></article>
    <article class="info-card"><strong>${winRate}%</strong><small>полных побед<br>в забегах</small></article>
  </div>
  <article class="premium-card">
    <span class="icon">👑</span><div><strong>Пример подписки</strong><p>Без рекламы, больше полезного пространства, золотой скин и 100 артефактов.</p></div>
    <button class="switch ${save.profile.premiumPreview ? 'on' : ''}" data-action="premium-preview" aria-label="Предпросмотр подписки"></button>
  </article>
  <p class="small-note" style="margin:12px 4px 0">Это тест монетизации, а не настоящая покупка. Переключатель нужен, чтобы сравнить обе версии интерфейса.</p>`;
}

function renderHome() {
  currentScreen = 'home';
  selection = null;
  screen.className = 'screen';
  screen.innerHTML = homeTemplate();
  updateChrome();
}

function renderCollection() {
  currentScreen = 'collection';
  selection = null;
  screen.className = 'screen';
  const cards = UNIT_IDS.map((id) => {
    const def = UNIT_DEFS[id];
    const card = save.cards[id];
    const cost = CARD_UPGRADE_COSTS[card.level];
    const maxed = card.level >= MAX_CARD_LEVEL;
    const progress = maxed ? 100 : Math.min(100, card.shards / cost.shards * 100);
    const canUpgrade = !maxed && card.shards >= cost.shards && save.profile.coins >= cost.coins;
    return `<article class="collection-card ${def.rarity}">
      <div class="collection-art">${def.icon}</div>
      <div class="collection-body">
        <h3>${def.name} · ур. ${card.level}</h3>
        <div class="collection-meta">${def.role} · ${TRAITS[def.trait].name}</div>
        <div class="progress"><i style="width:${progress}%"></i></div>
        <div class="upgrade-row"><small>${maxed ? 'Максимум' : `${card.shards}/${cost.shards} оск.`}</small>
        <button data-action="upgrade-card" data-unit="${id}" ${canUpgrade ? '' : 'disabled'}>${maxed ? 'MAX' : `${cost.coins} 🪙`}</button></div>
      </div>
    </article>`;
  }).join('');
  screen.innerHTML = `<div class="section-title" style="margin-top:3px"><h2>Коллекция</h2><span>максимум 10 уровней</span></div>
    <p class="small-note">Каждый уровень карты даёт +6% к её базовым характеристикам. Осколки выдаются после забегов.</p>
    <div class="collection-grid">${cards}</div>`;
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
  screen.innerHTML = `<div class="wizard-portrait">🧙</div>
    <div style="text-align:center"><p class="eyebrow">ЗАКЛИНАТЕЛЬ</p><h2 style="margin-bottom:6px">Архонт, уровень ${level}</h2><p class="small-note">Бесконечная мета-прокачка: каждый уровень даёт +0,1% ко всем характеристикам твоих бойцов.</p></div>
    <div class="progress" style="height:10px;margin:15px 0 5px"><i style="width:${progress}%"></i></div>
    <p class="small-note" style="text-align:center">${save.profile.wizardXp} / ${required} опыта до следующего уровня</p>
    <div class="stat-list">
      <div class="stat-row"><span>Постоянный бонус</span><b>+${bonus}%</b></div>
      <div class="stat-row"><span>Артефакты на складе</span><b>${save.profile.artifactStock}</b></div>
      <div class="stat-row"><span>Всего объединений</span><b>${save.stats.totalMerges}</b></div>
      <div class="stat-row"><span>Звук</span><button class="switch ${save.settings.sound ? 'on' : ''}" data-action="toggle-sound"></button></div>
      <div class="stat-row"><span>Вибрация</span><button class="switch ${save.settings.haptics ? 'on' : ''}" data-action="toggle-haptics"></button></div>
    </div>
    <article class="premium-card">
      <span class="icon">👑</span><div><strong>Подписка · $5/месяц</strong><p>Пока только интерактивный макет для сравнения ощущений.</p></div>
      <button class="switch ${save.profile.premiumPreview ? 'on' : ''}" data-action="premium-preview"></button>
    </article>
    <button class="ghost" style="width:100%;margin-top:14px" data-action="show-help">Как играть</button>
    <button class="danger" style="width:100%;margin-top:8px" data-action="reset-progress">Сбросить тестовый прогресс</button>`;
  updateChrome();
}

function createInitialMatch() {
  const board = Array(9).fill(null);
  const bench = Array(5).fill(null);
  board[1] = makeUnit('guardian', 1, 1);
  board[7] = makeUnit('ranger', 1, 7);
  bench[0] = makeUnit('duelist', 1, 0);
  const match = {
    active: true,
    round: 1,
    lives: 3,
    wins: 0,
    streak: 0,
    gold: 10,
    board,
    bench,
    shop: createShop(1),
    locked: false,
    artifactActive: false,
    enemyTeam: null,
    lastIncome: 0
  };
  save.match = match;
  ensureEnemyTeam();
  persist();
}

function ensureEnemyTeam() {
  if (!save.match || save.match.enemyTeam) return;
  const playerPower = Math.max(230, calculateTeamPower(boardUnits(), cardLevels(), save.profile.wizardLevel, save.match.artifactActive));
  save.match.enemyTeam = generateEnemyTeam({ round: save.match.round, playerPower });
}

function getZoneArray(zone) {
  return zone === 'board' ? save.match.board : save.match.bench;
}

function getSelectedUnit() {
  if (!selection || !save.match) return null;
  return getZoneArray(selection.zone)[selection.index];
}

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
    showUnitDetails(targetUnit, zone, index);
    return;
  }
  const sourceArray = getZoneArray(selection.zone);
  const sourceUnit = sourceArray[selection.index];
  if (!sourceUnit) {
    selection = null;
    renderMatch();
    return;
  }

  if (targetUnit && canMerge(sourceUnit, targetUnit)) {
    const merged = mergeUnits(sourceUnit, targetUnit);
    merged.slot = index;
    targetArray[index] = merged;
    sourceArray[selection.index] = null;
    save.stats.totalMerges += 1;
    selection = null;
    tone(720, .12, .05);
    haptic([20, 35, 35]);
    toast(`${UNIT_DEFS[merged.unitId].name}: теперь ${merged.star}★`);
    refreshEnemyForPowerChange();
    persist();
    renderMatch();
    return;
  }

  const sourceWasBench = selection.zone === 'bench';
  const targetIsBoard = zone === 'board';
  if (sourceWasBench && targetIsBoard && !targetUnit && boardUnits().length >= teamCapForRound(save.match.round)) {
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

function showUnitDetails(unit, zone, index) {
  const def = UNIT_DEFS[unit.unitId];
  const sellPrice = Math.max(1, Math.floor(def.cost * Math.pow(2, unit.star - 1) * 0.65));
  showModal(`<div class="unit-detail"><div class="big-icon">${def.icon}</div><div><h2>${def.name} ${stars(unit.star)}</h2><p style="margin:0">${def.role} · ${TRAITS[def.trait].name}</p></div></div>
    <p>${def.description}</p>
    <div class="reward-row"><span class="reward">Карта: ур. ${save.cards[unit.unitId].level}</span><span class="reward">Продажа: ${sellPrice} 🪙</span></div>
    <div class="modal-actions"><button class="danger" data-action="sell-unit" data-zone="${zone}" data-index="${index}">Продать</button><button class="secondary" data-action="close-modal">Вернуться</button></div>`);
}

function buyShop(index) {
  if (!save.match || battleRunning) return;
  const unitId = save.match.shop[index];
  if (!unitId) return;
  const def = UNIT_DEFS[unitId];
  if (save.match.gold < def.cost) return toast('Не хватает золота.');
  let zone = 'bench';
  let slot = save.match.bench.findIndex((unit) => !unit);
  if (slot < 0 && boardUnits().length < teamCapForRound(save.match.round)) {
    zone = 'board';
    slot = save.match.board.findIndex((unit) => !unit);
  }
  if (slot < 0) return toast('Нет свободного места. Сначала объедини или продай бойца.');
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
  const counts = units.reduce((acc, unit) => {
    const trait = UNIT_DEFS[unit.unitId].trait;
    acc[trait] = (acc[trait] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(TRAITS).map(([id, trait]) => `<span class="synergy ${actives[id] ? 'active' : ''}" title="${trait.description}">${trait.icon} ${trait.name} ${counts[id] || 0}/${trait.threshold}</span>`).join('');
}

function renderMatch() {
  currentScreen = 'match';
  ensureEnemyTeam();
  const match = save.match;
  const units = boardUnits();
  const cap = teamCapForRound(match.round);
  const power = calculateTeamPower(units, cardLevels(), save.profile.wizardLevel, match.artifactActive);
  const selectedUnit = getSelectedUnit();
  const board = match.board.map((unit, index) => {
    const isSelected = selection?.zone === 'board' && selection.index === index;
    const mergeTarget = unit && selectedUnit && canMerge(selectedUnit, unit) && !isSelected;
    return `<div class="board-slot ${index < 3 ? 'front' : ''} ${isSelected ? 'selected' : ''} ${mergeTarget ? 'merge-target' : ''}" data-action="slot" data-zone="board" data-index="${index}">${unit ? unitToken(unit, 'board', index) : ''}</div>`;
  }).join('');
  const bench = match.bench.map((unit, index) => {
    const isSelected = selection?.zone === 'bench' && selection.index === index;
    const mergeTarget = unit && selectedUnit && canMerge(selectedUnit, unit) && !isSelected;
    return `<div class="bench-slot ${isSelected ? 'selected' : ''} ${mergeTarget ? 'merge-target' : ''}" data-action="slot" data-zone="bench" data-index="${index}">${unit ? unitToken(unit, 'bench', index) : ''}</div>`;
  }).join('');
  const shop = match.shop.map((unitId, index) => {
    if (!unitId) return `<button class="shop-card sold" disabled></button>`;
    const def = UNIT_DEFS[unitId];
    return `<button class="shop-card ${def.rarity}" data-action="buy-shop" data-index="${index}" ${match.gold < def.cost ? 'disabled' : ''}><span class="shop-icon">${def.icon}</span><span class="shop-name">${def.name}</span><span class="shop-cost">${def.cost} 🪙</span></button>`;
  }).join('');
  const enemy = match.enemyTeam.map((unit) => `<span class="mini-unit">${UNIT_DEFS[unit.unitId].icon}<b>${unit.star}★</b></span>`).join('');
  const hearts = '❤️'.repeat(match.lives) + '🖤'.repeat(3 - match.lives);
  const artifactCount = save.profile.artifactStock;
  screen.className = 'screen match-screen';
  screen.innerHTML = `<div class="match-header"><div class="life-row">${hearts}</div><div class="round-pill">Раунд <b>${match.round}</b>/10</div><div class="match-economy"><b>${match.gold}</b> 🪙 · сила ${power}</div></div>
    <section class="arena-wrap" id="arena">
      <div class="enemy-preview"><span class="enemy-title">Соперник · ${match.enemyTeam.length} бойцов</span><div class="enemy-icons">${enemy}</div></div>
      <div class="plan-board">${board}</div><span class="team-cap">Отряд ${units.length}/${cap}</span><div id="battle-layer" class="battle-layer"></div>
    </section>
    <section class="deploy-panel"><div class="synergies">${renderSynergies(units)}</div><div class="bench">${bench}</div><div class="shop-row">${shop}</div></section>
    <div class="match-controls">
      <button class="icon-button" data-action="reroll" ${battleRunning ? 'disabled' : ''}>↻<small style="display:block;font-size:8px">1 🪙</small></button>
      <button class="icon-button artifact-button ${match.artifactActive ? 'active' : ''}" data-action="toggle-artifact" ${battleRunning || artifactCount <= 0 ? 'disabled' : ''}>💎<small>${artifactCount}</small></button>
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
  if (save.match.artifactActive) toast('Артефакт готов: +10% ко всем статам в этом раунде.');
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
  const battle = createBattle({
    playerUnits,
    enemyUnits: save.match.enemyTeam,
    cardLevels: cardLevels(),
    wizardLevel: save.profile.wizardLevel,
    artifactActive: save.match.artifactActive
  });
  const layer = document.querySelector('#battle-layer');
  const boardLayer = document.querySelector('.plan-board');
  const preview = document.querySelector('.enemy-preview');
  if (boardLayer) boardLayer.style.opacity = '.2';
  if (preview) preview.style.opacity = '.25';
  for (const unit of battle.units) {
    const el = document.createElement('div');
    el.id = `combat-${unit.combatId}`;
    el.className = `combatant ${unit.side}`;
    el.innerHTML = `<div class="avatar">${UNIT_DEFS[unit.unitId].icon}</div><div class="hpbar"><i></i></div>`;
    layer.append(el);
  }

  let last = performance.now();
  let accumulator = 0;
  const result = await new Promise((resolve) => {
    function frame(now) {
      const rawDt = Math.min(.05, (now - last) / 1000);
      last = now;
      accumulator += rawDt * 1.35;
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
  await new Promise((resolve) => setTimeout(resolve, 550));
  battleRunning = false;
  finishRound(result === 'player');
}

function updateCombatants(units) {
  for (const unit of units) {
    const el = document.querySelector(`#combat-${CSS.escape(unit.combatId)}`);
    if (!el) continue;
    el.style.left = `${unit.x}%`;
    el.style.top = `${unit.y}%`;
    el.classList.toggle('dead', unit.dead);
    const hp = Math.max(0, unit.hp / unit.maxHp * 100);
    el.querySelector('.hpbar i').style.width = `${hp}%`;
  }
}

function processBattleEvents(events, units, layer) {
  for (const event of events) {
    if (event.type === 'hit' || event.type === 'heal') {
      const target = units.find((unit) => unit.combatId === event.to);
      if (!target) continue;
      const pop = document.createElement('span');
      pop.className = `damage-pop ${event.type === 'heal' ? 'heal' : ''}`;
      pop.style.left = `${target.x}%`;
      pop.style.top = `${target.y}%`;
      pop.textContent = `${event.type === 'heal' ? '+' : '-'}${event.amount}`;
      layer.append(pop);
      setTimeout(() => pop.remove(), 700);
      if (event.type === 'hit' && Math.random() < .12) tone(180, .025, .012);
    }
  }
}

function finishRound(won) {
  const match = save.match;
  if (won) {
    match.wins += 1;
    match.streak = match.streak >= 0 ? match.streak + 1 : 1;
    tone(790, .18, .05);
    haptic([25, 50, 25]);
  } else {
    match.lives -= 1;
    match.streak = match.streak <= 0 ? match.streak - 1 : -1;
    tone(170, .22, .04);
    haptic(80);
  }
  const completedRound = match.round;
  save.stats.bestRound = Math.max(save.stats.bestRound, completedRound);
  const gameOver = match.lives <= 0;
  const victory = won && completedRound >= 10;
  if (gameOver || victory) {
    concludeMatch(victory);
    return;
  }
  const income = incomeForRound(match.gold, match.streak);
  match.lastIncome = income;
  match.gold += income;
  match.round += 1;
  match.artifactActive = false;
  match.enemyTeam = null;
  if (!match.locked) match.shop = createShop(match.round);
  ensureEnemyTeam();
  persist();
  showModal(`<div style="text-align:center"><div class="onboarding-icon">${won ? '🏆' : '🩹'}</div><h2>${won ? 'Раунд выигран' : 'Раунд проигран'}</h2><p>${won ? 'Расстановка сработала.' : `Осталось жизней: ${match.lives}. Попробуй изменить переднюю линию или собрать синергию.`}</p></div>
    <div class="reward-row"><span class="reward">+${income} 🪙 доход</span><span class="reward">Лимит: ${teamCapForRound(match.round)}</span><span class="reward">Серия: ${Math.abs(match.streak)}</span></div>
    <div class="modal-actions"><button class="primary" data-action="next-round">К раунду ${match.round}</button></div>`, { dismissible: false });
}

function concludeMatch(victory) {
  const match = save.match;
  const reached = match.round;
  const coinReward = 28 + reached * 7 + match.wins * 8 + (victory ? 90 : 0);
  const xpReward = 18 + reached * 5 + match.wins * 4 + (victory ? 55 : 0);
  const shardRewards = [];
  const shuffled = [...UNIT_IDS].sort(() => Math.random() - .5).slice(0, 2);
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
  const shards = shardRewards.map(({ id, amount }) => `<span class="reward">${UNIT_DEFS[id].icon} +${amount}</span>`).join('');
  showModal(`<div style="text-align:center"><div class="onboarding-icon">${victory ? '👑' : '🌙'}</div><h2>${victory ? 'Арена покорена!' : 'Забег завершён'}</h2><p>${victory ? 'Ты пережил все десять раундов.' : `Ты дошёл до ${reached}-го раунда. Награды уже добавлены к постоянному прогрессу.`}</p></div>
    <div class="reward-row"><span class="reward">+${coinReward} 🪙</span><span class="reward">+${xpReward} опыта</span>${shards}</div>
    <div class="modal-actions"><button class="primary" data-action="finish-match">На главную</button><button class="secondary" data-action="new-match">Ещё один забег</button></div>`, { dismissible: false });
}

function upgradeCard(unitId) {
  const card = save.cards[unitId];
  if (card.level >= MAX_CARD_LEVEL) return;
  const cost = CARD_UPGRADE_COSTS[card.level];
  if (card.shards < cost.shards || save.profile.coins < cost.coins) return;
  card.shards -= cost.shards;
  save.profile.coins -= cost.coins;
  card.level += 1;
  tone(800, .15, .05);
  haptic([20, 30, 20]);
  persist();
  toast(`${UNIT_DEFS[unitId].name} улучшен до ${card.level} уровня.`);
  renderCollection();
}

function togglePremiumPreview() {
  save.profile.premiumPreview = !save.profile.premiumPreview;
  if (save.profile.premiumPreview) {
    save.profile.artifactStock = Math.max(100, save.profile.artifactStock);
    toast('Предпросмотр подписки включён: реклама скрыта, выдано 100 артефактов.');
  } else {
    toast('Бесплатный интерфейс включён. Артефакты остаются для теста.');
  }
  persist();
  renderCurrent();
}

function showHelp() {
  showModal(`<div class="onboarding-step"><div class="onboarding-icon">🧩</div><h2>Как играть</h2></div>
    <p><b>1.</b> Покупай бойцов в магазине. Они сначала попадают на скамью.</p>
    <p><b>2.</b> Нажми бойца, затем свободную клетку — он переместится. Нажми двух одинаковых бойцов одной звезды — они объединятся.</p>
    <p><b>3.</b> Верхний ряд поля — передняя линия. Танков ставь туда, стрелков и поддержку — назад.</p>
    <p><b>4.</b> Две карты одной специализации включают синергию. Артефакт 💎 даёт +10% в выбранном раунде и расходуется.</p>
    <p><b>5.</b> За каждые сохранённые 5 золотых получаешь +1 дохода, максимум +3.</p>
    <div class="modal-actions"><button class="primary" data-action="close-modal">Понятно</button></div>`);
}

function showOnboarding() {
  showModal(`<div class="onboarding-step"><div class="onboarding-icon">✦</div><p class="eyebrow">ДОБРО ПОЖАЛОВАТЬ</p><h2>Твоя первая версия Merge Arcana</h2><p>Я выбрал короткий одиночный формат: один забег занимает примерно 8–15 минут, а прогресс карт и заклинателя остаётся между попытками.</p></div>
    <div class="reward-row"><span class="reward">🛒 Покупай</span><span class="reward">🧩 Объединяй</span><span class="reward">⚔️ Наблюдай бой</span></div>
    <div class="modal-actions"><button class="primary" data-action="onboarding-done">Начать знакомство</button><button class="secondary" data-action="show-help">Сначала правила</button></div>`, { dismissible: false });
}

function resetProgress() {
  showModal(`<h2>Сбросить прогресс?</h2><p>Удалятся уровни, монеты, статистика и текущий забег. Это действие нужно только для повторной проверки первого запуска.</p><div class="modal-actions"><button class="danger" data-action="reset-progress-confirm">Да, удалить всё</button><button class="secondary" data-action="close-modal">Отмена</button></div>`);
}

function renderCurrent() {
  if (currentScreen === 'collection') renderCollection();
  else if (currentScreen === 'wizard') renderWizard();
  else if (currentScreen === 'match' && save.match?.active) renderMatch();
  else renderHome();
}

function handleAction(action, element) {
  switch (action) {
    case 'home':
      if (battleRunning) toast('Сначала дождись завершения боя.');
      else renderHome();
      break;
    case 'collection': renderCollection(); break;
    case 'wizard': renderWizard(); break;
    case 'new-match': closeModal(); createInitialMatch(); renderMatch(); break;
    case 'new-match-confirm':
      showModal(`<h2>Начать заново?</h2><p>Текущий забег будет завершён без наград, но постоянный прогресс не пропадёт.</p><div class="modal-actions"><button class="danger" data-action="new-match">Начать новый</button><button class="secondary" data-action="close-modal">Продолжить старый</button></div>`);
      break;
    case 'continue-match': currentScreen = 'match'; renderMatch(); break;
    case 'slot': selectOrMove(element.dataset.zone, Number(element.dataset.index)); break;
    case 'select-unit': selectOrMove(element.dataset.zone, Number(element.dataset.index)); break;
    case 'buy-shop': buyShop(Number(element.dataset.index)); break;
    case 'reroll': rerollShop(); break;
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
        arr[index] = null;
        save.match.gold += price;
        selection = null;
        closeModal();
        refreshEnemyForPowerChange();
        persist();
        renderMatch();
        toast(`Продано за ${price} 🪙`);
      }
      break;
    }
    case 'upgrade-card': upgradeCard(element.dataset.unit); break;
    case 'premium-preview': togglePremiumPreview(); break;
    case 'toggle-sound': save.settings.sound = !save.settings.sound; persist(); renderWizard(); break;
    case 'toggle-haptics': save.settings.haptics = !save.settings.haptics; persist(); renderWizard(); break;
    case 'show-help': showHelp(); break;
    case 'onboarding-done': save.onboarded = true; persist(); closeModal(); break;
    case 'finish-match': closeModal(); save.match = null; persist(); renderHome(); break;
    case 'reset-progress': resetProgress(); break;
    case 'reset-progress-confirm':
      save = defaultSave();
      persist();
      closeModal();
      renderHome();
      showOnboarding();
      break;
  }
}

document.addEventListener('click', (event) => {
  const element = event.target.closest('[data-action]');
  if (!element || element.disabled) return;
  const action = element.dataset.action;
  if (action === 'modal-backdrop' && event.target !== element) return;
  handleAction(action, element);
});

document.addEventListener('contextmenu', (event) => event.preventDefault());

window.addEventListener('beforeunload', persist);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

renderHome();
if (!save.onboarded) showOnboarding();
