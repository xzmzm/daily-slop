/* Form 1040 (1913) — live return, bracket staircase, and today comparison. */

(function () {
  "use strict";

  var E = window.taxEngine;
  var state = { income: 23000, married: false, job: "engineer" };

  // Band colors: 0% (exempt) then one per combined marginal rate 1%..7%.
  var BAND_COLORS = ["#e6dbb9", "#c9d7ea", "#a8c0de", "#87a8d2", "#6690c6", "#4578ba", "#2f5f9e", "#1d4680"];

  function $(id) { return document.getElementById(id); }

  function fmt(n, cents) {
    return "$" + n.toLocaleString("en-US", {
      minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0
    });
  }
  function fmtK(n) { return n >= 1000 ? "$" + (n / 1000) + "k" : "$" + n; }

  // Full band map of the 1913 combined schedule for one filing status.
  function bands1913(married) {
    var exemption = E.TAX_1913.exemption[married ? "married" : "single"];
    var bands = [
      { from: 0, to: exemption, rate: 0, kind: "exempt" },
      { from: exemption, to: E.TAX_1913.surtaxStart, rate: E.TAX_1913.normalRate }
    ];
    E.TAX_1913.surtax.forEach(function (b) {
      bands.push({ from: b.from, to: b.to, rate: b.rate + E.TAX_1913.normalRate });
    });
    return bands;
  }

  /* ---------- staircase ---------- */

  var SX = 640, SY = 210, PAD_L = 34, PAD_R = 14, PAD_T = 14, BASE = 184, TOP = 22;
  function px(income) { return PAD_L + E.warp(income) * (SX - PAD_L - PAD_R); }
  function py(rate) { return BASE - (rate / 0.07) * (BASE - TOP); }

  function staircase(result) {
    var bands = bands1913(state.married);
    var income = result.income;

    // Corner points of the marginal staircase (x in dollars, r marginal rate).
    var pts = [];
    bands.forEach(function (b, i) {
      var prev = i ? bands[i - 1].rate : 0;
      if (b.rate !== prev) pts.push([b.from, prev], [b.from, b.rate]);
      else if (i === 0) pts.push([b.from, b.rate]);
      if (b.to !== Infinity) pts.push([b.to, b.rate]);
    });

    pts.push([E.MAX_INCOME, bands[bands.length - 1].rate]);
    var path = "M" + pts.map(function (p) { return px(p[0]).toFixed(1) + "," + py(p[1]).toFixed(1); }).join("L");

    // Fill under the curve up to `income`.
    var areaPts = [];
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      if (p[0] <= income) areaPts.push(p);
      else if (i && pts[i - 1][0] < income && pts[i - 1][1] === p[1]) {
        areaPts.push([income, p[1]]); break;
      } else if (pts[i - 1] && pts[i - 1][0] <= income && pts[i - 1][1] !== p[1] && p[0] > income) {
        areaPts.push([income, pts[i - 1][1]]); break;
      }
    }
    if (areaPts.length < 2) areaPts = [];
    var area = areaPts.length
      ? "M" + px(areaPts[0][0]).toFixed(1) + "," + BASE + "L" +
        areaPts.map(function (q) { return px(q[0]).toFixed(1) + "," + py(q[1]).toFixed(1); }).join("L") +
        "L" + px(areaPts[areaPts.length - 1][0]).toFixed(1) + "," + BASE + "Z"
      : "";

    var exemption = result.exemption;
    var parts = [];
    parts.push('<defs><pattern id="hatch" width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">' +
      '<line x1="0" y1="0" x2="0" y2="7" stroke="#c8bb95" stroke-width="2.2"/></pattern></defs>');

    for (var g = 0; g <= 7; g++) {
      parts.push('<text class="rate-label" x="' + (PAD_L - 7) + '" y="' + (py(g / 100) + 3.5) + '" text-anchor="end">' + g + "%</text>");
      if (g) parts.push('<line class="grid-line" x1="' + PAD_L + '" y1="' + py(g / 100) + '" x2="' + (SX - PAD_R) + '" y2="' + py(g / 100) + '"/>');
    }

    // Exempt band along the baseline, plus its label.
    parts.push('<rect class="exempt-zone" x="' + PAD_L + '" y="' + (BASE - 16) + '" width="' + (px(exemption) - PAD_L) + '" height="16"/>');
    parts.push('<text class="exempt-label" x="' + (PAD_L + 3) + '" y="' + (BASE - 23) + '">exempt</text>');

    // Threshold ticks + labels.
    var thresholds = [exemption, 20000, 50000, 75000, 100000, 250000, 500000];
    thresholds.forEach(function (t) {
      var x = px(t);
      var label = t === exemption ? fmtK(t) : (t / 1000) + "k";
      parts.push('<line class="grid-line" x1="' + x + '" y1="' + BASE + '" x2="' + x + '" y2="' + (BASE + 4) + '"/>');
      parts.push('<text class="threshold-label" x="' + (x + 3) + '" y="' + (BASE + 15) + '" transform="rotate(38 ' + (x + 3) + " " + (BASE + 15) + ')">' + label + "</text>");
    });
    parts.push('<line x1="' + PAD_L + '" y1="' + BASE + '" x2="' + (SX - PAD_R) + '" y2="' + BASE + '" stroke="#6d6350" stroke-width="1.5"/>');

    if (area) parts.push('<path class="area" d="' + area + '"/>');
    parts.push('<path class="step-line" d="' + path + '"/>');

    if (income > 0) {
      var cx = Math.max(PAD_L, px(income)), cy = py(result.marginal);
      parts.push('<line class="income-line" x1="' + cx + '" y1="' + cy + '" x2="' + cx + '" y2="' + BASE + '"/>');
      var flagX = cx > SX - 130 ? cx - 12 : cx + 14;
      parts.push('<g class="flag"><text x="' + flagX + '" y="' + (cy - 9) + '" text-anchor="' + (cx > SX - 130 ? "end" : "start") + '">' +
        (result.marginal * 100).toFixed(0) + "¢ on the next $</text></g>");
      parts.push('<g class="coin"><circle cx="' + cx + '" cy="' + cy + '" r="12"/><text x="' + cx + '" y="' + (cy + 4.5) + '">$</text></g>');
    }
    return parts.join("");
  }

  /* ---------- sliced income bar ---------- */

  function incomeBar(result) {
    var bands = bands1913(state.married);
    var html = "";
    bands.forEach(function (b) {
      var portion = Math.max(0, Math.min(result.income, b.to) - b.from);
      if (portion <= 0) return;
      var width = ((E.warp(Math.min(result.income, b.to)) - E.warp(b.from)) * 100).toFixed(2);
      var color = BAND_COLORS[Math.round(b.rate * 100)];
      var tooltip = b.rate === 0
        ? fmt(portion) + " exempt — the first " + fmt(b.to, true) + " is not taxed"
        : fmt(portion) + " here, taxed " + (b.rate * 100).toFixed(0) + "¢ on the dollar = " + fmt(portion * b.rate, true);
      html += '<div class="seg ' + (b.rate === 0 ? "exempt" : "") + '" style="width:' + width + '%;background:' +
        (b.rate === 0 ? "" : color) + '" title="' + tooltip + '">' +
        (width > 7 ? "<span>" + (b.rate === 0 ? "0¢" : (b.rate * 100).toFixed(0) + "¢") + "</span>" : "") + "</div>";
    });
    if (result.income < E.MAX_INCOME && result.income > 0) {
      html += '<div class="bar-rest" title="Scale continues to $1,000,000">→ $1M scale</div>';
    }
    return html || '<div class="bar-rest">no income yet — try a persona</div>';
  }

  /* ---------- who-pays grid ---------- */

  function whoGrid(result) {
    var paying = result.income > result.exemption;
    var houses = [];
    for (var i = 0; i < 100; i++) {
      var col = i % 10, row = Math.floor(i / 10);
      var lit = paying && i < 2;
      houses.push('<path class="' + (lit ? "house-lit" : "house-off") + '" d="M' + (col * 13 + 1.5) + " " + (row * 10.5 + 7.5) +
        "l4.5 -4.5 4.5 4.5 v4 h-9 z\"/>");
    }
    $("who-grid").innerHTML =
      '<svg viewBox="0 0 132 108" role="img" aria-label="two of one hundred houses lit">' + houses.join("") + "</svg>";
    $("who-sub").textContent = paying
      ? "In all of 1913 America, roughly 2 households in 100 paid any income tax. At this income, you are one of them."
      : "Roughly 2 households in 100 owed any 1913 income tax. At this income you owe nothing — the form never reaches you.";
  }

  /* ---------- the form ---------- */

  function surtaxRows(result) {
    var body = "";
    result.surtaxRows.forEach(function (r) {
      var bandLabel = r.to === Infinity
        ? "over $500,000"
        : "over " + fmt(r.from, false) + " to " + fmt(r.to, false);
      body += '<tr class="' + (r.portion > 0 ? "" : "is-zero") + '"><td>' + bandLabel + '</td><td>' +
        (r.rate * 100).toFixed(0) + '%</td><td class="pen">' + fmt(r.tax, true) + "</td></tr>";
    });
    $("surtax-table").querySelector("tbody").innerHTML = body;
  }

  function render() {
    var r = E.compute1913(state.income, state.married);

    $("f-occupation").textContent = state.job;
    $("f-gross").textContent = fmt(r.income, true);
    $("f-net").textContent = fmt(r.income, true);
    $("f-exemption").textContent = fmt(r.exemption, true);
    $("f-exemption-amt").textContent = fmt(r.exemption, false);
    $("f-normalbase").textContent = fmt(r.normalBase, true);
    $("f-normaltax").textContent = fmt(r.normalTax, true);
    surtaxRows(r);
    $("f-total").textContent = fmt(r.total, true);

    $("note-effective").textContent = r.total > 0
      ? "All told, " + fmt(r.total, false) + " of " + fmt(r.income, false) + " — " + (r.effective * 100).toFixed(1) + "¢ on every dollar earned."
      : "Below the " + fmt(r.exemption, false) + " line: no return owed, nothing enters lines 5 and 6.";
    $("note-marginal").textContent = r.marginal > 0
      ? "The next dollar you earn is taxed " + (r.marginal * 100).toFixed(0) + "¢; " + (100 - r.marginal * 100).toFixed(0) + "¢ of it stays yours."
      : "Your next dollar is still below the exemption — Washington sees none of it.";

    $("staircase").innerHTML = staircase(r);
    $("income-bar").innerHTML = incomeBar(r);
    $("bar-cap").textContent = "Your " + fmt(r.income, false) + " cut into bands — hatched head is exempt; each band taxes only the dollars inside it. Bar runs to $1M.";
    $("marginal-cents").textContent = (r.marginal * 100).toFixed(1);
    $("marginal-sub").textContent = r.marginal === 0
      ? "marginal rate — still inside the exemption, nothing accrues"
      : r.marginal > 0.0101
        ? "marginal rate — 1% normal + " + Math.round((r.marginal - 0.01) * 100) + "% additional"
        : "marginal rate — the 1% normal tax, and nothing more";
    $("effective-cents").textContent = (r.effective * 100).toFixed(1);
    $("effective-sub").textContent = "effective rate — " + fmt(r.total, false) + " tax on " + fmt(r.income, false) + " income";

    whoGrid(r);
    renderToday(r);

    document.querySelectorAll("#personas button").forEach(function (b) {
      b.classList.toggle("is-active", Number(b.dataset.income) === state.income);
    });
    document.querySelectorAll(".status-btn").forEach(function (b) {
      b.classList.toggle("is-active", (b.id === "status-married") === state.married);
    });
    if (document.activeElement !== $("income-input")) $("income-input").value = state.income;
    $("income-slider").value = Math.round(E.warp(state.income) * 1000);
  }

  /* ---------- 2026 comparison ---------- */

  function renderToday(r1913) {
    var today = E.compute2026(r1913.income * E.CPI_FACTOR, state.married);
    $("today-convert").textContent = fmt(r1913.income, false) + " in 1913 ≈ " +
      fmt(r1913.income * E.CPI_FACTOR, false) + " in 2026 dollars (CPI ×" + E.CPI_FACTOR + ")";
    $("today-1913-tax").textContent = fmt(r1913.total, false);
    $("today-1913-meta").textContent = (r1913.effective * 100).toFixed(1) + "¢ per dollar · next dollar " +
      (r1913.marginal * 100).toFixed(0) + "¢ · top rate 7%";
    $("today-2026-tax").textContent = fmt(today.total, false);
    $("today-2026-meta").textContent = (today.effective * 100).toFixed(1) + "¢ per dollar · next dollar " +
      (today.marginal * 100).toFixed(0) + "¢ · top rate 37%";
    $("bar-1913").style.width = Math.min(100, r1913.effective / 0.4 * 100).toFixed(1) + "%";
    $("bar-2026").style.width = Math.min(100, today.effective / 0.4 * 100).toFixed(1) + "%";
    $("today-note").textContent =
      "Same life, 113 years apart: the 1913 return takes " + (r1913.effective * 100).toFixed(1) +
      "¢ of every dollar and the 2026 return takes " + (today.effective * 100).toFixed(1) +
      "¢; the top bracket moved from 7% to 37%.";
  }

  /* ---------- wiring ---------- */

  function setIncome(value, job) {
    state.income = Math.max(0, Math.min(E.MAX_INCOME, Math.round(value)));
    if (job !== undefined) state.job = job;
    render();
  }

  $("income-slider").addEventListener("input", function () {
    state.income = E.unwarp(this.value / 1000);
    if (state.job && state.income !== lastPersonaIncome()) state.job = jobForIncome(state.income);
    render();
  });
  $("income-input").addEventListener("change", function () {
    setIncome(parseFloat(this.value) || 0);
  });
  $("personas").addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-income]");
    if (!btn) return;
    setIncome(Number(btn.dataset.income), btn.dataset.job);
  });
  $("status-single").addEventListener("click", function () { state.married = false; render(); });
  $("status-married").addEventListener("click", function () { state.married = true; render(); });
  $("today-toggle").addEventListener("click", function () {
    var body = $("today-body");
    var opening = body.hidden;
    body.hidden = !opening;
    this.textContent = opening ? "Run the same life in 2026 ▴" : "Run the same life in 2026 ▾";
  });

  function lastPersonaIncome() {
    var active = document.querySelector("#personas button.is-active");
    return active ? Number(active.dataset.income) : -1;
  }
  function jobForIncome(income) {
    if (income <= 700) return "laborer";
    if (income <= 1500) return "shipping clerk";
    if (income <= 6000) return "engineer";
    if (income <= 60000) return "bank president";
    return "oil magnate";
  }

  // Small API for the browser tests and the video recording.
  window.form1040 = {
    set: function (opts) {
      if (opts && typeof opts.income === "number") setIncome(opts.income, opts.job);
      if (opts && "married" in opts) { state.married = !!opts.married; }
      render();
    },
    state: function () {
      return {
        income: state.income, married: state.married, job: state.job,
        todayOpen: !$("today-body").hidden,
        total: E.compute1913(state.income, state.married).total
      };
    },
    toggleToday: function (open) {
      var hidden = $("today-body").hidden;
      if ((open === true && hidden) || (open === false && !hidden) || open === undefined) {
        $("today-toggle").click();
      }
    }
  };

  render();
})();
