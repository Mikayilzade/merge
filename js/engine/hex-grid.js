export const HEX_COLS = 7;
export const HEX_ROWS = 7;

const HEX_DIRS_EVEN = [[1,0],[-1,0],[0,-1],[-1,-1],[0,1],[-1,1]];
const HEX_DIRS_ODD = [[1,0],[-1,0],[1,-1],[0,-1],[1,1],[0,1]];
const CUBE_DIRS = [
  { x: 1, y: -1, z: 0 },
  { x: 1, y: 0, z: -1 },
  { x: 0, y: 1, z: -1 },
  { x: -1, y: 1, z: 0 },
  { x: -1, y: 0, z: 1 },
  { x: 0, y: -1, z: 1 }
];

export function isInsideHex(col, row) {
  return col >= 0 && col < HEX_COLS && row >= 0 && row < HEX_ROWS;
}

export function hexKey(col, row) { return `${col},${row}`; }

export function hexNeighbors(col, row) {
  const dirs = row % 2 ? HEX_DIRS_ODD : HEX_DIRS_EVEN;
  return dirs.map(([dc, dr]) => ({ col: col + dc, row: row + dr })).filter((cell) => isInsideHex(cell.col, cell.row));
}

export function offsetToCube(col, row) {
  const x = col - (row - (row & 1)) / 2;
  const z = row;
  const y = -x - z;
  return { x, y, z };
}

export function hexDistance(a, b) {
  const ac = offsetToCube(a.col, a.row);
  const bc = offsetToCube(b.col, b.row);
  return Math.max(Math.abs(ac.x - bc.x), Math.abs(ac.y - bc.y), Math.abs(ac.z - bc.z));
}

export function hexToPercent(col, row) {
  return { x: 9 + col * 12.7 + (row % 2 ? 6.35 : 0), y: 14 + row * 11.8 };
}

export function findHexPath(start, goal, occupied = new Set(), allowGoalOccupied = true) {
  const startKey = hexKey(start.col, start.row);
  const goalKey = hexKey(goal.col, goal.row);
  const queue = [start];
  const previous = new Map([[startKey, null]]);
  while (queue.length) {
    const current = queue.shift();
    const currentKey = hexKey(current.col, current.row);
    if (currentKey === goalKey) break;
    for (const next of hexNeighbors(current.col, current.row)) {
      const key = hexKey(next.col, next.row);
      if (previous.has(key)) continue;
      if (occupied.has(key) && !(allowGoalOccupied && key === goalKey)) continue;
      previous.set(key, current);
      queue.push(next);
    }
  }
  if (!previous.has(goalKey)) return [];
  const path = [];
  let cursor = goal;
  while (cursor && hexKey(cursor.col, cursor.row) !== startKey) {
    path.push(cursor);
    cursor = previous.get(hexKey(cursor.col, cursor.row));
  }
  return path.reverse();
}

export function ringCells(center, radius = 1) {
  const cells = [];
  for (let row = 0; row < HEX_ROWS; row += 1) {
    for (let col = 0; col < HEX_COLS; col += 1) {
      const cell = { col, row };
      if (hexDistance(center, cell) === radius) cells.push(cell);
    }
  }
  return cells;
}

export function hexDirectionIndex(from, to) {
  if (!from || !to || (from.col === to.col && from.row === to.row)) return null;
  const fromCube = offsetToCube(from.col, from.row);
  const neighbors = CUBE_DIRS.map((dir, index) => ({
    index,
    cube: { x: fromCube.x + dir.x, y: fromCube.y + dir.y, z: fromCube.z + dir.z }
  }));
  const toCube = offsetToCube(to.col, to.row);
  neighbors.sort((a, b) => {
    const da = Math.max(Math.abs(a.cube.x - toCube.x), Math.abs(a.cube.y - toCube.y), Math.abs(a.cube.z - toCube.z));
    const db = Math.max(Math.abs(b.cube.x - toCube.x), Math.abs(b.cube.y - toCube.y), Math.abs(b.cube.z - toCube.z));
    return da - db;
  });
  return neighbors[0]?.index ?? null;
}

export function oppositeHexDirection(index) {
  return Number.isInteger(index) ? (index + 3) % 6 : null;
}

export function isBackAttack(attacker, target) {
  if (!attacker || !target || hexDistance(attacker, target) !== 1) return false;
  const approach = hexDirectionIndex(target, attacker);
  return approach != null && approach === oppositeHexDirection(target.facingIndex);
}
