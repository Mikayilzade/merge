export const RARITY = {
  common: { name: 'Обычная', icon: '●', color: '#9fb3c8' },
  rare: { name: 'Редкая', icon: '◆', color: '#70a9ff' },
  epic: { name: 'Эпическая', icon: '✦', color: '#c787ff' }
};

export const UNIT_DEFS = {
  guardian: {
    id: 'guardian', name: 'Страж Рассвета', shortName: 'Страж', rarity: 'common', cost: 3,
    trait: 'aegis', role: 'Танк', roleIcon: '🛡',
    hp: 290, attack: 19, range: 22, moveSpeed: 28, attackInterval: 1.12,
    armor: 0.18, critChance: 0.04, critMultiplier: 1.5,
    abilityName: 'Последний бастион',
    abilityDescription: 'Когда здоровье ниже 45%, получает ещё 10% снижения входящего урона.',
    description: 'Самый надёжный передний боец. Медленно давит линию и принимает удар за более хрупких союзников.',
    lore: 'Стражи Рассвета охраняли мосты старой столицы ещё до Раскола. Их щиты выкованы из металла, который помнит солнечный свет.',
    quote: 'Пока щит стоит — город жив.',
    art: { primary: '#e6c66b', secondary: '#47627c', skin: '#d5a071', hair: '#3a2c25', weapon: 'shield' }
  },
  duelist: {
    id: 'duelist', name: 'Клинок Ветра', shortName: 'Дуэлянт', rarity: 'common', cost: 2,
    trait: 'aegis', role: 'Боец', roleIcon: '⚔',
    hp: 170, attack: 30, range: 20, moveSpeed: 43, attackInterval: 0.74,
    armor: 0.07, critChance: 0.09, critMultiplier: 1.55,
    comboEvery: 3, comboMultiplier: 1.7,
    abilityName: 'Третий выпад',
    abilityDescription: 'Каждая третья атака наносит 170% обычного урона.',
    description: 'Быстро входит в ближний бой и разгоняет урон серией частых атак.',
    lore: 'Клинки Ветра учатся побеждать до того, как противник поймёт, что дуэль уже началась. Каждый носит на рукояти имя первого учителя.',
    quote: 'Один шаг. Три удара. Тишина.',
    art: { primary: '#71c9de', secondary: '#2f4858', skin: '#d9a77e', hair: '#20232c', weapon: 'sword' }
  },
  ranger: {
    id: 'ranger', name: 'Следопыт Пепельных Лесов', shortName: 'Следопыт', rarity: 'common', cost: 3,
    trait: 'wild', role: 'Стрелок', roleIcon: '🏹',
    hp: 116, attack: 30, range: 116, moveSpeed: 31, attackInterval: 0.94,
    armor: 0.03, critChance: 0.15, critMultiplier: 1.65,
    firstShotCrit: true,
    abilityName: 'Метка добычи',
    abilityDescription: 'Первый выстрел по новой цели всегда критический.',
    description: 'Стабильный дальний урон. Особенно хорош, когда передняя линия удерживает врага на месте.',
    lore: 'После Раскола леса покрылись серым пеплом, но следопыты научились читать его как книгу: по одному отпечатку они знают, кто прошёл и чего боялся.',
    quote: 'След остаётся даже у тени.',
    art: { primary: '#6fbf73', secondary: '#294936', skin: '#b98967', hair: '#463528', weapon: 'bow' }
  },
  arcanist: {
    id: 'arcanist', name: 'Арканист Семи Печатей', shortName: 'Арканист', rarity: 'rare', cost: 4,
    trait: 'arcane', role: 'Маг', roleIcon: '✦',
    hp: 100, attack: 46, range: 108, moveSpeed: 26, attackInterval: 1.32,
    armor: 0.02, critChance: 0.07, critMultiplier: 1.55, splash: 42,
    abilityName: 'Разлом сферы',
    abilityDescription: 'Основная атака наносит 42% урона врагам рядом с целью.',
    description: 'Медленный, но мощный магический артиллерист. Наказывает врагов, стоящих плотной группой.',
    lore: 'Семь печатей когда-то удерживали небо целым. Теперь арканисты носят их осколки в парящих сферах и используют каждую трещину как оружие.',
    quote: 'Мир уже сломан. Я лишь выбираю линию разлома.',
    art: { primary: '#ad7cff', secondary: '#493067', skin: '#c48d6c', hair: '#ece1ff', weapon: 'orb' }
  },
  healer: {
    id: 'healer', name: 'Хранительница Искры', shortName: 'Хранительница', rarity: 'rare', cost: 3,
    trait: 'arcane', role: 'Поддержка', roleIcon: '✚',
    hp: 124, attack: 13, heal: 29, range: 102, moveSpeed: 29, attackInterval: 1.08,
    armor: 0.04, critChance: 0.04, critMultiplier: 1.5,
    abilityName: 'Нить возвращения',
    abilityDescription: 'Вместо атаки лечит самого раненого союзника в радиусе. Лечение может критовать.',
    description: 'Поддерживает переднюю линию и превращает затяжной бой в преимущество.',
    lore: 'Хранительницы верят, что у каждого живого существа есть искра, связанная с первым костром мира. Их магия не создаёт жизнь — она напоминает ей дорогу назад.',
    quote: 'Не уходи. Твоё место ещё здесь.',
    art: { primary: '#f2d06b', secondary: '#6f4d8f', skin: '#d7a17d', hair: '#f3e4d2', weapon: 'staff' }
  },
  bomber: {
    id: 'bomber', name: 'Подрывник Громовой Артели', shortName: 'Подрывник', rarity: 'rare', cost: 4,
    trait: 'wild', role: 'Артиллерия', roleIcon: '💥',
    hp: 92, attack: 39, range: 132, moveSpeed: 24, attackInterval: 1.5,
    armor: 0.06, critChance: 0.06, critMultiplier: 1.6, splash: 56,
    abilityName: 'Широкий заряд',
    abilityDescription: 'Взрыв наносит 42% урона всем врагам в большом радиусе от цели.',
    description: 'Самая дальняя атака в текущей коллекции. Слаб вблизи, но разрушает плотные построения.',
    lore: 'Громовая Артель считает каждый взрыв научным экспериментом. Если мастер выжил — формула верна. Если нет — ученики получают особенно ценные заметки.',
    quote: 'Отойди. Ещё дальше. Теперь идеально.',
    art: { primary: '#f28f3b', secondary: '#3d4654', skin: '#9a6b4d', hair: '#392d26', weapon: 'bomb' }
  },
  shade: {
    id: 'shade', name: 'Тень Безымянного Двора', shortName: 'Тень', rarity: 'epic', cost: 5,
    trait: 'veil', role: 'Убийца', roleIcon: '☾',
    hp: 132, attack: 37, range: 20, moveSpeed: 49, attackInterval: 0.82,
    armor: 0.05, critChance: 0.18, critMultiplier: 1.7, executeThreshold: 0.32, executeMultiplier: 1.55,
    targetMode: 'fragile',
    abilityName: 'Шёпот конца',
    abilityDescription: 'Предпочитает хрупкие цели. Наносит 155% урона врагам ниже 32% здоровья.',
    description: 'Очень быстрый убийца задней линии. Требует правильной расстановки и защиты от фокуса.',
    lore: 'У Безымянного Двора нет герба, трона и истории. Есть только список имён, которые должны исчезнуть до следующего новолуния.',
    quote: 'Ты услышишь меня только один раз.',
    art: { primary: '#665b9a', secondary: '#1d2032', skin: '#8f6f68', hair: '#14151c', weapon: 'daggers' }
  },
  pyromancer: {
    id: 'pyromancer', name: 'Пиромант Алого Осколка', shortName: 'Пиромант', rarity: 'epic', cost: 5,
    trait: 'veil', role: 'Маг', roleIcon: '🔥',
    hp: 104, attack: 43, range: 104, moveSpeed: 27, attackInterval: 1.18,
    armor: 0.02, critChance: 0.08, critMultiplier: 1.55, splash: 34,
    burnRatio: 0.22, burnDuration: 2.4,
    abilityName: 'Живое пламя',
    abilityDescription: 'Атаки поджигают цель: ещё 22% нанесённого урона за 2,4 секунды.',
    description: 'Давит постепенным уроном и добивает цели, которые пытаются пережить первый удар.',
    lore: 'Алый Осколок не горит — он убеждает материю вспомнить, что когда-то она была звездой. Пироманты лишь направляют этот воспоминательный жар.',
    quote: 'Пепел — это память огня.',
    art: { primary: '#ff6b4a', secondary: '#63233b', skin: '#c98f70', hair: '#ffcf6b', weapon: 'flame' }
  }
};

export const UNIT_IDS = Object.keys(UNIT_DEFS);

export const TRAITS = {
  aegis: {
    name: 'Клятва Рассвета', shortName: 'Рассвет', icon: '☀', threshold: 2,
    members: ['guardian', 'duelist'],
    description: 'Страж и Дуэлянт получают +20% здоровья и +8 п.п. брони.',
    lore: 'Воины старой столицы всё ещё держат клятву защищать тех, кто стоит за их спинами.'
  },
  wild: {
    name: 'Пепельная Охота', shortName: 'Охота', icon: '⟁', threshold: 2,
    members: ['ranger', 'bomber'],
    description: 'Следопыт и Подрывник получают +18% урона и +10% скорости передвижения.',
    lore: 'В Пепельных Лесах добычей становится тот, кто первым перестал двигаться.'
  },
  arcane: {
    name: 'Седьмая Печать', shortName: 'Печать', icon: '✦', threshold: 2,
    members: ['arcanist', 'healer'],
    description: 'Арканист и Хранительница получают +20% силы атаки/лечения и атакуют на 8% чаще.',
    lore: 'Две половины одной печати: одна разрывает материю, другая сшивает жизнь.'
  },
  veil: {
    name: 'Безлунная Завеса', shortName: 'Завеса', icon: '☾', threshold: 2,
    members: ['shade', 'pyromancer'],
    description: 'Тень и Пиромант получают +15 п.п. шанса критического удара и +25% критического множителя.',
    lore: 'Под Завесой не видно ни клинка, ни пламени — только их результат.'
  }
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

export const SHOP_ODDS = [
  { minRound: 1, maxRound: 2, common: 78, rare: 20, epic: 2 },
  { minRound: 3, maxRound: 5, common: 65, rare: 30, epic: 5 },
  { minRound: 6, maxRound: 8, common: 52, rare: 38, epic: 10 },
  { minRound: 9, maxRound: 10, common: 40, rare: 42, epic: 18 }
];

export const ARENA_SKINS = {
  violet: {
    id: 'violet', name: 'Аметистовый разлом', price: 0, icon: '✦',
    description: 'Холодный фиолетовый свет и кристаллы Арканы.'
  },
  ember: {
    id: 'ember', name: 'Кузня Алого Осколка', price: 900, icon: '🔥',
    description: 'Тёплая кузня, искры и раскалённые трещины.'
  },
  verdant: {
    id: 'verdant', name: 'Пепельный сад', price: 1200, icon: '🌿',
    description: 'Зелёное свечение леса, который выжил после Раскола.'
  }
};

export const STAT_HELP = {
  hp: { name: 'Здоровье', icon: '❤', description: 'Сколько чистого урона боец выдерживает до гибели.' },
  attack: { name: 'Сила удара', icon: '⚔', description: 'Базовый урон одной обычной атаки до брони и критических эффектов.' },
  dps: { name: 'Средний урон/сек', icon: '⌁', description: 'Расчётный урон в секунду с учётом частоты атак и среднего критического урона.' },
  attackSpeed: { name: 'Атак в секунду', icon: '⏱', description: 'Чем больше число, тем чаще боец атакует. Это 1 ÷ интервал атаки.' },
  moveSpeed: { name: 'Скорость движения', icon: '➜', description: 'Как быстро боец сближается с целью по арене. Не увеличивает частоту атак.' },
  range: { name: 'Дальность', icon: '◎', description: 'Максимальная дистанция атаки. Около 20 — ближний бой, 100+ — дальний.' },
  armor: { name: 'Броня', icon: '⬢', description: 'Процент физического и магического урона, который поглощается. Ограничение — 55%.' },
  crit: { name: 'Критический удар', icon: '✸', description: 'Шанс нанести увеличенный урон. Например 15% ×1,65.' },
  heal: { name: 'Лечение', icon: '✚', description: 'Количество здоровья, которое восстанавливает одна лечебная атака.' }
};
