// draft.js — the weaving model: threading, tie-up, treadling, and the
// drawdown that falls out of them. No rendering here, only cloth logic.

export const ENDS = 32;   // warp threads in one repeat
export const PICKS = 32;  // weft threads in one repeat

// Real looms pair a shaft count with a treadle count; 4 shafts almost always
// means 6 treadles (4 pattern + 2 tabby), 8 shafts means 10.
export const LOOMS = { 4: 6, 8: 10 };

export const PALETTE = [
  '#f2ece1', // undyed
  '#1b2430', // indigo-black
  '#b8442f', // madder
  '#e0a52e', // weld
  '#2f5d54', // pine
  '#7c5aa6', // logwood
  '#8d9aa8', // slate
  '#d9788f', // cochineal
];

export function makeDraft(shafts = 4) {
  const treadles = LOOMS[shafts];
  const d = {
    shafts,
    treadles,
    threading: new Array(ENDS).fill(0),
    treadling: new Array(PICKS).fill(0),
    tieup: Array.from({ length: treadles }, () => new Array(shafts).fill(false)),
    warpColor: new Array(ENDS).fill(1),
    weftColor: new Array(PICKS).fill(0),
  };
  applyThreading(d, 'straight');
  applyTieup(d, 'balanced');
  applyTreadling(d, 'straight');
  applyColors(d, 'solid');
  return d;
}

/* ---------------------------------------------------------------- threading */

export const THREADINGS = {
  straight: { label: () => 'Straight draw', fn: (i, S) => i % S },
  point: {
    label: () => 'Point / rosepath',
    fn: (i, S) => {
      const period = 2 * S - 2;
      const v = i % period;
      return v < S ? v : period - v;
    },
  },
  advancing: {
    label: () => 'Advancing twill',
    fn: (i, S) => (i + Math.floor(i / S)) % S,
  },
  broken: {
    label: () => 'Broken twill',
    fn: (i, S) => {
      // straight run, then the same run offset half a repeat
      const block = Math.floor(i / S);
      return (i % S + (block % 2 ? S / 2 : 0)) % S;
    },
  },
  blocks: {
    label: () => 'Blocks (M’s & O’s)',
    fn: (i, S) => {
      const pairs = S / 2;
      const block = Math.floor(i / 8) % pairs;
      return block * 2 + (i % 2);
    },
  },
};

export function applyThreading(d, name) {
  const p = THREADINGS[name];
  if (!p) return;
  for (let i = 0; i < ENDS; i++) d.threading[i] = p.fn(i, d.shafts) % d.shafts;
}

/* ------------------------------------------------------------------- tie-up */

// A tie-up says which shafts each treadle raises (rising shed). Twills raise a
// run of `up` adjacent shafts, walking the run one shaft per treadle.
function twill(d, up) {
  const { shafts: S, treadles: T } = d;
  clearTieup(d);
  const pattern = Math.min(S, T);
  for (let t = 0; t < pattern; t++) {
    for (let k = 0; k < up; k++) d.tieup[t][(t + k) % S] = true;
  }
  // spare treadles get the tabby pair, exactly as a real 4-shaft tie-up does
  for (let t = pattern; t < T; t++) {
    const odd = (t - pattern) % 2;
    for (let s = 0; s < S; s++) if (s % 2 === odd) d.tieup[t][s] = true;
  }
}

// Twill names are ratios of raised:lowered shafts, so the same structure is
// called 2/2 on four shafts and 4/4 on eight. Labels are computed, never
// hardcoded — calling a 7/1 twill "3/1" because it looked right on 4 shafts is
// exactly the kind of lie that makes a draft untrustworthy.
const ratio = (up, S) => `${up}/${S - up} twill`;

export const TIEUPS = {
  tabby: {
    label: () => 'Plain weave (tabby)',
    fn: (d) => {
      clearTieup(d);
      for (let t = 0; t < d.treadles; t++)
        for (let s = 0; s < d.shafts; s++) if (s % 2 === t % 2) d.tieup[t][s] = true;
    },
  },
  balanced: {
    label: (S) => `${ratio(S / 2, S)} (balanced) + tabby`,
    fn: (d) => twill(d, d.shafts / 2),
  },
  warpface: {
    label: (S) => `${ratio(S - 1, S)} (warp-faced) + tabby`,
    fn: (d) => twill(d, d.shafts - 1),
  },
  weftface: {
    label: (S) => `${ratio(1, S)} (weft-faced) + tabby`,
    fn: (d) => twill(d, 1),
  },
  satin: {
    label: () => 'Satin / spot',
    fn: (d) => {
      const { shafts: S, treadles: T } = d;
      clearTieup(d);
      const step = S === 8 ? 3 : 2;
      for (let t = 0; t < Math.min(S, T); t++) {
        d.tieup[t][(t * step) % S] = true;
        d.tieup[t][(t * step + 1) % S] = true;
      }
      for (let t = S; t < T; t++)
        for (let s = 0; s < S; s++) if (s % 2 === (t - S) % 2) d.tieup[t][s] = true;
    },
  },
};

export function clearTieup(d) {
  for (const row of d.tieup) row.fill(false);
}

export function applyTieup(d, name) {
  const p = TIEUPS[name];
  if (p) p.fn(d);
}

/* ---------------------------------------------------------------- treadling */

export const TREADLINGS = {
  straight: {
    label: () => 'Straight (walk the treadles)',
    fn: (d, p) => p % Math.min(d.shafts, d.treadles),
  },
  point: {
    label: () => 'Point (zigzag)',
    fn: (d, p) => {
      const S = Math.min(d.shafts, d.treadles);
      const period = 2 * S - 2;
      const v = p % period;
      return v < S ? v : period - v;
    },
  },
  tabby: {
    label: () => 'Tabby only',
    fn: (d, p) => d.treadles - 2 + (p % 2),
  },
  writ: {
    label: () => 'Tromp as writ (mirror threading)',
    fn: (d, p) => d.threading[p % ENDS] % d.treadles,
  },
  pattabby: {
    label: () => 'Pattern alternating tabby',
    fn: (d, p) =>
      p % 2 === 0
        ? Math.floor(p / 2) % Math.min(d.shafts, d.treadles)
        : d.treadles - 2 + (Math.floor(p / 2) % 2),
  },
};

export function applyTreadling(d, name) {
  const p = TREADLINGS[name];
  if (!p) return;
  for (let i = 0; i < PICKS; i++) d.treadling[i] = p.fn(d, i) % d.treadles;
}

/* ------------------------------------------------------------------- colour */

export const COLORWAYS = {
  solid: {
    label: () => 'Solid (undyed warp)',
    fn: (d) => {
      d.warpColor.fill(0);
      d.weftColor.fill(1);
    },
  },
  logcabin: {
    label: () => 'Log cabin',
    fn: (d) => {
      // alternate light/dark end to end; flip the phase every 8 threads
      for (let i = 0; i < ENDS; i++) {
        const phase = Math.floor(i / 8) % 2;
        d.warpColor[i] = (i + phase) % 2 ? 1 : 0;
      }
      for (let i = 0; i < PICKS; i++) {
        const phase = Math.floor(i / 8) % 2;
        d.weftColor[i] = (i + phase) % 2 ? 1 : 0;
      }
    },
  },
  stripes: {
    label: () => 'Warp stripes',
    fn: (d) => {
      const cols = [0, 2, 0, 4];
      for (let i = 0; i < ENDS; i++) d.warpColor[i] = cols[Math.floor(i / 4) % cols.length];
      d.weftColor.fill(1);
    },
  },
  shadow: {
    label: () => 'Shadow weave',
    fn: (d) => {
      for (let i = 0; i < ENDS; i++) d.warpColor[i] = i % 2 ? 1 : 0;
      for (let i = 0; i < PICKS; i++) d.weftColor[i] = i % 2 ? 0 : 1;
    },
  },
  plaid: {
    label: () => 'Plaid',
    fn: (d) => {
      const cols = [1, 1, 2, 0, 0, 4, 0, 0];
      for (let i = 0; i < ENDS; i++) d.warpColor[i] = cols[Math.floor(i / 2) % cols.length];
      for (let i = 0; i < PICKS; i++) d.weftColor[i] = cols[Math.floor(i / 2) % cols.length];
    },
  },
};

export function applyColors(d, name) {
  const p = COLORWAYS[name];
  if (p) p.fn(d);
}

/* ---------------------------------------------------------------- drawdown */

// The whole point of a draft: end e is lifted on pick p when the treadle used
// for that pick is tied to the shaft that end is threaded through.
export function isWarpUp(d, e, p) {
  return d.tieup[d.treadling[p % PICKS]][d.threading[e % ENDS]];
}

/* -------------------------------------------------------- structure report */

// Longest cyclic run of `want` in a boolean sequence. Cyclic because the
// drawdown is one repeat of an endless cloth.
function maxCyclicRun(seq, want) {
  const n = seq.length;
  if (seq.every((v) => v === want)) return n;
  let best = 0;
  let run = 0;
  for (let i = 0; i < n * 2; i++) {
    if (seq[i % n] === want) {
      run++;
      if (run > best) best = run;
    } else run = 0;
  }
  return Math.min(best, n);
}

export function analyze(d) {
  let warpFloat = 0; // warp passing over consecutive picks
  let weftFloat = 0; // weft passing over consecutive ends
  let looseEnds = 0;
  let up = 0;

  for (let e = 0; e < ENDS; e++) {
    const col = [];
    for (let p = 0; p < PICKS; p++) col.push(isWarpUp(d, e, p));
    const f = maxCyclicRun(col, true);
    if (f === PICKS || maxCyclicRun(col, false) === PICKS) looseEnds++;
    warpFloat = Math.max(warpFloat, f);
  }
  for (let p = 0; p < PICKS; p++) {
    const row = [];
    for (let e = 0; e < ENDS; e++) {
      const u = isWarpUp(d, e, p);
      row.push(u);
      if (u) up++;
    }
    weftFloat = Math.max(weftFloat, maxCyclicRun(row, false));
  }

  const faceWarp = up / (ENDS * PICKS);
  const plain = warpFloat === 1 && weftFloat === 1;

  const notes = [];
  if (plain) notes.push({ kind: 'ok', text: 'Perfect plain weave — every intersection alternates.' });
  else if (warpFloat <= 3 && weftFloat <= 3)
    notes.push({ kind: 'ok', text: 'Floats stay short; this would weave into stable cloth.' });

  const worst = Math.max(warpFloat, weftFloat);
  if (worst >= 4 && worst < 8)
    notes.push({ kind: 'warn', text: `Floats up to ${worst} threads — glossy, but it will snag.` });
  if (worst >= 8 && worst < ENDS)
    notes.push({ kind: 'bad', text: `Floats of ${worst} threads. Sleazy cloth: too little interlacement.` });
  if (looseEnds)
    notes.push({
      kind: 'bad',
      text: `${looseEnds} warp end${looseEnds > 1 ? 's' : ''} never interlace — untied to the cloth.`,
    });
  const deadTreadles = d.tieup.filter((r, t) => d.treadling.includes(t) && r.every((v) => !v)).length;
  if (deadTreadles)
    notes.push({ kind: 'bad', text: `${deadTreadles} treadle(s) in use raise no shafts — those picks lay flat.` });
  if (faceWarp > 0.72) notes.push({ kind: 'info', text: 'Warp-faced: the warp dominates the surface.' });
  if (faceWarp < 0.28) notes.push({ kind: 'info', text: 'Weft-faced: the weft covers the warp.' });

  const usedShafts = new Set(d.threading).size;
  const usedTreadles = new Set(d.treadling).size;

  return { warpFloat, weftFloat, faceWarp, plain, notes, usedShafts, usedTreadles };
}

/* ----------------------------------------------------------------- surprise */

// Deterministic PRNG so a seed reproduces a draft exactly.
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

// A random tie-up is usually *unweavable*, and the failure is not obvious: what
// matters is not "does every treadle raise something" but "does every shaft go
// both up and down across the treadles this treadling actually presses". A
// shaft that is always up (or always down) over the woven picks leaves its warp
// ends floating the full repeat — cloth that falls apart in the hand.
function randomTieup(d, r) {
  const S = d.shafts;
  const used = [...new Set(d.treadling)];
  clearTieup(d);

  for (let s = 0; s < S; s++) {
    if (used.length < 2) {
      d.tieup[used[0]][s] = r() < 0.5;
      continue;
    }
    let col;
    do {
      col = used.map(() => r() < 0.5);
    } while (col.every((v) => v) || col.every((v) => !v));
    used.forEach((t, i) => { d.tieup[t][s] = col[i]; });
  }

  // Treadles this treadling never presses still show in the tie-up, so give
  // them something plausible rather than leaving them blank.
  for (let t = 0; t < d.treadles; t++) {
    if (used.includes(t)) continue;
    const count = 1 + Math.floor(r() * (S - 1));
    const start = Math.floor(r() * S);
    for (let k = 0; k < count; k++) d.tieup[t][(start + k) % S] = true;
  }

  // No woven pick may lie flat (nothing raised) or lift the whole warp.
  return used.every((t) => {
    const row = d.tieup[t];
    return row.some((v) => v) && row.some((v) => !v);
  });
}

// Random but *weavable*: propose, then check the cloth actually holds together.
export function surprise(d, seed) {
  const r = rng(seed);
  const choose = (obj) => {
    const keys = Object.keys(obj);
    return keys[Math.floor(r() * keys.length)];
  };

  for (let attempt = 0; attempt < 80; attempt++) {
    applyThreading(d, choose(THREADINGS));
    applyTreadling(d, choose(TREADLINGS));
    applyColors(d, choose(COLORWAYS));
    if (!randomTieup(d, r)) continue;
    const a = analyze(d);
    if (a.notes.some((n) => n.kind === 'bad')) continue;
    if (Math.max(a.warpFloat, a.weftFloat) > 6) continue;
    return seed;
  }
  // Vanishingly unlikely, but never hand back cloth that won't hold.
  applyTieup(d, 'balanced');
  return seed;
}

/* --------------------------------------------------------------- WIF export */

// WIF (Weaving Information File) is the real interchange format weaving
// software has traded drafts in since 1997. It's an INI file.
export function toWIF(d) {
  const pad = (n) => String(n).padStart(2, '0');
  const now = new Date();
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const L = [];
  const section = (name, lines) => {
    L.push(`[${name}]`);
    L.push(...lines);
    L.push('');
  };

  const hex = (h) => {
    const m = /^#(\w\w)(\w\w)(\w\w)$/.exec(h);
    return `${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)}`;
  };

  section('WIF', ['Version=1.1', `Date=${date}`, 'Developers=daily-slop/loom-drafter', 'Source Program=loom-drafter', 'Source Version=1.0']);
  section('CONTENTS', ['COLOR PALETTE=yes', 'TEXT=yes', 'WEAVING=yes', 'WARP=yes', 'WEFT=yes', 'COLOR TABLE=yes', 'THREADING=yes', 'TIEUP=yes', 'TREADLING=yes']);
  section('TEXT', ['Title=loom-drafter draft', 'Author=woven in a browser']);
  section('WEAVING', [`Shafts=${d.shafts}`, `Treadles=${d.treadles}`, 'Rising Shed=yes']);
  section('WARP', [`Threads=${ENDS}`, 'Units=Decipoints', 'Thickness=10', `Color=${d.warpColor[0] + 1}`]);
  section('WEFT', [`Threads=${PICKS}`, 'Units=Decipoints', 'Thickness=10', `Color=${d.weftColor[0] + 1}`]);
  section('COLOR PALETTE', [`Entries=${PALETTE.length}`, 'Form=RGB', 'Range=0,255']);
  section('COLOR TABLE', PALETTE.map((c, i) => `${i + 1}=${hex(c)}`));
  section('THREADING', d.threading.map((s, i) => `${i + 1}=${s + 1}`));
  section('WARP COLORS', d.warpColor.map((c, i) => `${i + 1}=${c + 1}`));
  section('TREADLING', d.treadling.map((t, i) => `${i + 1}=${t + 1}`));
  section('WEFT COLORS', d.weftColor.map((c, i) => `${i + 1}=${c + 1}`));
  section(
    'TIEUP',
    d.tieup.map((row, t) => {
      const on = row.map((v, s) => (v ? s + 1 : 0)).filter(Boolean);
      return `${t + 1}=${on.join(',')}`;
    })
  );
  return L.join('\n');
}
