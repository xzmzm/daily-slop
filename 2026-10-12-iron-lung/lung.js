// Negative-pressure ventilation model: a tank around the body, one elastic
// lung behind one airway, and the blood gases that follow the breathing.
(function (root) {
  "use strict";

  // An eight-year-old, about 25 kg, as in Boston on October 12, 1928.
  const CHILD = {
    C: 0.015,        // respiratory-system compliance, L per cmH2O
    R: 20,           // airway resistance, cmH2O per L/s  (tau = R*C = 0.3 s)
    VD: 0.05,        // anatomic dead space, L
    VCO2: 110,       // CO2 production, mL/min
    ownRate: 24,     // the child's own breathing rate, /min
    ownPmus: 13,     // full-strength inspiratory muscle pressure, cmH2O
  };
  const TANK_TAU = 0.15;    // s, how fast the tank follows the bellows
  const INSP_FRACTION = 0.4; // share of each pump cycle spent pulling
  const VA_TAU = 4;         // s, averaging window for alveolar ventilation
  const CO2_TAU = 6;        // s, compressed body-CO2 response (real: minutes)
  const O2_TAU = 6;         // s
  const AA_GRADIENT = 8;    // mmHg, alveolar-to-arterial O2 difference
  const PIO2 = 0.21 * (760 - 47);
  const MIN_BREATH = 0.03;  // L; smaller flutters are not counted as breaths
  const MIN_PAO2 = 20;      // mmHg, floor: the blood never fully empties

  const paco2Target = (va, p = CHILD) => Math.min(100, (0.863 * p.VCO2) / Math.max(va, 0.3));
  const alveolarO2 = (paco2) => Math.max(0, PIO2 - paco2 / 0.8);
  // Severinghaus (1979) oxygen dissociation curve.
  const saturation = (po2) => (po2 <= 0 ? 0 : 100 / (23400 / (po2 ** 3 + 150 * po2) + 1));
  // Steady tidal volume for a square pull of `amp` cmH2O held for Ti seconds.
  const tidalSquare = (amp, ti, p = CHILD) => p.C * amp * (1 - Math.exp(-ti / (p.R * p.C)));
  const alveolarVent = (vt, rate, p = CHILD) => Math.max(0, vt - p.VD) * rate;

  function create(opts = {}) {
    const p = { ...CHILD, ...(opts.patient || {}) };
    return {
      p, t: 0,
      V: 0,            // lung volume above resting, L
      flow: 0,         // L/s into the lung
      Ptank: 0,        // cmH2O relative to the room
      Pmus: 0,
      pumpPhase: 0, ownPhase: 0.3,
      insp: false, acc: 0,
      va: opts.va ?? 0.6,         // L/min
      paco2: opts.paco2 ?? 85,   // mmHg
      pao2: opts.pao2 ?? 34,
      breaths: [],     // {t, vt}
      lastVt: 0,
    };
  }

  // controls: {motor, amp, rate, strength (0..1), hand (bool)}
  function step(s, dt, c) {
    const p = s.p;
    const n = Math.max(1, Math.ceil(dt / 0.004));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      let pulling;
      if (c.motor) {
        s.pumpPhase = (s.pumpPhase + (h * c.rate) / 60) % 1;
        pulling = s.pumpPhase < INSP_FRACTION;
      } else pulling = !!c.hand;
      const target = pulling ? -c.amp : 0;
      s.Ptank += (target - s.Ptank) * (1 - Math.exp(-h / TANK_TAU));

      s.ownPhase = (s.ownPhase + (h * p.ownRate) / 60) % 1;
      s.Pmus = s.ownPhase < INSP_FRACTION
        ? c.strength * p.ownPmus * Math.sin((Math.PI * s.ownPhase) / INSP_FRACTION) : 0;

      // Mouth at room pressure; the tank pulls on the chest wall from outside.
      s.flow = (s.Pmus - s.Ptank - s.V / p.C) / p.R;
      s.V += s.flow * h;
      s.t += h;

      if (!s.insp && s.flow > 0.01) { s.insp = true; s.acc = 0; }
      if (s.insp) {
        if (s.flow > 0) s.acc += s.flow * h;
        else {
          s.insp = false;
          if (s.acc > MIN_BREATH) {
            s.breaths.push({ t: s.t, vt: s.acc });
            s.lastVt = s.acc;
            s.va += (Math.max(0, s.acc - p.VD) * 60) / VA_TAU;
          }
        }
      }
      s.va *= Math.exp(-h / VA_TAU);
      s.paco2 += (paco2Target(s.va, p) - s.paco2) * (1 - Math.exp(-h / CO2_TAU));
      s.pao2 += (Math.max(MIN_PAO2, alveolarO2(s.paco2) - AA_GRADIENT) - s.pao2) * (1 - Math.exp(-h / O2_TAU));
    }
    while (s.breaths.length && s.breaths[0].t < s.t - 20) s.breaths.shift();
    return s;
  }

  // Breaths per minute over the last 10 s.
  function breathRate(s) {
    const b = s.breaths.filter((x) => x.t > s.t - 10);
    if (b.length < 2) return 0;
    if (s.t - b[b.length - 1].t > 8) return 0;
    return ((b.length - 1) * 60) / (b[b.length - 1].t - b[0].t);
  }
  const minuteVent = (s) => s.lastVt * breathRate(s);

  function verdict(s) {
    const sat = saturation(s.pao2);
    if (sat < 85 || s.paco2 > 65) return "failing";
    if (sat < 93 || s.paco2 > 50) return "struggling";
    if (s.paco2 < 30) return "overbreathed";
    return "breathing";
  }

  const api = {
    CHILD, TANK_TAU, INSP_FRACTION, MIN_BREATH, VA_TAU, CO2_TAU, PIO2,
    paco2Target, alveolarO2, saturation, tidalSquare, alveolarVent,
    create, step, breathRate, minuteVent, verdict,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Lung = api;
})(typeof window !== "undefined" ? window : globalThis);
