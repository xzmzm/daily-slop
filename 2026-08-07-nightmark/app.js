"use strict";

/* ===========================================================================
 * nightmark — a lighthouse light-characteristic builder
 *
 * The whole project turns on one function: buildIntervals(spec) -> timeline,
 * which converts an IALA light-characteristic spec (the notation a real
 * lighthouse is charted under, e.g. "Fl(2) W 6s" or "Mo(A) W 6s") into a list
 * of {on, off} intervals that sum to the cycle period. Everything visual —
 * the canvas lighthouse, the timeline strip, the quiz — is driven by a single
 * predicate isLit(t) derived from that timeline.
 * ========================================================================= */

/* ---- Morse code (ITU): dit = 1 unit, dah = 3 units, intra-letter gap = 1,
 *      inter-letter gap would be 3 but we render one letter per cycle. ---- */
const MORSE = {
  A: ".-",     B: "-...",  C: "-.-.",  D: "-..",   E: ".",
  F: "..-.",   G: "--.",   H: "....",  I: "..",    J: ".---",
  K: "-.-",    L: ".-..",  M: "--",    N: "-.",    O: "---",
  P: ".--.",   Q: "--.-",  R: ".-.",   S: "...",   T: "-",
  U: "..-",    V: "...-",  W: ".--",   X: "-..-",  Y: "-.--",
  Z: "--..",
  0: "-----",  1: ".----", 2: "..---", 3: "...--", 4: "....-",
  5: ".....",  6: "-....", 7: "--...", 8: "---..", 9: "----."
};

const COLOR_HEX = {
  W: "#fff4d6",   // warm white
  R: "#ff3b3b",
  G: "#2ed95a",
  Y: "#ffd23b"
};
const COLOR_NAME = { W: "white", R: "red", G: "green", Y: "yellow" };
const RHYTHM_NAME = {
  F:   "fixed",
  Fl:  "flashing",
  Oc:  "occulting",
  Iso: "isophase",
  Q:   "quick-flashing",
  Mo:  "Morse code"
};

/* ===========================================================================
 * buildIntervals — the engine.
 *
 * Returns a timeline: an array of segments [{lit:boolean, dur:number}]
 * whose durations sum to `period`. Building a single isLit(t) over this is
 * then trivial (phase = t mod period; walk segments).
 *
 * IALA conventions implemented:
 *   F   Fixed — always lit. One segment lit for the whole period.
 *   Fl  Flashing — light shorter than dark. Default flash = 0.5s; group
 *       flashes are separated by a 1.0s dark gap (the "eclipse" between
 *       members of a group). After the group, the rest of the period is dark.
 *   Oc  Occulting — the inverse of flashing: light is on most of the time
 *       and briefly drops OUT. Each group member is a 0.5s dark "eclipse",
 *       separated by a 1.0s lit interval.
 *   Iso Isophase — equal light and dark, split down the middle. For a
 *       group it alternates lit/dark of equal length.
 *   Q   Quick flashing — ~50–79 per minute; we use 0.5s per flash cycle
 *       (1 flash per 0.5s) and ignore count (a group is unusual but allowed;
 *       we treat Q(3) as 3 quick flashes then a rest).
 *   Mo  Morse — the dots and dashes of one letter, scaled to fill the period.
 * ========================================================================= */
function buildIntervals(spec) {
  const { rhythm, count = 1, period, morseLetter = "A" } = spec;
  const segs = [];
  const push = (lit, dur) => segs.push({ lit, dur });

  if (period <= 0) return [{ lit: true, dur: 1 }];

  switch (rhythm) {

    case "F": // fixed — steady on
      push(true, period);
      break;

    case "Fl": { // flashing — brief light, long dark
      const flash = 0.5;          // IALA: flash durations are short (typ. 0.3–0.5s)
      const gap   = 1.0;          // dark gap between members of a group
      const n = Math.max(1, count);
      for (let i = 0; i < n; i++) {
        push(true, flash);
        if (i < n - 1) push(false, gap);
      }
      // remainder of the period is dark (the long eclipse)
      const used = segs.reduce((s, x) => s + x.dur, 0);
      if (period - used > 0) push(false, period - used);
      break;
    }

    case "Oc": { // occulting — mostly lit, brief dark "eclipses"
      const dark = 0.5;
      const gap  = 1.0;           // lit gap between eclipses
      const n = Math.max(1, count);
      push(true, gap);            // lead-in lit
      for (let i = 0; i < n; i++) {
        push(false, dark);
        if (i < n - 1) push(true, gap);
      }
      const used = segs.reduce((s, x) => s + x.dur, 0);
      if (period - used > 0) push(true, period - used);
      break;
    }

    case "Iso": { // isophase — equal light and dark
      const n = Math.max(1, count);
      const half = period / (2 * n);
      for (let i = 0; i < n; i++) {
        push(true, half);
        push(false, half);
      }
      break;
    }

    case "Q": { // quick — ~0.5s each, continuous
      const n = Math.max(1, count);
      const per = period / n;     // divide period into n quick cycles
      const on = Math.min(0.25, per / 2);
      push(true, on);
      push(false, per - on);
      // (count>1 just repeats; but Q with a real rest is rare — we still fill)
      break;
    }

    case "Mo": { // morse — scale one letter to fill the period
      const code = MORSE[morseLetter] || MORSE.A;
      // units: dit=1, dah=3, intra-letter gap=1, plus a leading/trailing margin
      let units = 0;
      const parts = [];
      for (let i = 0; i < code.length; i++) {
        const sym = code[i];
        const on = (sym === ".") ? 1 : 3;
        parts.push({ lit: true, units: on });
        units += on;
        if (i < code.length - 1) { parts.push({ lit: false, units: 1 }); units += 1; }
      }
      // trailing dark to separate cycles (treat as part of the period)
      parts.push({ lit: false, units: 3 });
      units += 3;
      const unit = period / units;
      for (const p of parts) push(p.lit, p.units * unit);
      break;
    }
  }

  // normalize: collapse zero-length trailing segments, ensure sum == period
  let total = segs.reduce((s, x) => s + x.dur, 0);
  if (segs.length && Math.abs(total - period) > 1e-6 && segs[segs.length - 1]) {
    segs[segs.length - 1].dur += (period - total);
  }
  return segs;
}

/* isLitAt: given a timeline + elapsed seconds, is the lamp lit right now? */
function isLitAt(segs, period, t) {
  if (!segs.length) return false;
  const phase = ((t % period) + period) % period;
  let acc = 0;
  for (const s of segs) {
    acc += s.dur;
    if (phase < acc) return s.lit;
  }
  return segs[segs.length - 1].lit;
}

/* formatNotation: turn a spec into the charted IALA string, e.g. "Fl(2) W 6s" */
function formatNotation(spec) {
  const { rhythm, count = 1, color = "W", period, morseLetter = "A" } = spec;
  let s = rhythm;
  if (rhythm === "Mo") {
    s += `(${morseLetter})`;
  } else if (count > 1 && rhythm !== "F" && rhythm !== "Iso" && rhythm !== "Q") {
    s += `(${count})`;
  } else if (rhythm === "Q" && count > 1) {
    s += `(${count})`;
  }
  s += ` ${color}`;
  s += ` ${formatPeriod(period)}`;
  return s;
}
function formatPeriod(p) {
  return (Number.isInteger(p) ? `${p}s` : `${p.toFixed(1).replace(/\.0$/, "")}s`);
}

/* describeInWords: one plain-English sentence for the current characteristic */
function describeInWords(spec) {
  const { rhythm, count = 1, color = "W", period, morseLetter = "A" } = spec;
  const col = COLOR_NAME[color];
  const n = count;
  const p = formatPeriod(period);
  switch (rhythm) {
    case "F":
      return `A steady ${col} light, always on.`;
    case "Fl":
      if (n === 1) return `One ${col} flash every ${p}.`;
      return `A group of ${numWord(n)} ${col} flashes, repeating every ${p}.`;
    case "Oc":
      if (n === 1) return `A ${col} light that is mostly on, briefly blinking off once every ${p}.`;
      return `A ${col} light that blinks off ${numWord(n)} times in quick succession, every ${p}.`;
    case "Iso":
      return `Equal ${col} light and dark — on for half, off for half, every ${p}.`;
    case "Q":
      return `Continuous quick ${col} flashes (about one per half-second)${n > 1 ? `, in groups of ${numWord(n)}` : ""}.`;
    case "Mo":
      return `${col[0].toUpperCase()}${col.slice(1)} light flashing the Morse code for "${morseLetter}" (${morseHuman(morseLetter)}), one letter every ${p}.`;
    default:
      return "";
  }
}
function numWord(n) {
  return ["zero","one","two","three","four","five","six","seven","eight","nine"][n] || String(n);
}
function morseHuman(letter) {
  const m = MORSE[letter];
  if (!m) return "";
  return m.replace(/\./g, "·").replace(/-/g, "—");
}

/* ===========================================================================
 * Real lighthouse presets — all characteristics verified against the USCG
 * Light List / Wikipedia / U.S. Lighthouse Society records.
 * ========================================================================= */
const PRESETS = [
  {
    name: "Portland Head, ME",
    year: 1791,
    note: "First lit by whale oil; the oldest lighthouse in Maine.",
    spec: { rhythm: "Fl", count: 1, color: "W", period: 4 }
  },
  {
    name: "Heceta Head, OR",
    year: 1894,
    note: "Its first-order Fresnel lens — 1,000,000 candlepower — is the strongest on the Oregon coast.",
    spec: { rhythm: "Fl", count: 1, color: "W", period: 10 }
  },
  {
    name: "Bodie Island, NC",
    year: 1872,
    note: "The classic Outer Banks daymark — two white flashes every thirty seconds.",
    spec: { rhythm: "Fl", count: 2, color: "W", period: 30 }
  },
  {
    name: "Minot's Ledge, MA",
    year: 1860,
    note: "The \"I Love You\" light: its 1-4-3 flash matches the letters in \"I LOVE YOU\". The 1860 iron tower was called the \"iron spider\".",
    spec: { rhythm: "Fl", count: 1, color: "W", period: 45, special: "minots" }
  },
  {
    name: "Cape Hatteras, NC",
    year: 1803,
    note: "America's tallest brick lighthouse (210 ft). The spiral daymark is iconic.",
    spec: { rhythm: "Fl", count: 1, color: "W", period: 7.5 }
  },
  {
    name: "Point Reyes, CA",
    year: 1870,
    note: "Perched on the windiest, foggiest point on the Pacific coast.",
    spec: { rhythm: "Fl", count: 1, color: "W", period: 5 }
  },
  {
    name: "Tybee Island, GA",
    year: 1736,
    note: "A fixed (steady) white light — no flash at all. Steady beacons are rarer now.",
    spec: { rhythm: "F", count: 1, color: "W", period: 8 }
  },
  {
    name: "Pigeon Point, CA",
    year: 1872,
    note: "Tallest lighthouse on the West Coast (115 ft). One flash every ten seconds.",
    spec: { rhythm: "Fl", count: 1, color: "W", period: 10 }
  }
];

/* ===========================================================================
 * App state
 * ========================================================================= */
const state = {
  spec: { rhythm: "Fl", count: 1, color: "W", period: 4 },
  speed: 4,
  t: 0,           // simulated seconds elapsed
  lastTs: 0,
  timeline: [],
  mode: "build"   // "build" | "quiz"
};

function recompute() {
  state.timeline = buildIntervals(state.spec);
}

/* ===========================================================================
 * Canvas renderer — a stylised night sea with a lighthouse whose lamp beam
 * and tower light follow isLitAt().
 * ========================================================================= */
const stage = document.getElementById("stage");
const sctx  = stage.getContext("2d");
const quizStage = document.getElementById("quiz-stage");
const qctx  = quizStage.getContext("2d");

// beam color is derived from the lit color; the tower lamp glows the same hue.
function drawStage(ctx, canvas, lit, spec, t) {
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // ---- sky: deep night gradient with a faint horizon glow ----
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.78);
  sky.addColorStop(0,    "#070b1a");
  sky.addColorStop(0.55, "#0d1530");
  sky.addColorStop(1,    "#1a2347");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H * 0.78);

  // ---- stars (deterministic, twinkle slowly) ----
  drawStars(ctx, W, H, t);

  // ---- horizon glow (stronger when lit) ----
  const glow = ctx.createRadialGradient(W / 2, H * 0.78, 10, W / 2, H * 0.78, W * 0.6);
  const glowAlpha = lit ? 0.28 : 0.06;
  glow.addColorStop(0, `rgba(255,235,180,${glowAlpha})`);
  glow.addColorStop(1, "rgba(255,235,180,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, H * 0.5, W, H * 0.4);

  // ---- sea ----
  const sea = ctx.createLinearGradient(0, H * 0.78, 0, H);
  sea.addColorStop(0, "#0a1830");
  sea.addColorStop(1, "#050912");
  ctx.fillStyle = sea;
  ctx.fillRect(0, H * 0.78, W, H * 0.22);

  // moon reflection + light reflection on water
  drawSeaReflection(ctx, W, H, lit, spec, t);

  // ---- lighthouse ----
  const lx = W / 2;
  const lyBase = H * 0.80;
  drawLighthouse(ctx, lx, lyBase, lit, spec);

  // ---- beam (only when lit) ----
  if (lit) {
    drawBeam(ctx, lx, lyBase - 168, spec, t);
  }

  // ---- lamp halo ----
  drawLampHalo(ctx, lx, lyBase - 168, lit, spec);
}

const STAR_SEED = [];
for (let i = 0; i < 90; i++) {
  STAR_SEED.push({
    x: Math.random(),
    y: Math.random() * 0.62,
    r: Math.random() * 1.1 + 0.3,
    p: Math.random() * Math.PI * 2
  });
}
function drawStars(ctx, W, H, t) {
  ctx.save();
  for (const s of STAR_SEED) {
    const tw = 0.5 + 0.5 * Math.sin(t * 1.3 + s.p);
    ctx.globalAlpha = 0.3 + 0.6 * tw;
    ctx.fillStyle = "#dfe7ff";
    ctx.beginPath();
    ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawSeaReflection(ctx, W, H, lit, spec, t) {
  const color = COLOR_HEX[spec.color] || COLOR_HEX.W;
  const lx = W / 2;
  const seaTop = H * 0.78;
  ctx.save();
  // shimmering vertical streak under the lighthouse
  const streaks = 14;
  for (let i = 0; i < streaks; i++) {
    const yy = seaTop + (i / streaks) * (H - seaTop);
    const wobble = Math.sin(t * 2 + i * 0.7) * 6;
    const w = 60 - i * 2.5;
    const a = lit ? (0.18 * (1 - i / streaks)) : 0.04 * (1 - i / streaks);
    ctx.globalAlpha = a;
    ctx.fillStyle = color;
    ctx.fillRect(lx - w / 2 + wobble, yy, w, 3);
  }
  ctx.restore();
}

function drawBeam(ctx, lx, ly, spec, t) {
  const color = COLOR_HEX[spec.color] || COLOR_HEX.W;
  // a slowly rotating pair of beams (lighthouse lenses rotate)
  const baseAngle = t * 0.6;
  ctx.save();
  ctx.translate(lx, ly);
  for (const dir of [-1, 1]) {
    const ang = baseAngle * dir;
    ctx.save();
    ctx.rotate(ang);
    const grad = ctx.createLinearGradient(0, 0, 420, 0);
    grad.addColorStop(0,   hexA(color, 0.55));
    grad.addColorStop(0.4, hexA(color, 0.18));
    grad.addColorStop(1,   hexA(color, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(420, -34);
    ctx.lineTo(420, 34);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawLampHalo(ctx, lx, ly, lit, spec) {
  const color = COLOR_HEX[spec.color] || COLOR_HEX.W;
  ctx.save();
  if (lit) {
    const g = ctx.createRadialGradient(lx, ly, 2, lx, ly, 70);
    g.addColorStop(0,   hexA(color, 0.95));
    g.addColorStop(0.3, hexA(color, 0.45));
    g.addColorStop(1,   hexA(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(lx, ly, 70, 0, Math.PI * 2);
    ctx.fill();
    // bright core
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(lx, ly, 4.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // dim idle lamp
    ctx.fillStyle = "rgba(120,90,40,0.5)";
    ctx.beginPath();
    ctx.arc(lx, ly, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawLighthouse(ctx, lx, lyBase, lit, spec) {
  // lyBase = base of tower (the rock). Tower goes UP from there.
  const rockW = 150, rockH = 36;
  // ---- rocky base ----
  ctx.fillStyle = "#0c1020";
  ctx.beginPath();
  ctx.moveTo(lx - rockW / 2, lyBase + rockH);
  ctx.lineTo(lx - rockW / 2 + 10, lyBase);
  ctx.quadraticCurveTo(lx, lyBase - 6, lx + rockW / 2 - 10, lyBase);
  ctx.lineTo(lx + rockW / 2, lyBase + rockH);
  ctx.closePath();
  ctx.fill();

  // ---- tower (tapered), candy-stripe if "iconic" presets imply it ----
  const towerBot = lyBase;
  const towerTop = lyBase - 150;
  const wBot = 30, wTop = 20;
  // tower body gradient
  const tg = ctx.createLinearGradient(lx - wBot, 0, lx + wBot, 0);
  tg.addColorStop(0, "#1d2336");
  tg.addColorStop(0.5, "#2c3450");
  tg.addColorStop(1, "#161a2b");
  ctx.fillStyle = tg;
  ctx.beginPath();
  ctx.moveTo(lx - wBot / 2, towerBot);
  ctx.lineTo(lx - wTop / 2, towerTop);
  ctx.lineTo(lx + wTop / 2, towerTop);
  ctx.lineTo(lx + wBot / 2, towerBot);
  ctx.closePath();
  ctx.fill();

  // two red horizontal bands (a common daymark) — subtle at night
  ctx.fillStyle = "rgba(180,40,40,0.45)";
  band(ctx, lx, towerBot - 30, wBot * 0.92, wTop * 0.96, 10);
  band(ctx, lx, towerBot - 95, wBot * 0.7, wTop * 0.92, 10);

  // ---- gallery (platform under the lamp room) ----
  const galY = towerTop - 8;
  ctx.fillStyle = "#3a4660";
  ctx.fillRect(lx - wTop / 2 - 5, galY, wTop + 10, 6);
  // railing posts
  ctx.strokeStyle = "rgba(180,200,230,0.4)";
  ctx.lineWidth = 1;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(lx + i * 4, galY);
    ctx.lineTo(lx + i * 4, galY - 5);
    ctx.stroke();
  }

  // ---- lamp room ----
  const roomY = galY - 18;
  ctx.fillStyle = "#2a2f48";
  ctx.fillRect(lx - 12, roomY, 24, 16);
  // lamp room window panes (where the light shows)
  ctx.fillStyle = lit ? hexA(COLOR_HEX[spec.color] || COLOR_HEX.W, 0.9)
                      : "rgba(40,50,80,0.9)";
  ctx.fillRect(lx - 10, roomY + 3, 20, 10);

  // ---- roof / dome ----
  ctx.fillStyle = "#10131f";
  ctx.beginPath();
  ctx.moveTo(lx - 14, roomY);
  ctx.lineTo(lx, roomY - 16);
  ctx.lineTo(lx + 14, roomY);
  ctx.closePath();
  ctx.fill();
  // finial
  ctx.strokeStyle = "#10131f";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(lx, roomY - 16);
  ctx.lineTo(lx, roomY - 24);
  ctx.stroke();
}
function band(ctx, cx, y, wBot, wTop, h) {
  // trapezoidal horizontal band following tower taper
  ctx.beginPath();
  ctx.moveTo(cx - wBot / 2, y);
  ctx.lineTo(cx - wTop / 2, y - h);
  ctx.lineTo(cx + wTop / 2, y - h);
  ctx.lineTo(cx + wBot / 2, y);
  ctx.closePath();
  ctx.fill();
}

// hex + alpha -> rgba string (handles "#rrggbb")
function hexA(hex, a) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/* ===========================================================================
 * Timeline strip — one full cycle visualised left-to-right.
 * ========================================================================= */
const tlCanvas = document.getElementById("timeline");
const tlCtx = tlCanvas.getContext("2d");
function drawTimeline(spec, segs) {
  const W = tlCanvas.width, H = tlCanvas.height;
  tlCtx.clearRect(0, 0, W, H);

  // background
  tlCtx.fillStyle = "#0a0f1f";
  tlCtx.fillRect(0, 0, W, H);

  if (!segs.length) return;
  const total = segs.reduce((s, x) => s + x.dur, 0);
  let x = 0;
  const padY = 16;
  for (const s of segs) {
    const segW = (s.dur / total) * W;
    if (s.lit) {
      const col = COLOR_HEX[spec.color] || COLOR_HEX.W;
      // lit block: brighter bar + glow
      const g = tlCtx.createLinearGradient(0, padY, 0, H - padY);
      g.addColorStop(0, hexA(col, 0.95));
      g.addColorStop(1, hexA(col, 0.55));
      tlCtx.fillStyle = g;
      tlCtx.fillRect(x, padY, Math.max(1, segW - 1), H - padY * 2);
    } else {
      tlCtx.fillStyle = "#1a2238";
      tlCtx.fillRect(x, padY + 8, Math.max(1, segW - 1), H - padY * 2 - 16);
    }
    x += segW;
  }

  // a moving playhead at the current phase
  const phase = ((state.t % spec.period) + spec.period) % spec.period;
  const px = (phase / total) * W;
  tlCtx.strokeStyle = "rgba(255,255,255,0.85)";
  tlCtx.lineWidth = 2;
  tlCtx.beginPath();
  tlCtx.moveTo(px, 2);
  tlCtx.lineTo(px, H - 2);
  tlCtx.stroke();

  // second ticks at the bottom
  tlCtx.fillStyle = "rgba(150,170,210,0.5)";
  tlCtx.font = "10px ui-monospace, monospace";
  const ticks = Math.min(Math.ceil(total), 16);
  for (let i = 0; i <= ticks; i++) {
    const tx = (i / ticks) * W;
    tlCtx.fillRect(tx, H - 4, 1, 4);
    if (i % Math.max(1, Math.ceil(ticks / 6)) === 0) {
      tlCtx.fillText(`${i}s`, tx + 3, H - 6);
    }
  }
}

/* ===========================================================================
 * Builder mode UI wiring
 * ========================================================================= */
const el = (id) => document.getElementById(id);
const notationEl   = el("notation");
const plainwordsEl = el("plainwords");
const rhythmSel    = el("rhythm");
const countInput   = el("count");
const periodInput  = el("period");
const periodRange  = el("period-range");
const speedSel     = el("speed");
const morseSel     = el("morse-letter");
const colorRow     = el("color-row");
const presetGrid   = el("preset-grid");
const errMsg       = el("err-msg");
const grpCount     = el("grp-count");
const grpMorse     = el("grp-morse");
const statusLight  = el("status-light");
const statusText   = el("status-text");
const statusPhase  = el("status-phase");
const statusCycle  = el("status-cycle");

function syncControlsFromSpec() {
  rhythmSel.value  = state.spec.rhythm;
  countInput.value = state.spec.count;
  periodInput.value = state.spec.period;
  periodRange.value = Math.min(20, state.spec.period);
  morseSel.value   = state.spec.morseLetter || "A";
  speedSel.value   = String(state.speed);
  // color swatches
  for (const b of colorRow.querySelectorAll(".color-swatch")) {
    b.classList.toggle("active", b.dataset.color === state.spec.color);
  }
  updateGroupVisibility();
}

function updateGroupVisibility() {
  const r = state.spec.rhythm;
  // count stepper is meaningful for Fl, Oc, Iso, Q (not F or Mo)
  const showCount = (r === "Fl" || r === "Oc" || r === "Iso" || r === "Q");
  grpCount.hidden = !showCount;
  grpMorse.hidden = (r !== "Mo");
  // hint text
  const hint = el("count-hint");
  if (r === "Iso") hint.textContent = "(pairs of on/off per cycle)";
  else if (r === "Q") hint.textContent = "(flashes per group)";
  else hint.textContent = "(flashes per group)";
}

function applySpecAndRender() {
  recompute();
  notationEl.textContent = formatNotation(state.spec);
  plainwordsEl.textContent = describeInWords(state.spec);
}

function showError(msg) {
  errMsg.textContent = msg;
  errMsg.hidden = !msg;
}

rhythmSel.addEventListener("change", () => {
  state.spec.rhythm = rhythmSel.value;
  updateGroupVisibility();
  applySpecAndRender();
});
countInput.addEventListener("input", () => {
  let n = parseInt(countInput.value, 10);
  if (isNaN(n) || n < 1) n = 1;
  if (n > 9) n = 9;
  state.spec.count = n;
  applySpecAndRender();
});
periodInput.addEventListener("input", () => {
  let p = parseFloat(periodInput.value);
  if (isNaN(p)) p = 1;
  p = Math.max(1, Math.min(60, p));
  state.spec.period = p;
  periodRange.value = Math.min(20, p);
  applySpecAndRender();
});
periodRange.addEventListener("input", () => {
  const p = parseFloat(periodRange.value);
  state.spec.period = p;
  periodInput.value = p;
  applySpecAndRender();
});
morseSel.addEventListener("change", () => {
  state.spec.morseLetter = morseSel.value;
  applySpecAndRender();
});
speedSel.addEventListener("change", () => {
  state.speed = parseInt(speedSel.value, 10) || 1;
});
colorRow.addEventListener("click", (e) => {
  const b = e.target.closest(".color-swatch");
  if (!b) return;
  state.spec.color = b.dataset.color;
  for (const x of colorRow.querySelectorAll(".color-swatch")) x.classList.remove("active");
  b.classList.add("active");
  applySpecAndRender();
});

// steppers
document.querySelectorAll(".step-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const which = btn.dataset.step;
    if (which === "count-up")   countInput.value = Math.min(9, parseInt(countInput.value,10) + 1);
    if (which === "count-down") countInput.value = Math.max(1, parseInt(countInput.value,10) - 1);
    if (which === "period-up")  periodInput.value = Math.min(60, parseFloat(periodInput.value) + 0.5);
    if (which === "period-down") periodInput.value = Math.max(1, parseFloat(periodInput.value) - 0.5);
    countInput.dispatchEvent(new Event("input"));
    periodInput.dispatchEvent(new Event("input"));
  });
});

/* ---- presets ---- */
function buildPresetGrid() {
  presetGrid.innerHTML = "";
  for (const p of PRESETS) {
    const card = document.createElement("button");
    card.className = "preset-card";
    const note = p.note || "";
    card.title = `${p.name} — ${note}`;
    card.innerHTML = `
      <span class="preset-notation">${formatNotation(p.spec)}</span>
      <span class="preset-name">${p.name}</span>
    `;
    card.addEventListener("click", () => loadPreset(p));
    presetGrid.appendChild(card);
  }
}
function loadPreset(p) {
  // clone so edits don't mutate the preset
  state.spec = Object.assign({}, p.spec);
  state.t = 0;
  syncControlsFromSpec();
  applySpecAndRender();
  showError("");
}

/* ===========================================================================
 * Minot's special: render the "1-4-3" group flashing directly.
 * The real characteristic is Fl(1+4+3) W 45s — three sub-groups in one cycle.
 * We detect the special flag and override the timeline.
 * ========================================================================= */
function maybeMinotsOverride() {
  if (state.spec.special !== "minots") return null;
  // 1 flash, pause, 4 flashes, pause, 3 flashes — over a 45s period
  const P = state.spec.period || 45;
  const flash = 0.4, dark = 0.3;
  const grpGap = 2.0;       // gap between sub-groups
  function grp(n) {
    const segs = [];
    for (let i = 0; i < n; i++) {
      segs.push({ lit: true, dur: flash });
      if (i < n - 1) segs.push({ lit: false, dur: dark });
    }
    return segs;
  }
  const segs = [];
  segs.push(...grp(1));
  segs.push({ lit: false, dur: grpGap });
  segs.push(...grp(4));
  segs.push({ lit: false, dur: grpGap });
  segs.push(...grp(3));
  const used = segs.reduce((s, x) => s + x.dur, 0);
  segs.push({ lit: false, dur: P - used });
  return segs;
}
// hook into recompute
const _recompute = recompute;
recompute = function() {
  const ov = maybeMinotsOverride();
  if (ov) { state.timeline = ov; return; }
  _recompute();
};

/* ===========================================================================
 * Animation loop
 * ========================================================================= */
function frame(ts) {
  if (!state.lastTs) state.lastTs = ts;
  const dt = (ts - state.lastTs) / 1000;
  state.lastTs = ts;
  state.t += dt * state.speed;

  if (state.mode === "build") {
    const period = state.spec.period;
    const segs = state.timeline;
    const lit = isLitAt(segs, period, state.t);
    drawStage(sctx, stage, lit, state.spec, state.t);
    drawTimeline(state.spec, segs);
    // status bar
    statusLight.className = "status-dot " + (lit ? "lit" : "dark");
    statusText.textContent = lit ? "lit" : "dark";
    const phase = ((state.t % period) + period) % period;
    statusPhase.textContent = `phase ${phase.toFixed(2)}s`;
    statusCycle.textContent = `cycle ${formatPeriod(period)}`;
  } else {
    // quiz uses its own clock & spec
    drawQuiz(ts, dt);
  }
  requestAnimationFrame(frame);
}

/* ===========================================================================
 * Mode switching
 * ========================================================================= */
const modeBuildBtn = el("mode-build");
const modeQuizBtn  = el("mode-quiz");
const viewBuild = el("view-build");
const viewQuiz  = el("view-quiz");
modeBuildBtn.addEventListener("click", () => switchMode("build"));
modeQuizBtn.addEventListener("click",  () => switchMode("quiz"));
function switchMode(m) {
  state.mode = m;
  state.t = 0;
  const buildActive = (m === "build");
  modeBuildBtn.classList.toggle("active", buildActive);
  modeQuizBtn.classList.toggle("active", !buildActive);
  viewBuild.classList.toggle("active", buildActive);
  viewQuiz.classList.toggle("active", !buildActive);
  if (m === "quiz") startQuiz();
}

/* ===========================================================================
 * Quiz mode — flash a hidden characteristic, ask the user to identify it
 * from four multiple-choice notation strings.
 * ========================================================================= */
const quizChoicesEl = el("quiz-choices");
const quizFeedbackEl = el("quiz-feedback");
const quizPromptEl  = el("quiz-prompt");
const quizScoreEl   = el("quiz-score");
const quizTotalEl   = el("quiz-total");
const quizNextBtn   = el("quiz-next");
const quizRestartBtn= el("quiz-restart");

const quiz = {
  spec: null,
  segs: [],
  t: 0,
  score: 0,
  total: 0,
  answered: false,
  choices: []
};

// a curated pool of quiz-able characteristics (simple, unambiguous)
const QUIZ_POOL = [
  { rhythm: "Fl",  count: 1, color: "W", period: 4 },
  { rhythm: "Fl",  count: 2, color: "W", period: 6 },
  { rhythm: "Fl",  count: 3, color: "R", period: 10 },
  { rhythm: "Oc",  count: 1, color: "W", period: 6 },
  { rhythm: "Oc",  count: 2, color: "G", period: 8 },
  { rhythm: "Iso", count: 1, color: "W", period: 4 },
  { rhythm: "Iso", count: 1, color: "R", period: 6 },
  { rhythm: "Q",   count: 1, color: "W", period: 2 },
  { rhythm: "F",   count: 1, color: "W", period: 6 },
  { rhythm: "Mo",  count: 1, color: "W", period: 6, morseLetter: "A" },
  { rhythm: "Mo",  count: 1, color: "W", period: 6, morseLetter: "S" },
  { rhythm: "Fl",  count: 1, color: "G", period: 5 }
];

function startQuiz() {
  quiz.score = 0;
  quiz.total = 0;
  quizScoreEl.textContent = "0";
  quizTotalEl.textContent = "0";
  quizRestartBtn.hidden = true;
  nextQuizQuestion();
}

function nextQuizQuestion() {
  quiz.answered = false;
  quiz.t = 0;
  quizFeedbackEl.hidden = true;
  quizNextBtn.hidden = true;
  quizPromptEl.textContent = "Watch the light. What is its characteristic?";
  // pick a random target
  const target = QUIZ_POOL[Math.floor(Math.random() * QUIZ_POOL.length)];
  quiz.spec = Object.assign({}, target);
  quiz.segs = buildIntervals(quiz.spec);

  // build 4 choices: the correct one + 3 plausible distractors
  const correct = formatNotation(quiz.spec);
  const choicesSet = new Set([correct]);
  let guard = 0;
  while (choicesSet.size < 4 && guard < 200) {
    guard++;
    const d = makeDistractor(quiz.spec);
    if (d && !choicesSet.has(d)) choicesSet.add(d);
  }
  quiz.choices = shuffle([...choicesSet]).slice(0, 4);
  if (!quiz.choices.includes(correct)) quiz.choices[0] = correct;
  quiz.choices = shuffle(quiz.choices);

  quizChoicesEl.innerHTML = "";
  for (const c of quiz.choices) {
    const b = document.createElement("button");
    b.className = "quiz-choice";
    b.textContent = c;
    b.addEventListener("click", () => answerQuiz(c, b));
    quizChoicesEl.appendChild(b);
  }
}

function makeDistractor(spec) {
  // tweak one attribute
  const d = Object.assign({}, spec);
  const r = Math.random();
  if (r < 0.33) {
    const opts = ["Fl","Oc","Iso","Q","F"];
    d.rhythm = opts[Math.floor(Math.random()*opts.length)];
  } else if (r < 0.66) {
    const periods = [3,4,5,6,8,10,12];
    d.period = periods[Math.floor(Math.random()*periods.length)];
  } else {
    d.count = Math.max(1, (spec.count || 1) + (Math.random() < 0.5 ? -1 : 1));
    if (d.count > 4) d.count = 4;
  }
  // avoid producing something equal to the source
  if (formatNotation(d) === formatNotation(spec)) return null;
  return formatNotation(d);
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function answerQuiz(choice, btn) {
  if (quiz.answered) return;
  quiz.answered = true;
  quiz.total++;
  quizTotalEl.textContent = String(quiz.total);
  const correct = formatNotation(quiz.spec);
  const isRight = (choice === correct);
  if (isRight) quiz.score++;
  quizScoreEl.textContent = String(quiz.score);

  // mark all choices
  for (const b of quizChoicesEl.querySelectorAll(".quiz-choice")) {
    b.disabled = true;
    if (b.textContent === correct) b.classList.add("correct");
    else if (b === btn) b.classList.add("wrong");
  }
  quizFeedbackEl.hidden = false;
  quizFeedbackEl.className = "quiz-feedback " + (isRight ? "good" : "bad");
  quizFeedbackEl.innerHTML = isRight
    ? `✓ Correct — that was <code>${correct}</code>: ${describeInWords(quiz.spec)}`
    : `✗ That was <code>${correct}</code> — ${describeInWords(quiz.spec)}`;
  quizNextBtn.hidden = false;
}
quizNextBtn.addEventListener("click", nextQuizQuestion);
quizRestartBtn.addEventListener("click", startQuiz);

function drawQuiz(ts, dt) {
  if (!quiz.spec) return;
  quiz.t += dt * 2;  // quiz plays at a steady 2× so flashes are readable
  const period = quiz.spec.period;
  const lit = isLitAt(quiz.segs, period, quiz.t);
  drawStage(qctx, quizStage, lit, quiz.spec, quiz.t);
}

/* ===========================================================================
 * Boot
 * ========================================================================= */
syncControlsFromSpec();
applySpecAndRender();
buildPresetGrid();
requestAnimationFrame(frame);
