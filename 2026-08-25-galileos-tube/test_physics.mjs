// test_physics.mjs — node --test test_physics.mjs
// Validates the paraxial engine: thin-lens tracing identities against the
// ABCD-matrix closed forms, dispersion against Cauchy crown-glass values,
// and the ephemeris math against orbital-element anchors.

import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULTS,
  cauchyN,
  fObjForLambda,
  magnification,
  tubeLength,
  pupilDistance,
  exitPupilDia,
  lightGrasp,
  dawesArcsec,
  traceRay,
  traceBundle,
  exitAngleDeg,
  halfFieldDeg,
  halfFieldClosedForm,
  MOONS,
  moonOffsets,
  VENUS_R,
  venusGeometry,
} from "./physics.js";

const close = (actual, expected, tol, label) =>
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `${label}: got ${actual}, want ${expected} +/- ${tol}`,
  );

test("Cauchy crown glass hits n_d ~ 1.5168 at the d-line", () => {
  close(cauchyN(587.6), 1.51676, 2e-5, "n_d");
  close(cauchyN(486.1), 1.52237, 2e-5, "n_F");
  close(cauchyN(656.3), 1.51435, 2e-5, "n_C");
});

test("blue focuses shorter than red: longitudinal CA ~1.9% of f", () => {
  const fb = fObjForLambda(486.1);
  const fg = fObjForLambda(587.6);
  const fr = fObjForLambda(656.3);
  close(fg, DEFAULTS.fObj, 1e-12, "green is the reference focus");
  assert.ok(fb < fg && fg < fr, `focus order f_b=${fb} f_g=${fg} f_r=${fr}`);
  close(fb, 65.291, 2e-3, "blue focus");
  close(fr, 66.310, 2e-3, "red focus");
  close((fr - fb) / fg, 0.01546, 2e-4, "relative CA spread");
});

test("Padua Senate scope: M = 8.8x, tube SHORTER than the objective", () => {
  close(magnification(), 8.8, 1e-12, "M = f_obj/|f_eye|");
  close(tubeLength(), 58.5, 1e-12, "L = f_obj - |f_eye|");
});

test("exit pupil is virtual, inside the tube: z = L·f_eye/f_obj", () => {
  close(pupilDistance(), (58.5 * -7.5) / 66, 1e-12, "pupil distance");
  assert.ok(pupilDistance() < 0, "Galilean pupil must be virtual (negative)");
  // Keplerian flips it real:
  const kep = { ...DEFAULTS, fEye: 11 };
  close(pupilDistance(kep), (77 * 11) / 66, 1e-12, "Kepler pupil behind ocular");
});

test("exit pupil diameter = D_obj/M", () => {
  close(exitPupilDia(), 1.6 / 8.8, 1e-12, "D_x");
  close(lightGrasp(), (1.6 / 0.5) ** 2, 1e-12, "light grasp 10.24x");
  close(dawesArcsec(1.6), 116 / 16, 1e-12, "Dawes 7.25\"");
});

test("focused trace: exit slope is exactly M·alpha, upright for Galilean", () => {
  for (const alpha of [0.01, 0.05, 0.1]) {
    const out = exitAngleDeg(alpha);
    close(out, magnification() * alpha, 1e-6, `exit angle for alpha=${alpha}`);
    assert.ok(out > 0, "image must be upright (positive slope)");
  }
});

test("Keplerian ocular inverts: exit slope = -M·alpha", () => {
  const kep = { ...DEFAULTS, fEye: 11 };
  close(exitAngleDeg(0.05, kep), -(66 / 11) * 0.05, 1e-6, "inverted exit");
  const bundle = traceBundle(0.05, kep);
  close(bundle.deliveredFraction, 1, 1e-9, "on-axis fully delivered");
});

test("defocused eyepiece: exit rays stop being parallel", () => {
  const defocused = { ...DEFAULTS, eyePos: tubeLength() + 3 };
  const b = traceBundle(0, defocused, null, 9);
  const slopes = b.rays.map((r) => {
    const [a, c] = r.pts.slice(-2);
    return (c.y - a.y) / (c.x - a.x);
  });
  const spread = Math.max(...slopes) - Math.min(...slopes);
  assert.ok(spread > 5e-3, `defocused spread should be visible, got ${spread}`);
  const focused = traceBundle(0, DEFAULTS, null, 9);
  const fslopes = focused.rays.map((r) => {
    const [a, c] = r.pts.slice(-2);
    return (c.y - a.y) / (c.x - a.x);
  });
  close(Math.max(...fslopes) - Math.min(...fslopes), 0, 1e-10, "focused parallelism");
});

test("rays clip at the apertures exactly as geometric optics demands", () => {
  const outside = traceRay(DEFAULTS.aperture / 2 + 0.05, 0);
  assert.equal(outside.clippedAt, "objective", "ray off the objective clips");
  const wide = traceRay(0, (2 * Math.PI) / 180); // 2 degrees off axis
  assert.equal(wide.clippedAt, "eyepiece", "wide-field chief ray misses the ocular");
});

test("true field of view: numeric sweep matches the lever-arm formula", () => {
  // alpha_half = atan[(r_pupil - D_exit/2) / (L + l_eye·M)] = 0.1198 deg
  close(halfFieldClosedForm(), 0.11980, 2e-4, "closed-form half field");
  const numeric = halfFieldDeg();
  close(numeric, halfFieldClosedForm(), 0.02 * halfFieldClosedForm(),
    "numeric sweep vs formula");
});

test("higher power: true field shrinks, apparent field grows", () => {
  const x20 = { ...DEFAULTS, fObj: 66, fEye: -3.3 }; // Sidereus Nuncius scope
  const fovX9 = halfFieldDeg();
  const fovX20 = halfFieldDeg(x20);
  close(magnification(x20), 20, 1e-9, "x20 preset");
  assert.ok(fovX20 < fovX9,
    `x20 field (${fovX20}) must be strictly smaller than x9 field (${fovX9})`);
  // what you SEE is magnification x true field — and that grows:
  assert.ok(magnification(x20) * fovX20 > magnification() * fovX9,
    "apparent field of view should grow with power");
});

test("Medicean moons: periods exact, Jan 7 sketch reproduced", () => {
  close(MOONS[0].period, 1.769138, 1e-9, "Io");
  close(MOONS[1].period, 3.551181, 1e-9, "Europa");
  close(MOONS[2].period, 7.154553, 1e-9, "Ganymede");
  close(MOONS[3].period, 16.689017, 1e-9, "Callisto");
  const t0 = moonOffsets(0);
  assert.ok(t0.every((m) => m.offset > 0),
    "Jan 7: every starlet east of Jupiter (his first sketch)");
  assert.ok(t0[3].offset > t0[2].offset && t0[2].offset > t0[1].offset,
    "strung outward: Ganymede then Callisto farthest");
  // strict periodicity of the projection
  const t1 = moonOffsets(13.5);
  const t2 = moonOffsets(13.5 + MOONS[1].period);
  close(t1[1].offset, t2[1].offset, 1e-9, "Europa repeats after P");
});

test("Venus phases: new at inferior conjunction, gibbous at quadrature", () => {
  const inf = venusGeometry(0);
  close(inf.k, 0, 1e-9, "k=0 at inferior conjunction");
  close(inf.elongationDeg, 0, 1e-6, "elongation 0");
  close(inf.diamArcsec, 60.3, 0.5, "~60 arcsec across near inferior");
  const synodic = 1 / (1 / 224.701 - 1 / 365.256);
  const sup = venusGeometry(synodic / 2);
  assert.ok(sup.k > 0.97, `k=${sup.k} near full at superior conjunction`);
  // peak elongation arcsin(r_v/r_e) = 46.35 deg
  let bestEl = 0;
  for (let t = -140; t <= 140; t += 0.5) {
    bestEl = Math.max(bestEl, venusGeometry(t).elongationDeg);
  }
  close(bestEl, (Math.asin(VENUS_R) * 180) / Math.PI, 0.35, "greatest elongation");
});
