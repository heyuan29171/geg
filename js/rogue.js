// rogue.js — 冒险模式（肉鸽）：5 人队伍 + 流派机制 + 超进化 + 无限波
// 数值平（稀有度等差 1-8），机制主导强度；每波 2-5 秒节奏，超时/撤退结算
// 性能：战斗页静态骨架只建一次，每 tick 仅更新数值节点

let ROGUE_EXPECTED = null;
let rogueLastNow = 0;
let rogueLastResult = null;
let rogueDyn = null;

const ROGUE_BASE_POWER = { white: 1, green: 2, blue: 3, purple: 4, gold: 5, red: 6, black: 7, rainbow: 8 };
const ROGUE_EVO_MULT = { white: 2, green: 3, blue: 4, purple: 5, gold: 6, red: 7, black: 8, rainbow: 9 };
const ROGUE_MECH_ORDER = ['growth', 'combo', 'crit', 'smash', 'raid', 'delay', 'haste', 'press'];
const ROGUE_RARITY_IDX = { white: 0, green: 1, blue: 2, purple: 3, gold: 4, red: 5, black: 6, rainbow: 7 };

function rogueExpectedFrag() {
  if (ROGUE_EXPECTED == null) {
    let w = 0, f = 0;
    RARITY_LIST.forEach(r => { w += r.weight; f += r.weight * r.frag; });
    ROGUE_EXPECTED = f / w;
  }
  return ROGUE_EXPECTED;
}

// 流派 = 卡序号 + 稀有度偏移轮转，保证每族跨稀有度（数值与机制可分开取舍）
function rogueMechanic(card) {
  const n = CARDS.indexOf(card);
  const r = ROGUE_RARITY_IDX[card.rarity] || 0;
  return ROGUE_MECH_ORDER[(n + r * 3) % 8];
}

// 槽位战力 = 稀有度基数 × 全局强化乘区 × 超进化倍率（等级本身不叠数值，只供流派层数与超进化）
function rogueSlotPower(slot) {
  const c = CARD_MAP[slot.id];
  let p = ROGUE_BASE_POWER[c.rarity] || 1;
  p *= (S.rogue && S.rogue.powerMult) || 1;
  if (slot.lv >= CONFIG.ROGUE.EVO_LV) p *= (ROGUE_EVO_MULT[c.rarity] || 5);
  return p;
}

function rogueTeamPower() {
  const R = S.rogue;
  if (!R || !R.team.length) return 0;
  return R.team.reduce((a, s) => a + rogueSlotPower(s), 0);
}

function rogueBondLevel(m) {
  const R = S.rogue;
  let lv = 0;
  R.team.forEach(s => {
    const c = CARD_MAP[s.id];
    if (rogueMechanic(c) === m) lv++;
  });
  return lv;
}

// 被动层数：每张同族卡自带 1 层，强化等级每 3 级再 +1 层（累加共享，无上限）
// 加上事件卡给的加成层（R.bonusLayer）
function rogueMechLayer(m) {
  const R = S.rogue;
  let lv = (R && R.bonusLayer && R.bonusLayer[m]) || 0;
  if (!R) return 0;
  R.team.forEach(s => {
    const c = CARD_MAP[s.id];
    if (rogueMechanic(c) === m) lv += 1 + Math.floor(s.lv / 3);
  });
  return lv;
}

// 机制当前效果描述（含实际数值）
function rogueMechEffect(m, layer) {
  const M = CONFIG.ROGUE.MECHANICS[m];
  if (!layer) return M.desc;
  switch (m) {
    case 'growth': return '全队伤害 ×' + Math.pow(1.44, layer).toFixed(2);
    case 'combo': return '连击链：攻击次数期望 ×' + Math.pow(1.4, layer).toFixed(2);
    case 'crit': return '暴击伤害 ×' + Math.pow(1.4, layer).toFixed(2) + ' · 暴击率 ' + (rogueStats().critRate * 100).toFixed(1) + '%';
    case 'smash': return '每 5 秒附加 ' + (2 * Math.pow(1.5, layer - 1)).toFixed(1) + ' 次重击';
    case 'raid': return '开局将怪血量降至 ×' + Math.pow(0.7, layer).toFixed(2);
    case 'delay': return '限时 +' + (5 * Math.pow(1.5, layer - 1)).toFixed(1) + ' 秒';
    case 'haste': return '攻击频率 ×' + Math.pow(1.4, layer).toFixed(2);
    case 'press': return '怪物血量 ×' + Math.pow(0.71, layer).toFixed(2);
  }
  return M.desc;
}

function rogueStats() {
  const R = S.rogue;
  const u = S.rogueUpgrades;
  const st = {
    dmgMult: 1,
    critRate: 0,
    critMult: 2,
    atkPerSec: 1,
    smashDmg: 0,
    raidCut: 1,
    hpCut: 1,
    timeBonus: 0,
    weakAuto: 0,
  };
  const lv = {
    growth: rogueMechLayer('growth'),
    combo: rogueMechLayer('combo'),
    crit: rogueMechLayer('crit'),
    smash: rogueMechLayer('smash'),
    raid: rogueMechLayer('raid'),
    delay: rogueMechLayer('delay'),
    haste: rogueMechLayer('haste'),
    press: rogueMechLayer('press'),
  };
  if (lv.growth) st.dmgMult *= Math.pow(1.44, lv.growth);
  const rawCrit = 0.01 * (u.crit || 0) * Math.pow(1.5, lv.crit) + 0.02 * lv.crit;
  st.critRate = Math.min(0.9, rawCrit);
  if (rawCrit > 0.9) st.dmgMult *= 1 + (rawCrit - 0.9) * 0.1;
  if (lv.smash) st.smashDmg = 2 * Math.pow(1.5, lv.smash - 1);
  if (lv.raid) st.raidCut = Math.pow(0.7, lv.raid);
  st.hpCut *= Math.pow(0.71, lv.press);
  st.atkPerSec *= Math.pow(1.4, lv.haste);
  st.timeBonus += 5 * Math.pow(1.5, lv.delay - 1);
  st.critMult *= Math.pow(1.4, lv.crit);
  st.dmgMult *= 1 + 0.02 * (u.damage || 0);
  st.critMult *= 1 + 0.05 * (u.critd || 0);
  st.timeBonus += 0.5 * (u.time || 0);
  st.weakAuto = 0.01 * (u.weakauto || 0);
  st.critRate = Math.min(0.9, st.critRate);
  return st;
}

function rogueTimeout() {
  return CONFIG.ROGUE.WAVE_TIMEOUT + rogueStats().timeBonus;
}

function rogueMonsterHp(wave) {
  const R = S.rogue;
  const base = Math.max(rogueTeamPower() * CONFIG.ROGUE.MONSTER_BASE, 1);
  return base * Math.pow(CONFIG.ROGUE.MONSTER_GROWTH, wave - 1) * rogueStats().hpCut;
}

// 碎片只由波数与抽数率决定（同战力同波奖励恒定，局内时长不参与）：
// 每通过一波 = FRAG_WAVE_SECS 秒挂机当量 × FRAG_EQUIV_MULT 倍
function rogueRunFrags() {
  if (!S.rogue) return 0;
  const R = S.rogue;
  const iv = Math.max(0.005, R.baseInterval || battleInterval());
  const wins = Math.max(0, R.wave - 1);
  return Math.floor(CONFIG.ROGUE.FRAG_EQUIV_MULT * CONFIG.ROGUE.FRAG_WAVE_SECS * (wins / iv) * rogueExpectedFrag());
}

function rogueWaveCoins(wave) {
  return Math.floor(CONFIG.ROGUE.COIN_BASE * Math.pow(CONFIG.ROGUE.COIN_GROWTH, wave - 1));
}

// 卡池：上阵即消耗一张，持有量达到 CONSUME_MIN（至少留一张在包）的卡才能入选
function roguePool() {
  return CARDS.filter(c => !c.hidden && (S.owned[c.id] || 0) >= CONFIG.ROGUE.CONSUME_MIN).map(c => c.id);
}

function rogueRollOptions() {
  const R = S.rogue;
  const pool = roguePool().filter(id => !R.team.some(s => s.id === id));
  const opts = [];
  if (R.team.length < CONFIG.ROGUE.TEAM_LIMIT) {
    const cand = pool.length ? pool : roguePool();
    for (let i = cand.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = cand[i]; cand[i] = cand[j]; cand[j] = t;
    }
    cand.slice(0, CONFIG.ROGUE.OPTION_COUNT).forEach(id => opts.push({ kind: 'new', id }));
  } else {
    const ups = R.team.slice();
    for (let i = ups.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = ups[i]; ups[i] = ups[j]; ups[j] = t;
    }
    const target = ups[0].id;
    opts.push({ kind: 'up', id: target }, { kind: 'up', id: ups[1].id });
    const from = ups[2].id;
    const cand = pool.length ? pool : roguePool();
    if (cand.length) {
      opts.push({ kind: 'swap', id: cand[Math.floor(Math.random() * cand.length)], from });
    } else {
      // 包里没有更多可消耗的卡：用事件卡顶替，避免无选项卡死
      opts.push({ kind: 'event', eventId: 'gold', id: 'event' });
    }
  }
  if (!opts.length) {
    opts.push({ kind: 'event', eventId: 'gold', id: 'event' });
  }
  if (Math.random() < CONFIG.ROGUE.EVENT_CHANCE && opts.length === CONFIG.ROGUE.OPTION_COUNT) {
    const keys = Object.keys(CONFIG.ROGUE.EVENTS);
    const ev = keys[Math.floor(Math.random() * keys.length)];
    opts[Math.floor(Math.random() * opts.length)] = { kind: 'event', eventId: ev, id: 'event' };
  }
  return opts;
}

function rogueBeginWave() {
  const R = S.rogue;
  R.waveHpMax = rogueMonsterHp(R.wave);
  R.waveHpLeft = R.waveHpMax;
  R.waveSecs = 0;
  R.attackAcc = 0;
  R.smashT = 0;
  const st = rogueStats();
  if (st.raidCut < 1) R.waveHpLeft *= st.raidCut;
  if (R.waveHpLeft <= 0) R.waveHpLeft = R.waveHpMax * 0.05;
  R.weakAt = performance.now() + CONFIG.ROGUE.WEAK_EVERY * (0.8 + Math.random() * 0.4) * 1000;
  R.weakActive = false;
  R.weakEnd = 0;
  R.weakUsed = false;
}

function rogueStart() {
  if (S.rogue) return false;
  S.rogue = {
    team: [],
    wave: 1,
    baseInterval: battleInterval(),
    waveHpMax: 0,
    waveHpLeft: 0,
    waveSecs: 0,
    attackAcc: 0,
    smashT: 0,
    bank: 0,
    battleSecs: 0,
    offer: null,
    pendingSwap: null,
    powerMult: 1,
    goal: null,
    lastGoal: null,
    awaiting: true,
    goalPaid: false,
    segBankStart: 0,
    startedAt: Date.now(),
  };
  rogueLastResult = null;
  if (typeof renderRogue === 'function') renderRogue();
  if (typeof renderRoguePick === 'function') renderRoguePick();
  rogueShowGoal();
  return true;
}

// 契约机制（滚动）：每段立约 3~5 波，打满重新弹窗续约；金币按段记账，
// 未达承诺（含撤退）没收本段赚到的全部金币（已兑现段落锁定），「取消」在段间隙=全额结算离场
function rogueChooseGoal(n) {
  const R = S.rogue;
  if (!R || !R.awaiting || !n || n < 3 || n > 5) return false;
  R.goalPaid = false; // 每段立约复位，上一段立满 5 波则本段续约兑现一次奖励
  const bonusEligible = R.lastGoal === 5 && !R.goalPaid;
  R.goal = n | 0;
  R.awaiting = false;
  R.segStartWave = R.wave;
  R.segBankStart = R.bank;
  R.lastGoal = null;
  R.offer = rogueRollOptions();
  R.rerollN = 0;
  if (bonusEligible) {
    const keys = Object.keys(CONFIG.ROGUE.EVENTS);
    const ev = keys[Math.floor(Math.random() * keys.length)];
    R.offer[R.offer.length - 1] = { kind: 'event', eventId: ev, id: 'event', bonus: true };
    R.goalPaid = true;
    if (typeof toast === 'function') toast('达成 5 波契约，附赠一张事件卡！', 'rc-gold', 4000);
  }
  rogueHideGoal();
  if (typeof renderRogue === 'function') renderRogue();
  if (typeof renderRoguePick === 'function') renderRoguePick();
  return true;
}

// 段间隙的出口：打过至少一段则全额结算（拿到 result 页），开局从未开打则整局作废
function rogueCancelRun() {
  const R = S.rogue;
  if (!R || !R.awaiting) return false;
  if ((R.wave - 1) > 0) {
    const res = rogueSettle(false);
    return !!res;
  }
  S.rogue = null;
  rogueLastResult = null;
  rogueHideGoal();
  if (typeof renderAll === 'function') renderAll();
  return true;
}

function rogueHideGoal() {
  const m = $id('rogue-goal');
  if (m) m.classList.add('hidden');
}

function rogueGoalOpen() {
  const m = $id('rogue-goal');
  return !!(m && !m.classList.contains('hidden'));
}

function rogueShowGoal() {
  const m = $id('rogue-goal');
  if (!m) return;
  const sub = $id('rogue-goal-sub');
  if (sub) {
    const R = S.rogue;
    sub.textContent = (!R || R.lastGoal == null)
      ? '立约 3~5 波后开打；未达承诺（含主动撤退）将失去本段赚到的全部金币。取消则本局作废、无得无损'
      : '上一契约（' + R.lastGoal + ' 波）已兑现，已赚金币锁定。续约 3~5 波继续，取消即全额结算离场';
  }
  m.classList.remove('hidden');
}

function rogueWinWave() {
  const R = S.rogue;
  R.battleSecs += R.waveSecs;
  R.bank += rogueWaveCoins(R.wave);
  R.wave++;
  // 本段约定波数打满：停下重新立约（不生成 offer）；否则正常进入三选一
  if (R.goal != null && !R.awaiting && (R.wave - (R.segStartWave != null ? R.segStartWave : R.wave)) >= R.goal) {
    R.lastGoal = R.goal;
    R.awaiting = true;
    if (typeof renderRogue === 'function') renderRogue();
    rogueShowGoal();
    return;
  }
  R.offer = rogueRollOptions();
  R.rerollN = 0;
  if (typeof renderRogue === 'function') renderRogue();
}

function roguePick(optIdx) {
  const R = S.rogue;
  if (!R || !R.offer) return false;
  const opt = R.offer[optIdx];
  if (!opt) return false;
  if (opt.kind === 'event') {
    rogueApplyEvent(opt.eventId);
  } else if (opt.kind === 'new') {
    if (R.team.length >= CONFIG.ROGUE.TEAM_LIMIT) return false;
    if ((S.owned[opt.id] || 0) < CONFIG.ROGUE.CONSUME_MIN) return false;
    S.owned[opt.id] -= 1;
    R.team.push({ id: opt.id, lv: 0 });
  } else if (opt.kind === 'up') {
    const slot = R.team.find(s => s.id === opt.id);
    if (!slot) return false;
    slot.lv++;
    R.powerMult = (R.powerMult || 1) * CONFIG.ROGUE.UP_POWER_MULT;
  } else if (opt.kind === 'swap') {
    if (!R.pendingSwap) {
      R.pendingSwap = { id: opt.id };
      if (typeof renderRoguePick === 'function') renderRoguePick();
      return true;
    }
    return false;
  }
  R.offer = null;
  rogueBeginWave();
  if (typeof renderRogue === 'function') renderRogue();
  return true;
}

// 第二步：选择被替换的队伍卡（继承其强化等级）。新卡上场同样消耗一张
function rogueDoSwap(newId, fromId) {
  const R = S.rogue;
  if (!R || !R.pendingSwap || R.pendingSwap.id !== newId) return false;
  if ((S.owned[newId] || 0) < CONFIG.ROGUE.CONSUME_MIN) return false;
  const from = R.team.find(s => s.id === fromId);
  if (!from) return false;
  S.owned[newId] -= 1;
  R.team = R.team.map(s => s.id === fromId ? { id: newId, lv: from.lv } : s);
  R.pendingSwap = null;
  R.offer = null;
  rogueBeginWave();
  if (typeof renderRogue === 'function') renderRogue();
  return true;
}

// 一次普通命中（可能暴击）
function rogueBaseHit(st) {
  const R = S.rogue;
  const crit = Math.random() < st.critRate;
  R.waveHpLeft -= rogueTeamPower() * st.dmgMult * (crit ? st.critMult : 1);
}

// 弱点时刻：周期开窗，窗口内点击怪物造成一次必定暴击的重击；挂机由局外"弱点直觉"概率自动命中
function rogueWeakTick(nowMs) {
  const R = S.rogue;
  if (R.weakActive && nowMs >= R.weakEnd) {
    R.weakActive = false;
    R.weakAt = nowMs + CONFIG.ROGUE.WEAK_EVERY * (0.8 + Math.random() * 0.4) * 1000;
  } else if (!R.weakActive && nowMs >= R.weakAt) {
    R.weakActive = true;
    R.weakEnd = nowMs + CONFIG.ROGUE.WEAK_WINDOW * 1000;
    R.weakUsed = false;
    const st = rogueStats();
    if (Math.random() < (st.weakAuto || 0)) { rogueWeakStrike(); return; }
  }
}

function rogueWeakStrike() {
  const R = S.rogue;
  const st = rogueStats();
  const dmg = rogueTeamPower() * st.dmgMult * st.critMult;
  R.waveHpLeft -= dmg;
  rogueWeakFlash('-' + rogueFmt(dmg));
  if (R.waveHpLeft <= 0) rogueWinWave();
}

function rogueWeakClick() {
  const R = S.rogue;
  if (!R || R.offer || R.pendingSwap) return false;
  if (!R.weakActive || R.weakUsed) return false;
  if (performance.now() > R.weakEnd) { R.weakActive = false; return false; }
  R.weakUsed = true;
  rogueWeakStrike();
  if (typeof rogueUpdateDyn === 'function') rogueUpdateDyn();
  return true;
}

let rogueFlashTimer = null;
function rogueWeakFlash(txt) {
  const el = (typeof $id === 'function') ? $id('rogue-weak-flash') : null;
  if (!el || typeof el.classList === 'undefined') return;
  el.textContent = txt;
  el.classList.remove('go');
  void el.offsetWidth;
  el.classList.add('go');
}

// 重掷：同一 offer 内费用翻倍递增，从本局金币扣款
function rogueRerollCost() {
  const n = S.rogue ? (S.rogue.rerollN || 0) : 0;
  return CONFIG.ROGUE.REROLL_BASE * Math.pow(2, n);
}

function rogueReroll() {
  const R = S.rogue;
  if (!R || !R.offer || R.pendingSwap) return false;
  if ((R.rerollN || 0) >= CONFIG.ROGUE.REROLL_MAX) return false;
  const cost = rogueRerollCost();
  if (R.bank < cost) return false;
  R.bank -= cost;
  R.rerollN = (R.rerollN || 0) + 1;
  R.offer = rogueRollOptions();
  if (typeof renderRogue === 'function') renderRogue();
  return true;
}

function rogueApplyEvent(ev) {
  const R = S.rogue;
  if (!R) return;
  if (ev === 'gold') {
    R.bank += rogueWaveCoins(R.wave) * 8;
  } else if (ev === 'evo') {
    if (R.team.length) {
      const s = R.team[Math.floor(Math.random() * R.team.length)];
      s.lv += 3;
    }
  } else if (ev === 'layer') {
    const keys = Object.keys(CONFIG.ROGUE.MECHANICS);
    const m = keys[Math.floor(Math.random() * keys.length)];
    R.bonusLayer = R.bonusLayer || {};
    R.bonusLayer[m] = (R.bonusLayer[m] || 0) + 1;
  }
}

function rogueAttack(now) {
  const R = S.rogue;
  const st = rogueStats();
  const comboL = rogueMechLayer('combo');
  let hits = 0;
  const doHit = () => { rogueBaseHit(st); hits++; };
  doHit();
  // 连击：链式追加，整段期望攻击次数 = ×1.4^层（对齐攻速口径，无封顶）
  if (comboL) {
    const pStop = Math.pow(1.4, -comboL);
    let guard = 0;
    while (guard++ < 5000) {
      if (Math.random() < pStop) break;
      doHit();
    }
  }
  if (R.smashT >= 5) {
    R.smashT = 0;
    doHit();
    if (st.smashDmg > 1) {
      R.waveHpLeft -= rogueTeamPower() * st.dmgMult * (st.smashDmg - 1) * (Math.random() < st.critRate ? st.critMult : 1);
    }
  }
  if (R.waveHpLeft <= 0) rogueWinWave();
}

function rogueTick(now) {
  if (!S || !S.rogue) { rogueLastNow = 0; return; }
  // 选卡中 / 契约间隙待立约：局内一切冻结（时间不流失、不打怪不结算）
  if (S.rogue.offer || S.rogue.awaiting) { rogueLastNow = now; return; }
  if (typeof document !== 'undefined' && document.hidden) return;
  if (!rogueLastNow) rogueLastNow = now;
  const dt = Math.min((now - rogueLastNow) / 1000, 5);
  rogueLastNow = now;
  if (dt <= 0 || S.rogue.offer) return;
  const R = S.rogue;
  R.waveSecs += dt;
  rogueWeakTick(now);
  if (R.waveSecs >= rogueTimeout()) { rogueSettle(true); return; }
  const st = rogueStats();
  R.attackAcc += dt * st.atkPerSec;
  R.smashT += dt;
  let guard = 0;
  while (R.attackAcc >= 1 && guard++ < 50) {
    R.attackAcc -= 1;
    rogueAttack(now);
    if (!S.rogue || S.rogue.offer) return;
  }
  if (typeof rogueUpdateDyn === 'function' && typeof currentTab !== 'undefined' && currentTab === 'rogue') rogueUpdateDyn();
}

function rogueRetreat() { return rogueSettle(false, false); }

function rogueSettle(timedOut) {
  if (!S.rogue) return null;
  const R = S.rogue;
  const wins = R.wave - 1;
  const totalSecs = R.battleSecs + (R.waveSecs || 0);
  const msCount = Math.floor(wins / CONFIG.ROGUE.MILESTONE_WAVE);
  const msFrag = Math.floor(CONFIG.ROGUE.MILESTONE_FRAG * msCount * (msCount + 1) / 2);
  const baseFrags = rogueRunFrags();
  const frags = baseFrags + msFrag;
  // 失约按"本段完成波数"判定：segStartWave 之后的胜利才算本段进度
  const segStart = R.segStartWave != null ? R.segStartWave : Math.max(1, R.wave - (R.goal || 0));
  const segWins = Math.max(0, R.wave - segStart);
  const goalMiss = (R.goal || 0) > 0 && segWins < R.goal;
  const segGain = Math.max(0, R.bank - (R.segBankStart != null ? R.segBankStart : 0));
  const penalty = goalMiss ? segGain : 0;
  const coinsGot = R.bank - penalty;
  S.fragments += frags;
  S.fragEarnedTotal = (S.fragEarnedTotal || 0) + frags;
  S.coins = (S.coins || 0) + coinsGot;
  const isBest = !S.rogueBest || wins > S.rogueBest.wave || (wins === S.rogueBest.wave && coinsGot > S.rogueBest.coins);
  if (isBest) {
    S.rogueBest = {
      wave: wins,
      team: R.team.map(s => ({ id: s.id, lv: s.lv })),
      frags,
      coins: coinsGot,
      secs: Math.round(R.battleSecs),
      updatedAt: Date.now(),
    };
  }
  rogueLastResult = {
    wins,
    secs: Math.round(totalSecs),
    frags,
    baseFrags,
    msFrag,
    coins: coinsGot,
    bank: R.bank,
    penalty,
    goal: R.goal || 0,
    timedOut: !!timedOut,
    isBest,
  };
  S.rogue = null;
  rogueHideGoal();
  if (typeof checkAchievements === 'function') checkAchievements();
  if (typeof renderAll === 'function') renderAll();
  return rogueLastResult;
}

function rogueUpgradeCost(key) {
  const u = CONFIG.ROGUE.UPGRADES[key];
  if (!u) return 0;
  const lv = S.rogueUpgrades[key] || 0;
  if (lv >= u.max) return 0;
  return Math.floor(u.base * Math.pow(u.growth, lv));
}

function rogueUpgrade(key) {
  const u = CONFIG.ROGUE.UPGRADES[key];
  if (!u) return false;
  const cost = rogueUpgradeCost(key);
  if (cost <= 0 || (S.coins || 0) < cost) return false;
  S.coins -= cost;
  S.rogueUpgrades[key] = (S.rogueUpgrades[key] || 0) + 1;
  return true;
}

function rogueFmt(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + ' 亿';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + ' 万';
  if (n >= 1e4) return (n / 1e4).toFixed(1) + ' 万';
  return Math.floor(n).toLocaleString();
}

function fmtSci(n) {
  n = Math.floor(n);
  if (n >= 1e7) return n.toExponential(2);
  return n.toLocaleString();
}

function rogueCardHTML(slot) {
  const c = CARD_MAP[slot.id];
  const evo = slot.lv >= CONFIG.ROGUE.EVO_LV;
  const mech = rogueMechanic(c);
  return '<div class="rogue-team-card' + (evo ? ' evo' : '') + '">' +
    '<div class="rogue-team-art">' + artHTML(c) + '</div>' +
    '<div class="rogue-team-name">' + effName(c) + (slot.lv ? ' +' + slot.lv : '') + '</div>' +
    rarityTagHTML(effRarity(c)) +
    '<div class="r-tag r-mech">' + CONFIG.ROGUE.MECHANICS[mech].label + '</div>' +
    (evo ? '<div class="r-tag r-evo">超进化</div>' : '') +
    '</div>';
}

function rogueEventHTML(opt) {
  const ev = CONFIG.ROGUE.EVENTS[opt.eventId];
  return '<div class="rogue-pick-card r-event" data-rogue-pick="event:event">' +
    '<div class="rogue-pick-art ev-art">' + ev.icon + '</div>' +
    '<div class="rogue-pick-info">' +
    '<div class="rogue-pick-name">' + ev.name + '</div>' +
    '<span class="r-tag r-mech">事件</span>' +
    (opt.bonus ? '<span class="r-tag r-kind">契约奖励</span>' : '') +
    '<div class="rogue-pick-sub">' + ev.desc + '</div>' +
    '</div>' +
    '</div>';
}

function rogueOptionHTML(opt) {
  if (opt.kind === 'event') return rogueEventHTML(opt);
  const c = CARD_MAP[opt.id];
  const mech = rogueMechanic(c);
  const kindTxt = opt.kind === 'new' ? '加入队伍（消耗一张）' : (opt.kind === 'up' ? '强化 · 全队战力 ×' + CONFIG.ROGUE.UP_POWER_MULT : '替换继承');
  const sub = opt.kind === 'new'
    ? '持有 ×' + S.owned[opt.id]
    : (opt.kind === 'up'
      ? '当前 Lv.' + (S.rogue.team.find(s => s.id === opt.id) || { lv: 0 }).lv + ' → Lv.' + ((S.rogue.team.find(s => s.id === opt.id) || { lv: 0 }).lv + 1)
      : '点击后选择要替换的卡，并继承其 Lv.');
  return '<div class="rogue-pick-card" data-rogue-pick="' + opt.kind + ':' + opt.id + '">' +
    '<div class="rogue-pick-art">' + artHTML(c, true) + '</div>' +
    '<div class="rogue-pick-info">' +
    '<div class="rogue-pick-name">' + effName(c) + '</div>' +
    rarityTagHTML(effRarity(c)) +
    '<div class="rogue-pick-kind r-tag r-kind">' + kindTxt + '</div>' +
    '<div class="rogue-pick-sub">' + sub + '</div>' +
    '<div class="rogue-pick-sub r-tag r-mech">' + CONFIG.ROGUE.MECHANICS[mech].label + '：' + CONFIG.ROGUE.MECHANICS[mech].desc + '</div>' +
    '</div>' +
    '</div>';
}

function rogueSwapHTML(slot) {
  const c = CARD_MAP[slot.id];
  const mech = rogueMechanic(c);
  return '<div class="rogue-pick-card" data-rogue-swap="' + slot.id + '">' +
    '<div class="rogue-pick-art">' + artHTML(c) + '</div>' +
    '<div class="rogue-pick-info">' +
    '<div class="rogue-pick-name">' + effName(c) + (slot.lv ? ' +' + slot.lv : '') + '</div>' +
    rarityTagHTML(effRarity(c)) +
    '<div class="rogue-pick-kind r-tag r-mech">' + CONFIG.ROGUE.MECHANICS[mech].label + '：' + CONFIG.ROGUE.MECHANICS[mech].desc + '</div>' +
    '<div class="rogue-pick-sub">替换后继承其 Lv.' + slot.lv + '</div>' +
    '</div>' +
    '</div>';
}

let roguePickCache = '';
function renderRoguePick() {
  const pk = $id('rogue-pick');
  if (!pk) return;
  if (!S.rogue || (!S.rogue.offer && !S.rogue.pendingSwap)) {
    pk.classList.add('hidden');
    return;
  }
  const head = $id('rogue-pick-head-txt');
  const list = $id('rogue-pick-list');
  let headTxt, html;
  if (S.rogue.pendingSwap) {
    headTxt = '选择要替换的卡（继承其等级）';
    html = S.rogue.team.map(rogueSwapHTML).join('');
  } else {
    headTxt = '选择一个强化';
    html = S.rogue.offer.map(rogueOptionHTML).join('');
  }
  if (head && head.textContent !== headTxt) head.textContent = headTxt;
  if (roguePickCache !== html) {
    roguePickCache = html;
    list.innerHTML = html;
  }
  const rr = (typeof $id === 'function') ? $id('rogue-pick-reroll') : null;
  if (rr) {
    const R = S.rogue;
    if (!R || !R.offer || R.pendingSwap) {
      rr.classList.add('hidden');
    } else {
      rr.classList.remove('hidden');
      const canAfford = R.bank >= rogueRerollCost();
      const left = CONFIG.ROGUE.REROLL_MAX - (R.rerollN || 0);
      rr.disabled = !canAfford || left <= 0;
      rr.textContent = '重掷 ' + rogueRerollCost() + ' 金币（剩 ' + Math.max(0, left) + ' 次）';
    }
  }
  pk.classList.remove('hidden');
}

function rogueUpgradesHTML() {
  const rows = Object.keys(CONFIG.ROGUE.UPGRADES).map(key => {
    const u = CONFIG.ROGUE.UPGRADES[key];
    const lv = S.rogueUpgrades[key] || 0;
    const cost = rogueUpgradeCost(key);
    const btn = lv >= u.max
      ? '<button class="btn ghost" disabled>已满级</button>'
      : '<button class="btn" data-rogue="upgrade:' + key + '"' + ((S.coins || 0) < cost ? ' disabled' : '') + '>升级 ' + cost + ' 金币</button>';
    return '<div class="rogue-upg-row">' +
      '<div class="rogue-upg-info"><div class="rogue-upg-name">' + u.name + ' <span class="hint">' + u.desc + '</span></div>' +
      '<div class="rogue-upg-lv">Lv.' + lv + ' / ' + u.max + '</div></div>' + btn +
      '</div>';
  }).join('');
  return '<div class="rogue-upgrades">' +
    '<div class="rogue-upg-head">局外养成 <span class="hint">金币余额 <b class="rogue-coins">' + fmtSci(S.coins || 0) + '</b></span></div>' +
    rows + '</div>';
}

function rogueBestHTML() {
  const b = S.rogueBest;
  if (!b) return '';
  return '<div class="panel"><h3>历史最高战绩</h3>' +
    '<div class="kv"><span>通过波数</span><b>' + b.wave + ' 波</b></div>' +
    '<div class="kv"><span>队伍</span><b>' + b.team.map(s => effName(CARD_MAP[s.id]) + (s.lv ? ' +' + s.lv : '')).join(' / ') + '</b></div>' +
    '<div class="kv"><span>结算</span><b>+' + b.frags.toLocaleString() + ' 碎片 · +' + fmtSci(b.coins) + ' 金币</b></div>' +
    '<div class="hint">' + new Date(b.updatedAt).toLocaleString() + '</div></div>';
}

function rogueRunHTML() {
  const R = S.rogue;
  const st = rogueStats();
  const timeout = rogueTimeout();
  const growth = Math.pow(CONFIG.ROGUE.MONSTER_GROWTH, R.wave - 1);
  const mechInfo = Object.keys(CONFIG.ROGUE.MECHANICS).map(m => {
    const layer = rogueMechLayer(m);
    const n = rogueBondLevel(m);
    return layer ? '<div class="rogue-mech-row"><span class="r-tag r-mech">' + CONFIG.ROGUE.MECHANICS[m].label + ' ' + layer + ' 层</span><span class="hint">同族 ' + n + ' 人 · ' + rogueMechEffect(m, layer) + '</span></div>' : '';
  }).filter(Boolean).join('');
  return '<div class="panel">' +
    '<div class="rogue-run-head"><span>第 <b>' + R.wave + '</b> 波</span>' +
    '<span class="hint">强度 ×' + growth.toFixed(2) + '</span></div>' +
    '<div class="rogue-monster-box">' +
    '<div class="rogue-monster-wrap" id="rogue-monster-click" data-rogue="weak">' +
    '<img class="rogue-monster-img" src="img/monsters/monster.jpg" alt="怪物">' +
    '<div class="rogue-weak-ring"></div>' +
    '<span class="rogue-weak-flash" id="rogue-weak-flash"></span>' +
    '</div>' +
    '<div class="monster-name">第 ' + R.wave + ' 波入侵者 <span class="hint">' + timeout.toFixed(1) + ' 秒内击杀</span></div>' +
    '<div class="hpbar"><div class="hpbar-fill" id="rogue-hp-fill" style="width:100%"></div></div>' +
    '<div class="rogue-timer" id="rogue-hp-text">怪物 HP - / - · 剩余 -</div>' +
    '<div class="rogue-mechs">' + mechInfo + '</div>' +
    '</div>' +
    '<div class="rogue-team-head"><span>本局队伍（' + R.team.length + '/' + CONFIG.ROGUE.TEAM_LIMIT + '）</span>' +
    '<span class="hint">战力 ' + rogueFmt(rogueTeamPower()) + '</span></div>' +
    '<div class="rogue-team">' + (R.team.length ? R.team.map(rogueCardHTML).join('') : '<span class="hint">等待第一张卡…</span>') + '</div>' +
    '<div class="rogue-bank" id="rogue-bank-text"></div>' +
    '<div class="btn-row"><button class="btn danger" data-rogue="retreat">撤退结算（当前波不计入）</button></div>' +
    '</div>';
}

function rogueHomeHTML() {
  return '<div class="panel">' +
    '<h3>冒险（肉鸽）</h3>' +
    '<p>从你<b>已拥有的卡</b>里三选一组建 5 人队伍，迎战一波比一波强的怪物，无限波。<b>上阵会消耗一张该卡</b>（至少留一张在包），结算后不返还。滚动立约 3~5 波：未达承诺（含主动撤退）<b>本段赚到的金币全部没收</b>，已兑现段落锁定；立约满 5 波且达成，续约时附赠奖励卡。每波限时 ' + CONFIG.ROGUE.WAVE_TIMEOUT + ' 秒。</p>' +
    '<p><b>弱点时刻</b>：怪物发亮时点击它，造成一次必定暴击的重击；离线挂机由「弱点直觉」等级概率自动命中。</p>' +
    '<p><b>流派机制</b>：每张卡自带 1 层流派被动，强化每 3 级再 +1 层；同族卡层数累加共享，专精一族收益最大；强化 3 次触发<b>超进化</b>，战力大幅增强。</p>' +
    '<p>三选一可花金币重掷；偶尔出现事件卡。碎片按波数结算：每通过一波 = 当前抽数率挂机 ' + CONFIG.ROGUE.FRAG_WAVE_SECS + ' 秒的收益 ×' + CONFIG.ROGUE.FRAG_EQUIV_MULT + '，同战力同波奖励恒定。金币随波数递增，用于下方局外养成。</p>' +
    '<p>随时可撤退结算，本局收益不丢；离开页面本局暂停。</p>' +
    '<div class="btn-row"><button class="btn primary" data-rogue="start">开始冒险</button></div>' +
    '</div>' + rogueBestHTML() + rogueUpgradesHTML();
}

function rogueResultHTML() {
  const r = rogueLastResult;
  const mins = r.secs / 60;
  return '<div class="panel">' +
    '<h3>' + (r.timedOut ? '超时结算' : '撤退结算') + (r.isBest ? ' 🏆 新纪录！' : '') + '</h3>' +
    '<div class="kv"><span>通过波次</span><b>' + r.wins + ' 波</b></div>' +
    '<div class="kv"><span>战斗时长</span><b>' + (mins >= 1 ? mins.toFixed(1) + ' 分钟' : r.secs + ' 秒') + '</b></div>' +
    '<div class="kv"><span>碎片收益</span><b>+' + r.frags.toLocaleString() + (r.msFrag > 0 ? ' <span class="hint">（基础 ' + r.baseFrags + ' + 里程碑 ' + r.msFrag.toLocaleString() + '）</span>' : '') + '</b></div>' +
    (r.penalty > 0 ? '<div class="kv"><span>未达 ' + r.goal + ' 波目标</span><b class="miss-text">-' + fmtSci(r.penalty) + ' 金币</b></div>' : '') +
    '<div class="kv"><span>金币收益</span><b>+' + fmtSci(r.coins) + '</b></div>' +
    '<div class="btn-row"><button class="btn primary" data-rogue="start">再来一局</button></div>' +
    '</div>' + rogueBestHTML() + rogueUpgradesHTML();
}

let rogueViewCache = null;
function renderRogue() {
  const v = $id('rogue-view');
  if (!v) return;
  let html;
  if (S.rogue && S.rogue.awaiting) html = '<div class="panel"><h3>冒险进行中</h3><p class="hint">' + (S.rogue.goal ? '契约到期，续约后继续。' : '先选定本局目标波数，再开始选卡。') + '</p><div class="btn-row"><button class="btn primary" data-rogue="showgoal">立约</button></div></div>';
  else if (S.rogue) html = rogueRunHTML();
  else if (rogueLastResult) html = rogueResultHTML();
  else html = rogueHomeHTML();
  if (rogueViewCache !== html) {
    rogueViewCache = html;
    rogueDyn = null;
    v.innerHTML = html;
  }
  renderRoguePick();
  rogueUpdateDyn();
}

function rogueUpdateDyn() {
  if (!S.rogue) return;
  if (!rogueDyn) {
    const fill = $id('rogue-hp-fill');
    const txt = $id('rogue-hp-text');
    const bank = $id('rogue-bank-text');
    if (!fill || !txt || !bank) return;
    rogueDyn = { fill, txt, bank, weakEl: $id('rogue-monster-click'), weakOn: null };
  }
  const R = S.rogue;
  const timeout = rogueTimeout();
  const pct = Math.max(0, Math.min(100, R.waveHpLeft / R.waveHpMax * 100));
  const left = Math.max(0, timeout - R.waveSecs);
  rogueDyn.fill.style.width = pct + '%';
  rogueDyn.txt.textContent = '怪物 HP ' + rogueFmt(Math.max(0, R.waveHpLeft)) + ' / ' + rogueFmt(R.waveHpMax) + ' · 剩余 ' + left.toFixed(1) + 's';
  const bankTxt = '金币 <b>' + fmtSci(R.bank) + '</b>（本波 +' + fmtSci(rogueWaveCoins(R.wave)) + '）· 已获基础碎片 <b>' + rogueRunFrags().toLocaleString() + '</b>';
  if (rogueDyn.bank.innerHTML !== bankTxt) rogueDyn.bank.innerHTML = bankTxt;
  if (rogueDyn.weakEl) {
    const on = !!R.weakActive && !R.weakUsed && performance.now() <= (R.weakEnd || 0);
    if (rogueDyn.weakOn !== on) {
      rogueDyn.weakOn = on;
      rogueDyn.weakEl.classList.toggle('weak-on', on);
    }
  }
}