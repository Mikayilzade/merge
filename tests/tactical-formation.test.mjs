import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ENEMY_DEPLOY_CELLS,
  PLAYER_DEPLOY_CELLS,
  enemyDeploymentCell,
  playerDeploymentCell
} from '../js/engine-v031.js';

test('player has exactly 21 legal deployment hexes on the lower three rows', () => {
  assert.equal(PLAYER_DEPLOY_CELLS.length, 21);
  assert.equal(new Set(PLAYER_DEPLOY_CELLS.map(({ col, row }) => `${col},${row}`)).size, 21);
  assert.deepEqual([...new Set(PLAYER_DEPLOY_CELLS.map(({ row }) => row))], [4, 5, 6]);
  assert.ok(PLAYER_DEPLOY_CELLS.every(({ col }) => col >= 0 && col <= 6));
});

test('stored tactical positions map board inventory slots to any lower hex', () => {
  assert.deepEqual(playerDeploymentCell(0, { 0: 0 }), { col: 0, row: 4 });
  assert.deepEqual(playerDeploymentCell(0, { 0: 20 }), { col: 6, row: 6 });
  assert.deepEqual(playerDeploymentCell(5, { 5: 13 }), { col: 6, row: 5 });
});

test('legacy board slots still get safe compact defaults when no formation exists', () => {
  assert.deepEqual(playerDeploymentCell(0, {}), { col: 2, row: 4 });
  assert.deepEqual(playerDeploymentCell(4, {}), { col: 3, row: 5 });
  assert.deepEqual(playerDeploymentCell(8, {}), { col: 4, row: 6 });
});

test('enemy preview and battle use unique fixed upper-side deployment cells', () => {
  assert.equal(new Set(ENEMY_DEPLOY_CELLS.map(({ col, row }) => `${col},${row}`)).size, ENEMY_DEPLOY_CELLS.length);
  assert.ok(ENEMY_DEPLOY_CELLS.every(({ row }) => row >= 0 && row <= 2));
  assert.deepEqual(enemyDeploymentCell(0), { col: 3, row: 2 });
  assert.deepEqual(enemyDeploymentCell(5), { col: 5, row: 1 });
});
