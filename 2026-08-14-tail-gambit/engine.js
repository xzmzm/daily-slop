/* tail-gambit — small deterministic model shared by the UI and tests */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.TailGambit = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const STRATEGIES = {
    gecko: {
      label: "fat-tailed gecko", fractureDelay: 0.10, optimalLead: 0.34,
      timingSigma: 0.24, vigor: 1.00, decay: 5.6, energyShare: 0.34,
      sprintLoss: 0.19, regrowDays: 72,
    },
    skink: {
      label: "blue-tailed skink", fractureDelay: 0.075, optimalLead: 0.27,
      timingSigma: 0.19, vigor: 1.15, decay: 4.4, energyShare: 0.22,
      sprintLoss: 0.13, regrowDays: 96,
    },
    anole: {
      label: "green anole", fractureDelay: 0.13, optimalLead: 0.42,
      timingSigma: 0.27, vigor: 0.82, decay: 6.8, energyShare: 0.17,
      sprintLoss: 0.10, regrowDays: 110,
    },
  };

  function clamp(value, low, high) {
    return Math.max(low, Math.min(high, value));
  }

  function gaussian(value, mean, sigma) {
    const z = (value - mean) / sigma;
    return Math.exp(-0.5 * z * z);
  }

  function strategy(key) {
    return STRATEGIES[key] || STRATEGIES.gecko;
  }

  // A damped travelling wave: adjacent tail segments are phase-shifted. This
  // is a schematic of the rhythmic motor pattern measured after autotomy.
  function tailWave(segment, time, key) {
    const s = strategy(key);
    const envelope = time < 0 ? 0 : Math.exp(-time / s.decay);
    const phase = 2 * Math.PI * 3.15 * time - segment * 0.82;
    return s.vigor * envelope * Math.sin(phase);
  }

  function motionEnvelope(time, key) {
    const s = strategy(key);
    return time < 0 ? 0 : s.vigor * Math.exp(-time / s.decay);
  }

  /*
   * releaseTime is when the player contracts the fracture muscles; contactTime
   * is when the predator reaches the tail base. The effective lead subtracts
   * the small fracture delay. The output is an explicitly illustrative score,
   * not a claimed field survival probability.
   */
  function resolveStrike(releaseTime, contactTime, key) {
    const s = strategy(key);
    if (releaseTime == null || !Number.isFinite(releaseTime)) {
      return { outcome: "caught", score: 0, lead: -Infinity, timing: 0, distraction: 0 };
    }
    const detachTime = releaseTime + s.fractureDelay;
    const lead = contactTime - detachTime;
    if (lead <= -0.03) {
      return { outcome: "late", score: 0.03, lead, timing: 0, distraction: 0 };
    }
    const timing = gaussian(lead, s.optimalLead, s.timingSigma);
    // Dropping much too early gives the predator time to look up again.
    const reacquisition = clamp(1 - Math.max(0, lead - 0.80) / 0.90, 0.12, 1);
    const distraction = clamp(0.54 + 0.38 * s.vigor, 0, 1);
    const score = clamp(timing * reacquisition * distraction, 0, 1);
    let outcome = "missed";
    if (score >= 0.68) outcome = "escaped";
    else if (lead > 0.95) outcome = "early";
    return { outcome, score, lead, timing, distraction };
  }

  function recovery(day, key) {
    const s = strategy(key);
    const d = clamp(day, 0, s.regrowDays);
    const progress = d / s.regrowDays;
    // Fast wound closure, then slower tissue replacement. The new tail is a
    // cartilage tube rather than a rebuilt chain of vertebrae.
    const length = 1 - Math.pow(1 - progress, 1.65);
    const energy = clamp(1 - s.energyShare + 0.72 * s.energyShare * progress, 0, 1);
    const sprint = clamp(1 - s.sprintLoss * Math.exp(-3.2 * progress), 0, 1);
    return { day: d, progress, length, energy, sprint };
  }

  return { STRATEGIES, clamp, gaussian, strategy, tailWave, motionEnvelope, resolveStrike, recovery };
});
