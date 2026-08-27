let S = null;
let P0 = 20;
let monsterHp = 1;
let lastTick = 0;

function isEggUpgraded() { return !!(S && S.eggUpgraded); }

function isEggCard(c) { return c.id === 'egg-rainbow' || c.id === 'egg-rainbow-x'; }

function effRarity(c) { return (c.id === 'egg-rainbow' && isEggUpgraded()) ? 'rainbow' : c.rarity; }

function effName(c) { return (c.id === 'egg-rainbow' && isEggUpgraded()) ? '炫彩炫彩蛋' : c.name; }

function effDesc(c) { return (c.id === 'egg-rainbow' && isEggUpgraded()) ? '我相信我的梦，让白超越炫彩' : c.desc; }

function basePowerOf(card) {
  if (card.id === 'egg-rainbow' && isEggUpgraded()) return RARITIES.rainbow.basePower * 2;
  const base = RARITIES[card.rarity].basePower;
  return isShiny(card.id) ? base * 2 : base;
}

function formationCardsOf(cardId) {
  const c = CARD_MAP[cardId];
  return [c].concat(c.formation.map(f => CARD_MAP[f]));
}

function formationComplete(cardId) {
  return formationCardsOf(cardId).every(c => (S.owned[c.id] || 0) > 0);
}

function formationPowerOf(cardId) {
  const cards = formationCardsOf(cardId).filter(c => (S.owned[c.id] || 0) > 0);
  if (!cards.length) return 0;
  const n = cards.length;
  const sum = cards.reduce((a, c) => a + basePowerOf(c), 0);
  return sum * (1 + 0.2 * (n - 1) + 0.05 * (n - 1) * (n - 1));
}

function formationPowerFull(cardId) {
  const cards = formationCardsOf(cardId);
  const n = cards.length;
  const sum = cards.reduce((a, c) => a + basePowerOf(c), 0);
  return sum * (1 + 0.2 * (n - 1) + 0.05 * (n - 1) * (n - 1));
}

function activePower() { return formationPowerOf(S.activeCenter); }

function battleInterval() {
  const P = Math.max(activePower(), 1);
  const iv = CONFIG.INTERVAL_BASE * Math.pow(Math.max(P0, 1) / P, CONFIG.INTERVAL_EXP);
  return Math.max(CONFIG.MIN_INTERVAL, Math.min(CONFIG.INTERVAL_BASE, iv));
}

function monsterMaxHp() { return Math.max(1, activePower() * battleInterval()); }

function rollRarity() {
  const total = RARITY_LIST.reduce((a, r) => a + r.weight, 0);
  let x = Math.random() * total;
  for (const r of RARITY_LIST) {
    x -= r.weight;
    if (x <= 0) return r;
  }
  return RARITY_LIST[RARITY_LIST.length - 1];
}

function pickCard(rarityId) {
  const pool = CARDS.filter(c => c.rarity === rarityId && !c.hidden && !(c.unique && (S.owned[c.id] || 0) > 0));
  if (!pool.length) pool.push(CARDS.find(c => c.rarity === rarityId) || CARDS[0]);
  return pool[Math.floor(Math.random() * pool.length)];
}

function doDraw(opts) {
  const silent = opts && opts.silent;
  S.totalPulls++;
  if (!isEggUpgraded() && Math.random() < CONFIG.SECRET_EGG_RATE) {
    S.eggUpgraded = true;
    S.rarityCounts.rainbow = (S.rarityCounts.rainbow || 0) + 1;
    return { card: CARD_MAP['egg-rainbow-x'], r: RARITIES.rainbow, isNew: true, frag: 0, secret: true };
  }
  const r = applyPity(rollRarity());
  const card = pickCard(r.id);
  const before = S.owned[card.id] || 0;
  const isNew = before === 0;
  S.owned[card.id] = before + 1;
  if (isNew) S.ownedAt[card.id] = Date.now();
  if (isNew && typeof bossNewCard === 'function') bossNewCard(card);
  const shiny = rollShiny(card);
  S.rarityCounts[r.id]++;
  let frag = 0;
  if (!isNew) {
    frag = RARITIES[r.id].frag;
    S.fragments += frag;
    S.fragEarnedTotal = (S.fragEarnedTotal || 0) + frag;
  }
  if (!silent) {
    S.log.unshift({ t: Date.now(), cardId: card.id, isNew, frag });
    S.log = S.log.slice(0, 12);
  }
  return { card, r, isNew, frag, shiny };
}

function spawnMonster() { monsterHp = monsterMaxHp(); }

let lastClickAt = 0;
function clickMonster() {
  const now = Date.now();
  if (now - lastClickAt < 12.5) return;
  lastClickAt = now;
  monsterHp -= activePower() * 0.5;
  S.monsterClicks = (S.monsterClicks || 0) + 1;
  if (typeof Tutorial !== 'undefined') Tutorial.onMonsterClick();
  checkAchievements();
}

function tick(now) {
  if (!S) return;
  if (typeof document !== 'undefined' && document.hidden) return;
  if (!lastTick) lastTick = now;
  const dt = Math.min((now - lastTick) / 1000, 5);
  lastTick = now;
  monsterHp -= activePower() * dt;
  while (monsterHp <= 0) {
    const res = doDraw();
    S.kills++;
    S.monsterLevel = Math.min(S.monsterLevel + 1, 1e7);
    monsterHp += monsterMaxHp();
    onReward(res);
  }
  updateBattle();
  checkAchievements();
  nestTickCheck();
}

function nestTickCheck() {
  allNests().forEach(n => {
    if (!n || !n.a || !n.b || n.ready) return;
    if (Date.now() >= n.hatchAt) {
      n.ready = true;
      if (typeof renderSoon === 'function') renderSoon();
    }
  });
}

function ownedCardCount() {
  let n = 0;
  CARDS.forEach(c => { if (!c.hidden && (S.owned[c.id] || 0) > 0) n++; });
  return n;
}

function hasRarityOf(rarityId) {
  return CARDS.some(c => !c.hidden && effRarity(c) === rarityId && (S.owned[c.id] || 0) > 0);
}

function achievementProgress(cfg) {
  switch (cfg.type) {
    case 'pulls': return { cur: S.totalPulls, goal: cfg.goal };
    case 'kills': return { cur: S.kills || 0, goal: cfg.goal };
    case 'clicks': return { cur: S.monsterClicks || 0, goal: cfg.goal };
    case 'owned': return { cur: ownedCardCount(), goal: cfg.goal };
    case 'power': return { cur: activePower(), goal: cfg.goal };
    case 'rarity': return { cur: hasRarityOf(cfg.goal) ? 1 : 0, goal: 1 };
    case 'frags': return { cur: S.fragEarnedTotal || 0, goal: cfg.goal };
    case 'offline': return { cur: S.achievements[cfg.id] ? 1 : 0, goal: 1 };
    case 'secret': return { cur: isEggUpgraded() ? 1 : 0, goal: 1 };
    case 'nest': return { cur: S.nestHatches || 0, goal: cfg.goal };
  }
  return { cur: 0, goal: 1 };
}

function unlockAchievement(cfg) {
  if (S.achievements[cfg.id]) return false;
  S.achievements[cfg.id] = Date.now();
  S.fragments += cfg.reward;
  S.fragEarnedTotal = (S.fragEarnedTotal || 0) + cfg.reward;
  S.updatedAt = Date.now();
  if (typeof onAchievement === 'function') onAchievement(cfg);
  return true;
}

function checkAchievements() {
  if (!S.achievements) S.achievements = {};
  let n = 0;
  (CONFIG.ACHIEVEMENTS || []).forEach(cfg => {
    if (cfg.type === 'offline') return;
    if (S.achievements[cfg.id]) return;
    const p = achievementProgress(cfg);
    if (p.cur >= p.goal) { if (unlockAchievement(cfg)) n++; }
  });
  return n;
}

function checkOfflineAchievements(frags) {
  if (!S.achievements) S.achievements = {};
  let n = 0;
  (CONFIG.ACHIEVEMENTS || []).forEach(cfg => {
    if (cfg.type !== 'offline' || S.achievements[cfg.id]) return;
    if (frags >= cfg.goal) { if (unlockAchievement(cfg)) n++; }
  });
  return n;
}

function accrueSince(t0) {
  const elapsed = (Date.now() - t0) / 1000;
  if (elapsed < 90) return null;
  const secs = Math.min(elapsed, CONFIG.OFFLINE_CAP_HOURS * 3600);
  const pulls = secs / battleInterval();
  const frags = Math.floor(pulls / 3 * CONFIG.FRAG_COST_PER_DRAW);
  if (frags <= 0) return null;
  S.fragments += frags;
  S.fragEarnedTotal = (S.fragEarnedTotal || 0) + frags;
  S.updatedAt = Date.now();
  checkOfflineAchievements(frags);
  return { frags: frags, secs: Math.round(secs) };
}

function offlineAccrue() { return accrueSince(S.updatedAt); }

function spendFragments() {
  if (S.fragments < CONFIG.FRAG_COST_PER_DRAW) return false;
  S.fragments -= CONFIG.FRAG_COST_PER_DRAW;
  const res = doDraw();
  onReward(res);
  return true;
}

function spendAllFragments() {
  const draws = Math.min(Math.floor(S.fragments / CONFIG.FRAG_COST_PER_DRAW), CONFIG.MAX_FRAG_DRAWS);
  if (draws < 1) return null;
  S.fragments -= draws * CONFIG.FRAG_COST_PER_DRAW;
  const newCards = [];
  const byRarity = {};
  let fragGain = 0;
  let secretCount = 0;
  let secretNew = false;
  for (let i = 0; i < draws; i++) {
    const res = doDraw({ silent: true });
    if (res.secret) { secretCount++; if (res.isNew) secretNew = true; continue; }
    if (res.isNew) newCards.push(res.card.name);
    byRarity[res.r.id] = (byRarity[res.r.id] || 0) + 1;
    fragGain += res.frag;
  }
  S.fragEarnedTotal = (S.fragEarnedTotal || 0) + fragGain;
  return { draws, newCards, byRarity, fragGain, secretCount, secretNew };
}

function setActiveCard(id) {
  if (CARD_MAP[id] && (S.owned[id] || 0) > 0) {
    S.activeCenter = id;
    allNests().forEach(n => {
      let changed = false;
      if (n.a === id) { n.a = null; changed = true; }
      if (n.b === id) { n.b = null; changed = true; }
      if (changed) resetNestTimer(n);
    });
  }
}

function allNests() {
  return [S.homeNest].concat(S.extraNests || []);
}

function nestCardOK(card) {
  if (!card || isEggCard(card) || (S.owned[card.id] || 0) <= 0 || card.id === S.activeCenter) return false;
  return !allNests().some(n => n.a === card.id || n.b === card.id);
}

function nestSet(slot, cardId, idx) {
  const n = allNests()[idx || 0];
  if (!n || !nestCardOK(CARD_MAP[cardId])) return false;
  if (slot === 'a') n.a = cardId; else n.b = cardId;
  resetNestTimer(n);
  return true;
}

function nestRemove(slot, idx) {
  const n = allNests()[idx || 0];
  if (!n) return;
  if (slot === 'a') n.a = null; else n.b = null;
  resetNestTimer(n);
}

function resetNestTimer(n) {
  n = n || S.homeNest;
  if (!n.a || !n.b) { n.startedAt = 0; n.hatchAt = 0; n.ready = false; return; }
  n.ready = false;
  n.startedAt = Date.now();
  n.hatchAt = n.startedAt + (CONFIG.HOME_EGG_MIN + Math.random() * (CONFIG.HOME_EGG_MAX - CONFIG.HOME_EGG_MIN)) * 1000;
}

function buyNestSlot() {
  const extra = S.extraNests || [];
  if (extra.length >= CONFIG.SHOP.NEST_SLOT_COSTS.length) return false;
  const cost = CONFIG.SHOP.NEST_SLOT_COSTS[extra.length];
  if (S.fragments < cost) return false;
  S.fragments -= cost;
  S.extraNests = extra.concat([{ a: null, b: null, startedAt: 0, hatchAt: 0, ready: false }]);
  return true;
}

function pityCost(key) {
  const cfg = CONFIG.SHOP.PITY[key];
  return Math.round(cfg.baseCost * Math.pow(cfg.growth, (S.pityBought || {})[key] || 0));
}

function buyPity(key) {
  if (!CONFIG.SHOP.PITY[key]) return false;
  const cost = pityCost(key);
  if (S.fragments < cost) return false;
  S.fragments -= cost;
  S.pityStock = S.pityStock || { purple: 0, gold: 0, black: 0 };
  S.pityBought = S.pityBought || { purple: 0, gold: 0, black: 0 };
  S.pityStock[key]++;
  S.pityBought[key]++;
  return true;
}

function buyCosmeticFrame() {
  if (S.cosmetics && S.cosmetics.gradFrame) return false;
  if (S.fragments < CONFIG.SHOP.COSMETIC_FRAME_COST) return false;
  S.fragments -= CONFIG.SHOP.COSMETIC_FRAME_COST;
  S.cosmetics = { gradFrame: true };
  return true;
}

const PITY_TIERS = ['purple', 'gold', 'black'];

function isShiny(id) { return !!(S.shiny && S.shiny[id]); }

function shinyCountOf() { return S.shiny ? Object.keys(S.shiny).length : 0; }

function rollShiny(card) {
  if (!card || isEggCard(card)) return false;
  if (isShiny(card.id)) return false;
  if (Math.random() >= CONFIG.SHINY_RATE) return false;
  S.shiny = S.shiny || {};
  S.shiny[card.id] = Date.now();
  if (!S.shinySeen) {
    S.shinySeen = true;
    if (typeof showShinyModal === 'function') showShinyModal(card);
  } else if (typeof toast === 'function') {
    toast('「' + effName(card) + '」闪出了异色光！', 'rc-gold');
  }
  return true;
}

function pityFloorOrder() {
  const stock = S.pityStock || {};
  let order = -1;
  PITY_TIERS.forEach(k => {
    if ((stock[k] || 0) > 0) order = Math.max(order, RARITIES[k].order);
  });
  return order;
}

function rollRarityAbove(minOrder) {
  const pool = RARITY_LIST.filter(r => r.order >= minOrder);
  const total = pool.reduce((a, r) => a + r.weight, 0);
  let x = Math.random() * total;
  for (const r of pool) { x -= r.weight; if (x <= 0) return r; }
  return pool[pool.length - 1];
}

function consumePity(order) {
  const stock = S.pityStock || {};
  PITY_TIERS.forEach(k => {
    if ((stock[k] || 0) > 0 && RARITIES[k].order === order) stock[k]--;
  });
}

function applyPity(r) {
  const floor = pityFloorOrder();
  if (floor < 0) return r;
  let out = r;
  if (RARITIES[r.id].order < floor) out = rollRarityAbove(floor);
  consumePity(floor);
  return out;
}

function rollNestRarity(nest) {
  const n = nest || S.homeNest;
  const eligible = RARITY_LIST.filter(r => CARDS.some(c => c.rarity === r.id && !c.hidden && !isEggCard(c)));
  if (Math.random() < CONFIG.HOME_EGG_BOOST) {
    const oa = RARITIES[CARD_MAP[n.a].rarity].order;
    const ob = RARITIES[CARD_MAP[n.b].rarity].order;
    const pool = eligible.filter(r => r.order >= Math.min(oa, ob));
    const total = pool.reduce((a, r) => a + r.weight, 0);
    let x = Math.random() * total;
    for (const r of pool) { x -= r.weight; if (x <= 0) return r; }
    return pool[pool.length - 1];
  }
  const total = eligible.reduce((a, r) => a + r.weight, 0);
  let x = Math.random() * total;
  for (const r of eligible) { x -= r.weight; if (x <= 0) return r; }
  return eligible[eligible.length - 1];
}

function pickNestCard(rarityId) {
  const pool = CARDS.filter(c => c.rarity === rarityId && !c.hidden && !isEggCard(c));
  return pool[Math.floor(Math.random() * pool.length)];
}

function doNestDraw(nest) {
  S.totalPulls++;
  const r = rollNestRarity(nest);
  const card = pickNestCard(r.id);
  const before = S.owned[card.id] || 0;
  const isNew = before === 0;
  S.owned[card.id] = before + 1;
  if (isNew) S.ownedAt[card.id] = Date.now();
  if (isNew && typeof bossNewCard === 'function') bossNewCard(card);
  const shiny = rollShiny(card);
  S.rarityCounts[r.id]++;
  let frag = 0;
  if (!isNew) {
    frag = RARITIES[r.id].frag;
    S.fragments += frag;
    S.fragEarnedTotal = (S.fragEarnedTotal || 0) + frag;
  }
  S.log.unshift({ t: Date.now(), cardId: card.id, isNew, frag });
  S.log = S.log.slice(0, 12);
  return { card, r, isNew, frag, shiny };
}

function hatchEgg(idx) {
  const n = allNests()[idx || 0];
  if (!n || !n.ready) return null;
  const res = doNestDraw(n);
  S.nestHatches = (S.nestHatches || 0) + 1;
  resetNestTimer(n);
  checkAchievements();
  return res;
}

function gameInit() {
  const up = S.eggUpgraded;
  S.eggUpgraded = false;
  P0 = formationPowerOf('egg-rainbow');
  S.eggUpgraded = up;
}
