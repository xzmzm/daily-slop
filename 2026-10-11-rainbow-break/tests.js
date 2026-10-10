// node tests.js — checks for the field-sequential model.
const W = require("./wheel.js");

let passed = 0, failed = 0;
function check(name, ok, detail = "") {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
}
const near = (a, b, tol) => Math.abs(a - b) <= tol;

check("CBS disk: 144 fields/s on six segments is 1440 rpm", W.rpm(144) === 1440);
check("CBS: 144 fields/s make 48 RGB triads/s", W.colorPictures(144) === 48);
check("CBS: 405 lines interlaced at 144 fields/s is 29,160 lines/s", W.lineRate(144) === 29160);
check("a B&W set expects 15,750 lines/s — no lock", W.lineRate(144) / W.NTSC_BW.lineRate > 1.8);
check("field order cycles r, g, b", [0, 1, 2, 3, 4, 5].map(W.channelOf).join("") === "012012");
check("channelOf handles negative indices", W.channelOf(-1) === 2);
check("fieldIndex at boundaries", W.fieldIndex(1, 144) === 144 && W.fieldIndex(0.9999, 144) === 143);

check("field camera samples each field at its own time", W.sampleTime(5, 144, "field") === 5 / 144);
check("frame source holds one time for all three fields",
  W.sampleTime(3, 144, "frame") === W.sampleTime(5, 144, "frame"));

const total = W.fieldWeights(2.0, 144, W.EYE_TAU, 100000, 1e-12).reduce((s, f) => s + f.w, 0);
check("eye weights sum to 3 (one steady white)", near(total, 3, 1e-6), total.toFixed(6));
const white = W.perceivedSteady([1, 1, 1], 2.0, 144, W.EYE_TAU);
check("white at 144 Hz fuses to ≈ white", white.every((v) => near(v, 1, 0.02)),
  white.map((v) => v.toFixed(3)).join(", "));
const slow = W.perceivedSteady([1, 1, 1], 2.0 + 0.5 / 6, 6, W.EYE_TAU);
check("white at 6 Hz is one saturated colour", Math.max(...slow) > 2.5 && Math.min(...slow) < 0.1,
  slow.map((v) => v.toFixed(2)).join(", "));
const raw = W.fieldWeights(1.234, 144, 0);
check("tau = 0 shows the bare current field", raw.length === 1 && raw[0].w === 3);

const tri = W.triadWeights(2.0031, 144), per = [0, 0, 0];
tri.forEach((f) => { per[W.channelOf(f.k)] += f.w; });
check("triad window gives each channel exactly one field", per.every((v) => near(v, 1, 1e-9)),
  per.map((v) => v.toFixed(3)).join(", "));
check("triad window spans three field periods", near(tri.reduce((s, f) => s + f.w, 0), 3, 1e-9));

check("bounce stays in range", [0, 0.3, 1.7, 9.1].every((t) => {
  const x = W.bounce(t, 500, 100, 700); return x >= 100 && x <= 700;
}));
check("bounce reverses at the wall", near(W.bounce(1.3, 500, 100, 700), 650, 1e-9));
const flick = (rate) => { let lo = 9, hi = 0;
  for (let i = 0; i < 60; i++) { const v = W.perceivedSteady([1, 1, 1], 3 + i / 600, rate, W.EYE_TAU)[0];
    lo = Math.min(lo, v); hi = Math.max(hi, v); } return hi - lo; };
check("red flicker at 24 fields/s is far larger than at 144", flick(24) > 20 * flick(144),
  `${flick(24).toFixed(3)} vs ${flick(144).toFixed(4)}`);
check("fringe: 480 px/s at 144 Hz spans 6.67 px", near(W.fringeWidth(480, 144), 6.667, 1e-3));
check("fringe narrows as field rate rises", W.fringeWidth(480, 360) < W.fringeWidth(480, 144));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
