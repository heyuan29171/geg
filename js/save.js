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
    rarityCounts: rarityCounts,
    log: [],
    tutorial: 0,
    theme: 'light',
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
    rarityCounts: {},
    log: Array.isArray(raw.log) ? raw.log.slice(0, 12) : [],
    tutorial: raw.tutorial != null ? num(raw.tutorial, 0, 0, 4) : ((raw.totalPulls || 0) > 0 ? 4 : 0),
    theme: raw.theme === 'dark' ? 'dark' : 'light',
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
  CARDS.forEach(c => {
    if (!c.start && s.owned[c.id] > 0 && rawOwnedAt[c.id] == null) {
      delete s.owned[c.id];
      delete s.ownedAt[c.id];
    }
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
