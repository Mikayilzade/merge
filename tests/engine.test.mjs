import test from 'node:test';
import assert from 'node:assert/strict';
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
  generateEnemyTeam,
  incomeForRound,
  mergeUnits,
  seededRandom,
  shopOddsForRound,
  teamCapForRound,
  wizardMultiplier
} from '../js/engine.js';

test('two identical units of the same star merge', () => {
  const a = { uid: 'a', unitId: 'guardian', star: 1 };
  const b = { uid: 'b', unitId: 'guardian', star: 1 };
  assert.equal(canMerge(a, b), true);
  assert.equal(mergeUnits(a, b).star, 2);
  assert.equal(canMerge({ ...a, star: 3 }, { ...b, star: 3 }), false);
  assert.equal(canMerge(a, { ...b, unitId: 'ranger' }), false);
});

test('wizard progression stays infinite and grants 0.1% per level', () => {
  assert.equal(wizardMultiplier(1), 1);
  assert.equal(wizardMultiplier(101), 1.1);
  const profile = applyWizardXp({ wizardLevel: 1, wizardXp: 0 }, 10000);
  assert.ok(profile.wizardLevel > 1);
  assert.ok(profile.wizardXp >= 0);
});

test('visible combat stats expose DPS, armor, attack speed, movement and range', () => {
  const stats = calculateUnitStats({ unitId: 'ranger', star: 1 }, { cardLevel: 1, wizardLevel: 1, activeTraits: {} });
  assert.equal(stats.maxHp, 116);
  assert.equal(stats.attack, 30);
  assert.ok(stats.dps > 30);
  assert.ok(stats.attackSpeed > 1);
  assert.equal(stats.moveSpeed, 31);
  assert.equal(stats.range, 116);
  assert.equal(stats.armor, 0.03);
});

test('stars, card levels, wizard, artifact and synergy apply predictable multipliers', () => {
  const unit = { unitId: 'guardian', star: 1 };
  const base = calculateUnitStats(unit, { cardLevel: 1, wizardLevel: 1, activeTraits: {} });
  const boosted = calculateUnitStats({ ...unit, star: 2 }, {
    cardLevel: 4,
    wizardLevel: 51,
    artifactActive: true,
    activeTraits: { aegis: true }
  });
  assert.ok(boosted.maxHp > base.maxHp * 2.5);
  assert.ok(boosted.armor > base.armor);
  assert.ok(boosted.attack > base.attack);
});

test('synergies count unique character types, not duplicate copies', () => {
  const units = [
    { unitId: 'guardian' },
    { unitId: 'guardian' },
    { unitId: 'duelist' },
    { unitId: 'ranger' }
  ];
  assert.equal(countTraits(units).aegis, 2);
  assert.equal(activeTraits(units).aegis, true);
  assert.equal(activeTraits(units).wild, false);
});

test('each faction changes its documented numbers', () => {
  const aegis = calculateUnitStats({ unitId: 'guardian', star: 1 }, { activeTraits: { aegis: true } });
  const wild = calculateUnitStats({ unitId: 'ranger', star: 1 }, { activeTraits: { wild: true } });
  const arcane = calculateUnitStats({ unitId: 'arcanist', star: 1 }, { activeTraits: { arcane: true } });
  const veil = calculateUnitStats({ unitId: 'shade', star: 1 }, { activeTraits: { veil: true } });
  assert.equal(aegis.armor, 0.26);
  assert.equal(wild.attack, 35);
  assert.ok(arcane.attackSpeed > 1 / 1.32);
  assert.ok(Math.abs(veil.critChance - 0.33) < 1e-9);
  assert.equal(veil.critMultiplier, 1.95);
});

test('economy and team cap scale in predictable steps', () => {
  assert.equal(incomeForRound(0, 0), 5);
  assert.equal(incomeForRound(15, 0), 8);
  assert.equal(incomeForRound(10, 4), 9);
  assert.equal(teamCapForRound(1), 3);
  assert.equal(teamCapForRound(4), 4);
  assert.equal(teamCapForRound(10), 6);
});

test('shop odds change by round and seeded shops are deterministic', () => {
  assert.equal(shopOddsForRound(1).epic, 2);
  assert.equal(shopOddsForRound(10).epic, 18);
  const randomA = seededRandom(42);
  const randomB = seededRandom(42);
  assert.deepEqual(createShop(8, randomA), createShop(8, randomB));
  assert.equal(createShop(8, seededRandom(1)).length, 5);
});

test('daily meta offers are deterministic and contain shards plus artifacts', () => {
  const a = createMetaOffers(20000);
  const b = createMetaOffers(20000);
  assert.deepEqual(a, b);
  assert.equal(a.length, 4);
  assert.equal(a.filter((offer) => offer.type === 'shards').length, 3);
  assert.equal(a.at(-1).type, 'artifacts');
});

test('enemy generation supports the expanded eight-character roster', () => {
  const enemy = generateEnemyTeam({ round: 8, playerPower: 900, random: seededRandom(8) });
  assert.ok(enemy.length >= 3);
  assert.ok(enemy.length <= teamCapForRound(8));
  assert.ok(calculateTeamPower(enemy) > 0);
});

test('battle simulation reaches a result with crits, armor, healing and status logic enabled', () => {
  const battle = createBattle({
    playerUnits: [
      { uid: 'p1', unitId: 'guardian', star: 2, slot: 1 },
      { uid: 'p2', unitId: 'healer', star: 1, slot: 7 },
      { uid: 'p3', unitId: 'pyromancer', star: 1, slot: 8 }
    ],
    enemyUnits: [
      { uid: 'e1', unitId: 'duelist', star: 2, slot: 1 },
      { uid: 'e2', unitId: 'ranger', star: 2, slot: 7 },
      { uid: 'e3', unitId: 'shade', star: 1, slot: 8 }
    ],
    cardLevels: { guardian: 2, healer: 2, pyromancer: 2 },
    wizardLevel: 10,
    artifactActive: false,
    random: seededRandom(99)
  });
  let guard = 0;
  const eventTypes = new Set();
  while (!battle.finished && guard++ < 2500) {
    const snapshot = battle.step(0.04);
    snapshot.events.forEach((event) => eventTypes.add(event.type));
  }
  assert.ok(battle.finished);
  assert.ok(['player', 'enemy'].includes(battle.winner));
  assert.ok(guard < 2500);
  assert.ok(eventTypes.has('hit'));
  assert.ok(eventTypes.has('death'));
});
