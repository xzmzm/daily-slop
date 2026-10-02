/* Node checks for the 1913 / 2026 tax engines. Run: node test.cjs */
const assert = require("assert");
const engine = require("./core.js");
const { compute1913, compute2026, warp, unwarp, TAX_1913 } = engine;

function approx(actual, expected, eps) {
  assert.ok(Math.abs(actual - expected) <= (eps || 0.005), `${actual} != ${expected}`);
}

// --- 1913: the exemption gate ---
let r = compute1913(580, false);
approx(r.total, 0); approx(r.marginal, 0); approx(r.effective, 0);

r = compute1913(3000, false);            // exactly at the single exemption
approx(r.total, 0); approx(r.marginal, 0);

r = compute1913(4000, false);            // $1,000 over the line
approx(r.normalTax, 10); approx(r.surtaxTotal, 0); approx(r.total, 10);
approx(r.marginal, 0.01); approx(r.effective, 0.0025);

// --- 1913: the canonical $23,000 single filer ---
r = compute1913(23000, false);
approx(r.normalBase, 20000); approx(r.normalTax, 200);
approx(r.surtaxTotal, 30);               // (23,000 - 20,000) x 1%
approx(r.total, 230);
approx(r.marginal, 0.02); approx(r.effective, 0.01);
assert.strictEqual(r.surtaxRows.filter(row => row.portion > 0).length, 1);

// Married quirk: the $4,000 exemption cuts only the normal tax.
r = compute1913(23000, true);
approx(r.normalTax, 190); approx(r.surtaxTotal, 30); approx(r.total, 220);

// --- 1913: bracket boundaries are on net income, not income-minus-exemption ---
r = compute1913(20000, false);
approx(r.surtaxTotal, 0); approx(r.marginal, 0.02);   // next dollar is over $20,000
r = compute1913(19999, false);
approx(r.marginal, 0.01);
r = compute1913(100000, false);
approx(r.surtaxTotal, 300 + 500 + 750);  // up to $100k: 1%+2%+3% bands
approx(r.marginal, 0.05);                // ...but the 100,001st dollar pays 4% additional
r = compute1913(100001, false);
approx(r.marginal, 0.05);

// --- 1913: the $1,000,000 oil magnate ---
r = compute1913(1000000, false);
approx(r.normalTax, 9970);
approx(r.surtaxTotal, 300 + 500 + 750 + 6000 + 12500 + 30000);  // 50,050
approx(r.total, 60020);
approx(r.marginal, 0.07);                // the famous top rate
approx(r.effective, 0.06002);            // marginal != effective

// --- 2026: spot checks against Rev. Proc. 2025-32 ---
r = compute2026(100000, false);
approx(r.taxable, 83900);
approx(r.total, 1240 + 4560 + 7370);     // 13,170
approx(r.marginal, 0.22);

r = compute2026(28500, false);           // taxable exactly 12,400: next dollar is 12%
approx(r.marginal, 0.12);

r = compute2026(100000, true);
approx(r.taxable, 67800);
approx(r.total, 2480 + 0.12 * (67800 - 24800));  // 10% then 12%: $7,640
approx(r.marginal, 0.12);

r = compute2026(15000, false);           // under the $16,100 standard deduction
approx(r.total, 0); approx(r.marginal, 0);

// --- the warp used by slider and charts ---
approx(warp(1000000), 1); approx(warp(0), 0);
assert.ok(warp(3000) > 0.13 && warp(3000) < 0.15);
approx(unwarp(warp(123456)), 123500, 60);

// --- schedule integrity: contiguous, rising surtax ---
TAX_1913.surtax.forEach((b, i) => {
  if (i) assert.strictEqual(b.from, TAX_1913.surtax[i - 1].to);
  assert.ok(b.rate > TAX_1913.surtax[i - 1]?.rate || i === 0);
});

console.log("core tests: all green");
