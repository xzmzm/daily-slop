// engine.js — Mendelian cat-coat genetics, pure (no DOM), Node-testable.
// Used by app.js in the browser and by test_engine.js in Node.
//
// The model is real mammalian coat genetics, simplified to the biallelic
// loci that most govern a cat's visible appearance:
//
//   Orange  O/o   X-linked (the star). O = orange pigment; o = non-orange.
//   Brown   B/b   autosomal. B = black eumelanin; b = chocolate (b < B).
//   Agouti  A/a   autosomal. A = tabby banding shows; a = solid.
//   Dilute  D/d   autosomal recessive. d/d fades black→blue, orange→cream.
//   Spot    S/s   autosomal, INCOMPLETE dominance. ss none, Ss bicolor,
//                 SS high-white. (demonstrates incomplete vs full dominance)
//   White   W/w   autosomal DOMINANT EPISTASIS. W/_ = all white, masks all.
//   Length  L/l   autosomal recessive. l/l = longhair.
//
// Males are XY (one X → one orange allele); females are XX (two). Sons get
// their only X from their mother; daughters get one X from each parent.
// This is why tortoiseshell cats are almost always female: a tortie needs
// one O and one o X, i.e. X^O X^o, which requires two X chromosomes.

if (typeof module !== "undefined" && module.exports) {
  module.exports = {};
}

const Orange = { sym: "O", name: "Orange", link: "X" }; // X-linked
const LOCI = ["B", "A", "D", "S", "W", "L"]; // autosomal, biallelic

// Canonical allele sets (first = dominant)
const ALLELES = {
  B: ["B", "b"], // black / chocolate
  A: ["A", "a"], // agouti(tabby) / solid
  D: ["D", "d"], // full / dilute
  S: ["S", "s"], // white-spot / none
  W: ["W", "w"], // dominant-white / normal
  L: ["L", "l"], // short / long
  O: ["O", "o"], // orange / non-orange (X-linked)
};

// ---------- tiny RNG ----------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const defaultRng = mulberry32(0xC4755); // deterministic by default for replayable litters

function pick(arr, rng) {
  return arr[Math.floor((rng || defaultRng)() * arr.length)];
}

// ---------- genotype ----------
// genotype = {
//   sex: "F" | "M",
//   O: [a]            // male: one allele. female: two alleles.
//   B,A,D,S,W,L: [a,a]
// }

function isFemale(g) {
  return g.sex === "F";
}

// normalize allele pair so dominant-first (purely cosmetic for display)
function normPair(p, locus) {
  const dom = ALLELES[locus][0];
  if (p[0] === p[1]) return [p[0], p[1]];
  return p[0] === dom ? [p[0], p[1]] : [p[1], p[0]];
}

// ---------- gametes ----------
// An egg carries one X (one O allele) + one allele per autosomal locus.
// A sperm carries EITHER an X (→ daughter) OR a Y (→ son), + autosomal alleles.
function eggAlleles(mother, rng) {
  const r = rng || defaultRng;
  const g = { O: pick(mother.O, r) };
  for (const loc of LOCI) g[loc] = pick(mother[loc], r);
  return g;
}

// returns { sex, gamete } — son or daughter sperm, each 50%
function spermAlleles(father, rng) {
  const r = rng || defaultRng;
  const daughter = r() < 0.5;
  const g = {};
  if (daughter) g.O = father.O[0]; // father's single X → daughter
  for (const loc of LOCI) g[loc] = pick(father[loc], r);
  return { sex: daughter ? "F" : "M", gamete: g };
}

// make one kitten
function mate(mother, father, rng) {
  const r = rng || defaultRng;
  const eg = eggAlleles(mother, r);
  const sp = spermAlleles(father, r);
  const kitten = { sex: sp.sex };
  if (sp.sex === "F") {
    kitten.O = normPair([eg.O, sp.gamete.O], "O");
  } else {
    kitten.O = [eg.O]; // son gets his only X from mother
  }
  for (const loc of LOCI) kitten[loc] = normPair([eg[loc], sp.gamete[loc]], loc);
  return kitten;
}

// make a whole litter
function litter(mother, father, n, rng) {
  const r = rng || defaultRng;
  const out = [];
  for (let i = 0; i < n; i++) out.push(mate(mother, father, r));
  return out;
}

// ---------- phenotype ----------
// Resolve a genotype into a structured, renderable phenotype.

function isDom(pair, locus) {
  // carries at least one dominant allele
  return pair[0] === ALLELES[locus][0] || pair[1] === ALLELES[locus][0];
}
function isHomRec(pair, locus) {
  const rec = ALLELES[locus][1];
  return pair[0] === rec && pair[1] === rec;
}

// eumelanin base color given B locus, possibly diluted by D locus
function eumelaninColor(geno) {
  let base; // black family
  if (isDom(geno.B, "B")) base = "black"; // B_
  else base = "chocolate"; // bb
  const dilute = isHomRec(geno.D, "D");
  if (dilute) {
    return { base, dilute: true, name: base === "black" ? "blue" : "lilac" };
  }
  return { base, dilute: false, name: base };
}

// orange-pigment color, possibly diluted
function orangeColor(geno) {
  const dilute = isHomRec(geno.D, "D");
  return { base: "orange", dilute, name: dilute ? "cream" : "orange" };
}

// Does this cat show orange pigment?
// males: X^O → orange. females: X^O X^O → orange; X^O X^o → tortie (mosaic)
function orangeState(geno) {
  if (geno.sex === "M") return geno.O[0] === "O" ? "orange" : "none";
  // female
  const a = geno.O[0], b = geno.O[1];
  if (a === "O" && b === "O") return "orange";
  if (a === "o" && b === "o") return "none";
  return "tortie"; // X^O X^o
}

function tabbyShows(geno, pigment) {
  // A_ → agouti → tabby banding visible. aa → solid.
  // Real quirk: orange cats almost always show tabby regardless (O incompletely
  // suppresses agouti), so we let tabby show on orange even when aa.
  if (pigment === "orange") return true;
  return isDom(geno.A, "A");
}

function phenotype(geno) {
  // 1. Dominant white epistasis — W_ masks everything.
  if (isDom(geno.W, "W")) {
    return {
      sex: geno.sex,
      white: "full",
      whiteSpot: null,
      pigments: [{ kind: "white", name: "white" }],
      tabby: false,
      tortie: false,
      longhair: isHomRec(geno.L, "L"),
    };
  }

  // 2. Resolve pigment regions from orange state.
  const os = orangeState(geno);
  const pigments = [];
  let tortie = false;
  if (os === "orange") {
    const c = orangeColor(geno);
    pigments.push({ kind: "orange", name: c.name, dilute: c.dilute, tabby: tabbyShows(geno, "orange") });
  } else if (os === "none") {
    const e = eumelaninColor(geno);
    pigments.push({ kind: "eumelanin", name: e.name, base: e.base, dilute: e.dilute, tabby: tabbyShows(geno, "eumelanin") });
  } else {
    // tortie — mosaic of orange + eumelanin
    tortie = true;
    const o = orangeColor(geno);
    const e = eumelaninColor(geno);
    pigments.push({ kind: "orange", name: o.name, dilute: o.dilute, tabby: true });
    pigments.push({ kind: "eumelanin", name: e.name, base: e.base, dilute: e.dilute, tabby: tabbyShows(geno, "eumelanin") });
  }

  // 3. White spotting (incomplete dominance).
  let whiteSpot = null;
  if (isHomRec(geno.S, "S")) {
    // Ss
  }
  if (geno.S[0] === "S" && geno.S[1] === "S") whiteSpot = "high";
  else if (geno.S[0] === "S" || geno.S[1] === "S") whiteSpot = "bicolor";

  return {
    sex: geno.sex,
    white: null,
    whiteSpot,
    pigments,
    tabby: pigments.some((p) => p.tabby),
    tortie,
    longhair: isHomRec(geno.L, "L"),
  };
}

// ---------- human labels ----------
function colorWord(p) {
  return p.name; // black/blue/chocolate/lilac/orange/cream
}

function describePheno(ph) {
  if (ph.white === "full") {
    const coat = ph.longhair ? "Longhair white" : "White";
    return { short: "White", full: `${coat} (${ph.sex === "F" ? "female" : "male"})`, kind: "solid-white" };
  }

  const tortie = ph.tortie;
  const calico = tortie && ph.whiteSpot; // tortie + white = calico
  const parts = [];

  if (tortie) {
    // dilute tortie = blue-cream; chocolate tortie etc.
    const dil = ph.pigments.every((p) => p.dilute);
    const choc = ph.pigments.some((p) => p.base === "chocolate");
    let base;
    if (dil && choc) base = "lilac-cream";
    else if (dil) base = "blue-cream";
    else if (choc) base = "chocolate tortoiseshell";
    else base = "tortoiseshell";
    parts.push(base);
    if (ph.pigments.some((p) => p.tabby && p.kind === "eumelanin")) {
      // tabby striping on the dark patches → "torbie"
      // (kept subtle; many registries call it "tabby tortie" / torbie)
    }
  } else {
    const p = ph.pigments[0];
    if (p.tabby) parts.push(colorWord(p) + " tabby");
    else parts.push(colorWord(p) === "orange" ? "red" : colorWord(p)); // solid
    if (p.name === "orange" && p.tabby) parts[parts.length - 1] = "red tabby";
  }

  if (calico) {
    // replace tortie noun with calico family
    const dil = ph.pigments.every((p) => p.dilute);
    const choc = ph.pigments.some((p) => p.base === "chocolate");
    parts.length = 0;
    if (dil && choc) parts.push("lilac-calico");
    else if (dil) parts.push("dilute calico");
    else if (choc) parts.push("chocolate calico");
    else parts.push("calico");
  } else if (ph.whiteSpot === "bicolor" && !tortie) {
    parts.push("with white");
  } else if (ph.whiteSpot === "high" && !tortie) {
    parts.push("van");
  }

  if (ph.longhair) parts.push("(longhair)");

  const short = parts.join(" ");
  return {
    short,
    full: `${short} · ${ph.sex === "F" ? "female" : "male"}`,
    kind: calico ? "calico" : tortie ? "tortie" : ph.pigments[0].tabby ? "tabby" : "solid",
  };
}

function phenoKey(ph) {
  // stable key for ratio aggregation
  if (ph.white === "full") return "W:white";
  const pig = ph.pigments
    .map((p) => p.name + (p.tabby ? "+tab" : ""))
    .sort()
    .join("|");
  return [pig, ph.whiteSpot || "-", ph.longhair ? "long" : "short", ph.sex].join("/");
}

// ---------- genotype display ----------
function describeGeno(geno) {
  const oStr = geno.sex === "M" ? `X^${geno.O[0]}Y` : `X^${geno.O[0]}X^${geno.O[1]}`;
  const auto = LOCI.map((l) => `${geno[l][0]}${geno[l][1]}`).join(" ");
  return `${oStr}  ${auto}`;
}

// ---------- Punnett squares ----------
// autosomal, biallelic: 2x2 of offspring genotypes
function punnettAuto(mother, father, locus) {
  const dom = ALLELES[locus][0];
  const rec = ALLELES[locus][1];
  const m = mother[locus];
  const f = father[locus];
  // four cells (independent assortment, 25% each unless parents share alleles)
  const cells = [];
  for (const ma of m) {
    for (const fa of f) {
      const pair = ma === fa || ma === dom ? [ma, fa] : [fa, ma];
      cells.push(pair.join(""));
    }
  }
  // tally
  const tally = {};
  for (const c of cells) tally[c] = (tally[c] || 0) + 1;
  const rows = [
    { label: father[locus].join(""), cells: [cells[2], cells[3]] },
  ];
  // Represent as grid with mother alleles across top, father down side.
  return {
    locus,
    top: m, // mother's two alleles (columns)
    side: f, // father's two alleles (rows)
    cells, // [m0f0, m0f1, m1f0, m1f1] row-major over (mother col × father row)
    tally, // genotype-string → count out of 4
    dom,
    rec,
  };
}

// X-linked orange Punnett — father gives X (→daughter) or Y (→son).
// Returns the classic 2x2 with sex annotation.
function punnettOrange(mother, father) {
  // mother contributes one of her X's; father contributes X or Y
  const mAlleles = mother.O; // length 2 (she's female)
  const fX = father.O[0]; // father's single X
  // female labels normalized dominant-first (X^O before X^o) per convention
  const femLabel = (a, b) => (a === "O" || b === "O" ? `X^OX^o` : `X^${a}X^${b}`);
  const outcomes = [
    { mom: mAlleles[0], dad: fX, sex: "F", label: femLabel(mAlleles[0], fX) },
    { mom: mAlleles[0], dad: "Y", sex: "M", label: `X^${mAlleles[0]}Y` },
    { mom: mAlleles[1], dad: fX, sex: "F", label: femLabel(mAlleles[1], fX) },
    { mom: mAlleles[1], dad: "Y", sex: "M", label: `X^${mAlleles[1]}Y` },
  ];
  return {
    top: mAlleles, // mother's X's
    side: [fX, "Y"], // father gives X (→F) or Y (→M)
    outcomes, // 4 cells, each 25%
  };
}

// ---------- expected phenotype ratios (analytic) ----------
// per-locus genotype outcome distribution for an autosomal biallelic cross
function autoGenoDist(mother, father, locus) {
  const m = mother[locus], f = father[locus];
  const dom = ALLELES[locus][0];
  const tally = {};
  const cells = [`${m[0]}${f[0]}`, `${m[0]}${f[1]}`, `${m[1]}${f[0]}`, `${m[1]}${f[1]}`];
  for (const raw of cells) {
    const pair = raw.split("");
    const norm = pair[0] === pair[1] || pair[0] === dom ? raw : `${pair[1]}${pair[0]}`;
    tally[norm] = (tally[norm] || 0) + 0.25;
  }
  return tally; // genotype-string → probability
}

// orange outcome dist: returns list of {O, sex, p}
function orangeDist(mother, father) {
  const m = mother.O; // length 2
  const fX = father.O[0];
  const out = [];
  // each mom allele 0.5; dad X or Y 0.5
  const push = (oAlleles, sex, p) => {
    const O = sex === "M" ? [oAlleles[0]] : oAlleles;
    out.push({ O, sex, p });
  };
  // mother's first X
  push([m[0], fX], "F", 0.25);
  push([m[0]], "M", 0.25);
  push([m[1], fX], "F", 0.25);
  push([m[1]], "M", 0.25);
  // merge identical
  const merged = {};
  for (const o of out) {
    const key = (sex) => `${o.O.join("")}|${sex}`;
    const k = `${o.O.join("")}|${o.sex}`;
    merged[k] = merged[k] || { O: o.O, sex: o.sex, p: 0 };
    merged[k].p += o.p;
  }
  return Object.values(merged);
}

// full joint phenotype distribution: enumerate all genotype combos
function expectedRatios(mother, father) {
  // per-locus dists
  const dists = {};
  for (const loc of LOCI) dists[loc] = autoGenoDist(mother, father, loc);
  const od = orangeDist(mother, father);

  // expand autosomal cartesian product
  let combos = [{ geno: {}, p: 1 }];
  for (const loc of LOCI) {
    const next = [];
    for (const c of combos) {
      for (const [g, pg] of Object.entries(dists[loc])) {
        next.push({ geno: { ...c.geno, [loc]: g.split("") }, p: c.p * pg });
      }
    }
    combos = next;
  }
  // attach orange + sex
  const full = [];
  for (const c of combos) {
    for (const o of od) {
      full.push({ geno: { sex: o.sex, O: o.O, ...c.geno }, p: c.p * o.p });
    }
  }
  // aggregate by phenotype
  const ratio = {};
  for (const f of full) {
    const ph = phenotype(f.geno);
    const key = phenoKey(ph);
    if (!ratio[key]) ratio[key] = { ph, p: 0 };
    ratio[key].p += f.p;
  }
  // sorted list
  const list = Object.values(ratio).sort((a, b) => b.p - a.p);
  return list;
}

// ---------- presets (named cats, hand-written genotypes) ----------
// Each is a plausible purebred-ish cat. Comments note the real phenotype.
function G(sex, O, B, A, D, S, W, L) {
  return { sex, O, B, A, D, S, W, L };
}
const PRESETS = [
  { name: "Domino (black SH male)", g: G("M", ["o"], ["B", "B"], ["a", "a"], ["D", "D"], ["s", "s"], ["w", "w"], ["L", "L"]) },
  { name: "Marmalade (orange tabby male)", g: G("M", ["O"], ["B", "b"], ["A", "a"], ["D", "d"], ["s", "s"], ["w", "w"], ["L", "l"]) },
  { name: "Saffron (orange female)", g: G("F", ["O", "O"], ["B", "B"], ["a", "a"], ["D", "D"], ["s", "s"], ["w", "w"], ["L", "L"]) },
  { name: "Sooty (blue male)", g: G("M", ["o"], ["B", "B"], ["a", "a"], ["d", "d"], ["s", "s"], ["w", "w"], ["L", "L"]) },
  { name: "Patches (tortie female)", g: G("F", ["O", "o"], ["B", "B"], ["A", "a"], ["D", "D"], ["s", "s"], ["w", "w"], ["L", "L"]) },
  { name: "Callie (calico female)", g: G("F", ["O", "o"], ["B", "B"], ["A", "a"], ["D", "D"], ["S", "s"], ["w", "w"], ["L", "L"]) },
  { name: "Coco (chocolate female)", g: G("F", ["o", "o"], ["b", "b"], ["a", "a"], ["D", "D"], ["s", "s"], ["w", "w"], ["L", "L"]) },
  { name: "Snowball (dominant white)", g: G("F", ["o", "o"], ["B", "B"], ["A", "A"], ["D", "D"], ["s", "s"], ["W", "w"], ["L", "L"]) },
  { name: "Tux (black-and-white male)", g: G("M", ["o"], ["B", "B"], ["a", "a"], ["D", "D"], ["S", "s"], ["w", "w"], ["L", "L"]) },
  { name: "Smoke (longhair blue tabby)", g: G("F", ["o", "o"], ["B", "B"], ["A", "a"], ["d", "d"], ["s", "s"], ["w", "w"], ["l", "l"]) },
];

// expose on window in browser, on module in Node
function expose(api) {
  if (typeof window !== "undefined") {
    for (const k in api) window[k] = api[k];
  }
  if (typeof module !== "undefined" && module.exports) {
    for (const k in api) module.exports[k] = api[k];
  }
}

expose({
  ALLELES,
  LOCI,
  Orange,
  mulberry32,
  pick,
  mate,
  litter,
  phenotype,
  describePheno,
  describeGeno,
  phenoKey,
  punnettAuto,
  punnettOrange,
  expectedRatios,
  orangeState,
  eumelaninColor,
  orangeColor,
  autoGenoDist,
  orangeDist,
  PRESETS,
  isDom,
  isHomRec,
  normPair,
});
