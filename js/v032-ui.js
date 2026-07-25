import './v033-state.js?v=0.3.6';
import './v034-ui.js?v=0.3.6';
import { enhanceFormation } from './v032-formation.js?v=0.3.6';
import { enhanceCombatUi, refreshCombatBadges } from './v032-combat-ui.js?v=0.3.6';

const BUILD='0.3.6';
let scheduled=false;

function enhance(){
  const screen=document.querySelector('#screen');if(!screen)return;
  if(screen.classList.contains('match-screen'))enhanceFormation(screen);
  enhanceCombatUi(screen);
}

function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;enhance();});}

const observer=new MutationObserver((mutations)=>{
  let full=false;
  for(const mutation of mutations){
    if(mutation.type==='attributes'&&mutation.target.matches?.('.hpbar i')){
      const combatant=mutation.target.closest('.combatant');if(combatant)refreshCombatBadges(combatant.parentElement||document);
    }else if(mutation.type==='childList'){
      const meaningful=[...mutation.addedNodes].some((node)=>node.nodeType===1&&!node.classList?.contains('tactical-deploy-layer')&&!node.classList?.contains('enemy-deploy-layer')&&!node.classList?.contains('upgrade-preview')&&!node.classList?.contains('daily-rotation-note'));
      if(meaningful)full=true;
    }
  }
  if(full)schedule();
});

observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['style','class']});
window.addEventListener('pageshow',schedule);
document.documentElement.dataset.mergeBuild=BUILD;
schedule();