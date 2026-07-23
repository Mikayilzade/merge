import { UNIT_DEFS } from './data.js';

const weaponShapes = {
  shield: `<g class="weapon weapon-shield"><path d="M26 63 L43 56 L47 91 Q35 106 23 91 Z" fill="#d9dfe8" stroke="#fff" stroke-width="3"/><path d="M30 65 L39 62 L41 87 Q35 95 29 87 Z" fill="#6d86a0"/><path d="M76 60 L91 89" stroke="#d7b46a" stroke-width="6" stroke-linecap="round"/><path d="M84 79 L96 87" stroke="#f1e8d0" stroke-width="4" stroke-linecap="round"/></g>`,
  sword: `<g class="weapon weapon-sword"><path d="M82 42 L94 86" stroke="#edf7ff" stroke-width="6" stroke-linecap="round"/><path d="M79 65 L91 61" stroke="#e7bd66" stroke-width="5"/><path d="M90 84 L95 97" stroke="#6e4b35" stroke-width="6" stroke-linecap="round"/></g>`,
  bow: `<g class="weapon weapon-bow"><path d="M88 43 Q109 70 89 101" fill="none" stroke="#d49d50" stroke-width="5"/><path d="M88 43 L89 101" stroke="#f3e6cc" stroke-width="2"/><path d="M70 72 L101 72" stroke="#dfeaff" stroke-width="3"/><path d="M98 68 L105 72 L98 76" fill="#dfeaff"/></g>`,
  orb: `<g class="weapon weapon-orb"><circle cx="92" cy="63" r="15" fill="#9f78ff" opacity=".4"/><circle cx="92" cy="63" r="9" fill="#e7ddff"/><path d="M76 74 Q92 93 108 74" fill="none" stroke="#b99cff" stroke-width="3"/><circle cx="92" cy="63" r="20" fill="none" stroke="#d6c7ff" stroke-width="2" stroke-dasharray="5 5"/></g>`,
  staff: `<g class="weapon weapon-staff"><path d="M92 48 L82 110" stroke="#7a5638" stroke-width="6" stroke-linecap="round"/><circle cx="94" cy="42" r="12" fill="#f5d56e"/><path d="M84 43 Q94 24 104 43 Q94 57 84 43" fill="#fff2a8" opacity=".8"/></g>`,
  bomb: `<g class="weapon weapon-bomb"><circle cx="91" cy="82" r="17" fill="#303741" stroke="#8d99a6" stroke-width="3"/><path d="M91 65 Q89 53 100 50" fill="none" stroke="#9f6f3f" stroke-width="4"/><circle cx="102" cy="48" r="5" fill="#ffcf57"/><path d="M72 58 L84 91" stroke="#7a5638" stroke-width="7" stroke-linecap="round"/></g>`,
  daggers: `<g class="weapon weapon-daggers"><path d="M79 55 L98 86" stroke="#d9e0ff" stroke-width="5" stroke-linecap="round"/><path d="M92 54 L73 86" stroke="#d9e0ff" stroke-width="5" stroke-linecap="round"/><path d="M76 58 L84 53 M95 58 L87 53" stroke="#a88cff" stroke-width="4"/></g>`,
  flame: `<g class="weapon weapon-flame"><path d="M91 93 Q71 75 91 50 Q95 68 104 57 Q112 82 91 93" fill="#ff7b4f"/><path d="M92 86 Q84 76 93 66 Q97 75 101 72 Q103 82 92 86" fill="#ffd36b"/><circle cx="92" cy="72" r="22" fill="#ff6b4a" opacity=".14"/></g>`
};

function bodyMarkup(def) {
  const a = def.art;
  return `
    <ellipse class="art-shadow" cx="60" cy="124" rx="31" ry="9" fill="#02030a" opacity=".34"/>
    <g class="character-body">
      <path class="cape" d="M42 61 Q60 49 78 61 L87 116 Q59 131 33 116 Z" fill="${a.secondary}" opacity=".92"/>
      <path class="leg" d="M47 99 L44 122" stroke="${a.secondary}" stroke-width="12" stroke-linecap="round"/>
      <path class="leg" d="M69 99 L74 122" stroke="${a.secondary}" stroke-width="12" stroke-linecap="round"/>
      <path class="boot" d="M36 123 Q45 116 51 123" stroke="#1a1b24" stroke-width="8" stroke-linecap="round"/>
      <path class="boot" d="M68 123 Q77 116 83 123" stroke="#1a1b24" stroke-width="8" stroke-linecap="round"/>
      <path class="torso" d="M40 59 Q60 48 80 59 L77 101 Q60 112 43 101 Z" fill="${a.primary}" stroke="rgba(255,255,255,.45)" stroke-width="2"/>
      <path d="M47 62 L58 99" stroke="#fff" stroke-width="5" opacity=".17"/>
      <path class="arm left-arm" d="M43 65 L29 91" stroke="${a.skin}" stroke-width="11" stroke-linecap="round"/>
      <path class="arm right-arm" d="M77 66 L91 88" stroke="${a.skin}" stroke-width="11" stroke-linecap="round"/>
      <circle class="head" cx="60" cy="43" r="20" fill="${a.skin}" stroke="rgba(255,255,255,.48)" stroke-width="2"/>
      <path class="hair" d="M41 43 Q43 18 63 21 Q80 22 80 45 Q69 32 43 39 Z" fill="${a.hair}"/>
      <circle cx="53" cy="45" r="2" fill="#171820"/><circle cx="67" cy="45" r="2" fill="#171820"/>
      <path d="M55 54 Q60 57 65 54" fill="none" stroke="#7f4f48" stroke-width="2" stroke-linecap="round"/>
      <path class="belt" d="M43 88 Q60 94 77 88" fill="none" stroke="#26212c" stroke-width="6"/>
      ${weaponShapes[a.weapon] || ''}
    </g>`;
}

export function unitArt(unitId, { className = '', label = '', decorative = false } = {}) {
  const def = UNIT_DEFS[unitId];
  if (!def) return '';
  const aria = decorative ? 'aria-hidden="true"' : `role="img" aria-label="${label || def.name}"`;
  return `<svg class="unit-art unit-art-${unitId} ${className}" viewBox="0 0 120 140" ${aria} xmlns="http://www.w3.org/2000/svg">
    <circle cx="60" cy="65" r="53" fill="${def.art.primary}" opacity=".08"/>
    <circle class="art-aura" cx="60" cy="68" r="46" fill="none" stroke="${def.art.primary}" stroke-width="2" opacity=".22" stroke-dasharray="4 7"/>
    ${bodyMarkup(def)}
  </svg>`;
}

export function wizardArt({ className = '' } = {}) {
  return `<svg class="wizard-art ${className}" viewBox="0 0 180 210" role="img" aria-label="Архонт">
    <ellipse cx="90" cy="192" rx="55" ry="12" fill="#05030d" opacity=".38"/>
    <path d="M48 92 Q90 63 132 92 L151 187 Q91 207 29 187 Z" fill="#463078"/>
    <path d="M53 94 L88 184" stroke="#a98cff" stroke-width="11" opacity=".32"/>
    <path d="M63 87 Q90 70 117 87 L113 154 Q90 168 67 154 Z" fill="#8064c8" stroke="#d8c7ff" stroke-width="3"/>
    <circle cx="90" cy="63" r="31" fill="#d6a27f"/>
    <path d="M57 63 Q56 27 92 26 Q123 29 123 67 Q105 48 61 59 Z" fill="#efe6ff"/>
    <path d="M56 52 Q90 2 128 52 L113 47 L118 67 Q91 49 59 66 Z" fill="#2a1b4a" stroke="#a98cff" stroke-width="3"/>
    <circle cx="79" cy="65" r="3" fill="#2d203b"/><circle cx="103" cy="65" r="3" fill="#2d203b"/>
    <path d="M80 79 Q91 86 103 78" fill="none" stroke="#7f4f48" stroke-width="3"/>
    <path d="M135 69 L123 184" stroke="#6f4d38" stroke-width="8" stroke-linecap="round"/>
    <circle cx="138" cy="56" r="20" fill="#a67eff" opacity=".38"/><circle cx="138" cy="56" r="10" fill="#f0e9ff"/>
    <path d="M127 56 Q138 35 149 56 Q138 75 127 56" fill="none" stroke="#c9b2ff" stroke-width="3"/>
  </svg>`;
}
