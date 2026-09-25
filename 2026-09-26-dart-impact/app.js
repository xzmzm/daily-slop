/* DART kinetic-deflection studio — scene, choreography and UI. */
(() => {
  'use strict';
  const C = window.dartCore;

  // Presentation constants. The orbital clock runs at ×1800 (1 s ≈ 30 min);
  // the terminal approach is choreographed at presentation speed because the
  // real crossing takes under a second.
  const TIME_SCALE = 1800;
  const APPROACH_S = 4.2;
  const FLASH_S = 0.45;
  const LICIACUBE_AT = 2.6;
  const LICIACUBE_S = 3.2;
  const EXAGGERATE_K = 4;
  const BODY_K = 1;            // 1 = bodies at true scale (the system is that tight)
  const SUN_DIR = [0.94, 0.34]; // sunlight from upper-left; tail points away

  const scene = document.getElementById('scene');
  const sctx = scene.getContext('2d');
  const lcCanvas = document.getElementById('lightcurve');
  const lctx = lcCanvas.getContext('2d');

  const el = {
    clock: document.getElementById('clock'),
    scaleNote: document.getElementById('scaleNote'),
    beta: document.getElementById('betaRange'),
    theta: document.getElementById('thetaRange'),
    betaVal: document.getElementById('betaVal'),
    thetaVal: document.getElementById('thetaVal'),
    exagg: document.getElementById('exaggCheck'),
    launch: document.getElementById('launch'),
    craft: document.getElementById('craftLine'),
    statMode: document.getElementById('statMode'),
    dT: document.getElementById('dT'),
    dv: document.getElementById('dv'),
    tBefore: document.getElementById('tBefore'),
    tAfter: document.getElementById('tAfter'),
    aNew: document.getElementById('aNew'),
    ecc: document.getElementById('ecc'),
    impulse: document.getElementById('impulse'),
    goalBar: document.getElementById('goalBar'),
    resultBar: document.getElementById('resultBar'),
    resultLbl: document.getElementById('resultLbl'),
    drift: document.getElementById('drift'),
    lcFoot: document.getElementById('lcFoot'),
  };

  const state = {
    phase: 'idle',            // idle | approach | aftermath
    tau: 0,                   // presentation clock (s); drives every visual
    beta: 3.61, theta: 0,
    exaggerate: true,
    phi0: -Math.PI / 2,       // Dimorphos starts at 12 o'clock, moving right
    launchTau: 0, impactTau: 0, phiImpact: 0, vHat: [0, 0], nHat: [1, 0],
    impactPos: [0, 0],
    result: null,             // C.impact(...) frozen at launch
    predicted: null,          // C.impact(...) for current sliders
    particles: [],            // closed-form ejecta (position pure in τ)
    autoplay: true,
  };
  state.predicted = C.impact(state.beta, state.theta);

  let stars = [];
  const starRng = C.seededRng(926);

  // --- geometry ------------------------------------------------------------
  function metrics() {
    const w = scene.clientWidth, h = scene.clientHeight;
    const R = Math.min(w * 0.30, h * 0.42);   // orbit radius in px
    return { w, h, cx: w / 2, cy: h / 2, R, ppm: R / C.A0 };
  }
  const pt = (m, ang, rM) => [m.cx + Math.cos(ang) * rM * m.ppm, m.cy + Math.sin(ang) * rM * m.ppm];

  function oldAngle(tau) {   // pre-impact: steady circular motion
    return state.phi0 + (2 * Math.PI / C.T0) * tau * TIME_SCALE;
  }

  function dimorphosNow(tau) {
    if (!state.result || tau < state.impactTau) {
      const ang = oldAngle(tau);
      return { ang, r: C.A0 };
    }
    const p = C.positionAt(state.result, (tau - state.impactTau) * TIME_SCALE);
    return { ang: state.phiImpact + p.angle, r: p.radius };
  }

  function exaggRadius(result, f) {
    // Pin the impact point; exaggerate the radial deviation from A0.
    const r = (result.a * (1 - result.e * result.e)) / (1 + result.e * Math.cos(f));
    return state.exaggerate ? C.A0 + EXAGGERATE_K * (r - C.A0) : r;
  }

  function drawOrbitPath(m, result, sceneRot, stroke, dash, width, alpha) {
    sctx.save();
    sctx.strokeStyle = stroke; sctx.globalAlpha = alpha;
    sctx.lineWidth = width; sctx.setLineDash(dash);
    sctx.beginPath();
    for (let f = 0; f <= 360; f += 3) {
      const fr = (f * Math.PI) / 180;
      const [x, y] = pt(m, sceneRot + result.argp + fr, exaggRadius(result, fr));
      if (f === 0) sctx.moveTo(x, y); else sctx.lineTo(x, y);
    }
    sctx.stroke();
    sctx.restore();
  }

  function drawBody(m, cx, cy, rad, seed, spin, base, rim) {
    sctx.save();
    sctx.translate(cx, cy);
    sctx.beginPath();
    const rng = C.seededRng(seed);
    const lobes = [[2, 0.05, 0], [3, 0.06, 1.7], [5, 0.03, 4.1], [7, 0.025, 2.3]]
      .map(([n, amp, ph]) => [n, amp, ph, rng()]);
    for (let a = 0; a <= 360; a += 6) {
      const ar = (a * Math.PI) / 180;
      let r = 1;
      for (const [n, amp, ph, j] of lobes) r += amp * Math.cos(n * (ar + spin) + ph + j * 6.28);
      const x = Math.cos(ar) * rad * r, y = Math.sin(ar) * rad * r;
      if (a === 0) sctx.moveTo(x, y); else sctx.lineTo(x, y);
    }
    sctx.closePath();
    const grad = sctx.createLinearGradient(-rad, -rad, rad, rad);
    grad.addColorStop(0, rim); grad.addColorStop(1, base);
    sctx.fillStyle = grad;
    sctx.shadowColor = 'rgba(0,0,0,.6)'; sctx.shadowBlur = rad * 0.5;
    sctx.fill();
    sctx.shadowBlur = 0;
    sctx.strokeStyle = 'rgba(255,255,255,.14)'; sctx.lineWidth = 1; sctx.stroke();
    sctx.restore();
  }

  function drawScene() {
    const m = metrics();
    const dpr = window.devicePixelRatio || 1;
    if (scene.width !== Math.round(m.w * dpr)) {
      scene.width = Math.round(m.w * dpr); scene.height = Math.round(m.h * dpr);
    }
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const tau = state.tau;
    const post = state.phase === 'aftermath';
    const approaching = state.phase === 'approach';
    const impactPt = state.phase === 'idle' ? null : pt(m, state.phiImpact, C.A0);

    // impact flash shake
    let shakeX = 0, shakeY = 0;
    if (post) {
      const dt = tau - state.impactTau;
      if (dt < 0.5) {
        const amp = 7 * Math.exp(-8 * dt);
        shakeX = amp * Math.cos(47 * dt + 1.3); shakeY = amp * Math.sin(53 * dt);
      }
    }
    sctx.translate(shakeX, shakeY);

    // starfield
    if (stars.length === 0) {
      for (let i = 0; i < 150; i++) stars.push([starRng(), starRng(), starRng(), starRng()]);
    }
    for (const [sx, sy, ss, sp] of stars) {
      const tw = 0.5 + 0.5 * Math.sin(tau * (0.4 + sp) + sp * 40);
      sctx.globalAlpha = 0.16 + 0.5 * tw * ss;
      sctx.fillStyle = '#cfe2f5';
      sctx.fillRect(sx * m.w, sy * m.h, 1.4 + ss, 1.4 + ss);
    }
    sctx.globalAlpha = 1;

    // sun marker
    sctx.save();
    sctx.globalAlpha = 0.8;
    sctx.fillStyle = '#ffd98a';
    sctx.font = '13px ui-monospace, Menlo, monospace';
    sctx.fillText('☀', 16, 24);
    sctx.fillText('sunlight', 34, 24);
    sctx.restore();

    // old orbit
    sctx.save();
    sctx.strokeStyle = '#3d4f68'; sctx.lineWidth = 1.4; sctx.setLineDash([7, 7]);
    sctx.beginPath(); sctx.arc(m.cx, m.cy, m.R, 0, 2 * Math.PI); sctx.stroke();
    sctx.restore();

    // orbits: predicted ghost (pre-impact) or actual (post-impact)
    const shown = state.result || state.predicted;
    const sceneRot = state.phiImpact;
    if (!post || state.exaggerate) {
      drawOrbitPath(m, shown, sceneRot, '#7fd6e8', [5, 6], 1.6,
        post ? 0.95 : 0.45);
    } else {
      drawOrbitPath(m, shown, sceneRot, '#7fd6e8', [], 1.8, 0.95);
    }
    if (post) {
      // apoapsis is the impact point; mark the near periapsis
      const periR = exaggRadius(shown, 0);
      const [px, py] = pt(m, sceneRot + shown.argp, periR);
      sctx.fillStyle = '#7fd6e8';
      sctx.beginPath(); sctx.arc(px, py, 3, 0, 2 * Math.PI); sctx.fill();
      sctx.font = '11px ui-monospace, Menlo, monospace';
      sctx.fillStyle = '#7fd6e8'; sctx.globalAlpha = 0.85;
      sctx.fillText(`peri ${Math.round(shown.rp)} m`, px + 7, py + 3);
      sctx.globalAlpha = 1;
    }

    // ejecta tail wedge (anti-sunward; the Hubble tail, faded in)
    if (post && tau - state.impactTau > 1.2) {
      const d = dimorphosNow(tau);
      const [bx, by] = pt(m, d.ang, d.r);
      const grow = Math.min(1, (tau - state.impactTau - 1.2) / 8);
      const len = 250 * grow, half = (26 + 110 * grow);
      const ux = SUN_DIR[0], uy = SUN_DIR[1];
      sctx.save();
      sctx.globalAlpha = 0.1 + 0.06 * grow;
      const grad = sctx.createLinearGradient(bx, by, bx + ux * len, by + uy * len);
      grad.addColorStop(0, '#cfe2f5'); grad.addColorStop(1, 'rgba(207,226,245,0)');
      sctx.fillStyle = grad;
      sctx.beginPath();
      sctx.moveTo(bx - uy * 6, by + ux * 6);
      sctx.lineTo(bx + ux * len - uy * half, by + uy * len + ux * half);
      sctx.lineTo(bx + ux * len + uy * half, by + uy * len - ux * half);
      sctx.lineTo(bx + uy * 6, by - ux * 6);
      sctx.closePath(); sctx.fill();
      if (grow > 0.55) {
        sctx.globalAlpha = 0.5; sctx.fillStyle = '#8fa2b8';
        sctx.font = '11px ui-monospace, Menlo, monospace';
        sctx.fillText('ejecta tail — sunlight pushes the dust', bx + ux * len * 0.45, by + uy * len * 0.45 + 26);
      }
      sctx.restore();
    }

    // Didymos (true scale ×BODY_K)
    const didR = C.DIDYMOS_R * m.ppm * BODY_K;
    drawBody(m, m.cx, m.cy, didR, 41, tau * 0.02, '#3f444d', '#757c88');
    sctx.fillStyle = '#8fa2b8'; sctx.font = '11px ui-monospace, Menlo, monospace';
    sctx.fillText('Didymos · 780 m', m.cx + didR + 8, m.cy - 6);

    // Dimorphos
    const d = dimorphosNow(tau);
    const [dx, dy] = pt(m, d.ang, d.r);
    const dimR = C.DIMORPHOS_R * m.ppm * BODY_K;
    if (post) {   // crater rim glow on the hit face
      sctx.save();
      sctx.globalAlpha = Math.max(0, 1 - (tau - state.impactTau) / 6);
      sctx.fillStyle = '#ffb454';
      sctx.beginPath(); sctx.arc(dx, dy, dimR * 1.45, 0, 2 * Math.PI); sctx.fill();
      sctx.restore();
    }
    drawBody(m, dx, dy, dimR, 77, d.ang, '#4a5364', '#8d97ab');
    sctx.fillStyle = '#8fa2b8';
    sctx.fillText('Dimorphos · 160 m', dx + dimR + 7, dy + 3);

    // DART probe during approach
    if (approaching) {
      const t = (tau - state.launchTau) / APPROACH_S;
      const dist = (1 - t) * m.R * 2.4;
      const px = impactPt[0] + state.nHat[0] * dist;
      const py = impactPt[1] + state.nHat[1] * dist;
      // trail
      sctx.save();
      sctx.strokeStyle = 'rgba(255,180,84,.5)'; sctx.lineWidth = 2;
      sctx.beginPath();
      sctx.moveTo(px, py);
      sctx.lineTo(px + state.nHat[0] * 120, py + state.nHat[1] * 120);
      sctx.stroke();
      sctx.restore();
      // probe: box + panels
      sctx.save();
      sctx.translate(px, py);
      sctx.rotate(Math.atan2(-state.nHat[1], -state.nHat[0]));
      sctx.fillStyle = '#e8edf4'; sctx.fillRect(-5, -4, 10, 8);
      sctx.fillStyle = '#3d6f8f';
      sctx.fillRect(-3, -16, 5, 12); sctx.fillRect(-3, 4, 5, 12);
      sctx.fillRect(-2.5, -13, 4, 26);
      sctx.restore();
      // SMART Nav lock brackets converge on the moonlet
      const lock = 46 - 24 * t;
      sctx.save();
      sctx.strokeStyle = '#ffb454'; sctx.lineWidth = 1.4;
      const bx = dx, by = dy, L = 9;
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        sctx.beginPath();
        sctx.moveTo(bx + sx * lock - sx * L, by + sy * lock);
        sctx.lineTo(bx + sx * lock, by + sy * lock);
        sctx.lineTo(bx + sx * lock, by + sy * lock - sy * L);
        sctx.stroke();
      }
      sctx.fillStyle = '#ffb454'; sctx.font = '11px ui-monospace, Menlo, monospace';
      sctx.fillText('SMART Nav lock', bx + lock + 6, by - lock - 4);
      sctx.restore();
      // impact countdown
      sctx.fillStyle = '#ffb454'; sctx.font = '12px ui-monospace, Menlo, monospace';
      sctx.fillText(`impact in ${Math.max(0, state.impactTau - tau).toFixed(1)} s`, m.w - 150, 26);
    }

    // flash + shock ring
    if (post) {
      const dt = tau - state.impactTau;
      if (dt < FLASH_S + 0.25) {
        const k = Math.min(1, dt / FLASH_S);
        sctx.save();
        sctx.globalAlpha = 1 - k;
        const rad = 12 + 130 * k;
        const g = sctx.createRadialGradient(dx, dy, 0, dx, dy, rad);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, '#ffcf87'); g.addColorStop(1, 'rgba(255,180,84,0)');
        sctx.fillStyle = g;
        sctx.beginPath(); sctx.arc(dx, dy, rad, 0, 2 * Math.PI); sctx.fill();
        sctx.restore();
      }
      if (dt < 1.4) {   // shock ring
        const k = dt / 1.4;
        sctx.save();
        sctx.globalAlpha = 0.55 * (1 - k);
        sctx.strokeStyle = '#ffd98a'; sctx.lineWidth = 1.6;
        sctx.beginPath(); sctx.arc(dx, dy, dimR + 10 + 170 * k * k, 0, 2 * Math.PI); sctx.stroke();
        sctx.restore();
      }
      // Δv arrow along the recoil, fading
      if (dt < 2.6) {
        const a = 1 - dt / 2.6;
        const [vx, vy] = state.vHat;
        sctx.save();
        sctx.globalAlpha = a;
        sctx.strokeStyle = '#ffb454'; sctx.fillStyle = '#ffb454'; sctx.lineWidth = 2.2;
        const ax = dx - vx * (dimR + 8), ay = dy - vy * (dimR + 8);
        const bx2 = ax - vx * 54, by2 = ay - vy * 54;
        sctx.beginPath(); sctx.moveTo(ax, ay); sctx.lineTo(bx2, by2); sctx.stroke();
        sctx.beginPath();
        sctx.moveTo(bx2 - vx * 8, by2 - vy * 8);
        sctx.lineTo(bx2 - vy * 4 - vx * 2, by2 + vx * 4 - vy * 2);
        sctx.lineTo(bx2 + vy * 4 - vx * 2, by2 - vx * 4 - vy * 2);
        sctx.closePath(); sctx.fill();
        sctx.font = '12px ui-monospace, Menlo, monospace';
        sctx.fillText(`Δv ${(state.result.dv * 1000).toFixed(2)} mm/s`, bx2 - vx * 20 - 26, by2 - vy * 20 - 8);
        sctx.restore();
      }

      // ejecta particles (closed-form positions: pure in τ)
      const k = 0.35;  // drag rate, 1/s
      for (const p of state.particles) {
        const age = dt - p.delay;
        if (age < 0 || age > p.life) continue;
        const f = (1 - Math.exp(-k * age)) / k;
        const x = impactPt[0] + p.vx * f;
        const y = impactPt[1] + p.vy * f;
        sctx.globalAlpha = (1 - age / p.life) * 0.85;
        sctx.fillStyle = p.tint;
        sctx.fillRect(x, y, p.size, p.size);
      }
      sctx.globalAlpha = 1;

      // LICIACube flyby
      const lt = (tau - state.impactTau - LICIACUBE_AT) / LICIACUBE_S;
      if (lt > 0 && lt < 1) {
        const fx = impactPt[0] - 260 + 520 * lt;
        const fy = impactPt[1] + 190 - 380 * lt;
        sctx.save();
        sctx.strokeStyle = 'rgba(140,226,170,.45)'; sctx.lineWidth = 1.4;
        sctx.setLineDash([4, 4]);
        sctx.beginPath();
        sctx.moveTo(impactPt[0] - 260, impactPt[1] + 190);
        sctx.lineTo(fx, fy); sctx.stroke();
        sctx.setLineDash([]);
        sctx.fillStyle = '#8ce2aa';
        sctx.fillRect(fx - 3, fy - 3, 6, 6);
        sctx.font = '11px ui-monospace, Menlo, monospace';
        sctx.fillText('LICIACube · flyby T+3 min', fx + 9, fy + 14);
        sctx.restore();
      }
    }

    // scale bar
    const barM = 500, barPx = barM * m.ppm;
    sctx.save();
    sctx.strokeStyle = '#8fa2b8'; sctx.fillStyle = '#8fa2b8'; sctx.lineWidth = 1.4;
    const bx0 = 18, by0 = m.h - 18;
    sctx.beginPath();
    sctx.moveTo(bx0, by0 - 5); sctx.lineTo(bx0, by0); sctx.lineTo(bx0 + barPx, by0); sctx.lineTo(bx0 + barPx, by0 - 5);
    sctx.stroke();
    sctx.font = '11px ui-monospace, Menlo, monospace';
    sctx.fillText(`${barM} m`, bx0 + barPx / 2 - 14, by0 - 8);
    sctx.restore();
  }

  // --- lightcurve ----------------------------------------------------------
  function drawLightcurve() {
    const w = lcCanvas.clientWidth, h = lcCanvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    if (lcCanvas.width !== Math.round(w * dpr)) {
      lcCanvas.width = Math.round(w * dpr); lcCanvas.height = Math.round(h * dpr);
    }
    lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lctx.clearRect(0, 0, w, h);
    const result = state.result || state.predicted;
    const DAYS = 4, T0 = C.T0, T1 = result.T;
    const padL = 44, padR = 12, padT = 12, padB = 22;
    const plotW = w - padL - padR, plotH = h - padT - padB;
    const xOf = (day) => padL + (day / DAYS) * plotW;
    const yOf = (flux) => padT + (1 - flux) * (plotH / 1.35);

    // axes + day ticks
    lctx.strokeStyle = '#1b2a3d'; lctx.lineWidth = 1;
    lctx.font = '10px ui-monospace, Menlo, monospace'; lctx.fillStyle = '#8fa2b8';
    for (let day = 0; day <= DAYS; day += 0.5) {
      const x = xOf(day);
      lctx.beginPath(); lctx.moveTo(x, padT); lctx.lineTo(x, padT + plotH); lctx.stroke();
      if (day % 1 === 0) lctx.fillText(day ? `d${day}` : 'impact', x - 8, h - 8);
    }
    lctx.fillStyle = '#5d6f85';
    lctx.fillText('flux', 8, padT + 8);

    const t0 = 0.35 * 86400;  // first predicted event, day 0.35
    const dip = (t, tk) => 0.10 * Math.exp(-(((t - tk) / 1400) ** 2));
    const trace = (period, stroke, dash) => {
      lctx.save();
      lctx.strokeStyle = stroke; lctx.lineWidth = 1.4; lctx.setLineDash(dash);
      lctx.beginPath();
      const tEnd = DAYS * 86400;
      const events = [];
      for (let k = 0; ; k++) {
        const tk = t0 + k * period;
        if (tk > tEnd + 4000) break;
        events.push(tk);
      }
      const step = (tEnd / plotW) * 2;
      for (let t = 0; t <= tEnd; t += step) {
        let flux = 1;
        for (const tk of events) flux -= dip(t, tk);
        const [x, y] = [xOf(t / 86400), yOf(flux)];
        if (t === 0) lctx.moveTo(x, y); else lctx.lineTo(x, y);
      }
      lctx.stroke();
      lctx.restore();
    };
    trace(T0, '#5d6f85', []);            // no-impact prediction
    trace(T1, state.result ? '#ffb454' : 'rgba(255,180,84,.55)', state.result ? [] : [4, 3]);

    // post-impact scanning read line, sweeping once
    if (state.result) {
      const sweep = Math.min(1, (state.tau - state.impactTau - 1.2) / 8);
      if (sweep > 0 && sweep < 1) {
        const x = xOf(sweep * DAYS);
        lctx.save();
        lctx.strokeStyle = '#7fd6e8'; lctx.globalAlpha = 0.7; lctx.setLineDash([3, 3]);
        lctx.beginPath(); lctx.moveTo(x, padT); lctx.lineTo(x, padT + plotH); lctx.stroke();
        lctx.restore();
      }
    }

    // legend
    lctx.font = '10.5px ui-monospace, Menlo, monospace';
    lctx.fillStyle = '#5d6f85'; lctx.fillText('— no impact (11.92 h)', padL + 6, padT + 10);
    lctx.fillStyle = state.result ? '#ffb454' : 'rgba(255,180,84,.7)';
    lctx.fillText(state.result ? '— after impact' : '— predicted after impact', padL + 6, padT + 23);
  }

  // --- stats ---------------------------------------------------------------
  const easeOut = (t) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);

  function updateStats() {
    const r = state.result || state.predicted;
    let k = 1;
    if (state.result) k = easeOut((state.tau - state.impactTau - 0.25) / 1.4);
    el.statMode.textContent = state.result ? 'measured' : 'predicted';
    el.dT.textContent = '−' + (Math.abs(r.dT) / 60 * k).toFixed(1);
    el.dv.textContent = (r.dv * 1000 * k).toFixed(2) + ' mm/s';
    el.tBefore.textContent = C.fmtHours(C.T0);
    el.tAfter.textContent = C.fmtHours(r.T);
    el.aNew.textContent = `${C.A0} → ${Math.round(r.a)} m`;
    el.ecc.textContent = `0 → ${(r.e).toFixed(3)}`;
    el.impulse.textContent = `${r.impulseRatio.toFixed(1)}× spacecraft momentum`;
    const ratio = Math.abs(r.dT) / C.GOAL * k;
    el.goalBar.style.width = Math.max(1.5, 100 / ratio) + '%';
    el.resultLbl.textContent = `${state.result ? 'result' : 'predicted'} ${Math.round(Math.abs(r.dT) * k)} s · ${ratio.toFixed(0)}× goal`;
    const driftH = C.driftHours(4, r.T);
    el.drift.textContent = `${state.result ? 'by day 4,' : 'predicted:'} mutual events ${driftH.toFixed(1)} h early`;
    el.lcFoot.innerHTML = `Dimorphos regularly blocks Didymos's light; each dip is a clock tick. ` +
      `With T = ${C.fmtHours(r.T).replace(' ', '&nbsp;')}, ticks land ` +
      `<b class="early">${driftH.toFixed(1)} h early by day 4</b> — that walk-out is how ` +
      `−33 min was measured from Earth.`;
  }

  function updateClock() {
    if (state.phase === 'aftermath') {
      const simSec = (state.tau - state.impactTau) * TIME_SCALE;
      el.clock.textContent = `${C.fmtClock(simSec, true)} · period ${C.fmtHours(state.result.T)}`;
    } else if (state.phase === 'approach') {
      el.clock.textContent = `terminal approach · ${(state.impactTau - state.tau).toFixed(1)} s to impact`;
    } else {
      el.clock.textContent = `orbiting · period ${C.fmtHours(C.T0)} · ×${TIME_SCALE}`;
    }
  }

  // --- choreography --------------------------------------------------------
  function launch() {
    if (state.phase !== 'idle') return;
    state.launchTau = state.tau;
    state.impactTau = state.tau + APPROACH_S;
    state.phiImpact = oldAngle(state.impactTau);
    // velocity unit at impact (screen coords, orbit runs clockwise on screen)
    const v = [-Math.sin(state.phiImpact), Math.cos(state.phiImpact)];
    const th = (state.theta * Math.PI) / 180;
    // incoming direction: head-on retrograde, rotated off-axis by θ
    const nv = [-v[0], -v[1]];
    state.nHat = [nv[0] * Math.cos(th) - nv[1] * Math.sin(th),
                  nv[0] * Math.sin(th) + nv[1] * Math.cos(th)];
    state.vHat = v;
    state.result = C.impact(state.beta, state.theta);
    state.phase = 'approach';
    // deterministic ejecta: seeded fresh per impact, biased down-orbit
    const rng = C.seededRng(20260926);
    const n = Math.round(110 + 78 * state.beta);
    state.particles = [];
    for (let i = 0; i < n; i++) {
      const gauss = (rng() + rng() + rng() - 1.5) / 1.5;
      const spread = gauss * 0.9;                       // rad around v̂
      const omni = rng() < 0.3 ? rng() * Math.PI * 2 : null;
      const ang = omni === null ? Math.atan2(v[1], v[0]) + spread : omni;
      const spd = (46 + 230 * Math.pow(rng(), 1.6)) * (0.55 + 0.45 * rng());
      state.particles.push({
        vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
        life: 3.5 + 5.5 * rng(), delay: rng() * 0.5,
        size: 1 + 1.8 * rng(),
        tint: rng() < 0.7 ? '#ffcf87' : '#e8edf4',
      });
    }
    el.launch.textContent = 'RESET';
    el.launch.classList.add('reset');
    el.craft.textContent = 'signal lost at impact +1 s — confirmed by Deep Space Network';
    updateStats(); drawLightcurve();
  }

  function reset() {
    state.phase = 'idle';
    state.result = null;
    state.particles = [];
    state.predicted = C.impact(state.beta, state.theta);
    el.launch.textContent = 'LAUNCH DART ▸';
    el.launch.classList.remove('reset');
    el.craft.textContent = 'DART · 570 kg · 6.14 km/s · SMART Nav locked';
    updateStats(); drawLightcurve();
  }

  function setSliders(beta, theta) {
    state.beta = beta; state.theta = theta;
    el.beta.value = beta; el.theta.value = theta;
    el.betaVal.textContent = beta.toFixed(2);
    el.thetaVal.textContent = theta + '°';
    state.predicted = C.impact(beta, theta);
    updateStats();
    if (!state.result) drawLightcurve();
  }

  // --- wiring --------------------------------------------------------------
  el.beta.addEventListener('input', () => {
    state.beta = parseFloat(el.beta.value);
    el.betaVal.textContent = state.beta.toFixed(2);
    state.predicted = C.impact(state.beta, state.theta);
    updateStats(); if (!state.result) drawLightcurve();
  });
  el.theta.addEventListener('input', () => {
    state.theta = parseInt(el.theta.value, 10);
    el.thetaVal.textContent = state.theta + '°';
    state.predicted = C.impact(state.beta, state.theta);
    updateStats(); if (!state.result) drawLightcurve();
  });
  el.exagg.addEventListener('change', () => { state.exaggerate = el.exagg.checked; });
  el.launch.addEventListener('click', () => (state.phase === 'idle' ? launch() : reset()));

  document.querySelectorAll('[data-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-preset]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const presets = { real: [3.61, 0], splat: [1.0, 0], glance: [3.61, 45] };
      const [beta, theta] = presets[btn.dataset.preset];
      if (state.phase !== 'idle') reset();
      setSliders(beta, theta);
    });
  });

  // --- clock ---------------------------------------------------------------
  let lastRaf = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - lastRaf) / 1000);
    lastRaf = now;
    if (state.autoplay) tick(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function tick(dt) {
    const prev = state.tau;
    state.tau += dt;
    if (state.phase === 'approach' && state.tau >= state.impactTau) {
      state.phase = 'aftermath';
    }
    updateClock();
    drawScene();
    if (state.result && (state.tau - state.impactTau) < 2.2) updateStats();
    if (state.result) {
      const sweepT = (state.tau - state.impactTau - 1.2) / 8;
      if (sweepT > 0 && sweepT < 1.05) drawLightcurve();
    }
  }

  window.dart = {
    setAutoplay(on) { state.autoplay = !!on; if (on) lastRaf = performance.now(); },
    tick,
    fastForward(seconds) {
      const end = state.tau + seconds;
      while (state.tau < end) tick(0.05);
    },
    apply(preset) {
      const map = { real: [3.61, 0], splat: [1, 0], glance: [3.61, 45] };
      if (!map[preset]) throw new Error('unknown preset ' + preset);
      if (state.phase !== 'idle') reset();
      setSliders(...map[preset]);
      document.querySelectorAll('[data-preset]').forEach((b) =>
        b.classList.toggle('active', b.dataset.preset === preset));
    },
    set(key, value) {
      if (key === 'beta') setSliders(value, state.theta);
      else if (key === 'theta') setSliders(state.beta, value);
      else if (key === 'exaggerate') { state.exaggerate = !!value; el.exagg.checked = !!value; }
      else throw new Error('unknown key ' + key);
    },
    launch,
    reset,
    getState() {
      const r = state.result || state.predicted;
      return {
        phase: state.phase, tau: state.tau, beta: state.beta, theta: state.theta,
        launched: !!state.result,
        stats: {
          dvMmS: r.dv * 1000, dTsec: r.dT, dTmin: r.dT / 60,
          tAfterS: r.T, aNewM: r.a, ecc: r.e, ratio: Math.abs(r.dT) / C.GOAL,
          driftH4d: C.driftHours(4, r.T),
        },
      };
    },
  };

  setSliders(3.61, 0);
  updateClock(); updateStats(); drawLightcurve();
})();
