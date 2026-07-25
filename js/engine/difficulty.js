import { UNIT_DEFS, UNIT_IDS } from '../data.js';
import { teamCapForRound } from './economy.js';
import { seededRandom } from './random.js';
import { calculateTeamPower } from './stats.js';
import { cloneJson, readJsonStorage, writeJsonStorage } from './storage.js';

export const DIFFICULTY_STORAGE_KEY = 'merge-arcana-difficulty-v033';
const SAVE_KEY = 'merge-arcana-save-v1';

const ARCHETYPES = [
  ['guardian', 'healer', 'ranger', 'duelist', 'arcanist', 'bomber'],
  ['guardian', 'ranger', 'arcanist', 'healer', 'duelist', 'shade'],
  ['guardian', 'duelist', 'ranger', 'healer', 'bomber', 'pyromancer'],
  ['duelist', 'shade', 'ranger', 'guardian', 'healer', 'arcanist'],
  ['guardian', 'arcanist', 'healer', 'pyromancer', 'ranger', 'duelist'],
  ['guardian', 'bomber', 'ranger', 'duelist', 'healer', 'shade']
];

export function readDifficultyState() {
  const state = readJsonStorage(DIFFICULTY_STORAGE_KEY, {});
  return state && typeof state === 'object' ? state : {};
}

function writeDifficultyState(state) { writeJsonStorage(DIFFICULTY_STORAGE_KEY, state); }

export function adaptiveMultiplier(random = Math.random) {
  return 1.10 + Math.max(0, Math.min(0.999999, Number(random()) || 0)) * 0.05;
}

export function adaptiveTarget(previousPower, random = Math.random) {
  const basis = Math.max(1, Math.round(Number(previousPower) || 1));
  const coefficient = adaptiveMultiplier(random);
  return { coefficient, targetPower: Math.round(basis * coefficient) };
}

function allowedUnitIds(round) {
  if (round < 4) return UNIT_IDS.filter((id) => UNIT_DEFS[id].rarity !== 'epic');
  return [...UNIT_IDS];
}

function compositionFor(archetype, count, allowed, offset = 0) {
  const ordered = [...archetype.slice(offset), ...archetype.slice(0, offset)].filter((id) => allowed.includes(id));
  const result = [];
  for (const id of ordered) {
    if (result.length >= count) break;
    result.push(id);
  }
  for (const id of allowed) {
    if (result.length >= count) break;
    if (!result.includes(id)) result.push(id);
  }
  while (result.length < count) result.push(allowed[result.length % allowed.length]);
  return result;
}

function enumerateStars(length, maxStar, callback, index = 0, current = []) {
  if (index >= length) { callback(current); return; }
  for (let star = 1; star <= maxStar; star += 1) {
    current.push(star);
    enumerateStars(length, maxStar, callback, index + 1, current);
    current.pop();
  }
}

function candidateScore(power, target, team) {
  const relativeError = Math.abs(power - target) / Math.max(1, target);
  const duplicatePenalty = (team.length - new Set(team.map((unit) => unit.unitId)).size) * 0.012;
  return relativeError + duplicatePenalty;
}

export function buildEnemyForTarget({ round = 1, targetPower = 300, wizardLevel = 1, seed = 1 } = {}) {
  const cap = teamCapForRound(round);
  const minCount = Math.min(3, cap);
  const allowed = allowedUnitIds(round);
  const enemyWizardLevel = Math.max(1, Math.floor(wizardLevel * 0.65));
  const random = seededRandom(seed + round * 901 + Math.round(targetPower));
  const archetypes = [...ARCHETYPES].sort(() => random() - 0.5);
  let best = null;

  const inspect = (maxStar) => {
    for (let count = minCount; count <= cap; count += 1) {
      for (let a = 0; a < archetypes.length; a += 1) {
        for (let offset = 0; offset < Math.min(3, archetypes[a].length); offset += 1) {
          const ids = compositionFor(archetypes[a], count, allowed, offset);
          enumerateStars(count, maxStar, (stars) => {
            const team = ids.map((unitId, index) => ({ uid: `enemy-${round}-${a}-${offset}-${index}`, unitId, star: stars[index], slot: index }));
            const power = calculateTeamPower(team, {}, enemyWizardLevel, false);
            const score = candidateScore(power, targetPower, team);
            if (!best || score < best.score || (score === best.score && random() > 0.5)) best = { team, power, score };
          });
        }
      }
    }
  };

  inspect(round <= 1 ? 1 : round < 6 ? 2 : 3);
  if (!best || best.power < targetPower * 0.95) inspect(3);
  return best || { team: [], power: 0, score: 1 };
}

function currentWizardLevel() {
  const save = readJsonStorage(SAVE_KEY, null);
  return Math.max(1, Number(save?.profile?.wizardLevel) || 1);
}

function activeChallenge(state, round) {
  const challenge = state.challenges?.[String(round)];
  return challenge?.team?.length ? challenge : null;
}

export function generateEnemyTeam({ round = 1, playerPower = 0 } = {}) {
  const state = readDifficultyState();
  if (state.lastWinner === 'enemy' && Array.isArray(state.lastEnemyTeam) && state.lastEnemyTeam.length) return cloneJson(state.lastEnemyTeam);
  const cached = activeChallenge(state, round);
  if (cached) return cloneJson(cached.team);

  const previousPower = state.lastWinner === 'player' && state.lastPlayerPower ? state.lastPlayerPower : Math.max(230, Number(playerPower) || 230);
  const firstChallenge = state.lastWinner !== 'player';
  const coefficient = firstChallenge ? 0.96 : adaptiveMultiplier(Math.random);
  const targetPower = Math.round(previousPower * coefficient);
  const seed = Math.floor(Math.random() * 1_000_000_000);
  const built = buildEnemyForTarget({ round, targetPower, wizardLevel: currentWizardLevel(), seed });

  state.challenges ||= {};
  state.challenges[String(round)] = { round, basisPower: previousPower, coefficient, targetPower, actualPower: built.power, team: cloneJson(built.team) };
  writeDifficultyState(state);
  return cloneJson(built.team);
}

export function recordBattleResult({ winner, playerPower, enemyTeam, round, reason = 'normal' }) {
  const state = readDifficultyState();
  state.lastWinner = winner;
  state.lastPlayerPower = playerPower;
  state.lastEnemyTeam = cloneJson(enemyTeam || []);
  state.lastRound = round;
  state.lastBattleAt = Date.now();
  state.lastBattleEndReason = reason;
  writeDifficultyState(state);
  if (typeof window !== 'undefined') {
    window.__mergeLastBattleResult = winner;
    window.__mergeLastBattleRound = round;
    window.__mergeBattleEndReason = reason;
  }
}
