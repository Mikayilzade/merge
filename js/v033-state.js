const DIFFICULTY_KEY = 'merge-arcana-difficulty-v033';

const nativeStringify = JSON.stringify.bind(JSON);
const nativeParse = JSON.parse.bind(JSON);
const nativeGetItem = Storage.prototype.getItem;
const nativeRemoveItem = Storage.prototype.removeItem;

function readDifficulty() {
  try { return nativeParse(nativeGetItem.call(localStorage, DIFFICULTY_KEY) || '{}') || {}; }
  catch { return {}; }
}

function clearDifficulty() {
  try { nativeRemoveItem.call(localStorage, DIFFICULTY_KEY); } catch { /* optional */ }
}

function clone(value) {
  try { return nativeParse(nativeStringify(value)); }
  catch { return value; }
}

// app.js keeps its save object inside the module. On a loss it originally advances
// match.round before persisting. Mutating only localStorage was not enough: the
// in-memory object still pointed at the next round, which forced a page reload.
//
// JSON.stringify receives the real save object by reference, so this narrow hook
// rewinds that same object immediately before app.js persists it. The normal
// `next-round` action can then close the modal and render the same challenge in-place.
const originalJsonStringify = JSON.stringify;
JSON.stringify = function mergeArcanaStringify(value, replacer, space) {
  try {
    const state = readDifficulty();
    const match = value?.match;
    const retryRound = Number(state.lastRound);
    if (
      state.lastWinner === 'enemy' &&
      match?.active &&
      Number.isInteger(retryRound) &&
      match.lives > 0 &&
      match.round === retryRound + 1 &&
      Array.isArray(state.lastEnemyTeam) &&
      state.lastEnemyTeam.length
    ) {
      match.round = retryRound;
      match.enemyTeam = clone(state.lastEnemyTeam);
      match.artifactActive = false;
    }
  } catch { /* never block normal serialization */ }
  return originalJsonStringify.call(JSON, value, replacer, space);
};

function decorateLossModal() {
  const result = document.querySelector('.round-result.lost');
  if (!result) return;
  const state = readDifficulty();
  const round = Math.max(1, Number(state.lastRound) || 1);
  const paragraph = result.querySelector('p');
  const copy = 'Соперник остаётся тем же. Потрать доход, переставь героев или собери усиление и сразу попробуй этот же раунд ещё раз.';
  if (paragraph && paragraph.textContent !== copy) paragraph.textContent = copy;

  const modal = result.closest('.modal');
  const next = modal?.querySelector('[data-action="next-round"]');
  const label = `Продолжить · повторить раунд ${round}`;
  if (next && next.textContent !== label) next.textContent = label;
}

let decorating = false;
const observer = new MutationObserver(() => {
  if (decorating) return;
  decorating = true;
  queueMicrotask(() => {
    try { decorateLossModal(); }
    finally { decorating = false; }
  });
});
observer.observe(document.documentElement, { subtree: true, childList: true });

document.addEventListener('click', (event) => {
  if (event.target.closest?.('[data-action="new-match"]')) clearDifficulty();
}, true);

window.addEventListener('pageshow', decorateLossModal);
