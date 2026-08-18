const RARITIES = {
  white:   { name: '白卡',   order: 0, color: '#9ca3af', weight: 55,      basePower: 1,       frag: 1 },
  green:   { name: '绿卡',   order: 1, color: '#16a34a', weight: 30,      basePower: 10,      frag: 3 },
  blue:    { name: '蓝卡',   order: 2, color: '#2563eb', weight: 10,      basePower: 60,      frag: 8 },
  purple:  { name: '紫卡',   order: 3, color: '#7c3aed', weight: 2,       basePower: 400,     frag: 25 },
  gold:    { name: '金卡',   order: 4, color: '#d97706', weight: 0.4,     basePower: 3000,    frag: 80 },
  red:     { name: '红卡',   order: 5, color: '#dc2626', weight: 0.0004,  basePower: 25000,   frag: 400 },
  black:   { name: '黑卡',   order: 6, color: '#111827', weight: 0.0001,  basePower: 200000,  frag: 1500 },
  rainbow: { name: '炫彩卡', order: 7, color: 'rainbow', weight: 0.00002, basePower: 2000000, frag: 5000 },
};

const RARITY_LIST = Object.keys(RARITIES).map(k => ({ id: k, ...RARITIES[k] })).sort((a, b) => a.order - b.order);

const CARDS = [
  { id: 'egg-rainbow',  name: '炫彩蛋',     rarity: 'white',  start: true, unique: true, art: { type: 'egg', colors: 'rainbow' },               desc: '传说中集齐五种元素之蛋才会孵化的神奇蛋。',                flavor: '它只是一颗白卡蛋，但梦想是炫彩的。',             formation: ['egg-gold', 'egg-wood', 'egg-water', 'egg-fire', 'egg-earth'] },
  { id: 'egg-gold',     name: '金蛋',       rarity: 'white',  start: true, art: { type: 'egg', colors: ['#ffe9a8', '#f5b52e'] },  desc: '沉甸甸的蛋，隐约透出金光。',                              flavor: '晃一晃，里面有叮当声。',                        formation: [] },
  { id: 'egg-wood',     name: '木蛋',       rarity: 'white',  start: true, art: { type: 'egg', colors: ['#e0d3b0', '#8a6b3f'] },  desc: '外壳带着树皮纹路的蛋。',                                  flavor: '插进土里好像会发芽。',                          formation: [] },
  { id: 'egg-water',    name: '水蛋',       rarity: 'white',  start: true, art: { type: 'egg', colors: ['#d6ecff', '#4da3ff'] },  desc: '轻轻晃动，能听到水声的蛋。',                              flavor: '永远潮乎乎的。',                                formation: [] },
  { id: 'egg-fire',     name: '火蛋',       rarity: 'white',  start: true, art: { type: 'egg', colors: ['#ffe0cc', '#ff7a45'] },  desc: '摸上去热乎乎的蛋。',                                      flavor: '冬天抱着它睡觉。',                              formation: [] },
  { id: 'egg-earth',    name: '土蛋',       rarity: 'white',  start: true, art: { type: 'egg', colors: ['#ecd9b8', '#96704a'] },  desc: '沾着泥土气息的蛋。',                                      flavor: '重得像个哑铃。',                                formation: [] },
  { id: 'sapling',      name: '小树苗',     rarity: 'green',  art: { type: 'emoji', emoji: '🌱' },  desc: '需要三颗蛋的陪伴才能茁壮成长。',            flavor: '一天长一片叶子。',                              formation: ['egg-wood', 'egg-earth', 'egg-water'] },
  { id: 'ember',        name: '小火苗',     rarity: 'green',  art: { type: 'emoji', emoji: '🔥' },  desc: '一点就着的小脾气。',                        flavor: '吹口气就会灭。',                              formation: ['egg-fire', 'egg-wood', 'egg-gold'] },
  { id: 'droplet',      name: '小水灵',     rarity: 'green',  art: { type: 'emoji', emoji: '💧' },  desc: '整天咕嘟咕嘟冒泡。',                        flavor: '哭的时候会下雨。',                            formation: ['egg-water', 'egg-fire', 'egg-earth'] },
  { id: 'forest-guard', name: '森林守卫',   rarity: 'blue',   art: { type: 'emoji', emoji: '🌳' },  desc: '森林里最可靠的伙伴。',                      flavor: '每一片叶子都在放哨。',                        formation: ['sapling', 'egg-wood', 'egg-earth'] },
  { id: 'lava-turtle',  name: '岩浆龟',     rarity: 'blue',   art: { type: 'emoji', emoji: '🐢' },  desc: '龟壳里住着一座小火山。',                    flavor: '走得慢，但挡不住。',                          formation: ['ember', 'egg-fire'] },
  { id: 'elementalist', name: '元素使',     rarity: 'purple', art: { type: 'emoji', emoji: '⚗️' },  desc: '调和水火木土的大师。',                      flavor: '配方是机密。',                                formation: ['egg-fire', 'egg-water', 'egg-wood', 'egg-earth'] },
  { id: 'rainbow-dragon', name: '彩虹龙',   rarity: 'gold',   art: { type: 'emoji', emoji: '🐉' },  desc: '横跨天际的传说之龙。',                      flavor: '它飞过的地方会下糖果雨。',                  formation: ['elementalist', 'forest-guard', 'lava-turtle', 'ember', 'droplet', 'sapling'] },
  { id: 'chaos-lord',   name: '混沌魔王',   rarity: 'red',    art: { type: 'emoji', emoji: '👹' },  desc: '吞噬光明与秩序。',                          flavor: '连影子都害怕它。',                            formation: ['rainbow-dragon', 'elementalist', 'egg-gold', 'egg-wood', 'egg-water', 'egg-fire', 'egg-earth'] },
  { id: 'abyss-lord',   name: '深渊之主',   rarity: 'black',  art: { type: 'emoji', emoji: '🕳️' },  desc: '凝视深渊者，终将被深渊凝视。',              flavor: '没人见过它的真面目。',                        formation: ['chaos-lord', 'rainbow-dragon', 'elementalist', 'egg-gold', 'egg-wood', 'egg-water', 'egg-fire', 'egg-earth'] },
  { id: 'creator',      name: '创世神',     rarity: 'rainbow', art: { type: 'emoji', emoji: '✨' },  desc: '一切卡片的起源。',                          flavor: '它给自己写的登场台词。',                      formation: ['abyss-lord', 'chaos-lord', 'rainbow-dragon', 'elementalist'] },
  { id: 'egg-stone',    name: '石头蛋',     rarity: 'white',  art: { type: 'egg', colors: ['#e2e8f0', '#94a3b8'] },  desc: '重得像块石头的蛋。',                      flavor: '砸核桃挺好用。',                          formation: [] },
  { id: 'egg-thunder',  name: '雷蛋',       rarity: 'white',  art: { type: 'egg', colors: ['#fef9c3', '#eab308'] },  desc: '偶尔会噼啪作响的蛋。',                    flavor: '摸之前记得先洗手。',                      formation: [] },
  { id: 'egg-ice',      name: '冰蛋',       rarity: 'white',  art: { type: 'egg', colors: ['#e0f2fe', '#38bdf8'] },  desc: '摸起来凉飕飕的蛋。',                      flavor: '夏天想抱着它。',                          formation: [] },
  { id: 'rockling',     name: '小石头',     rarity: 'green',  art: { type: 'emoji', emoji: '🪨' },  desc: '一块会滚的小石头。',                      flavor: '滚起来比看起来快。',                      formation: ['egg-stone', 'egg-gold', 'egg-wood'] },
  { id: 'cloudling',    name: '小云朵',     rarity: 'green',  art: { type: 'emoji', emoji: '☁️' },  desc: '软绵绵的云朵精灵。',                      flavor: '心情好就下雨。',                          formation: ['egg-water', 'egg-thunder', 'egg-ice'] },
  { id: 'blossom',      name: '小花精',     rarity: 'green',  art: { type: 'emoji', emoji: '🌸' },  desc: '从花苞里钻出来的小家伙。',                flavor: '走到哪香到哪。',                          formation: ['egg-wood', 'egg-water', 'egg-earth'] },
  { id: 'thunder-spirit', name: '雷灵',     rarity: 'blue',   art: { type: 'emoji', emoji: '⚡' },  desc: '脾气火爆的电系精灵。',                    flavor: '打雷天最精神。',                          formation: ['cloudling', 'egg-thunder', 'egg-water'] },
  { id: 'ice-wisp',     name: '冰灵',       rarity: 'blue',   art: { type: 'emoji', emoji: '❄️' },  desc: '指尖掠过霜雪的精灵。',                    flavor: '夏天站在它身边很凉快。',                  formation: ['blossom', 'egg-ice', 'egg-wood'] },
  { id: 'rock-golem',   name: '岩甲兵',     rarity: 'blue',   art: { type: 'emoji', emoji: '🗿' },  desc: '岩石堆成的沉默士兵。',                    flavor: '它的笑点很低。',                          formation: ['rockling', 'egg-earth', 'egg-gold'] },
  { id: 'storm-witch',  name: '风暴女巫',   rarity: 'purple', art: { type: 'emoji', emoji: '🧙' },  desc: '把闪电装进帽子的女巫。',                  flavor: '帽子其实是晴雨计。',                      formation: ['thunder-spirit', 'cloudling', 'egg-thunder', 'egg-ice'] },
  { id: 'crystal-golem', name: '水晶魔像',  rarity: 'purple', art: { type: 'emoji', emoji: '💎' },  desc: '浑身剔透的水晶造物。',                    flavor: '在阳光下会闪瞎眼。',                      formation: ['rock-golem', 'ice-wisp', 'egg-ice', 'egg-gold'] },
  { id: 'thunder-dragon', name: '雷光龙',   rarity: 'gold',   art: { type: 'emoji', emoji: '🐲' },  desc: '御雷而行的东方之龙。',                    flavor: '尾巴一甩就是一道闪电。',                  formation: ['storm-witch', 'thunder-spirit', 'cloudling', 'ice-wisp', 'egg-thunder', 'egg-ice'] },
  { id: 'gold-golem',   name: '金晶王',     rarity: 'gold',   art: { type: 'emoji', emoji: '👑' },  desc: '统治矿物王国的黄金之王。',                flavor: '它的王座是块大金矿。',                    formation: ['crystal-golem', 'rock-golem', 'rockling', 'egg-gold', 'egg-wood', 'egg-earth'] },
  { id: 'storm-lord',   name: '风暴之主',   rarity: 'red',    art: { type: 'emoji', emoji: '🌩️' },  desc: '将整片天空握在手中。',                    flavor: '它一打喷嚏就会刮台风。',                  formation: ['thunder-dragon', 'storm-witch', 'gold-golem', 'egg-thunder', 'egg-gold'] },
  { id: 'void-dragon',  name: '虚空之龙',   rarity: 'black',  art: { type: 'emoji', emoji: '🌀' },  desc: '蛰伏于虚空尽头的古龙。',                  flavor: '它的叹息就是黑洞。',                      formation: ['storm-lord', 'thunder-dragon', 'gold-golem', 'crystal-golem', 'egg-thunder', 'egg-ice'] },
];

CARDS.forEach((c, i) => { c.no = i + 1; });

const CARD_MAP = {};
CARDS.forEach(c => { CARD_MAP[c.id] = c; });

const CONFIG = {
  INTERVAL_BASE: 10,
  INTERVAL_GOLD_S: 2,
  INTERVAL_GOLD_P: 14200,
  EXP_START_TO_GOLD: 0.2442,
  EXP_GOLD_TO_TOP: 0.7661,
  MIN_INTERVAL: 0.005,
  OFFLINE_CAP_HOURS: 8,
  FRAG_COST_PER_DRAW: 10,
};
