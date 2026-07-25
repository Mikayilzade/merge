export { seededRandom, weightedPick } from './engine/random.js';
export {
  activeTraits,
  calculateTeamPower,
  calculateUnitStats,
  cardLevelMultiplier,
  countTraits,
  rangeInHexes,
  statMultipliers,
  wizardMultiplier
} from './engine/stats.js';
export {
  applyWizardXp,
  canMerge,
  createMetaOffers,
  createShop,
  experienceToNextWizardLevel,
  incomeForRound,
  interestForGold,
  mergeUnits,
  rarityLabel,
  shopOddsForRound,
  teamCapForRound
} from './engine/economy.js';
export {
  HEX_COLS,
  HEX_ROWS,
  findHexPath,
  hexDirectionIndex,
  hexDistance,
  hexKey,
  hexNeighbors,
  hexToPercent,
  isBackAttack,
  isInsideHex,
  oppositeHexDirection,
  ringCells
} from './engine/hex-grid.js';
export {
  adaptiveMultiplier,
  adaptiveTarget,
  buildEnemyForTarget,
  DIFFICULTY_STORAGE_KEY,
  generateEnemyTeam,
  readDifficultyState
} from './engine/difficulty.js';
export {
  ENEMY_DEPLOY_CELLS,
  FORMATION_STORAGE_KEY,
  PLAYER_DEPLOY_CELLS,
  enemyDeploymentCell,
  playerDeploymentCell,
  readStoredFormation
} from './engine/formation.js';

import { createCoreBattle } from './engine/combat-core.js';
import { recordBattleResult } from './engine/difficulty.js';
import { applyStoredFormation, exposeCombatState, wrapReadableBattleSpeed } from './engine/formation.js';
import { publishBattleReport } from './engine/report.js';
import { calculateTeamPower } from './engine/stats.js';
import { cloneJson, readJsonStorage } from './engine/storage.js';
import { wrapBattleWatchdog } from './engine/watchdog.js';

const SAVE_KEY = 'merge-arcana-save-v1';

function currentRound() {
  const save = readJsonStorage(SAVE_KEY, {});
  return Math.max(1, Number(save?.match?.round) || 1);
}

function wrapAdaptiveResultRecording(battle, options) {
  const playerPower = calculateTeamPower(
    options.playerUnits || [],
    options.cardLevels || {},
    options.wizardLevel || 1,
    Boolean(options.artifactActive)
  );
  const enemySnapshot = cloneJson(options.enemyUnits || []);
  const round = currentRound();
  let recorded = false;
  const originalStep = battle.step.bind(battle);
  battle.step = (dt) => {
    const snapshot = originalStep(dt);
    if (battle.finished && !recorded) {
      recorded = true;
      const reason = battle.endReason || snapshot.reason || 'normal';
      recordBattleResult({ winner: battle.winner, playerPower, enemyTeam: enemySnapshot, round, reason });
      publishBattleReport({ report: battle.report, units: battle.units, winner: battle.winner, reason, round });
    }
    return snapshot;
  };
  return battle;
}

export function createBattle(options) {
  let battle = createCoreBattle(options);
  battle = applyStoredFormation(battle);
  battle = wrapReadableBattleSpeed(battle);
  battle = wrapAdaptiveResultRecording(battle, options);
  battle = wrapBattleWatchdog(battle, options);
  exposeCombatState(battle);
  return battle;
}
