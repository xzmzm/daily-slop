/* Closed-form assertions for the Luna 2 studio. Run: node test_luna2.mjs */
import * as L from './luna2.js';

let passed = 0;
const checks = [];
function near(name, got, want, tol) {
  const ok = Math.abs(got - want) <= tol;
  checks.push([ok, `${name}: got ${got.toPrecision(6)}, want ${want.toPrecision(6)} ±${tol.toPrecision(3)}`]);
  if (ok) passed++;
}
function isTrue(name, cond, detail = '') {
  checks.push([cond, `${name} ${detail}`]);
  if (cond) passed++;
}

/* ---------- injection ---------- */
near('escape speed at 200 km', L.escapeSpeed(L.C.RP), 11.0146, 0.002);
near('perigee speed at v_inf=1.65 (docs: 11.2 km/s)', L.perigeeSpeed(1.65), 11.137, 0.005);
near('Baikonur eastward rotation bonus, km/s', L.rotationBonus(), 0.3233, 0.001);
near('Moon mean motion, deg/day', (L.OMEGA_M * 86400 * 180) / Math.PI, 13.176, 0.01);
near('Moon orbital speed, km/s', L.V_MOON, 1.0232, 0.001);

/* ---------- flight time: ellipse / parabola / hyperbola ---------- */
const aHoh = (L.C.RP + L.C.ORBIT_R) / 2;
const vpHoh = Math.sqrt(L.C.MU_E * (2 / L.C.RP - 1 / aHoh));
near('Hohmann transfer to the Moon, hours', L.flightTime(vpHoh) / 3600, 119.47, 0.5);
isTrue('below Hohmann speed the ellipse never reaches the Moon', L.ellipseTimeToRadius(vpHoh - 0.01, L.C.ORBIT_R) === Infinity);
near('parabolic (Barker) flight, hours', L.barkerTime(L.C.ORBIT_R) / 3600, 50.68, 0.05);
near('hyperbolic solver continuous with Barker at v_inf→0, hours',
  L.hypTimeToRadius(0.005, L.C.ORBIT_R) / 3600, L.barkerTime(L.C.ORBIT_R) / 3600, 0.01);
const tArr = L.hypTimeToRadius(1.65, L.C.ORBIT_R);
near('Luna 2 calibrated flight time, s (documented 138,162 = 38h22m42s)', tArr, 138162, 700);
near('hyperbolic Kepler roundtrip: r(t=0) equals perigee', L.hyperbolaState(1.65, 0).r, L.C.RP, 1e-3);
isTrue('true anomaly monotone along the coast',
  L.hyperbolaState(1.65, tArr / 2).nu < L.hyperbolaState(1.65, tArr).nu);

/* ---------- the shot ---------- */
const A = L.arrivalState(1.65);
near('Moon lead during the coast, deg (aim 21.1° ahead)', A.leadDeg, 21.05, 0.15);
near('arrival true anomaly, deg', (A.nuArr * 180) / Math.PI, 157.46, 0.2);
near('arrival speed at lunar distance (vis-viva), km/s', A.vArr, 2.190, 0.005);
near('arrival transverse component, km/s', A.vt, 0.190, 0.005);
near('arrival radial component, km/s', A.vr, 2.182, 0.005);
near('true anomaly solver agrees with closed form at arrival, deg',
  (L.hyperbolaState(1.65, tArr).nu * 180) / Math.PI, (A.nuArr * 180) / Math.PI, 0.2);
isTrue('perfect timing hits the Moon', L.missDistance(1.65, 0) <= L.C.R_M,
  `(closest approach ${L.missDistance(1.65, 0).toFixed(1)} km)`);
near('84 s of timing error = Moon arc missed, km', L.missDistance(1.65, 84), L.V_MOON * 84, 15);
near('Luna-1-sized miss (5,995 km) needs ~6,285 s of error', L.missDistance(1.65, 6285), 5995, 300);
isTrue('40 minutes late is a clean miss', L.missDistance(1.65, 2400) > L.C.R_M,
  `(closest approach ${L.missDistance(1.65, 2400).toFixed(0)} km)`);
near('Moon-radius timing slack, s', L.RADIUS_TIMING_SLACK_S, 1698, 5);
const sens = L.speedSensitivityKmPerMs();
isTrue('1 m/s of injection speed costs 5–120 km at the Moon', sens > 5 && sens < 120, `(= ${sens.toFixed(1)} km)`);

/* ---------- the last hour ---------- */
near('actual encounter angle (near-radial arrival), deg', L.actualPhiDeg(), 85.0, 0.3);
near('Moon-relative arrival speed at the real geometry, km/s', L.moonRelativeSpeed(85, 2.19), 2.335, 0.005);
near('Moon surface escape speed, km/s', L.MOON_ESCAPE, 2.3757, 0.002);
const vImp = L.impactSpeed(L.moonRelativeSpeed(85, 2.19));
near('impact speed = sqrt(v_esc^2 + v_inf^2), km/s (documented ~3.3)', vImp, 3.33, 0.02);
near('impact energy of 390.2 kg at 3.331 km/s, GJ', L.impactEnergy(3.331) / 1e9, 2.165, 0.02);
near('same energy in tonnes of TNT', L.tntTonnes(L.impactEnergy(3.331)), 0.517, 0.01);

/* ---------- magnetometer ---------- */
near('dipole field at the surface, equator, gamma', L.dipoleB(L.C.R_E, 0), 31200, 5);
near('dipole field at 45° latitude = 31200·√2.5, gamma', L.dipoleB(L.C.R_E, 45), 31200 * Math.sqrt(2.5), 60);
near('Earth dipole at lunar distance, gamma', L.dipoleB(L.C.ORBIT_R, 0), 0.142, 0.01);
isTrue('Earth\u2019s dipole at the Moon sits below one telemetry quantum',
  L.dipoleB(L.C.ORBIT_R, 45) < L.magQuantum);
near('fluxgate quantization, gamma (published ±12)', L.magQuantum, 11.71875, 0.01);
isTrue('lunar field bound (20–30 gamma) sits above the quantum', L.C.LUNAR_BOUND_GAMMA > L.magQuantum);

/* ---------- the artificial comet ---------- */
near('sodium thermal speed at 500 K, km/s', L.sodiumVth(500), 0.679, 0.007);
near('time to expand to 650 km at 500 K, minutes', 325000 / (L.sodiumVth(500) * 1000) / 60, 8.0, 0.15);
near('angular size of the 650-km cloud, arcmin', L.sodiumAngArcmin(325000 / (L.sodiumVth(500) * 1000), 500), 13.76, 0.3);
near('…as a fraction of the full Moon', L.sodiumAngArcmin(325000 / (L.sodiumVth(500) * 1000), 500) / L.C.MOON_ANG_DIAM_ARCMIN, 0.443, 0.01);

/* ---------- geography & misc ---------- */
near('Apollo 11 distance from the impact site, km', L.greatCircleKm(29.1, 0, 0.674, 23.473), 1097, 15);
near('Moon walks this far in the 84-second prediction error, km', L.V_MOON * 84, 85.9, 0.5);
isTrue('two 72-pentagon spheres = 144 shields', L.C.PENTAGONS === 2 * 72);

const failed = checks.filter((c) => !c[0]);
for (const [ok, msg] of checks) console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
console.log(`\n${passed}/${checks.length} checks passed`);
if (failed.length) process.exit(1);
