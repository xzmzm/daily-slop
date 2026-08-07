// app.js — cattery UI: breeds cats, renders each coat procedurally from its
// genotype, shows Punnett squares and expected-vs-actual Mendelian ratios.
//
// The genetics live in engine.js (pure, Node-tested). This file is the visual
// layer: how a phenotype becomes pixels.

(function () {
"use strict";

// ============ color palette ============
// pigment colors keyed by the engine's color names
const COLORS = {
  black: { base: "#2c2a28", dark: "#16140f", light: "#4a463f" },     // B_ D_
  blue: { base: "#8290ab", dark: "#5f6c87", light: "#a6b1c4" },       // B_ dd  (dilute black)
  chocolate: { base: "#5e3825", dark: "#3d2216", light: "#7a4d36" }, // bb D_
  lilac: { base: "#a99eb4", dark: "#847893", light: "#c2b8cc" },     // bb dd (dilute chocolate)
  orange: { base: "#e08538", dark: "#b5641e", light: "#f0a45c" },    // O D_
  cream: { base: "#e6c79c", dark: "#c9a474", light: "#f2dcbe" },     // O dd (dilute orange)
  white: { base: "#f4efe6", dark: "#d9d2c4", light: "#ffffff" },
};

function pigmentColor(name) { return COLORS[name] || COLORS.black; }

// ============ RNG ============
function hashStr(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

// ============ silhouette ============
// Trace the cat silhouette (front-facing, sitting) into the current ctx path,
// in the box [0,0]-[W,H]. Multiple subpaths: ears, head, body, paws, tail-base.
// Caller fills or clips.
function traceSilhouette(ctx, W, H) {
  const cx = W / 2;
  const sc = Math.min(W, H);

  // ---- ears (triangles) ----
  const earY = 0.20 * H, earTipY = 0.04 * H;
  const earInner = 0.41 * W, earOuter = 0.27 * W, earTipL = 0.31 * W, earTipR = 0.69 * W;
  const earBaseR = 0.59 * W;
  // left ear
  ctx.moveTo(earOuter, earY);
  ctx.lineTo(earTipL, earTipY);
  ctx.lineTo(earInner, 0.27 * H);
  ctx.closePath();
  // right ear
  ctx.moveTo(earBaseR, earY);
  ctx.lineTo(earTipR, earTipY);
  ctx.lineTo(W - earInner, 0.27 * H);
  ctx.closePath();

  // ---- head (circle) ----
  const headR = 0.175 * sc;
  const headCY = 0.35 * H;
  ctx.moveTo(cx + headR, headCY);
  ctx.arc(cx, headCY, headR, 0, Math.PI * 2);

  // ---- body (sitting wedge with haunches) ----
  // a guitar-pick / pear shape from shoulders to base
  const topY = 0.46 * H;
  const baseY = 0.93 * H;
  const baseHalf = 0.34 * W;
  const shoulderHalf = 0.205 * W;
  ctx.moveTo(cx - shoulderHalf, topY);
  // left side down and out
  ctx.bezierCurveTo(
    cx - shoulderHalf - 0.04 * W, 0.60 * H,
    cx - baseHalf - 0.02 * W, 0.78 * H,
    cx - baseHalf + 0.03 * W, baseY - 0.04 * H
  );
  // base with paw notches
  const pawY = baseY - 0.005 * H;
  const pawHalf = 0.075 * W;
  // left paw dip
  ctx.quadraticCurveTo(cx - baseHalf + 0.03 * W, baseY, cx - 0.13 * W, baseY);
  ctx.quadraticCurveTo(cx - 0.10 * W, pawY - 0.01 * H, cx - pawHalf, pawY - 0.01 * H);
  ctx.quadraticCurveTo(cx, pawY + 0.015 * H, cx + pawHalf, pawY - 0.01 * H);
  ctx.quadraticCurveTo(cx + 0.10 * W, pawY - 0.01 * H, cx + 0.13 * W, baseY);
  ctx.quadraticCurveTo(cx + baseHalf - 0.03 * W, baseY, cx + baseHalf - 0.03 * W, baseY - 0.04 * H);
  // right side up
  ctx.bezierCurveTo(
    cx + baseHalf + 0.02 * W, 0.78 * H,
    cx + shoulderHalf + 0.04 * W, 0.60 * H,
    cx + shoulderHalf, topY
  );
  // across shoulders (connect to head region) — slight inward
  ctx.quadraticCurveTo(cx, 0.43 * H, cx - shoulderHalf, topY);
  ctx.closePath();
}

// tail: drawn as a separate filled crescent curling around the right side
function traceTail(ctx, W, H) {
  const cx = W / 2;
  ctx.moveTo(cx + 0.30 * W, 0.72 * H);
  ctx.bezierCurveTo(
    cx + 0.46 * W, 0.66 * H,
    cx + 0.50 * W, 0.50 * H,
    cx + 0.40 * W, 0.42 * H
  );
  ctx.bezierCurveTo(
    cx + 0.34 * W, 0.38 * H,
    cx + 0.30 * W, 0.44 * H,
    cx + 0.34 * W, 0.50 * H
  );
  ctx.bezierCurveTo(
    cx + 0.40 * W, 0.58 * H,
    cx + 0.38 * W, 0.64 * H,
    cx + 0.28 * W, 0.66 * H
  );
  ctx.closePath();
}

// ============ the big renderer ============
// drawCat(ctx, W, H, geno, pheno, seedStr)
function drawCat(ctx, W, H, geno, ph, seedStr) {
  const rng = mulberry32(hashStr(seedStr));
  ctx.clearRect(0, 0, W, H);
  const cx = W / 2;

  // ---- 0. resolve coat regions ----
  // For a tortie, base = eumelanin, patches = orange (and vice-versa is fine).
  // pigments[] already has the colors; order them so darker is base.
  let baseP, patchP;
  if (ph.tortie) {
    // put eumelanin first as base
    const eu = ph.pigments.find((p) => p.kind === "eumelanin");
    const or = ph.pigments.find((p) => p.kind === "orange");
    baseP = eu || or; patchP = or;
  } else {
    baseP = ph.pigments[0];
  }
  const baseCol = ph.white === "full" ? COLORS.white : pigmentColor(baseP.name);

  // ---- draw the silhouette filled with base color (also used as clip) ----
  ctx.save();
  ctx.beginPath();
  traceSilhouette(ctx, W, H);
  traceTail(ctx, W, H);

  // base fill
  ctx.fillStyle = baseCol.base;
  ctx.fill();

  // clip to silhouette for all coat detail
  ctx.clip();

  // subtle body shading (volume): darker on edges
  const shade = ctx.createRadialGradient(cx, 0.55 * H, 0.08 * H, cx, 0.55 * H, 0.5 * H);
  shade.addColorStop(0, "rgba(255,255,255,0.10)");
  shade.addColorStop(0.6, "rgba(0,0,0,0)");
  shade.addColorStop(1, "rgba(0,0,0,0.28)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);

  // ---- 1. tortie patches (orange on black, or black on orange) ----
  if (ph.tortie && patchP) {
    const patchCol = pigmentColor(patchP.name);
    drawTortiePatches(ctx, W, H, rng, patchCol, baseCol);
  }

  // ---- 2. tabby stripes (on the colored regions) ----
  // skip if solid white. For tortie, stripes only where agouti (eumelanin) shows tabby.
  if (ph.tabby && ph.white !== "full") {
    drawTabby(ctx, W, H, ph, baseCol, patchP);
  }

  // ---- 3. white spotting (on top of color) ----
  if (ph.whiteSpot && ph.white !== "full") {
    drawWhiteSpotting(ctx, W, H, rng, ph.whiteSpot);
  }

  ctx.restore(); // release clip

  // ---- 4. outline (draw silhouette stroke on top) ----
  ctx.save();
  ctx.lineWidth = Math.max(1.2, 0.012 * Math.min(W, H));
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.lineJoin = "round";
  ctx.beginPath();
  traceSilhouette(ctx, W, H);
  traceTail(ctx, W, H);
  ctx.stroke();
  ctx.restore();

  // ---- 5. face details (eyes, nose, ears interior, whiskers) ----
  drawFace(ctx, W, H, rng, ph, geno);
}

// ---- tortie patches: organic blobs of patch color over base ----
function drawTortiePatches(ctx, W, H, rng, patchCol, baseCol) {
  const cx = W / 2;
  const nBlobs = 5 + Math.floor(rng() * 4); // 5-8 patches
  for (let i = 0; i < nBlobs; i++) {
    // patch centers biased to body and head regions
    const region = rng();
    let bx, by;
    if (region < 0.3) { // head
      bx = cx + (rng() - 0.5) * 0.30 * W;
      by = 0.30 * H + (rng() - 0.5) * 0.12 * H;
    } else { // body
      bx = cx + (rng() - 0.5) * 0.55 * W;
      by = 0.55 * H + (rng() - 0.5) * 0.35 * H;
    }
    const blobR = (0.035 + rng() * 0.04) * Math.min(W, H);
    const sub = 3 + Math.floor(rng() * 3); // 3-5 sub-circles per blob
    ctx.fillStyle = patchCol.base;
    for (let j = 0; j < sub; j++) {
      const ox = (rng() - 0.5) * blobR * 1.6;
      const oy = (rng() - 0.5) * blobR * 1.6;
      const r = blobR * (0.7 + rng() * 0.6);
      ctx.beginPath();
      ctx.arc(bx + ox, by + oy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ---- mackerel tabby stripes ----
function drawTabby(ctx, W, H, ph, baseCol, patchP) {
  const cx = W / 2;
  // stripe color: darker shade of whatever's underneath.
  // For tortie, stripes go over everything — approximate with a translucent dark.
  const stripeCol = ph.tortie
    ? "rgba(0,0,0,0.30)"
    : baseCol.dark;

  ctx.strokeStyle = stripeCol;
  ctx.lineWidth = Math.max(1.5, 0.018 * Math.min(W, H));
  ctx.lineCap = "round";

  // body vertical stripes
  const nBody = 5;
  for (let i = 0; i < nBody; i++) {
    const x = cx + (i - (nBody - 1) / 2) * 0.07 * W;
    ctx.beginPath();
    ctx.moveTo(x - 0.01 * W, 0.50 * H);
    ctx.bezierCurveTo(x - 0.02 * W, 0.62 * H, x + 0.02 * W, 0.78 * H, x, 0.88 * H);
    ctx.stroke();
  }
  // a couple on the shoulders
  for (let i = 0; i < 2; i++) {
    const x = cx + (i === 0 ? -1 : 1) * 0.10 * W;
    ctx.beginPath();
    ctx.moveTo(x, 0.50 * H);
    ctx.lineTo(x + (i === 0 ? -0.01 : 0.01) * W, 0.60 * H);
    ctx.stroke();
  }

  // forehead "M" marking
  const fy = 0.28 * H;
  ctx.lineWidth = Math.max(1.2, 0.014 * Math.min(W, H));
  ctx.beginPath();
  ctx.moveTo(cx - 0.05 * W, fy);
  ctx.lineTo(cx - 0.02 * W, fy + 0.03 * H);
  ctx.lineTo(cx, fy + 0.012 * H);
  ctx.lineTo(cx + 0.02 * W, fy + 0.03 * H);
  ctx.lineTo(cx + 0.05 * W, fy);
  ctx.stroke();

  // cheek stripes
  ctx.lineWidth = Math.max(1, 0.011 * Math.min(W, H));
  for (let i = 0; i < 2; i++) {
    const y = 0.36 * H + i * 0.018 * H;
    ctx.beginPath();
    ctx.moveTo(cx - 0.14 * W, y);
    ctx.lineTo(cx - 0.07 * W, y + 0.004 * H);
    ctx.moveTo(cx + 0.07 * W, y + 0.004 * H);
    ctx.lineTo(cx + 0.14 * W, y);
    ctx.stroke();
  }
}

// ---- white spotting ----
function drawWhiteSpotting(ctx, W, H, rng, level) {
  const cx = W / 2;
  const white = COLORS.white.base;

  if (level === "high") {
    // van: white everywhere except a colored cap on head + tail
    // fill nearly all with white, leaving head top + tail
    ctx.fillStyle = white;
    ctx.fillRect(0, 0, W, H);
    // restore color on lower head band & a couple body patches kept — actually
    // van keeps color ONLY on head crown and tail. Re-patch nothing; the base
    // was already laid, so cover everything, then we lose color. Instead, draw
    // white as big blobs leaving head crown + tail.
    // Redo: we already overwrote. To keep it simple, "high" = white body with
    // small colored head — approximate by leaving a colored crown: redraw not
    // needed; just ensure muzzle/face still gets details later.
    return;
  }

  // bicolor: muzzle/chin, blaze, chest, belly, paws
  ctx.fillStyle = white;
  // face blaze + muzzle (lower face white)
  ctx.beginPath();
  ctx.ellipse(cx, 0.42 * H, 0.10 * W, 0.07 * H, 0, 0, Math.PI * 2);
  ctx.fill();
  // chin/muzzle
  ctx.beginPath();
  ctx.ellipse(cx, 0.44 * H, 0.07 * W, 0.045 * H, 0, 0, Math.PI * 2);
  ctx.fill();
  // central forehead blaze (thin stripe up from muzzle)
  ctx.fillRect(cx - 0.012 * W, 0.26 * H, 0.024 * W, 0.12 * H);

  // chest patch
  ctx.beginPath();
  ctx.ellipse(cx, 0.56 * H, 0.10 * W, 0.06 * H, 0, 0, Math.PI * 2);
  ctx.fill();
  // belly
  ctx.beginPath();
  ctx.ellipse(cx, 0.72 * H, 0.13 * W, 0.10 * H, 0, 0, Math.PI * 2);
  ctx.fill();

  // paws (front) — white socks
  ctx.fillRect(cx - 0.12 * W, 0.84 * H, 0.07 * W, 0.10 * H);
  ctx.fillRect(cx + 0.05 * W, 0.84 * H, 0.07 * W, 0.10 * H);
}

// ---- face: eyes, nose, ears, whiskers ----
function drawFace(ctx, W, H, rng, ph, geno) {
  const cx = W / 2;
  const eyeY = 0.345 * H;
  const eyeDX = 0.062 * W;
  const eyeR = 0.022 * Math.min(W, H);

  // ear interiors (pink triangles)
  ctx.fillStyle = "rgba(218,150,150,0.55)";
  [[0.345, 0.155, 0.40, 0.255], [0.655, 0.155, 0.60, 0.255]].forEach(([ax, ay, ix, iy]) => {
    ctx.beginPath();
    ctx.moveTo(ax * W + 0.02 * W, ay * H + 0.03 * H);
    ctx.lineTo(ix * W, iy * H);
    ctx.lineTo(ax * W - 0.01 * W, ay * H + 0.04 * H);
    ctx.closePath();
    ctx.fill();
  });

  // ---- eyes ----
  // blue if dominant white (W_); else green/copper/amber
  let iris;
  if (ph.white === "full") iris = "#8fc4e0"; // blue-eyed white
  else {
    const pick = rng();
    if (pick < 0.4) iris = "#7fb04a";       // green
    else if (pick < 0.75) iris = "#c8893a";  // copper/amber
    else iris = "#9ab84e";                   // yellow-green
  }

  [-1, 1].forEach((s) => {
    const ex = cx + s * eyeDX;
    // eye white / sclera ring (subtle)
    ctx.fillStyle = "#f2ead9";
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, eyeR, eyeR * 1.05, 0, 0, Math.PI * 2);
    ctx.fill();
    // iris
    ctx.fillStyle = iris;
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, eyeR * 0.88, eyeR * 1.0, 0, 0, Math.PI * 2);
    ctx.fill();
    // pupil — vertical slit (cats!)
    ctx.fillStyle = "#0a0a08";
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, eyeR * 0.22, eyeR * 0.92, 0, 0, Math.PI * 2);
    ctx.fill();
    // catchlight
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.arc(ex - eyeR * 0.25, eyeY - eyeR * 0.35, eyeR * 0.18, 0, Math.PI * 2);
    ctx.fill();
  });

  // ---- nose (pink triangle) ----
  const ny = 0.40 * H;
  ctx.fillStyle = "#d98a93";
  ctx.beginPath();
  ctx.moveTo(cx - 0.012 * W, ny);
  ctx.lineTo(cx + 0.012 * W, ny);
  ctx.lineTo(cx, ny + 0.014 * H);
  ctx.closePath();
  ctx.fill();
  // mouth line
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = Math.max(1, 0.008 * Math.min(W, H));
  ctx.beginPath();
  ctx.moveTo(cx, ny + 0.014 * H);
  ctx.lineTo(cx, ny + 0.024 * H);
  ctx.moveTo(cx, ny + 0.024 * H);
  ctx.quadraticCurveTo(cx - 0.012 * W, ny + 0.030 * H, cx - 0.018 * W, ny + 0.026 * H);
  ctx.moveTo(cx, ny + 0.024 * H);
  ctx.quadraticCurveTo(cx + 0.012 * W, ny + 0.030 * H, cx + 0.018 * W, ny + 0.026 * H);
  ctx.stroke();

  // ---- whiskers ----
  ctx.strokeStyle = "rgba(245,240,230,0.7)";
  ctx.lineWidth = Math.max(0.6, 0.005 * Math.min(W, H));
  const wy = 0.415 * H;
  for (let i = 0; i < 3; i++) {
    const yy = wy + (i - 1) * 0.012 * H;
    ctx.beginPath();
    ctx.moveTo(cx - 0.025 * W, yy);
    ctx.quadraticCurveTo(cx - 0.10 * W, yy + (i - 1) * 0.006 * H, cx - 0.16 * W, yy + (i - 1) * 0.010 * H);
    ctx.moveTo(cx + 0.025 * W, yy);
    ctx.quadraticCurveTo(cx + 0.10 * W, yy + (i - 1) * 0.006 * H, cx + 0.16 * W, yy + (i - 1) * 0.010 * H);
    ctx.stroke();
  }
}

// ============ app state ============
const state = {
  mom: null,
  dad: null,
  momName: "",
  dadName: "",
  litter: [],
};

// ============ render helpers ============
function renderParent(which, cat) {
  const canvas = document.getElementById(which + "-canvas");
  const ctx = canvas.getContext("2d");
  const ph = phenotype(cat);
  drawCat(ctx, canvas.width, canvas.height, cat, ph, which + "|" + describeGeno(cat));
  document.getElementById(which + "-name").textContent = state[which + "Name"] || "—";
  document.getElementById(which + "-pheno").textContent = describePheno(ph).short + " · " + (cat.sex === "F" ? "female" : "male");
  document.getElementById(which + "-geno").textContent = describeGeno(cat);
}

function renderLitter() {
  const grid = document.getElementById("litter-grid");
  grid.innerHTML = "";
  const hint = document.getElementById("litter-hint");
  if (state.litter.length === 0) {
    hint.textContent = "mate the parents to see kittens";
    return;
  }
  hint.textContent = `${state.litter.length} kittens from this cross`;

  state.litter.forEach((k, i) => {
    const ph = phenotype(k);
    const desc = describePheno(ph);
    const cell = document.createElement("div");
    cell.className = "kitten" + (ph.tortie ? " tortie" : "") + (desc.kind === "calico" ? " calico" : "");
    const cv = document.createElement("canvas");
    cv.width = 200; cv.height = 184;
    cell.appendChild(cv);
    const name = document.createElement("div");
    name.className = "k-name";
    name.innerHTML = `${desc.short}<span class="k-sex ${k.sex === "F" ? "f" : "m"}">${k.sex === "F" ? "♀" : "♂"}</span>`;
    cell.appendChild(name);
    const geno = document.createElement("div");
    geno.className = "k-geno";
    geno.textContent = describeGeno(k);
    cell.appendChild(geno);
    grid.appendChild(cell);
    const ctx = cv.getContext("2d");
    drawCat(ctx, cv.width, cv.height, k, ph, "k" + i + "|" + describeGeno(k));
  });
}

// ---- ratios: expected (analytic) vs actual (this litter) ----
function renderRatios() {
  const list = document.getElementById("ratios");
  list.innerHTML = "";
  const expected = expectedRatios(state.mom, state.dad);
  if (expected.length === 0) return;

  // actual counts keyed same as phenoKey
  const actual = {};
  let total = state.litter.length;
  for (const k of state.litter) {
    const key = phenoKey(phenotype(k));
    actual[key] = (actual[key] || 0) + 1;
  }

  expected.forEach((e) => {
    const key = phenoKey(e.ph);
    const expPct = e.p * 100;
    const actCount = actual[key] || 0;
    const actPct = total > 0 ? (actCount / total) * 100 : 0;
    const desc = describePheno(e.ph);
    const row = document.createElement("div");
    row.className = "ratio-row";
    row.innerHTML = `
      <span class="ratio-label">${desc.short}</span>
      <div class="ratio-bar-wrap">
        <div class="ratio-bar" style="width:${Math.max(2, expPct)}%"></div>
        ${total > 0 ? `<div class="ratio-actual" style="width:${actPct}%"></div><span class="ratio-actual-tick" style="left:${actPct}%">▲</span>` : ""}
        <span class="ratio-exp-bar">${expPct.toFixed(0)}%</span>
      </div>
      <span class="ratio-exp">${total > 0 ? `${actCount}/${total}` : "—"}<span class="ratio-exp-sub">exp ${expPct.toFixed(0)}%</span></span>
    `;
    list.appendChild(row);
  });

  if (total === 0) {
    const note = document.createElement("p");
    note.className = "punnett-note";
    note.textContent = "Mate the parents to see how the actual litter compares to these expectations.";
    list.appendChild(note);
  }
}

// ---- Punnett square for the orange locus ----
function renderPunnett() {
  const wrap = document.getElementById("punnett-orange");
  wrap.innerHTML = "";
  const p = punnettOrange(state.mom, state.dad);

  // build a 3x3 grid: corner | mom alleles (cols) ; dad alleles (rows) ; cells
  const tbl = document.createElement("table");
  tbl.className = "punnett";

  // header row: corner + mother's two X's
  const head = document.createElement("tr");
  head.appendChild(th(""));
  head.appendChild(th(`X^${p.top[0]}`));
  head.appendChild(th(`X^${p.top[1]}`));
  tbl.appendChild(head);

  // two rows: father gives X (→daughters) and Y (→sons)
  // outcomes order: [m0,fX] [m0,Y] [m1,fX] [m1,Y]
  const rows = [
    { sideLabel: `X^${p.side[0]}`, cells: [p.outcomes[0], p.outcomes[2]], note: "daughters" },
    { sideLabel: `${p.side[1]}`, cells: [p.outcomes[1], p.outcomes[3]], note: "sons" },
  ];
  rows.forEach((r) => {
    const tr = document.createElement("tr");
    const sideCell = th(r.sideLabel);
    const sideTag = document.createElement("span");
    sideTag.className = "sex-tag";
    sideTag.textContent = r.note;
    sideCell.appendChild(sideTag);
    tr.appendChild(sideCell);
    r.cells.forEach((o) => {
      const td = document.createElement("td");
      td.className = "cell " + cellClass(o);
      td.innerHTML = `${o.label}<span class="sex-tag">${o.sex === "F" ? "♀" : "♂"}</span>`;
      tr.appendChild(td);
    });
    tbl.appendChild(tr);
  });
  wrap.appendChild(tbl);

  // explanatory note
  const note = document.getElementById("punnett-note");
  note.innerHTML = buildPunnettNote(p);
}

function th(label) {
  const t = document.createElement("th");
  t.textContent = label;
  return t;
}
function cellClass(o) {
  // classify each outcome cell for color
  if (o.sex === "F") {
    // female: tortie if one O one o
    if ((o.label.includes("O") && o.label.includes("o"))) return "f tortie";
    if (o.label === "X^OX^O") return "f orange-cell";
    return "f black-cell"; // X^oX^o
  } else {
    return o.label === "X^OY" ? "m orange-cell" : "m black-cell";
  }
}

function buildPunnettNote(p) {
  // describe the cross in words
  const momO = state.mom.O;
  const dadO = state.dad.O[0];
  const momPheno = momO[0] === "O" && momO[1] === "O" ? "orange"
    : (momO.includes("O") && momO.includes("o") ? "tortoiseshell" : "non-orange");
  const dadPheno = dadO === "O" ? "orange" : "non-orange";
  let s = `Mother is <strong>${momPheno}</strong> (X^${momO[0]}X^${momO[1]}), father is <strong>${dadPheno}</strong> (X^${dadO}Y). `;
  // tortie daughters?
  const tortieD = p.outcomes.filter((o) => o.sex === "F" && o.label.includes("O") && o.label.includes("o"));
  if (tortieD.length) {
    s += `Tortoiseshell daughters (X^OX^o) appear in ${tortieD.length}/4 cells — each gets an O from one parent and an o from the other. `;
  }
  // sons follow mother's X
  const orangeSons = p.outcomes.filter((o) => o.sex === "M" && o.label === "X^OY").length;
  if (orangeSons) s += `Sons inherit their only X from their mother: ${orangeSons}/4 sons will be orange (X^OY). `;
  // the headline
  s += `<strong>No cell produces a tortoiseshell male</strong> — a tortie needs both an O and an o X chromosome, and a male (XY) has only one X. That is why tortoiseshell cats are almost always female.`;
  return s;
}

// ---- locus cheatsheet ----
const LOCI_INFO = [
  { sym: "O", name: "Orange", link: "X-linked", desc: "O makes orange pigment replace black. Carried on the X chromosome — the source of the tortoiseshell pattern.", alleles: "O > o" },
  { sym: "B", name: "Brown", link: "autosomal", desc: "Sets the eumelanin (dark pigment) shade: B = black, b = chocolate.", alleles: "B > b" },
  { sym: "A", name: "Agouti", link: "autosomal", desc: "A switches on tabby banding of individual hairs; aa = solid (no tabby shows).", alleles: "A > a" },
  { sym: "D", name: "Dilute", link: "recessive", desc: "dd fades pigment: black→blue, chocolate→lilac, orange→cream.", alleles: "D > d" },
  { sym: "S", name: "White spotting", link: "incomplete dom.", desc: "Ss = bicolor (white paws/chest); SS = high white. Incomplete dominance — the heterozygote is intermediate.", alleles: "S > s" },
  { sym: "W", name: "Dominant white", link: "epistatic", desc: "W_ masks all other pigment — a fully white cat (often blue-eyed). Classic dominant epistasis.", alleles: "W > w" },
  { sym: "L", name: "Hair length", link: "recessive", desc: "L = shorthair; ll = longhair. A simple recessive, true to Mendel's peas.", alleles: "L > l" },
];

function renderLoci() {
  const wrap = document.getElementById("loci-table");
  wrap.innerHTML = "";
  LOCI_INFO.forEach((loc) => {
    const card = document.createElement("div");
    card.className = "locus-card";
    card.innerHTML = `
      <div class="lc-head">
        <span class="lc-sym">${loc.sym}</span>
        <span class="lc-name">${loc.name}</span>
        <span class="lc-link">${loc.link}</span>
      </div>
      <div class="lc-desc">${loc.desc}</div>
      <div class="lc-alleles">${loc.alleles}</div>
    `;
    wrap.appendChild(card);
  });
}

// ============ picker modal ============
function openPicker(which) {
  const backdrop = document.getElementById("picker-backdrop");
  const grid = document.getElementById("picker-grid");
  document.getElementById("picker-title").textContent = `choose a ${which === "mom" ? "mother" : "father"}`;
  grid.innerHTML = "";
  // filter by sex (only show female candidates for mom, male for dad)
  // but allow any — a cat is male or female. Keep all presets, dim wrong-sex.
  PRESETS.forEach((p) => {
    const card = document.createElement("div");
    card.className = "picker-card";
    const cv = document.createElement("canvas");
    cv.width = 160; cv.height = 144;
    card.appendChild(cv);
    const ph = phenotype(p.g);
    const nameDiv = document.createElement("div");
    nameDiv.className = "pc-name";
    nameDiv.textContent = p.name.split(" (")[0];
    const phenoDiv = document.createElement("div");
    phenoDiv.className = "pc-pheno";
    phenoDiv.textContent = describePheno(ph).short + " · " + (p.g.sex === "F" ? "♀" : "♂");
    card.appendChild(nameDiv);
    card.appendChild(phenoDiv);

    const wrongSex = (which === "mom" && p.g.sex !== "F") || (which === "dad" && p.g.sex !== "M");
    if (wrongSex) {
      card.style.opacity = "0.4";
      card.title = "wrong sex for this parent";
    } else {
      card.addEventListener("click", () => {
        if (which === "mom") { state.mom = cloneGeno(p.g); state.momName = shortName(p.name); }
        else { state.dad = cloneGeno(p.g); state.dadName = shortName(p.name); }
        renderParent(which, which === "mom" ? state.mom : state.dad);
        closePicker();
        renderRatios();
        renderPunnett();
      });
    }
    grid.appendChild(card);
    const ctx = cv.getContext("2d");
    drawCat(ctx, cv.width, cv.height, p.g, ph, "pick|" + p.name);
  });
  backdrop.hidden = false;
}
function closePicker() {
  document.getElementById("picker-backdrop").hidden = true;
}
function cloneGeno(g) { return JSON.parse(JSON.stringify(g)); }
function shortName(fullName) { return fullName.split(" (")[0]; }

// ============ actions ============
function doMate() {
  const n = clamp(parseInt(document.getElementById("litter-size").value, 10) || 8, 1, 48);
  // fresh RNG each mate so each litter differs, but seeded by parents + time
  const seed = (hashStr(describeGeno(state.mom) + describeGeno(state.dad)) ^ ((Date.now() & 0xffff) << 8)) >>> 0;
  state.litter = litter(state.mom, state.dad, n, mulberry32(seed));
  renderLitter();
  renderRatios();
  document.getElementById("litter-count").textContent = `${state.litter.length} kittens`;
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ============ init ============
function init() {
  // default parents: a tortie female × black male → classic calico/tortie litter
  const momPreset = PRESETS.find((p) => p.name.startsWith("Patches"));
  const dadPreset = PRESETS.find((p) => p.name.startsWith("Domino"));
  state.mom = cloneGeno(momPreset.g);
  state.dad = cloneGeno(dadPreset.g);
  state.momName = shortName(momPreset.name);
  state.dadName = shortName(dadPreset.name);

  renderParent("mom", state.mom);
  renderParent("dad", state.dad);
  renderLoci();
  renderRatios();
  renderPunnett();

  // gallery/screenshot convenience: ?mate=1 breeds a litter on load
  if (new URLSearchParams(location.search).get("mate") === "1") doMate();

  document.getElementById("mate-btn").addEventListener("click", doMate);
  document.getElementById("mom-pick").addEventListener("click", () => openPicker("mom"));
  document.getElementById("dad-pick").addEventListener("click", () => openPicker("dad"));
  document.getElementById("picker-close").addEventListener("click", closePicker);
  document.getElementById("picker-backdrop").addEventListener("click", (ev) => {
    if (ev.target.id === "picker-backdrop") closePicker();
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") closePicker();
    if (ev.key === " " && !ev.target.matches("input,textarea")) { ev.preventDefault(); doMate(); }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
})();
