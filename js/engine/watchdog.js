import { recordBattleResult } from './difficulty.js';
import { publishBattleReport } from './report.js';
import { calculateTeamPower } from './stats.js';
import { cloneJson, readJsonStorage } from './storage.js';

const SAVE_KEY = 'merge-arcana-save-v1';

export function hpScore(units, side) {
  return units.filter((unit) => unit.side === side).reduce((sum, unit) => sum + Math.max(0, unit.hp) / Math.max(1, unit.maxHp), 0);
}

export function progressSignature(units) {
  return units.map((unit) => [unit.combatId, unit.dead ? 1 : 0, Math.max(0, Math.round(unit.hp)), unit.col, unit.row].join(':')).join('|');
}

function currentRound() {
  const save = readJsonStorage(SAVE_KEY, {});
  return Math.max(1, Number(save?.match?.round) || 1);
}

export function wrapBattleWatchdog(base, options) {
  const playerPower = calculateTeamPower(options.playerUnits || [], options.cardLevels || {}, options.wizardLevel || 1, Boolean(options.artifactActive));
  const enemySnapshot = cloneJson(options.enemyUnits || []);
  const round = currentRound();
  let forcedFinished = false;
  let forcedWinner = null;
  let forcedReason = null;
  let outerClock = 0;
  let noProgressClock = 0;
  let previousSignature = progressSignature(base.units);
  let forcedRecorded = false;

  function forceResult(reason) {
    if (forcedFinished || base.finished) return;
    const playerScore = hpScore(base.units, 'player');
    const enemyScore = hpScore(base.units, 'enemy');
    forcedWinner = playerScore >= enemyScore ? 'player' : 'enemy';
    forcedFinished = true;
    forcedReason = reason;
    if (!forcedRecorded) {
      forcedRecorded = true;
      recordBattleResult({ winner: forcedWinner, playerPower, enemyTeam: enemySnapshot, round, reason });
      publishBattleReport({ report: base.report, units: base.units, winner: forcedWinner, reason, round });
    }
  }

  const originalStep = base.step.bind(base);
  base.step = (dt) => {
    if (forcedFinished) return { events: [], finished: true, winner: forcedWinner, units: base.units, report: base.report, reason: forcedReason };
    const tick = Math.max(0, Number(dt) || 0);
    outerClock += tick;
    const snapshot = originalStep(tick);
    const signature = progressSignature(base.units);
    if (signature === previousSignature) noProgressClock += tick;
    else {
      noProgressClock = 0;
      previousSignature = signature;
    }
    if (!base.finished && noProgressClock >= 8) forceResult('stalled');
    if (!base.finished && !forcedFinished && outerClock >= 30) forceResult('time-limit');
    if (forcedFinished) return { ...snapshot, finished: true, winner: forcedWinner, reason: forcedReason, units: base.units, report: base.report };
    return snapshot;
  };

  return {
    units: base.units,
    report: base.report,
    step: base.step,
    get finished() { return forcedFinished || base.finished; },
    get winner() { return forcedFinished ? forcedWinner : base.winner; },
    get endReason() { return forcedFinished ? forcedReason : base.endReason; }
  };
}
