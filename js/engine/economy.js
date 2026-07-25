import { MAX_STAR, RARITY, SHOP_ODDS, UNIT_DEFS, UNIT_IDS } from '../data.js';
import { seededRandom, weightedPick } from './random.js';

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
      type: 'shards',
      unitId,
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
