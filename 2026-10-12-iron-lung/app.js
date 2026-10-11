// Iron Lung UI: draw the tank, run the lung model, read out the blood gases.
(function () {
  "use strict";
  const L = window.Lung;
  const $ = (id) => document.getElementById(id);
  const scene = $("scene").getContext("2d");
  const trace = $("trace").getContext("2d");

  const ctl = { motor: false, amp: 12, rate: 20, strength: 0.1, hand: false };
  let sim, history, sampleClock, external = false;

  function reset() {
    sim = L.create();
    history = [];
    sampleClock = 0;
  }
  reset();

  // ---------- controls ----------
  function setMotor(on) {
    ctl.motor = on;
    if (on) setHand(false);
    $("motor-on").setAttribute("aria-pressed", on);
    $("motor-off").setAttribute("aria-pressed", !on);
    $("hand").disabled = on;
  }
  function setHand(down) {
    ctl.hand = down && !ctl.motor;
    $("hand").classList.toggle("down", ctl.hand);
  }
  function setAmp(v) { ctl.amp = +v; $("amp").value = v; syncLabels(); }
  function setRate(v) { ctl.rate = +v; $("rate").value = v; syncLabels(); }
  function setStrength(v) { ctl.strength = v / 100; $("strength").value = v; syncLabels(); }
  function syncLabels() {
    $("amp-out").textContent = `${ctl.amp} cmH₂O`;
    $("rate-out").textContent = `${ctl.rate} /min`;
    $("strength-out").textContent = `${Math.round(ctl.strength * 100)}%`;
    document.querySelectorAll("[data-amp]").forEach((b) => b.classList.toggle("on", +b.dataset.amp === ctl.amp));
    document.querySelectorAll("[data-rate]").forEach((b) => b.classList.toggle("on", +b.dataset.rate === ctl.rate));
  }
  $("motor-on").onclick = () => setMotor(true);
  $("motor-off").onclick = () => setMotor(false);
  $("amp").oninput = (e) => setAmp(e.target.value);
  $("rate").oninput = (e) => setRate(e.target.value);
  $("strength").oninput = (e) => setStrength(e.target.value);
  document.querySelectorAll("[data-amp]").forEach((b) => (b.onclick = () => setAmp(b.dataset.amp)));
  document.querySelectorAll("[data-rate]").forEach((b) => (b.onclick = () => setRate(b.dataset.rate)));
  $("reset").onclick = () => { reset(); setMotor(false); setStrength(10); };
  const hand = $("hand");
  hand.addEventListener("pointerdown", (e) => { hand.setPointerCapture(e.pointerId); setHand(true); });
  ["pointerup", "pointercancel", "lostpointercapture"].forEach((ev) => hand.addEventListener(ev, () => setHand(false)));
  addEventListener("keydown", (e) => {
    if (e.code !== "Space" || e.target.tagName === "INPUT") return;
    e.preventDefault();
    if (!e.repeat) setHand(true);
  });
  addEventListener("keyup", (e) => { if (e.code === "Space") setHand(false); });
  addEventListener("blur", () => setHand(false));
  setMotor(false);
  syncLabels();

  // ---------- drawing ----------
  const mix = (a, b, u) => a.map((x, i) => Math.round(x + (b[i] - x) * u));
  const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  function drawScene() {
    const g = scene, W = 960, H = 420;
    g.clearRect(0, 0, W, H);
    // ward wall and floor
    g.fillStyle = "#d9d3bf"; g.fillRect(0, 0, W, H);
    g.fillStyle = "#c7d3c6"; g.fillRect(0, 0, W, 250);
    g.fillStyle = "#b9c5b7"; g.fillRect(0, 246, W, 6);
    g.fillStyle = "#cfc6ae"; g.fillRect(0, 372, W, 48);

    const sat = L.saturation(sim.pao2);
    const cyan = clamp((96 - sat) / 36, 0, 1);
    const tx = 270, ty = 120, tw = 620, th = 180;

    // legs
    g.fillStyle = "#4b5354";
    [[tx + 40, 300], [tx + tw - 60, 300]].forEach(([x, y]) => g.fillRect(x, y, 14, 76));
    g.fillRect(tx + 30, 368, tw - 60, 8);

    // bellows under the foot end: extends as the tank pressure drops
    const pull = clamp(-sim.Ptank / 30, 0, 1);
    const bx = tx + tw - 230, bw = 150, btop = 300, bh = 22 + pull * 46;
    g.fillStyle = "#3b3330";
    const pleats = 6;
    g.beginPath();
    g.moveTo(bx, btop);
    for (let i = 0; i <= pleats; i++) {
      const y = btop + (bh * i) / pleats, inset = i % 2 ? 10 : 0;
      g.lineTo(bx + inset, y);
    }
    for (let i = pleats; i >= 0; i--) {
      const y = btop + (bh * i) / pleats, inset = i % 2 ? 10 : 0;
      g.lineTo(bx + bw - inset, y);
    }
    g.closePath(); g.fill();
    g.fillStyle = "#62584f"; g.fillRect(bx - 6, btop + bh, bw + 12, 8);
    // hand lever (only matters when the motor is off)
    const lever = ctl.motor ? 0 : pull;
    g.save();
    g.translate(bx + bw + 8, btop + bh + 4);
    g.rotate(-0.9 + lever * 0.75);
    g.fillStyle = ctl.motor ? "#8b8f88" : "#a3392a";
    g.fillRect(0, -4, 70, 8);
    g.beginPath(); g.arc(72, 0, 8, 0, Math.PI * 2); g.fill();
    g.restore();
    // motor box
    g.fillStyle = "#56605f"; g.fillRect(tx + 80, 312, 110, 50);
    g.fillStyle = ctl.motor ? "#9be3a7" : "#4a4a44";
    g.beginPath(); g.arc(tx + 172, 326, 5, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#e5e1d3"; g.font = "600 11px ui-monospace, Menlo, monospace";
    g.fillText(ctl.motor ? "MOTOR ON" : "MOTOR OFF", tx + 92, 352);

    // tank body
    const grd = g.createLinearGradient(0, ty, 0, ty + th);
    grd.addColorStop(0, "#c2c9c9"); grd.addColorStop(0.35, "#eef1ef");
    grd.addColorStop(0.7, "#9aa4a5"); grd.addColorStop(1, "#6f797b");
    g.fillStyle = grd;
    g.beginPath(); g.roundRect(tx, ty, tw, th, 40); g.fill();
    g.strokeStyle = "#596264"; g.lineWidth = 2; g.stroke();
    // seams and rivets
    g.fillStyle = "#6d7779";
    [tx + 170, tx + 360, tx + 540].forEach((x) => {
      g.fillRect(x, ty + 2, 3, th - 4);
      for (let y = ty + 14; y < ty + th - 8; y += 18) { g.beginPath(); g.arc(x + 9, y, 2.2, 0, Math.PI * 2); g.fill(); }
    });

    // inspection window with the body inside
    const wx = tx + 40, wy = ty + 34, ww = tw - 90, wh = 96;
    g.save();
    g.beginPath(); g.roundRect(wx, wy, ww, wh, 18); g.clip();
    g.fillStyle = "#2a3532"; g.fillRect(wx, wy, ww, wh);
    // mattress
    g.fillStyle = "#e8e2cf"; g.fillRect(wx, wy + wh - 22, ww, 22);
    // body under a sheet: chest rises with lung volume
    const rise = clamp(sim.V / 0.3, -0.1, 1.3) * 30;
    const base = wy + wh - 22;
    g.fillStyle = "#f2efe6";
    g.beginPath();
    g.moveTo(wx, base - 30 - rise * 0.6);
    g.bezierCurveTo(wx + 50, base - 40 - rise, wx + 130, base - 44 - rise, wx + 190, base - 32 - rise * 0.7);
    g.bezierCurveTo(wx + 250, base - 26 - rise * 0.4, wx + 300, base - 26, wx + 360, base - 22);
    g.bezierCurveTo(wx + 420, base - 26, wx + 460, base - 14, ww + wx, base - 12);
    g.lineTo(ww + wx, base); g.lineTo(wx, base); g.closePath(); g.fill();
    g.strokeStyle = "#cfc8b4"; g.lineWidth = 1.5; g.stroke();
    g.restore();
    g.strokeStyle = "#3f4849"; g.lineWidth = 4;
    g.beginPath(); g.roundRect(wx, wy, ww, wh, 18); g.stroke();
    g.fillStyle = "#ffffff55";
    g.fillRect(wx + 30, wy + 8, 120, 5);

    // end plate and rubber collar
    g.fillStyle = "#5c6567"; g.beginPath(); g.roundRect(tx - 14, ty - 6, 30, th + 12, 10); g.fill();
    // head rest
    g.fillStyle = "#8a6b4e"; g.fillRect(70, ty + 112, tx - 84, 12);
    g.fillStyle = "#4b5354"; g.fillRect(96, ty + 124, 10, 132);
    g.fillStyle = "#f4f1e8"; g.beginPath(); g.ellipse(170, ty + 104, 80, 16, 0, 0, Math.PI * 2); g.fill();
    // neck and collar
    const skin = mix([235, 186, 160], [150, 168, 196], cyan);
    g.fillStyle = rgb(mix(skin, [0, 0, 0], 0.08)); g.fillRect(212, ty + 66, 50, 30);
    g.fillStyle = "#2c2a28"; g.beginPath(); g.roundRect(240, ty + 56, 24, 50, 8); g.fill();
    // head
    const hx = 182, hy = ty + 72;
    g.fillStyle = rgb(skin);
    g.beginPath(); g.ellipse(hx, hy, 44, 38, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#6b4a33";
    g.beginPath(); g.ellipse(hx - 16, hy - 8, 34, 34, -0.3, Math.PI * 0.75, Math.PI * 1.85); g.fill();
    g.beginPath(); g.ellipse(hx - 30, hy + 4, 18, 30, 0, 0, Math.PI * 2); g.fill();
    // face, looking up
    g.strokeStyle = "#5a3f2e"; g.lineWidth = 2;
    const eyesOpen = sat > 90;
    g.beginPath();
    if (eyesOpen) { g.arc(hx + 18, hy - 14, 3, 0, Math.PI * 2); }
    else { g.moveTo(hx + 13, hy - 14); g.quadraticCurveTo(hx + 18, hy - 11, hx + 23, hy - 14); }
    g.stroke();
    g.beginPath(); g.moveTo(hx + 40, hy - 8); g.lineTo(hx + 47, hy + 2); g.lineTo(hx + 41, hy + 4); g.stroke();
    const lip = rgb(mix([190, 90, 90], [110, 120, 170], cyan));
    g.strokeStyle = lip; g.lineWidth = 3;
    const mouth = clamp(sim.flow * 12, -1, 1);
    g.beginPath(); g.moveTo(hx + 30, hy + 16); g.quadraticCurveTo(hx + 36, hy + 18 + Math.abs(mouth) * 2, hx + 40, hy + 15); g.stroke();
    // air at the nose: blue arrows in, grey out
    const f = sim.flow;
    if (Math.abs(f) > 0.04) {
      g.strokeStyle = f > 0 ? "#3d7fbf" : "#9aa0a0"; g.lineWidth = 2.5;
      const n = Math.min(3, Math.ceil(Math.abs(f) / 0.15));
      for (let i = 0; i < n; i++) {
        const y = hy - 20 - i * 9, x0 = hx + 58, x1 = hx + 92;
        g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke();
        const tip = f > 0 ? x0 : x1, dir = f > 0 ? 1 : -1;
        g.beginPath(); g.moveTo(tip, y); g.lineTo(tip + 6 * dir, y - 4); g.moveTo(tip, y); g.lineTo(tip + 6 * dir, y + 4); g.stroke();
      }
    }

    // pressure gauge on a pipe
    const gx = tx + 470, gy = 60, gr = 50;
    g.fillStyle = "#5c6567"; g.fillRect(gx - 5, gy + gr - 4, 10, ty - gy - gr + 8);
    g.fillStyle = "#3f4849"; g.beginPath(); g.arc(gx, gy, gr + 5, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#f6f2e6"; g.beginPath(); g.arc(gx, gy, gr, 0, Math.PI * 2); g.fill();
    const ang = (p) => Math.PI * (5 / 6 + (4 / 3) * (p + 30) / 40); // -30..+10 cmH2O
    g.strokeStyle = "#22302b"; g.fillStyle = "#22302b"; g.lineWidth = 1.5;
    g.font = "600 9px ui-monospace, Menlo, monospace"; g.textAlign = "center"; g.textBaseline = "middle";
    for (let p = -30; p <= 10; p += 5) {
      const a = ang(p), r0 = p % 10 ? gr - 7 : gr - 11;
      g.beginPath(); g.moveTo(gx + Math.cos(a) * r0, gy + Math.sin(a) * r0);
      g.lineTo(gx + Math.cos(a) * (gr - 2), gy + Math.sin(a) * (gr - 2)); g.stroke();
      if (p % 10 === 0) g.fillText(p, gx + Math.cos(a) * (gr - 21), gy + Math.sin(a) * (gr - 21));
    }
    g.fillText("cmH₂O", gx, gy + 32);
    const a = ang(clamp(sim.Ptank, -30, 10));
    g.strokeStyle = "#a3392a"; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(gx, gy); g.lineTo(gx + Math.cos(a) * (gr - 8), gy + Math.sin(a) * (gr - 8)); g.stroke();
    g.fillStyle = "#22302b"; g.beginPath(); g.arc(gx, gy, 4, 0, Math.PI * 2); g.fill();
    g.textAlign = "left"; g.textBaseline = "alphabetic";
    g.font = "600 13px ui-monospace, Menlo, monospace"; g.fillStyle = "#22302b";
    g.fillText(`tank ${sim.Ptank > -0.5 ? "0" : sim.Ptank.toFixed(0)} cmH₂O`, gx + 66, gy + 6);
  }

  function drawTrace() {
    const g = trace, W = 960, H = 170, span = 15;
    g.fillStyle = "#1f2a26"; g.fillRect(0, 0, W, H);
    g.strokeStyle = "#ffffff14"; g.lineWidth = 1;
    for (let s = 0; s <= span; s++) {
      const x = W - (s / span) * W;
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke();
    }
    const mid = 100;
    g.beginPath(); g.moveTo(0, mid); g.lineTo(W, mid); g.stroke();
    const t1 = sim.t;
    const plot = (key, y0, scale, color) => {
      g.strokeStyle = color; g.lineWidth = 2; g.beginPath();
      let first = true;
      for (const h of history) {
        const x = W - ((t1 - h.t) / span) * W;
        const y = y0 - h[key] * scale;
        if (first) { g.moveTo(x, y); first = false; } else g.lineTo(x, y);
      }
      g.stroke();
    };
    plot("p", 30, 2.2, "#f0a35a");     // tank pressure: down = below room pressure
    plot("v", 160, 180, "#7fc8f8");    // lung volume above resting, L
    g.font = "600 12px ui-monospace, Menlo, monospace";
    g.fillStyle = "#f0a35a"; g.fillText("tank pressure (down = below room)", 10, 18);
    g.fillStyle = "#7fc8f8"; g.fillText("air in the lungs (lower trace)", 290, 18);
    g.fillStyle = "#ffffff66"; g.textAlign = "right"; g.fillText("last 15 s", W - 10, 18); g.textAlign = "left";
  }

  // ---------- readouts ----------
  function readouts() {
    const sat = L.saturation(sim.pao2), co2 = sim.paco2;
    const rr = L.breathRate(sim), vt = rr ? sim.lastVt : 0, ve = vt * rr;
    const va = Math.max(0, vt - sim.p.VD) * rr;
    const cls = (bad, warn) => (bad ? "bad" : warn ? "warn" : "ok");
    $("o-sat").innerHTML = `${sat.toFixed(0)}<small>%</small>`;
    $("o-sat").className = "v " + cls(sat < 85, sat < 93);
    $("o-co2").innerHTML = `${co2.toFixed(0)}<small> mmHg</small>`;
    $("o-co2").className = "v " + cls(co2 > 65, co2 > 50 || co2 < 30);
    $("o-vt").innerHTML = rr ? `${Math.round(vt * 1000)}<small> mL</small>` : "—";
    $("o-rr").innerHTML = rr ? `${rr.toFixed(0)}<small> /min</small>` : "none";
    $("o-ve").innerHTML = `${ve.toFixed(1)}<small> L/min</small>`;
    $("o-va").innerHTML = `${va.toFixed(1)}<small> L/min</small>`;
    const v = L.verdict(sim);
    const vEl = $("verdict");
    vEl.textContent = { failing: "respiratory failure", struggling: "not enough air", overbreathed: "over-breathed", breathing: "breathing well" }[v];
    vEl.className = { failing: "bad", struggling: "warn", overbreathed: "warn", breathing: "ok" }[v];
    $("status").textContent = statusLine(v, vt, rr, sat, co2);
    return { sat, co2, rr, vt, ve, va, verdict: v };
  }

  function statusLine(v, vt, rr, sat, co2) {
    const ml = Math.round(vt * 1000);
    if (!ctl.motor && !rr && ctl.strength < 0.3)
      return ctl.hand
        ? "Keep holding for about a second, then let go so the chest can fall back. Aim for about 20 pulls a minute."
        : "The pump is still. Polio has left the child's breathing muscles too weak to fill the lungs, so CO₂ builds up and oxygen falls.";
    if (v === "failing" && rr && vt < 0.1)
      return `${rr.toFixed(0)} breaths a minute of ${ml} mL each, but the first 50 mL of every breath only fills the nose and windpipe. Too little reaches the lungs.`;
    if (v === "failing" || v === "struggling")
      return `Each breath brings in ${ml || 0} mL, but the lungs are not getting enough fresh air. CO₂ is ${co2.toFixed(0)} mmHg and ${L.paco2Target(sim.va) > co2 ? "rising" : "falling"}.`;
    if (v === "overbreathed")
      return `More air than the child needs: CO₂ has fallen to ${co2.toFixed(0)} mmHg. Pull less hard or slow the pump.`;
    if (!ctl.motor) return `Hand pumping: ${rr.toFixed(0)} breaths a minute of ${ml} mL. Don't stop.`;
    return `Every time the tank pulls down to −${ctl.amp} cmH₂O, room air flows in through the nose: ${ml} mL a breath, ${rr.toFixed(0)} a minute.`;
  }

  // ---------- loop ----------
  let latest = readouts();
  function pump(dt) {
    L.step(sim, dt, ctl);
    sampleClock += dt;
    if (sampleClock >= 1 / 30) {
      sampleClock = 0;
      history.push({ t: sim.t, p: sim.Ptank, v: sim.V });
      while (history.length && history[0].t < sim.t - 15.5) history.shift();
    }
    drawScene();
    drawTrace();
    latest = readouts();
  }
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!external) pump(dt);
    requestAnimationFrame(frame);
  }
  pump(0);
  requestAnimationFrame(frame);

  window.ironLung = {
    pump(dt) { external = true; pump(dt); },
    hand: setHand,
    getState: () => ({ ...ctl, ...latest, t: sim.t, Ptank: sim.Ptank, V: sim.V }),
  };
})();
