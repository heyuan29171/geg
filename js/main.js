(function () {
  let onPageHide = null;
  S = Save.load();
  gameInit();
  spawnMonster();

  CARDS.filter(c => !c.hidden).forEach(c => {
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

  setInterval(() => { tick(performance.now()); Tutorial.check(); rogueTick(performance.now()); }, 250);
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

  $id('ach-filters').addEventListener('click', e => {
    const chip = e.target.closest('[data-achf]');
    if (!chip) return;
    achFilter = chip.dataset.achf;
    renderAchievements();
  });

  $id('nest-list').addEventListener('click', e => {
    const sp = e.target.closest('[data-speedup]');
    if (sp && !sp.disabled) {
      const ok = nestSpeedup(+sp.dataset.speedup);
      toast(ok ? '加速成功！孵化时长 −25%' : '碎片不足或次数用完', ok ? '' : 'rc-white');
      renderHome();
      renderTopbar();
      Save.write(S);
      return;
    }
    const ht = e.target.closest('[data-hatch]');
    if (ht) {
      const res = hatchEgg(+ht.dataset.hatch);
      if (res) {
        showNestModal(res);
        renderAll();
        Save.write(S);
      }
      return;
    }
    const rm = e.target.closest('[data-remove]');
    if (rm) {
      const host = rm.closest('.nest-slot');
      nestRemove(host.dataset.nslot, +host.dataset.nidx);
      renderHome();
      Save.write(S);
      return;
    }
    const slotEl = e.target.closest('.nest-slot');
    if (slotEl) openNestPicker({ idx: +slotEl.dataset.nidx, slot: slotEl.dataset.nslot });
  });

  $id('nest-picker').addEventListener('click', e => {
    if (e.target.classList.contains('nest-picker-backdrop') || e.target.closest('#nest-picker-close')) {
      closeNestPicker();
      return;
    }
    const row = e.target.closest('[data-pick]');
    if (!row || !pickerSlot) return;
    if (nestSet(pickerSlot.slot, row.dataset.pick, pickerSlot.idx)) {
      closeNestPicker();
      renderHome();
      Save.write(S);
    }
  });

  $id('shop-list').addEventListener('click', e => {
    const btn = e.target.closest('[data-buy]');
    if (!btn) return;
    const key = btn.dataset.buy;
    let ok = false, msg = '购买失败';
    if (key === 'nest-slot') {
      ok = buyNestSlot();
      msg = ok ? '新窝位建好了！' : '碎片不足';
    } else if (key === 'cosmetic-frame') {
      ok = buyCosmeticFrame();
      msg = ok ? '毕业纪念框已解锁，全图鉴镀金边！' : '碎片不足';
    } else if (key.indexOf('pity-') === 0) {
      ok = buyPity(key.slice(5));
      msg = ok ? '保底券已持有，下一抽生效' : '碎片不足';
    }
    if (ok) Save.write(S);
    toast(msg, ok ? '' : 'rc-white');
    renderShop();
    renderTopbar();
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

  $id('btn-art-mode').addEventListener('click', () => {
    S.artMode = S.artMode === 'emoji' ? 'img' : 'emoji';
    const b = $id('btn-art-mode');
    if (b) b.textContent = S.artMode === 'emoji' ? '切换到立绘卡面' : '切换到 emoji 卡面';
    renderAll();
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

  $id('egg-modal-close').addEventListener('click', () => { if (!eggModalOpen()) return; hideEggModal(); });
  $id('egg-modal').addEventListener('click', e => {
    if (e.target.classList.contains('egg-modal-backdrop')) hideEggModal();
  });
  $id('rogue-view').addEventListener('click', e => {
    const btn = e.target.closest('[data-rogue]');
    if (!btn) return;
    const act = btn.dataset.rogue;
    if (act === 'start') {
      if (rogueStart()) toast('先立约本局目标波数', '', 3000);
      else toast('已有一局进行中', 'rc-white');
    } else if (act === 'retreat') {
      const res = rogueRetreat();
      if (res) toast('撤退结算：碎片 +' + res.frags + ' · 金币 +' + res.coins + '（' + res.wins + ' 波）', '', 5000);
    } else if (act === 'showgoal') {
      rogueShowGoal();
    } else if (act === 'weak') {
      rogueWeakClick();
    } else if (act && act.indexOf('upgrade:') === 0) {
      const key = act.slice(8);
      if (rogueUpgrade(key)) {
        toast(CONFIG.ROGUE.UPGRADES[key].name + ' 升级成功', '');
        Save.write(S);
      }
      else toast('金币不足或已满级', 'rc-white');
    }
    renderRogue();
    if (bossOpen) updateBossPanel();
  });

  $id('rogue-goal').addEventListener('click', e => {
    const b = e.target.closest('[data-goal]');
    if (!b) return;
    const n = parseInt(b.dataset.goal, 10);
    if (!n) {
      rogueCancelRun();
      return;
    }
    if (rogueChooseGoal(n)) Save.write(S);
  });

  $id('rogue-pick').addEventListener('click', e => {
    if (e.target.closest('[data-rogue-pick-reroll]')) {
      if (!rogueReroll()) toast('金币不足或次数用完', 'rc-white');
      return;
    }
    if (e.target.classList.contains('rogue-pick-backdrop') || e.target.closest('#rogue-pick-close')) {
      if (S.rogue && S.rogue.pendingSwap) {
        S.rogue.pendingSwap = null;
        renderRoguePick();
      } else {
        $id('rogue-pick').classList.add('hidden');
      }
      return;
    }
    const swapRow = e.target.closest('[data-rogue-swap]');
    if (swapRow) {
      if (S.rogue && S.rogue.pendingSwap && rogueDoSwap(S.rogue.pendingSwap.id, swapRow.dataset.rogueSwap)) {
        renderAll();
        Save.write(S);
      }
      return;
    }
    const row = e.target.closest('[data-rogue-pick]');
    if (!row) return;
    const val = row.dataset.roguePick;
    const idx = S.rogue && S.rogue.offer ? S.rogue.offer.findIndex(o => (o.kind + ':' + o.id) === val) : -1;
    if (idx >= 0 && roguePick(idx)) {
      if (!S.rogue || !S.rogue.pendingSwap) {
        renderAll();
        Save.write(S);
      }
    }
  });

  $id('nest-modal-close').addEventListener('click', () => { if (!nestModalOpen()) return; hideNestModal(); });
  $id('shiny-modal-close').addEventListener('click', () => { if (!shinyModalOpen()) return; hideShinyModal(); });
  $id('shiny-modal').addEventListener('click', e => {
    if (e.target.classList.contains('egg-modal-backdrop')) hideShinyModal();
  });
  $id('viewer-shiny-toggle').addEventListener('click', toggleViewerShiny);
  $id('nest-modal').addEventListener('click', e => {
    if (e.target.classList.contains('egg-modal-backdrop')) hideNestModal();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Tab') {
      e.preventDefault();
      if (!bossOpen) {
        const v = $id('viewer');
        if (v && !v.classList.contains('hidden')) closeViewer();
      }
      toggleBoss();
    } else if (e.key === 'Escape') {
      if (eggModalOpen()) { hideEggModal(); return; }
      if (nestModalOpen()) { hideNestModal(); return; }
      const rp = $id('rogue-pick');
      if (rp && !rp.classList.contains('hidden')) {
        if (S.rogue && S.rogue.pendingSwap) {
          S.rogue.pendingSwap = null;
          renderRoguePick();
        } else {
          rp.classList.add('hidden');
        }
        return;
      }
      if (rogueGoalOpen()) { rogueHideGoal(); return; }
      if (bossOpen) toggleBoss();
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
  if (res.secretNew) showEggUpgradeNotice();
  const achN = checkAchievements();
  if (achN > 0) parts.push('成就 +' + achN + ' 项');
  toast('碎片抽卡 ×' + res.draws + '：' + parts.join('；'), '', 6000);
  renderAll();
  if (bossOpen) updateBossPanel();
}

function strongestCard() {
  let best = null, bestP = -1;
  CARDS.forEach(c => {
    if ((S.owned[c.id] || 0) > 0) {
      const p = formationPowerOf(c.id);
      if (p > bestP || (p === bestP && best && basePowerOf(c) > basePowerOf(CARD_MAP[best]))) {
        bestP = p;
        best = c.id;
      }
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
