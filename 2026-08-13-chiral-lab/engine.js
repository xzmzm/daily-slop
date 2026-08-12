/*
 * chiral-lab — engine
 *
 * Pure mathematics of handedness (chirality). No DOM, no canvas here — just
 * the linear algebra that says why a left hand can never be turned into a
 * right hand, so it can be unit-tested (see test_engine.js) and reasoned
 * about independently.
 *
 * The whole lesson in two lines
 * ----------------------------
 *   A reflection has determinant −1.  Every rotation has determinant +1.
 *   So reflection ∘ rotation always has determinant −1 ≠ +1, and therefore
 *   can never be the identity — which is exactly why no amount of turning
 *   will superimpose a chiral object on its mirror image.
 *
 * To make that tangible we compute, for a point cloud P:
 *
 *   • mirror(P)  — reflection across a plane through the origin (det = −1)
 *   • kabsch(P, Q) — the optimal rigid alignment of Q onto P, both the best
 *       *proper* rotation (det = +1, what your hands can do) and the best
 *       *unrestricted* orthogonal map (det = ±1, what a reflection can do)
 *   • chirality(P) — the RMSD left over when you align mirror(P) onto P using
 *       only rotation.  ≈ 0  ⇒ achiral (you can match it by turning);
 *       bounded away from 0 ⇒ chiral (you never can).  The unrestricted map
 *       always hits ≈ 0 for a mirror pair, so the *gap* between the two RMSDs
 *       is the chirality itself.
 *
 * Vectors are [x, y, z] arrays.  Matrices are row-major flat arrays of length
 * 9:  M = [m00, m01, m02,  m10, m11, m12,  m20, m21, m22],  acting as M·v.
 * Point clouds are arrays of [x,y,z].
 */

(function (global) {
  "use strict";

  // ── 3×3 matrix helpers (row-major, M·v) ───────────────────────────────────

  function identity() {
    return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  }

  function multiply(a, b) {
    // (a·b)·v = a·(b·v)  — b is applied first.
    const o = new Array(9);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        o[r * 3 + c] =
          a[r * 3 + 0] * b[0 * 3 + c] +
          a[r * 3 + 1] * b[1 * 3 + c] +
          a[r * 3 + 2] * b[2 * 3 + c];
      }
    }
    return o;
  }

  function transpose(m) {
    return [
      m[0], m[3], m[6],
      m[1], m[4], m[7],
      m[2], m[5], m[8],
    ];
  }

  function det(m) {
    return (
      m[0] * (m[4] * m[8] - m[5] * m[7]) -
      m[1] * (m[3] * m[8] - m[5] * m[6]) +
      m[2] * (m[3] * m[7] - m[4] * m[6])
    );
  }

  /** Apply matrix m to vector v (m·v). */
  function applyVec(m, v) {
    return [
      m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
      m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
      m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
    ];
  }

  /**
   * Rotation about a unit axis `axis` by angle `theta` (Rodrigues' formula).
   * Returns a proper rotation (det = +1).  `axis` is normalised internally.
   */
  function fromAxisAngle(axis, theta) {
    const inv = Math.hypot(axis[0], axis[1], axis[2]) || 1;
    const ax = axis[0] / inv, ay = axis[1] / inv, az = axis[2] / inv;
    const c = Math.cos(theta), s = Math.sin(theta), C = 1 - c;
    return [
      c + ax * ax * C,     ax * ay * C - az * s, ax * az * C + ay * s,
      ay * ax * C + az * s, c + ay * ay * C,     ay * az * C - ax * s,
      az * ax * C - ay * s, az * ay * C + ax * s, c + az * az * C,
    ];
  }

  /**
   * Reflection across the plane through the origin with unit normal `n`
   * (Householder: R = I − 2 n⊗n).  Determinant −1 by construction.  `n` is
   * normalised internally.
   */
  function reflect(n) {
    const inv = Math.hypot(n[0], n[1], n[2]) || 1;
    const nx = n[0] / inv, ny = n[1] / inv, nz = n[2] / inv;
    return [
      1 - 2 * nx * nx, -2 * nx * ny,     -2 * nx * nz,
      -2 * ny * nx,     1 - 2 * ny * ny, -2 * ny * nz,
      -2 * nz * nx,    -2 * nz * ny,      1 - 2 * nz * nz,
    ];
  }

  /** Standard basis reflection planes (all det = −1). */
  const PLANES = Object.freeze({
    yz: Object.freeze([1, 0, 0]), // x → −x
    xz: Object.freeze([0, 1, 0]), // y → −y
    xy: Object.freeze([0, 0, 1]), // z → −z
  });

  // ── Point-cloud operations ────────────────────────────────────────────────

  /** Apply matrix m to every point (returns a new cloud). */
  function rotate(cloud, m) {
    const out = new Array(cloud.length);
    for (let i = 0; i < cloud.length; i++) {
      const p = cloud[i];
      out[i] = [
        m[0] * p[0] + m[1] * p[1] + m[2] * p[2],
        m[3] * p[0] + m[4] * p[1] + m[5] * p[2],
        m[6] * p[0] + m[7] * p[1] + m[8] * p[2],
      ];
    }
    return out;
  }

  /** Convenience alias: a reflection is applied to a cloud exactly like a
   *  rotation (both are 3×3 matrices); the name documents intent. */
  const reflectCloud = rotate;

  function centroid(cloud) {
    let x = 0, y = 0, z = 0;
    for (let i = 0; i < cloud.length; i++) {
      x += cloud[i][0]; y += cloud[i][1]; z += cloud[i][2];
    }
    const n = cloud.length || 1;
    return [x / n, y / n, z / n];
  }

  /** Centre a cloud on the origin (subtracts the centroid). */
  function center(cloud) {
    const c = centroid(cloud);
    const out = new Array(cloud.length);
    for (let i = 0; i < cloud.length; i++) {
      const p = cloud[i];
      out[i] = [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
    }
    return out;
  }

  /**
   * Per-point RMS distance between two index-paired clouds (no alignment).
   * Both should be centred first if you want a translation-invariant score.
   */
  function rmsdRawPoints(p, q) {
    const n = Math.min(p.length, q.length);
    if (n === 0) return 0;
    let s = 0;
    for (let i = 0; i < n; i++) {
      const dx = p[i][0] - q[i][0];
      const dy = p[i][1] - q[i][1];
      const dz = p[i][2] - q[i][2];
      s += dx * dx + dy * dy + dz * dz;
    }
    return Math.sqrt(s / n);
  }

  // ── Jacobi eigendecomposition of a symmetric 3×3 matrix ───────────────────
  //
  // Returns { lambda: [l0,l1,l2], V: [v0,v1,v2] as columns } with
  // A = V · diag(lambda) · Vᵀ.  Used to build the SVD needed by Kabsch.
  // Classic cyclic Jacobi; converges in a handful of sweeps for 3×3.

  function jacobiEigen3(a) {
    // Work on a copy so the caller's matrix is untouched.
    const A = a.slice();
    // V starts as identity; its columns become the eigenvectors. Stored as
    // three length-3 column vectors: V[i] is the i-th eigenvector.
    const V = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
    const at = (r, c) => A[r * 3 + c];

    for (let sweep = 0; sweep < 60; sweep++) {
      // Off-diagonal magnitude — when it vanishes, A is diagonal.
      let off = Math.abs(at(0, 1)) + Math.abs(at(0, 2)) + Math.abs(at(1, 2));
      if (off <= 1e-16) break;

      for (let p = 0; p < 2; p++) {
        for (let q = p + 1; q < 3; q++) {
          const apq = at(p, q);
          if (Math.abs(apq) <= 1e-18) continue;
          // Rotation angle that annihilates A[p][q].
          const phi = 0.5 * Math.atan2(2 * apq, at(q, q) - at(p, p));
          rotatePair(A, V, p, q, Math.cos(phi), Math.sin(phi));
        }
      }
    }
    return {
      lambda: [at(0, 0), at(1, 1), at(2, 2)],
      V, // V[i] is the i-th eigenvector (length-3)
    };
  }

  /**
   * Apply one Jacobi rotation that zeroes the (p,q) off-diagonal.
   * Mutates A (symmetric 3×3 flat row-major) and accumulates V (columns).
   */
  function rotatePair(A, V, p, q, c, s) {
    const at = (r, cc) => A[r * 3 + cc];
    const set = (r, cc, v) => { A[r * 3 + cc] = v; };
    // Rotate rows/columns p and q.
    for (let r = 0; r < 3; r++) {
      const arp = at(r, p), arq = at(r, q);
      set(r, p, c * arp - s * arq);
      set(r, q, s * arp + c * arq);
    }
    for (let cc = 0; cc < 3; cc++) {
      const apc = at(p, cc), aqc = at(q, cc);
      set(p, cc, c * apc - s * aqc);
      set(q, cc, s * apc + c * aqc);
    }
    // Accumulate eigenvectors: V ← V · J.
    for (let r = 0; r < 3; r++) {
      const vrp = V[p][r], vrq = V[q][r];
      V[p][r] = c * vrp - s * vrq;
      V[q][r] = s * vrp + c * vrq;
    }
  }

  // ── SVD of a 3×3 matrix via eigendecomposition of HᵀH ──────────────────────
  //
  //   H = U · diag(σ) · Vᵀ ,   with σ sorted descending and the columns of U
  //   and V forming orthonormal right/left singular sets.  We get V from the
  //   eigendecomposition of the 3×3 symmetric HᵀH, then U = H V Σ⁻¹.

  /**
   * Compact SVD.  Returns { U:[cols], V:[cols], s:[σ0,σ1,σ2] } where U[i]/V[i]
   * are length-3 column vectors.
   */
  function svd3(h) {
    // HᵀH  (symmetric 3×3).
    const HtH = new Array(9);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        let s = 0;
        for (let k = 0; k < 3; k++) s += h[k * 3 + i] * h[k * 3 + j];
        HtH[i * 3 + j] = s;
      }
    }
    const e = jacobiEigen3(HtH); // e.V[i] eigenvector, e.lambda[i] eigenvalue
    // Pack eigenpairs, clamp tiny negatives from round-off, sort desc.
    const pairs = [0, 1, 2].map((i) => ({
      sigma: Math.sqrt(Math.max(e.lambda[i], 0)),
      v: e.V[i],
    }));
    pairs.sort((a, b) => b.sigma - a.sigma);

    const V = pairs.map((p) => p.v.slice());
    const s = pairs.map((p) => p.sigma);

    // U[:,i] = H V[:,i] / σ_i  (σ_i = 0 column left zero — handled by fallback).
    const U = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let i = 0; i < 3; i++) {
      // H·v_i
      const hv = [
        h[0] * V[i][0] + h[1] * V[i][1] + h[2] * V[i][2],
        h[3] * V[i][0] + h[4] * V[i][1] + h[5] * V[i][2],
        h[6] * V[i][0] + h[7] * V[i][1] + h[8] * V[i][2],
      ];
      const norm = Math.hypot(hv[0], hv[1], hv[2]) || 1;
      const scale = s[i] > 1e-12 ? 1 / s[i] : 1 / norm;
      U[i] = [hv[0] * scale, hv[1] * scale, hv[2] * scale];
      if (s[i] <= 1e-12) {
        // Degenerate column: just keep the unit vector H·v/||H·v||.
        U[i] = [hv[0] / norm, hv[1] / norm, hv[2] / norm];
      }
    }
    return { U, V, s };
  }

  // ── Kabsch: optimal rigid alignment of cloud Q onto cloud P ───────────────
  //
  // minimises  Σ ‖R q_i − p_i‖²  over rotations R (translation removed by
  // centring).  Returns the best *proper* rotation R (det = +1, what your
  // wrists can do) AND the best *unrestricted* orthogonal map Rraw (det = ±1,
  // what a single reflection can do), with both RMSDs.  For a mirror pair
  // (Q = mirror(P)) the unrestricted RMSD is ~0 and the proper RMSD is the
  // chirality.

  /** Columns → row-major flat.  cols[i] is a length-3 column vector. */
  function colsToFlat(cols) {
    return [
      cols[0][0], cols[1][0], cols[2][0],
      cols[0][1], cols[1][1], cols[2][1],
      cols[0][2], cols[1][2], cols[2][2],
    ];
  }

  function kabsch(P, Q) {
    const Pc = center(P);
    const Qc = center(Q);
    // H = Σ q_c (p_c)ᵀ  → H[i][j] = Σ_k Qc[k][i] · Pc[k][j].
    const H = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    const n = Math.min(Pc.length, Qc.length);
    for (let k = 0; k < n; k++) {
      const q = Qc[k], p = Pc[k];
      H[0] += q[0] * p[0]; H[1] += q[0] * p[1]; H[2] += q[0] * p[2];
      H[3] += q[1] * p[0]; H[4] += q[1] * p[1]; H[5] += q[1] * p[2];
      H[6] += q[2] * p[0]; H[7] += q[2] * p[1]; H[8] += q[2] * p[2];
    }
    const { U, V } = svd3(H);
    // Rraw = V · Uᵀ  (best orthogonal, possibly improper).
    const Vflat = colsToFlat(V);
    const Ut = transpose(colsToFlat(U));
    const Rraw = multiply(Vflat, Ut);
    const d = det(Rraw) >= 0 ? 1 : -1;
    // R = V · diag(1, 1, d) · Uᵀ  → proper rotation (det = +1).
    const D = [1, 0, 0, 0, 1, 0, 0, 0, d];
    const R = multiply(Vflat, multiply(D, Ut));

    const RQraw = rotate(Qc, Rraw);
    const RQ = rotate(Qc, R);
    return {
      R,         // best proper rotation mapping Q → P
      Rraw,      // best orthogonal (det ±1) mapping Q → P
      detRaw: det(Rraw),
      rmsd: rmsdRawPoints(Pc, RQ),   // best achievable with rotation only
      rmsdRaw: rmsdRawPoints(Pc, RQraw), // best achievable allowing one reflection
    };
  }

  // ── Chirality ─────────────────────────────────────────────────────────────

  /**
   * Chirality of a point cloud P with respect to a mirror plane (default yz,
   * i.e. x → −x).  Reflects P, then asks Kabsch how well the mirror can be
   * aligned back onto P using only rotation.
   *
   *   properRmsd ≈ 0  → achiral (a turn superimposes the mirror)
   *   properRmsd > tol → chiral (no turn ever will)
   *
   * The unrestricted RMSD is ~0 for any mirror pair, so the difference
   * (properRmsd − rmsdRaw) is the chirality "size".
   */
  function chirality(P, planeNormal) {
    const n = planeNormal || PLANES.yz;
    const M = reflect(n);
    const mirrored = reflectCloud(center(P), M);
    const Pc = center(P);
    const res = kabsch(Pc, mirrored);
    return {
      properRmsd: res.rmsd,
      improperRmsd: res.rmsdRaw,
      // Chiral when allowing a reflection gets you strictly closer than any
      // turn can.  All generators are ~unit-scale, so a 1e-6 absolute floor on
      // the gap cleanly separates "genuinely stuck" from "numerical zero".
      isChiral: res.rmsd - res.rmsdRaw > 1e-6,
      detRaw: res.detRaw,
      R: res.R,
      Rraw: res.Rraw,
    };
  }

  // ── Exact 2D Procrustes (rotation in the plane only) ──────────────────────
  //
  // For flat shapes (z = 0) this is the *only* alignment a 2D creature can
  // do — turn in the plane.  A flat letter F is chiral in 2D (the mirror
  // never lines up) but achiral in 3D (flip it over).  θ* = atan2(S, C) with
  //   S = Σ(qx·py − qy·px),   C = Σ(qx·px + qy·py).

  function procrustes2D(P, Q) {
    const Pc = center(P);
    const Qc = center(Q);
    let S = 0, C = 0, p2 = 0, q2 = 0;
    const n = Math.min(Pc.length, Qc.length);
    for (let k = 0; k < n; k++) {
      const qx = Qc[k][0], qy = Qc[k][1], px = Pc[k][0], py = Pc[k][1];
      S += qx * py - qy * px;
      C += qx * px + qy * py;
      p2 += px * px + py * py;
      q2 += qx * qx + qy * qy;
    }
    const theta = Math.atan2(S, C);
    const minRmsd2 = (p2 + q2 - 2 * Math.hypot(S, C)) / (n || 1);
    return { theta, rmsd: Math.sqrt(Math.max(minRmsd2, 0)) };
  }

  /**
   * 2D chirality of a flat cloud: mirror across the y-axis (x → −x) and ask
   * how well the in-plane rotation aligns it.  > tol ⇒ chiral in the plane.
   */
  function chirality2D(P) {
    const Pc = center(P);
    const M = reflect(PLANES.yz); // x → −x
    const mirrored = reflectCloud(Pc, M);
    return procrustes2D(Pc, mirrored);
  }

  // ── Object generators (point clouds + edges) ──────────────────────────────
  //
  // Each returns { pts:[[x,y,z]], groups:[[indices]], edges:[[i,j]], chiral:boolean }.
  // `groups` partitions indices for colouring; `edges` are wireframe segments.

  function build(groups, edges, chiral, meta) {
    const pts = [];
    for (const g of groups) pts.push(...g);
    // Recompute group offsets now that pts is flattened.
    const out = [];
    let off = 0;
    for (const g of groups) {
      out.push(g.map((_, i) => off + i));
      off += g.length;
    }
    return { pts, groups: out, edges: edges || [], chiral, meta: meta || {} };
  }

  /** A 3D helix (right-handed by default).  Classic chiral curve. */
  function helix(n, turns, radius, rise, handed) {
    const h = handed === "left" ? -1 : 1;
    const blade = [];
    const core = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const a = h * turns * 2 * Math.PI * t;
      const x = radius * Math.cos(a);
      const y = radius * Math.sin(a);
      const z = (t - 0.5) * rise;
      core.push([x, y, z]);
      // A little fin offset radially so the handedness reads visually.
      blade.push([1.35 * radius * Math.cos(a), 1.35 * radius * Math.sin(a), z]);
    }
    const edges = [];
    for (let i = 0; i < n - 1; i++) edges.push([i, i + n]);
    return build([core, blade], edges, true, { kind: "helix", handed });
  }

  /** A 3-blade propeller with pitch (twist) — chiral. */
  function propeller(blades, radius, twist) {
    const groups = [];
    const edges = [];
    let base = 0;
    for (let b = 0; b < blades; b++) {
      const a0 = (b / blades) * 2 * Math.PI;
      const pts = [];
      const M = 10;
      for (let j = 0; j <= M; j++) {
        const f = j / M;
        const r = f * radius;
        const a = a0 + twist * f;
        pts.push([r * Math.cos(a), r * Math.sin(a), 0.15 * Math.sin(twist * f * 2)]);
      }
      for (let j = 0; j < M; j++) edges.push([base + j, base + j + 1]);
      base += M + 1;
      groups.push(pts);
    }
    return build(groups, edges, true, { kind: "propeller" });
  }

  /**
   * A tetrahedral chiral centre: a central atom with four DIFFERENT
   * substituents at the tetrahedron's vertices (the canonical organic-chem
   * chiral object).  Each substituent is a short cluster, distinct by group.
   */
  function tetrahedralMolecule() {
    // Regular tetrahedron vertex directions (mutually 109.5° apart).
    const tetra = [
      [1, 1, 1],
      [1, -1, -1],
      [-1, 1, -1],
      [-1, -1, 1],
    ];
    const groups = [[[0, 0, 0]]]; // central carbon
    const edges = [];
    let off = 1;
    // The four substituents must DIFFER (different lengths + terminal blobs)
    // for the centre to be a true stereocentre.  Identical arms would make a
    // regular tetrahedron, which is achiral.
    const armLen = [1.7, 1.3, 1.05, 0.75];
    const blob = [3, 4, 5, 2]; // terminal cluster size, also distinct
    for (let v = 0; v < 4; v++) {
      const dir = tetra[v];
      const arm = [];
      const M = 4;
      for (let j = 1; j <= M; j++) {
        const f = j / M;
        arm.push([dir[0] * armLen[v] * f, dir[1] * armLen[v] * f, dir[2] * armLen[v] * f]);
      }
      // A little terminal blob (different count per arm ⇒ distinct groups).
      for (let b = 0; b < blob[v]; b++) {
        const ang = (b / blob[v]) * 2 * Math.PI;
        arm.push([
          dir[0] * armLen[v] + 0.12 * Math.cos(ang),
          dir[1] * armLen[v] + 0.12 * Math.sin(ang),
          dir[2] * armLen[v] + 0.12,
        ]);
      }
      edges.push([0, off]); // bond carbon→arm
      groups.push(arm);
      off += arm.length;
    }
    return build(groups, edges, true, { kind: "tetrahedron" });
  }

  /**
   * A flat letter F (in the z = 0 plane).  Chiral in 2D, achiral in 3D — the
   * whole "flip it over" lesson.  Built as a stroke skeleton.
   */
  function flatF() {
    const s = 1.0;
    const verts = [
      [0, 0, 0],   // 0 spine base
      [0, 3, 0],   // 1 spine top
      [1.4, 3, 0], // 2 top arm
      [1.4, 2.1, 0],
      [0.9, 2.1, 0], // 4
      [0.9, 1.7, 0],
      [1.3, 1.7, 0], // 6 mid arm
      [1.3, 0.9, 0],
      [0.9, 0.9, 0],
      [0, 0, 0],
    ];
    const edges = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9]];
    return build([verts.map((v) => v.slice())], edges, false, { kind: "flatF" });
  }

  /** A cube (vertex + edge points) — an obviously achiral, symmetric control. */
  function cube(s) {
    s = s || 1;
    const v = [
      [-s, -s, -s], [s, -s, -s], [s, s, -s], [-s, s, -s],
      [-s, -s, s], [s, -s, s], [s, s, s], [-s, s, s],
    ];
    const edges = [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7],
    ];
    return build([v], edges, false, { kind: "cube" });
  }

  /**
   * A 3D hand: flat palm + four fingers + a thumb attached to ONE face (+z)
   * only.  Real hands are chiral precisely because they have a front and a
   * back — the thumb is on one side, not mirrored through the palm.  That
   * asymmetry is the whole point of "handedness".
   */
  function hand() {
    const palm = grid(0, 1.0, 0, 1.2, 5, 5, 0); // z = 0 palm plate
    const fingers = [];
    const fx = [0.15, 0.4, 0.65, 0.9];
    const flen = [0.7, 0.95, 0.9, 0.65];
    for (let i = 0; i < 4; i++) {
      for (let k = 0; k <= 5; k++) {
        const f = k / 5;
        fingers.push([fx[i], 1.2 + f * flen[i], 0]);
      }
    }
    // Thumb on the +z face only (a one-sided protrusion ⇒ chiral).
    const thumb = [];
    for (let k = 0; k <= 6; k++) {
      const f = k / 6;
      thumb.push([-0.15 - 0.75 * f, 0.55 + 0.45 * Math.sin(f * Math.PI * 0.5), 0.18]);
    }
    return build([palm, fingers, thumb], [], true, { kind: "hand" });
  }

  /** Small helper: a flat grid of points in the z = z0 plane. */
  function grid(x0, x1, y0, y1, nx, ny, z0) {
    const out = [];
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < ny; j++) {
        out.push([x0 + (x1 - x0) * i / (nx - 1), y0 + (y1 - y0) * j / (ny - 1), z0]);
      }
    }
    return out;
  }

  /**
   * A gastropod (snail) shell: a logarithmic spiral swept around a cone —
   * almost all species coil the same way (dextral, ~90%); the rare left-coiling
   * (sinistral) ones are the snail "lefties".  Mirrors the human ~10% split.
   */
  function snailShell(turns, handed) {
    const h = handed === "left" ? -1 : 1;
    const n = 280;
    const core = [];
    const lip = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const a = h * turns * 2 * Math.PI * t;
      const radius = 0.25 + 1.0 * Math.exp(-2.2 * t); // big at the open end
      const z = (t - 0.5) * 2.6;
      const x = radius * Math.cos(a);
      const y = radius * Math.sin(a);
      core.push([x, y, z]);
      lip.push([(radius + 0.12) * Math.cos(a), (radius + 0.12) * Math.sin(a), z]);
    }
    const edges = [];
    for (let i = 0; i < n - 1; i++) edges.push([i, i + n]);
    return build([core, lip], edges, true, { kind: "snail", handed });
  }

  // ── Export ────────────────────────────────────────────────────────────────

  const _api = {
    // matrices
    identity, multiply, transpose, det, applyVec, fromAxisAngle, reflect, PLANES,
    // clouds
    rotate, reflectCloud, centroid, center, rmsdRawPoints,
    // linear-algebra internals
    jacobiEigen3, svd3,
    // alignment & chirality
    kabsch, chirality, procrustes2D, chirality2D,
    // generators
    build, helix, propeller, tetrahedralMolecule, flatF, cube, hand, snailShell,
  };
  global.ChiralLab = _api;
})(typeof window !== "undefined" ? window : globalThis);

if (typeof module !== "undefined" && module.exports) {
  module.exports = (typeof window !== "undefined" ? window : globalThis).ChiralLab;
}
