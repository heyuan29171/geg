const SAVE_KEY = 'geg_save_v1';

function defaultSave() {
  const owned = {};
  CARDS.forEach(c => { if (c.start) owned[c.id] = 1; });
  const rarityCounts = {};
  RARITY_LIST.forEach(r => { rarityCounts[r.id] = 0; });
  return {
    v: 1,
    owned: owned,
    fragments: 0,
    activeCenter: 'egg-rainbow',
    monsterLevel: 1,
    kills: 0,
    totalPulls: 0,
    rarityCounts: rarityCounts,
    log: [],
    updatedAt: Date.now(),
  };
}

function num(v, def, min, max) {
  const n = typeof v === 'number' && isFinite(v) ? v : def;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function sanitize(raw) {
  const d = defaultSave();
  if (!raw || typeof raw !== 'object') return d;
  const s = {
    v: 1,
    owned: {},
    fragments: num(raw.fragments, 0, 0, 1e12),
    activeCenter: typeof raw.activeCenter === 'string' && CARD_MAP[raw.activeCenter] ? raw.activeCenter : d.activeCenter,
    monsterLevel: num(raw.monsterLevel, 1, 1, 1e7),
    kills: num(raw.kills, 0, 0, 1e12),
    totalPulls: num(raw.totalPulls, 0, 0, 1e12),
    rarityCounts: {},
    log: Array.isArray(raw.log) ? raw.log.slice(0, 12) : [],
    updatedAt: num(raw.updatedAt, Date.now(), 0, Date.now()),
  };
  CARDS.forEach(c => {
    const rawOwned = raw.owned && typeof raw.owned === 'object' ? raw.owned : {};
    const def = c.start ? 1 : 0;
    const n = num(rawOwned[c.id], def, 0, 1e9);
    s.owned[c.id] = c.start && n === 0 ? 1 : n;
  });
  RARITY_LIST.forEach(r => {
    const rawRc = raw.rarityCounts && typeof raw.rarityCounts === 'object' ? raw.rarityCounts : {};
    s.rarityCounts[r.id] = num(rawRc[r.id], 0, 0, 1e12);
  });
  return s;
}

const Save = {
  load() {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { raw = null; }
    return sanitize(raw);
  },
  write(S) {
    S.updatedAt = Date.now();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { }
  },
  export(S) {
    const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'geg-save.json';
    a.click();
    URL.revokeObjectURL(a.href);
  },
  importFile(file, onDone) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const s = sanitize(JSON.parse(reader.result));
        localStorage.setItem(SAVE_KEY, JSON.stringify(s));
        onDone && onDone(true);
      } catch (e) {
        onDone && onDone(false);
      }
    };
    reader.onerror = () => onDone && onDone(false);
    reader.readAsText(file);
  },
  reset() {
    localStorage.removeItem(SAVE_KEY);
  },
};
