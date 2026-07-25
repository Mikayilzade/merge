import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptiveTarget, buildEnemyForTarget } from '../js/engine-v033.js';

test('adaptive target is 10-15 percent above previous winning army', () => {
  const low = adaptiveTarget(1000, () => 0);
  const high = adaptiveTarget(1000, () => 0.999999);
  assert.equal(low.targetPower, 1100);
  assert.equal(high.targetPower, 1150);
  assert.ok(low.coefficient >= 1.10 && low.coefficient <= 1.15);
  assert.ok(high.coefficient >= 1.10 && high.coefficient <= 1.15);
});

test('enemy builder creates a real team rather than a hidden stat multiplier', () => {
  const built = buildEnemyForTarget({ round: 4, targetPower: 1250, wizardLevel: 3, seed: 42 });
  assert.ok(built.team.length >= 3);
  assert.ok(built.team.length <= 4);
  assert.ok(built.power > 0);
  for (const unit of built.team) {
    assert.ok(typeof unit.unitId === 'string' && unit.unitId.length > 0);
    assert.ok([1, 2, 3].includes(unit.star));
  }
});

test('same seed and target produce the same challenge composition', () => {
  const a = buildEnemyForTarget({ round: 7, targetPower: 2400, wizardLevel: 5, seed: 777 });
  const b = buildEnemyForTarget({ round: 7, targetPower: 2400, wizardLevel: 5, seed: 777 });
  assert.deepEqual(a, b);
});
