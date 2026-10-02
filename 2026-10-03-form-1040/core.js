/* Pure tax engines for the 1913 Revenue Act and tax year 2026.
   No DOM access here: both the app and the node tests import this file. */

(function (global) {
  "use strict";

  // Revenue Act of 1913, sec. II, para. A: 1% "normal tax" above an exemption,
  // plus a graduated "additional tax" (surtax) on net income over $20,000.
  // Quirk kept on purpose: the exemption reduces only the normal tax; the
  // surtax thresholds apply to full net income.
  const TAX_1913 = {
    label: 1913,
    normalRate: 0.01,
    exemption: { single: 3000, married: 4000 },
    surtaxStart: 20000,
    surtax: [
      { from: 20000, to: 50000, rate: 0.01 },
      { from: 50000, to: 75000, rate: 0.02 },
      { from: 75000, to: 100000, rate: 0.03 },
      { from: 100000, to: 250000, rate: 0.04 },
      { from: 250000, to: 500000, rate: 0.05 },
      { from: 500000, to: Infinity, rate: 0.06 },
    ],
  };

  // Tax year 2026 (Rev. Proc. 2025-32): standard deduction replaces the
  // exemption; one bracket schedule per filing status; the deduction applies
  // to the whole schedule, unlike 1913's surtax carve-out.
  const TAX_2026 = {
    label: 2026,
    deduction: { single: 16100, married: 32200 },
    brackets: {
      single: [
        { from: 0, to: 12400, rate: 0.10 },
        { from: 12400, to: 50400, rate: 0.12 },
        { from: 50400, to: 105700, rate: 0.22 },
        { from: 105700, to: 201775, rate: 0.24 },
        { from: 201775, to: 256225, rate: 0.32 },
        { from: 256225, to: 640600, rate: 0.35 },
        { from: 640600, to: Infinity, rate: 0.37 },
      ],
      married: [
        { from: 0, to: 24800, rate: 0.10 },
        { from: 24800, to: 100800, rate: 0.12 },
        { from: 100800, to: 211400, rate: 0.22 },
        { from: 211400, to: 403550, rate: 0.24 },
        { from: 403550, to: 512450, rate: 0.32 },
        { from: 512450, to: 768700, rate: 0.35 },
        { from: 768700, to: Infinity, rate: 0.37 },
      ],
    },
  };

  // Average CPI factor, 1913 -> 2026. Approximate on purpose; NOTES.md says so.
  const CPI_FACTOR = 33;

  function sliceTax(brackets, base, income) {
    // Tax on `income - base` spread over `brackets`, which are already
    // expressed in full-income terms (base shifts the zero point).
    const rows = brackets.map(function (b) {
      const from = Math.max(b.from, base);
      const to = b.to;
      const portion = Math.max(0, Math.min(income, to) - from);
      return { from: b.from, to: b.to, rate: b.rate, portion, tax: portion * b.rate };
    });
    const total = rows.reduce(function (sum, r) { return sum + r.tax; }, 0);
    return { rows, total };
  }

  function marginalAt(brackets, base, income) {
    // Rate on the next dollar (the right derivative): the band containing
    // income + epsilon. At exactly $50,000 the next dollar is already in the
    // over-$50,000 band, even though that band's portion is still $0.00.
    for (var i = brackets.length - 1; i >= 0; i--) {
      if (income >= brackets[i].from) return brackets[i].rate;
    }
    return brackets.length ? 0 : 0;
  }

  function compute1913(income, married) {
    const status = married ? "married" : "single";
    const exemption = TAX_1913.exemption[status];
    const normalBase = Math.max(0, income - exemption);
    const normalTax = normalBase * TAX_1913.normalRate;
    // Surtax: thresholds on full net income, exemption ignored.
    const surtax = sliceTax(TAX_1913.surtax, 0, income);
    const total = normalTax + surtax.total;
    const surtaxMarginal = income >= TAX_1913.surtaxStart
      ? marginalAt(TAX_1913.surtax, 0, income) : 0;
    return {
      income, married, exemption,
      normalBase, normalTax,
      surtaxRows: surtax.rows,
      surtaxTotal: surtax.total,
      total,
      marginal: income > exemption ? TAX_1913.normalRate + surtaxMarginal : 0,
      effective: income > 0 ? total / income : 0,
    };
  }

  function compute2026(income, married) {
    const status = married ? "married" : "single";
    const deduction = TAX_2026.deduction[status];
    const taxable = Math.max(0, income - deduction);
    const result = sliceTax(TAX_2026.brackets[status], 0, taxable);
    return {
      income, married, deduction, taxable,
      rows: result.rows, total: result.total,
      marginal: taxable > 0 ? marginalAt(TAX_2026.brackets[status], 0, taxable) : 0,
      effective: income > 0 ? result.total / income : 0,
    };
  }

  // Cube-root warp shared by the slider and the charts: $0 -> 0, $1M -> 1,
  // so $3,000 sits 14% along the track instead of 0.3%.
  const MAX_INCOME = 1000000;
  function warp(income) { return Math.cbrt(Math.max(0, income) / MAX_INCOME); }
  function unwarp(u) { return Math.round(MAX_INCOME * Math.pow(Math.min(1, Math.max(0, u)), 3) / 100) * 100; }

  const engine = {
    TAX_1913, TAX_2026, CPI_FACTOR, MAX_INCOME,
    compute1913, compute2026, warp, unwarp,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = engine;
  global.taxEngine = engine;
})(typeof window !== "undefined" ? window : globalThis);
