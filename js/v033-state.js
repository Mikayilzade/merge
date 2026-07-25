const SAVE_KEY = 'merge-arcana-save-v1';
const DIFFICULTY_KEY = 'merge-arcana-difficulty-v033';

const nativeSetItem = Storage.prototype.setItem;
const nativeGetItem = Storage.prototype.getItem;
const nativeRemoveItem = Storage.prototype.removeItem;

function readDifficulty() {
  try { return JSON.parse(nativeGetItem.call(localStorage, DIFFICULTY_KEY) || '{}') || {}; }
  catch { return {}; }
}

function clearDifficulty() {
  try { nativeRemoveItem.call(localStorage, DIFFICULTY_KEY); } catch { /* optional */ }
  window.__mergeRetryPending = false;
}

Storage.prototype.setItem = function patchedSetItem(key, value) {
  if (this === localStorage && key === SAVE_KEY) {
    try {
      const parsed = JSON.parse(String(value));
      const state = readDifficulty();
      const match = parsed?.match;
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
        match.enemyTeam = JSON.parse(JSON.stringify(state.lastEnemyTeam));
        match.artifactActive = false;
        window.__mergeRetryPending = true;
        value = JSON.stringify(parsed);
      }
    } catch { /* never block the normal save */ }
  }
  return nativeSetItem.call(this, key, value);
};

function decorateLossModal() {
  const result = document.querySelector('.round-result.lost');
  if (!result) return;
  const state = readDifficulty();
  const round = Math.max(1, Number(state.lastRound) || 1);
  const paragraph = result.querySelector('p');
  if (paragraph) paragraph.textContent = 'Соперник остаётся тем же. Потрать доход, переставь героев или собери усиление и попробуй решить этот же раунд ещё раз.';
  const next = document.querySelector('[data-action="next-round"]');
  if (next) next.textContent = `Повторить раунд ${round}`;
}

const observer = new MutationObserver(() => decorateLossModal());
observer.observe(document.documentElement, { subtree: true, childList: true });

document.addEventListener('click', (event) => {
  const newMatch = event.target.closest?.('[data-action="new-match"]');
  if (newMatch) clearDifficulty();

  const retry = event.target.closest?.('[data-action="next-round"]');
  if (retry && document.querySelector('.round-result.lost')) {
    event.preventDefault();
    event.stopImmediatePropagation();
    location.reload();
  }
}, true);

window.addEventListener('pageshow', decorateLossModal);
