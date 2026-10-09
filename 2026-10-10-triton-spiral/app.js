/* Triton Spiral — canvas view + controls. Renders the tidal track computed in
 * triton.js: ghost ellipses of the orbit's own past, the synchronous orbit and
 * Roche limit rings, an illustrative-motion Triton, and a deterministic ring
 * era after the shatter. Everything scrubbable, nothing pre-baked. */
(function () {
  "use strict";
  var T = window.Triton;

  var canvas = document.getElementById("sky");
  var ctx = canvas.getContext("2d");
  var scrub = document.getElementById("scrub");
  var playBtn = document.getElementById("play");
  var resetBtn = document.getElementById("reset");
  var speedSel = document.getElementById("speed");
  var RING_WINDOW = 2.4e8;              // years of ring era on the timeline
  var RING_MASS_TEXT = "2.1\u00d710\u00b2\u00b2 kg";
  var SATURN_RATIO = 1400;
  var reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  var PRESETS = {
    today: { label: "today", a0: T.A_NOW, e0: T.E_NOW, k2q: T.K2_Q_TRITON_CAPTURE,
             era: "since October 10, 2026" },
    capture: { label: "capture", a0: 985442, e0: 0.80, k2q: T.K2_Q_TRITON_CAPTURE,
               era: "since the capture, early in Neptune's history" }
  };

  var state = {
    preset: "today", retro: true, playing: false, speed: 50,
    t: 0, track: null, T: 1, doom: null,
    phase: 1.2,             // illustrative mean anomaly (radians)
    scale: 0, lastNow: 0
  };

  function recompute() {
    var p = PRESETS[state.preset];
    state.track = T.computeTrack({
      a0: p.a0, e0: p.e0, retro: state.retro, k2qTriton: p.k2q, tMaxYears: 4.6e9
    });
    state.doom = state.track.doomYears;
    state.T = (state.doom != null ? state.doom : 4.6e9) + RING_WINDOW;
    state.t = 0;
    state.playing = false;
    scrub.value = 0;
    playBtn.textContent = "Play";
  }

  /* ---------------- canvas plumbing ---------------- */
  var W = 0, H = 0, dpr = 1, stars = null;

  function resize() {
    var box = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(320, box.width); H = Math.max(320, box.height);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    makeStars();
  }

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var z = Math.imul(seed ^ seed >>> 15, 1 | seed);
      z = z + Math.imul(z ^ z >>> 7, 61 | z) ^ z;
      return ((z ^ z >>> 14) >>> 0) / 4294967296;
    };
  }

  function makeStars() {
    stars = document.createElement("canvas");
    stars.width = canvas.width; stars.height = canvas.height;
    var s = stars.getContext("2d");
    s.scale(dpr, dpr);
    var rnd = mulberry32(20261010);
    for (var i = 0; i < 170; i++) {
      var x = rnd() * W, y = rnd() * H, r = 0.4 + rnd() * 1.3;
      var tint = rnd();
      s.fillStyle = tint < 0.12 ? "rgba(240,180,200," : tint < 0.24 ? "rgba(170,190,255," : "rgba(225,232,248,";
      s.globalAlpha = 0.12 + rnd() * 0.55;
      s.beginPath(); s.arc(x, y, r, 0, 6.2832); s.fill();
    }
    s.globalAlpha = 0.05;
    s.fillStyle = "#7b96f7";
    for (i = 0; i < 3; i++) {
      var gx = rnd() * W, gy = rnd() * H;
      var g = s.createRadialGradient(gx, gy, 0, gx, gy, 60 + rnd() * 70);
      g.addColorStop(0, "rgba(123,150,247,.35)"); g.addColorStop(1, "rgba(123,150,247,0)");
      s.fillStyle = g; s.beginPath(); s.arc(gx, gy, 130, 0, 6.2832); s.fill();
    }
  }

  var OMEGA = -0.56;         // fixed orientation of the major axis on screen
  var SIGN = { retro: 1, pro: -1 };   // which way the anomaly sweeps

  function ellipsePath(a, e) {
    var b = a * Math.sqrt(Math.max(0, 1 - e * e));
    var cx = W / 2 - Math.cos(OMEGA) * a * e;
    var cy = H / 2 - Math.sin(OMEGA) * a * e;
    ctx.beginPath();
    ctx.ellipse(cx, cy, a, b, OMEGA, 0, 6.2832);
    return { cx: cx, cy: cy, b: b };
  }

  function keplerPos(a, e, M, dir) {
    var E = M;
    for (var i = 0; i < 6; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    var r = a * (1 - e * Math.cos(E));
    var nu = Math.atan2(Math.sqrt(Math.max(0, 1 - e * e)) * Math.sin(E), Math.cos(E) - e);
    var th = OMEGA + dir * nu;
    return { x: W / 2 + r * Math.cos(th), y: H / 2 + r * Math.sin(th),
             r: r, th: th, nu: nu };
  }

  function ringLabel(text, radiusPx, angle, color) {
    if (radiusPx < 30 || radiusPx > Math.min(W, H) * 0.52) return;
    var x = W / 2 + Math.cos(angle) * radiusPx, y = H / 2 + Math.sin(angle) * radiusPx;
    ctx.save();
    ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = Math.cos(angle) >= 0 ? "left" : "right";
    var pad = Math.cos(angle) >= 0 ? 8 : -8;
    ctx.fillStyle = "rgba(6,10,20,.75)";
    var w = ctx.measureText(text).width;
    var bx = Math.cos(angle) >= 0 ? x + pad - 4 : x + pad - w - 4;
    ctx.fillRect(bx, y - 15, w + 8, 19);
    ctx.fillStyle = color;
    ctx.fillText(text, x + pad, y);
    ctx.restore();
  }

  function drawNeptune(scale) {
    var cx = W / 2, cy = H / 2, r = Math.max(4, T.R_NEPTUNE * scale);
    var g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r);
    g.addColorStop(0, "#a9c1ff"); g.addColorStop(0.45, "#5578e2");
    g.addColorStop(0.8, "#2b4694"); g.addColorStop(1, "#182a58");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = "rgba(150,180,255,.4)"; ctx.lineWidth = 1.2;
    ctx.stroke();
    if (r > 56) {   // faint bands + a dark spot, only when zoomed in
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.985, 0, 6.2832); ctx.clip();
      ctx.globalAlpha = 0.16; ctx.strokeStyle = "#0c1838"; ctx.lineWidth = r * 0.07;
      for (var i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.ellipse(cx, cy + i * r * 0.34, r * 1.05, r * 0.10, 0, 0, 6.2832);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.20; ctx.fillStyle = "#0a1430";
      ctx.beginPath(); ctx.ellipse(cx + r * 0.22, cy + r * 0.3, r * 0.30, r * 0.13, -0.3, 0, 6.2832); ctx.fill();
      ctx.restore();
    }
    if (r > 30) {   // spin indicator: Neptune turns prograde (CCW on screen)
      var ar = r + 14;
      ctx.save();
      ctx.strokeStyle = "rgba(123,150,247,.85)"; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(cx, cy, ar, -2.4, -0.9); ctx.stroke();
      var tip = -0.9, tx = cx + Math.cos(tip) * ar, ty = cy + Math.sin(tip) * ar;
      var ta = tip + Math.PI / 2;
      ctx.fillStyle = "rgba(123,150,247,.9)";
      ctx.beginPath();
      ctx.moveTo(tx + Math.cos(ta) * 6, ty + Math.sin(ta) * 6);
      ctx.lineTo(tx + Math.cos(tip) * 4, ty + Math.sin(tip) * 4);
      ctx.lineTo(tx - Math.cos(tip) * 4, ty - Math.sin(tip) * 4);
      ctx.closePath(); ctx.fill();
      ctx.font = "10.5px ui-sans-serif, system-ui, sans-serif";
      ctx.fillStyle = "rgba(142,163,205,.9)"; ctx.textAlign = "center";
      ctx.fillText("Neptune spins \u00b7 16 h", cx, cy - ar - 7);
      ctx.restore();
    }
  }

  /* Ring era: every particle is a pure function of ringClock, so scrubbing
   * back and forth replays the same ring. */
  var ringRnd = mulberry32(18461010);
  var ringParticles = [];
  for (var i = 0; i < 950; i++) {
    ringParticles.push({ u1: ringRnd(), u2: ringRnd(), u3: ringRnd(), u4: ringRnd() });
  }
  var MOONLETS = [{ a: 1.30, ang: 0.7 }, { a: 1.36, ang: 2.6 }, { a: 1.43, ang: 4.4 }];

  function drawRing(clock, scale, dir) {
    var RO = T.A_ROCHE, cx = W / 2, cy = H / 2;
    ctx.save();
    ctx.strokeStyle = "rgba(224,122,95,.35)";
    ctx.setLineDash([4, 7]);
    ctx.beginPath(); ctx.arc(cx, cy, RO * scale, 0, 6.2832); ctx.stroke();
    ctx.setLineDash([]);
    for (var i = 0; i < ringParticles.length; i++) {
      var p = ringParticles[i];
      var a = RO * (1.04 + 0.15 * p.u1) + 0.17 * RO * (p.u2 - 0.5) * 2 *
              Math.min(1, clock / 1.2e8);
      var ang = p.u3 * 6.2832 + dir * 6.2832 * (clock / 5e5) * Math.pow(RO / a, 1.5);
      var x = cx + Math.cos(ang) * a * scale, y = cy + Math.sin(ang) * a * scale;
      if (a < RO * 1.035) {          // inner edge: streaking down onto Neptune
        ctx.strokeStyle = "rgba(232,150,120," + (0.25 + 0.3 * p.u4).toFixed(2) + ")";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, y);
        ctx.lineTo(x + (cx - x) * 0.06, y + (cy - y) * 0.06 + 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.u4 < 0.35 ? "rgba(255,222,232,.85)" : "rgba(196,214,248,.6)";
        ctx.globalAlpha = 0.5 + 0.5 * p.u4;
        ctx.fillRect(x, y, 1.6, 1.6);
      }
    }
    ctx.globalAlpha = 1;
    if (clock > 6e7) {               // outer edge re-accretes past the limit
      var ramp = Math.min(1, (clock - 6e7) / 1.5e7);
      for (i = 0; i < MOONLETS.length; i++) {
        var m = MOONLETS[i];
        var mx = cx + Math.cos(m.ang) * RO * m.a * scale;
        var my = cy + Math.sin(m.ang) * RO * m.a * scale;
        ctx.globalAlpha = ramp;
        ctx.fillStyle = "#ffe3ee";
        ctx.shadowColor = "#f2a7bf"; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(mx, my, 3.2, 0, 6.2832); ctx.fill();
        ctx.shadowBlur = 0;
        if (ramp === 1) {
          ctx.font = "10.5px ui-sans-serif, system-ui, sans-serif";
          ctx.fillStyle = "rgba(242,167,191,.95)"; ctx.textAlign = "center";
          ctx.fillText("new moons", mx, my - 9);
        }
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  /* ---------------- main draw ---------------- */
  var ghostCache = { key: "", n: 0 };

  function draw(dt) {
    var s = T.sampleTrack(state.track, Math.min(state.t, state.doom != null ? state.doom : state.t));
    var shattered = state.doom != null && state.t > state.doom;
    var ringClock = shattered ? state.t - state.doom : 0;
    var rApo = s.a * (1 + s.e);
    var target = Math.min(W, H) / 2 / Math.max(rApo * 1.30, T.A_ROCHE * 1.8);
    state.scale = state.scale ? state.scale + (target - state.scale) * Math.min(1, dt * 4) : target;
    var scale = state.scale;
    var dir = SIGN[state.retro ? "retro" : "pro"];

    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(stars, 0, 0, W, H);
    drawNeptune(scale);

    /* the orbit's own past: ghost ellipses sampled from the track */
    if (!shattered || ringClock < 3e6) {
      var fade = shattered ? Math.max(0, 1 - ringClock / 3e6) : 1;
      var pts = state.track.points;
      var upto = 0;
      while (upto < pts.length - 1 && pts[upto + 1].t <= state.t) upto++;
      var n = Math.min(upto, 70);
      var step = Math.max(1, Math.floor(upto / 70));
      for (var i = 0; i < upto; i += step) {
        var p = pts[i];
        var f = i / Math.max(1, upto);
        ctx.strokeStyle = "rgba(" + Math.round(123 + 119 * f) + "," +
          Math.round(150 + 17 * f) + "," + Math.round(247 - 28 * f) + "," +
          (0.04 + 0.09 * f * (0.3 + 0.7 * fade)).toFixed(3) + ")";
        ctx.lineWidth = 1;
        ellipsePath(p.a * scale, p.e);
        ctx.stroke();
      }
    }

    /* reference rings: synchronous orbit (dotted) and Roche limit (dashed) */
    ctx.strokeStyle = "rgba(95,208,189,.5)";
    ctx.lineWidth = 1.2;
    ctx.setLineDash([2, 6]);
    ctx.beginPath(); ctx.arc(W / 2, H / 2, T.A_SYNC * scale, 0, 6.2832); ctx.stroke();
    ctx.setLineDash([]);
    ringLabel("synchronous orbit \u00b7 3.4 R\u2099", T.A_SYNC * scale, -0.8, "#5fd0bd");

    if (!shattered || ringClock < 3e6) {
      var fade2 = shattered ? Math.max(0, 1 - ringClock / 3e6) : 1;
      /* Roche limit ring */
      ctx.strokeStyle = "rgba(224,122,95," + (0.55 * fade2 + 0.3 * (1 - fade2)).toFixed(2) + ")";
      ctx.lineWidth = 1.2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.arc(W / 2, H / 2, T.A_ROCHE * scale, 0, 6.2832); ctx.stroke();
      ctx.setLineDash([]);
      ringLabel("Roche limit \u00b7 2.3 R\u2099", T.A_ROCHE * scale, 2.55, "#e07a5f");

      /* current orbit + Triton */
      ctx.save();
      ctx.globalAlpha = fade2;
      ctx.strokeStyle = "rgba(242,167,191,.85)"; ctx.lineWidth = 1.5;
      ctx.shadowColor = "rgba(242,167,191,.5)"; ctx.shadowBlur = 5;
      ellipsePath(s.a * scale, s.e); ctx.stroke();
      ctx.shadowBlur = 0;
      var pos = keplerPos(s.a * scale, s.e, state.phase, dir);
      var ahead = keplerPos(s.a * scale, s.e, state.phase + 0.05, dir);
      var dx = ahead.x - pos.x, dy = ahead.y - pos.y;
      var dl = Math.hypot(dx, dy) || 1;
      var tr = Math.max(3.5, Math.min(11, T.R_TRITON * scale * 2));
      ctx.fillStyle = "#ffdce9";
      ctx.shadowColor = "#f2a7bf"; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.arc(pos.x, pos.y, tr, 0, 6.2832); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,220,233,.95)";
      ctx.font = "11.5px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText("Triton", pos.x + tr + 6, pos.y + 4);
      var hx = dx / dl, hy = dy / dl;
      ctx.strokeStyle = "rgba(255,220,233,.9)"; ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(pos.x + hx * (tr + 12), pos.y + hy * (tr + 12));
      ctx.lineTo(pos.x + hx * (tr + 22), pos.y + hy * (tr + 22));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pos.x + hx * (tr + 26), pos.y + hy * (tr + 26));
      ctx.lineTo(pos.x + hx * (tr + 16) - hy * 4, pos.y + hy * (tr + 16) + hx * 4);
      ctx.lineTo(pos.x + hx * (tr + 16) + hy * 4, pos.y + hy * (tr + 16) - hx * 4);
      ctx.closePath();
      ctx.fillStyle = "rgba(255,220,233,.9)"; ctx.fill();
      ctx.restore();
    }
    if (shattered) drawRing(ringClock, scale, dir);

    /* scale bar */
    var bars = [1e4, 2e4, 5e4, 1e5, 2e5, 5e5], L = 0;
    for (i = 0; i < bars.length; i++) if (bars[i] * scale <= 150) L = bars[i];
    if (L) {
      var x0 = W - 24 - L * scale, y0 = H - 26;
      ctx.strokeStyle = "rgba(142,163,205,.8)"; ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x0, y0); ctx.lineTo(x0 + L * scale, y0);
      ctx.moveTo(x0, y0 - 4); ctx.lineTo(x0, y0 + 4);
      ctx.moveTo(x0 + L * scale, y0 - 4); ctx.lineTo(x0 + L * scale, y0 + 4);
      ctx.stroke();
      ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
      ctx.fillStyle = "rgba(142,163,205,.9)"; ctx.textAlign = "right";
      ctx.fillText(L >= 1e5 ? (L / 1e3) + ",000 km" : L.toLocaleString() + " km",
        x0 + L * scale, y0 - 8);
      ctx.textAlign = "left";
    }
    return { s: s, shattered: shattered, ringClock: ringClock };
  }

  /* ---------------- DOM readouts ---------------- */
  var SUP = { "-": "\u207b", "0": "\u2070", "1": "\u00b9", "2": "\u00b2", "3": "\u00b3",
              "4": "\u2074", "5": "\u2075", "6": "\u2076", "7": "\u2077",
              "8": "\u2078", "9": "\u2079", "+": "\u207a" };
  function sup(x) { return String(x).split("").map(function (c) { return SUP[c] || c; }).join(""); }

  function fmtDur(yr) {
    if (yr >= 1e9) return (yr / 1e9).toFixed(2) + " Gyr";
    if (yr >= 1e6) return (yr / 1e6).toFixed(1) + " Myr";
    if (yr >= 1e3) return Math.round(yr / 1e3) + " kyr";
    return Math.max(0, Math.round(yr)) + " yr";
  }

  var dom = {
    big: document.getElementById("time-big"), era: document.getElementById("time-era"),
    phase: document.getElementById("phase-chip"), dirChip: document.getElementById("dir-chip"),
    caption: document.getElementById("slider-caption"), note: document.getElementById("scale-note"),
    a: document.getElementById("r-a"), aSub: document.getElementById("r-a-sub"),
    p: document.getElementById("r-p"), pSub: document.getElementById("r-p-sub"),
    e: document.getElementById("r-e"), eSub: document.getElementById("r-e-sub"),
    dk: document.getElementById("r-doom-k"), d: document.getElementById("r-doom"),
    dSub: document.getElementById("r-doom-sub"),
    h: document.getElementById("r-heat"), hSub: document.getElementById("r-heat-sub"),
    hk: document.querySelector("#r-heat").closest(".tile").querySelector(".k")
  };

  function updateDom(view) {
    var s = view.s, shattered = view.shattered, ringClock = view.ringClock;
    var p = PRESETS[state.preset];

    if (shattered) {
      dom.big.textContent = "ring age " + fmtDur(ringClock);
      dom.era.textContent = "since Triton shattered";
    } else if (state.t <= 0) {
      dom.big.textContent = state.preset === "today" ? "today" : "just captured";
      dom.era.textContent = p.era;
    } else {
      dom.big.textContent = "+" + fmtDur(state.t);
      dom.era.textContent = p.era;
    }

    var chipText, chipCls;
    if (shattered) { chipText = "ring era \u2014 Triton is a ring now"; chipCls = "chip warn"; }
    else if (s.e > 0.01) { chipText = "circularizing \u2014 tides eat the ellipse"; chipCls = "chip live"; }
    else if (state.retro) { chipText = "retrograde spiral \u2014 the tide always wins"; chipCls = "chip live"; }
    else { chipText = "prograde drift \u2014 slipping away to safety"; chipCls = "chip calm"; }
    dom.phase.textContent = chipText; dom.phase.className = chipCls;
    dom.dirChip.textContent = state.retro
      ? "orbiting backwards \u00b7 156.9\u00b0 tilt"
      : "orbiting forwards (what-if)";
    dom.dirChip.className = state.retro ? "chip" : "chip calm";

    if (shattered) {
      dom.dk.textContent = "Ring age";
      dom.d.textContent = fmtDur(ringClock);
      dom.dSub.textContent = "inner edge rains onto Neptune";
      dom.a.textContent = (T.A_ROCHE * 1.1 / 1000).toFixed(0) + "k\u2013" + (T.A_ROCHE * 1.5 / 1000).toFixed(0) + "k km";
      dom.aSub.textContent = "spreading ring \u00b7 past 2.5 R_N";
      dom.p.textContent = "\u2014";
      dom.pSub.textContent = "particles shear at their own Kepler rates";
      dom.e.textContent = "\u2014";
      dom.eSub.textContent = "shattered at the Roche limit";
      dom.hk.textContent = "Ring mass";
      dom.h.textContent = RING_MASS_TEXT;
      dom.hSub.textContent = "\u2248 " + SATURN_RATIO.toLocaleString() + " \u00d7 Saturn's rings today";
    } else {
      dom.a.textContent = Math.round(s.a).toLocaleString() + " km";
      dom.aSub.textContent = (s.a / T.R_NEPTUNE).toFixed(1) + " Neptune radii";
      dom.p.textContent = T.periodDays(s.a).toFixed(2) + " d";
      dom.pSub.textContent = state.retro ? "backwards around Neptune" : "forwards around Neptune";
      dom.e.textContent = s.e < 1e-3 ? s.e.toFixed(6) : s.e.toFixed(3);
      dom.eSub.textContent = s.e > 0.01 ? "tides are squeezing it out" : "circular \u2014 as measured today";
      if (state.doom != null) {
        dom.dk.textContent = "Time to shatter";
        dom.d.textContent = fmtDur(Math.max(0, state.doom - state.t));
        dom.dSub.textContent = "until the Roche limit";
      } else {
        dom.dk.textContent = "Outward drift";
        dom.d.textContent = "+" + Math.round(s.a - PRESETS[state.preset].a0).toLocaleString() + " km";
        dom.dSub.textContent = "no shatter \u2014 drifting away";
      }
      var ratio = T.tidalFluxRatio(s.a, s.e, p.k2q);
      dom.hk.textContent = "Tidal heat inside Triton";
      if (ratio > 0.5) {
        dom.h.textContent = ratio >= 100 ? Math.round(ratio / 10) * 10 + "\u00d7 sunlight" : ratio.toFixed(1) + "\u00d7 sunlight";
        var watts = T.tidalHeatW(s.a, s.e, p.k2q);
        var m = watts.toExponential(1).split("e+");
        dom.hSub.textContent = "\u2248 " + m[0] + "\u00d710" + sup(m[1]) +
          " W \u00b7 peaks near pericenter";
      } else {
        dom.h.textContent = "quiet";
        dom.hSub.textContent = "the orbit is circular \u2014 tides barely grip";
      }
    }

    dom.caption.textContent = state.doom != null
      ? "shatter at +" + fmtDur(state.doom) + " \u00b7 then the ring era"
      : "no shatter on this path \u2014 Triton drifts outward the whole way";
    dom.note.textContent = "view spans " +
      Math.round(Math.max(W, H) / 2 / state.scale / T.R_NEPTUNE).toFixed(1) + " Neptune radii \u00b7 ghost ellipses are the orbit's own past";
  }

  /* ---------------- loop ---------------- */
  var frameCount = 0;
  function pump(dt) {
    frameCount++;
    if (state.playing) {
      state.t = Math.min(state.T, state.t + state.speed * 1e6 * dt);
      if (!reduceMotion) state.phase += dt * 0.55 * (state.retro ? 1 : -1);
      if (state.t >= state.T) { state.playing = false; playBtn.textContent = "Play"; }
      scrub.value = Math.round(1000 * state.t / state.T);
    }
    var view = draw(dt);
    if (frameCount % 6 === 1) updateDom(view);
    return view;
  }

  function frame(now) {
    var dt = Math.min(0.05, (now - state.lastNow) / 1000 || 0.016);
    state.lastNow = now;
    pump(dt);
    requestAnimationFrame(frame);
  }

  /* ---------------- wiring ---------------- */
  playBtn.addEventListener("click", function () {
    if (state.t >= state.T) { state.t = 0; scrub.value = 0; }
    state.playing = !state.playing;
    playBtn.textContent = state.playing ? "Pause" : "Play";
  });
  resetBtn.addEventListener("click", function () {
    state.t = 0; state.playing = false; scrub.value = 0; playBtn.textContent = "Play";
  });
  scrub.addEventListener("input", function () {
    state.t = (scrub.value / 1000) * state.T;
    if (state.playing && state.t >= state.T) { state.playing = false; playBtn.textContent = "Play"; }
  });
  speedSel.addEventListener("change", function () { state.speed = +speedSel.value; });

  function setPreset(name) {
    state.preset = name;
    document.getElementById("preset-today").setAttribute("aria-pressed", name === "today");
    document.getElementById("preset-capture").setAttribute("aria-pressed", name === "capture");
    recompute();
  }
  function setDirection(retro) {
    state.retro = retro;
    document.getElementById("dir-retro").setAttribute("aria-pressed", retro);
    document.getElementById("dir-pro").setAttribute("aria-pressed", !retro);
    document.getElementById("dir-hint").textContent = retro
      ? "Neptune's tidal bulge trails Triton's backwards motion \u2014 it can only brake."
      : "Beyond the synchronous line the bulge leads instead \u2014 it pushes Triton out, like Earth's Moon.";
    recompute();
  }
  document.getElementById("preset-today").addEventListener("click", function () { setPreset("today"); });
  document.getElementById("preset-capture").addEventListener("click", function () { setPreset("capture"); });
  document.getElementById("dir-retro").addEventListener("click", function () { setDirection(true); });
  document.getElementById("dir-pro").addEventListener("click", function () { setDirection(false); });

  window.tritonSpiral = {
    /* Deterministic frame driver for headless recording. */
    pump: pump,
    getState: function () {
      var s = T.sampleTrack(state.track, Math.min(state.t, state.doom != null ? state.doom : Infinity));
      return {
        t: state.t, T: state.T, preset: state.preset, retro: state.retro,
        playing: state.playing, a: s.a, e: s.e,
        shattered: state.doom != null && state.t > state.doom,
        ringClock: state.doom != null ? Math.max(0, state.t - state.doom) : 0,
        doom: state.doom, speed: state.speed, scale: state.scale
      };
    }
  };

  if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas.parentElement || canvas);
  resize();
  recompute();
  requestAnimationFrame(frame);
})();
