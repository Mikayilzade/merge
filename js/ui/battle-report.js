import { UNIT_DEFS } from '../data.js';
import { BATTLE_REPORT_STORAGE_KEY } from '../engine/report.js';

function readReport() {
  try { return JSON.parse(localStorage.getItem(BATTLE_REPORT_STORAGE_KEY) || 'null'); }
  catch { return null; }
}

function reasonLabel(report) {
  if (report.reason === 'stalled') return 'Решение судей · бой застопорился';
  if (report.reason === 'time-limit') return 'Решение судей · время вышло';
  if (report.reason === 'elimination') return 'Победа уничтожением';
  return 'Итог боя';
}

function metric(entry) {
  const def = UNIT_DEFS[entry.unitId];
  if (!def) return '';
  const parts = [`${'★'.repeat(entry.star || 1)} ${def.shortName}`];
  if (entry.damageDealt) parts.push(`урон ${entry.damageDealt}`);
  if (entry.healingDone) parts.push(`лечение ${entry.healingDone}`);
  if (entry.kills) parts.push(`добивания ${entry.kills}`);
  if (entry.backstabs) parts.push(`в спину ${entry.backstabs}`);
  return parts.join(' · ');
}

export function enhanceBattleResult(root = document) {
  const modal = root.querySelector('#modal-root .modal');
  const result = modal?.querySelector('.round-result');
  if (!modal || !result || modal.querySelector('.battle-report-v04')) return;
  const report = readReport();
  if (!report?.entries?.length) return;

  const player = report.entries.filter((entry) => entry.side === 'player')
    .sort((a, b) => (b.damageDealt + b.healingDone) - (a.damageDealt + a.healingDone))
    .slice(0, 4);
  const box = document.createElement('section');
  box.className = 'battle-report-v04';
  box.innerHTML = `<div class="battle-report-head"><b>${reasonLabel(report)}</b><span>HP-счёт ${report.playerHpScore.toFixed(2)} : ${report.enemyHpScore.toFixed(2)}</span></div>
    <div class="battle-report-units">${player.map((entry) => `<div><span>${metric(entry)}</span><small>осталось ${entry.hp}/${entry.maxHp} HP</small></div>`).join('')}</div>`;
  const actions = modal.querySelector('.modal-actions');
  if (actions) modal.insertBefore(box, actions);
  else modal.append(box);
}

const observer = new MutationObserver(() => enhanceBattleResult(document));
observer.observe(document.documentElement, { subtree: true, childList: true });
window.addEventListener('pageshow', () => enhanceBattleResult(document));
