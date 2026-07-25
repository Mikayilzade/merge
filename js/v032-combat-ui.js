const SPEED_KEY='merge-arcana-battle-speed-v032';

function numberFromText(text=''){const match=String(text).match(/(\d[\d\s]*)/);return match?Number(match[1].replace(/\s/g,'')):null;}
function currentSpeed(){const stored=Number(localStorage.getItem(SPEED_KEY));return[0.5,1,2].includes(stored)?stored:1;}
window.__mergeBattleSpeed=currentSpeed();

function enhancePower(screen){
  const header=screen.querySelector('.match-header');if(!header)return;
  const own=numberFromText(screen.querySelector('.match-economy span')?.textContent);const enemy=numberFromText(screen.querySelector('.enemy-title')?.textContent);if(own==null||enemy==null)return;
  let versus=header.querySelector('.power-versus');if(!versus){versus=document.createElement('div');versus.className='power-versus';header.append(versus);}
  const html=`<span class="power-you"><small>ТЫ</small><b>${own}</b></span><strong>⚔</strong><span class="power-enemy"><small>ВРАГ</small><b>${enemy}</b></span>`;if(versus.innerHTML!==html)versus.innerHTML=html;
}

function ensureSpeed(arena){
  if(arena.querySelector('.battle-speed-control'))return;
  const control=document.createElement('div');control.className='battle-speed-control';
  control.innerHTML='<small>СКОРОСТЬ</small>'+[0.5,1,2].map((speed)=>`<button type="button" data-battle-speed="${speed}" class="${window.__mergeBattleSpeed===speed?'active':''}">×${speed}</button>`).join('');
  control.addEventListener('click',(event)=>{const button=event.target.closest('[data-battle-speed]');if(!button)return;event.preventDefault();event.stopPropagation();const speed=Number(button.dataset.battleSpeed);window.__mergeBattleSpeed=speed;try{localStorage.setItem(SPEED_KEY,String(speed));}catch{}control.querySelectorAll('button').forEach((item)=>item.classList.toggle('active',item===button));});
  arena.append(control);
}

function stateFor(combatant){return window.__mergeCombatState?.[combatant.id?.replace(/^combat-/,'')||''];}
function updateBadge(combatant){
  const state=stateFor(combatant);const bar=combatant.querySelector('.hpbar');const fill=bar?.querySelector('i');if(!bar||!fill)return;
  let hp=bar.querySelector('.hp-number');if(!hp){hp=document.createElement('em');hp.className='hp-number';bar.append(hp);}
  if(state)hp.textContent=`${state.hp}/${state.maxHp}`;else{const width=parseFloat(fill.style.width||'100');hp.textContent=`${Number.isFinite(width)?Math.max(0,Math.min(100,Math.round(width))):100}%`;}
  let stars=combatant.querySelector('.combat-stars');if(!stars){stars=document.createElement('span');stars.className='combat-stars';combatant.append(stars);}stars.textContent='★'.repeat(state?.star||1);
}

function updateBadges(root=document){root.querySelectorAll('.combatant').forEach(updateBadge);}
function relabelRanges(root=document){root.querySelectorAll('.stat-cell').forEach((cell)=>{const small=cell.querySelector('small');if(small?.textContent==='Дальность'&&!small.dataset.hexLabel){small.textContent='Дальность · гексы';small.dataset.hexLabel='1';}});}
function refreshHelp(root=document){
  root.querySelectorAll('.help-list article').forEach((article)=>{const title=article.querySelector('b')?.textContent;const copy=article.querySelector('p');if(!copy)return;if(title==='Дальность')copy.textContent='Максимальная дистанция действия в гексах. 1 — соседняя клетка; дальники и маги работают с 3–5 гексов.';if(title==='Скорость движения')copy.textContent='Определяет, как часто герой может перейти на соседний свободный гекс. Не увеличивает частоту атак.';});
  root.querySelectorAll('.formula-list article').forEach((article)=>{if(article.querySelector('b')?.textContent==='Сила команды'){const copy=article.querySelector('p');if(copy)copy.textContent='Сводный ориентир из здоровья, DPS, лечения и дальности. Это не прогноз победы: соперник фиксирован заранее, а путь, цели и расстановка могут перевернуть бой.';}});
}
function refreshCopy(root=document){const eyebrow=root.querySelector('.hero-v2 .eyebrow');if(eyebrow)eyebrow.textContent='ПРОТОТИП 0.3.2 · ТАКТИЧЕСКАЯ ГЕКС-АРЕНА';root.querySelectorAll('.guide-steps article p').forEach((p)=>{if(p.textContent.includes('Верхний ряд ближе к противнику')||p.textContent.includes('Расставь бойцов на своей стороне'))p.textContent='Нижние три ряда — твои 21 стартовый гекс. Выбери героя, затем любой свободный гекс. Враг заранее виден сверху и не меняется от твоей перестановки.';});refreshHelp(root);}

export function enhanceCombatUi(screen){const arena=screen.querySelector('.arena-wrap');if(arena){enhancePower(screen);ensureSpeed(arena);}updateBadges(screen);relabelRanges(document);refreshCopy(document);}
export function refreshCombatBadges(root=document){updateBadges(root);}
