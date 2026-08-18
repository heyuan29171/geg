let S = null;
let P0 = 20;
let monsterHp = 1;
let lastTick = 0;

function basePowerOf(card) { return RARITIES[card.rarity].basePower; }

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
  const pool = CARDS.filter(c => c.rarity === rarityId && !(c.unique && (S.owned[c.id] || 0) > 0));
  if (!pool.length) pool.push(CARDS.find(c => c.rarity === rarityId) || CARDS[0]);
  return pool[Math.floor(Math.random() * pool.length)];
}

function doDraw(opts) {
  const silent = opts && opts.silent;
  S.totalPulls++;
  const r = rollRarity();
  const card = pickCard(r.id);
  const before = S.owned[card.id] || 0;
  const isNew = before === 0;
  S.owned[card.id] = before + 1;
  if (isNew) S.ownedAt[card.id] = Date.now();
  if (isNew && typeof bossNewCard === 'function') bossNewCard(card);
  S.rarityCounts[r.id]++;
  let frag = 0;
  if (!isNew) {
    frag = RARITIES[r.id].frag;
    S.fragments += frag;
  }
  if (!silent) {
    S.log.unshift({ t: Date.now(), cardId: card.id, isNew, frag });
    S.log = S.log.slice(0, 12);
  }
  return { card, r, isNew, frag };
}

function spawnMonster() { monsterHp = monsterMaxHp(); }

function clickMonster() {
  monsterHp -= activePower() * 0.5;
  if (typeof Tutorial !== 'undefined') Tutorial.onMonsterClick();
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
}

function accrueSince(t0) {
  const elapsed = (Date.now() - t0) / 1000;
  if (elapsed < 90) return null;
  const secs = Math.min(elapsed, CONFIG.OFFLINE_CAP_HOURS * 3600);
  const pulls = secs / battleInterval();
  const frags = Math.floor(pulls * 0.1 * CONFIG.FRAG_COST_PER_DRAW);
  if (frags <= 0) return null;
  S.fragments += frags;
  S.updatedAt = Date.now();
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
  for (let i = 0; i < draws; i++) {
    const res = doDraw({ silent: true });
    if (res.isNew) newCards.push(res.card.name);
    byRarity[res.r.id] = (byRarity[res.r.id] || 0) + 1;
    fragGain += res.frag;
  }
  return { draws, newCards, byRarity, fragGain };
}

function setActiveCard(id) {
  if (CARD_MAP[id] && (S.owned[id] || 0) > 0) S.activeCenter = id;
}

function gameInit() {
  P0 = formationPowerOf('egg-rainbow');
}
