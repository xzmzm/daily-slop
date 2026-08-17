/* flash-spectrum — drawing, DOM, pointer handling, and the __demo hooks
 * the video renderer steps through. All physics lives in engine.js; this
 * file only paints state and forwards input.
 */
"use strict";

const E = window.FlashEngine;

/* ── state (the whole UI is a pure function of this) ─────────────────── */
const state = {
  scene: "guntur",           // 'guntur' | 'corona'
  t: E.T_MIN,                // seconds from second contact
  lambda: 589.0,             // crosshair wavelength, nm
  playing: false,
  playRate: 6,               // sim-seconds per real second
  measured: new Set(),       // catalogue ids visited by the crosshair
  strangers: new Set(),      // uncatalogued lines visited
  lastVerdict: null,
};

/* ── dom ─────────────────────────────────────────────────────────────── */
const $ = (id) => document.getElementById(id);
const scope = $("scope");
const ctx = scope.getContext("2d");
const disk = $("disk");
const dctx = disk.getContext("2d");
const clock = $("clock");
clock.min = E.T_MIN;
clock.max = E.T_MAX;

const W = scope.width, H = scope.height;
const FINDER = { x0: 36, x1: W - 36, y0: 64, y1: 196, wl0: 380, wl1: 740 };
const EYE = { x0: 36, x1: W - 36, y0: 300, y1: 660, span: 20 };
const TRACE_MAX = 1.12;

const wlToXf = (wl) => FINDER.x0 + ((wl - FINDER.wl0) / (FINDER.wl1 - FINDER.wl0)) * (FINDER.x1 - FINDER.x0);
const xToWlf = (x) => FINDER.wl0 + ((x - FINDER.x0) / (FINDER.x1 - FINDER.x0)) * (FINDER.wl1 - FINDER.wl0);
const wlToXe = (wl) => EYE.x0 + (0.5 + (wl - state.lambda) / (2 * EYE.span)) * (EYE.x1 - EYE.x0);
const xToWle = (x) => state.lambda + ((x - EYE.x0) / (EYE.x1 - EYE.x0) - 0.5) * 2 * EYE.span;

/* fixed stars for the disk inset — hand-placed, no RNG anywhere */
const STARS = [[38, 40], [104, 22], [170, 58], [418, 30], [452, 96], [30, 402], [460, 402],
               [72, 132], [404, 152], [16, 236], [456, 250], [120, 452], [352, 448]];

/* ── drawing ─────────────────────────────────────────────────────────── */
function drawScope() {
  ctx.clearRect(0, 0, W, H);
  const t = state.scene === "corona" ? E.TOTALITY_HALF : state.t;

  ctx.font = "500 21px ui-monospace, Menlo, monospace";
  ctx.fillStyle = "#9aa0b4";
  ctx.textAlign = "left";
  ctx.fillText("finder · the whole visible window · 380–740 nm", FINDER.x0, 44);
  ctx.fillText("eyepiece · ±20 nm around the crosshair · drag either band", EYE.x0, 282);

  drawBand(FINDER.x0, FINDER.x1, FINDER.y0, FINDER.y1, FINDER.wl0, FINDER.wl1, t, false);
  drawBand(EYE.x0, EYE.x1, EYE.y0, EYE.y1, state.lambda - EYE.span, state.lambda + EYE.span, t, true);

  /* Fraunhofer letters under the finder */
  ctx.font = "500 19px ui-monospace, Menlo, monospace";
  ctx.textAlign = "center";
  for (const f of E.FRAUNHOFER) {
    if (f.id === "b₄" || f.id === "b₃" || f.id === "Hδ" || f.id === "Hγ") continue;
    const x = wlToXf(f.wl);
    if (x < FINDER.x0 + 10 || x > FINDER.x1 - 10) continue;
    ctx.fillStyle = "rgba(154,160,180,.75)";
    ctx.fillText(f.id, x, FINDER.y1 + 26);
    ctx.strokeStyle = "rgba(154,160,180,.28)";
    tick(x, FINDER.y1, FINDER.y1 + 8);
  }

  /* zoom connector: finder window → eyepiece */
  const za = wlToXf(state.lambda - EYE.span), zb = wlToXf(state.lambda + EYE.span);
  ctx.strokeStyle = "rgba(217,164,65,.5)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(za, FINDER.y1 + 40); ctx.lineTo(EYE.x0, EYE.y0 - 26);
  ctx.moveTo(zb, FINDER.y1 + 40); ctx.lineTo(EYE.x1, EYE.y0 - 26);
  ctx.stroke();
  ctx.strokeStyle = "rgba(217,164,65,.8)";
  ctx.beginPath();
  ctx.moveTo(za, FINDER.y1 + 36); ctx.lineTo(za, FINDER.y1 + 44);
  ctx.moveTo(zb, FINDER.y1 + 36); ctx.lineTo(zb, FINDER.y1 + 44);
  ctx.stroke();

  /* eyepiece ticks every 5 nm */
  ctx.font = "500 19px ui-monospace, Menlo, monospace";
  const step = 5;
  for (let wl = Math.ceil((state.lambda - EYE.span) / step) * step; wl <= state.lambda + EYE.span; wl += step) {
    const x = wlToXe(wl);
    ctx.strokeStyle = "rgba(154,160,180,.16)";
    ctx.beginPath(); ctx.moveTo(x, EYE.y0); ctx.lineTo(x, EYE.y1); ctx.stroke();
    ctx.fillStyle = "rgba(154,160,180,.8)";
    ctx.fillText(wl.toFixed(0), x, EYE.y1 + 30);
    ctx.strokeStyle = "rgba(154,160,180,.45)";
    tick(x, EYE.y1, EYE.y1 + 8);
  }

  /* line labels over the eyepiece */
  drawLineLabels(t);

  /* crosshair */
  const xe = wlToXe(state.lambda), xf = wlToXf(state.lambda);
  ctx.strokeStyle = "#d9a441";
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(xf, FINDER.y0 - 6); ctx.lineTo(xf, FINDER.y1 + 6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(xe, EYE.y0 - 18); ctx.lineTo(xe, EYE.y1 + 6); ctx.stroke();
  ctx.fillStyle = "#d9a441";
  ctx.beginPath();
  ctx.moveTo(xe - 7, EYE.y0 - 30); ctx.lineTo(xe + 7, EYE.y0 - 30); ctx.lineTo(xe, EYE.y0 - 18);
  ctx.closePath(); ctx.fill();
  ctx.font = "600 21px ui-monospace, Menlo, monospace";
  ctx.textAlign = "center";
  ctx.fillText(`${state.lambda.toFixed(2)} nm`, Math.min(Math.max(xe, EYE.x0 + 66), EYE.x1 - 66), EYE.y0 - 38);
}

function drawBand(x0, x1, y0, y1, wl0, wl1, t, trace) {
  ctx.fillStyle = "#05070d";
  ctx.fillRect(x0 - 2, y0, x1 - x0 + 4, y1 - y0);
  const n = Math.round(x1 - x0);
  for (let i = 0; i < n; i++) {
    const wl = wl0 + ((wl1 - wl0) * i) / n;
    const I = E.spectrum(t, wl, state.scene);
    const c = E.wavelengthToRGB(wl);
    const d = E.displayIntensity(I);
    ctx.fillStyle = `rgb(${Math.round(255 * c.r * d)},${Math.round(255 * c.g * d)},${Math.round(255 * c.b * d)})`;
    ctx.fillRect(x0 + i, y0, 1.2, y1 - y0);
  }
  if (trace) {
    ctx.strokeStyle = "rgba(240,238,228,.85)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= n; i += 2) {
      const wl = wl0 + ((wl1 - wl0) * i) / n;
      const I = E.spectrum(t, wl, state.scene);
      const y = y1 - (Math.min(I, TRACE_MAX) / TRACE_MAX) * (y1 - y0);
      if (i === 0) ctx.moveTo(x0 + i, y); else ctx.lineTo(x0 + i, y);
    }
    ctx.stroke();
  }
  ctx.strokeStyle = "#232a3d";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x0 - 2, y0, x1 - x0 + 4, y1 - y0);
}

function drawLineLabels(t) {
  const feats = [];
  if (state.scene === "corona") {
    for (const l of E.CORONAL_LINES) feats.push({ wl: l.wl, label: l.id === "green" ? "530.3 ?" : "637.4 Fe XIII", kind: l.unknown1869 ? "stranger" : "known" });
  } else {
    if (E.uncovered(state.t) > 0.008) {
      for (const l of E.FRAUNHOFER) feats.push({ wl: l.wl, label: l.id, kind: "abs" });
    }
    const e = E.emission(state.t, state.scene);
    if (e > 0.06) {
      for (const l of E.FLASH_LINES) {
        if (l.strength * e < 0.05) continue;
        feats.push({ wl: l.wl, label: l.id, kind: l.helium ? "stranger" : "emis" });
      }
    }
  }
  feats.sort((a, b) => a.wl - b.wl);
  let lastX = -1e9;
  for (const f of feats) {
    const x = wlToXe(f.wl);
    if (x < EYE.x0 + 14 || x > EYE.x1 - 14) continue;
    if (x - lastX < 62) continue;                       // de-clutter overlaps
    lastX = x;
    const color = f.kind === "stranger" ? "#d96a4a" : (f.kind === "emis" ? "#6fc3b7" : "rgba(154,160,180,.7)");
    ctx.font = f.kind === "stranger" ? "700 21px ui-monospace, Menlo, monospace" : "500 19px ui-monospace, Menlo, monospace";
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.fillText(f.label, x, EYE.y0 + 26);
    ctx.strokeStyle = color;
    ctx.lineWidth = f.kind === "stranger" ? 2 : 1;
    ctx.setLineDash(f.kind === "stranger" ? [5, 4] : []);
    ctx.beginPath(); ctx.moveTo(x, EYE.y0 + 34); ctx.lineTo(x, EYE.y0 + 48); ctx.stroke();
    ctx.setLineDash([]);
  }
}

function tick(x, y0, y1) {
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
}

/* the eclipsed disk — both disks to scale; the Moon is a hair bigger than
 * the Sun, which is why totality happens at all */
function drawDisk() {
  const w = disk.width, h = disk.height, cx = w / 2, cy = h / 2;
  dctx.clearRect(0, 0, w, h);
  dctx.fillStyle = "#05070d";
  dctx.fillRect(0, 0, w, h);
  for (const [sx, sy] of STARS) {
    dctx.fillStyle = "rgba(233,228,214,.7)";
    dctx.fillRect(sx, sy, 2.6, 2.6);
  }
  const t = state.scene === "corona" ? E.TOTALITY_HALF : state.t;
  const sep = E.separation(t);              // arcmin between centres
  const px = 9.2;                           // px per arcmin
  const Rs = 15.9 * px, Rm = 16.6 * px;
  const offPx = sep * px;                   // Moon slides in from the right
  const unc = E.uncovered(t);

  /* corona glow during totality */
  if (unc === 0) {
    const glow = dctx.createRadialGradient(cx, cy, Rm * 0.95, cx, cy, Rm * 2.4);
    glow.addColorStop(0, "rgba(240,236,220,.5)");
    glow.addColorStop(0.35, "rgba(240,236,220,.16)");
    glow.addColorStop(1, "rgba(240,236,220,0)");
    dctx.fillStyle = glow;
    dctx.beginPath(); dctx.arc(cx, cy, Rm * 2.4, 0, Math.PI * 2); dctx.fill();
  }

  /* photosphere */
  dctx.fillStyle = "#fdf4dc";
  dctx.beginPath(); dctx.arc(cx, cy, Rs, 0, Math.PI * 2); dctx.fill();

  /* Moon */
  const mx = cx + offPx;
  dctx.fillStyle = "#070a12";
  dctx.beginPath(); dctx.arc(mx, cy, Rm, 0, Math.PI * 2); dctx.fill();
  dctx.strokeStyle = "rgba(154,160,180,.5)";
  dctx.lineWidth = 2;
  dctx.beginPath(); dctx.arc(mx, cy, Rm, 0, Math.PI * 2); dctx.stroke();

  dctx.font = "500 20px ui-monospace, Menlo, monospace";
  dctx.fillStyle = "rgba(154,160,180,.85)";
  dctx.textAlign = "left";
  dctx.fillText("Sun", 16, h - 48);
  dctx.fillText("Moon", w - 74, h - 48);
  dctx.textAlign = "center";
  dctx.fillStyle = "#d9a441";
  dctx.fillText(unc === 0 ? "TOTALITY" : `photosphere ${(unc * 100).toFixed(1)}%`, cx, h - 16);
}

/* ── panels ──────────────────────────────────────────────────────────── */
function phaseText() {
  if (state.scene === "corona") return "mid-totality · 1869 · corona only";
  const t = state.t;
  if (t < -240) return "partial · the crescent thins";
  if (t < -60) return "partial · almost gone";
  if (t < -1) return "last light · the chromosphere peeks";
  if (t < 8) return "TOTALITY — the flash!";
  if (t < E.C3 - 8) return "totality · ring + prominences";
  if (t <= E.C3 + 8) return "third contact — flash again";
  return "partial again · crescent returning";
}

function renderPanels() {
  $("phaseLabel").textContent = phaseText();
  const tShow = state.scene === "corona" ? "—" : `t = ${state.t >= 0 ? "+" : "−"}${Math.abs(state.t).toFixed(0)} s`;
  $("clockLabel").textContent = tShow;
  const unc = E.uncovered(state.scene === "corona" ? E.TOTALITY_HALF : state.t);
  $("uncLabel").textContent = `photosphere ${state.scene === "corona" ? 0 : (unc * 100).toFixed(1)}%`;
  clock.value = state.t;
  clock.disabled = state.scene === "corona";

  /* catalogue */
  const lib = E.matchLibrary(state.lambda, state.scene);
  const rows = $("catalogue");
  rows.innerHTML = "";
  for (const entry of E.LIBRARY_1868) {
    const li = document.createElement("li");
    const isMatch = lib && lib.wl === entry.wl;
    if (isMatch) li.classList.add("matched");
    if (state.measured.has(entry.id)) li.classList.add("measured");
    const left = document.createElement("span");
    left.textContent = `${entry.id} · ${entry.el}`;
    const right = document.createElement("span");
    right.innerHTML = `<span class="tick"></span> <span class="wl">${entry.wl.toFixed(2)}</span>`;
    li.append(left, right);
    rows.append(li);
  }
  $("measuredBadge").textContent = `measured ${state.measured.size} / ${E.LIBRARY_1868.length}`;
  $("catalogueTitle").textContent = state.scene === "corona" ? "catalogue: closed in 1869" : "1868 line catalogue";

  /* eyepiece readout + claim */
  $("lambdaLabel").textContent = `λ = ${state.lambda.toFixed(2)} nm`;
  const feat = E.nearestFeature(state.scene === "corona" ? E.TOTALITY_HALF : state.t, state.lambda, state.scene);
  const matchEl = $("matchLabel");
  const claimBtn = $("claimBtn");
  if (lib) {
    matchEl.className = "match known";
    matchEl.textContent = `${lib.id} — catalogued (${lib.el})`;
  } else if (feat && feat.kind === "emission") {
    matchEl.className = "match unknown";
    matchEl.textContent = state.scene === "corona"
      ? `${feat.line.wl.toFixed(1)} nm — no laboratory spectrum matches`
      : `${feat.line.wl.toFixed(1)} nm — nothing in the catalogue. A stranger.`;
  } else if (feat) {
    matchEl.className = "match known";
    matchEl.textContent = `${feat.line.id} absorption (${feat.line.el})`;
  } else {
    matchEl.className = "match nothing";
    matchEl.textContent = "continuum — park the crosshair on a line";
  }

  const strangerHere = feat && feat.kind === "emission" && !lib;
  claimBtn.hidden = !strangerHere;
  claimBtn.textContent = state.scene === "corona" ? "claim the green line →" : "claim a new element →";

  /* session tracking */
  if (lib) state.measured.add(lib.id);
  if (feat && feat.kind === "emission" && !lib) state.strangers.add(feat.line.id);

  /* kirchhoff strip */
  const emisActive = state.scene === "corona" || unc < 0.015;
  setKirchhoff(emisActive ? "emis" : "abs");
  $("kirchhoffCaption").textContent = emisActive
    ? "Totality is law 2: the thin hot chromosphere, unveiled, shines in bright lines."
    : "The uneclipsed Sun is law 3: its cool outer gas eats dark lines out of the continuum.";
}

function setKirchhoff(active) {
  for (const fig of document.querySelectorAll("#kirchhoff figure")) {
    fig.classList.toggle("active", fig.dataset.k === active);
  }
}

function initKirchhoff() {
  const draw = (svg, kind) => {
    let inner = "";
    for (let x = 0; x < 120; x += 2) {
      const wl = 400 + (x / 120) * 300;
      const c = E.wavelengthToRGB(wl);
      const dim = kind === "cont" ? 1 : kind === "emis" ? 0.05 : 0.75;
      const rgb = `rgb(${Math.round(255 * c.r * dim)},${Math.round(255 * c.g * dim)},${Math.round(255 * c.b * dim)})`;
      inner += `<rect x="${x}" y="6" width="2.4" height="32" fill="${rgb}"/>`;
    }
    if (kind === "emis") {
      for (const wl of [436, 486, 518, 560, 588, 656]) {
        const c = E.wavelengthToRGB(wl);
        inner += `<rect x="${((wl - 400) / 300) * 120 - 3}" y="6" width="6" height="32" fill="rgb(${Math.round(255 * c.r)},${Math.round(255 * c.g)},${Math.round(255 * c.b)})"/>`;
      }
    }
    if (kind === "abs") {
      for (const wl of [431, 486, 518, 589, 656]) {
        inner += `<rect x="${((wl - 400) / 300) * 120 - 3}" y="6" width="6" height="32" fill="#05070d"/>`;
      }
    }
    svg.innerHTML = inner;
  };
  for (const fig of document.querySelectorAll("#kirchhoff figure")) {
    draw(fig.querySelector("svg"), fig.dataset.k);
  }
}

/* ── verdict ─────────────────────────────────────────────────────────── */
function showVerdict() {
  const total = state.measured.size + state.strangers.size;
  const v = state.lastVerdict = E.verdict(
    state.lambda, state.scene, total,
    state.scene === "corona" ? E.TOTALITY_HALF : state.t,
  );
  $("verdictEyebrow").textContent = state.scene === "corona"
    ? "one year later · the corona at mid-totality" : "telegram from Guntur · 19 August 1868";
  $("verdictTitle").textContent = v.title;
  const body = $("verdictBody");
  body.innerHTML = "";
  v.lines.forEach((line, i) => {
    const p = document.createElement("p");
    if (v.ok && i >= v.lines.length - 2) p.className = "hist";
    if (!v.ok && i === v.lines.length - 1) p.className = "hist";
    p.textContent = line;
    body.append(p);
  });
  $("verdict").hidden = false;
}

/* ── interaction ─────────────────────────────────────────────────────── */
function pointerLambda(event) {
  const rect = scope.getBoundingClientRect();
  const x = (event.clientX - rect.left) * (W / rect.width);
  const y = (event.clientY - rect.top) * (H / rect.height);
  if (y < FINDER.y1 + 60) return clamp(xToWlf(x));
  return clamp(xToWle(x));
}
const clamp = (wl) => Math.max(385, Math.min(735, wl));

let dragging = false;
scope.addEventListener("pointerdown", (e) => {
  dragging = true;
  scope.setPointerCapture(e.pointerId);
  state.lambda = pointerLambda(e);
  render();
});
scope.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  state.lambda = pointerLambda(e);
  render();
});
scope.addEventListener("pointerup", () => { dragging = false; });

clock.addEventListener("input", () => {
  state.t = parseFloat(clock.value);
  render();
});
document.querySelectorAll("#phaseChips .chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    setScene("guntur");
    state.t = parseFloat(chip.dataset.t);
    render();
  });
});
$("playBtn").addEventListener("click", () => {
  state.playing = !state.playing;
  $("playBtn").textContent = state.playing ? "❚❚ pause" : "▶ slow play ×6";
  if (state.playing) requestAnimationFrame(playFrame);
});
function playFrame() {
  if (!state.playing) return;
  state.t = Math.min(E.T_MAX, state.t + state.playRate / 30);
  render();
  if (state.t >= E.T_MAX) {
    state.playing = false;
    $("playBtn").textContent = "▶ slow play ×6";
    return;
  }
  requestAnimationFrame(playFrame);
}
$("claimBtn").addEventListener("click", showVerdict);
$("verdictClose").addEventListener("click", () => { $("verdict").hidden = true; });

function setScene(scene) {
  state.scene = scene;
  state.playing = false;
  $("playBtn").textContent = "▶ slow play ×6";
  $("sceneGuntur").classList.toggle("active", scene === "guntur");
  $("sceneCorona").classList.toggle("active", scene === "corona");
  if (scene === "corona") {
    state.lambda = 530.29;
  } else {
    state.lambda = Math.min(735, Math.max(385, state.lambda));
  }
  render();
}
$("sceneGuntur").addEventListener("click", () => setScene("guntur"));
$("sceneCorona").addEventListener("click", () => setScene("corona"));

function render() {
  drawScope();
  drawDisk();
  renderPanels();
}

/* ── the deterministic demo API the video renderer drives ────────────── */
window.__demo = {
  setPhase(t) { state.t = Math.max(E.T_MIN, Math.min(E.T_MAX, t)); render(); },
  phase() { return state.t; },
  setLambda(wl) { state.lambda = clamp(wl); render(); },
  lambda() { return state.lambda; },
  /* crosshair position in page CSS pixels — the video cursor follows it */
  crosshairScreenPos() {
    const r = scope.getBoundingClientRect();
    return {
      x: wlToXe(state.lambda) * (r.width / W) + r.left,
      y: ((EYE.y0 + EYE.y1) / 2) * (r.height / H) + r.top,
    };
  },
  setScene(name) { setScene(name); },
  scene() { return state.scene; },
  claim() { showVerdict(); return state.lastVerdict.kind; },
  closeVerdict() { $("verdict").hidden = true; render(); },
  state() {
    return {
      t: state.t, lambda: state.lambda, scene: state.scene,
      measured: [...state.measured].length, strangers: [...state.strangers].length,
      verdict: state.lastVerdict ? state.lastVerdict.kind : null,
    };
  },
  /* advance the eclipse clock deterministically (sim seconds) */
  step(dtSim, options = {}) {
    const { dtStep } = options;
    if (dtStep) {
      const steps = Math.max(1, Math.round(dtSim / dtStep));
      for (let i = 0; i < steps; i++) {
        state.t = Math.min(E.T_MAX, state.t + dtStep);
      }
    } else {
      state.t = Math.min(E.T_MAX, state.t + dtSim);
    }
    render();
  },
  setPaused() { state.playing = false; },
};

initKirchhoff();
render();
