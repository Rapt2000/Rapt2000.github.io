/* ==========================================================================
   集成战略群友赛 #5 — 赛事页面 / 算分系统
   单文件逻辑，无外部依赖。
   ========================================================================== */

'use strict';

/* --------------------------------------------------------------------------
   Constants
   -------------------------------------------------------------------------- */

const STORAGE_KEY = 'is5-friend-cup-v1';
const MAX_PLAYERS = 10;

const DIFFICULTIES = [
  { value: '6', label: '保密等级·6', coeff: 1.05 },
  { value: '9', label: '保密等级·9', coeff: 1.03 },
  { value: '12', label: '保密等级·12', coeff: 1.0 },
  { value: '15', label: '保密等级·15', coeff: 1.1 },
  { value: '16', label: '保密等级·16', coeff: 1.2 }
];

const SQUADS = [
  { id: 'command', name: '指挥分队', coeff: 1.15 },
  { id: 'special', name: '特勤分队', coeff: 1.05 },
  { id: 'logistics', name: '后勤分队', coeff: 0.97 },
  { id: 'spear', name: '矛头分队', coeff: 1.15 },
  { id: 'assault', name: '突击战术分队', coeff: 1.07 },
  { id: 'fortress', name: '堡垒战术分队', coeff: 1.05 },
  { id: 'ranged', name: '远程战术分队', coeff: 1.07 },
  { id: 'destruction', name: '破坏战术分队', coeff: 1.03 },
  { id: 'highground', name: '高台突破分队', coeff: 1.10 },
  { id: 'groundbreak', name: '地面突破分队', coeff: 1.10 },
  { id: 'origin', name: '本源研修分队', coeff: 1.07 },
  { id: 'civilization', name: '文明开化分队', coeff: 0.95 },
  { id: 'pioneer', name: '开拓者分队', coeff: 1.0 },
  { id: 'trade', name: '多边贸易分队', coeff: 0.95 },
  { id: 'geology', name: '地质调查分队', coeff: 1.0 },
  { id: 'solidarity', name: '团结阵线分队', coeff: 1.03 },
  { id: 'traverse', name: '踏足遍历分队', coeff: 0.97 }
];

const EXTRA_META = {
  life: { name: '生命蓝图' },
  leyline: { name: '黑流地脉' },
  utopia: { name: '特定实托邦' }
};

function defineStage(id, name, config = {}) {
  const extras = ['life', 'leyline', 'utopia']
    .filter((key) => Number(config[key]) > 0)
    .map((key) => ({ id: key, name: EXTRA_META[key].name, points: Number(config[key]) }));

  return {
    id,
    name,
    base: Number(config.base) || 0,
    noLeak: Number(config.noLeak) || 0,
    extras,
    option: config.option || null,
    flags: config.flags || [],
    chaseBlocksExtras: config.chaseBlocksExtras || [],
    compensation: Boolean(config.compensation),
    compensationIncludesFlags: Boolean(config.compensationIncludesFlags)
  };
}

function layerBaseOption(values) {
  return {
    id: 'layer',
    label: '通关层数',
    values: [
      { id: 'III', label: 'III·血色空脉', base: values[0] },
      { id: 'IV', label: 'IV·受害者腐殖', base: values[1] },
      { id: 'V', label: 'V·卡德霍之颅', base: values[2] }
    ]
  };
}

function layerBonusOption(values) {
  return {
    id: 'layer',
    label: '探测先锋层数',
    values: [
      { id: '1', label: '1 层', bonus: values[0] },
      { id: '2', label: '2 层', bonus: values[1] },
      { id: '3', label: '3 层', bonus: values[2] },
      { id: '4', label: '4 层', bonus: values[3] },
      { id: '5', label: '5 层', bonus: values[4] }
    ]
  };
}

function modeOption(normal, emergency) {
  return {
    id: 'mode',
    label: '作战难度',
    values: [
      { id: 'normal', label: '普通作战', noLeak: normal },
      { id: 'emergency', label: '紧急作战', noLeak: emergency }
    ]
  };
}

const BOSS_STAGES = [
  defineStage('iron', '铁腕迷思', { noLeak: 30, life: 15, leyline: 10, utopia: 5 }),
  defineStage('zeal', '狂热敬虔', { noLeak: 25, life: 15, leyline: 10, utopia: 5 }),
  defineStage('glory', '光荣远征', { noLeak: 35, life: 15, leyline: 10, utopia: 5 }),
  defineStage('mourning', '哀悼铁腕', { base: 40, noLeak: 10, life: 20 }),
  defineStage('cold', '冰冷流亡', { base: 35, noLeak: 10, life: 20 }),
  defineStage('golden', '赤金厄运', { base: 50, noLeak: 10, life: 20 })
];

const EMERGENCY_III_STAGES = [
  defineStage('em3-stone', '圆石技艺', { base: 40, noLeak: 10, life: 15, leyline: 15, utopia: 10 }),
  defineStage('em3-budget', '预算否决', { base: 30, noLeak: 5, life: 15, leyline: 10, utopia: 10 }),
  defineStage('em3-habit', '生存习性', { base: 30, noLeak: 5, life: 15, leyline: 10, utopia: 10 }),
  defineStage('em3-scorched', '焦土之家', { base: 25, noLeak: 5, life: 15, leyline: 15, utopia: 5 }),
  defineStage('em3-blackflow', '黑色逆流', { base: 25, noLeak: 5, life: 15, leyline: 15, utopia: 5 }),
  defineStage('em3-loot', '趁火打劫', { noLeak: 20, life: 15, leyline: 15, utopia: 5 }),
  defineStage('em3-path', '辟路行进', { noLeak: 20, life: 15, leyline: 10, utopia: 5 })
];

const EMERGENCY_IV_STAGES = [
  defineStage('em4-scenery', '取景圣地', { base: 50, noLeak: 10, life: 20, leyline: 15, utopia: 15 }),
  defineStage('em4-requiem', '安魂节起义', { base: 45, noLeak: 10, life: 20, leyline: 15, utopia: 15 }),
  defineStage('em4-future', '未来见闻', { base: 45, noLeak: 10, life: 20, leyline: 20, utopia: 15 }),
  defineStage('em4-birth', '诞生礼', { base: 40, noLeak: 10, life: 20, leyline: 15, utopia: 10 }),
  defineStage('em4-escort', '暴力押运', { base: 40, noLeak: 10, life: 20, leyline: 20, utopia: 10 }),
  defineStage('em4-plantation', '种植园惊魂', { base: 40, noLeak: 10, life: 20, leyline: 15, utopia: 10 }),
  defineStage('em4-knife', '长刀寒夜', { base: 35, noLeak: 10, life: 20, leyline: 15, utopia: 10 }),
  defineStage('em4-home', '侵占家园', { base: 35, noLeak: 10, life: 20, leyline: 15, utopia: 10 }),
  defineStage('em4-sides', '选边站', { base: 35, noLeak: 10, life: 20, leyline: 15, utopia: 10 })
];

const EMERGENCY_V_STAGES = [
  defineStage('em5-soul', '灵魂归宿', { base: 80, noLeak: 15, life: 30, leyline: 25, utopia: 25 }),
  defineStage('em5-parasite', '刺生灾害', { base: 70, noLeak: 10, life: 30, leyline: 25, utopia: 15 }),
  defineStage('em5-desire', '物欲遮天', { base: 70, noLeak: 10, life: 30, leyline: 30, utopia: 15 }),
  defineStage('em5-jungle', '丛林法则', { base: 70, noLeak: 10, life: 30, leyline: 30, utopia: 15 }),
  defineStage('em5-wage', '恶意讨薪', { base: 65, noLeak: 10, life: 30, leyline: 20, utopia: 15 }),
  defineStage('em5-step', '一步之遥', { base: 65, noLeak: 10, life: 30, leyline: 25, utopia: 15 }),
  defineStage('em5-breed', '过度繁殖', { base: 60, noLeak: 10, life: 30, leyline: 35, utopia: 15 }),
  defineStage('em5-water', '彼处水如酒', { base: 60, noLeak: 10, life: 30, leyline: 20, utopia: 15 }),
  defineStage('em5-farewell', '送别仪式', { base: 60, noLeak: 10, life: 30, leyline: 20, utopia: 15 })
];

const EMERGENCY_VI_STAGES = [
  defineStage('em6-march', '贫瘠行军', { base: 100, noLeak: 20, life: 40, leyline: 35, utopia: 20 }),
  defineStage('em6-coexist', '同域共存', { base: 100, noLeak: 20, life: 40, leyline: 40, utopia: 20 }),
  defineStage('em6-bond', '不解之缘', { base: 95, noLeak: 20, life: 40, leyline: 35, utopia: 20 }),
  defineStage('em6-fate', '命运共享', { base: 85, noLeak: 20, life: 40, leyline: 30, utopia: 20 })
];

const SPECIAL_STAGES = [
  defineStage('sp-invalid', '无效验尸', {
    noLeak: 20,
    leyline: 30,
    utopia: 20,
    option: layerBaseOption([100, 80, 50])
  }),
  defineStage('sp-ashpit', '灰坑', {
    noLeak: 10,
    life: 30,
    option: layerBaseOption([160, 110, 60])
  })
];

const WANDERER_STAGES = [
  defineStage('sp-buy', '强买强卖', { noLeak: 15, life: 15, leyline: 10, utopia: 5 }),
  defineStage('sp-chase', '进退趋同', { noLeak: 35, life: 25, leyline: 15, utopia: 10 })
];

const SETTLEMENT_STAGES = [
  defineStage('sp-branch', '枯枝', { noLeak: 30, life: 20, leyline: 15, utopia: 10 }),
  defineStage('sp-leaves', '败叶', { noLeak: 50, life: 30, leyline: 20, utopia: 15 })
];

const DUCK_STAGES = [
  defineStage('duck-opening', '开业剪彩', {
    noLeak: 20,
    life: 15,
    leyline: 10,
    utopia: 5,
    option: modeOption(20, 30)
  }),
  defineStage('duck-meeting', '合伙人会议', {
    noLeak: 50,
    life: 30,
    leyline: 20,
    utopia: 15,
    option: modeOption(50, 70)
  })
];

const CHASE_I_STAGES = [
  defineStage('ch1-plush', '毛绒游戏', { noLeak: 15 }),
  defineStage('ch1-blood', '血夜回魂', { noLeak: 15 }),
  defineStage('ch1-doom', '在劫难逃', { noLeak: 15 })
];

const CHASE_II_STAGES = [
  defineStage('ch2-fire', '易燃隐患', { base: 30, noLeak: 10 }),
  defineStage('ch2-fang', '外显尖牙', { base: 30, noLeak: 10 }),
  defineStage('ch2-equal', '一视同仁', { base: 30, noLeak: 10 }),
  defineStage('ch2-sheep', '咩的朋友', { base: 25, noLeak: 10 })
];

const CHASE_IV_STAGES = [
  defineStage('ch4-body', '“灭身”', { base: 70, noLeak: 20, life: 25 }),
  defineStage('ch4-rage', '“纵怒”', { base: 65, noLeak: 20, life: 25 }),
  defineStage('ch4-joy', '“闹乐”', { base: 60, noLeak: 20, life: 25 }),
  defineStage('ch4-locust', '晶矿惊蝗', { base: 65, noLeak: 20, life: 25 })
];

const ENDING_RESTART_STAGES = [
  defineStage('end-restless', '永无安宁', {
    base: 150,
    noLeak: 10,
    life: 30,
    leyline: 25,
    utopia: 15,
    option: layerBonusOption([10, 25, 50, 90, 120]),
    compensation: true
  }),
  defineStage('end-pain', '痛苦将息', {
    base: 200,
    noLeak: 20,
    life: 30,
    option: layerBonusOption([15, 30, 60, 120, 160]),
    compensation: true
  })
];

const ENDING_RESHAPE_STAGES = [
  defineStage('end-chaos', '混沌源阶理论', {
    base: 300,
    noLeak: 20,
    life: 35,
    leyline: 25,
    utopia: 20,
    compensation: true
  }),
  defineStage('end-constant', '失恒常量', {
    base: 400,
    noLeak: 20,
    life: 35,
    leyline: 25,
    utopia: 20,
    compensation: true
  })
];

const ENDING_HARMONY_STAGES = [
  defineStage('end-disease', '畸症', {
    base: 350,
    noLeak: 30,
    leyline: 30,
    utopia: 20,
    flags: [
      { id: 'chase', label: '追猎', points: 30 },
      { id: 'kill', label: '击杀<玻利瓦尔，症结之核>', points: 120 }
    ],
    chaseBlocksExtras: ['leyline', 'utopia'],
    compensation: true,
    compensationIncludesFlags: true
  })
];

const ENDING_REKINDLE_STAGES = [
  defineStage('end-sun', '熄日', {
    base: 400,
    noLeak: 30,
    life: 50,
    leyline: 30,
    utopia: 20,
    flags: [
      { id: 'chase', label: '追猎', points: 40 },
      { id: 'kill', label: '击杀<沉沦之人>', points: 200 }
    ],
    chaseBlocksExtras: ['leyline', 'utopia'],
    compensation: true,
    compensationIncludesFlags: true
  })
];

const SCORE_PARTS = [
  {
    id: 'boss',
    number: '1',
    title: '【Ⅲ·血色空脉】「险路恶敌」关卡得分',
    groups: [
      {
        id: 'boss',
        number: 'Ⅲ',
        title: '【Ⅲ·血色空脉】「险路恶敌」',
        selection: 'single',
        note: '六个关卡中仅可记录 1 个',
        stages: BOSS_STAGES
      }
    ]
  },
  {
    id: 'emergency',
    number: '2',
    title: '紧急作战关卡得分',
    groups: [
      {
        id: 'em3',
        number: '2.1',
        title: '【III·血色空脉】紧急作战',
        selection: 'multi',
        note: '可同时记录多个关卡',
        stages: EMERGENCY_III_STAGES
      },
      {
        id: 'em4',
        number: '2.2',
        title: '【IV·受害者腐殖】紧急作战',
        selection: 'multi',
        note: '可同时记录多个关卡',
        stages: EMERGENCY_IV_STAGES
      },
      {
        id: 'em5',
        number: '2.3',
        title: '【V·卡德霍之颅】紧急作战',
        selection: 'multi',
        note: '可同时记录多个关卡',
        stages: EMERGENCY_V_STAGES
      },
      {
        id: 'em6',
        number: '2.4',
        title: '【VI·源流交汇处/盲目者所见】紧急作战',
        selection: 'multi',
        note: '可同时记录多个关卡',
        stages: EMERGENCY_VI_STAGES
      }
    ]
  },
  {
    id: 'special',
    number: '3',
    title: '特殊作战关卡得分',
    groups: [
      {
        id: 'prelude',
        number: '3.1',
        title: '结局前置',
        selection: 'single',
        note: '两个关卡中仅可记录 1 个',
        stages: SPECIAL_STAGES
      },
      {
        id: 'wanderer',
        number: '3.2',
        title: '流窜居民',
        selection: 'multi',
        note: '可同时记录多个关卡',
        stages: WANDERER_STAGES
      },
      {
        id: 'settlement',
        number: '3.3',
        title: '居民据点',
        selection: 'multi',
        note: '可同时记录多个关卡',
        stages: SETTLEMENT_STAGES
      },
      {
        id: 'duck',
        number: '3.4',
        title: '鸭爵团伙',
        selection: 'multi',
        note: '可同时记录多个关卡',
        stages: DUCK_STAGES
      }
    ]
  },
  {
    id: 'chase',
    number: '4',
    title: '非险路恶敌追猎关卡得分',
    groups: [
      {
        id: 'chase1',
        number: '4.1',
        title: '【I·玻利瓦尔肤层】追猎作战',
        selection: 'single',
        note: '三个关卡中仅可记录 1 个',
        stages: CHASE_I_STAGES
      },
      {
        id: 'chase2',
        number: '4.2',
        title: '【II·甜美的伤口】追猎作战',
        selection: 'single',
        note: '四个关卡中仅可记录 1 个',
        stages: CHASE_II_STAGES
      },
      {
        id: 'chase4',
        number: '4.3',
        title: '【IV·受害者腐殖】追猎作战',
        selection: 'multi',
        note: '可同时记录多个关卡',
        stages: CHASE_IV_STAGES
      }
    ]
  },
  {
    id: 'finale',
    number: '5',
    title: '结局险路恶敌关卡得分',
    groups: [
      {
        id: 'ending-restart',
        number: '5.1',
        title: '结局【强制重启】',
        selection: 'single',
        note: '两个关卡中仅可记录 1 个',
        stages: ENDING_RESTART_STAGES
      },
      {
        id: 'ending-reshape',
        number: '5.2',
        title: '结局【维度重构】',
        selection: 'single',
        note: '两个关卡中仅可记录 1 个',
        stages: ENDING_RESHAPE_STAGES
      },
      {
        id: 'ending-harmony',
        number: '5.3',
        title: '结局【纠缠，调和】',
        selection: 'single',
        note: '仅有一个关卡',
        stages: ENDING_HARMONY_STAGES
      },
      {
        id: 'ending-rekindle',
        number: '5.4',
        title: '结局【旧日重燃】',
        selection: 'single',
        note: '仅有一个关卡',
        stages: ENDING_REKINDLE_STAGES
      }
    ]
  }
];

const ALL_STAGES = SCORE_PARTS.flatMap((part) => part.groups.flatMap((group) => group.stages));
const STAGE_MAP = new Map(ALL_STAGES.map((stage) => [stage.id, stage]));
const STAGE_GROUP_MAP = new Map();
SCORE_PARTS.forEach((part) => {
  part.groups.forEach((group) => {
    group.partId = part.id;
    group.stages.forEach((stage) => STAGE_GROUP_MAP.set(stage.id, group));
  });
});

const ABYSS_OPERATORS = [
  { id: 'closure', name: '可露希尔', hue: 6 },
  { id: 'silverash', name: '凛御银灰', hue: 205 },
  { id: 'chen', name: '赤刃明霄陈', hue: 12 },
  { id: 'klemenza', name: '克莱门莎', hue: 328 },
  { id: 'bellone', name: '贝洛内', hue: 275 },
  { id: 'wisadel', name: '维什戴尔', hue: 356 },
  { id: 'kaltsit', name: '凯尔希·思衡托', hue: 165 },
  { id: 'hoshigu', name: '斩业星熊', hue: 40 },
  { id: 'dionysus', name: '酒神', hue: 300 },
  { id: 'gnosis', name: '灵知', hue: 190 },
  { id: 'angelina', name: '予愿安洁莉娜', hue: 322 },
  { id: 'exusiai', name: '新约能天使', hue: 28 },
  { id: 'wang', name: '望', hue: 220 }
];

const FACTION_NAMES = [
  '罗德岛', '炎', '阿戈尔', '玻利瓦尔', '哥伦比亚',
  '东', '伊比利亚', '卡西米尔', '谢拉格', '拉特兰',
  '莱塔尼亚', '米诺斯', '雷姆必拓', '萨米', '萨尔贡',
  '叙拉古', '乌萨斯', '维多利亚', '卡兹戴尔'
];

const ENDING_GROUPS = [
  {
    id: 'two',
    title: '（1）结局【维度重构】收藏品记分',
    note: '可同时勾选',
    options: [
      { field: 'endingTwoAlpha', label: '沙盘α', points: 30 },
      { field: 'endingTwoBeta', label: '沙盘β', points: 20 }
    ],
    bonusText: '同时勾选沙盘α与沙盘β，额外 +30',
    bonus: (player) => (player.endingTwoAlpha && player.endingTwoBeta ? 30 : 0)
  },
  {
    id: 'three',
    title: '（2）结局【纠缠，调和】收藏品记分',
    note: '可同时勾选',
    options: [
      { field: 'endingThreeBeacon', label: '怦然信标', points: 40 },
      { field: 'endingThreeGod', label: '击坠“神明”', points: 30 },
      { field: 'endingThreeLight', label: '湮没“光明”', points: 40 },
      { field: 'endingThreeCivilization', label: '焚毁“文明”', points: 80 }
    ],
    bonusText: '同时勾选击坠“神明”、湮没“光明”、焚毁“文明”，额外 +60',
    bonus: (player) => (
      player.endingThreeGod && player.endingThreeLight && player.endingThreeCivilization ? 60 : 0
    )
  },
  {
    id: 'four',
    title: '（3）结局【旧日重燃】收藏品记分',
    note: '可同时勾选',
    options: [
      { field: 'endingFourPray', label: '谒日之祈', points: 20 },
      { field: 'endingFourPact', label: '祭日之契', points: 100 }
    ],
    bonusText: '',
    bonus: () => 0
  }
];

const NUMERIC_FIELD_LIMITS = {
  recruit6: [0, 99],
  recruit5: [0, 99],
  recruit4: [0, 99],
  collectibleCount: [0, 100],
  lossWheelLayers: [0, 99],
  lossFoodLayers: [0, 99],
  boardValue: [0, 99999],
  partsCapacity: [0, 999],
  swaddle: [0, 99],
  duck: [0, 99],
  settleScore: [0, 99999999],
  settleCollectibles: [0, 9999],
  settleThermos: [0, 9999],
  settleParts: [0, 9999],
  settleEfficiency: [0, 9999]
};

const PAGE_NAMES = new Set(['rules', 'rules-detail', 'schedule', 'calculator']);
const numberFormatter = new Intl.NumberFormat('zh-CN', {
  maximumFractionDigits: 2
});

/* --------------------------------------------------------------------------
   Small utilities
   -------------------------------------------------------------------------- */

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function toNumber(value) {
  if (value === '' || value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toInt(value, fallback = 0) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatNumber(value) {
  if (!Number.isFinite(value)) value = 0;
  const rounded = Math.round(value * 100) / 100;
  return numberFormatter.format(Object.is(rounded, -0) ? 0 : rounded);
}

function formatCoefficient(value) {
  const safe = Number.isFinite(Number(value)) ? Number(value) : 1;
  return safe.toFixed(2);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return character;
    }
  });
}

function stringValue(value, maxLength = 80) {
  if (value === null || value === undefined) return '';
  return String(value).slice(0, maxLength);
}

function inputValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  return String(value);
}

function formatDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return '—';
  return String(value).replaceAll('-', '.');
}

function getDifficulty(value) {
  return DIFFICULTIES.find((item) => item.value === String(value)) || DIFFICULTIES[3];
}

function getSquad(value) {
  return SQUADS.find((item) => item.id === value)
    || SQUADS.find((item) => item.id === 'pioneer')
    || SQUADS[0];
}

function getStage(id) {
  return STAGE_MAP.get(id);
}

function getStageGroup(id) {
  return STAGE_GROUP_MAP.get(id);
}

function createStageState(stage) {
  const options = {};
  if (stage.option) {
    options[stage.option.id] = stage.option.values[0].id;
  }
  return {
    selected: false,
    perfect: false,
    extras: [],
    flags: [],
    compensation: false,
    options
  };
}

function getStageOptionValue(stage, stageState) {
  if (!stage.option) return null;
  const selected = stageState.options && stageState.options[stage.option.id];
  return stage.option.values.find((value) => value.id === selected) || stage.option.values[0];
}

/* --------------------------------------------------------------------------
   State
   -------------------------------------------------------------------------- */

function createDefaultPlayer() {
  return {
    name: '',
    date: '',
    operator: '',
    difficulty: '15',
    squad: 'pioneer',
    stages: Object.fromEntries(ALL_STAGES.map((stage) => [stage.id, createStageState(stage)])),
    recruit6: '',
    recruit5: '',
    recruit4: '',
    mechanicNoRecruit: false,
    mechanicNoAssist: false,
    abyssSelected: [],
    abyssMissed: [],
    factions: [],
    collectibleCount: '',
    endingTwoAlpha: false,
    endingTwoBeta: false,
    endingThreeBeacon: false,
    endingThreeGod: false,
    endingThreeLight: false,
    endingThreeCivilization: false,
    endingFourPray: false,
    endingFourPact: false,
    lossWheel: false,
    lossWheelLayers: '',
    lossFood: false,
    lossFoodLayers: '',
    boardValue: '',
    partsCapacity: '',
    swaddle: '',
    duck: '',
    settleScore: '',
    settleCollectibles: '',
    settleThermos: '',
    settleParts: '',
    settleEfficiency: ''
  };
}

function createDefaultState() {
  return {
    version: 2,
    playerCount: MAX_PLAYERS,
    activePlayer: 0,
    players: Array.from({ length: MAX_PLAYERS }, () => createDefaultPlayer()),
    updatedAt: ''
  };
}

function normalizePlayer(raw, fallback) {
  const player = createDefaultPlayer();
  if (!raw || typeof raw !== 'object') return player;

  player.name = stringValue(raw.name, 80);
  player.date = /^\d{4}-\d{2}-\d{2}$/.test(String(raw.date)) ? String(raw.date) : '';
  player.operator = stringValue(raw.operator, 80);
  player.difficulty = DIFFICULTIES.some((item) => item.value === String(raw.difficulty))
    ? String(raw.difficulty)
    : fallback.difficulty;
  player.squad = SQUADS.some((item) => item.id === raw.squad)
    ? raw.squad
    : fallback.squad;

  const oldExtraAliases = { blueprint: 'life' };
  ALL_STAGES.forEach((stage) => {
    const saved = raw.stages && raw.stages[stage.id];
    if (!saved || typeof saved !== 'object') return;

    const target = player.stages[stage.id];
    target.selected = Boolean(saved.selected)
      || (saved.selected === undefined && Boolean(saved.perfect || saved.clear));
    target.perfect = Boolean(saved.perfect);
    target.compensation = Boolean(stage.compensation && saved.compensation);

    const allowedExtras = new Set(stage.extras.map((extra) => extra.id));
    const savedExtras = Array.isArray(saved.extras) ? saved.extras : [];
    target.extras = [...new Set(savedExtras
      .map((id) => oldExtraAliases[id] || id)
      .filter((id) => allowedExtras.has(id)))];

    const allowedFlags = new Set(stage.flags.map((flag) => flag.id));
    target.flags = Array.isArray(saved.flags)
      ? [...new Set(saved.flags.filter((id) => allowedFlags.has(id)))]
      : [];

    if (stage.option) {
      const savedOptions = saved.options && typeof saved.options === 'object' ? saved.options : {};
      const selected = savedOptions[stage.option.id];
      if (stage.option.values.some((value) => value.id === selected)) {
        target.options[stage.option.id] = selected;
      }
    }

    if (target.compensation) {
      target.perfect = false;
      if (!stage.compensationIncludesFlags) target.flags = [];
    }

    if (target.flags.includes('chase') && stage.chaseBlocksExtras.length) {
      const blocked = new Set(stage.chaseBlocksExtras);
      target.extras = target.extras.filter((id) => !blocked.has(id));
    }

    if (!target.selected) {
      target.perfect = false;
      target.compensation = false;
      target.extras = [];
      target.flags = [];
    }
  });

  // Single-selection groups must never retain more than one recorded stage.
  SCORE_PARTS.forEach((part) => {
    part.groups.forEach((group) => {
      if (group.selection !== 'single') return;
      let found = false;
      group.stages.forEach((stage) => {
        const target = player.stages[stage.id];
        if (!target.selected) return;
        if (found) {
          player.stages[stage.id] = createStageState(stage);
        } else {
          found = true;
        }
      });
    });
  });

  [
    'recruit6', 'recruit5', 'recruit4', 'collectibleCount', 'lossWheelLayers',
    'lossFoodLayers', 'boardValue', 'partsCapacity', 'swaddle', 'duck', 'settleScore',
    'settleCollectibles', 'settleThermos', 'settleParts', 'settleEfficiency'
  ].forEach((field) => {
    player[field] = inputValue(raw[field]);
  });

  player.mechanicNoRecruit = Boolean(raw.mechanicNoRecruit);
  player.mechanicNoAssist = Boolean(raw.mechanicNoAssist);

  const allowedOperators = new Set(ABYSS_OPERATORS.map((operator) => operator.id));
  player.abyssSelected = Array.isArray(raw.abyssSelected)
    ? [...new Set(raw.abyssSelected.filter((id) => allowedOperators.has(id)))].slice(0, 4)
    : [];
  player.abyssMissed = Array.isArray(raw.abyssMissed)
    ? [...new Set(raw.abyssMissed.filter((id) => player.abyssSelected.includes(id)))]
    : [];
  player.factions = Array.isArray(raw.factions)
    ? [...new Set(raw.factions.filter((name) => FACTION_NAMES.includes(name)))]
    : [];

  player.endingTwoAlpha = Boolean(raw.endingTwoAlpha)
    || raw.endingTwo === 'alpha' || raw.endingTwo === 'both';
  player.endingTwoBeta = Boolean(raw.endingTwoBeta)
    || raw.endingTwo === 'beta' || raw.endingTwo === 'both';

  player.endingThreeBeacon = Boolean(raw.endingThreeBeacon) || raw.endingThree === 'beacon';
  player.endingThreeGod = Boolean(raw.endingThreeGod)
    || raw.endingThree === 'god' || raw.endingThree === 'triple';
  player.endingThreeLight = Boolean(raw.endingThreeLight)
    || raw.endingThree === 'light' || raw.endingThree === 'triple';
  player.endingThreeCivilization = Boolean(raw.endingThreeCivilization)
    || raw.endingThree === 'civilization' || raw.endingThree === 'triple';

  player.endingFourPray = Boolean(raw.endingFourPray) || raw.endingFour === 'pray';
  player.endingFourPact = Boolean(raw.endingFourPact) || raw.endingFour === 'pact';

  player.lossWheel = Boolean(raw.lossWheel)
    || raw.lossRelicMode === 'wheel' || raw.lossRelicMode === 'both';
  player.lossFood = Boolean(raw.lossFood)
    || raw.lossRelicMode === 'food' || raw.lossRelicMode === 'both';

  if (player.lossWheelLayers === '') {
    player.lossWheelLayers = inputValue(
      raw.lossWheelLayers ?? (
        raw.lossRelicMode === 'wheel' || raw.lossRelicMode === 'both' ? raw.lossRelicLayers : ''
      )
    );
  }
  if (player.lossFoodLayers === '') {
    player.lossFoodLayers = inputValue(
      raw.lossFoodLayers ?? (
        raw.lossRelicMode === 'food' || raw.lossRelicMode === 'both' ? raw.lossRelicLayers : ''
      )
    );
  }

  return player;
}

function normalizeState(raw) {
  const state = createDefaultState();
  if (!raw || typeof raw !== 'object') return state;

  state.playerCount = clamp(toInt(raw.playerCount, MAX_PLAYERS), 1, MAX_PLAYERS);
  state.activePlayer = clamp(toInt(raw.activePlayer, 0), 0, state.playerCount - 1);

  const fallback = createDefaultPlayer();
  state.players = Array.from({ length: MAX_PLAYERS }, (_, index) => (
    normalizePlayer(raw.players && raw.players[index], fallback)
  ));

  state.updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : '';
  return state;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    return normalizeState(JSON.parse(raw));
  } catch (error) {
    console.warn('无法读取本机存档，将使用空白数据。', error);
    return createDefaultState();
  }
}

let state = loadState();
let saveTimer = null;
let toastTimer = null;
let lastSavedText = '';

/* --------------------------------------------------------------------------
   Scoring
   -------------------------------------------------------------------------- */

function stageScore(stage, stageState) {
  if (!stage || !stageState || !stageState.selected) return 0;

  const option = getStageOptionValue(stage, stageState);
  const base = option && option.base !== undefined ? option.base : stage.base;
  const noLeak = option && option.noLeak !== undefined ? option.noLeak : stage.noLeak;
  const bonus = option && option.bonus !== undefined ? option.bonus : 0;

  const chaseActive = stageState.flags.includes('chase');
  const blockedExtras = chaseActive ? new Set(stage.chaseBlocksExtras) : new Set();
  const extras = stage.extras.reduce(
    (total, extra) => (
      stageState.extras.includes(extra.id) && !blockedExtras.has(extra.id)
        ? total + extra.points
        : total
    ),
    0
  );

  const flags = stage.flags.reduce(
    (total, flag) => total + (stageState.flags.includes(flag.id) ? flag.points : 0),
    0
  );

  if (stage.compensation && stageState.compensation) {
    return (base + bonus + extras + (stage.compensationIncludesFlags ? flags : 0)) * 0.4;
  }

  return base + bonus + extras + flags + (stageState.perfect ? noLeak : 0);
}

function scoreGroup(player, group) {
  return group.stages.reduce(
    (total, stage) => total + stageScore(stage, player.stages[stage.id]),
    0
  );
}

function scorePart(player, part) {
  return part.groups.reduce((total, group) => total + scoreGroup(player, group), 0);
}

function scoreStages(player) {
  return SCORE_PARTS.reduce((total, part) => total + scorePart(player, part), 0);
}

function selectedStageCount(player, group) {
  return group.stages.filter((stage) => player.stages[stage.id].selected).length;
}

function scoreOperators(player) {
  const recruits =
    toNumber(player.recruit6) * 40 +
    toNumber(player.recruit5) * 20 +
    toNumber(player.recruit4) * 10;

  const mechanic =
    (player.mechanicNoRecruit ? 200 : 0) +
    (player.mechanicNoAssist ? 100 : 0);

  const abyss = player.abyssMissed.filter((id) => player.abyssSelected.includes(id)).length * 50;
  const factions = player.factions.length * 50;

  return recruits + mechanic + abyss + factions;
}

function lossRelicBreakdown(player) {
  const wheelLayers = player.lossWheel ? Math.max(0, toNumber(player.lossWheelLayers)) : 0;
  const foodLayers = player.lossFood ? Math.max(0, toNumber(player.lossFoodLayers)) : 0;
  const wheel = player.lossWheel ? -100 * wheelLayers : 0;
  const food = player.lossFood ? -150 * foodLayers : 0;
  const both = player.lossWheel && player.lossFood
    ? -100 * Math.max(wheelLayers, foodLayers)
    : 0;
  return { wheelLayers, foodLayers, wheel, food, both, total: wheel + food + both };
}

function scoreLossRelic(player) {
  return lossRelicBreakdown(player).total;
}

function scoreEndingGroup(player, group) {
  const options = group.options.reduce(
    (sum, option) => sum + (player[option.field] ? option.points : 0),
    0
  );
  return options + group.bonus(player);
}

function scoreEndings(player) {
  return ENDING_GROUPS.reduce((total, group) => total + scoreEndingGroup(player, group), 0);
}

function scorePartsCapacity(player) {
  if (player.partsCapacity === '') return 0;
  const capacity = Math.max(0, toNumber(player.partsCapacity));
  if (capacity <= 8) return 150;
  if (capacity <= 10) return 100;
  if (capacity <= 12) return 40;
  if (capacity <= 14) return 10;
  if (capacity <= 20) return 0;
  return -(capacity - 20) * 20;
}

function partsCapacityTier(player) {
  if (player.partsCapacity === '') return '待填写';
  const capacity = Math.max(0, toNumber(player.partsCapacity));
  if (capacity <= 8) return '+150';
  if (capacity <= 10) return '+100';
  if (capacity <= 12) return '+40';
  if (capacity <= 14) return '+10';
  if (capacity <= 20) return '±0';
  return `−${formatNumber((capacity - 20) * 20)}`;
}

function scoreOther(player) {
  const collectibles = clamp(toNumber(player.collectibleCount), 0, 100) * 2.5;
  const endings = scoreEndings(player);
  const lossRelic = scoreLossRelic(player);
  const board = -Math.max(0, toNumber(player.boardValue)) * 2;
  const parts = scorePartsCapacity(player);
  const swaddle = Math.max(0, toNumber(player.swaddle)) * 15;
  const duck = Math.max(0, toNumber(player.duck)) * 20;

  return collectibles + endings + lossRelic + board + parts + swaddle + duck;
}

function settlementBreakdown(player) {
  const gameScore = Math.max(0, toNumber(player.settleScore));
  const efficiency = Math.max(0, toNumber(player.settleEfficiency));
  const parts = Math.max(0, toNumber(player.settleParts));
  const collectibles = Math.max(0, toNumber(player.settleCollectibles));
  const thermos = Math.max(0, toNumber(player.settleThermos));

  const base = efficiency > 0 ? gameScore / efficiency : 0;
  const partsPenalty = parts * 5;
  const excess = Math.max(collectibles - thermos - 135, 0);
  const collectiblePenalty = excess * 5;
  const valid = efficiency > 0 || gameScore === 0;

  return {
    gameScore,
    efficiency,
    parts,
    collectibles,
    thermos,
    base,
    partsPenalty,
    excess,
    collectiblePenalty,
    valid,
    value: valid ? base - partsPenalty - collectiblePenalty : 0
  };
}

function scoreSettlement(player) {
  return settlementBreakdown(player).value;
}

function calculatePlayer(player) {
  const stage = scoreStages(player);
  const operator = scoreOperators(player);
  const other = scoreOther(player);
  const settlement = scoreSettlement(player);
  const subtotal = stage + operator + other + settlement;
  const difficulty = getDifficulty(player.difficulty);
  const squad = getSquad(player.squad);
  const squadCoeff = Number.isFinite(Number(squad.coeff)) ? Number(squad.coeff) : 1;
  const total = subtotal * difficulty.coeff * squadCoeff;

  return {
    stage,
    operator,
    other,
    settlement,
    subtotal,
    difficulty,
    squad,
    squadCoeff,
    total,
    settlementDetail: settlementBreakdown(player)
  };
}

/* --------------------------------------------------------------------------
   DOM references
   -------------------------------------------------------------------------- */

const elements = {
  pagePanels: [...document.querySelectorAll('[data-page-panel]')],
  navItems: [...document.querySelectorAll('.nav-item')],
  pageLinks: [...document.querySelectorAll('[data-page-link], [data-page]')],
  saveState: document.getElementById('saveState'),
  saveText: document.getElementById('saveText'),
  playerCount: document.getElementById('playerCount'),
  playerCountLabel: document.getElementById('playerCountLabel'),
  playerTabs: document.getElementById('playerTabs'),
  calculatorMount: document.getElementById('calculatorMount'),
  dockIndex: document.getElementById('dockIndex'),
  dockName: document.getElementById('dockName'),
  dockStatus: document.getElementById('dockStatus'),
  dockTotal: document.getElementById('dockTotal'),
  dockCoefficients: document.getElementById('dockCoefficients'),
  scheduleBody: document.getElementById('scheduleBody'),
  registeredCount: document.getElementById('registeredCount'),
  scoredCount: document.getElementById('scoredCount'),
  scheduleUpdated: document.getElementById('scheduleUpdated'),
  toast: document.getElementById('toast')
};

/* --------------------------------------------------------------------------
   Render: shared bits
   -------------------------------------------------------------------------- */

function currentPlayer() {
  return state.players[state.activePlayer];
}

function currentCalculation() {
  return calculatePlayer(currentPlayer());
}

function playerLabel(player, index) {
  return player.name.trim() || `选手 ${String(index + 1).padStart(2, '0')}`;
}

function showToast(message) {
  if (!elements.toast) return;
  elements.toast.textContent = message;
  elements.toast.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    elements.toast.classList.remove('is-visible');
  }, 2400);
}

function setSaveText(text, mode = '') {
  if (!elements.saveText || !elements.saveState) return;
  elements.saveText.textContent = text;
  elements.saveState.classList.toggle('is-saving', mode === 'saving');
  elements.saveState.classList.toggle('is-error', mode === 'error');
  if (mode !== 'saving') lastSavedText = text;
}

function markDirty({ immediate = false } = {}) {
  state.updatedAt = new Date().toISOString();
  setSaveText('保存中…', 'saving');
  window.clearTimeout(saveTimer);

  if (immediate) {
    persistState();
    return;
  }

  saveTimer = window.setTimeout(() => {
    persistState();
  }, 150);
}

function persistState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setSaveText(`已自动保存 · ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`);
  } catch (error) {
    console.warn('无法写入本机存档。', error);
    setSaveText('保存失败 · 请检查浏览器设置', 'error');
  }
}

function updateDock() {
  const player = currentPlayer();
  const calc = currentCalculation();
  const number = String(state.activePlayer + 1).padStart(2, '0');

  elements.dockIndex.textContent = `PLAYER ${number}`;
  elements.dockName.textContent = player.name.trim() || '未登记昵称';
  elements.dockStatus.textContent = `正在编辑第 ${state.activePlayer + 1} 位选手 · ${getDifficulty(player.difficulty).label}`;
  elements.dockTotal.textContent = formatNumber(calc.total);
  elements.dockCoefficients.textContent =
    `×${formatCoefficient(calc.difficulty.coeff)} 难度 · ×${formatCoefficient(calc.squadCoeff)} 分队`;

  document.querySelectorAll('[data-score-part="stage"]').forEach((node) => {
    node.textContent = formatNumber(calc.stage);
  });
  document.querySelectorAll('[data-score-part="operator"]').forEach((node) => {
    node.textContent = formatNumber(calc.operator);
  });
  document.querySelectorAll('[data-score-part="other"]').forEach((node) => {
    node.textContent = formatNumber(calc.other);
  });
  document.querySelectorAll('[data-score-part="settlement"]').forEach((node) => {
    node.textContent = formatNumber(calc.settlement);
  });
  document.querySelectorAll('[data-score-part="total"]').forEach((node) => {
    node.textContent = formatNumber(calc.total);
  });

  SCORE_PARTS.forEach((part) => {
    const partNode = elements.calculatorMount.querySelector(`[data-stage-part-score="${part.id}"]`);
    if (partNode) partNode.textContent = formatNumber(scorePart(player, part));

    part.groups.forEach((group) => {
      const scoreNode = elements.calculatorMount.querySelector(`[data-group-score="${group.id}"]`);
      if (scoreNode) scoreNode.textContent = formatNumber(scoreGroup(player, group));

      const metaNode = elements.calculatorMount.querySelector(`[data-group-meta="${group.id}"]`);
      if (metaNode) {
        metaNode.textContent =
          `${group.selection === 'single' ? '单选' : '多选'} · ${selectedStageCount(player, group)}/${group.stages.length}`;
      }
    });
  });

  const finalTotal = elements.calculatorMount.querySelector('[data-total-big]');
  if (finalTotal) finalTotal.textContent = formatNumber(calc.total);

  const combinedCoeff = elements.calculatorMount.querySelector('[data-combined-coeff]');
  if (combinedCoeff) {
    combinedCoeff.textContent = `×${formatCoefficient(calc.difficulty.coeff * calc.squadCoeff)}`;
  }

  const finalParts = {
    stage: elements.calculatorMount.querySelector('[data-final-part="stage"]'),
    operator: elements.calculatorMount.querySelector('[data-final-part="operator"]'),
    other: elements.calculatorMount.querySelector('[data-final-part="other"]'),
    settlement: elements.calculatorMount.querySelector('[data-final-part="settlement"]'),
    difficulty: elements.calculatorMount.querySelector('[data-final-coeff="difficulty"]'),
    squad: elements.calculatorMount.querySelector('[data-final-coeff="squad"]')
  };

  if (finalParts.stage) finalParts.stage.textContent = formatNumber(calc.stage);
  if (finalParts.operator) finalParts.operator.textContent = formatNumber(calc.operator);
  if (finalParts.other) finalParts.other.textContent = formatNumber(calc.other);
  if (finalParts.settlement) finalParts.settlement.textContent = formatNumber(calc.settlement);
  if (finalParts.difficulty) finalParts.difficulty.textContent = `×${formatCoefficient(calc.difficulty.coeff)}`;
  if (finalParts.squad) finalParts.squad.textContent = `×${formatCoefficient(calc.squadCoeff)}`;
}

/* --------------------------------------------------------------------------
   Render: player tabs
   -------------------------------------------------------------------------- */

function renderPlayerTabs() {
  const previousScrollTop = elements.playerTabs.scrollTop;
  const previousScrollLeft = elements.playerTabs.scrollLeft;

  const tabs = state.players.slice(0, state.playerCount).map((player, index) => {
    const calc = calculatePlayer(player);
    const active = index === state.activePlayer;
    return `
      <button
        class="player-tab${active ? ' is-active' : ''}"
        type="button"
        role="tab"
        aria-selected="${active}"
        aria-controls="calculatorPage"
        data-player-index="${index}"
      >
        <span class="player-tab__num">${String(index + 1).padStart(2, '0')}</span>
        <span class="player-tab__body">
          <b>${escapeHtml(player.name.trim() || '待登记')}</b>
          <small>${player.name.trim() ? formatNumber(calc.total) : '尚未填写'}</small>
        </span>
        <span class="player-tab__score">${player.name.trim() ? '分' : '—'}</span>
      </button>
    `;
  }).join('');

  elements.playerTabs.innerHTML = tabs;
  elements.playerTabs.scrollTop = previousScrollTop;
  elements.playerTabs.scrollLeft = previousScrollLeft;
  elements.playerCountLabel.textContent = `${state.playerCount} PAGES`;
}

/* --------------------------------------------------------------------------
   Render: calculator template
   -------------------------------------------------------------------------- */

function difficultyTemplate(player) {
  return DIFFICULTIES.map((difficulty) => `
    <label class="choice">
      <input
        type="radio"
        name="difficulty"
        value="${difficulty.value}"
        data-field="difficulty"
        ${player.difficulty === difficulty.value ? 'checked' : ''}
      >
      <span class="choice__body">
        <span class="choice__name">${difficulty.label}</span>
        <span class="choice__coeff">系数 ×${difficulty.coeff.toFixed(2)}</span>
      </span>
    </label>
  `).join('');
}

function squadTemplate(player) {
  return SQUADS.map((squad) => `
    <label class="choice choice--squad">
      <input
        type="radio"
        name="squad"
        value="${squad.id}"
        data-field="squad"
        ${player.squad === squad.id ? 'checked' : ''}
      >
      <span class="choice__body">
        <img class="squad-icon" src="assets/squads/${squad.id}.png" alt="">
        <span class="choice__text">
          <span class="choice__name">${squad.name}</span>
          <span class="choice__coeff">分队系数 ×${squad.coeff.toFixed(2)}</span>
        </span>
      </span>
    </label>
  `).join('');
}

function stageSummary(stage) {
  const parts = [];
  let baseText = stage.base ? `基础 +${stage.base}` : '';
  let noLeakText = stage.noLeak ? `无漏 +${stage.noLeak}` : '';

  if (stage.option) {
    if (stage.option.values.some((value) => value.base !== undefined)) {
      baseText = `基础 ${stage.option.values.map((value) => value.base).join('/')}`;
    }
    if (stage.option.values.some((value) => value.noLeak !== undefined)) {
      noLeakText = `无漏 ${stage.option.values.map((value) => value.noLeak).join('/')}`;
    }
    if (stage.option.values.some((value) => value.bonus !== undefined)) {
      parts.push('层数加分');
    }
  }

  if (baseText) parts.push(baseText);
  if (noLeakText) parts.push(noLeakText);
  if (stage.flags.length) parts.push(stage.flags.map((flag) => escapeHtml(flag.label)).join(' / '));
  if (stage.compensation) parts.push('可补偿 40%');
  if (stage.extras.length) parts.push(`${stage.extras.length} 项额外加分`);
  return parts.join(' · ');
}

function optionValueLabel(value) {
  const suffix = [];
  if (value.base !== undefined) suffix.push(`基础 ${value.base}`);
  if (value.noLeak !== undefined) suffix.push(`无漏 ${value.noLeak}`);
  if (value.bonus !== undefined) suffix.push(`+${value.bonus}`);
  return suffix.length ? `${value.label} · ${suffix.join(' / ')}` : value.label;
}

function stageOptionTemplate(stage, stageState) {
  if (!stage.option) return '';
  const selected = stageState.options[stage.option.id] || stage.option.values[0].id;
  return `
    <label class="stage-option">
      <span>${stage.option.label}</span>
      <select data-stage-option="${stage.id}" data-option-id="${stage.option.id}">
        ${stage.option.values.map((value) => `
          <option value="${value.id}" ${selected === value.id ? 'selected' : ''}>${optionValueLabel(value)}</option>
        `).join('')}
      </select>
    </label>
  `;
}

function stageCardTemplate(stage, group, player) {
  const stageState = player.stages[stage.id];
  const selected = Boolean(stageState.selected);
  const points = stageScore(stage, stageState);
  const option = getStageOptionValue(stage, stageState);
  const noLeak = option && option.noLeak !== undefined ? option.noLeak : stage.noLeak;
  const inputType = group.selection === 'single' ? 'radio' : 'checkbox';

  const chaseActive = stageState.flags.includes('chase');
  const extras = stage.extras.map((extra) => {
    const blocked = chaseActive && stage.chaseBlocksExtras.includes(extra.id);
    return `
      <label class="extra-check">
        <input
          type="checkbox"
          data-stage-id="${stage.id}"
          data-stage-extra="${extra.id}"
          ${!blocked && stageState.extras.includes(extra.id) ? 'checked' : ''}
          ${blocked ? 'disabled' : ''}
        >
        <span>${extra.name}</span>
        <span>+${extra.points}</span>
      </label>
    `;
  }).join('');

  const flags = stage.flags.map((flag) => `
    <label class="switch-row stage-flag">
      <input
        type="checkbox"
        data-stage-id="${stage.id}"
        data-stage-flag="${flag.id}"
        ${stageState.flags.includes(flag.id) ? 'checked' : ''}
      >
      <span>${escapeHtml(flag.label)}</span>
      <b>+${flag.points}</b>
    </label>
  `).join('');

  const compensation = stage.compensation
    ? `<div class="stage-compensation">
        <label class="switch-row">
          <input type="checkbox" data-stage-id="${stage.id}" data-stage-compensation ${stageState.compensation ? 'checked' : ''}>
          <span>未通关得分补偿</span>
          <b>×40%</b>
        </label>
        <small>${stage.compensationIncludesFlags
          ? '按本关基础分、层数加分、额外加分与追猎/击杀加分之和的 40% 计分'
          : '按本关基础分、层数加分与额外加分之和的 40% 计分'}</small>
      </div>`
    : '';

  return `
    <article class="stage-card stage-card--score${selected ? ' is-selected' : ''}" data-stage-card="${stage.id}">
      <div class="stage-card__head">
        <label class="stage-select">
          <input
            type="${inputType}"
            name="stage-group-${group.id}"
            value="${stage.id}"
            data-stage-select="${stage.id}"
            ${selected ? 'checked' : ''}
          >
          <span class="stage-select__name">${stage.name}</span>
        </label>
        <span class="stage-points" data-stage-points="${stage.id}">${points ? `+${formatNumber(points)}` : '0'}</span>
      </div>
      <p class="stage-card__summary">${stageSummary(stage)}</p>
      <div class="stage-card__body">
        ${stageOptionTemplate(stage, stageState)}
        <label class="switch-row">
          <input
            type="checkbox"
            data-stage-id="${stage.id}"
            data-stage-perfect
            ${stageState.perfect ? 'checked' : ''}
          >
          <span>无漏通关</span>
          <b data-stage-no-leak>+${noLeak}</b>
        </label>
        ${flags}
        ${stage.chaseBlocksExtras.length
          ? `<p class="stage-block-note">勾选「追猎」后，${stage.chaseBlocksExtras.map((id) => EXTRA_META[id].name).join('、')}不可同时勾选。</p>`
          : ''}
        ${compensation}
        ${extras ? `<div class="extra-grid">${extras}</div>` : ''}
      </div>
    </article>
  `;
}

function scoreGroupTemplate(group, player) {
  const selectedCount = selectedStageCount(player, group);
  const isSingle = group.selection === 'single';

  return `
    <details class="score-group${group.id === 'boss' ? ' is-open' : ''}" data-score-group="${group.id}" ${group.id === 'boss' ? 'open' : ''}>
      <summary class="score-group__summary">
        <span class="score-group__number">${group.number || '—'}</span>
        <span class="score-group__title">${group.title}</span>
        <span class="score-group__meta" data-group-meta="${group.id}">${isSingle ? '单选' : '多选'} · ${selectedCount}/${group.stages.length}</span>
        <span class="score-group__score" data-group-score="${group.id}">0</span>
        <span class="score-group__chevron" aria-hidden="true">⌄</span>
      </summary>
      <div class="score-group__body">
        <div class="score-group__tools">
          <p>${group.note}</p>
          <button class="mini-button" type="button" data-clear-group="${group.id}">清空本组</button>
        </div>
        <div class="stage-grid stage-grid--score">
          ${group.stages.map((stage) => stageCardTemplate(stage, group, player)).join('')}
        </div>
      </div>
    </details>
  `;
}

function scorePartTemplate(part, player) {
  return `
    <section class="score-part" data-score-part-block="${part.id}">
      <header class="score-part__head">
        <span class="score-part__number">${part.number}</span>
        <h4>${part.title}</h4>
        <span class="score-part__total">
          <small>小计</small>
          <b data-stage-part-score="${part.id}">0</b>
        </span>
      </header>
      <div class="score-groups">
        ${part.groups.map((group) => scoreGroupTemplate(group, player)).join('')}
      </div>
    </section>
  `;
}

function abyssPoolTemplate(player) {
  return ABYSS_OPERATORS.map((operator) => {
    const selected = player.abyssSelected.includes(operator.id);
    const disabled = !selected && player.abyssSelected.length >= 4;
    return `
      <button
        class="operator-pick${selected ? ' is-selected' : ''}"
        type="button"
        data-abyss-pick="${operator.id}"
        aria-pressed="${selected}"
        ${disabled ? 'disabled' : ''}
        title="${selected ? '点击移除' : '选择该干员'}"
      >
        <span class="op-orb" style="--orb-h:${operator.hue}">${operator.name.slice(0, 1)}</span>
        <span class="operator-pick__name">${operator.name}</span>
      </button>
    `;
  }).join('');
}

function abyssMissedTemplate(player) {
  if (player.abyssSelected.length === 0) {
    return '<div class="missed-placeholder">先从上方选择本局出现的「沉沦干员」，再标记其中未抓取的对象。</div>';
  }

  return player.abyssSelected.map((id) => {
    const operator = ABYSS_OPERATORS.find((item) => item.id === id);
    if (!operator) return '';
    const missed = player.abyssMissed.includes(id);
    return `
      <button
        class="missed-pick${missed ? ' is-selected' : ''}"
        type="button"
        data-abyss-missed="${id}"
        aria-pressed="${missed}"
      >
        <span>${operator.name}</span>
      </button>
    `;
  }).join('');
}

function factionGridTemplate(player) {
  return FACTION_NAMES.map((name) => {
    const selected = player.factions.includes(name);
    return `
      <button
        class="faction-chip${selected ? ' is-selected' : ''}"
        type="button"
        data-faction="${name}"
        aria-pressed="${selected}"
      >
        <span class="faction-chip__mark">${name.slice(0, 1)}</span>
        <span>${name}</span>
      </button>
    `;
  }).join('');
}

function endingGroupTemplate(group, player) {
  const options = group.options.map((option) => `
    <label class="option">
      <input
        type="checkbox"
        value="${option.field}"
        data-field="${option.field}"
        ${player[option.field] ? 'checked' : ''}
      >
      <span>${option.label}<b>+${option.points}</b></span>
    </label>
  `).join('');

  return `
    <div class="special-group" data-ending-group="${group.id}">
      <div class="special-group__head">
        <h5>${group.title}</h5>
        <b data-special-score="${group.id}">+0</b>
      </div>
      <div class="special-group__hint">
        <span>${group.note}</span>
        ${group.bonusText ? `<em>${group.bonusText}</em>` : ''}
      </div>
      <div class="option-row">${options}</div>
    </div>
  `;
}

function lossRelicTemplate(player) {
  return `
    <div class="special-group">
      <div class="special-group__head">
        <h5>（4）收藏品【复得之轮】和【果腹】记分</h5>
        <b data-special-score="loss">0</b>
      </div>
      <div class="loss-grid">
        <div class="loss-row${player.lossWheel ? ' is-active' : ''}" data-loss-row="wheel">
          <label class="loss-check">
            <input type="checkbox" data-field="lossWheel" ${player.lossWheel ? 'checked' : ''}>
            <span>复得之轮</span>
            <em>−100×a</em>
          </label>
          <label class="loss-layer">持有层数 a
            <input type="number" min="0" max="99" step="1" data-field="lossWheelLayers" value="${escapeHtml(inputValue(player.lossWheelLayers))}" placeholder="0" ${player.lossWheel ? '' : 'disabled'}>
          </label>
          <span class="loss-row__value" data-preview="wheel">0</span>
        </div>
        <div class="loss-row${player.lossFood ? ' is-active' : ''}" data-loss-row="food">
          <label class="loss-check">
            <input type="checkbox" data-field="lossFood" ${player.lossFood ? 'checked' : ''}>
            <span>果腹</span>
            <em>−150×b</em>
          </label>
          <label class="loss-layer">持有层数 b
            <input type="number" min="0" max="99" step="1" data-field="lossFoodLayers" value="${escapeHtml(inputValue(player.lossFoodLayers))}" placeholder="0" ${player.lossFood ? '' : 'disabled'}>
          </label>
          <span class="loss-row__value" data-preview="food">0</span>
        </div>
        <div class="loss-both">
          <span>同时持有额外扣除：−100×max{a,b}</span>
          <b data-preview="loss-both">0</b>
        </div>
      </div>
      <p class="loss-total">本项合计 <b data-preview="loss">0</b></p>
    </div>
  `;
}

function calculatorTemplate(player, index) {
  const number = String(index + 1).padStart(2, '0');
  const calc = calculatePlayer(player);

  return `
    <div class="player-page" id="calculatorPage" role="tabpanel" aria-label="第 ${index + 1} 位选手算分">
      <section class="calc-section" id="section-start">
        <header class="calc-section__head">
          <div class="section-title">
            <span class="section-title__index">01</span>
            <div>
              <h3>开局信息</h3>
              <span class="section-title__en">STARTING LOADOUT · PLAYER ${number}</span>
            </div>
          </div>
          <span class="section-score"><small>倍率区</small><b data-combined-coeff>×${formatCoefficient(calc.difficulty.coeff * calc.squadCoeff)}</b></span>
        </header>

        <div class="field-grid">
          <label class="field">
            <span class="field__label">选手昵称 <small>必填</small></span>
            <input type="text" data-field="name" maxlength="80" value="${escapeHtml(player.name)}" placeholder="输入选手昵称">
          </label>
          <label class="field">
            <span class="field__label">比赛日期</span>
            <input type="date" data-field="date" value="${escapeHtml(player.date)}">
          </label>
          <label class="field">
            <span class="field__label">开局六星干员</span>
            <input type="text" data-field="operator" maxlength="80" value="${escapeHtml(player.operator)}" placeholder="如：维什戴尔">
          </label>
        </div>

        <div class="subsection">
          <div class="subsection__head">
            <h4>开局难度</h4>
            <small>单选 · 不同难度使用对应系数</small>
          </div>
          <div class="choice-grid difficulty-grid">
            ${difficultyTemplate(player)}
          </div>
        </div>

        <div class="subsection">
          <div class="subsection__head">
            <h4>开局分队</h4>
            <small>单选 · 分队系数由赛事规则固定</small>
          </div>
          <div class="choice-grid squad-grid">
            ${squadTemplate(player)}
          </div>
        </div>
      </section>

      <section class="calc-section" id="section-stages">
        <header class="calc-section__head">
          <div class="section-title">
            <span class="section-title__index">02</span>
            <div>
              <h3>关卡通关得分</h3>
              <span class="section-title__en">STAGE CLEARANCE</span>
            </div>
          </div>
          <span class="section-score"><small>本部分</small><b data-score-part="stage">${formatNumber(calc.stage)}</b><span>分</span></span>
        </header>

        <div class="score-section-toolbar">
          <p>展开各组填写关卡；组内小计与第二部分的合计会实时更新。单选组切换关卡时，原关卡选择会自动清空。</p>
          <div class="score-section-toolbar__actions">
            <button class="mini-button" type="button" data-toggle-groups="open">全部展开</button>
            <button class="mini-button" type="button" data-toggle-groups="close">全部收起</button>
          </div>
        </div>

        ${SCORE_PARTS.map((part) => scorePartTemplate(part, player)).join('')}
      </section>

      <section class="calc-section" id="section-operators">
        <header class="calc-section__head">
          <div class="section-title">
            <span class="section-title__index">03</span>
            <div>
              <h3>干员记分项</h3>
              <span class="section-title__en">OPERATOR SCORE</span>
            </div>
          </div>
          <span class="section-score"><small>本部分</small><b data-score-part="operator">${formatNumber(calc.operator)}</b><span>分</span></span>
        </header>

        <div class="subsection">
          <div class="subsection__head">
            <h4>临时招募加分</h4>
            <small>填写临时招募数量</small>
          </div>
          <div class="recruit-grid">
            <div class="recruit-card">
              <span class="recruit-star">6<span>★</span></span>
              <label>六星临时招募
                <input type="number" min="0" max="99" step="1" data-field="recruit6" value="${escapeHtml(inputValue(player.recruit6))}" placeholder="0">
              </label>
              <span class="recruit-card__factor">×40<b>+0</b></span>
            </div>
            <div class="recruit-card">
              <span class="recruit-star">5<span>★</span></span>
              <label>五星临时招募
                <input type="number" min="0" max="99" step="1" data-field="recruit5" value="${escapeHtml(inputValue(player.recruit5))}" placeholder="0">
              </label>
              <span class="recruit-card__factor">×20<b>+0</b></span>
            </div>
            <div class="recruit-card">
              <span class="recruit-star">4<span>★</span></span>
              <label>四星临时招募
                <input type="number" min="0" max="99" step="1" data-field="recruit4" value="${escapeHtml(inputValue(player.recruit4))}" placeholder="0">
              </label>
              <span class="recruit-card__factor">×10<b>+0</b></span>
            </div>
          </div>
        </div>

        <div class="subsection">
          <div class="subsection__head">
            <h4>干员【机械师】记分</h4>
            <small>可同时勾选</small>
          </div>
          <div class="mechanism-grid">
            <label class="mechanism-card">
              <input type="checkbox" data-field="mechanicNoRecruit" ${player.mechanicNoRecruit ? 'checked' : ''}>
              <span class="mechanism-card__text">
                <b>未抓取干员【机械师】</b>
                <small>全程未招募机械师</small>
              </span>
              <em>+200</em>
            </label>
            <label class="mechanism-card">
              <input type="checkbox" data-field="mechanicNoAssist" ${player.mechanicNoAssist ? 'checked' : ''}>
              <span class="mechanism-card__text">
                <b>未使用助力干员【机械师】</b>
                <small>全程未使用助力机械师</small>
              </span>
              <em>+100</em>
            </label>
          </div>
        </div>

        <div class="subsection faction-block">
          <div class="subsection__head">
            <h4>国际探察小队</h4>
            <small>每个势力 +50 分 · 可勾选多个势力</small>
          </div>
          <p class="faction-desc">抓取同一势力的至少 3 名六星干员可获得加分。</p>
          <div class="faction-grid" id="factionGrid">
            ${factionGridTemplate(player)}
          </div>
          <div class="faction-summary">
            <span>已选 <b data-faction-count>${player.factions.length}</b> 个势力</span>
            <b data-preview="factions">+${player.factions.length * 50}</b>
          </div>
        </div>

        <div class="abyss-block">
          <div class="subsection__head">
            <h5>“沉沦干员”抽取 <span class="abyss-count" id="abyssCount">${player.abyssSelected.length}/4</span></h5>
            <small>至多选择 4 名</small>
          </div>
          <div class="operator-grid" id="abyssPool">
            ${abyssPoolTemplate(player)}
          </div>

          <div class="subsection__head" style="margin-top:16px">
            <h5>未抓取的“沉沦干员”</h5>
            <small>每名 +50 分 · 仅可选择上方已选干员</small>
          </div>
          <div class="missed-grid" id="abyssMissed">
            ${abyssMissedTemplate(player)}
          </div>
        </div>
      </section>

      <section class="calc-section" id="section-other">
        <header class="calc-section__head">
          <div class="section-title">
            <span class="section-title__index">04</span>
            <div>
              <h3>其他记分项</h3>
              <span class="section-title__en">MISC. SCORE</span>
            </div>
          </div>
          <span class="section-score"><small>本部分</small><b data-score-part="other">${formatNumber(calc.other)}</b><span>分</span></span>
        </header>

        <div class="subsection">
          <div class="subsection__head">
            <h4>收藏品结算加分</h4>
            <small>每件 +2.5 分 · 上限 100 件</small>
          </div>
          <div class="collectible-card">
            <div class="collectible-card__main">
              <div class="collectible-card__head">
                <span>收藏品数量</span>
                <small>0 — 100</small>
              </div>
              <input class="collectible-range" type="range" min="0" max="100" step="1" value="${clamp(toNumber(player.collectibleCount), 0, 100)}" data-range="collectibleCount" aria-label="收藏品数量滑块">
              <div class="collectible-score">
                <span>常规收藏品得分</span>
                <b data-preview="collectibles">+0</b>
              </div>
            </div>
            <label class="number-with-suffix">
              <input class="input" type="number" min="0" max="100" step="1" data-field="collectibleCount" value="${escapeHtml(inputValue(player.collectibleCount))}" placeholder="0" aria-label="收藏品数量">
              <span>件</span>
            </label>
          </div>
        </div>

        <div class="special-card">
          <div class="special-card__head">
            <h4>特殊收藏品和零件记分</h4>
            <small>结局收藏品可多选，同持奖励自动叠加</small>
          </div>

          ${ENDING_GROUPS.map((group) => endingGroupTemplate(group, player)).join('')}

          ${lossRelicTemplate(player)}

          <div class="special-group">
            <div class="special-group__head">
              <h5>（5）自然物【板藤】记分</h5>
              <b data-special-score="board">0</b>
            </div>
            <div class="mini-grid">
              <label class="mini-field">
                <span class="mini-field__label">
                  <b>超量【板藤】失去时价值</b>
                  <small>每 1 点失去价值扣除 2 分</small>
                </span>
                <input type="number" min="0" step="1" data-field="boardValue" value="${escapeHtml(inputValue(player.boardValue))}" placeholder="0">
                <span class="mini-field__value" data-preview="board">0</span>
              </label>
              <div class="mini-field">
                <span class="mini-field__label">
                  <b>（6）零件箱容量 m</b>
                  <small>≤8 / ≤10 / ≤12 / ≤14 / ≤20 / &gt;20 分档</small>
                </span>
                <input type="number" min="0" step="1" data-field="partsCapacity" value="${escapeHtml(inputValue(player.partsCapacity))}" placeholder="m">
                <span class="tier-badge" data-preview="parts-tier">待填写</span>
              </div>
            </div>
          </div>

          <div class="special-group">
            <div class="special-group__head">
              <h5>（7）【襁褓】记分</h5>
              <b data-special-score="swaddle">0</b>
            </div>
            <div class="mini-grid">
              <div class="mini-field">
                <span class="mini-field__label">
                  <b>孵育的【襁褓】数量</b>
                  <small>每个 +15 分</small>
                </span>
                <input type="number" min="0" max="99" step="1" data-field="swaddle" value="${escapeHtml(inputValue(player.swaddle))}" placeholder="0">
                <span class="mini-field__value" data-preview="swaddle">+0</span>
              </div>
              <div class="mini-field">
                <span class="mini-field__label">
                  <b>零件箱容量结算</b>
                  <small>所得分数随容量档位变化</small>
                </span>
                <span class="mini-field__value" data-preview="parts">+0</span>
              </div>
            </div>
          </div>
        </div>

        <div class="duck-card">
          <span class="duck-card__icon">鸭</span>
          <span class="duck-card__text">
            <b>特殊敌人：击杀【鸭爵团伙】数量</b>
            <small>每击杀 1 个 +20 分</small>
          </span>
          <input type="number" min="0" max="99" step="1" data-field="duck" value="${escapeHtml(inputValue(player.duck))}" placeholder="0" aria-label="鸭爵团伙击杀数量">
          <span class="mini-field__value" data-preview="duck">+0</span>
        </div>
      </section>

      <section class="calc-section" id="section-settlement">
        <header class="calc-section__head">
          <div class="section-title">
            <span class="section-title__index">05</span>
            <div>
              <h3>游戏结算得分</h3>
              <span class="section-title__en">FINAL SETTLEMENT</span>
            </div>
          </div>
          <span class="section-score"><small>本部分</small><b data-score-part="settlement">${formatNumber(calc.settlement)}</b><span>分</span></span>
        </header>

        <div class="settlement-grid">
          <div class="settlement-field">
            <label for="settleScore">游戏内结算分</label>
            <input id="settleScore" type="number" min="0" step="0.01" data-field="settleScore" value="${escapeHtml(inputValue(player.settleScore))}" placeholder="0">
          </div>
          <div class="settlement-field">
            <label for="settleCollectibles">收藏品数量</label>
            <input id="settleCollectibles" type="number" min="0" step="1" data-field="settleCollectibles" value="${escapeHtml(inputValue(player.settleCollectibles))}" placeholder="0">
          </div>
          <div class="settlement-field">
            <label for="settleThermos">收藏品【热水壶】数量</label>
            <input id="settleThermos" type="number" min="0" step="1" data-field="settleThermos" value="${escapeHtml(inputValue(player.settleThermos))}" placeholder="0">
          </div>
          <div class="settlement-field">
            <label for="settleParts">零件数量</label>
            <input id="settleParts" type="number" min="0" step="1" data-field="settleParts" value="${escapeHtml(inputValue(player.settleParts))}" placeholder="0">
          </div>
          <div class="settlement-field">
            <label for="settleEfficiency">得分效率</label>
            <input id="settleEfficiency" type="number" min="0" step="0.01" data-field="settleEfficiency" value="${escapeHtml(inputValue(player.settleEfficiency))}" placeholder="如 1.35">
          </div>
        </div>

        <div class="formula-panel">
          <div>
            <p class="formula-panel__label">CALCULATION</p>
            <p class="formula" data-formula-expression>游戏内结算分 ÷ 得分效率 − 零件数量 × 5 − max(收藏品数量 − 热水壶数量 − 135, 0) × 5</p>
            <p class="formula-warning" data-formula-warning>填写了游戏内结算分，但得分效率为 0，本部分暂按 0 分计算。</p>
          </div>
          <div class="formula-result">
            <span>本部分得分</span>
            <b data-score-part="settlement">${formatNumber(calc.settlement)}</b>
          </div>
        </div>
      </section>

      <section class="calc-section final-section" id="section-final">
        <header class="calc-section__head">
          <div class="section-title">
            <span class="section-title__index">06</span>
            <div>
              <h3>选手得分</h3>
              <span class="section-title__en">FINAL PLAYER SCORE</span>
            </div>
          </div>
          <span class="section-score"><small>最终</small><b data-score-part="total">${formatNumber(calc.total)}</b><span>分</span></span>
        </header>

        <div class="final-layout">
          <div class="final-label">
            <h3>${escapeHtml(player.name.trim() || `选手 ${number}`)}</h3>
            <p>第二至第五部分得分相加后，依次乘以开局难度系数与开局分队系数。</p>
            <div class="final-breakdown">
              <span>关卡 <b data-final-part="stage">${formatNumber(calc.stage)}</b></span>
              <span>干员 <b data-final-part="operator">${formatNumber(calc.operator)}</b></span>
              <span>其他 <b data-final-part="other">${formatNumber(calc.other)}</b></span>
              <span>结算 <b data-final-part="settlement">${formatNumber(calc.settlement)}</b></span>
              <span>难度 <b data-final-coeff="difficulty">×${formatCoefficient(calc.difficulty.coeff)}</b></span>
              <span>分队 <b data-final-coeff="squad">×${formatCoefficient(calc.squadCoeff)}</b></span>
            </div>
          </div>
          <div class="final-total">
            <strong data-total-big>${formatNumber(calc.total)}</strong>
            <span>分</span>
          </div>
        </div>

        <div class="calc-actions" style="margin-top:24px">
          <div class="calc-actions__left">
            <button class="button button--ghost button--small" type="button" data-action="copy-summary">复制算分明细</button>
            <button class="button button--danger button--small" type="button" data-action="reset-player">清空本页</button>
          </div>
          <p class="calc-actions__note">清空仅影响当前选手页面，其他选手数据不会改变。</p>
        </div>
      </section>
    </div>
  `;
}

function renderCalculator() {
  const player = currentPlayer();
  elements.calculatorMount.innerHTML = calculatorTemplate(player, state.activePlayer);
  updateDock();
  updateRecruitPreviews();
  updateSpecialPreviews();
  syncStageUI();
  syncLossRelicUI();
  updateSettlementFormula();
}

/* --------------------------------------------------------------------------
   Update previews
   -------------------------------------------------------------------------- */

function updateRecruitPreviews() {
  const player = currentPlayer();
  const cards = elements.calculatorMount.querySelectorAll('.recruit-card');
  const values = [toNumber(player.recruit6) * 40, toNumber(player.recruit5) * 20, toNumber(player.recruit4) * 10];
  cards.forEach((card, index) => {
    const target = card.querySelector('.recruit-card__factor b');
    if (target) target.textContent = values[index] ? `+${formatNumber(values[index])}` : '+0';
  });

  const factionCount = elements.calculatorMount.querySelector('[data-faction-count]');
  const factionScore = elements.calculatorMount.querySelector('[data-preview="factions"]');
  if (factionCount) factionCount.textContent = String(player.factions.length);
  if (factionScore) factionScore.textContent = `+${player.factions.length * 50}`;
}

function updateSpecialPreviews() {
  const player = currentPlayer();
  const loss = lossRelicBreakdown(player);
  const board = -Math.max(0, toNumber(player.boardValue)) * 2;
  const parts = scorePartsCapacity(player);
  const swaddle = Math.max(0, toNumber(player.swaddle)) * 15;
  const duck = Math.max(0, toNumber(player.duck)) * 20;
  const collectibles = clamp(toNumber(player.collectibleCount), 0, 100) * 2.5;

  const setText = (selector, text) => {
    const node = elements.calculatorMount.querySelector(selector);
    if (node) node.textContent = text;
  };

  ENDING_GROUPS.forEach((group) => {
    setText(`[data-special-score="${group.id}"]`, `+${formatNumber(scoreEndingGroup(player, group))}`);
  });

  setText('[data-special-score="loss"]', formatNumber(loss.total));
  setText('[data-special-score="board"]', formatNumber(board));
  setText('[data-special-score="swaddle"]', `+${formatNumber(swaddle)}`);
  setText('[data-preview="wheel"]', formatNumber(loss.wheel));
  setText('[data-preview="food"]', formatNumber(loss.food));
  setText('[data-preview="loss-both"]', formatNumber(loss.both));
  setText('[data-preview="loss"]', formatNumber(loss.total));
  setText('[data-preview="board"]', formatNumber(board));
  setText('[data-preview="parts"]', parts > 0 ? `+${formatNumber(parts)}` : formatNumber(parts));
  setText('[data-preview="parts-tier"]', partsCapacityTier(player));
  setText('[data-preview="swaddle"]', `+${formatNumber(swaddle)}`);
  setText('[data-preview="duck"]', `+${formatNumber(duck)}`);
  setText('[data-preview="collectibles"]', `+${formatNumber(collectibles)}`);
}

function syncStageUI() {
  const player = currentPlayer();

  ALL_STAGES.forEach((stage) => {
    const stageState = player.stages[stage.id];
    const card = elements.calculatorMount.querySelector(`[data-stage-card="${stage.id}"]`);
    if (!card) return;

    const selected = Boolean(stageState.selected);
    const option = getStageOptionValue(stage, stageState);
    const noLeak = option && option.noLeak !== undefined ? option.noLeak : stage.noLeak;

    card.classList.toggle('is-selected', selected);

    const selectInput = card.querySelector(`[data-stage-select="${stage.id}"]`);
    if (selectInput) selectInput.checked = selected;

    const optionInput = card.querySelector(`[data-stage-option="${stage.id}"]`);
    if (optionInput) {
      optionInput.disabled = !selected;
      if (option) optionInput.value = option.id;
    }

    const noLeakInput = card.querySelector('[data-stage-perfect]');
    if (noLeakInput) {
      noLeakInput.checked = Boolean(stageState.perfect);
      noLeakInput.disabled = !selected || stageState.compensation;
    }

    const noLeakLabel = card.querySelector('[data-stage-no-leak]');
    if (noLeakLabel) noLeakLabel.textContent = `+${noLeak}`;

    card.querySelectorAll('[data-stage-flag]').forEach((input) => {
      input.checked = stageState.flags.includes(input.dataset.stageFlag);
      input.disabled = !selected || (stageState.compensation && !stage.compensationIncludesFlags);
    });

    const compensationInput = card.querySelector('[data-stage-compensation]');
    if (compensationInput) {
      compensationInput.checked = Boolean(stageState.compensation);
      compensationInput.disabled = !selected;
    }

    card.querySelectorAll('[data-stage-extra]').forEach((input) => {
      const blocked = stageState.flags.includes('chase')
        && stage.chaseBlocksExtras.includes(input.dataset.stageExtra);
      input.checked = !blocked && stageState.extras.includes(input.dataset.stageExtra);
      input.disabled = !selected || blocked;
    });

    const pointsNode = card.querySelector(`[data-stage-points="${stage.id}"]`);
    if (pointsNode) {
      const points = stageScore(stage, stageState);
      pointsNode.textContent = points ? `+${formatNumber(points)}` : '0';
    }
  });
}

function syncLossRelicUI() {
  const player = currentPlayer();
  const wheelInput = elements.calculatorMount.querySelector('[data-field="lossWheelLayers"]');
  const foodInput = elements.calculatorMount.querySelector('[data-field="lossFoodLayers"]');
  if (wheelInput) wheelInput.disabled = !player.lossWheel;
  if (foodInput) foodInput.disabled = !player.lossFood;

  const wheelRow = elements.calculatorMount.querySelector('[data-loss-row="wheel"]');
  const foodRow = elements.calculatorMount.querySelector('[data-loss-row="food"]');
  if (wheelRow) wheelRow.classList.toggle('is-active', player.lossWheel);
  if (foodRow) foodRow.classList.toggle('is-active', player.lossFood);
}

function updateSettlementFormula() {
  const player = currentPlayer();
  const detail = settlementBreakdown(player);
  const expression = elements.calculatorMount.querySelector('[data-formula-expression]');
  const warning = elements.calculatorMount.querySelector('[data-formula-warning]');
  if (!expression) return;

  const efficiency = detail.efficiency || 0;
  expression.innerHTML =
    `<strong>${formatNumber(detail.gameScore)}</strong> ÷ <strong>${efficiency ? formatNumber(efficiency) : '—'}</strong>` +
    ` − <strong>${formatNumber(detail.parts)}</strong> × 5` +
    ` − max(<strong>${formatNumber(detail.collectibles)}</strong> − <strong>${formatNumber(detail.thermos)}</strong> − 135, 0) × 5`;

  if (warning) {
    warning.classList.toggle('is-visible', detail.gameScore > 0 && efficiency <= 0);
  }
}

/* --------------------------------------------------------------------------
   Render: schedule
   -------------------------------------------------------------------------- */

function getScheduleEntries() {
  const entries = [];

  for (let index = 0; index < MAX_PLAYERS; index += 1) {
    const player = index < state.playerCount ? state.players[index] : null;
    const calc = player ? calculatePlayer(player) : null;
    const name = player ? player.name.trim() : '';
    entries.push({ index, player, calc, name, named: Boolean(name), rank: null });
  }

  const named = entries.filter((entry) => entry.named);
  named.sort((a, b) => {
    const difference = b.calc.total - a.calc.total;
    if (Math.abs(difference) > 0.000001) return difference;
    return a.index - b.index;
  });

  let previousScore = null;
  let previousRank = 0;
  named.forEach((entry, position) => {
    if (previousScore !== null && Math.abs(previousScore - entry.calc.total) < 0.000001) {
      entry.rank = previousRank;
    } else {
      entry.rank = position + 1;
      previousRank = entry.rank;
      previousScore = entry.calc.total;
    }
  });

  const remaining = entries.filter((entry) => !entry.named);
  return [...named, ...remaining];
}

function rankBadge(rank) {
  if (!rank) return '<span class="rank-empty">—</span>';
  const podium = rank <= 3 ? ` rank-badge--${rank}` : '';
  return `<span class="rank-badge${podium}">${rank}</span>`;
}

function renderSchedule() {
  if (!elements.scheduleBody) return;
  const entries = getScheduleEntries();
  const named = entries.filter((entry) => entry.named);
  const scored = named.filter((entry) => Math.abs(entry.calc.total) > 0.000001);

  elements.registeredCount.textContent = `${named.length} / ${MAX_PLAYERS}`;
  elements.scoredCount.textContent = `${scored.length} 人`;

  if (state.updatedAt) {
    const date = new Date(state.updatedAt);
    if (!Number.isNaN(date.getTime())) {
      elements.scheduleUpdated.textContent = `${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} 更新`;
    } else {
      elements.scheduleUpdated.textContent = '已同步';
    }
  } else {
    elements.scheduleUpdated.textContent = '等待录入';
  }

  elements.scheduleBody.innerHTML = entries.map((entry) => {
    if (!entry.named) {
      return `
        <tr class="is-empty">
          <td>
            <div class="player-cell">
              <span class="player-cell__no">P${String(entry.index + 1).padStart(2, '0')}</span>
              <span class="player-cell__name is-placeholder">${entry.player ? '待登记' : '虚位以待'}</span>
            </div>
          </td>
          <td class="cell-mono">—</td>
          <td class="cell-mono">—</td>
          <td class="cell-mono">—</td>
          <td class="cell-mono">—</td>
          <td class="cell-score">—</td>
          <td class="cell-rank"><span class="rank-empty">—</span></td>
        </tr>
      `;
    }

    const { player, calc, index, rank } = entry;
    const difficulty = getDifficulty(player.difficulty);
    const squad = getSquad(player.squad);
    const podium = rank && rank <= 3 ? ' is-podium' : '';

    return `
      <tr class="${podium.trim()}">
        <td>
          <div class="player-cell">
            <span class="player-cell__no">P${String(index + 1).padStart(2, '0')}</span>
            <button class="name-link" type="button" data-open-player="${index}">
              <span class="player-cell__name">${escapeHtml(player.name)}</span>
            </button>
          </div>
        </td>
        <td class="cell-mono">${formatDate(player.date)}</td>
        <td>
          <div class="difficulty-cell">
            <b>${difficulty.label}</b>
            <small>×${formatCoefficient(difficulty.coeff)}</small>
          </div>
        </td>
        <td><span class="cell-mono">${squad.name}</span></td>
        <td><span class="cell-mono">${escapeHtml(player.operator || '—')}</span></td>
        <td class="cell-score">${formatNumber(calc.total)}</td>
        <td class="cell-rank">${rankBadge(rank)}</td>
      </tr>
    `;
  }).join('');
}

/* --------------------------------------------------------------------------
   UI updates
   -------------------------------------------------------------------------- */

function updateAllScores() {
  updateDock();
  updateRecruitPreviews();
  updateSpecialPreviews();
  updateSettlementFormula();
  renderPlayerTabs();
  renderSchedule();
}

function clampFieldOnChange(field, input) {
  const limits = NUMERIC_FIELD_LIMITS[field];
  if (!limits) return;
  const [min, max] = limits;
  const raw = input.value;
  if (raw === '') return;

  let value = toNumber(raw);
  value = clamp(value, min, max);

  if (['recruit6', 'recruit5', 'recruit4', 'collectibleCount', 'lossWheelLayers', 'lossFoodLayers', 'swaddle', 'duck', 'settleCollectibles', 'settleThermos', 'settleParts'].includes(field)) {
    value = Math.round(value);
  }

  input.value = String(value);
  currentPlayer()[field] = String(value);

  if (field === 'collectibleCount') {
    const range = elements.calculatorMount.querySelector('[data-range="collectibleCount"]');
    if (range) range.value = String(value);
  }
}

/* --------------------------------------------------------------------------
   Field / stage / abyss events
   -------------------------------------------------------------------------- */

function updateField(input) {
  const field = input.dataset.field;
  if (!field) return;

  const player = currentPlayer();
  if (input.type === 'checkbox') {
    player[field] = input.checked;
  } else {
    player[field] = input.value;
  }
}

function finishStageChange() {
  syncStageUI();
  updateAllScores();
  markDirty();
}

function resetStageRecord(stageId) {
  const stage = getStage(stageId);
  if (!stage) return;
  currentPlayer().stages[stageId] = createStageState(stage);
}

function handleStageSelect(input) {
  const stage = getStage(input.dataset.stageSelect);
  if (!stage) return;

  const group = getStageGroup(stage.id);
  const player = currentPlayer();

  if (!input.checked) {
    resetStageRecord(stage.id);
    finishStageChange();
    return;
  }

  if (group && group.selection === 'single') {
    group.stages.forEach((groupStage) => {
      if (groupStage.id !== stage.id) resetStageRecord(groupStage.id);
    });
  }

  player.stages[stage.id].selected = true;
  finishStageChange();
}

function handleStagePerfect(input) {
  const stage = getStage(input.dataset.stageId);
  if (!stage) return;
  const stageState = currentPlayer().stages[stage.id];
  if (stageState.compensation) {
    input.checked = false;
    return;
  }
  stageState.perfect = input.checked;
  finishStageChange();
}

function handleStageExtra(input) {
  const stage = getStage(input.dataset.stageId);
  if (!stage) return;
  const stageState = currentPlayer().stages[stage.id];
  if (!stageState.selected) {
    input.checked = false;
    return;
  }

  const extraId = input.dataset.stageExtra;
  const blocked = stageState.flags.includes('chase') && stage.chaseBlocksExtras.includes(extraId);
  if (blocked) {
    input.checked = false;
    return;
  }

  if (input.checked) {
    if (!stageState.extras.includes(extraId)) stageState.extras.push(extraId);
  } else {
    stageState.extras = stageState.extras.filter((id) => id !== extraId);
  }
  finishStageChange();
}

function handleStageOption(input) {
  const stage = getStage(input.dataset.stageOption);
  if (!stage || !stage.option) return;
  const stageState = currentPlayer().stages[stage.id];
  if (!stageState.selected) return;
  if (!stage.option.values.some((value) => value.id === input.value)) return;

  stageState.options[stage.option.id] = input.value;
  finishStageChange();
}

function handleStageFlag(input) {
  const stage = getStage(input.dataset.stageId);
  if (!stage) return;
  const stageState = currentPlayer().stages[stage.id];
  if (!stageState.selected || (stageState.compensation && !stage.compensationIncludesFlags)) {
    input.checked = false;
    return;
  }

  const flagId = input.dataset.stageFlag;
  if (input.checked) {
    if (!stageState.flags.includes(flagId)) stageState.flags.push(flagId);
    if (flagId === 'chase' && stage.chaseBlocksExtras.length) {
      const blocked = new Set(stage.chaseBlocksExtras);
      stageState.extras = stageState.extras.filter((id) => !blocked.has(id));
    }
  } else {
    stageState.flags = stageState.flags.filter((id) => id !== flagId);
  }
  finishStageChange();
}

function handleStageCompensation(input) {
  const stage = getStage(input.dataset.stageId);
  if (!stage) return;
  const stageState = currentPlayer().stages[stage.id];
  if (!stageState.selected) {
    input.checked = false;
    return;
  }

  stageState.compensation = input.checked;
  if (stageState.compensation) {
    stageState.perfect = false;
    if (!stage.compensationIncludesFlags) stageState.flags = [];
  }
  finishStageChange();
}

function clearStageGroup(groupId) {
  const part = SCORE_PARTS.find((item) => item.groups.some((group) => group.id === groupId));
  const group = part && part.groups.find((item) => item.id === groupId);
  if (!group) return;

  group.stages.forEach((stage) => resetStageRecord(stage.id));
  finishStageChange();
  showToast('本组关卡记录已清空');
}

function renderFactionUI() {
  const player = currentPlayer();
  const grid = elements.calculatorMount.querySelector('#factionGrid');
  if (grid) grid.innerHTML = factionGridTemplate(player);
  const count = elements.calculatorMount.querySelector('[data-faction-count]');
  const score = elements.calculatorMount.querySelector('[data-preview="factions"]');
  if (count) count.textContent = String(player.factions.length);
  if (score) score.textContent = `+${player.factions.length * 50}`;
}

function handleFactionToggle(name) {
  if (!FACTION_NAMES.includes(name)) return;
  const player = currentPlayer();
  if (player.factions.includes(name)) {
    player.factions = player.factions.filter((item) => item !== name);
  } else {
    player.factions.push(name);
  }
  renderFactionUI();
  updateAllScores();
  markDirty();
}

function renderAbyssUI() {
  const player = currentPlayer();
  const pool = elements.calculatorMount.querySelector('#abyssPool');
  const missed = elements.calculatorMount.querySelector('#abyssMissed');
  const count = elements.calculatorMount.querySelector('#abyssCount');
  if (pool) pool.innerHTML = abyssPoolTemplate(player);
  if (missed) missed.innerHTML = abyssMissedTemplate(player);
  if (count) count.textContent = `${player.abyssSelected.length}/4`;
}

function handleAbyssPick(id) {
  const player = currentPlayer();
  if (!ABYSS_OPERATORS.some((operator) => operator.id === id)) return;

  if (player.abyssSelected.includes(id)) {
    player.abyssSelected = player.abyssSelected.filter((item) => item !== id);
    player.abyssMissed = player.abyssMissed.filter((item) => item !== id);
  } else if (player.abyssSelected.length >= 4) {
    showToast('“沉沦干员”至多选择 4 名');
    return;
  } else {
    player.abyssSelected.push(id);
  }

  renderAbyssUI();
  updateAllScores();
  markDirty();
}

function handleAbyssMissed(id) {
  const player = currentPlayer();
  if (!player.abyssSelected.includes(id)) return;

  if (player.abyssMissed.includes(id)) {
    player.abyssMissed = player.abyssMissed.filter((item) => item !== id);
  } else {
    player.abyssMissed.push(id);
  }

  renderAbyssUI();
  updateAllScores();
  markDirty();
}

/* --------------------------------------------------------------------------
   Player switching / count / reset
   -------------------------------------------------------------------------- */

function switchPlayer(index) {
  const next = clamp(index, 0, state.playerCount - 1);
  if (next === state.activePlayer) return;
  state.activePlayer = next;
  renderCalculator();
  renderPlayerTabs();
  markDirty({ immediate: true });
}

function changePlayerCount(value) {
  const count = clamp(toInt(value, state.playerCount), 1, MAX_PLAYERS);
  state.playerCount = count;
  state.activePlayer = clamp(state.activePlayer, 0, count - 1);
  elements.playerCount.value = String(count);
  renderPlayerTabs();
  renderCalculator();
  renderSchedule();
  markDirty({ immediate: true });
}

function resetCurrentPlayer() {
  const player = currentPlayer();
  const label = player.name.trim() || `第 ${state.activePlayer + 1} 位选手`;
  if (!window.confirm(`确定清空「${label}」的全部算分数据吗？此操作不可撤销。`)) return;

  state.players[state.activePlayer] = createDefaultPlayer();
  renderCalculator();
  renderPlayerTabs();
  renderSchedule();
  markDirty({ immediate: true });
  showToast('当前选手页面已清空');
}

/* --------------------------------------------------------------------------
   Copy summary
   -------------------------------------------------------------------------- */

function buildSummaryText() {
  const player = currentPlayer();
  const calc = calculatePlayer(player);
  const difficulty = getDifficulty(player.difficulty);
  const squad = getSquad(player.squad);

  const stageLines = ALL_STAGES
    .map((stage) => {
      const score = stageScore(stage, player.stages[stage.id]);
      return score ? `  · ${stage.name}：${formatNumber(score)}` : '';
    })
    .filter(Boolean);

  const selectedOperators = player.abyssSelected
    .map((id) => ABYSS_OPERATORS.find((operator) => operator.id === id))
    .filter(Boolean)
    .map((operator) => operator.name)
    .join('、') || '未选择';

  const missedOperators = player.abyssMissed
    .map((id) => ABYSS_OPERATORS.find((operator) => operator.id === id))
    .filter(Boolean)
    .map((operator) => operator.name)
    .join('、') || '无';

  return [
    '【集成战略群友赛#5 · 算分摘要】',
    `选手：${player.name.trim() || '未登记'}`,
    `日期：${player.date || '未填写'}`,
    `开局六星：${player.operator || '未填写'}`,
    `难度：${difficulty.label}（×${formatCoefficient(difficulty.coeff)}）`,
    `分队：${squad.name}（×${formatCoefficient(calc.squadCoeff)}）`,
    '',
    `关卡通关得分：${formatNumber(calc.stage)}`,
    ...stageLines,
    `干员记分项：${formatNumber(calc.operator)}`,
    `  国际探察小队：${player.factions.join('、') || '未选择'}`,
    `  沉沦干员：${selectedOperators}`,
    `  未抓取：${missedOperators}`,
    `其他记分项：${formatNumber(calc.other)}`,
    `游戏结算得分：${formatNumber(calc.settlement)}`,
    `小计：${formatNumber(calc.subtotal)}`,
    `选手得分：${formatNumber(calc.total)}`,
    '',
    '数据由“集成战略群友赛#5”记分计算器生成'
  ].join('\n');
}

async function copySummary() {
  const text = buildSummaryText();

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    showToast('算分明细已复制');
  } catch (error) {
    console.warn('复制失败', error);
    showToast('复制失败，请检查浏览器权限');
  }
}

/* --------------------------------------------------------------------------
   Navigation
   -------------------------------------------------------------------------- */

function navigate(page, updateHash = true) {
  const next = PAGE_NAMES.has(page) ? page : 'rules';

  elements.pagePanels.forEach((panel) => {
    panel.classList.toggle('is-active', panel.dataset.pagePanel === next);
  });
  elements.navItems.forEach((item) => {
    const active = item.dataset.page === next;
    item.classList.toggle('is-active', active);
    if (active) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  });

  if (updateHash && window.location.hash !== `#${next}`) {
    try {
      history.replaceState(null, '', `#${next}`);
    } catch (error) {
      window.location.hash = next;
    }
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openPlayerFromSchedule(index) {
  const next = clamp(index, 0, state.playerCount - 1);
  state.activePlayer = next;
  renderCalculator();
  renderPlayerTabs();
  navigate('calculator');
  markDirty({ immediate: true });
}

/* --------------------------------------------------------------------------
   Event wiring
   -------------------------------------------------------------------------- */

document.addEventListener('click', (event) => {
  const pageTrigger = event.target.closest('[data-page]');
  if (pageTrigger) {
    event.preventDefault();
    navigate(pageTrigger.dataset.page);
    return;
  }

  const pageLink = event.target.closest('[data-page-link]');
  if (pageLink) {
    event.preventDefault();
    navigate(pageLink.dataset.pageLink);
    return;
  }

  const playerTab = event.target.closest('[data-player-index]');
  if (playerTab) {
    switchPlayer(Number(playerTab.dataset.playerIndex));
    return;
  }

  const schedulePlayer = event.target.closest('[data-open-player]');
  if (schedulePlayer) {
    openPlayerFromSchedule(Number(schedulePlayer.dataset.openPlayer));
    return;
  }

  const faction = event.target.closest('[data-faction]');
  if (faction) {
    handleFactionToggle(faction.dataset.faction);
    return;
  }

  const abyssPick = event.target.closest('[data-abyss-pick]');
  if (abyssPick) {
    handleAbyssPick(abyssPick.dataset.abyssPick);
    return;
  }

  const abyssMissed = event.target.closest('[data-abyss-missed]');
  if (abyssMissed) {
    handleAbyssMissed(abyssMissed.dataset.abyssMissed);
    return;
  }

  const clearGroup = event.target.closest('[data-clear-group]');
  if (clearGroup) {
    clearStageGroup(clearGroup.dataset.clearGroup);
    return;
  }

  const groupToggle = event.target.closest('[data-toggle-groups]');
  if (groupToggle) {
    const shouldOpen = groupToggle.dataset.toggleGroups === 'open';
    elements.calculatorMount.querySelectorAll('.score-group').forEach((group) => {
      group.open = shouldOpen;
    });
    return;
  }

  const action = event.target.closest('[data-action]');
  if (action) {
    if (action.dataset.action === 'copy-summary') copySummary();
    if (action.dataset.action === 'reset-player') resetCurrentPlayer();
    return;
  }

});

elements.playerCount.addEventListener('change', (event) => {
  changePlayerCount(event.target.value);
});

document.addEventListener('input', (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;

  if (input.matches('[data-range="collectibleCount"]')) {
    const player = currentPlayer();
    player.collectibleCount = input.value;
    const numberInput = elements.calculatorMount.querySelector('[data-field="collectibleCount"]');
    if (numberInput) numberInput.value = input.value;
    updateAllScores();
    markDirty();
    return;
  }

  if (input.dataset.field) {
    if (input.type === 'checkbox' || input.type === 'radio') return;
    updateField(input);
    if (input.dataset.field === 'collectibleCount') {
      const range = elements.calculatorMount.querySelector('[data-range="collectibleCount"]');
      if (range) range.value = String(clamp(toNumber(input.value), 0, 100));
    }
    updateAllScores();
    markDirty();
  }
});

document.addEventListener('change', (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) && !(input instanceof HTMLSelectElement)) return;

  if (input.dataset.stageSelect) {
    handleStageSelect(input);
    return;
  }

  if ('stagePerfect' in input.dataset) {
    handleStagePerfect(input);
    return;
  }

  if (input.dataset.stageExtra) {
    handleStageExtra(input);
    return;
  }

  if (input.dataset.stageFlag) {
    handleStageFlag(input);
    return;
  }

  if ('stageCompensation' in input.dataset) {
    handleStageCompensation(input);
    return;
  }

  if (input.dataset.stageOption) {
    handleStageOption(input);
    return;
  }

  if (input.dataset.field) {
    if (input.type === 'checkbox' || input.type === 'radio') {
      updateField(input);
      if (input.dataset.field === 'lossWheel' || input.dataset.field === 'lossFood') {
        syncLossRelicUI();
      }
      updateAllScores();
      markDirty();
      return;
    }

    clampFieldOnChange(input.dataset.field, input);
    updateAllScores();
    markDirty();
  }
});

window.addEventListener('hashchange', () => {
  navigate(window.location.hash.replace('#', ''), false);
});

window.addEventListener('beforeunload', () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    // Ignore unload-time storage errors.
  }
});

window.addEventListener('pagehide', () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    // Ignore unload-time storage errors.
  }
});

/* --------------------------------------------------------------------------
   Initial render
   -------------------------------------------------------------------------- */

function initialize() {
  elements.playerCount.value = String(state.playerCount);
  renderPlayerTabs();
  renderCalculator();
  renderSchedule();

  const initialPage = window.location.hash.replace('#', '');
  navigate(PAGE_NAMES.has(initialPage) ? initialPage : 'rules', false);

  if (state.updatedAt) {
    setSaveText('已恢复本机数据');
  }

  try {
    if (!localStorage.getItem(STORAGE_KEY)) {
      markDirty({ immediate: true });
    }
  } catch (error) {
    setSaveText('本机存储不可用', 'error');
  }
}

initialize();

/* Small read-only hook for debugging and automated verification. */
window.IS5Cup = Object.freeze({
  version: '4.1.0',
  storageKey: STORAGE_KEY,
  getState: () => JSON.parse(JSON.stringify(state)),
  calculatePlayer: (index = state.activePlayer) => {
    const player = state.players[clamp(index, 0, MAX_PLAYERS - 1)];
    return calculatePlayer(player);
  },
  getSquadCoefficients: () => Object.fromEntries(SQUADS.map((squad) => [squad.id, squad.coeff])),
  getScoreParts: () => JSON.parse(JSON.stringify(SCORE_PARTS))
});
