/* Orbit Chime — an orbital polyrhythm music box.
 *
 * N planets ride concentric orbits with integer-ratio periods. Every time a
 * planet sweeps past the meridian (12 o'clock) it chimes one note of a scale.
 * Timing is driven by the Web Audio clock with a lookahead scheduler; the
 * canvas just renders wherever the clock says the planets are.
 */
"use strict";

// ---------------------------------------------------------------- constants

const TAU = Math.PI * 2;
const MERIDIAN = -Math.PI / 2; // 12 o'clock

// Each ratio set maps planet index -> how many revolutions per full cycle.
// Planet i completes ratio[i] revolutions while the whole pattern loops once.
const RATIO_SETS = [
  { id: "count", label: "counting", fn: (i) => i + 2 }, // 2 3 4 5 6 ...
  { id: "prime", label: "primes", fn: (i) => [2, 3, 5, 7, 11, 13, 17, 19, 23][i] },
  { id: "odd", label: "odds", fn: (i) => i * 2 + 1 }, // 1 3 5 7 9 ...
  { id: "fib", label: "fibonacci", fn: (i) => [2, 3, 5, 8, 13, 21, 34, 55, 89][i] },
];

// Semitone offsets, planet 0 (outermost orbit) = lowest note.
const SCALES = [
  { id: "penta", label: "pentatonic", steps: [0, 2, 4, 7, 9] },
  { id: "minor", label: "minor penta", steps: [0, 3, 5, 7, 10] },
  { id: "lydian", label: "lydian", steps: [0, 2, 4, 6, 7, 9, 11] },
  { id: "hirajoshi", label: "hirajoshi", steps: [0, 2, 3, 7, 8] },
];
const ROOT_HZ = 220; // A3

const state = {
  playing: false,
  cycleSec: 6, // seconds for one full pattern loop
  count: 6, // number of planets
  ratioIdx: 0,
  scaleIdx: 0,
  startTime: 0, // audio-clock time when angle == 0 for everyone
  muted: new Set(),
  flashes: [], // {ring, at} recent meridian crossings, for drawing
};

// ------------------------------------------------------------------- audio

let ctx = null;
let master = null;
let delaySend = null;

function initAudio() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();

  master = ctx.createGain();
  master.gain.value = 0.55;
  const comp = ctx.createDynamicsCompressor();
  master.connect(comp).connect(ctx.destination);

  // A single feedback delay gives the chimes a shared, hazy tail.
  delaySend = ctx.createGain();
  delaySend.gain.value = 0.35;
  const delay = ctx.createDelay(1.5);
  delay.delayTime.value = 0.31;
  const fb = ctx.createGain();
  fb.gain.value = 0.42;
  const damp = ctx.createBiquadFilter();
  damp.type = "lowpass";
  damp.frequency.value = 2200;
  delaySend.connect(delay).connect(damp).connect(fb).connect(delay);
  damp.connect(master);
}

function noteHz(ring) {
  const scale = SCALES[state.scaleIdx].steps;
  // Outermost planet (ring 0) lowest; walk up the scale, octave-wrapping.
  const deg = ring % scale.length;
  const oct = Math.floor(ring / scale.length);
  return ROOT_HZ * Math.pow(2, (scale[deg] + oct * 12) / 12);
}

function chime(ring, when) {
  const hz = noteHz(ring);
  const gain = ctx.createGain();
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = hz;

  // A quieter octave partial makes it bell-ish without FM bookkeeping.
  const partial = ctx.createOscillator();
  partial.type = "sine";
  partial.frequency.value = hz * 2.01; // slight detune -> shimmer
  const pGain = ctx.createGain();
  pGain.gain.value = 0.35;
  partial.connect(pGain).connect(gain);
  osc.connect(gain);

  const dur = 1.4;
  const peak = 0.28 / Math.sqrt(ring * 0.6 + 1); // high notes softer
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(peak, when + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);

  gain.connect(master);
  gain.connect(delaySend);
  osc.start(when);
  partial.start(when);
  osc.stop(when + dur);
  partial.stop(when + dur);
}

// ---------------------------------------------------------------- scheduler
// Classic lookahead scheduler: every tick, schedule any crossings that fall
// within the next LOOKAHEAD seconds at their exact audio-clock time.

const LOOKAHEAD = 0.12; // s
const TICK_MS = 30;
let schedTimer = null;
const nextDue = []; // per-ring audio time of next meridian crossing

function ringPeriod(ring) {
  return state.cycleSec / RATIO_SETS[state.ratioIdx].fn(ring);
}

function resetSchedule(fromTime) {
  nextDue.length = 0;
  for (let i = 0; i < state.count; i++) {
    // First crossing at/after fromTime, on this ring's grid anchored at
    // startTime. n=0 is allowed: every planet starts on the meridian, so
    // pressing play opens with a full chord.
    const p = ringPeriod(i);
    const n = Math.max(0, Math.ceil((fromTime - state.startTime) / p));
    nextDue[i] = state.startTime + n * p;
  }
}

function schedulerTick() {
  const horizon = ctx.currentTime + LOOKAHEAD;
  for (let i = 0; i < state.count; i++) {
    const p = ringPeriod(i);
    while (nextDue[i] < horizon) {
      if (!state.muted.has(i)) {
        chime(i, nextDue[i]);
        state.flashes.push({ ring: i, at: nextDue[i] });
      }
      nextDue[i] += p;
    }
  }
  // Drop stale flashes (they fade in ~0.9s).
  const cutoff = ctx.currentTime - 1;
  while (state.flashes.length && state.flashes[0].at < cutoff) state.flashes.shift();
}

function play() {
  initAudio();
  ctx.resume();
  state.playing = true;
  state.startTime = ctx.currentTime + 0.05;
  resetSchedule(ctx.currentTime);
  schedTimer = setInterval(schedulerTick, TICK_MS);
  playBtn.textContent = "⏸ Pause";
  hint.classList.add("dim");
}

function pause() {
  state.playing = false;
  clearInterval(schedTimer);
  schedTimer = null;
  if (ctx) ctx.suspend();
  playBtn.textContent = "▶ Play";
}

// Rebuild timing after a parameter change without stopping playback.
function retime() {
  if (!state.playing) return;
  state.startTime = ctx.currentTime + 0.05;
  resetSchedule(ctx.currentTime);
}

// ------------------------------------------------------------------ canvas

const canvas = document.getElementById("sky");
const g = canvas.getContext("2d");
let W = 0, H = 0, CX = 0, CY = 0, R_MAX = 0;

function resize() {
  const rect = canvas.parentElement.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const side = Math.min(rect.width, rect.height);
  canvas.style.width = side + "px";
  canvas.style.height = side + "px";
  canvas.width = Math.round(side * dpr);
  canvas.height = Math.round(side * dpr);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  W = side; H = side;
  CX = W / 2; CY = H / 2;
  R_MAX = side * 0.44;
}
window.addEventListener("resize", resize);

function ringRadius(i) {
  // Ring 0 outermost. Inner rings shrink but keep a floor so 9 rings fit.
  return R_MAX * (1 - i / (state.count + 1.4));
}

function ringAngle(i, t) {
  const p = ringPeriod(i);
  const phase = state.playing ? ((t - state.startTime) / p) % 1 : 0;
  return MERIDIAN + phase * TAU;
}

function ringHue(i) {
  return (205 + i * 33) % 360;
}

function draw() {
  const t = ctx && state.playing ? ctx.currentTime : 0;
  g.clearRect(0, 0, W, H);

  // Meridian line
  g.strokeStyle = "rgba(255,255,255,0.10)";
  g.lineWidth = 1;
  g.setLineDash([3, 5]);
  g.beginPath();
  g.moveTo(CX, CY - R_MAX - 12);
  g.lineTo(CX, CY);
  g.stroke();
  g.setLineDash([]);

  for (let i = 0; i < state.count; i++) {
    const r = ringRadius(i);
    const a = ringAngle(i, t);
    const hue = ringHue(i);
    const isMuted = state.muted.has(i);

    // Orbit
    g.strokeStyle = isMuted ? "rgba(255,255,255,0.05)" : `hsla(${hue}, 60%, 60%, 0.16)`;
    g.lineWidth = 1;
    g.beginPath();
    g.arc(CX, CY, r, 0, TAU);
    g.stroke();

    // Comet trail — arc fading behind the planet
    if (!isMuted && state.playing) {
      const trail = 0.9; // radians
      const grad = 14;
      for (let s = 0; s < grad; s++) {
        const a0 = a - (trail * (s + 1)) / grad;
        const a1 = a - (trail * s) / grad;
        g.strokeStyle = `hsla(${hue}, 85%, 65%, ${0.28 * (1 - s / grad)})`;
        g.lineWidth = 2.4;
        g.beginPath();
        g.arc(CX, CY, r, a0, a1);
        g.stroke();
      }
    }

    // Planet
    const px = CX + Math.cos(a) * r;
    const py = CY + Math.sin(a) * r;
    const pr = Math.max(3.4, 7 - i * 0.35);
    if (!isMuted) {
      g.shadowColor = `hsla(${hue}, 90%, 65%, 0.9)`;
      g.shadowBlur = 14;
    }
    g.fillStyle = isMuted ? "rgba(255,255,255,0.18)" : `hsl(${hue}, 90%, ${72}%)`;
    g.beginPath();
    g.arc(px, py, pr, 0, TAU);
    g.fill();
    g.shadowBlur = 0;

    // Flash ripple at the meridian on recent crossings
    for (const f of state.flashes) {
      if (f.ring !== i) continue;
      const age = t - f.at;
      if (age < 0 || age > 0.9) continue;
      const k = age / 0.9;
      g.strokeStyle = `hsla(${hue}, 95%, 70%, ${0.55 * (1 - k)})`;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(CX, CY - r, 4 + k * 26, 0, TAU);
      g.stroke();
    }
  }

  requestAnimationFrame(draw);
}

// -------------------------------------------------------------- interaction

const playBtn = document.getElementById("play");
const hint = document.getElementById("hint");
const cycleInput = document.getElementById("cycle");
const cycleVal = document.getElementById("cycle-val");
const countInput = document.getElementById("count");
const countVal = document.getElementById("count-val");
const ratioName = document.getElementById("ratio-name");

playBtn.addEventListener("click", () => (state.playing ? pause() : play()));

cycleInput.addEventListener("input", () => {
  state.cycleSec = parseFloat(cycleInput.value);
  cycleVal.textContent = state.cycleSec.toFixed(1) + "s";
  retime();
});

countInput.addEventListener("input", () => {
  state.count = parseInt(countInput.value, 10);
  countVal.textContent = String(state.count);
  updateRatioName();
  retime();
});

function updateRatioName() {
  const fn = RATIO_SETS[state.ratioIdx].fn;
  const parts = [];
  for (let i = 0; i < state.count; i++) parts.push(fn(i));
  ratioName.textContent = parts.join(" : ");
}

function buildChoices(elId, sets, currentIdx, onPick) {
  const box = document.getElementById(elId);
  box.innerHTML = "";
  sets.forEach((s, idx) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = s.label;
    b.className = idx === currentIdx() ? "on" : "";
    b.addEventListener("click", () => {
      onPick(idx);
      [...box.children].forEach((c, j) => c.classList.toggle("on", j === idx));
    });
    box.appendChild(b);
  });
}

buildChoices("ratios", RATIO_SETS, () => state.ratioIdx, (i) => {
  state.ratioIdx = i;
  updateRatioName();
  retime();
});
buildChoices("scales", SCALES, () => state.scaleIdx, (i) => {
  state.scaleIdx = i;
});

// Click near an orbit to mute/unmute that planet.
canvas.addEventListener("pointerdown", (e) => {
  const rect = canvas.getBoundingClientRect();
  const dx = e.clientX - rect.left - CX;
  const dy = e.clientY - rect.top - CY;
  const d = Math.hypot(dx, dy);
  let best = -1, bestErr = 14;
  for (let i = 0; i < state.count; i++) {
    const err = Math.abs(d - ringRadius(i));
    if (err < bestErr) { bestErr = err; best = i; }
  }
  if (best >= 0) toggleMute(best);
});

function toggleMute(i) {
  if (state.muted.has(i)) state.muted.delete(i);
  else state.muted.add(i);
}

window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  if (e.code === "Space") {
    e.preventDefault();
    state.playing ? pause() : play();
  } else if (e.key >= "1" && e.key <= "9") {
    const i = parseInt(e.key, 10) - 1;
    if (i < state.count) toggleMute(i);
  } else if (e.key === "s" || e.key === "S") {
    const i = (state.scaleIdx + 1) % SCALES.length;
    state.scaleIdx = i;
    const box = document.getElementById("scales");
    [...box.children].forEach((c, j) => c.classList.toggle("on", j === i));
  } else if (e.key === "p" || e.key === "P") {
    const i = (state.ratioIdx + 1) % RATIO_SETS.length;
    state.ratioIdx = i;
    updateRatioName();
    retime();
    const box = document.getElementById("ratios");
    [...box.children].forEach((c, j) => c.classList.toggle("on", j === i));
  }
});

// ------------------------------------------------------------------- start

updateRatioName();
resize();
requestAnimationFrame(draw);
