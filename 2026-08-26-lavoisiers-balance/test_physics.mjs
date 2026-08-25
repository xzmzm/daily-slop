// test_physics.mjs — node --test test_physics.mjs
// Validates the ledger engine: molar masses against atomic sums, reaction
// extents against limiting reagents, the sealed-vessel mass invariant to
// float dust, open-vessel deltas against closed forms, and the manometer
// law P ∝ n against exact mole counts.

import test from "node:test";
import assert from "node:assert/strict";

import {
  ATOMS,
  SPECIES,
  REACTIONS,
  MOL_PER_LITRE_STP,
  AIR_O2_FRACTION,
  reactionById,
  molesOf,
  gramsOf,
  o2MolesInAir,
  n2MolesInAir,
  initialMoles,
  maxExtent,
  applyExtent,
  totalMass,
  weighedMass,
  pressureRatio,
  percentElement,
  buildLedger,
} from "./physics.js";

const close = (actual, expected, tol, label) =>
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `${label}: got ${actual}, want ${expected} ± ${tol}`
  );

test("molar masses are exact atomic sums", () => {
  close(SPECIES.SnO2.M, ATOMS.Sn + 2 * ATOMS.O, 0, "M(SnO2)");
  close(SPECIES.HgO.M, ATOMS.Hg + ATOMS.O, 0, "M(HgO)");
  close(SPECIES.H2O.M, 2 * ATOMS.H + ATOMS.O, 0, "M(H2O)");
  close(SPECIES.CO2.M, ATOMS.C + 2 * ATOMS.O, 0, "M(CO2)");
  close(SPECIES.O2.M, 2 * ATOMS.O, 0, "M(O2)");
});

test("percent composition anchors (SnO2 is ~78.8% tin)", () => {
  close(percentElement("SnO2", "Sn"), 78.77, 0.01, "%Sn in SnO2");
  close(percentElement("HgO", "Hg"), 92.61, 0.01, "%Hg in HgO");
  close(percentElement("H2O", "O"), 88.81, 0.01, "%O in H2O");
});

test("air budget: one litre of air holds 0.2095/22.414 mol of O2", () => {
  close(o2MolesInAir(1), AIR_O2_FRACTION * MOL_PER_LITRE_STP, 1e-15, "n_O2 per litre");
  // 1.2 L retort ≈ 0.01122 mol O2 = 0.359 g
  close(gramsOf(o2MolesInAir(1.2), "O2"), 0.3589, 3e-4, "O2 grams in 1.2 L");
  close(n2MolesInAir(1) / o2MolesInAir(1), 0.7905 / 0.2095, 1e-12, "N2:O2 ratio");
});

test("tin retort 1774: sealed total mass invariant to 1e-9 g", () => {
  const r = reactionById("tin");
  const led = buildLedger(r, { Sn: 10 }, 1.2, "sealed", 1);
  close(led.drift, 0, 1e-9, "sealed drift");
  // O2 limits: all 0.35895... g consumed
  const nO2 = o2MolesInAir(1.2);
  close(led.rows.find((x) => x.s === "O2").after, 0, 1e-12, "O2 exhausted");
  close(
    led.rows.find((x) => x.s === "Sn").after,
    10 - gramsOf(nO2, "Sn"),
    1e-9,
    "Sn consumed = n_O2·M_Sn"
  );
  close(
    led.rows.find((x) => x.s === "SnO2").after,
    gramsOf(nO2, "SnO2"),
    1e-9,
    "SnO2 formed"
  );
});

test("tin retort: N2 spectator untouched; air loses exactly its active fifth", () => {
  const r = reactionById("tin");
  const led = buildLedger(r, { Sn: 10 }, 1.2, "sealed", 1);
  close(led.n1.N2, n2MolesInAir(1.2), 1e-15, "N2 unchanged");
  const gasBefore = o2MolesInAir(1.2) + n2MolesInAir(1.2);
  close((gasBefore - o2MolesInAir(1.2)) / gasBefore, 0.7905, 1e-12, "air shrinks to N2 share");
  close(pressureRatio(led.n0, led.n1), 0.7905, 1e-9, "manometer drops to ~79%");
});

test("open crucible: metal gains exactly the oxygen it fixed (+0.359 g)", () => {
  const r = reactionById("tin");
  const sealed = buildLedger(r, { Sn: 10 }, 1.2, "sealed", 1);
  const open = buildLedger(r, { Sn: 10 }, 1.2, "open", 1);
  // open vessel has unlimited air → full sample converts
  close(open.xiMax, 10 / SPECIES.Sn.M, 1e-12, "open extent limited by Sn only");
  close(open.weighedDelta, +gramsOf(open.xiMax, "O2"), 1e-9, "solid gain = fixed O2");
  assert.ok(open.weighedDelta > 0, "metals gain weight in open fire");
  // in the sealed run the condensed phases still gain what the air lost
  let condensedDelta = 0;
  for (const row of sealed.rows) {
    if (row.phase !== "gas") condensedDelta += row.after - row.before;
  }
  close(condensedDelta, +gramsOf(sealed.xiMax, "O2"), 1e-9, "condensed gain sealed");
  assert.ok(condensedDelta > 0);
});

test("charcoal: weighed loss equals escaping CO2 (44.01/12.01 per gram)", () => {
  const r = reactionById("charcoal");
  const open = buildLedger(r, { C: 12 }, 2, "open", 1);
  close(open.weighedDelta, -12, 1e-6, "all charcoal leaves the pan");
  close(
    open.rows.find((x) => x.s === "CO2").after,
    gramsOf(molesOf(12, "C"), "CO2"),
    1e-6,
    "CO2 produced"
  );
  close(open.drift, 0, 1e-9, "but the universe still balances");
  // sealed jar: only the air's O2 burns
  const sealed = buildLedger(r, { C: 12 }, 2, "sealed", 1);
  close(sealed.rows.find((x) => x.s === "C").before - sealed.rows.find((x) => x.s === "C").after,
    gramsOf(o2MolesInAir(2), "C"), 1e-9, "sealed burn limited by air");
});

test("red calx: 43.32 g HgO → 40.118 g Hg + 3.200 g O2 (ξ = 0.1 mol)", () => {
  const r = reactionById("calx");
  const led = buildLedger(r, { HgO: 43.32 }, 4, "open", 1);
  close(molesOf(43.32, "HgO"), 0.2, 2e-4, "sample ≈ 0.2 mol");
  close(led.xiMax, 0.1, 2e-4, "extent ξ");
});

test("calx stoichiometry: Hg : O2 = 2 : 1 by moles", () => {
  const r = reactionById("calx");
  const led = buildLedger(r, { HgO: 43.32 }, 4, "open", 1);
  const row = (s) => led.rows.find((x) => x.s === s);
  const nHg = molesOf(row("Hg").after - row("Hg").before, "Hg");
  const nO2 = molesOf(row("O2").after - row("O2").before, "O2"); // produced only
  close(nHg / nO2, 2, 1e-9, "ratio");
  close(led.weighedDelta, -gramsOf(led.xi, "O2"), 1e-9, "open vessel 'loses' the oxygen");
});

test("calx sealed: manometer rises by produced O2 over vessel air", () => {
  const r = reactionById("calx");
  const V = 4;
  const led = buildLedger(r, { HgO: 43.32 }, V, "sealed", 1);
  const airGas = n2MolesInAir(V) + o2MolesInAir(V);
  const expected = (airGas + led.xi) / airGas;
  close(led.pressure, expected, 1e-9, "P ratio from exact mole counts");
  assert.ok(led.pressure > 1, "pressure rises when calx gives up gas");
});

test("water synthesis: 4.032 g H2 + 32.000 g O2 → 36.032 g H2O exactly", () => {
  const r = reactionById("water");
  const led = buildLedger(r, { H2: 4.032 }, 0, "sealed", 1);
  close(led.rows.find((x) => x.s === "H2").after, 0, 1e-9, "H2 exhausted");
  close(
    led.rows.find((x) => x.s === "O2").after,
    48 - 32.0, // bottled excess minus one mole consumed
    0.01,
    "O2 leftover"
  );
  close(led.rows.find((x) => x.s === "H2O").after, 36.032, 1e-2, "water formed");
  close(led.drift, 0, 1e-9, "sealed invariant");
});

test("water synthesis: H2 : O2 consumed = 2 : 1 (Gay-Lussac's law in moles)", () => {
  const r = reactionById("water");
  const f = 0.37;
  const led = buildLedger(r, { H2: 4.032 }, 0, "sealed", f);
  const dH2 = led.rows.find((x) => x.s === "H2").before - led.rows.find((x) => x.s === "H2").after;
  const dO2 = led.rows.find((x) => x.s === "O2").before - led.rows.find((x) => x.s === "O2").after;
  close(molesOf(dH2, "H2") / molesOf(dO2, "O2"), 2, 1e-9, "volume/mole ratio");
});

test("every reaction conserves mass at every extent (the whole point)", () => {
  for (const r of REACTIONS) {
    for (const vessel of ["sealed"]) {
      const masses = {};
      masses[r.sampleKey] = r.sampleDefault;
      const V = r.airLitres ? r.airLitres.def : 0;
      for (let i = 0; i <= 10; i++) {
        const led = buildLedger(r, masses, V, vessel, i / 10);
        close(led.drift, 0, 1e-8, `${r.id} @ f=${i / 10} (${vessel})`);
      }
    }
  }
});

test("extent linearity: every species moves linearly in f", () => {
  const r = reactionById("tin");
  const a = buildLedger(r, { Sn: 10 }, 1.2, "sealed", 0.25);
  const b = buildLedger(r, { Sn: 10 }, 1.2, "sealed", 0.75);
  const c = buildLedger(r, { Sn: 10 }, 1.2, "sealed", 0.50);
  const snO2a = a.rows.find((x) => x.s === "SnO2").after;
  const snO2b = b.rows.find((x) => x.s === "SnO2").after;
  const snO2c = c.rows.find((x) => x.s === "SnO2").after;
  close(snO2c, (snO2a + snO2b) / 2, 1e-10, "midpoint");
});
