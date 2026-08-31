// test_materials.mjs — node --test test_materials.mjs
// Validates the Montessori math-shelf engine: the exchange algebra (value
// invariance under arbitrary bank trades, checked with BigInt), the
// canonicalize / dynamic-addition carry algorithm (against BigInt addition
// over a fuzz sweep), the exchange script bookkeeping, Nicomachus's theorem
// in the pink tower and its L-gnomon proof plate, the binomial and trinomial
// cube inventories ((a+b)³ in 8 pieces, (a+b+c)³ in 27), the cross-material
// identity that both algebra boxes equal the biggest pink-tower cube, and
// the preset ledger.

import test from "node:test";
import assert from "node:assert/strict";

import {
  CATS, zeroCounts, valueOf, bigintValueOf, exchangeDown, canonicalize, isCanonical,
  addCounts, dynamicAddLedger, exchangeScript,
  triangular, sumCubes, sumCubesNaive, pinkTower, gnomonAreas,
  BINOMIAL, TRINOMIAL, binomialPieces, trinomialPieces,
  PRESETS, TIMELINE,
} from "./materials.js";

// deterministic LCG so a failing fuzz can be replayed
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

test("exchange algebra: 10-of-a-kind ⇄ 1-of-the-next is value-neutral (BigInt)", () => {
  const rng = makeRng(20260831);
  for (let trial = 0; trial < 200; trial += 1) {
    let counts = zeroCounts();
    counts.unit = Math.floor(rng() * 19999); // a merged pile, unexchanged
    const v0 = bigintValueOf(counts);
    for (let hop = 0; hop < 1000; hop += 1) {
      const idx = Math.floor(rng() * (CATS.length - 1));
      const { counts: next, ok } = exchangeDown(counts, idx);
      assert.equal(bigintValueOf(ok ? next : counts), v0, "value drifted under exchange");
      if (ok) counts = next;
    }
    assert.equal(valueOf(counts), Number(v0), "float and BigInt values disagree");
  }
});

test("canonicalize preserves value and lands every digit under 10", () => {
  const rng = makeRng(311870);
  for (let trial = 0; trial < 500; trial += 1) {
    const counts = zeroCounts();
    counts.unit = Math.floor(rng() * 19999);
    const canonical = canonicalize(counts);
    assert.equal(bigintValueOf(canonical), bigintValueOf(counts));
    assert.ok(isCanonical(canonical));
    // canonical form of a value ≤ 19999 has at most one ten-thousand
    assert.ok(canonical.tenK <= 1);
  }
  assert.equal(valueOf(canonicalize({ unit: 15, ten: 0, hundred: 0, thousand: 0, tenK: 0 })), 15);
  assert.deepEqual(canonicalize({ unit: 15, ten: 0, hundred: 0, thousand: 0, tenK: 0 }),
    { unit: 5, ten: 1, hundred: 0, thousand: 0, tenK: 0 });
});

test("dynamic addition ledger matches BigInt addition and counts its carries", () => {
  // 3567 + 2795 = 6362 with three carries (units, tens, hundreds)
  const casa = dynamicAddLedger(3567, 2795);
  assert.equal(casa.result, 6362);
  assert.equal(casa.carryCount, 3);
  // 9999 + 1 = 10000: four carries, overflowing into the ten-thousand column
  const cascade = dynamicAddLedger(9999, 1);
  assert.equal(cascade.result, 10000);
  assert.equal(cascade.carryCount, 4);
  const top = cascade.cols[cascade.cols.length - 1];
  assert.equal(top.digit, 1); // one ten-thousand
  // static addition: no carries at all
  assert.equal(dynamicAddLedger(2345, 1234).carryCount, 0);
  assert.equal(dynamicAddLedger(2345, 1234).result, 3579);
  // the first exchange lesson: 8 + 7 = 15
  assert.deepEqual(dynamicAddLedger(8, 7).cols[0], {
    idx: 0, cat: "unit", label: "个", color: CATS[0].color,
    a: 8, b: 7, carryIn: 0, sum: 15, digit: 5, carryOut: 1 });
  // fuzz against BigInt
  const rng = makeRng(1907);
  for (let trial = 0; trial < 500; trial += 1) {
    const a = Math.floor(rng() * 10000);
    const b = Math.floor(rng() * 10000);
    const led = dynamicAddLedger(a, b);
    assert.equal(led.result, a + b);
    assert.equal(BigInt(led.result), BigInt(a) + BigInt(b));
    // digits rebuilt from the ledger columns reproduce the number
    const rebuilt = led.cols.reduce((s, c) => s + c.digit * CATS[c.idx].value, 0);
    assert.equal(rebuilt, a + b);
    // reference carry count
    let refCarries = 0, carry = 0;
    for (let i = 0; i < CATS.length; i += 1) {
      const s = Math.floor(a / CATS[i].value) % 10 + Math.floor(b / CATS[i].value) % 10 + carry;
      if (s >= 10) refCarries += 1;
      carry = s >= 10 ? 1 : 0;
    }
    assert.equal(led.carryCount, refCarries, `carry mismatch for ${a}+${b}`);
  }
});

test("combine → exchange script → canonical answer, end to end", () => {
  const a = { unit: 7, ten: 6, hundred: 5, thousand: 3, tenK: 0 };   // 3567
  const b = { unit: 5, ten: 9, hundred: 7, thousand: 2, tenK: 0 };   // 2795
  const merged = addCounts(a, b);
  assert.equal(valueOf(merged), 3567 + 2795);
  const { steps, final } = exchangeScript(merged);
  assert.ok(steps.length >= 3);
  assert.ok(steps.every((s) => s.valueBefore === s.valueAfter));
  assert.deepEqual(final, { unit: 2, ten: 6, hundred: 3, thousand: 6, tenK: 0 });
  assert.equal(valueOf(final), 6362);
  // the cascade: every category trades up, and a ten-thousand appears
  const nine = { unit: 9, ten: 9, hundred: 9, thousand: 9, tenK: 0 };
  const one = { unit: 1, ten: 0, hundred: 0, thousand: 0, tenK: 0 };
  const casc = exchangeScript(addCounts(nine, one));
  assert.equal(casc.steps.length, 4);
  assert.equal(casc.final.tenK, 1);
  assert.equal(valueOf(casc.final), 10000);
});

test("Nicomachus in the pink tower: Σn³ = T² = 55² = 3025 cm³", () => {
  const tower = pinkTower();
  assert.equal(tower.cubes.length, 10);
  assert.equal(tower.cubes[0].volumeCm3, 1);
  assert.equal(tower.cubes[9].volumeCm3, 1000);
  assert.equal(tower.totalCm3, 3025);
  assert.equal(tower.T, 55);
  assert.equal(tower.T2, 3025);
  assert.equal(sumCubesNaive(10), sumCubes(10));
  assert.equal(sumCubes(10), 55 * 55);
  // the prefix identity holds for every n, not just ten
  for (let n = 1; n <= 40; n += 1) assert.equal(sumCubesNaive(n), triangular(n) ** 2);
  // 55 is exactly the number rods' total length in cm units (1+2+…+10)
  let rodSum = 0;
  for (let n = 1; n <= 10; n += 1) rodSum += n;
  assert.equal(rodSum, tower.T);
});

test("the proof plate: gnomon n of the 55×55 square has area exactly n³", () => {
  const gnomons = gnomonAreas(10);
  assert.equal(gnomons.length, 10);
  for (const g of gnomons) assert.equal(g.area, g.n ** 3);
  // the gnomons tile the square: their areas sum to 55² = 3025
  assert.equal(gnomons.reduce((s, g) => s + g.area, 0), 55 * 55);
  assert.equal(gnomons[0].area, 1);
  assert.equal(gnomons[9].area, 1000); // the outermost ring alone is 10³
});

test("binomial cube: 8 pieces fill (a+b)³ exactly", () => {
  const box = binomialPieces(); // a=6, b=4
  assert.equal(box.pieceCount, 8);
  const byTerm = Object.fromEntries(box.inventory.map((r) => [r.term, r.count]));
  assert.deepEqual(byTerm, { "a³": 1, "a²b": 3, "ab²": 3, "b³": 1 });
  assert.equal(box.volume, 6 ** 3 + 3 * 36 * 4 + 3 * 6 * 16 + 4 ** 3);
  assert.equal(box.volume, box.boxVolume);
  assert.equal(box.boxVolume, 1000); // the box is 10 cm on a side
  // every piece is a real box and the pieces' volumes sum to the box
  assert.equal(box.pieces.reduce((s, p) => s + p.volume, 0), box.boxVolume);
  assert.ok(box.pieces.every((p) => p.dx === 6 || p.dx === 4));
  // and it generalizes
  assert.equal(binomialPieces(7, 5).volume, 12 ** 3);
  assert.equal(binomialPieces(1, 1).pieceCount, 8);
});

test("trinomial cube: 27 pieces fill (a+b+c)³ exactly", () => {
  const box = trinomialPieces(); // a=5, b=3, c=2
  assert.equal(box.pieceCount, 27);
  assert.equal(box.volume, box.boxVolume);
  assert.equal(box.boxVolume, 1000); // 5+3+2 = 10 cm box
  const byTerm = Object.fromEntries(box.inventory.map((r) => [r.term, r.count]));
  assert.equal(byTerm["a³"] + byTerm["b³"] + byTerm["c³"], 3);        // three cubes
  assert.equal(byTerm["abc"], 6);                                     // six corner blocks
  const prisms = box.inventory.filter((r) => r.term.length === 3 && r.term !== "abc")
    .reduce((s, r) => s + r.count, 0);
  assert.equal(prisms, 18);                                           // eighteen prisms
  assert.equal(3 + 6 + 18, 27);
  assert.equal(box.volume, 125 + 27 + 8 + 3 * (75 + 50 + 45 + 18 + 20 + 12) + 6 * 30);
  assert.equal(binomialPieces(4, 3).volume, 343);
});

test("cross-material ledger: both algebra boxes equal the biggest pink cube", () => {
  const tower = pinkTower();
  const biggest = tower.cubes[9].volumeCm3;
  assert.equal(binomialPieces().volume, biggest);
  assert.equal(trinomialPieces().volume, biggest);
  assert.equal(BINOMIAL.a + BINOMIAL.b, 10);
  assert.equal(TRINOMIAL.a + TRINOMIAL.b + TRINOMIAL.c, 10);
});

test("shelf ledger: presets and timeline are sane", () => {
  assert.equal(PRESETS.length, 5);
  for (const p of PRESETS) {
    assert.ok(Number.isInteger(p.a) && p.a >= 0 && p.a <= 9999);
    assert.ok(Number.isInteger(p.b) && p.b >= 0 && p.b <= 9999);
    assert.equal(dynamicAddLedger(p.a, p.b).result, p.a + p.b);
  }
  assert.equal(PRESETS[1].a + PRESETS[1].b, 10000);
  assert.equal(dynamicAddLedger(PRESETS[0].a, PRESETS[0].b).carryCount, 3);
  const years = TIMELINE.map((t) => t.year);
  assert.equal(years[0], "1870");
  assert.ok(TIMELINE.some((t) => t.year === "1907"));
  assert.ok(TIMELINE.some((t) => t.year.includes("1949"))); // three Nobel nominations
});
