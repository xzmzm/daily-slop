(function () {
  "use strict";
  const W = window.Wheel;
  const $ = (id) => document.getElementById(id);

  const RATE_MIN = 48, RATE_MAX = 360, SLOW = 1 / 120;
  const SCREEN_W = 800, SCREEN_H = 600;
  const BALL = { y: 352, r: 50, lo: 112, hi: 688 };

  const state = {
    rate: 144, scale: 1, playing: true, gaze: "fixed", speed: 720,
    source: "field", receiver: "color", t: 0, lastDt: 1 / 60,
  };
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) state.playing = false;

  // --- scene -----------------------------------------------------------------
  const BG = [0.05, 0.055, 0.11];
  const BARS = [[.92, .92, .92], [.92, .9, .1], [.1, .88, .9], [.1, .85, .15],
                [.88, .12, .85], [.9, .1, .1], [.12, .15, .92]];
  const CREAM = [0.96, 0.9, 0.74];
  const WHITE = [0.98, 0.98, 0.98];

  const ballX = (t) => W.bounce(t, state.speed, BALL.lo, BALL.hi);
  const eyeX = (t) => (state.gaze === "follow" ? ballX(t) : 0);

  // Draw the whole scene as it looked at sample time ts, in one channel
  // (c = 0/1/2) at the given gain, or as luminance when c is -1.
  function drawScene(ctx, c, gain, ts, shift) {
    const tone = (col) => {
      const v = c < 0 ? (0.3 * col[0] + 0.59 * col[1] + 0.11 * col[2]) : col[c];
      const n = Math.round(Math.min(1, v * gain) * 255);
      return c < 0 ? `rgb(${n},${n},${n})` : c === 0 ? `rgb(${n},0,0)` : c === 1 ? `rgb(0,${n},0)` : `rgb(0,0,${n})`;
    };
    ctx.fillStyle = tone(BG);
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    ctx.save();
    ctx.translate(shift, 0);
    const bw = 680 / BARS.length;
    BARS.forEach((col, i) => { ctx.fillStyle = tone(col); ctx.fillRect(60 + i * bw, 46, bw - 4, 112); });
    ctx.fillStyle = tone(CREAM);
    ctx.font = "700 46px Georgia, serif";
    ctx.textAlign = "center";
    ctx.fillText("CBS  COLOR", 400, 230);
    // checkered studio floor: hard vertical edges show breakup best
    for (let i = 0; i < 18; i++) for (let j = 0; j < 2; j++) {
      if ((i + j) % 2) continue;
      ctx.fillStyle = tone(WHITE);
      ctx.fillRect(40 + i * 40, 470 + j * 40, 40, 40);
    }
    ctx.fillStyle = tone(WHITE);
    ctx.beginPath();
    ctx.arc(ballX(ts), BALL.y, BALL.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // --- screen ----------------------------------------------------------------
  const tv = $("tv"), tctx = tv.getContext("2d");
  const buf = document.createElement("canvas");
  buf.width = SCREEN_W; buf.height = SCREEN_H;
  const bctx = buf.getContext("2d");

  // Picture: the latest red, green and blue fields, each placed where it hit
  // the retina. Flicker: the eye's low-pass response to the field sequence,
  // applied as a tint (≈ white at 144/s, one bare colour in slow motion).
  function renderColor(ctx, lumaOnly) {
    const t = state.t;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    ctx.globalCompositeOperation = "lighter";
    const eyeNow = eyeX(t);
    for (const f of W.triadWeights(t, state.rate)) {
      const ts = W.sampleTime(f.k, state.rate, state.source);
      // a B&W set has no disk: every field is grey
      drawScene(ctx, lumaOnly ? -1 : W.channelOf(f.k), lumaOnly ? f.w / 3 : f.w, ts, eyeNow - eyeX(f.mid));
    }
    if (!lumaOnly) {
      const tint = W.perceivedSteady([1, 1, 1], t, state.rate, W.EYE_TAU * state.scale);
      const top = Math.max(...tint);
      if (top > 1.005 || Math.min(...tint) < 0.995) {
        ctx.globalCompositeOperation = "multiply";
        ctx.fillStyle = `rgb(${tint.map((v) => Math.round(255 * v / top)).join(",")})`;
        ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
        // restore overall brightness: the eye sees the bare field at full strength
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = Math.min(1, Math.max(0, top - 1) / 2);
        ctx.drawImage(ctx.canvas, 0, 0, ctx.canvas.width, ctx.canvas.height, 0, 0, SCREEN_W, SCREEN_H);
        ctx.globalAlpha = 1;
      }
    }
    ctx.globalCompositeOperation = "source-over";
  }

  // An ordinary 525-line set sweeps 15,750 lines/s; CBS sends 29,160. Nothing
  // locks, so the picture tears diagonally and rolls.
  function renderBW() {
    renderColor(bctx, true);
    const t = state.t / state.scale;
    const ctx = tctx;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    const band = 3, ratio = W.lineRate(state.rate) / W.NTSC_BW.lineRate;
    const roll = (t * 230) % SCREEN_H;
    for (let y = 0; y < SCREEN_H; y += band) {
      const sy = (y * ratio + roll) % SCREEN_H;
      const off = ((y * 2.7 + t * 410) % SCREEN_W + SCREEN_W) % SCREEN_W;
      ctx.drawImage(buf, 0, sy, SCREEN_W, band, off - SCREEN_W, y, SCREEN_W, band);
      ctx.drawImage(buf, 0, sy, SCREEN_W, band, off, y, SCREEN_W, band);
    }
    ctx.fillStyle = "rgba(200,200,200,0.06)";
    for (let i = 0; i < 40; i++) ctx.fillRect(0, (i * 97 + t * 900) % SCREEN_H, SCREEN_W, 1);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(170, 262, 460, 76);
    ctx.fillStyle = "#e8e8e8";
    ctx.font = "600 22px ui-monospace, Menlo, monospace";
    ctx.textAlign = "center";
    ctx.fillText("NO LOCK", 400, 294);
    ctx.font = "15px ui-monospace, Menlo, monospace";
    ctx.fillText(`${W.lineRate(state.rate).toLocaleString("en-US")} lines/s sent · 15,750 expected`, 400, 322);
  }

  // --- disk ------------------------------------------------------------------
  const disk = $("disk"), dctx = disk.getContext("2d");
  const DISK_COLORS = ["#ff4a3d", "#3ee06c", "#4a7dff"];

  function drawDiskAt(u, alpha) {
    const cx = 84, cy = 88, R = 74;
    dctx.globalAlpha = alpha;
    for (let j = 0; j < 6; j++) {
      const a0 = -Math.PI / 2 + (j - u) * Math.PI / 3, a1 = a0 + Math.PI / 3;
      dctx.fillStyle = DISK_COLORS[j % 3];
      dctx.beginPath(); dctx.moveTo(cx, cy); dctx.arc(cx, cy, R, a0, a1); dctx.closePath(); dctx.fill();
    }
    dctx.globalAlpha = 1;
  }

  function renderDisk() {
    dctx.clearRect(0, 0, 168, 168);
    const u = state.t * state.rate;
    const sweep = state.playing ? state.rate * state.lastDt * state.scale : 0;
    dctx.globalCompositeOperation = "lighter";
    if (sweep > 0.4) {
      const n = Math.min(32, Math.ceil(sweep * 6));
      for (let i = 0; i < n; i++) drawDiskAt(u - (sweep * i) / n, 1 / n);
    } else drawDiskAt(u, 1);
    dctx.globalCompositeOperation = "source-over";
    dctx.fillStyle = "#120d09";
    dctx.beginPath(); dctx.arc(84, 88, 12, 0, Math.PI * 2); dctx.fill();
    // the tube sits behind the top of the disk
    dctx.strokeStyle = "#f3e7d0"; dctx.lineWidth = 2;
    dctx.strokeRect(70, 16, 28, 26);
    dctx.beginPath(); dctx.moveTo(84, 2); dctx.lineTo(78, 10); dctx.lineTo(90, 10); dctx.closePath();
    dctx.fillStyle = "#f3e7d0"; dctx.fill();
  }

  // --- readouts --------------------------------------------------------------
  function fringes() {
    const fw = W.fringeWidth(state.speed, state.rate);
    const follow = state.gaze === "follow", field = state.source === "field";
    // retina slip of each object, per field: the ball slips unless the eye
    // rides it; the set slips only when the eye moves.
    return { ball: follow !== field ? fw : 0, bg: follow ? fw : 0 };
  }

  function statusText() {
    if (state.receiver === "bw") return "A black-and-white set can't follow 405 lines × 144 fields. No picture at all — the reason the FCC reversed itself in 1953.";
    if (state.scale < 1) return `Slow motion: the eye slows too, so you see each bare field. Field ${W.CHANNELS[W.channelOf(W.fieldIndex(state.t, state.rate))].toUpperCase()} is lit; the tube shows only that colour's brightness.`;
    const f = fringes();
    if (state.speed === 0) return "Nothing moves, so every field lands in the same place and the colours fuse.";
    if (state.rate < 72) return `${Math.round(state.rate / 3)} RGB sets a second is too slow: the colours shimmer, and the edges break into ${W.fringeWidth(state.speed, state.rate).toFixed(0)} px rainbows.`;
    if (f.ball && f.bg) return "One frame split into three fields, eye on the ball: everything slips, everything fringes. This is the DLP rainbow.";
    if (f.ball) return "The camera shot red, green and blue at three moments. Hold your gaze and the ball's three colours land side by side.";
    if (f.bg) return "Your eye rides the ball, so its three fields line up — but now the still set slides across your retina, and every edge breaks.";
    return "One frame split three ways, gaze held still: no rainbows, but the ball jumps only once per RGB set.";
  }

  function updateReadouts() {
    $("o-rate").textContent = Math.round(state.rate);
    $("o-rpm").innerHTML = `${Math.round(W.rpm(state.rate))} <small>rpm</small>`;
    $("o-triads").innerHTML = `${(state.rate / 3).toFixed(state.rate % 3 ? 1 : 0)} <small>/s</small>`;
    const f = fringes();
    $("o-fball").innerHTML = `${f.ball.toFixed(1)} <small>px</small>`;
    $("o-fbg").innerHTML = `${f.bg.toFixed(1)} <small>px</small>`;
    $("rate-out").textContent = `${Math.round(state.rate)} /s`;
    $("speed-out").textContent = `${state.speed} px/s`;
    $("disk-label").textContent = `disk · ${Math.round(W.rpm(state.rate))} rpm${state.scale < 1 ? " ×1/120" : ""}`;
    $("status").textContent = statusText();
    document.querySelectorAll(".chips button").forEach((b) => b.classList.toggle("on", +b.dataset.rate === Math.round(state.rate)));
  }

  function render() {
    if (state.receiver === "bw") renderBW(); else renderColor(tctx, false);
    renderDisk();
    disk.style.opacity = state.receiver === "bw" ? 0.25 : 1;
    updateReadouts();
  }

  // --- controls --------------------------------------------------------------
  const rateToSlider = (r) => Math.round(1000 * Math.log(r / RATE_MIN) / Math.log(RATE_MAX / RATE_MIN));
  const sliderToRate = (v) => Math.round(RATE_MIN * Math.pow(RATE_MAX / RATE_MIN, v / 1000));
  function setRate(r) { state.rate = Math.max(RATE_MIN, Math.min(RATE_MAX, r)); $("rate").value = rateToSlider(state.rate); render(); }
  $("rate").addEventListener("input", (e) => { state.rate = sliderToRate(+e.target.value); render(); });
  document.querySelectorAll(".chips button").forEach((b) => b.addEventListener("click", () => setRate(+b.dataset.rate)));
  $("speed").addEventListener("input", (e) => { state.speed = +e.target.value; render(); });

  function seg(ids, apply) {
    ids.forEach((id) => $(id).addEventListener("click", () => {
      ids.forEach((other) => $(other).setAttribute("aria-pressed", String(other === id)));
      apply(id); render();
    }));
  }
  seg(["speed-1", "speed-slow"], (id) => { state.scale = id === "speed-1" ? 1 : SLOW; });
  seg(["gaze-fixed", "gaze-follow"], (id) => { state.gaze = id === "gaze-fixed" ? "fixed" : "follow"; });
  seg(["source-field", "source-frame"], (id) => { state.source = id === "source-field" ? "field" : "frame"; });
  seg(["set-color", "set-bw"], (id) => { state.receiver = id === "set-color" ? "color" : "bw"; });
  function syncPlay() { $("play").textContent = state.playing ? "Pause" : "Play"; $("play").setAttribute("aria-label", $("play").textContent); }
  $("play").addEventListener("click", () => { state.playing = !state.playing; syncPlay(); render(); });

  // --- loop ------------------------------------------------------------------
  function pump(dt) {
    state.lastDt = dt;
    if (state.playing) state.t += dt * state.scale;
    render();
  }
  let last = null, external = false;
  function frame(now) {
    if (!external) {
      const dt = last == null ? 1 / 60 : Math.min(0.1, (now - last) / 1000);
      pump(dt);
    }
    last = now;
    requestAnimationFrame(frame);
  }

  setRate(144);
  syncPlay();
  requestAnimationFrame(frame);

  // Hook for the headless video recorder: it drives time itself.
  window.rainbowBreak = {
    pump(dt) { external = true; pump(dt); },
    getState: () => ({ ...state, fringes: fringes(), field: W.channelOf(W.fieldIndex(state.t, state.rate)) }),
  };
})();
