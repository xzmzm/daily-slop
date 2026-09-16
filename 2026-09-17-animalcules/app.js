/* ==========================================================================
   The Little Animals — the four live machines.
   All numbers come from engine.js; this file only draws and animates.
   ========================================================================== */
import * as E from './engine.js';

const $ = (sel) => document.querySelector(sel);
const LAMBDA = 0.55;                     // µm, photopic green
const SCREW_PITCH = 0.5;                 // mm/turn, modelled fine screw (NOTES.md)

const state = {
  D: 1.6, n: 1.52, pupil: 0.152,         // Machine I bead
  D2: 1.6, NA: 0.152, glass: 'sodalime', // Machine II chart
  sample: 'self', vinegar: false, speedMix: 1, scrapeMg: 1, // Machine III
  floorUm: 1.4,                          // Machine IV
};

const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const sup = (x) => String(x).split('').map((c) => SUP[c] ?? c).join('');
const big = (x) => {
  if (x <= 0) return '0';
  const e = Math.floor(Math.log10(x));
  const m = x / 10 ** e;
  return e >= -1 && e <= 4 ? Math.round(x).toLocaleString('en-US') : `${m.toFixed(1)}×10${sup(e)}`;
};
const fx = (x, d = 2) => x.toFixed(d);

/* Shared derived optics for the bead the viewer is "holding". */
function beadModel() {
  const f = E.ballFocalLength(state.n, state.D);
  const M = E.ballMagnification(state.n, state.D);
  const NAfull = E.ballNA(state.n);
  const pupil = Math.min(state.pupil, NAfull - 0.004);
  const dDiff = E.abbeResolutionUm(state.n);
  return { f, M, NAfull, pupil, dDiff };
}

/* Shared chromatic model for Machine II's bead (its own glass + diameter). */
function colourModel() {
  const g = E.GLASSES.find((x) => x.id === state.glass);
  const df = E.axialChromatismUm(state.D2, g.nd, g.v);
  const naStar = E.optimalNA(LAMBDA, df);
  const dMin = E.minResolutionUm(LAMBDA, df);
  const blur = E.totalBlurUm(LAMBDA, df, state.NA);
  const M = E.ballMagnification(g.nd, state.D2);
  return { g, df, naStar, dMin, blur, M };
}

/* The blur Machine III actually shows: Machine I's bead, stopped down. */
function viewBlur() {
  const b = beadModel();
  const df = E.axialChromatismUm(state.D, state.n, 64);
  return { M: b.M, blur: E.totalBlurUm(LAMBDA, df, b.pupil) };
}

/* ==========================================================================
   Machine I — the bead of glass
   ========================================================================== */

const cvBead = $('#cv-bead');
const cBead = cvBead.getContext('2d');

function drawBead() {
  const W = cvBead.width, H = cvBead.height;
  const b = beadModel();
  const S = 150;                                   // px per mm
  const cx = 372, cy = H / 2;

  cBead.clearRect(0, 0, W, H);
  cBead.fillStyle = '#100d08';
  cBead.fillRect(0, 0, W, H);

  const Rpx = (state.D / 2) * S;
  const specX = cx - b.f * S;                      // specimen at the front focus

  /* optical axis */
  cBead.strokeStyle = 'rgba(237,226,203,0.14)';
  cBead.setLineDash([5, 6]);
  cBead.beginPath(); cBead.moveTo(24, cy); cBead.lineTo(W - 88, cy); cBead.stroke();
  cBead.setLineDash([]);

  /* the brass sandwich: two plates above and below the bead */
  const plate = (x0, x1, y, h) => {
    const grad = cBead.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, '#8a6a2a'); grad.addColorStop(0.5, '#5d471e'); grad.addColorStop(1, '#3d2f14');
    cBead.fillStyle = grad;
    cBead.fillRect(x0, y, x1 - x0, h);
  };
  plate(cx - Rpx - 46, cx + Rpx + 46, cy - Rpx - 74, 26);
  plate(cx - Rpx - 46, cx + Rpx + 46, cy + Rpx + 48, 26);
  cBead.strokeStyle = 'rgba(0,0,0,0.5)';
  cBead.strokeRect(cx - Rpx - 46, cy - Rpx - 74, (Rpx + 46) * 2, 26);
  cBead.strokeRect(cx - Rpx - 46, cy + Rpx + 48, (Rpx + 46) * 2, 26);

  /* the focus screw + specimen pin at left */
  const screwX = 52;
  cBead.fillStyle = '#2a2216';
  cBead.strokeStyle = '#8a6a2a';
  cBead.lineWidth = 2;
  cBead.beginPath(); cBead.arc(screwX, cy, 22, 0, Math.PI * 2); cBead.fill(); cBead.stroke();
  cBead.beginPath();
  cBead.moveTo(screwX - 14, cy); cBead.lineTo(screwX + 14, cy);
  cBead.moveTo(screwX - 14, cy + 6); cBead.lineTo(screwX + 14, cy + 6);
  cBead.stroke();
  label(cBead, 'focus screw', screwX, cy + 40, '#a99c80');

  /* the pin carrying the specimen */
  const grad2 = cBead.createLinearGradient(specX - 8, 0, specX, 0);
  grad2.addColorStop(0, '#8a6a2a'); grad2.addColorStop(1, '#d9a441');
  cBead.strokeStyle = grad2;
  cBead.lineWidth = 5;
  cBead.beginPath(); cBead.moveTo(screwX + 30, cy); cBead.lineTo(specX, cy); cBead.stroke();
  /* the scrape itself */
  cBead.fillStyle = '#74c79a';
  cBead.beginPath(); cBead.arc(specX, cy, 6.5, 0, Math.PI * 2); cBead.fill();
  cBead.fillStyle = 'rgba(116,199,154,0.35)';
  cBead.beginPath(); cBead.arc(specX, cy, 11, 0, Math.PI * 2); cBead.fill();

  /* the bead */
  const grad = cBead.createRadialGradient(cx - Rpx * 0.35, cy - Rpx * 0.4, Rpx * 0.1, cx, cy, Rpx);
  grad.addColorStop(0, 'rgba(240,230,207,0.55)');
  grad.addColorStop(0.55, 'rgba(217,164,65,0.16)');
  grad.addColorStop(1, 'rgba(122,167,199,0.34)');
  cBead.fillStyle = grad;
  cBead.beginPath(); cBead.arc(cx, cy, Rpx, 0, Math.PI * 2); cBead.fill();
  cBead.strokeStyle = 'rgba(240,230,207,0.8)';
  cBead.lineWidth = 1.5;
  cBead.beginPath(); cBead.arc(cx, cy, Rpx, 0, Math.PI * 2); cBead.stroke();
  cBead.fillStyle = 'rgba(255,255,255,0.5)';
  cBead.beginPath(); cBead.ellipse(cx - Rpx * 0.42, cy - Rpx * 0.48, Rpx * 0.18, Rpx * 0.1, -0.6, 0, Math.PI * 2); cBead.fill();

  /* the traced ray fan, limited by the accepted pupil cone */
  const hMax = (state.D / 2) * Math.min(1, state.pupil / b.NAfull);
  const rays = 13;
  for (let i = 0; i < rays; i++) {
    const h = ((i / (rays - 1)) * 2 - 1) * hMax * 0.96;
    const r = E.traceBallRay(state.n, state.D, Math.abs(h), b.f);
    if (!r || h === 0) continue;
    const sgn = Math.sign(h);
    const entry = { x: cx + r.entry.x * S, y: cy + r.entry.y * S * sgn };
    const exit = { x: cx + r.exit.x * S, y: cy + r.exit.y * S * sgn };
    cBead.strokeStyle = 'rgba(217,164,65,0.5)';
    cBead.lineWidth = 1;
    cBead.beginPath();
    cBead.moveTo(specX, cy); cBead.lineTo(entry.x, entry.y);
    cBead.lineTo(exit.x, exit.y);
    const dirY = r.exitDir.y * sgn, dirX = r.exitDir.x;
    const tEnd = dirX !== 0 ? (W - 96 - exit.x) / dirX : 1e9;
    cBead.lineTo(exit.x + dirX * Math.max(0, tEnd), exit.y + dirY * Math.max(0, tEnd));
    cBead.stroke();
  }

  /* dimension f (surface → specimen ≈ f − R … centre → specimen = f) */
  dim(cBead, cx, cy + Rpx + 90, specX, cx, `f = ${fx(b.f, 3)} mm`, '#d9a441');
  label(cBead, `D = ${fx(state.D, 2)} mm`, cx, cy - Rpx - 84, '#ede2cb');

  /* the eye */
  const ex = W - 58;
  cBead.strokeStyle = '#ede2cb';
  cBead.lineWidth = 2;
  cBead.beginPath();
  cBead.moveTo(ex - 26, cy); cBead.bezierCurveTo(ex - 14, cy - 20, ex + 12, cy - 20, ex + 24, cy);
  cBead.bezierCurveTo(ex + 12, cy + 20, ex - 14, cy + 20, ex - 26, cy);
  cBead.stroke();
  cBead.fillStyle = '#74c79a';
  cBead.beginPath(); cBead.arc(ex - 1, cy, 8, 0, Math.PI * 2); cBead.fill();
  cBead.fillStyle = '#14110c';
  cBead.beginPath(); cBead.arc(ex - 1, cy, 3.4, 0, Math.PI * 2); cBead.fill();
  label(cBead, 'the eye', ex - 12, cy + 36, '#a99c80');

  const arc = E.apparentArcmin(1, b.M);
  label(cBead, `a 1 µm feature looks ${fx(arc, 1)}′ tall to this eye`, cx - 60, H - 14,
    arc >= 1 ? '#74c79a' : '#c05a41');

  $('#v-diameter').textContent = `${fx(state.D, 2)} mm`;
  $('#v-index').textContent = fx(state.n, 3);
  $('#v-pupil').textContent = fx(Math.min(state.pupil, b.NAfull - 0.004), 3);

  const df = E.axialChromatismUm(state.D, state.n, 64);
  const blur = E.totalBlurUm(LAMBDA, df, state.pupil);
  const dof = E.depthOfFieldUm(LAMBDA, state.pupil);
  const deg = E.screwDegreesPerDOF(LAMBDA, state.pupil, SCREW_PITCH);
  const dMax = E.maxDiameterForEye(state.n);
  $('#ro-bead').innerHTML = `
    <h3>this bead</h3>
    <div class="kv"><span class="k">focal length f</span><span class="v hot">${fx(b.f, 3)} mm</span></div>
    <div class="kv"><span class="k">back focus (eye side)</span><span class="v">${fx(E.ballBackFocus(state.n, state.D), 3)} mm</span></div>
    <div class="kv"><span class="k">magnification</span><span class="v hot">${fx(b.M, 0)}×</span></div>
    <div class="formula">f = nD / 4(n−1)<br>M = 250 mm / f</div>
    <h3>the light it accepts</h3>
    <div class="kv"><span class="k">full-cone NA</span><span class="v">${fx(b.NAfull, 3)}</span></div>
    <div class="kv"><span class="k">diffraction limit</span><span class="v">${fx(b.dDiff, 3)} µm</span></div>
    <div class="kv"><span class="k">accepted cone (pupil)</span><span class="v">${fx(state.pupil, 3)}</span></div>
    <div class="kv"><span class="k">colour+diffraction blur</span><span class="v">${fx(blur, 2)} µm</span></div>
    <div class="formula">NA = R/f = 2(n−1)/n — no D in it.<br>Diameter buys magnification;<br>index buys resolution.</div>
    <h3>the eye's say</h3>
    <div class="kv"><span class="k">1 µm feature appears</span><span class="v ${arc >= 1 ? 'ok' : 'warm'}">${fx(arc, 1)} arcmin</span></div>
    <div class="kv"><span class="k">largest bead that clears the 1′ bar</span><span class="v">${fx(dMax, 2)} mm</span></div>
    <div class="note">The bead must stay pinhead-sized: any bigger and the finest detail its
    own diffraction allows falls below the eye's 1-arcminute bar. That is why Leeuwenhoek
    ground 1–2 mm beads — and never told anyone how.</div>
    <h3>the focus screw</h3>
    <div class="kv"><span class="k">depth of field at this cone</span><span class="v">${fx(dof, 1)} µm</span></div>
    <div class="kv"><span class="k">screw degrees per DOF</span><span class="v">${fx(deg, 1)}°</span></div>
    <div class="note">Stopped down for colour, ~${fx(deg, 0)}° of a ${SCREW_PITCH} mm screw spans the
    whole in-focus slab; at the full ${fx(b.NAfull, 2)} cone it would be
    ${fx(E.screwDegreesPerDOF(LAMBDA, b.NAfull, SCREW_PITCH), 1)}°. The pin, not the lens, moves.</div>
    <h3>against London</h3>
    <div class="chip ${b.M > E.HOOKE_MAG ? 'on' : 'off'}">${fx(b.M / E.HOOKE_MAG, 1)}× Hooke's compound</div>
    <div class="chip ${state.D <= E.ballDiameterFor(state.n, E.SURVIVORS.magMax) + 0.05 ? 'on' : ''}">within the survivors' range</div>`;
}

function label(ctx, text, x, y, color, size = 11.5, align = 'center') {
  ctx.fillStyle = color;
  ctx.font = `${size}px "SF Mono", Monaco, monospace`;
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
}

function dim(ctx, x0, y, x1, xRef, text, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x0, y - 6); ctx.lineTo(x0, y + 6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x1, y - 6); ctx.lineTo(x1, y + 6); ctx.stroke();
  ctx.setLineDash([4, 3]);
  ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
  ctx.setLineDash([]);
  label(ctx, text, (x0 + x1) / 2, y + 18, color);
}

/* ==========================================================================
   Machine II — the colour trap
   ========================================================================== */

const cvColour = $('#cv-colour');
const cColour = cvColour.getContext('2d');
const CH = { l: 56, r: 18, t: 18, b: 42 };
const NA_LO = 0.04, NA_HI = 0.72, BLUR_HI = 4.2;
const nx = (na) => CH.l + ((na - NA_LO) / (NA_HI - NA_LO)) * (cvColour.width - CH.l - CH.r);
const ny = (b) => cvColour.height - CH.b - (b / BLUR_HI) * (cvColour.height - CH.t - CH.b);

function drawColour() {
  const W = cvColour.width, H = cvColour.height;
  const m = colourModel();
  cColour.clearRect(0, 0, W, H);
  cColour.fillStyle = '#100d08';
  cColour.fillRect(0, 0, W, H);

  /* the measured band of the surviving instruments */
  cColour.fillStyle = 'rgba(217,164,65,0.13)';
  cColour.fillRect(CH.l, ny(E.SURVIVORS.resMaxUm), W - CH.l - CH.r, ny(E.SURVIVORS.resMinUm) - ny(E.SURVIVORS.resMaxUm));
  cColour.strokeStyle = 'rgba(217,164,65,0.5)';
  cColour.setLineDash([6, 4]);
  [E.SURVIVORS.resMinUm, E.SURVIVORS.resMaxUm].forEach((b) => {
    cColour.beginPath(); cColour.moveTo(CH.l, ny(b)); cColour.lineTo(W - CH.r, ny(b)); cColour.stroke();
  });
  cColour.setLineDash([]);
  label(cColour, 'surviving instruments measure 1–2.1 µm', W - CH.r - 8, ny(E.SURVIVORS.resMinUm) - 8, 'rgba(217,164,65,0.85)', 11, 'right');

  /* axes */
  cColour.strokeStyle = 'rgba(237,226,203,0.18)';
  cColour.fillStyle = '#a99c80';
  cColour.font = '10.5px "SF Mono", Monaco, monospace';
  for (let b = 0; b <= 4; b += 1) {
    cColour.beginPath(); cColour.moveTo(CH.l, ny(b)); cColour.lineTo(W - CH.r, ny(b)); cColour.stroke();
    cColour.textAlign = 'right'; cColour.fillText(`${b}`, CH.l - 8, ny(b) + 3.5);
  }
  for (let na = 0.1; na <= 0.7001; na += 0.1) {
    cColour.beginPath(); cColour.moveTo(nx(na), CH.t); cColour.lineTo(nx(na), H - CH.b); cColour.stroke();
    cColour.textAlign = 'center'; cColour.fillText(fx(na, 1), nx(na), H - CH.b + 16);
  }
  label(cColour, 'accepted cone NA →', W - CH.r, H - 8, '#a99c80', 11, 'right');
  cColour.save();
  cColour.translate(14, H / 2); cColour.rotate(-Math.PI / 2);
  label(cColour, 'smallest detail (µm)', 0, 0, '#a99c80', 11);
  cColour.restore();

  const curve = (fn, color, width = 2) => {
    cColour.strokeStyle = color; cColour.lineWidth = width;
    cColour.beginPath();
    for (let px = CH.l; px <= W - CH.r; px += 2) {
      const na = NA_LO + ((px - CH.l) / (W - CH.l - CH.r)) * (NA_HI - NA_LO);
      const b = fn(na);
      if (b > BLUR_HI) { cColour.stroke(); cColour.beginPath(); continue; }
      if (px === CH.l) cColour.moveTo(px, ny(b)); else cColour.lineTo(px, ny(b));
    }
    cColour.stroke();
  };

  curve((na) => LAMBDA / (2 * na), '#74c79a');
  label(cColour, 'diffraction λ/2NA', nx(0.63), ny(LAMBDA / (2 * 0.63)) - 10, '#74c79a', 11, 'center');
  curve((na) => m.df * na, '#7aa7c7');
  label(cColour, `colour Δf·NA (Δf=${fx(m.df, 1)} µm)`, nx(0.62), ny(m.df * 0.62) - 10, '#7aa7c7', 11, 'center');
  curve((na) => E.totalBlurUm(LAMBDA, m.df, na), '#f0e6cf', 2.5);

  /* the optimum */
  cColour.fillStyle = '#d9a441';
  cColour.beginPath(); cColour.arc(nx(m.naStar), ny(m.dMin), 6, 0, Math.PI * 2); cColour.fill();
  cColour.strokeStyle = 'rgba(217,164,65,0.6)';
  cColour.beginPath(); cColour.arc(nx(m.naStar), ny(m.dMin), 11, 0, Math.PI * 2); cColour.stroke();
  label(cColour, `NA* = √(λ/2Δf) = ${fx(m.naStar, 3)}`, nx(m.naStar), ny(m.dMin) + 26, '#d9a441', 11, 'center');
  label(cColour, `d_min = √(λΔf) = ${fx(m.dMin, 2)} µm`, nx(m.naStar) + 10, ny(m.dMin) - 20, '#d9a441', 11, 'left');

  /* where the slider is */
  cColour.strokeStyle = 'rgba(192,90,65,0.75)';
  cColour.lineWidth = 1.5;
  cColour.beginPath(); cColour.moveTo(nx(state.NA), CH.t); cColour.lineTo(nx(state.NA), H - CH.b); cColour.stroke();
  cColour.fillStyle = '#c05a41';
  cColour.beginPath(); cColour.arc(nx(state.NA), ny(m.blur), 5, 0, Math.PI * 2); cColour.fill();

  $('#v-diameter2').textContent = `${fx(state.D2, 2)} mm`;
  $('#v-na').textContent = fx(state.NA, 3);

  const ratio = m.dMin / ((E.SURVIVORS.resMinUm + E.SURVIVORS.resMaxUm) / 2);
  $('#ro-colour').innerHTML = `
    <h3>this glass</h3>
    <div class="kv"><span class="k">type</span><span class="v">${m.g.label}</span></div>
    <div class="kv"><span class="k">n at 0.5876 µm</span><span class="v">${fx(m.g.nd, 3)}</span></div>
    <div class="kv"><span class="k">Abbe V</span><span class="v">${m.g.v}</span></div>
    <div class="kv"><span class="k">n(F) − n(C)</span><span class="v">${fx((m.g.nd - 1) / m.g.v, 5)}</span></div>
    <h3>the trade</h3>
    <div class="kv"><span class="k">axial colour Δf</span><span class="v cool">${fx(m.df, 2)} µm</span></div>
    <div class="kv"><span class="k">optimum cone NA*</span><span class="v hot">${fx(m.naStar, 3)}</span></div>
    <div class="kv"><span class="k">smallest detail there</span><span class="v hot">${fx(m.dMin, 2)} µm</span></div>
    <div class="kv"><span class="k">your cone now</span><span class="v">${fx(state.NA, 3)}</span></div>
    <div class="kv"><span class="k">your blur now</span><span class="v ${Math.abs(state.NA - m.naStar) < 0.02 ? 'ok' : ''}">${fx(m.blur, 2)} µm</span></div>
    <div class="formula">total² = (λ/2NA)² + (Δf·NA)²<br>NA* = √(λ / 2Δf)<br>d_min = √(λ·Δf)</div>
    <div class="kv"><span class="k">model / measured band</span><span class="v">${fx(ratio, 2)}×</span></div>
    <div class="note">The closed-form sweet spot lands within a factor of two of the
    1–2.1 µm actually measured on the surviving instruments (van Zuylen 1981) — the same
    game the real beads were playing: accept a wide cone and colour smears; stop down and
    diffraction wins. Flint glass drags the optimum down and left: more dispersion, worse
    floor. This bead at D = ${fx(state.D2, 1)} mm would magnify ${fx(m.M, 0)}×.</div>
    <div class="chip ${state.glass === 'sodalime' ? 'warm' : ''}">crown V≈64: the Delft default</div>
    <div class="chip ${state.glass === 'flint' ? 'off' : ''}">flint V≈36: Δf ×1.5</div>`;
}

/* ==========================================================================
   Machine III — the scurf of the teeth
   ========================================================================== */

const cvLetter = $('#cv-letter');
const cLetter = cvLetter.getContext('2d');

const SAMPLES = {
  self: { label: 'his own teeth', counts: { spirochete: 5, rod: 9, coccus: 7 }, speed: 1 },
  oldman: { label: 'the old man who never cleaned his teeth', counts: { spirochete: 13, rod: 17, coccus: 11 }, speed: 1.65 },
};

let creatures = [];
function spawnCreatures() {
  const s = SAMPLES[state.sample];
  creatures = [];
  const R = 168;
  const place = () => {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * R;
    return { x: 390 + r * Math.cos(a), y: 225 + r * Math.sin(a) };
  };
  for (let i = 0; i < s.counts.spirochete; i++) {
    const p = place();
    creatures.push({ kind: 'spirochete', x: p.x, y: p.y, a: Math.random() * Math.PI * 2, phase: Math.random() * 10, speed: 34 + Math.random() * 22 });
  }
  for (let i = 0; i < s.counts.rod; i++) {
    const p = place();
    creatures.push({ kind: 'rod', x: p.x, y: p.y, a: Math.random() * Math.PI * 2, rot: Math.random() * Math.PI * 2, phase: Math.random() * 10, speed: 9 + Math.random() * 7 });
  }
  for (let i = 0; i < s.counts.coccus; i++) {
    const p = place();
    creatures.push({ kind: 'coccus', x: p.x, y: p.y, phase: Math.random() * 10 });
  }
}

function drawLetter(dt) {
  const W = cvLetter.width, H = cvLetter.height;
  const view = viewBlur();
  const pxUm = Math.max(1.2, view.M * 0.02);
  const blurPx = Math.max(0.4, (view.blur * pxUm) / 2);
  const cx = 390, cy = 225, R = 205;

  cLetter.clearRect(0, 0, W, H);
  cLetter.fillStyle = '#100d08';
  cLetter.fillRect(0, 0, W, H);

  /* the round field of view */
  cLetter.save();
  cLetter.beginPath(); cLetter.arc(cx, cy, R, 0, Math.PI * 2); cLetter.clip();
  const grad = cLetter.createRadialGradient(cx - 60, cy - 70, 30, cx, cy, R * 1.15);
  grad.addColorStop(0, '#efe3c4');
  grad.addColorStop(0.55, '#d9c9a1');
  grad.addColorStop(1, '#8f7f5c');
  cLetter.fillStyle = grad;
  cLetter.fillRect(cx - R, cy - R, R * 2, R * 2);
  cLetter.restore();
  cLetter.strokeStyle = '#8a6a2a';
  cLetter.lineWidth = 4;
  cLetter.beginPath(); cLetter.arc(cx, cy, R, 0, Math.PI * 2); cLetter.stroke();

  /* creatures, blurred exactly as the bead's own blur dictates */
  const s = SAMPLES[state.sample];
  cLetter.save();
  cLetter.beginPath(); cLetter.arc(cx, cy, R - 3, 0, Math.PI * 2); cLetter.clip();
  cLetter.filter = `blur(${fx(blurPx, 2)}px)`;
  for (const c of creatures) {
    if (c.kind === 'spirochete') {
      c.phase += dt * 5 * state.speedMix;
      c.x += Math.cos(c.a) * c.speed * s.speed * state.speedMix * dt;
      c.y += Math.sin(c.a) * c.speed * s.speed * state.speedMix * dt;
      if ((c.x - cx) ** 2 + (c.y - cy) ** 2 > 168 * 168) c.a += Math.PI * (0.5 + Math.random() * 0.6);
      const L = 12 * pxUm;
      cLetter.strokeStyle = '#3f7d5c';
      cLetter.lineWidth = Math.max(1.6, 0.25 * pxUm);
      cLetter.beginPath();
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        const wob = Math.sin(t * Math.PI * 4 + c.phase) * L * 0.11;
        const px = c.x + Math.cos(c.a) * (t - 0.5) * L + Math.cos(c.a + Math.PI / 2) * wob;
        const py = c.y + Math.sin(c.a) * (t - 0.5) * L + Math.sin(c.a + Math.PI / 2) * wob;
        if (i === 0) cLetter.moveTo(px, py); else cLetter.lineTo(px, py);
      }
      cLetter.stroke();
    } else if (c.kind === 'rod') {
      c.rot += dt * 1.7 * state.speedMix;
      c.phase += dt * 4 * state.speedMix;
      c.x += Math.cos(c.a) * c.speed * s.speed * state.speedMix * dt;
      c.y += Math.sin(c.a) * c.speed * s.speed * state.speedMix * dt;
      if ((c.x - cx) ** 2 + (c.y - cy) ** 2 > 168 * 168) c.a += Math.PI * (0.6 + Math.random() * 0.8);
      const L = 4 * pxUm, Wd = Math.max(2, 1.0 * pxUm);
      cLetter.save();
      cLetter.translate(c.x, c.y); cLetter.rotate(c.rot + Math.sin(c.phase) * 0.5);
      cLetter.fillStyle = '#5a9a76';
      roundRect(cLetter, -L / 2, -Wd / 2, L, Wd, Wd / 2);
      cLetter.fill();
      cLetter.restore();
    } else {
      c.phase += dt * 2.2 * state.speedMix;
      const cell = Math.max(1.4, 0.8 * pxUm);
      cLetter.fillStyle = '#6d8f7b';
      for (let i = 0; i < 6; i++) {
        cLetter.beginPath();
        cLetter.arc(c.x + i * cell * 1.35 + Math.sin(c.phase + i) * 0.7, c.y + Math.cos(c.phase + i * 0.7) * 0.7, cell / 2, 0, Math.PI * 2);
        cLetter.fill();
      }
    }
  }
  cLetter.filter = 'none';
  cLetter.restore();

  /* scale furniture: 10 µm bar + a hair spanning ghost */
  const bar = 10 * pxUm;
  cLetter.strokeStyle = '#3d2f14';
  cLetter.lineWidth = 3;
  cLetter.beginPath();
  cLetter.moveTo(cx - R + 26, cy + R - 34); cLetter.lineTo(cx - R + 26 + bar, cy + R - 34);
  cLetter.stroke();
  label(cLetter, '10 µm', cx - R + 26 + bar / 2, cy + R - 42, '#3d2f14', 11);
  const hair = 70 * pxUm;
  cLetter.strokeStyle = 'rgba(61,47,20,0.55)';
  cLetter.setLineDash([6, 4]);
  cLetter.lineWidth = 1.5;
  cLetter.beginPath();
  cLetter.moveTo(cx - hair / 2, cy + R - 16); cLetter.lineTo(cx + hair / 2, cy + R - 16);
  cLetter.stroke();
  cLetter.setLineDash([]);
  label(cLetter, `a hair of one's head (${fx(70 * pxUm / pxUm, 0)} µm)`, cx, cy + R - 24, 'rgba(61,47,20,0.75)', 10.5);

  /* side annotations */
  label(cLetter, `${SAMPLES[state.sample].label}`, cx, 26, '#a99c80', 12);
  label(cLetter, `${fx(view.M, 0)}× · blur ${fx(view.blur, 2)} µm`, cx, 44, '#a99c80', 11);
  if (state.vinegar) {
    label(cLetter, 'wine vinegar — the swimmers lie still', cx, cy + R + 28, '#c05a41', 12);
  }

  /* readout */
  const count = E.plaqueCount(state.scrapeMg);
  const verdicts = E.SPECIES.map((sp) => {
    const seen = E.verdictFor(sp.lengthUm, view.blur);
    const shape = E.verdictFor(sp.widthUm, view.blur);
    return `<div class="kv"><span class="k">${sp.label.split('—')[0].trim()}</span>` +
      `<span class="v ${seen !== 'invisible' ? 'ok' : 'warm'}">${seen !== 'invisible' ? 'seen' : 'lost'} · ${shape === 'resolved' ? 'shape resolved' : shape === 'blip' ? 'a blip' : 'no shape'}</span></div>`;
  }).join('');
  $('#v-scrape').textContent = `${fx(state.scrapeMg, state.scrapeMg < 1 ? 2 : 1)} mg`;
  $('#ro-letter').innerHTML = `
    <h3>the letter</h3>
    <div class="kv"><span class="k">dated</span><span class="v hot">17 September 1683</span></div>
    <div class="kv"><span class="k">to</span><span class="v">Francis Aston</span></div>
    <div class="note">Published as "An Abstract of a Letter … containing Some Microscopical
    Observations, about Animals in the Scurf of the Teeth", Phil. Trans. 14 (1684).</div>
    <h3>through your bead</h3>
    <div class="kv"><span class="k">magnification</span><span class="v hot">${fx(view.M, 0)}×</span></div>
    <div class="kv"><span class="k">smallest detail</span><span class="v">${fx(view.blur, 2)} µm</span></div>
    ${verdicts}
    <div class="note">The pike is 12 µm long but only 0.25 µm thick — through the bead it is a
    darting thread whose shape never resolves, exactly as he drew it: a curve, not a worm.
    The third sort at 0.8 µm sits below the floor: "exceeding small", dots and heaps.</div>
    <h3>the company</h3>
    <div class="kv"><span class="k">scrape on the pin</span><span class="v">${fx(state.scrapeMg, state.scrapeMg < 1 ? 2 : 1)} mg</span></div>
    <div class="kv"><span class="k">creatures at 10¹¹/g wet</span><span class="v hot">${big(count)}</span></div>
    <div class="chip ${count > E.POPULATIONS[0].people ? 'on' : 'off'}">vs the Dutch Republic (1.9 M)</div>
    <div class="chip ${count > E.POPULATIONS[1].people ? 'on' : 'off'}">vs all Europe (110 M)</div>
    <div class="note">${state.sample === 'oldman' ? 'The old man\'s mouth: "an unbelievably great company … a-swimming more nimbly than any I had ever seen to this time."' : 'His own mouth: a mixed company, moderately stocked.'}
    ${state.vinegar ? ' The vinegar has stopped the swimmers.' : ''}</div>`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ==========================================================================
   Machine IV — the ladder and the timeline
   ========================================================================== */

const cvLadder = $('#cv-ladder');
const cLadder = cvLadder.getContext('2d');
const LOG_HI = 2.05, LOG_LO = -4;                    // 112 µm … 0.1 nm
const lx = (um) => 46 + ((Math.log10(um) - LOG_LO) / (LOG_HI - LOG_LO)) * (cvLadder.width - 46 - 20);

function drawLadder() {
  const W = cvLadder.width, H = cvLadder.height;
  cLadder.clearRect(0, 0, W, H);
  cLadder.fillStyle = '#100d08';
  cLadder.fillRect(0, 0, W, H);

  const baseY = H - 66;

  /* decade grid */
  for (let e = -4; e <= 2; e++) {
    const x = lx(10 ** e);
    cLadder.strokeStyle = 'rgba(237,226,203,0.09)';
    cLadder.beginPath(); cLadder.moveTo(x, 24); cLadder.lineTo(x, baseY + 26); cLadder.stroke();
    label(cLadder, e === 0 ? '1 µm' : `10${sup(e)}`, x, baseY + 42, '#6f6650', 10.5);
  }
  label(cLadder, 'each step ÷10 →', 50, 20, '#6f6650', 10.5, 'left');

  /* the resolution floor */
  const fxp = lx(state.floorUm);
  cLadder.strokeStyle = '#c05a41';
  cLadder.lineWidth = 2;
  cLadder.beginPath(); cLadder.moveTo(fxp, 26); cLadder.lineTo(fxp, baseY + 24); cLadder.stroke();
  cLadder.fillStyle = 'rgba(192,90,65,0.10)';
  cLadder.fillRect(fxp, 26, W - 20 - fxp, baseY - 2);

  /* tech floor markers */
  E.FLOORS.forEach((fl, i) => {
    const x = lx(fl.um);
    cLadder.strokeStyle = 'rgba(217,164,65,0.4)';
    cLadder.setLineDash([3, 4]);
    cLadder.beginPath(); cLadder.moveTo(x, 30); cLadder.lineTo(x, baseY + 12); cLadder.stroke();
    cLadder.setLineDash([]);
    label(cLadder, fl.label, x + (i % 2 ? 6 : -6), 34 + (i % 2) * 14, 'rgba(217,164,65,0.8)', 10, i % 2 ? 'left' : 'right');
  });

  /* ladder items */
  E.LADDER.forEach((item, i) => {
    const x = lx(item.sizeUm);
    const y = baseY - 30 - i * 46;
    const visible = item.sizeUm >= state.floorUm;
    const side = x > W - 200 ? -1 : 1;
    cLadder.strokeStyle = visible ? (item.kind === 'creature' ? '#74c79a' : '#d9a441') : '#4b4433';
    cLadder.lineWidth = 1.5;
    cLadder.beginPath(); cLadder.moveTo(x, baseY + 10); cLadder.lineTo(x, y + 8); cLadder.stroke();
    cLadder.fillStyle = visible ? (item.kind === 'creature' ? '#74c79a' : '#f0e6cf') : '#4b4433';
    if (item.kind === 'creature') {
      cLadder.beginPath(); cLadder.ellipse(x, y + 8, 13, 5, 0, 0, Math.PI * 2); cLadder.fill();
      cLadder.beginPath(); cLadder.ellipse(x + 19 * side, y + 8, 8, 4, -0.3 * side, 0, Math.PI * 2); cLadder.fill();
    } else {
      cLadder.fillRect(x - 2, y + 2, 4, 12);
    }
    label(cLadder, item.label, x + 10 * side, y, visible ? '#ede2cb' : '#6f6650', 11, side > 0 ? 'left' : 'right');
    label(cLadder, `${fx(item.sizeUm, item.sizeUm < 0.01 ? 4 : 2)} µm`, x + 10 * side, y + 24, '#8a7f66', 10, side > 0 ? 'left' : 'right');
  });

  const visibleCount = E.LADDER.filter((i) => i.kind === 'creature' && i.sizeUm >= state.floorUm).length;
  $('#v-floor').textContent = `${fx(state.floorUm, state.floorUm < 0.01 ? 4 : 2)} µm`;
  $('#ro-ladder').innerHTML = `
    <h3>the floor</h3>
    <div class="kv"><span class="k">resolution floor</span><span class="v hot">${fx(state.floorUm, state.floorUm < 0.01 ? 4 : 2)} µm</span></div>
    <div class="kv"><span class="k">creatures above it</span><span class="v">${visibleCount} of ${E.LADDER.filter((i) => i.kind === 'creature').length}</span></div>
    <div class="note">At Hooke's floor even the rod is lost. At the bead's 1.4 µm the rod's
    length and the pike's length show, but no width resolves. Only modern optics pulls the
    0.8 µm cocci into shape, and only the electron microscope sees what a spirochete is
    made of.</div>
    <h3>what survives of the man</h3>
    <div class="chip warm">500+ lenses</div>
    <div class="chip warm">~560 letters</div>
    <div class="chip">9 microscopes survive</div>
    <div class="chip">FRS 1680, never attended</div>
    <div class="note">After his death in 1723 his daughter sent a cabinet of microscopes to
    the Royal Society; it was lost. The nine known survivors magnify ${E.SURVIVORS.magMin}×–${E.SURVIVORS.magMax}×
    and resolve 1–2.1 µm — every number on this page is bounded by them.</div>`;
}

/* ==========================================================================
   wiring
   ========================================================================== */

function bind(id, fn) {
  $(id).addEventListener('input', (e) => { fn(parseFloat(e.target.value)); });
}

bind('#in-diameter', (v) => { state.D = v; });
bind('#in-index', (v) => { state.n = v; });
bind('#in-pupil', (v) => { state.pupil = v; });
bind('#in-diameter2', (v) => { state.D2 = v; });
bind('#in-na', (v) => { state.NA = v; });
bind('#in-scrape', (v) => { state.scrapeMg = 10 ** ((v / 100) * 2 - 1); });
bind('#in-floor', (v) => { state.floorUm = 10 ** (1 + (v / 1000) * (LOG_LO - 1)); });

$('#btn-275').addEventListener('click', () => {
  const D = E.ballDiameterFor(state.n, E.SURVIVORS.magMax);
  state.D = D;
  $('#in-diameter').value = fx(D, 2);
});
$('#btn-open-pupil').addEventListener('click', () => {
  state.pupil = E.ballNA(state.n) - 0.006;
  $('#in-pupil').value = fx(state.pupil, 3);
});

E.GLASSES.forEach((g) => {
  const b = document.createElement('button');
  b.className = 'doc-btn'; b.textContent = g.label; b.dataset.glass = g.id;
  b.addEventListener('click', () => {
    state.glass = g.id;
    document.querySelectorAll('#glass-btns .doc-btn').forEach((x) => x.classList.toggle('active', x.dataset.glass === g.id));
  });
  $('#glass-btns').appendChild(b);
});
document.querySelector('#glass-btns .doc-btn').classList.add('active');

function setSample(id) {
  state.sample = id;
  state.vinegar = false; state.speedMix = 1;
  $('#btn-sample-self').classList.toggle('active', id === 'self');
  $('#btn-sample-oldman').classList.toggle('active', id === 'oldman');
  $('#btn-vinegar').classList.remove('spent');
  spawnCreatures();
}
$('#btn-sample-self').addEventListener('click', () => setSample('self'));
$('#btn-sample-oldman').addEventListener('click', () => setSample('oldman'));
function pourVinegar() {
  state.vinegar = true;
  $('#btn-vinegar').classList.add('spent');
}
$('#btn-vinegar').addEventListener('click', pourVinegar);

E.FLOORS.forEach((fl) => {
  const b = document.createElement('button');
  b.className = 'doc-btn'; b.textContent = fl.label;
  b.addEventListener('click', () => {
    state.floorUm = fl.um;
    $('#in-floor').value = fx(((Math.log10(fl.um) - 1) / (LOG_LO - 1)) * 1000, 0);
  });
  $('#floor-btns').appendChild(b);
});

/* timeline */
E.TIMELINE.forEach(([date, title, body]) => {
  const div = document.createElement('div');
  div.className = 'tl-item' + (date === E.LETTER.date ? ' fire' : '');
  div.innerHTML = `<div class="tl-date">${date}</div><div class="tl-title">${title}</div>${body}`;
  $('#tl-track').appendChild(div);
});

/* video hooks, in the house style */
window.__anml = { setSample, pourVinegar };

/* main loop */
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  state.speedMix += ((state.vinegar ? 0 : 1) - state.speedMix) * Math.min(1, dt * 1.4);
  drawBead();
  drawColour();
  drawLetter(dt);
  drawLadder();
  requestAnimationFrame(loop);
}
spawnCreatures();
requestAnimationFrame(loop);
