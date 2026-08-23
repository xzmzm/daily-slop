// app.js — Plinian Hour studio: eruption cross-section, bay map, timeline.
import {
  simulate, fmtClock, frontRadius, runoutMax, terminalVelocity,
  fallFraction, TOWNS, TOWN_BEARING, townXY, UMBRELLA_FRAC,
  columnHeight, umbrellaHeight, massFlux, collapseMargin, mulberry32,
} from "./physics.js";

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

const SCENARIOS = {
  historical: { u0: 260, T0: 1000, wind: 6 },
  cold: { u0: 250, T0: 650, wind: 6 },
  weak: { u0: 150, T0: 900, wind: 6 },
  gale: { u0: 260, T0: 1000, wind: 15 },
};

const state = {
  u0: 260, T0: 1000, r0: 200, wind: 6,
  time: 1.5, // hours from 13:00 Aug 24
  view: "section",
  playing: false,
  scenario: "historical",
};

let sim = null;

function recompute() {
  sim = simulate({ u0: state.u0, T0: state.T0, r0: state.r0, wind: state.wind });
}

recompute();

/* ------------------------------------------------------------------ */
/* DOM                                                                 */
/* ------------------------------------------------------------------ */

const $ = (id) => document.getElementById(id);
const canvas = $("view");
const ctx = canvas.getContext("2d");
const W = canvas.width;
const H = canvas.height;

function syncInputs() {
  $("u0").value = state.u0; $("u0-out").textContent = `${Math.round(state.u0)} m/s`;
  $("T0").value = state.T0; $("T0-out").textContent = `${Math.round(state.T0)} K`;
  $("wind").value = state.wind; $("wind-out").textContent = `${state.wind.toFixed(1)} m/s`;
}

function syncMeters() {
  const mdot = sim.mdot;
  $("mdot").textContent = `${(mdot / 1e6).toFixed(0)} ×10⁶ kg/s`;
  $("hcol").textContent = sim.sustained ? `${(sim.hCol / 1000).toFixed(1)} km` : "— collapsed";
  $("znb").textContent = sim.sustained ? `${(sim.zNb / 1000).toFixed(1)} km` : "—";
  const marginKm = sim.margin / 1000;
  $("margin").textContent = `${marginKm >= 0 ? "+" : ""}${marginKm.toFixed(2)} km ${sim.sustained ? "buoyant" : "COLLAPSE"}`;
  // meter: map margin −6…+6 km onto 0…1 around the zero line at 35%…65%
  const frac = Math.min(1, Math.max(0, 0.5 + marginKm / 12));
  const zero = 0.35;
  const fill = $("cm-fill");
  if (marginKm >= 0) {
    fill.style.left = `${zero * 100}%`;
    fill.style.width = `${(frac - zero) * 100}%`;
    fill.style.background = "var(--safe)";
  } else {
    fill.style.left = `${frac * 100}%`;
    fill.style.width = `${(zero - frac) * 100}%`;
    fill.style.background = "var(--danger)";
  }
  $("cm-note").textContent = sim.sustained
    ? `Ballistic coast ${(sim.hBall / 1000).toFixed(1)} km clears the ${(sim.hNeed / 1000).toFixed(1)} km reversal demand.`
    : `Coast reaches only ${(sim.hBall / 1000).toFixed(1)} km — needs ${(sim.hNeed / 1000).toFixed(1)} km. It falls back.`;
  document.querySelectorAll(".chip[data-scenario]").forEach((b) => {
    b.classList.toggle("active", b.dataset.scenario === state.scenario);
  });
}

function fateOf(town, now) {
  if (!town.surge) {
    if (town.key === "misenum") return ["watching across the bay", "warn"];
    return ["light ash only", "safe"];
  }
  if (now >= town.surge.arrive) return [`surge struck ${fmtClock(town.surge.arrive).split(" · ")[0]} — lost`, "dead"];
  return [`surge inbound, ETA ${fmtClock(town.surge.arrive).split(" · ")[0]}`, "warn"];
}

function syncLedger() {
  const tbody = $("ledger").querySelector("tbody");
  tbody.innerHTML = "";
  const ff = fallFraction(state.time);
  for (const town of sim.towns) {
    const depth = town.depthTotal * ff;
    const tr = document.createElement("tr");
    const [fateText, cls] = fateOf(town, state.time);
    tr.innerHTML = `<td class="tname">${town.name}</td>
      <td class="tval">${depth >= 1 ? depth.toFixed(0) + " cm" : depth.toFixed(1) + " cm"}
        <span class="fate ${cls}">${fateText}</span></td>
      <td class="tval">${town.surge ? fmtClock(town.surge.arrive).split(" · ")[0] : "never"}</td>`;
    tbody.appendChild(tr);
  }
}

function captionFor(now) {
  if (!sim.sustained && now > 0.4) {
    return "The jet never turns buoyant — the whole column fountains back and feeds one devastating density current.";
  }
  if (now < 0.5) return "One o'clock, 24 August 79 AD — the mountain opens after centuries of silence.";
  if (now < 7) return "White pumice phase — a stratospheric stone pine of gas, drifting SE over Pompeii.";
  if (now < 12) return "Grey pumice phase — the column peaks; roofs begin failing under the load in Pompeii.";
  if (now < 18.9) return "Night — the column can no longer carry its load. Collapse pulses send surges downslope.";
  return "Dawn lifts the darkness. Pompeii, Herculaneum, Stabiae — gone under ash and mud, preserved for us.";
}

function syncAll() {
  syncMeters();
  syncLedger();
  $("clock").textContent = fmtClock(state.time);
  $("caption").textContent = captionFor(state.time);
  render();
}

/* ------------------------------------------------------------------ */
/* Shared drawing helpers                                              */
/* ------------------------------------------------------------------ */

/** Day-light factor over our window (13:00 → 08:30 next day). */
function sunFactor(t) {
  // 13:00 bright; dusk 19.5–21.5; night till 14.5 (03:30); dawn 14.5–18.5
  if (t < 6.5) return 1;
  if (t < 8.5) return 1 - (t - 6.5) / 2;
  if (t < 14.5) return 0;
  if (t < 18.5) return (t - 14.5) / 4;
  return Math.min(1, 0.85 + (t - 18.5) / 6);
}

function skyGradient(dark) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  if (dark < 0.5) {
    g.addColorStop(0, "#05060f");
    g.addColorStop(1, "#0a0810");
  } else {
    g.addColorStop(0, `rgba(70,110,170,${0.75 * dark})`);
    g.addColorStop(0.7, `rgba(190,170,140,${0.5 * dark})`);
    g.addColorStop(1, `rgba(230,180,120,${0.35 * dark})`);
  }
  return g;
}

const rng = mulberry32(79);
const RISERS = Array.from({ length: 110 }, () => ({
  p: rng(), off: rng(), sway: rng() * 2 - 1, size: 1 + rng() * 2.2 }));
const CLASTS = Array.from({ length: 150 }, () => ({
  x: rng(), p: rng(), size: 1 + rng() * 2.6, tint: rng() }));

/* ------------------------------------------------------------------ */
/* SECTION view                                                        */
/* ------------------------------------------------------------------ */

// section geometry
const SEC = {
  groundY: 726,
  xVent: 320,
  zPx: 512 / 40000,     // vertical: 40 km -> 512 px
  kx: 0.040,            // horizontal metres -> px
};
const zY = (z) => SEC.groundY - z * SEC.zPx;

function eruptionStrength(t) {
  if (t <= 0) return 0;
  if (t < 0.4) return t / 0.4;
  return 1;
}

function phaseGrey(t) { return t > 7; } // grey pumice after ~8 PM

function activePulses(now) {
  return sim.pulses
    .filter((p) => p.t <= now)
    .map((p) => ({ ...p, age: (now - p.t) * 3600 }))
    .filter((p) => p.age < 3600 * 2.5);
}

function drawSection() {
  const t = state.time;
  const dark = 1 - sunFactor(t);
  ctx.clearRect(0, 0, W, H);

  // sky
  ctx.fillStyle = skyGradient(sunFactor(t));
  ctx.fillRect(0, 0, W, H);
  if (dark > 0.4) {
    ctx.fillStyle = `rgba(255,255,255,${(dark - 0.4) * 0.7})`;
    for (const s of RISERS.slice(0, 60)) {
      ctx.globalAlpha = 0.25 + 0.5 * ((s.off * 7919) % 1);
      ctx.fillRect(((s.p * 997) % 1) * W, ((s.off * 613) % 1) * (SEC.groundY - 260), s.size * 0.8, s.size * 0.8);
    }
    ctx.globalAlpha = 1;
  }

  const strength = eruptionStrength(t);
  const grey = phaseGrey(t);
  const hTop = sim.sustained ? sim.hCol : Math.max(sim.hBall * 1.15, 4000);

  // tropopause + NB guides
  ctx.setLineDash([6, 7]);
  ctx.strokeStyle = "rgba(150,180,220,0.4)";
  line(40, zY(11000), W - 40, zY(11000));
  ctx.fillStyle = "rgba(150,180,220,0.65)";
  ctx.font = "12px ui-monospace, Menlo, monospace";
  ctx.fillText("tropopause 11 km", 46, zY(11000) - 6);
  ctx.setLineDash([]);

  // column envelope
  if (strength > 0) {
    const colAlpha = 0.16 + 0.38 * strength;
    ctx.beginPath();
    const steps = 60;
    for (let i = 0; i <= steps; i++) {
      const z = (i / steps) * hTop;
      const hw = halfWidthM(z) * SEC.kx;
      ctx.lineTo(SEC.xVent - hw, zY(z));
    }
    for (let i = steps; i >= 0; i--) {
      const z = (i / steps) * hTop;
      const hw = halfWidthM(z) * SEC.kx;
      ctx.lineTo(SEC.xVent + hw, zY(z));
    }
    ctx.closePath();
    const cg = ctx.createLinearGradient(0, zY(hTop), 0, SEC.groundY);
    if (sim.sustained) {
      cg.addColorStop(0, `rgba(235,225,215,${colAlpha})`);
      cg.addColorStop(0.25, grey ? `rgba(190,175,165,${colAlpha + 0.12})` : `rgba(245,238,225,${colAlpha + 0.1})`);
      cg.addColorStop(1, `rgba(${grey ? "255,140,70" : "255,205,130"},${colAlpha + 0.25})`);
    } else {
      cg.addColorStop(0, `rgba(120,110,105,${colAlpha})`);
      cg.addColorStop(1, `rgba(255,120,60,${colAlpha + 0.3})`);
    }
    ctx.fillStyle = cg;
    ctx.fill();

    // rising particles
    for (const r of RISERS) {
      let zFrac = ((r.p + t * (0.05 + 0.09 * r.size / 3)) % 1);
      if (!sim.sustained && zFrac > 0.72) continue;
      const z = zFrac * hTop * (sim.sustained ? 1 : 0.98);
      const hw = halfWidthM(z) * SEC.kx;
      const x = SEC.xVent + r.sway * hw * 0.85 * Math.min(1, zFrac * 3);
      ctx.globalAlpha = (sim.sustained ? 0.75 : 0.6) * strength * (1 - 0.55 * zFrac);
      ctx.fillStyle = zFrac < 0.15 ? "#ffdca8" : grey ? "#cbb9a8" : "#efe6da";
      ctx.beginPath();
      ctx.arc(x, zY(z), r.size, 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // umbrella cloud
    if (sim.sustained) {
      const zu = sim.zNb;
      const uw = halfWidthM(hTop) * SEC.kx + 90 + 40 * Math.sin(Math.min(1, t / 3) * 3);
      ctx.save();
      ctx.translate(SEC.xVent, zY(zu));
      ctx.scale(uw / 90, 26 / 90);
      ctx.beginPath();
      ctx.arc(0, 0, 90, Math.PI, 0);
      ctx.closePath();
      ctx.fillStyle = `rgba(${grey ? "175,162,152" : "228,220,210"},${0.34 + 0.2 * strength})`;
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = "rgba(212,175,55,0.5)";
      ctx.setLineDash([2, 5]);
      line(40, zY(sim.zNb), W - 40, zY(sim.zNb));
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(212,175,55,0.8)";
      ctx.fillText(`umbrella / neutral buoyancy ${(sim.zNb / 1000).toFixed(0)} km`, 46, zY(sim.zNb) + 14);
    }

    // height bracket
    ctx.strokeStyle = "rgba(240,230,216,0.55)";
    line(W - 150, zY(hTop), W - 150, SEC.groundY);
    line(W - 156, zY(hTop), W - 144, zY(hTop));
    ctx.fillStyle = "rgba(240,230,216,0.8)";
    ctx.textAlign = "right";
    ctx.fillText(
      sim.sustained ? `column top ${(sim.hCol / 1000).toFixed(1)} km` : `fountain stalls at ${(sim.hBall / 1000).toFixed(1)} km`,
      W - 160, zY(hTop) + 16);
    ctx.textAlign = "left";
  }

  // falling clasts with wind drift
  if (strength > 0 && sim.sustained) {
        for (const c of CLASTS) {
      const cyc = ((c.p + t / 2.2) % 1);
      const drift = state.wind * 8 * (cyc * 3);
      const x = 120 + c.x * (W - 240) + drift + Math.sin((c.p + t) * 6) * 8;
      const y = zY(sim.zNb) + cyc * (SEC.groundY - zY(sim.zNb)) * (0.4 + c.tint * 0.6);
      if (y > SEC.groundY - 4 || x > W - 30 || x < 20) continue;
      ctx.globalAlpha = 0.5 + c.tint * 0.4;
      ctx.fillStyle = c.tint > 0.6 ? "#d8c9b2" : "#a99c8c";
      ctx.beginPath();
      ctx.arc(x, y, c.size, 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // wind arrow
    ctx.strokeStyle = "rgba(150,180,220,0.7)";
    arrow(60, 120, 60 + 40 + state.wind * 6, 120);
    ctx.fillStyle = "rgba(150,180,220,0.8)";
    ctx.fillText(`wind ${state.wind.toFixed(0)} m/s → SE`, 58, 108);
  }

  // ground + cone
  ctx.fillStyle = "#141008";
  ctx.fillRect(0, SEC.groundY, W, H - SEC.groundY);
  ctx.fillStyle = "#241a10";
  ctx.beginPath();
  ctx.moveTo(SEC.xVent - 2600 * SEC.kx - 40, SEC.groundY);
  ctx.lineTo(SEC.xVent - 14, SEC.groundY - 1200 * SEC.zPx * 4.2);
  ctx.lineTo(SEC.xVent - 4, SEC.groundY - 1200 * SEC.zPx * 4.2);
  ctx.lineTo(SEC.xVent + 10, SEC.groundY - 1180 * SEC.zPx * 4.2);
  ctx.lineTo(SEC.xVent + 2600 * SEC.kx + 40, SEC.groundY);
  ctx.closePath();
  ctx.fill();
  if (strength > 0) {
    ctx.fillStyle = `rgba(255,${grey ? 120 : 170},60,${0.75 * strength})`;
    ctx.beginPath();
    ctx.ellipse(SEC.xVent, SEC.groundY - 1200 * SEC.zPx * 4.2, 26 * strength, 8 * strength, 0, 0, 7);
    ctx.fill();
  }

  // surge currents (section)
  for (const p of activePulses(t)) {
    const r = frontRadius(p.age, p.volume);
    const rx = r * SEC.kx;
    const grad = ctx.createLinearGradient(SEC.xVent, 0, SEC.xVent + rx, 0);
    grad.addColorStop(0, "rgba(255,90,40,0.05)");
    grad.addColorStop(0.8, "rgba(255,120,50,0.32)");
    grad.addColorStop(1, "rgba(255,200,120,0.75)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(SEC.xVent, SEC.groundY);
    ctx.quadraticCurveTo(SEC.xVent + rx * 0.5, SEC.groundY - 60 - 30 * Math.sin(p.age / 40),
      SEC.xVent + rx, SEC.groundY);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,200,120,0.9)";
    ctx.fillText(`${(r / 1000).toFixed(1)} km`, SEC.xVent + rx - 30, SEC.groundY - 12);
  }

  // towns
  ctx.font = "12.5px -apple-system, sans-serif";
  for (const town of sim.towns) {
    const { x: xm } = townXY(town);
    const x = SEC.xVent + xm * SEC.kx;
    if (x < 30 || x > W - 60) continue;
    const depth = town.depthTotal * fallFraction(t);
    const barH = Math.min(120, depth * 0.62);
    const surged = town.surge && t >= town.surge.arrive;
    ctx.fillStyle = surged ? "rgba(120,60,40,0.9)" : "rgba(190,180,168,0.85)";
    ctx.fillRect(x - 5, SEC.groundY - barH, 10, barH);
    ctx.strokeStyle = surged ? "#ff9ba0" : "rgba(240,230,216,0.8)";
    line(x - 7, SEC.groundY, x + 7, SEC.groundY);
    ctx.fillStyle = surged ? "#ff9ba0" : "rgba(240,230,216,0.92)";
    ctx.fillText(town.name, x - 24, SEC.groundY + 18);
    ctx.fillStyle = "rgba(185,179,171,0.85)";
    ctx.fillText(depth >= 1 ? `${depth.toFixed(0)} cm` : "<1 cm", x - 20, SEC.groundY + 33);
    if (surged) {
      ctx.fillStyle = "#e5484d";
      ctx.fillText("✝", x - 4, SEC.groundY - barH - 8);
    }
  }
}

function halfWidthM(z) {
  // jet widens roughly linearly; the umbrella flare is drawn separately
  return 340 + 0.155 * z;
}

/* ------------------------------------------------------------------ */
/* MAP view                                                            */
/* ------------------------------------------------------------------ */

const MAP = { cx: -6, cy: -6, s: 25.4 };
const mx = (xKm) => W / 2 + (xKm - MAP.cx) * MAP.s;
const my = (yKm) => H / 2 - (yKm - MAP.cy) * MAP.s;

// stylized Bay of Naples: the sea polygon (km offsets from Vesuvius, x=E, y=N)
// runs Naples → Pozzuoli shore → Misenum cape → inner-bay shore → Sorrentine
// peninsula tip, then closes across the open Tyrrhenian to the south-west.
const SEA = [
  [-17, 7], [-12.5, 1], [-13, -4], [-26, -3.2], [-29.5, -5.8],
  [-21, -6.5], [-14, -4.2], [-6, -3.4], [0.5, -4.8], [4.5, -7.5], [6.5, -9.5],
  [8.5, -13.5], [7, -17], [4, -22], [1, -30], [-2, -36],
  [-8, -46], [-46, -46], [-46, 10],
];

function traceSea() {
  ctx.beginPath();
  ctx.moveTo(mx(SEA[0][0]), my(SEA[0][1]));
  for (const [x, y] of SEA) ctx.lineTo(mx(x), my(y));
  ctx.closePath();
}

function drawMap() {
  const t = state.time;
  const dark = 1 - sunFactor(t);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = skyGradient(sunFactor(t));
  ctx.fillRect(0, 0, W, H);

  // land everywhere, then the bay bites the south-west out of it
  ctx.fillStyle = `rgba(46,38,26,${0.96 - 0.2 * dark})`;
  ctx.fillRect(0, 0, W, H);
  traceSea();
  ctx.fillStyle = `rgba(18,42,66,${0.88 - 0.25 * dark})`;
  ctx.fill();

  // isomass heat (log-scaled ash blanket)
  const iso = sim.isomass;
  const cell = 10;
  for (let px = 0; px < W; px += cell) {
    for (let py = 0; py < H; py += cell) {
      const xKm = (px - W / 2) / MAP.s + MAP.cx;
      const yKm = (H / 2 - py) / MAP.s + MAP.cy;
      const m = iso(xKm * 1000, yKm * 1000);
      if (m < 1) continue;
      const lg = Math.log10(m);           // 0 … ~4
      const depthCm = (m / 600) * 100;
      if (depthCm < 0.5) continue;
      ctx.fillStyle = `rgba(${215 - lg * 8},${205 - lg * 22},${188 - lg * 30},${Math.min(0.82, 0.1 + lg * 0.19)})`;
      ctx.fillRect(px, py, cell, cell);
    }
  }

  // surge sectors
  for (const p of activePulses(t)) {
    const r = frontRadius(p.age, p.volume);
    const done = r >= runoutMax(p.volume) - 1;
    const rp = r / 1000 * MAP.s;
    ctx.save();
    ctx.translate(mx(0), my(0));
    // canvas angles: bearing deg -> math rad (bearing measured clockwise from north/up)
    const a0 = ((p.centre - p.half - 90) * Math.PI) / 180;
    const a1 = ((p.centre + p.half - 90) * Math.PI) / 180;
    const grad = ctx.createRadialGradient(0, 0, rp * 0.4, 0, 0, rp);
    grad.addColorStop(0, "rgba(255,90,40,0.02)");
    grad.addColorStop(1, done ? "rgba(255,90,40,0.14)" : "rgba(255,150,60,0.4)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, rp, a0, a1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // coastline stroke on top
  traceSea();
  ctx.strokeStyle = "rgba(160,190,215,0.55)";
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.lineWidth = 1;

  // dispersal-axis arrow
  arrow(mx(-4), my(4), mx(-4 + state.wind * 1.1), my(4 - state.wind * 1.1));
  ctx.fillStyle = "rgba(150,180,220,0.85)";
  ctx.font = "12px ui-monospace, Menlo, monospace";
  ctx.fillText(`wind ${state.wind.toFixed(0)} m/s`, mx(-4), my(4) - 10);

  // volcano marker
  drawVolcanoMarker(mx(0), my(0));

  // towns
  for (const town of sim.towns) {
    const px = mx(town.dE), py = my(town.dN);
    const depth = town.depthTotal * fallFraction(t);
    const surged = town.surge && t >= town.surge.arrive;
    ctx.fillStyle = surged ? "#ff9ba0" : "#ffe9c9";
    ctx.beginPath();
    ctx.arc(px, py, 5, 0, 7);
    ctx.fill();
    ctx.strokeStyle = "rgba(10,8,6,0.8)";
    ctx.stroke();
    ctx.font = "bold 13px -apple-system, sans-serif";
    ctx.fillStyle = surged ? "#ff9ba0" : "rgba(240,230,216,0.95)";
    ctx.fillText(town.name, px + 9, py + 4);
    ctx.font = "12px ui-monospace, Menlo, monospace";
    ctx.fillStyle = "rgba(185,179,171,0.95)";
    ctx.fillText(depth >= 1 ? `${depth.toFixed(0)} cm` : "ash trace", px + 9, py + 19);
    if (surged) {
      ctx.fillStyle = "#e5484d";
      ctx.font = "bold 12px -apple-system, sans-serif";
      ctx.fillText(`✝ ${fmtClock(town.surge.arrive).split(" · ")[0]}`, px + 9, py + 34);
    }
  }

  // legend
  ctx.font = "12px ui-monospace, Menlo, monospace";
  ctx.fillStyle = "rgba(185,179,171,0.9)";
  ctx.fillText("shading: pumice-fall deposit thickness (exponential thinning)", 20, H - 46);
  ctx.fillText("orange fan: pyroclastic density currents (box model)", 20, H - 28);
}

function drawVolcanoMarker(px, py) {
  const t = state.time;
  const strength = eruptionStrength(t);
  ctx.fillStyle = "#3a2b1a";
  ctx.beginPath();
  ctx.moveTo(px - 14, py);
  ctx.lineTo(px, py - 22);
  ctx.lineTo(px + 14, py);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(240,230,216,0.5)";
  ctx.stroke();
  if (strength > 0 && sim.sustained) {
    // plume seen from above: expanding rings to umbrella radius
    const rp = (halfWidthM(sim.hCol) / 1000) * MAP.s;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(px, py, rp * (0.5 + 0.25 * i), 0, 7);
      ctx.strokeStyle = `rgba(${phaseGrey(t) ? "190,175,165" : "235,228,218"},${0.35 - 0.09 * i})`;
      ctx.lineWidth = 8;
      ctx.stroke();
    }
    ctx.lineWidth = 1;
  }
}

/* ------------------------------------------------------------------ */

function line(a, b, c, d) {
  ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke();
}

function arrow(x0, y0, x1, y1) {
  ctx.lineWidth = 2;
  line(x0, y0, x1, y1);
  const ang = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - 9 * Math.cos(ang - 0.4), y1 - 9 * Math.sin(ang - 0.4));
  ctx.lineTo(x1 - 9 * Math.cos(ang + 0.4), y1 - 9 * Math.sin(ang + 0.4));
  ctx.closePath();
  ctx.fillStyle = ctx.strokeStyle;
  ctx.fill();
  ctx.lineWidth = 1;
}

function render() {
  if (state.view === "section") drawSection();
  else drawMap();
}

/* ------------------------------------------------------------------ */
/* Loop                                                                */
/* ------------------------------------------------------------------ */

let lastTs = null;
function loop(ts) {
  if (!state.playing) { lastTs = null; return; }
  if (lastTs !== null) {
    const dt = Math.min(0.06, (ts - lastTs) / 1000);
    state.time = Math.min(19.6, state.time + dt * 0.42);
    $("time").value = state.time;
    syncAll();
    if (state.time >= 19.6) { state.playing = false; $("play").classList.remove("on"); }
  }
  lastTs = ts;
  requestAnimationFrame(loop);
}

/* ------------------------------------------------------------------ */
/* Events                                                              */
/* ------------------------------------------------------------------ */

$("u0").addEventListener("input", (e) => {
  state.u0 = +e.target.value; state.scenario = "custom"; recompute(); syncInputs(); syncAll();
});
$("T0").addEventListener("input", (e) => {
  state.T0 = +e.target.value; state.scenario = "custom"; recompute(); syncInputs(); syncAll();
});
$("wind").addEventListener("input", (e) => {
  state.wind = +e.target.value; state.scenario = "custom"; recompute(); syncInputs(); syncAll();
});
$("time").addEventListener("input", (e) => {
  state.time = +e.target.value; syncAll();
});
$("play").addEventListener("click", () => {
  state.playing = !state.playing;
  $("play").classList.toggle("on", state.playing);
  if (state.playing) { if (state.time >= 19.6) state.time = 0; requestAnimationFrame(loop); }
});
document.querySelectorAll("#view-tabs .tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    state.view = btn.dataset.view;
    document.querySelectorAll("#view-tabs .tab").forEach((b) => b.classList.toggle("active", b === btn));
    syncAll();
  });
});
document.querySelectorAll(".chip[data-scenario]").forEach((btn) => {
  btn.addEventListener("click", () => loadScenario(btn.dataset.scenario));
});
$("pulse").addEventListener("click", () => triggerExtraPulse());

function loadScenario(name) {
  const sc = SCENARIOS[name];
  if (!sc) return;
  Object.assign(state, sc, { scenario: name });
  recompute(); syncInputs(); syncAll();
}

/** Manual collapse pulse at the current moment, sized by how overloaded the jet is. */
function triggerExtraPulse() {
  const V = sim.sustained ? 1.2e9 : 2.8e9;
  sim.pulses.push({ t: state.time, label: "manual collapse", volume: V, centre: 147, half: 40 });
  syncAll();
}

/* ------------------------------------------------------------------ */
/* Scripting API for the video renderer                                */
/* ------------------------------------------------------------------ */

window.__demo = {
  setJet(u0, T0) {
    state.u0 = u0; state.T0 = T0 ?? state.T0; state.scenario = "custom";
    recompute(); syncInputs(); syncAll();
  },
  setWind(w) { state.wind = w; state.scenario = "custom"; recompute(); syncInputs(); syncAll(); },
  setTime(h) { state.playing = false; state.time = h; $("time").value = h; syncAll(); },
  nudgeTime(dh) { state.time = Math.min(19.6, Math.max(0, state.time + dh)); $("time").value = state.time; syncAll(); },
  play() { state.playing = true; $("play").classList.add("on"); requestAnimationFrame(loop); },
  pause() { state.playing = false; $("play").classList.remove("on"); },
  setView(v) {
    state.view = v;
    document.querySelectorAll("#view-tabs .tab").forEach((b) => b.classList.toggle("active", b.dataset.view === v));
    syncAll();
  },
  loadScenario(name) { loadScenario(name); },
  triggerPulse() { triggerExtraPulse(); },
  getState() {
    return {
      u0: state.u0, T0: state.T0, wind: state.wind, time: state.time,
      view: state.view, sustained: sim.sustained,
      mdot: sim.mdot, hCol: sim.hCol, zNb: sim.zNb,
      margin: sim.margin,
      towns: sim.towns.map((t) => ({ key: t.key, depth: +(t.depthTotal * fallFraction(state.time)).toFixed(1), surge: t.surge })),
    };
  },
};

/* init */
syncInputs();
syncAll();
