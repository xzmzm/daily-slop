/* flash-spectrum — the deterministic eclipse-spectroscopy engine.
 *
 * Guntur, 18 August 1868: as the Moon erases the photosphere second by
 * second, the Sun's spectrum flips from Fraunhofer absorption (dark lines
 * on a bright continuum) to chromospheric emission (bright lines on
 * black) — the flash spectrum. One yellow line at 587.56 nm matches
 * nothing in the 1868 catalogue. It is helium: the first element
 * discovered in the sky, 27 years before anyone held it on Earth.
 *
 * Everything here is pure and node-testable: the app adds only drawing,
 * DOM and pointer handling. Wavelengths are real; line widths and the
 * timing/emission constants are exaggerated for playability (see
 * NOTES.md — the flash really is seconds, the chromosphere really is
 * only revealed at the limb, the corona is drawn ~1000× brighter than
 * reality so you can see it on a screen).
 */
"use strict";

/* ── Eclipse geometry ──────────────────────────────────────────────────
 * An illustrative *central* total eclipse: the Moon slightly larger than
 * the Sun, relative sidereal motion 30.5′/h. Not a reconstruction of
 * Guntur's exact timings — the contact math is what matters. */
const GEO = Object.freeze({
  sunR: 15.9,               // photosphere angular radius, arcmin
  moonR: 16.6,              // Moon angular radius, arcmin
  rate: 30.5 / 3600,        // relative angular rate, arcmin per second
});
const TOTALITY_HALF = (GEO.moonR - GEO.sunR) / GEO.rate; // C2 → mid, ≈ 82.6 s
const C3 = 2 * TOTALITY_HALF;                            // third contact
const T_MIN = -480;         // scrubber start: 8 min before 2nd contact
const T_MAX = Math.round(C3 + 165); // end: a little past third contact

/* The corona is ~10⁻⁶ of the photosphere in brightness; drawn ~1000×
 * brighter so the screen shows it. Only the label lies, not the physics. */
const CORONA_FLOOR = 0.0012;

/* ── Line tables (wavelengths real; widths exaggerated for the screen) ── */

/* Fraunhofer absorption lines riding on the photospheric continuum. */
const FRAUNHOFER = Object.freeze([
  { wl: 393.37, id: "K",  el: "Ca II",    depth: 0.85, sigma: 0.55 },
  { wl: 396.85, id: "H",  el: "Ca II",    depth: 0.80, sigma: 0.55 },
  { wl: 410.17, id: "Hδ", el: "H",        depth: 0.45, sigma: 0.60 },
  { wl: 430.79, id: "G",  el: "Fe I",     depth: 0.70, sigma: 0.60 },
  { wl: 434.05, id: "Hγ", el: "H",        depth: 0.55, sigma: 0.60 },
  { wl: 486.13, id: "F",  el: "H β",      depth: 0.75, sigma: 0.60 },
  { wl: 516.73, id: "b₄", el: "Mg I",     depth: 0.50, sigma: 0.50 },
  { wl: 517.27, id: "b₃", el: "Mg I",     depth: 0.55, sigma: 0.50 },
  { wl: 518.36, id: "b₂", el: "Mg I",     depth: 0.65, sigma: 0.50 },
  { wl: 526.96, id: "E",  el: "Fe I",     depth: 0.55, sigma: 0.50 },
  { wl: 589.00, id: "D₂", el: "Na I",     depth: 0.80, sigma: 0.50 },
  { wl: 589.59, id: "D₁", el: "Na I",     depth: 0.75, sigma: 0.50 },
  { wl: 656.28, id: "C",  el: "H α",      depth: 0.70, sigma: 0.65 },
  { wl: 686.72, id: "B",  el: "O₂ (air)", depth: 0.50, sigma: 0.90, telluric: true },
]);

/* Chromospheric / prominence emission — the flash spectrum. Lines with
 * `helium` are the ones nobody in 1868 could account for. */
const FLASH_LINES = Object.freeze([
  { wl: 410.17, id: "Hδ",   el: "H",   strength: 0.50, sigma: 0.50 },
  { wl: 434.05, id: "Hγ",   el: "H",   strength: 0.68, sigma: 0.50 },
  { wl: 447.15, id: "He I", el: "?",   strength: 0.42, sigma: 0.50, helium: true },
  { wl: 486.13, id: "Hβ",   el: "H",   strength: 0.92, sigma: 0.50 },
  { wl: 518.36, id: "b₂",   el: "Mg I", strength: 0.35, sigma: 0.55 },
  { wl: 587.56, id: "D₃",   el: "?",   strength: 0.85, sigma: 0.45, helium: true, theLine: true },
  { wl: 589.00, id: "D₂",   el: "Na I", strength: 0.58, sigma: 0.45 },
  { wl: 589.59, id: "D₁",   el: "Na I", strength: 0.48, sigma: 0.45 },
  { wl: 656.28, id: "C",    el: "H α",  strength: 1.00, sigma: 0.55 },
  { wl: 706.52, id: "He I", el: "?",   strength: 0.38, sigma: 0.55, helium: true },
]);

/* Epilogue scene: mid-totality of 1869+, the corona on its own. The green
 * line fooled a generation ("coronium") until Edlén 1942. */
const CORONAL_LINES = Object.freeze([
  { wl: 530.29, id: "green", el: "?",       strength: 0.55, sigma: 0.75, unknown1869: true },
  { wl: 637.45, id: "red",   el: "Fe XIII", strength: 0.24, sigma: 0.75 },
]);

/* The 1868 line catalogue the player matches against. Helium is —
 * historically, deliberately — absent. */
const LIBRARY_1868 = Object.freeze([
  { wl: 393.37, id: "K",  el: "Ca II" },
  { wl: 396.85, id: "H",  el: "Ca II" },
  { wl: 410.17, id: "Hδ", el: "H" },
  { wl: 430.79, id: "G",  el: "Fe I" },
  { wl: 434.05, id: "Hγ", el: "H" },
  { wl: 486.13, id: "F",  el: "H β" },
  { wl: 518.36, id: "b₂", el: "Mg I" },
  { wl: 526.96, id: "E",  el: "Fe I" },
  { wl: 589.00, id: "D₂", el: "Na I" },
  { wl: 589.59, id: "D₁", el: "Na I" },
  { wl: 656.28, id: "C",  el: "H α" },
  { wl: 686.72, id: "B",  el: "O₂ (air)" },
]);

const LIB_TOL = 0.65;       // nm; a catalogue match within ±0.65 nm
const FEATURE_TOL = 1.0;    // nm; the eyepiece calls this "on the line"

/* ── Visible-light palette (Dan Bruton's approximation) ──────────────── */
function wavelengthToRGB(wl) {
  let r = 0, g = 0, b = 0;
  if (wl < 380 || wl > 780) return { r: 0, g: 0, b: 0 };
  if (wl < 440) { r = (440 - wl) / 60; b = 1; }
  else if (wl < 490) { g = (wl - 440) / 50; b = 1; }
  else if (wl < 510) { g = 1; b = (510 - wl) / 20; }
  else if (wl < 580) { r = (wl - 510) / 70; g = 1; }
  else if (wl < 645) { r = 1; g = (645 - wl) / 65; }
  else if (wl <= 780) { r = 1; }
  let f = 1;
  if (wl < 420) f = 0.3 + (0.7 * (wl - 380)) / 40;
  else if (wl > 700) f = 0.3 + (0.7 * (780 - wl)) / 80;
  const gamma = 0.8;
  const scaled = (c) => (c === 0 ? 0 : Math.pow(c * f, gamma));
  return { r: scaled(r), g: scaled(g), b: scaled(b) };
}

function gauss(x, mu, sigma) {
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z);
}

/* ── Circle-overlap geometry (exact lens area) ───────────────────────── */
function lensArea(d, R, r) {
  if (d >= R + r) return 0;
  if (d <= Math.abs(R - r)) return Math.PI * Math.min(R, r) ** 2;
  const a1 = R * R * Math.acos((d * d + R * R - r * r) / (2 * d * R));
  const a2 = r * r * Math.acos((d * d + r * r - R * R) / (2 * d * r));
  const a3 = 0.5 * Math.sqrt(Math.max(0, (-d + R + r) * (d + R - r) * (d - R + r) * (d + R + r)));
  return a1 + a2 - a3;
}

/* Moon–Sun centre separation, arcmin, at time t (seconds from C2). */
function separation(t) {
  return GEO.rate * Math.abs(t - TOTALITY_HALF);
}

/* Fraction of the photospheric disk still uncovered (1 → full sun). */
function uncovered(t) {
  const d = separation(t);
  return 1 - lensArea(d, GEO.sunR, GEO.moonR) / (Math.PI * GEO.sunR * GEO.sunR);
}

/* Continuum level at the eyepiece: the surviving photosphere plus the
 * (generously drawn) coronal light. */
function continuum(t, scene) {
  const corona = CORONA_FLOOR * (scene === "corona" ? 2.4 : 1);
  return (scene === "corona" ? 0 : uncovered(t)) + corona;
}

/* How visible the chromospheric ring / prominences are: nothing until the
 * last sliver of photosphere is nearly gone, then the flash itself peaks
 * within seconds of each contact, settling to the mid-totality ring. */
function emergence(t) {
  return clamp01(1 - uncovered(t) / 0.015);
}
function flashBump(t, contact) {
  const dt = t - contact;
  return Math.exp(-0.5 * (dt / 8) ** 2);
}
function emission(t, scene) {
  if (scene === "corona") return 0;   // epilogue: corona only, no flash
  const flash = Math.max(flashBump(t, 0), flashBump(t, C3));
  return emergence(t) * (0.55 + 0.45 * clamp01(flash));
}

/* ── The spectrum itself: intensity at wavelength λ, time t ──────────── */
function spectrum(t, wl, scene) {
  const isCorona = scene === "corona";
  const photosphere = isCorona ? 0 : uncovered(t);

  let I = continuum(t, scene);
  if (photosphere > 0) {
    let absorption = 0;
    for (const line of FRAUNHOFER) absorption += line.depth * gauss(wl, line.wl, line.sigma);
    I -= photosphere * Math.min(0.95, absorption);
  }

  const e = emission(t, scene);
  if (e > 0) {
    for (const line of FLASH_LINES) I += e * line.strength * gauss(wl, line.wl, line.sigma);
  }
  if (isCorona) {
    for (const line of CORONAL_LINES) I += line.strength * gauss(wl, line.wl, line.sigma);
  }
  return Math.max(0, I);
}

/* Samples for drawing: n points across [wl0, wl1]. */
function samples(t, wl0, wl1, n, scene) {
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const wl = wl0 + ((wl1 - wl0) * i) / (n - 1);
    out[i] = { wl, i: spectrum(t, wl, scene) };
  }
  return out;
}

/* Screen stretch: like a gamma stretch on an astro image — the eye
 * adapts, the display follows. */
function displayIntensity(I) {
  return Math.pow(clamp01(I), 0.45);
}

/* ── Measurement ─────────────────────────────────────────────────────── */

/* Nearest catalogue entry within LIB_TOL, or null. */
function matchLibrary(wl, scene) {
  if (scene === "corona") return null;   // no catalogue yet — that's the trap
  let best = null, bestD = Infinity;
  for (const entry of LIBRARY_1868) {
    const d = Math.abs(wl - entry.wl);
    if (d < bestD) { bestD = d; best = entry; }
  }
  return bestD <= LIB_TOL ? best : null;
}

/* The spectral feature (absorption dip or emission peak) nearest the
 * cursor, if any is close enough to count as "on it". */
function nearestFeature(t, wl, scene) {
  const isCorona = scene === "corona";
  const candidates = [];
  if (!isCorona && uncovered(t) > 0.008) {
    for (const line of FRAUNHOFER) candidates.push({ wl: line.wl, kind: "absorption", line });
  }
  const e = emission(t, scene);
  if (!isCorona && e > 0.06) {
    for (const line of FLASH_LINES) {
      if (line.strength * e > 0.05) candidates.push({ wl: line.wl, kind: "emission", line });
    }
  }
  if (isCorona) {
    for (const line of CORONAL_LINES) candidates.push({ wl: line.wl, kind: "emission", line });
  }
  let best = null, bestD = Infinity;
  for (const c of candidates) {
    const d = Math.abs(wl - c.wl);
    if (d < bestD) { bestD = d; best = c; }
  }
  return bestD <= FEATURE_TOL ? best : null;
}

/* ── The verdict: what happens when you send the telegram ────────────── */
function verdict(wl, scene, measuredCount, t) {
  const lib = matchLibrary(wl, scene);
  const feat = nearestFeature(t, wl, scene);
  const near = Math.abs(wl - feat?.wl ?? wl) <= FEATURE_TOL ? feat : null;

  if (scene === "corona") {
    if (near && near.line.unknown1869) {
      return {
        kind: "coronium-trap",
        ok: false,
        title: "Careful — this trap has teeth",
        lines: [
          "530.3 nm, in the corona, matching no laboratory spectrum ever produced.",
          "The 1869 observers called it coronium and added it to the periodic table.",
          "1942, Bengt Edlén: it is iron with thirteen electrons stripped off (Fe XIV),",
          "a forbidden transition that can only glow in the corona's near-vacuum.",
          "For Fe XIV to exist at all, the corona must be over a million kelvin —",
          "a mystery line turned out to be a thermometer, and a Nobel-worthy one.",
        ],
      };
    }
    if (near) {
      return {
        kind: "corona-known",
        ok: false,
        title: "Known — that one came cheap",
        lines: [
          "637.4 nm — catalogued (after 1942) as Fe XIII, the red cousin of the green line.",
          "Both forbidden; both coronal; neither a new element.",
        ],
      };
    }
    return nothingThere();
  }

  if (near && near.line.helium) {
    if (near.line.theLine) {
      return {
        kind: "helium",
        ok: true,
        title: "Helium — discovered in the sky",
        lines: [
          "587.56 nm. Not hydrogen, not sodium, not anything in the 1868 catalogue.",
          "Janssen saw it at Guntur on 18 August 1868; Lockyer independently on 20 October.",
          "Lockyer and Frankland named it after helios, the Greek sun — because that",
          "is where it lived: an element of the sky, with no home on Earth.",
          "Only in 1895 did Ramsay free the same gas from a uranium ore (cleveite)",
          "and watch the same yellow line appear in a tube on a bench. Sky first, Earth second.",
          `Lines measured this session: ${measuredCount}.`,
        ],
      };
    }
    return {
      kind: "helium-blue",
      ok: true,
      title: "The same stranger, in another colour",
      lines: [
        `${near.line.wl.toFixed(2)} nm — this is helium's second act: He I ${near.line.id}.`,
        "Claim D₃ at 587.56 nm for the canonical discovery — this line seals the case.",
      ],
    };
  }
  if (lib) {
    return {
      kind: "known",
      ok: false,
      title: "Known since Bunsen and Kirchhoff",
      lines: [
        `${wl.toFixed(1)} nm sits on ${lib.id} (${lib.el}) — catalogued since the 1860s.`,
        "Sodium and hydrogen announce themselves in every flame on Earth.",
        "The new thing must be a line with no catalogue entry at all.",
      ],
    };
  }
  return nothingThere();
}

function nothingThere() {
  return {
    kind: "nothing",
    ok: false,
    title: "Nothing there",
    lines: [
      "The crosshair is not on a line. Park it on a bright one at totality,",
      "check the catalogue, and only then send the telegram.",
    ],
  };
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

/* ── Exports ─────────────────────────────────────────────────────────── */
const FlashEngine = {
  GEO, TOTALITY_HALF, C3, T_MIN, T_MAX, CORONA_FLOOR,
  FRAUNHOFER, FLASH_LINES, CORONAL_LINES, LIBRARY_1868, LIB_TOL, FEATURE_TOL,
  wavelengthToRGB, gauss, lensArea, separation, uncovered,
  continuum, emergence, emission, spectrum, samples, displayIntensity,
  matchLibrary, nearestFeature, verdict,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = FlashEngine;
}
if (typeof window !== "undefined") {
  window.FlashEngine = FlashEngine;
}
