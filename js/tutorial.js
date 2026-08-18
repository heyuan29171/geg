const Tutorial = (function () {
  let mask = null, ring = null, bubble = null;
  let current = null;
  let sub = '';
  let clicks = 0;
  let pullBase = 0;

  const T = {
    monster: {
      sel: '#monster-img',
      title: '欢迎来到 geg！',
      body: '这是一个挂机集卡游戏：怪物会一直自动战斗、自动掉落卡片，关掉页面也会离线收益。<br>想更快出卡？<b>点击怪物</b>可以提前击杀（每次缩短 0.5 秒）。<br>点它 20 次，打出你的第一张新卡吧！<span class="tut-progress" id="tut-progress"></span>',
    },
    'frag-wait': {
      sel: null,
      title: '重复卡片 = 碎片',
      body: '战斗继续中！重复抽到的卡片会自动变成<b>碎片</b>，10 碎片可以抽卡一次。<br>攒到 10 个碎片，我会教你怎么用它。',
    },
    frag: {
      sel: '#btn-spend-frag',
      title: '碎片攒够了！',
      body: '点击下面的「<b>用 10 碎片立即出战</b>」按钮，用碎片抽一张卡。<br>（如果不在战斗页，先点顶部「战斗」）',
    },
    'bag-hint': {
      sel: null,
      title: '编队决定速度',
      body: '碎片抽卡成功！<b>编队越强，战斗间隔越短，出卡越快</b>。<br>当你拿到更强的编队时，我会带你去换上它。',
    },
    'bag-tab': {
      sel: '.tab-btn[data-tab="backpack"]',
      title: '你有更强的编队了！',
      body: '点击顶部「<b>背包</b>」标签，看看你拥有的全部卡片。',
    },
    'bag-sort': {
      sel: '#bag-sorts [data-sort="fp"]',
      title: '按编队战力排序',
      body: '点击「<b>编队战力</b>」排序按钮，最强的编队会排到最前面。',
    },
    'bag-pick': {
      sel: () => {
        const btns = document.querySelectorAll('[data-set-active]');
        return btns.length ? btns[0] : null;
      },
      title: '换上最强编队',
      body: '最上面这一行就是当前<b>战力最高的编队</b>。<br>点击它右边的「<b>设为出战</b>」按钮换上去。',
    },
    settings: {
      sel: '.tab-btn[data-tab="settings"]',
      title: '最后去一个地方',
      body: '设置页里有完整的游戏说明：玩法、掉落概率、全部数值公式。<br>点击顶部「<b>设置</b>」标签。',
    },
    done: {
      sel: null,
      title: '都学会啦！',
      body: '设置页有完整说明（玩法 / 概率 / 公式），随时可以回来查看。<br>祝你收集愉快！',
      doneBtn: true,
    },
  };

  function hasDOM() { return typeof document !== 'undefined' && document.body; }

  function ensureUI() {
    if (!hasDOM() || mask) return;
    mask = document.createElement('div');
    mask.id = 'tut-mask';
    ring = document.createElement('div');
    ring.id = 'tut-ring';
    bubble = document.createElement('div');
    bubble.id = 'tut-bubble';
    document.body.appendChild(mask);
    document.body.appendChild(ring);
    document.body.appendChild(bubble);
  }

  function render() {
    ensureUI();
    if (!mask || !current) return;
    const st = T[current];
    if (!st) return;
    const skipBtn = '<button class="tut-btn tut-skip" id="tut-skip">跳过引导</button>';
    const doneBtn = st.doneBtn ? '<button class="tut-btn primary" id="tut-done">知道了</button>' : '';
    bubble.innerHTML = '<div class="tut-title">' + st.title + '</div>' +
      '<div class="tut-body">' + st.body + '</div>' +
      '<div class="tut-btns">' + skipBtn + doneBtn + '</div>';
    bubble.style.display = 'block';
    if (st.sel === null) {
      mask.style.display = 'none';
      ring.style.display = 'none';
      positionBubbleCentered();
    } else {
      updatePos();
    }
  }

  function positionBubbleCentered() {
    if (!bubble) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    const bw = bubble.offsetWidth || Math.min(vw - 24, 340);
    const bh = bubble.offsetHeight || 160;
    bubble.style.left = Math.max(8, (vw - bw) / 2) + 'px';
    bubble.style.top = Math.max(16, vh / 3) + 'px';
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function updatePos() {
    if (!mask || !bubble || !current) return;
    const st = T[current];
    let el = null;
    if (st.sel) el = typeof st.sel === 'function' ? st.sel() : document.querySelector(st.sel);
    if (!el) {
      mask.style.display = 'none';
      ring.style.display = 'none';
      positionBubbleCentered();
      return;
    }
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    if (!r.width || !r.height) {
      mask.style.display = 'none';
      ring.style.display = 'none';
      positionBubbleCentered();
      return;
    }
    const pad = Math.max(4, Math.min(10, r.width * 0.15));
    const x = clamp(r.left - pad, 0, vw - 1), y = clamp(r.top - pad, 0, vh - 1);
    const w = clamp(r.width + pad * 2, 24, vw), h = clamp(r.height + pad * 2, 24, vh);
    mask.style.display = 'block';
    mask.style.clipPath =
      'polygon(0 0,' + vw + 'px 0,' + vw + 'px ' + vh + 'px,0 ' + vh + 'px,0 0,' +
      x + 'px ' + y + 'px,' + x + 'px ' + (y + h) + 'px,' + (x + w) + 'px ' + (y + h) + 'px,' +
      (x + w) + 'px ' + y + 'px,' + x + 'px ' + y + 'px)';
    ring.style.display = 'block';
    ring.style.left = x + 'px';
    ring.style.top = y + 'px';
    ring.style.width = w + 'px';
    ring.style.height = h + 'px';
    const bw = bubble.offsetWidth || Math.min(vw - 24, 340);
    const bh = bubble.offsetHeight || 140;
    let bx = clamp(r.left + r.width / 2 - bw / 2, 8, vw - bw - 8);
    let by = r.bottom + 14;
    if (by + bh > vh - 8) by = r.top - bh - 14;
    if (by < 8) by = 8;
    bubble.style.left = bx + 'px';
    bubble.style.top = by + 'px';
  }

  function setStep(key) {
    current = key;
    render();
  }

  function hide() {
    if (mask) { mask.remove(); mask = null; }
    if (ring) { ring.remove(); ring = null; }
    if (bubble) { bubble.remove(); bubble = null; }
    current = null;
  }

  function finish() {
    S.tutorial = 4;
    hide();
    Save.write(S);
  }

  function begin() {
    if (S.tutorial >= 4) return;
    if (S.tutorial === 0 && S.totalPulls > 0) { S.tutorial = 4; Save.write(S); return; }
    clicks = 0;
    pullBase = S.totalPulls;
    if (S.tutorial === 0) setStep('monster');
    else if (S.tutorial === 1) setStep('frag-wait');
    else if (S.tutorial === 2) setStep('bag-hint');
    else if (S.tutorial === 3) setStep('settings');
  }

  function hasStronger() {
    const cur = activePower();
    return CARDS.some(c => (S.owned[c.id] || 0) > 0 && formationPowerOf(c.id) > cur);
  }

  function check() {
    if (S.tutorial >= 4) {
      if (current) hide();
      return;
    }
    if (S.tutorial === 0) {
      if (clicks >= 20 || S.totalPulls > pullBase) {
        S.tutorial = 1;
        Save.write(S);
        setStep('frag-wait');
      } else if (current !== 'monster') {
        setStep('monster');
      }
    } else if (S.tutorial === 1) {
      if (S.fragments >= 10 && current !== 'frag') setStep('frag');
    } else if (S.tutorial === 2) {
      if (hasStronger() && current !== 'bag-tab') {
        sub = '';
        setStep('bag-tab');
      }
    } else if (S.tutorial === 3) {
      if (current !== 'settings') setStep('settings');
    }
    updatePos();
  }

  function onMonsterClick() {
    if (S.tutorial === 0) clicks++;
    if (mask && current === 'monster') {
      const p = document.getElementById('tut-progress');
      if (p) p.textContent = '（进度 ' + Math.min(clicks, 20) + '/20）';
    }
  }

  function onDocClick(e) {
    if (S.tutorial >= 4 || !current) return;
    const t = e.target;
    if (t.closest('#tut-skip')) { finish(); return; }
    if (current === 'done' && t.closest('#tut-done')) { finish(); return; }
    if (S.tutorial === 1 && S.fragments >= 10 && t.closest('#btn-spend-frag')) {
      S.tutorial = 2;
      Save.write(S);
      setStep('bag-hint');
      return;
    }
    if (S.tutorial === 2) {
      if (sub === '' && t.closest('.tab-btn[data-tab="backpack"]')) {
        sub = 'sort';
        setStep('bag-sort');
        return;
      }
      if (sub === 'sort' && t.closest('#bag-sorts [data-sort="fp"]')) {
        sub = 'pick';
        setStep('bag-pick');
        return;
      }
      if (sub === 'pick' && t.closest('[data-set-active]')) {
        S.tutorial = 3;
        Save.write(S);
        setStep('settings');
        return;
      }
      return;
    }
    if (S.tutorial === 3 && t.closest('.tab-btn[data-tab="settings"]')) {
      setStep('done');
      return;
    }
  }

  if (hasDOM() && document.addEventListener) {
    document.addEventListener('click', onDocClick, true);
    window.addEventListener('resize', () => updatePos());
  }

  return {
    begin: begin,
    check: check,
    onMonsterClick: onMonsterClick,
    _test: { onDocClick: onDocClick, setStep: setStep, current: () => current, sub: () => sub },
  };
})();