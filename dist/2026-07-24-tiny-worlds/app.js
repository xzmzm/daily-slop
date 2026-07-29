// Tiny Worlds — seeded procedural landscapes on a <canvas>.
// No deps. A seed string -> deterministic world. Share via #seed=... in the URL.
(function () {
  "use strict";

  const W = 960;
  const H = 540;
  const canvas = document.getElementById("world");
  const ctx = canvas.getContext("2d");

  // ---- DOM ----
  const seedDisplay = document.getElementById("seedDisplay");
  const moodDisplay = document.getElementById("moodDisplay");
  const reshuffleBtn = document.getElementById("reshuffle");
  const copyBtn = document.getElementById("copy");
  const shareBtn = document.getElementById("share");
  const seedInput = document.getElementById("seedInput");
  const loadBtn = document.getElementById("loadSeed");
  const hintEl = document.getElementById("hint");

  // =====================================================================
  // Deterministic randomness
  // =====================================================================

  // cyrb53: string -> 53-bit-ish hash, returns a uint32 seed for mulberry32.
  function cyrb53(str, seed = 0) {
    let h1 = 0xdeadbeef ^ seed,
      h2 = 0x41c6ce57 ^ seed;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }

  // mulberry32: uint32 -> PRNG function returning [0,1).
  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Rng: friendly wrapper around a seeded PRNG.
  class Rng {
    constructor(seedStr) {
      this.seed = seedStr;
      this._n = mulberry32(cyrb53(seedStr) >>> 0);
    }
    next() {
      return this._n();
    }
    range(min, max) {
      return min + (max - min) * this._n();
    }
    int(min, max) {
      return Math.floor(this.range(min, max + 1));
    }
    pick(arr) {
      return arr[Math.floor(this._n() * arr.length)];
    }
    chance(p) {
      return this._n() < p;
    }
  }

  // =====================================================================
  // Color helper
  // =====================================================================
  function withAlpha(hex, a) {
    // hex like "#rrggbb" -> "rgba(r,g,b,a)"
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return `rgba(${r},${g},${b},${a})`;
  }

  // =====================================================================
  // Palettes — four times of day drive the whole mood.
  // =====================================================================
  const PALETTES = [
    {
      name: "dawn",
      mood: "first light",
      skyTop: "#2a3a5e",
      skyMid: "#c96f7a",
      skyHorizon: "#f6c69b",
      celestial: "#fff1c0",
      hill: "#3a4a63",
      hill2: "#4d5e78",
      waterTop: "#b97a86",
      waterBottom: "#2c3a52",
      night: false,
    },
    {
      name: "day",
      mood: "bright afternoon",
      skyTop: "#3f7fc4",
      skyMid: "#7fb8e8",
      skyHorizon: "#d6ecfb",
      celestial: "#fff6cc",
      hill: "#5a6f7a",
      hill2: "#7a8f9a",
      waterTop: "#6aa6d6",
      waterBottom: "#1f4a6a",
      night: false,
    },
    {
      name: "dusk",
      mood: "golden dusk",
      skyTop: "#2d2350",
      skyMid: "#c2506b",
      skyHorizon: "#f59a4b",
      celestial: "#ffd9a0",
      hill: "#2a2238",
      hill2: "#3c3050",
      waterTop: "#8a4a5a",
      waterBottom: "#1c1830",
      night: false,
    },
    {
      name: "night",
      mood: "moonlit night",
      skyTop: "#05060f",
      skyMid: "#0d1230",
      skyHorizon: "#2a2f55",
      celestial: "#eef2ff",
      hill: "#0a0e1f",
      hill2: "#141a36",
      waterTop: "#1a2040",
      waterBottom: "#05060f",
      night: true,
    },
  ];

  // =====================================================================
  // World model — everything derived from the seed.
  // =====================================================================
  function buildWorld(seedStr) {
    const rng = new Rng(seedStr);
    const pal = rng.pick(PALETTES);
    const horizonY = Math.round(rng.range(200, 270));

    // Celestial body position & size.
    const bodyR = rng.range(26, 42);
    const bodyX = rng.range(W * 0.2, W * 0.8);
    const bodyY = rng.range(70, horizonY - 60);

    // Hills: 2 layers, each a summed-sine silhouette.
    const hills = [0, 1].map((i) => ({
      color: i === 0 ? pal.hill2 : pal.hill, // farther layer drawn first, lighter
      baseY: horizonY - rng.range(4, 18) - i * 6,
      amp1: rng.range(12, 26),
      amp2: rng.range(4, 12),
      freq1: rng.range(0.004, 0.01),
      freq2: rng.range(0.012, 0.02),
      phase1: rng.range(0, Math.PI * 2),
      phase2: rng.range(0, Math.PI * 2),
    }));

    // Clouds: a few soft clusters.
    const clouds = [];
    const cloudCount = rng.int(2, 5);
    for (let i = 0; i < cloudCount; i++) {
      clouds.push({
        x: rng.range(0, W),
        y: rng.range(40, horizonY - 70),
        s: rng.range(0.7, 1.5),
        a: rng.range(0.25, 0.55),
      });
    }

    // Stars (night only).
    const stars = [];
    if (pal.night) {
      const sc = rng.int(60, 140);
      for (let i = 0; i < sc; i++) {
        stars.push({
          x: rng.range(0, W),
          y: rng.range(0, horizonY - 10),
          r: rng.range(0.4, 1.6),
          a: rng.range(0.3, 1),
        });
      }
    }

    // Birds: a few seagull "m" silhouettes in the sky.
    const birds = [];
    const birdCount = pal.night ? 0 : rng.int(0, 5);
    for (let i = 0; i < birdCount; i++) {
      birds.push({
        x: rng.range(60, W - 60),
        y: rng.range(60, horizonY - 30),
        s: rng.range(5, 9),
      });
    }

    // A sailboat near the horizon (sometimes).
    const boat = rng.chance(0.6)
      ? {
          x: rng.range(W * 0.15, W * 0.85),
          y: horizonY + rng.range(8, 40),
          s: rng.range(0.8, 1.4),
        }
      : null;

    // Ripple lines on the water.
    const ripples = [];
    const rc = rng.int(6, 12);
    for (let i = 0; i < rc; i++) {
      ripples.push({
        y: horizonY + rng.range(6, H - horizonY - 6),
        w: rng.range(20, 120),
        x: rng.range(0, W),
        a: rng.range(0.05, 0.18),
      });
    }

    return {
      seed: seedStr,
      pal,
      horizonY,
      body: { x: bodyX, y: bodyY, r: bodyR },
      hills,
      clouds,
      stars,
      birds,
      boat,
      ripples,
    };
  }

  // =====================================================================
  // Rendering
  // =====================================================================

  function drawSky(w) {
    const { pal, horizonY } = w;
    const g = ctx.createLinearGradient(0, 0, 0, horizonY);
    g.addColorStop(0, pal.skyTop);
    g.addColorStop(0.6, pal.skyMid);
    g.addColorStop(1, pal.skyHorizon);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, horizonY);
  }

  function drawStars(w) {
    for (const s of w.stars) {
      ctx.fillStyle = withAlpha("#ffffff", s.a);
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCelestial(w) {
    const { x, y, r } = w.body;
    const c = w.pal.celestial;
    // soft glow
    const g = ctx.createRadialGradient(x, y, r * 0.3, x, y, r * 5);
    g.addColorStop(0, withAlpha(c, 0.45));
    g.addColorStop(1, withAlpha(c, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 5, 0, Math.PI * 2);
    ctx.fill();
    // body
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    // craters for the moon
    if (w.pal.night) {
      const rng = new Rng(w.seed + "::moon");
      ctx.fillStyle = withAlpha("#9aa6c8", 0.5);
      for (let i = 0; i < 4; i++) {
        const ang = rng.range(0, Math.PI * 2);
        const dist = rng.range(0, r * 0.6);
        const cr = rng.range(2, 5);
        ctx.beginPath();
        ctx.arc(x + Math.cos(ang) * dist, y + Math.sin(ang) * dist, cr, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawClouds(w) {
    for (const cl of w.clouds) {
      const blobs = 4;
      ctx.fillStyle = w.pal.night
        ? withAlpha("#9fb0d8", cl.a * 0.5)
        : withAlpha("#ffffff", cl.a);
      for (let i = 0; i < blobs; i++) {
        const bx = cl.x + i * 16 * cl.s;
        const by = cl.y + Math.sin(i) * 4 * cl.s;
        const br = (14 + (i % 2) * 6) * cl.s;
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawBirds(w) {
    ctx.strokeStyle = withAlpha("#1a1a1a", 0.55);
    ctx.lineWidth = 1.5;
    for (const b of w.birds) {
      ctx.beginPath();
      ctx.moveTo(b.x - b.s, b.y + b.s * 0.4);
      ctx.quadraticCurveTo(b.x - b.s * 0.4, b.y - b.s * 0.5, b.x, b.y);
      ctx.quadraticCurveTo(b.x + b.s * 0.4, b.y - b.s * 0.5, b.x + b.s, b.y + b.s * 0.4);
      ctx.stroke();
    }
  }

  function hillY(h, x) {
    return (
      h.baseY -
      Math.sin(x * h.freq1 + h.phase1) * h.amp1 -
      Math.sin(x * h.freq2 + h.phase2) * h.amp2
    );
  }

  function drawHills(w) {
    // farther (lighter) layer first, then nearer (darker) on top.
    for (const h of w.hills) {
      ctx.fillStyle = h.color;
      ctx.beginPath();
      ctx.moveTo(0, w.horizonY);
      for (let x = 0; x <= W; x += 4) {
        ctx.lineTo(x, hillY(h, x));
      }
      ctx.lineTo(W, w.horizonY);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawWater(w) {
    const { pal, horizonY } = w;
    const g = ctx.createLinearGradient(0, horizonY, 0, H);
    g.addColorStop(0, pal.waterTop);
    g.addColorStop(1, pal.waterBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, horizonY, W, H - horizonY);

    // sun/moon reflection streak.
    const { x, r } = w.body;
    const reflH = H - horizonY;
    const rg = ctx.createLinearGradient(0, horizonY, 0, H);
    rg.addColorStop(0, withAlpha(pal.celestial, 0.5));
    rg.addColorStop(1, withAlpha(pal.celestial, 0));
    ctx.fillStyle = rg;
    const topW = r * 0.8;
    const botW = r * 2.4;
    ctx.beginPath();
    ctx.moveTo(x - topW, horizonY);
    ctx.lineTo(x + topW, horizonY);
    ctx.lineTo(x + botW, H);
    ctx.lineTo(x - botW, H);
    ctx.closePath();
    ctx.fill();

    // horizontal ripples — soft, scattered.
    for (const rp of w.ripples) {
      ctx.fillStyle = withAlpha(pal.night ? "#aab4d8" : "#ffffff", rp.a);
      ctx.fillRect(rp.x - rp.w / 2, rp.y, rp.w, 1);
    }
  }

  function drawBoat(w) {
    if (!w.boat) return;
    const { x, y, s } = w.boat;
    ctx.fillStyle = withAlpha("#10131a", 0.85);
    // hull
    ctx.beginPath();
    ctx.moveTo(x - 10 * s, y);
    ctx.lineTo(x + 10 * s, y);
    ctx.lineTo(x + 6 * s, y + 4 * s);
    ctx.lineTo(x - 6 * s, y + 4 * s);
    ctx.closePath();
    ctx.fill();
    // mast + sail
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 16 * s);
    ctx.lineTo(x + 9 * s, y - 2 * s);
    ctx.closePath();
    ctx.fill();
  }

  function drawVignette() {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.85);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function drawGrain(w) {
    const rng = new Rng(w.seed + "::grain");
    const n = 3500;
    for (let i = 0; i < n; i++) {
      const x = rng.range(0, W);
      const y = rng.range(0, H);
      const a = rng.range(0.01, 0.04);
      ctx.fillStyle = rng.chance(0.5)
        ? `rgba(255,255,255,${a})`
        : `rgba(0,0,0,${a})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  function renderWorld(w) {
    ctx.clearRect(0, 0, W, H);
    drawSky(w);
    if (w.pal.night) drawStars(w);
    drawCelestial(w);
    drawClouds(w);
    drawBirds(w);
    drawHills(w);
    drawWater(w);
    drawBoat(w);
    drawVignette();
    drawGrain(w);
  }

  // =====================================================================
  // Seed / URL handling
  // =====================================================================
  function randomSeed() {
    return Math.random().toString(36).slice(2, 8);
  }

  function seedFromHash() {
    const h = location.hash || "";
    const m = h.match(/[#&]seed=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function setHashSeed(seedStr) {
    // avoid scrolling/junk when updating in-place
    const url = `${location.pathname}${location.search}#seed=${encodeURIComponent(seedStr)}`;
    history.replaceState(null, "", url);
  }

  let currentWorld = null;

  function load(seedStr, opts = {}) {
    const seed = (seedStr || "").trim() || randomSeed();
    const w = buildWorld(seed);
    currentWorld = w;
    renderWorld(w);
    seedDisplay.textContent = seed;
    moodDisplay.textContent = "· " + w.pal.mood;
    setHashSeed(seed);
    if (opts.announce) flashHint(`loaded seed “${seed}”`);
  }

  // ---- transient hint ----
  let hintTimer = null;
  function flashHint(msg) {
    hintEl.textContent = msg;
    hintEl.classList.add("show");
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => hintEl.classList.remove("show"), 1600);
  }

  // =====================================================================
  // Wiring
  // =====================================================================
  reshuffleBtn.addEventListener("click", () => load(randomSeed(), { announce: true }));

  copyBtn.addEventListener("click", async () => {
    if (!currentWorld) return;
    try {
      await navigator.clipboard.writeText(currentWorld.seed);
      flashHint("seed copied 📋");
    } catch {
      flashHint("copy failed — select the seed text manually");
    }
  });

  shareBtn.addEventListener("click", async () => {
    if (!currentWorld) return;
    const url = `${location.origin}${location.pathname}#seed=${encodeURIComponent(currentWorld.seed)}`;
    try {
      await navigator.clipboard.writeText(url);
      flashHint("share URL copied 🔗");
    } catch {
      flashHint("copy failed — copy the URL from the address bar");
    }
  });

  loadBtn.addEventListener("click", () => {
    const v = seedInput.value.trim();
    if (!v) {
      flashHint("type a seed first");
      return;
    }
    load(v, { announce: true });
    seedInput.value = "";
  });

  seedInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") loadBtn.click();
  });

  // keyboard shortcut: space = reshuffle (when not typing in the input)
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" && document.activeElement !== seedInput) {
      e.preventDefault();
      load(randomSeed(), { announce: true });
    }
  });

  // respond to back/forward through the hash
  window.addEventListener("hashchange", () => {
    const s = seedFromHash();
    if (s && (!currentWorld || s !== currentWorld.seed)) load(s);
  });

  // ---- go ----
  load(seedFromHash() || randomSeed());
})();
