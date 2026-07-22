import { MAX_STAR, STAR_MULTIPLIERS, TRAITS, UNIT_DEFS, UNIT_IDS } from './data.js';

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

export function createShop(round = 1, random = Math.random, size = 4) {
  const rareChance = Math.min(0.22 + round * 0.018, 0.48);
  return Array.from({ length: size }, () => {
    const rarity = random() < rareChance ? 'rare' : 'common';
    const pool = UNIT_IDS.filter((id) => UNIT_DEFS[id].rarity === rarity);
    return pool[Math.floor(random() * pool.length)];
  });
}

export function canMerge(a, b) {
  return Boolean(a && b && a.unitId === b.unitId && a.star === b.star && a.star < MAX_STAR);
}

export function mergeUnits(a, b) {
  if (!canMerge(a, b)) return null;
  return {
    ...a,
    uid: a.uid,
    star: a.star + 1,
    mergedFrom: [a.uid, b.uid]
  };
}

export function cardLevelMultiplier(level = 1) {
  return 1 + Math.max(0, level - 1) * 0.06;
}

export function wizardMultiplier(level = 1) {
  return 1 + Math.max(0, level - 1) * 0.001;
}

export function countTraits(units = []) {
  return units.reduce((acc, unit) => {
    const trait = UNIT_DEFS[unit.unitId]?.trait;
    if (trait) acc[trait] = (acc[trait] || 0) + 1;
    return acc;
  }, {});
}

export function activeTraits(units = []) {
  const counts = countTraits(units);
  return Object.fromEntries(
    Object.entries(TRAITS).map(([id, trait]) => [id, (counts[id] || 0) >= trait.threshold])
  );
}

export function calculateUnitStats(unit, options = {}) {
  const def = UNIT_DEFS[unit.unitId];
  if (!def) throw new Error(`Unknown unit: ${unit.unitId}`);
  const starMult = STAR_MULTIPLIERS[unit.star] || 1;
  const levelMult = cardLevelMultiplier(options.cardLevel || 1);
  const wizMult = wizardMultiplier(options.wizardLevel || 1);
  const artifactMult = options.artifactActive ? 1.1 : 1;
  const traits = options.activeTraits || {};
  let hpTrait = 1;
  let powerTrait = 1;
  if (def.trait === 'guardians' && traits.guardians) hpTrait = 1.2;
  if (def.trait === 'hunters' && traits.hunters) powerTrait = 1.16;
  if (def.trait === 'mystics' && traits.mystics) powerTrait = 1.18;
  const common = starMult * levelMult * wizMult * artifactMult;
  return {
    maxHp: Math.round(def.hp * common * hpTrait),
    attack: Math.round(def.attack * common * powerTrait),
    heal: Math.round((def.heal || 0) * common * powerTrait),
    range: def.range,
    speed: def.speed,
    attackInterval: def.attackInterval,
    splash: def.splash || 0
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
    return sum + stats.maxHp * 0.34 + stats.attack * (1.7 / stats.attackInterval) + stats.heal * 1.45;
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
  const difficulty = 0.83 + Math.min(0.25, round * 0.022) + random() * 0.11;
  const target = Math.max(210 + round * 42, playerPower * difficulty);
  const team = [];
  let safety = 0;
  while (team.length < cap && safety++ < 50) {
    const unitId = UNIT_IDS[Math.floor(random() * UNIT_IDS.length)];
    let star = 1;
    if (round >= 3 && random() < Math.min(0.58, 0.11 + round * 0.045)) star = 2;
    if (round >= 7 && random() < Math.min(0.24, (round - 6) * 0.035)) star = 3;
    const candidate = { uid: `enemy-${round}-${safety}`, unitId, star, slot: team.length };
    team.push(candidate);
    const power = calculateTeamPower(team, {}, Math.max(1, Math.floor(round * 0.7)), false);
    if (power >= target && team.length >= Math.min(3, cap)) break;
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

export function createBattle({ playerUnits, enemyUnits, cardLevels = {}, wizardLevel = 1, artifactActive = false }) {
  const pTraits = activeTraits(playerUnits);
  const eTraits = activeTraits(enemyUnits);
  const makeCombatant = (unit, side, index, traits) => {
    const stats = calculateUnitStats(unit, {
      cardLevel: side === 'player' ? (cardLevels[unit.unitId] || 1) : Math.max(1, Math.floor(wizardLevel * 0.35)),
      wizardLevel: side === 'player' ? wizardLevel : Math.max(1, Math.floor(wizardLevel * 0.65)),
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
      x: 25 + col * 25,
      y: side === 'player' ? 76 + row * 5 : 24 - row * 5,
      hp: stats.maxHp,
      cooldown: 0.15 + index * 0.08,
      dead: false
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
      unit.cooldown -= dt;
      const enemies = units.filter((other) => other.side !== unit.side && !other.dead);
      const allies = units.filter((other) => other.side === unit.side && !other.dead);
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
        } else {
          targetInfo = nearest(unit, enemies);
        }
      } else {
        targetInfo = nearest(unit, enemies);
      }
      const target = targetInfo.target;
      if (!target) continue;
      const allowedRange = Math.max(5.5, unit.range / 8.5);
      if (targetInfo.distance <= allowedRange) {
        if (unit.cooldown <= 0) {
          unit.cooldown = unit.attackInterval;
          if (action === 'heal') {
            const amount = Math.min(unit.heal, target.maxHp - target.hp);
            target.hp += amount;
            events.push({ type: 'heal', from: unit.combatId, to: target.combatId, amount });
          } else {
            const damage = unit.attack;
            target.hp -= damage;
            events.push({ type: 'hit', from: unit.combatId, to: target.combatId, amount: damage, ranged: unit.range > 45 });
            if (unit.splash) {
              for (const other of enemies) {
                if (other === target || other.dead) continue;
                if (distance(target, other) <= unit.splash / 8) {
                  const splashDamage = Math.round(damage * 0.42);
                  other.hp -= splashDamage;
                  events.push({ type: 'hit', from: unit.combatId, to: other.combatId, amount: splashDamage, splash: true });
                }
              }
            }
          }
        }
      } else {
        const dx = target.x - unit.x;
        const dy = target.y - unit.y;
        const length = Math.hypot(dx, dy) || 1;
        const move = Math.min(targetInfo.distance - allowedRange, unit.speed * dt / 10);
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
    if (!playerAlive || !enemyAlive || elapsed >= 32) {
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
