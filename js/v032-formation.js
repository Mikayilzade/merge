const FORMATION_KEY = 'merge-arcana-hex-formation-v032';
const DEFAULT_POSITIONS = [2,3,4,9,10,11,16,17,18];
const ENEMY_CELLS = [
  {col:3,row:2},{col:2,row:2},{col:4,row:2},
  {col:3,row:1},{col:1,row:1},{col:5,row:1},
  {col:2,row:0},{col:4,row:0},{col:3,row:0}
];

function readFormation(){
  try{const parsed=JSON.parse(localStorage.getItem(FORMATION_KEY)||'{}');return parsed&&typeof parsed==='object'?parsed:{};}catch{return {};}
}
function writeFormation(value){try{localStorage.setItem(FORMATION_KEY,JSON.stringify(value));}catch{}}
function setGridPosition(el,col,row){el.style.setProperty('--hex-col',col);el.style.setProperty('--hex-row',row);}
function coords(position){return{col:position%7,row:4+Math.floor(position/7)};}

function makeGrid(){
  const grid=document.createElement('div');
  grid.className='battle-hex-grid';
  grid.setAttribute('aria-hidden','true');
  for(let row=0;row<7;row+=1)for(let col=0;col<7;col+=1){
    const cell=document.createElement('i');
    cell.className=`battle-hex row-${row} ${row<3?'enemy-zone':row>3?'player-zone':'neutral-zone'}`;
    setGridPosition(cell,col,row);grid.append(cell);
  }
  return grid;
}

function boardEntries(arena){
  return [...arena.querySelectorAll('.plan-board .board-slot')].map((slot,index)=>({index,slot,token:slot.querySelector('.unit-token')})).filter((entry)=>entry.token);
}

function normalize(entries){
  const formation=readFormation();const used=new Set();
  for(const entry of entries){
    let position=Number(formation[String(entry.index)]);
    if(!Number.isInteger(position)||position<0||position>=21||used.has(position)){
      const preferred=DEFAULT_POSITIONS[entry.index]??entry.index;
      position=!used.has(preferred)?preferred:Array.from({length:21},(_,i)=>i).find((i)=>!used.has(i));
      formation[String(entry.index)]=position;
    }
    used.add(position);
  }
  writeFormation(formation);return formation;
}

function renderPlayer(arena){
  const entries=boardEntries(arena);const formation=normalize(entries);
  arena.querySelector('.tactical-deploy-layer')?.remove();
  const layer=document.createElement('div');layer.className='tactical-deploy-layer';layer.setAttribute('aria-label','Твоя зона расстановки: 21 гекс');
  const occupants=new Map(entries.map((entry)=>[Number(formation[String(entry.index)]),entry]));
  for(let position=0;position<21;position+=1){
    const cell=document.createElement('div');cell.className='tactical-cell';cell.dataset.formationCell=String(position);cell.tabIndex=0;
    const point=coords(position);setGridPosition(cell,point.col,point.row);
    const occupant=occupants.get(position);
    if(occupant){cell.classList.add('occupied');const clone=occupant.token.cloneNode(true);clone.classList.add('tactical-token');cell.append(clone);}else cell.innerHTML='<span class="deploy-dot">+</span>';
    layer.append(cell);
  }
  arena.append(layer);
}

function renderEnemy(arena){
  const source=[...arena.querySelectorAll('.enemy-icons .mini-unit')];
  arena.querySelector('.enemy-deploy-layer')?.remove();
  const layer=document.createElement('div');layer.className='enemy-deploy-layer';layer.setAttribute('aria-label','Стартовая расстановка соперника');
  source.forEach((icon,index)=>{const point=ENEMY_CELLS[index]||ENEMY_CELLS[index%ENEMY_CELLS.length];const holder=document.createElement('div');holder.className='enemy-tactical-unit';setGridPosition(holder,point.col,point.row);const clone=icon.cloneNode(true);clone.classList.add('enemy-field-token');holder.append(clone);layer.append(holder);});
  arena.append(layer);
}

function selectedSource(){
  const selected=document.querySelector('.plan-board .unit-token.selected, .bench .unit-token.selected');
  return selected?{zone:selected.dataset.zone,index:Number(selected.dataset.index)}:null;
}

function placeSelected(arena,position){
  const selected=selectedSource();if(!selected)return;
  const formation=normalize(boardEntries(arena));
  if(selected.zone==='bench'){
    const empty=[...arena.querySelectorAll('.plan-board .board-slot')].find((slot)=>!slot.querySelector('.unit-token'));
    if(!empty)return;
    const index=Number(empty.dataset.index);formation[String(index)]=position;writeFormation(formation);empty.click();return;
  }
  if(selected.zone!=='board')return;
  const current=Number(formation[String(selected.index)]);
  const other=Object.entries(formation).find(([index,pos])=>Number(pos)===position&&Number(index)!==selected.index);
  if(other)formation[other[0]]=current;
  formation[String(selected.index)]=position;writeFormation(formation);renderPlayer(arena);
}

function bind(arena){
  if(arena.dataset.tacticalBound)return;arena.dataset.tacticalBound='1';
  arena.addEventListener('click',(event)=>{if(event.target.closest('.unit-token'))return;const cell=event.target.closest('.tactical-cell');if(!cell)return;event.preventDefault();event.stopPropagation();placeSelected(arena,Number(cell.dataset.formationCell));});
  arena.addEventListener('keydown',(event)=>{if(!['Enter',' '].includes(event.key))return;const cell=event.target.closest('.tactical-cell');if(!cell)return;event.preventDefault();placeSelected(arena,Number(cell.dataset.formationCell));});
}

export function enhanceFormation(screen){
  const arena=screen.querySelector('.arena-wrap');if(!arena)return;
  screen.classList.add('hex-v032');arena.dataset.combatModel='hex';
  if(!arena.querySelector('.battle-hex-grid'))arena.prepend(makeGrid());
  renderPlayer(arena);renderEnemy(arena);bind(arena);
  const title=arena.querySelector('.enemy-title');if(title)title.textContent=title.textContent.replace('Соперник · ','Враг · ');
}
