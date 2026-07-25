import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateTeamPower, createBattle } from '../js/engine.js';

test('modular public engine simulates a complete battle with real unit data', () => {
  const player = [
    { uid: 'p1', unitId: 'guardian', star: 1, slot: 0 },
    { uid: 'p2', unitId: 'ranger', star: 1, slot: 1 }
  ];
  const enemy = [
    { uid: 'e1', unitId: 'guardian', star: 1, slot: 0 },
    { uid: 'e2', unitId: 'duelist', star: 1, slot: 1 }
  ];
  const battle = createBattle({
    playerUnits: player,
    enemyUnits: enemy,
    cardLevels: { guardian: 1, ranger: 1 },
    wizardLevel: 1,
    random: () => 0.5
  });

  assert.equal(battle.units.length, 4);
  for (let i = 0; i < 2000 && !battle.finished; i += 1) battle.step(0.04);

  assert.equal(battle.finished, true);
  assert.ok(['player', 'enemy'].includes(battle.winner));
  assert.ok(battle.report['player-p1']);
  assert.ok(calculateTeamPower(player, { guardian: 1, ranger: 1 }, 1, false) > 0);
});
