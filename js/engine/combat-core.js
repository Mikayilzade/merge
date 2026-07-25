import { UNIT_DEFS } from '../data.js';
import { activeTraits, calculateUnitStats } from './stats.js';
import { HEX_COLS, HEX_ROWS, hexDirectionIndex, hexDistance, hexKey, hexToPercent, isBackAttack } from './hex-grid.js';
import { chooseHealTarget, chooseTarget, nextMoveCell } from './targeting.js';

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

function updateVisualPosition(unit) {
  const p = hexToPercent(unit.col, unit.row);
  unit.x = p.x;
  unit.y = p.y;
}

function createReportEntry(unit) {
  return {
    combatId: unit.combatId,
    unitId: unit.unitId,
    side: unit.side,
    star: unit.star,
    damageDealt: 0,
    damageTaken: 0,
    healingDone: 0,
    kills: 0,
    attacks: 0,
    backstabs: 0
  };
}

export function createCoreBattle({ playerUnits, enemyUnits, cardLevels = {}, wizardLevel = 1, artifactActive = false, random = Math.random }) {
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
      facingIndex: side === 'player' ? 2 : 5,
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
  const report = Object.fromEntries(units.map((unit) => [unit.combatId, createReportEntry(unit)]));

  const used = new Set();
  for (const unit of units) {
    let key = hexKey(unit.col, unit.row);
    if (used.has(key)) {
      const free = [];
      for (let row = 0; row < HEX_ROWS; row += 1) {
        for (let col = 0; col < HEX_COLS; col += 1) {
          const candidate = { col, row };
          if (!used.has(hexKey(col, row))) free.push(candidate);
        }
      }
      free.sort((a, b) => hexDistance(unit, a) - hexDistance(unit, b));
      if (free[0]) {
        unit.col = free[0].col;
        unit.row = free[0].row;
        updateVisualPosition(unit);
        key = hexKey(unit.col, unit.row);
      }
    }
    used.add(key);
  }

  let elapsed = 0;
  let finished = false;
  let winner = null;
  let endReason = null;

  function addDamage(source, target, amount) {
    if (source && report[source.combatId]) report[source.combatId].damageDealt += Math.max(0, amount);
    if (target && report[target.combatId]) report[target.combatId].damageTaken += Math.max(0, amount);
  }

  function markDeaths(events, killer = null) {
    for (const unit of units) {
      if (!unit.dead && unit.hp <= 0) {
        unit.hp = 0;
        unit.dead = true;
        events.push({ type: 'death', target: unit.combatId });
        if (killer && report[killer.combatId]) report[killer.combatId].kills += 1;
      }
    }
  }

  function step(dt) {
    if (finished) return { events: [], finished, winner, elapsed, units, report, reason: endReason };
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
          if (report[unit.combatId]) report[unit.combatId].damageTaken += amount;
          events.push({ type: 'burn', to: unit.combatId, amount });
        }
      }
    }
    markDeaths(events);

    for (const unit of units) {
      if (unit.dead || unit.hp <= 0) continue;
      unit.cooldown -= dt;
      unit.moveClock += dt;
      const enemies = units.filter((other) => other.side !== unit.side && !other.dead && other.hp > 0);
      const allies = units.filter((other) => other.side === unit.side && !other.dead && other.hp > 0);
      if (!enemies.length) continue;

      const def = UNIT_DEFS[unit.unitId];
      let target = def.heal ? chooseHealTarget(unit, allies) : null;
      const action = target ? 'heal' : 'attack';
      if (!target) target = chooseTarget(unit, enemies);
      if (!target) continue;

      unit.facingIndex = hexDirectionIndex(unit, target) ?? unit.facingIndex;
      unit.facing = target.col < unit.col ? 'left' : target.col > unit.col ? 'right' : target.row < unit.row ? 'up' : 'down';
      const dist = hexDistance(unit, target);
      const allowedRange = action === 'heal' ? Math.max(2, unit.range) : Math.max(1, unit.range);

      if (dist <= allowedRange) {
        if (unit.cooldown <= 0) {
          unit.cooldown = unit.attackInterval;
          unit.attacksMade += 1;
          if (report[unit.combatId]) report[unit.combatId].attacks += 1;

          if (action === 'heal') {
            const critical = random() < unit.critChance;
            const raw = unit.heal * (critical ? unit.critMultiplier : 1);
            const amount = Math.min(Math.round(raw), target.maxHp - target.hp);
            target.hp += amount;
            if (report[unit.combatId]) report[unit.combatId].healingDone += amount;
            events.push({ type: 'heal', from: unit.combatId, to: target.combatId, amount, critical, special: critical ? 'Критическое лечение' : null });
          } else {
            const backstab = unit.unitId === 'shade' && isBackAttack(unit, target);
            let critical = backstab || random() < unit.critChance;
            let special = backstab ? 'Удар в спину' : null;
            if (backstab && report[unit.combatId]) report[unit.combatId].backstabs += 1;
            if (def.firstShotCrit && unit.lastTarget !== target.combatId) { critical = true; special = 'Метка добычи'; }
            let rawDamage = unit.attack * (critical ? unit.critMultiplier : 1);
            if (def.comboEvery && unit.attacksMade % def.comboEvery === 0) { rawDamage *= def.comboMultiplier; special = 'Третий выпад'; }
            if (def.executeThreshold && target.hp / target.maxHp <= def.executeThreshold) { rawDamage *= def.executeMultiplier; special = 'Шёпот конца'; }
            const damage = damageAfterArmor(rawDamage, target);
            target.hp -= damage;
            addDamage(unit, target, damage);
            unit.lastTarget = target.combatId;
            events.push({ type: 'hit', from: unit.combatId, to: target.combatId, amount: damage, ranged: unit.range > 1, critical, backstab, special, style: def.art.weapon });

            if (def.splash) {
              for (const other of enemies) {
                if (other === target || other.dead || other.hp <= 0) continue;
                if (hexDistance(target, other) <= 1) {
                  const splashDamage = damageAfterArmor(rawDamage * 0.42, other);
                  other.hp -= splashDamage;
                  addDamage(unit, other, splashDamage);
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
            markDeaths(events, unit);
          }
        }
      } else {
        const occupied = new Set(units.filter((other) => other !== unit && !other.dead && other.hp > 0).map((other) => hexKey(other.col, other.row)));
        const stepCell = nextMoveCell(unit, target, occupied, Math.max(1, allowedRange));
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

    markDeaths(events);
    const playerAlive = units.some((u) => u.side === 'player' && !u.dead);
    const enemyAlive = units.some((u) => u.side === 'enemy' && !u.dead);
    if (!playerAlive || !enemyAlive || elapsed >= 42) {
      finished = true;
      if (playerAlive && !enemyAlive) { winner = 'player'; endReason = 'elimination'; }
      else if (enemyAlive && !playerAlive) { winner = 'enemy'; endReason = 'elimination'; }
      else {
        const playerHp = units.filter((u) => u.side === 'player').reduce((sum, u) => sum + Math.max(0, u.hp) / u.maxHp, 0);
        const enemyHp = units.filter((u) => u.side === 'enemy').reduce((sum, u) => sum + Math.max(0, u.hp) / u.maxHp, 0);
        winner = playerHp >= enemyHp ? 'player' : 'enemy';
        endReason = 'time-limit';
      }
    }
    return { events, finished, winner, elapsed, units, report, reason: endReason };
  }

  return { units, report, step, get finished() { return finished; }, get winner() { return winner; }, get endReason() { return endReason; } };
}
