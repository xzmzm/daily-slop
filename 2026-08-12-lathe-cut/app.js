/*
 * lathe-cut — application
 *
 * Wires the pure engine (engine.js) to a canvas turntable. The disc is a
 * SCHEMATIC: a real LP groove is sub-millimetre pitch (you cannot see the
 * individual turns), so the canvas draws a legible ~6–40 turns and labels
 * itself as such. The physics readouts (λ, v, grooves/in, side time, RIAA)
 * are exact and use the real pitch you set.
 *
 * The thing the schematic preserves honestly is the waveform: each visible
 * turn carries exactly `gpr` lateral wiggles of the chosen timbre, and the
 * number of wiggles per revolution is the literal definition of the recorded
 * frequency (f = gpr · rpm/60). So what you see IS what is encoded.
 */

(() => {
  "use strict";
  const E = window.LatheCut;
  const G = E.GEOMETRY;

  // ── state ────────────────────────────────────────────────────────────────
  const state = {
    timbre: "sine",
    gpr: 24,
    pitch: 0.16,        // real mm — drives KPIs
    amp: 0.55,          // mm of display excursion
    rpm: 100 / 3,
    mode: "idle",       // idle | cutting | playing
    cutProgress: 0,     // 0..1 of the *visual* spiral revealed
    needleR_mm: G.outerGroove_mm,
    needleDropping: false,
    spinAngle: 0,       // rad, disc rotation (real-time ω while running)
    backwards: false,
    cutDuration: 7.2,   // seconds for a full cut (time-lapse)
  };

  // ── dom ──────────────────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const dom = {
    canvas: $("platter"), stage: $("stage"),
    kRpm: $("kRpm"), kRadius: $("kRadius"), kVel: $("kVel"), kLambda: $("kLambda"),
    kLpi: $("kLpi"), kSide: $("kSide"),
    gpr: $("gpr"), gprVal: $("gprVal"), freqVal: $("freqVal"), lambdaNow: $("lambdaNow"),
    pitch: $("pitch"), pitchVal: $("pitchVal"), lpiVal: $("lpiVal"),
    amp: $("amp"), ampVal: $("ampVal"),
    timbreRow: $("timbreRow"),
    modeBadge: $("modeBadge"), stylusR: $("stylusR"), cutHint: $("cutHint"),
    cutBtn: $("cutBtn"), needleBtn: $("needleBtn"), resetBtn: $("resetBtn"), revChk: $("revChk"),
    lambdaGrid: $("lambdaGrid"), cutterFill: $("cutterFill"), cutterLimit: $("cutterLimit"),
    innerWarn: $("innerWarn"), innerFmax: $("innerFmax"),
    riaaPlot: $("riaaPlot"), riaaLandmarks: $("riaaLandmarks"),
  };
  const ctx = dom.canvas.getContext("2d");

  // ── canvas sizing (DPR-aware) ────────────────────────────────────────────
  let W = 0, H = 0, CX = 0, CY = 0, SCALE = 1;   // SCALE = px per mm (visual)
  let outerV = 0;             // disc edge (visual px)
  let grooveOuterV = 0;       // outer modulated groove (visual px) — 146.05 mm
  let grooveInnerV = 0;       // inner groove / runout (visual px) — 70 mm
  let labelV = 0;             // paper label (visual px) — 63 mm
  let visibleTurns = 16;

  function resize() {
    const rect = dom.stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.round(rect.width); H = Math.round(rect.height);
    dom.canvas.width = W * dpr; dom.canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    CX = W / 2; CY = H / 2;
    const half = Math.min(W, H) / 2;
    outerV = half * 0.92;                                // disc outer edge
    SCALE = outerV / (G.discDiameter_mm / 2);           // px per mm
    grooveOuterV = G.outerGroove_mm * SCALE;            // 146.05 mm
    grooveInnerV = G.innerGroove_mm * SCALE;            // 70 mm
    labelV = G.labelRadius_mm * SCALE;                  // 63 mm
    recomputeSpiral();
    draw();
  }

  // ── visual pitch (schematic, legible) ────────────────────────────────────
  function visualTurnCount() {
    // fewer real mm/turn → denser real record → show MORE turns (clamped legible)
    const n = Math.round(16 * (0.16 / state.pitch));
    return Math.max(6, Math.min(40, n));
  }

  // Precomputed spiral points (disc-local px), rebuilt on param change.
  let spiral = [];     // [{x,y,mr}]  mr = mean radius px
  function recomputeSpiral() {
    visibleTurns = visualTurnCount();
    const bandPitch = (grooveOuterV - grooveInnerV) / visibleTurns;   // px per turn
    const samplesPerRev = Math.max(60, 8 * state.gpr);
    const N = samplesPerRev * visibleTurns;
    const ampPx = state.amp * SCALE * 0.5;  // modest px excursion (amp is in mm)
    const out = new Array(N);
    for (let i = 0; i < N; i++) {
      const frac = i / (N - 1);
      const theta = frac * visibleTurns * E.TWO_PI;
      const mr = grooveOuterV - (bandPitch / E.TWO_PI) * theta;
      const phase = (theta / E.TWO_PI) * state.gpr;
      const mod = E.waveformSample(state.timbre, phase) * ampPx;
      const r = mr + mod;
      out[i] = { x: r * Math.cos(theta), y: r * Math.sin(theta), mr, theta };
    }
    spiral = out;
  }

  // reveal cutProgress → number of points to draw
  function revealedCount() {
    if (state.mode === "idle") {
      // show the whole spiral faintly as the "blank groove guide" before cutting
      return Math.floor(spiral.length * (state.cutProgress || 0));
    }
    return Math.floor(spiral.length * state.cutProgress);
  }

  // ── drawing ──────────────────────────────────────────────────────────────
  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawPlatter();
    ctx.save();
    ctx.translate(CX, CY);
    ctx.rotate(state.spinAngle);
    drawDisc();
    drawSpiral();
    drawLabel();
    ctx.restore();
    drawSpindle();
    drawArms();   // cutting head + tonearm (lab frame, do not rotate)
  }

  function drawPlatter() {
    // faint outer platter ring
    const r = Math.min(W, H) / 2;
    const g = ctx.createRadialGradient(CX, CY, r * 0.5, CX, CY, r);
    g.addColorStop(0, "rgba(40,34,26,0.0)");
    g.addColorStop(1, "rgba(0,0,0,0.5)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function drawDisc() {
    // vinyl body
    const g = ctx.createRadialGradient(0, 0, labelV, 0, 0, outerV);
    g.addColorStop(0, "#161310");
    g.addColorStop(0.55, "#0c0a08");
    g.addColorStop(0.85, "#1a1410");
    g.addColorStop(1, "#241b13");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, outerV, 0, E.TWO_PI); ctx.fill();
    // subtle sheen
    ctx.strokeStyle = "rgba(232,161,58,0.06)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, outerV - 1, 0, E.TWO_PI); ctx.stroke();
  }

  function drawSpiral() {
    if (!spiral.length) return;
    const showAll = state.mode === "idle" && state.cutProgress === 0;
    const n = showAll ? spiral.length : revealedCount();
    // faint guide of the whole spiral (the uncut lacquer guide)
    if (state.mode !== "playing") {
      ctx.strokeStyle = "rgba(120,100,75,0.10)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < spiral.length; i++) {
        const p = spiral[i];
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
    // the engraved (revealed) portion — bright
    if (n > 1) {
      ctx.strokeStyle = state.mode === "playing"
        ? "rgba(190,165,120,0.55)"
        : "rgba(232,200,140,0.72)";
      ctx.lineWidth = 1.25;
      ctx.lineJoin = "round";
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const p = spiral[i];
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
    // hot cutting tip
    if (state.mode === "cutting" && n > 0 && n < spiral.length) {
      const tip = spiral[Math.max(0, n - 1)];
      const glow = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, 14);
      glow.addColorStop(0, "rgba(255,120,60,0.9)");
      glow.addColorStop(1, "rgba(255,120,60,0)");
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(tip.x, tip.y, 14, 0, E.TWO_PI); ctx.fill();
      ctx.fillStyle = "#ffd9a0";
      ctx.beginPath(); ctx.arc(tip.x, tip.y, 2.2, 0, E.TWO_PI); ctx.fill();
    }
  }

  function drawLabel() {
    // paper label
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, labelV);
    g.addColorStop(0, "#c8442f");
    g.addColorStop(1, "#8d2a1c");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, labelV, 0, E.TWO_PI); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, labelV, 0, E.TWO_PI); ctx.stroke();
    // label text (rotates with disc)
    ctx.fillStyle = "rgba(243,234,217,0.92)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${Math.round(labelV * 0.20)}px -apple-system, sans-serif`;
    ctx.fillText("lathe-cut", 0, -labelV * 0.34);
    ctx.font = `${Math.round(labelV * 0.12)}px ui-monospace, monospace`;
    ctx.fillStyle = "rgba(243,234,217,0.6)";
    ctx.fillText(`${state.rpm === 45 ? "45" : "33⅓"} rpm`, 0, labelV * 0.02);
    ctx.fillText(`gpr ${state.gpr} · ${state.timbre}`, 0, labelV * 0.30);
    // a rotation tick so spin is visible
    ctx.strokeStyle = "rgba(243,234,217,0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(labelV * 0.7, 0); ctx.lineTo(labelV * 0.92, 0); ctx.stroke();
  }

  function drawSpindle() {
    ctx.save();
    ctx.translate(CX, CY);
    const hole = Math.max(3, G.spindle_mm * SCALE * 0.5);
    ctx.fillStyle = "#0a0806";
    ctx.beginPath(); ctx.arc(0, 0, hole + 2, 0, E.TWO_PI); ctx.fill();
    ctx.fillStyle = "#3a2e22";
    ctx.beginPath(); ctx.arc(0, 0, hole, 0, E.TWO_PI); ctx.fill();
    ctx.fillStyle = "#5a4a36";
    ctx.beginPath(); ctx.arc(-hole * 0.3, -hole * 0.3, hole * 0.45, 0, E.TWO_PI); ctx.fill();
    ctx.restore();
  }

  // current stylus radius (mm) in lab frame, depending on mode
  function currentStylusR_mm() {
    if (state.mode === "cutting") {
      const rV = grooveOuterV - state.cutProgress * (grooveOuterV - grooveInnerV);
      return rV / SCALE;
    }
    if (state.mode === "playing") return state.needleR_mm;
    return G.outerGroove_mm;
  }

  function drawArms() {
    ctx.save();
    ctx.translate(CX, CY);
    if (state.mode === "cutting") {
      // cutting head on a horizontal rail at angle π (left)
      const rV = grooveOuterV - state.cutProgress * (grooveOuterV - grooveInnerV);
      const hx = -rV, hy = 0;
      // rail
      ctx.strokeStyle = "rgba(232,161,58,0.25)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-outerV - 8, 0); ctx.lineTo(-labelV, 0); ctx.stroke();
      // head
      ctx.fillStyle = "#2a221a";
      ctx.strokeStyle = "#e8a13a";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(hx - 14, hy - 11, 24, 22, 4) : ctx.rect(hx - 14, hy - 11, 24, 22);
      ctx.fill(); ctx.stroke();
      // stylus shard into the disc
      ctx.strokeStyle = "#ffd9a0"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(hx + 4, hy); ctx.lineTo(hx + 10, hy); ctx.stroke();
      ctx.fillStyle = "#ff8a4a";
      ctx.beginPath(); ctx.arc(hx + 10, hy, 2.4, 0, E.TWO_PI); ctx.fill();
    }
    if (state.mode === "playing") {
      // tonearm from upper-right pivot to needle
      const ang = -Math.PI * 0.62; // upper-left-ish contact
      const nr = state.needleR_mm * SCALE;
      const nx = nr * Math.cos(ang), ny = nr * Math.sin(ang);
      const pivX = outerV * 0.92, pivY = -outerV * 0.92;
      ctx.strokeStyle = "#8a7a5e";
      ctx.lineWidth = 4; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(pivX, pivY); ctx.lineTo(nx, ny); ctx.stroke();
      ctx.strokeStyle = "#bfa97e"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(pivX, pivY); ctx.lineTo(nx, ny); ctx.stroke();
      // pivot
      ctx.fillStyle = "#3a2e22"; ctx.strokeStyle = "#e8a13a"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(pivX, pivY, 7, 0, E.TWO_PI); ctx.fill(); ctx.stroke();
      // needle tip glow
      const glow = ctx.createRadialGradient(nx, ny, 0, nx, ny, 12);
      glow.addColorStop(0, "rgba(127,212,114,0.85)");
      glow.addColorStop(1, "rgba(127,212,114,0)");
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(nx, ny, 12, 0, E.TWO_PI); ctx.fill();
      ctx.fillStyle = "#eafff0";
      ctx.beginPath(); ctx.arc(nx, ny, 2.6, 0, E.TWO_PI); ctx.fill();
    }
    ctx.restore();
  }

  // ── animation loop ───────────────────────────────────────────────────────
  let last = performance.now();
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const dir = state.backwards ? -1 : 1;
    if (state.mode === "cutting") {
      state.cutProgress = Math.min(1, state.cutProgress + dt / state.cutDuration);
      state.spinAngle += dir * E.omega(state.rpm) * dt;
      if (state.cutProgress >= 1) { state.mode = "idle"; state.cutProgress = 1; syncModeUi(); }
    } else if (state.mode === "playing") {
      state.spinAngle += dir * E.omega(state.rpm) * dt;
      // needle drifts inward as the groove advances
      const bandPitch = (G.outerGroove_mm - G.innerGroove_mm) / E.spiralTurns(G.outerGroove_mm, G.innerGroove_mm, state.pitch);
      // drift so a real side plays in ~ sideTime, but sped up: traverse in ~12s
      const traverseSec = 12;
      state.needleR_mm += dir * -1 * (G.outerGroove_mm - G.innerGroove_mm) / traverseSec * dt;
      if (state.needleR_mm <= G.innerGroove_mm) {
        state.needleR_mm = G.innerGroove_mm;
        stopPlayback(); state.mode = "idle"; syncModeUi();
      }
      if (state.needleR_mm >= G.outerGroove_mm) {
        state.needleR_mm = G.outerGroove_mm;
        stopPlayback(); state.mode = "idle"; syncModeUi();
      }
    }
    if (state.mode !== "idle" || state.spinAngle !== 0) {
      // keep a gentle idle only if spinning; otherwise leave the last frame
    }
    draw();
    updateHud();
    requestAnimationFrame(tick);
  }

  // ── readouts ─────────────────────────────────────────────────────────────
  function fmt(n, d = 2) { return Number(n).toFixed(d); }

  function updateKPIs() {
    const r = currentStylusR_mm();
    const v = E.linearVelocity(state.rpm, r) / 1000;       // m/s
    const fRef = 440;
    const lam = E.wavelength(state.rpm, r, fRef);          // mm
    const turns = E.spiralTurns(G.outerGroove_mm, G.innerGroove_mm, state.pitch);
    const side = E.sideTimeMinutes(state.rpm, turns);      // min
    dom.kRpm.textContent = state.rpm === 45 ? "45" : "33⅓";
    dom.kRadius.textContent = fmt(r, 1);
    dom.kVel.textContent = fmt(v, 2);
    dom.kLambda.textContent = fmt(lam, 2);
    dom.kLpi.textContent = Math.round(E.lpiFromPitch(state.pitch));
    dom.kSide.textContent = fmt(side, 1);
  }

  function updateProgramReadouts() {
    const f0 = E.frequency(state.gpr, state.rpm);
    dom.gprVal.textContent = state.gpr;
    dom.freqVal.textContent = fmt(f0, 1);
    dom.lambdaNow.textContent = fmt(E.wavelength(state.rpm, currentStylusR_mm(), f0), 1);
    dom.pitchVal.textContent = fmt(state.pitch, 2);
    dom.lpiVal.textContent = Math.round(E.lpiFromPitch(state.pitch));
    dom.ampVal.textContent = fmt(state.amp, 2);
  }

  function updateHud() {
    const r = currentStylusR_mm();
    dom.stylusR.textContent = fmt(r, 1);
    updateKPIs();
    updateProgramReadouts();
    updateLambdaGrid();
    updateCutterBar();
  }

  function updateLambdaGrid() {
    // λ of the current program frequency at outer / mid / inner groove
    const f = E.frequency(state.gpr, state.rpm);
    const pts = [
      ["outer", G.outerGroove_mm], ["mid", (G.outerGroove_mm + G.innerGroove_mm) / 2], ["inner", G.innerGroove_mm],
    ];
    const cutterLimit = G.cutterLimit_mm;
    dom.lambdaGrid.innerHTML = pts.map(([label, r]) => {
      const lam = E.wavelength(state.rpm, r, f);
      const danger = lam < cutterLimit * 4 ? " danger" : "";
      const unit = lam >= 1 ? [fmt(lam, 2), "mm"] : [fmt(lam * 1000, 0), "µm"];
      return `<div class="lambda-cell${danger}"><div class="lc-r">${label} · ${fmt(r, 0)}mm</div><div class="lc-l">${unit[0]}</div><div class="lc-u">${unit[1]} @ ${fmt(f, 1)} Hz</div></div>`;
    }).join("");
  }

  function updateCutterBar() {
    // The bar shows the resolution ceiling — the highest frequency the
    // 25 µm cutter tip can still resolve at the current stylus radius. It is
    // full (~20 kHz) at the outer groove and collapses toward the label:
    // this *is* the inner-groove problem, drawn as retreating treble headroom.
    const r = currentStylusR_mm();
    const fMax = E.maxResolvableFrequency(state.rpm, r, G.cutterLimit_mm);
    const headroom = Math.max(0, Math.min(1, fMax / 20000)); // 1.0 = full 20 kHz band
    dom.cutterFill.style.width = (headroom * 100) + "%";
    dom.cutterLimit.style.left = "100%"; // the 20 kHz reference edge
    const warn = fMax < 16000;           // entered the inner third of the groove
    dom.innerWarn.classList.toggle("hidden", !warn);
    dom.innerFmax.textContent = fmt(fMax / 1000, 1);
  }

  // ── RIAA plot (static SVG, rebuilt on load) ──────────────────────────────
  function drawRiaa() {
    const W2 = 320, H2 = 120, pad = 6;
    const lo = Math.log10(20), hi = Math.log10(20000);
    const x = (f) => pad + (Math.log10(f) - lo) / (hi - lo) * (W2 - 2 * pad);
    const dbs = E.riaaPlaybackDb(20), dbe = E.riaaPlaybackDb(20000);
    const span = Math.max(Math.abs(dbs), Math.abs(dbe));
    const y = (db) => H2 - pad - ((db + span) / (2 * span)) * (H2 - 2 * pad);
    let d = "";
    for (let i = 0; i <= 240; i++) {
      const f = Math.pow(10, lo + (hi - lo) * i / 240);
      d += (i ? "L" : "M") + x(f).toFixed(1) + " " + y(E.riaaPlaybackDb(f)).toFixed(1) + " ";
    }
    // zero-dB axis
    const y0 = y(0);
    dom.riaaPlot.innerHTML = `
      <line x1="${pad}" y1="${y0.toFixed(1)}" x2="${W2 - pad}" y2="${y0.toFixed(1)}" stroke="#6b6151" stroke-width="1" stroke-dasharray="3 3"/>
      <path d="${d}" fill="none" stroke="#e8a13a" stroke-width="2"/>
      <text x="${x(1000).toFixed(0)}" y="${(y0 - 4).toFixed(0)}" fill="#9a8e78" font-size="9" text-anchor="middle" font-family="ui-monospace,monospace">1 kHz · 0 dB</text>
    `;
    const marks = [[100, "+13.1"], [500, "+2.6"], [1000, "0"], [5000, "−8.2"], [10000, "−13.7"], [20000, "−19.6"]];
    dom.riaaLandmarks.innerHTML = marks.map(([f, db]) => `<div><b>${db}</b>${f >= 1000 ? f / 1000 + " kHz" : f + " Hz"}</div>`).join("");
  }

  // ── audio (Web Audio monitor) ────────────────────────────────────────────
  let actx = null, monitor = null, monitorGain = null;
  function ensureAudio() {
    if (actx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    actx = new AC();
    monitorGain = actx.createGain();
    monitorGain.gain.value = 0;
    monitorGain.connect(actx.destination);
  }
  function periodicFor(timbre) {
    // native oscillators cover all four shapes
    const map = { sine: "sine", triangle: "triangle", saw: "sawtooth", square: "square" };
    return map[timbre] || "sine";
  }
  function startPlayback() {
    ensureAudio();
    if (!actx) return;
    if (actx.state === "suspended") actx.resume();
    stopPlayback();
    monitor = actx.createOscillator();
    monitor.type = periodicFor(state.timbre);
    const f0 = E.frequency(state.gpr, state.rpm);
    // fundamental of a real cut is often sub-audible; shift up for the monitor
    let f = f0;
    while (f < 70) f *= 2;
    monitor.frequency.value = f;
    monitor.connect(monitorGain);
    monitor.start();
    monitorGain.gain.cancelScheduledValues(actx.currentTime);
    monitorGain.gain.setValueAtTime(monitorGain.gain.value, actx.currentTime);
    monitorGain.gain.linearRampToValueAtTime(0.14, actx.currentTime + 0.12);
  }
  function stopPlayback() {
    if (!actx || !monitor) return;
    const t = actx.currentTime;
    monitorGain.gain.cancelScheduledValues(t);
    monitorGain.gain.setValueAtTime(monitorGain.gain.value, t);
    monitorGain.gain.linearRampToValueAtTime(0, t + 0.08);
    const m = monitor; monitor = null;
    setTimeout(() => { try { m.stop(); } catch (e) {} }, 120);
  }

  // ── actions ──────────────────────────────────────────────────────────────
  function syncModeUi() {
    dom.modeBadge.textContent = state.mode;
    dom.modeBadge.className = state.mode;
    dom.cutBtn.disabled = state.mode === "playing";
    if (state.mode === "cutting") dom.cutBtn.textContent = "⌖ cutting…";
    else dom.cutBtn.textContent = "⌖ cut";
    if (state.mode === "playing") dom.needleBtn.textContent = "⏏ lift needle";
    else dom.needleBtn.textContent = "⤓ drop needle";
    dom.cutHint.textContent =
      state.mode === "cutting" ? "engraving the lacquer — head feeds inward" :
      state.mode === "playing" ? "reading the groove — needle drifting inward" :
      state.cutProgress > 0 ? "side cut · drop the needle to play" :
      "press CUT to engrave the lacquer";
  }

  function doCut() {
    if (state.mode === "playing") return;
    state.mode = "cutting";
    state.cutProgress = 0;
    state.needleR_mm = G.outerGroove_mm;
    recomputeSpiral();
    syncModeUi();
  }
  function doNeedle() {
    if (state.mode === "playing") { stopPlayback(); state.mode = "idle"; syncModeUi(); return; }
    if (state.mode === "cutting") return;
    if (state.cutProgress === 0) { // nothing cut yet — auto-cut a side first
      state.cutProgress = 1;
    }
    state.mode = "playing";
    state.needleR_mm = state.backwards ? G.innerGroove_mm : G.outerGroove_mm;
    recomputeSpiral();
    syncModeUi();
    startPlayback();
  }
  function doReset() {
    stopPlayback();
    state.mode = "idle"; state.cutProgress = 0;
    state.needleR_mm = G.outerGroove_mm; state.spinAngle = 0;
    recomputeSpiral(); syncModeUi(); draw();
  }

  // ── wiring ───────────────────────────────────────────────────────────────
  dom.cutBtn.addEventListener("click", doCut);
  dom.needleBtn.addEventListener("click", doNeedle);
  dom.resetBtn.addEventListener("click", doReset);
  dom.revChk.addEventListener("change", () => { state.backwards = dom.revChk.checked; });

  dom.timbreRow.addEventListener("click", (e) => {
    const b = e.target.closest(".timbre"); if (!b) return;
    state.timbre = b.dataset.timbre;
    [...dom.timbreRow.children].forEach((c) => c.classList.toggle("on", c === b));
    recomputeSpiral(); draw();
    if (monitor) monitor.type = periodicFor(state.timbre);
  });
  document.querySelector('.rpm-row')?.addEventListener("click", (e) => {
    const b = e.target.closest(".rpm"); if (!b) return;
    state.rpm = parseFloat(b.dataset.rpm);
    document.querySelectorAll(".rpm").forEach((c) => c.classList.toggle("on", c === b));
    recomputeSpiral(); draw();
  });

  dom.gpr.addEventListener("input", () => {
    state.gpr = parseInt(dom.gpr.value, 10);
    recomputeSpiral(); draw();
  });
  dom.pitch.addEventListener("input", () => {
    state.pitch = parseFloat(dom.pitch.value);
    recomputeSpiral(); draw();
  });
  dom.amp.addEventListener("input", () => {
    state.amp = parseFloat(dom.amp.value);
    recomputeSpiral(); draw();
  });

  // click on the disc to drop the needle at that radius
  dom.canvas.addEventListener("click", (e) => {
    if (state.mode === "cutting") return;
    const rect = dom.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left - CX;
    const y = e.clientY - rect.top - CY;
    const r = Math.hypot(x, y) / SCALE;
    if (r >= G.innerGroove_mm && r <= G.outerGroove_mm) {
      if (state.cutProgress === 0) state.cutProgress = 1;
      state.needleR_mm = r;
      state.mode = "playing";
      recomputeSpiral(); syncModeUi(); startPlayback();
    }
  });

  // keyboard: space = cut, n = needle, r = reset
  window.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT") return;
    if (e.code === "Space") { e.preventDefault(); doCut(); }
    else if (e.key === "n") doNeedle();
    else if (e.key === "r") doReset();
  });

  window.addEventListener("resize", resize);

  // ── boot ─────────────────────────────────────────────────────────────────
  resize();
  drawRiaa();
  syncModeUi();
  updateHud();
  requestAnimationFrame((t) => { last = t; tick(t); });
})();
