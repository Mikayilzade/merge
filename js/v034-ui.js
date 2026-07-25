import { MAX_CARD_LEVEL } from './data.js?v=0.3.4';
import { calculateUnitStats } from './engine-v033.js?v=0.3.4';

const SAVE_KEY = 'merge-arcana-save-v1';

function readSave() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY) || '{}') || {}; }
  catch { return {}; }
}

function fmt(value, digits = 1) {
  const n = Number(value) || 0;
  return Number.isInteger(n) ? String(n) : n.toFixed(digits).replace(/\.0$/, '');
}

function delta(next, current, digits = 1) {
  const d = Number(next) - Number(current);
  const value = Number.isInteger(d) ? String(d) : d.toFixed(digits).replace(/\.0$/, '');
  return `${d >= 0 ? '+' : ''}${value}`;
}

function statLine(icon, label, current, next, digits = 1) {
  return `<div class="upgrade-stat"><span>${icon} ${label}</span><b>${fmt(current, digits)} → ${fmt(next, digits)}</b><small>${delta(next, current, digits)}</small></div>`;
}

function decorateCollection(root = document) {
  const save = readSave();
  const wizardLevel = Math.max(1, Number(save.profile?.wizardLevel) || 1);

  root.querySelectorAll('.hero-card').forEach((cardEl) => {
    const button = cardEl.querySelector('.hero-card-main[data-unit]');
    const unitId = button?.dataset.unit;
    const card = save.cards?.[unitId];
    if (!unitId || !card || cardEl.querySelector('.upgrade-preview')) return;

    const preview = document.createElement('div');
    preview.className = 'upgrade-preview';

    if (card.level >= MAX_CARD_LEVEL) {
      preview.innerHTML = '<div class="upgrade-preview-title"><b>Карта полностью улучшена</b><span>MAX</span></div>';
    } else {
      const current = calculateUnitStats({ unitId, star: 1 }, { cardLevel: card.level, wizardLevel, activeTraits: {} });
      const nextLevel = card.level + 1;
      const next = calculateUnitStats({ unitId, star: 1 }, { cardLevel: nextLevel, wizardLevel, activeTraits: {} });
      const powerIcon = current.heal ? '✚' : '⚔';
      const powerLabel = current.heal ? 'Лечение' : 'Удар';
      const powerCurrent = current.heal || current.attack;
      const powerNext = next.heal || next.attack;
      preview.innerHTML = `<div class="upgrade-preview-title"><b>После улучшения до ур. ${nextLevel}</b><span>+6% от базы</span></div>
        <div class="upgrade-preview-grid">
          ${statLine('❤', 'HP', current.maxHp, next.maxHp, 0)}
          ${statLine(powerIcon, powerLabel, powerCurrent, powerNext, 0)}
          ${statLine('⌁', current.heal ? 'Поддержка/с' : 'DPS', current.dps, next.dps, 1)}
        </div>`;
    }

    const upgrade = cardEl.querySelector('.card-upgrade');
    if (upgrade) cardEl.insertBefore(preview, upgrade);
    else cardEl.append(preview);
  });
}

function decorateStore(root = document) {
  const heading = [...root.querySelectorAll('.page-heading h2')].find((node) => node.textContent.includes('Базар Осколков'));
  if (!heading) return;
  const pageHeading = heading.closest('.page-heading');
  const list = root.querySelector('.offer-list');
  if (!pageHeading || !list || root.querySelector('.daily-rotation-note')) return;

  const note = document.createElement('div');
  note.className = 'daily-rotation-note';
  note.innerHTML = '<b>Ежедневная ротация</b><span>Каждые сутки появляются 3 случайных героя с осколками + предложение артефактов. Купленные позиции остаются отмечены до следующей ротации.</span>';
  list.before(note);
}

function injectStyles() {
  if (document.querySelector('#v034-styles')) return;
  const style = document.createElement('style');
  style.id = 'v034-styles';
  style.textContent = `
    .upgrade-preview{margin:0 16px 12px;padding:10px 11px;border:1px solid #a981ff2c;border-radius:14px;background:linear-gradient(145deg,#7e5ce710,#ffffff05)}
    .upgrade-preview-title{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px}.upgrade-preview-title b{font-size:11px}.upgrade-preview-title span{font-size:9px;color:#c9b8f5}
    .upgrade-preview-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.upgrade-stat{display:grid;gap:2px;padding:6px;border-radius:10px;background:#0f0b1c66;border:1px solid #ffffff0e}.upgrade-stat span{font-size:8px;color:#bdb3d0}.upgrade-stat b{font-size:10px;white-space:nowrap}.upgrade-stat small{font-size:8px;color:#70efbd;font-weight:800}
    .daily-rotation-note{display:grid;gap:4px;margin:10px 0 14px;padding:11px 12px;border:1px solid #b28cff2d;border-radius:14px;background:#8e6bff0d}.daily-rotation-note b{font-size:11px;color:#e3d8ff}.daily-rotation-note span{font-size:10px;line-height:1.4;color:#bdb3d0}
    @media(max-width:430px){.upgrade-preview{margin:0 12px 10px}.upgrade-preview-grid{gap:4px}.upgrade-stat{padding:5px}.upgrade-stat b{font-size:9px}.upgrade-stat span,.upgrade-stat small{font-size:7.5px}}
  `;
  document.head.append(style);
}

function enhance() {
  injectStyles();
  decorateCollection(document);
  decorateStore(document);
}

let pending = false;
const schedule = () => {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => { pending = false; enhance(); });
};

new MutationObserver(schedule).observe(document.documentElement, { subtree: true, childList: true });
window.addEventListener('pageshow', schedule);
schedule();
