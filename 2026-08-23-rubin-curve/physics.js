// physics.js — Newtonian rotation-curve engine for an exponential disk
// inside a pseudo-isothermal dark-matter halo.
//
// Units: radius kpc, velocity km/s, mass M_sun.
// G in these units: 4.30091e-6 kpc (km/s)^2 M_sun^-1.
//
// Disk   : Freeman (1970) exponential-disk curve, exact Bessel form
//          v_d^2 = 4 pi G Sigma0 h y^2 [I0(y)K0(y) - I1(y)K1(y)],  y = r/(2h)
// Halo   : pseudo-isothermal sphere, v_h^2 = v_inf^2 [1 - (rc/r) atan(r/rc)]
// Total  : quadrature sum sqrt(v_d^2 + v_h^2) — standard rotation-curve fit.
//
// Everything below is self-contained (Bessel functions implemented from
// their defining series) so test_physics.mjs can validate against textbook
// reference values without any dependency.

export const G = 4.30091e-6; // kpc (km/s)^2 / M_sun
export const KMS_TO_KPC_PER_GYR = 1.022712165; // 1 km/s ~ 1.0227 kpc/Gyr

export const DEFAULTS = {
  mdisk: 6.0e10, // M_sun, stellar disk
  h: 4.0, // kpc, disk scale length
  vinf: 190.0, // km/s, halo asymptotic speed
  rc: 3.5, // kpc, halo core radius
  rmax: 32.0, // kpc, chart extent
  rLast: 24.0, // kpc, "last measured point" (paper's outermost)
};

/* ------------------------------------------------------------------ */
/* Modified Bessel functions of the first kind — defining power series */
/* (all-positive terms, no cancellation):                              */
/*   I0(x) = sum_{k>=0} (x^2/4)^k / (k!)^2                             */
/*   I1(x) = sum_{k>=0} (x/2)^(2k+1) / (k! (k+1)!)                     */
/* ------------------------------------------------------------------ */

export function besseli0(x) {
  x = Math.abs(x);
  const z = (x * x) / 4;
  let term = 1;
  let sum = 1;
  for (let k = 1; k < 200; k++) {
    term *= z / (k * k);
    sum += term;
    if (term < 1e-18 * sum && k > 3) break;
  }
  return sum;
}

export function besseli1(x) {
  const ax = Math.abs(x);
  const half = ax / 2;
  let term = half;
  let sum = half;
  for (let k = 1; k < 200; k++) {
    term *= (half * half) / (k * (k + 1));
    sum += term;
    if (term < 1e-18 * sum && k > 3) break;
  }
  return x < 0 ? -sum : sum;
}

/* ------------------------------------------------------------------ */
/* K0: convergent small-argument series, asymptotic tail for large x.  */
/*   K0(x) = -ln(x/2) - gamma + sum_{k>=1} z^k/(k!)^2 * (Hk - ln(x/2) - gamma)
/*   with z = x^2/4, Hk the harmonic numbers (derived from the         */
/*   standard small-argument expansion; exact, no remembered tables).  */
/*   Large x: K0 ~ sqrt(pi/2x) e^-x (1 - 1/(8x) + 9/(128x^2) - 225/(3072x^3))
/*   K1 from the Wronskian identity: I0 K1 + I1 K0 = 1/x.             */
/* ------------------------------------------------------------------ */

const GAMMA = 0.5772156649015329;

export function besselk0(x) {
  if (x <= 0) return Infinity;
  if (x > 4.0) {
    const s = 1 - 1 / (8 * x) + 9 / (128 * x * x) - 225 / (3072 * x ** 3);
    return Math.sqrt(Math.PI / (2 * x)) * Math.exp(-x) * s;
  }
  const L = Math.log(x / 2);
  const z = (x * x) / 4;
  const base = -L - GAMMA;
  let term = 1; // z^k / (k!)^2, starting at k=0 value 1
  let harmonic = 0;
  let sum = 0;
  for (let k = 1; k < 100; k++) {
    term *= z / (k * k);
    harmonic += 1 / k;
    const piece = term * (harmonic + base);
    sum += piece;
    if (k > 4 && Math.abs(piece) < 1e-18 * Math.abs(sum)) break;
  }
  return base + sum;
}

export function besselk1(x) {
  if (x <= 0) return Infinity;
  return (1 / x - besseli1(x) * besselk0(x)) / besseli0(x);
}

/* ------------------------------------------------------------------ */
/* Rotation curves                                                     */
/* ------------------------------------------------------------------ */

/** Newtonian circular speed of the exponential disk alone (km/s). */
export function diskV(r, { mdisk, h } = DEFAULTS) {
  if (r <= 0) return 0;
  const sigma0 = mdisk / (2 * Math.PI * h * h); // central surface density
  const y = r / (2 * h);
  const combo = besseli0(y) * besselk0(y) - besseli1(y) * besselk1(y);
  const v2 = 4 * Math.PI * G * sigma0 * h * y * y * combo;
  return Math.sqrt(Math.max(0, v2));
}

/** Circular speed of the pseudo-isothermal halo alone (km/s). */
export function haloV(r, { vinf, rc } = DEFAULTS) {
  if (r <= 0) return 0;
  const v2 = vinf * vinf * (1 - (rc / r) * Math.atan(r / rc));
  return Math.sqrt(Math.max(0, v2));
}

/** Observed/total circular speed (km/s) — disk (+ halo when enabled). */
export function totalV(r, params, haloOn = true) {
  const vd = diskV(r, params);
  if (!haloOn) return vd;
  return Math.sqrt(vd * vd + haloV(r, params) ** 2);
}

/** Kepler reference: all visible mass treated as a point at the centre. */
export function keplerV(r, { mdisk } = DEFAULTS) {
  if (r <= 0) return 0;
  return Math.sqrt((G * mdisk) / r);
}

/* ------------------------------------------------------------------ */
/* Enclosed-mass budgets                                               */
/* ------------------------------------------------------------------ */

/** Enclosed mass of the exponential disk interior to r. */
export function diskMass(r, { mdisk, h } = DEFAULTS) {
  const x = r / h;
  return mdisk * (1 - Math.exp(-x) * (1 + x));
}

/** Enclosed halo mass interior to r (from v_h^2 r / G). */
export function haloMass(r, params) {
  const v = haloV(r, params);
  return (v * v * r) / G;
}

/** Total enclosed mass implied by the observed circular speed. */
export function enclosedMass(r, params, haloOn = true) {
  const v = totalV(r, params, haloOn);
  return (v * v * r) / G;
}

/** Dark-matter fraction inside r (0 when the halo is switched off). */
export function darkFraction(r, params, haloOn = true) {
  if (!haloOn) return 0;
  const total = enclosedMass(r, params, true);
  if (total <= 0) return 0;
  return 1 - diskMass(r, params) / total;
}

/** Peak location/speed sanity anchors (Binney & Tremaine): the
 *  exponential-disk curve peaks near R = 2.15 h–2.2 h at
 *  v_peak ~ 0.622 sqrt(G M / h). Used by the tests. */
export function diskPeak(params) {
  let best = { r: 0, v: 0 };
  for (let r = 0.05; r <= 40; r += 0.01) {
    const v = diskV(r, params);
    if (v > best.v) best = { r, v };
  }
  return best;
}

/** Deterministic RNG (mulberry32) — the app seeds stars and the video
 *  rendering needs identical "observational" noise every run. */
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

/** Gaussian noise from a uniform RNG (Box–Muller, deterministic pair). */
export function gauss(rng) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
