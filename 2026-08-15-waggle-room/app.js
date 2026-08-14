/*
 * waggle-room — app
 *
 * Wires the engine to two canvases:
 *   • the dark comb, where a bee dances the figure-eight (or the round dance)
 *   • the parchment field, north-up, where the sun rides the dial ring and
 *     the flower cluster is draggable — plus its opaque cover, used by the
 *     recruit game ("you are a follower bee in the dark").
 *
 * One rAF loop draws both; the dance parameters are recomputed every frame
 * from live state, so dragging flowers, sliding the sun, or switching
 * dialects changes the dance instantly (that liveness is the lesson).
 */

(function () {
  "use strict";

  const E = window.WaggleEngine;

  // The reference scene: von Frisch country, mid-August.
  const LAT = 48.2;
  const DECL = E.declination(227); // 2026-08-15 → ≈ +13.8°

  const FIELD_MAX_M = 2400;   // metres at the dial ring
  const FIELD_R_PX = 165;     // dial-ring radius in field-canvas units

  const $ = (id) => document.getElementById(id);

  const state = {
    timeH: 12,
    dialectKey: "carnica",
    flat: false,
    flowers: { az: 58, dist: 1100 },
    flight: null,             // { t0, dur } fly-the-forage animation
    game: {
      phase: "idle",          // idle | dance | reveal
      round: null, rng: null,
      rounds: [],             // grades
      number: 0,
    },
  };

  const sun = () => E.solarAzimuth(state.timeH, LAT, DECL);

  // ── canvas setup (crisp on retina) ────────────────────────────────────────

  function setupCanvas(canvas, cssW, cssH) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    canvas.style.aspectRatio = `${cssW} / ${cssH}`;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    return ctx;
  }

  const comb = $("comb");
  const field = $("field");
  const combCtx = setupCanvas(comb, 640, 340);
  const fieldCtx = setupCanvas(field, 640, 340);
  const COMB = { w: 640, h: 340, cx: 320, cy: 172, rose: 126 };
  const FIELD = { w: 640, h: 340, cx: 320, cy: 178 };

  const pxPerM = FIELD_R_PX / FIELD_MAX_M;
  const flowerPx = (az = state.flowers.az, dist = state.flowers.dist) =>
    E.pxFromAz(FIELD.cx, FIELD.cy, az, dist * pxPerM);
  const sunPx = (az = sun().azimuth) => E.pxFromAz(FIELD.cx, FIELD.cy, az, FIELD_R_PX + 26);

  // ── the dance parameters, recomputed every frame ──────────────────────────

  function danceParams() {
    if (state.game.phase === "dance" && state.game.round) {
      const r = state.game.round;
      return { angle: r.trueAngle, duration: r.trueDuration,
               round: false, game: true };
    }
    const s = sun();
    const f = state.flowers;
    return {
      angle: E.danceAngleFromVertical(f.az, s.azimuth, state.flat),
      duration: E.waggleDuration(f.dist, state.dialectKey),
      round: E.isRoundDance(f.dist, state.dialectKey),
      game: false,
    };
  }

  // dance animation state machine (WAGGLE → LOOP left → WAGGLE → LOOP right…)
  const dance = {
    mode: "waggle",       // waggle | loop | round
    side: 1,
    t0: performance.now(),
    run: { angle: 0, duration: 1 },
    lastRunTimer: 0,
  };

  function nextDanceRun() {
    // real runs scatter a few degrees; followers average several of them
    const params = danceParams();
    const jitter = state.game.phase === "dance" && state.game.rng
      ? E.jitteredRun(state.game.rng, params.angle, params.duration)
      : E.jitteredRun(E.makeRNG((Math.random() * 1e9) | 0), params.angle, params.duration);
    dance.run = jitter;
  }

  const LOOP_S = 1.05;
  const LOOP_RADIUS = 92;

  function danceGeometry(ctx) {
    const c = COMB;
    const t = dance.run.duration;
    const runLen = Math.max(54, Math.min(232, 52 + 78 * t));
    const u = E.unitVector(dance.run.angle); // run direction, canvas coords
    const mid = { x: c.cx, y: c.cy + 26 };
    return {
      start: { x: mid.x - u.x * runLen / 2, y: mid.y - u.y * runLen / 2 },
      end: { x: mid.x + u.x * runLen / 2, y: mid.y + u.y * runLen / 2 },
      u, runLen,
    };
  }

  function beeAt(now) {
    // returns { x, y, heading, waggling, phase01 } for the animated dancer
    const params = danceParams();
    if (params.round) {
      const period = 0.42; // one round-dance circle
      const p = ((now / 1000) % period) / period;
      const a = p * 2 * Math.PI;
      return {
        x: COMB.cx + Math.cos(a) * 44,
        y: COMB.cy + 26 + Math.sin(a) * 44,
        heading: a + Math.PI / 2,
        waggling: false, phase01: p,
      };
    }
    const g = danceGeometry();
    const t = (now - dance.t0) / 1000;
    if (dance.mode === "waggle") {
      const p = Math.min(1, t / dance.run.duration);
      const lateral = Math.sin((now / 1000) * 2 * Math.PI *
                               E.dialect(state.dialectKey).waggleHz) * 6.5;
      return {
        x: g.start.x + (g.end.x - g.start.x) * p + (-g.u.y) * lateral,
        y: g.start.y + (g.end.y - g.start.y) * p + g.u.x * lateral,
        heading: Math.atan2(g.u.y, g.u.x),
        waggling: true, phase01: p,
      };
    }
    // loop: semicircle from end back to start, bulging to `side`
    const p = Math.min(1, t / LOOP_S);
    const eased = p * p * (3 - 2 * p);
    const cxm = (g.start.x + g.end.x) / 2 + (-g.u.y) * dance.side * LOOP_RADIUS;
    const cym = (g.start.y + g.end.y) / 2 + g.u.x * dance.side * LOOP_RADIUS;
    const angStart = Math.atan2(g.end.y - cym, g.end.x - cxm);
    const sweep = Math.PI * dance.side;
    const a = angStart + sweep * eased;
    return {
      x: cxm + Math.cos(a) * LOOP_RADIUS,
      y: cym + Math.sin(a) * LOOP_RADIUS,
      heading: a + (dance.side > 0 ? Math.PI / 2 : -Math.PI / 2),
      waggling: false, phase01: p,
    };
  }

  const trail = [];
  function pushTrail(p) {
    trail.push(p);
    if (trail.length > 110) trail.shift();
  }

  function drawBee(ctx, x, y, heading, waggling, now) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(heading + Math.PI / 2);
    // wings
    if (waggling) {
      ctx.fillStyle = "rgba(190, 225, 255, .25)";
      const flap = Math.sin(now / 1000 * 2 * Math.PI * 30) * 2;
      ctx.beginPath();
      ctx.ellipse(-7, -2 + flap, 7, 3.4, -0.5, 0, 2 * Math.PI);
      ctx.ellipse(7, -2 - flap, 7, 3.4, 0.5, 0, 2 * Math.PI);
      ctx.fill();
    }
    // abdomen
    ctx.fillStyle = "#e8a13a";
    ctx.beginPath();
    ctx.ellipse(0, 7.5, 5.6, 8.4, 0, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = "#2a2130";
    for (const yy of [5.5, 10.5]) {
      ctx.beginPath();
      ctx.ellipse(0, yy, 5.4, 1.7, 0, 0, 2 * Math.PI);
      ctx.fill();
    }
    // thorax + head
    ctx.fillStyle = "#4a3b33";
    ctx.beginPath();
    ctx.ellipse(0, -2, 4.4, 4.4, 0, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = "#2a2130";
    ctx.beginPath();
    ctx.arc(0, -8.5, 3, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();
  }

  // ── comb rendering ────────────────────────────────────────────────────────

  function drawComb(now) {
    const ctx = combCtx;
    const c = COMB;
    const params = danceParams();
    ctx.clearRect(0, 0, c.w, c.h);

    // faint hex cells
    ctx.save();
    ctx.strokeStyle = "rgba(240, 180, 41, .05)";
    ctx.lineWidth = 1;
    const R = 9;
    for (let row = -1; row * R * 1.5 < c.h + 26; row++) {
      for (let col = -1; col * R * 1.732 < c.w + 26; col++) {
        const x = col * R * 1.732 + (row % 2 ? R * 0.866 : 0);
        const y = row * R * 1.5;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = Math.PI / 6 + (i * Math.PI) / 3;
          const px = x + R * Math.cos(a) * 0.94;
          const py = y + R * Math.sin(a) * 0.94;
          i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }
    ctx.restore();

    // the protractor rose
    ctx.save();
    ctx.strokeStyle = "rgba(207, 195, 230, .22)";
    ctx.fillStyle = "rgba(207, 195, 230, .45)";
    ctx.lineWidth = 1;
    ctx.font = "10.5px ui-monospace, Menlo, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let a = 0; a < 360; a += 15) {
      const major = a % 45 === 0;
      const r1 = c.rose + (major ? 12 : 6);
      const u = E.unitVector(a);
      ctx.beginPath();
      ctx.moveTo(c.cx + u.x * r1, c.cy + u.y * r1);
      ctx.lineTo(c.cx + u.x * (c.rose + 14), c.cy + u.y * (c.rose + 14));
      ctx.globalAlpha = major ? 0.8 : 0.35;
      ctx.stroke();
      if (major && a !== 0) {
        ctx.globalAlpha = 0.75;
        ctx.fillText(String(a), c.cx + u.x * (c.rose + 27), c.cy + u.y * (c.rose + 27));
      }
    }
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(c.cx, c.cy, c.rose, 0, 2 * Math.PI);
    ctx.stroke();

    // "up = sun" axis
    ctx.strokeStyle = "rgba(240, 180, 41, .5)";
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.moveTo(c.cx, c.cy - c.rose - 4);
    ctx.lineTo(c.cx, c.cy + c.rose + 4);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(240, 180, 41, .8)";
    ctx.font = "10px ui-monospace, Menlo, monospace";
    ctx.fillText("0° = up = sun", c.cx, c.cy - c.rose - 16);
    ctx.restore();

    if (!params.round) {
      // the waggle-run axis + angle arc
      const g = danceGeometry();
      ctx.save();
      ctx.strokeStyle = "rgba(240, 180, 41, .34)";
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 6]);
      ctx.beginPath();
      ctx.moveTo(g.start.x, g.start.y);
      ctx.lineTo(g.end.x, g.end.y);
      ctx.stroke();
      ctx.setLineDash([]);

      if (!params.game) {
        const th = dance.run.angle;
        ctx.strokeStyle = "rgba(125, 220, 232, .85)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        const a0 = -Math.PI / 2;
        const a1 = -Math.PI / 2 + th * Math.PI / 180;
        ctx.arc(c.cx, c.cy, c.rose - 16, a0, a1, th < 0);
        ctx.stroke();
        const mid = -Math.PI / 2 + (th / 2) * Math.PI / 180;
        ctx.fillStyle = "rgba(125, 220, 232, .95)";
        ctx.font = "12px ui-monospace, Menlo, monospace";
        ctx.fillText(
          (th >= 0 ? "+" : "") + th.toFixed(0) + "°",
          c.cx + Math.cos(mid) * (c.rose - 34),
          c.cy + Math.sin(mid) * (c.rose - 34)
        );
      }
      ctx.restore();
    }

    // trail
    ctx.save();
    for (let i = 0; i < trail.length; i++) {
      const p = trail[i];
      const k = i / trail.length;
      ctx.globalAlpha = 0.05 + 0.3 * k * k;
      ctx.fillStyle = "#f0b429";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.1 + 1.6 * k, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.restore();

    const bee = beeAt(now);
    pushTrail(bee);
    drawBee(ctx, bee.x, bee.y, bee.heading, bee.waggling, now);

    // run-timer chip under the dancer during waggle
    if (bee.waggling && params.game) {
      ctx.save();
      ctx.fillStyle = "rgba(13, 10, 18, .78)";
      const label = ((now - dance.t0) / 1000).toFixed(2) + " s";
      ctx.font = "11px ui-monospace, Menlo, monospace";
      const w = ctx.measureText(label).width + 14;
      ctx.beginPath();
      ctx.roundRect(c.cx - w / 2, c.cy + c.rose + 22, w, 20, 6);
      ctx.fill();
      ctx.fillStyle = "#f0b429";
      ctx.textAlign = "center";
      ctx.fillText(label, c.cx, c.cy + c.rose + 32);
      ctx.restore();
    }
  }

  // ── field rendering ───────────────────────────────────────────────────────

  function drawSun(ctx, az) {
    const p = E.pxFromAz(FIELD.cx, FIELD.cy, az, FIELD_R_PX + 26);
    ctx.save();
    ctx.strokeStyle = "rgba(200, 150, 40, .35)";
    ctx.setLineDash([2, 5]);
    ctx.beginPath();
    ctx.moveTo(FIELD.cx, FIELD.cy);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.setLineDash([]);
    const grad = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 30);
    grad.addColorStop(0, "rgba(247, 200, 76, .95)");
    grad.addColorStop(1, "rgba(247, 200, 76, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 30, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = "#e9a821";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 11, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = "rgba(120, 80, 10, .5)";
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * 2 * Math.PI;
      ctx.beginPath();
      ctx.moveTo(p.x + Math.cos(a) * 14, p.y + Math.sin(a) * 14);
      ctx.lineTo(p.x + Math.cos(a) * 19, p.y + Math.sin(a) * 19);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawHive(ctx) {
    ctx.save();
    ctx.translate(FIELD.cx, FIELD.cy);
    ctx.fillStyle = "#8a6a3a";
    ctx.strokeStyle = "#5c4423";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-16, 10);
    ctx.quadraticCurveTo(-16, -14, 0, -14);
    ctx.quadraticCurveTo(16, -14, 16, 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "rgba(92, 68, 35, .55)";
    for (const yy of [-5, 1]) {
      ctx.beginPath();
      ctx.moveTo(-15, yy);
      ctx.quadraticCurveTo(0, yy - 4, 15, yy);
      ctx.stroke();
    }
    ctx.fillStyle = "#2e2317";
    ctx.beginPath();
    ctx.arc(0, 9, 3.6, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();
  }

  function drawFlowers(ctx, x, y, highlight) {
    ctx.save();
    if (highlight) {
      ctx.strokeStyle = "rgba(46, 130, 70, .8)";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.arc(x, y, 30, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    const petals = [
      [0, -14], [10, -4], [6, 11], [-6, 11], [-10, -4],
    ];
    for (const [dx, dy] of petals) {
      ctx.fillStyle = "#d9738f";
      ctx.beginPath();
      ctx.arc(x + dx, y + dy, 6.2, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.fillStyle = "#f0c24a";
    ctx.beginPath();
    ctx.arc(x, y, 5.4, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = "#4f7a3a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 2, y + 13);
    ctx.quadraticCurveTo(x - 6, y + 22, x - 10, y + 28);
    ctx.moveTo(x + 2, y + 13);
    ctx.quadraticCurveTo(x + 6, y + 22, x + 10, y + 28);
    ctx.stroke();
    ctx.restore();
  }

  function drawField(now) {
    const ctx = fieldCtx;
    ctx.clearRect(0, 0, FIELD.w, FIELD.h);

    // parchment + faint meadow specks (deterministic)
    ctx.fillStyle = "#f3ecdb";
    ctx.fillRect(0, 0, FIELD.w, FIELD.h);
    const rng = E.makeRNG(44);
    ctx.fillStyle = "rgba(110, 130, 70, .16)";
    for (let i = 0; i < 130; i++) {
      const x = rng() * FIELD.w, y = rng() * FIELD.h;
      ctx.fillRect(x, y, 2.2, 1.2);
    }

    // compass ring
    ctx.save();
    ctx.strokeStyle = "rgba(90, 76, 55, .35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(FIELD.cx, FIELD.cy, FIELD_R_PX, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.setLineDash([2, 6]);
    ctx.beginPath();
    ctx.arc(FIELD.cx, FIELD.cy, FIELD_R_PX + 26, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(90, 76, 55, .8)";
    ctx.font = "600 11px ui-monospace, Menlo, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const [label, az] of [["N", 0], ["E", 90], ["S", 180], ["W", 270]]) {
      const p = E.pxFromAz(FIELD.cx, FIELD.cy, az, FIELD_R_PX - 18);
      ctx.fillText(label, p.x, p.y);
    }
    ctx.restore();

    const s = sun();
    drawSun(ctx, s.azimuth);

    // the vector hive → flowers
    const inReveal = state.game.phase === "reveal";
    const f = inReveal ? state.game.round.target : state.flowers;
    const fp = flowerPx(f.az, f.dist);
    ctx.save();
    ctx.strokeStyle = "rgba(60, 50, 35, .6)";
    ctx.lineWidth = 1.6;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(FIELD.cx, FIELD.cy);
    ctx.lineTo(fp.x, fp.y);
    ctx.stroke();
    ctx.setLineDash([]);
    // angle arc sun → flowers (measured at the hive)
    const delta = E.wrap180(f.az - s.azimuth);
    ctx.strokeStyle = "rgba(200, 90, 120, .75)";
    ctx.lineWidth = 2;
    const a0 = (s.azimuth - 90) * Math.PI / 180;
    const a1 = (f.az - 90) * Math.PI / 180;
    ctx.beginPath();
    ctx.arc(FIELD.cx, FIELD.cy, 56, a0, a1, delta < 0);
    ctx.stroke();
    const midAz = s.azimuth + delta / 2;
    const mp = E.pxFromAz(FIELD.cx, FIELD.cy, midAz, 74);
    ctx.fillStyle = "rgba(170, 55, 95, .95)";
    ctx.font = "600 11.5px ui-monospace, Menlo, monospace";
    ctx.textAlign = "center";
    ctx.fillText((delta >= 0 ? "+" : "") + delta.toFixed(0) + "°", mp.x, mp.y);
    // distance label
    const dLabel = f.dist >= 1000
      ? (f.dist / 1000).toFixed(2) + " km" : Math.round(f.dist) + " m";
    const mid = { x: (FIELD.cx + fp.x) / 2, y: (FIELD.cy + fp.y) / 2 };
    ctx.fillStyle = "rgba(60, 50, 35, .95)";
    ctx.font = "10.5px ui-monospace, Menlo, monospace";
    ctx.fillText(dLabel, mid.x, mid.y - 8);
    ctx.restore();

    drawHive(ctx);
    drawFlowers(ctx, fp.x, fp.y, inReveal);

    // fly-the-forage
    if (state.flight) {
      const ft = (now - state.flight.t0) / 1000;
      const dur = state.flight.dur;
      if (ft >= dur) state.flight = null;
      else {
        const out = 1.05, pause = 0.4;
        let p = ft < out ? ft / out : ft < out + pause ? 1 : 1 - (ft - out - pause) / (dur - out - pause);
        const ease = p * p * (3 - 2 * p);
        const bx = FIELD.cx + (fp.x - FIELD.cx) * ease;
        const by = FIELD.cy + (fp.y - FIELD.cy) * ease;
        ctx.fillStyle = "#31313d";
        ctx.beginPath();
        ctx.arc(bx, by, 3.4, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = "rgba(49, 49, 61, .5)";
        ctx.beginPath();
        ctx.arc(bx - 4, by, 3.2, 0, 2 * Math.PI);
        ctx.arc(bx + 4, by, 3.2, 0, 2 * Math.PI);
        ctx.stroke();
      }
    }

    // reveal-layer: the player's guess + errors
    if (inReveal) {
      const g = state.game.guessPx;
      ctx.save();
      ctx.strokeStyle = "#7a3d55";
      ctx.fillStyle = "rgba(122, 61, 85, .12)";
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(g.x, g.y, 13, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(g.x - 8, g.y - 8); ctx.lineTo(g.x + 8, g.y + 8);
      ctx.moveTo(g.x + 8, g.y - 8); ctx.lineTo(g.x - 8, g.y + 8);
      ctx.stroke();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "rgba(122, 61, 85, .6)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(g.x, g.y);
      ctx.lineTo(fp.x, fp.y);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ── DOM readouts ──────────────────────────────────────────────────────────

  function fmtTime(h) {
    const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }

  function updateDom() {
    const params = danceParams();
    const s = sun();
    const inGame = state.game.phase === "dance";
    const f = state.flowers;
    const d = E.dialect(state.dialectKey);

    $("hudTime").textContent = fmtTime(state.timeH);
    $("hudSunAz").textContent = s.azimuth.toFixed(0) + "°";
    $("hudFlowerAz").textContent = f.az.toFixed(0) + "°";
    $("hudFlowerDist").textContent =
      f.dist >= 1000 ? (f.dist / 1000).toFixed(2) + " km" : Math.round(f.dist) + " m";
    $("timeVal").textContent = fmtTime(state.timeH);

    // KPI row
    if (inGame) {
      $("kAngle").textContent = "?";
      $("kDur").textContent = dance.run.duration.toFixed(2) + " s";
      $("kDist").textContent = "?";
      $("kForm").textContent = "decode the dark";
    } else {
      $("kAngle").textContent = (params.angle >= 0 ? "+" : "") + params.angle.toFixed(0) + "°";
      $("kDur").textContent = params.duration.toFixed(2) + " s";
      $("kDist").textContent = f.dist >= 1000 ? (f.dist / 1000).toFixed(2) + " km" : Math.round(f.dist) + " m";
      $("kForm").textContent = params.round ? "round dance" : "waggle dance";
    }

    // comb HUD
    const phaseLabel = params.round ? "round dance — it's close"
      : dance.mode === "waggle" ? "waggle run" : "return loop";
    $("phaseBadge").textContent = phaseLabel;
    if (dance.mode === "waggle") {
      dance.lastRunTimer = Math.min((performance.now() - dance.t0) / 1000, dance.run.duration);
    }
    $("runTimer").textContent = dance.lastRunTimer.toFixed(2) + " s";
    $("hudAngleRow").style.visibility = inGame ? "hidden" : "visible";
    $("hudAngle").textContent = (dance.run.angle >= 0 ? "+" : "") + dance.run.angle.toFixed(0) + "°";
    $("combNote").textContent = state.flat
      ? "flat comb under open sky — up = north, she points the true way"
      : "straight up the comb = toward the sun";

    // live encoding card
    if (inGame) {
      $("rAngleExpr").innerHTML = "θ = ? — read the protractor";
      $("rDurExpr").innerHTML = "t = ? — time the waggle run";
      $("rFormExpr").innerHTML = "a waggle dance you must decode";
    } else {
      $("rAngleExpr").innerHTML =
        `θ = az(flower) − az(sun) = ${f.az.toFixed(0)}° − ${s.azimuth.toFixed(0)}° = <em>${(params.angle >= 0 ? "+" : "") + params.angle.toFixed(0)}°</em> from vertical`;
      $("rDurExpr").innerHTML =
        `t = ${d.intercept} + ${d.slope}·${(f.dist / 1000).toFixed(2)} = <em>${params.duration.toFixed(2)} s</em> ≈ ${E.waggleCount(params.duration, state.dialectKey)} waggles`;
      $("rFormExpr").innerHTML = params.round
        ? `d = ${Math.round(f.dist)} m &lt; ${d.roundThreshold} m → <em>round dance</em> (distance yes, direction no)`
        : `d = ${Math.round(f.dist)} m ≥ ${d.roundThreshold} m → <em>waggle dance</em>`;
    }
  }

  // ── the dialect chart (inline SVG) ────────────────────────────────────────

  function drawDialectChart() {
    const svg = $("dialectChart");
    const W = 300, H = 150, mL = 34, mB = 26, mT = 8, mR = 8;
    const x = (km) => mL + (km / 3) * (W - mL - mR);
    const y = (t) => H - mB - (t / 3.2) * (H - mB - mT);
    const colors = { carnica: "#f0b429", ligustica: "#7ddce8", scutellata: "#ff7a8c" };
    let s = "";
    // axes + grid
    s += `<line x1="${mL}" y1="${H - mB}" x2="${W - mR}" y2="${H - mB}" stroke="rgba(168,155,192,.35)"/>`;
    s += `<line x1="${mL}" y1="${mT}" x2="${mL}" y2="${H - mB}" stroke="rgba(168,155,192,.35)"/>`;
    for (let t = 1; t <= 3; t++) {
      s += `<line x1="${mL}" y1="${y(t)}" x2="${W - mR}" y2="${y(t)}" stroke="rgba(168,155,192,.12)"/>`;
      s += `<text x="${mL - 6}" y="${y(t) + 3}" text-anchor="end" font-size="8.5" fill="#6b6280">${t}s</text>`;
    }
    for (let km = 1; km <= 3; km++) {
      s += `<text x="${x(km)}" y="${H - mB + 12}" text-anchor="middle" font-size="8.5" fill="#6b6280">${km}km</text>`;
    }
    for (const key of Object.keys(E.DIALECTS)) {
      const d = E.dialect(key);
      const t0 = E.waggleDuration(d.roundThreshold, key);
      const t3 = E.waggleDuration(3000, key);
      const sel = key === state.dialectKey;
      s += `<line x1="${x(d.roundThreshold / 1000)}" y1="${y(t0)}" x2="${x(3)}" y2="${y(t3)}" stroke="${colors[key]}" stroke-width="${sel ? 2.6 : 1.4}" opacity="${sel ? 1 : 0.5}"/>`;
      s += `<circle cx="${x(d.roundThreshold / 1000)}" cy="${y(t0)}" r="${sel ? 3.4 : 2.4}" fill="${colors[key]}" opacity="${sel ? 1 : 0.55}"/>`;
      if (key === state.dialectKey) {
        // the live point
        const f = state.flowers;
        s += `<circle cx="${x(Math.min(3, f.dist / 1000))}" cy="${y(E.waggleDuration(f.dist, key))}" r="4.2" fill="#fff" stroke="${colors[key]}" stroke-width="2.4"/>`;
      }
    }
    // round-dance zone
    const rx = x(E.dialect(state.dialectKey).roundThreshold / 1000);
    s += `<rect x="${mL}" y="${mT}" width="${rx - mL}" height="${H - mB - mT}" fill="rgba(255,255,255,.05)"/>`;
    s += `<text x="${(mL + rx) / 2}" y="${H - mB - 6}" text-anchor="middle" font-size="7.5" fill="#6b6280">round</text>`;
    svg.innerHTML = s;
    const d = E.dialect(state.dialectKey);
    $("dialectNote").textContent =
      `${d.label} — t ≈ ${d.intercept} + ${d.slope}·d(km) · round dance below ${d.roundThreshold} m · waggles at ${d.waggleHz} Hz`;
  }

  // ── interactions ──────────────────────────────────────────────────────────

  function canvasPos(canvas, ev) {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((ev.clientX - r.left) / r.width) * 640,
      y: ((ev.clientY - r.top) / r.height) * 340,
    };
  }

  let dragging = false;
  field.addEventListener("pointerdown", (ev) => {
    if (state.game.phase !== "idle" && state.game.phase !== "reveal") return;
    const p = canvasPos(field, ev);
    const fp = flowerPx();
    if (Math.hypot(p.x - fp.x, p.y - fp.y) < 34) dragging = true;
    if (dragging) field.setPointerCapture(ev.pointerId);
  });
  field.addEventListener("pointermove", (ev) => {
    if (!dragging) return;
    const p = canvasPos(field, ev);
    const dx = p.x - FIELD.cx, dy = p.y - FIELD.cy;
    let r = Math.hypot(dx, dy);
    // no minimum: dragging the flowers right onto the hive (r ≈ 0) is the
    // round-dance zone — "close by, no direction"
    r = Math.min(FIELD_R_PX, r);
    state.flowers.az = E.azFromPx(dx, dy);
    state.flowers.dist = r / pxPerM;
  });
  const endDrag = () => { dragging = false; };
  field.addEventListener("pointerup", endDrag);
  field.addEventListener("pointercancel", endDrag);

  $("timeSlider").addEventListener("input", (ev) => {
    state.timeH = parseFloat(ev.target.value);
  });

  $("flyBtn").addEventListener("click", () => {
    state.flight = { t0: performance.now(), dur: 2.6 };
  });

  for (const btn of document.querySelectorAll(".dialect-btn")) {
    btn.addEventListener("click", () => {
      if (state.game.phase === "dance") return;
      state.dialectKey = btn.dataset.key;
      for (const b of document.querySelectorAll(".dialect-btn")) b.classList.toggle("sel", b === btn);
      drawDialectChart();
    });
  }

  $("flatChk").addEventListener("change", (ev) => {
    state.flat = ev.target.checked;
  });

  // ── the recruit game ──────────────────────────────────────────────────────

  function lockControls(on) {
    document.querySelector(".controls").classList.toggle("locked", on);
    $("timeSlider").disabled = on;
    $("flyBtn").disabled = on;
    $("flatChk").disabled = on;
  }

  function startRound(seed) {
    const g = state.game;
    g.rng = E.makeRNG(seed !== undefined ? seed : (Math.random() * 1e9) | 0);
    g.round = E.newGameRound(g.rng, {
      sunAzimuth: sun().azimuth,
      dialectKey: state.dialectKey,
    });
    g.phase = "dance";
    g.number += 1;
    dance.mode = "waggle";
    dance.t0 = performance.now();
    nextDanceRun();
    const cover = $("fieldCover");
    cover.hidden = false;
    cover.classList.remove("gone");
    $("gameScore").hidden = true;
    $("gameBtn").textContent = "…watch the comb, then click the dark field";
    $("gameBtn").disabled = true;
    $("gameIntro").textContent =
      "Sun azimuth is locked at " + g.round.sunAzimuth.toFixed(0) +
      "° and the dialect is " + E.dialect(state.dialectKey).label +
      ". Decode θ off the protractor, t off the run timer — az = sun + θ, d from the calibration — then click.";
    lockControls(true);
    updateGameMeta();
  }

  function guess(ev) {
    const g = state.game;
    if (g.phase !== "dance") return;
    const p = canvasPos(field, ev);
    const dx = p.x - FIELD.cx, dy = p.y - FIELD.cy;
    const guessAz = E.azFromPx(dx, dy);
    const guessDist = Math.hypot(dx, dy) / pxPerM;
    g.result = E.scoreGuess(g.round.target, { azimuth: guessAz, distanceM: guessDist });
    g.guessPx = p;
    g.phase = "reveal";
    $("fieldCover").classList.add("gone");
    lockControls(false);
    $("gameBtn").disabled = false;
    $("gameBtn").textContent = "🐝 next dance";
    $("gameScore").hidden = false;
    $("gGrade").textContent = g.result.grade;
    $("gGrade").className = "grade " + (g.result.grade === "D" ? "bad" : g.result.grade === "A" ? "good" : "");
    $("gVerdict").textContent = g.result.verdict;
    $("gAngle").textContent = g.result.angleErr.toFixed(1) + "°";
    $("gDist").textContent =
      Math.round(g.result.distErr) + " m (" + Math.round(g.result.distPct * 100) + "%)";
    const chip = $("gChip");
    chip.textContent = g.result.recruitWouldFind ? "would find it ✓" : "would NOT find it ✗";
    chip.className = g.result.recruitWouldFind ? "yes" : "no";
    g.rounds.push(g.result.grade);
    updateGameMeta();
  }

  function updateGameMeta() {
    const g = state.game;
    $("gameMeta").textContent = g.rounds.length
      ? `round ${g.number} · grades so far: ${g.rounds.join(" · ")}`
      : "no rounds yet";
  }

  $("fieldCover").addEventListener("click", guess);
  $("gameBtn").addEventListener("click", () => {
    if (state.game.phase === "dance") return;
    startRound();
  });

  // ── the frame loop ────────────────────────────────────────────────────────

  function tick(now) {
    const params = danceParams();
    // advance the dance state machine
    if (params.round) {
      dance.mode = "round";
    } else if (dance.mode === "waggle") {
      if (now - dance.t0 >= dance.run.duration * 1000) {
        dance.mode = "loop";
        dance.t0 = now;
        dance.side = -dance.side;
      }
    } else if (dance.mode === "loop") {
      if (now - dance.t0 >= LOOP_S * 1000) {
        dance.mode = "waggle";
        dance.t0 = now;
        nextDanceRun();
        trail.length = 0;
      }
    } else {
      dance.mode = "waggle";
      dance.t0 = now;
      nextDanceRun();
    }

    drawComb(now);
    drawField(now);
    updateDom();
    requestAnimationFrame(tick);
  }

  drawDialectChart();
  nextDanceRun();
  requestAnimationFrame(tick);

  // ── demo hooks for the video renderer (real interactions, scripted) ──────
  window.__demo = {
    state,
    flowerPx, sunPx,
    fieldCenter: () => ({ x: FIELD.cx, y: FIELD.cy }),
    combCenter: () => ({ x: COMB.cx, y: COMB.cy }),
    setFlowers(az, dist) { state.flowers = { az, dist }; },
    setTime(h) { state.timeH = h; $("timeSlider").value = h; },
    setDialect(key) {
      state.dialectKey = key;
      for (const b of document.querySelectorAll(".dialect-btn")) b.classList.toggle("sel", b.dataset.key === key);
      drawDialectChart();
    },
    startRound: (seed) => startRound(seed),
    targetPx: () => {
      const t = state.game.round.target;
      return flowerPx(t.az, t.dist);
    },
  };
})();
