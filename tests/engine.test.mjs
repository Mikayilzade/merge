import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activeTraits,
  applyWizardXp,
  calculateTeamPower,
  calculateUnitStats,
  canMerge,
  createBattle,
  createShop,
  generateEnemyTeam,
  incomeForRound,
  mergeUnits,
  seededRandom,
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

test('wizard progression is infinite and grants 0.1% per level', () => {
  assert.equal(wizardMultiplier(1), 1);
  assert.equal(wizardMultiplier(101), 1.1);
  const profile = applyWizardXp({ wizardLevel: 1, wizardXp: 0 }, 1000);
  assert.ok(profile.wizardLevel > 1);
  assert.ok(profile.wizardXp >= 0);
});

test('card level, star, artifact and active trait increase stats', () => {
  const unit = { unitId: 'guardian', star: 1 };
  const base = calculateUnitStats(unit, { cardLevel: 1, wizardLevel: 1, activeTraits: {} });
  const boosted = calculateUnitStats({ ...unit, star: 2 }, {
    cardLevel: 4,
    wizardLevel: 51,
    artifactActive: true,
    activeTraits: { guardians: true }
  });
  assert.ok(boosted.maxHp > base.maxHp * 2);
  assert.ok(boosted.attack > base.attack);
});

test('two matching traits activate a synergy', () => {
  const traits = activeTraits([
    { unitId: 'guardian' },
    { unitId: 'duelist' },
    { unitId: 'ranger' }
  ]);
  assert.equal(traits.guardians, true);
  assert.equal(traits.hunters, false);
});

test('economy and team cap scale in predictable steps', () => {
  assert.equal(incomeForRound(0, 0), 5);
  assert.equal(incomeForRound(15, 0), 8);
  assert.equal(incomeForRound(10, 4), 9);
  assert.equal(teamCapForRound(1), 3);
  assert.equal(teamCapForRound(4), 4);
  assert.equal(teamCapForRound(10), 6);
});

test('shop and enemy generation are deterministic with a seed', () => {
  const randomA = seededRandom(42);
  const randomB = seededRandom(42);
  assert.deepEqual(createShop(5, randomA), createShop(5, randomB));
  const enemy = generateEnemyTeam({ round: 6, playerPower: 700, random: seededRandom(8) });
  assert.ok(enemy.length >= 3);
  assert.ok(enemy.length <= teamCapForRound(6));
  assert.ok(calculateTeamPower(enemy) > 0);
});

test('battle simulation reaches a valid result', () => {
  const battle = createBattle({
    playerUnits: [
      { uid: 'p1', unitId: 'guardian', star: 2, slot: 1 },
      { uid: 'p2', unitId: 'ranger', star: 2, slot: 7 }
    ],
    enemyUnits: [
      { uid: 'e1', unitId: 'duelist', star: 1, slot: 1 },
      { uid: 'e2', unitId: 'ranger', star: 1, slot: 7 }
    ],
    cardLevels: { guardian: 2, ranger: 2 },
    wizardLevel: 10,
    artifactActive: false
  });
  let guard = 0;
  while (!battle.finished && guard++ < 2000) battle.step(0.04);
  assert.ok(battle.finished);
  assert.ok(['player', 'enemy'].includes(battle.winner));
  assert.ok(guard < 2000);
});
