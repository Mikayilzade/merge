import test from 'node:test';
import assert from 'node:assert/strict';
import { hexDirectionIndex, hexNeighbors, isBackAttack, oppositeHexDirection } from '../js/engine/hex-grid.js';

test('six adjacent hexes map to six direction indexes', () => {
  const center = { col: 3, row: 3 };
  const indexes = hexNeighbors(center.col, center.row).map((cell) => hexDirectionIndex(center, cell));
  assert.equal(new Set(indexes).size, 6);
});

test('opposite direction is symmetrical', () => {
  for (let i = 0; i < 6; i += 1) assert.equal(oppositeHexDirection(oppositeHexDirection(i)), i);
});

test('back attack only triggers on the directly opposite adjacent hex', () => {
  const target = { col: 3, row: 3, facingIndex: 2 };
  const neighbors = hexNeighbors(3, 3);
  const behind = neighbors.find((cell) => hexDirectionIndex(target, cell) === oppositeHexDirection(target.facingIndex));
  const side = neighbors.find((cell) => cell !== behind && hexDirectionIndex(target, cell) !== oppositeHexDirection(target.facingIndex));
  assert.equal(isBackAttack(behind, target), true);
  assert.equal(isBackAttack(side, target), false);
});
