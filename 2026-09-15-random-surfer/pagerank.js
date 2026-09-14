/* ==========================================================================
   Random Surfer (1997) — closed-form link ranking and spectrum math.
   PageRank as the dominant eigenvector of G = d·A + (1−d)/N·J, with A the
   column-stochastic link matrix (dangling columns spread uniformly). All
   arithmetic here is exact linear algebra: power iteration, direct solve of
   (I − dA) r = (1−d)/N·1, and eigenvalues via Newton's identities plus
   Durand–Kerner. The spectrum identity spec(G) = {1} ∪ {d·μ : μ ∈ spec(A),
   μ ≠ 1} holds because A is column-stochastic (1ᵀA = 1ᵀ forces every other
   eigenvector to be left-orthogonal to 1, where the teleportation rank-one
   term acts as zero).
   ========================================================================== */

export const D_PAPER = 0.85;   // Brin & Page 1998 damping factor
export const PAPER = {
  pages: 24e6,        // "over 24 million pages" at time of writing
  links: 322e6,       // link database used for the PageRank run
  iterations: 52,     // iterations reported to convergence on 322 M links
};

/* Deterministic RNG so surfer trails replay identically everywhere. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- graph -> link matrix ---------- */

/* A[i][j] = probability that a surfer at page j steps to page i.
   Dangling columns (no outlinks) are repaired to the uniform distribution;
   with repair = false they leak mass and the matrix is sub-stochastic. */
export function linkMatrix(edges, N, repair = true) {
  const A = Array.from({ length: N }, () => new Array(N).fill(0));
  const out = new Array(N).fill(0);
  for (const [f, t] of edges) { A[t][f] += 1; out[f] += 1; }
  for (let j = 0; j < N; j++) {
    if (out[j] === 0) {
      if (repair) for (let i = 0; i < N; i++) A[i][j] = 1 / N;
      continue;
    }
    for (let i = 0; i < N; i++) if (A[i][j]) A[i][j] = 1 / out[j];
  }
  return A;
}

export function uniform(N) { return new Array(N).fill(1 / N); }
export function pointMass(N, i) { const x = new Array(N).fill(0); x[i] = 1; return x; }

export function sum(x) { let s = 0; for (const v of x) s += v; return s; }
export function l1(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s;
}

/* One power iteration: x' = d·A·x + (1−d)/N·1. */
export function googleStep(A, x, d) {
  const N = x.length;
  const y = new Array(N).fill((1 - d) / N);
  for (let j = 0; j < N; j++) {
    const xj = x[j];
    if (xj === 0) continue;
    for (let i = 0; i < N; i++) y[i] += d * A[i][j] * xj;
  }
  return y;
}

export function powerIterate(A, x0, d, iters) {
  let x = x0.slice();
  const residuals = [];
  for (let k = 0; k < iters; k++) {
    const y = googleStep(A, x, d);
    residuals.push(l1(y, x));
    x = y;
  }
  return { x, residuals };
}

/* Exact stationary vector: solve (I − dA) r = (1−d)/N·1 by Gaussian
   elimination with partial pivoting. Requires repair = true (else the
   stationary vector is the zero vector and the solve is meaningless). */
export function solveRank(edges, N, d = D_PAPER, repair = true) {
  const A = linkMatrix(edges, N, repair);
  const M = A.map((row, i) => row.map((v, j) => (i === j ? 1 : 0) - d * v));
  const b = new Array(N).fill((1 - d) / N);
  for (let col = 0; col < N; col++) {
    let piv = col;
    for (let r = col + 1; r < N; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (piv !== col) { [M[col], M[piv]] = [M[piv], M[col]]; [b[col], b[piv]] = [b[piv], b[col]]; }
    for (let r = col + 1; r < N; r++) {
      const f = M[r][col] / M[col][col];
      for (let c = col; c < N; c++) M[r][c] -= f * M[col][c];
      b[r] -= f * b[col];
    }
  }
  const x = new Array(N);
  for (let r = N - 1; r >= 0; r--) {
    let acc = b[r];
    for (let c = r + 1; c < N; c++) acc -= M[r][c] * x[c];
    x[r] = acc / M[r][r];
  }
  return x;
}

/* ---------- eigenvalues: Newton's identities + Durand–Kerner ---------- */

function matMul(P, Q) {
  const n = P.length;
  const R = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++)
    for (let k = 0; k < n; k++) {
      const pik = P[i][k];
      if (pik === 0) continue;
      for (let j = 0; j < n; j++) R[i][j] += pik * Q[k][j];
    }
  return R;
}

/* Characteristic polynomial coefficients, descending, monic:
   p(λ) = λⁿ + c₁λⁿ⁻¹ + … + cₙ via c_k = −(1/k) Σ c_{k−i}·tr(Aⁱ). */
export function charPoly(M) {
  const n = M.length;
  const traces = [];
  let P = M.map((r) => r.slice());
  for (let k = 1; k <= n; k++) {
    let tr = 0;
    for (let i = 0; i < n; i++) tr += P[i][i];
    traces.push(tr);
    if (k < n) P = matMul(P, M);
  }
  const c = [1];
  for (let k = 1; k <= n; k++) {
    let acc = 0;
    for (let i = 1; i <= k; i++) acc += c[k - i] * traces[i - 1];
    c.push(-acc / k);
  }
  return c;
}

const cadd = (a, b) => [a[0] + b[0], a[1] + b[1]];
const csub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const cdiv = (a, b) => {
  const den = b[0] * b[0] + b[1] * b[1];
  return [(a[0] * b[0] + a[1] * b[1]) / den, (a[1] * b[0] - a[0] * b[1]) / den];
};

function polyEvalC(coeffs, z) {
  let v = [coeffs[0], 0];
  for (let i = 1; i < coeffs.length; i++) v = cadd(cmul(v, z), [coeffs[i], 0]);
  return v;
}

function cpow(z, k) {
  let v = [1, 0];
  for (let i = 0; i < k; i++) v = cmul(v, z);
  return v;
}

export function durandKerner(coeffs, iters = 1000, tol = 1e-13) {
  const n = coeffs.length - 1;
  let roots = [];
  for (let k = 0; k < n; k++) roots.push(cpow([0.4, 0.9], k));
  for (let it = 0; it < iters; it++) {
    let move = 0;
    const next = roots.slice();
    for (let i = 0; i < n; i++) {
      let denom = [1, 0];
      for (let j = 0; j < n; j++) if (j !== i) denom = cmul(denom, csub(roots[i], roots[j]));
      const mag = Math.hypot(denom[0], denom[1]);
      if (mag < 1e-300) continue;
      const dz = cdiv(polyEvalC(coeffs, roots[i]), denom);
      next[i] = csub(roots[i], dz);
      move = Math.max(move, Math.hypot(dz[0], dz[1]));
    }
    roots = next;
    if (move < tol) break;
  }
  return roots.map(([re, im]) => ({ re, im }));
}

export function eigenvalues(M) { return durandKerner(charPoly(M)); }

/* Spectrum of the Google matrix without ever forming it:
   spec(G) = {1} ∪ {d·μ : μ ∈ spec(A), μ ≠ 1}. */
export function specGoogle(A, d) {
  const mus = eigenvalues(A);
  const out = [{ re: 1, im: 0 }];
  for (const m of mus) {
    if (Math.abs(m.re - 1) < 1e-7 && Math.abs(m.im) < 1e-7) continue;
    out.push({ re: d * m.re, im: d * m.im });
  }
  return out;
}

/* Convergence factor of power iteration = |λ₂(G)| = d·max|μ₂(A)|. */
export function spectralGapFactor(A, d) {
  let m2 = 0;
  for (const m of eigenvalues(A)) {
    if (Math.abs(m.re - 1) < 1e-7 && Math.abs(m.im) < 1e-7) continue;
    m2 = Math.max(m2, Math.hypot(m.re, m.im));
  }
  return d * m2;
}

/* Worst-case iterations to shrink the start error below eps: |λ₂| ≤ d. */
export function iterationsFor(eps, d) {
  return Math.ceil(Math.log(eps) / Math.log(d));
}

/* Ratio of successive residuals over the tail — the measured factor. */
export function measuredFactor(residuals) {
  const n = residuals.length;
  if (n < 12) return null;
  const tail = residuals.slice(n - 8);
  const ratios = [];
  for (let i = 1; i < tail.length; i++) if (tail[i - 1] > 1e-300) ratios.push(tail[i] / tail[i - 1]);
  if (!ratios.length) return null;
  ratios.sort((a, b) => a - b);
  return ratios[Math.floor(ratios.length / 2)];
}

/* ---------- closed-form preset graphs ---------- */

export const cycleEdges = (n) => Array.from({ length: n }, (_, i) => [i, (i + 1) % n]);

export const cliquePairEdges = () => {
  const edges = [];
  for (let g = 0; g < 2; g++)
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) if (i !== j) edges.push([g * 4 + i, g * 4 + j]);
  return edges;
};

export const starEdges = (k) => {
  const edges = [];
  for (let i = 1; i <= k; i++) edges.push([0, i], [i, 0]);
  return edges;
};

export const lineEdges = (n) => Array.from({ length: n - 1 }, (_, i) => [i, i + 1]);

/* Star graph stationary vector by symmetry (2-state reduction):
   hub  y = (1 + d·k) / ((k+1)(1+d))
   leaf x = (1−d)/(k+1) + d·y/k                                    */
export function starRanks(k, d = D_PAPER) {
  const y = (1 + d * k) / ((k + 1) * (1 + d));
  const x = (1 - d) / (k + 1) + (d * y) / k;
  return { hub: y, leaf: x };
}

/* One seeded surfer hop under G: teleport with probability 1−d, else
   follow a uniformly random outlink (dangling pages teleport). */
export function surferHop(edges, N, at, rand, d = D_PAPER) {
  if (rand() < 1 - d) return Math.floor(rand() * N);
  const outs = [];
  for (const [f, t] of edges) if (f === at) outs.push(t);
  if (!outs.length) return Math.floor(rand() * N);
  return outs[Math.floor(rand() * outs.length)];
}
