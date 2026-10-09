/* Node checks for the Triton Spiral physics module. Run: node tests.js */
"use strict";
const T = require("./triton.js");

let failures = 0;
function check(name, ok, detail) {
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${ok ? "" : "  -- " + detail}`);
  if (!ok) failures++;
}
const close = (x, target, rel) => Math.abs(x - target) <= target * rel;

// Anchor constants against published values.
const period = T.periodDays(T.A_NOW);
check("Kepler: orbital period at a=354,759 km is 5.877 d",
  close(period, 5.877, 0.005), `got ${period.toFixed(4)} d`);
check("synchronous orbit is near 83,500 km (3.4 R_N)",
  close(T.A_SYNC, 83500, 0.05), `got ${T.A_SYNC.toFixed(0)} km`);
check("fluid Roche limit is near 56,000 km (2.3 R_N)",
  close(T.A_ROCHE, 56000, 0.05), `got ${T.A_ROCHE.toFixed(0)} km`);
check("mean Neptunian density near 1.64 g/cm^3",
  close(T.RHO_NEPTUNE, 1.64, 0.05), `got ${T.RHO_NEPTUNE.toFixed(3)}`);

// The headline number: from today's orbit, doom in ~3.6 Gyr.
const retroNow = T.computeTrack({ retro: true });
check("retrograde track from today ends in shatter", retroNow.doomYears !== null,
  `doomYears=${retroNow.doomYears}`);
check("time to shatter from today is ~3.6 Gyr",
  retroNow.doomYears !== null && close(retroNow.doomYears / 1e9, 3.6, 0.1),
  `got ${(retroNow.doomYears / 1e9).toFixed(2)} Gyr`);

// Prograde twin of the same orbit drifts outward, Moon-style.
const proNow = T.computeTrack({ retro: false, tMaxYears: 4.6e9 });
const proEnd = T.sampleTrack(proNow, 4.6e9);
check("prograde what-if never shatters within 4.6 Gyr", proNow.doomYears === null,
  `doomYears=${proNow.doomYears}`);
check("prograde orbit drifts outward by >35,000 km by +4.6 Gyr",
  proEnd.a - T.A_NOW > 35000, `got Δa=${(proEnd.a - T.A_NOW).toFixed(0)} km`);

// Capture scenario: a0(1-e0^2) = today's a, so circularization lands home.
const capture = T.computeTrack({ a0: 985442, e0: 0.80, retro: true,
  k2qTriton: T.K2_Q_TRITON_CAPTURE });
const circ = capture.points.find(p => p.e < 0.001);
check("capture orbit circularizes (e<0.001) within 1 Gyr",
  circ !== undefined && circ.t < 1e9,
  circ ? `at t=${(circ.t / 1e6).toFixed(0)} Myr` : "never");
check("circularized orbit lands within 10% of today's 354,759 km",
  circ !== undefined && close(circ.a, T.A_NOW, 0.10),
  circ ? `got a=${circ.a.toFixed(0)} km` : "n/a");
check("capture track still ends in shatter, within 4.5 Gyr",
  capture.doomYears !== null && capture.doomYears / 1e9 < 4.5,
  `doomYears=${capture.doomYears}`);

// Scrubbing is monotone: sampleTrack matches the stored knots.
const s1 = T.sampleTrack(retroNow, retroNow.points[Math.floor(retroNow.points.length / 3)].t);
check("sampleTrack reproduces a stored knot exactly",
  s1.a === retroNow.points[Math.floor(retroNow.points.length / 3)].a, "");

// Tidal heat during the capture era, quiet today.
const hotRatio = T.tidalFluxRatio(985442, 0.80, T.K2_Q_TRITON_CAPTURE);
const nowRatio = T.tidalFluxRatio(T.A_NOW, T.E_NOW, T.K2_Q_TRITON_CAPTURE);
check("capture-era tidal flux is 10-500x sunlight at Neptune",
  hotRatio > 10 && hotRatio < 500, `got ${hotRatio.toFixed(1)}x`);
check("today's tidal flux is negligible (<0.01x sunlight)",
  nowRatio < 0.01, `got ${nowRatio.toFixed(4)}x`);

// The retrograde rule itself: inward everywhere, even outside sync.
const inNow = T.dadtPlanet(T.A_NOW, 0, true, T.K2_Q_NEPTUNE);
const outNow = T.dadtPlanet(T.A_NOW, 0, false, T.K2_Q_NEPTUNE);
check("at today's orbit: retrograde decays, prograde expands",
  inNow < 0 && outNow > 0, `${inNow.toExponential(2)} / ${outNow.toExponential(2)} km/s`);
const inLow = T.dadtPlanet(T.A_SYNC * 0.5, 0, false, T.K2_Q_NEPTUNE);
check("prograde inside the synchronous orbit still decays", inLow < 0,
  `${inLow.toExponential(2)} km/s`);

console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
