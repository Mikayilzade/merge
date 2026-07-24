export * from './engine-v03.js';
import { createBattle as createHexBattle, hexToPercent } from './engine-v03.js';

function deploymentCell(unit, side, index) {
  const slot = Number.isFinite(unit.slot) ? Math.max(0, Math.min(8, unit.slot)) : Math.max(0, Math.min(8, index));
  const localRow = Math.floor(slot / 3);
  const col = 2 + (slot % 3);
  const row = side === 'player' ? 4 + localRow : 2 - localRow;
  return { col, row };
}

/**
 * 0.3.1 deployment adapter.
 * The legacy planning board numbers cells from its front row to its back row.
 * Base hex combat originally interpreted those rows in reverse. Reposition the
 * same combatant objects before the first simulation tick so the visible setup
 * and the first battle frame describe the same formation.
 */
export function createBattle(options) {
  const battle = createHexBattle(options);
  let playerIndex = 0;
  let enemyIndex = 0;
  for (const unit of battle.units) {
    const index = unit.side === 'player' ? playerIndex++ : enemyIndex++;
    const cell = deploymentCell(unit, unit.side, index);
    unit.col = cell.col;
    unit.row = cell.row;
    const point = hexToPercent(unit.col, unit.row);
    unit.x = point.x;
    unit.y = point.y;
    unit.facing = unit.side === 'player' ? 'up' : 'down';
    unit.facingHex = unit.side === 'player' ? 'N' : 'S';
  }
  return battle;
}
