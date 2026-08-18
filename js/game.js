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
  const cards = formationCardsOf(cardId);
  if (!cards.every(c => (S.owned[c.id] || 0) > 0)) return basePowerOf(cards[0]);
  const n = cards.length;
  const sum = cards.reduce((a, c) => a + basePowerOf(c), 0);
  return sum * (1 + 0.2 * (n - 1) + 0.05 * (n - 1) * (n - 1));
}

function activePower() { return formationPowerOf(S.activeCenter); }

function battleInterval() {
  const P = Math.max(activePower(), 1);
  return Math.max(CONFIG.MIN_INTERVAL, Math.min(CONFIG.INTERVAL_BASE, CONFIG.INTERVAL_BASE * Math.pow(Math.max(P0, 1) / P, CONFIG.INTERVAL_EXP)));
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
  if (!pool.length) pool.push(CARDS[Math.floor(Math.random() * CARDS.length)]);
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

function tick(now) {
  if (!S) return;
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

function offlineAccrue() {
  const elapsed = (Date.now() - S.updatedAt) / 1000;
  if (elapsed < 90) return 0;
  const iv = battleInterval();
  const maxN = Math.floor(CONFIG.OFFLINE_CAP_HOURS * 3600 / iv);
  let n = Math.min(Math.floor(elapsed / iv), maxN);
  for (let i = 0; i < n; i++) {
    doDraw({ silent: true });
    S.kills++;
    S.monsterLevel = Math.min(S.monsterLevel + 1, 1e7);
  }
  return n;
}

function spendFragments() {
  if (S.fragments < CONFIG.FRAG_COST_PER_DRAW) return false;
  S.fragments -= CONFIG.FRAG_COST_PER_DRAW;
  const res = doDraw();
  onReward(res);
  return true;
}

function setActiveCard(id) {
  if (CARD_MAP[id] && (S.owned[id] || 0) > 0) S.activeCenter = id;
}

function gameInit() {
  P0 = formationPowerOf('egg-rainbow');
}
