/* flash-spectrum engine tests — plain node, zero dependencies. */
"use strict";

const E = require("./engine.js");

let passed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  passed += 1;
}
function close(a, b, tol, msg) {
  ok(Math.abs(a - b) <= tol, `${msg} (|${a} - ${b}| ≤ ${tol})`);
}
function monotone(pts, dir, msg) {
  for (let i = 1; i < pts.length; i++) {
    if (dir > 0) ok(pts[i] <= pts[i - 1] + 1e-12, `${msg} [${i}]`);
    else ok(pts[i] >= pts[i - 1] - 1e-12, `${msg} [${i}]`);
  }
}

/* ── wavelength → colour ─────────────────────────────────────────────── */
{
  const blue = E.wavelengthToRGB(450);
  const green = E.wavelengthToRGB(550);
  const yellow = E.wavelengthToRGB(580);
  const red = E.wavelengthToRGB(656.28);
  ok(blue.b > blue.r && blue.b > blue.g, "450 nm is blue-dominant");
  ok(green.g > green.r && green.g > green.b, "550 nm is green-dominant");
  ok(yellow.r > 0.85 && yellow.g > 0.85 && yellow.b === 0, "580 nm is yellow (r+g, no b)");
  ok(red.r > 0.99 && red.g < 0.01 && red.b === 0, "656 nm is pure red");
  const violet = E.wavelengthToRGB(395);
  ok(violet.r > 0 && violet.b > violet.g, "395 nm keeps a violet fringe of red");
  const dark = E.wavelengthToRGB(300);
  ok(dark.r === 0 && dark.g === 0 && dark.b === 0, "below 380 nm is black");
  const cyan = E.wavelengthToRGB(490);
  ok(cyan.g > 0.9 && cyan.b > 0.9 && cyan.r === 0, "490 nm is cyan");
  const teal = E.wavelengthToRGB(500);
  ok(teal.g > 0.9 && teal.b > 0.3 && teal.r === 0, "500 nm is green-leaning cyan");
}

/* ── circle-overlap lens area ────────────────────────────────────────── */
{
  close(E.lensArea(0, 10, 7), Math.PI * 49, 1e-9, "full containment → smaller disk");
  close(E.lensArea(0, 7, 10), Math.PI * 49, 1e-9, "containment is symmetric");
  close(E.lensArea(10, 10, 20), Math.PI * 100, 1e-9, "internal tangency");
  ok(E.lensArea(9, 10, 20) === Math.PI * 100, "containment holds inside tangency");
  ok(E.lensArea(17, 10, 7) === 0, "external tangency → zero");
  ok(E.lensArea(50, 10, 7) === 0, "far apart → zero");
  close(E.lensArea(10, 10, 10), 2 * (100 * Math.acos(0.5) - 50 * Math.sin(Math.acos(0.5))), 1e-9,
    "equal circles at d=R: lens = 2(R² acos(d/2R) − (d/2)R sin(acos))");
  // area must be continuous across the containment boundary
  const eps = 1e-9;
  close(E.lensArea(3 - eps, 10, 7), E.lensArea(3 + eps, 10, 7), 1e-6, "lens continuous at d=R−r");
  // symmetric in its arguments away from containment
  close(E.lensArea(12, 10, 7), E.lensArea(12, 7, 10), 1e-9, "lens symmetric in R,r");
}

/* ── eclipse geometry ────────────────────────────────────────────────── */
{
  const { GEO, TOTALITY_HALF, C3 } = E;
  close(TOTALITY_HALF, (GEO.moonR - GEO.sunR) / GEO.rate, 1e-12, "totality half-duration");
  close(E.separation(0), GEO.moonR - GEO.sunR, 1e-9, "C2: internal tangency");
  close(E.separation(TOTALITY_HALF), 0, 1e-9, "mid-totality: perfect centre");
  close(E.uncovered(0), 0, 1e-9, "nothing of the photosphere at C2");
  close(E.uncovered(TOTALITY_HALF), 0, 1e-9, "nothing at mid-totality");
  ok(E.uncovered(E.T_MIN) > 0.05, "8 min before C2 a crescent still blazes");
  ok(E.uncovered(E.T_MIN) < 0.18, "…but most of the disk is already eaten");
  ok(E.uncovered(E.T_MIN) > E.uncovered(-240), "the sliver shrinks with time");
  monotone([-480, -400, -300, -200, -120, -60, -30, -10, -1, 0].map(E.uncovered), +1,
    "uncovered decreases monotonically into second contact");
  monotone([C3, C3 + 30, C3 + 60, C3 + 120, C3 + 165].map(E.uncovered), -1,
    "uncovered grows monotonically after third contact");
  close(E.uncovered(C3), 0, 1e-9, "C3: back to internal tangency");
}

/* ── continuum & emission envelopes ──────────────────────────────────── */
{
  const flashPeak = E.emission(0, "guntur");
  const mid = E.emission(E.TOTALITY_HALF, "guntur");
  close(flashPeak, 1.0, 1e-9, "the flash peaks at exactly full strength at C2");
  ok(Math.abs(mid - 0.55) < 0.02, "mid-totality settles to the ring level (~0.55)");
  ok(E.emission(E.T_MIN, "guntur") === 0, "no emission 8 min out: continuum owns the eye");
  ok(E.emission(-240, "guntur") === 0, "no emission 4 min out");
  ok(E.emission(2, "guntur") > E.emission(20, "guntur"), "after C2 the flash decays to the ring");
  ok(E.emission(E.C3, "guntur") > 0.9, "the flash returns at third contact");
  ok(E.emission(60, "corona") === 0, "epilogue scene has no flash spectrum");
  ok(E.continuum(E.T_MIN, "guntur") > 0.05, "partial-phase continuum follows the sliver");
  close(E.continuum(0, "guntur"), E.CORONA_FLOOR, 1e-12, "totality continuum = corona floor");
  ok(E.continuum(0, "corona") === E.CORONA_FLOOR * 2.4, "epilogue lifts the floor to show the corona");
}

/* ── the spectrum: absorption flips to emission ──────────────────────── */
{
  const S = (t, wl) => E.spectrum(t, wl, "guntur");
  // partial phase: dark lines on a bright continuum
  ok(S(-480, 640) > 0.05, "8 min out: continuum present at 640 nm");
  ok(S(-480, 656.28) < 0.55 * S(-480, 640), "…and Hα is a dark dip in it");
  ok(S(-480, 589.0) < 0.55 * S(-480, 592), "Na D₂ reads dark in the partial phase");
  close(S(-480, 587.56), S(-480, 592), 0.004, "D₃: NO feature of its own at noon — the point");
  // totality: bright lines on black
  ok(S(2, 640) < 0.01, "just after C2: the continuum is gone at 640 nm");
  ok(S(2, 656.28) > 0.8, "…and Hα blazes in emission");
  ok(S(2, 656.28) > S(-480, 656.28) + 0.6, "Hα flips from dip to peak across C2");
  ok(S(2, 589.0) > 0.25, "sodium shows in emission during the flash");
  ok(S(2, 587.56) > S(2, 589.0), "D₃ outshines D₂ — the stranger leads the pair");
  // D₃ arrives with the flash and never existed before
  close(S(T_MIN_SAFE(), 587.56), S(-480, 592), 0.01, "no D₃ bump long before C2");
  ok(S(2, 587.56) > 0.5, "D₃ is a first-rank line in the flash");
  // mid-totality still shows the ring/prominences
  ok(S(E.TOTALITY_HALF, 656.28) > 0.4, "mid-totality: Hα ring persists");
  // after C3 the continuum returns
  ok(S(E.C3 + 120, 640) > 0.02, "past C3 the crescent brings the continuum back");
  // determinism: byte-identical repeats
  const a = E.samples(2, 560, 620, 64, "guntur");
  const b = E.samples(2, 560, 620, 64, "guntur");
  ok(JSON.stringify(a) === JSON.stringify(b), "samples are deterministic");
  // energy sanity: absorption never makes intensity negative
  let min = 1;
  for (const s of E.samples(-480, 380, 740, 721, "guntur")) min = Math.min(min, s.i);
  ok(min >= 0, "intensity stays non-negative");
}
function T_MIN_SAFE() { return -480; }

/* ── display stretch ─────────────────────────────────────────────────── */
{
  close(E.displayIntensity(1), 1, 1e-12, "full well stays full");
  ok(E.displayIntensity(0.0012) > 0.02 && E.displayIntensity(0.0012) < 0.06,
    "corona floor lifts to a faint visible glow under the gamma stretch");
  ok(E.displayIntensity(0.01) < E.displayIntensity(0.1), "stretch is monotone");
}

/* ── catalogue matching — the discovery hinge ────────────────────────── */
{
  const m = E.matchLibrary(589.0, "guntur");
  ok(m && m.id === "D₂", "589.0 matches sodium D₂");
  ok(E.matchLibrary(589.59, "guntur")?.id === "D₁", "589.6 matches sodium D₁");
  ok(E.matchLibrary(656.3, "guntur")?.el === "H α", "Hα matches hydrogen");
  ok(E.matchLibrary(486.1, "guntur")?.id === "F", "486.1 matches Hβ/F");
  ok(E.matchLibrary(587.56, "guntur") === null, "587.56 matches NOTHING in 1868 — the discovery");
  ok(E.matchLibrary(588.28, "guntur") === null, "between D₃ and D₂ is no-man's land");
  ok(E.matchLibrary(530.3, "guntur") === null, "no green line in the 1868 library either");
  ok(E.matchLibrary(518.4, "guntur")?.id === "b₂", "magnesium b₂ matches");
  // tolerance edges
  ok(E.matchLibrary(589.0 - E.LIB_TOL + 0.01, "guntur") !== null, "just inside tolerance matches");
  ok(E.matchLibrary(656.28 + E.LIB_TOL + 0.05, "guntur") === null, "just outside tolerance does not");
  ok(E.matchLibrary(530.3, "corona") === null, "epilogue: the catalogue is closed — that's the trap");
}

/* ── feature finding ─────────────────────────────────────────────────── */
{
  const f1 = E.nearestFeature(2, 587.56, "guntur");
  ok(f1 && f1.kind === "emission" && f1.line.id === "D₃", "cursor on D₃ in the flash");
  const f2 = E.nearestFeature(2, 588.9, "guntur");
  ok(f2 && f2.line.id === "D₂", "cursor a touch right is on sodium D₂");
  ok(E.nearestFeature(-480, 587.56, "guntur") === null, "no D₃ feature to find at −8 min");
  const f3 = E.nearestFeature(-480, 589.0, "guntur");
  ok(f3 && f3.kind === "absorption", "at −8 min the D lines are absorption dips");
  ok(E.nearestFeature(-480, 600, "guntur") === null, "continuum between lines: nothing there");
  const g = E.nearestFeature(E.TOTALITY_HALF, 530.3, "corona");
  ok(g && g.line.unknown1869, "epilogue: the green line is findable and flagged");
  const r = E.nearestFeature(E.TOTALITY_HALF, 637.4, "corona");
  ok(r && r.line.el === "Fe XIII", "epilogue red line is catalogued in hindsight");
}

/* ── verdicts ────────────────────────────────────────────────────────── */
{
  const v = E.verdict(587.56, "guntur", 7, 2);
  ok(v.kind === "helium" && v.ok, "claiming D₃ wins helium");
  ok(v.lines.some((l) => l.includes("587.56")), "the verdict quotes the wavelength");
  ok(v.lines.some((l) => l.includes("1895")), "the verdict tells the 1895 Earth discovery");
  ok(v.lines.some((l) => l.includes("7")), "the verdict reports the session's line count");

  const vb = E.verdict(447.15, "guntur", 3, 2);
  ok(vb.kind === "helium-blue" && vb.ok, "helium's other lines score as seconds");
  ok(vb.lines.some((l) => l.includes("He I")), "…and are named as He I");

  const vk = E.verdict(589.0, "guntur", 2, -480);
  ok(vk.kind === "known" && !vk.ok, "claiming sodium is rebuffed");
  ok(vk.lines.some((l) => l.includes("odium")), "the rebuke names sodium");

  const vn = E.verdict(600, "guntur", 2, 2);
  ok(vn.kind === "nothing", "claiming empty continuum gets nothing");

  const vc = E.verdict(530.3, "corona", 2, E.TOTALITY_HALF);
  ok(vc.kind === "coronium-trap" && !vc.ok, "the green line is the coronium trap");
  ok(vc.lines.some((l) => l.includes("Fe XIV") || l.includes("Edlén") || l.includes("1942")),
    "the trap verdict explains forbidden Fe XIV / Edlén 1942");
  ok(vc.lines.some((l) => l.includes("million")), "…and the million-degree corona");

  const vcr = E.verdict(637.4, "corona", 2, E.TOTALITY_HALF);
  ok(vcr.kind === "corona-known", "the red coronal line is dismissed as known");
}

/* ── the 1869 epilogue spectrum ──────────────────────────────────────── */
{
  const S = (wl) => E.spectrum(0, wl, "corona");
  ok(S(530.29) > 0.5, "the green line dominates the epilogue");
  ok(S(637.45) > 0.2, "its red Fe XIII cousin is present");
  close(S(560), E.CORONA_FLOOR * 2.4, 1e-12, "elsewhere only the lifted corona floor");
  ok(S(656.28) < 0.01, "no flash Hα in the epilogue — corona only");
  // and the green line is nowhere in the 1868 scene at any time
  let maxGreen = 0;
  for (let t = E.T_MIN; t <= E.T_MAX; t += 7) {
    maxGreen = Math.max(maxGreen, E.spectrum(t, 530.29, "guntur") - E.continuum(t, "guntur"));
  }
  ok(maxGreen < 0.01, "1868 Guntur shows no 530.3 line anywhere on the clock");
}

/* ── presets & integrity ─────────────────────────────────────────────── */
{
  ok(E.FRAUNHOFER.length >= 12, "a full Fraunhofer set");
  ok(E.FLASH_LINES.length >= 10, "a full flash set");
  const heliums = E.FLASH_LINES.filter((l) => l.helium);
  ok(heliums.length === 3, "three helium lines hide in the flash");
  ok(heliums.some((l) => l.theLine), "exactly one is the canonical D₃");
  for (const l of [...E.FRAUNHOFER, ...E.FLASH_LINES, ...E.CORONAL_LINES]) {
    ok(l.wl > 300 && l.wl < 800, `${l.id}: wavelength in range`);
    ok(l.sigma > 0 && l.sigma < 1.5, `${l.id}: playable width`);
  }
  for (const l of E.FRAUNHOFER) ok(l.depth > 0 && l.depth <= 1, `${l.id}: depth sane`);
  for (const l of E.FLASH_LINES) ok(l.strength > 0 && l.strength <= 1, `${l.id}: strength sane`);
  // every library entry corresponds to a real photospheric line
  for (const entry of E.LIBRARY_1868) {
    const src = E.FRAUNHOFER.find((f) => f.wl === entry.wl);
    ok(src !== undefined, `library ${entry.id} is a real Fraunhofer line`);
  }
  // and helium is in none of them
  for (const entry of E.LIBRARY_1868) {
    ok(!E.FLASH_LINES.find((f) => f.helium && Math.abs(f.wl - entry.wl) < 0.5),
      `library ${entry.id} is not secretly helium`);
  }
}

console.log(`flash-spectrum: all ${passed} assertions passed`);
