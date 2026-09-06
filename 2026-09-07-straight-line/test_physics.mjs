// test_physics.mjs — node --test test_physics.mjs
// Validates the Straight-Line engine: the bandwidth law closed form against
// its step-by-step derivation and against every documented analog standard,
// the Kell discount, the exact NTSC-1953 rational chain (29.97, 3.579545 MHz,
// 315/88 MHz, 30000/1001), the dot-inversion arithmetic, drop-frame timecode,
// the YIQ matrix (row sums, round trip, exact bar staircase, tint rotation),
// the mechanical dead end (rim speed, pixel time, duty cycle), and the
// timeline's shape.

import test from "node:test";
import assert from "node:assert/strict";

import {
  KELL, SOUND_MS, STANDARDS, FHD_SAMPLE_CLOCK,
  bandwidthHz, bandwidthSteps, kellLines,
  rimSpeed, pixelTime, dutyCycle,
  NTSC, colorChain, dotCycles, dropFrame,
  YIQ_M, YIQ_INV, yiq, rgbFromYiq, rotateIQ, hueDeg, saturation,
  clamp01, BARS, barLuma,
  EVENTS,
} from "./physics.js";

const close = (a, b, tol, label) =>
  assert.ok(Math.abs(a - b) <= tol, `${label}: ${a} vs ${b} (±${tol})`);
const byId = (id) => STANDARDS.find((s) => s.id === id);

// ── 1 · the bandwidth law ────────────────────────────────────────────────────

test("bandwidth: closed form equals the step chain for every standard", () => {
  for (const std of STANDARDS) {
    const closed = bandwidthHz(std);
    const steps = bandwidthSteps(std);
    close(closed, steps.hz, Math.abs(closed) * 1e-12, `${std.id} closed vs steps`);
  }
});

test("bandwidth: NTSC 525 lands on its documented 4.2 MHz", () => {
  const b = bandwidthHz(byId("ntsc"));
  close(b, 4.2e6, 0.15e6, "525-line video bandwidth");
  close(b / 1e6, 4.27, 0.08, "≈ 4.27 MHz");
});

test("bandwidth: Baird's 30 lines fit inside a 10 kHz AM audio channel", () => {
  const b = bandwidthHz(byId("baird"));
  close(b, 9.19e3, 0.1e3, "30-line bandwidth");
  assert.ok(b < 10e3, "the whole picture fits a medium-wave channel");
});

test("bandwidth: the balanced law lands within 35% of every analog standard", () => {
  for (const std of STANDARDS) {
    if (std.digital) continue;               // the digital endpoint is a sample clock
    const b = bandwidthHz(std);
    assert.ok(b / std.docHz >= 0.65 && b / std.docHz <= 1.02,
      `${std.id}: balanced ${b} vs doc ${std.docHz}`);
  }
});

test("bandwidth: the square law — B ∝ N² at fixed frame rate and shape", () => {
  const base = byId("ntsc");
  for (const scale of [1 / 3, 1, 2, 3]) {
    const scaled = { ...base, lines: Math.round(base.lines * scale),
      activeLines: Math.round(base.activeLines * scale) };
    close(bandwidthHz(scaled) / bandwidthHz(base), scale * scale,
      0.02 * scale * scale, `N × ${scale.toPrecision(3)} → B × N²`);
  }
});

test("kell: 525 lines scan 480 but sell 336", () => {
  close(kellLines(480), 336, 1e-12, "0.7 × 480");
  close(KELL, 0.7, 1e-12, "the 1933 honesty discount");
});

test("fhd: the digital endpoint is exactly 148.5 MHz", () => {
  assert.equal(FHD_SAMPLE_CLOCK, 2200 * 1125 * 60);
  assert.equal(FHD_SAMPLE_CLOCK, 148_500_000);
  close(byId("fhd").docHz, FHD_SAMPLE_CLOCK, 1e-9, "doc uses the sample clock");
});

// ── 2 · the mechanical dead end ──────────────────────────────────────────────

test("nipkow: rim speed is π·D·fps — Baird fine, 525-line marginal", () => {
  close(rimSpeed(1, 12.5), Math.PI * 12.5, 1e-12, "1 m disk at 12.5 fps");
  close(rimSpeed(1, 12.5), 39.27, 0.01, "≈ 39.3 m/s");
  assert.ok(rimSpeed(1, 12.5) / SOUND_MS < 0.2, "Baird's disk stays subsonic");
  // a 1.5 m disk at 60 fields would ride the edge of the sound barrier
  close(rimSpeed(1.5, 30) / SOUND_MS, 0.412, 0.01, "525-line 1.5 m disk Mach");
});

test("nipkow: the selenium gap — three orders of magnitude", () => {
  const bairdPx = pixelTime(byId("baird"));
  const ntscPx = pixelTime(byId("ntsc"));
  close(bairdPx * 1e6, 37.3, 1.5, "Baird pixel ≈ 37 µs");
  close(ntscPx * 1e9, 81.6, 2, "NTSC pixel ≈ 82 ns");
  assert.ok(bairdPx / ntscPx > 400, "the cell physics cannot follow MHz scanning");
});

test("nipkow: duty cycle — each pixel lights once per frame, ~(AR·n_v·N)⁻¹", () => {
  const d30 = dutyCycle(byId("baird"));
  const d525 = dutyCycle(byId("ntsc"));
  close(d30, 1 / 2100, 1e-9, "30-line duty = 1/2100 exactly");
  close(d525, 2.4568e-6, 5e-10, "525-line duty ≈ 2.5 ppm");
  close(d30 / d525, 193.75, 0.5, "the lamp dimmed ~194× between 30 and 525 lines");
});

// ── 3 · the 1953 color bargain ───────────────────────────────────────────────

test("chain: f_line = 4.5 MHz / 286 = 15734.2657 Hz", () => {
  const { fLine } = colorChain();
  assert.equal(fLine, 4.5e6 / 286);
  close(fLine, 15734.2657, 0.001, "the 1953 line rate");
});

test("chain: frame rate is exactly 30000/1001 = 29.97…", () => {
  const { fFrame } = colorChain();
  assert.equal(fFrame, 30000 / 1001);       // 4.5e6/286/525 === 30000/1001 exactly
  close(fFrame, 29.97, 0.001, "the famous 29.97");
});

test("chain: the subcarrier is exactly 315/88 MHz", () => {
  const { fSc } = colorChain();
  assert.equal(fSc, 315e6 / 88);            // 227.5 × 4.5e6/286 === 315/88 MHz
  close(fSc, 3_579_545.45, 0.01, "3.579545 MHz");
  close(NTSC.scHalfLines % 1, 0.5, 1e-12, "227.5 is an odd half-integer");
  assert.equal(NTSC.audioLines, 286, "audio sits at an integer line count");
});

test("chain: 525 interlace fields come out of the same fractions", () => {
  const { fField, fLine } = colorChain();
  close(fLine / fField, 262.5, 1e-9, "262.5 lines per field");
  close(fField, 59.94, 0.001, "59.94 fields/s");
});

test("dots: phase flips every line, quarter-steps every field", () => {
  const d = dotCycles(100, 0) - dotCycles(99, 0);
  close(((d % 1) + 1) % 1, 0.5, 1e-12, "line-to-line dot inversion");
  const f = ((dotCycles(0, 1) - dotCycles(0, 0)) % 1 + 1) % 1;
  close(Math.min(f, 1 - f), 0.25, 1e-12, "a quarter-cycle per field, either sign");
  // two adjacent lines' dots sum to zero — the cancellation a B&W eye averages
  const a = Math.sin(2 * Math.PI * dotCycles(10.25, 0));
  const b = Math.sin(2 * Math.PI * dotCycles(11.25, 0));
  close(a + b, 0, 1e-12, "adjacent-line dots cancel pairwise");
});

test("drop-frame: 108 frames an hour, 3.6 s of drift, 3.6 ms/h overcorrect", () => {
  const { driftSec, dropped } = dropFrame();
  assert.equal(dropped, 108, "2 per minute except every tenth minute");
  close(driftSec, 3.5964, 0.001, "hourly drift");
  close(dropped / 30, 3.6, 1e-9, "compensation is exactly 3.600 s");
  const overcorrectFrames = dropped - 3600 * 30 * (1 - colorChain().fFrame / 30);
  close(overcorrectFrames, 0.1079, 0.001, "the famous residual");
  close((overcorrectFrames / 30) * 24 * 30.4, 2.62, 0.05, "≈ 2.6 s per month");
});

// ── 4 · YIQ ──────────────────────────────────────────────────────────────────

test("yiq: the rounded matrix rows sum to exactly 1, 0, 0", () => {
  for (const row of YIQ_M) close(row[0] + row[1] + row[2], row === YIQ_M[0] ? 1 : 0,
    1e-12, "row sum");
});

test("yiq: white carries no color at all", () => {
  const v = yiq([1, 1, 1]);
  close(v[0], 1, 1e-12, "Y of white");
  assert.ok(Math.abs(v[1]) < 1e-12 && Math.abs(v[2]) < 1e-12, "I=Q=0");
});

test("yiq: rgb∘yiq is the identity (inverse matrix exact)", () => {
  const samples = [];
  for (const r of [0, 0.25, 1]) for (const g of [0, 0.5, 1]) for (const b of [0, 0.75, 1])
    samples.push([r, g, b]);
  samples.push(...BARS.map((bar) => bar.rgb));
  for (const rgb of samples) {
    const back = rgbFromYiq(yiq(rgb));
    for (let k = 0; k < 3; k++) close(back[k], rgb[k], 1e-12, "round trip");
  }
});

test("yiq: the bar staircase is exact and strictly descending", () => {
  const expected = [1, 0.886, 0.701, 0.587, 0.413, 0.299, 0.114];
  const got = barLuma();
  got.forEach((y, i) => close(y, expected[i], 1e-12, `bar ${i} luma`));
  for (let i = 1; i < got.length; i++)
    assert.ok(got[i] < got[i - 1], "staircase descends");
});

test("tint: rotation moves hue by exactly θ, luma and saturation untouched", () => {
  const yellow = yiq([1, 1, 0]);
  const s0 = saturation(yellow);
  for (const theta of [5, 30, 137, 240]) {
    const rot = rotateIQ(yellow, theta);
    close((hueDeg(rot) - hueDeg(yellow) + 360) % 360, theta, 1e-9, `hue +${theta}°`);
    close(rot[0], yellow[0], 1e-12, "Y invariant");
    close(saturation(rot), s0, 1e-12, "saturation invariant");
  }
  // a black-and-white set watches the same tint sweep and sees nothing
  close(rotateIQ(yellow, 180)[0], yellow[0], 1e-12, "B&W viewers never knew");
});

test("clamp01 sanity", () => {
  assert.deepEqual([clamp01(-1), clamp01(0.5), clamp01(2)], [0, 0.5, 1]);
});

// ── 5 · the timeline ─────────────────────────────────────────────────────────

test("timeline: ascending 1884 → 2009, exactly one star, the night of 9/7", () => {
  const years = EVENTS.map((e) => e.year);
  for (let i = 1; i < years.length; i++)
    assert.ok(years[i] > years[i - 1], "strictly ascending");
  assert.equal(years[0], 1884);
  assert.equal(years[years.length - 1], 2009);
  assert.equal(EVENTS.filter((e) => e.star).length, 1);
  const star = EVENTS.find((e) => e.star);
  assert.equal(star.when, "1927.9.7");
});
