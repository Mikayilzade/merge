import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoreBattle } from '../js/engine/combat-core.js';
import { hexDirectionIndex, hexNeighbors, oppositeHexDirection, hexToPercent } from '../js/engine/hex-grid.js';

test('Shade gets a guaranteed critical from the rear adjacent hex', () => {
  const battle = createCoreBattle({
    playerUnits: [{ uid: 'shade', unitId: 'shade', star: 1, slot: 0 }],
    enemyUnits: [{ uid: 'guard', unitId: 'guardian', star: 1, slot: 0 }],
    wizardLevel: 1,
    random: () => 0.99
  });
  const shade = battle.units.find((unit) => unit.unitId === 'shade');
  const guard = battle.units.find((unit) => unit.unitId === 'guardian');

  guard.col = 3;
  guard.row = 3;
  guard.facingIndex = 2;
  Object.assign(guard, hexToPercent(guard.col, guard.row));
  const rearDirection = oppositeHexDirection(guard.facingIndex);
  const rear = hexNeighbors(guard.col, guard.row).find((cell) => hexDirectionIndex(guard, cell) === rearDirection);
  assert.ok(rear);

  shade.col = rear.col;
  shade.row = rear.row;
  Object.assign(shade, hexToPercent(shade.col, shade.row));
  shade.cooldown = 0;
  guard.cooldown = 99;

  const snapshot = battle.step(0.04);
  const hit = snapshot.events.find((event) => event.type === 'hit' && event.from === shade.combatId);
  assert.ok(hit);
  assert.equal(hit.backstab, true);
  assert.equal(hit.critical, true);
  assert.equal(battle.report[shade.combatId].backstabs, 1);
});
