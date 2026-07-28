'use strict';

/* ============================================================
   THE BACKROOMS — an endless procedural liminal-space walker.
   Wolfenstein-style raycaster (canvas 2D, no WebGL), infinite
   deterministic floorplan from hashed value noise, per-pixel
   floor/ceiling casting, flickering fluorescents, Web Audio hum.
   ============================================================ */

const W = 320, H = 180;
const PLANE = 0.66;            // ~66° FOV
const MAXD = 26;               // ray march limit (cells)
const WALL_T = 0.60;           // noise threshold → wall
const NOISE_SCALE = 3.05;      // wall blob size (cells)

const view = document.getElementById('view');
const ctx = view.getContext('2d');
ctx.imageSmoothingEnabled = false;

const levelLabel = document.getElementById('level-label');
const metersEl = document.getElementById('meters');
const fadeEl = document.getElementById('fade');
const splashEl = document.getElementById('splash');
const splashTitle = document.getElementById('splash-title');
const splashSub = document.getElementById('splash-sub');
const startEl = document.getElementById('start');

/* ---------------- deterministic hash / value noise ---------------- */

function hash2(x, y) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const sstep = t => t * t * (3 - 2 * t);

function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const a = hash2(ix, iy),     b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  const u = sstep(fx), v = sstep(fy);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/* ---------------- world (infinite, per-level) ---------------- */

let level = 0;

function isWallCell(cx, cy) {
  const s = level * 57.31; // decorrelate levels
  return vnoise(cx / NOISE_SCALE + s, cy / NOISE_SCALE + s * 1.7) > WALL_T;
}
function isDoorCell(cx, cy) {
  return !isWallCell(cx, cy) &&
         hash2(cx * 3 + 11 + level * 733, cy * 5 + 37) < 0.0016;
}
const raySolid = (cx, cy) => isWallCell(cx, cy) || isDoorCell(cx, cy);

function findSpawn(sx, sy) {
  for (let r = 0; r < 60; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const cx = sx + dx, cy = sy + dy;
      if (!isWallCell(cx, cy) && !isDoorCell(cx, cy)) return [cx, cy];
    }
  }
  return [sx, sy];
}

/* ---------------- textures ---------------- */
/* Walls are drawn per-column via drawImage from a canvas.
   Floor/ceiling are sampled per-pixel from rgba arrays. */

function makeCanvas() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  return c;
}

function buildDoorTex() {
  const c = makeCanvas(), g = c.getContext('2d');
  g.fillStyle = '#020202'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#0d0c08'; g.fillRect(0, 0, 3, 64); g.fillRect(61, 0, 3, 64);
  g.fillStyle = '#111008'; g.fillRect(0, 0, 64, 3);
  return c;
}
const doorTex = buildDoorTex();

let TEX = null; // { wallCv, floorArr, ceilLitArr, ceilPlainArr, fogD }

function buildTextures() {
  const hue = 48 - Math.min(level * 7, 34);       // yellow → sickly olive
  const sat = Math.max(24, 50 - level * 3);
  const lig = Math.max(28, 52 - level * 3);

  // --- wallpaper ---
  const wc = makeCanvas(), g = wc.getContext('2d');
  g.fillStyle = `hsl(${hue},${sat}%,${lig}%)`; g.fillRect(0, 0, 64, 64);
  g.globalAlpha = 0.22;
  g.fillStyle = `hsl(${hue},${sat}%,${lig - 14}%)`;
  for (let x = 0; x < 64; x += 8) g.fillRect(x, 0, 2, 64);      // stripes
  g.globalAlpha = 0.16;
  g.fillStyle = `hsl(${hue},${sat + 8}%,${lig - 20}%)`;
  for (let y = 4; y < 64; y += 16)                              // motif row
    for (let x = 4; x < 64; x += 16) {
      g.beginPath();                                            // small diamond
      g.moveTo(x, y - 3); g.lineTo(x + 3, y); g.lineTo(x, y + 3); g.lineTo(x - 3, y);
      g.fill();
    }
  g.globalAlpha = 0.25;                                          // grime
  for (let i = 0; i < 260; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(40,32,10,0.5)' : 'rgba(255,250,220,0.35)';
    g.fillRect(Math.random() * 64 | 0, Math.random() * 64 | 0, 1, 1);
  }
  g.globalAlpha = 1;
  g.fillStyle = `hsl(${hue - 12},28%,16%)`; g.fillRect(0, 58, 64, 6); // baseboard
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 56, 64, 2);

  // --- carpet ---
  const fc = makeCanvas(); { const f = fc.getContext('2d');
    f.fillStyle = `hsl(${hue - 14},30%,19%)`; f.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 900; i++) {
      const v = (Math.random() * 22 - 11) | 0;
      f.fillStyle = `hsl(${hue - 14},${28 + (Math.random() * 10 | 0)}%,${19 + v}%)`;
      f.fillRect(Math.random() * 64 | 0, Math.random() * 64 | 0, 1, 1);
    }
  }

  // --- ceiling tiles (lit + plain) ---
  const cl = makeCanvas(); { const c2 = cl.getContext('2d');
    c2.fillStyle = `hsl(${hue},12%,70%)`; c2.fillRect(0, 0, 64, 64);
    c2.fillStyle = `hsl(${hue},10%,52%)`;
    c2.fillRect(0, 0, 64, 2); c2.fillRect(0, 62, 64, 2);
    c2.fillRect(0, 0, 2, 64); c2.fillRect(62, 0, 2, 64);
    const grad = c2.createLinearGradient(0, 22, 0, 42);          // light panel
    grad.addColorStop(0, '#fffdf2'); grad.addColorStop(0.5, '#fffbe4');
    grad.addColorStop(1, '#f2ecd0');
    c2.fillStyle = grad; c2.fillRect(7, 23, 50, 18);
    c2.fillStyle = 'rgba(120,110,80,0.6)'; c2.fillRect(7, 23, 50, 1);
    c2.fillRect(7, 40, 50, 1);
  }
  const cp = makeCanvas(); { const c3 = cp.getContext('2d');
    c3.fillStyle = `hsl(${hue},10%,62%)`; c3.fillRect(0, 0, 64, 64);
    c3.fillStyle = `hsl(${hue},9%,48%)`;
    c3.fillRect(0, 0, 64, 2); c3.fillRect(0, 62, 64, 2);
    c3.fillRect(0, 0, 2, 64); c3.fillRect(62, 0, 2, 64);
    for (let i = 0; i < 60; i++) {                               // stains
      c3.fillStyle = 'rgba(90,80,55,0.25)';
      c3.fillRect(Math.random() * 64 | 0, Math.random() * 64 | 0, 2, 1);
    }
  }

  TEX = {
    wallCv: wc,
    floorArr: fc.getContext('2d').getImageData(0, 0, 64, 64).data,
    ceilLitArr: cl.getContext('2d').getImageData(0, 0, 64, 64).data,
    ceilPlainArr: cp.getContext('2d').getImageData(0, 0, 64, 64).data,
    fogD: Math.max(9, 15 - level),
  };
}

/* ceiling light state per cell: 0 = no panel, 0.12 = dead panel, 1 = lit */
function cellLight(cx, cy) {
  const h = hash2(cx * 17 + level * 131, cy * 29 + 7);
  if (h < 0.45) return 0;
  if (h > 0.97) return 0.12;
  return 1;
}

/* ---------------- player ---------------- */

let px = 2.5, py = 2.5, ang = 0;
let meters = 0;
let locked = true;

{
  const s = findSpawn(2, 2);
  px = s[0] + 0.5; py = s[1] + 0.5;
  ang = mostOpenAngle();
}
buildTextures();

/* face the direction with the longest unobstructed ray (avoid spawning
   nose-first into a wall) */
function mostOpenAngle() {
  let best = 0, bestD = -1;
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4;
    const dx = Math.cos(a), dy = Math.sin(a);
    let d = 0;
    while (d < 12 && !raySolid(Math.floor(px + dx * d), Math.floor(py + dy * d))) d += 0.25;
    if (d > bestD) { bestD = d; best = a; }
  }
  return best;
}

const keys = Object.create(null);
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
  begin();
});
addEventListener('keyup', e => { keys[e.code] = false; });

/* mouse-drag turning (trackpad friendly) */
let dragging = false, lastMX = 0;
view.addEventListener('mousedown', e => { dragging = true; lastMX = e.clientX; });
addEventListener('mouseup', () => { dragging = false; });
addEventListener('mousemove', e => {
  if (!dragging || locked) return;
  ang += (e.clientX - lastMX) * 0.005;
  lastMX = e.clientX;
});

/* ---------------- audio: the hum ---------------- */

let AC = null, humBus = null, humOsc = null, humOsc2 = null;

function initAudio() {
  AC = new (window.AudioContext || window.webkitAudioContext)();
  if (AC.state === 'suspended') AC.resume();
  const master = AC.createGain(); master.gain.value = 0.9; master.connect(AC.destination);
  humBus = AC.createGain(); humBus.gain.value = 0.05; humBus.connect(master);

  humOsc = AC.createOscillator(); humOsc.type = 'sine'; humOsc.frequency.value = 110;
  const g1 = AC.createGain(); g1.gain.value = 1.0;
  humOsc.connect(g1); g1.connect(humBus); humOsc.start();

  humOsc2 = AC.createOscillator(); humOsc2.type = 'sine'; humOsc2.frequency.value = 220;
  const g2 = AC.createGain(); g2.gain.value = 0.32;
  humOsc2.connect(g2); g2.connect(humBus); humOsc2.start();

  const o3 = AC.createOscillator(); o3.type = 'sawtooth'; o3.frequency.value = 55;
  const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 240;
  const g3 = AC.createGain(); g3.gain.value = 0.22;
  o3.connect(lp); lp.connect(g3); g3.connect(humBus); o3.start();

  // faint room tone: looped filtered noise
  const len = AC.sampleRate * 2;
  const buf = AC.createBuffer(1, len, AC.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
  const ns = AC.createBufferSource(); ns.buffer = buf; ns.loop = true;
  const lp2 = AC.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 180;
  const g4 = AC.createGain(); g4.gain.value = 0.012;
  ns.connect(lp2); lp2.connect(g4); g4.connect(master); ns.start();
}

function setLevelTone() {
  if (!AC) return;
  const f = 110 * Math.pow(0.93, level);
  humOsc.frequency.setTargetAtTime(f, AC.currentTime, 0.4);
  humOsc2.frequency.setTargetAtTime(f * 2, AC.currentTime, 0.4);
}

/* ---------------- start / transitions ---------------- */

let started = false;
function begin() {
  if (started) return;
  started = true;
  locked = false;
  startEl.classList.add('hidden');
  initAudio();
  splash('LEVEL 0', 'mono-yellow wallpaper. moist carpet. 600 million square miles, give or take.');
}
startEl.addEventListener('mousedown', begin);

function splash(title, sub) {
  splashTitle.textContent = title;
  splashSub.textContent = sub;
  splashEl.classList.add('on');
  setTimeout(() => splashEl.classList.remove('on'), 2400);
}

const flavor = [
  'the wallpaper repeats.',
  'you have been here before.',
  'the hum is closer now.',
  'the carpet is damper here.',
  'some lights are out. some were never on.',
  'do not listen for footsteps.',
  'the exit signs lied.',
  'it goes further down.',
];

function startTransition() {
  if (locked) return;
  locked = true;
  fadeEl.classList.add('on');
  setTimeout(() => {
    level++;
    buildTextures();
    setLevelTone();
    const s = findSpawn(Math.floor(px), Math.floor(py));
    px = s[0] + 0.5; py = s[1] + 0.5;
    levelLabel.textContent = 'LEVEL ' + level;
    splash('LEVEL ' + level, flavor[(level - 1) % flavor.length]);
    setTimeout(() => { fadeEl.classList.remove('on'); locked = false; }, 900);
  }, 600);
}

/* ---------------- movement + collision ---------------- */

function tryMove(dx, dy) {
  const r = 0.22;
  const nx = px + dx;
  if (!isWallCell(Math.floor(nx + Math.sign(dx) * r), Math.floor(py))) px = nx;
  const ny = py + dy;
  if (!isWallCell(Math.floor(px), Math.floor(ny + Math.sign(dy) * r))) py = ny;
  if (isDoorCell(Math.floor(px), Math.floor(py))) startTransition();
}

/* ---------------- flicker ---------------- */

let bright = 1, flickT = 0, nextFlick = 4;

function updateFlicker(dt) {
  nextFlick -= dt;
  if (nextFlick <= 0) {
    flickT = 0.15 + Math.random() * 0.6;
    nextFlick = Math.max(1.2, 2.5 + Math.random() * 7 - level * 0.4);
  }
  if (flickT > 0) {
    flickT -= dt;
    bright = 0.25 + Math.random() * 0.75;
  } else {
    bright += (1 - bright) * Math.min(1, dt * 8);
  }
}

/* ---------------- render ---------------- */

const frame = ctx.createImageData(W, H);

// vignette, prerendered
const vig = makeCanvas(); vig.width = W; vig.height = H;
{
  const g = vig.getContext('2d');
  const rg = g.createRadialGradient(W/2, H/2, H*0.35, W/2, H/2, H*0.95);
  rg.addColorStop(0, 'rgba(0,0,0,0)');
  rg.addColorStop(1, 'rgba(0,0,0,0.55)');
  g.fillStyle = rg; g.fillRect(0, 0, W, H);
}

// film grain
const grainCv = document.getElementById('grain');
const grainCtx = grainCv.getContext('2d');
const grainImg = grainCtx.createImageData(160, 90);
let grainTick = 0;

function renderFloorCeil(dirX, dirY, plX, plY) {
  const d = frame.data;
  const fogD = TEX.fogD;
  for (let y = 0; y < H; y++) {
    const isCeil = y < H / 2;
    const p = isCeil ? (H / 2 - y) : (y - H / 2);
    let i = y * W * 4;
    if (p === 0) { // horizon row
      for (let x = 0; x < W; x++) { d[i]=10; d[i+1]=10; d[i+2]=8; d[i+3]=255; i+=4; }
      continue;
    }
    const rowDist = (0.5 * H) / p;
    const fog = Math.max(0.04, 1 - rowDist / fogD);
    const stepX = rowDist * 2 * plX / W;
    const stepY = rowDist * 2 * plY / W;
    let fx = px + rowDist * (dirX - plX);
    let fy = py + rowDist * (dirY - plY);
    for (let x = 0; x < W; x++) {
      const cx = Math.floor(fx), cy = Math.floor(fy);
      const tx = ((fx - cx) * 64) | 0;
      const ty = ((fy - cy) * 64) | 0;
      const ti = (ty * 64 + tx) * 4;
      let arr, m;
      if (isCeil) {
        const L = cellLight(cx, cy);
        if (L > 0) { arr = TEX.ceilLitArr; m = L * bright * fog; }
        else { arr = TEX.ceilPlainArr; m = fog * 0.9; }
      } else {
        arr = TEX.floorArr; m = fog;
      }
      d[i]     = arr[ti]     * m;
      d[i + 1] = arr[ti + 1] * m;
      d[i + 2] = arr[ti + 2] * m;
      d[i + 3] = 255;
      fx += stepX; fy += stepY; i += 4;
    }
  }
  ctx.putImageData(frame, 0, 0);
}

function renderWalls(dirX, dirY, plX, plY) {
  const fogD = TEX.fogD;
  for (let x = 0; x < W; x++) {
    const cam = 2 * x / W - 1;
    const rdx = dirX + plX * cam;
    const rdy = dirY + plY * cam;
    let mapX = Math.floor(px), mapY = Math.floor(py);
    const ddx = rdx === 0 ? 1e30 : Math.abs(1 / rdx);
    const ddy = rdy === 0 ? 1e30 : Math.abs(1 / rdy);
    let stepX, stepY, sdX, sdY;
    if (rdx < 0) { stepX = -1; sdX = (px - mapX) * ddx; }
    else { stepX = 1; sdX = (mapX + 1 - px) * ddx; }
    if (rdy < 0) { stepY = -1; sdY = (py - mapY) * ddy; }
    else { stepY = 1; sdY = (mapY + 1 - py) * ddy; }

    let side = 0, hit = false, door = false;
    for (let n = 0; n < 64; n++) {
      if (sdX < sdY) { sdX += ddx; mapX += stepX; side = 0; }
      else { sdY += ddy; mapY += stepY; side = 1; }
      if (isWallCell(mapX, mapY)) { hit = true; break; }
      if (isDoorCell(mapX, mapY)) { hit = true; door = true; break; }
      if (Math.min(sdX, sdY) > MAXD) break;
    }
    if (!hit) continue;

    let perp = side === 0 ? sdX - ddx : sdY - ddy;
    perp = Math.max(perp, 0.03);
    const lineH = H / perp;
    const y0 = (H - lineH) / 2;
    let wallX = side === 0 ? py + perp * rdy : px + perp * rdx;
    wallX -= Math.floor(wallX);
    let texX = (wallX * 64) | 0;
    if ((side === 0 && rdx > 0) || (side === 1 && rdy < 0)) texX = 63 - texX;

    ctx.drawImage(door ? doorTex : TEX.wallCv, texX, 0, 1, 64, x, y0, 1, lineH);

    let sh = Math.min(0.92, perp / fogD);
    if (side === 1) sh = Math.min(0.95, sh + 0.16);
    if (door) sh = Math.max(sh, 0.3);
    ctx.fillStyle = `rgba(0,0,0,${sh})`;
    ctx.fillRect(x, y0, 1, lineH);
  }
}

function render() {
  const dirX = Math.cos(ang), dirY = Math.sin(ang);
  const plX = -dirY * PLANE, plY = dirX * PLANE;
  renderFloorCeil(dirX, dirY, plX, plY);
  renderWalls(dirX, dirY, plX, plY);
  if (bright < 0.99) {
    ctx.fillStyle = `rgba(0,0,0,${(1 - bright) * 0.45})`;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.drawImage(vig, 0, 0);

  if (++grainTick % 3 === 0) {
    const gd = grainImg.data;
    for (let i = 0; i < gd.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      gd[i] = v; gd[i + 1] = v; gd[i + 2] = v; gd[i + 3] = 14;
    }
    grainCtx.putImageData(grainImg, 0, 0);
  }
}

/* ---------------- main loop ---------------- */

let last = performance.now();

function frameLoop(t) {
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;

  if (!locked) {
    const rot = 2.6 * dt;
    if (keys.ArrowLeft || keys.KeyQ) ang -= rot;
    if (keys.ArrowRight || keys.KeyE) ang += rot;
    const mv = 3.1 * dt;
    let dx = 0, dy = 0;
    if (keys.KeyW || keys.ArrowUp) { dx += Math.cos(ang) * mv; dy += Math.sin(ang) * mv; }
    if (keys.KeyS || keys.ArrowDown) { dx -= Math.cos(ang) * mv; dy -= Math.sin(ang) * mv; }
    if (keys.KeyA) { dx += Math.sin(ang) * mv; dy -= Math.cos(ang) * mv; }
    if (keys.KeyD) { dx -= Math.sin(ang) * mv; dy += Math.cos(ang) * mv; }
    if (dx || dy) {
      tryMove(dx, dy);
      meters += Math.hypot(dx, dy);
      metersEl.textContent = Math.round(meters) + ' m';
    }
  }

  updateFlicker(dt);
  if (humBus) humBus.gain.value = 0.05 * (0.55 + 0.6 * bright);
  render();
  requestAnimationFrame(frameLoop);
}
requestAnimationFrame(frameLoop);

/* tiny test handle — lets automated checks find a doorway and verify the
   level transition without wandering for minutes */
window.__br = {
  level: () => level,
  pos: () => [px, py],
  nearestDoor() {
    const cx = Math.floor(px), cy = Math.floor(py);
    for (let r = 1; r < 200; r++)
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (isDoorCell(cx + dx, cy + dy)) return [cx + dx, cy + dy];
      }
    return null;
  },
  teleport(x, y, a) { px = x; py = y; if (a !== undefined) ang = a; },
};
