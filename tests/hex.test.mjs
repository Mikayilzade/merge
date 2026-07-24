import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBattle,
  findHexPath,
  generateEnemyTeam,
  hexDistance,
  hexKey,
  hexNeighbors,
  rangeInHexes,
  ringCells,
  seededRandom
} from '../js/engine-v031.js';

test('combat ranges are expressed in hexes', () => {
  assert.equal(rangeInHexes('guardian'), 1);
  assert.equal(rangeInHexes('duelist'), 1);
  assert.equal(rangeInHexes('healer'), 3);
  assert.equal(rangeInHexes('arcanist'), 4);
  assert.equal(rangeInHexes('ranger'), 4);
  assert.equal(rangeInHexes('bomber'), 5);
});

test('a central hex has six neighbours and can be surrounded', () => {
  const center = { col: 3, row: 3 };
  const neighbours = hexNeighbors(center.col, center.row);
  assert.equal(neighbours.length, 6);
  assert.equal(ringCells(center, 1).length, 6);
  for (const cell of neighbours) assert.equal(hexDistance(center, cell), 1);
});

test('pathfinding routes around occupied hexes', () => {
  const occupied = new Set([hexKey(3, 4), hexKey(3, 3)]);
  const path = findHexPath({ col: 3, row: 6 }, { col: 3, row: 2 }, occupied, false);
  assert.ok(path.length > 0);
  assert.ok(path.every((cell) => !occupied.has(hexKey(cell.col, cell.row))));
});

test('opponent composition stays fixed for the whole round', () => {
  const a = generateEnemyTeam({ round: 7, playerPower: 300, random: seededRandom(1) });
  const b = generateEnemyTeam({ round: 7, playerPower: 9000, random: seededRandom(999) });
  assert.deepEqual(a, b);
});

test('planning front row becomes the closest player combat row', () => {
  const battle = createBattle({
    playerUnits: [
      { uid: 'front', unitId: 'guardian', star: 1, slot: 0 },
      { uid: 'middle', unitId: 'duelist', star: 1, slot: 3 },
      { uid: 'back', unitId: 'ranger', star: 1, slot: 6 }
    ],
    enemyUnits: [{ uid: 'enemy', unitId: 'guardian', star: 1, slot: 0 }],
    random: seededRandom(4)
  });
  const front = battle.units.find((unit) => unit.uid === 'front');
  const middle = battle.units.find((unit) => unit.uid === 'middle');
  const back = battle.units.find((unit) => unit.uid === 'back');
  assert.equal(front.row, 4);
  assert.equal(middle.row, 5);
  assert.equal(back.row, 6);
});

test('living combatants never share the same hex', () => {
  const battle = createBattle({
    playerUnits: [
      { uid: 'p1', unitId: 'guardian', star: 2, slot: 0 },
      { uid: 'p2', unitId: 'duelist', star: 1, slot: 1 },
      { uid: 'p3', unitId: 'ranger', star: 1, slot: 2 },
      { uid: 'p4', unitId: 'healer', star: 1, slot: 3 },
      { uid: 'p5', unitId: 'shade', star: 1, slot: 4 },
      { uid: 'p6', unitId: 'bomber', star: 1, slot: 5 }
    ],
    enemyUnits: [
      { uid: 'e1', unitId: 'guardian', star: 2, slot: 0 },
      { uid: 'e2', unitId: 'duelist', star: 1, slot: 1 },
      { uid: 'e3', unitId: 'ranger', star: 1, slot: 2 },
      { uid: 'e4', unitId: 'healer', star: 1, slot: 3 },
      { uid: 'e5', unitId: 'shade', star: 1, slot: 4 },
      { uid: 'e6', unitId: 'bomber', star: 1, slot: 5 }
    ],
    random: seededRandom(33)
  });
  let guard = 0;
  while (!battle.finished && guard++ < 1600) {
    battle.step(0.04);
    const living = battle.units.filter((unit) => !unit.dead && unit.hp > 0);
    const occupied = living.map((unit) => hexKey(unit.col, unit.row));
    assert.equal(new Set(occupied).size, occupied.length);
  }
  assert.ok(battle.finished);
});

test('two rangers acquire and damage each other on the hex field', () => {
  const battle = createBattle({
    playerUnits: [{ uid: 'p', unitId: 'ranger', star: 1, slot: 1 }],
    enemyUnits: [{ uid: 'e', unitId: 'ranger', star: 1, slot: 1 }],
    random: seededRandom(7)
  });
  let sawHit = false;
  for (let i = 0; i < 300 && !battle.finished; i += 1) {
    const snapshot = battle.step(0.04);
    if (snapshot.events.some((event) => event.type === 'hit')) { sawHit = true; break; }
  }
  assert.equal(sawHit, true);
});
