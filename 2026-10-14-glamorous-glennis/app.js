// Glamorous Glennis — page: sky view, Machmeter, controls, trace.
(function () {
  const X = window.X1;
  const $ = (id) => document.getElementById(id);
  const sky = $("sky"), ctx = sky.getContext("2d");
  const trace = $("trace"), tctx = trace.getContext("2d");
  const meter = $("machmeter"), mctx = meter.getContext("2d");
  const W = sky.width, H = sky.height;
  const SCALE = 0.33;              // px per metre for wavefronts and the B-29
  const PLANE = { x: 600, y: 270 };
  const DEG = Math.PI / 180;

  let s, mem, waves, lastEmit, history, live = true, paused = false, pace = 3;
  let autopilot = false, keys = { up: false, down: false, tup: false, tdown: false };
  let banner = null, streaks;

  function newFlight(seed) {
    s = X.create({ seed: seed || (Date.now() & 0xffff) + 1 });
    mem = {};
    waves = [];
    lastEmit = -1;
    history = [];
    banner = null;
    autopilot = false;
    streaks = Array.from({ length: 18 }, (_, i) => ({ x: (i * 97) % W, y: 30 + ((i * 131) % (H - 60)), len: 30 + (i * 37) % 70 }));
    refresh();
  }

  // ---------- simulation ----------
  function step(dt) {
    const sub = 1 / 60;
    let left = dt;
    while (left > 1e-9 && s.phase === "flying") {
      const h = Math.min(sub, left);
      if (autopilot) mem = X.autopilot(s, mem);
      else {
        const target = (keys.up ? 1 : 0) - (keys.down ? 1 : 0);
        s.stick += Math.max(-4 * h, Math.min(4 * h, target - s.stick));
        s.trimRate = (keys.tup ? 1 : 0) - (keys.tdown ? 1 : 0);
      }
      const wasLevel = s.levelSuper;
      X.step(s, h);
      if (wasLevel === 0 && s.levelSuper > 0)
        banner = { text: "MACH 1 · LEVEL", sub: `${fmtFt(s.h)} · ${Math.round(s.v / X.MPH)} mph`, t: s.t };
      if (s.t - lastEmit >= 0.12) {
        lastEmit = s.t;
        waves.push({ x: s.x, h: s.h, t0: s.t, a: X.isa(s.h).a });
        if (waves.length > 40) waves.shift();
      }
      if (!history.length || s.t - history[history.length - 1].t >= 0.5)
        history.push({ t: s.t, m: s.mach, h: s.h });
      left -= h;
    }
    if (s.phase !== "flying" && !banner?.final) {
      s.stick = 0;
      s.trimRate = 0;
      const txt = { supersonic: "THROUGH THE WALL", subsonic: "THE WALL HELD", tuck: "MACH TUCK", low: "TOO LOW" }[s.outcome];
      banner = { text: txt, sub: summary(), t: s.t, final: true };
    }
  }

  function summary() {
    if (s.outcome === "tuck") return `nose went 40° down at Mach ${s.mach.toFixed(2)}, no pitch authority left`;
    const lvl = s.levelSuper > 0 ? ` · ${s.levelSuper.toFixed(0)} s level supersonic` : "";
    return `peak Mach ${s.maxMach.toFixed(3)} at ${fmtFt(s.maxMachAlt)}${lvl}`;
  }

  // ---------- formatting ----------
  const fmtFt = (m) => `${Math.round(m / X.FT).toLocaleString("en-US")} ft`;
  const signed = (x, d = 1) => (x < 0 ? "−" : "") + Math.abs(x).toFixed(d);

  // ---------- sky ----------
  function draw() {
    const hFt = s.h / X.FT;
    const k = Math.min(1, Math.max(0, (hFt - 15000) / 30000));
    const mix = (a, b) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
    const top = mix([86, 140, 200], [18, 38, 84]), low = mix([196, 214, 228], [104, 140, 186]);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, `rgb(${top})`);
    g.addColorStop(1, `rgb(${low})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // cirrus streaks for a sense of speed
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 2;
    for (const st of streaks) {
      const x = ((st.x - s.x * SCALE * 0.6) % (W + 200) + W + 200) % (W + 200) - 100;
      const y = st.y + ((s.h * 0.05) % H);
      const yy = ((y % H) + H) % H;
      ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + st.len, yy); ctx.stroke();
    }

    // altitude tape
    ctx.font = "12px ui-monospace, Menlo, monospace";
    ctx.textAlign = "right";
    const pxPerFt = 0.05;
    for (let f = Math.floor((hFt - 6000) / 1000) * 1000; f < hFt + 6000; f += 1000) {
      const y = PLANE.y - (f - hFt) * pxPerFt;
      if (y < 8 || y > H - 8) continue;
      const major = f % 5000 === 0;
      ctx.strokeStyle = major ? "rgba(255,255,255,.55)" : "rgba(255,255,255,.25)";
      ctx.beginPath(); ctx.moveTo(W - (major ? 34 : 20), y); ctx.lineTo(W - 6, y); ctx.stroke();
      if (major) { ctx.fillStyle = "rgba(255,255,255,.75)"; ctx.fillText(`${f / 1000}k`, W - 38, y + 4); }
    }

    const nose = { x: PLANE.x + Math.cos(-s.gamma) * 62, y: PLANE.y + Math.sin(-s.gamma) * 62 };

    // B-29 mothership, drifting away after the drop
    if (s.t < 20) {
      const bx = nose.x + (X.DROP.v * s.t - s.x) * SCALE - 40;
      const by = PLANE.y - (X.DROP.h + 18 - s.h) * SCALE - 34;
      drawB29(bx, by);
    }

    // wavefronts: emitted from the nose, centred where the nose was
    ctx.lineWidth = 1.4;
    for (const w of waves) {
      const r = (s.t - w.t0) * w.a * SCALE;
      if (r > 520) continue;
      const cx = nose.x + (w.x - s.x) * SCALE, cy = nose.y - (w.h - s.h) * SCALE;
      const alpha = Math.max(0, 0.5 - r / 1100);
      ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
      ctx.beginPath(); ctx.arc(cx, cy, Math.max(0.5, r), 0, Math.PI * 2); ctx.stroke();
    }

    // Mach cone
    const mu = X.mu(s.mach);
    if (mu) {
      ctx.strokeStyle = "rgba(255,226,170,.85)";
      ctx.lineWidth = 2;
      for (const sgn of [1, -1]) {
        const dir = Math.PI + -s.gamma + sgn * mu;
        ctx.beginPath(); ctx.moveTo(nose.x, nose.y);
        ctx.lineTo(nose.x + Math.cos(dir) * 600, nose.y + Math.sin(dir) * 600);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(255,236,200,.95)";
      ctx.textAlign = "left";
      ctx.font = "13px ui-monospace, Menlo, monospace";
      ctx.fillText(`Mach angle ${(mu / DEG).toFixed(1)}°`, nose.x - 210, nose.y - 150);
    }

    drawX1();
    drawHud(hFt);
    drawBanner();
  }

  function drawB29(x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(205,210,214,.95)";
    ctx.beginPath(); ctx.ellipse(0, 0, 165, 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-138, -2); ctx.lineTo(-170, -46); ctx.lineTo(-152, -46); ctx.lineTo(-116, -4); ctx.fill();
    ctx.fillStyle = "rgba(120,130,140,.9)";
    ctx.fillRect(-10, 8, 60, 4);
    ctx.fillStyle = "rgba(255,255,255,.8)";
    ctx.font = "11px ui-monospace, Menlo, monospace";
    ctx.textAlign = "center";
    ctx.fillText("B-29", 0, -20);
    ctx.restore();
  }

  function drawX1() {
    const shake = s.buffet * 4;
    ctx.save();
    ctx.translate(PLANE.x + (Math.random() - .5) * shake, PLANE.y + (Math.random() - .5) * shake);
    ctx.rotate(-s.gamma);
    // exhaust: one flame per lit chamber with shock diamonds
    const lit = X.chambersLit(s);
    for (let i = 0; i < lit; i++) {
      const oy = -6 + i * 4;
      const len = 46 + Math.random() * 10;
      const fg = ctx.createLinearGradient(-60, 0, -60 - len, 0);
      fg.addColorStop(0, "rgba(255,240,200,.95)");
      fg.addColorStop(0.5, "rgba(255,150,70,.7)");
      fg.addColorStop(1, "rgba(255,110,60,0)");
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.moveTo(-58, oy - 2.2); ctx.lineTo(-60 - len, oy); ctx.lineTo(-58, oy + 2.2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.85)";
      for (let d = 1; d <= 3; d++) { ctx.beginPath(); ctx.arc(-58 - d * 11, oy, 1.4, 0, Math.PI * 2); ctx.fill(); }
    }
    // fuselage: a .50-calibre bullet with wings
    ctx.fillStyle = "#e8761f";
    ctx.beginPath();
    ctx.moveTo(62, 0);
    ctx.bezierCurveTo(40, -12, 10, -12, -20, -11);
    ctx.lineTo(-58, -8); ctx.lineTo(-58, 8); ctx.lineTo(-20, 11);
    ctx.bezierCurveTo(10, 12, 40, 12, 62, 0);
    ctx.fill();
    ctx.fillStyle = "#c95d12";
    ctx.beginPath(); ctx.moveTo(-36, -8); ctx.lineTo(-56, -30); ctx.lineTo(-48, -30); ctx.lineTo(-24, -9); ctx.fill();
    // moving stabilizer, angled by the trim setting
    ctx.save();
    ctx.translate(-44, -2);
    ctx.rotate(-s.trim * 0.5);
    ctx.fillStyle = "#b9500f";
    ctx.fillRect(-12, -2, 20, 4);
    ctx.restore();
    ctx.fillStyle = "#d1681a";
    ctx.beginPath(); ctx.moveTo(14, 3); ctx.lineTo(-12, 5); ctx.lineTo(-20, 8); ctx.lineTo(10, 8); ctx.fill();
    ctx.fillStyle = "rgba(40,60,90,.75)";
    ctx.beginPath(); ctx.moveTo(40, -6); ctx.lineTo(26, -10); ctx.lineTo(26, -5); ctx.fill();
    ctx.restore();
  }

  function drawHud(hFt) {
    const a = X.isa(s.h).a;
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(10,20,40,.45)";
    ctx.fillRect(14, 14, 318, 70);
    ctx.fillStyle = "#fff";
    ctx.font = "700 20px ui-monospace, Menlo, monospace";
    ctx.fillText(`MACH ${s.mach.toFixed(3)}`, 26, 42);
    ctx.font = "13px ui-monospace, Menlo, monospace";
    ctx.fillText(`${Math.round(hFt).toLocaleString("en-US")} ft · ${Math.round(s.v / X.MPH)} mph`, 26, 62);
    ctx.fillStyle = "rgba(255,255,255,.75)";
    ctx.fillText(`sound here ${Math.round(a / X.MPH)} mph · ${(X.isa(s.h).T - 273.15).toFixed(0)} °C`, 26, 78);
    ctx.fillText(`t+${fmtT(s.t)}`, 250, 42);

    const auth = X.elevatorAuthority(s.mach);
    if (s.phase === "flying" && auth < 0.6) {
      ctx.fillStyle = "rgba(179,38,30,.85)";
      ctx.fillRect(14, 92, 318, 26);
      ctx.fillStyle = "#fff";
      ctx.font = "700 13px ui-monospace, Menlo, monospace";
      ctx.fillText(`SHOCK ON THE TAIL · elevator ${Math.round(auth * 100)}% · TRIM`, 24, 110);
    }
    if (paused) {
      ctx.fillStyle = "rgba(255,255,255,.85)";
      ctx.font = "700 14px ui-monospace, Menlo, monospace";
      ctx.fillText("PAUSED", 26, H - 20);
    }
  }

  function drawBanner() {
    if (!banner) return;
    const age = s.t - banner.t;
    if (!banner.final && age > 6) return;
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(10,20,40,.55)";
    ctx.fillRect(W / 2 - 250, H - 116, 500, 76);
    ctx.fillStyle = banner.final && s.outcome !== "supersonic" ? "#ffb4a8" : "#ffd29a";
    ctx.font = "700 28px Georgia, serif";
    ctx.fillText(banner.text, W / 2, H - 80);
    ctx.fillStyle = "rgba(255,255,255,.9)";
    ctx.font = "13px ui-monospace, Menlo, monospace";
    ctx.fillText(banner.sub, W / 2, H - 56);
  }

  const fmtT = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

  // ---------- trace ----------
  function drawTrace() {
    const w = trace.width, h = trace.height, padL = 38, padR = 46, padT = 10, padB = 20;
    tctx.clearRect(0, 0, w, h);
    const tMax = Math.max(300, Math.ceil(s.t / 60) * 60);
    const X0 = (t) => padL + (t / tMax) * (w - padL - padR);
    const YM = (m) => padT + (1 - m / 1.2) * (h - padT - padB);
    const YH = (ft) => padT + (1 - (ft - 10000) / 40000) * (h - padT - padB);
    tctx.font = "11px ui-monospace, Menlo, monospace";
    tctx.strokeStyle = "rgba(32,38,46,.15)";
    tctx.fillStyle = "#5e6670";
    for (let t = 0; t <= tMax; t += 60) {
      tctx.beginPath(); tctx.moveTo(X0(t), padT); tctx.lineTo(X0(t), h - padB); tctx.stroke();
      tctx.textAlign = "center"; tctx.fillText(`${t / 60} min`, X0(t), h - 5);
    }
    tctx.setLineDash([5, 4]);
    tctx.strokeStyle = "rgba(216,102,28,.7)";
    tctx.beginPath(); tctx.moveTo(padL, YM(1)); tctx.lineTo(w - padR, YM(1)); tctx.stroke();
    tctx.setLineDash([]);
    tctx.textAlign = "right";
    tctx.fillStyle = "#d8661c";
    for (const m of [0.4, 0.8, 1.0]) tctx.fillText(m.toFixed(1), padL - 5, YM(m) + 4);
    tctx.textAlign = "left";
    tctx.fillStyle = "#2f5d93";
    for (const f of [20000, 30000, 40000]) tctx.fillText(`${f / 1000}k`, w - padR + 6, YH(f) + 4);
    const line = (fn, color) => {
      tctx.strokeStyle = color; tctx.lineWidth = 2; tctx.beginPath();
      history.forEach((p, i) => (i ? tctx.lineTo : tctx.moveTo).call(tctx, X0(p.t), fn(p)));
      tctx.stroke(); tctx.lineWidth = 1;
    };
    line((p) => YH(p.h / X.FT), "#2f5d93");
    line((p) => YM(Math.min(1.2, p.m)), "#d8661c");
    tctx.fillStyle = "#20262e";
    tctx.textAlign = "left";
    tctx.fillText("— Mach", padL + 8, padT + 12);
    tctx.fillStyle = "#2f5d93";
    tctx.fillText("— altitude", padL + 70, padT + 12);
  }

  // ---------- Machmeter ----------
  function drawMeter() {
    const c = mctx, R = 150, cx = 170, cy = 170;
    c.clearRect(0, 0, 340, 340);
    c.fillStyle = "#15191f";
    c.beginPath(); c.arc(cx, cy, R + 12, 0, Math.PI * 2); c.fill();
    const a0 = 135 * DEG, span = 270 * DEG, lo = 0.4, hi = 1.0;
    const angOf = (m) => a0 + ((Math.min(hi + 0.03, Math.max(lo, m)) - lo) / (hi - lo)) * span;
    c.strokeStyle = "#e9e3d6"; c.fillStyle = "#e9e3d6";
    c.font = "600 20px ui-monospace, Menlo, monospace"; c.textAlign = "center";
    for (let m = 0.4; m <= 1.0001; m += 0.02) {
      const ang = angOf(m), major = Math.round(m * 100) % 10 === 0;
      c.lineWidth = major ? 4 : 2;
      c.beginPath();
      c.moveTo(cx + Math.cos(ang) * (R - (major ? 22 : 12)), cy + Math.sin(ang) * (R - (major ? 22 : 12)));
      c.lineTo(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R); c.stroke();
      if (major) c.fillText(m.toFixed(1).replace(/^0/, ""), cx + Math.cos(ang) * (R - 44), cy + Math.sin(ang) * (R - 44) + 7);
    }
    c.font = "600 16px ui-monospace, Menlo, monospace";
    c.fillStyle = "#e8761f";
    c.fillText("MACH", cx, cy + 62);
    const ind = X.indicatedMach(s.mach, s.t);
    const ang = ind > hi ? angOf(hi) + 0.25 : angOf(ind);
    c.strokeStyle = "#ffffff"; c.lineWidth = 5; c.lineCap = "round";
    c.beginPath(); c.moveTo(cx - Math.cos(ang) * 22, cy - Math.sin(ang) * 22);
    c.lineTo(cx + Math.cos(ang) * (R - 16), cy + Math.sin(ang) * (R - 16)); c.stroke();
    c.fillStyle = "#e8761f"; c.beginPath(); c.arc(cx, cy, 9, 0, Math.PI * 2); c.fill();
    return ind;
  }

  // ---------- panel ----------
  function updatePanel() {
    const ind = drawMeter();
    $("v-mach").textContent = s.mach.toFixed(3);
    $("v-mach").className = "v" + (s.mach >= 1 ? " ok" : "");
    let needle = "cockpit needle agrees";
    if (ind > 1.0) needle = "needle tipped off the scale";
    else if (Math.abs(ind - s.mach) > 0.004) needle = `needle stuck near ${ind.toFixed(3)}`;
    $("v-needle").textContent = needle;
    $("v-alt").textContent = fmtFt(s.h);
    $("v-tas").textContent = `${Math.round(s.v / X.MPH)} mph`;
    $("v-a").textContent = `${Math.round(X.isa(s.h).a / X.MPH)} mph`;
    $("v-gam").textContent = `${signed(s.gamma / DEG)}°`;
    $("v-g").textContent = `${s.n.toFixed(1)} g`;
    const fuel = s.fuel / X.X1.fuel;
    $("v-fuel").textContent = `${Math.round(fuel * 100)}%`;
    $("v-fuel").className = "v" + (fuel < 0.15 ? " bad" : fuel < 0.35 ? " warn" : "");
    const lit = X.chambersLit(s);
    $("v-lit").textContent = `${lit} lit · ${Math.round(lit * 1500)} lbf`;
    document.querySelectorAll("#chambers button").forEach((b) => {
      const i = +b.dataset.c;
      b.classList.toggle("on", s.chambers[i] && s.fuel > 0);
      b.disabled = s.fuel <= 0 || s.phase !== "flying";
    });
    const auth = X.elevatorAuthority(s.mach);
    $("v-auth").textContent = `${Math.round(auth * 100)}%`;
    $("v-auth").className = auth < 0.6 ? "bad" : "";
    $("b-auth").style.width = `${auth * 100}%`;
    $("b-auth").style.background = auth < 0.6 ? "var(--bad)" : "var(--ok)";
    $("v-trim").textContent = signed(s.trim / 0.6 * 4, 1) + "°";
    $("b-trim").style.left = `${50 + (s.trim / 0.6) * 46}%`;
    $("stick-up").classList.toggle("down", s.stick > 0.3);
    $("stick-down").classList.toggle("down", s.stick < -0.3);
    $("trim-up").classList.toggle("down", s.trimRate > 0);
    $("trim-down").classList.toggle("down", s.trimRate < 0);
    $("auto").classList.toggle("on", autopilot);
    $("auto").textContent = autopilot ? "Autopilot flying — take over" : "Fly Yeager's profile";
    $("status").innerHTML = statusText();
    $("loglines").innerHTML = s.events.slice(-4).map((e) => `t+${fmtT(e.t)} · ${e.text}`).join("<br>");
  }

  function statusText() {
    const hFt = s.h / X.FT;
    if (s.phase !== "flying") {
      if (s.outcome === "supersonic") return `<b>Through.</b> ${summary()}. Yeager's was Mach 1.06 near 43,000 ft, about 20 seconds of it, then a glide home to Rogers Dry Lake.`;
      if (s.outcome === "tuck") return `<b>The shock won.</b> With the elevator blanked, only the stabilizer trim can hold the nose up. Drop again and hold <b>W</b> as you pass Mach 0.9.`;
      if (s.outcome === "low") return "<b>Too low.</b> Light a chamber before you sink away from the drop altitude.";
      if (s.maxMach >= 1) return `<b>Only in a dive.</b> ${summary()}, but never with the nose level. Yeager's run counted because it was level flight.`;
      return `<b>The wall held.</b> ${summary()}. Climb higher, where sound is slower and the air thinner, and keep a chamber burning until you are through.`;
    }
    if (!X.chambersLit(s) && s.fuel > 0 && s.lastThrust === 0) return "Dropped from the B-29 at 20,000 ft and 250 mph. Light a chamber (<b>1–4</b>) before you sink too far.";
    if (X.elevatorAuthority(s.mach) < 0.6) return `<b>Shock on the tail.</b> The elevator has ${Math.round(X.elevatorAuthority(s.mach) * 100)}% of its bite and the shock is pushing the nose down. Use the stabilizer trim (<b>W</b>) to hold it level.`;
    if (s.mach >= 1) return `Supersonic. The pressure waves can't get ahead of the nose any more, and they pile into a cone ${(X.mu(s.mach) / DEG).toFixed(0)}° off the flight path.`;
    if (hFt < 38000 && X.chambersLit(s)) return `Climb toward 40,000 ft and above. Sound is ${Math.round(X.isa(s.h).a / X.MPH)} mph here; above 36,000 ft it bottoms out at 660 mph.`;
    if (s.fuel <= 0) return "Tanks dry. You are a glider now.";
    return "Level off near 42,000 ft and let it run. Watch the wavefronts bunch up in front of the nose.";
  }

  // ---------- loop ----------
  let last = null;
  function frame(ts) {
    if (last == null) last = ts;
    const dt = Math.min(0.1, (ts - last) / 1000);
    last = ts;
    if (live && !paused) step(dt * pace);
    refresh();
    requestAnimationFrame(frame);
  }
  function refresh() { draw(); drawTrace(); updatePanel(); }

  // ---------- input ----------
  function takeOver() { if (autopilot) { autopilot = false; s.stick = 0; s.trimRate = 0; } }
  const holdMap = { "stick-up": "up", "stick-down": "down", "trim-up": "tup", "trim-down": "tdown" };
  for (const [id, key] of Object.entries(holdMap)) {
    const el = $(id);
    const on = (e) => { e.preventDefault(); takeOver(); keys[key] = true; };
    const off = () => { keys[key] = false; };
    el.addEventListener("pointerdown", on);
    el.addEventListener("pointerup", off);
    el.addEventListener("pointerleave", off);
    el.addEventListener("pointercancel", off);
  }
  $("chambers").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    takeOver();
    const i = +b.dataset.c;
    X.setChamber(s, i, !s.chambers[i]);
  });
  $("auto").addEventListener("click", () => {
    if (autopilot) return takeOver();
    if (s.phase !== "flying") newFlight();
    autopilot = true;
  });
  $("reset").addEventListener("click", () => newFlight());
  $("pace").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    pace = +b.dataset.pace;
    document.querySelectorAll("#pace button").forEach((x) => x.setAttribute("aria-pressed", x === b));
  });
  const keyMap = { ArrowUp: "up", ArrowDown: "down", w: "tup", W: "tup", s: "tdown", S: "tdown" };
  addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (keyMap[e.key]) { e.preventDefault(); takeOver(); keys[keyMap[e.key]] = true; return; }
    if (e.repeat) return;
    if ("1234".includes(e.key) && e.key.length === 1) { takeOver(); const i = +e.key - 1; X.setChamber(s, i, !s.chambers[i]); }
    else if (e.key === " ") { e.preventDefault(); paused = !paused; }
    else if (e.key === "a" || e.key === "A") $("auto").click();
    else if (e.key === "r" || e.key === "R") newFlight();
  });
  addEventListener("keyup", (e) => { if (keyMap[e.key]) keys[keyMap[e.key]] = false; });
  addEventListener("blur", () => { keys = { up: false, down: false, tup: false, tdown: false }; });

  newFlight();
  requestAnimationFrame(frame);

  // Hooks for tests and the video recorder.
  window.glennis = {
    get state() { return s; },
    newFlight, step, draw, updatePanel, refresh,
    setLive: (v) => { live = v; },
    setAutopilot: (v) => { autopilot = v; },
    keys: (k) => Object.assign(keys, k),
  };
})();
