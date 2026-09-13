/* ==========================================================================
   Luna 2 (1959) — closed-form translunar ballistics and instrument math.
   Everything here is exact two-body arithmetic (Kepler / Barker / patched
   conics / dipole field), no numerical integration. Units: km, s, kg, γ(nT).
   ========================================================================== */

export const C = {
  MU_E: 398600.4418,          // km^3/s^2
  R_E: 6371,                  // mean Earth radius, km
  MU_M: 4902.800066,          // km^3/s^2
  R_M: 1737.4,                // Moon radius, km
  ORBIT_R: 384400,            // mean Earth–Moon distance, km
  MOON_PERIOD_D: 27.321661,   // sidereal month, days
  V_EQ_EARTH: 0.4651,         // equatorial rotation speed, km/s
  BAIKONUR_LAT: 45.965,       // degrees N
  PROBE_MASS: 390.2,          // Luna 2 launch mass, kg
  RP: 6571,                   // injection perigee radius (200 km altitude), km
  VINF: 1.65,                 // hyperbolic excess calibrated to the 38h22m flight
  V_MOON_MEAN: 1.023,         // published mean lunar orbital speed, km/s
  DOK_T_FLIGHT: 138162,       // 12 Sep 06:39:42 -> 13 Sep 21:02:24 UT, s
  B_EQ_GAMMA: 31200,          // Earth surface equatorial dipole field, gamma
  MAG_FULL_SCALE: 750,        // fluxgate range, gamma
  MAG_BITS: 6,                // telemetry quantization bits
  LUNAR_BOUND_GAMMA: 25,      // published upper bound ~2-3e-4 G, gamma
  NA_MASS_KG: 22.98976928 * 1.66053906660e-27,
  K_B: 1.380649e-23,
  NA_RELEASE_KM: 156000,      // spent stage sodium release, km from Earth
  NA_CLOUD_KM: 650,           // observed expanded cloud diameter, km
  MOON_ANG_DIAM_ARCMIN: 31.1, // reference full Moon
  PENTAGONS: 144,             // 2 spheres x 72 pentagonal shields
};

export const OMEGA_M = (2 * Math.PI) / (C.MOON_PERIOD_D * 86400); // rad/s
export const V_MOON = OMEGA_M * C.ORBIT_R;                        // km/s

/* ---------- basic two-body ---------- */

export const escapeSpeed = (r) => Math.sqrt((2 * C.MU_E) / r);

export const perigeeSpeed = (vinf, rp = C.RP) =>
  Math.sqrt(escapeSpeed(rp) ** 2 + vinf ** 2);   // vis-viva at perigee

/* Hyperbola geometry from v_inf and perigee radius. */
export function hyperbola(vinf, rp = C.RP) {
  const a = C.MU_E / vinf ** 2;        // semi-major axis magnitude, km
  const e = 1 + rp / a;
  const vp = perigeeSpeed(vinf, rp);
  const h = rp * vp;                   // specific angular momentum
  const p = (h * h) / C.MU_E;
  return { a, e, vp, h, p };
}

/* Time from perigee to radius R on a hyperbola: t = sqrt(a^3/mu) (e sinh H - H). */
export function hypTimeToRadius(vinf, R, rp = C.RP) {
  const { a, e } = hyperbola(vinf, rp);
  const H = Math.acosh((R / a + 1) / e);
  const M = e * Math.sinh(H) - H;
  return Math.sqrt(a ** 3 / C.MU_E) * M;
}

/* Invert hyperbolic Kepler by Newton: time since perigee -> H. */
export function hypAnomalyAtTime(vinf, t, rp = C.RP) {
  const { a, e } = hyperbola(vinf, rp);
  const n = Math.sqrt(C.MU_E / a ** 3);
  const M = n * t;
  let H = Math.asinh(Math.max(M, 1e-12) / e);
  for (let i = 0; i < 60; i++) {
    const f = e * Math.sinh(H) - H - M;
    const fp = e * Math.cosh(H) - 1;
    const d = f / fp;
    H -= d;
    if (Math.abs(d) < 1e-12) break;
  }
  return H;
}

export function hyperbolaState(vinf, t, rp = C.RP) {
  const { e, p } = hyperbola(vinf, rp);
  const H = hypAnomalyAtTime(vinf, t, rp);
  const r = (C.MU_E / vinf ** 2) * (e * Math.cosh(H) - 1);
  const nu =
    2 * Math.atan(Math.sqrt((e + 1) / (e - 1)) * Math.tanh(H / 2));
  return { r, nu, H };   // polar angle = nu, measured from perigee
}

/* Parabolic Barker flight time (the v_inf -> 0 limit). */
export function barkerTime(R, rp = C.RP) {
  const D = Math.sqrt(R / rp - 1);
  return Math.sqrt((2 * rp ** 3) / C.MU_E) * (D + D ** 3 / 3);
}

/* Elliptic time from perigee to radius R (v_p < v_escape). */
export function ellipseTimeToRadius(vp, R, rp = C.RP) {
  const eps = (vp * vp) / 2 - C.MU_E / rp;
  const a = -C.MU_E / (2 * eps);
  const e = 1 - rp / a;
  if (R > a * (1 + e)) return Infinity;   // apogee falls short of the Moon
  const cosE = (1 - R / a) / e;
  const E = Math.acos(cosE);
  const M = E - e * Math.sin(E);
  return Math.sqrt(a ** 3 / C.MU_E) * M;
}

/* Flight time to the Moon's orbit for any perigee speed. */
export function flightTime(vp, R = C.ORBIT_R, rp = C.RP) {
  const vesc = escapeSpeed(rp);
  if (vp < vesc - 1e-9) return ellipseTimeToRadius(vp, R, rp);
  if (vp > vesc + 1e-9) return hypTimeToRadius(Math.sqrt(vp ** 2 - vesc ** 2), R, rp);
  return barkerTime(R, rp);
}

/* ---------- the shot: aim, arrival, miss ---------- */

export function arrivalState(vinf = C.VINF, rp = C.RP) {
  const tArr = hypTimeToRadius(vinf, C.ORBIT_R, rp);
  const { e, p, vp } = hyperbola(vinf, rp);
  const nuArr = Math.acos((p / C.ORBIT_R - 1) / e);
  const vArr = Math.sqrt(vinf ** 2 + (2 * C.MU_E) / C.ORBIT_R); // vis-viva
  const vt = (rp * vp) / C.ORBIT_R;                             // transverse
  const vr = Math.sqrt(vArr ** 2 - vt ** 2);                    // radial
  const leadDeg = (OMEGA_M * tArr * 180) / Math.PI;             // Moon walks this
  const theta0 = nuArr - OMEGA_M * tArr;                        // perfect launch angle
  return { tArr, nuArr, vArr, vt, vr, leadDeg, theta0, e, p, vp };
}

/* v_inf w.r.t. the Moon from the encounter geometry: angle phi between the
   probe's Earth-centric arrival velocity and the Moon's orbital velocity. */
export const moonRelativeSpeed = (phiDeg, vArr) =>
  Math.sqrt(vArr ** 2 + V_MOON ** 2 - 2 * vArr * V_MOON * Math.cos((phiDeg * Math.PI) / 180));

/* The angle Luna 2's geometry actually gives (near-radial arrival). */
export function actualPhiDeg(vinf = C.VINF, rp = C.RP) {
  const { vArr, vt } = arrivalState(vinf, rp);
  return (Math.acos(vt / vArr) * 180) / Math.PI;
}

export const MOON_ESCAPE = Math.sqrt((2 * C.MU_M) / C.R_M);     // 2.3757 km/s
export const impactSpeed = (vinfM) => Math.sqrt(MOON_ESCAPE ** 2 + vinfM ** 2);
export const impactEnergy = (vImpactKmS, m = C.PROBE_MASS) =>
  0.5 * m * (vImpactKmS * 1000) ** 2;                           // joules
export const tntTonnes = (joules) => joules / 4.184e9;

/* Closest approach to the Moon's centre for a launch timing error tau
   (seconds late; negative = early), scanning the closed-form trajectory.
   The aim (theta0) is frozen at the reference v_inf so speed errors can be
   studied separately from timing errors. */
export function missDistance(vinf = C.VINF, tauSec = 0, rp = C.RP, aimVinf = vinf) {
  const ref = arrivalState(aimVinf, rp);
  const { tArr } = ref;
  const state = (t) => {
    const s = hyperbolaState(vinf, Math.max(t, 0), rp);
    const probeX = s.r * Math.cos(s.nu);
    const probeY = s.r * Math.sin(s.nu);
    const moonAng = ref.nuArr + OMEGA_M * (t - tArr + tauSec);
    const moonX = C.ORBIT_R * Math.cos(moonAng);
    const moonY = C.ORBIT_R * Math.sin(moonAng);
    return Math.hypot(probeX - moonX, probeY - moonY);
  };
  let best = Infinity;
  const coarse = 900;
  for (let i = 0; i <= coarse; i++) {
    const t = tArr * (0.6 + (0.8 * i) / coarse);
    const d = state(t);
    if (d < best) best = d;
  }
  const t0 = tArr, span = (tArr * 0.8) / coarse;
  for (let i = -60; i <= 60; i++) {
    const t = t0 + (i / 60) * span;
    const d = state(t);
    if (d < best) best = d;
  }
  return best;
}

/* What a 1 m/s injection speed error costs at the Moon, aim frozen. */
export function speedSensitivityKmPerMs(vinf = C.VINF, rp = C.RP) {
  const miss = missDistance(vinf + 0.001, 0, rp, vinf);
  return miss / 1;   // km per m/s (0.001 km/s perturbation)
}

/* The timing slack the Moon's radius buys: R_M / v_Moon seconds. */
export const RADIUS_TIMING_SLACK_S = C.R_M / V_MOON;

/* ---------- magnetometer: Earth dipole vs the 12-gamma quantum ---------- */

export const dipoleB = (rKm, latDeg = 0, bEq = C.B_EQ_GAMMA) =>
  bEq * (C.R_E / rKm) ** 3 * Math.sqrt(1 + 3 * Math.sin((latDeg * Math.PI) / 180) ** 2);

export const magQuantum = C.MAG_FULL_SCALE / 2 ** C.MAG_BITS;   // ~11.7 -> "±12 gamma"

/* ---------- the sodium artificial comet ---------- */

export const sodiumVth = (T) =>
  Math.sqrt((8 * C.K_B * T) / (Math.PI * C.NA_MASS_KG)) / 1000; // km/s

export const sodiumDiameterKm = (tSec, T) => 2 * sodiumVth(T) * tSec;

export const sodiumAngArcmin = (tSec, T, distKm = C.NA_RELEASE_KM + C.R_E) =>
  (sodiumDiameterKm(tSec, T) / distKm) * (180 / Math.PI) * 60;

/* ---------- helpers ---------- */

export function greatCircleKm(lat1, lon1, lat2, lon2, radius = C.R_M) {
  const d =
    Math.sin((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(((lon2 - lon1) * Math.PI) / 180);
  return Math.acos(Math.min(1, Math.max(-1, d))) * radius;
}

export const rotationBonus = (latDeg = C.BAIKONUR_LAT) =>
  C.V_EQ_EARTH * Math.cos((latDeg * Math.PI) / 180);

export const TIMELINE = [
  { date: 'SEP–DEC 1958', text: 'The first three Soviet Moon shots all fail on the way up. The fourth R-7 lunar stack is being readied at Baikonur.' },
  { date: '4 JAN 1959', text: 'Luna 1 launches 2 January and misses the Moon by 5,995 km — becoming the first artificial satellite of the Sun instead.' },
  { date: '4 MAR 1959', text: 'Pioneer 4, the American answer, sweeps past the Moon at ≈60,000 km — the US record at the time.' },
  { date: '12–14 SEP 1959', text: 'LUNA 2. Launched 12 Sept 06:39:42 UT, impacts 13 Sept 21:02:24 UT = 14 Sept 00:02:24 Moscow time. Jodrell Bank\u2019s tape ends mid-tone; Radio Moscow\u2019s prediction was 84 seconds off.' },
  { date: 'OCT 1959', text: 'Luna 3 loops behind the Moon and photographs the far side for the first time.' },
  { date: '26 APR 1962', text: 'Ranger 4 reaches the lunar far side dead on arrival — the first US object on the Moon.' },
  { date: '3 FEB 1966', text: 'Luna 9 makes the first soft landing, and photographs from the surface.' },
  { date: '20 JUL 1969', text: 'Apollo 11 lands 1,100 km from the Luna 2 impact point — humans, a decade later.' },
  { date: '2009 →', text: 'LRO maps the Moon at half-metre resolution; Luna 2\u2019s exact crater has never been conclusively identified.' },
];

export const FACTS = {
  impactSite: { lat: 29.1, lon: 0.0 },
  apolloDistanceKm: greatCircleKm(29.1, 0.0, 0.674, 23.473),
  moonArc84s: V_MOON * 84,
  lagrangeNote: 'the spent third stage followed about 30 minutes later; its impact point is unknown',
};
