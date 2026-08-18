(function () {
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
  if (off) toast('离线归来：碎片收益 +' + off.frags + '（相当于 ' + Math.floor(off.frags / CONFIG.FRAG_COST_PER_DRAW) + ' 抽）', '', 6000);

  setInterval(() => tick(performance.now()), 100);
  setInterval(() => Save.write(S), 5000);
  window.addEventListener('pagehide', () => Save.write(S));
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
        toast('导入成功，页面刷新');
        setTimeout(() => location.reload(), 800);
      } else {
        toast('导入失败：存档格式不正确', 'rc-red', 4000);
      }
      e.target.value = '';
    });
  });
  $id('btn-reset').addEventListener('click', () => {
    if (confirm('确定要清空所有存档吗？此操作不可恢复。')) {
      Save.reset();
      location.reload();
    }
  });
}
