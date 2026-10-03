/* Falling forever — UI wiring: two canvas benches + WebAudio beeps.
   Exposes window.ffApp for tests and the video capture. */
(function () {
  "use strict";
  const ff = window.fallingForever;
  const fmt = (n, d = 0) => n.toLocaleString("en-US", { maximumFractionDigits: d });

  // Deterministic stars/hills so every render (and every video frame) matches.
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ------------------------------------------------ bench I: the cannon */
  const cannon = document.getElementById("cannon-canvas");
  const cctx = cannon.getContext("2d");
  const CW = cannon.width, CH = cannon.height;      // 1340 x 640
  const R_PX = 330;
  const EARTH_CX = CW / 2, EARTH_CY = 460 + R_PX;   // surface peeks at y=460
  const SCALE = R_PX / ff.R_EARTH;
  const MOUNTAIN_PX = ff.MOUNTAIN_H * SCALE;
  const PALETTE = ["#e3b341", "#7fd4d4", "#d98a70", "#b39ddb", "#9ccc9c", "#82b1ff", "#e6b8a2"];
  const toScreen = (p) => [EARTH_CX + p[0] * SCALE, EARTH_CY - p[1] * SCALE];

  let shots = [];
  let lastResult = null;

  function drawCannon() {
    cctx.clearRect(0, 0, CW, CH);
    // stars
    const rand = mulberry32(19571004);
    for (let i = 0; i < 130; i++) {
      const x = rand() * CW, y = rand() * CH, r = rand();
      if (Math.hypot(x - EARTH_CX, y - (EARTH_CY - 40)) < R_PX * 0.8) continue;
      cctx.globalAlpha = 0.25 + 0.6 * r;
      cctx.fillStyle = "#cfd8ec";
      cctx.fillRect(x, y, r > 0.85 ? 2 : 1, r > 0.85 ? 2 : 1);
    }
    cctx.globalAlpha = 1;

    // Earth disk with a lit limb
    const grad = cctx.createRadialGradient(EARTH_CX - R_PX * 0.3, EARTH_CY - R_PX * 1.25, R_PX * 0.2,
                                           EARTH_CX, EARTH_CY, R_PX);
    grad.addColorStop(0, "#233350");
    grad.addColorStop(1, "#0c1220");
    cctx.fillStyle = grad;
    cctx.beginPath();
    cctx.arc(EARTH_CX, EARTH_CY, R_PX, 0, 2 * Math.PI);
    cctx.fill();
    cctx.strokeStyle = "#4a5c85";
    cctx.lineWidth = 1.4;
    cctx.stroke();
    // faint meridians to sell the sphere
    cctx.strokeStyle = "rgba(120,140,190,0.18)";
    cctx.lineWidth = 1;
    for (const off of [-0.5, -0.25, 0.25, 0.5]) {
      cctx.beginPath();
      cctx.ellipse(EARTH_CX, EARTH_CY, R_PX * Math.abs(off), R_PX, 0, 0, 2 * Math.PI);
      cctx.stroke();
    }
    // night-side city speckle near the limb
    const rand2 = mulberry32(4104);
    for (let i = 0; i < 90; i++) {
      const a = rand2() * Math.PI, rr = R_PX * (0.35 + 0.63 * rand2());
      const x = EARTH_CX + Math.cos(a) * rr, y = EARTH_CY - Math.sin(a) * rr * 0.98;
      cctx.fillStyle = "rgba(227,179,65,0.5)";
      cctx.fillRect(x, y, 1.2, 1.2);
    }

    // launch-altitude circle
    cctx.setLineDash([3, 5]);
    cctx.strokeStyle = "rgba(127,212,212,0.30)";
    cctx.beginPath();
    cctx.arc(EARTH_CX, EARTH_CY, R_PX + MOUNTAIN_PX, 0, 2 * Math.PI);
    cctx.stroke();
    cctx.setLineDash([]);
    cctx.fillStyle = "rgba(127,212,212,0.55)";
    cctx.font = "11px ui-monospace, Menlo, monospace";
    cctx.fillText("500 km launch circle", EARTH_CX + R_PX + MOUNTAIN_PX + 8, EARTH_CY - R_PX - MOUNTAIN_PX + 14);

    // mountain + cannon
    const mx = EARTH_CX, my = EARTH_CY - R_PX;
    cctx.fillStyle = "#39445f";
    cctx.beginPath();
    cctx.moveTo(mx - 26, my + 2);
    cctx.lineTo(mx, my - MOUNTAIN_PX);
    cctx.lineTo(mx + 26, my + 2);
    cctx.closePath();
    cctx.fill();
    cctx.strokeStyle = "#e9e3d2";
    cctx.lineWidth = 3;
    cctx.beginPath();
    cctx.moveTo(mx, my - MOUNTAIN_PX);
    cctx.lineTo(mx + 30, my - MOUNTAIN_PX - 6);
    cctx.stroke();
    cctx.fillStyle = "#e9e3d2";
    cctx.beginPath();
    cctx.arc(mx, my - MOUNTAIN_PX, 3, 0, 2 * Math.PI);
    cctx.fill();

    // shots
    shots.forEach((shot, index) => {
      const color = shot.color;
      cctx.strokeStyle = color;
      cctx.lineWidth = 1.8;
      cctx.beginPath();
      shot.points.forEach((p, i) => {
        const [sx, sy] = toScreen(p);
        if (i === 0) cctx.moveTo(sx, sy); else cctx.lineTo(sx, sy);
      });
      cctx.stroke();
      if (shot.result === "impact") {
        const [ix, iy] = toScreen(shot.points[shot.points.length - 1]);
        cctx.strokeStyle = color;
        cctx.lineWidth = 2;
        cctx.beginPath();
        cctx.moveTo(ix - 5, iy - 5); cctx.lineTo(ix + 5, iy + 5);
        cctx.moveTo(ix + 5, iy - 5); cctx.lineTo(ix - 5, iy + 5);
        cctx.stroke();
      }
      // label on a staggered shelf above the highest point, with a leader line
      let top = shot.points[0], topY = -1;
      shot.points.forEach((p) => { if (p[1] > topY) { topY = p[1]; top = p; } });
      const [ax, ay] = toScreen(top);
      const label = shotLabel(shot);
      cctx.font = "12px ui-monospace, Menlo, monospace";
      const wText = cctx.measureText(label).width;
      const shelfY = Math.max(30, ay - 26 - 15 * (shot.tag % 3));
      let shelfX = Math.max(34, Math.min(CW - wText - 34, ax - wText / 2 + (shot.tag % 2 ? 46 : -46)));
      cctx.strokeStyle = "rgba(233,227,210,0.28)";
      cctx.lineWidth = 1;
      cctx.beginPath();
      cctx.moveTo(ax, ay - 4);
      cctx.lineTo(shelfX + wText / 2, shelfY + 12);
      cctx.stroke();
      cctx.fillStyle = color;
      cctx.fillText(label, shelfX, shelfY);
    });
  }

  function shotLabel(shot) {
    if (shot.result === "impact") return `${shot.v0.toFixed(2)} → ${fmt(shot.downrangeKm)} km`;
    if (shot.result === "orbit") return `${shot.v0.toFixed(2)} → orbit · ${shot.periodMin.toFixed(0)} min`;
    return `${shot.v0.toFixed(2)} → escape`;
  }

  const verdictEl = document.getElementById("verdict");
  const shotsEl = document.getElementById("shots");

  function verdictFor(shot) {
    if (shot.result === "impact") {
      const mm = Math.floor(shot.flightSec / 60), ss = Math.round(shot.flightSec % 60);
      const extra = shot.downrangeKm > 6000
        ? " The ground kept curving away under the shot."
        : shot.downrangeKm < 900 ? " At these speeds the curve of the Earth barely matters." : "";
      return `<b>${shot.v0.toFixed(2)} km/s</b> — impact after ${mm}:${String(ss).padStart(2, "0")}, ` +
             `<b>${fmt(shot.downrangeKm)} km</b> downrange.${extra}`;
    }
    if (shot.result === "orbit") {
      return `<b>${shot.v0.toFixed(2)} km/s</b> — it never lands. Perigee <b>${fmt(shot.perigeeKm)} km</b>, ` +
             `apogee <b>${fmt(shot.apogeeKm)} km</b>, one lap every <b>${shot.periodMin.toFixed(1)} min</b>. ` +
             `It is falling the whole time; the ground just keeps leaving.`;
    }
    return `<b>${shot.v0.toFixed(2)} km/s</b> — positive energy. It is not coming back.`;
  }

  function refreshShotList() {
    shotsEl.innerHTML = "";
    shots.forEach((s) => {
      const li = document.createElement("li");
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.style.background = s.color;
      li.appendChild(chip);
      const span = document.createElement("span");
      span.textContent =
        s.result === "impact" ? `${s.v0.toFixed(2)} km/s → impact ${fmt(s.downrangeKm)} km`
        : s.result === "orbit" ? `${s.v0.toFixed(2)} km/s → orbit, ${s.periodMin.toFixed(1)} min`
        : `${s.v0.toFixed(2)} km/s → escape`;
      li.appendChild(span);
      shotsEl.appendChild(li);
    });
  }

  function fire(v) {
    if (typeof v !== "number") v = parseFloat(speedSlider.value);
    const shot = ff.simulateShot(v * 1000, ff.MOUNTAIN_H);
    shot.v0 = v;
    shot.tag = shots.length;
    shot.color = PALETTE[shots.length % PALETTE.length];
    shots.push(shot);
    if (shots.length > 7) shots.shift();
    lastResult = shot.result;
    verdictEl.innerHTML = verdictFor(shot);
    refreshShotList();
    drawCannon();
    return shot.result;
  }

  const speedSlider = document.getElementById("speed-slider");
  const speedValue = document.getElementById("speed-value");
  speedSlider.addEventListener("input", () => { speedValue.textContent = parseFloat(speedSlider.value).toFixed(2); });
  document.getElementById("fire").addEventListener("click", () => fire());
  document.getElementById("clear").addEventListener("click", () => {
    shots = []; lastResult = null; refreshShotList(); drawCannon();
    verdictEl.innerHTML = "The bench is loaded. First shot at " + parseFloat(speedSlider.value).toFixed(2) + " km/s?";
  });
  document.getElementById("presets").addEventListener("click", (e) => {
    const v = e.target.dataset && e.target.dataset.v;
    if (!v) return;
    speedSlider.value = v;
    speedValue.textContent = parseFloat(v).toFixed(2);
    fire(parseFloat(v));
  });

  /* ------------------------------------------------- bench II: the beep */
  const sky = document.getElementById("sky-canvas");
  const sctx = sky.getContext("2d");
  const SW = sky.width, SH = sky.height;            // 1340 x 640
  const SKY_R = 860;                                 // sky view occupies x 0..860
  const CHART_X = 960, CHART_W = SW - CHART_X - 40;  // doppler chart, clear gutter between
  const CHART_Y = 70, CHART_H = 450;

  let peakDeg = 90;
  let driftOn = false;
  let soundOn = true;
  let pass = null;                                   // sampled pass
  let play = { active: false, t0: 0, duration: 13000, progress: 0, raf: 0 };
  let audioCtx = null;

  const PASS_SECONDS_ON_SCREEN = 13;

  function resample() {
    pass = ff.samplePass(peakDeg, 900);
    play.progress = 0;
    drawSky();
    updateReadouts(null);
  }

  function sampleAt(tReal) {                         // linear interpolation on pass.points
    const pts = pass.points;
    const t0 = pts[0].t, span = pts[pts.length - 1].t - t0;
    const f = Math.max(0, Math.min(1, (tReal - t0) / span));
    const idx = Math.min(pts.length - 2, Math.floor(f * (pts.length - 1)));
    const a = pts[idx], b = pts[idx + 1];
    const w = f * (pts.length - 1) - idx;
    const lerp = (x, y) => x + (y - x) * w;
    return { t: tReal, elevRad: lerp(a.elevRad, b.elevRad), rangeM: lerp(a.rangeM, b.rangeM),
             vr: lerp(a.vr, b.vr), dopplerHz: lerp(a.dopplerHz, b.dopplerHz),
             azRad: lerp(a.azRad, b.azRad) };
  }

  const beatAt = (tReal) =>
    ff.IF_HZ + sampleAt(tReal).dopplerHz + (driftOn ? ff.driftHz(tReal) : 0);

  const roElev = document.getElementById("ro-elev");
  const roRange = document.getElementById("ro-range");
  const roVr = document.getElementById("ro-vr");
  const roBeat = document.getElementById("ro-beat");
  const roDf = document.getElementById("ro-df");

  function updateReadouts(s) {
    if (!s) {
      roElev.textContent = "—"; roRange.textContent = "—"; roVr.textContent = "—";
      roBeat.textContent = "—"; roDf.textContent = "—";
      return;
    }
    roElev.textContent = (s.elevRad * 180 / Math.PI).toFixed(1) + "°";
    roRange.textContent = fmt(s.rangeM / 1000) + " km";
    roVr.textContent = (s.vr > 0 ? "+" : "−") + fmt(Math.abs(s.vr)) + " m/s";
    roDf.textContent = (s.dopplerHz > 0 ? "+" : "−") + fmt(Math.abs(s.dopplerHz)) + " Hz";
    roBeat.textContent = Math.round(beatAt(s.t)) + " Hz";
  }

  function drawSky() {
    sctx.clearRect(0, 0, SW, SH);
    const pts = pass.points;
    const azs = pts.map((p) => p.azRad);
    const azMin = Math.min(...azs), azMax = Math.max(...azs);
    const azPad = (azMax - azMin) * 0.06 + 0.02;
    const azLo = azMin - azPad, azHi = azMax + azPad;
    const X = (az) => 60 + ((az - azLo) / (azHi - azLo)) * (SKY_R - 120);
    const Y = (el) => 560 - (el / (Math.PI / 2)) * 470;

    // sky background & elevation grid
    sctx.fillStyle = "#0a0e17";
    sctx.fillRect(0, 0, SKY_R, SH);
    sctx.strokeStyle = "rgba(90,105,145,0.25)";
    sctx.lineWidth = 1;
    sctx.font = "11px ui-monospace, Menlo, monospace";
    sctx.fillStyle = "#8b96ad";
    for (const el of [30, 60]) {
      sctx.beginPath(); sctx.moveTo(46, Y(el * Math.PI / 180)); sctx.lineTo(SKY_R - 26, Y(el * Math.PI / 180)); sctx.stroke();
      sctx.fillText(el + "°", 12, Y(el * Math.PI / 180) + 4);
    }
    for (let az = -180; az <= 180; az += 30) {
      const x = X(az * Math.PI / 180);
      if (x < 46 || x > SKY_R - 26) continue;
      sctx.beginPath(); sctx.moveTo(x, 44); sctx.lineTo(x, 545); sctx.stroke();
      sctx.fillText((az > 0 ? "E" : az < 0 ? "W" : "S") + Math.abs(az) + "°", x - 14, 34);
    }
    sctx.fillStyle = "#8b96ad";
    sctx.fillText("zenith", X(0) - 20, 22);
    // divider between the two charts
    sctx.strokeStyle = "#26304a";
    sctx.beginPath(); sctx.moveTo(910, 20); sctx.lineTo(910, SH - 20); sctx.stroke();

    // hills silhouette
    sctx.fillStyle = "#131a29";
    sctx.beginPath();
    sctx.moveTo(0, SH);
    const rand3 = mulberry32(571);
    sctx.lineTo(0, 560);
    for (let x = 0; x <= SKY_R; x += 40) {
      sctx.quadraticCurveTo(x + 20, 552 - rand3() * 26, x + 40, 556 - rand3() * 14);
    }
    sctx.lineTo(SKY_R, SH);
    sctx.closePath();
    sctx.fill();
    // observer + antenna
    sctx.strokeStyle = "#e9e3d2";
    sctx.lineWidth = 2;
    sctx.beginPath();
    sctx.arc(SKY_R / 2, 596, 7, 0, 2 * Math.PI);
    sctx.stroke();
    sctx.beginPath();
    sctx.moveTo(SKY_R / 2 + 7, 594); sctx.lineTo(SKY_R / 2 + 34, 566);
    sctx.moveTo(SKY_R / 2 + 34, 566); sctx.lineTo(SKY_R / 2 + 26, 566);
    sctx.moveTo(SKY_R / 2 + 34, 566); sctx.lineTo(SKY_R / 2 + 34, 574);
    sctx.stroke();
    sctx.fillStyle = "#5d6983";
    sctx.fillText("you · 20.005 MHz", SKY_R / 2 + 44, 596);

    // predicted path (faint), broken at the zenith where az is meaningless
    sctx.strokeStyle = "rgba(227,179,65,0.30)";
    sctx.lineWidth = 1.5;
    sctx.setLineDash([5, 6]);
    sctx.beginPath();
    let prevAz = pts[0].azRad;
    pts.forEach((p, i) => {
      const x = X(p.azRad), y = Y(p.elevRad);
      if (i === 0 || Math.abs(p.azRad - prevAz) > 0.35) sctx.moveTo(x, y); else sctx.lineTo(x, y);
      prevAz = p.azRad;
    });
    sctx.stroke();
    sctx.setLineDash([]);
    let ca = pts[0];
    pts.forEach((p) => { if (p.elevRad > ca.elevRad) ca = p; });
    sctx.strokeStyle = "rgba(127,212,212,0.8)";
    sctx.beginPath();
    sctx.arc(X(ca.azRad), Y(ca.elevRad), 6, 0, 2 * Math.PI);
    sctx.stroke();
    sctx.fillStyle = "rgba(127,212,212,0.9)";
    const caRight = X(ca.azRad) > SKY_R - 130;
    sctx.fillText("closest · Δf = 0", caRight ? X(ca.azRad) - 108 : X(ca.azRad) + 10, Y(ca.elevRad) - 8);

    // current satellite
    const prog = play.progress;
    const sNow = prog > 0 ? sampleAt(pts[0].t + prog * (pts[pts.length - 1].t - pts[0].t)) : null;
    if (sNow) {
      const sx = X(sNow.azRad), sy = Y(sNow.elevRad);
      // travelled part of the path, solid (broken at the zenith)
      sctx.strokeStyle = "#e3b341";
      sctx.lineWidth = 2.4;
      sctx.beginPath();
      const upto = Math.floor(prog * (pts.length - 1));
      let prevAz = pts[0].azRad;
      for (let i = 0; i <= upto; i++) {
        const x = X(pts[i].azRad), y = Y(pts[i].elevRad);
        if (i === 0 || Math.abs(pts[i].azRad - prevAz) > 0.35) sctx.moveTo(x, y); else sctx.lineTo(x, y);
        prevAz = pts[i].azRad;
      }
      sctx.stroke();
      // line of sight
      sctx.setLineDash([2, 5]);
      sctx.strokeStyle = "rgba(233,227,210,0.5)";
      sctx.lineWidth = 1;
      sctx.beginPath(); sctx.moveTo(SKY_R / 2, 590); sctx.lineTo(sx, sy); sctx.stroke();
      sctx.setLineDash([]);
      // satellite: little sphere with antenna whips
      sctx.fillStyle = "#e9e3d2";
      sctx.beginPath(); sctx.arc(sx, sy, 6, 0, 2 * Math.PI); sctx.fill();
      sctx.strokeStyle = "#e9e3d2"; sctx.lineWidth = 1.2;
      for (const d of [-1, 1]) {
        sctx.beginPath(); sctx.moveTo(sx, sy); sctx.lineTo(sx + d * 12, sy - d * 6); sctx.stroke();
      }
      sctx.fillStyle = "#9aa3b8";
      sctx.font = "12px ui-monospace, Menlo, monospace";
      sctx.fillText(`range ${fmt(sNow.rangeM / 1000)} km`, sx + 14, sy - 10);
    }

    drawChart(prog);
  }

  function drawChart(prog) {
    const pts = pass.points;
    const tLo = pts[0].t, tHi = pts[pts.length - 1].t;
    const dfMax = Math.max(520, Math.max(...pts.map((p) => Math.abs(p.dopplerHz))) * 1.15);
    const CX = (t) => CHART_X + ((t - tLo) / (tHi - tLo)) * CHART_W;
    const CY = (df) => CHART_Y + CHART_H / 2 - (df / dfMax) * (CHART_H / 2);

    sctx.fillStyle = "#0a0e17";
    sctx.fillRect(CHART_X, CHART_Y, CHART_W, CHART_H);
    sctx.strokeStyle = "#26304a";
    sctx.strokeRect(CHART_X, CHART_Y, CHART_W, CHART_H);

    sctx.font = "11px ui-monospace, Menlo, monospace";
    sctx.fillStyle = "#8b96ad";
    sctx.fillText("received Doppler · Hz", CHART_X, CHART_Y - 10);
    sctx.strokeStyle = "rgba(90,105,145,0.3)";
    sctx.beginPath(); sctx.moveTo(CHART_X, CY(0)); sctx.lineTo(CHART_X + CHART_W, CY(0)); sctx.stroke();
    for (const v of [400, -400]) {
      sctx.beginPath(); sctx.moveTo(CHART_X, CY(v)); sctx.lineTo(CHART_X + CHART_W, CY(v)); sctx.stroke();
      sctx.fillText((v > 0 ? "+" : "") + v, CHART_X + 8, CY(v) - 5);
    }
    sctx.fillStyle = "#7fd4d4";
    sctx.fillText("approaching", CHART_X + 8, CY(400) + 18);
    sctx.fillStyle = "#d98a70";
    sctx.fillText("receding", CHART_X + 8, CY(-400) - 8);
    const midMin = ((tLo + tHi) / 2) / 60;
    sctx.fillStyle = "#8b96ad";
    sctx.fillText(`pass time · min`, CHART_X, CHART_Y + CHART_H + 22);
    sctx.fillText(`compressed ×${Math.round((tHi - tLo) / PASS_SECONDS_ON_SCREEN)}`,
                  CHART_X + CHART_W - 150, CHART_Y + CHART_H + 22);

    // drift ghost
    if (driftOn) {
      sctx.strokeStyle = "rgba(154,163,184,0.35)";
      sctx.lineWidth = 1;
      sctx.setLineDash([2, 4]);
      sctx.beginPath();
      pts.forEach((p, i) => {
        const x = CX(p.t), y = CY(p.dopplerHz + ff.driftHz(p.t));
        if (i === 0) sctx.moveTo(x, y); else sctx.lineTo(x, y);
      });
      sctx.stroke();
      sctx.setLineDash([]);
      sctx.fillStyle = "#9aa3b8";
      sctx.fillText("grey: transmitter thermal drift ±0.7 kHz", CHART_X + 8, CHART_Y + 32);
    }

    // curve up to playhead; idle shows the whole prediction faintly
    const upto = Math.max(1, Math.floor(prog * (pts.length - 1)));
    sctx.globalAlpha = prog === 0 ? 0.35 : 1;
    sctx.strokeStyle = "#e3b341";
    sctx.lineWidth = 2;
    sctx.beginPath();
    for (let i = 0; i <= upto; i++) {
      const x = CX(pts[i].t), y = CY(pts[i].dopplerHz + (driftOn ? ff.driftHz(pts[i].t) : 0));
      if (i === 0) sctx.moveTo(x, y); else sctx.lineTo(x, y);
    }
    sctx.stroke();
    sctx.globalAlpha = 1;

    if (prog > 0) {
      const p = pts[upto];
      const dfNow = p.dopplerHz + (driftOn ? ff.driftHz(p.t) : 0);
      const px = CX(p.t), py = CY(dfNow);
      sctx.strokeStyle = "rgba(233,227,210,0.35)";
      sctx.beginPath(); sctx.moveTo(px, CHART_Y); sctx.lineTo(px, CHART_Y + CHART_H); sctx.stroke();
      sctx.fillStyle = "#e9e3d2";
      sctx.beginPath(); sctx.arc(px, py, 4, 0, 2 * Math.PI); sctx.fill();
      const tag = (dfNow > 0 ? "+" : "−") + Math.abs(dfNow).toFixed(0) + " Hz";
      const tagX = Math.min(px + 6, CHART_X + CHART_W - 64);
      sctx.fillText(tag, tagX, CHART_Y + 14);
    }
  }

  /* ------------------------------------------------------- the beeps */
  function scheduleBeeps() {
    if (!soundOn) return;
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtx.resume();
    const master = audioCtx.createGain();
    master.gain.value = 0.4;
    master.connect(audioCtx.destination);
    const pts = pass.points;
    const t0 = pts[0].t, span = pts[pts.length - 1].t - t0;
    let screenT = 0.15, k = 0;
    while (screenT < PASS_SECONDS_ON_SCREEN - 0.1 && k < 60) {
      const realT = t0 + (screenT / PASS_SECONDS_ON_SCREEN) * span;
      const f = Math.max(200, beatAt(realT));
      const when = audioCtx.currentTime + screenT;
      const osc = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.frequency.value = f;
      osc2.frequency.value = f * 2.01;
      const g2 = audioCtx.createGain();
      g2.gain.value = 0.12;                           // faint harmonic: radio-y edge
      osc.connect(g); osc2.connect(g2); g2.connect(g);
      g.connect(master);
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(0.9, when + 0.006);
      g.gain.setValueAtTime(0.9, when + 0.09);
      g.gain.linearRampToValueAtTime(0, when + 0.12);
      osc.start(when); osc.stop(when + 0.13);
      osc2.start(when); osc2.stop(when + 0.13);
      // 1957 condition: the pause grows as the hull heats in sunlight
      const cadence = driftOn ? 0.34 + 0.24 * (screenT / PASS_SECONDS_ON_SCREEN) : 0.36;
      screenT += cadence;
      k++;
    }
  }

  function tickPlay() {
    if (!play.active) return;
    play.progress = Math.min(1, (performance.now() - play.t0) / play.duration);
    drawSky();
    const pts = pass.points;
    const realT = pts[0].t + play.progress * (pts[pts.length - 1].t - pts[0].t);
    updateReadouts(sampleAt(realT));
    if (play.progress >= 1) {
      play.active = false;
      const dfs = pts.map((p) => p.dopplerHz);
      const plus = Math.max(...dfs), minus = Math.min(...dfs);
      document.getElementById("beep-verdict").innerHTML =
        `Closest approach at <b>${peakDeg}°</b>. The glide ran <b>+${fmt(plus)} Hz</b> coming to ` +
        `<b>−${fmt(-minus)} Hz</b> going — zero right at closest approach.` +
        (driftOn ? " Drift on: the wander is noise, the one-way glide is the satellite." : "");
      return;
    }
    play.raf = requestAnimationFrame(tickPlay);
  }

  function playPass() {
    stopPass();
    play.active = true;
    play.t0 = performance.now();
    play.progress = 0;
    scheduleBeeps();
    document.getElementById("beep-verdict").textContent =
      "Listening… pitch above the beat means it is still coming.";
    tickPlay();
  }

  function stopPass() {
    play.active = false;
    cancelAnimationFrame(play.raf);
  }

  const peakSlider = document.getElementById("peak-slider");
  const peakValue = document.getElementById("peak-value");
  peakSlider.addEventListener("input", () => {
    peakDeg = parseInt(peakSlider.value, 10);
    peakValue.textContent = peakDeg;
    stopPass();
    resample();
  });
  document.getElementById("play").addEventListener("click", playPass);
  document.getElementById("sound").addEventListener("click", (e) => {
    soundOn = !soundOn;
    const b = e.currentTarget;
    b.classList.toggle("toggle-on", soundOn);
    b.textContent = soundOn ? "sound on" : "sound off";
    b.setAttribute("aria-pressed", String(soundOn));
  });
  document.getElementById("drift").addEventListener("change", (e) => {
    driftOn = e.target.checked;
    stopPass();
    play.progress = 0;
    drawSky();
  });

  /* ----------------------------------------------------------- boot */
  resample();
  drawCannon();

  window.ffApp = {
    setSpeed(v) { speedSlider.value = v; speedValue.textContent = Number(v).toFixed(2); },
    speed: () => parseFloat(speedSlider.value),
    fire, clear: () => { shots = []; refreshShotList(); drawCannon(); },
    shots: () => shots.map((s) => ({ v0: s.v0, result: s.result, downrangeKm: s.downrangeKm,
                                     periodMin: s.periodMin, perigeeKm: s.perigeeKm, apogeeKm: s.apogeeKm })),
    setPeak(deg) { peakDeg = deg; peakSlider.value = deg; peakValue.textContent = deg; resample(); },
    playPass, stopPass,
    setDrift(on) { driftOn = on; document.getElementById("drift").checked = on; play.progress = 0; drawSky(); },
    setSound(on) { soundOn = on; },
    passInfo: () => ({ peak: peakDeg, drift: driftOn, playing: play.active, progress: play.progress }),
    beatAt, sampleAt: (t) => sampleAt(t),
  };
})();
