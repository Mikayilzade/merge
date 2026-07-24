const BUILD = '0.3.0';

function numberFromText(text = '') {
  const match = String(text).match(/(\d[\d\s]*)/);
  return match ? Number(match[1].replace(/\s/g, '')) : null;
}

function makeHexGrid() {
  const grid = document.createElement('div');
  grid.className = 'battle-hex-grid';
  grid.setAttribute('aria-hidden', 'true');
  for (let row = 0; row < 7; row += 1) {
    for (let col = 0; col < 7; col += 1) {
      const cell = document.createElement('i');
      cell.className = `battle-hex row-${row} ${row < 3 ? 'enemy-zone' : row > 3 ? 'player-zone' : 'neutral-zone'}`;
      cell.style.setProperty('--hex-col', col);
      cell.style.setProperty('--hex-row', row);
      grid.append(cell);
    }
  }
  return grid;
}

function enhancePowerReadout(screen) {
  const header = screen.querySelector('.match-header');
  const arena = screen.querySelector('.arena-wrap');
  if (!header || !arena) return;
  const own = numberFromText(screen.querySelector('.match-economy span')?.textContent);
  const enemy = numberFromText(screen.querySelector('.enemy-title')?.textContent);
  if (own == null || enemy == null) return;
  let versus = header.querySelector('.power-versus');
  if (!versus) {
    versus = document.createElement('div');
    versus.className = 'power-versus';
    header.append(versus);
  }
  versus.innerHTML = `<span class="power-you"><small>ТЫ</small><b>${own}</b></span><strong>⚔</strong><span class="power-enemy"><small>ВРАГ</small><b>${enemy}</b></span>`;
}

function enhanceArena(screen) {
  const arena = screen.querySelector('.arena-wrap');
  if (!arena) return;
  screen.classList.add('hex-v03');
  arena.dataset.combatModel = 'hex';
  if (!arena.querySelector('.battle-hex-grid')) arena.prepend(makeHexGrid());
  const enemyTitle = arena.querySelector('.enemy-title');
  if (enemyTitle) enemyTitle.title = 'Состав соперника фиксируется на весь раунд и не меняется от твоей перестановки.';
}

function updateHpLabels(root = document) {
  root.querySelectorAll('.combatant').forEach((combatant) => {
    const bar = combatant.querySelector('.hpbar');
    const fill = bar?.querySelector('i');
    if (!bar || !fill) return;
    let label = bar.querySelector('.hp-number');
    if (!label) {
      label = document.createElement('em');
      label.className = 'hp-number';
      bar.append(label);
    }
    const width = parseFloat(fill.style.width || '100');
    const value = Number.isFinite(width) ? Math.max(0, Math.min(100, Math.round(width))) : 100;
    label.textContent = `${value}%`;
  });
}

function relabelRanges(root = document) {
  root.querySelectorAll('.stat-cell').forEach((cell) => {
    const small = cell.querySelector('small');
    if (small?.textContent === 'Дальность' && !small.dataset.hexLabel) {
      small.textContent = 'Дальность · гексы';
      small.dataset.hexLabel = '1';
    }
  });
}

function enhance() {
  const screen = document.querySelector('#screen');
  if (!screen) return;
  if (screen.classList.contains('match-screen')) {
    enhanceArena(screen);
    enhancePowerReadout(screen);
  }
  updateHpLabels(screen);
  relabelRanges(document);
}

let scheduled = false;
function scheduleEnhance() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    enhance();
  });
}

const observer = new MutationObserver((mutations) => {
  let needsFull = false;
  for (const mutation of mutations) {
    if (mutation.type === 'attributes' && mutation.target.matches?.('.hpbar i')) {
      const bar = mutation.target.closest('.hpbar');
      const label = bar?.querySelector('.hp-number');
      if (label) {
        const value = Math.max(0, Math.min(100, Math.round(parseFloat(mutation.target.style.width || '100'))));
        label.textContent = `${Number.isFinite(value) ? value : 100}%`;
      } else needsFull = true;
    } else if (mutation.type === 'childList') needsFull = true;
  }
  if (needsFull) scheduleEnhance();
});

observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class'] });
window.addEventListener('pageshow', scheduleEnhance);
document.documentElement.dataset.mergeBuild = BUILD;
scheduleEnhance();
