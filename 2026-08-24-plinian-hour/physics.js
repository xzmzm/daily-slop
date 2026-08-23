// physics.js — Plinian eruption-column, tephra-fallout and pyroclastic
// density-current engine for the 24 August 79 AD Vesuvius eruption.
//
// Units: SI internally (m, s, kg, Pa), distances exposed in metres,
// clock times in fractional hours from 13:00 on 24 Aug 79 AD.
//
// Three sub-models, each the standard first-order teaching model:
//
// 1. COLUMN   quarter-power plume scaling H = H_ref (mdot/mdot_ref)^(1/4)
//             (Morton–Taylor–Turner dimensional analysis; calibrated so
//             mdot = 1e8 kg/s gives ~33 km, Carey & Sigurdsson's estimate
//             for the grey-pumice phase of 79 AD), with an explicit
//             fountain-collapse criterion: a solids-laden jet survives only
//             if its ballistic coast clears the buoyancy-reversal height.
// 2. FALLOUT  Pyle (1989) exponential thinning on the dispersal axis:
//             M(X,Y) = M0 exp(-X'/b) exp(-Y^2 / 2 w^2), downwind only,
//             with clast terminal velocity in Stokes→Newton drag.
// 3. SURGE    Benjamin box model for a collapse-fed gravity current:
//             front speed U = Fr sqrt(g' h), h = V/(pi R^2) geometric
//             thinning, closed-form arrival times, angular sector masks.
//
// Everything is self-contained pure JS so test_physics.mjs can validate
// every formula exactly.

export const G0 = 9.81;          // m/s^2
export const RHO_A0 = 1.225;     // sea-level air density, kg/m^3
export const SCALE_H = 8500;     // isothermal atmosphere scale height, m
export const P_A0 = 101325;      // sea-level pressure, Pa
export const RS_GAS = 430;       // J/(kg K) gas constant, H2O-rich volcanic gas
export const CHI_VOLATILE = 0.05; // volatile mass fraction at the vent
export const VENT_Z = 1200;      // vent elevation, m (Vesuvius summit ~1281)
export const RHO_DEP = 600;      // loose pumice-fall deposit bulk density, kg/m^3
export const PUMICE_RHO = 500;   // pumice clast particle density, kg/m^3
export const AIR_MU = 1.8e-5;    // dynamic viscosity of air, Pa s

/* ------------------------------------------------------------------ */
/* Atmosphere (isothermal exponential — good to ~20% up to 40 km)      */
/* ------------------------------------------------------------------ */

export function airDensity(z) {
  return RHO_A0 * Math.exp(-Math.max(0, z) / SCALE_H);
}

export function airPressure(z) {
  return P_A0 * Math.exp(-Math.max(0, z) / SCALE_H);
}

/** Standard-atmosphere temperature profile, for display only. */
export function airTemp(z) {
  const zk = Math.max(0, z) / 1000;
  return zk < 11 ? 288.15 - 6.5 * zk : 216.65;
}

export function ventAmbient() {
  return { rho: airDensity(VENT_Z), P: airPressure(VENT_Z) };
}

/* ------------------------------------------------------------------ */
/* Column: mass flux, height, fountain collapse                        */
/* ------------------------------------------------------------------ */

export const H_REF = 33000;       // m, column height at MDOT_REF (C&S 1987: ~33 km)
export const MDOT_REF = 1.0e8;    // kg/s
export const UMBRELLA_FRAC = 0.74; // neutral-buoyancy level / column top (Sparks)
const REVERSAL_KM = 2.2;          // closure constant for thermal dilution (see NOTES)

/** Bulk exit density of the solids-laden jet. The gas alone follows the
 *  ideal gas law at vent pressure; the remaining (1 - chi) is pyroclasts. */
export function exitMixture(T0) {
  const amb = ventAmbient();
  const rhoGas = amb.P / (RS_GAS * T0);
  return rhoGas / CHI_VOLATILE;
}

/** Mass discharge rate, kg/s. */
export function massFlux(r0, u0, T0) {
  return Math.PI * r0 * r0 * u0 * exitMixture(T0);
}

/** Plinian column height above the vent, m. */
export function columnHeight(mdot) {
  if (mdot <= 0) return 0;
  return H_REF * Math.pow(mdot / MDOT_REF, 0.25);
}

/** Umbrella-cloud (neutral buoyancy) height above the vent, m. */
export function umbrellaHeight(mdot) {
  return UMBRELLA_FRAC * columnHeight(mdot);
}

/**
 * Fountain-collapse criterion.
 *
 * The jet leaves the vent denser than air (solids loading), so it is
 * decelerated by reduced gravity g_load while entrainment dilutes it.
 * It survives if its ballistic coast h_ball = u0^2 / (2 |g_load|) reaches
 * the reversal demand h_need = REVERSAL_KM * sqrt(rho_mix/rho_air) before
 * momentum runs out. Colder or slower jets fall back as a fountain and
 * feed pyroclastic currents instead of a buoyant column.
 */
export function collapseMargin(u0, T0) {
  const amb = ventAmbient();
  const rhoMix = exitMixture(T0);
  const gLoad = G0 * (rhoMix - amb.rho) / rhoMix;
  const hBall = (u0 * u0) / (2 * gLoad);
  const hNeed = REVERSAL_KM * 1000 * Math.sqrt(rhoMix / amb.rho);
  return {
    sustained: hBall >= hNeed,
    hBall,
    hNeed,
    margin: hBall - hNeed,
    rhoMix,
    gLoad,
  };
}

/* ------------------------------------------------------------------ */
/* Fallout: terminal velocity + Pyle exponential thinning              */
/* ------------------------------------------------------------------ */

/** Clast terminal velocity, m/s. Stokes below Re=1, Newton above Re=1000,
 *  log-space bridge between. d in metres. */
export function terminalVelocity(d, rhoP = PUMICE_RHO, rhoA = 1.1, cd = 1.0) {
  const vStokes = (rhoP * G0 * d * d) / (18 * AIR_MU);
  const re = (rhoA * vStokes * d) / AIR_MU;
  const vNewton = Math.sqrt((4 * G0 * d * Math.max(rhoP - rhoA, 0)) / (3 * cd * rhoA));
  if (re < 1) return vStokes;
  if (re > 1000) return vNewton;
  const f = Math.log10(re) / 3;
  return Math.exp((1 - f) * Math.log(vStokes) + f * Math.log(vNewton));
}

/** Reynolds number of a clast falling at speed v. */
export function reynolds(d, v, rhoA = 1.1) {
  return (rhoA * v * d) / AIR_MU;
}

export const FALL = {
  B0: 3800,        // m, proximal thinning rate at zero wind (Pyle-style b)
  UW_REF: 15,      // m/s, wind speed at which b doubles
  SHIFT_K: 0.12,   // downwind shift of the lobe peak, fraction of uw*z/vt_med
  CM: 0.75e-8,     // mass calibration: M0 = CM * (erupted kg)^0.92
  MASS_EXP: 0.92,
  VT_MED_D: 0.004, // median clast diameter driving the lobe shift, m
  FALL_START: 0.5, // h from 13:00 — fallout begins
  FALL_END: 14.5,  // h from 13:00 — fallout ends (~03:30)
  WHITE_FRAC: 0.55, // white-pumice share of the fall mass
};

/** Total erupted mass that lands as local tephra, kg. */
export function fallMass(mdot, fallHours = FALL.FALL_END - FALL.FALL_START) {
  return mdot * fallHours * 3600;
}

/**
 * Isomass field M(x, y) in kg/m^2, ground-fixed coordinates with origin at
 * the vent, x along the dispersal axis (downwind positive). Exponential
 * thinning downwind, gentler-but-real decay upwind, Gaussian crosswind.
 */
export function makeIsomass(params) {
  const { mdot, wind } = params;
  const vtMed = terminalVelocity(FALL.VT_MED_D);
  const zRel = umbrellaHeight(mdot) + VENT_Z;
  const shift = FALL.SHIFT_K * wind * (zRel / vtMed);
  const bDown = FALL.B0 * (1 + wind / FALL.UW_REF);
  const bUp = 0.35 * bDown;
  const M0 = FALL.CM * Math.pow(fallMass(mdot), FALL.MASS_EXP);

  return function isomass(x, y) {
    const xp = x - shift;
    const along = xp >= 0 ? Math.exp(-xp / bDown) : Math.exp(xp / bUp);
    const w = 1200 + 0.28 * Math.abs(xp);
    const cross = Math.exp(-(y * y) / (2 * w * w));
    return M0 * along * cross;
  };
}

/** Deposit depth in cm at (x, y). */
export function depthCm(isomass, x, y) {
  return (isomass(x, y) / RHO_DEP) * 100;
}

/** Fraction of the total fall already deposited at time t (hours from 13:00). */
export function fallFraction(t) {
  const span = FALL.FALL_END - FALL.FALL_START;
  const f = (t - FALL.FALL_START) / span;
  return Math.min(1, Math.max(0, f));
}

/* ------------------------------------------------------------------ */
/* Pyroclastic density current (Benjamin box model)                    */
/* ------------------------------------------------------------------ */

export const FR_BENJAMIN = 1.19;  // Benjamin front Froude number
export const H_STOP = 3.0;        // current stalls thinner than this, m
export const RHO_CUR = 1200;      // dense-current mixture density, kg/m^3
export const R0_PULSE = 2000;     // initial release radius, m

export function currentGPrime() {
  return G0 * (RHO_CUR - 1.2) / RHO_CUR;
}

/** Front speed of a box current of thickness h. */
export function currentSpeed(h) {
  return FR_BENJAMIN * Math.sqrt(currentGPrime() * h);
}

/** Maximum runout radius of a pulse releasing volume V (m^3). */
export function runoutMax(V) {
  return Math.sqrt(V / (Math.PI * H_STOP));
}

/** Closed-form travel time to distance D (s); D within R0 arrives at once. */
export function arrivalSeconds(D, V) {
  if (D <= R0_PULSE) return 0;
  const C = FR_BENJAMIN * Math.sqrt((currentGPrime() * V) / Math.PI);
  return (D * D - R0_PULSE * R0_PULSE) / (2 * C);
}

/** Front radius at time dt after release, capped at runout. */
export function frontRadius(dt, V) {
  if (dt <= 0) return R0_PULSE;
  const C = FR_BENJAMIN * Math.sqrt((currentGPrime() * V) / Math.PI);
  const r = Math.sqrt(R0_PULSE * R0_PULSE + 2 * C * dt);
  return Math.min(r, runoutMax(V));
}

/* ------------------------------------------------------------------ */
/* Geography & timeline                                                */
/* ------------------------------------------------------------------ */

/** Towns around the volcano: real offsets from Vesuvius (dN, dE km),
 *  derived bearing/dist. X/Y are dispersal-axis coordinates. */
function townGeometry(windDegToSE = 135) {
  // dispersal axis unit vector toward SE (bearing 135°): (E, N) = (sin, cos)
  const axE = Math.sin((windDegToSE * Math.PI) / 180);
  const axN = Math.cos((windDegToSE * Math.PI) / 180);
  return { axE, axN };
}

export function townXY(town, windDegToSE = 135) {
  const { axE, axN } = townGeometry(windDegToSE);
  const x = town.dE * 1000 * axE + town.dN * 1000 * axN;
  const y = -town.dE * 1000 * axN + town.dN * 1000 * axE;
  return { x, y };
}

export const TOWNS = [
  { key: "misenum", name: "Misenum", dN: -3.76, dE: -27.4, note: "Pliny the Younger watches from here" },
  { key: "herculaneum", name: "Herculaneum", dN: -1.67, dE: -5.57, note: "first surge, 01:05" },
  { key: "oplontis", name: "Oplontis", dN: -7.2, dE: 2.1, note: "villa suburbana under the plume" },
  { key: "pompeii", name: "Pompeii", dN: -8.0, dE: 5.2, note: "pumice all day, surge at dawn" },
  { key: "stabiae", name: "Stabiae", dN: -14.0, dE: 5.5, note: "Pliny the Elder dies here" },
];

export const TOWN_BEARING = Object.fromEntries(
  TOWNS.map((t) => {
    const deg = (Math.atan2(t.dE, t.dN) * 180) / Math.PI;
    return [t.key, deg < 0 ? deg + 360 : deg];
  })
);

export const TOWN_DIST_KM = Object.fromEntries(
  TOWNS.map((t) => [t.key, Math.hypot(t.dN, t.dE)])
);

/** Collapse pulses of the historical night. Times in hours from 13:00,
 *  volumes in m^3 of dense mixture, sectors as [centre, halfwidth] deg. */
export const HISTORICAL_PULSES = [
  { t: 12.08, label: "S1 · the waterfront surge", volume: 1.4e9, centre: 253, half: 26 },
  { t: 13.12, label: "S2 · Oplontis vineyards", volume: 0.7e9, centre: 168, half: 14 },
  { t: 15.07, label: "S3 · the SE countryside", volume: 0.9e9, centre: 121, half: 10 },
  { t: 17.5, label: "S4 · down the Sarno", volume: 2.6e9, centre: 158, half: 11 },
  { t: 18.57, label: "S6 · over the Pompeii wall", volume: 2.2e9, centre: 147, half: 22 },
];

/** Does a pulse sector cover a town bearing? */
export function sectorHits(bearing, centre, half) {
  let d = ((bearing - centre + 540) % 360) - 180;
  return Math.abs(d) <= half;
}

/* ------------------------------------------------------------------ */
/* Full simulation                                                     */
/* ------------------------------------------------------------------ */

/**
 * Simulate the eruption for one parameter set. Returns per-town verdicts,
 * the column state and the pulse schedule actually used.
 */
export function simulate({ u0 = 260, T0 = 1000, r0 = 200, wind = 6, pulses = HISTORICAL_PULSES } = {}) {
  const mdot = massFlux(r0, u0, T0);
  const col = collapseMargin(u0, T0);
  const hCol = columnHeight(mdot);
  const zNb = UMBRELLA_FRAC * hCol;
  const isomass = makeIsomass({ mdot, wind });

  // If the fountain collapses outright, the whole schedule collapses with it:
  // replace the historical pulses by a single massive early release.
  const effPulses = col.sustained
    ? pulses
    : [{ t: FALL.FALL_END - 1, label: "total fountain collapse", volume: 4.5e9, centre: 150, half: 120 }];

  const towns = TOWNS.map((town) => {
    const { x, y } = townXY(town);
    const distKm = Math.hypot(town.dN, town.dE);
    const bearing = TOWN_BEARING[town.key];
    const depthTotal = depthCm(isomass, x, y);
    let surge = null;
    for (const p of effPulses) {
      if (!sectorHits(bearing, p.centre, p.half)) continue;
      if (runoutMax(p.volume) < distKm * 1000) continue;
      const eta = arrivalSeconds(distKm * 1000, p.volume) / 3600;
      const arrive = p.t + eta;
      if (surge === null || arrive < surge.arrive) surge = { arrive, pulse: p.label };
    }
    return {
      ...town,
      x,
      y,
      bearing,
      distKm,
      depthTotal,
      surge,
    };
  });

  return {
    mdot,
    hCol,
    zNb,
    sustained: col.sustained,
    margin: col.margin,
    hBall: col.hBall,
    hNeed: col.hNeed,
    rhoMix: col.rhoMix,
    isomass,
    pulses: effPulses,
    towns,
  };
}

/* ------------------------------------------------------------------ */
/* Clock helpers                                                       */
/* ------------------------------------------------------------------ */

export function fmtClock(t) {
  const total = 13 + t;
  const h = ((total % 24) + 24) % 24;
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  const day = total >= 24 ? 1 : 0; // hours past midnight -> Aug 25
  const ampm = hh < 12 ? "AM" : "PM";
  const h12 = ((hh + 11) % 12) + 1;
  return `${h12}:${String(mm).padStart(2, "0")} ${ampm} · Aug ${day === 0 ? 24 : 25}, 79 AD`;
}

/** Deterministic RNG (mulberry32) for particles — video needs identical runs. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
