import { STAR_MULTIPLIERS, TRAITS, UNIT_DEFS } from '../data.js';

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
    maxHp: Math.round(def.hp * common * mult.hpTrait),
    attack,
    heal,
    range: rangeInHexes(def),
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
    const utility = (stats.range >= 3 ? 18 : 0) + (stats.splash ? 24 : 0);
    return sum + effectiveHp * 0.3 + stats.dps * 5.2 + sustain + utility;
  }, 0));
}
