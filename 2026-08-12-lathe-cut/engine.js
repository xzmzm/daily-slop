/*
 * lathe-cut — engine
 *
 * Pure physics of the analog disc record. No DOM, no canvas, no audio here —
 * just the closed-form relations that make a cutting lathe work, so they can
 * be unit-tested (see test_engine.js) and reasoned about independently.
 *
 * Units policy
 * -----------
 *   Lengths that describe the *disc*   → millimetres (mm)  [radius, pitch, λ]
 *   Angular frequency                  → revolutions per minute (rpm) or rad/s
 *   Audio frequency                    → Hertz (Hz)
 *   Linear groove velocity             → millimetres per second (mm/s)
 *
 * The hero identity, used everywhere, is
 *
 *        λ(r, f) = 2π · r · (rpm / 60) / f          ... (1)
 *
 * i.e. one cycle of audio of frequency f occupies exactly the arc length the
 * needle travels during 1/f seconds. That arc length is the wavelength laid
 * into the lacquer. It shrinks toward the label because r shrinks — the whole
 * "inner groove problem" falls out of one line.
 */

(function (global) {
  "use strict";

  const TWO_PI = Math.PI * 2;

  // ── Standard 12-inch LP geometry (real-world reference numbers) ───────────
  const GEOMETRY = Object.freeze({
    discDiameter_mm: 304.8, // 12 inches
    outerGroove_mm: 146.05, // start of the modulated groove (~5.75")
    innerGroove_mm: 70.0,   // locked-groove / runout (~2.76")
    labelRadius_mm: 63.0,   // paper label edge
    spindle_mm: 7.24,       // centre hole
    // cutting-stylus tip — frequencies whose λ falls below this can't be
    // resolved by the cutter and blur together. ~25 µm is the real figure.
    cutterLimit_mm: 0.025,
  });

  const RPM_PRESETS = Object.freeze({ "33.333": 33.333333, "45": 45.0 });

  // ── Angular / linear velocity ─────────────────────────────────────────────

  /** Angular velocity (rad/s) from rpm. */
  function omega(rpm) {
    return (TWO_PI * rpm) / 60;
  }

  /** Seconds for one revolution (period). */
  function revolutionPeriod(rpm) {
    return 60 / rpm;
  }

  /**
   * Linear groove velocity (mm/s) at radius r (mm) for a turntable speed.
   * v = ω·r, with r already in mm so v comes out in mm/s directly.
   */
  function linearVelocity(rpm, r_mm) {
    return omega(rpm) * r_mm;
  }

  // ── The hero identity: wavelength of a recorded frequency ────────────────

  /**
   * Wavelength (mm) laid into the lacquer: how many millimetres of groove one
   * cycle of frequency f occupies at radius r. Equation (1) above.
   */
  function wavelength(rpm, r_mm, f) {
    if (f <= 0) return Infinity;
    return linearVelocity(rpm, r_mm) / f;
  }

  /**
   * Inverse of `wavelength`: the highest frequency that still resolves to at
   * least `minLambda` mm of groove at radius r. Above this, cycles blur.
   */
  function maxResolvableFrequency(rpm, r_mm, minLambda_mm) {
    if (minLambda_mm <= 0) return Infinity;
    return linearVelocity(rpm, r_mm) / minLambda_mm;
  }

  // ── Mapping the visible groove to real audio ─────────────────────────────

  /**
   * The directly-observable groove feature is how many wiggles fit in one
   * revolution (call it `gpr`). The real audio frequency that produced them is
   *
   *     f = gpr · (rpm / 60)            ... gpr cycles per T = 60/rpm seconds
   *
   * because one revolution takes exactly 60/rpm seconds.
   */
  function frequency(gpr, rpm) {
    return gpr * (rpm / 60);
  }

  /** Inverse of `frequency`: how many wiggles/rev a tone of f Hz cuts. */
  function wigglesPerRevolution(f, rpm) {
    return f * (60 / rpm);
  }

  /**
   * Wavelength expressed directly in the observable: with gpr wiggles laid
   * evenly around a circle of radius r, each wiggle spans λ = 2πr / gpr mm.
   * This must agree with wavelength(rpm, r, frequency(gpr, rpm)) — the test
   * suite asserts that equivalence, which is the algebraic identity
   *   2πr / gpr  =  2πr·(rpm/60) / (gpr·rpm/60).
   */
  function wavelengthFromGpr(r_mm, gpr) {
    if (gpr <= 0) return Infinity;
    return (TWO_PI * r_mm) / gpr;
  }

  // ── The spiral (Archimedean) ──────────────────────────────────────────────

  /**
   * Groove pitch: centre-to-centre spacing between adjacent spiral turns.
   * Related to the "lines per inch" figure quoted on record sleeves by
   *   lpi = 25.4 / pitch_mm.
   */
  function pitchFromLpi(lpi) {
    return 25.4 / lpi;
  }
  function lpiFromPitch(pitch_mm) {
    return 25.4 / pitch_mm;
  }

  /**
   * Archimedean spiral radius at angle θ (radians), starting at rOuter and
   * walking inward by `pitch` per full turn:
   *     r(θ) = rOuter − (pitch / 2π) · θ
   */
  function spiralRadius(theta, rOuter_mm, pitch_mm) {
    return rOuter_mm - (pitch_mm / TWO_PI) * theta;
  }

  /** Angle θ (radians) at which the spiral reaches rInner. */
  function spiralThetaAtRadius(rInner_mm, rOuter_mm, pitch_mm) {
    if (pitch_mm <= 0) return Infinity;
    return ((rOuter_mm - rInner_mm) * TWO_PI) / pitch_mm;
  }

  /** Number of concentric turns between rOuter and rInner at given pitch. */
  function spiralTurns(rOuter_mm, rInner_mm, pitch_mm) {
    if (pitch_mm <= 0) return Infinity;
    return (rOuter_mm - rInner_mm) / pitch_mm;
  }

  /**
   * Total playable side time (minutes): turns × period, in minutes.
   *   minutes = turns · (60/rpm) / 60 = turns / rpm
   * (With rpm in rev/min this is just turns/rpm minutes — tidy.)
   */
  function sideTimeMinutes(rpm, turns) {
    return turns / rpm;
  }

  /**
   * Approximate total groove length (mm) — the arc length of the Archimedean
   * spiral. For a tightly wound spiral (pitch ≪ r) the exact arc length is
   *   L ≈ ½·(θ_f² − θ_i²)·(pitch/2π)  ... per-turn average r·dθ summed,
   * which simplifies to the closed form below. Used for the "needle travelled"
   * readout; it's the integral of r(θ) dθ from 0..θ_f.
   */
  function spiralArcLength_mm(rOuter_mm, rInner_mm, pitch_mm) {
    const thetaF = spiralThetaAtRadius(rInner_mm, rOuter_mm, pitch_mm);
    // ∫₀^θf r(θ) dθ = rOuter·θf − (pitch/2π)·θf²/2
    return rOuter_mm * thetaF - (pitch_mm / TWO_PI) * (thetaF * thetaF) / 2;
  }

  // ── Waveform shapes (the "timbre" of the cut) ────────────────────────────

  const WAVEFORMS = Object.freeze({
    sine: (phase) => Math.sin(phase * TWO_PI),
    triangle: (phase) => 1 - 4 * Math.abs(phase - 0.5),
    saw: (phase) => 1 - 2 * phase,
    square: (phase) => (phase < 0.5 ? 1 : -1),
  });

  /** Sample a named waveform at phase ∈ [0,1). Amplitude ∈ [−1,1]. */
  function waveformSample(timbre, phase) {
    const fn = WAVEFORMS[timbre] || WAVEFORMS.sine;
    const p = phase - Math.floor(phase); // wrap to [0,1)
    return fn(p);
  }

  /**
   * Build one period of a waveform as Float32 samples (for the Web Audio
   * periodic-wave and for drawing the "what you're cutting" preview).
   */
  function waveformTable(timbre, samples) {
    const out = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      out[i] = waveformSample(timbre, i / samples);
    }
    return out;
  }

  // ── RIAA equalization ─────────────────────────────────────────────────────
  //
  // Cutting pre-emphasis boosts highs and cuts lows (so the bass groove stays
  // narrow and the treble stays above the noise floor); playback de-emphasis
  // is the exact inverse. The three corner frequencies of the standard are
  // encoded as time constants 3180 µs (50.05 Hz), 318 µs (500.5 Hz) and
  // 75 µs (2122 Hz). Playback transfer:
  //
  //   H(s) = (1 + s·τ1) / [(1 + s·τ0)(1 + s·τ2)],   τ0=3180µs, τ1=318µs, τ2=75µs
  //
  // Normalised to 0 dB at 1 kHz (a constant multiplier, fixed by convention).
  {
    const TAU0 = 3180e-6; // 50.05 Hz
    const TAU1 = 318e-6;  // 500.5 Hz
    const TAU2 = 75e-6;   // 2122 Hz
    const OMEGA_1K = TWO_PI * 1000;
    const NORM = (1 + OMEGA_1K * OMEGA_1K * TAU1 * TAU1) /
      ((1 + OMEGA_1K * OMEGA_1K * TAU0 * TAU0) * (1 + OMEGA_1K * OMEGA_1K * TAU2 * TAU2));

    /** Raw (un-normalised) RIAA playback power gain at frequency f (Hz). */
    function riaaPlaybackGainRaw(f) {
      const w = TWO_PI * f;
      const num = 1 + w * w * TAU1 * TAU1;
      const den = (1 + w * w * TAU0 * TAU0) * (1 + w * w * TAU2 * TAU2);
      return num / den;
    }

    /** RIAA playback gain normalised so 1 kHz = 0 dB. Returns dB. */
    function riaaPlaybackDb(f) {
      return 10 * Math.log10(riaaPlaybackGainRaw(f) / NORM);
    }

    // expose the block-scoped functions
    global.__riaa = { riaaPlaybackGainRaw, riaaPlaybackDb, TAU0, TAU1, TAU2 };
  }

  // ── Modulated groove point (for drawing) ─────────────────────────────────

  /**
   * A point on the modulated spiral at spiral-angle θ (radians), given gpr
   * wiggles per revolution, timbre, and a display amplitude (mm of lateral
   * excursion, exaggerated so the wiggle is visible). Returns {x, y, r} in the
   * disc frame, centred at the origin, in mm.
   *
   * The carrier is the mean spiral radius at θ; the lateral modulation is
   * applied along the radial direction (a real cutter pushes the stylus
   * laterally — perpendicular to the groove — which for a tightly-wound spiral
   * is essentially the radial direction; the visual error is negligible and
   * the topology — waveform shape preserved, wavelength = 2πr/gpr — is exact).
   */
  function groovePoint(theta, gpr, timbre, rOuter_mm, pitch_mm, amplitude_mm) {
    const meanR = spiralRadius(theta, rOuter_mm, pitch_mm);
    const phase = (theta / TWO_PI) * gpr; // gpr cycles per 2π
    const mod = waveformSample(timbre, phase) * amplitude_mm;
    const r = meanR + mod;
    return { x: r * Math.cos(theta), y: r * Math.sin(theta), r };
  }

  // ── Export ────────────────────────────────────────────────────────────────

  const _api = {
    TWO_PI,
    GEOMETRY,
    RPM_PRESETS,
    omega,
    revolutionPeriod,
    linearVelocity,
    wavelength,
    maxResolvableFrequency,
    frequency,
    wigglesPerRevolution,
    wavelengthFromGpr,
    pitchFromLpi,
    lpiFromPitch,
    spiralRadius,
    spiralThetaAtRadius,
    spiralTurns,
    sideTimeMinutes,
    spiralArcLength_mm,
    WAVEFORMS,
    waveformSample,
    waveformTable,
    riaaPlaybackGainRaw: global.__riaa.riaaPlaybackGainRaw,
    riaaPlaybackDb: global.__riaa.riaaPlaybackDb,
    RIAA_TAU: { tau0: global.__riaa.TAU0, tau1: global.__riaa.TAU1, tau2: global.__riaa.TAU2 },
    groovePoint,
  };
  global.LatheCut = _api;
})(typeof window !== "undefined" ? window : globalThis);

// Export both for Node (module.exports) and the browser (window.LatheCut).
if (typeof module !== "undefined" && module.exports) {
  module.exports = (typeof window !== "undefined" ? window : globalThis).LatheCut;
}
