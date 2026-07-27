// Morphogen — Gray-Scott reaction-diffusion, all local, no deps.
// U + 2V -> 3V, V -> P.  Two chemicals diffuse at different rates; the fast
// "kill" of V and steady "feed" of U keep the system from settling. The gap
// between the two diffusion rates is what lets Turing patterns crystallize.

const canvas = document.getElementById("dish");
const ctx = canvas.getContext("2d", { willReadFrequently: false });
const W = canvas.width;   // grid columns (200)
const H = canvas.height;  // grid rows (200)
const N = W * H;

// Two buffers per chemical, ping-ponged each step.
let u = new Float32Array(N);
let v = new Float32Array(N);
let u2 = new Float32Array(N);
let v2 = new Float32Array(N);

// Simulation constants (Karl Sims / mrob conventions, dt = 1).
const Du = 1.0;
const Dv = 0.5;
let feed = 0.0545;
let kill = 0.062;
const STEPS_PER_FRAME = 8;

let running = true;
let brush = 10;

// --- palettes: three colour stops each, dark -> mid -> bright ---
const palettes = {
  Biolume: ["#04121a", "#0fb5a4", "#e7fff7"],
  Ember: ["#140702", "#ff6a00", "#ffe9b0"],
  Ink: ["#05060f", "#4b6bff", "#e2e8ff"],
  Bone: ["#0a0a0c", "#8a8f9c", "#ffffff"],
};
let paletteName = "Biolume";
let lut = buildLUT(paletteName); // 256-entry lookup: value -> packed RGBA

// --- curated Gray-Scott recipes (feed, kill) ---
const recipes = [
  { name: "Corals", f: 0.0545, k: 0.062 },
  { name: "Mitosis", f: 0.0367, k: 0.0649 },
  { name: "Labyrinth", f: 0.029, k: 0.057 },
  { name: "Spots", f: 0.035, k: 0.065 },
  { name: "Worms", f: 0.078, k: 0.061 },
  { name: "Pulses", f: 0.025, k: 0.06 },
];
let recipeIndex = 0;

// ----------------------------------------------------------------------------
// Colour helpers
// ----------------------------------------------------------------------------
function hexToRGB(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function buildLUT(name) {
  const [c0, c1, c2] = palettes[name].map(hexToRGB);
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    // two-segment gradient: c0->c1 for t<0.5, c1->c2 above
    let r, g, b;
    if (t < 0.5) {
      const s = t / 0.5;
      r = c0[0] + (c1[0] - c0[0]) * s;
      g = c0[1] + (c1[1] - c0[1]) * s;
      b = c0[2] + (c1[2] - c0[2]) * s;
    } else {
      const s = (t - 0.5) / 0.5;
      r = c1[0] + (c2[0] - c1[0]) * s;
      g = c1[1] + (c2[1] - c1[1]) * s;
      b = c1[2] + (c2[2] - c1[2]) * s;
    }
    // 0xAABBGGRR little-endian packing for the ImageData Uint32 view
    table[i] = (255 << 24) | (b << 16) | (g << 8) | r;
  }
  return table;
}

// ----------------------------------------------------------------------------
// Field setup
// ----------------------------------------------------------------------------
function clear() {
  u.fill(1);
  v.fill(0);
}

function inoculate(cx, cy, r, jitter = false) {
  const rr = r * r;
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y > rr) continue;
      const px = ((cx + x) % W + W) % W;
      const py = ((cy + y) % H + H) % H;
      const idx = py * W + px;
      const amt = jitter ? 0.5 + Math.random() * 0.5 : 0.5;
      v[idx] = amt;
      u[idx] = 0.25;
    }
  }
}

function reseed() {
  clear();
  // a scatter of blobs so the whole dish comes alive
  const blobs = 7 + Math.floor(Math.random() * 6);
  for (let i = 0; i < blobs; i++) {
    inoculate(
      Math.floor(Math.random() * W),
      Math.floor(Math.random() * H),
      3 + Math.floor(Math.random() * 6),
      true
    );
  }
}

// ----------------------------------------------------------------------------
// The reaction-diffusion step (toroidal / wrap-around edges)
// ----------------------------------------------------------------------------
function step() {
  for (let y = 0; y < H; y++) {
    const yUp = ((y - 1 + H) % H) * W;
    const yDn = ((y + 1) % H) * W;
    const yC = y * W;
    for (let x = 0; x < W; x++) {
      const xL = (x - 1 + W) % W;
      const xR = (x + 1) % W;
      const c = yC + x;

      const uc = u[c];
      const vc = v[c];

      // 3x3 Laplacian: orthogonal 0.2, diagonal 0.05, centre -1
      const lu =
        u[yC + xL] * 0.2 + u[yC + xR] * 0.2 + u[yUp + x] * 0.2 + u[yDn + x] * 0.2 +
        u[yUp + xL] * 0.05 + u[yUp + xR] * 0.05 + u[yDn + xL] * 0.05 + u[yDn + xR] * 0.05 -
        uc;
      const lv =
        v[yC + xL] * 0.2 + v[yC + xR] * 0.2 + v[yUp + x] * 0.2 + v[yDn + x] * 0.2 +
        v[yUp + xL] * 0.05 + v[yUp + xR] * 0.05 + v[yDn + xL] * 0.05 + v[yDn + xR] * 0.05 -
        vc;

      const uvv = uc * vc * vc;
      let nu = uc + (Du * lu - uvv + feed * (1 - uc));
      let nv = vc + (Dv * lv + uvv - (kill + feed) * vc);

      // clamp for numerical safety
      u2[c] = nu < 0 ? 0 : nu > 1 ? 1 : nu;
      v2[c] = nv < 0 ? 0 : nv > 1 ? 1 : nv;
    }
  }
  // ping-pong
  let t = u; u = u2; u2 = t;
  t = v; v = v2; v2 = t;
}

// ----------------------------------------------------------------------------
// Rendering
// ----------------------------------------------------------------------------
const img = ctx.createImageData(W, H);
const pix32 = new Uint32Array(img.data.buffer);

function render() {
  for (let i = 0; i < N; i++) {
    // contrast between the two chemicals reads best; scale into [0,255]
    let t = (u[i] - v[i]);        // ~ -0.x .. 1
    t = (1 - t);                  // invert so V-rich regions glow
    let idx = (t * 255) | 0;
    if (idx < 0) idx = 0; else if (idx > 255) idx = 255;
    pix32[i] = lut[idx];
  }
  ctx.putImageData(img, 0, 0);
}

// ----------------------------------------------------------------------------
// Main loop
// ----------------------------------------------------------------------------
function frame() {
  if (running) {
    for (let s = 0; s < STEPS_PER_FRAME; s++) step();
  }
  render();
  requestAnimationFrame(frame);
}

// ----------------------------------------------------------------------------
// Pointer painting
// ----------------------------------------------------------------------------
let painting = false;

function gridFromEvent(e) {
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * W;
  const y = ((e.clientY - rect.top) / rect.height) * H;
  return [Math.floor(x), Math.floor(y)];
}

canvas.addEventListener("pointerdown", (e) => {
  painting = true;
  canvas.setPointerCapture(e.pointerId);
  const [x, y] = gridFromEvent(e);
  inoculate(x, y, (brush / 2) | 0);
});

canvas.addEventListener("pointermove", (e) => {
  if (!painting) return;
  const [x, y] = gridFromEvent(e);
  inoculate(x, y, (brush / 2) | 0);
});

canvas.addEventListener("pointerup", () => (painting = false));
canvas.addEventListener("pointercancel", () => (painting = false));

// ----------------------------------------------------------------------------
// UI wiring
// ----------------------------------------------------------------------------
const feedEl = document.getElementById("feed");
const killEl = document.getElementById("kill");
const brushEl = document.getElementById("brush");
const feedVal = document.getElementById("feed-val");
const killVal = document.getElementById("kill-val");
const brushVal = document.getElementById("brush-val");
const recipeName = document.getElementById("recipe-name");
const playBtn = document.getElementById("play");

function syncSliders() {
  feedEl.value = feed;
  killEl.value = kill;
  feedVal.textContent = feed.toFixed(4);
  killVal.textContent = kill.toFixed(4);
}

feedEl.addEventListener("input", () => {
  feed = parseFloat(feedEl.value);
  feedVal.textContent = feed.toFixed(4);
});
killEl.addEventListener("input", () => {
  kill = parseFloat(killEl.value);
  killVal.textContent = kill.toFixed(4);
});
brushEl.addEventListener("input", () => {
  brush = parseInt(brushEl.value, 10);
  brushVal.textContent = brush;
});

// recipe buttons
const recipesBox = document.getElementById("recipes");
recipes.forEach((r, i) => {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = r.name;
  b.setAttribute("aria-pressed", i === recipeIndex ? "true" : "false");
  b.addEventListener("click", () => setRecipe(i));
  recipesBox.appendChild(b);
});

function setRecipe(i) {
  recipeIndex = i;
  const r = recipes[i];
  feed = r.f;
  kill = r.k;
  recipeName.textContent = r.name;
  syncSliders();
  [...recipesBox.children].forEach((b, j) =>
    b.setAttribute("aria-pressed", j === i ? "true" : "false")
  );
  reseed();
}

// palette buttons
const palettesBox = document.getElementById("palettes");
Object.keys(palettes).forEach((name) => {
  const b = document.createElement("button");
  b.type = "button";
  b.setAttribute("aria-pressed", name === paletteName ? "true" : "false");
  const sw = document.createElement("span");
  sw.className = "swatch";
  sw.style.background = `linear-gradient(90deg, ${palettes[name].join(",")})`;
  b.appendChild(sw);
  b.appendChild(document.createTextNode(name));
  b.addEventListener("click", () => {
    paletteName = name;
    lut = buildLUT(name);
    [...palettesBox.children].forEach((x) =>
      x.setAttribute("aria-pressed", x === b ? "true" : "false")
    );
  });
  palettesBox.appendChild(b);
});

function togglePlay() {
  running = !running;
  playBtn.textContent = running ? "⏸ Pause" : "▶ Play";
}

playBtn.addEventListener("click", togglePlay);
document.getElementById("seed").addEventListener("click", reseed);
document.getElementById("clear").addEventListener("click", clear);

document.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT") return;
  if (e.code === "Space") { e.preventDefault(); togglePlay(); }
  else if (e.key === "r" || e.key === "R") reseed();
  else if (e.key === "c" || e.key === "C") clear();
  else if (e.key === "n" || e.key === "N") setRecipe((recipeIndex + 1) % recipes.length);
});

// ----------------------------------------------------------------------------
// Boot
// ----------------------------------------------------------------------------
syncSliders();
brushVal.textContent = brush;
reseed();
frame();
