// physics.js — paraxial optics engine for a Galilean telescope.
//
// Units: lengths in cm, angles in radians unless a function name says Deg/Arcsec.
// Sign convention: light travels +x; a ray is (y, theta) with positive theta
// pointing "up". A thin lens of focal length f refracts theta -= y/f, so the
// Galilean eyepiece simply has f < 0 (diverging).
//
// The whole lesson in three closed forms (all validated by tests):
//   M  = f_obj / |f_eye|                       angular magnification
//   L  = f_obj + f_eye = f_obj - |f_eye|       tube length (SHORTER than f_obj)
//   D_x = D_obj / M                            exit pupil diameter
// plus the virtual exit pupil at z = L·f_eye/f_obj behind the eyepiece —
// negative for a Galilean scope: the pupil lives INSIDE the tube, which is
// why the eye position is uncritical but the true field is tiny.

export const DEFAULTS = {
  fObj: 66, // cm — objective focal length (Padua Senate scope ~8.8x)
  fEye: -7.5, // cm — eyepiece focal length; NEGATIVE => Galilean
  eyePos: null, // cm — eyepiece x-position; null => focused at tubeLength
  aperture: 1.6, // cm — objective clear aperture (stopped down, as Galileo did)
  eyePupil: 0.5, // cm — observer's dark-adapted pupil
  eyeOffset: 2.0, // cm — eye sits this far behind the eyepiece
};

export const EYEPIECE_APERTURE = 1.4; // cm — small concave ocular lens

// Cauchy dispersion for crown glass: n(λ) = A + B/λ², λ in nm.
export const CAUCHY_A = 1.5046;
export const CAUCHY_B = 4200; // nm²
export const LAMBDA_NM = { blue: 486.1, green: 587.6, red: 656.3 };
const N_D = CAUCHY_A + CAUCHY_B / (LAMBDA_NM.green * LAMBDA_NM.green);

/** Refractive index of crown glass at wavelength lambdaNm (Cauchy fit). */
export function cauchyN(lambdaNm) {
  return CAUCHY_A + CAUCHY_B / (lambdaNm * lambdaNm);
}

/** Objective focal length at a wavelength: thin-lens power ∝ (n − 1).
 *  Blue focuses SHORTER than red — longitudinal chromatic aberration. */
export function fObjForLambda(lambdaNm, fObj = DEFAULTS.fObj) {
  return fObj * ((N_D - 1) / (cauchyN(lambdaNm) - 1));
}

/* ------------------------------------------------------------------ */
/* Closed-form first-order results                                     */
/* ------------------------------------------------------------------ */

/** Angular magnification M = f_obj/|f_eye| (positive; image upright). */
export function magnification({ fObj, fEye } = DEFAULTS) {
  return Math.abs(fObj / fEye);
}

/** Tube length L = f_obj + f_eye (signed): shorter than f_obj when Galilean. */
export function tubeLength({ fObj, fEye } = DEFAULTS) {
  return fObj + fEye;
}

/** Eyepiece x-position on the bench (focused unless overridden). */
export function eyepiecePosition(params = DEFAULTS) {
  return params.eyePos == null ? tubeLength(params) : params.eyePos;
}

/** Exit-pupil distance behind the eyepiece, signed:
 *  z = L·f_eye/f_obj. Negative (Galilean) = VIRTUAL, inside the tube.
 *  Derived from ABCD matrices: image of the objective stop through the
 *  eyepiece forms where B of P(z)·L(f)·P(L) vanishes → z = Lf/(L−f),
 *  and since L − f = f_obj, z = L·f_eye/f_obj exactly. */
export function pupilDistance(params = DEFAULTS) {
  return (tubeLength(params) * params.fEye) / params.fObj;
}

/** Exit pupil diameter = D_obj/M exactly (lateral magnification |f_eye/f_obj|). */
export function exitPupilDia(params = DEFAULTS) {
  return params.aperture / magnification(params);
}

/** Light-grasp gain vs the naked eye: area ratio (D_obj/D_pupil)². */
export function lightGrasp(params = DEFAULTS) {
  return (params.aperture / params.eyePupil) ** 2;
}

/** Dawes limit in arc seconds for an aperture given in cm. */
export function dawesArcsec(apertureCm) {
  return 116 / (apertureCm * 10);
}

/* ------------------------------------------------------------------ */
/* Ray tracing                                                         */
/* ------------------------------------------------------------------ */

function propagate(x0, y0, th, x1) {
  return y0 + th * (x1 - x0); // strictly paraxial: keeps the trace consistent
}                               // with theta -= y/f refraction to float precision

/**
 * Trace one incident ray through objective and eyepiece to the eye plane.
 * y0: entry height at the objective, alphaRad: field angle (parallel bundle).
 * lambdaNm: null => achromatic (green focus); else dispersive trace.
 * Returns { pts:[{x,y}...], clippedAt, hitsPupil }.
 */
export function traceRay(y0, alphaRad, params = DEFAULTS, lambdaNm = null) {
  const p = { ...DEFAULTS, ...params };
  const fO = lambdaNm == null ? p.fObj : fObjForLambda(lambdaNm, p.fObj);
  const fE = p.fEye;
  const xEyeRaw = eyepiecePosition(p);
  // Guard degenerate drags: the eyepiece must sit somewhere ahead of the eye.
  const xEye = Math.max(Math.abs(fE) * 0.5 + 4, Math.min(xEyeRaw, tubeLength({ ...p, eyePos: null }) * 2));
  const xStart = -Math.min(24, Math.max(10, Math.abs(p.fObj) * 0.3));
  const aObj = p.aperture / 2;
  const aEye = EYEPIECE_APERTURE / 2;
  const tanA = Math.tan(alphaRad);
  const pts = [{ x: xStart, y: y0 + tanA * xStart }];

  if (Math.abs(y0) > aObj + 1e-9) {
    pts.push({ x: 0, y: y0 });
    return { pts, clippedAt: "objective", hitsPupil: false };
  }
  let y = y0;
  let th = alphaRad;
  pts.push({ x: 0, y });
  th -= y / fO;

  const yAtEyeLens = propagate(0, y, th, xEye);
  pts.push({ x: xEye, y: yAtEyeLens });
  if (Math.abs(yAtEyeLens) > aEye + 1e-9) {
    return { pts, clippedAt: "eyepiece", hitsPupil: false };
  }
  th -= yAtEyeLens / fE;

  const xEyePlaneAbs = xEye + p.eyeOffset;
  const yAtPupil = propagate(xEye, yAtEyeLens, th, xEyePlaneAbs);
  pts.push({ x: xEyePlaneAbs, y: yAtPupil });
  const hitsPupil = Math.abs(yAtPupil) <= p.eyePupil / 2 + 1e-9;
  return { pts, clippedAt: null, hitsPupil };
}

/**
 * Trace a filled bundle across the aperture at field angle alphaDeg.
 * Returns rays plus deliveredFraction (fraction reaching the pupil) and the
 * mean exit slope — which must equal ±M·alpha for a focused instrument.
 */
export function traceBundle(alphaDeg, params = DEFAULTS, lambdaNm = null, nRays = 7) {
  const p = { ...DEFAULTS, ...params };
  const a = p.aperture / 2;
  const rays = [];
  let delivered = 0;
  for (let i = 0; i < nRays; i++) {
    const y0 = nRays === 1 ? 0 : -a + (2 * a * i) / (nRays - 1);
    const r = traceRay(y0, (alphaDeg * Math.PI) / 180, p, lambdaNm);
    if (!r.clippedAt && r.hitsPupil) delivered += 1;
    rays.push(r);
  }
  const last = rays[rays.length - 1];
  const first = rays[0];
  const exitPts = last.pts.length >= 4 && first.pts.length >= 4;
  const exitSlope = exitPts
    ? (last.pts[last.pts.length - 1].y - last.pts[last.pts.length - 2].y +
       first.pts[first.pts.length - 1].y - first.pts[first.pts.length - 2].y) /
      (2 * p.eyeOffset)
    : NaN;
  return { rays, deliveredFraction: delivered / nRays, exitSlope };
}

/** Exit slope of the on-axis (chief) ray in degrees — ±M·alpha when focused. */
export function exitAngleDeg(alphaDeg, params = DEFAULTS, lambdaNm = null) {
  const p = { ...DEFAULTS, ...params };
  const r = traceRay(0, (alphaDeg * Math.PI) / 180, p, lambdaNm);
  if (r.clippedAt || r.pts.length < 4) return NaN;
  const [a, b] = r.pts.slice(-2);
  // paraxial slopes ARE angles here — no atan round-trip
  return (((b.y - a.y) / (b.x - a.x)) * 180) / Math.PI;
}

/**
 * True half-field of view in degrees, found numerically: the largest field
 * angle whose bundle still clears both lenses and lands fully in the pupil.
 */
export function halfFieldDeg(params = DEFAULTS) {
  const usable = (deg) => traceBundle(deg, params, null, 11).deliveredFraction >= 0.999;
  if (!usable(0)) return 0;
  let lo = 0;
  let hi = 0.25; // degrees — generous upper bound
  while (usable(hi) && hi < 3) hi *= 2;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (usable(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Closed-form half-field (deg). The chief ray leaves the eyepiece at height
 *  L·α and drifts M·α per cm, so the bundle fits the pupil only while
 *  α·(L + ℓ·M) ≤ r_pupil − D_exit/2 — the famous tiny Galilean field. */
export function halfFieldClosedForm(params = DEFAULTS) {
  const p = { ...DEFAULTS, ...params };
  const slack = p.eyePupil / 2 - exitPupilDia(p) / 2;
  if (slack <= 0) return 0;
  const lever = tubeLength(p) + magnification(p) * p.eyeOffset;
  return (Math.atan(slack / lever) * 180) / Math.PI;
}

/* ------------------------------------------------------------------ */
/* What Galileo saw                                                    */
/* ------------------------------------------------------------------ */

// The four Medicean stars: mean synodic periods in days.
export const MOONS = [
  { name: "Io", period: 1.769138 },
  { name: "Europa", period: 3.551181 },
  { name: "Ganymede", period: 7.154553 },
  { name: "Callisto", period: 16.689017 },
];

// Phase offsets (rad of mean longitude at t=0 = evening of Jan 7, 1610)
// calibrated so the t=0 configuration matches Galileo's notebook sketch:
// three starlets strung out EAST of Jupiter (Callisto farthest), none west.
const MOON_PHASE0 = [Math.asin(0.18), Math.asin(0.42), Math.asin(0.72), Math.asin(0.97)];
const JUPITER_SEMI_MAJOR_CM = [1.0, 1.6, 2.55, 4.5]; // drawing units

/** Projected sky-plane offset of each moon at t days after Jan 7.75, 1610.
 *  All orbits are nearly edge-on, so Galileo saw one line of "stars". */
export function moonOffsets(tDays) {
  return MOONS.map((moon, i) => {
    const lon = MOON_PHASE0[i] + (2 * Math.PI * tDays) / moon.period;
    return {
      name: moon.name,
      period: moon.period,
      offset: Math.sin(lon) * JUPITER_SEMI_MAJOR_CM[i], // + = east (preceding)
      depth: Math.cos(lon), // <0 => behind Jupiter (could be eclipsed)
      lon,
    };
  });
}

// Paraphrases from Sidereus Nuncius / the notebook (t in days from Jan 7 eve).
export const GALILEO_LOG = [
  { t: 0, date: "Jan 7", text: "Three starlets in a line east of Jupiter — he thinks they are fixed stars." },
  { t: 1, date: "Jan 8", text: "All three now WEST?! He first blames his tables, then believes the stars move." },
  { t: 3, date: "Jan 10", text: "Only two remain — the third was behind Jupiter all along." },
  { t: 6, date: "Jan 13", text: "FOUR at last. They turn around Jupiter like planets around the Sun." },
];

/** Venus phase fraction k = (1+cos ψ)/2, ψ = Sun–Venus–Earth angle,
 *  from circular coplanar orbits anchored at inferior conjunction (t=0).
 *  r_v = 0.723 AU, P_v = 224.70 d, P_e = 365.256 d. */
export const VENUS_R = 0.723;
export const VENUS_PERIOD = 224.701;
export const EARTH_PERIOD = 365.256;

export function venusGeometry(tDays) {
  const lv = (2 * Math.PI * tDays) / VENUS_PERIOD; // heliocentric longitude offset
  const le = (2 * Math.PI * tDays) / EARTH_PERIOD;
  // Earth at origin-ish: vectors from Venus to Sun and Venus to Earth
  const vx = VENUS_R * Math.cos(lv);
  const vy = VENUS_R * Math.sin(lv);
  const ex = Math.cos(le);
  const ey = Math.sin(le);
  const vSun = { x: -vx, y: -vy };
  const vEar = { x: ex - vx, y: ey - vy };
  const cosPsi =
    (vSun.x * vEar.x + vSun.y * vEar.y) /
    (Math.hypot(vSun.x, vSun.y) * Math.hypot(vEar.x, vEar.y));
  const k = (1 + cosPsi) / 2; // illuminated fraction
  const distAU = Math.hypot(vEar.x, vEar.y);
  // elongation = angle Sun-Earth-Venus
  const eSun = { x: -ex, y: -ey };
  const cosEl =
    (eSun.x * (vx - ex) + eSun.y * (vy - ey)) / (Math.hypot(eSun.x, eSun.y) * distAU);
  const elongationDeg = (Math.acos(Math.min(1, Math.max(-1, cosEl))) * 180) / Math.PI;
  const diamArcsec = (2 * 6052 / (distAU * 1.496e8)) * 206265;
  return { k, elongationDeg, distAU, diamArcsec };
}
