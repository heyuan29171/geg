const INSTANCE = new URLSearchParams(location.search).get('save');
const SAVE_KEY = 'geg_save_v1' + (INSTANCE ? '_' + INSTANCE : '');
const SAVE_MAGIC = 'GEG1';
const XOR_SEED = 137;
const XOR_KEY = 0x5A;
let lastWritten = null;

function encodeSave(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let seed = XOR_SEED;
  for (let i = 0; i < bytes.length; i++) {
    seed = (seed * 31 + 7) & 0xFFFF;
    bytes[i] ^= (seed ^ XOR_KEY) & 0xFF;
  }
  let ck = 0xABCD;
  for (let i = 0; i < bytes.length; i++) ck = ((ck * 33) ^ bytes[i]) & 0xFFFF;
  const out = new Uint8Array(bytes.length + 2);
  out.set(bytes);
  out[bytes.length] = (ck >> 8) & 0xFF;
  out[bytes.length + 1] = ck & 0xFF;
  let bin = '';
  for (let i = 0; i < out.length; i++) bin += String.fromCharCode(out[i]);
  return SAVE_MAGIC + btoa(bin);
}

function decodeSave(str) {
  if (typeof str !== 'string' || str.slice(0, SAVE_MAGIC.length) !== SAVE_MAGIC) return null;
  let bin;
  try { bin = atob(str.slice(SAVE_MAGIC.length)); } catch (e) { return null; }
  if (bin.length < 2) return null;
  const n = bin.length - 2;
  let ck = 0xABCD;
  for (let i = 0; i < n; i++) ck = ((ck * 33) ^ bin.charCodeAt(i)) & 0xFFFF;
  if (bin.charCodeAt(n) !== ((ck >> 8) & 0xFF) ||
      bin.charCodeAt(n + 1) !== (ck & 0xFF)) return null;
  const bytes = new Uint8Array(n);
  let seed = XOR_SEED;
  for (let i = 0; i < n; i++) {
    seed = (seed * 31 + 7) & 0xFFFF;
    bytes[i] = bin.charCodeAt(i) ^ ((seed ^ XOR_KEY) & 0xFF);
  }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch (e) { return null; }
}

function defaultSave() {
  const owned = {};
  const ownedAt = {};
  const now = Date.now();
  CARDS.forEach(c => {
    if (c.start) { owned[c.id] = 1; ownedAt[c.id] = now; }
  });
  const rarityCounts = {};
  RARITY_LIST.forEach(r => { rarityCounts[r.id] = 0; });
  return {
    v: 1,
    owned: owned,
    ownedAt: ownedAt,
    fragments: 0,
    activeCenter: 'egg-rainbow',
    monsterLevel: 1,
    kills: 0,
    totalPulls: 0,
    monsterClicks: 0,
    rarityCounts: rarityCounts,
    log: [],
    tutorial: 0,
    theme: 'light',
    artMode: 'img',
    eggUpgraded: false,
    achievements: {},
    fragEarnedTotal: 0,
    homeNest: { a: null, b: null, startedAt: 0, hatchAt: 0, ready: false },
    extraNests: [],
    nestHatches: 0,
    pityStock: { purple: 0, gold: 0, black: 0 },
    pityBought: { purple: 0, gold: 0, black: 0 },
    cosmetics: { gradFrame: false },
    shiny: {},
    shinySeen: false,
    coins: 0,
    rogueUpgrades: { time: 0, damage: 0, crit: 0, critd: 0, weakauto: 0 },
    rogue: null,
    rogueBest: null,
    updatedAt: Date.now(),
  };
}

function num(v, def, min, max) {
  const n = typeof v === 'number' && isFinite(v) ? v : def;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function sanitize(raw) {
  const d = defaultSave();
  if (!raw || typeof raw !== 'object' || raw.v !== 1) return d;
  const s = {
    v: 1,
    owned: {},
    ownedAt: {},
    fragments: num(raw.fragments, 0, 0, 1e12),
    activeCenter: typeof raw.activeCenter === 'string' && CARD_MAP[raw.activeCenter] ? raw.activeCenter : d.activeCenter,
    monsterLevel: num(raw.monsterLevel, 1, 1, 1e7),
    kills: num(raw.kills, 0, 0, 1e12),
    totalPulls: num(raw.totalPulls, 0, 0, 1e12),
    monsterClicks: num(raw.monsterClicks, 0, 0, 1e12),
    rarityCounts: {},
    log: Array.isArray(raw.log) ? raw.log.slice(0, 12) : [],
    tutorial: raw.tutorial != null ? num(raw.tutorial, 0, 0, 4) : ((raw.totalPulls || 0) > 0 ? 4 : 0),
    theme: raw.theme === 'dark' ? 'dark' : 'light',
    artMode: raw.artMode === 'emoji' ? 'emoji' : 'img',
    eggUpgraded: !!raw.eggUpgraded,
    achievements: raw.achievements && typeof raw.achievements === 'object' ? raw.achievements : {},
    fragEarnedTotal: num(raw.fragEarnedTotal, 0, 0, 1e15),
    homeNest: sanitizeNest(raw.homeNest),
    extraNests: sanitizeExtraNests(raw.extraNests),
    nestHatches: num(raw.nestHatches, 0, 0, 1e9),
    pityStock: sanitizePityCounts(raw.pityStock),
    pityBought: sanitizePityCounts(raw.pityBought),
    cosmetics: {
      gradFrame: !!(raw.cosmetics && raw.cosmetics.gradFrame),
    },
    shiny: sanitizeShiny(raw.shiny),
    shinySeen: !!raw.shinySeen,
    coins: num(raw.coins, 0, 0, 1e15),
    rogueUpgrades: sanitizeRogueUpgrades(raw.rogueUpgrades),
    rogue: sanitizeRogue(raw.rogue),
    rogueBest: sanitizeRogueBest(raw.rogueBest),
    updatedAt: num(raw.updatedAt, Date.now(), 0, Date.now()),
  };
  CARDS.forEach(c => {
    const rawOwned = raw.owned && typeof raw.owned === 'object' ? raw.owned : {};
    const def = c.start ? 1 : 0;
    const n = num(rawOwned[c.id], def, 0, 1e9);
    s.owned[c.id] = c.unique ? Math.min(n, 1) : (c.start && n === 0 ? 1 : n);
  });
  const rawOwnedAt = raw.ownedAt && typeof raw.ownedAt === 'object' ? raw.ownedAt : {};
  CARDS.forEach(c => {
    s.ownedAt[c.id] = rawOwnedAt[c.id] != null
      ? num(rawOwnedAt[c.id], 0, 0, Date.now())
      : (c.start ? s.updatedAt : 0);
  });
  RARITY_LIST.forEach(r => {
    const rawRc = raw.rarityCounts && typeof raw.rarityCounts === 'object' ? raw.rarityCounts : {};
    s.rarityCounts[r.id] = num(rawRc[r.id], 0, 0, 1e12);
  });
  return s;
}

function sanitizeNest(raw) {
  const n = { a: null, b: null, startedAt: 0, hatchAt: 0, ready: false };
  if (!raw || typeof raw !== 'object') return n;
  const ok = id => typeof id === 'string' && CARD_MAP[id] && CARD_MAP[id].id !== 'egg-rainbow' && CARD_MAP[id].id !== 'egg-rainbow-x';
  const a = ok(raw.a) ? raw.a : null;
  const b = ok(raw.b) && raw.b !== a ? raw.b : null;
  n.a = a;
  n.b = b;
  n.startedAt = num(raw.startedAt, 0, 0, Date.now());
  n.hatchAt = num(raw.hatchAt, 0, 0, Date.now() + 1e8);
  n.ready = !!raw.ready;
  if (!a || !b) { n.startedAt = 0; n.hatchAt = 0; n.ready = false; }
  return n;
}

function sanitizeExtraNests(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 3).map(sanitizeNest);
}

function sanitizePityCounts(raw) {
  const out = { purple: 0, gold: 0, black: 0 };
  if (!raw || typeof raw !== 'object') return out;
  ['purple', 'gold', 'black'].forEach(k => {
    out[k] = num(raw[k], 0, 0, 1e9);
  });
  return out;
}

function sanitizeShiny(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  Object.keys(raw).forEach(id => {
    if (CARD_MAP[id] && CARD_MAP[id].id !== 'egg-rainbow' && CARD_MAP[id].id !== 'egg-rainbow-x') {
      const t = num(raw[id], 0, 0, Date.now());
      if (t > 0) out[id] = t;
    }
  });
  return out;
}

function sanitizeRogueUpgrades(raw) {
  const u = { time: 0, damage: 0, crit: 0, critd: 0, weakauto: 0 };
  if (raw && typeof raw === 'object') {
    const ups = CONFIG.ROGUE.UPGRADES;
    Object.keys(ups).forEach(k => { u[k] = num(raw[k], 0, 0, ups[k].max); });
  }
  return u;
}

function rogueNum(v, def) {
  return typeof v === 'number' && isFinite(v) ? v : def;
}

function sanitizeRogue(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    team: Array.isArray(raw.team) ? raw.team.filter(s => s && typeof s.id === 'string' && CARD_MAP[s.id]).map(s => ({
      id: s.id,
      lv: num(s.lv, 0, 0, 1e4),
    })) : [],
    wave: num(raw.wave, 1, 1, 1e6),
    baseInterval: rogueNum(raw.baseInterval, CONFIG.INTERVAL_BASE),
    waveHpMax: rogueNum(raw.waveHpMax, 0),
    waveHpLeft: rogueNum(raw.waveHpLeft, 0),
    waveSecs: rogueNum(raw.waveSecs, 0),
    attackAcc: rogueNum(raw.attackAcc, 0),
    smashT: rogueNum(raw.smashT, 0),
    bank: rogueNum(raw.bank, 0),
    battleSecs: rogueNum(raw.battleSecs, 0),
    offer: Array.isArray(raw.offer) && raw.offer.length ? raw.offer.filter(o => {
      if (!o || typeof o !== 'object') return false;
      if (o.kind === 'event') return !!CONFIG.ROGUE.EVENTS[o.eventId];
      return typeof o.id === 'string' && !!CARD_MAP[o.id];
    }) : null,
    rerollN: num(raw.rerollN, 0, 0, CONFIG.ROGUE.REROLL_MAX),
    powerMult: rogueNum(raw.powerMult, 1),
    goal: raw.goal == null ? 0 : num(raw.goal, 0, 0, 5),
    lastGoal: rogueNum(raw.lastGoal, null),
    awaiting: !!raw.awaiting,
    segBankStart: num(raw.segBankStart, 0, 0, 1e15),
    segStartWave: num(raw.segStartWave, 0, 0, 1e9),
    goalPaid: !!raw.goalPaid,
    bonusLayer: (function () {
      const out = {};
      if (raw.bonusLayer && typeof raw.bonusLayer === 'object') {
        Object.keys(CONFIG.ROGUE.MECHANICS).forEach(m => {
          const v = num(raw.bonusLayer[m], 0, 0, 1e4);
          if (v > 0) out[m] = v;
        });
      }
      return out;
    })(),
    weakAt: rogueNum(raw.weakAt, Date.now() + CONFIG.ROGUE.WEAK_EVERY * 1000),
    weakActive: !!raw.weakActive,
    weakEnd: rogueNum(raw.weakEnd, 0),
    weakUsed: !!raw.weakUsed,
    startedAt: num(raw.startedAt, 0, 0, Date.now() + 1e9),
  };
}

function sanitizeRogueBest(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.team) || !raw.team.length) return null;
  return {
    wave: num(raw.wave, 0, 0, 1e6),
    team: raw.team.filter(s => s && typeof s.id === 'string' && CARD_MAP[s.id]).map(s => ({
      id: s.id,
      lv: num(s.lv, 0, 0, 1e4),
    })),
    frags: num(raw.frags, 0, 0, 1e15),
    coins: num(raw.coins, 0, 0, 1e15),
    secs: num(raw.secs, 0, 0, 1e7),
    updatedAt: num(raw.updatedAt, Date.now(), 0, Date.now()),
  };
}

const Save = {
  load() {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { raw = null; }
    return sanitize(raw);
  },
  write(S) {
    if (typeof document === 'undefined' || !document.hidden) S.updatedAt = Date.now();
    const json = JSON.stringify(S);
    if (json === lastWritten) return;
    lastWritten = json;
    try { localStorage.setItem(SAVE_KEY, json); } catch (e) { }
  },
  export(S) {
    const blob = new Blob([encodeSave(S)], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'geg-save' + (INSTANCE ? '-' + INSTANCE : '') + '.geg';
    a.click();
    URL.revokeObjectURL(a.href);
  },
  importFile(file, onDone) {
    const reader = new FileReader();
    reader.onload = () => {
      const obj = decodeSave(reader.result);
      if (!obj) {
        onDone && onDone(false);
        return;
      }
      const s = sanitize(obj);
      localStorage.setItem(SAVE_KEY, JSON.stringify(s));
      onDone && onDone(true);
    };
    reader.onerror = () => onDone && onDone(false);
    reader.readAsText(file);
  },
  reset() {
    localStorage.removeItem(SAVE_KEY);
    lastWritten = null;
  },
};
