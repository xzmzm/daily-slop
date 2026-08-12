// test_engine.js — assertions for the chiral-lab engine.
// Run with:  node test_engine.js
//
// Each test prints a one-line PASS / FAIL. Exit code 1 on any failure.

'use strict';

const E = require('./engine.js');

let npass = 0, nfail = 0;
function ok(name, cond, extra) {
  if (cond) { npass++; console.log('  PASS  ' + name); }
  else { nfail++; console.log('  FAIL  ' + name + (extra ? '   ' + extra : '')); }
}
function near(name, a, b, tol, extra) {
  const d = Math.abs(a - b);
  ok(name + `  (${a.toExponential(4)} vs ${b.toExponential(4)}, Δ=${d.toExponential(2)})`,
     d <= tol, extra);
}
// max abs entry of a flat matrix
function mabs(m) { let z = 0; for (const v of m) z = Math.max(z, Math.abs(v)); return z; }
// max abs deviation of a flat matrix from the identity
function devI(m) {
  const I = [1,0,0,0,1,0,0,0,1];
  let z = 0;
  for (let i = 0; i < 9; i++) z = Math.max(z, Math.abs(m[i] - I[i]));
  return z;
}

// Deterministic PRNG so the suite is reproducible.
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

console.log('chiral-lab engine — verification\n');

// ─────────────────────────────────────────────────────────────────────────
// 1. Matrix determinants & orthogonality.  THE core fact: reflections are
//    det −1, rotations are det +1.
// ─────────────────────────────────────────────────────────────────────────
console.log('[1] determinants & orthogonality');
{
  near('  det(I) = +1', E.det(E.identity()), 1, 1e-12);
  for (const n of [E.PLANES.yz, E.PLANES.xz, E.PLANES.xy, [1, 1, 1], [0.3, -0.4, 0.9]]) {
    const R = E.reflect(n);
    near(`  det(reflect) = −1`, E.det(R), -1, 1e-12);
    // Reflection is its own inverse: R·R = I.
    const RR = E.multiply(R, R);
    ok(`  reflect² = I  (dev=${devI(RR).toExponential(1)})`, devI(RR) < 1e-9);
  }
  let rotDetOk = true, rotOrthoOk = true;
  const axes = [[1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 1], [0.2, -0.7, 0.5]];
  for (const ax of axes) {
    for (let i = 0; i < 12; i++) {
      const th = (i / 12) * 2 * Math.PI + 0.13;
      const R = E.fromAxisAngle(ax, th);
      if (Math.abs(E.det(R) - 1) > 1e-9) rotDetOk = false;
      // R·Rᵀ = I  (orthonormal)
      const Rt = E.transpose(R);
      const P = E.multiply(R, Rt);
      if (devI(P) > 1e-9) rotOrthoOk = false;
    }
  }
  ok('  all rotations det = +1', rotDetOk);
  ok('  all rotations R·Rᵀ = I (orthonormal)', rotOrthoOk);
}

// ─────────────────────────────────────────────────────────────────────────
// 2. The parity proof: reflection ∘ rotation always has det −1, so it can
//    never be the identity (det +1).  That is why no turn superimposes a
//    left hand onto a right hand.
// ─────────────────────────────────────────────────────────────────────────
console.log('[2] parity proof (det reflection∘rotation = −1)');
{
  let allNeg = true, neverIdentity = true;
  const Ref = E.reflect(E.PLANES.yz);
  for (const ax of [[1, 0, 0], [0.3, 0.7, 0.2], [1, 2, 3]]) {
    for (let i = 0; i < 24; i++) {
      const th = (i / 24) * 2 * Math.PI;
      const R = E.fromAxisAngle(ax, th);
      const M = E.multiply(Ref, R);
      if (Math.abs(E.det(M) + 1) > 1e-9) allNeg = false;
      // M is never the identity: it must move some vector.
      const v = E.applyVec(M, [1, 0.5, 0.25]);
      if (Math.abs(v[0] - 1) < 1e-9 && Math.abs(v[1] - 0.5) < 1e-9 && Math.abs(v[2] - 0.25) < 1e-9) {
        neverIdentity = false;
      }
    }
  }
  ok('  det(reflect·rotate) = −1 for every sampled rotation', allNeg);
  ok('  reflect·rotate is never the identity', neverIdentity);
  // Rotations are closed under composition: product of two rotations is det +1.
  const R1 = E.fromAxisAngle([1, 1, 0], 0.7);
  const R2 = E.fromAxisAngle([0, 2, 1], -1.1);
  near('  det(rot·rot) = +1 (rotations closed)', E.det(E.multiply(R1, R2)), 1, 1e-9);
}

// ─────────────────────────────────────────────────────────────────────────
// 3. Jacobi eigendecomposition of a symmetric 3×3.  Reconstruction
//    A = VΛVᵀ, and V is orthonormal.
// ─────────────────────────────────────────────────────────────────────────
console.log('[3] symmetric eigensolve (Jacobi)');
{
  const rnd = lcg(42);
  let reconOk = true, orthoOk = true, eigReal = true;
  for (let trial = 0; trial < 30; trial++) {
    // Build a random symmetric matrix.
    const a = [];
    for (let i = 0; i < 9; i++) a[i] = rnd() * 2 - 1;
    const A = [
      a[0], a[1], a[2],
      a[1], a[3], a[4],
      a[2], a[4], a[5],
    ];
    const { lambda, V } = E.jacobiEigen3(A);
    if (lambda.some((v) => !Number.isFinite(v))) eigReal = false;
    // Reconstruct V·diag(λ)·Vᵀ and compare.
    const L = [lambda[0],0,0, 0,lambda[1],0, 0,0,lambda[2]];
    const Vflat = [
      V[0][0], V[1][0], V[2][0],
      V[0][1], V[1][1], V[2][1],
      V[0][2], V[1][2], V[2][2],
    ];
    const recon = E.multiply(Vflat, E.multiply(L, E.transpose(Vflat)));
    let reconErr = 0;
    for (let i = 0; i < 9; i++) reconErr = Math.max(reconErr, Math.abs(recon[i] - A[i]));
    if (reconErr > 1e-9) reconOk = false;
    // V orthonormal: VᵀV = I.
    const VtV = E.multiply(E.transpose(Vflat), Vflat);
    if (Math.abs(VtV[0]-1)>1e-9||Math.abs(VtV[4]-1)>1e-9||Math.abs(VtV[8]-1)>1e-9||
        Math.abs(VtV[1])>1e-9||Math.abs(VtV[2])>1e-9||Math.abs(VtV[5])>1e-9) orthoOk = false;
  }
  ok('  A = V·diag(λ)·Vᵀ reconstructed (30 random matrices)', reconOk);
  ok('  eigenvectors orthonormal', orthoOk);
  ok('  eigenvalues finite & real', eigReal);
}

// ─────────────────────────────────────────────────────────────────────────
// 4. SVD of a 3×3: H = U·diag(s)·Vᵀ, s ≥ 0 sorted desc, U/V orthonormal.
// ─────────────────────────────────────────────────────────────────────────
console.log('[4] 3×3 SVD');
{
  const rnd = lcg(7);
  let reconOk = true, orthoOk = true, sortedOk = true;
  for (let trial = 0; trial < 30; trial++) {
    const H = [];
    for (let i = 0; i < 9; i++) H[i] = rnd() * 2 - 1;
    const { U, V, s } = E.svd3(H);
    if (!(s[0] >= s[1] - 1e-12 && s[1] >= s[2] - 1e-12) || s.some((v) => v < -1e-9)) sortedOk = false;
    const Uflat = [U[0][0],U[1][0],U[2][0], U[0][1],U[1][1],U[2][1], U[0][2],U[1][2],U[2][2]];
    const Vflat = [V[0][0],V[1][0],V[2][0], V[0][1],V[1][1],V[2][1], V[0][2],V[1][2],V[2][2]];
    // UᵀU and VᵀV ≈ I
    const UtU = E.multiply(E.transpose(Uflat), Uflat);
    const VtV = E.multiply(E.transpose(Vflat), Vflat);
    for (const M of [UtU, VtV]) {
      if (Math.abs(M[0]-1)>1e-7||Math.abs(M[4]-1)>1e-7||Math.abs(M[8]-1)>1e-7||
          Math.abs(M[1])>1e-7||Math.abs(M[2])>1e-7||Math.abs(M[5])>1e-7) orthoOk = false;
    }
    // H V = U diag(s)  ⟺  H ≈ U diag(s) Vᵀ
    const recon = E.multiply(Uflat, E.multiply([s[0],0,0,0,s[1],0,0,0,s[2]], E.transpose(Vflat)));
    let bad = 0;
    for (let i = 0; i < 9; i++) bad = Math.max(bad, Math.abs(recon[i] - H[i]));
    if (bad > 1e-7) reconOk = false;
  }
  ok('  H = U·diag(s)·Vᵀ reconstructed (30 random matrices)', reconOk);
  ok('  U, V orthonormal', orthoOk);
  ok('  singular values ≥ 0 and sorted descending', sortedOk);
}

// ─────────────────────────────────────────────────────────────────────────
// 5. Kabsch recovers a known rotation (and the convention R: Q→P).
// ─────────────────────────────────────────────────────────────────────────
console.log('[5] Kabsch recovers a known rotation');
{
  const rnd = lcg(99);
  const P = [];
  for (let i = 0; i < 40; i++) P.push([rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1]);
  const Rstar = E.fromAxisAngle([0.4, -1.2, 0.7], 1.234);
  const Q = E.rotate(P, Rstar);
  const res = E.kabsch(P, Q);
  near('  best-rotation RMSD ≈ 0', res.rmsd, 0, 1e-9);
  near('  det(best R) = +1 (proper)', E.det(res.R), 1, 1e-9);
  // The recovered R must map Q onto P.
  const Qc = E.center(Q), Pc = E.center(P);
  const rq = E.rotate(Qc, res.R);
  near('  rotate(Q, R) ≈ P  (R maps Q→P)', E.rmsdRawPoints(Pc, rq), 0, 1e-9);
  // Adding a translation must not change the result (centring removes it).
  const Qshift = Q.map((p) => [p[0] + 5, p[1] - 3, p[2] + 2]);
  near('  translation-invariant', E.kabsch(P, Qshift).rmsd, 0, 1e-9);
}

// ─────────────────────────────────────────────────────────────────────────
// 6. Kabsch on a mirror pair: the best *unrestricted* map is improper
//    (det −1) and hits ~0 RMSD; the best *proper* map is what's left over.
// ─────────────────────────────────────────────────────────────────────────
console.log('[6] Kabsch parity on a mirror pair');
{
  const hand = E.hand().pts;
  const M = E.reflect(E.PLANES.yz);
  const mirrorHand = E.reflectCloud(E.center(hand), M);
  const res = E.kabsch(E.center(hand), mirrorHand);
  near('  best unrestricted RMSD ≈ 0', res.rmsdRaw, 0, 1e-6);
  near('  det(best unrestricted map) = −1 (improper)', res.detRaw, -1, 1e-6);
  ok('  best proper RMSD strictly > 0 (this is the chirality)', res.rmsd > 0.05,
     `rmsd=${res.rmsd.toExponential(3)}`);
}

// ─────────────────────────────────────────────────────────────────────────
// 7. Chirality classification.  Achiral → properRmsd ≈ 0; chiral → > tol,
//    with improperRmsd ≈ 0 in every case (a reflection always finishes the
//    job).  Independent of which mirror plane you choose.
// ─────────────────────────────────────────────────────────────────────────
console.log('[7] chirality classification');
{
  const achiral = { 'flat F': E.flatF().pts };
  const chiral = {
    'helix': E.helix(80, 4, 0.6, 2.0, 'right').pts,
    'propeller': E.propeller(3, 1.0, 1.6).pts,
    'tetrahedral centre': E.tetrahedralMolecule().pts,
    'hand': E.hand().pts,
    'snail shell': E.snailShell(3.5, 'right').pts,
  };
  for (const [name, pts] of Object.entries(achiral)) {
    const c = E.chirality(pts);
    near(`  ${name}: properRmsd ≈ 0 (achiral)`, c.properRmsd, 0, 1e-6,
         `proper=${c.properRmsd.toExponential(2)}`);
    ok(`  ${name}: isChiral = false`, !c.isChiral);
  }
  for (const [name, pts] of Object.entries(chiral)) {
    const c = E.chirality(pts);
    ok(`  ${name}: isChiral = true`, c.isChiral,
       `proper=${c.properRmsd.toExponential(2)} improper=${c.improperRmsd.toExponential(2)}`);
    near(`  ${name}: improperRmsd ≈ 0 (a flip always works)`, c.improperRmsd, 0, 1e-6);
  }
  // Plane-independence: chirality is a property of the object, not the mirror.
  const h = E.helix(60, 4, 0.6, 2.0, 'right').pts;
  const c1 = E.chirality(h, E.PLANES.yz);
  const c2 = E.chirality(h, E.PLANES.xy);
  const c3 = E.chirality(h, [0.3, -0.4, 0.9]);
  ok('  helix chiral across 3 different mirror planes',
     c1.isChiral && c2.isChiral && c3.isChiral);
}

// ─────────────────────────────────────────────────────────────────────────
// 8. The 2D-vs-3D lesson.  A flat letter F is CHIRAL in the plane (no in-plane
//    turn aligns its mirror) but ACHIRAL in 3D (flip it over about an in-plane
//    axis).  Chirality depends on how much room you have to move.
// ─────────────────────────────────────────────────────────────────────────
console.log('[8] 2D vs 3D — the flat F');
{
  const F = E.flatF().pts;
  const c2 = E.chirality2D(F);
  const c3 = E.chirality(F, E.PLANES.yz);
  ok('  flat F chiral in 2D (mirror never aligns by turning)', c2.rmsd > 0.1,
     `rmsd2D=${c2.rmsd.toExponential(3)}`);
  near('  flat F achiral in 3D (flip it over → RMSD 0)', c3.properRmsd, 0, 1e-6);
  // The 2D optimum angle and RMSD are exact: a known in-plane rotation of F
  // must be recovered with ~0 residual by procrustes2D.
  const Pc = E.center(F);
  const Rz = E.fromAxisAngle([0, 0, 1], 0.815);
  const rotated = E.rotate(Pc, Rz);
  const proc = E.procrustes2D(Pc, rotated);
  near('  procrustes2D recovers known in-plane rotation (rmsd 0)', proc.rmsd, 0, 1e-9);
  near('  recovered angle ≈ −0.815 (undoes the rotation)', proc.theta, -0.815, 1e-9);
}

// ─────────────────────────────────────────────────────────────────────────
// 9. Helix handedness.  A right-handed and a left-handed helix are exact
//    mirror images of each other; chirality flags them as non-superimposable.
// ─────────────────────────────────────────────────────────────────────────
console.log('[9] helix handedness');
{
  const right = E.helix(120, 4, 0.6, 2.0, 'right').pts;
  const left = E.helix(120, 4, 0.6, 2.0, 'left').pts;
  const cr = E.chirality(right);
  const cl = E.chirality(left);
  ok('  right-handed helix is chiral', cr.isChiral);
  ok('  left-handed helix is chiral', cl.isChiral);
  const mirrorRight = E.reflectCloud(E.center(right), E.reflect(E.PLANES.yz));
  // Mirroring a right-handed helix yields a LEFT-handed helix (same handedness
  // as the generated left one) — so a proper rotation DOES align them.
  const toLeft = E.kabsch(E.center(left), mirrorRight);
  near('  mirror(right helix) aligns to left helix by a proper turn',
       toLeft.rmsd, 0, 1e-6, `rmsd=${toLeft.rmsd.toExponential(2)}`);
  near('  that turn is proper (det +1)', E.det(toLeft.R), 1, 1e-6);
  // But mirror(right) never aligns back to RIGHT by any proper turn (that is
  // the chirality) — only the improper map finishes it.
  const toRight = E.kabsch(E.center(right), mirrorRight);
  ok('  no proper turn aligns mirror(right) back onto right',
     toRight.rmsd > 0.05, `rmsd=${toRight.rmsd.toExponential(2)}`);
  near('  improper map does align it (det −1)', toRight.detRaw, -1, 1e-6);
}

// ─────────────────────────────────────────────────────────────────────────
// 10. Centring & RMSD sanity.
// ─────────────────────────────────────────────────────────────────────────
console.log('[10] centring & RMSD');
{
  const P = [[1, 1, 1], [-1, -1, -1], [2, 0, -2], [0, 3, -1]];
  const c = E.centroid(P);
  const Pc = E.center(P);
  near('  centroid of centred cloud = 0', E.centroid(Pc)[0], 0, 1e-12);
  near('  centroid y = 0', E.centroid(Pc)[1], 0, 1e-12);
  near('  centroid z = 0', E.centroid(Pc)[2], 0, 1e-12);
  near('  rmsd of identical clouds = 0', E.rmsdRawPoints(P, P), 0, 1e-12);
  const Q = P.map((p) => [p[0] + 1, p[1], p[2]]);
  near('  rmsd of unit-translated cloud = 1', E.rmsdRawPoints(P, Q), 1, 1e-12);
}

console.log(`\n${npass} passed, ${nfail} failed.`);
process.exit(nfail === 0 ? 0 : 1);
