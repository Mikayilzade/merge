import { readJsonStorage, writeJsonStorage } from './storage.js';

export const BATTLE_REPORT_STORAGE_KEY = 'merge-arcana-last-battle-report-v04';

function normalizedEntry(entry, unit) {
  return {
    combatId: entry?.combatId || unit?.combatId,
    unitId: entry?.unitId || unit?.unitId,
    side: entry?.side || unit?.side,
    star: entry?.star || unit?.star || 1,
    damageDealt: Math.round(entry?.damageDealt || 0),
    damageTaken: Math.round(entry?.damageTaken || 0),
    healingDone: Math.round(entry?.healingDone || 0),
    kills: Math.round(entry?.kills || 0),
    attacks: Math.round(entry?.attacks || 0),
    backstabs: Math.round(entry?.backstabs || 0),
    hp: Math.max(0, Math.round(unit?.hp || 0)),
    maxHp: Math.max(1, Math.round(unit?.maxHp || 1)),
    alive: Boolean(unit && !unit.dead && unit.hp > 0)
  };
}

function sideHpScore(entries, side) {
  return entries.filter((entry) => entry.side === side).reduce((sum, entry) => sum + entry.hp / entry.maxHp, 0);
}

export function buildBattleReport({ report = {}, units = [], winner, reason = 'normal', round = null } = {}) {
  const byId = new Map(units.map((unit) => [unit.combatId, unit]));
  const ids = new Set([...Object.keys(report || {}), ...byId.keys()]);
  const entries = [...ids].map((id) => normalizedEntry(report?.[id], byId.get(id)));
  return {
    version: 1,
    at: Date.now(),
    round,
    winner,
    reason,
    playerHpScore: sideHpScore(entries, 'player'),
    enemyHpScore: sideHpScore(entries, 'enemy'),
    entries
  };
}

export function publishBattleReport(payload) {
  const report = buildBattleReport(payload);
  writeJsonStorage(BATTLE_REPORT_STORAGE_KEY, report);
  if (typeof window !== 'undefined') window.__mergeLastBattleReport = report;
  return report;
}

export function readLastBattleReport() {
  return readJsonStorage(BATTLE_REPORT_STORAGE_KEY, null);
}
