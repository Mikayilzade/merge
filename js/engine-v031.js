export * from './engine-v03.js';
import { createBattle as createHexBattle, hexKey, hexToPercent } from './engine-v03.js';

export const FORMATION_STORAGE_KEY = 'merge-arcana-hex-formation-v032';

export const PLAYER_DEPLOY_CELLS = Array.from({ length: 21 }, (_, index) => ({
  col: index % 7,
  row: 4 + Math.floor(index / 7)
}));

export const ENEMY_DEPLOY_CELLS = [
  { col: 3, row: 2 }, { col: 2, row: 2 }, { col: 4, row: 2 },
  { col: 3, row: 1 }, { col: 1, row: 1 }, { col: 5, row: 1 },
  { col: 2, row: 0 }, { col: 4, row: 0 }, { col: 3, row: 0 }
];

function compactPlayerCell(slot = 0) {
  const safe = Math.max(0, Math.min(8, Number(slot) || 0));
  const localRow = Math.floor(safe / 3);
  return { col: 2 + (safe % 3), row: 4 + localRow };
}

export function readStoredFormation(storage) {
  try {
    const source = storage ?? globalThis.localStorage;
    const parsed = JSON.parse(source?.getItem?.(FORMATION_STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function playerDeploymentCell(slot, formation = {}) {
  const raw = Number(formation[String(slot)]);
  if (Number.isInteger(raw) && raw >= 0 && raw < PLAYER_DEPLOY_CELLS.length) {
    return { ...PLAYER_DEPLOY_CELLS[raw] };
  }
  return compactPlayerCell(slot);
}

export function enemyDeploymentCell(index = 0) {
  return { ...(ENEMY_DEPLOY_CELLS[index] || ENEMY_DEPLOY_CELLS[index % ENEMY_DEPLOY_CELLS.length] || { col: 3, row: 1 }) };
}

function nearestFree(preferred, allowed, used) {
  if (!used.has(hexKey(preferred.col, preferred.row))) return preferred;
  const sorted = [...allowed].sort((a, b) => {
    const da = Math.abs(a.col - preferred.col) + Math.abs(a.row - preferred.row);
    const db = Math.abs(b.col - preferred.col) + Math.abs(b.row - preferred.row);
    return da - db;
  });
  return sorted.find((cell) => !used.has(hexKey(cell.col, cell.row))) || preferred;
}

function placeBattleUnits(battle, formation) {
  const used = new Set();
  let playerIndex = 0;
  let enemyIndex = 0;
  for (const unit of battle.units) {
    const index = unit.side === 'player' ? playerIndex++ : enemyIndex++;
    const preferred = unit.side === 'player'
      ? playerDeploymentCell(unit.slot ?? index, formation)
      : enemyDeploymentCell(index);
    const allowed = unit.side === 'player' ? PLAYER_DEPLOY_CELLS : ENEMY_DEPLOY_CELLS;
    const cell = nearestFree(preferred, allowed, used);
    unit.col = cell.col;
    unit.row = cell.row;
    const point = hexToPercent(unit.col, unit.row);
    unit.x = point.x;
    unit.y = point.y;
    unit.facing = unit.side === 'player' ? 'up' : 'down';
    unit.facingHex = unit.side === 'player' ? 'N' : 'S';
    used.add(hexKey(unit.col, unit.row));
  }
}

function exposeCombatState(battle) {
  if (typeof window === 'undefined') return;
  window.__mergeCombatState = Object.fromEntries(battle.units.map((unit) => [unit.combatId, {
    hp: Math.max(0, Math.ceil(unit.hp)),
    maxHp: unit.maxHp,
    star: unit.star,
    side: unit.side,
    col: unit.col,
    row: unit.row,
    dead: unit.dead
  }]));
}

/**
 * 0.3.2 tactical adapter.
 * The legacy nine board slots remain only as stable inventory positions so old
 * saves, shop purchases and merges continue to work. Actual battle deployment
 * is read from the 21 lower hexes stored by v032-formation.js.
 */
export function createBattle(options) {
  const battle = createHexBattle(options);
  const formation = readStoredFormation();
  placeBattleUnits(battle, formation);
  exposeCombatState(battle);

  const baseStep = battle.step.bind(battle);
  battle.step = (dt) => {
    const uiSpeed = Math.max(0.5, Math.min(2, Number(globalThis.__mergeBattleSpeed) || 1));
    // app.js historically runs the simulator at x1.45. On screen, x1 in 0.3.2
    // deliberately slows simulation to roughly half of the old visual pace.
    const readableScale = typeof window === 'undefined' ? 1 : 0.52 * uiSpeed;
    const snapshot = baseStep(dt * readableScale);
    exposeCombatState(battle);
    return snapshot;
  };

  return battle;
}
