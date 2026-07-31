/* Eclipse Chaser — Aug 12 2026 total solar eclipse, from anywhere.
 * Model: calibrated centerline (path.js) + two-piece magnitude falloff,
 * fitted to the real Wikipedia city table. Approximate, not for navigation.
 */
"use strict";

const KM = 111.32;
const MAG_AXIS = ECLIPSE_META.magnitudeAxis;   // 1.0386
const SUN_DECL = 14.9;                          // sun declination, Aug 12 (deg)

// cumulative arc lengths along the centerline (km) for the duration taper
const ARCS = (() => {
  const P = ECLIPSE_PATH, a = [0];
  for (let i = 1; i < P.length; i++) {
    const [la1, lo1] = P[i - 1], [la2, lo2] = P[i];
    const h = Math.sin((la2 - la1) * Math.PI / 360) ** 2 +
              Math.cos(la1 * Math.PI / 180) * Math.cos(la2 * Math.PI / 180) *
              Math.sin((lo2 - lo1) * Math.PI / 360) ** 2;
    a.push(a[i - 1] + 2 * 6371 * Math.asin(Math.sqrt(h)));
  }
  return a;
})();

// ---------------------------------------------------------------- geometry --
function nearestOnPath(lat, lon) {
  const P = ECLIPSE_PATH;
  let bd = Infinity, bi = 0, bt = 0;
  const c = Math.cos((lat * Math.PI) / 180);
  for (let i = 0; i < P.length - 1; i++) {
    const a = P[i], b = P[i + 1];
    const x1 = a[1] * c, y1 = a[0], x2 = b[1] * c, y2 = b[0];
    const dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy;
    const t = L2 === 0 ? 0 : Math.max(0, Math.min(1, ((lon * c - x1) * dx + (lat - y1) * dy) / L2));
    const d = Math.hypot(lon * c - (x1 + t * dx), lat - (y1 + t * dy)) * KM;
    if (d < bd) { bd = d; bi = i; bt = t; }
  }
  const a = P[bi], b = P[bi + 1];
  const arcFrac = (ARCS[bi] + (ARCS[bi + 1] - ARCS[bi]) * bt) / ARCS[ARCS.length - 1];
  return { d: bd, t: a[2] + (b[2] - a[2]) * bt, dur: a[3] + (b[3] - a[3]) * bt, hw: a[4] + (b[4] - a[4]) * bt,
           frac: arcFrac };
}

// magnitude: two-piece isotropic falloff, calibrated against real cities
function magnitudeOf(d, hw) {
  if (d <= hw) return MAG_AXIS;
  const u = d - hw;
  if (u <= 400) return Math.max(0, 1 - u / 3620);
  if (u <= 3400) return Math.max(0, 0.8895 - (u - 400) / 18000);
  return 0;
}

function sunAltAz(lat, lon, tUT) {
  const phi = lat * Math.PI / 180, dec = SUN_DECL * Math.PI / 180;
  const H = ((tUT - 12 + lon / 15) * 15) * Math.PI / 180;
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  let az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)) + Math.PI;
  return { alt: alt * 180 / Math.PI, az: ((az * 180 / Math.PI) % 360 + 360) % 360 };
}

// ------------------------------------------------------------- model per spot
function circumstances(lat, lon) {
  const { d, t, dur, hw, frac } = nearestOnPath(lat, lon);
  const mag = magnitudeOf(d, hw);
  const total = mag >= 1;
  const totDur = total ? dur * Math.sqrt(Math.max(0, 1 - (d / hw) ** 2)) : 0; // seconds
  const m = Math.min(1, mag);
  // C1..C4 length: ~2h at the axis, tapering toward the path ends
  const taper = 1 - 0.5 * Math.pow(Math.max(0, (frac - 0.55) / 0.45), 1.6);
  const totLen = 125 * Math.pow(m / MAG_AXIS, 0.42) * taper / 60;  // hours
  let C1 = t - totLen / 2, C4 = t + totLen / 2, Tmax = t;
  const C2 = total ? t - totDur / 2 / 3600 : null;
  const C3 = total ? t + totDur / 2 / 3600 : null;

  // sunset truncation: if the sun is below the horizon at max, the eclipse is cut short
  const s0 = sunAltAz(lat, lon, C1), s1 = sunAltAz(lat, lon, C4);
  let tSet = null;
  if (s0.alt > 0 && s1.alt < 0) {                 // sun sets mid-eclipse
    let lo = C1, hi = C4;
    for (let k = 0; k < 24; k++) {
      const mid = (lo + hi) / 2;
      if (sunAltAz(lat, lon, mid).alt > 0) lo = mid; else hi = mid;
    }
    tSet = (lo + hi) / 2;
  }
  const altAtMax = sunAltAz(lat, lon, Tmax).alt;
  let maxMag = mag, maxT = Tmax, cutShort = false;
  if (tSet !== null && tSet < Tmax) {
    cutShort = true;
    maxT = tSet;
    maxMag = m * Math.pow(Math.sin((Math.PI / 2) * (tSet - C1) / (Tmax - C1)), 0.75);
    C4 = Math.min(C4, tSet);
  }
  return { lat, lon, d, t, dur, hw, mag, total, totDur, m, C1, C2, C3, C4, Tmax,
           maxMag, maxT, cutShort, tSet, altAtMax, azAtMax: sunAltAz(lat, lon, Tmax).az };
}

// phase magnitude at timeline position (hours UT)
function magAt(c, tUT) {
  if (tUT <= c.C1 || tUT >= c.C4) return 0;
  if (c.total && c.C2 !== null && tUT >= c.C2 && tUT <= c.C3) return MAG_AXIS;
  if (c.total) {
    if (tUT < c.C2) {
      const u = (tUT - c.C1) / (c.C2 - c.C1);
      return MAG_AXIS * Math.pow(Math.sin((Math.PI / 2) * u), 0.75);
    }
    const u = (tUT - c.C3) / (c.C4 - c.C3);
    return MAG_AXIS * Math.pow(Math.sin((Math.PI / 2) * u), 0.75);
  }
  return c.m * Math.pow(Math.sin(Math.PI * (tUT - c.C1) / (c.C4 - c.C1)), 0.75);
}

// ------------------------------------------------------------------- cities
const CITIES = [
  ["Reykjavík", 64.15, -21.94, 0], ["Látrabjarg", 65.50, -24.53, 0],
  ["A Coruña", 43.36, -8.42, 2], ["Bilbao", 43.26, -2.93, 2],
  ["Zaragoza", 41.65, -0.88, 2], ["Valencia", 39.47, -0.38, 2],
  ["Palma", 39.57, 2.65, 2], ["Madrid", 40.42, -3.70, 2],
  ["Barcelona", 41.39, 2.17, 2], ["Lisbon", 38.72, -9.14, 1],
  ["Dublin", 53.35, -6.26, 1], ["London", 51.51, -0.13, 1],
  ["Paris", 48.86, 2.35, 2], ["Berlin", 52.52, 13.41, 2],
  ["Rome", 41.90, 12.50, 2], ["Oslo", 59.91, 10.75, 2],
  ["Stockholm", 59.33, 18.07, 2], ["Moscow", 55.76, 37.62, 3],
  ["Casablanca", 33.57, -7.59, 1], ["Cairo", 30.04, 31.24, 3],
];

function tzFor(lat, lon) {
  if (lat > 62.4 && lon > -27 && lon < -12) return 0;                    // Iceland
  if (lat > 49.5 && lon > -11 && lon < 2) return 1;                      // UK / Ireland
  if (lat > 36 && lat < 44.5 && lon > -10 && lon < -6.5) return 1;       // Portugal
  if (lat > 30 && lat < 38.5 && lon > -10 && lon < 12) return 1;         // N Africa
  if (lat > 36 && lon >= -10 && lon < 19) return 2;                      // W/C Europe
  if (lat > 34 && lon >= 19 && lon < 30) return 3;                       // Greece & co
  if (lat > 22 && lon >= 30 && lon < 36) return 3;                       // Egypt
  if (lat > 36 && lon >= 30) return 3;                                   // E Europe
  return Math.round(lon / 15);
}

// ------------------------------------------------------------------ helpers
const $ = (id) => document.getElementById(id);
const pad2 = (n) => String(n).padStart(2, "0");
const hhmm = (h) => `${pad2(Math.floor(h))}:${pad2(Math.floor((h % 1) * 60))}`;
const hhmmss = (h) => {
  const s = Math.floor(h * 3600);
  return `${pad2(Math.floor(s / 3600))}:${pad2(Math.floor((s % 3600) / 60))}:${pad2(s % 60)}`;
};
function compass(deg) {
  const names = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
                 "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return names[Math.round(deg / 22.5) % 16];
}

// --------------------------------------------------------------------- state
let sel = { lat: 64.15, lon: -21.94, name: "Reykjavík", tz: 0, isCity: true };
let playing = false, playT = 0, rafId = null;

// ------------------------------------------------------------------- map --
const MAP = $("map"), MCTX = MAP.getContext("2d");
const LON0 = -50, LON1 = 32, LAT0 = 24, LAT1 = 76;
function px(lon, lat) {
  return [(lon - LON0) / (LON1 - LON0) * MAP.width,
          (LAT1 - lat) / (LAT1 - LAT0) * MAP.height];
}

function drawMap() {
  const W = MAP.width, H = MAP.height, ctx = MCTX;
  ctx.clearRect(0, 0, W, H);

  // ocean
  const og = ctx.createLinearGradient(0, 0, 0, H);
  og.addColorStop(0, "#0b1226"); og.addColorStop(1, "#0d1a30");
  ctx.fillStyle = og; ctx.fillRect(0, 0, W, H);

  // graticule
  ctx.strokeStyle = "rgba(120,150,200,0.10)"; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let lon = -40; lon <= 30; lon += 10) {
    const [x] = px(lon, 50);
    ctx.moveTo(x, 0); ctx.lineTo(x, H);
  }
  for (let lat = 30; lat <= 70; lat += 10) {
    const [, y] = px(0, lat);
    ctx.moveTo(0, y); ctx.lineTo(W, y);
  }
  ctx.stroke();

  // shadow bands (magnitude field on a coarse grid, upscaled)
  const GW = 190, GH = Math.round(GW * H / W);
  const off = document.createElement("canvas");
  off.width = GW; off.height = GH;
  const octx = off.getContext("2d");
  const img = octx.createImageData(GW, GH);
  for (let gy = 0; gy < GH; gy++) {
    const lat = LAT1 - (gy + 0.5) / GH * (LAT1 - LAT0);
    const c = Math.cos(lat * Math.PI / 180);
    for (let gx = 0; gx < GW; gx++) {
      const lon = LON0 + (gx + 0.5) / GW * (LON1 - LON0);
      const { d, hw } = nearestOnPath(lat, lon);
      const m = magnitudeOf(d, hw);
      let r = 0, g = 0, b = 0, a = 0;
      if (m >= 1) { r = 205; g = 58; b = 44; a = 150; }
      else if (m > 0.02) { r = 235; g = 150; b = 40; a = Math.round(Math.pow(m, 2) * 110); }
      const i = (gy * GW + gx) * 4;
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = a;
    }
  }
  octx.putImageData(img, 0, 0);
  ctx.drawImage(off, 0, 0, W, H);

  // land
  ctx.fillStyle = "#1b2740";
  for (const poly of COAST) {
    ctx.beginPath();
    poly.forEach(([lon, lat], i) => {
      const [x, y] = px(lon, lat);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.closePath(); ctx.fill();
  }

  // centerline
  ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 1.2;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ECLIPSE_PATH.forEach(([lat, lon], i) => {
    const [x, y] = px(lon, lat);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke(); ctx.setLineDash([]);

  // greatest eclipse marker
  const [gx, gy] = px(ECLIPSE_META.greatest[1], ECLIPSE_META.greatest[0]);
  ctx.fillStyle = "#ffd9a0";
  ctx.font = "13px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.fillText("✦ greatest eclipse", gx, gy - 8);

  // cities
  ctx.font = "10px ui-monospace, monospace";
  ctx.textAlign = "left";
  for (const [name, lat, lon] of CITIES) {
    const [x, y] = px(lon, lat);
    const isSel = sel.isCity && sel.name === name;
    ctx.fillStyle = isSel ? "#ffd9a0" : "rgba(220,235,255,0.75)";
    ctx.beginPath(); ctx.arc(x, y, isSel ? 4 : 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillText(name, x + 6, y + 3);
  }

  // selection marker (map clicks)
  if (!sel.isCity) {
    const [x, y] = px(sel.lon, sel.lat);
    ctx.strokeStyle = "#ffd9a0"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 13, y); ctx.lineTo(x - 5, y);
    ctx.moveTo(x + 5, y); ctx.lineTo(x + 13, y);
    ctx.moveTo(x, y - 13); ctx.lineTo(x, y - 5);
    ctx.moveTo(x, y + 5); ctx.lineTo(x, y + 13);
    ctx.stroke();
  }
}

MAP.addEventListener("click", (ev) => {
  const r = MAP.getBoundingClientRect();
  const x = (ev.clientX - r.left) / r.width * MAP.width;
  const y = (ev.clientY - r.top) / r.height * MAP.height;
  const lon = LON0 + x / MAP.width * (LON1 - LON0);
  const lat = LAT1 - y / MAP.height * (LAT1 - LAT0);
  selectSpot(lat, lon, null, tzFor(lat, lon));
});

// ------------------------------------------------------------------- sun --
const SUN = $("sun"), SCTX = SUN.getContext("2d");
const SR = 92, SCX = SUN.width / 2, SCY = SUN.height / 2 + 6;
const MOON_R = SR * 1.0193;
let stars = [];
(function () {
  let s = 12345;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 130; i++) stars.push([rnd(), rnd(), rnd() * 0.9 + 0.1]);
})();

function drawSun(c, tUT) {
  const ctx = SCTX, W = SUN.width, H = SUN.height;
  const m = magAt(c, tUT);
  const dark = Math.max(0, Math.min(1, (m - 0.45) / 0.55));

  // sky
  const skyTop = [30, 55, 105], skyBot = [96, 130, 175];
  const sh = 1 - dark;
  const sg = ctx.createLinearGradient(0, 0, 0, H);
  sg.addColorStop(0, `rgb(${skyTop.map(v => Math.round(v * sh)).join(",")})`);
  sg.addColorStop(1, `rgb(${skyBot.map(v => Math.round(v * sh)).join(",")})`);
  ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);

  // stars during deep eclipse
  if (dark > 0.6) {
    ctx.fillStyle = `rgba(255,255,255,${(dark - 0.6) / 0.4})`;
    for (const [sx, sy, sz] of stars) {
      ctx.globalAlpha = (dark - 0.6) / 0.4 * sz;
      ctx.fillRect(sx * W, sy * H, 1.4, 1.4);
    }
    ctx.globalAlpha = 1;
  }

  const mClamp = Math.min(m, 1);
  const xOff = (SR + MOON_R - 2 * SR * mClamp);            // moon center offset
  const ang = -Math.PI * 0.28;                              // approach direction
  const mx = SCX + xOff * Math.cos(ang);
  const my = SCY + xOff * Math.sin(ang);

  // corona during totality
  if (m >= 1) {
    const t = performance.now() / 1000;
    const cor = ctx.createRadialGradient(SCX, SCY, SR * 0.9, SCX, SCY, SR * 2.6);
    cor.addColorStop(0, "rgba(255,250,235,0.95)");
    cor.addColorStop(0.25, "rgba(255,244,214,0.55)");
    cor.addColorStop(1, "rgba(255,240,210,0)");
    ctx.fillStyle = cor;
    ctx.beginPath(); ctx.arc(SCX, SCY, SR * 2.6, 0, Math.PI * 2); ctx.fill();
    // streamers
    ctx.save();
    ctx.translate(SCX, SCY); ctx.rotate(t * 0.05);
    for (let i = 0; i < 6; i++) {
      ctx.rotate(Math.PI / 3);
      const gr = ctx.createLinearGradient(0, 0, 0, -SR * 3.4);
      gr.addColorStop(0, "rgba(255,246,225,0.5)");
      gr.addColorStop(1, "rgba(255,246,225,0)");
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.moveTo(-SR * 0.14, -SR * 0.95);
      ctx.quadraticCurveTo(-SR * 0.34, -SR * 2.1, -SR * 0.06, -SR * 3.3);
      ctx.quadraticCurveTo(SR * 0.3, -SR * 2.0, SR * 0.14, -SR * 0.95);
      ctx.fill();
    }
    ctx.restore();
    // prominences
    ctx.fillStyle = "rgba(255,90,70,0.85)";
    for (const [pa, pr] of [[0.9, 0.06], [2.6, 0.045], [4.4, 0.075]]) {
      ctx.beginPath();
      ctx.arc(SCX + Math.cos(pa) * SR * 0.98, SCY + Math.sin(pa) * SR * 0.98,
              SR * pr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // sun disk (crescent when partially covered)
  if (m < 1) {
    const sg2 = ctx.createRadialGradient(SCX - 14, SCY - 14, 6, SCX, SCY, SR);
    sg2.addColorStop(0, "#fff8e0"); sg2.addColorStop(0.75, "#ffe9a8"); sg2.addColorStop(1, "#ffb347");
    ctx.fillStyle = sg2;
    ctx.beginPath(); ctx.arc(SCX, SCY, SR, 0, Math.PI * 2); ctx.fill();
  }

  // moon
  const mg = ctx.createRadialGradient(mx - 30, my - 30, 10, mx, my, MOON_R * 1.05);
  mg.addColorStop(0, "#000"); mg.addColorStop(0.82, "#05070d"); mg.addColorStop(1, "#101828");
  ctx.fillStyle = mg;
  ctx.beginPath(); ctx.arc(mx, my, MOON_R, 0, Math.PI * 2); ctx.fill();

  // diamond ring + Baily's beads near the contacts
  if (m >= 0.93 && m < 1.03) {
    const beadDir = Math.atan2(SCY - my, SCX - mx);        // sun edge nearest the moon
    const near = Math.abs(m - 1);
    const spread = m < 1 ? 1.5 - near * 9 : 0.5;
    let s = Math.floor(near * 10000);
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const nBeads = m < 1 ? 26 : 12;
    ctx.fillStyle = "#fff7dc";
    for (let i = 0; i < nBeads; i++) {
      const a = beadDir + (rnd() - 0.5) * spread * (m < 1 ? 1 : 0.25) + Math.PI * 0.5 * 0;
      const rr = SR * (1 + (rnd() - 0.5) * 0.012);
      const bx = SCX + Math.cos(a) * rr, by = SCY + Math.sin(a) * rr;
      ctx.globalAlpha = 0.35 + rnd() * 0.65;
      ctx.beginPath(); ctx.arc(bx, by, 1 + rnd() * 2.4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (m >= 0.995 && m < 1.02) {                          // diamond ring
      const da = beadDir + (m < 1 ? 0.15 : -0.15);
      ctx.fillStyle = "#fffdf5";
      ctx.beginPath();
      ctx.arc(SCX + Math.cos(da) * SR * 1.01, SCY + Math.sin(da) * SR * 1.01, 5.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // phase label
  let label;
  if (m <= 0.01) label = "first contact — eclipse begins";
  else if (m < 1) label = `partial — ${Math.round(m * 100)}% of the sun's diameter covered`;
  else if (m < MAG_AXIS - 0.001) label = "totality";
  else label = "TOTALITY — the corona is out";
  $("phase-label").textContent = label;
}

// --------------------------------------------------------------- readout ---
function fmtContacts(c, tz) {
  const parts = [`C1 ${hhmm(c.C1 + tz)}`];
  if (c.total) {
    parts.push(`C2 ${hhmm(c.C2 + tz)}`, `C3 ${hhmm(c.C3 + tz)}`);
  }
  parts.push(`C4 ${hhmm(c.C4 + tz)}`);
  return parts.join("  ·  ");
}

function updateReadout() {
  const c = circumstances(sel.lat, sel.lon);
  const tz = sel.tz;
  $("ro-place").textContent = sel.name;
  $("ro-type").textContent = c.total
    ? "TOTAL solar eclipse"
    : `partial — max ${(c.maxMag * 100).toFixed(2)}% of diameter`;
  $("ro-max").textContent = `${hhmm(c.maxT + tz)} local (${hhmmss(c.maxT)} UT)`;
  const obsc = Math.pow(Math.min(1, c.maxMag), 1.65) * 100;
  $("ro-mag").textContent = c.total
    ? `magnitude ${c.maxMag.toFixed(3)} — the disk fully covered`
    : `magnitude ${(c.maxMag).toFixed(4)} · ~${obsc.toFixed(1)}% of the disk`;
  $("ro-tot").textContent = c.total
    ? `${Math.round(c.totDur)}s of darkness`
    : "none — you stay in daylight";
  const { altAtMax, azAtMax } = c;
  $("ro-sun").textContent = altAtMax > 0
    ? `${altAtMax.toFixed(1)}° up, ${compass(azAtMax)} (${azAtMax.toFixed(0)}°)`
    : `${altAtMax.toFixed(1)}° — below the horizon`;
  $("ro-contacts").textContent = fmtContacts(c, tz);
  $("ro-note").textContent = c.cutShort
    ? `sun sets at ${hhmm(c.tSet + tz)} local — the eclipse is cut short; you'd catch ~${(c.maxMag * 100).toFixed(1)}%`
    : c.total
      ? "find clear sky to the west and look up at C2 — watch for Baily's beads"
      : c.mag * 100 >= 99
        ? "agonizingly close — totality is just over the horizon"
        : "approximate values; enough to know where to stand";
  return c;
}

// ----------------------------------------------------------------- timeline
const SCRUB = $("scrub");
let cur = null;

function syncTimeline(c) {
  SCRUB.min = 0; SCRUB.max = 1000; SCRUB.value = 0;
  $("tl-left").textContent = hhmm(c.C1);
  $("tl-right").textContent = hhmm(c.C4);
}

SCRUB.addEventListener("input", () => {
  if (!cur) return;
  playing = false;
  const t = cur.C1 + (SCRUB.value / 1000) * (cur.C4 - cur.C1);
  drawSun(cur, t);
});

$("btn-max").addEventListener("click", () => {
  if (!cur) return;
  playing = false;
  SCRUB.value = 500;
  drawSun(cur, cur.Tmax);
});

$("btn-play").addEventListener("click", () => {
  if (!cur) return;
  playing = !playing;
  $("btn-play").textContent = playing ? "❚❚ pause" : "▶ play";
  if (playing) {
    playT = cur.C1 + (SCRUB.value / 1000) * (cur.C4 - cur.C1);
    if (playT >= cur.C4) { playT = cur.C1; SCRUB.value = 0; }
    const step = () => {
      if (!playing || !cur) return;
      playT += (cur.C4 - cur.C1) / 1000 * 0.35;       // ~3 s per full pass
      if (playT > cur.C4) { playT = cur.C4; playing = false; $("btn-play").textContent = "▶ play"; }
      SCRUB.value = Math.round((playT - cur.C1) / (cur.C4 - cur.C1) * 1000);
      drawSun(cur, playT);
      if (playing) rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
  } else if (rafId) {
    cancelAnimationFrame(rafId);
  }
});

// ------------------------------------------------------------- selection ---
function selectSpot(lat, lon, name, tz) {
  sel = { lat, lon, name: name || `${lat.toFixed(2)}°N ${lon.toFixed(2)}°E`, tz, isCity: !!name };
  cur = updateReadout();
  syncTimeline(cur);
  drawSun(cur, cur.Tmax);
  SCRUB.value = 500;
  $("btn-play").textContent = "▶ play";
  drawMap();
  document.querySelectorAll("#chips button").forEach((b) => {
    b.classList.toggle("on", name !== null && b.dataset.name === name);
  });
}

// city chips
const chipsEl = $("chips");
for (const [name, lat, lon, tz] of CITIES) {
  const b = document.createElement("button");
  b.type = "button"; b.dataset.name = name; b.textContent = name;
  b.addEventListener("click", () => selectSpot(lat, lon, name, tz));
  chipsEl.appendChild(b);
}

// countdown to 2026-08-12 17:47:06 UTC
const TARGET = Date.UTC(2026, 7, 12, 17, 47, 6);
function tickCountdown() {
  const d = TARGET - Date.now();
  if (d <= 0) { $("countdown").textContent = "it's happening — right now"; return; }
  const s = Math.floor(d / 1000);
  const dd = Math.floor(s / 86400), hh = Math.floor((s % 86400) / 3600),
        mm = Math.floor((s % 3600) / 60), ss = s % 60;
  $("countdown").textContent =
    `T-minus ${dd}d ${pad2(hh)}:${pad2(mm)}:${pad2(ss)} — greatest eclipse 17:47 UT`;
}
tickCountdown();
setInterval(tickCountdown, 1000);

// go
selectSpot(sel.lat, sel.lon, sel.name, sel.tz);
