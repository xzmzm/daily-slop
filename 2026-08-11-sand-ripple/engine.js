// engine.js — aeolian sand-ripple core
//
// THE PHYSICS IN ONE PARAGRAPH
// Wind drives saltating grains that strike the bed at a shallow angle α
// (~10–15°) and splash out short "reptating" hops. Because the saltators
// descend at angle α, a windward (stoss) slope catches more impacts per unit
// area — linearly enhanced by cot α. Those extra reptators hop a mean
// distance L downwind and land, by the geometry of the bed, typically just
// past the crest. That phase-shifted redeposition is the bed instability
// that turns a flat sheet into migrating ripples (Anderson 1987). A small
// surface creep (diffusion) stabilizes the shortest wavelengths, so the bed
// selects a fastest-growing ripple wavelength.
//
// UNITS
// Everything in this file is in CELL units. h[i] is bed height in "grain
// layers" (dimensionless); distances are in cells; k is rad/cell. There is
// deliberately no dx in the dynamics — dx exists only as display metadata
// (physical scale) and for the angle-of-repose check. This keeps the linear
// algebra clean and the numerics stable.
//
// All functions are pure: they take a Float64Array bed h over N periodic
// cells and return new arrays without mutation. The app renders them; the
// tests assert them.

'use strict';

// ───────────────────────────────────────────────────────────────────────────
// Parameters
//   N         number of bed cells (periodic)
//   L         mean reptation hop length, in cells (~ a few grain diameters)
//   C         transport coefficient  = n·I₀·cotα  (grains per step per slope).
//             This is the "wind strength" dial — it sets how strongly a
//             unit of slope enhances erosion. cot(11°) ≈ 5.14 is folded in.
//   D         surface-creep diffusion (cells²/step), stabilizes short λ.
//   reposeDeg angle of repose for avalanching, degrees (~33° for dry sand).
//   hopMax    truncate the hop kernel at this many cells.
//   dxMeters  metres per cell — DISPLAY ONLY, never enters the dynamics.
// ───────────────────────────────────────────────────────────────────────────

const DEFAULTS = {
  N: 512,
  L: 4.2,            // mean reptation hop ≈ 4 cells ≈ 17 mm (a few grain dia.)
  C: 0.35,           // transport / wind strength  (n·I₀·cotα)
  D: 0.20,           // surface creep — sets the selected wavelength via CL/D
  reposeDeg: 33,     // angle of repose
  hopMax: 48,        // truncate the hop kernel at this many cells
  dxMeters: 0.004,   // 4 mm per cell — for physical readouts only
};

function resolve(params) {
  return Object.assign({}, DEFAULTS, params);
}

// ───────────────────────────────────────────────────────────────────────────
// Hop kernel: geometric pmf p[r], r = 1..hopMax, with mean exactly L. This is
// the discrete analogue of Anderson's exponential reptation splash distribution
// (same mean L). Its characteristic function converges to 1/(1+ikL) as L→∞,
// so the continuum closed forms match.
//   q = (L−1)/L ;  p[r] = (1−q) q^{r−1}  for r ≥ 1
//   Σ p[r] = 1 ;  E[r] = 1/(1−q) = L     ✓
// ───────────────────────────────────────────────────────────────────────────
function hopKernel(params) {
  const p = resolve(params);
  const L = Math.max(p.L, 1.0001);          // need L>1 for q∈(0,1)
  // Truncate the tail beyond ~10L (≥ e^{-10} negligible). Keep hopMax as a cap.
  const cap = Math.max(p.hopMax, Math.ceil(12 * L));
  const q = (L - 1) / L;
  const ker = new Float64Array(cap + 1);    // index 0 unused (hops ≥1)
  let s = 0;
  for (let r = 1; r <= cap; r++) {
    ker[r] = (1 - q) * Math.pow(q, r - 1);
    s += ker[r];
  }
  for (let r = 1; r <= cap; r++) ker[r] /= s;   // renormalize truncation
  return ker;
}

// Characteristic function of the hop kernel at spatial frequency k (rad/cell):
//   P̃(k) = Σ_r p[r] e^{−i k r}
// Exact discrete analogue of Anderson's continuum 1/(1+ikL).
function hopChar(params, k) {
  const ker = hopKernel(params);
  let re = 0, im = 0;
  for (let r = 1; r < ker.length; r++) {
    re += ker[r] * Math.cos(k * r);
    im -= ker[r] * Math.sin(k * r);
  }
  return { re, im };
}

// ───────────────────────────────────────────────────────────────────────────
// Local slope (centered difference) in CELL units — dimensionless height
// change per cell. This is tan(bed angle) when 1 height unit ≈ 1 cell width.
// ───────────────────────────────────────────────────────────────────────────
function slope(h, i) {
  const N = h.length;
  return (h[(i + 1) % N] - h[(i - 1 + N) % N]) / 2;
}

// ───────────────────────────────────────────────────────────────────────────
// The saltation flux operator (linear bed-instability engine).
//
// One step does two things:
//   (1) EROSION.  Cell i loses grains at rate C·s_i where s_i is the local
//       slope. On a periodic domain the flat-bed part cancels with deposition,
//       so only the slope (perturbation) term remains: erosion_i = C·s_i.
//       (The CLAMP path, used by the app, floors the impact rate at zero on
//       steep lee slopes — the only nonlinearity. Tests run without it.)
//   (2) DEPOSITION.  Eroded grains hop downwind by the kernel:
//       dep_i = Σ_r p[r]·erosion_{i−r}.
//
// Net:  Δh_i = −erosion_i + Σ_r p[r]·erosion_{i−r}.
// Mass-conserving (Σ Δh = 0) whenever Σp[r] = 1, which the kernel guarantees.
// ───────────────────────────────────────────────────────────────────────────
function fluxErosion(h, params) {
  const p = resolve(params);
  const N = h.length;
  const e = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const s = slope(h, i);
    if (params && params.clamp) {
      // Physical impact rate I_i = I₀(1 + cotα·s); clamp at zero (lee shadow).
      e[i] = p.C * Math.max(-1.0, s);
    } else {
      e[i] = p.C * s;
    }
  }
  return e;
}

function fluxDeposit(erosion, params) {
  const ker = hopKernel(params);
  const N = erosion.length;
  const d = new Float64Array(N);
  for (let r = 1; r < ker.length; r++) {
    const w = ker[r];
    if (w === 0) continue;
    for (let i = 0; i < N; i++) {
      d[i] += w * erosion[(i - r + N) % N];
    }
  }
  return d;
}

// One full saltation step: returns a NEW bed (does not mutate input).
function fluxStep(h, params) {
  const p = resolve(params);
  const N = h.length;
  const e = fluxErosion(h, params);
  const d = fluxDeposit(e, params);
  const out = new Float64Array(N);
  for (let i = 0; i < N; i++) out[i] = h[i] - e[i] + d[i];
  // Surface creep (discrete Laplacian diffusion), periodic.
  if (p.D > 0) {
    for (let i = 0; i < N; i++) {
      out[i] += p.D * (h[(i + 1) % N] - 2 * h[i] + h[(i - 1 + N) % N]);
    }
  }
  return out;
}

// ───────────────────────────────────────────────────────────────────────────
// Linear stability — the closed form.
//
// For a Fourier mode h_i ∝ e^{ik·i}, the discrete saltation step multiplies
// it by the complex per-step multiplier (one-line derivation in NOTES.md):
//
//     M(k) = 1 + C · i·sin(k) · [ P̃(k) − 1 ]  −  D · k̂²
//
// where k̂² = 2 − 2cos(k) is the discrete Laplacian eigenvalue (→ k² in the
// continuum) and P̃(k) is the hop characteristic function. k is rad/cell.
//
// For small k this converges to Anderson's continuum dispersion relation
//     σ(k) ≈ C · i k · [1/(1+ikL) − 1] − D k²,
//     Re σ = (C L k²) / (1 + (kL)²)  −  D k² .
// ───────────────────────────────────────────────────────────────────────────
function linearMultiplier(k, params) {
  const p = resolve(params);
  const Pc = hopChar(params, k);
  const sk = Math.sin(k);
  // (P̃ − 1)
  const ar = Pc.re - 1, ai = Pc.im;
  // multiply (ar + i·ai) by i·sk:  = (−sk·ai) + i·(sk·ar)
  const beta = sk;
  const mul_re = -beta * ai;
  const mul_im = beta * ar;
  // discrete Laplacian eigenvalue
  const khat2 = 2 - 2 * Math.cos(k);
  const re = 1 + p.C * mul_re - p.D * khat2;
  const im = p.C * mul_im;
  return { re, im };
}

// Per-step growth rate = ln|M(k)|. Positive ⇒ growing mode.
function linearGrowthRate(k, params) {
  const m = linearMultiplier(k, params);
  return 0.5 * Math.log(m.re * m.re + m.im * m.im);
}

// Migration (drift) speed of a mode, cells per step. For h ∝ e^{ikx}, one step
// multiplies by M = |M|e^{iφ}, which shifts the pattern by Δx = −φ/k per step
// (since e^{ik(x+Δx)} = e^{ikx}·e^{ikΔx} must equal e^{ikx}·e^{iφ} ⇒ Δx = φ/k
// only with the opposite sign convention; the bed-crest moves downwind, +x).
function linearDriftSpeed(k, params) {
  const m = linearMultiplier(k, params);
  return -Math.atan2(m.im, m.re) / k;
}

// Fastest-growing wavelength by golden-section search on Re σ over k ∈ (0, π].
// Returns { lambda (cells), k (rad/cell) }.
function fastestWavelength(params) {
  const p = resolve(params);
  const kMin = (2 * Math.PI / p.N) * 1.5;
  const kMax = Math.PI;
  const phi = (Math.sqrt(5) - 1) / 2;
  let a = kMin, b = kMax;
  let c = b - phi * (b - a);
  let d = a + phi * (b - a);
  for (let it = 0; it < 200; it++) {
    if (linearGrowthRate(c, params) > linearGrowthRate(d, params)) b = d;
    else a = c;
    c = b - phi * (b - a);
    d = a + phi * (b - a);
    if (b - a < 1e-8) break;
  }
  const k = 0.5 * (a + b);
  return { lambda: (2 * Math.PI) / k, k };
}

// ───────────────────────────────────────────────────────────────────────────
// Avalanching — enforce the angle of repose (dry sand ≈ 33°).
//
// Cell-to-cell height difference |Δh| = |h[i]−h[i+1]| corresponds to a slope
// tan(θ)=|Δh| when 1 height unit ≈ 1 horizontal cell. Sand cannot stand
// steeper than its repose angle in EITHER direction, so we relax oversteep
// cell pairs both downwind and upwind (gravity is symmetric on a static bed).
// Mass-conserving by construction.
// ───────────────────────────────────────────────────────────────────────────
function avalanche(h, params) {
  const p = resolve(params);
  const N = h.length;
  const maxDiff = Math.tan(p.reposeDeg * Math.PI / 180);
  const out = Float64Array.from(h);
  for (let sweep = 0; sweep < 12; sweep++) {
    let moved = false;
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      const diff = out[i] - out[j];          // signed; positive ⇒ i is higher
      if (Math.abs(diff) > maxDiff) {
        const excess = (Math.abs(diff) - maxDiff) / 2;
        if (diff > 0) { out[i] -= excess; out[j] += excess; }
        else          { out[i] += excess; out[j] -= excess; }
        moved = true;
      }
    }
    if (!moved) break;
  }
  return out;
}

// ───────────────────────────────────────────────────────────────────────────
// Diagnostics
// ───────────────────────────────────────────────────────────────────────────
function totalMass(h) {
  let s = 0;
  for (let i = 0; i < h.length; i++) s += h[i];
  return s;
}

function maxAbsSlope(h) {
  const N = h.length;
  let m = 0;
  for (let i = 0; i < N; i++) {
    const s = Math.abs(slope(h, i));
    if (s > m) m = s;
  }
  return m;
}

// Max cell-to-cell height difference (for avalanche verification).
function maxHeightDiff(h) {
  const N = h.length;
  let m = 0;
  for (let i = 0; i < N; i++) {
    const d = Math.abs(h[i] - h[(i + 1) % N]);
    if (d > m) m = d;
  }
  return m;
}

// Empirical DFT amplitude at frequency index m (cycles across the domain),
// used by the app's spectrum panel and by the tests' growth-rate measurement.
function dftAmplitude(h, m) {
  const N = h.length;
  let re = 0, im = 0;
  const w = -2 * Math.PI * m / N;
  for (let i = 0; i < N; i++) {
    re += h[i] * Math.cos(w * i);
    im += h[i] * Math.sin(w * i);
  }
  return Math.sqrt(re * re + im * im) / N;
}

// ───────────────────────────────────────────────────────────────────────────
// Public API — export both for Node (module.exports) and the browser (window).
// ───────────────────────────────────────────────────────────────────────────
const _api = {
  DEFAULTS, resolve,
  hopKernel, hopChar, slope,
  fluxErosion, fluxDeposit, fluxStep,
  linearMultiplier, linearGrowthRate, linearDriftSpeed, fastestWavelength,
  avalanche,
  totalMass, maxAbsSlope, maxHeightDiff, dftAmplitude,
};
if (typeof module !== 'undefined' && module.exports) {
  module.exports = _api;
}
if (typeof window !== 'undefined') {
  Object.assign(window, _api);
}
