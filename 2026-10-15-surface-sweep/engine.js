/* A deliberately small, dimensionless surface-transport model. */
(function (root) {
  'use strict';
  const N = 65, H = 2 / (N - 1), DT = 1 / 240;
  const MOBILITY = 0.003, DIFFUSION = 0.0008, A = 0.22;
  const tension = c => 1 - c / (c + A);
  // Integral of D + M*c*(-d gamma/dc), with gamma's range scaled to 40.
  // Pairwise differences conserve soap and are zero for a uniform surface.
  const transport = c => DIFFUSION * c + MOBILITY * 40 * A *
    (Math.log((c + A) / A) + A / (c + A) - 1);
  function random(seed) {
    let s = seed >>> 0;
    return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  }
  class Dish {
    constructor({ seed = 1015, count = 1100, coat = 0 } = {}) {
      this.c = new Float64Array(N * N);
      this.next = new Float64Array(N * N);
      this.g = new Float64Array(N * N);
      this.sigma = new Float64Array(N * N);
      this.mask = new Uint8Array(N * N);
      this.cells = [];
      this.edges = [];
      this.time = 0; this.drops = 0; this.events = []; this.coat = coat;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const i = y * N + x;
        if (Math.hypot(x * H - 1, y * H - 1) <= 1) {
          this.mask[i] = 1; this.cells.push(i); this.c[i] = coat;
        }
      }
      for (const i of this.cells) {
        if (i % N < N - 1 && this.mask[i + 1]) this.edges.push([i, i + 1]);
        if (i + N < N * N && this.mask[i + N]) this.edges.push([i, i + N]);
      }
      const rng = random(seed);
      this.pepper = Array.from({ length: count }, () => {
        const r = Math.sqrt(rng()) * 0.965, angle = rng() * 2 * Math.PI;
        return { x: r * Math.cos(angle), y: r * Math.sin(angle), size: 0.7 + rng() * 1.3,
          angle: rng() * Math.PI, tone: rng() };
      });
      this.initialCenter = this.pepper.filter(p => Math.hypot(p.x, p.y) < 0.4).length;
      this.updateTension();
    }
    updateTension() { for (const i of this.cells) this.sigma[i] = tension(this.c[i]); }
    drop(x, y, kind = 'soap', dose = 1) {
      if (!Number.isFinite(x) || !Number.isFinite(y) || Math.hypot(x, y) > 1) return false;
      if (!['soap', 'water'].includes(kind) || !Number.isFinite(dose) || dose <= 0 || dose > 3) return false;
      if (kind === 'soap') {
        for (const i of this.cells) {
          const dx = (i % N) * H - 1 - x, dy = Math.floor(i / N) * H - 1 - y;
          this.c[i] += dose * 3.5 * Math.exp(-(dx * dx + dy * dy) / 0.012);
        }
        this.drops++;
      }
      this.events.push({ x, y, kind, time: this.time });
      this.updateTension();
      return true;
    }
    velocity(x, y) {
      const gx = Math.max(1, Math.min(N - 2.001, (x + 1) / H));
      const gy = Math.max(1, Math.min(N - 2.001, (y + 1) / H));
      const ix = Math.floor(gx), iy = Math.floor(gy), fx = gx - ix, fy = gy - iy;
      let vx = 0, vy = 0, sum = 0;
      for (let yy = 0; yy < 2; yy++) for (let xx = 0; xx < 2; xx++) {
        const i = (iy + yy) * N + ix + xx;
        if (!this.mask[i]) continue;
        const s = this.sigma[i];
        const l = this.mask[i - 1] ? this.sigma[i - 1] : s;
        const r = this.mask[i + 1] ? this.sigma[i + 1] : s;
        const t = this.mask[i - N] ? this.sigma[i - N] : s;
        const b = this.mask[i + N] ? this.sigma[i + N] : s;
        const w = (xx ? fx : 1 - fx) * (yy ? fy : 1 - fy);
        vx += (r - l) * w; vy += (b - t) * w; sum += w;
      }
      const factor = MOBILITY * 40 / (2 * H * (sum || 1));
      return { x: vx * factor, y: vy * factor };
    }
    step(seconds) {
      if (!Number.isFinite(seconds) || seconds <= 0) return;
      const steps = Math.ceil(seconds / DT), dt = seconds / steps;
      for (let k = 0; k < steps; k++) {
        for (const i of this.cells) { this.g[i] = transport(this.c[i]); this.next[i] = this.c[i]; }
        for (const [i, j] of this.edges) {
          const flux = (this.g[i] - this.g[j]) * dt / (H * H);
          this.next[i] -= flux; this.next[j] += flux;
        }
        [this.c, this.next] = [this.next, this.c];
        this.updateTension();
        for (const p of this.pepper) {
          const v = this.velocity(p.x, p.y);
          p.x += v.x * dt; p.y += v.y * dt;
          const r = Math.hypot(p.x, p.y);
          if (r > 0.976) { p.x *= 0.976 / r; p.y *= 0.976 / r; }
        }
        this.time += dt;
      }
      this.events = this.events.filter(e => this.time - e.time < 2);
    }
    stats() {
      let low = 1, high = 0, mass = 0;
      for (const i of this.cells) {
        low = Math.min(low, this.sigma[i]); high = Math.max(high, this.sigma[i]); mass += this.c[i];
      }
      const center = this.pepper.filter(p => Math.hypot(p.x, p.y) < 0.4).length;
      return { low, high, contrast: (high - low) * 100, mass: mass * H * H,
        cleared: Math.max(0, Math.round(100 * (1 - center / (this.initialCenter || 1)))),
        time: this.time, drops: this.drops };
    }
  }
  const api = { Dish, tension, N, H, DT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Surface = api;
})(typeof window === 'undefined' ? globalThis : window);
