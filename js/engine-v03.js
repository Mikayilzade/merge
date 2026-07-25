import {
  MAX_STAR,
  RARITY,
  SHOP_ODDS,
  STAR_MULTIPLIERS,
  TRAITS,
  UNIT_DEFS,
  UNIT_IDS
} from './data.js';

export const HEX_COLS = 7;
export const HEX_ROWS = 7;
const HEX_DIRS_EVEN = [[1,0],[-1,0],[0,-1],[-1,-1],[0,1],[-1,1]];
const HEX_DIRS_ODD = [[1,0],[-1,0],[1,-1],[0,-1],[1,1],[0,1]];

export function seededRandom(seed = Date.now()) {
  let value = Math.abs(Number(seed)) % 2147483647 || 1;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

export function weightedPick(entries, random = Math.random) {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = random() * total;
  for (const entry of entries) {
    cursor -= entry.weight;
    if (cursor <= 0) return entry.value;
  }
  return entries.at(-1)?.value;
}

export function shopOddsForRound(round = 1) {
  return SHOP_ODDS.find((row) => round >= row.minRound && round <= row.maxRound) || SHOP_ODDS.at(-1);
}

export function createShop(round = 1, random = Math.random, size = 5) {
  const odds = shopOddsForRound(round);
  return Array.from({ length: size }, () => {
    const rarity = weightedPick([
      { value: 'common', weight: odds.common },
      { value: 'rare', weight: odds.rare },
      { value: 'epic', weight: odds.epic }
    ], random);
    const pool = UNIT_IDS.filter((id) => UNIT_DEFS[id].rarity === rarity);
    return pool[Math.floor(random() * pool.length)];
  });
}

export function createMetaOffers(dayKey = Math.floor(Date.now() / 86400000)) {
  const random = seededRandom(dayKey + 7713);
  const pool = [...UNIT_IDS].sort(() => random() - 0.5).slice(0, 3);
  return [
    ...pool.map((unitId, index) => ({
      id: `shards-${dayKey}-${unitId}`,
      type: 'shards', unitId,
      amount: 6 + Math.floor(random() * 5),
      price: 85 + index * 25 + (UNIT_DEFS[unitId].rarity === 'epic' ? 80 : UNIT_DEFS[unitId].rarity === 'rare' ? 35 : 0)
    })),
    { id: `artifacts-${dayKey}`, type: 'artifacts', amount: 5, price: 125 }
  ];
}

export function canMerge(a, b) {
  return Boolean(a && b && a.unitId === b.unitId && a.star === b.star && a.star < MAX_STAR);
}

export function mergeUnits(a, b) {
  if (!canMerge(a, b)) return null;
  return { ...a, uid: a.uid, star: a.star + 1, mergedFrom: [a.uid, b.uid] };
}

export function cardLevelMultiplier(level = 1) {
  return 1 + Math.max(0, level - 1) * 0.06;
}

export function wizardMultiplier(level = 1) {
  return 1 + Math.max(0, level - 1) * 0.001;
}

export function countTraits(units = []) {
  const uniqueByTrait = {};
  for (const unit of units) {
    const def = UNIT_DEFS[unit.unitId];
    if (!def?.trait) continue;
    uniqueByTrait[def.trait] ||= new Set();
    uniqueByTrait[def.trait].add(unit.unitId);
  }
  return Object.fromEntries(Object.entries(uniqueByTrait).map(([id, members]) => [id, members.size]));
}

export function activeTraits(units = []) {
  const counts = countTraits(units);
  return Object.fromEntries(Object.entries(TRAITS).map(([id, trait]) => [id, (counts[id] || 0) >= trait.threshold]));
}

export function statMultipliers(unit, options = {}) {
  const def = UNIT_DEFS[unit.unitId];
  const star = STAR_MULTIPLIERS[unit.star] || 1;
  const card = cardLevelMultiplier(options.cardLevel || 1);
  const wizard = wizardMultiplier(options.wizardLevel || 1);
  const artifact = options.artifactActive ? 1.1 : 1;
  const traits = options.activeTraits || {};
  return {
    star, card, wizard, artifact,
    hpTrait: def.trait === 'aegis' && traits.aegis ? 1.2 : 1,
    powerTrait: def.trait === 'wild' && traits.wild ? 1.18 : def.trait === 'arcane' && traits.arcane ? 1.2 : 1,
    moveTrait: def.trait === 'wild' && traits.wild ? 1.1 : 1,
    intervalTrait: def.trait === 'arcane' && traits.arcane ? 0.92 : 1,
    armorTrait: def.trait === 'aegis' && traits.aegis ? 0.08 : 0,
    critChanceTrait: def.trait === 'veil' && traits.veil ? 0.15 : 0,
    critMultiplierTrait: def.trait === 'veil' && traits.veil ? 0.25 : 0
  };
}

export function rangeInHexes(defOrId) {
  const def = typeof defOrId === 'string' ? UNIT_DEFS[defOrId] : defOrId;
  if (!def) return 1;
  if (def.heal) return 3;
  if (def.range <= 30) return 1;
  if (def.range <= 105) return 3;
  if (def.range <= 120) return 4;
  return 5;
}

export function calculateUnitStats(unit, options = {}) {
  const def = UNIT_DEFS[unit.unitId];
  if (!def) throw new Error(`Unknown unit: ${unit.unitId}`);
  const mult = statMultipliers(unit, options);
  const common = mult.star * mult.card * mult.wizard * mult.artifact;
  const attackInterval = def.attackInterval * mult.intervalTrait;
  const attack = Math.round(def.attack * common * mult.powerTrait);
  const heal = Math.round((def.heal || 0) * common * mult.powerTrait);
  const critChance = Math.min(0.75, def.critChance + mult.critChanceTrait);
  const critMultiplier = def.critMultiplier + mult.critMultiplierTrait;
  const attackSpeed = 1 / attackInterval;
  const averagePower = (heal || attack) * (1 + critChance * (critMultiplier - 1));
  return {
    maxHp: Math.round(def.hp * common * mult.hpTrait), attack, heal,
    range: rangeInHexes(def),
    moveSpeed: Math.round(def.moveSpeed * mult.moveTrait * 10) / 10,
    attackInterval: Math.round(attackInterval * 1000) / 1000,
    attackSpeed: Math.round(attackSpeed * 100) / 100,
    armor: Math.min(0.55, def.armor + mult.armorTrait), critChance, critMultiplier,
    splash: def.splash || 0,
    dps: Math.round(averagePower * attackSpeed * 10) / 10,
    multipliers: mult
  };
}

export function calculateTeamPower(units = [], cardLevels = {}, wizardLevel = 1, artifactActive = false) {
  const traits = activeTraits(units);
  return Math.round(units.reduce((sum, unit) => {
    const stats = calculateUnitStats(unit, { cardLevel: cardLevels[unit.unitId] || 1, wizardLevel, artifactActive, activeTraits: traits });
    const effectiveHp = stats.maxHp / Math.max(0.45, 1 - stats.armor);
    const sustain = stats.heal ? stats.dps * 1.35 : 0;
    const utility = (stats.range >= 3 ? 18 : 0) + (stats.splash ? 24 : 0);
    return sum + effectiveHp * 0.3 + stats.dps * 5.2 + sustain + utility;
  }, 0));
}

export function teamCapForRound(round) {
  return Math.min(6, 3 + Math.floor((Math.max(1, round) - 1) / 3));
}

export function interestForGold(gold) {
  return Math.min(3, Math.floor(Math.max(0, gold) / 5));
}

export function incomeForRound(gold, streak = 0) {
  const streakBonus = Math.abs(streak) >= 2 ? Math.min(2, Math.floor(Math.abs(streak) / 2)) : 0;
  return 5 + interestForGold(gold) + streakBonus;
}

// Enemy generation is deterministic for a round. Repositioning or merging your army
// must never secretly replace the opponent after it has already been shown.
export function generateEnemyTeam({ round = 1 } = {}) {
  const random = seededRandom(92021 + round * 1777);
  const cap = teamCapForRound(round);
  const count = Math.min(cap, 3 + Math.floor((round - 1) / 3));
  const rarityLimit = round < 4 ? ['common', 'rare'] : ['common', 'rare', 'epic'];
  const pool = UNIT_IDS.filter((id) => rarityLimit.includes(UNIT_DEFS[id].rarity));
  const team = [];
  for (let i = 0; i < count; i += 1) {
    const unitId = pool[Math.floor(random() * pool.length)];
    let star = 1;
    if (round >= 4 && random() < Math.min(0.72, 0.13 + round * 0.055)) star = 2;
    if (round >= 8 && random() < Math.min(0.28, (round - 7) * 0.07)) star = 3;
    team.push({ uid: `enemy-${round}-${i}`, unitId, star, slot: i });
  }
  return team;
}

export function isInsideHex(col, row) {
  return col >= 0 && col < HEX_COLS && row >= 0 && row < HEX_ROWS;
}

export function hexKey(col, row) { return `${col},${row}`; }

export function hexNeighbors(col, row) {
  const dirs = row % 2 ? HEX_DIRS_ODD : HEX_DIRS_EVEN;
  return dirs.map(([dc, dr]) => ({ col: col + dc, row: row + dr })).filter((cell) => isInsideHex(cell.col, cell.row));
}

function offsetToCube(col, row) {
  const x = col - (row - (row & 1)) / 2;
  const z = row;
  const y = -x - z;
  return { x, y, z };
}

export function hexDistance(a, b) {
  const ac = offsetToCube(a.col, a.row);
  const bc = offsetToCube(b.col, b.row);
  return Math.max(Math.abs(ac.x - bc.x), Math.abs(ac.y - bc.y), Math.abs(ac.z - bc.z));
}

export function hexToPercent(col, row) {
  return { x: 9 + col * 12.7 + (row % 2 ? 6.35 : 0), y: 14 + row * 11.8 };
}

export function findHexPath(start, goal, occupied = new Set(), allowGoalOccupied = true) {
  const startKey = hexKey(start.col, start.row);
  const goalKey = hexKey(goal.col, goal.row);
  const queue = [start];
  const previous = new Map([[startKey, null]]);
  while (queue.length) {
    const current = queue.shift();
    const currentKey = hexKey(current.col, current.row);
    if (currentKey === goalKey) break;
    for (const next of hexNeighbors(current.col, current.row)) {
      const key = hexKey(next.col, next.row);
      if (previous.has(key)) continue;
      if (occupied.has(key) && !(allowGoalOccupied && key === goalKey)) continue;
      previous.set(key, current);
      queue.push(next);
    }
  }
  if (!previous.has(goalKey)) return [];
  const path = [];
  let cursor = goal;
  while (cursor && hexKey(cursor.col, cursor.row) !== startKey) {
    path.push(cursor);
    cursor = previous.get(hexKey(cursor.col, cursor.row));
  }
  return path.reverse();
}

export function ringCells(center, radius = 1) {
  const cells = [];
  for (let row = 0; row < HEX_ROWS; row += 1) {
    for (let col = 0; col < HEX_COLS; col += 1) {
      const cell = { col, row };
      if (hexDistance(center, cell) === radius) cells.push(cell);
    }
  }
  return cells;
}

function damageAfterArmor(raw, target) {
  let armor = target.armor;
  if (target.unitId === 'guardian' && target.hp <= target.maxHp * 0.45) armor = Math.min(0.55, armor + 0.1);
  return Math.max(1, Math.round(raw * (1 - armor)));
}

function initialCell(unit, side, index) {
  const slot = Number.isFinite(unit.slot) ? unit.slot : index;
  const colMap = [2, 3, 4, 1, 5, 0, 6, 2, 4];
  const localRow = Math.floor(slot / 3);
  const col = colMap[slot % colMap.length];
  const row = side === 'player' ? Math.max(4, 6 - localRow) : Math.min(2, localRow);
  return { col, row };
}

function chooseTarget(source, targets) {
  const living = targets.filter((target) => !target.dead && target.hp > 0);
  if (!living.length) return null;
  const def = UNIT_DEFS[source.unitId];
  if (def.targetMode === 'fragile') {
    return [...living].sort((a, b) => {
      const fragA = a.maxHp * (1 + a.armor);
      const fragB = b.maxHp * (1 + b.armor);
      return fragA - fragB || hexDistance(source, a) - hexDistance(source, b);
    })[0];
  }
  return [...living].sort((a, b) => hexDistance(source, a) - hexDistance(source, b) || a.hp / a.maxHp - b.hp / b.maxHp)[0];
}

function chooseHealTarget(source, allies) {
  const injured = allies.filter((ally) => !ally.dead && ally.hp > 0 && ally.hp < ally.maxHp * 0.96);
  if (!injured.length) return null;
  return [...injured].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || hexDistance(source, a) - hexDistance(source, b))[0];
}

function nextMoveCell(unit, target, occupied, desiredRange) {
  const candidates = [];
  for (let row = 0; row < HEX_ROWS; row += 1) {
    for (let col = 0; col < HEX_COLS; col += 1) {
      const key = hexKey(col, row);
      if (occupied.has(key) && key !== hexKey(unit.col, unit.row)) continue;
      const dist = hexDistance({ col, row }, target);
      if (dist <= desiredRange) candidates.push({ col, row, dist });
    }
  }
  candidates.sort((a, b) => {
    const pathA = findHexPath(unit, a, occupied, false).length || 99;
    const pathB = findHexPath(unit, b, occupied, false).length || 99;
    return pathA - pathB || Math.abs(a.dist - desiredRange) - Math.abs(b.dist - desiredRange);
  });
  for (const candidate of candidates) {
    const path = findHexPath(unit, candidate, occupied, false);
    if (path.length) return path[0];
  }
  const adjacent = hexNeighbors(unit.col, unit.row).filter((cell) => !occupied.has(hexKey(cell.col, cell.row)));
  adjacent.sort((a, b) => hexDistance(a, target) - hexDistance(b, target));
  return adjacent[0] || null;
}

function updateVisualPosition(unit) {
  const p = hexToPercent(unit.col, unit.row);
  unit.x = p.x;
  unit.y = p.y;
}

export function createBattle({
  playerUnits,
  enemyUnits,
  cardLevels = {},
  wizardLevel = 1,
  artifactActive = false,
  random = Math.random
}) {
  const pTraits = activeTraits(playerUnits);
  const eTraits = activeTraits(enemyUnits);
  const enemyCardLevel = Math.max(1, Math.floor(wizardLevel * 0.35));
  const enemyWizardLevel = Math.max(1, Math.floor(wizardLevel * 0.65));

  const makeCombatant = (unit, side, index, traits) => {
    const stats = calculateUnitStats(unit, {
      cardLevel: side === 'player' ? (cardLevels[unit.unitId] || 1) : enemyCardLevel,
      wizardLevel: side === 'player' ? wizardLevel : enemyWizardLevel,
      artifactActive: side === 'player' && artifactActive,
      activeTraits: traits
    });
    const cell = initialCell(unit, side, index);
    const combatant = {
      ...unit, ...stats, ...cell, side,
      combatId: `${side}-${unit.uid}`,
      hp: stats.maxHp,
      cooldown: 0.12 + index * 0.075,
      moveClock: 0,
      dead: false,
      attacksMade: 0,
      lastTarget: null,
      facing: side === 'player' ? 'up' : 'down',
      facingHex: side === 'player' ? 'N' : 'S',
      burnRemaining: 0,
      burnDps: 0,
      burnAccumulator: 0
    };
    updateVisualPosition(combatant);
    return combatant;
  };

  const units = [
    ...playerUnits.map((u, i) => makeCombatant(u, 'player', i, pTraits)),
    ...enemyUnits.map((u, i) => makeCombatant(u, 'enemy', i, eTraits))
  ];

  // Safety: if imported old saves place two units into the same starting cell,
  // spread later units to the nearest free hex before combat begins.
  const used = new Set();
  for (const unit of units) {
    let key = hexKey(unit.col, unit.row);
    if (used.has(key)) {
      const free = [];
      for (let row = 0; row < HEX_ROWS; row += 1) for (let col = 0; col < HEX_COLS; col += 1) {
        const candidate = { col, row };
        if (!used.has(hexKey(col, row))) free.push(candidate);
      }
      free.sort((a, b) => hexDistance(unit, a) - hexDistance(unit, b));
      if (free[0]) { unit.col = free[0].col; unit.row = free[0].row; updateVisualPosition(unit); key = hexKey(unit.col, unit.row); }
    }
    used.add(key);
  }

  let elapsed = 0;
  let finished = false;
  let winner = null;

  function step(dt) {
    if (finished) return { events: [], finished, winner, elapsed, units };
    elapsed += dt;
    const events = [];

    for (const unit of units) {
      if (unit.dead) continue;
      if (unit.burnRemaining > 0) {
        unit.burnRemaining -= dt;
        unit.burnAccumulator += dt;
        while (unit.burnAccumulator >= 0.4 && !unit.dead) {
          unit.burnAccumulator -= 0.4;
          const amount = damageAfterArmor(unit.burnDps * 0.4, unit);
          unit.hp -= amount;
          events.push({ type: 'burn', to: unit.combatId, amount });
        }
      }
    }

    for (const unit of units) {
      if (unit.dead || unit.hp <= 0) continue;
      unit.cooldown -= dt;
      unit.moveClock += dt;
      const enemies = units.filter((other) => other.side !== unit.side && !other.dead && other.hp > 0);
      const allies = units.filter((other) => other.side === unit.side && !other.dead && other.hp > 0);
      if (!enemies.length) continue;

      const def = UNIT_DEFS[unit.unitId];
      let target = def.heal ? chooseHealTarget(unit, allies) : null;
      let action = target ? 'heal' : 'attack';
      if (!target) target = chooseTarget(unit, enemies);
      if (!target) continue;

      const dist = hexDistance(unit, target);
      unit.facing = target.col < unit.col ? 'left' : target.col > unit.col ? 'right' : target.row < unit.row ? 'up' : 'down';
      unit.facingHex = `${target.col - unit.col},${target.row - unit.row}`;
      const allowedRange = action === 'heal' ? Math.max(2, unit.range) : Math.max(1, unit.range);

      if (dist <= allowedRange) {
        if (unit.cooldown <= 0) {
          unit.cooldown = unit.attackInterval;
          unit.attacksMade += 1;
          if (action === 'heal') {
            const critical = random() < unit.critChance;
            const raw = unit.heal * (critical ? unit.critMultiplier : 1);
            const amount = Math.min(Math.round(raw), target.maxHp - target.hp);
            target.hp += amount;
            events.push({ type: 'heal', from: unit.combatId, to: target.combatId, amount, critical, special: critical ? 'Критическое лечение' : null });
          } else {
            let critical = random() < unit.critChance;
            let special = null;
            if (def.firstShotCrit && unit.lastTarget !== target.combatId) { critical = true; special = 'Метка добычи'; }
            let rawDamage = unit.attack * (critical ? unit.critMultiplier : 1);
            if (def.comboEvery && unit.attacksMade % def.comboEvery === 0) { rawDamage *= def.comboMultiplier; special = 'Третий выпад'; }
            if (def.executeThreshold && target.hp / target.maxHp <= def.executeThreshold) { rawDamage *= def.executeMultiplier; special = 'Шёпот конца'; }
            const damage = damageAfterArmor(rawDamage, target);
            target.hp -= damage;
            unit.lastTarget = target.combatId;
            events.push({ type: 'hit', from: unit.combatId, to: target.combatId, amount: damage, ranged: unit.range > 1, critical, special, style: def.art.weapon });

            if (def.splash) {
              for (const other of enemies) {
                if (other === target || other.dead || other.hp <= 0) continue;
                if (hexDistance(target, other) <= 1) {
                  const splashDamage = damageAfterArmor(rawDamage * 0.42, other);
                  other.hp -= splashDamage;
                  events.push({ type: 'hit', from: unit.combatId, to: other.combatId, amount: splashDamage, splash: true, style: def.art.weapon });
                }
              }
            }
            if (def.burnRatio) {
              target.burnRemaining = def.burnDuration;
              target.burnDps = rawDamage * def.burnRatio / def.burnDuration;
              target.burnAccumulator = 0;
              events.push({ type: 'status', from: unit.combatId, to: target.combatId, status: 'burn', special: 'Живое пламя' });
            }
          }
        }
      } else {
        const occupied = new Set(units.filter((other) => other !== unit && !other.dead && other.hp > 0).map((other) => hexKey(other.col, other.row)));
        const desiredRange = Math.max(1, allowedRange);
        const stepCell = nextMoveCell(unit, target, occupied, desiredRange);
        const movementInterval = Math.max(0.16, 0.72 - unit.moveSpeed / 100);
        if (stepCell && unit.moveClock >= movementInterval) {
          unit.moveClock = 0;
          const old = { col: unit.col, row: unit.row };
          unit.col = stepCell.col;
          unit.row = stepCell.row;
          updateVisualPosition(unit);
          events.push({ type: 'move', unit: unit.combatId, from: old, to: { col: unit.col, row: unit.row } });
        }
      }
    }

    for (const unit of units) {
      if (!unit.dead && unit.hp <= 0) {
        unit.hp = 0;
        unit.dead = true;
        events.push({ type: 'death', target: unit.combatId });
      }
    }

    const playerAlive = units.some((u) => u.side === 'player' && !u.dead);
    const enemyAlive = units.some((u) => u.side === 'enemy' && !u.dead);
    if (!playerAlive || !enemyAlive || elapsed >= 42) {
      finished = true;
      if (playerAlive && !enemyAlive) winner = 'player';
      else if (enemyAlive && !playerAlive) winner = 'enemy';
      else {
        const playerHp = units.filter((u) => u.side === 'player').reduce((sum, u) => sum + Math.max(0, u.hp) / u.maxHp, 0);
        const enemyHp = units.filter((u) => u.side === 'enemy').reduce((sum, u) => sum + Math.max(0, u.hp) / u.maxHp, 0);
        winner = playerHp >= enemyHp ? 'player' : 'enemy';
      }
    }
    return { events, finished, winner, elapsed, units };
  }

  return { units, step, get finished() { return finished; }, get winner() { return winner; } };
}

export function experienceToNextWizardLevel(level) {
  return 40 + Math.floor(Math.pow(level, 1.22) * 12);
}

export function applyWizardXp(profile, gainedXp) {
  const next = { ...profile, wizardXp: (profile.wizardXp || 0) + gainedXp };
  while (next.wizardXp >= experienceToNextWizardLevel(next.wizardLevel)) {
    next.wizardXp -= experienceToNextWizardLevel(next.wizardLevel);
    next.wizardLevel += 1;
  }
  return next;
}

export function rarityLabel(rarity) {
  return RARITY[rarity]?.name || rarity;
}
