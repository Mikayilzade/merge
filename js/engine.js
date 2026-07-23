import {
  MAX_STAR,
  RARITY,
  SHOP_ODDS,
  STAR_MULTIPLIERS,
  TRAITS,
  UNIT_DEFS,
  UNIT_IDS
} from './data.js';

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
  return Object.fromEntries(
    Object.entries(TRAITS).map(([id, trait]) => [id, (counts[id] || 0) >= trait.threshold])
  );
}

export function statMultipliers(unit, options = {}) {
  const def = UNIT_DEFS[unit.unitId];
  const star = STAR_MULTIPLIERS[unit.star] || 1;
  const card = cardLevelMultiplier(options.cardLevel || 1);
  const wizard = wizardMultiplier(options.wizardLevel || 1);
  const artifact = options.artifactActive ? 1.1 : 1;
  const traits = options.activeTraits || {};
  return {
    star,
    card,
    wizard,
    artifact,
    hpTrait: def.trait === 'aegis' && traits.aegis ? 1.2 : 1,
    powerTrait: def.trait === 'wild' && traits.wild ? 1.18 : def.trait === 'arcane' && traits.arcane ? 1.2 : 1,
    moveTrait: def.trait === 'wild' && traits.wild ? 1.1 : 1,
    intervalTrait: def.trait === 'arcane' && traits.arcane ? 0.92 : 1,
    armorTrait: def.trait === 'aegis' && traits.aegis ? 0.08 : 0,
    critChanceTrait: def.trait === 'veil' && traits.veil ? 0.15 : 0,
    critMultiplierTrait: def.trait === 'veil' && traits.veil ? 0.25 : 0
  };
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
    maxHp: Math.round(def.hp * common * mult.hpTrait),
    attack,
    heal,
    range: def.range,
    moveSpeed: Math.round(def.moveSpeed * mult.moveTrait * 10) / 10,
    attackInterval: Math.round(attackInterval * 1000) / 1000,
    attackSpeed: Math.round(attackSpeed * 100) / 100,
    armor: Math.min(0.55, def.armor + mult.armorTrait),
    critChance,
    critMultiplier,
    splash: def.splash || 0,
    dps: Math.round(averagePower * attackSpeed * 10) / 10,
    multipliers: mult
  };
}

export function calculateTeamPower(units = [], cardLevels = {}, wizardLevel = 1, artifactActive = false) {
  const traits = activeTraits(units);
  return Math.round(units.reduce((sum, unit) => {
    const stats = calculateUnitStats(unit, {
      cardLevel: cardLevels[unit.unitId] || 1,
      wizardLevel,
      artifactActive,
      activeTraits: traits
    });
    const effectiveHp = stats.maxHp / Math.max(0.45, 1 - stats.armor);
    const sustain = stats.heal ? stats.dps * 1.35 : 0;
    const utility = (stats.range > 70 ? 18 : 0) + (stats.splash ? 24 : 0);
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

export function generateEnemyTeam({ round = 1, playerPower = 300, random = Math.random } = {}) {
  const cap = teamCapForRound(round);
  const difficulty = 0.84 + Math.min(0.24, round * 0.021) + random() * 0.1;
  const target = Math.max(220 + round * 46, playerPower * difficulty);
  const team = [];
  let safety = 0;
  while (team.length < cap && safety++ < 70) {
    const rarityLimit = round < 4 ? ['common', 'rare'] : ['common', 'rare', 'epic'];
    const pool = UNIT_IDS.filter((id) => rarityLimit.includes(UNIT_DEFS[id].rarity));
    const unitId = pool[Math.floor(random() * pool.length)];
    let star = 1;
    if (round >= 3 && random() < Math.min(0.6, 0.1 + round * 0.046)) star = 2;
    if (round >= 7 && random() < Math.min(0.25, (round - 6) * 0.038)) star = 3;
    team.push({ uid: `enemy-${round}-${safety}`, unitId, star, slot: team.length });
    const enemyLevel = Math.max(1, Math.floor(round * 0.68));
    const levels = Object.fromEntries(UNIT_IDS.map((id) => [id, enemyLevel]));
    if (calculateTeamPower(team, levels, Math.max(1, Math.floor(round * 0.6)), false) >= target && team.length >= Math.min(3, cap)) break;
  }
  return team;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function nearest(source, targets) {
  let best = null;
  let bestDistance = Infinity;
  for (const target of targets) {
    if (target.dead) continue;
    const d = distance(source, target);
    if (d < bestDistance) {
      best = target;
      bestDistance = d;
    }
  }
  return { target: best, distance: bestDistance };
}

function chooseTarget(source, targets) {
  const def = UNIT_DEFS[source.unitId];
  if (def.targetMode === 'fragile') {
    const sorted = [...targets].sort((a, b) => (a.maxHp + a.armor * 300) - (b.maxHp + b.armor * 300));
    const preferred = sorted[0];
    return { target: preferred, distance: preferred ? distance(source, preferred) : Infinity };
  }
  return nearest(source, targets);
}

function damageAfterArmor(raw, target) {
  let armor = target.armor;
  if (target.unitId === 'guardian' && target.hp <= target.maxHp * 0.45) armor = Math.min(0.55, armor + 0.1);
  return Math.max(1, Math.round(raw * (1 - armor)));
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
    const col = unit.slot % 3;
    const row = Math.floor(unit.slot / 3);
    return {
      ...unit,
      ...stats,
      side,
      combatId: `${side}-${unit.uid}`,
      x: 24 + col * 26,
      y: side === 'player' ? 76 + row * 4.6 : 24 - row * 4.6,
      hp: stats.maxHp,
      cooldown: 0.12 + index * 0.075,
      dead: false,
      attacksMade: 0,
      lastTarget: null,
      facing: side === 'player' ? 'up' : 'down',
      burnRemaining: 0,
      burnDps: 0,
      burnAccumulator: 0
    };
  };

  const units = [
    ...playerUnits.map((u, i) => makeCombatant(u, 'player', i, pTraits)),
    ...enemyUnits.map((u, i) => makeCombatant(u, 'enemy', i, eTraits))
  ];
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
      const enemies = units.filter((other) => other.side !== unit.side && !other.dead && other.hp > 0);
      const allies = units.filter((other) => other.side === unit.side && !other.dead && other.hp > 0);
      if (!enemies.length) continue;

      let targetInfo;
      let action = 'attack';
      if (UNIT_DEFS[unit.unitId].heal) {
        const injured = allies
          .filter((ally) => ally.hp < ally.maxHp * 0.94)
          .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
        if (injured.length) {
          targetInfo = nearest(unit, injured);
          action = 'heal';
        } else targetInfo = chooseTarget(unit, enemies);
      } else targetInfo = chooseTarget(unit, enemies);

      const target = targetInfo.target;
      if (!target) continue;
      unit.facing = target.x < unit.x ? 'left' : target.x > unit.x ? 'right' : unit.side === 'player' ? 'up' : 'down';
      const allowedRange = Math.max(5.5, unit.range / 8.5);
      if (targetInfo.distance <= allowedRange) {
        if (unit.cooldown <= 0) {
          unit.cooldown = unit.attackInterval;
          unit.attacksMade += 1;
          const def = UNIT_DEFS[unit.unitId];
          if (action === 'heal') {
            const critical = random() < unit.critChance;
            const raw = unit.heal * (critical ? unit.critMultiplier : 1);
            const amount = Math.min(Math.round(raw), target.maxHp - target.hp);
            target.hp += amount;
            events.push({ type: 'heal', from: unit.combatId, to: target.combatId, amount, critical, special: critical ? 'Критическое лечение' : null });
          } else {
            let critical = random() < unit.critChance;
            let special = null;
            if (def.firstShotCrit && unit.lastTarget !== target.combatId) {
              critical = true;
              special = 'Метка добычи';
            }
            let rawDamage = unit.attack * (critical ? unit.critMultiplier : 1);
            if (def.comboEvery && unit.attacksMade % def.comboEvery === 0) {
              rawDamage *= def.comboMultiplier;
              special = 'Третий выпад';
            }
            if (def.executeThreshold && target.hp / target.maxHp <= def.executeThreshold) {
              rawDamage *= def.executeMultiplier;
              special = 'Шёпот конца';
            }
            const damage = damageAfterArmor(rawDamage, target);
            target.hp -= damage;
            unit.lastTarget = target.combatId;
            events.push({
              type: 'hit', from: unit.combatId, to: target.combatId, amount: damage,
              ranged: unit.range > 45, critical, special, style: def.art.weapon
            });

            if (def.splash) {
              for (const other of enemies) {
                if (other === target || other.dead || other.hp <= 0) continue;
                if (distance(target, other) <= def.splash / 8) {
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
        const dx = target.x - unit.x;
        const dy = target.y - unit.y;
        const length = Math.hypot(dx, dy) || 1;
        const move = Math.min(targetInfo.distance - allowedRange, unit.moveSpeed * dt / 10);
        unit.x += dx / length * move;
        unit.y += dy / length * move;
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
    if (!playerAlive || !enemyAlive || elapsed >= 34) {
      finished = true;
      if (playerAlive && !enemyAlive) winner = 'player';
      else if (enemyAlive && !playerAlive) winner = 'enemy';
      else {
        const playerHp = units.filter((u) => u.side === 'player').reduce((sum, u) => sum + u.hp / u.maxHp, 0);
        const enemyHp = units.filter((u) => u.side === 'enemy').reduce((sum, u) => sum + u.hp / u.maxHp, 0);
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
