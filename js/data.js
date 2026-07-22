export const UNIT_DEFS = {
  guardian: {
    id: 'guardian', name: 'Страж', icon: '🛡️', rarity: 'common', cost: 3,
    trait: 'guardians', role: 'Танк', hp: 260, attack: 18, range: 22, speed: 26, attackInterval: 1.15,
    description: 'Держит переднюю линию и принимает основной урон.'
  },
  duelist: {
    id: 'duelist', name: 'Дуэлянт', icon: '⚔️', rarity: 'common', cost: 2,
    trait: 'guardians', role: 'Боец', hp: 165, attack: 31, range: 20, speed: 39, attackInterval: 0.78,
    description: 'Быстро сокращает дистанцию и часто атакует.'
  },
  ranger: {
    id: 'ranger', name: 'Следопыт', icon: '🏹', rarity: 'common', cost: 3,
    trait: 'hunters', role: 'Стрелок', hp: 112, attack: 29, range: 118, speed: 28, attackInterval: 0.95,
    description: 'Надёжный дальний урон из заднего ряда.'
  },
  arcanist: {
    id: 'arcanist', name: 'Арканист', icon: '🔮', rarity: 'rare', cost: 4,
    trait: 'mystics', role: 'Маг', hp: 96, attack: 45, range: 108, speed: 25, attackInterval: 1.35, splash: 38,
    description: 'Медленно выпускает мощные атаки по области.'
  },
  healer: {
    id: 'healer', name: 'Хранительница', icon: '✨', rarity: 'rare', cost: 3,
    trait: 'mystics', role: 'Поддержка', hp: 118, attack: 12, heal: 27, range: 100, speed: 27, attackInterval: 1.1,
    description: 'Лечит самого раненого союзника, пока команда сражается.'
  },
  bomber: {
    id: 'bomber', name: 'Подрывник', icon: '💣', rarity: 'rare', cost: 4,
    trait: 'hunters', role: 'Артиллерия', hp: 88, attack: 38, range: 130, speed: 23, attackInterval: 1.55, splash: 48,
    description: 'Бьёт дальше всех и наказывает плотные построения.'
  }
};

export const UNIT_IDS = Object.keys(UNIT_DEFS);

export const TRAITS = {
  guardians: { name: 'Оплот', icon: '🛡️', threshold: 2, description: '+20% здоровья Стражам и Дуэлянтам' },
  hunters: { name: 'Охота', icon: '🎯', threshold: 2, description: '+16% урона Следопытам и Подрывникам' },
  mystics: { name: 'Мистика', icon: '✦', threshold: 2, description: '+18% силы атак и лечения Арканистам и Хранительницам' }
};

export const STAR_MULTIPLIERS = [0, 1, 1.82, 3.28];
export const MAX_STAR = 3;
export const MAX_CARD_LEVEL = 10;

export const CARD_UPGRADE_COSTS = {
  1: { shards: 6, coins: 60 },
  2: { shards: 10, coins: 100 },
  3: { shards: 16, coins: 170 },
  4: { shards: 24, coins: 260 },
  5: { shards: 34, coins: 380 },
  6: { shards: 48, coins: 540 },
  7: { shards: 66, coins: 760 },
  8: { shards: 88, coins: 1050 },
  9: { shards: 120, coins: 1450 }
};
