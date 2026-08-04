'use strict';

/* black-cow — a root beer float physics toy
 *
 * Model: everything is measured in mL against a 600 mL glass.
 *   surfaceY = GB - (fill + submerged scoops + foam) * PX_PER_ML
 * The scoop floats (55% of its volume underwater — ice cream is ~0.55 g/mL),
 * its rough surface nucleates CO2 into bubbles, bubbles pop into foam,
 * foam collapses over time, and anything above the rim spills onto the
 * counter. Pour root beer onto a scoop and the fizz wakes up violently:
 * that's Wisner's rule.
 */

/* ---------------- geometry ---------------- */

const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');

const W = 640, H = 660;
const GX = 310;          // glass centre x
const GT = 122;          // glass rim y
const GB = 452;          // glass bottom y
const GWT = 168;         // glass top width
const GWB = 132;         // glass bottom width
const GH = GB - GT;
const CAP = 600;         // mL at the rim
const PX_PER_ML = GH / CAP;     // 0.55 px per mL
const PX_PER_MM = 1.65;         // cosmetic scale for the readout

const BX = 170, BY = 98;        // bottle anchor (body centre)
const BOTTLE_TIP = 54;          // mouth offset from anchor
const POUR_X = GX - 40;         // where the stream lands
const POUR_RATE = 165;          // mL/s

const SIZES = { 60: 27, 90: 33, 130: 39 };   // scoop volume mL -> radius px
const FOAM_TAU = { 1.0: 12, 0.8: 8, 0.55: 5 };  // foam decay time constant, s

const FACTS = [
  'The root beer float was invented in 1893 by Frank Wisner at Cripple Creek Brewing, Colorado. He called it a "black cow".',
  'National Root Beer Float Day is August 6 — A&W hands out free floats from 2–8 pm at most locations.',
  "Wisner's rule: root beer first, scoop after. Reverse the order and the fizz volcanoes over the rim.",
  'Ice cream floats because it is lighter: ~0.55 g/mL against root beer\u2019s ~1.0. Only about half the scoop sits under the surface.',
  'The head is CO\u2082 escaping solution. The scoop\u2019s rough, cold surface is packed with nucleation sites — that is where the foam is born.',
  'A "brown cow" is a cola float, a "purple cow" is grape soda, and a "Boston cooler" is vanilla ice cream with Vernors ginger ale.',
  'The 1893 "black cow" predates the root beer trademark by two years — the float came first, the name followed.',
];

/* ---------------- state ---------------- */

const state = {
  fill: 0,          // mL root beer in the glass
  foam: 0,          // mL foam
  spill: 0,         // mL on the counter
  scoops: [],       // {x, y, vy, r, vol, seed, phase, landT}
  bubbles: [],      // {x, y, vy, r, rf, phase}
  rings: [],        // {x, y, r, life}
  drips: [],        // {x, y, vy, wob, side}
  spray: [],        // {x, y, vx, vy, r, life}
  pouring: false,
  warned: false,
  carb: 0.75,
  temp: 1.0,        // fizz factor: 1.0 chilled, 0.8 room, 0.55 warm
  scoopVol: 90,
  t: 0,
};

/* ---------------- helpers ---------------- */

function rr(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function glassPath(inset) {
  const l = GX - GWT / 2 + inset, rt = GX + GWT / 2 - inset;
  const lb = GX - GWB / 2 + inset, rb = GX + GWB / 2 - inset;
  const r0 = 15;
  ctx.beginPath();
  ctx.moveTo(l, GT + 2);
  ctx.lineTo(lb, GB - r0);
  ctx.quadraticCurveTo(lb, GB, lb + r0, GB);
  ctx.lineTo(rb - r0, GB);
  ctx.quadraticCurveTo(rb, GB, rb, GB - r0);
  ctx.lineTo(rt, GT + 2);
}

function baseSurfaceY() {
  return GB - (state.fill + state.foam) * PX_PER_ML;
}

/* submerged volume of a scoop: full 55% if it floats, less if it bottoms out */
function subVol(s) {
  const surf = baseSurfaceY();
  const depth = GB - surf;
  if (depth >= s.r * 1.1) return 0.55 * s.vol;
  if (depth <= 0) return 0;
  return Math.min(0.55, (depth / (s.r * 2)) * 0.6) * s.vol;
}

function totalV() {
  let v = state.fill + state.foam;
  for (const s of state.scoops) v += subVol(s);
  return v;
}

function surfaceY() { return GB - totalV() * PX_PER_ML; }
function foamTopY() { return surfaceY() - state.foam * PX_PER_ML; }

function rand(a, b) { return a + Math.random() * (b - a); }

/* ---------------- physics ---------------- */

function spawnBubble(x, y, sizeFactor) {
  if (state.bubbles.length > 420) return;
  const r = rand(1.7, 2.7) * sizeFactor;
  state.bubbles.push({
    x: x + rand(-1, 1), y,
    vy: -(rand(42, 82)) * (1.3 - 0.3 * state.temp),
    r, rf: r / 2.2,
    phase: rand(0, Math.PI * 2),
  });
}

function scoopBubbles(s, dt) {
  /* bubbles nucleate on the submerged surface of the scoop */
  const rate = state.carb * (6 + 40 * state.temp) * dt;
  let n = Math.floor(rate) + (Math.random() < rate % 1 ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const dy = Math.sqrt(Math.random()) * s.r * 0.95;
    const dx = (Math.random() * 2 - 1) * Math.sqrt(Math.max(0, s.r * s.r - dy * dy)) * 0.9;
    spawnBubble(s.x + dx, s.y + dy, 1.45 - 0.45 * state.temp);
  }
}

function popBubble(b) {
  state.foam += 0.06 * b.rf;
  if (Math.random() < 0.08) {
    state.rings.push({ x: b.x, y: b.y, r: 2, life: 0 });
  }
}

function splash(s) {
  s.landT = state.t;
  s.landed = true;
  state.foam += 1.6 * (s.vol / 90);
  for (let i = 0; i < 10; i++) {
    state.spray.push({
      x: s.x + rand(-6, 6), y: s.y - s.r * 0.4,
      vx: rand(-70, 70), vy: rand(-170, -40),
      r: rand(2, 4), life: 0,
    });
  }
  for (let i = 0; i < 22; i++) spawnBubble(s.x + rand(-10, 10), s.y + rand(-6, 8), 1.2);
}

function dropScoop(x) {
  if (state.scoops.length >= 3) {
    toast('Three scoops is reckless — the glass has a limit.', 'warn');
    return;
  }
  state.scoops.push({
    x: x ?? GX + rand(-26, 26),
    y: -40, vy: 0,
    r: SIZES[state.scoopVol],
    vol: state.scoopVol,
    seed: Math.random() * 1000,
    phase: 0,      // 0 falling, 1 settled
    landed: false, // splash() fires exactly once per drop
    landT: -10,
  });
  judge();
}

function step(dt) {
  /* --- pouring --- */
  if (state.pouring) {
    const surf = surfaceY();
    const impactY = Math.min(surf, foamTopY()) - 3;
    state.fill += POUR_RATE * dt;
    state.foam += 0.5 * dt;            /* pouring sloshes a little head into being */

    if (state.scoops.length > 0) {
      if (!state.warned) {
        toast("Wisner's rule: root beer first, scoop after. You poured onto the scoop — the fizz is waking up.", 'warn');
        state.warned = true;
      }
      /* volcano: strong nucleation right where the stream hits the scoop */
      const strength = 0.3 + 0.7 * (state.fill / CAP);
      const n = Math.floor(230 * strength * dt);
      for (let i = 0; i < n; i++) spawnBubble(POUR_X + rand(-6, 6), impactY, 2.2);
    }
    const n = Math.floor(state.carb * 40 * dt);
    for (let i = 0; i < n; i++) spawnBubble(POUR_X + rand(-8, 8), impactY, 1.2);
  } else {
    state.warned = false;
  }

  /* --- scoops --- */
  for (const s of state.scoops) {
    const surf = surfaceY();
    const floatOK = (GB - surf) >= s.r * 1.1;
    const restY = floatOK ? surf + 0.05 * s.r : GB - s.r - 2;
    if (s.phase === 0) {
      s.vy += 1500 * dt;
      s.y += s.vy * dt;
      if (s.y >= restY) { s.y = restY; s.phase = 1; if (!s.landed) splash(s); }
    } else {
      /* settled: ride the surface gently, never re-trigger the fall */
      s.y += (restY - s.y) * Math.min(1, dt * 5);
    }
    scoopBubbles(s, dt);
  }

  /* --- bubbles --- */
  const surf = surfaceY();
  for (let i = state.bubbles.length - 1; i >= 0; i--) {
    const b = state.bubbles[i];
    b.y += b.vy * dt;
    b.x += Math.sin(b.phase + state.t * 2.2) * 10 * dt;
    b.r += 1.4 * dt;
    if (b.y <= surf + rand(0, 3)) { popBubble(b); state.bubbles.splice(i, 1); }
  }

  /* --- foam life --- */
  const tau = FOAM_TAU[state.temp] ?? 40;
  state.foam -= state.foam * dt / tau;
  if (foamTopY() < GT) state.foam -= state.foam * dt / 4;   // over the rim: collapses fast

  /* --- overflow --- */
  const V = totalV();
  if (V > CAP) {
    let ex = (V - CAP) * 2.2 * dt;
    const fromFoam = Math.min(state.foam, ex);
    state.foam -= fromFoam; ex -= fromFoam;
    const fromFill = Math.min(state.fill, ex);
    state.fill -= fromFill;
    state.spill += fromFoam + fromFill;
    if (state.drips.length < 40 && Math.random() < dt * 9) {
      const side = Math.random() < 0.5 ? -1 : 1;
      state.drips.push({
        x: GX + side * (GWT / 2 - 3), y: GT + 6,
        vy: rand(26, 56), wob: rand(0, 6.28), side,
      });
    }
  }

  /* --- drips --- */
  for (let i = state.drips.length - 1; i >= 0; i--) {
    const d = state.drips[i];
    d.y += d.vy * dt;
    d.x += Math.sin(d.wob + state.t * 3) * 6 * dt;
    if (d.y > GB + 4) state.drips.splice(i, 1);
  }

  /* --- spray --- */
  for (let i = state.spray.length - 1; i >= 0; i--) {
    const p = state.spray[i];
    p.vy += 600 * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.life += dt;
    if (p.life > 1.1 || p.y > GB + 40) state.spray.splice(i, 1);
  }

  /* --- rings --- */
  for (let i = state.rings.length - 1; i >= 0; i--) {
    const r = state.rings[i];
    r.r += 30 * dt; r.life += dt;
    if (r.life > 0.6) state.rings.splice(i, 1);
  }
}

/* ---------------- render ---------------- */

function draw() {
  const t = state.t;
  const surf = surfaceY();
  const foamH = state.foam * PX_PER_ML;
  const foamTop = surf - foamH;

  /* wall */
  const wall = ctx.createLinearGradient(0, 0, 0, H);
  wall.addColorStop(0, '#efe6cf');
  wall.addColorStop(1, '#f2ead6');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, W, H);

  /* counter */
  const wood = ctx.createLinearGradient(0, 470, 0, H);
  wood.addColorStop(0, '#93643a');
  wood.addColorStop(1, '#6e4526');
  ctx.fillStyle = wood;
  ctx.fillRect(0, 470, W, H - 470);
  ctx.fillStyle = 'rgba(255, 235, 200, 0.35)';
  ctx.fillRect(0, 470, W, 4);
  ctx.strokeStyle = 'rgba(60, 30, 10, 0.18)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 7; i++) {
    const y = 486 + i * 27 + Math.sin(i * 3.1) * 4;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(W * 0.3, y + 3, W * 0.7, y - 3, W, y + 1);
    ctx.stroke();
  }

  /* puddle */
  if (state.spill > 1) {
    const rx = Math.min(12 + state.spill * 0.5, 72);
    ctx.fillStyle = 'rgba(122, 58, 20, 0.35)';
    ctx.beginPath();
    ctx.ellipse(GX, GB + 10, rx, rx * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /* glass body glow */
  glassPath(5);
  ctx.lineWidth = 12;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)';
  ctx.stroke();

  /* liquid */
  ctx.save();
  glassPath(6);
  ctx.clip();
  if (surf < GB) {
    const liq = ctx.createLinearGradient(0, surf - 50, 0, GB + 30);
    liq.addColorStop(0, 'rgba(170, 98, 42, 0.92)');
    liq.addColorStop(0.45, 'rgba(124, 61, 22, 0.94)');
    liq.addColorStop(1, 'rgba(74, 36, 12, 0.96)');
    ctx.fillStyle = liq;
    ctx.fillRect(GX - GWT / 2, surf - 50, GWT, GB + 40 - surf + 50);

    /* wavy surface highlight */
    ctx.beginPath();
    const x0 = GX - GWT / 2 + 8, x1 = GX + GWT / 2 - 8;
    for (let x = x0; x <= x1; x += 4) {
      const y = surf + Math.sin(x * 0.045 + t * 2.2) * 2.2;
      if (x === x0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.lineTo(x1, surf - 8);
    ctx.lineTo(x0, surf - 8);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 236, 200, 0.20)';
    ctx.fill();
  }
  ctx.restore();

  /* bubbles */
  for (const b of state.bubbles) {
    ctx.strokeStyle = 'rgba(255, 240, 214, 0.85)';
    ctx.lineWidth = 1.2;
    ctx.fillStyle = 'rgba(255, 240, 214, 0.10)';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  /* ripple rings */
  for (const r of state.rings) {
    ctx.strokeStyle = `rgba(255, 240, 214, ${0.7 * (1 - r.life / 0.6)})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    ctx.stroke();
  }

  /* foam */
  if (foamH > 0.8) {
    ctx.save();
    glassPath(6);
    ctx.clip();
    const band = ctx.createLinearGradient(0, foamTop - 2, 0, surf + 2);
    band.addColorStop(0, 'rgba(253, 249, 239, 0.97)');
    band.addColorStop(1, 'rgba(248, 240, 222, 0.88)');
    ctx.fillStyle = band;
    ctx.fillRect(GX - GWT / 2, foamTop - 3, GWT, foamH + 6);

    const blobs = Math.max(4, Math.min(46, Math.floor(foamH * 1.1)));
    for (let i = 0; i < blobs; i++) {
      const y = rand(foamTop - 2, surf - 1);
      const x = rand(GX - GWT / 2 + 8, GX + GWT / 2 - 8);
      const r = rand(3, foamH > 26 ? 9 : 6);
      ctx.fillStyle = 'rgba(255, 252, 244, 0.92)';
      ctx.strokeStyle = 'rgba(224, 208, 176, 0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (Math.random() < 0.4) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath();
        ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.45, Math.PI, Math.PI * 1.7);
        ctx.stroke();
      }
    }
    ctx.restore();
  } else if (surf < GB) {
    ctx.strokeStyle = 'rgba(255, 250, 240, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(GX - GWT / 2 + 8, surf);
    ctx.lineTo(GX + GWT / 2 - 8, surf);
    ctx.stroke();
  }

  /* scoops */
  for (const s of state.scoops) {
    const grad = ctx.createRadialGradient(s.x - s.r * 0.35, s.y - s.r * 0.4, s.r * 0.2, s.x, s.y, s.r);
    grad.addColorStop(0, '#fff6e0');
    grad.addColorStop(0.65, '#f3e3bc');
    grad.addColorStop(1, '#e2c99a');
    ctx.fillStyle = grad;
    ctx.strokeStyle = 'rgba(190, 150, 90, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    /* wet band below the surface line */
    if (surf < s.y + s.r) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = 'rgba(120, 60, 25, 0.30)';
      ctx.fillRect(s.x - s.r, Math.max(surf, s.y - s.r), s.r * 2, s.y + s.r);
      ctx.restore();
    }

    /* vanilla speckles (seeded) */
    let seed = s.seed;
    const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    ctx.fillStyle = 'rgba(214, 172, 110, 0.8)';
    for (let i = 0; i < 14; i++) {
      const a = rnd() * Math.PI * 2, d = rnd() * s.r * 0.72;
      ctx.beginPath();
      ctx.arc(s.x + Math.cos(a) * d, s.y + Math.sin(a) * d, 1.3 + rnd() * 1.3, 0, Math.PI * 2);
      ctx.fill();
    }

    /* highlight */
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(s.x - s.r * 0.3, s.y - s.r * 0.35, s.r * 0.55, Math.PI * 1.05, Math.PI * 1.55);
    ctx.stroke();

    /* landing ripple */
    if (t - s.landT < 0.5) {
      const p = (t - s.landT) / 0.5;
      ctx.strokeStyle = `rgba(255, 240, 214, ${0.6 * (1 - p)})`;
      ctx.beginPath();
      ctx.ellipse(s.x, surf, 8 + p * 26, 3 + p * 7, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  /* glass front */
  glassPath(5);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.26)';
  rr(GX - GWT / 2 + 7, GT + 16, 5, GB - GT - 46, 3);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(GX - GWT / 2, GT + 2);
  ctx.lineTo(GX + GWT / 2, GT + 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(GX, GT + 2, GWT / 2, 7, 0, 0, Math.PI * 2);
  ctx.stroke();

  /* drips on the outside wall */
  for (const d of state.drips) {
    ctx.fillStyle = 'rgba(122, 58, 20, 0.85)';
    ctx.beginPath();
    ctx.arc(d.x, d.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  /* bottle */
  const tilt = state.pouring ? 0.52 : 0.30;
  ctx.save();
  ctx.translate(BX, BY);
  ctx.rotate(tilt);
  const body = ctx.createLinearGradient(-17, 0, 17, 0);
  body.addColorStop(0, '#5e2f0e');
  body.addColorStop(0.35, '#8a4a1e');
  body.addColorStop(1, '#6b3512');
  ctx.fillStyle = body;
  rr(-17, -4, 34, 60, 9);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
  rr(-14, -2, 7, 40, 3);
  ctx.fill();
  ctx.fillStyle = '#2a2018';
  ctx.fillRect(-7, -46, 14, 42);
  ctx.fillRect(-8.5, -54, 17, 9);
  ctx.fillStyle = '#f4e9cf';
  rr(-16, 8, 32, 26, 3);
  ctx.fill();
  ctx.fillStyle = '#7c3d16';
  ctx.font = '8px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('ROOT', 0, 19);
  ctx.fillText('BEER', 0, 27);
  ctx.restore();

  /* stream */
  if (state.pouring) {
    const mx = BX + Math.sin(tilt) * BOTTLE_TIP;
    const my = BY - Math.cos(tilt) * BOTTLE_TIP;
    const iy = Math.max(foamTop, GT + 4) - 2;
    const cy = (my + iy) / 2 - 6;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.quadraticCurveTo(mx + 28, cy, POUR_X, iy);
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(150, 86, 38, 0.8)';
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(214, 150, 84, 0.9)';
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 240, 214, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(POUR_X, iy, 8, 3, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  /* spray droplets */
  for (const p of state.spray) {
    ctx.fillStyle = `rgba(122, 58, 20, ${Math.max(0, 1 - p.life / 1.1)})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* ---------------- verdict ---------------- */

const gradeEl = document.getElementById('grade');
const verdictEl = document.getElementById('verdict');

function judge() {
  const fillPct = state.fill / CAP;
  const crown = state.foam * PX_PER_ML;
  const n = state.scoops.length;
  let grade, name, text;

  if (state.spill > 18) {
    grade = 'D'; name = 'Counter Catastrophe';
    text = 'The foam won. The mop comes out; the glass gets a eulogy.';
  } else if (n === 0 && state.fill > 8) {
    grade = 'D'; name = 'Soda, Not a Float';
    text = 'A float needs a scoop. This is just root beer with ambition.';
  } else if (state.fill < CAP * 0.3) {
    grade = 'D'; name = 'Sip, Not a Float';
    text = 'Three pours minimum, one scoop. Wisner poured six inches.';
  } else if (state.spill > 0) {
    grade = 'C'; name = 'Rim Accident';
    text = 'You tasted the float AND the counter. The head escaped.';
  } else if (crown > 42) {
    grade = 'C'; name = 'Torrential Head';
    text = 'Foam, not float. The crown is wearing the glass.';
  } else if (state.temp < 0.7 && fillPct > 0.5) {
    grade = 'C'; name = 'Warm Flatliner';
    text = 'Warm root beer fizzes big, then dies flat. Chill the bottle.';
  } else if (n >= 3) {
    grade = 'C'; name = 'Three Scoops of Reckless';
    text = 'The glass cannot hold that ambition. Two scoops, max.';
  } else if (fillPct > 0.97) {
    grade = 'C'; name = 'Rim-Rider';
    text = 'So close that the foam is literally on the edge.';
  } else if (state.carb < 0.35 && crown < 6) {
    grade = 'B'; name = 'Smooth Operator';
    text = 'Low fizz, high dignity. A quiet glass of amber.';
  } else if (crown < 4 && state.carb >= 0.35) {
    grade = 'B'; name = 'Quiet Float';
    text = 'Where is the head? Give the fizz a moment before judging.';
  } else if (fillPct < 0.55) {
    grade = 'B'; name = 'Shy Pour';
    text = 'Good crown, thin pour. One more pull on the spout.';
  } else {
    grade = 'A'; name = 'Black Cow, 1893 Class';
    text = 'Frank Wisner would serve this: root beer first, scoop after, foam crowning just past the rim.';
  }

  gradeEl.className = 'grade grade-' + grade.toLowerCase();
  gradeEl.textContent = grade;
  verdictEl.textContent = `${name} — ${text}`;
}

/* ---------------- UI ---------------- */

const $ = id => document.getElementById(id);

function toast(msg, kind) {
  const el = document.createElement('div');
  el.className = 'toast' + (kind === 'warn' ? ' warn' : '');
  el.textContent = msg;
  $('toasts').appendChild(el);
  setTimeout(() => el.remove(), 3400);
}

function reset() {
  state.fill = 0;
  state.foam = 0;
  state.spill = 0;
  state.scoops = [];
  state.bubbles = [];
  state.rings = [];
  state.drips = [];
  state.spray = [];
  state.pouring = false;
  state.warned = false;
  $('toasts').innerHTML = '';
  judge();
}

function demo() {
  reset();
  toast('Demo — the 1893 way: root beer first, scoop after.');
  state.pouring = true;
  setTimeout(() => { state.pouring = false; }, 2000);        /* ~330 mL, leaves headroom for the crown */
  setTimeout(() => dropScoop(GX + rand(-10, 10)), 2450);
  setTimeout(() => toast('Your turn — Fresh glass, or pour your own. Hold the pour button.'), 3500);
}

$('carb').addEventListener('input', e => {
  state.carb = e.target.value / 100;
  $('carbVal').textContent = e.target.value + '%';
});

$('tempSeg').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  state.temp = parseFloat(b.dataset.temp);
  $('tempSeg').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
});
$('sizeSeg').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  state.scoopVol = parseInt(b.dataset.vol, 10);
  $('sizeSeg').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
});

const pourBtn = $('pourBtn');
pourBtn.addEventListener('pointerdown', e => {
  pourBtn.setPointerCapture(e.pointerId);
  state.pouring = true;
});
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) {
  pourBtn.addEventListener(ev, () => { state.pouring = false; });
}

$('scoopBtn').addEventListener('click', () => dropScoop());
$('demoBtn').addEventListener('click', demo);
$('resetBtn').addEventListener('click', reset);

window.addEventListener('keydown', e => {
  if (e.code === 'Space') { e.preventDefault(); state.pouring = true; }
  else if (e.key === 's' || e.key === 'S') dropScoop();
  else if (e.key === 'r' || e.key === 'R') reset();
});
window.addEventListener('keyup', e => {
  if (e.code === 'Space') state.pouring = false;
});

/* facts rotation */
const factEl = $('fact');
let fi = Math.floor(Math.random() * FACTS.length);
factEl.textContent = FACTS[fi];
setInterval(() => {
  fi = (fi + 1) % FACTS.length;
  factEl.textContent = FACTS[fi];
}, 7000);

/* ---------------- loop ---------------- */

function fit() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
fit();

const rFill = $('rFill'), rCrown = $('rCrown'), rSpill = $('rSpill');

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  state.t += dt;
  step(dt);
  draw();

  rFill.textContent = Math.round(state.fill);
  rCrown.textContent = Math.round(state.foam * PX_PER_ML / PX_PER_MM);
  rSpill.textContent = Math.round(state.spill);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

setInterval(judge, 400);

/* run the demo once on load so the page opens on a finished float */
demo();
