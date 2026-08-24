// app.js — Perspicillum: interactive Galilean-telescope studio.
// All optics come from physics.js (paraxial, tested); this file only draws
// and wires inputs. No randomness anywhere, so video re-renders are stable.

import * as P from "./physics.js";

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

const SCENARIOS = {
  padua: { fObj: 66, fEyeMag: 7.5, ap: 16, kmode: false },
  sidereus: { fObj: 66, fEyeMag: 3.3, ap: 16, kmode: false },
  medici: { fObj: 100, fEyeMag: 3.0, ap: 15, kmode: false },
  kepler: { fObj: 66, fEyeMag: 6.0, ap: 22, kmode: true },
};

const state = {
  fObj: 66,
  fEyeMag: 7.5,
  apertureCm: 1.6,
  kmode: false,
  ca: false,
  fieldDeg: 0.15,
  eyePosOverride: null, // cm; null = focused at tube length
  tab: "campanile",
  shipKm: 30,
  jupDays: 0,
  venusDays: -18,
};

function params() {
  return {
    fObj: state.fObj,
    fEye: state.kmode ? state.fEyeMag : -state.fEyeMag,
    aperture: state.apertureCm,
    eyePos: state.eyePosOverride,
    eyeOffset: P.DEFAULTS.eyeOffset,
  };
}

const fmt = (x, d = 1) => Number(x).toFixed(d);

/* ------------------------------------------------------------------ */
/* Optical bench                                                       */
/* ------------------------------------------------------------------ */

const bench = document.getElementById("bench");
const bctx = bench.getContext("2d");

function fitCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

let dragX = null; // world x under cursor while dragging the eyepiece

bench.addEventListener("pointerdown", (e) => {
  const { w } = fitCanvas(bench);
  const view = benchView();
  const px = (e.clientX - bench.getBoundingClientRect().left);
  const xEyePx = view.sx(P.eyepiecePosition(state));
  if (Math.abs(px - xEyePx) < 22) {
    dragX = px;
    bench.setPointerCapture(e.pointerId);
  }
});
bench.addEventListener("pointermove", (e) => {
  if (dragX == null) return;
  const rect = bench.getBoundingClientRect();
  const view = benchView();
  const worldX = view.xMin + ((e.clientX - rect.left) / view.plotW) * (view.xMax - view.xMin);
  const lo = Math.max(8, state.fObj * 0.25);
  const hi = state.fObj * 1.7;
  state.eyePosOverride = Math.min(hi, Math.max(lo, worldX));
});
bench.addEventListener("pointerup", () => { dragX = null; });

function benchView() {
  const fEye = state.kmode ? state.fEyeMag : -state.fEyeMag;
  const L = P.tubeLength({ fObj: state.fObj, fEye });
  const xEye = state.eyePosOverride == null ? L : state.eyePosOverride;
  const rect = bench.getBoundingClientRect();
  const plotW = rect.width - 20;
  const xMin = -Math.min(24, state.fObj * 0.32);
  const xMax = Math.max(xEye, L) + 15;
  return { xMin, xMax, plotW, rectW: rect.width };
}

benchView.sx = (view, x) => 10 + ((x - view.xMin) / (view.xMax - view.xMin)) * view.plotW;

// convenience wrapper bound per-frame
function sxOf(view) {
  return (x) => benchView.sx(view, x);
}

function drawBench() {
  const { ctx, w, h } = fitCanvas(bench);
  ctx.clearRect(0, 0, w, h);
  const p = params();
  const view = benchView();
  const sx = sxOf(view);
  const cy = h / 2;

  // vertical exaggeration factor is implicit (independent x/y scales)
  // collect rays first to size the y range
  const alphas = [-state.fieldDeg, 0, state.fieldDeg];
  const lambdas = state.ca ? [P.LAMBDA_NM.blue, P.LAMBDA_NM.green, P.LAMBDA_NM.red] : [null];
  const lambdaColors = { [P.LAMBDA_NM.blue]: "#6fa8ff", [P.LAMBDA_NM.green]: "#b8f1c9", [P.LAMBDA_NM.red]: "#ff9a6f" };
  const bundles = [];
  let yPeak = 0.9;
  for (const aDeg of alphas) {
    for (const lam of lambdas) {
      const b = P.traceBundle(aDeg, { ...p, aperture: p.aperture }, lam, state.ca ? 5 : 7);
      bundles.push({ aDeg, lam, b });
      for (const r of b.rays) for (const pt of r.pts) yPeak = Math.max(yPeak, Math.abs(pt.y));
    }
  }
  const yHalf = yPeak * 1.3;
  const sy = (y) => cy - (y / yHalf) * (h / 2 - 26);

  // optical axis
  ctx.strokeStyle = "rgba(143,161,196,.35)";
  ctx.setLineDash([5, 7]);
  ctx.beginPath(); ctx.moveTo(sx(view.xMin), cy); ctx.lineTo(sx(view.xMax), cy); ctx.stroke();
  ctx.setLineDash([]);

  // tube ghost
  const xEyeCur = P.eyepiecePosition(p);
  const wallH = (p.aperture / 2 + 0.5) ;
  ctx.strokeStyle = "rgba(212,175,55,.28)";
  ctx.lineWidth = 2;
  ctx.strokeRect(sx(-3), sy(wallH), sx(xEyeCur + 1.2) - sx(-3), sy(-wallH) - sy(wallH));
  ctx.lineWidth = 1;
  ctx.fillStyle = "rgba(212,175,55,.55)";
  ctx.font = "11px ui-monospace, Menlo, monospace";
  ctx.textAlign = "center";
  ctx.fillText("tube (ghost)", sx((xEyeCur - 3) / 2), sy(wallH) + 14);

  // common focal plane tick
  ctx.strokeStyle = "rgba(127,212,255,.5)";
  ctx.setLineDash([3, 5]);
  ctx.beginPath(); ctx.moveTo(sx(p.fObj), sy(yHalf * 0.92)); ctx.lineTo(sx(p.fObj), sy(-yHalf * 0.92)); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(127,212,255,.75)";
  ctx.fillText("common focus", sx(p.fObj), sy(yHalf * 0.92) - 6);

  // objective lens + stop
  drawObjective(ctx, sx(0), sy(0), sy(p.aperture / 2) - sy(0), sy(-p.aperture / 2) - sy(0));
  // eyepiece lens
  const isConvex = p.fEye > 0;
  drawEyepiece(ctx, sx(xEyeCur), sy(0), sy(P.EYEPIECE_APERTURE / 2) - sy(0), sy(-P.EYEPIECE_APERTURE / 2) - sy(0), isConvex);

  // rays
  for (const { aDeg, lam, b } of bundles) {
    const baseColor = lam != null ? lambdaColors[lam]
      : (aDeg === 0 ? "#f4e3bd" : aDeg > 0 ? "#ffd27f" : "#ffc46b");
    for (const r of b.rays) {
      ctx.strokeStyle = r.clippedAt ? "rgba(255,122,122,.4)" : baseColor;
      ctx.globalAlpha = r.clippedAt ? 0.5 : (!r.clippedAt && !r.hitsPupil && r.pts.length >= 4) ? 0.55 : 0.95;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      r.pts.forEach((pt, i) => i === 0 ? ctx.moveTo(sx(pt.x), sy(pt.y)) : ctx.lineTo(sx(pt.x), sy(pt.y)));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // eye pupil
  const xEyeAbs = xEyeCur + p.eyeOffset;
  const rP = p.eyePupil / 2;
  ctx.strokeStyle = "rgba(240,244,252,.85)";
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(sx(xEyeAbs), cy, Math.abs(sy(rP) - sy(0)), 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = "rgba(240,244,252,.08)";
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.fillStyle = "#8fa1c4";
  ctx.fillText("eye", sx(xEyeAbs), sy(0) + (sy(-rP) - sy(0)) + 14);

  // magnification fan labels
  const outDeg = P.exitAngleDeg(state.fieldDeg, p);
  ctx.textAlign = "right";
  ctx.fillStyle = "#8fa1c4";
  ctx.fillText(`in ${fmt(state.fieldDeg, 2)}°`, w - 12, h - 30);
  ctx.fillStyle = "#d4af37";
  ctx.font = "600 12px ui-monospace, Menlo, monospace";
  ctx.fillText(`out ${Number.isFinite(outDeg) ? fmt(Math.abs(outDeg), 2) : "—"}°  (×${fmt(P.magnification(p), 1)})`, w - 12, h - 12);

  // drag affordance
  if (dragX == null) {
    ctx.fillStyle = "rgba(212,175,55,.75)";
    ctx.textAlign = "center";
    ctx.fillText("⇔", sx(xEyeCur), sy(0) - (sy(0) - sy(P.EYEPIECE_APERTURE / 2)) - 8);
  }
}

function drawObjective(ctx, cx, cyy, halfUp, halfDown) {
  const hw = 9;
  ctx.strokeStyle = "#d4af37";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - hw / 2, cyy + halfDown);
  ctx.quadraticCurveTo(cx + hw / 2, cyy, cx - hw / 2, cyy + halfUp);
  ctx.moveTo(cx + hw / 2, cyy + halfDown);
  ctx.quadraticCurveTo(cx - hw / 2, cyy, cx + hw / 2, cyy + halfUp);
  ctx.stroke();
  // baffle plates marking the stop
  ctx.strokeStyle = "rgba(212,175,55,.5)";
  ctx.beginPath();
  ctx.moveTo(cx - hw, cyy + halfDown - 2); ctx.lineTo(cx - hw / 2, cyy + halfDown - 2);
  ctx.moveTo(cx - hw, cyy + halfUp + 2); ctx.lineTo(cx - hw / 2, cyy + halfUp + 2);
  ctx.stroke();
  ctx.fillStyle = "#d4af37";
  ctx.font = "11px ui-monospace, Menlo, monospace";
  ctx.textAlign = "center";
  ctx.fillText(`objective f=${fmt(state.fObj, 0)}cm`, cx, cyy + halfDown + 14);
  ctx.lineWidth = 1;
}

function drawEyepiece(ctx, cx, cyy, halfUp, halfDown, convex) {
  const hw = 7;
  ctx.strokeStyle = "#7fd4ff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (convex) {
    ctx.moveTo(cx - hw / 2, cyy + halfDown);
    ctx.quadraticCurveTo(cx + hw / 2, cyy, cx - hw / 2, cyy + halfUp);
    ctx.moveTo(cx + hw / 2, cyy + halfDown);
    ctx.quadraticCurveTo(cx - hw / 2, cyy, cx + hw / 2, cyy + halfUp);
  } else {
    ctx.moveTo(cx - hw / 2, cyy + halfDown);
    ctx.quadraticCurveTo(cx - hw * 1.1, cyy, cx - hw / 2, cyy + halfUp);
    ctx.moveTo(cx + hw / 2, cyy + halfDown);
    ctx.quadraticCurveTo(cx + hw * 1.1, cyy, cx + hw / 2, cyy + halfUp);
  }
  ctx.stroke();
  ctx.fillStyle = "#7fd4ff";
  ctx.font = "11px ui-monospace, Menlo, monospace";
  ctx.textAlign = "center";
  ctx.fillText(`${convex ? "convex" : "concave"} ocular f=${state.kmode ? "+" : "−"}${fmt(state.fEyeMag, 1)}cm`, cx, cyy + halfDown + 14);
  ctx.lineWidth = 1;
}

/* ------------------------------------------------------------------ */
/* Ledger                                                              */
/* ------------------------------------------------------------------ */

const $ = (id) => document.getElementById(id);

function updateLedger() {
  const p = params();
  const focused = { ...P.DEFAULTS, ...p, eyePos: null };
  const M = P.magnification(focused);
  const L = P.tubeLength(focused);
  const dx = P.exitPupilDia(focused);
  const z = P.pupilDistance(focused);
  const half = P.halfFieldDeg(focused);
  const tfov = 2 * half;
  $("outM").textContent = `×${fmt(M, 1)}`;
  $("outL").textContent = `${fmt(L, 1)} cm`;
  $("outExit").textContent = `${fmt(dx * 10, 2)} mm`;
  $("outPupil").textContent = z < 0
    ? `virtual · ${fmt(-z, 1)} cm inside tube`
    : `real · ${fmt(z, 1)} cm behind ocular`;
  $("outFov").textContent =
    `${(tfov * 60).toFixed(0)}′ / ${(tfov * M * 60).toFixed(0)}′`;
  $("outGrasp").textContent = `×${fmt(P.lightGrasp(focused), 1)}`;
  $("outDawes").textContent =
    `${fmt(P.dawesArcsec(focused.aperture), 1)}″ (eye: 60″)`;

  const chip = $("focusChip");
  const off = state.eyePosOverride == null ? 0 : state.eyePosOverride - L;
  if (Math.abs(off) < 0.06) {
    chip.textContent = "FOCUSED"; chip.classList.remove("off");
  } else {
    chip.textContent = `DEFOCUSED ${off > 0 ? "+" : ""}${fmt(off, 1)} cm`;
    chip.classList.add("off");
  }

  const note = $("lessonNote");
  if (Math.abs(off) >= 0.06) {
    note.innerHTML = `<b>Out of focus.</b> The ocular must sit exactly where both focal points coincide; anywhere else the exiting rays converge or diverge and the scene smears into a blur circle at your pupil.`;
  } else if (state.kmode) {
    note.innerHTML = `<b>Kepler mode.</b> A convex ocular makes a real, reachable exit pupil and a wider field — but flips the image upside down. Dutch sailors kept the awkward Galilean layout for decades rather than read charts inverted.`;
  } else {
    note.innerHTML = `<b>The concave ocular sits <i>before</i> the common focus.</b> Upright image, short tube — but the exit pupil is virtual (trapped inside the tube), so your eye rides the lens and the true field squeezes to ${(tfov * 60).toFixed(0)} arc-minutes.`;
  }
}

/* ------------------------------------------------------------------ */
/* Eyepiece view                                                       */
/* ------------------------------------------------------------------ */

const scope = document.getElementById("scope");
const sctx = scope.getContext("2d");

function drawScope() {
  const { ctx, w, h } = fitCanvas(scope);
  ctx.clearRect(0, 0, w, h);
  const p = { ...params(), eyePos: null };
  const M = P.magnification(p);
  const R = Math.min(w * 0.23, h * 0.44); // two circles, side by side, no overlap
  const centers = [
    { x: w * 0.26, y: h * 0.52, label: "naked eye", zoom: 1 },
    { x: w * 0.74, y: h * 0.52, label: `perspicillum ×${fmt(M, 1)}`, zoom: M },
  ];
  for (const c of centers) {
    const side = c.zoom < 1.01 ? "eye" : "tube";
    ctx.save();
    ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, Math.PI * 2); ctx.clip();
    drawScene(ctx, c, R, state.tab, side);
    ctx.restore();
    ctx.strokeStyle = "rgba(212,175,55,.4)";
    ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#8fa1c4";
    ctx.font = "600 12px ui-monospace, Menlo, monospace";
    ctx.textAlign = "center";
    ctx.fillText(c.label, c.x, c.y - R - 10);
    // footer captions live OUTSIDE the circular clip, or they get cut
    drawSceneFooter(ctx, c, R, state.tab, side);
  }
}

function drawSceneFooter(ctx, c, R, tab, side) {
  if (tab === "jupiter") return drawJupiterFooter(ctx, c, R, side);
  if (tab === "campanile") return drawShipsFooter(ctx, c, R, side);
}

function drawScene(ctx, c, R, tab, side) {
  const p = { ...params(), eyePos: null };
  const M = P.magnification(p);
  if (tab === "campanile") return drawShips(ctx, c, R, side, M);
  if (tab === "jupiter") return drawJupiter(ctx, c, R, side, M, p);
  return drawVenus(ctx, c, R, side, M, p);
}

/* --- Campanile ------------------------------------------------------ */

const CAMPANILE_H_M = 98.6;
const MAST_H_M = 20;
const SHIP_KNOTS = 4; // approach speed

function horizonKm(heightM) { return 3.57 * Math.sqrt(heightM); }

function drawShips(ctx, c, R, side, M) {
  const dKm = state.shipKm;
  // sky & sea
  const sky = ctx.createLinearGradient(0, c.y - R, 0, c.y);
  sky.addColorStop(0, "#101a33"); sky.addColorStop(1, "#3a3050");
  ctx.fillStyle = sky; ctx.fillRect(c.x - R, c.y - R, 2 * R, R);
  const sea = ctx.createLinearGradient(0, c.y, 0, c.y + R);
  sea.addColorStop(0, "#17324a"); sea.addColorStop(1, "#0b1626");
  ctx.fillStyle = sea; ctx.fillRect(c.x - R, c.y, 2 * R, R);
  ctx.strokeStyle = "rgba(240,244,252,.25)";
  ctx.beginPath(); ctx.moveTo(c.x - R, c.y); ctx.lineTo(c.x + R, c.y); ctx.stroke();

  const thetaArcsec = (206265 * MAST_H_M) / (dKm * 1000);
  const maxD = horizonKm(CAMPANILE_H_M) + horizonKm(MAST_H_M); // mast-top geometry
  const DETECT_ARCSEC_EYE = 150; // ~2.5' practical unaided threshold
  const visibleEye = thetaArcsec >= DETECT_ARCSEC_EYE;
  const visibleTube = dKm <= maxD && thetaArcsec >= DETECT_ARCSEC_EYE / M;

  // apparent-size scaling: map 300 arcsec to the full circle diameter
  const winArcsec = side === "tube" ? 300 : 300 * M;
  const pxPerArcsec = (2 * R) / winArcsec;
  const mastPx = Math.min(R * 0.9, thetaArcsec * pxPerArcsec);
  if ((side === "eye" && visibleEye) || (side === "tube" && visibleTube)) {
    drawShip(ctx, c.x, c.y, Math.max(mastPx, 2));
  }
  // campanile parapet foreground
  ctx.fillStyle = "#060910";
  ctx.fillRect(c.x - R, c.y + R * 0.78, 2 * R, R * 0.22);
  ctx.fillRect(c.x - R, c.y + R * 0.78, 2 * R, 4);
  for (let i = 0; i < 9; i++) {
    ctx.fillRect(c.x - R + 8 + i * (2 * R - 16) / 8, c.y + R * 0.72, 5, R * 0.07);
  }
}

function drawShipsFooter(ctx, c, R, side) {
  const dKm = state.shipKm;
  const maxD = horizonKm(CAMPANILE_H_M) + horizonKm(MAST_H_M);
  ctx.fillStyle = "#8fa1c4";
  ctx.font = "11px ui-monospace, Menlo, monospace";
  ctx.textAlign = "center";
  if (side === "tube") {
    const thetaArcsec = (206265 * MAST_H_M) / (dKm * 1000);
    ctx.fillText(`${thetaArcsec.toFixed(0)}″ · horizon ${fmt(maxD, 0)} km`, c.x, c.y + R + 12);
  } else {
    ctx.fillText(`naked limit ≈ ${fmt((206265 * MAST_H_M) / 150 / 1000, 0)} km`, c.x, c.y + R + 12);
  }
}

function drawShip(ctx, x, waterY, hPx) {
  const wPx = Math.max(hPx * 0.9, 3);
  ctx.fillStyle = "rgba(240,244,252,.9)";
  // hull
  ctx.beginPath();
  ctx.moveTo(x - wPx / 2, waterY);
  ctx.lineTo(x - wPx * 0.38, waterY - hPx * 0.16);
  ctx.lineTo(x + wPx * 0.38, waterY - hPx * 0.16);
  ctx.lineTo(x + wPx / 2, waterY);
  ctx.closePath(); ctx.fill();
  // masts + sail hint
  ctx.fillRect(x - wPx * 0.1, waterY - hPx, Math.max(wPx * 0.03, 1), hPx * 0.84);
  ctx.fillRect(x + wPx * 0.16, waterY - hPx * 0.7, Math.max(wPx * 0.03, 1), hPx * 0.54);
  ctx.beginPath();
  ctx.moveTo(x - wPx * 0.08, waterY - hPx * 0.92);
  ctx.quadraticCurveTo(x + wPx * 0.2, waterY - hPx * 0.7, x - wPx * 0.05, waterY - hPx * 0.45);
  ctx.closePath();
  ctx.fillStyle = "rgba(240,244,252,.55)";
  ctx.fill();
}

/* --- Jupiter & the Medicean stars ----------------------------------- */

const MOON_AS_PER_UNIT = 140; // Io semi-major ≈ 142" at 5.1 AU

// Both circles span the same APPARENT angle = M × TFOV, so the tube side
// shows exactly the instrument's true field (the ledger number) while the
// naked side shows the same apparent patch of unaided sky.
function scopeWindows(M, p) {
  const tfovAs = 2 * P.halfFieldDeg(p) * 3600;
  return { tube: tfovAs, eye: tfovAs * M };
}

function drawJupiter(ctx, c, R, side, M, p) {
  ctx.fillStyle = "#05070f";
  ctx.fillRect(c.x - R, c.y - R, 2 * R, 2 * R);
  // faint stars
  const stars = [[-.62, -.4, 1], [.4, -.66, .8], [.7, .3, 1.1], [-.3, .58, .7], [.1, -.2, .6]];
  ctx.fillStyle = "rgba(240,244,252,.5)";
  for (const [fx, fy, fr] of stars) {
    ctx.beginPath(); ctx.arc(c.x + fx * R, c.y + fy * R, fr, 0, Math.PI * 2); ctx.fill();
  }
  const win = scopeWindows(M, p);
  const winAs = side === "tube" ? win.tube : win.eye;
  const scale = (2 * R) / winAs;
  const jupR_as = 22;
  const moons = P.moonOffsets(state.jupDays);
  const dateLabel = julianLabel(state.jupDays);

  if (side === "eye") {
    // 44" disc is below the eye's ~60" resolution: one glare blob, no moons
    const glow = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 9);
    glow.addColorStop(0, "rgba(232,202,160,.95)");
    glow.addColorStop(0.4, "rgba(232,202,160,.35)");
    glow.addColorStop(1, "rgba(232,202,160,0)");
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(c.x, c.y, 9, 0, Math.PI * 2); ctx.fill();
  } else {
    const jr = Math.max(jupR_as * scale, 8);
    const grad = ctx.createRadialGradient(c.x - jr * 0.3, c.y - jr * 0.3, jr * 0.2, c.x, c.y, jr);
    grad.addColorStop(0, "#e8caa0"); grad.addColorStop(1, "#b98a54");
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(c.x, c.y, jr, 0, Math.PI * 2); ctx.fill();
    if (jr > 10) {
      ctx.save();
      ctx.beginPath(); ctx.arc(c.x, c.y, jr, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = "rgba(120,70,30,.28)";
      for (const band of [-0.5, 0.05, 0.55]) {
        ctx.fillRect(c.x - jr, c.y + band * jr - jr * 0.07, 2 * jr, jr * 0.14);
      }
      ctx.restore();
    }
    // moons as star-dots (unresolved points, even in the tube); the field
    // edge really does swallow the outer ones — that is the Galilean trap
    ctx.fillStyle = "#fdf6e3";
    for (const m of moons) {
      const asOffset = m.offset * MOON_AS_PER_UNIT;
      if (m.depth < 0 && Math.abs(asOffset) < jupR_as) continue; // behind
      sparkle(ctx, c.x + asOffset * scale, c.y, 3.2);
    }
  }

  // scale bar + date live in drawJupiterFooter (outside the circle clip)
}

function drawJupiterFooter(ctx, c, R, side) {
  const p = { ...params(), eyePos: null };
  const M = P.magnification(p);
  const win = scopeWindows(M, p);
  const winAs = side === "tube" ? win.tube : win.eye;
  const scale = (2 * R) / winAs;
  const barAs = win.tube / 4;
  const barPx = Math.min(barAs * scale, 2 * R - 24);
  ctx.strokeStyle = "rgba(212,175,55,.6)";
  ctx.beginPath();
  ctx.moveTo(c.x - barPx / 2, c.y + R - 14);
  ctx.lineTo(c.x + barPx / 2, c.y + R - 14);
  ctx.stroke();
  ctx.fillStyle = "#8fa1c4";
  ctx.font = "11px ui-monospace, Menlo, monospace";
  ctx.textAlign = "center";
  const label = side === "tube"
    ? `${julianLabel(state.jupDays)} · ${Math.round(barAs)}″`
    : `${julianLabel(state.jupDays)} · ${Math.round(barAs)}″ true`;
  ctx.fillText(label, c.x, c.y + R + 12);
}

function sparkle(ctx, x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, -r * 2); ctx.lineTo(r * 0.5, 0); ctx.lineTo(0, r * 2); ctx.lineTo(-r * 0.5, 0);
  ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

const MONTHS = ["Jan", "Feb", "Mar"];
function julianLabel(tDays) {
  // t=0 is the evening of Jan 7, 1610 (Julian), Padua
  const total = 7 + tDays;
  const month = total <= 31 ? 0 : 1;
  const day = month === 0 ? total : total - 31;
  const hourFrac = (total % 1) * 24;
  const hh = String(Math.floor(hourFrac)).padStart(2, "0");
  return `${MONTHS[month]} ${Math.floor(day)}, 1610 ${hh}:00`;
}

/* --- Venus phases ---------------------------------------------------- */

function drawVenus(ctx, c, R, side, M, p) {
  ctx.fillStyle = "#05070f";
  ctx.fillRect(c.x - R, c.y - R, 2 * R, 2 * R);
  const g = P.venusGeometry(state.venusDays);
  const win = scopeWindows(M, p);
  const winAs = side === "tube" ? win.tube : win.eye;
  const scale = (2 * R) / winAs;
  const vr = (g.diamArcsec / 2) * scale;

  if (vr <= 2.2) {
    // below/around eye resolution: a point of light with a little glare
    const glow = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 8);
    glow.addColorStop(0, "rgba(242,232,201,.95)");
    glow.addColorStop(0.4, "rgba(242,232,201,.3)");
    glow.addColorStop(1, "rgba(242,232,201,0)");
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(c.x, c.y, 8, 0, Math.PI * 2); ctx.fill();
  } else {
    // dark disc
    ctx.fillStyle = "#20242e";
    ctx.beginPath(); ctx.arc(c.x, c.y, vr, 0, Math.PI * 2); ctx.fill();
    // lit region: right limb (sunward) arc + terminator ellipse back to the top.
    // k<0.5 crescent: terminator bows sunward; k>0.5 gibbous: it bows away.
    ctx.fillStyle = "#f2e8c9";
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, vr, vr, 0, -Math.PI / 2, Math.PI / 2); // top → bottom via +x
    if (g.k >= 0.5) {
      ctx.ellipse(c.x, c.y, Math.max(vr * (2 * g.k - 1), 0.01), vr, 0, Math.PI / 2, -Math.PI / 2);
    } else {
      ctx.ellipse(c.x, c.y, Math.max(vr * (1 - 2 * g.k), 0.01), vr, 0, Math.PI / 2, -Math.PI / 2, true);
    }
    ctx.closePath();
    ctx.fill();
  }
}

/* ------------------------------------------------------------------ */
/* Target controls                                                     */
/* ------------------------------------------------------------------ */

const TAB_NOTE = {
  campanile: "25 Aug 1609: senators on the campanile watched hulls climb the horizon about two hours before anyone on the docks could swear to them.",
  jupiter: "Jan 7 – Mar 2, 1610: four 'stars' that never leave a line through Jupiter, and keep overtaking each other. Phases here are calibrated to his notebook sketch, not an ephemeris.",
  venus: "Dec 1610: Venus goes through a full set of phases, swelling six-fold near inferior conjunction. Impossible if it orbits the Earth.",
};

function buildTargetControls() {
  const box = $("targetControls");
  box.innerHTML = "";
  if (state.tab === "campanile") {
    box.innerHTML = `
      <label>ship distance <output id="vShip">${fmt(state.shipKm, 0)} km</output>
        <input type="range" id="ship" min="8" max="50" step="1" value="${state.shipKm}"></label>
      <div class="verdict" id="shipVerdict"></div>`;
    $("ship").addEventListener("input", (e) => {
      state.shipKm = +e.target.value;
      $("vShip").textContent = `${fmt(state.shipKm, 0)} km`;
      updateShipVerdict();
    });
    updateShipVerdict();
  } else if (state.tab === "jupiter") {
    box.innerHTML = `
      <label>nights since Jan 7, 1610 <output id="vJup">${julianLabel(state.jupDays)}</output>
        <input type="range" id="jup" min="0" max="54" step="0.25" value="${state.jupDays}"></label>
      <div id="logBox"></div>`;
    $("jup").addEventListener("input", (e) => {
      state.jupDays = +e.target.value;
      $("vJup").textContent = julianLabel(state.jupDays);
      updateJupiterLog();
    });
    updateJupiterLog();
  } else {
    box.innerHTML = `
      <label>days from inferior conjunction <output id="vVen">${fmt(state.venusDays, 0)} d</output>
        <input type="range" id="ven" min="-80" max="80" step="1" value="${state.venusDays}"></label>
      <div class="verdict" id="venVerdict"></div>`;
    $("ven").addEventListener("input", (e) => {
      state.venusDays = +e.target.value;
      $("vVen").textContent = `${fmt(state.venusDays, 0)} d`;
      updateVenusVerdict();
    });
    updateVenusVerdict();
  }
}

function updateShipVerdict() {
  const d = state.shipKm;
  const maxD = horizonKm(CAMPANILE_H_M) + horizonKm(MAST_H_M);
  const dNaked = (206265 * MAST_H_M) / 150 / 1000;
  const lead = Math.max(0, (maxD - Math.max(d, dNaked)) / (SHIP_KNOTS * 1.852));
  const eye = d <= dNaked ? "a speck you can just swear to" : "nothing — below the eye's ~2.5′ threshold";
  $("shipVerdict").innerHTML =
    `At ${fmt(d, 0)} km: naked eye sees <b>${eye}</b>; the tube holds the mast to the horizon (${fmt(maxD, 0)} km). ` +
    `News still beats the dockworkers by <b>${lead.toFixed(1)} h</b> at ${SHIP_KNOTS} knots.`;
}

function updateJupiterLog() {
  const box = $("logBox");
  const near = P.GALILEO_LOG.reduce((best, e) =>
    Math.abs(e.t - state.jupDays) < Math.abs(best.t - state.jupDays) ? e : best);
  if (Math.abs(near.t - state.jupDays) > 1.6) {
    box.innerHTML = `<div class="verdict">Between notebook entries — drag toward a dated night.</div>`;
    return;
  }
  box.innerHTML = `<div class="log-entry"><b>${near.date}</b> “${near.text}”</div>`;
}

function updateVenusVerdict() {
  const g = P.venusGeometry(state.venusDays);
  const phaseName = g.k < 0.1 ? "new" : g.k < 0.45 ? "crescent" : g.k < 0.55 ? "half" : g.k < 0.9 ? "gibbous" : "full";
  $("venVerdict").innerHTML =
    `Illuminated fraction k = (1+cos ψ)/2 = <b>${g.k.toFixed(2)}</b> — <b>${phaseName}</b>, ø${g.diamArcsec.toFixed(0)}″. ` +
    `A Ptolemaic Venus, forever chained between Earth and Sun, can never be gibbous. This one is.`;
}

/* ------------------------------------------------------------------ */
/* Wiring                                                              */
/* ------------------------------------------------------------------ */

function syncControls() {
  $("fobj").value = state.fObj;
  $("vFobj").textContent = `${fmt(state.fObj, 0)} cm`;
  $("feye").value = state.fEyeMag;
  $("vFeye").textContent = `${fmt(state.fEyeMag, 1)} cm`;
  $("aperture").value = state.apertureCm * 10;
  $("vAp").textContent = `${fmt(state.apertureCm * 10, 0)} mm`;
  $("field").value = state.fieldDeg;
  $("vField").textContent = `${fmt(state.fieldDeg, 2)}°`;
  $("ca").checked = state.ca;
  $("kmode").checked = state.kmode;
}

function bindControls() {
  $("fobj").addEventListener("input", (e) => {
    state.fObj = +e.target.value;
    $("vFobj").textContent = `${fmt(state.fObj, 0)} cm`;
    state.eyePosOverride = null; markScenarioDirty();
  });
  $("feye").addEventListener("input", (e) => {
    state.fEyeMag = +e.target.value;
    $("vFeye").textContent = `${fmt(state.fEyeMag, 1)} cm`;
    state.eyePosOverride = null; markScenarioDirty();
  });
  $("aperture").addEventListener("input", (e) => {
    state.apertureCm = +e.target.value / 10;
    $("vAp").textContent = `${fmt(+e.target.value, 0)} mm`;
  });
  $("field").addEventListener("input", (e) => {
    state.fieldDeg = +e.target.value;
    $("vField").textContent = `${fmt(state.fieldDeg, 2)}°`;
  });
  $("ca").addEventListener("change", (e) => { state.ca = e.target.checked; });
  $("kmode").addEventListener("change", (e) => {
    state.kmode = e.target.checked;
    state.eyePosOverride = null;
    markScenarioDirty();
  });

  $("presets").querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => loadScenario(btn.dataset.scenario));
  });
  $("tabs").querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => setTab(btn.dataset.tab));
  });
}

function markScenarioDirty() {
  document.querySelectorAll("#presets button").forEach((b) => b.classList.remove("on"));
}

function loadScenario(name) {
  const sc = SCENARIOS[name];
  if (!sc) return;
  state.fObj = sc.fObj;
  state.fEyeMag = sc.fEyeMag;
  state.apertureCm = sc.ap / 10;
  state.kmode = sc.kmode;
  state.eyePosOverride = null;
  document.querySelectorAll("#presets button").forEach((b) =>
    b.classList.toggle("on", b.dataset.scenario === name));
  syncControls();
}

function setTab(name) {
  state.tab = name;
  document.querySelectorAll("#tabs button").forEach((b) =>
    b.classList.toggle("on", b.dataset.tab === name));
  $("tabNote").textContent = TAB_NOTE[name];
  buildTargetControls();
}

/* ------------------------------------------------------------------ */
/* __demo API — deterministic hooks for the video renderer             */
/* ------------------------------------------------------------------ */

window.__demo = {
  loadScenario,
  setTab,
  setFocal(fObj, fEyeMag) {
    state.fObj = fObj;
    state.fEyeMag = fEyeMag;
    state.eyePosOverride = null;
    markScenarioDirty();
    syncControls();
  },
  setDefocus(cm) {
    const L = P.tubeLength({ fObj: state.fObj, fEye: state.kmode ? state.fEyeMag : -state.fEyeMag });
    state.eyePosOverride = cm === 0 ? null : L + cm;
  },
  setField(deg) { state.fieldDeg = deg; $("field").value = deg; $("vField").textContent = `${fmt(deg, 2)}°`; },
  setCA(on) { state.ca = !!on; $("ca").checked = !!on; },
  setAperture(mm) { state.apertureCm = mm / 10; $("aperture").value = mm; $("vAp").textContent = `${fmt(mm, 0)} mm`; },
  setShip(km) { if (state.tab !== "campanile") setTab("campanile"); state.shipKm = km; buildTargetControls(); },
  setJupiter(days) { if (state.tab !== "jupiter") setTab("jupiter"); state.jupDays = days; buildTargetControls(); },
  setVenus(days) { if (state.tab !== "venus") setTab("venus"); state.venusDays = days; buildTargetControls(); },
  state: () => JSON.parse(JSON.stringify(state)),
};

/* ------------------------------------------------------------------ */
/* Main loop                                                           */
/* ------------------------------------------------------------------ */

function frame() {
  drawBench();
  drawScope();
  requestAnimationFrame(frame);
}

bindControls();
syncControls();
setTab("campanile");
loadScenario("padua");
updateLedger();
setInterval(updateLedger, 250);
requestAnimationFrame(frame);
