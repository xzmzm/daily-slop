/* Hydrostatic toy for Venera 4's descent. Heights are relative to where the signal stopped. */
(function (root) {
  'use strict';
  const START = { p: 0.75, t: 325 };          // first parachute readings: ~0.75 atm, 52 °C
  const END = { p: 22, t: 535 };              // last readings: ~22 atm, 262 °C
  const KAPPA = Math.log(END.t / START.t) / Math.log(END.p / START.p); // T ∝ P^κ along the descent
  const C = 8.314 / 0.04344 / 8.87 / 1000;    // R/(μg) in km per kelvin (CO₂, Venus gravity)
  const DESCENT_MIN = 93;
  const ALTIMETER_KM = 26;                    // radar altimeter reading when transmission began
  const ALTIMETER_ALIAS_KM = 32;              // periodic-FM ambiguity: 30–40 km
  const MARINER = { p: 0.72, km: 58 };        // Mariner 5 occultation + radar radius
  const HULL_ATM = 20;

  const temp = p => START.t * Math.pow(p / START.p, KAPPA);
  // height above the silent-probe point at pressure p; negative means deeper than the probe got
  const rel = p => C * (END.t - temp(p)) / KAPPA;
  const pressureAt = z => END.p * Math.pow((END.t - KAPPA * z / C) / END.t, 1 / KAPPA);
  const tempAt = z => END.t - KAPPA * z / C;
  const SPAN = rel(START.p);

  // time since parachute opened, weighting slow air: speed ∝ ρ^-1/2, ρ ∝ P^(1-κ)
  const N = 400;
  const clock = [0];
  for (let i = 1; i <= N; i++) {
    const a = Math.log(START.p) + (Math.log(END.p) - Math.log(START.p)) * (i - .5) / N;
    const p = Math.exp(a);
    const step = C * temp(p) * (Math.log(END.p) - Math.log(START.p)) / N; // km per slice
    clock.push(clock[i - 1] + step * Math.pow(p, (1 - KAPPA) / 2));
  }
  const scale = DESCENT_MIN / clock[N];
  function pressureAtMinute(m) {
    const target = Math.max(0, Math.min(DESCENT_MIN, m)) / scale;
    let i = 1;
    while (i < N && clock[i] < target) i++;
    const f = (target - clock[i - 1]) / (clock[i] - clock[i - 1] || 1);
    return Math.exp(Math.log(START.p) + (Math.log(END.p) - Math.log(START.p)) * (i - 1 + f) / N);
  }

  // h = how far above the true ground the probe was when it fell silent
  function analyse(h, alias) {
    const ground = { p: pressureAt(-h), t: tempAt(-h) };
    const altimeter = ALTIMETER_KM + (alias ? ALTIMETER_ALIAS_KM : 0);
    const gapAltimeter = h + rel(START.p) - altimeter;
    const gapMariner = h + rel(MARINER.p) - MARINER.km;
    const worst = Math.max(Math.abs(gapAltimeter), Math.abs(gapMariner));
    let verdict = 'split';
    if (worst <= 3) verdict = 'agree';
    else if (Math.abs(gapMariner) <= 3) verdict = 'mariner';
    else if (Math.abs(gapAltimeter) <= 3) verdict = 'altimeter';
    return { h, alias, ground, altimeter, gapAltimeter, gapMariner, verdict,
      landed: h < .5, crushed: h >= .5 && ground.p > HULL_ATM * 1.1 };
  }
  // height of the silent probe each pin alone would demand
  const impliedH = alias => ({ altimeter: ALTIMETER_KM + (alias ? ALTIMETER_ALIAS_KM : 0) - SPAN,
    mariner: MARINER.km - rel(MARINER.p) });

  const api = { START, END, KAPPA, DESCENT_MIN, ALTIMETER_KM, ALTIMETER_ALIAS_KM, MARINER, HULL_ATM, SPAN,
    temp, rel, pressureAt, tempAt, pressureAtMinute, analyse, impliedH };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.VeneraModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
