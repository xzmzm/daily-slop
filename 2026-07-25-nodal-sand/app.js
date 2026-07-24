/**
 * Nodal Sand — interactive Chladni plate simulator.
 * Particles get kicks proportional to standing-wave amplitude, so they
 * migrate away from antinodes and pool on the quiet nodal lines.
 */
(() => {
  const canvas = document.getElementById("plate");
  const ctx = canvas.getContext("2d", { alpha: false });
  const W = canvas.width;
  const H = canvas.height;

  // Offscreen field (rebuilt only when modes change)
  const field = document.createElement("canvas");
  field.width = W;
  field.height = H;
  const fctx = field.getContext("2d", { alpha: false });

  const el = {
    modeN: document.getElementById("modeN"),
    modeM: document.getElementById("modeM"),
    modeNOut: document.getElementById("modeNOut"),
    modeMOut: document.getElementById("modeMOut"),
    drive: document.getElementById("drive"),
    driveOut: document.getElementById("driveOut"),
    damping: document.getElementById("damping"),
    dampingOut: document.getElementById("dampingOut"),
    meta: document.getElementById("meta"),
    reshuffle: document.getElementById("reshuffle"),
    scatter: document.getElementById("scatter"),
    preset: document.getElementById("preset"),
    audio: document.getElementById("audio"),
  };

  const PARTICLE_COUNT = 10000;
  const BASE_FREQ = 55; // Hz for mode (1,1)

  /** @type {Float32Array} positions: [x0,y0,x1,y1,...] */
  const pos = new Float32Array(PARTICLE_COUNT * 2);
  /** @type {Float32Array} velocities */
  const vel = new Float32Array(PARTICLE_COUNT * 2);

  let n = 2;
  let m = 3;
  let drive = 0.55;
  let damp = 0.72;
  let soundOn = false;
  let fieldDirty = true;

  // --- Audio (lazy, needs user gesture) ---
  let audioCtx = null;
  let oscillator = null;
  let gainNode = null;

  function ensureAudio() {
    if (audioCtx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audioCtx = new AC();
    gainNode = audioCtx.createGain();
    gainNode.gain.value = 0;
    gainNode.connect(audioCtx.destination);
    oscillator = audioCtx.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.value = frequencyHz();
    oscillator.connect(gainNode);
    oscillator.start();
  }

  function frequencyHz() {
    // Ideal square membrane: f ∝ √(n² + m²)
    return BASE_FREQ * Math.sqrt(n * n + m * m);
  }

  function syncAudio() {
    if (!oscillator || !gainNode || !audioCtx) return;
    const f = frequencyHz();
    oscillator.frequency.setTargetAtTime(f, audioCtx.currentTime, 0.04);
    const target = soundOn ? 0.045 * (0.4 + drive * 0.6) : 0;
    gainNode.gain.setTargetAtTime(target, audioCtx.currentTime, 0.05);
  }

  // --- Particles ---
  function spawnParticles(mode = "uniform") {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      let x;
      let y;
      if (mode === "center") {
        const a = Math.random() * Math.PI * 2;
        const r = Math.pow(Math.random(), 0.55) * Math.min(W, H) * 0.28;
        x = W * 0.5 + Math.cos(a) * r;
        y = H * 0.5 + Math.sin(a) * r;
      } else if (mode === "ring") {
        const a = Math.random() * Math.PI * 2;
        const r = Math.min(W, H) * (0.22 + Math.random() * 0.18);
        x = W * 0.5 + Math.cos(a) * r;
        y = H * 0.5 + Math.sin(a) * r;
      } else {
        x = Math.random() * W;
        y = Math.random() * H;
      }
      pos[i * 2] = x;
      pos[i * 2 + 1] = y;
      vel[i * 2] = 0;
      vel[i * 2 + 1] = 0;
    }
  }

  function scatterBurst() {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      vel[i * 2] += (Math.random() - 0.5) * 8;
      vel[i * 2 + 1] += (Math.random() - 0.5) * 8;
    }
  }

  // Brush: push sand while dragging
  let brushing = false;

  function canvasPoint(evt) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const src = evt.touches ? evt.touches[0] : evt;
    return {
      x: (src.clientX - rect.left) * scaleX,
      y: (src.clientY - rect.top) * scaleY,
    };
  }

  function brush(x, y) {
    const r = 52;
    const r2 = r * r;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const px = pos[i * 2];
      const py = pos[i * 2 + 1];
      const dx = px - x;
      const dy = py - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < r2 && d2 > 0.5) {
        const d = Math.sqrt(d2);
        const f = ((r - d) / r) * 2.0;
        vel[i * 2] += (dx / d) * f;
        vel[i * 2 + 1] += (dy / d) * f;
      }
    }
  }

  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    brushing = true;
    const pt = canvasPoint(e);
    brush(pt.x, pt.y);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!brushing) return;
    const pt = canvasPoint(e);
    brush(pt.x, pt.y);
  });
  const endBrush = () => {
    brushing = false;
  };
  canvas.addEventListener("pointerup", endBrush);
  canvas.addEventListener("pointercancel", endBrush);

  // --- Physics step ---
  function step() {
    const kick = 2.8 * drive;
    const friction = 0.86 + damp * 0.12; // 0.86..0.98
    const margin = 2;
    const invW = Math.PI / W;
    const invH = Math.PI / H;
    const nPi = n * invW;
    const mPi = m * invH;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      let x = pos[i * 2];
      let y = pos[i * 2 + 1];
      let vx = vel[i * 2];
      let vy = vel[i * 2 + 1];

      const A = Math.sin(nPi * (x + 0.5)) * Math.sin(mPi * (y + 0.5));
      const mag = A < 0 ? -A : A;
      if (mag > 0.02) {
        const ang = Math.random() * Math.PI * 2;
        const strength = kick * mag * mag;
        vx += Math.cos(ang) * strength;
        vy += Math.sin(ang) * strength;
      }

      vx *= friction;
      vy *= friction;
      x += vx;
      y += vy;

      if (x < margin) {
        x = margin;
        vx = vx < 0 ? -vx * 0.4 : vx * 0.4;
      } else if (x > W - margin) {
        x = W - margin;
        vx = vx > 0 ? -vx * 0.4 : vx * 0.4;
      }
      if (y < margin) {
        y = margin;
        vy = vy < 0 ? -vy * 0.4 : vy * 0.4;
      } else if (y > H - margin) {
        y = H - margin;
        vy = vy > 0 ? -vy * 0.4 : vy * 0.4;
      }

      pos[i * 2] = x;
      pos[i * 2 + 1] = y;
      vel[i * 2] = vx;
      vel[i * 2 + 1] = vy;
    }
  }

  // --- Field backdrop ---
  function rebuildField() {
    const img = fctx.createImageData(W, H);
    const data = img.data;
    const cell = 4;
    const nPi = (n * Math.PI) / W;
    const mPi = (m * Math.PI) / H;

    for (let y = 0; y < H; y += cell) {
      for (let x = 0; x < W; x += cell) {
        const A = Math.abs(Math.sin(nPi * (x + 0.5)) * Math.sin(mPi * (y + 0.5)));
        const g = (14 + A * 32) | 0;
        const b = (22 + A * 55) | 0;
        for (let dy = 0; dy < cell && y + dy < H; dy++) {
          for (let dx = 0; dx < cell && x + dx < W; dx++) {
            const i = ((y + dy) * W + (x + dx)) * 4;
            data[i] = 10;
            data[i + 1] = g;
            data[i + 2] = b;
            data[i + 3] = 255;
          }
        }
      }
    }
    fctx.putImageData(img, 0, 0);

    // Vignette
    const grad = fctx.createRadialGradient(
      W * 0.5,
      H * 0.5,
      W * 0.18,
      W * 0.5,
      H * 0.5,
      W * 0.72
    );
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.5)");
    fctx.fillStyle = grad;
    fctx.fillRect(0, 0, W, H);

    // Rim
    fctx.strokeStyle = "rgba(240, 198, 116, 0.2)";
    fctx.lineWidth = 3;
    fctx.strokeRect(5, 5, W - 10, H - 10);

    // Faint nodal guide lines (zero contours approx via grid)
    fctx.strokeStyle = "rgba(240, 198, 116, 0.06)";
    fctx.lineWidth = 1;
    for (let k = 1; k < n; k++) {
      const x = (k / n) * W;
      fctx.beginPath();
      fctx.moveTo(x, 0);
      fctx.lineTo(x, H);
      fctx.stroke();
    }
    for (let k = 1; k < m; k++) {
      const y = (k / m) * H;
      fctx.beginPath();
      fctx.moveTo(0, y);
      fctx.lineTo(W, y);
      fctx.stroke();
    }

    fieldDirty = false;
  }

  function drawSand() {
    // Gold grains
    ctx.fillStyle = "rgba(232, 196, 110, 0.85)";
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const x = pos[i * 2];
      const y = pos[i * 2 + 1];
      ctx.fillRect(x, y, 1.2, 1.2);
    }
    // Sparse brighter highlights
    ctx.fillStyle = "rgba(255, 236, 180, 0.7)";
    for (let i = 0; i < PARTICLE_COUNT; i += 9) {
      ctx.fillRect(pos[i * 2], pos[i * 2 + 1], 1, 1);
    }
  }

  function updateMeta() {
    el.meta.textContent = `mode (${n}, ${m}) · ${frequencyHz().toFixed(0)} Hz`;
  }

  function frame() {
    step();
    if (fieldDirty) rebuildField();
    ctx.drawImage(field, 0, 0);
    drawSand();
    requestAnimationFrame(frame);
  }

  // --- Controls ---
  const presets = [
    [1, 1],
    [1, 2],
    [2, 2],
    [2, 3],
    [3, 3],
    [1, 4],
    [3, 4],
    [4, 5],
    [2, 5],
    [5, 5],
    [3, 1],
    [4, 2],
  ];
  let presetIdx = 3;

  function readSliders() {
    n = Number(el.modeN.value);
    m = Number(el.modeM.value);
    drive = Number(el.drive.value) / 100;
    damp = Number(el.damping.value) / 100;
    el.modeNOut.textContent = String(n);
    el.modeMOut.textContent = String(m);
    el.driveOut.textContent = el.drive.value;
    el.dampingOut.textContent = el.damping.value;
    updateMeta();
    syncAudio();
    fieldDirty = true;
  }

  for (const id of ["modeN", "modeM", "drive", "damping"]) {
    el[id].addEventListener("input", readSliders);
  }

  el.reshuffle.addEventListener("click", () => {
    const modes = ["uniform", "center", "ring"];
    spawnParticles(modes[(Math.random() * modes.length) | 0]);
  });

  el.scatter.addEventListener("click", scatterBurst);

  el.preset.addEventListener("click", () => {
    presetIdx = (presetIdx + 1) % presets.length;
    const [pn, pm] = presets[presetIdx];
    el.modeN.value = String(pn);
    el.modeM.value = String(pm);
    readSliders();
  });

  el.audio.addEventListener("click", async () => {
    ensureAudio();
    if (audioCtx?.state === "suspended") {
      await audioCtx.resume();
    }
    soundOn = !soundOn;
    el.audio.setAttribute("aria-pressed", soundOn ? "true" : "false");
    el.audio.textContent = soundOn ? "♪ Sound on" : "♪ Sound off";
    syncAudio();
  });

  window.addEventListener("keydown", (e) => {
    if (e.target.matches("input, textarea, button")) return;
    if (e.code === "Space") {
      e.preventDefault();
      scatterBurst();
    }
    if (e.key === "r" || e.key === "R") {
      spawnParticles("uniform");
    }
    if (e.key === "n" || e.key === "N") {
      el.preset.click();
    }
  });

  // Boot
  readSliders();
  spawnParticles("uniform");
  updateMeta();
  requestAnimationFrame(frame);
})();
