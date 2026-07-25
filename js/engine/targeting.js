import { UNIT_DEFS } from '../data.js';
import { HEX_COLS, HEX_ROWS, findHexPath, hexDistance, hexKey, hexNeighbors } from './hex-grid.js';

export function chooseTarget(source, targets) {
  const living = targets.filter((target) => !target.dead && target.hp > 0);
  if (!living.length) return null;
  const def = UNIT_DEFS[source.unitId];
  if (def.targetMode === 'fragile') {
    return [...living].sort((a, b) => {
      const fragA = a.maxHp * (1 + a.armor);
      const fragB = b.maxHp * (1 + b.armor);
      return fragA - fragB || hexDistance(source, a) - hexDistance(source, b);
    })[0];
  }
  return [...living].sort((a, b) => hexDistance(source, a) - hexDistance(source, b) || a.hp / a.maxHp - b.hp / b.maxHp)[0];
}

export function chooseHealTarget(source, allies) {
  const injured = allies.filter((ally) => !ally.dead && ally.hp > 0 && ally.hp < ally.maxHp * 0.96);
  if (!injured.length) return null;
  return [...injured].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || hexDistance(source, a) - hexDistance(source, b))[0];
}

export function nextMoveCell(unit, target, occupied, desiredRange) {
  const candidates = [];
  for (let row = 0; row < HEX_ROWS; row += 1) {
    for (let col = 0; col < HEX_COLS; col += 1) {
      const key = hexKey(col, row);
      if (occupied.has(key) && key !== hexKey(unit.col, unit.row)) continue;
      const dist = hexDistance({ col, row }, target);
      if (dist <= desiredRange) candidates.push({ col, row, dist });
    }
  }
  candidates.sort((a, b) => {
    const pathA = findHexPath(unit, a, occupied, false).length || 99;
    const pathB = findHexPath(unit, b, occupied, false).length || 99;
    return pathA - pathB || Math.abs(a.dist - desiredRange) - Math.abs(b.dist - desiredRange);
  });
  for (const candidate of candidates) {
    const path = findHexPath(unit, candidate, occupied, false);
    if (path.length) return path[0];
  }
  const adjacent = hexNeighbors(unit.col, unit.row).filter((cell) => !occupied.has(hexKey(cell.col, cell.row)));
  adjacent.sort((a, b) => hexDistance(a, target) - hexDistance(b, target));
  return adjacent[0] || null;
}
