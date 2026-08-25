// physics.js — Lavoisier's ledger: exact stoichiometry + balance model.
//
// The whole app is a bookkeeping device. Every number on screen comes from
// this file: species molar masses derived from atomic masses (so a compound
// weighs exactly the sum of its atoms), reaction extents limited by real
// supplies (a sealed litre of air holds only 0.2095 × V/22.414 mol of O2),
// and two ways to put a vessel on the scale:
//
//   sealed — everything counts:  m = Σ n_s · M_s   (invariant under reaction)
//   open   — only condensed phases count; gases are exchanged with an
//            unweighed atmosphere, which is precisely the bookkeeping error
//            that phlogiston theory was invented to explain.

export const ATOMS = {
  O: 15.999,
  H: 1.008,
  C: 12.011,
  N: 14.007,
  Sn: 118.71,
  Hg: 200.59,
};

// Molar volumes / air composition at 0 °C, 1 atm.
export const MOL_PER_LITRE_STP = 1 / 22.414;
export const AIR_O2_FRACTION = 0.2095; // the "active" fifth of the air
export const AIR_N2_FRACTION = 0.7905; // the inert remainder (+ traces)

function species(label, formula, phase, comp, color, r) {
  const M = Object.entries(comp).reduce((m, [k, v]) => m + ATOMS[k] * v, 0);
  return { label, formula, phase, M, color, r };
}

export const SPECIES = {
  Sn: species("锡", "Sn", "solid", { Sn: 1 }, "#9fb8d4", 13),
  O2: species("氧气", "O₂", "gas", { O: 2 }, "#ff6b5e", 9),
  N2: species("氮气", "N₂", "gas", { N: 2 }, "#7fa3d8", 10),
  SnO2: species("锡灰", "SnO₂", "solid", { Sn: 1, O: 2 }, "#e6d3a3", 15),
  C: species("木炭", "C", "solid", { C: 1 }, "#4d5871", 12),
  CO2: species("二氧化碳", "CO₂", "gas", { C: 1, O: 2 }, "#c98f96", 11),
  HgO: species("红灰（氧化汞）", "HgO", "solid", { Hg: 1, O: 1 }, "#e05c4e", 13),
  Hg: species("水银", "Hg", "liquid", { Hg: 1 }, "#c9d4e4", 12),
  H2: species("易燃气（氢）", "H₂", "gas", { H: 2 }, "#f4f7ff", 6),
  H2O: species("水", "H₂O", "liquid", { H: 2, O: 1 }, "#6fc3ff", 10),
};

// Reaction registry. Coefficients are exact small integers; `airFeed` names
// the reactant drawn from the vessel's air (sealed) or the atmosphere
// (open); bottled gases live in `masses` like solids do.
export const REACTIONS = [
  {
    id: "tin",
    year: "1774",
    title: "锡的密室",
    eq: "Sn + O₂ → SnO₂",
    reactants: { Sn: 1, O2: 1 },
    products: { SnO2: 1 },
    spectators: ["N2"],
    airFeed: "O2",
    vesselDefault: "sealed",
    sampleKey: "Sn",
    sampleLabel: "锡的质量",
    sampleDefault: 10,
    sampleMin: 1,
    sampleMax: 24,
    airLitres: { def: 1.2, min: 0.3, max: 4, step: 0.05 },
    story: "密封曲颈瓶里加热锡，总重一分不差；锡灰变重的每一克，都是空气交出的。",
  },
  {
    id: "charcoal",
    year: "日常",
    title: "木炭的减重",
    eq: "C + O₂ → CO₂↑",
    reactants: { C: 1, O2: 1 },
    products: { CO2: 1 },
    spectators: ["N2"],
    airFeed: "O2",
    vesselDefault: "open",
    sampleKey: "C",
    sampleLabel: "木炭的质量",
    sampleDefault: 12,
    sampleMin: 2,
    sampleMax: 30,
    airLitres: { def: 2.0, min: 0.3, max: 6, step: 0.05 },
    story: "敞口的炭盆烧完只剩轻飘飘的灰——账上少掉的质量全变成了逃走的 CO₂。",
  },
  {
    id: "calx",
    year: "1775–78",
    title: "红色的灰烬",
    eq: "2 HgO → 2 Hg + O₂↑",
    reactants: { HgO: 2 },
    products: { Hg: 2, O2: 1 },
    spectators: ["N2"],
    vesselDefault: "sealed",
    sampleKey: "HgO",
    sampleLabel: "红灰的质量",
    sampleDefault: 43.32,
    sampleMin: 5,
    sampleMax: 60,
    airLitres: { def: 4, min: 0.5, max: 10, step: 0.1 },
    story: "加热红灰：亮银色的汞留下来，一种让蜡烛爆燃的气体被赶了出来——氧。",
  },
  {
    id: "water",
    year: "1783",
    title: "水的合成",
    eq: "2 H₂ + O₂ → 2 H₂O",
    reactants: { H2: 2, O2: 1 },
    products: { H2O: 2 },
    spectators: [],
    airFeed: null,
    sealedOnly: true,
    vesselDefault: "sealed",
    sampleKey: "H2",
    sampleLabel: "易燃气（氢）的质量",
    sampleDefault: 4.032,
    sampleMin: 0.5,
    sampleMax: 8,
    bottledExcess: { O2: 48 }, // 氧气过量，氢气是限制试剂
    story: "电火花下，易燃气和活气烧成的液滴是水。水不是元素，是氢的氧化物。",
  },
];

export function reactionById(id) {
  return REACTIONS.find((r) => r.id === id);
}

export function molesOf(grams, s) {
  return grams / SPECIES[s].M;
}
export function gramsOf(mol, s) {
  return mol * SPECIES[s].M;
}

export function o2MolesInAir(litres) {
  return AIR_O2_FRACTION * litres * MOL_PER_LITRE_STP;
}
export function n2MolesInAir(litres) {
  return AIR_N2_FRACTION * litres * MOL_PER_LITRE_STP;
}

// Initial mole map for a scenario state (grams + vessel air), before any
// extent is applied. Air-bearing vessels start with their full O2 + N2
// charge — the sealed scale weighs the air too.
export function initialMoles(reaction, masses, airLitres) {
  const n = {};
  for (const [s, g] of Object.entries(masses)) n[s] = molesOf(g, s);
  if (reaction.bottledExcess) {
    for (const [s, g] of Object.entries(reaction.bottledExcess)) {
      n[s] = (n[s] || 0) + molesOf(g, s);
    }
  }
  if (reaction.spectators.includes("N2")) {
    n.N2 = n2MolesInAir(airLitres);
    n.O2 = (n.O2 || 0) + o2MolesInAir(airLitres);
  }
  return n;
}

// Maximum reaction extent ξ_max (mol of reaction events): the limiting
// reagent wins. An open vessel draws its air-feed gas from an unbounded
// atmosphere; a sealed one only has what the air held at sealing time.
export function maxExtent(reaction, masses, airLitres, vessel) {
  let limit = Infinity;
  for (const [s, nu] of Object.entries(reaction.reactants)) {
    let avail;
    if (reaction.airFeed === s && vessel === "open") continue; // unlimited
    if (reaction.airFeed === s) avail = o2MolesInAir(airLitres);
    else {
      const g = (masses[s] != null ? masses[s] : 0) +
        (reaction.bottledExcess ? reaction.bottledExcess[s] || 0 : 0);
      avail = g / SPECIES[s].M;
    }
    limit = Math.min(limit, avail / nu);
  }
  return limit;
}

// Apply extent ξ: reactants −ν·ξ, products +ν·ξ. Tiny negatives from float
// dust are clamped to zero.
export function applyExtent(reaction, n0, xi) {
  const out = { ...n0 };
  for (const [s, nu] of Object.entries(reaction.reactants)) {
    out[s] = Math.max(0, (out[s] || 0) - nu * xi);
  }
  for (const [s, nu] of Object.entries(reaction.products)) {
    out[s] = (out[s] || 0) + nu * xi;
  }
  return out;
}

// Sealed-system total mass — the invariant. Σ n·M over every species present.
export function totalMass(n) {
  let m = 0;
  for (const [s, mol] of Object.entries(n)) m += mol * SPECIES[s].M;
  return m;
}

// What the scale reads. Sealed: everything in the vessel counts and the
// reading cannot move. Open: only solid/liquid phases are on the pan —
// gases come from, or leave to, an unweighed atmosphere.
export function weighedMass(vessel, n) {
  let m = 0;
  for (const [s, mol] of Object.entries(n)) {
    if (vessel === "open" && SPECIES[s].phase === "gas") continue;
    m += mol * SPECIES[s].M;
  }
  return m;
}

// Gas-phase mole change → manometer reading for a sealed rigid vessel at
// fixed T: P_after/P_before = n_after/n_before.
export function pressureRatio(before, after) {
  const gas = (n) => {
    let t = 0;
    for (const [s, mol] of Object.entries(n)) {
      if (SPECIES[s].phase === "gas") t += mol;
    }
    return t;
  };
  const b = gas(before);
  if (b <= 0) return 1;
  return gas(after) / b;
}

// Percent by mass of element E in species s (exact from atomic masses).
export function percentElement(s, element) {
  // composition lookup via SPECIES formula reconstruction
  const table = {
    SnO2: { Sn: 1, O: 2 },
    HgO: { Hg: 1, O: 1 },
    H2O: { H: 2, O: 1 },
    CO2: { C: 1, O: 2 },
    O2: { O: 2 },
    N2: { N: 2 },
    H2: { H: 2 },
    Sn: { Sn: 1 },
    C: { C: 1 },
    Hg: { Hg: 1 },
  };
  const comp = table[s];
  let total = 0;
  for (const [k, v] of Object.entries(comp)) total += ATOMS[k] * v;
  return (ATOMS[element] * comp[element]) / total * 100;
}

// The phlogiston court. Phlogiston theory says burning/calcining releases
// "phlogiston" from the body into the air, so the condensed residue should
// WEIGH LESS than the starting solid. The scale disagrees for metals.
export const PHLOGISTON_PREDICTS_LOSS = -1; // sign of Δ(weighed solid mass)

export function courtVerdict(reaction, deltaWeighed) {
  const predicts = PHLOGISTON_PREDICTS_LOSS;
  const observed = Math.sign(deltaWeighed) || 0;
  const contradicts = observed !== 0 && observed !== predicts;
  return {
    predicts,
    observed,
    contradicts,
    magnitude: deltaWeighed - predicts * Math.abs(deltaWeighed),
  };
}

// Ledger rows for the UI: per-species before/after grams with totals.
export function buildLedger(reaction, masses, airLitres, vessel, f) {
  const n0 = initialMoles(reaction, masses, airLitres);
  const xiMax = maxExtent(reaction, masses, airLitres, vessel);
  const xi = xiMax * f;
  const n1 = applyExtent(reaction, n0, xi);

  const order = [
    ...Object.keys(reaction.reactants),
    ...Object.keys(reaction.products),
    ...(reaction.bottledExcess ? Object.keys(reaction.bottledExcess) : []),
    ...reaction.spectators,
  ];
  const seen = new Set();
  const rows = [];
  for (const s of order) {
    if (seen.has(s)) continue;
    seen.add(s);
    rows.push({
      s,
      label: SPECIES[s].label,
      formula: SPECIES[s].formula,
      phase: SPECIES[s].phase,
      before: gramsOf(n0[s] || 0, s),
      after: gramsOf(n1[s] || 0, s),
      escapedNote:
        vessel === "open" && SPECIES[s].phase === "gas"
          ? "不计入秤盘"
          : null,
    });
  }

  // Conservation is a statement about CLOSED systems. An open crucible
  // draws its air-feed gas from an unweighed atmosphere, so to balance the
  // books we credit exactly what was drawn before comparing totals.
  let n0closed = n0;
  if (vessel === "open" && reaction.airFeed) {
    const nu = reaction.reactants[reaction.airFeed];
    n0closed = {
      ...n0,
      [reaction.airFeed]: Math.max(n0[reaction.airFeed] || 0, xi * nu),
    };
  }

  const totalBefore = totalMass(n0closed);
  const totalAfter = totalMass(n1);
  const weighedBefore = weighedMass(vessel, n0);
  const weighedAfter = weighedMass(vessel, n1);

  return {
    xi,
    xiMax,
    rows,
    totalBefore,
    totalAfter,
    drift: totalAfter - totalBefore,
    weighedBefore,
    weighedAfter,
    weighedDelta: weighedAfter - weighedBefore,
    pressure: pressureRatio(n0, n1),
    n0,
    n1,
  };
}

// Closed forms used by the chart: weighed mass as a linear function of ξ.
export function weighedVsExtent(reaction, masses, airLitres, vessel, steps = 64) {
  const pts = [];
  const xiMax = maxExtent(reaction, masses, airLitres, vessel);
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const led = buildLedger(reaction, masses, airLitres, vessel, f);
    pts.push({ f, sealed: totalMass(led.n0), open: led.weighedAfter });
  }
  return pts;
}
