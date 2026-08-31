// test_physics.mjs — node --test test_physics.mjs
// Validates the Carrington's Storm engine: the light-vs-plasma race t = D/v
// and the 17.6-h anchor, the dipole magnetopause r ∝ p^(−1/6) with its exact
// 64×→½ law and the geosynchronous crossing pressure, the Dessler–Parker–
// Sckopke ring-current ledger (4×10¹³ J per nT), the flare's power bookkeeping,
// the ground-current arithmetic V = E·L and I = V/R against the 1859 and 1989
// calibrations, the aurora-latitude least-squares fit, and the replay model's
// invariants (crochet with the light, SSC with the plasma, Colaba minimum).

import test from "node:test";
import assert from "node:assert/strict";

import {
  AU_KM, C_KMS, GEO_RE, MU0, DIPOLE_M, RE_M,
  tLightSeconds, transitHours, speedForTransit, l1WarningMinutes, speedRatio,
  CARRINGTON_V, CARRINGTON_TRANSIT_H, CME_LAUNCH_H, FLARE_H, SSC_H,
  FLARE_J, FLARE_S, flarePowerW, flareFractionOfSun, flareHiroshimas,
  SUNSPOT_M2,
  standoffRe, pressureForStandoffRe, P_AT_GEO,
  ringEnergyJ, ringHiroshimas, ringGridHours,
  gicVolts, gicAmps, eFromDho, E_PER_NTPERHR, LINE_1859,
  AURORA_DATA, AURORA_FIT, auroraMLat,
  STORMS, PRESETS, DEFAULTS,
  dstTrace, dhoTrace, pressureTrace, BAY_9,
  hhmm, dayLabel,
} from "./physics.js";

const close = (a, b, tol, label) =>
  assert.ok(Math.abs(a - b) <= tol, `${label}: ${a} vs ${b} (±${tol})`);

test("light crosses 1 AU in 499 s — 8 min 19 s", () => {
  close(tLightSeconds(), AU_KM / C_KMS, 1e-6, "t_light");
  close(tLightSeconds(), 499.0, 0.1, "the famous 8⅓ minutes");
});

test("the plasma race: t = D/v, with 1859's 17.55-h anchor", () => {
  close(transitHours(400), 103.89, 0.05, "slow wind 400 km/s → 4.33 days");
  close(transitHours(1000), 41.56, 0.05, "1989-class 1000 km/s");
  close(transitHours(3000), 13.85, 0.05, "2012 near-miss 3000 km/s");
  close(CARRINGTON_TRANSIT_H, 17.55, 1e-9, "10:30 launch → 04:03 SSC");
  close(transitHours(CARRINGTON_V), CARRINGTON_TRANSIT_H, 1e-6, "v ↔ t round trip");
  close(speedForTransit(17.6), 2361.1, 0.5, "the quoted 17.6 h needs 2361 km/s");
  close(CME_LAUNCH_H + transitHours(CARRINGTON_V), SSC_H, 1e-6, "SSC = launch + transit");
});

test("photons outrun plasma by c/v ≈ 126.6×", () => {
  close(speedRatio(CARRINGTON_V), C_KMS / CARRINGTON_V, 1e-6, "ratio");
  close(speedRatio(CARRINGTON_V), 126.6, 0.5, "the two messengers");
  // L1 sentinels: only minutes of warning for a fast CME
  close(l1WarningMinutes(CARRINGTON_V), 1500000 / CARRINGTON_V / 60, 1e-9, "L1 warning");
  assert.ok(l1WarningMinutes(CARRINGTON_V) < 11 && l1WarningMinutes(CARRINGTON_V) > 10);
  close(l1WarningMinutes(3000), 8.33, 0.02, "2012-class shock");
});

test("magnetopause: r = (µ₀M²/32π²p)^⅙, the sixth root that swallows spikes", () => {
  close(standoffRe(2), Math.pow(MU0 * DIPOLE_M ** 2 / (32 * Math.PI ** 2 * 2 * 1e-9), 1 / 6) / RE_M, 1e-12, "closed form");
  close(standoffRe(2), 7.53, 0.02, "dipole standoff at 2 nPa");
  // the exact invariant: 64× pressure → exactly half the radius (64^⅙ = 2)
  assert.ok(Math.abs(standoffRe(128) / standoffRe(2) - 0.5) < 1e-12, "64× → ½");
  assert.ok(Math.abs(standoffRe(0.5) / standoffRe(32) - 2) < 1e-12, "and back down (×64 the other way)");
  // round trip through the inverse
  close(pressureForStandoffRe(standoffRe(15)), 15, 1e-9, "p round trip");
  // geosynchronous crossing pressure (pure-dipole bookkeeping)
  close(P_AT_GEO, 4.35, 0.05, "GEO breach at ≈4.4 nPa, dipole-only");
  // a Carrington-class 64 nPa crushes the dipole nose deep inside GEO
  assert.ok(standoffRe(64) < GEO_RE, "GEO satellites sit in solar wind");
  close(standoffRe(64), 4.23, 0.02, "×32 from quiet ⇒ ÷1.78");
  assert.ok(Math.abs(standoffRe(128) / standoffRe(2) - 0.5) < 1e-12, "×64 ⇒ exactly ½");
});

test("Dessler–Parker–Sckopke: 4×10¹³ J of ring current per nT of Dst", () => {
  close(ringEnergyJ(-1760), 7.04e16, 1e9, "Carrington (Tsurutani est.)");
  close(ringEnergyJ(-589), 2.356e16, 1e8, "Quebec 1989");
  close(ringEnergyJ(-1760) / ringEnergyJ(-589), 1760 / 589, 1e-9, "strictly linear");
  close(ringHiroshimas(-1760), 7.04e16 / 6.3e13, 1e6, "≈1,100 Hiroshimas overhead");
  close(ringGridHours(-1760), 7.04e16 / 3.4e12 / 3600, 1e-6, "≈5.7 h of the human grid");
});

test("the X45 ledger: power, fraction of the Sun, Hiroshimas", () => {
  close(flarePowerW(), FLARE_J / FLARE_S, 1, "5×10²⁵ J in 300 s");
  assert.ok(flarePowerW() > 1.6e23 && flarePowerW() < 1.7e23, "≈1.7×10²³ W");
  close(flareFractionOfSun(), 4.35e-4, 0.02e-4, "0.04% of the Sun's output");
  close(flareHiroshimas(), 5e25 / 6.3e13, 1e9, "≈8×10¹¹ Hiroshimas");
  close(SUNSPOT_M2, 2300e-6 * 2 * Math.PI * 6.957e8 ** 2, 1, "2300 msh → m²");
  assert.ok(SUNSPOT_M2 > 6.9e15 && SUNSPOT_M2 < 7.1e15);
});

test("ground currents: V = E·L, I = V/R — the two telegraph calibrations", () => {
  close(gicVolts(21.66, 300), 6498, 1e-6, "Maine 1989 measured E over 300 km");
  close(gicAmps(21.66, 300, 60), 108.3, 0.1, "transformer-neutral class GIC");
  const mA1859 = gicAmps(2, LINE_1859.lKm, LINE_1859.rOhms) * 1000;
  close(mA1859, 183.8, 0.5, "1859 line at E = 2 V/km");
  assert.ok(mA1859 > 100 && mA1859 < 250, "sounder-class current: battery can be cut");
  close(eFromDho(1500), 21.66, 1e-9, "the Maine dB/dt calibration");
  close(E_PER_NTPERHR, 21.66 / 1500, 1e-12, "V/km per nT/hr");
});

test("aurora latitude: least squares on the five storm pins", () => {
  assert.ok(AURORA_FIT.b < 0, "harder storm → lower sky");
  assert.ok(AURORA_FIT.b > -12 && AURORA_FIT.b < -5, "gentle log slope");
  close(auroraMLat(-1760), 18.2, 0.6, "1859: the sky burned at 18°");
  // every historical pin reproduced within 4° (the scatter is honest)
  for (const d of AURORA_DATA) {
    assert.ok(Math.abs(auroraMLat(d.dst) - d.mlat) < 4, `${d.id}: fit ${auroraMLat(d.dst).toFixed(1)} vs ${d.mlat}`);
  }
  assert.ok(auroraMLat(-1760) < auroraMLat(-412), "monotone where it matters");
});

test("the storm ladder: 1859 on top, the near miss flagged", () => {
  assert.equal(STORMS.length, 6);
  const hits = STORMS.filter((s) => !s.missed);
  for (let i = 1; i < hits.length; i++) {
    assert.ok(Math.abs(hits[i - 1].dst) > Math.abs(hits[i].dst), "sorted by |Dst|");
  }
  assert.equal(hits[0].id, "1859");
  assert.equal(STORMS.find((s) => s.id === "2012").missed, true);
  assert.equal(STORMS.find((s) => s.id === "1989").eVkKm, 21.66);
});

test("replay model: the crochet rides with the light, the storm with the plasma", () => {
  // before anything: quiet
  close(dstTrace(20), 0, 1, "quiet Sun, Aug 27");
  // the crochet peaks within an hour of 11:18, well before the CME arrives
  const cPeak = dstTrace(FLARE_H + 0.25);
  assert.ok(cPeak > 60 && cPeak < 110, `crochet ≈+110 nT: got ${cPeak.toFixed(1)}`);
  // two hours after the flare the needle is calm again — only storm-1's tail
  // (a −12 nT e-fold remnant of Aug 28/29); the plasma is still en route
  close(dstTrace(FLARE_H + 2.2), -12.4, 4, "calm between messengers");
  // the main-phase minimum: ~−1560 nT (Colaba read ≈−1600 local)
  let min = 0, tMin = SSC_H;
  for (let t = SSC_H; t < SSC_H + 12; t += 1 / 60) {
    const v = dstTrace(t);
    if (v < min) { min = v; tMin = t; }
  }
  assert.ok(min < -1520 && min > -1640, `Colaba minimum: got ${min.toFixed(0)}`);
  assert.ok(tMin - SSC_H > 1.2 && tMin - SSC_H < 3.2, "crash takes ~2.3 h");
  // the pressure story: quiet ~1.6 nPa, SSC spike above 50 nPa, decays
  close(pressureTrace(20), 1.6, 1e-9, "quiet pressure");
  assert.ok(pressureTrace(SSC_H + 0.1) > 50, "SSC spike");
  assert.ok(pressureTrace(SSC_H + 20) < pressureTrace(SSC_H + 2), "sheath relaxes");
  // faster CME ⇒ earlier storm: the whole replay reflows
  const sscFast = CME_LAUNCH_H + transitHours(3000);
  assert.ok(sscFast < SSC_H - 3, "3000 km/s arrives hours earlier");
});

test("dH/dt: the Colaba needle moved at ≥2000 nT/hr during the crash", () => {
  let maxDho = 0;
  for (let t = SSC_H; t < SSC_H + 12; t += 1 / 120) {
    maxDho = Math.max(maxDho, dhoTrace(t));
  }
  assert.ok(maxDho > 2000 && maxDho < 2700, `peak |dH/dt|: got ${maxDho.toFixed(0)} nT/hr`);
  // Love et al. 2024: Colaba's rate of change ≥ 2436 nT/hr — same class.
  // mapped through the Maine conductor calibration, that ground would see:
  assert.ok(eFromDho(2436) > 30, "a 30+ V/km day in Maine-like crust");
});

test("clock helpers: 131.3 h is 11:18 on 1 Sept", () => {
  assert.equal(hhmm(131.3), "11:18");
  assert.equal(hhmm(148.05), "04:03");
  assert.equal(dayLabel(131.3), "9月1日");
  assert.equal(dayLabel(148.05), "9月2日");
  assert.equal(dayLabel(43.4), "8月28日");
});

test("presets and defaults line up with the anchors", () => {
  assert.equal(PRESETS[0].id, "replay1859");
  close(PRESETS[0].vKmS, CARRINGTON_V, 1e-9, "replay runs the real speed");
  close(DEFAULTS.vKmS, CARRINGTON_V, 1e-9);
  assert.ok(PRESETS.some((p) => p.id === "nearMiss" && p.vKmS === 3000));
  assert.ok(BAY_9 > 0.69 && BAY_9 < 0.70, "bay peak factor e-folding sanity");
});
