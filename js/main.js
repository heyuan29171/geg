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
    im.src = 'img/cards/' + c.id + '.png';
  });
  const mi = new Image();
  mi.onload = () => {
    if (mi.naturalWidth > 0) {
      MONSTER_PNG = true;
      $id('monster-img').src = 'img/monsters/monster.png';
    }
  };
  mi.src = 'img/monsters/monster.png';

  const off = offlineAccrue();
  spawnMonster();
  initViewer();
  bindEvents();
  renderAll();
  Tutorial.begin();
  if (off) toast('离线归来：碎片收益 +' + off.frags + '（相当于 ' + Math.floor(off.frags / CONFIG.FRAG_COST_PER_DRAW) + ' 抽）', '', 6000);

  setInterval(() => { tick(performance.now()); Tutorial.check(); }, 100);
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

  $id('btn-spend-all-frag').addEventListener('click', () => {
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
