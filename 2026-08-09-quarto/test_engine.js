// Verification harness for the quarto imposition engine.
// Loads app.js in a stubbed browser context so we can call imposeSheets,
// readingOrder, nestingOrder and formatName and assert against hand-computed
// expectations — the classic 8-page layout, the 16-page expansion, and the
// invariants that hold for any saddle-stitched booklet.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// ---- stub the DOM bits app.js touches at module load ----
function makeEl(id) {
  const base = {
    id,
    value: "", textContent: "", innerHTML: "", className: "",
    style: {}, dataset: {},
    addEventListener: () => {}, removeEventListener: () => {},
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
  console,
  Math, Date, parseInt, parseFloat, Number, String, Boolean, Array, Object,
  setTimeout, clearTimeout, module: { exports: {} },
};
sandbox.window.document = stubDoc;

const code = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const { imposeSheets, readingOrder, nestingOrder, formatName } =
  sandbox.module.exports;

// ─────────────────────────────────────────────────────────────────
// tiny test framework
// ─────────────────────────────────────────────────────────────────
let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail) {
  if (cond) { pass++; }
  else { fail++; fails.push(name + (detail ? " :: " + detail : "")); console.log("  ✗ " + name + (detail ? " — " + detail : "")); }
}
function eq(name, got, want) {
  const same = JSON.stringify(got) === JSON.stringify(want);
  ok(name, same, "got " + JSON.stringify(got) + " want " + JSON.stringify(want));
}
function deepEq(name, got, want) { eq(name, got, want); }

// ─────────────────────────────────────────────────────────────────
// 1. THE CLASSIC 8-PAGE BOOKLET (the canonical reference layout)
//    Two sheets: outer [8,1]/[2,7], inner [6,3]/[4,5].
//    This is the layout in every bookbinding textbook.
// ─────────────────────────────────────────────────────────────────
console.log("\n— 8-page classic layout —");
const s8 = imposeSheets(8);
eq("8pg · sheet count", s8.length, 2);
deepEq("8pg · outer sheet front", s8[0].front, [8, 1]);
deepEq("8pg · outer sheet back",  s8[0].back,  [2, 7]);
deepEq("8pg · inner sheet front", s8[1].front, [6, 3]);
deepEq("8pg · inner sheet back",  s8[1].back,  [4, 5]);

// ─────────────────────────────────────────────────────────────────
// 2. THE 16-PAGE EXPANSION (octavo — four sheets)
// ─────────────────────────────────────────────────────────────────
console.log("— 16-page octavo —");
const s16 = imposeSheets(16);
eq("16pg · sheet count", s16.length, 4);
deepEq("16pg · sheet 1 front (cover)", s16[0].front, [16, 1]);
deepEq("16pg · sheet 1 back",          s16[0].back,  [2, 15]);
deepEq("16pg · sheet 2 front", s16[1].front, [14, 3]);
deepEq("16pg · sheet 2 back",  s16[1].back,  [4, 13]);
deepEq("16pg · sheet 3 front", s16[2].front, [12, 5]);
deepEq("16pg · sheet 3 back",  s16[2].back,  [6, 11]);
deepEq("16pg · sheet 4 front (center)", s16[3].front, [10, 7]);
deepEq("16pg · sheet 4 back",            s16[3].back,  [8, 9]);

// ─────────────────────────────────────────────────────────────────
// 3. THE FOLIO (single sheet, 4 pages)
// ─────────────────────────────────────────────────────────────────
console.log("— 4-page folio —");
const s4 = imposeSheets(4);
deepEq("4pg · single sheet front", s4[0].front, [4, 1]);
deepEq("4pg · single sheet back",  s4[0].back,  [2, 3]);

// ─────────────────────────────────────────────────────────────────
// 4. THE FACE-SUM INVARIANT — every face of every sheet sums to P+1.
//    This is the heart of saddle-stitch geometry.
// ─────────────────────────────────────────────────────────────────
console.log("— face-sum invariant (P+1 on every face) —");
[4, 8, 12, 16, 20, 24, 28, 32].forEach((P) => {
  const sheets = imposeSheets(P);
  const target = P + 1;
  let allOk = true;
  sheets.forEach((s, i) => {
    [s.front[0] + s.front[1], s.back[0] + s.back[1]].forEach((sum, j) => {
      if (sum !== target) {
        allOk = false;
        console.log(`    P=${P} sheet ${i} face ${j}: ${sum} ≠ ${target}`);
      }
    });
  });
  ok(`P=${P}: all faces sum to ${target}`, allOk);
});

// ─────────────────────────────────────────────────────────────────
// 5. UNIQUENESS — every page 1..P appears exactly once across all sheets.
// ─────────────────────────────────────────────────────────────────
console.log("— page uniqueness —");
[4, 8, 16, 32].forEach((P) => {
  const sheets = imposeSheets(P);
  const seen = [];
  sheets.forEach((s) => seen.push(...s.front, ...s.back));
  seen.sort((a, b) => a - b);
  const expected = [];
  for (let p = 1; p <= P; p++) expected.push(p);
  deepEq(`P=${P}: every page 1..${P} appears once`, seen, expected);
});

// ─────────────────────────────────────────────────────────────────
// 6. READING ORDER — the flat 1..P map is correct, and each page knows
//    which sheet + face it lives on.
// ─────────────────────────────────────────────────────────────────
console.log("— reading order + provenance —");
const ro8 = readingOrder(8);
eq("8pg · reading order length", ro8.length, 8);
eq("8pg · page 1 → sheet 1 front", ro8[0].sheet, 0);
ok("8pg · page 1 on front", ro8[0].face === "front");
eq("8pg · page 8 → sheet 1 front", ro8[7].sheet, 0);
eq("8pg · page 5 → sheet 2 back (center)", ro8[4].sheet, 1);
const pagesInOrder = ro8.map((r) => r.page);
deepEq("8pg · pages are 1..8", pagesInOrder, [1, 2, 3, 4, 5, 6, 7, 8]);

// every page's provenance is consistent with the sheets themselves
const s8ref = imposeSheets(8);
let provConsistent = true;
ro8.forEach((r) => {
  const sheet = s8ref[r.sheet];
  const onFace = r.face === "front" ? sheet.front : sheet.back;
  if (!onFace.includes(r.page)) provConsistent = false;
});
ok("8pg · readingOrder provenance matches imposeSheets", provConsistent);

// ─────────────────────────────────────────────────────────────────
// 7. NESTING ORDER — sheet 0 is outermost, last sheet is the center.
// ─────────────────────────────────────────────────────────────────
console.log("— nesting order —");
deepEq("8pg · nesting is [0,1]", nestingOrder(8), [0, 1]);
deepEq("16pg · nesting is [0,1,2,3]", nestingOrder(16), [0, 1, 2, 3]);

// ─────────────────────────────────────────────────────────────────
// 8. FORMAT NAMES (folio / quarto / octavo)
// ─────────────────────────────────────────────────────────────────
console.log("— format names —");
ok("4pg · folio",          formatName(4).startsWith("folio"));
ok("8pg · quarto",         formatName(8).startsWith("quarto"));
ok("16pg · octavo",        formatName(16).startsWith("octavo"));
ok("32pg · sexto-decimo",  formatName(32).includes("sexto-decimo"));

// ─────────────────────────────────────────────────────────────────
// 9. INPUT VALIDATION
// ─────────────────────────────────────────────────────────────────
console.log("— input validation —");
let threw = false;
try { imposeSheets(5); } catch { threw = true; }
ok("odd page count throws", threw);
threw = false;
try { imposeSheets(2); } catch { threw = true; }
ok("too-few page count throws", threw);
threw = false;
try { imposeSheets(0); } catch { threw = true; }
ok("zero page count throws", threw);

// ─────────────────────────────────────────────────────────────────
// 10. THE COVER-AND-CENTER CLAIMS (good for the NOTES)
//     The cover sheet always carries [P, 1]; the center sheet carries
//     the two middle pages of the book.
// ─────────────────────────────────────────────────────────────────
console.log("— cover & center claims —");
[8, 16, 24, 32].forEach((P) => {
  const sheets = imposeSheets(P);
  deepEq(`P=${P} · cover front is [P,1]`, sheets[0].front, [P, 1]);
  // center sheet's four pages should be the four middle pages of the book
  const mid = P / 2;
  const centerFront = sheets[sheets.length - 1].front;
  const centerBack = sheets[sheets.length - 1].back;
  const centerPages = [...centerFront, ...centerBack].sort((a, b) => a - b);
  deepEq(`P=${P} · center sheet = middle four pages`, centerPages, [mid - 1, mid, mid + 1, mid + 2]);
});

// ─────────────────────────────────────────────────────────────────
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log("\nFAILURES:");
  fails.forEach((f) => console.log("  ✗ " + f));
  process.exit(1);
} else {
  console.log("✓ all imposition assertions hold");
}
