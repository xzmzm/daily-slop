// physics.js — Faraday's Ring studio, exact closed forms.
// 29 Aug 1831: at the Royal Institution, Michael Faraday wound two coils on a
// soft iron ring, touched a battery to one, and saw the other coil's
// galvanometer needle kick — then fall back to zero while the current kept
// flowing, then kick the other way when he broke the circuit. Electromagnetic
// induction. Everything here is a formula you can check by hand: the magnetic
// circuit's reluctance law, L = N²/ℛ and M = N₁N₂/ℛ, the RL exponential with
// τ = L/R, the ballistic galvanometer's charge law q = N₂ΔΦ/R₂ (speed-free),
// the break spike |ε| = M·I₀/t_b and the arc that clamps it, the field energy
// ½LI², and the transformer law the ring grew up into: V = π√2·f·N·Φ̂.

export const MU0 = 4e-7 * Math.PI; // H/m
export const FT_TO_M = 0.3048;
export const IN_TO_M = 0.0254;
export const TAU = Math.PI * 2;

// --- the historical ring (Faraday's diary, 29 Aug 1831) -------------------
//
//   "Made a ring of soft round iron; the iron was 7/8ths of an inch thick;
//    the ring 6 inches in external diameter." Wire lengths 72 ft (primary,
//    three 24-ft helices) and 60 ft (secondary, two 30-ft helices) are
//    documented; the TURN COUNTS are a reconstruction: wire length ÷ mean
//    circumference, single layer. µ_r, battery voltage and wire resistance
//    are stated stand-ins (see NOTES.md).

export const HIST = {
  ringODin: 6,        // inches, external diameter
  rodIn: 0.875,       // inches, iron rod thickness
  primaryWireFt: 72,  // three helices of 24 ft
  secondaryWireFt: 60, // two helices of 30 ft
  batteryPairs: 10,   // "ten pairs of plates 4 inches square"
  cellVolts: 0.9,     // one Cu–Zn pair ≈ 0.9 V → 9 V, a stated stand-in
  softIronMuR: 3000,  // soft iron, a stated stand-in
  bSat: 1.8,          // tesla, saturation knee of soft iron
};

export const meanDia = () => (HIST.ringODin - HIST.rodIn) * IN_TO_M;
export const pathLength = () => Math.PI * meanDia();
export const coreArea = () => Math.PI * ((HIST.rodIn / 2) * IN_TO_M) ** 2;
export const meanCircumference = () => Math.PI * meanDia();

// Reconstruction: how many single-layer turns fit a given wire length.
export const turnsFromWire = (wireLenM, circM) => Math.floor(wireLenM / circM);

export const N1_HIST = turnsFromWire(HIST.primaryWireFt * FT_TO_M, meanCircumference());
export const N2_HIST = turnsFromWire(HIST.secondaryWireFt * FT_TO_M, meanCircumference());

// The battery is exact on its own law: ten pairs × 0.9 V.
export const batteryVolts = () => HIST.batteryPairs * HIST.cellVolts;

// Copper wire resistance per metre for the ~0.5 mm cotton-covered wire
// (ρ = 1.7e-8 Ω·m) — a stated reconstruction, used for the secondary loop.
export const COPPER_R_PER_M = 1.7e-8 / (Math.PI * 0.25e-3 ** 2);
export const secondaryLoopR = (N2) => 1 + N2 * meanCircumference() * COPPER_R_PER_M; // +1 Ω galvanometer

// --- the magnetic circuit: reluctance is Ohm's law for flux ---------------
//
//   ℛ = l / (µ₀·µ_r·A),   Φ = N·I / ℛ,   B = Φ / A,
//   L = N²/ℛ,   M = N₁N₂/ℛ = √(L₁L₂)  (perfect coupling, k = 1)

export const reluctance = (muR, A = coreArea(), l = pathLength()) =>
  l / (MU0 * muR * A);

export const inductance = (N, Rl) => (N * N) / Rl;
export const mutualInductance = (N1, N2, Rl) => (N1 * N2) / Rl;
export const coupling = (M, L1, L2) => M / Math.sqrt(L1 * L2);

export const fluxOf = (N, I, Rl) => (N * I) / Rl; // webers
export const bField = (flux, A = coreArea()) => flux / A;
export const isUnsaturated = (B, bSat = HIST.bSat) => B < bSat;
export const saturationMargin = (B, bSat = HIST.bSat) => bSat - B;

// Iron vs air: everything scales by exactly µ_r. Take the ring away and the
// 1831 galvanometer kick shrinks by the same factor — the near-miss.
export const airVsIronFactor = (muR) => muR;

// --- the RL circuit: current has inertia ----------------------------------
//
//   make:  I(t) = I∞(1 − e^(−t/τ)),   τ = L/R
//   break: I(t) = I₀·e^(−t/t_b)

export const steadyCurrent = (V, R) => V / R;
export const tau = (L, R) => L / R;
export const rlGrowth = (t, V, R, L) =>
  steadyCurrent(V, R) * (1 - Math.exp(-t / tau(L, R)));
export const rlDecay = (t, I0, decayTau) => I0 * Math.exp(-t / decayTau);
export const fieldEnergy = (L, I) => 0.5 * L * I * I;

// --- induction --------------------------------------------------------------
//
//   ε₂ = −N₂·dΦ/dt = −M·dI₁/dt        (Faraday + Lenz: the sign fights you)
//   q  = ∫ε₂/R₂ dt = N₂·ΔΦ / R₂       (ballistic galvanometer: charge, not
//                                      speed — the kick counts flux quanta)

export const emfFromCurrentSlope = (M, dIdt) => -M * dIdt;
export const chargeThrough = (N2, dPhi, R2) => (N2 * dPhi) / R2;
export const peakEmfMake = (M, I0, tc) => (M * I0) / tc;   // |ε| at make = M·I₀/τ
export const breakSpike = (M, I0, tb) => (M * I0) / tb;     // |ε| at break = M·I₀/t_b

// The arc clamp: an open-circuit inductor demands V = L·I₀/t_b, but the
// contact gap strikes an arc near V_bd, which fixes dΦ/dt instead — you
// cannot break the current faster than t_eff = L·I₀/V_bd. The secondary
// then sees exactly V_bd × N₂/N₁ (because M/L₁ = N₂/N₁ on a shared core).
export const M_over_L1 = (N1, N2) => N2 / N1; // exact identity, k = 1

export function breakAnalysis({ L, I0, tb, vBd, N1, N2 }) {
  const vOpen = breakSpike(L, I0, tb);
  const clamped = vOpen > vBd;
  const v1 = Math.min(vOpen, vBd);
  const tEff = clamped ? (L * I0) / vBd : tb;
  return {
    vOpen,
    clamped,
    v1,                       // primary spike actually developed
    v2: (N2 / N1) * v1,       // secondary kick
    tEff,                     // effective break duration
  };
}

// --- the piecewise-exact replay engine -------------------------------------
//
// A history of events (make/break) determines I₁(t) everywhere:
//
//   after a 'make'  at t_k:  I(t) = I∞ − (I∞ − I_k)·e^(−(t−t_k)/τ)
//   after a 'break' at t_k:  I(t) = I_k·e^(−(t−t_k)/t_eff)
//
// ε₂ = −M·dI₁/dt is then also piecewise closed-form — no numerical
// differentiation anywhere. The charge delivered across any event follows
// the same identity: q = M·(I_after − I_before)/R₂ = N₂ΔΦ/R₂.

export function replayCurrent(events, t, { V, R1, L1, tEffOf }) {
  // events: [{ t, kind: 'make'|'break', I0 }] sorted by t; I before first = 0.
  let I = 0;
  let lastEvent = null;
  for (const ev of events) {
    if (ev.t > t) break;
    I = segmentCurrent(ev, t, { V, R1, L1, tEffOf, I0: ev.I0 });
    lastEvent = ev;
  }
  return I;
}

// current within the segment opened by `ev` (which started at ev.t)
export function segmentCurrent(ev, t, { V, R1, L1, tEffOf, I0 }) {
  const s = t - ev.t;
  if (ev.kind === "make") {
    const Iinf = steadyCurrent(V, R1);
    return Iinf - (Iinf - I0) * Math.exp(-s / tau(L1, R1));
  }
  const tEff = tEffOf(ev);
  return I0 * Math.exp(-s / tEff);
}

export function segmentEmf2(ev, t, { V, R1, L1, M, tEffOf, I0 }) {
  const s = t - ev.t;
  if (ev.kind === "make") {
    const Iinf = steadyCurrent(V, R1);
    const dIdt = ((Iinf - I0) / tau(L1, R1)) * Math.exp(-s / tau(L1, R1));
    return -M * dIdt;
  }
  const tEff = tEffOf(ev);
  return M * (I0 / tEff) * Math.exp(-s / tEff);
}

// Lenz's law, made checkable: at make the induced current opposes the rise,
// at break it props the falling current — opposite signs, same |q|.
export const lenzSignAtMake = -1;
export const lenzSignAtBreak = +1;

// --- the transformer the ring grew up into ---------------------------------
//
//   Φ(t) = Φ̂·sin ωt  →  ε = −N·dΦ/dt = −N·ω·Φ̂·cos ωt
//   V_rms = (π√2)·f·N·Φ̂  ≈ 4.44·f·N·Φ̂     (the "4.44" on every iron core)
//   V₂/V₁ = N₂/N₁

export const K4 = Math.PI * Math.SQRT2; // ≈ 4.4429
export const fluxAmpFromV = (Vrms, f, N) => Vrms / (K4 * f * N);
export const voltsFromFluxAmp = (phiMax, f, N) => K4 * f * N * phiMax;
export const turnsRatio = (N1, N2) => N2 / N1;
export const emfAC = (N, w, phiMax, t) => -N * w * phiMax * Math.cos(w * t);

// --- presets ---------------------------------------------------------------

export const RING_DEFAULTS = {
  V: batteryVolts(),     // 9 V — ten pairs of 4-inch plates
  R1: 4.5,               // Ω, wire + battery (reconstruction)
  N1: N1_HIST,           // 53 turns, reconstructed from 72 ft
  N2: N2_HIST,           // 44 turns, reconstructed from 60 ft
  muR: HIST.softIronMuR, // soft iron
  tbUs: 5,               // break duration, µs — a brisk knife switch + arc
  vBd: 1200,             // V, contact gap breakdown (stand-in)
  drive: "manual",       // 'manual' | 'ac'
  ac: { V1: 4.5, f: 50 }, // AC mode source (µs-scale future, honest B below)
};

export const PRESETS = {
  ring1831: {
    id: "ring1831",
    label: "一八三一 · 法拉第的原环",
    ring: { ...RING_DEFAULTS },
  },
  ruhmkorff: {
    id: "ruhmkorff",
    label: "火花 · 卢姆科夫线圈",
    ring: {
      ...RING_DEFAULTS,
      V: 12, R1: 8, N1: 200, N2: 20000, muR: 4000, tbUs: 2, vBd: 400,
    },
  },
  acGrid: {
    id: "acGrid",
    label: "装上未来 · 五十赫兹",
    ring: { ...RING_DEFAULTS, drive: "ac", ac: { V1: 4.5, f: 50 } },
  },
  airCore: {
    id: "airCore",
    label: "拿走铁环 · 法拉第的险情",
    ring: { ...RING_DEFAULTS, muR: 1 },
  },
};

// --- the lineage ledger ----------------------------------------------------
// A modern ignition coil: primary ~6 mH, interrupted ~4 A in ~15 µs, the arc
// clamps the primary, and the 1:65 turns ratio finishes the job.

export const IGNITION = { L: 6e-3, I0: 4, tb: 15e-6, vBd: 400, ratio: 65 };
export const ignitionSpike = () =>
  breakAnalysis({ L: IGNITION.L, I0: IGNITION.I0, tb: IGNITION.tb, vBd: IGNITION.vBd, N1: 1, N2: IGNITION.ratio }).v2;

// Ruhmkorff secondary wire: N₂ turns × mean circumference.
export const coilWireKm = (N2) => (N2 * meanCircumference()) / 1000;
