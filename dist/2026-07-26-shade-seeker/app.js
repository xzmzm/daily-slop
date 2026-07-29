/* Shade Seeker — real solar geometry casts shadows over a procedural city block.
   Drag the picnicker into the shade. Vanilla JS, no deps. */

"use strict";

const canvas = document.getElementById("city");
const ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height;

// Offscreen mask used for "am I in shade?" tests + shade % sampling
const mask = document.createElement("canvas");
mask.width = W; mask.height = H;
const mctx = mask.getContext("2d", { willReadFrequently: true });

// ---------------------------------------------------------------- seeded RNG
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- solar math
// Day of year -> solar declination (degrees). Cooper's equation.
function declination(doy) {
  return 23.44 * Math.sin((2 * Math.PI * (284 + doy)) / 365);
}

// Returns { alt, az } in degrees. az measured from North, clockwise.
// Solar noon pinned to t=12 (no longitude / equation of time — it's a toy).
function sunPosition(latDeg, doy, hours) {
  const rad = Math.PI / 180;
  const lat = latDeg * rad;
  const dec = declination(doy) * rad;
  const Hangle = (hours - 12) * 15 * rad; // hour angle

  const sinAlt = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(Hangle);
  const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));

  let cosAz = (Math.sin(dec) - Math.sin(alt) * Math.sin(lat)) / (Math.cos(alt) * Math.cos(lat) || 1e-9);
  cosAz = Math.max(-1, Math.min(1, cosAz));
  let az = Math.acos(cosAz) / rad;          // 0..180, from North
  if (Hangle > 0) az = 360 - az;            // afternoon -> western sky
  return { alt: alt / rad, az };
}

// ---------------------------------------------------------------- city block
// World units are canvas pixels; building heights in the same units.
let city = null;

function generateCity(seed) {
  const rnd = mulberry32(seed);
  const buildings = [];
  const trees = [];

  // Street grid: 4 x 3 lots separated by streets
  const streets = { xs: [0, 250, 500, 750, W], ys: [0, 210, 410, H] };
  const SW = 34; // street width

  const lotList = [];
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 3; j++)
      lotList.push({
        x: streets.xs[i] + SW / 2,
        y: streets.ys[j] + SW / 2,
        w: streets.xs[i + 1] - streets.xs[i] - SW,
        h: streets.ys[j + 1] - streets.ys[j] - SW,
      });

  // One lot becomes the park (with trees); rest get buildings
  const parkIdx = Math.floor(rnd() * lotList.length);

  lotList.forEach((lot, idx) => {
    if (idx === parkIdx) {
      city_park = lot;
      const n = 4 + Math.floor(rnd() * 4);
      for (let t = 0; t < n; t++) {
        trees.push({
          x: lot.x + 20 + rnd() * (lot.w - 40),
          y: lot.y + 20 + rnd() * (lot.h - 40),
          r: 14 + rnd() * 12,          // canopy radius
          hgt: 25 + rnd() * 25,        // canopy height above ground
        });
      }
      return;
    }
    // 1-3 buildings per lot
    const n = 1 + Math.floor(rnd() * 3);
    for (let b = 0; b < n; b++) {
      const bw = 50 + rnd() * (lot.w / n - 55);
      const bh = 50 + rnd() * (lot.h - 60);
      const bx = lot.x + (lot.w / n) * b + rnd() * Math.max(0, lot.w / n - bw - 8) + 4;
      const by = lot.y + rnd() * Math.max(0, lot.h - bh - 8) + 4;
      buildings.push({
        x: bx, y: by, w: bw, h: bh,
        hgt: 30 + Math.pow(rnd(), 1.6) * 150,   // most low-rise, a few towers
        hue: 25 + rnd() * 30,
      });
    }
  });

  // A few street trees along sidewalks
  for (let t = 0; t < 8; t++) {
    trees.push({
      x: 30 + rnd() * (W - 60),
      y: streets.ys[1 + Math.floor(rnd() * 2)] - SW / 2 + SW / 2 * (rnd() < 0.5 ? -0.4 : 0.4),
      r: 10 + rnd() * 8,
      hgt: 20 + rnd() * 15,
    });
  }

  return { buildings, trees, streets, SW, parkIdx, lotList };
}
let city_park = null;

// ---------------------------------------------------------------- state
const state = {
  seed: (Math.random() * 2 ** 31) | 0,
  time: 14,
  doy: 207,       // Jul 26
  lat: 40,
  guy: { x: 480, y: 300 },
  playing: false,
};

city = generateCity(state.seed);

// ---------------------------------------------------------------- geometry
// Convex hull (Andrew monotone chain) — exact ground shadow of a box.
function hull(pts) {
  pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

// Shadow displacement per unit height for current sun
function shadowVec(sun) {
  const rad = Math.PI / 180;
  const len = 1 / Math.max(Math.tan(sun.alt * rad), 0.03); // cap huge dusk shadows
  const a = sun.az * rad;
  return { dx: -Math.sin(a) * len, dy: Math.cos(a) * len }; // opposite the sun; N = up
}

function inBuilding(x, y) {
  return city.buildings.find(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
}

// ---------------------------------------------------------------- shadow mask
let maskData = null;

function paintShadows(g, sun, solid) {
  const v = shadowVec(sun);
  g.fillStyle = solid ? "#000" : "rgba(35, 30, 55, 0.42)";

  for (const b of city.buildings) {
    const c = [
      [b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h],
    ];
    const top = c.map(([x, y]) => [x + v.dx * b.hgt, y + v.dy * b.hgt]);
    const poly = hull(c.concat(top));
    g.beginPath();
    poly.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.fill();
  }
  for (const t of city.trees) {
    g.beginPath();
    g.arc(t.x + v.dx * t.hgt, t.y + v.dy * t.hgt, t.r, 0, Math.PI * 2);
    g.fill();
  }
}

function rebuildMask(sun) {
  mctx.clearRect(0, 0, W, H);
  if (sun.alt > 0) paintShadows(mctx, sun, true);
  maskData = mctx.getImageData(0, 0, W, H).data;
}

const shaded = (x, y) => maskData[((y | 0) * W + (x | 0)) * 4 + 3] > 0;

function shadePercent() {
  let shadeN = 0, total = 0;
  for (let y = 6; y < H; y += 12)
    for (let x = 6; x < W; x += 12) {
      if (inBuilding(x, y)) continue;
      total++;
      if (shaded(x, y)) shadeN++;
    }
  return total ? (100 * shadeN) / total : 0;
}

// ---------------------------------------------------------------- rendering
function drawGround() {
  ctx.fillStyle = "#cfc3a0";                    // sidewalks / lots
  ctx.fillRect(0, 0, W, H);

  // streets
  ctx.fillStyle = "#8b8478";
  const { xs, ys } = city.streets, SW = city.SW;
  for (let i = 1; i < xs.length - 1; i++) ctx.fillRect(xs[i] - SW / 2, 0, SW, H);
  for (let j = 1; j < ys.length - 1; j++) ctx.fillRect(0, ys[j] - SW / 2, W, SW);

  // dashed center lines
  ctx.strokeStyle = "rgba(255,255,240,0.5)";
  ctx.lineWidth = 2;
  ctx.setLineDash([12, 14]);
  ctx.beginPath();
  for (let i = 1; i < xs.length - 1; i++) { ctx.moveTo(xs[i], 0); ctx.lineTo(xs[i], H); }
  for (let j = 1; j < ys.length - 1; j++) { ctx.moveTo(0, ys[j]); ctx.lineTo(W, ys[j]); }
  ctx.stroke();
  ctx.setLineDash([]);

  // park lawn
  if (city_park) {
    ctx.fillStyle = "#9fbf6e";
    ctx.fillRect(city_park.x, city_park.y, city_park.w, city_park.h);
  }
}

function drawBuildings() {
  for (const b of city.buildings) {
    const l = 82 - (b.hgt / 180) * 34;          // taller = darker roof
    ctx.fillStyle = `hsl(${b.hue}, 26%, ${l}%)`;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = "rgba(60,45,25,0.5)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    // roof furniture: AC box
    ctx.fillStyle = "rgba(60,45,25,0.25)";
    ctx.fillRect(b.x + b.w * 0.15, b.y + b.h * 0.2, 10, 8);
    if (b.hgt > 100) {                           // tall towers get a helipad ring
      ctx.strokeStyle = "rgba(60,45,25,0.35)";
      ctx.beginPath();
      ctx.arc(b.x + b.w / 2, b.y + b.h / 2, Math.min(b.w, b.h) * 0.25, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawTrees() {
  for (const t of city.trees) {
    ctx.fillStyle = "#4f7d3a";
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.beginPath(); ctx.arc(t.x - t.r * 0.25, t.y - t.r * 0.25, t.r * 0.55, 0, Math.PI * 2); ctx.fill();
  }
}

function drawGuy(status) {
  const { x, y } = state.guy;
  // picnic blanket
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#d9455f";
  ctx.fillRect(-16, -11, 32, 22);
  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.lineWidth = 1;
  for (let i = -16; i <= 16; i += 8) { ctx.beginPath(); ctx.moveTo(i, -11); ctx.lineTo(i, 11); ctx.stroke(); }
  ctx.restore();

  ctx.font = "26px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const face = status === "roof" ? "🙃" : status === "night" ? "😴" : status === "cool" ? "😎" : "🥵";
  ctx.fillText(face, x, y - 2);
}

function drawSunIndicator(sun) {
  if (sun.alt <= 0) return;
  const rad = Math.PI / 180, a = sun.az * rad;
  const dir = { x: Math.sin(a), y: -Math.cos(a) };            // toward the sun
  const cx = W / 2, cy = H / 2;
  const t = Math.min(
    dir.x ? (dir.x > 0 ? (W - 40 - cx) / dir.x : (40 - cx) / dir.x) : 1e9,
    dir.y ? (dir.y > 0 ? (H - 40 - cy) / dir.y : (40 - cy) / dir.y) : 1e9,
  );
  const sx = cx + dir.x * t, sy = cy + dir.y * t;

  const glow = ctx.createRadialGradient(sx, sy, 2, sx, sy, 26);
  glow.addColorStop(0, "rgba(255, 210, 80, 0.95)");
  glow.addColorStop(1, "rgba(255, 210, 80, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(sx, sy, 26, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ffd94d";
  ctx.beginPath(); ctx.arc(sx, sy, 10, 0, Math.PI * 2); ctx.fill();
}

function atmosphere(sun) {
  if (sun.alt <= 0) {                                        // night
    ctx.fillStyle = "rgba(18, 22, 52, 0.62)";
    ctx.fillRect(0, 0, W, H);
  } else if (sun.alt < 15) {                                 // golden hour
    const k = 1 - sun.alt / 15;
    ctx.fillStyle = `rgba(255, 140, 50, ${0.16 * k})`;
    ctx.fillRect(0, 0, W, H);
  }
}

// ---------------------------------------------------------------- HUD
const el = id => document.getElementById(id);
const statusEl = el("status");

function fmtTime(t) {
  const h = Math.floor(t) % 24, m = Math.floor((t % 1) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MDAYS = [31,28,31,30,31,30,31,31,30,31,30,31];
function fmtDoy(doy) {
  let d = doy, m = 0;
  while (d > MDAYS[m]) { d -= MDAYS[m]; m++; }
  return `${MONTHS[m]} ${d}`;
}

function guyStatus(sun) {
  if (sun.alt <= 0) return "night";
  if (inBuilding(state.guy.x, state.guy.y)) return "roof";
  return shaded(state.guy.x, state.guy.y) ? "cool" : "hot";
}

function updateHUD(sun, status) {
  el("timeVal").textContent = fmtTime(state.time);
  el("dateVal").textContent = fmtDoy(state.doy);
  el("latVal").textContent = `${Math.abs(state.lat)}°${state.lat >= 0 ? "N" : "S"}${state.lat === 0 ? " (equator)" : ""}`;

  el("sunInfo").textContent = sun.alt > 0
    ? `sun: alt ${sun.alt.toFixed(1)}° · az ${sun.az.toFixed(0)}°`
    : "sun: below horizon";
  el("shadePct").textContent = sun.alt > 0
    ? `ground in shade: ${shadePercent().toFixed(0)}%`
    : "ground in shade: 100% (it's night)";

  statusEl.className = "status " + (status === "cool" ? "cool" : status === "night" ? "night" : "hot");
  statusEl.textContent = {
    cool: "😎 lovely — picnicker is in the shade",
    hot: "🥵 full sun! drag them somewhere cooler",
    roof: "🙃 that's a roof. bold choice. (full sun)",
    night: "😴 night — everything is shade now",
  }[status];
}

// ---------------------------------------------------------------- main loop
function render() {
  const sun = sunPosition(state.lat, state.doy, state.time);
  rebuildMask(sun);

  drawGround();
  if (sun.alt > 0) paintShadows(ctx, sun, false);
  drawTrees();
  drawBuildings();
  const status = guyStatus(sun);
  drawGuy(status);
  drawSunIndicator(sun);
  atmosphere(sun);
  updateHUD(sun, status);
}

// ---------------------------------------------------------------- input
function canvasPos(ev) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (ev.clientX - r.left) * (W / r.width),
    y: (ev.clientY - r.top) * (H / r.height),
  };
}

let dragging = false;
canvas.addEventListener("pointerdown", ev => {
  dragging = true;
  canvas.classList.add("dragging");
  canvas.setPointerCapture(ev.pointerId);
  const p = canvasPos(ev);
  state.guy.x = Math.max(8, Math.min(W - 8, p.x));
  state.guy.y = Math.max(8, Math.min(H - 8, p.y));
  render();
});
canvas.addEventListener("pointermove", ev => {
  if (!dragging) return;
  const p = canvasPos(ev);
  state.guy.x = Math.max(8, Math.min(W - 8, p.x));
  state.guy.y = Math.max(8, Math.min(H - 8, p.y));
  render();
});
canvas.addEventListener("pointerup", () => { dragging = false; canvas.classList.remove("dragging"); });

el("time").addEventListener("input", e => { state.time = +e.target.value; render(); });
el("doy").addEventListener("input", e => { state.doy = +e.target.value; render(); });
el("lat").addEventListener("input", e => { state.lat = +e.target.value; render(); });

el("reshuffle").addEventListener("click", () => {
  state.seed = (Math.random() * 2 ** 31) | 0;
  city = generateCity(state.seed);
  render();
});

// Play: sweep the day at ~2.4 sim-hours per second
let lastT = 0;
function tick(now) {
  if (!state.playing) return;
  const dt = Math.min(now - lastT, 100) / 1000;
  lastT = now;
  state.time = (state.time + dt * 2.4) % 24;
  el("time").value = state.time;
  render();
  requestAnimationFrame(tick);
}
el("play").addEventListener("click", () => {
  state.playing = !state.playing;
  el("play").textContent = state.playing ? "⏸ pause" : "▶ play day";
  el("play").classList.toggle("active", state.playing);
  if (state.playing) { lastT = performance.now(); requestAnimationFrame(tick); }
});

window.addEventListener("keydown", e => {
  if (e.code === "Space") { e.preventDefault(); el("play").click(); }
});

render();
