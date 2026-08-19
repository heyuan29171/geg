(function () {
  let onPageHide = null;
  S = Save.load();
  gameInit();
  spawnMonster();

  CARDS.forEach(c => {
    const im = new Image();
    im.onload = () => {
      if (im.naturalWidth > 0) {
        PNG_READY.add(c.id);
        renderAll();
      }
    };
    im.src = 'img/cards/thumb/' + c.id + '.jpg';
  });
  const mi = new Image();
  mi.onload = () => {
    if (mi.naturalWidth > 0) {
      MONSTER_PNG = true;
      $id('monster-img').src = 'img/monsters/monster.jpg';
    }
  };
  mi.src = 'img/monsters/monster.jpg';

  const off = offlineAccrue();
  spawnMonster();
  initViewer();
  bindEvents();
  renderAll();
  applyTheme();
  Tutorial.begin();
  if (off) toast('离线归来：碎片收益 +' + off.frags + '（相当于 ' + Math.floor(off.frags / CONFIG.FRAG_COST_PER_DRAW) + ' 抽）', '', 6000);

  setInterval(() => { tick(performance.now()); Tutorial.check(); }, 250);
  setInterval(() => Save.write(S), 5000);
  onPageHide = () => Save.write(S);
  window.addEventListener('pagehide', onPageHide);

  let hiddenAt = null;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hiddenAt = Date.now();
    } else if (hiddenAt !== null) {
      const off = accrueSince(hiddenAt);
      hiddenAt = null;
      if (off) toast('离线归来：碎片收益 +' + off.frags + '（相当于 ' + Math.floor(off.frags / CONFIG.FRAG_COST_PER_DRAW) + ' 抽）', '', 6000);
    }
  });
})();

function bindEvents() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      currentTab = btn.dataset.tab;
      $id('tab-' + currentTab).classList.add('active');
      renderAll();
    });
  });

  $id('monster-img').addEventListener('click', () => {
    clickMonster();
    const img = $id('monster-img');
    img.classList.remove('m-hit');
    void img.offsetWidth;
    img.classList.add('m-hit');
  });

  $id('codex-filters').addEventListener('click', e => {
    const chip = e.target.closest('[data-filter]');
    if (!chip) return;
    codexFilter = chip.dataset.filter;
    renderCodex();
  });

  $id('bag-filters').addEventListener('click', e => {
    const chip = e.target.closest('[data-filter]');
    if (!chip) return;
    bagFilter = chip.dataset.filter;
    renderBackpack();
  });

  bindSortRow($id('codex-sorts'), codexSort, renderCodex);
  bindSortRow($id('bag-sorts'), bagSort, renderBackpack);

  $id('codex-state-filters').addEventListener('click', e => {
    const own = e.target.closest('[data-own]');
    if (own) { codexOwned = own.dataset.own; renderCodex(); return; }
    const cpl = e.target.closest('[data-cpl]');
    if (cpl) { codexComplete = cpl.dataset.cpl; renderCodex(); }
  });

  $id('codex-range-filters').addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'codex-pmin') codexPowerMin = t.value;
    else if (t.id === 'codex-pmax') codexPowerMax = t.value;
    else if (t.id === 'codex-search') codexQuery = t.value;
    else return;
    renderCodex();
  });

  $id('bag-state-filters').addEventListener('click', e => {
    const cpl = e.target.closest('[data-cpl]');
    if (cpl) { bagComplete = cpl.dataset.cpl; renderBackpack(); }
  });

  $id('bag-range-filters').addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'bag-pmin') bagPowerMin = t.value;
    else if (t.id === 'bag-pmax') bagPowerMax = t.value;
    else if (t.id === 'bag-search') bagQuery = t.value;
    else return;
    renderBackpack();
  });

  $id('codex-grid').addEventListener('click', e => {
    const cell = e.target.closest('[data-view]');
    if (!cell) return;
    if (cell.dataset.mystery) {
      toast('获得后才能解锁图鉴内容', 'rc-gold');
      return;
    }
    openViewer(cell.dataset.view);
  });

  $id('bag-list').addEventListener('click', e => {
    const setBtn = e.target.closest('[data-set-active]');
    if (setBtn) {
      setActiveCard(setBtn.dataset.setActive);
      renderAll();
      return;
    }
    const view = e.target.closest('[data-view]');
    if (view) openViewer(view.dataset.view);
  });

  $id('btn-spend-frag').addEventListener('click', () => {
    const ok = spendFragments();
    toast(ok ? '碎片出战一次' : '碎片不足（10 碎片 / 次）', ok ? '' : 'rc-white');
    if (ok) renderAll();
  });

  $id('btn-spend-all-frag').addEventListener('click', handleSpendAllFrag);

  $id('btn-theme').addEventListener('click', () => {
    S.theme = S.theme === 'dark' ? 'light' : 'dark';
    applyTheme();
    Save.write(S);
  });

  $id('boss-strongest').addEventListener('click', () => {
    const best = strongestCard();
    if (best) {
      setActiveCard(best);
      renderAll();
      updateBossPanel();
    }
  });

  $id('boss-frag-all').addEventListener('click', handleSpendAllFrag);

  document.addEventListener('keydown', e => {
    if (e.key === 'Tab') {
      e.preventDefault();
      if (!bossOpen) {
        const v = $id('viewer');
        if (v && !v.classList.contains('hidden')) closeViewer();
      }
      toggleBoss();
    } else if (e.key === 'Escape' && bossOpen) {
      toggleBoss();
    }
  });

  $id('btn-export').addEventListener('click', () => Save.export(S));
  $id('btn-import').addEventListener('click', () => $id('import-file').click());
  $id('import-file').addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    Save.importFile(f, ok => {
      if (ok) {
        S = Save.load();
        window.removeEventListener('pagehide', onPageHide);
        toast('导入成功，页面刷新');
        setTimeout(() => location.reload(), 800);
      } else {
        toast('导入失败：存档格式不正确', 'rc-red', 4000);
      }
      e.target.value = '';
    });
  });

let tutorialArmed = false;
  $id('btn-tutorial-restart').addEventListener('click', () => {
    const btn = $id('btn-tutorial-restart');
    if (!tutorialArmed) {
      tutorialArmed = true;
      btn.textContent = '再次点击确认重新开始';
      setTimeout(() => {
        tutorialArmed = false;
        btn.textContent = '重新开始新手教程（点两次确认）';
      }, 4000);
      return;
    }
    tutorialArmed = false;
    btn.textContent = '重新开始新手教程（点两次确认）';
    Tutorial.restart();
    toast('新手教程已重新开始', '');
  });

  let resetArmed = false;
  $id('btn-reset').addEventListener('click', () => {
    const btn = $id('btn-reset');
    if (!resetArmed) {
      resetArmed = true;
      btn.textContent = '再次点击确认清空';
      setTimeout(() => {
        resetArmed = false;
        btn.textContent = '重置存档';
      }, 4000);
      return;
    }
    resetArmed = false;
    Save.reset();
    S = defaultSave();
    window.removeEventListener('pagehide', onPageHide);
    location.reload();
  });
}

function handleSpendAllFrag() {
  const res = spendAllFragments();
  if (!res) {
    toast('碎片不足（10 碎片 / 抽）', 'rc-white');
    return;
  }
  const parts = [];
  const rc = RARITY_LIST.filter(r => (res.byRarity[r.id] || 0) > 0)
    .map(r => r.name.replace('卡', '') + '×' + res.byRarity[r.id]).join(' ');
  parts.push(rc);
  if (res.newCards.length) parts.push('新卡：' + res.newCards.join('、'));
  if (res.fragGain) parts.push('重复转化碎片 +' + res.fragGain);
  toast('碎片抽卡 ×' + res.draws + '：' + parts.join('；'), '', 6000);
  renderAll();
  if (bossOpen) updateBossPanel();
}

function strongestCard() {
  let best = null, bestP = 0;
  CARDS.forEach(c => {
    if ((S.owned[c.id] || 0) > 0) {
      const p = formationPowerOf(c.id);
      if (p > bestP) { bestP = p; best = c.id; }
    }
  });
  return best;
}

let bossOpen = false;
let bossRarity = -1;

function bossNewCard(card) {
  if (!bossOpen) return;
  const ri = RARITY_LIST.findIndex(r => r.id === card.rarity);
  if (ri > bossRarity) bossRarity = ri;
}

function updateBossPanel() {
  if (!document || !$id('boss-panel')) return;
  $id('boss-rate').textContent = (1 / battleInterval()).toFixed(1);
  $id('boss-frag').textContent = S.fragments.toLocaleString();
  $id('boss-new').textContent = bossRarity < 0 ? '暂无新卡' : '新卡：' + RARITY_LIST[bossRarity].name;
}

function toggleBoss() {
  bossOpen = !bossOpen;
  document.body.classList.toggle('boss-mode', bossOpen);
  $id('boss-panel').classList.toggle('hidden', !bossOpen);
  if (bossOpen) {
    bossRarity = -1;
    document.title = '新建文本.txt - 记事本';
    const note = $id('boss-note');
    if (note) { note.value = ''; note.focus(); }
    updateBossPanel();
  } else {
    document.title = 'geg';
  }
}

setInterval(() => { if (bossOpen) updateBossPanel(); }, 250);

function applyTheme() {
  const body = document && document.body;
  if (body && body.classList) body.classList.toggle('dark', S.theme === 'dark');
  const b = $id('btn-theme');
  if (b) b.textContent = S.theme === 'dark' ? '切换到亮色模式' : '切换到深色模式';
}
