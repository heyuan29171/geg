let currentTab = 'battle';
let codexFilter = 'all';
let bagFilter = 'all';
let codexOwned = 'all';
let codexComplete = 'all';
let bagComplete = 'all';
let codexPowerMin = '', codexPowerMax = '', codexQuery = '';
let bagPowerMin = '', bagPowerMax = '', bagQuery = '';
let codexSort = { key: 'no', dir: 1 };
let bagSort = { key: 'no', dir: -1 };
const PNG_READY = new Set();
let MONSTER_PNG = false;
let viewerOpen = false;

function $id(id) { return document.getElementById(id); }

function fmtRate(p) {
  let s;
  if (p >= 10) s = p.toFixed(0);
  else if (p >= 1) s = p.toFixed(1);
  else if (p >= 0.1) s = p.toFixed(2);
  else if (p >= 0.01) s = p.toFixed(3);
  else s = p.toFixed(5);
  if (s.indexOf('.') >= 0) s = s.replace(/\.?0+$/, '');
  return s + '%';
}

const RATE_TOTAL = RARITY_LIST.reduce((a, r) => a + r.weight, 0);

function ratePct(r) { return r.weight / RATE_TOTAL * 100; }

function frameClass(card) {
  const grad = S && S.cosmetics && S.cosmetics.gradFrame ? ' frame-grad' : '';
  return 'frame frame-' + effRarity(card) + grad;
}

function rarityTagHTML(r) { return '<span class="r-tag r-' + r + '">' + RARITIES[r].name + '</span>'; }

function eggStyle(card) {
  const cols = card.art.colors;
  if (cols === 'rainbow') {
    return "background: conic-gradient(from 0deg, #f43f5e, #f59e0b, #84cc16, #22c55e, #0ea5e9, #8b5cf6, #f43f5e); animation: egg-spin 8s linear infinite;";
  }
  return "background: radial-gradient(circle at 35% 28%, " + cols[0] + " 0%, " + cols[1] + " 78%);";
}

function artHTML(card, full) {
  if (S && S.artMode !== 'emoji' && PNG_READY.has(card.id)) {
    return '<img class="art-img" src="img/cards/' + (full ? card.id : 'thumb/' + card.id) + '.jpg" alt="">';
  }
  if (card.art && card.art.type === 'egg') {
    return '<div class="egg-art" style="' + eggStyle(card) + '"></div>';
  }
  return '<div class="emoji-art">' + (card.art && card.art.emoji ? card.art.emoji : '?') + '</div>';
}

function toast(msg, cls, ms) {
  const t = document.createElement('div');
  t.className = 'toast' + (cls ? ' ' + cls : '');
  t.innerHTML = msg;
  $id('toasts').appendChild(t);
  setTimeout(() => t.classList.add('out'), ms || 4000);
  setTimeout(() => t.remove(), (ms || 4000) + 500);
}

function fmtInterval(sec) {
  if (sec >= 1) return sec.toFixed(1) + 's';
  return (1 / sec).toFixed(1) + ' 抽/秒';
}

let lastToastAt = 0;
let renderQueued = false;

function renderSoon() {
  if (renderQueued) return;
  renderQueued = true;
  setTimeout(() => { renderQueued = false; renderAll(); }, 400);
}

let eggModalLockUntil = 0;

function showEggModal() {
  const m = $id('egg-modal');
  if (!m) return;
  m.classList.remove('hidden');
  eggModalLockUntil = Date.now() + 3000;
  const btn = $id('egg-modal-close');
  if (btn) btn.disabled = true;
  setTimeout(() => {
    const b = $id('egg-modal-close');
    if (b && !m.classList.contains('hidden')) b.disabled = false;
  }, 3000);
}

function hideEggModal() {
  if (Date.now() < eggModalLockUntil) return;
  const m = $id('egg-modal');
  if (m) m.classList.add('hidden');
  const btn = $id('egg-modal-close');
  if (btn) btn.disabled = false;
}

function eggModalOpen() {
  const m = $id('egg-modal');
  return !!(m && !m.classList.contains('hidden'));
}

function showNestModal(res) {
  const m = $id('nest-modal');
  if (!m || !res) return;
  const c = res.card && CARD_MAP[res.card.id] ? CARD_MAP[res.card.id] : null;
  const rid = res.r ? res.r.id : 'white';
  const cardEl = $id('nest-modal-card');
  if (cardEl) cardEl.innerHTML = '<div class="nest-modal-art">' + (c ? artHTML(c) : '') + '</div>' +
    '<div class="nest-modal-name">' + (c ? effName(c) : '???') + '</div>' +
    '<span class="r-tag r-' + rid + '">' + (res.r ? res.r.name : '') + '</span>';
  const sub = $id('nest-modal-sub');
  if (sub) sub.textContent = res.isNew ? '新卡！已加入图鉴' : '重复卡，获得 +' + res.frag + ' 碎片';
  m.classList.remove('hidden');
}

function hideNestModal() {
  const m = $id('nest-modal');
  if (m) m.classList.add('hidden');
}

function nestModalOpen() {
  const m = $id('nest-modal');
  return !!(m && !m.classList.contains('hidden'));
}

function onAchievement(cfg) {
  const label = cfg.hidden ? '幻蛋之秘' : cfg.name;
  if (document.body.classList.contains('boss-mode')) {
    const h = $id('boss-ach-hint');
    if (h) {
      h.textContent = '🏆 ' + label + ' +' + cfg.reward + ' 碎片';
      h.classList.remove('hidden');
      clearTimeout(h._t);
      h._t = setTimeout(() => h.classList.add('hidden'), 6000);
    }
    return;
  }
  toast('🏆 成就达成「' + label + '」 +' + cfg.reward + ' 碎片', 'rc-gold', 5000);
}

function showEggUpgradeNotice() {
  if (document.body.classList.contains('boss-mode')) {
    const h = $id('boss-egg-hint');
    if (h) h.classList.remove('hidden');
    return;
  }
  showEggModal();
}

function onReward(res) {
  if (res.secret) {
    if (res.isNew) showEggUpgradeNotice();
    renderSoon();
    return;
  }
  const order = res.r.order;
  const now = Date.now();
  if (res.isNew || order >= 3) {
    if (now - lastToastAt >= 1200) {
      lastToastAt = now;
      const tag = res.isNew ? '<b>新卡！</b>' : '';
      toast(tag + rarityTagHTML(res.r.id) + ' · ' + res.card.name, 'rc-' + res.r.id, 4500);
    }
  } else if (now - lastToastAt >= 1200) {
    lastToastAt = now;
    toast(res.card.name + (res.frag ? ' +' + res.frag + ' 碎片' : ''), 'rc-' + res.r.id, 3000);
  }
  renderSoon();
}

function renderTopbar() {
  $id('ts-power').textContent = Math.round(activePower());
  $id('ts-interval').textContent = fmtInterval(battleInterval());
  $id('ts-frag').textContent = S.fragments;
  $id('ts-kills').textContent = S.kills;
  const btn = $id('btn-spend-all-frag');
  const draws = Math.floor(S.fragments / CONFIG.FRAG_COST_PER_DRAW);
  const capped = Math.min(draws, CONFIG.MAX_FRAG_DRAWS);
  btn.textContent = '用全部碎片抽卡（' + S.fragments + ' 碎片 → ' + capped + ' 抽' + (draws > CONFIG.MAX_FRAG_DRAWS ? '，单次上限 ' + CONFIG.MAX_FRAG_DRAWS + ' 抽' : '') + '）';
  btn.disabled = draws < 1;
}

function miniCardHTML(card, isCenter) {
  return '<div class="mini-card' + (isCenter ? ' center' : '') + ' ' + frameClass(card) + '">' +
    '<div class="frame-inner"><div class="mini-art">' + artHTML(card) + '</div>' +
    '<div class="mini-name">' + effName(card) + '</div></div></div>';
}

function battleRowHTML() {
  const center = CARD_MAP[S.activeCenter];
  const owned = formationCardsOf(S.activeCenter).filter(cm => (S.owned[cm.id] || 0) > 0);
  const n = owned.length;
  if (n === 1) return miniCardHTML(center, true);
  const others = owned.filter(cm => cm.id !== center.id);
  const left = others.slice(0, Math.floor(n / 2));
  const right = others.slice(Math.floor(n / 2));
  return left.map(m => miniCardHTML(m, false)).join('') +
    miniCardHTML(center, true) +
    right.map(m => miniCardHTML(m, false)).join('');
}

function memberChipHTML(cm, isSelf) {
  const has = (S.owned[cm.id] || 0) > 0;
  return '<span class="f-mem' + (has ? '' : ' miss') + '">' +
    '<span class="r-dot r-' + effRarity(cm) + '"></span>' +
    '<span class="rn-' + effRarity(cm) + '">' + effName(cm) + '</span>' +
    (isSelf ? '（中心）' : '') +
    (has ? '' : ' ✗') +
    '</span>';
}

function formationLineHTML(cardId) {
  const c = CARD_MAP[cardId];
  if (!c.formation.length) return '独行编队 · 战力 ' + Math.round(basePowerOf(c));
  const ownedCount = formationCardsOf(cardId).filter(cm => (S.owned[cm.id] || 0) > 0).length;
  const total = 1 + c.formation.length;
  const complete = ownedCount === total;
  const chips = formationCardsOf(cardId).map(cm => memberChipHTML(cm, cm.id === cardId)).join('');
  return '<div class="f-line">' + chips + '</div>' +
    '<div class="f-summary ' + (complete ? 'ok-text' : 'miss-text') + '">' +
    (complete ? '编队已集齐（' + total + ' 张）· 编队战力 ' + Math.round(formationPowerOf(cardId))
      : '编队未集齐（' + ownedCount + '/' + total + ' 张）· 战力 ' + Math.round(formationPowerOf(cardId)) + ' · 集齐后 ' + Math.round(formationPowerFull(cardId))) +
    '</div>';
}

let rbCache = { row: null, rate: false };
function renderBattle() {
  const rowHTML = battleRowHTML();
  if (rbCache.row !== rowHTML) {
    rbCache.row = rowHTML;
    $id('battle-row').innerHTML = rowHTML;
    const c = CARD_MAP[S.activeCenter];
    const ownedCount = formationCardsOf(S.activeCenter).filter(cm => (S.owned[cm.id] || 0) > 0).length;
    const total = formationCardsOf(S.activeCenter).length;
    $id('row-caption').textContent = (ownedCount === total ? '出战编队 · 中心 ' + effName(c) + ' · 共 ' + total + ' 张' : (ownedCount > 1 ? '出战编队（' + ownedCount + '/' + total + '）· 中心 ' + effName(c) : '单独出战 · 中心 ' + effName(c)));
    $id('formation-info').innerHTML = formationInfoHTML();
  }
  if (!rbCache.rate) {
    rbCache.rate = true;
    $id('rate-panel').innerHTML = rateRowsHTML();
  }
  $id('st-pulls').textContent = S.totalPulls;
  $id('st-kills').textContent = S.kills;
  const lc = S.rarityCounts;
  $id('st-lower').textContent = (lc.white || 0) + ' / ' + (lc.green || 0) + ' / ' + (lc.blue || 0);
  $id('st-upper').textContent = (lc.purple || 0) + ' / ' + (lc.gold || 0) + ' / ' + (lc.red || 0);
  $id('st-top').textContent = (lc.black || 0) + ' / ' + (lc.rainbow || 0);
  renderLog();
  updateBattle();
}

function formationInfoHTML() {
  const cards = formationCardsOf(S.activeCenter);
  const complete = formationComplete(S.activeCenter);
  const rows = cards.map(cm => {
    const has = (S.owned[cm.id] || 0) > 0;
    const isSelf = cm.id === S.activeCenter;
    return '<div class="frow ' + (has ? 'ok' : 'miss') + '">' + (has ? '✓' : '✗') + ' ' + effName(cm) + (isSelf ? '（中心）' : '') + ' · 基础战力 ' + basePowerOf(cm) + '</div>';
  }).join('');
  return '<div class="fhead">' + effName(CARD_MAP[S.activeCenter]) + ' ' + rarityTagHTML(effRarity(CARD_MAP[S.activeCenter])) + '</div>' +
    '<div class="fbody">' + rows + '</div>' +
    '<div class="fnote">' + (complete ? '编队战力 ' + Math.round(formationPowerOf(S.activeCenter))
      : '编队未集齐（' + formationCardsOf(S.activeCenter).filter(cm => (S.owned[cm.id] || 0) > 0).length + '/' + formationCardsOf(S.activeCenter).length + '）· 战力 ' + Math.round(formationPowerOf(S.activeCenter)) + ' · 集齐后 ' + Math.round(formationPowerFull(S.activeCenter))) + ' · 战斗间隔 ' + fmtInterval(battleInterval()) + '</div>';
}

function rateRowsHTML() {
  return RARITY_LIST.map(r =>
    '<div class="rate-row"><span class="r-dot r-' + r.id + '"></span><span>' + r.name + '</span><b>' + fmtRate(ratePct(r)) + '</b></div>'
  ).join('');
}

let logCache = null;
function renderLog() {
  const wrap = $id('battle-log');
  const html = !S.log.length
    ? '<div class="log-empty">还没有战利品记录</div>'
    : S.log.map(e => {
        const c = CARD_MAP[e.cardId];
        const t = new Date(e.t).toLocaleTimeString('zh-CN', { hour12: false });
        return '<div class="log-entry"><span class="log-time">' + t + '</span>' +
          '<span class="r-dot r-' + effRarity(c) + '"></span>' +
          '<span>' + effName(c) + '</span>' +
          (e.isNew ? '<span class="ok-text">新卡</span>' : '<span class="miss-text">+' + e.frag + ' 碎片</span>') + '</div>';
      }).join('');
  if (logCache !== html) {
    logCache = html;
    wrap.innerHTML = html;
  }
}

let ubCache = null;
function updateBattle() {
  const maxHp = monsterMaxHp();
  const pct = Math.max(0, Math.min(100, monsterHp / maxHp * 100));
  const level = S.monsterLevel;
  const p = activePower();
  const leftTxt = (p > 0 ? Math.max(0, monsterHp / p) : 0).toFixed(1);
  const c = ubCache || (ubCache = {});
  if (c.level !== level) {
    c.level = level;
    $id('monster-level').textContent = 'Lv.' + level;
    const size = Math.min(120 + level * 1.5, 240);
    const hue = (level * 13) % 360;
    const img = $id('monster-img');
    img.style.width = size + 'px';
    img.style.height = size + 'px';
    img.style.filter = 'hue-rotate(' + hue + 'deg) drop-shadow(0 10px 16px rgba(15,23,42,.15))';
  }
  if (c.pct !== pct) {
    c.pct = pct;
    $id('monster-hp').style.width = pct + '%';
  }
  if (c.leftTxt !== leftTxt) {
    c.leftTxt = leftTxt;
    $id('monster-left').textContent = leftTxt;
  }
  renderTopbar();
}

function chipHTML(label, id, count, total, active) {
  return '<button class="chip' + (active ? ' active' : '') + '" data-filter="' + id + '">' + label + (total > 0 ? ' <span class="chip-count">' + count + '/' + total + '</span>' : '') + '</button>';
}

function rarityFilterHTML(el, current, countFn) {
  const chips = [chipHTML('全部', 'all', countFn('all').count, countFn('all').total, current === 'all')];
  RARITY_LIST.forEach(r => {
    const k = r.id;
    const c = countFn(k);
    chips.push(chipHTML(r.name, k, c.count, c.total, current === k));
  });
  el.innerHTML = chips.join('');
}

function setInnerHTML(el, html) { if (el.innerHTML !== html) el.innerHTML = html; }

function chipGroup(label, attr, items, current) {
  return '<span class="sort-label">' + label + '</span>' + items.map(it =>
    '<button class="chip' + (current === it[0] ? ' active' : '') + '" data-' + attr + '="' + it[0] + '">' + it[1] + '</button>'
  ).join('');
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function rangeRowHTML(prefix, pMin, pMax, query) {
  return '<span class="sort-label">战力区间</span>' +
    '<input class="num-input" id="' + prefix + '-pmin" type="number" placeholder="最小" value="' + esc(pMin) + '">' +
    '<span class="range-sep">~</span>' +
    '<input class="num-input" id="' + prefix + '-pmax" type="number" placeholder="最大" value="' + esc(pMax) + '">' +
    '<span class="sort-label">搜索</span>' +
    '<input class="search-input" id="' + prefix + '-search" type="text" placeholder="输入卡名…" value="' + esc(query) + '">';
}

function keepFocus(focus) {
  if (!focus) return;
  const el = $id(focus.id);
  if (el) {
    el.focus();
    if (focus.sel != null) {
      const v = el.value;
      try { el.setSelectionRange(Math.min(focus.sel, v.length), Math.min(focus.sel, v.length)); } catch (e) { }
    }
  }
}

function captureFocus() {
  const ae = document.activeElement;
  if (ae && ae.id && (ae.type === 'number' || ae.type === 'text') && ae.id.indexOf('-') >= 0) {
    return { id: ae.id, sel: ae.selectionStart };
  }
  return null;
}

function passesFilters(c, f) {
  const owned = (S.owned[c.id] || 0) > 0;
  if (f.owned === 'owned' && !owned) return false;
  if (f.owned === 'missing' && owned) return false;
  const ready = formationComplete(c.id);
  if (f.complete === 'ready' && !ready) return false;
  if (f.complete === 'no' && ready) return false;
  const p = formationPowerOf(c.id);
  if (f.pMin !== '' && p < +f.pMin) return false;
  if (f.pMax !== '' && p > +f.pMax) return false;
  if (f.query && effName(c).indexOf(f.query) < 0) return false;
  return true;
}

function countOwned(rarityId) {
  const pool = rarityId === 'all'
    ? CARDS.filter(c => !c.hidden)
    : CARDS.filter(c => !c.hidden && effRarity(c) === rarityId);
  let count = 0;
  pool.forEach(c => { if ((S.owned[c.id] || 0) > 0) count++; });
  return { count: count, total: pool.length };
}

function sortedCards(pool, sort) {
  const dir = sort.dir;
  const val = c => {
    switch (sort.key) {
      case 'rarity': return RARITIES[effRarity(c)].order;
      case 'power': return basePowerOf(c);
      case 'fp': return formationPowerOf(c.id);
      case 'count': return S.owned[c.id] || 0;
      case 'got': return S.ownedAt[c.id] || 0;
      default: return c.no;
    }
  };
  return pool.slice().sort((a, b) => (val(a) - val(b)) * dir || (a.no - b.no) * dir);
}

function renderSortBar(el, sort, withCount) {
  const opts = withCount
    ? [['no', '编号'], ['rarity', '稀有度'], ['power', '战力'], ['fp', '编队战力'], ['count', '持有数'], ['got', '获得时间']]
    : [['no', '编号'], ['rarity', '稀有度'], ['power', '战力'], ['fp', '编队战力']];
  const chips = opts.map(o =>
    '<button class="chip' + (sort.key === o[0] ? ' active' : '') + '" data-sort="' + o[0] + '">' + o[1] + '</button>'
  ).join('');
  const html = '<span class="sort-label">排序</span>' + chips +
    '<button class="chip dir" data-dir="1">' + (sort.dir === 1 ? '↑ 升序' : '↓ 降序') + '</button>';
  if (el.innerHTML !== html) el.innerHTML = html;
}

function bindSortRow(el, sort, rerender) {
  el.addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    if (chip.dataset.sort) sort.key = chip.dataset.sort;
    else sort.dir *= -1;
    rerender();
  });
}

function updateGrid(el, htmls) {
  const html = htmls.join('');
  const kids = el.children ? Array.from(el.children) : null;
  if (!kids || kids.length === 0 && html !== '') {
    el.innerHTML = html;
    return;
  }
  if (!el.insertAdjacentHTML) {
    el.innerHTML = html;
    return;
  }
  for (let i = 0; i < htmls.length; i++) {
    const kid = kids[i];
    if (!kid) { el.insertAdjacentHTML('beforeend', htmls[i]); continue; }
    if (kid.outerHTML !== htmls[i]) kid.outerHTML = htmls[i];
  }
  while (el.children.length > htmls.length) el.lastChild.remove();
}

function renderCodex() {
  const focus = captureFocus();
  rarityFilterHTML($id('codex-filters'), codexFilter, countOwned);
  setInnerHTML($id('codex-state-filters'),
    chipGroup('获得', 'own', [['all', '全部'], ['owned', '已获得'], ['missing', '未获得']], codexOwned) +
    chipGroup('编队', 'cpl', [['all', '全部'], ['ready', '可出战'], ['no', '未集齐']], codexComplete));
  setInnerHTML($id('codex-range-filters'), rangeRowHTML('codex', codexPowerMin, codexPowerMax, codexQuery));
  const owned = countOwned('all');
  const pct = owned.total ? Math.round(owned.count / owned.total * 100) : 0;
  $id('codex-head').innerHTML = '<div class="codex-progress"><span>收集 ' + owned.count + ' / ' + owned.total + '（' + pct + '%）</span><div class="bar"><div class="bar-fill" style="width:' + pct + '%"></div></div></div>';
  const pool = sortedCards(CARDS.filter(c =>
    !c.hidden &&
    (codexFilter === 'all' || effRarity(c) === codexFilter) &&
    passesFilters(c, { owned: codexOwned, complete: codexComplete, pMin: codexPowerMin, pMax: codexPowerMax, query: codexQuery })
  ), codexSort);
  renderSortBar($id('codex-sorts'), codexSort, false);
  if (!pool.length) {
    $id('codex-grid').innerHTML = '<div class="log-empty">没有符合条件的卡片</div>';
    return;
  }
  updateGrid($id('codex-grid'), pool.map(c => {
    const ownedCount = S.owned[c.id] || 0;
    const locked = ownedCount === 0;
    const mystery = locked && RARITIES[effRarity(c)].order >= 4;
    return '<button class="codex-cell ' + frameClass(c) + '" data-view="' + c.id + '"' + (mystery ? ' data-mystery="1"' : '') + '>' +
      '<div class="frame-inner' + (locked ? ' locked' : '') + '">' +
      '<div class="cell-art">' + (mystery ? '<div class="emoji-art">?</div>' : artHTML(c)) + '</div>' +
      '<div class="cell-no">' + (mystery ? '' : 'NO.' + c.no) + '</div>' +
      '<div class="cell-name">' + (mystery ? '???' : effName(c)) + '</div>' +
      (locked ? '<div class="cell-lock">未获得</div>' : '<div class="cell-count">×' + ownedCount + '</div>') +
      '</div></button>';
  }));
  keepFocus(focus);
}

function renderBackpack() {
  const focus = captureFocus();
  rarityFilterHTML($id('bag-filters'), bagFilter, countOwned);
  setInnerHTML($id('bag-state-filters'),
    chipGroup('编队', 'cpl', [['all', '全部'], ['ready', '可出战'], ['no', '未集齐']], bagComplete));
  setInnerHTML($id('bag-range-filters'), rangeRowHTML('bag', bagPowerMin, bagPowerMax, bagQuery));
  const pool = sortedCards(CARDS.filter(c =>
    !c.hidden &&
    (S.owned[c.id] || 0) > 0 &&
    (bagFilter === 'all' || effRarity(c) === bagFilter) &&
    passesFilters(c, { complete: bagComplete, pMin: bagPowerMin, pMax: bagPowerMax, query: bagQuery })
  ), bagSort);
  renderSortBar($id('bag-sorts'), bagSort, true);
  if (!pool.length) {
    $id('bag-list').innerHTML = '<div class="log-empty">没有符合筛选的卡片</div>';
    return;
  }
  updateGrid($id('bag-list'), pool.map(c => {
    const count = S.owned[c.id];
    const active = S.activeCenter === c.id;
    return '<div class="bag-row ' + frameClass(c) + '">' +
      '<div class="frame-inner bag-inner">' +
      '<div class="bag-art" data-view="' + c.id + '">' + artHTML(c) + '</div>' +
      '<div class="bag-info">' +
      '<div class="bag-title">NO.' + c.no + ' ' + effName(c) + ' ' + rarityTagHTML(effRarity(c)) + (active ? '<span class="active-tag">出战</span>' : '') + '</div>' +
      '<div class="bag-sub">持有 ×' + count + ' · 基础战力 ' + basePowerOf(c) + ' · 重复转化 ' + RARITIES[effRarity(c)].frag + ' 碎片</div>' +
      '<div class="bag-formation">' + formationLineHTML(c.id) + '</div>' +
      '</div>' +
      '<div class="bag-actions">' +
      '<button class="btn ' + (active ? 'ghost' : 'primary') + '" data-set-active="' + c.id + '">' + (active ? '当前出战' : '设为出战') + '</button>' +
      '<button class="btn" data-view="' + c.id + '">观赏</button>' +
      '</div>' +
      '</div></div>';
  }));
  keepFocus(focus);
}

let achFilter = 'all';

function achievementCardHTML(cfg) {
  const isDone = !!S.achievements[cfg.id];
  const secret = !isDone;
  const p = achievementProgress(cfg);
  const pct = Math.min(100, Math.max(0, Math.round(p.cur / p.goal * 100)));
  const name = secret ? '？？？' : cfg.name;
  const desc = secret ? '？？？' : cfg.desc;
  const reward = secret ? '？？？' : '+' + cfg.reward.toLocaleString() + ' 碎片';
  const bar = secret
    ? '<div class="ach-bar"><div class="ach-bar-fill" style="width:0%"></div></div><div class="ach-foot">？？？</div>'
    : '<div class="ach-bar"><div class="ach-bar-fill" style="width:' + pct + '%"></div></div><div class="ach-foot">' + p.cur.toLocaleString() + ' / ' + p.goal.toLocaleString() + '</div>';
  const badge = isDone
    ? '<span class="ach-badge done">✓ 达成' + (S.achievements[cfg.id] ? ' · ' + new Date(S.achievements[cfg.id]).toLocaleString() : '') + '</span>'
    : '<span class="ach-badge">未达成</span>';
  return '<div class="ach-card' + (isDone ? ' done' : '') + (secret ? ' secret' : '') + '">' +
    '<div class="ach-top"><span class="ach-name">' + name + '</span><span class="ach-reward">' + reward + '</span></div>' +
    '<div class="ach-desc">' + desc + '</div>' + bar +
    '<div class="ach-badge-row">' + badge + '</div></div>';
}

function renderAchievements() {
  const head = $id('ach-head');
  const fl = $id('ach-filters');
  const grid = $id('ach-grid');
  if (!head || !fl || !grid) return;
  const list = CONFIG.ACHIEVEMENTS || [];
  const done = list.filter(c => S.achievements[c.id]).length;
  const totalReward = list.reduce((a, c) => a + c.reward, 0);
  const pct = list.length ? Math.round(done / list.length * 100) : 0;
  head.innerHTML = '<div class="codex-progress"><span>成就 ' + done + ' / ' + list.length + '（' + pct + '%）· 全部奖励碎片合计 ' + totalReward.toLocaleString() + '</span><div class="bar"><div class="bar-fill" style="width:' + pct + '%"></div></div></div>';
  fl.innerHTML = chipGroup('状态', 'achf', [['all', '全部'], ['done', '已达成'], ['todo', '未达成']], achFilter);
  const pool = list.filter(c => achFilter === 'all' ? true : achFilter === 'done' ? !!S.achievements[c.id] : !S.achievements[c.id]);
  if (!pool.length) { grid.innerHTML = '<div class="log-empty">没有符合条件的成就</div>'; return; }
  updateGrid(grid, pool.map(achievementCardHTML));
}

let pickerSlot = null;

function nestName(i) { return ['一号窝', '二号窝', '三号窝', '四号窝'][i] || ('窝 ' + (i + 1)); }

function openNestPicker(target) {
  pickerSlot = target;
  const n = allNests()[target.idx];
  const picker = $id('nest-picker');
  if (!picker || !n) return;
  const inAnyNest = id => allNests().some(nn => nn.a === id || nn.b === id);
  const list = CARDS.filter(c =>
    !c.hidden && !isEggCard(c) && (S.owned[c.id] || 0) > 0 && c.id !== S.activeCenter
  );
  const other = target.slot === 'a' ? n.b : n.a;
  $id('nest-picker-title').textContent = nestName(target.idx) + ' · 选择卡片';
  $id('nest-picker-list').innerHTML = list.map(c => {
    const busy = inAnyNest(c.id) && c.id !== other;
    const disabled = c.id === other || busy;
    const tag = c.id === other
      ? '<span class="r-tag">已在本窝</span>'
      : busy ? '<span class="r-tag">已在别的窝</span>'
        : '<span class="r-tag r-' + effRarity(c) + '">' + RARITIES[effRarity(c)].name + '</span>';
    return '<div class="nest-pick-row' + (disabled ? ' disabled' : '') + '" data-pick="' + c.id + '">' +
      '<span class="nest-pick-name">' + effName(c) + '</span>' + tag +
      '<span class="nest-pick-count">持有 ×' + S.owned[c.id] + '</span>' +
      '</div>';
  }).join('');
  picker.classList.remove('hidden');
}

function closeNestPicker() {
  const picker = $id('nest-picker');
  if (picker) picker.classList.add('hidden');
  pickerSlot = null;
}

function slotCardHTML(cardId) {
  const c = CARD_MAP[cardId];
  if (!c) return '<span class="nest-placeholder">点击放入</span>';
  return '<div class="nest-card">' +
    '<div class="nest-card-art">' + artHTML(c) + '</div>' +
    '<div class="nest-card-info">' +
    '<div class="nest-card-name">' + effName(c) + '</div>' +
    '<span class="r-tag r-' + effRarity(c) + '">' + RARITIES[effRarity(c)].name + '</span>' +
    '</div>' +
    '<button class="btn nest-remove" data-remove="1">移除</button>' +
    '</div>';
}

function nestBlockHTML(idx, n) {
  const htmlA = n.a ? slotCardHTML(n.a) : '<span class="nest-placeholder">点击放入</span>';
  const htmlB = n.b ? slotCardHTML(n.b) : '<span class="nest-placeholder">点击放入</span>';
  let stText, eggHTML, actionsHTML = '';
  if (!n.a && !n.b) {
    stText = '未开始：放入两张卡片开始生蛋';
    eggHTML = '';
  } else if (!n.a || !n.b) {
    stText = '未开始：再放一张卡片开始生蛋';
    eggHTML = '';
  } else if (n.ready) {
    stText = '蛋生好了！';
    eggHTML = '<div class="nest-egg-box"><span>🥚</span><div class="nest-egg-title">蛋生好了，随时可以开启</div>' +
      '<button class="btn primary" data-hatch="' + idx + '">开启</button></div>';
  } else {
    stText = '孵化中…（时长随机 15 分钟 ~ 2 小时，具体时间保密）';
    const left = CONFIG.SHOP.SPEEDUP_MAX - (n.speedups || 0);
    actionsHTML = '<div class="nest-actions">' +
      '<button class="btn btn-sm" data-speedup="' + idx + '"' + (left <= 0 ? ' disabled' : '') + '>加速生蛋 ' + fmtFrag(CONFIG.SHOP.SPEEDUP_COST) + ' 碎片</button>' +
      '<span class="nest-action-note">剩余时间 −25%，本周期还能加速 ' + left + ' 次</span></div>';
    eggHTML = '';
  }
  return '<div class="panel nest-block">' +
    '<h3>' + nestName(idx) + '</h3>' +
    '<div class="nest-slots">' +
    '<div class="nest-slot" data-nidx="' + idx + '" data-nslot="a">' + htmlA + '</div>' +
    '<div class="nest-x">×</div>' +
    '<div class="nest-slot" data-nidx="' + idx + '" data-nslot="b">' + htmlB + '</div>' +
    '</div>' +
    '<div class="nest-status">' + stText + '</div>' +
    actionsHTML +
    '<div class="nest-egg">' + eggHTML + '</div>' +
    '</div>';
}

function renderHome() {
  const wrap = $id('nest-list');
  if (!wrap || !S.homeNest) return;
  const nests = allNests();
  let html = '';
  for (let i = 0; i < nests.length; i++) html += nestBlockHTML(i, nests[i]);
  for (let j = nests.length - 1; j < CONFIG.SHOP.NEST_SLOT_COSTS.length; j++) {
    html += '<div class="panel nest-block locked">' +
      '<h3>' + nestName(j + 1) + '</h3>' +
      '<p class="nest-locked-tip">在商店花 ' + fmtFrag(CONFIG.SHOP.NEST_SLOT_COSTS[j]) + ' 碎片扩建后解锁。</p>' +
      '</div>';
  }
  if (wrap.innerHTML !== html) wrap.innerHTML = html;
}

function fmtFrag(n) {
  n = Math.round(n);
  if (n >= 1e8) return (Math.round(n / 1e8 * 100) / 100) + ' 亿';
  if (n >= 1e4) return Math.round(n / 1e4).toLocaleString() + ' 万';
  return n.toLocaleString();
}

const SHOP_ITEMS = [
  { key: 'pity-purple', name: '紫卡保底券', tier: 'purple',
    desc: '每一抽自动消耗一张，那一抽必出<b>紫卡</b>及以上；生蛋不生效。',
    meta: () => '持有 ' + (S.pityStock.purple || 0) + ' 张',
    cost: () => pityCost('purple'), can: () => true },
  { key: 'pity-gold', name: '金卡保底券', tier: 'gold',
    desc: '每一抽自动消耗一张，那一抽必出<b>金卡</b>及以上；生蛋不生效。',
    meta: () => '持有 ' + (S.pityStock.gold || 0) + ' 张',
    cost: () => pityCost('gold'), can: () => true },
  { key: 'pity-black', name: '黑卡保底券', tier: 'black',
    desc: '每一抽自动消耗一张，那一抽必出<b>黑卡</b>及以上；生蛋不生效。',
    meta: () => '持有 ' + (S.pityStock.black || 0) + ' 张',
    cost: () => pityCost('black'), can: () => true },
  { key: 'nest-slot', name: '扩建窝位', tier: null,
    desc: '再造一个窝同时生蛋。',
    meta: () => '已建 ' + (S.extraNests || []).length + ' / 3 个',
    cost: () => { const n = (S.extraNests || []).length; return n >= 3 ? Infinity : CONFIG.SHOP.NEST_SLOT_COSTS[n]; }, can: () => true },
  { key: 'cosmetic-frame', name: '毕业纪念框', tier: null,
    desc: '全图鉴永久镀金边，包括还没抽到的卡。',
    meta: () => S.cosmetics && S.cosmetics.gradFrame ? '已拥有' : '一次性购买',
    cost: () => CONFIG.SHOP.COSMETIC_FRAME_COST, can: () => !(S.cosmetics && S.cosmetics.gradFrame) },
];

function renderShop() {
  const list = $id('shop-list');
  if (!list) return;
  list.innerHTML = SHOP_ITEMS.map(it => {
    const cost = it.cost();
    const soldOut = cost === Infinity;
    const owned = !it.can();
    const afford = S.fragments >= cost;
    const btn = soldOut || owned
      ? '<button class="btn" disabled>' + (soldOut ? '已售罄' : '已拥有') + '</button>'
      : '<button class="btn primary' + (afford ? '' : ' dim') + '" data-buy="' + it.key + '">' + fmtFrag(cost) + ' 碎片</button>';
    const desc = typeof it.desc === 'function' ? it.desc() : it.desc;
    return '<div class="shop-row">' +
      '<div class="shop-info"><b>' + it.name + '</b>' +
      (it.tier ? rarityTagHTML(it.tier) : '') +
      '<span class="shop-desc">' + desc + '</span>' +
      '<span class="shop-meta">' + it.meta() + '</span></div>' +
      '<div class="shop-buy">' + btn + '</div>' +
      '</div>';
  }).join('');
}

function renderSettings() {
  const b = $id('btn-art-mode');
  if (b) b.textContent = S.artMode === 'emoji' ? '切换到 AI 立绘卡面' : '切换到 emoji 卡面';
  const rows = RARITY_LIST.map(r =>
    '<tr><td><span class="rate-name rn-' + r.id + '"><span class="r-dot r-' + r.id + '"></span>' + r.name + '</span></td>' +
    '<td>' + fmtRate(ratePct(r)) + '</td>' +
    '<td>' + r.basePower + '</td>' +
    '<td>' + r.frag + '</td></tr>'
  ).join('');
  $id('settings-rates').innerHTML =
    '<div class="formula">当前版本 <b>v' + CONFIG.VERSION + '</b></div>' +
    '<div class="formula">战力 = Σ 已拥有成员基础战力 ×（1 + 0.2×(n−1) + 0.05×(n−1)²），n = 已拥有成员数。编队未集齐时按已有成员出战。</div>' +
    '<div class="formula">战斗间隔 = 10s ×（初始蛋队 19.5 战力 / 当前战力）^0.4956，最短 0.005s。编队越强抽得越快。</div>' +
    '<div class="formula">重复卡片自动转碎片：白 1 / 绿 2；蓝及以上 = 该稀有度期望抽数 × 0.65。10 碎片 = 1 抽，平均每抽回本约一半。</div>' +
    '<div class="formula">离线收益：关闭页面或切走标签页期间，按线上抽卡速度的 1/3 折算为碎片，最多累计 ' + CONFIG.OFFLINE_CAP_HOURS + ' 小时，回到页面自动入账。点击怪物每次缩短下一抽 0.5 秒。</div>' +
    '<table class="rate-table"><thead><tr><th>稀有度</th><th>单抽概率</th><th>基础战力</th><th>重复→碎片</th></tr></thead><tbody>' + rows + '</tbody></table>';
}

let heavyRenderAt = 0;
let heavyPending = false;
function renderHeavy() {
  if (currentTab === 'codex') renderCodex();
  else if (currentTab === 'backpack') renderBackpack();
  else if (currentTab === 'achievements') renderAchievements();
  else if (currentTab === 'home') renderHome();
  else if (currentTab === 'shop') renderShop();
  else if (currentTab === 'settings') renderSettings();
}
function renderAll() {
  if (!S) return;
  renderTopbar();
  renderBattle();
  if (currentTab === 'codex' || currentTab === 'backpack' || currentTab === 'achievements' || currentTab === 'home' || currentTab === 'shop' || currentTab === 'settings') {
    const now = Date.now();
    if (now - heavyRenderAt >= 1200) {
      heavyRenderAt = now;
      renderHeavy();
    } else if (!heavyPending) {
      heavyPending = true;
      setTimeout(() => {
        heavyPending = false;
        heavyRenderAt = Date.now();
        renderHeavy();
      }, 1200);
    }
  }
}

let vRotX = -15, vRotY = 0, vScale = 1, vDragging = false, vtx = 0, vty = 0;

function initViewer() {
  const stage = $id('viewer-stage');
  const card = $id('viewer-card');
  stage.addEventListener('dragstart', e => e.preventDefault());
  stage.addEventListener('pointerdown', e => {
    vDragging = true;
    vtx = e.clientX;
    vty = e.clientY;
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', e => {
    if (!vDragging) return;
    const dx = e.clientX - vtx, dy = e.clientY - vty;
    vtx = e.clientX;
    vty = e.clientY;
    vRotY += dx * 0.6;
    vRotX += dy * 0.6;
    vRotX = Math.max(-90, Math.min(90, vRotX));
  });
  const stop = () => { vDragging = false; };
  stage.addEventListener('pointerup', stop);
  stage.addEventListener('pointercancel', stop);
  stage.addEventListener('wheel', e => {
    e.preventDefault();
    vScale = Math.max(0.5, Math.min(2.5, vScale + (e.deltaY < 0 ? 0.1 : -0.1)));
  }, { passive: false });
  stage.addEventListener('dblclick', () => { vRotX = -15; vRotY = 0; vScale = 1; });
  $id('viewer-close').addEventListener('click', closeViewer);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeViewer(); });
  requestAnimationFrame(vloop);
}

function vloop() {
  if (viewerOpen && !vDragging) vRotY += 14 * 0.016;
  $id('viewer-card').style.transform = 'rotateX(' + vRotX + 'deg) rotateY(' + vRotY + 'deg) scale(' + vScale + ')';
  requestAnimationFrame(vloop);
}

function openViewer(cardId) {
  const c = CARD_MAP[cardId];
  if (!c) return;
  vRotX = -15;
  vRotY = 0;
  vScale = 1;
  $id('vfront').innerHTML = frontHTML(c);
  $id('vback').innerHTML = backHTML(c);
  $id('vfront-wrap').className = 'vface-wrap ' + frameClass(c);
  $id('vback-wrap').className = 'vface-wrap vback-wrap ' + frameClass(c);
  $id('viewer').classList.remove('hidden');
  viewerOpen = true;
  document.body.style.overflow = 'hidden';
}

function closeViewer() {
  $id('viewer').classList.add('hidden');
  viewerOpen = false;
  document.body.style.overflow = '';
}

function frontHTML(c) {
  return     '<div class="v-art">' + artHTML(c, true) + '</div>' +
    '<div class="v-no">NO.' + c.no + '</div>' +
    '<div class="v-name">' + effName(c) + '</div>' +
    rarityTagHTML(effRarity(c)) +
    '<div class="v-line">基础战力 <b>' + basePowerOf(c) + '</b></div>' +
    '<div class="v-line">编队 ' + (1 + c.formation.length) + ' 张' + (c.formation.length ? '' : ' · 独行') + '</div>';
}

function backHTML(c) {
  const owned = (S.owned[c.id] || 0) > 0;
  const complete = formationComplete(c.id);
  const members = formationCardsOf(c.id).map(cm => {
    const has = (S.owned[cm.id] || 0) > 0;
    return '<span class="v-mem ' + (has ? 'ok' : 'miss') + '">' +
      '<span class="r-dot r-' + effRarity(cm) + '"></span>' +
      '<span class="rn-' + effRarity(cm) + '">' + effName(cm) + '</span>' +
      (cm.id === c.id ? '（中心）' : '') +
      (has ? '' : ' ✗') +
      '</span>';
  }).join('');
  return '<div class="v-sec">掉落概率 <b>' + (c.id === 'egg-rainbow' ? (isEggUpgraded() ? fmtRate(CONFIG.SECRET_EGG_RATE * 100) : '0%') : fmtRate(ratePct(RARITIES[effRarity(c)]))) + '</b></div>' +
    '<div class="v-sec">重复获得 → 碎片 +' + RARITIES[effRarity(c)].frag + '</div>' +
    '<div class="v-sec">战力：单独 ' + basePowerOf(c) +
    (c.formation.length ? ' / 编队 ' + Math.round(formationPowerOf(c.id)) + (complete ? '' : '（未集齐）') : '') + '</div>' +
    '<div class="v-sec-title">编队成员（共 ' + (1 + c.formation.length) + ' 张）</div>' +
    '<div class="v-mems">' + members + '</div>' +
    '<div class="v-desc">' + effDesc(c) + '</div>' +
    '<div class="v-flavor">「' + c.flavor + '」</div>' +
    (owned ? '' : '<div class="v-unowned">尚未获得</div>');
}
