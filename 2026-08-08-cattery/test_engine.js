// test_engine.js — run with:  node test_engine.js
// Asserts the genetics engine against hand-computed Mendelian expectations.
// Pure logic — no DOM.

const e = require("./engine.js");

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; /* console.log("  ✓ " + name); */ }
  else { fail++; console.log("  ✗ " + name + (extra ? "  → " + extra : "")); }
}
function eq(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  ok(name, g === w, `got ${g} want ${w}`);
}
function near(name, got, want, tol) {
  tol = tol == null ? 1e-9 : tol;
  ok(name, Math.abs(got - want) <= tol, `got ${got} want ${want} (±${tol})`);
}

const G = e.ALLELES;
function geno(sex, O, B, A, D, S, W, L) { return { sex, O, B, A, D, S, W, L }; }

// ============================================================
// 1. Autosomal Punnett squares
// ============================================================
{
  // Bb × Bb → 1 BB : 2 Bb : 1 bb
  const p = e.punnettAuto(geno("F", ["o", "o"], ["B", "b"], ["A", "A"], ["D", "D"], ["s", "s"], ["w", "w"], ["L", "L"]),
                          geno("M", ["o"], ["B", "b"], ["A", "A"], ["D", "D"], ["s", "s"], ["w", "w"], ["L", "L"]), "B");
  eq("Bb×Bb tally BB", p.tally["BB"], 1);
  eq("Bb×Bb tally Bb", p.tally["Bb"], 2);
  eq("Bb×Bb tally bb", p.tally["bb"], 1);
}
{
  // BB × bb → all Bb
  const p = e.punnettAuto(geno("F", ["o", "o"], ["B", "B"], ["A", "A"], ["D", "D"], ["s", "s"], ["w", "w"], ["L", "L"]),
                          geno("M", ["o"], ["b", "b"], ["A", "A"], ["D", "D"], ["s", "s"], ["w", "w"], ["L", "L"]), "B");
  eq("BB×bb → all Bb", p.tally["Bb"], 4);
}
{
  // Dd × dd → 2 Dd : 2 dd (test cross)
  const p = e.punnettAuto(geno("F", ["o", "o"], ["B", "B"], ["A", "A"], ["D", "d"], ["s", "s"], ["w", "w"], ["L", "L"]),
                          geno("M", ["o"], ["B", "B"], ["A", "A"], ["d", "d"], ["s", "s"], ["w", "w"], ["L", "L"]), "D");
  eq("Dd×dd → Dd", p.tally["Dd"], 2);
  eq("Dd×dd → dd", p.tally["dd"], 2);
}

// ============================================================
// 2. X-linked orange — the headline genetics
// ============================================================
{
  // tortie mother X^O X^o  ×  non-orange father X^oY
  const mom = geno("F", ["O", "o"], ["B", "B"], ["A", "A"], ["D", "D"], ["s", "s"], ["w", "w"], ["L", "L"]);
  const dad = geno("M", ["o"], ["B", "B"], ["A", "A"], ["D", "D"], ["s", "s"], ["w", "w"], ["L", "L"]);
  const p = e.punnettOrange(mom, dad);
  eq("tortie×b father X^oY → 4 outcomes", p.outcomes.length, 4);
  // X^O X^o (tortie F), X^o X^o (black F), X^O Y (orange M), X^o Y (black M)
  const labels = p.outcomes.map((o) => o.label).sort();
  eq("orange Punnett labels", labels, ["X^OY", "X^OX^o", "X^oX^o", "X^oY"].sort());
}
{
  // orange male X^O Y  ×  black female X^o X^o
  // → daughters all X^O X^o (tortie); sons all X^o Y (black). Criss-cross inheritance.
  const mom = geno("F", ["o", "o"], ["B", "B"], ["A", "A"], ["D", "D"], ["s", "s"], ["w", "w"], ["L", "L"]);
  const dad = geno("M", ["O"], ["B", "B"], ["A", "A"], ["D", "D"], ["s", "s"], ["w", "w"], ["L", "L"]);
  const p = e.punnettOrange(mom, dad);
  const female = p.outcomes.filter((o) => o.sex === "F");
  const male = p.outcomes.filter((o) => o.sex === "M");
  eq("orange father → all daughters tortie", female.every((o) => o.label === "X^OX^o"), true);
  eq("orange father → all sons black", male.every((o) => o.label === "X^oY"), true);
}
{
  // orange male × orange female → ALL kittens orange
  const mom = geno("F", ["O", "O"], ["B", "B"], ["A", "A"], ["D", "D"], ["s", "s"], ["w", "w"], ["L", "L"]);
  const dad = geno("M", ["O"], ["B", "B"], ["A", "A"], ["D", "D"], ["s", "s"], ["w", "w"], ["L", "L"]);
  const p = e.punnettOrange(mom, dad);
  eq("O×O → all orange", p.outcomes.every((o) => o.label.includes("O")), true);
}

// ============================================================
// 3. The tortie paradox — almost always female
// ============================================================
{
  // A tortie phenotype requires X^O and X^o. Males (XY) have one X.
  // So a normal male can never be tortie.
  // Demonstrate: breed two cats, collect 2000 kittens, check torties are female.
  const mom = geno("F", ["O", "o"], ["B", "B"], ["A", "a"], ["D", "D"], ["s", "s"], ["w", "w"], ["L", "L"]);
  const dad = geno("M", ["o"], ["B", "B"], ["A", "a"], ["D", "D"], ["s", "s"], ["w", "w"], ["L", "L"]);
  const n = 4000;
  const kittens = e.litter(mom, dad, n, e.mulberry32(12345));
  const torties = kittens.filter((k) => e.phenotype(k).tortie);
  const tortieMales = torties.filter((k) => k.sex === "M");
  const tortieFemales = torties.filter((k) => k.sex === "F");
  ok("torties all female (4000 kittens)", tortieMales.length === 0,
     `${tortieFemales.length} F torties, ${tortieMales.length} M torties`);
  ok("tortie females actually occur", tortieFemales.length > 100,
     `only ${tortieFemales.length}`);
}

// ============================================================
// 4. Dominant white epistasis (W_ masks everything)
// ============================================================
{
  // Ww × ww → 50% all-white, 50% colored
  const mom = geno("F", ["o", "o"], ["B", "B"], ["a", "a"], ["D", "D"], ["s", "s"], ["w", "w"], ["L", "L"]);
  const dad = geno("M", ["o"], ["B", "B"], ["a", "a"], ["D", "D"], ["s", "s"], ["W", "w"], ["L", "L"]);
  // build expected ratios
  const r = e.expectedRatios(mom, dad);
  const white = r.find((x) => x.ph.white === "full");
  // black shows up once per sex (male & female) — sum across sex
  const black = r.filter((x) => x.ph.pigments[0] && x.ph.pigments[0].name === "black")
                  .reduce((s, x) => s + x.p, 0);
  near("Ww×ww → 50% white", white.p, 0.5);
  near("Ww×ww → 50% black", black, 0.5);
  // and a random litter reflects it
  const kittens = e.litter(mom, dad, 2000, e.mulberry32(7));
  const w = kittens.filter((k) => e.phenotype(k).white === "full").length;
  ok("Ww×ww random litter ~50% white", Math.abs(w / 2000 - 0.5) < 0.07, `${(w / 2000).toFixed(3)}`);
}

// ============================================================
// 5. Dilution (recessive d/d fades colors)
// ============================================================
{
  // B_ D_ = black; B_ dd = blue; bb D_ = chocolate; bb dd = lilac
  eq("BB Dd → black", e.eumelaninColor(geno("M", ["o"], ["B", "B"], ["A", "A"], ["D", "d"], ["s", "s"], ["w", "w"], ["L", "L"])).name, "black");
  eq("BB dd → blue", e.eumelaninColor(geno("M", ["o"], ["B", "B"], ["A", "A"], ["d", "d"], ["s", "s"], ["w", "w"], ["L", "L"])).name, "blue");
  eq("bb Dd → chocolate", e.eumelaninColor(geno("M", ["o"], ["b", "b"], ["A", "A"], ["D", "d"], ["s", "s"], ["w", "w"], ["L", "L"])).name, "chocolate");
  eq("bb dd → lilac", e.eumelaninColor(geno("M", ["o"], ["b", "b"], ["A", "A"], ["d", "d"], ["s", "s"], ["w", "w"], ["L", "L"])).name, "lilac");
  // orange dd = cream
  eq("orange dd → cream", e.orangeColor(geno("M", ["O"], ["B", "B"], ["A", "A"], ["d", "d"], ["s", "s"], ["w", "w"], ["L", "L"])).name, "cream");
}

// ============================================================
// 6. Agouti / tabby (A_ shows tabby banding; aa solid)
// ============================================================
{
  const tabbyMale = geno("M", ["o"], ["B", "B"], ["A", "a"], ["D", "D"], ["s", "s"], ["w", "w"], ["L", "L"]);
  const solidMale = geno("M", ["o"], ["B", "B"], ["a", "a"], ["D", "D"], ["s", "s"], ["w", "w"], ["L", "L"]);
  eq("Aa black → tabby", e.phenotype(tabbyMale).tabby, true);
  eq("aa black → solid", e.phenotype(solidMale).tabby, false);
}

// ============================================================
// 7. Expected ratios — probabilities sum to 1
// ============================================================
{
  for (const preset of [
    [geno("F", ["O", "o"], ["B", "B"], ["A", "a"], ["D", "D"], ["s", "s"], ["w", "w"], ["L", "L"]),
     geno("M", ["o"], ["B", "B"], ["A", "a"], ["D", "D"], ["s", "s"], ["w", "w"], ["L", "L"])],
    [geno("F", ["o", "o"], ["B", "b"], ["A", "a"], ["D", "d"], ["s", "s"], ["w", "w"], ["L", "L"]),
     geno("M", ["o"], ["B", "b"], ["A", "a"], ["D", "d"], ["s", "s"], ["w", "w"], ["L", "L"])],
    [geno("F", ["O", "o"], ["B", "B"], ["A", "A"], ["D", "D"], ["S", "s"], ["w", "w"], ["L", "L"]),
     geno("M", ["o"], ["B", "B"], ["A", "A"], ["D", "D"], ["s", "s"], ["w", "w"], ["L", "L"])],
  ]) {
    const r = e.expectedRatios(preset[0], preset[1]);
    const sum = r.reduce((s, x) => s + x.p, 0);
    near("ratios sum to 1", sum, 1.0);
    ok("all probs in [0,1]", r.every((x) => x.p >= 0 && x.p <= 1));
  }
}

// ============================================================
// 8. Calico requires tortie + white spotting
// ============================================================
{
  // X^O X^o  +  Ss/ss  → some calico
  const mom = geno("F", ["O", "o"], ["B", "B"], ["A", "A"], ["D", "D"], ["S", "s"], ["w", "w"], ["L", "L"]);
  const dad = geno("M", ["o"], ["B", "B"], ["A", "A"], ["D", "D"], ["s", "s"], ["w", "w"], ["L", "L"]);
  const r = e.expectedRatios(mom, dad);
  const calico = r.find((x) => x.ph.tortie && x.ph.whiteSpot);
  ok("calico appears in cross", !!calico);
  near("calico ~ 1/8 (¼ tortie-female × ½ white)", calico ? calico.p : 0, 0.125);
}

// ============================================================
// 9. White spotting — incomplete dominance
// ============================================================
{
  // Ss × Ss → 1 SS (high) : 2 Ss (bicolor) : 1 ss (none)
  const p = e.punnettAuto(geno("F", ["o", "o"], ["B", "B"], ["A", "A"], ["D", "D"], ["S", "s"], ["w", "w"], ["L", "L"]),
                          geno("M", ["o"], ["B", "B"], ["A", "A"], ["D", "D"], ["S", "s"], ["w", "w"], ["L", "L"]), "S");
  eq("Ss×Ss → SS", p.tally["SS"], 1);
  eq("Ss×Ss → Ss", p.tally["Ss"], 2);
  eq("Ss×Ss → ss", p.tally["ss"], 1);
}

// ============================================================
// 10. Genotype string formatting
// ============================================================
{
  eq("male genotype string", e.describeGeno(geno("M", ["O"], ["B", "b"], ["A", "a"], ["D", "D"], ["s", "s"], ["w", "w"], ["L", "l"])),
    "X^OY  Bb Aa DD ss ww Ll");
  eq("female genotype string", e.describeGeno(geno("F", ["O", "o"], ["B", "B"], ["A", "A"], ["D", "D"], ["s", "s"], ["w", "w"], ["L", "L"])),
    "X^OX^o  BB AA DD ss ww LL");
}

// ============================================================
// 11. Presets load and resolve to plausible phenotypes
// ============================================================
{
  for (const p of e.PRESETS) {
    const ph = e.phenotype(p.g);
    ok(`preset ${p.name} resolves`, !!ph);
  }
  const tortie = e.PRESETS.find((p) => p.name.startsWith("Patches"));
  eq("Patches is tortie", e.phenotype(tortie.g).tortie, true);
  eq("Patches is female", e.phenotype(tortie.g).sex, "F");
  const snowball = e.PRESETS.find((p) => p.name.startsWith("Snowball"));
  eq("Snowball all-white", e.phenotype(snowball.g).white, "full");
  const marm = e.PRESETS.find((p) => p.name.startsWith("Marmalade"));
  eq("Marmalade is orange", e.orangeState(marm.g), "orange");
}

// ============================================================
// 12. Orange male can never produce orange sons (he gives them Y)
// ============================================================
{
  const dad = geno("M", ["O"], ["B", "B"], ["A", "A"], ["D", "D"], ["s", "s"], ["w", "w"], ["L", "L"]);
  const mom = geno("F", ["o", "o"], ["B", "B"], ["A", "A"], ["D", "D"], ["s", "s"], ["w", "w"], ["L", "L"]);
  const kittens = e.litter(mom, dad, 2000, e.mulberry32(99));
  const orangeSons = kittens.filter((k) => k.sex === "M" && e.orangeState(k) === "orange").length;
  ok("orange father → 0 orange sons", orangeSons === 0, `${orangeSons} orange sons`);
}

// ============================================================
// 13. Sex ratio ~ 50/50
// ============================================================
{
  const mom = geno("F", ["o", "o"], ["B", "B"], ["A", "A"], ["D", "D"], ["s", "s"], ["w", "w"], ["L", "L"]);
  const dad = geno("M", ["o"], ["B", "B"], ["A", "A"], ["D", "D"], ["s", "s"], ["w", "w"], ["L", "L"]);
  const kittens = e.litter(mom, dad, 4000, e.mulberry32(2024));
  const f = kittens.filter((k) => k.sex === "F").length;
  ok("sex ratio ~50/50", Math.abs(f / 4000 - 0.5) < 0.06, `${(f / 4000).toFixed(3)}`);
}

console.log(`\n${pass} passed, ${fail} failed.`);
process.exit(fail ? 1 : 0);
