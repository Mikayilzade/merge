export * from './engine-v033.js';
import {
  calculateTeamPower,
  createBattle as createAdaptiveBattle,
  DIFFICULTY_STORAGE_KEY
} from './engine-v033.js';

const SAVE_KEY = 'merge-arcana-save-v1';

function safeParse(raw, fallback = null) {
  try { return JSON.parse(raw); } catch { return fallback; }
}

function readStorage(key, fallback = null) {
  try {
    const raw = globalThis.localStorage?.getItem?.(key);
    return raw == null ? fallback : safeParse(raw, fallback);
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try { globalThis.localStorage?.setItem?.(key, JSON.stringify(value)); } catch { /* optional */ }
}

function clone(value) {
  return value == null ? value : safeParse(JSON.stringify(value), value);
}

function hpScore(units, side) {
  return units
    .filter((unit) => unit.side === side)
    .reduce((sum, unit) => sum + Math.max(0, unit.hp) / Math.max(1, unit.maxHp), 0);
}

function progressSignature(units) {
  return units.map((unit) => [
    unit.combatId,
    unit.dead ? 1 : 0,
    Math.max(0, Math.round(unit.hp)),
    unit.col,
    unit.row
  ].join(':')).join('|');
}

function currentRound() {
  const save = readStorage(SAVE_KEY, {});
  return Math.max(1, Number(save?.match?.round) || 1);
}

function recordForcedResult({ winner, playerPower, enemyTeam, round, reason }) {
  const state = readStorage(DIFFICULTY_STORAGE_KEY, {}) || {};
  state.lastWinner = winner;
  state.lastPlayerPower = playerPower;
  state.lastEnemyTeam = clone(enemyTeam || []);
  state.lastRound = round;
  state.lastBattleAt = Date.now();
  state.lastBattleEndReason = reason;
  writeStorage(DIFFICULTY_STORAGE_KEY, state);
  if (typeof window !== 'undefined') {
    window.__mergeLastBattleResult = winner;
    window.__mergeLastBattleRound = round;
    window.__mergeBattleEndReason = reason;
  }
}

/**
 * 0.3.6 battle safety layer.
 *
 * Visual speed is intentionally slow on mobile. The old simulator timeout was
 * measured after that visual slowdown, so an awkward matchup could display
 * "БОЙ ИДЁТ…" for almost two real minutes. This facade keeps normal battles
 * untouched, but finishes true stalls quickly and caps total wall-time.
 */
export function createBattle(options) {
  const base = createAdaptiveBattle(options);
  const playerPower = calculateTeamPower(
    options.playerUnits || [],
    options.cardLevels || {},
    options.wizardLevel || 1,
    Boolean(options.artifactActive)
  );
  const enemySnapshot = clone(options.enemyUnits || []);
  const round = currentRound();

  let forcedFinished = false;
  let forcedWinner = null;
  let forcedReason = null;
  let outerClock = 0;
  let noProgressClock = 0;
  let previousSignature = progressSignature(base.units);
  let forcedRecorded = false;

  const originalStep = base.step.bind(base);

  function forceResult(reason) {
    if (forcedFinished || base.finished) return;
    const playerScore = hpScore(base.units, 'player');
    const enemyScore = hpScore(base.units, 'enemy');
    forcedWinner = playerScore >= enemyScore ? 'player' : 'enemy';
    forcedFinished = true;
    forcedReason = reason;
    if (!forcedRecorded) {
      forcedRecorded = true;
      recordForcedResult({ winner: forcedWinner, playerPower, enemyTeam: enemySnapshot, round, reason });
    }
  }

  function step(dt) {
    if (forcedFinished) {
      return { events: [], finished: true, winner: forcedWinner, units: base.units, reason: forcedReason };
    }

    const tick = Math.max(0, Number(dt) || 0);
    outerClock += tick;
    const snapshot = originalStep(tick);

    const signature = progressSignature(base.units);
    if (signature === previousSignature) noProgressClock += tick;
    else {
      noProgressClock = 0;
      previousSignature = signature;
    }

    // app.js feeds ~1.45 simulator seconds per real second, independent of the
    // readable animation multiplier inside engine-v031. These thresholds mean
    // ~5.5 real seconds with literally no HP/movement change, or ~21 seconds
    // maximum total battle time at normal settings.
    if (!base.finished && noProgressClock >= 8) forceResult('stalled');
    if (!base.finished && !forcedFinished && outerClock >= 30) forceResult('time-limit');

    if (forcedFinished) {
      return { ...snapshot, finished: true, winner: forcedWinner, reason: forcedReason, units: base.units };
    }
    return snapshot;
  }

  return {
    units: base.units,
    step,
    get finished() { return forcedFinished || base.finished; },
    get winner() { return forcedFinished ? forcedWinner : base.winner; }
  };
}
