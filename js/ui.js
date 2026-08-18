let currentTab = 'battle';
let codexFilter = 'all';
let bagFilter = 'all';
let codexSort = { key: 'no', dir: 1 };
let bagSort = { key: 'no', dir: 1 };
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

function frameClass(card) { return 'frame frame-' + card.rarity; }

function rarityTagHTML(r) { return '<span class="r-tag r-' + r + '">' + RARITIES[r].name + '</span>'; }

function eggStyle(card) {
  const cols = card.art.colors;
  if (cols === 'rainbow') {
    return "background: conic-gradient(from 0deg, #f43f5e, #f59e0b, #84cc16, #22c55e, #0ea5e9, #8b5cf6, #f43f5e); animation: egg-spin 8s linear infinite;";
  }
  return "background: radial-gradient(circle at 35% 28%, " + cols[0] + " 0%, " + cols[1] + " 78%);";
}

function artHTML(card) {
  if (PNG_READY.has(card.id)) {
    return '<img class="art-img" src="img/cards/' + card.id + '.png" alt="">';
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

function onReward(res) {
  const order = res.r.order;
  if (res.isNew || order >= 3) {
    const tag = res.isNew ? '<b>新卡！</b>' : '';
    toast(tag + rarityTagHTML(res.r.id) + ' · ' + res.card.name, 'rc-' + res.r.id, 4500);
  } else {
    toast(res.card.name + (res.frag ? ' +' + res.frag + ' 碎片' : ''), 'rc-' + res.r.id, 3000);
  }
  renderAll();
}

function renderTopbar() {
  $id('ts-power').textContent = Math.round(activePower());
  $id('ts-interval').textContent = battleInterval().toFixed(1) + 's';
  $id('ts-frag').textContent = S.fragments;
  $id('ts-kills').textContent = S.kills;
  const btn = $id('btn-spend-all-frag');
  const draws = Math.floor(S.fragments / CONFIG.FRAG_COST_PER_DRAW);
  btn.textContent = '用全部碎片抽卡（' + S.fragments + ' 碎片 → ' + draws + ' 抽）';
  btn.disabled = draws < 1;
}

function miniCardHTML(card, isCenter) {
  return '<div class="mini-card' + (isCenter ? ' center' : '') + ' ' + frameClass(card) + '">' +
    '<div class="frame-inner"><div class="mini-art">' + artHTML(card) + '</div>' +
    '<div class="mini-name">' + card.name + '</div></div></div>';
}

function battleRowHTML() {
  const c = CARD_MAP[S.activeCenter];
  const complete = formationComplete(S.activeCenter);
  if (!complete) return miniCardHTML(c, true);
  const members = c.formation.map(f => CARD_MAP[f]);
  const n = members.length + 1;
  const centerIdx = Math.floor(n / 2);
  const left = members.slice(0, centerIdx);
  const right = members.slice(centerIdx);
  return left.map(m => miniCardHTML(m, false)).join('') +
    miniCardHTML(c, true) +
    right.map(m => miniCardHTML(m, false)).join('');
}

function formationLineHTML(cardId) {
  const c = CARD_MAP[cardId];
  if (!c.formation.length) return '独行编队 · 战力 ' + Math.round(basePowerOf(c));
  const complete = formationComplete(cardId);
  if (complete) return '<span class="ok-text">编队已集齐（' + (1 + c.formation.length) + ' 张）· 编队战力 ' + Math.round(formationPowerOf(cardId)) + '</span>';
  const miss = c.formation.filter(f => (S.owned[f] || 0) === 0).map(f => CARD_MAP[f].name);
  return '<span class="miss-text">编队未集齐 · 缺少：' + miss.join('、') + '</span>';
}

function renderBattle() {
  $id('battle-row').innerHTML = battleRowHTML();
  const c = CARD_MAP[S.activeCenter];
  const complete = formationComplete(S.activeCenter);
  $id('row-caption').textContent = (complete ? '出战编队' : '单独出战') + ' · 中心 ' + c.name + ' · 共 ' + (complete ? formationCardsOf(S.activeCenter).length : 1) + ' 张';
  $id('formation-info').innerHTML = formationInfoHTML();
  $id('rate-panel').innerHTML = rateRowsHTML();
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
    return '<div class="frow ' + (has ? 'ok' : 'miss') + '">' + (has ? '✓' : '✗') + ' ' + cm.name + (isSelf ? '（中心）' : '') + ' · 基础战力 ' + basePowerOf(cm) + '</div>';
  }).join('');
  return '<div class="fhead">' + CARD_MAP[S.activeCenter].name + ' ' + rarityTagHTML(CARD_MAP[S.activeCenter].rarity) + '</div>' +
    '<div class="fbody">' + rows + '</div>' +
    '<div class="fnote">' + (complete ? '编队战力 ' + Math.round(formationPowerOf(S.activeCenter)) : '编队未集齐，单独出战（战力 ' + Math.round(basePowerOf(CARD_MAP[S.activeCenter])) + '）') + ' · 战斗间隔 ' + battleInterval().toFixed(1) + 's</div>';
}

function rateRowsHTML() {
  return RARITY_LIST.map(r =>
    '<div class="rate-row"><span class="r-dot r-' + r.id + '"></span><span>' + r.name + '</span><b>' + fmtRate(r.weight) + '</b></div>'
  ).join('');
}

function renderLog() {
  const wrap = $id('battle-log');
  if (!S.log.length) {
    wrap.innerHTML = '<div class="log-empty">还没有战利品记录</div>';
    return;
  }
  wrap.innerHTML = S.log.map(e => {
    const c = CARD_MAP[e.cardId];
    const t = new Date(e.t).toLocaleTimeString('zh-CN', { hour12: false });
    return '<div class="log-entry"><span class="log-time">' + t + '</span>' +
      '<span class="r-dot r-' + c.rarity + '"></span>' +
      '<span>' + c.name + '</span>' +
      (e.isNew ? '<span class="ok-text">新卡</span>' : '<span class="miss-text">+' + e.frag + ' 碎片</span>') + '</div>';
  }).join('');
}

function updateBattle() {
  const maxHp = monsterMaxHp();
  const pct = Math.max(0, Math.min(100, monsterHp / maxHp * 100));
  $id('monster-hp').style.width = pct + '%';
  $id('monster-level').textContent = 'Lv.' + S.monsterLevel;
  const size = Math.min(120 + S.monsterLevel * 1.5, 240);
  const hue = (S.monsterLevel * 13) % 360;
  const img = $id('monster-img');
  img.style.width = size + 'px';
  img.style.height = size + 'px';
  img.style.filter = 'hue-rotate(' + hue + 'deg) drop-shadow(0 10px 16px rgba(15,23,42,.15))';
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

function countOwned(rarityId) {
  const pool = rarityId === 'all' ? CARDS : CARDS.filter(c => c.rarity === rarityId);
  let count = 0;
  pool.forEach(c => { if ((S.owned[c.id] || 0) > 0) count++; });
  return { count: count, total: pool.length };
}

function sortedCards(pool, sort) {
  const dir = sort.dir;
  const val = c => {
    switch (sort.key) {
      case 'rarity': return RARITIES[c.rarity].order;
      case 'power': return basePowerOf(c);
      case 'fp': return formationPowerOf(c.id);
      case 'count': return S.owned[c.id] || 0;
      default: return c.no;
    }
  };
  return pool.slice().sort((a, b) => (val(a) - val(b)) * dir || (a.no - b.no) * dir);
}

function renderSortBar(el, sort, withCount) {
  const opts = withCount
    ? [['no', '编号'], ['rarity', '稀有度'], ['power', '战力'], ['fp', '编队战力'], ['count', '持有数']]
    : [['no', '编号'], ['rarity', '稀有度'], ['power', '战力'], ['fp', '编队战力']];
  const chips = opts.map(o =>
    '<button class="chip' + (sort.key === o[0] ? ' active' : '') + '" data-sort="' + o[0] + '">' + o[1] + '</button>'
  ).join('');
  el.innerHTML = '<span class="sort-label">排序</span>' + chips +
    '<button class="chip dir" data-dir="1">' + (sort.dir === 1 ? '↑ 升序' : '↓ 降序') + '</button>';
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

function renderCodex() {
  rarityFilterHTML($id('codex-filters'), codexFilter, countOwned);
  const owned = countOwned('all');
  const pct = owned.total ? Math.round(owned.count / owned.total * 100) : 0;
  $id('codex-head').innerHTML = '<div class="codex-progress"><span>收集 ' + owned.count + ' / ' + owned.total + '（' + pct + '%）</span><div class="bar"><div class="bar-fill" style="width:' + pct + '%"></div></div></div>';
  const pool = sortedCards(CARDS.filter(c => codexFilter === 'all' || c.rarity === codexFilter), codexSort);
  renderSortBar($id('codex-sorts'), codexSort, false);
  $id('codex-grid').innerHTML = pool.map(c => {
    const ownedCount = S.owned[c.id] || 0;
    const locked = ownedCount === 0;
    const mystery = locked && RARITIES[c.rarity].order >= 4;
    return '<button class="codex-cell ' + frameClass(c) + '" data-view="' + c.id + '"' + (mystery ? ' data-mystery="1"' : '') + '>' +
      '<div class="frame-inner' + (locked ? ' locked' : '') + '">' +
      '<div class="cell-art">' + (mystery ? '<div class="emoji-art">?</div>' : artHTML(c)) + '</div>' +
      '<div class="cell-no">' + (mystery ? '' : 'NO.' + c.no) + '</div>' +
      '<div class="cell-name">' + (mystery ? '???' : c.name) + '</div>' +
      (locked ? '<div class="cell-lock">未获得</div>' : '<div class="cell-count">×' + ownedCount + '</div>') +
      '</div></button>';
  }).join('');
}

function renderBackpack() {
  rarityFilterHTML($id('bag-filters'), bagFilter, countOwned);
  const pool = sortedCards(CARDS.filter(c => (S.owned[c.id] || 0) > 0 && (bagFilter === 'all' || c.rarity === bagFilter)), bagSort);
  renderSortBar($id('bag-sorts'), bagSort, true);
  if (!pool.length) {
    $id('bag-list').innerHTML = '<div class="log-empty">背包空空如也</div>';
    return;
  }
  $id('bag-list').innerHTML = pool.map(c => {
    const count = S.owned[c.id];
    const active = S.activeCenter === c.id;
    return '<div class="bag-row ' + frameClass(c) + '">' +
      '<div class="frame-inner bag-inner">' +
      '<div class="bag-art" data-view="' + c.id + '">' + artHTML(c) + '</div>' +
      '<div class="bag-info">' +
      '<div class="bag-title">NO.' + c.no + ' ' + c.name + ' ' + rarityTagHTML(c.rarity) + (active ? '<span class="active-tag">出战</span>' : '') + '</div>' +
      '<div class="bag-sub">持有 ×' + count + ' · 基础战力 ' + basePowerOf(c) + ' · 重复转化 ' + RARITIES[c.rarity].frag + ' 碎片</div>' +
      '<div class="bag-formation">' + formationLineHTML(c.id) + '</div>' +
      '</div>' +
      '<div class="bag-actions">' +
      '<button class="btn ' + (active ? 'ghost' : 'primary') + '" data-set-active="' + c.id + '">' + (active ? '当前出战' : '设为出战') + '</button>' +
      '<button class="btn" data-view="' + c.id + '">观赏</button>' +
      '</div>' +
      '</div></div>';
  }).join('');
}

function renderSettings() {
  const rows = RARITY_LIST.map(r =>
    '<tr><td><span class="r-dot r-' + r.id + '"></span>' + r.name + '</td>' +
    '<td>' + fmtRate(r.weight) + '</td>' +
    '<td>' + r.basePower + '</td>' +
    '<td>' + r.frag + '</td></tr>'
  ).join('');
  $id('settings-rates').innerHTML =
    '<div class="formula">离线收益按线上抽卡速度的 1/10 折算为碎片发放，最多累积 ' + CONFIG.OFFLINE_CAP_HOURS + ' 小时。</div>' +
    '<table class="rate-table"><thead><tr><th>稀有度</th><th>单抽概率</th><th>基础战力</th><th>重复→碎片</th></tr></thead><tbody>' + rows + '</tbody></table>';
}

function renderAll() {
  if (!S) return;
  renderTopbar();
  renderBattle();
  renderCodex();
  renderBackpack();
  renderSettings();
}

let vRotX = -15, vRotY = 0, vScale = 1, vDragging = false, vtx = 0, vty = 0;

function initViewer() {
  const stage = $id('viewer-stage');
  const card = $id('viewer-card');
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
  return '<div class="v-art">' + artHTML(c) + '</div>' +
    '<div class="v-no">NO.' + c.no + '</div>' +
    '<div class="v-name">' + c.name + '</div>' +
    rarityTagHTML(c.rarity) +
    '<div class="v-line">基础战力 <b>' + basePowerOf(c) + '</b></div>' +
    '<div class="v-line">编队 ' + (1 + c.formation.length) + ' 张' + (c.formation.length ? '' : ' · 独行') + '</div>';
}

function backHTML(c) {
  const owned = (S.owned[c.id] || 0) > 0;
  const complete = formationComplete(c.id);
  const members = formationCardsOf(c.id).map(cm => {
    const has = (S.owned[cm.id] || 0) > 0;
    const isSelf = cm.id === c.id;
    return '<span class="v-mem ' + (has ? 'ok' : 'miss') + '">' + (has ? '✓' : '✗') + ' ' + cm.name + (isSelf ? '（中心）' : '') + '</span>';
  }).join('');
  return '<div class="v-sec">掉落概率 <b>' + fmtRate(RARITIES[c.rarity].weight) + '</b> · 无保底</div>' +
    '<div class="v-sec">重复获得 → 碎片 +' + RARITIES[c.rarity].frag + '</div>' +
    '<div class="v-sec">战力：单独 ' + basePowerOf(c) +
    (c.formation.length ? ' / 编队 ' + Math.round(formationPowerOf(c.id)) + (complete ? '' : '（未集齐）') : '') + '</div>' +
    '<div class="v-sec-title">编队成员（共 ' + (1 + c.formation.length) + ' 张）</div>' +
    '<div class="v-mems">' + members + '</div>' +
    '<div class="v-desc">' + c.desc + '</div>' +
    '<div class="v-flavor">「' + c.flavor + '」</div>' +
    (owned ? '' : '<div class="v-unowned">尚未获得</div>');
}
