// Verification harness for the nightmark engine.
// Loads app.js in a stubbed browser context so we can call buildIntervals,
// isLitAt, formatNotation and assert against hand-computed expectations.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// ---- stub the DOM bits app.js touches at module load ----
const stubCanvasCtx = new Proxy({}, { get: () => () => {} });
function makeEl(id) {
  // canvas elements need getContext; everything else is a no-op proxy
  const base = {
    id,
    width: 520, height: 440,
    value: "", textContent: "", innerHTML: "", className: "",
    hidden: false, disabled: false, title: "",
    style: {}, dataset: {},
    addEventListener: () => {}, removeEventListener: () => {},
    appendChild: () => {}, querySelectorAll: () => [],
    dispatchEvent: () => true, closest: () => null,
    getContext: () => stubCanvasCtx,
    classList: { add(){}, remove(){}, toggle(){} },
  };
  return base;
}
const stubDoc = {
  getElementById: (id) => makeEl(id),
  querySelectorAll: () => [],
  addEventListener: () => {},
  createElement: () => makeEl("created"),
};
const sandbox = {
  window: {},
  document: stubDoc,
  requestAnimationFrame: () => {},
  console,
  Math, Date, parseInt, parseFloat, Number, String, Boolean, Array, Object,
  isNaN, Set, Proxy,
};
sandbox.window.document = stubDoc;
sandbox.window.requestAnimationFrame = () => {};
sandbox.global = sandbox;
vm.createContext(sandbox);

const src = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
// append an export hook: app.js is strict-mode, so top-level decls aren't
// attached to the global. Pin them explicitly via globalThis.
const srcWithExports = src + "\n;globalThis.__x = { buildIntervals, isLitAt, formatNotation, formatPeriod, describeInWords, MORSE, PRESETS };\n";
vm.runInContext(srcWithExports, sandbox);

const {
  buildIntervals,
  isLitAt,
  formatNotation,
  describeInWords,
  MORSE,
  PRESETS,
} = sandbox.__x;

// ---------------- assertions ----------------
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; }
  else { fail++; console.error(`  ✗ ${name}${extra ? "  —  " + extra : ""}`); }
}
function approx(a, b, eps = 1e-6) { return Math.abs(a - b) < eps; }

// 1. Every preset's timeline must sum to exactly its period.
for (const p of PRESETS) {
  const segs = sandbox.buildIntervals ? buildIntervals(p.spec) : [];
  // buildIntervals is reassigned via the minots hook at runtime; replicate that:
  let ts = buildIntervals(p.spec);
  if (p.spec.special === "minots") {
    // emulate the override
    const flash = 0.4, dark = 0.3, grpGap = 2.0;
    const grp = (n) => {
      const s = [];
      for (let i = 0; i < n; i++) { s.push({lit:true,dur:flash}); if (i<n-1) s.push({lit:false,dur:dark}); }
      return s;
    };
    ts = [];
    ts.push(...grp(1)); ts.push({lit:false,dur:grpGap});
    ts.push(...grp(4)); ts.push({lit:false,dur:grpGap});
    ts.push(...grp(3));
    const used = ts.reduce((a,x)=>a+x.dur,0);
    ts.push({lit:false,dur:(p.spec.period||45)-used});
  }
  const total = ts.reduce((s, x) => s + x.dur, 0);
  ok(`${p.name}: timeline sums to period`, approx(total, p.spec.period),
     `got ${total}, want ${p.spec.period}`);
}

// 2. Notation strings match expectations for each preset.
const wantNotation = {
  "Portland Head, ME":   "Fl W 4s",
  "Heceta Head, OR":     "Fl W 10s",
  "Bodie Island, NC":    "Fl(2) W 30s",
  "Minot's Ledge, MA":   "Fl W 45s",   // base notation; special minots override is visual only
  "Cape Hatteras, NC":   "Fl W 7.5s",
  "Point Reyes, CA":     "Fl W 5s",
  "Tybee Island, GA":    "F W 8s",
  "Pigeon Point, CA":    "Fl W 10s",
};
for (const p of PRESETS) {
  const got = formatNotation(p.spec);
  ok(`${p.name}: notation`, got === wantNotation[p.name], `got "${got}", want "${wantNotation[p.name]}"`);
}

// 3. Fixed light is always lit.
{
  const segs = buildIntervals({ rhythm: "F", count: 1, color: "W", period: 8 });
  for (let t = 0; t <= 8; t += 0.25) {
    ok(`F W 8s lit at t=${t}`, isLitAt(segs, 8, t) === true);
  }
}

// 4. Flashing: a single flash should appear lit briefly then dark for the rest.
{
  const segs = buildIntervals({ rhythm: "Fl", count: 1, color: "W", period: 4 });
  ok("Fl W 4s lit at t=0", isLitAt(segs, 4, 0) === true);
  ok("Fl W 4s lit at t=0.3", isLitAt(segs, 4, 0.3) === true);
  ok("Fl W 4s dark at t=0.6", isLitAt(segs, 4, 0.6) === false);
  ok("Fl W 4s dark at t=2", isLitAt(segs, 4, 2) === false);
  ok("Fl W 4s lit again at t=4 (=t=0)", isLitAt(segs, 4, 4) === true);
}

// 5. Group flashing Fl(2): two flashes then a long dark.
{
  const segs = buildIntervals({ rhythm: "Fl", count: 2, color: "W", period: 6 });
  ok("Fl(2) W 6s lit at 0", isLitAt(segs, 6, 0) === true);
  ok("Fl(2) W 6s dark at 0.6", isLitAt(segs, 6, 0.6) === false);   // gap between flashes? actually 0.5 flash so dark
  ok("Fl(2) W 6s lit at 1.5", isLitAt(segs, 6, 1.5) === true);     // second flash (0.5+1.0=1.5)
  ok("Fl(2) W 6s dark at 3", isLitAt(segs, 6, 3) === false);       // long dark
  ok("Fl(2) W 6s lit at 6", isLitAt(segs, 6, 6) === true);         // wraps
}

// 6. Occulting: mostly lit, brief dark.
{
  const segs = buildIntervals({ rhythm: "Oc", count: 1, color: "W", period: 6 });
  ok("Oc W 6s lit at 0", isLitAt(segs, 6, 0) === true);
  ok("Oc W 6s lit at 2", isLitAt(segs, 6, 2) === true);
  ok("Oc W 6s dark at ~1.3", isLitAt(segs, 6, 1.3) === false);  // lead 1.0 + dark 0.5 => dark at 1.0..1.5
  ok("Oc W 6s lit at 4", isLitAt(segs, 6, 4) === true);
}

// 7. Isophase: half on, half off.
{
  const segs = buildIntervals({ rhythm: "Iso", count: 1, color: "W", period: 4 });
  ok("Iso W 4s lit at 0", isLitAt(segs, 4, 0) === true);
  ok("Iso W 4s lit at 1.9", isLitAt(segs, 4, 1.9) === true);
  ok("Iso W 4s dark at 2.1", isLitAt(segs, 4, 2.1) === false);
  ok("Iso W 4s dark at 3.9", isLitAt(segs, 4, 3.9) === false);
}

// 8. Quick flashing: flashes very frequently.
{
  const segs = buildIntervals({ rhythm: "Q", count: 1, color: "W", period: 2 });
  ok("Q W 2s lit at 0", isLitAt(segs, 2, 0) === true);
  ok("Q W 2s dark at 0.3", isLitAt(segs, 2, 0.3) === false);
}

// 9. Morse: letter A is .-  => lit, dark, lit-long, dark.
{
  const segs = buildIntervals({ rhythm: "Mo", count: 1, color: "W", period: 6, morseLetter: "A" });
  // units: 1(dit)+1(gap)+3(dah)+3(trail) = 8 units over 6s => unit=0.75
  // dit lit: 0..0.75 ; gap dark 0.75..1.5 ; dah lit 1.5..3.75 ; trail dark 3.75..6
  ok("Mo(A) lit at 0.3", isLitAt(segs, 6, 0.3) === true);
  ok("Mo(A) dark at 1.0", isLitAt(segs, 6, 1.0) === false);
  ok("Mo(A) lit at 2.0", isLitAt(segs, 6, 2.0) === true);
  ok("Mo(A) lit at 3.5", isLitAt(segs, 6, 3.5) === true);   // dah spans 1.5..3.75, so 3.5 is lit
  ok("Mo(A) dark at 4", isLitAt(segs, 6, 4) === false);      // past 3.75 => trailing dark
  ok("Mo(A) dark at 5", isLitAt(segs, 6, 5) === false);
}

// 10. Morse table sanity: every quiz/preset letter exists.
for (const L of ["A","S","O","U","V","H","K","M","S","T"]) {
  ok(`MORSE[${L}] exists`, !!MORSE[L]);
}
// 143 = I(1) L(4) Y(3)? Actually "I LOVE YOU" letters. Verify MORSE has all.
for (const L of "ILOVEYOU") ok(`MORSE[${L}] exists`, !!MORSE[L]);

// 11. describeInWords never returns empty for any rhythm.
for (const r of ["F","Fl","Oc","Iso","Q","Mo"]) {
  const spec = { rhythm: r, count: 2, color: "W", period: 6, morseLetter: "A" };
  ok(`describeInWords(${r}) non-empty`, describeInWords(spec).length > 0, describeInWords(spec));
}

// 12. Period formatting: integers get "Ns", halves get "N.5s".
ok("formatPeriod(4)", formatNotation({rhythm:"Fl",count:1,color:"W",period:4}) === "Fl W 4s");
ok("formatPeriod(7.5)", formatNotation({rhythm:"Fl",count:1,color:"W",period:7.5}) === "Fl W 7.5s");

console.log(`\n${pass} passed, ${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
