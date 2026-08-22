// test_physics.mjs — node --test test_physics.mjs
// Validates the Bessel implementations against textbook reference values
// and the rotation-curve engine against the Binney & Tremaine anchors.

import test from "node:test";
import assert from "node:assert/strict";

import {
  G,
  DEFAULTS,
  besseli0,
  besseli1,
  besselk0,
  besselk1,
  diskV,
  haloV,
  totalV,
  keplerV,
  diskMass,
  haloMass,
  enclosedMass,
  darkFraction,
  diskPeak,
  mulberry32,
  gauss,
} from "./physics.js";

const close = (actual, expected, tol, label) =>
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `${label}: got ${actual}, want ${expected} +/- ${tol}`,
  );

test("I0 matches reference values", () => {
  close(besseli0(0.5), 1.0634834, 2e-6, "I0(0.5)");
  close(besseli0(1), 1.2660659, 2e-6, "I0(1)");
  close(besseli0(2), 2.2795852, 2e-6, "I0(2)");
  close(besseli0(4), 11.3019220, 2e-5, "I0(4)");
  close(besseli0(6), 67.2344070, 2e-4, "I0(6)");
  close(besseli0(0), 1, 0, "I0(0)");
});

test("I1 matches reference values", () => {
  close(besseli1(0.5), 0.2578943, 2e-6, "I1(0.5)");
  close(besseli1(1), 0.5651591, 2e-6, "I1(1)");
  close(besseli1(2), 1.5906369, 2e-6, "I1(2)");
  close(besseli1(4), 9.7594652, 2e-5, "I1(4)");
  close(besseli1(6), 61.3419330, 2e-4, "I1(6)");
  close(besseli1(0), 0, 0, "I1(0)");
});

test("K0 matches reference values", () => {
  close(besselk0(0.5), 0.9244191, 3e-5, "K0(0.5)");
  close(besselk0(1), 0.4210244, 3e-5, "K0(1)");
  close(besselk0(2), 0.1138939, 3e-5, "K0(2)");
  close(besselk0(3), 0.0347395, 3e-5, "K0(3)");
  close(besselk0(5), 0.0036911, 3e-6, "K0(5)");
});

test("K1 matches reference values (Wronskian identity)", () => {
  close(besselk1(0.5), 1.6564411, 3e-5, "K1(0.5)");
  close(besselk1(1), 0.6019072, 3e-5, "K1(1)");
  close(besselk1(2), 0.1398659, 3e-5, "K1(2)");
  close(besselk1(3), 0.0401564, 3e-5, "K1(3)");
  close(besselk1(5), 0.0040451, 3e-6, "K1(5)");
});

test("Wronskian I0*K1 + I1*K0 = 1/x", () => {
  for (const x of [0.3, 0.7, 1.5, 2.5, 3.9, 4.5, 6, 8]) {
    close(besseli0(x) * besselk1(x) + besseli1(x) * besselk0(x), 1 / x, 1e-4, `wronskian(${x})`);
  }
});

test("exponential disk peaks near 2.15 h at 0.622 sqrt(GM/h)", () => {
  const p = { ...DEFAULTS };
  const peak = diskPeak(p);
  const expectR = 2.15 * p.h;
  const expectV = 0.622 * Math.sqrt((G * p.mdisk) / p.h);
  assert.ok(
    Math.abs(peak.r - expectR) < 0.25 * p.h,
    `peak radius ${peak.r} should be near 2.15h = ${expectR}`,
  );
  close(peak.v, expectV, 1.5, `peak speed vs anchor`);
});

test("disk curve is Keplerian in the far field", () => {
  const p = { mdisk: 6e10, h: 3.0 };
  for (const r of [40, 60, 100]) {
    const ratio = diskV(r, p) / keplerV(r, p);
    close(ratio, 1, 0.02, `v_d/kepler at r=${r}`);
  }
});

test("disk curve rises ~linearly from the centre (with the known sqrt-log correction)", () => {
  // Near r=0 the combination I0K0-I1K1 diverges like ln(1/y), so
  // v_d ~ r*sqrt(ln(1/r)): slightly steeper than strictly linear.
  const p = { ...DEFAULTS };
  const ratio = diskV(0.1, p) / diskV(0.2, p);
  assert.ok(ratio > 0.5 && ratio < 0.62, `inner slope ratio: ${ratio}`);
});

test("disk enclosed mass saturates at M_disk", () => {
  const p = { ...DEFAULTS };
  assert.equal(diskMass(0, p), 0);
  const frac = diskMass(10 * p.h, p) / p.mdisk;
  assert.ok(frac > 0.999, `mass should converge, got ${frac}`);
});

test("pseudo-isothermal halo: solid body inside, flat outside", () => {
  const p = { vinf: 190, rc: 3.5 };
  close(haloV(0.01, p) / (haloV(0.02, p) || 1), 0.5, 0.02, "inner linear rise");
  close(haloV(10000, p), p.vinf, 0.5, "asymptote");
  close(haloV(0, p), 0, 0, "zero at centre");
});

test("halo enclosed mass grows linearly at large r (flat curve => M ~ r)", () => {
  const p = { vinf: 190, rc: 3.5 };
  const m1 = haloMass(1000, p);
  const m2 = haloMass(2000, p);
  close(m2 / m1, 2.0, 0.01, "M(2000)/M(1000)");
});

test("total curve in quadrature, dark fraction sane", () => {
  const p = { ...DEFAULTS };
  const r = 24;
  const vd = diskV(r, p);
  const vh = haloV(r, p);
  close(totalV(r, p, true), Math.sqrt(vd * vd + vh * vh), 1e-9, "quadrature");
  close(totalV(r, p, false), vd, 1e-9, "halo off = disk");
  const fd = darkFraction(r, p, true);
  assert.equal(darkFraction(r, p, false), 0);
  assert.ok(fd > 0.6 && fd < 0.95, `dark fraction at 24 kpc should be ~0.7-0.9, got ${fd}`);
  // flatness of the total curve between 8 and 28 kpc
  const v8 = totalV(8, p, true);
  const v28 = totalV(28, p, true);
  assert.ok(Math.abs(v28 - v8) / v8 < 0.15, `curve should be roughly flat: v8=${v8} v28=${v28}`);
});

test("Rubin & Ford 1970 anchor: M31 curve stays high past the visible disk", () => {
  // With the default galaxy the visible-mass prediction falls at large r
  // while the "observed" (disk+halo) speed stays up: the whole lesson.
  const p = { ...DEFAULTS };
  const r = 24; // the paper's outermost measured point
  const observed = totalV(r, p, true);
  const predicted = diskV(r, p);
  assert.ok(
    observed / predicted > 1.6,
    `observed/predicted at 24 kpc should be >> 1, got ${observed / predicted}`,
  );
  const mtot = enclosedMass(r, p, true);
  assert.ok(mtot > 3 * p.mdisk, `enclosed mass should dwarf the disk, got ${mtot / p.mdisk}x`);
});

test("mulberry32 is deterministic; gauss is reproducible", () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  const seqA = [a(), a(), a()];
  const seqB = [b(), b(), b()];
  assert.deepEqual(seqA, seqB);
  const g1 = gauss(mulberry32(7));
  const g2 = gauss(mulberry32(7));
  assert.equal(g1, g2);
});
