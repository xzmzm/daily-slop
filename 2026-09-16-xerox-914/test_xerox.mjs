/* Closed-form assertions for the Xerox 914 studio. Run: node test_xerox.mjs */
import * as X from './engine.js';

let passed = 0;
const checks = [];
function near(name, got, want, tol) {
  const ok = Math.abs(got - want) <= tol;
  checks.push([ok, `${name}: got ${typeof got === 'number' ? got.toPrecision(7) : got}, want ${want.toPrecision(7)} ±${tol.toPrecision(3)}`]);
  if (ok) passed++;
}
function rel(name, got, want, tol) {
  const ok = Math.abs(got - want) <= tol * Math.abs(want);
  checks.push([ok, `${name}: got ${got.toPrecision(10)}, want ${want.toPrecision(10)} rel ±${tol}`]);
  if (ok) passed++;
}
function isTrue(name, cond, detail = '') {
  checks.push([cond, `${name} ${detail}`]);
  if (cond) passed++;
}

const S = { ...X.DEFAULTS };

/* ---------- documented anchors (guard the history against typos) ---------- */
isTrue('the 914 is named for its 9×14 copy', X.M914.copyWidth === 9 && X.M914.copyLength === 14);
isTrue('7 copies a minute', X.M914.cpm === 7);
isTrue('$27,500 sticker, $95 lease with 2,000 included and 4¢ over', X.M914.purchase === 27500 && X.M914.leaseMonth === 95 && X.M914.leaseIncluded === 2000 && X.M914.leaseExtra === 0.04);
isTrue('1965 metered rental $25 + 10¢', X.M914.rentMonth === 25 && X.M914.rentCopy === 0.10);
isTrue('timeline keeps the Sherry-Netherland date', X.TIMELINE.some((t) => t[0] === '1959-09-16'));
isTrue('Model A needed its 39 steps', X.TIMELINE.some((t) => t[1] === 'Xerox Model A' && t[2].includes('39')));

/* ---------- cadence ---------- */
near('one copy every 60/7 seconds', X.copyCycleSeconds(), 8.5714286, 1e-6);
near('charge→develop lag is half a revolution', X.halfRotationSeconds(), 4.2857143, 1e-6);

/* ---------- corona (Peek's law + wire geometry) ---------- */
near('Peek onset field at an 80 µm wire', X.peekOnset(80e-6), 1.30995e7, 3e4);
near('corona ignites around 5.55 kV for an 80 µm wire 8 mm out', X.coronaOnsetVoltage(80e-6, 8e-3), 5552.2, 5);
near('field at the wire surface at 6.5 kV', X.coronaField(80e-6, 8e-3, 6500), 1.53359e7, 3e4);
isTrue('the 6.5 kV supply clears Peek onset', X.coronaField(80e-6, 8e-3, 6500) > X.peekOnset(80e-6));
isTrue('a 4.8 kV supply would not ignite the corona', X.coronaField(80e-6, 8e-3, 4800) < X.peekOnset(80e-6));
isTrue('thinner wire → stronger surface field', X.coronaField(40e-6, 8e-3, 6500) > X.coronaField(120e-6, 8e-3, 6500));
isTrue('thinner wire lights at a lower voltage', X.coronaOnsetVoltage(40e-6, 8e-3) < X.coronaOnsetVoltage(120e-6, 8e-3));
near('80 µm wire needs 4.14 kV; 120 µm needs 6.60 kV', X.coronaOnsetVoltage(40e-6, 8e-3) + X.coronaOnsetVoltage(120e-6, 8e-3), 10742.4, 3);
isTrue('default corona is lit', X.coronaIsOn(S));

/* ---------- selenium capacitor ---------- */
near('45 µm of selenium = 124 pF/cm²', X.capPFcm2(45e-6), 123.9586, 0.5);
near('surface charge at 900 V', X.surfaceCharge(900, 45e-6), 1.115628e-3, 1e-6);
rel('cap × V = σ exactly', X.plateCap(45e-6) * 900, X.surfaceCharge(900, 45e-6), 1e-12);

/* ---------- dark decay ---------- */
near('Maxwell relaxation τ = ρε ≈ 55.8 s at 10¹⁴ Ω·cm', X.darkTau(1e14), 55.781, 0.05);
near('after half a revolution the image keeps 92.6 % of its charge', X.darkDecay(900, X.halfRotationSeconds(), X.darkTau(1e14)), 833.44, 0.5);
isTrue('…which clears the 90 % survival bar for a 7 cpm cycle', X.darkDecay(900, X.halfRotationSeconds(), X.darkTau(1e14)) > 810);
isTrue('a 10¹² Ω·cm coating would NOT hold the image', X.darkDecay(900, X.halfRotationSeconds(), X.darkTau(1e12)) < 810);

/* ---------- photodischarge ---------- */
near('one erg/cm² of blue light discharges 312 V (η = 1)', X.photoPerErg(480e-9, 1, 45e-6), 312.32, 0.5);
near('…and 187.4 V at η = 0.6', X.photoPerErg(480e-9, 0.6, 45e-6), 187.395, 0.3);
rel('charge bookkeeping closes to the last photon: rate·C = e·η·λ/hc', X.photoRate(480e-9, 0.6, 45e-6) * X.plateCap(45e-6), (X.Q_E * 0.6 * 480e-9) / X.HC, 1e-12);
near('white background discharges to 150.4 V at 4 erg/cm²', X.vBackground(S), 150.42, 0.3);
near('ink (OD 1.3) knocks the image down to 862.4 V', X.vImage(S), 862.43, 0.3);
near('contrast potential 712.0 V', X.contrastPotential(S), 712.01, 0.3);
near('PIDC floors at the trapping residual', X.pid(1e9, 900, 75, 480e-9, 0.6, 45e-6), 75, 1e-9);
isTrue('red light is dark to selenium (a 6 erg red flash does nothing)', X.pid(6, 900, 75, 650e-9, 0.6, 45e-6) === 900);
isTrue('the band-gap cutoff sits at 610 nm', X.spectralResponse(610e-9) === 1 && X.spectralResponse(610.001e-9) === 0);

/* ---------- development field ---------- */
near('effective gap = g + d/εr = 307.1 µm', X.gapEffective(S), 3.071429e-4, 1e-8);
near('development field 2.318 V/µm', X.devFieldState(S), 2.31816e6, 2e3);
isTrue('…below air breakdown, as it must be', X.belowAirBreakdown(X.devFieldState(S)));
isTrue('squeeze the gap to 100 µm and it would arc', !X.belowAirBreakdown(X.devField(X.contrastPotential(S), 1e-4, S.d)));

/* ---------- toner adhesion and release ---------- */
near('electrostatic release threshold (4 µC/g, 4 µm)', X.releaseField(4e-3, 4e-6), 1.656465e5, 5);
rel('adhesion scales linearly with radius', X.releaseField(4e-3, 8e-6) / X.releaseField(4e-3, 4e-6), 2, 1e-12);
rel('image-force identity: q/(16πε₀r²) = (q/m)ρr/12ε₀', X.tonerCharge(4e-3, 4e-6) / (16 * Math.PI * X.EPS0 * (4e-6) ** 2), X.releaseField(4e-3, 4e-6), 1e-12);
near('total release threshold with the vdW floor', X.releaseTotal(S), 2.0656465e6, 10);
isTrue('image toner releases at defaults', X.imageDevelops(S));
isTrue('8 µm toner still releases', X.imageDevelops({ ...S, tonerR: 8e-6 }));
isTrue('12 µm toner never leaves the beads → blank copy', X.regime({ ...S, tonerR: 12e-6 }) === 'blank');
isTrue('15 µC/g toner is held too hard → blank copy', X.regime({ ...S, qm: 15e-3 }) === 'blank');

/* ---------- background fog ---------- */
isTrue('no fog at defaults', !X.backgroundFogs(S));
near('background must discharge below 634.4 V to stay clean', X.vBgNoFog(S), 634.45, 0.5);
near('…which takes 1.417 erg/cm² of exposure', X.fluenceNoFog(S), 1.4171, 0.005);
isTrue('starve the exposure to 1.3 erg/cm² and the copy fogs grey', X.regime({ ...S, fluence: 1.3 }) === 'fog');
isTrue('1.5 erg/cm² is off the fog line (it washes out instead)', X.regime({ ...S, fluence: 1.5 }) !== 'fog');

/* ---------- neutralisation development ---------- */
near('developed mass per area at defaults', X.massPerAreaState(S), 5.1307e-3, 2e-5);
near('…that is 0.513 mg/cm²', X.mgPerCm2(X.massPerAreaState(S)), 0.51307, 0.002);
rel('neutralisation identity: (M/A)·(q/m) = ε₀E exactly', X.massPerAreaState(S) * S.qm, X.EPS0 * X.devFieldState(S), 1e-12);
isTrue('coverage grows as q/m falls (richer blacks from lazier toner)', X.massPerAreaState({ ...S, qm: 2e-3 }) > X.massPerAreaState(S));

/* ---------- monolayer statistics ---------- */
near('one statistical monolayer of 4 µm toner', X.monolayerMass(4e-6), 3.226667e-3, 1e-7);
near('area coverage 79.6 % (1.59 monolayers)', X.coverage(X.massPerAreaState(S), 4e-6), 0.7961, 0.002);
near('print optical density 0.674', X.opticalDensity(X.coverage(X.massPerAreaState(S), 4e-6), 2), 0.6741, 0.003);
near('zero toner, zero density', X.opticalDensity(X.coverage(0, 4e-6), 2), 0, 1e-12);
near('full coverage saturates at the solid density', X.opticalDensity(1, 2), 2, 1e-12);
isTrue('coverage → 1 as mass → ∞', X.coverage(1, 4e-6) > 0.9999);
near('≈1.74 million toner particles per cm²', X.tonerPerCm2(X.massPerAreaState(S), 4e-6), 1.7398e6, 5e3);

/* ---------- fuser arithmetic ---------- */
near('a solid 9×14 copy carries 0.417 g of toner', X.tonerPerCopyKg(X.massPerAreaState(S)), 4.17125e-4, 2e-6);
near('melting that toner takes 70.5 J', X.fuseEnergy(X.tonerPerCopyKg(X.massPerAreaState(S))), 70.494, 0.05);
near('…only 8.2 W averaged over 7 copies a minute', X.fusePowerAtCpm(X.tonerPerCopyKg(X.massPerAreaState(S))), 8.224, 0.02);

/* ---------- scorch gauge ---------- */
near('a 60 %-black payroll page pegs the gauge', X.scorchLoad(0.6, X.massPerAreaState(S)), 0.6052, 0.01);
isTrue('…and catches fire (the zeros-and-O\'s anecdote)', X.catchesFire(0.6, X.massPerAreaState(S)));
isTrue('a 20 % memo stays below the smoke line', !X.catchesFire(0.2, X.massPerAreaState(S)));
isTrue('over-develop (q/m halved) and even the memo scorches', X.catchesFire(0.3, X.massPerAreaState({ ...S, qm: 2e-3 })));

/* ---------- the copy economy ---------- */
near('lease floor $95 at any volume ≤ 2,000', X.leaseMonthly(0) + X.leaseMonthly(2000), 190, 1e-9);
near('4,000 copies in a month cost $175', X.leaseMonthly(4000), 175, 1e-9);
near('100,000 copies (rated maximum) cost $4,015', X.leaseMonthly(100000), 4015, 1e-9);
near('…4.0¢ per copy at the limit', X.perCopy(X.leaseMonthly(100000), 100000), 0.04015, 1e-9);
near('1965 meter: 1,000 copies cost $125', X.rentMonthly(1000), 125, 1e-9);
near('mimeograph long run: 1,000 copies, one stencil, $8.90', X.mimeoMonthly(1000, 1), 8.9, 1e-9);
near('914 beats a 35¢ Photostat from 49 copies a month', X.crossoverFlat(0.35), 48.387, 0.01);
near('…and a 15¢ Verifax from 137 copies', X.crossoverFlat(0.15), 136.364, 0.01);
near('…and a 7.5¢ Thermofax from 429 copies', X.crossoverFlat(0.075), 428.571, 0.01);
isTrue('nobody beats nobody at exactly 4¢', X.crossoverFlat(0.04) === null);
isTrue('the mimeograph never loses on a single original', X.crossoverMimeo(1) === null);
near('50 distinct originals a month: mimeograph wins only above 938 copies', X.crossoverMimeo(50), 937.5, 0.1);
near('20 originals: crossover drops to 93.75', X.crossoverMimeo(20), 93.75, 0.1);

/* ---------- report ---------- */
const failed = checks.filter((c) => !c[0]);
for (const [ok, msg] of checks) console.log(`${ok ? 'ok' : 'FAIL'}  ${msg}`);
console.log(`\n${passed}/${checks.length} assertions passed`);
if (failed.length) process.exit(1);
