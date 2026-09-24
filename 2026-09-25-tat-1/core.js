/* TAT-1 — pure simulation core: speech model, TASI assignment, cable physics.
   No DOM here; testable under node. */
(function (global) {
  'use strict';

  // The crossing: Clarenville, Newfoundland → Oban, Scotland (via Kerrera).
  // Geodesic is ~3,346 km; the cable follows the seabed, so ~3,700 km ≈ 2,000 nmi.
  const ROUTE_KM = 3700;
  // Polyethylene coax: signals travel at about two-thirds of c.
  const SPEED_KM_S = 200000;
  // Bell Labs flexible vacuum-tube repeaters; the span below is even spacing
  // across the whole crossing (published sources also give ~69 km in the
  // deep section — same order, see NOTES.md).
  const REPEATERS = 51;

  const oneWayMs = (km = ROUTE_KM) => (km / SPEED_KM_S) * 1000;
  const roundTripMs = (km = ROUTE_KM) => 2 * oneWayMs(km);
  const spanKm = () => ROUTE_KM / (REPEATERS - 1);

  // Deterministic RNG (mulberry32) — every conversation gets its own stream,
  // so changing one slider never reshuffles the other callers' patterns.
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function lnChoose(n, k) {
    let s = 0;
    for (let i = 1; i <= k; i++) s += Math.log((n - k + i) / i);
    return s;
  }

  // P(X > k) for X ~ Binomial(n, p) — how often more than k callers speak at once.
  function binomialTail(n, k, p) {
    if (k >= n) return 0;
    let sum = 0;
    for (let i = k + 1; i <= n; i++) {
      const ln = lnChoose(n, i) + i * Math.log(p) + (n - i) * Math.log(1 - p);
      const term = Math.exp(ln);
      sum += term;
      if (term < 1e-14 && sum > 0) break;
    }
    return Math.min(1, sum);
  }

  // 72 real city pairs: 12 western exchanges × 6 British ones, exactly the
  // TASI-era count of speech circuits.
  const WESTERN_CITIES = ['New York', 'Chicago', 'Boston', 'Washington', 'Philadelphia',
    'Detroit', 'Montreal', 'Toronto', 'Halifax', 'Ottawa', 'Cleveland', 'Buffalo'];
  const BRITISH_CITIES = ['London', 'Glasgow', 'Manchester', 'Birmingham', 'Leeds', 'Edinburgh'];
  const CALL_PAIRS = [];
  for (const w of WESTERN_CITIES) for (const b of BRITISH_CITIES) CALL_PAIRS.push([w, b]);

  // Speech is bursts and gaps. Mean spurt ~0.95 s; mean gap scales so that
  // spurt/(spurt+gap) ≈ activity (classic telephone activity is ~35%).
  const TasiSim = class {
    constructor(opts = {}) {
      const { conversations = 8, circuits = 5, activity = 0.35, tasi = true, seed = 20260925 } = opts;
      this.seed = seed;
      this.activity = activity;
      this.tasi = tasi;
      this.clock = 0;
      this.conversations = [];
      this.circuits = [];
      this.talkMs = 0;
      this.busyMs = 0;      // circuit-time actually carrying speech
      this.occupiedMs = 0;  // circuit-time held (with TASI off, silence holds too)
      this.clipMs = 0;
      this.clipCount = 0;
      this.blockedHistory = 0;
      this.resize(conversations, circuits);
    }

    resize(conversations, circuits) {
      // Rebuild the caller list, keeping each caller's RNG stream by index so
      // one slider never reshuffles the other callers' patterns.
      const old = this.conversations;
      this.conversations = [];
      for (let i = 0; i < conversations; i++) {
        const kept = old[i];
        if (kept) this.conversations.push(kept);
        else this.conversations.push({
          pair: CALL_PAIRS[i % CALL_PAIRS.length],
          stream: rng(this.seed * 7919 + i + 1),
          talking: false,
          // Stagger the first spurt so callers don't all start at once.
          timer: rng(this.seed * 104729 + i * 31 + 7)() * 2500,
          circuit: -1,
          clipping: false,
        });
      }
      this.circuits = Array.from({ length: circuits }, () => -1);
      // Statistics describe the current configuration: start clean on any change.
      this.talkMs = this.busyMs = this.occupiedMs = this.clipMs = this.clipCount = 0;
      if (!this.tasi) {
        // Permanent assignment: circuit c belongs to caller c; the rest blocked.
        this.conversations.forEach((c, i) => { c.circuit = i < circuits ? i : -1; });
        this.circuits = this.circuits.map((_, i) => (i < this.conversations.length ? i : -1));
      } else {
        this.conversations.forEach((c) => { c.circuit = -1; });
        this.claimIdle();
      }
    }

    setTasi(on) {
      this.tasi = !!on;
      this.talkMs = this.busyMs = this.occupiedMs = this.clipMs = this.clipCount = 0;
      this.conversations.forEach((c) => { c.circuit = -1; c.clipping = false; });
      this.circuits = this.circuits.map(() => -1);
      if (!this.tasi) this.resize(this.conversations.length, this.circuits.length);
      else this.claimIdle();
    }

    drawGap(c) { return (0.35 + c.stream() * 1.2) * (1 - this.activity) / this.activity * (0.5 + c.stream()); }

    step(dtMs) {
      this.clock += dtMs;
      const dt = Math.min(dtMs, 250); // stable under big recorder jumps
      for (const c of this.conversations) {
        c.timer -= dt;
        if (c.timer <= 0) {
          if (c.talking) {
            c.talking = false;
            c.timer = this.drawGap(c) * 1000;
            c.clipping = false;
            if (this.tasi && c.circuit >= 0) { this.circuits[c.circuit] = -1; c.circuit = -1; }
          } else {
            c.talking = true;
            c.timer = (0.35 + c.stream() * 1.2) * 1000;
          }
        }
      }
      if (this.tasi) this.claimIdle();
      // Accounting: talker-time, circuit-time carrying speech, circuit-time held.
      let active = 0, busy = 0;
      for (const c of this.conversations) {
        if (!c.talking) continue;
        active++;
        if (c.circuit >= 0) busy++;
        else if (this.tasi) { // a spurt with no free circuit is being clipped
          if (!c.clipping) { c.clipping = true; this.clipCount++; }
          this.clipMs += dt;
        }
      }
      this.talkMs += active * dt;
      this.busyMs += busy * dt;
      this.occupiedMs += this.circuits.reduce((n, owner) => n + (owner >= 0 ? 1 : 0), 0) * dt;
    }
    claimIdle() {
      if (!this.tasi) return;
      for (let i = 0; i < this.conversations.length; i++) {
        const c = this.conversations[i];
        if (c.talking && c.circuit < 0) {
          const free = this.circuits.indexOf(-1);
          if (free >= 0) { this.circuits[free] = i; c.circuit = free; c.clipping = false; }
        }
      }
    }

    stats() {
      const n = this.conversations.length;
      const m = this.circuits.length;
      const active = this.conversations.filter((c) => c.talking).length;
      const held = this.circuits.reduce((a, o) => a + (o >= 0 ? 1 : 0), 0);
      const talkMs = Math.max(this.talkMs, 1);
      return {
        conversations: n,
        circuits: m,
        active,
        held,
        occupancy: this.busyMs / (this.occupiedMs || 1),
        speechOnCircuits: m > 0 ? (this.busyMs / Math.max(this.clock, 1)) / m : 0,
        clipCount: this.clipCount,
        clippedPct: this.clipMs / talkMs,
        blocked: this.tasi ? 0 : Math.max(0, n - m),
        gain: m > 0 ? n / m : 0,
      };
    }

    snapshot() {
      return {
        circuits: this.circuits.slice(),
        callers: this.conversations.map((c) => ({
          pair: c.pair, talking: c.talking, circuit: c.circuit, clipping: c.clipping,
        })),
      };
    }
  };

  // Cable pulse engine: speech dashes, test shouts, and the echo they drag back.
  // Positions are 0 (Clarenville) → 1 (Oban). Physics ratios are exact
  // (one-way = 18.5 ms, echo = +37 ms round trip); absolute screen time is
  // stretched by the chosen crossing duration.
  const Pulses = class {
    constructor({ suppressor = false } = {}) {
      this.suppressor = suppressor;
      this.items = [];
      this.arrived = [];
    }
    // With the suppressor armed, a terminal won't launch its own transmission
    // while speech is still arriving from the far end — the classic lockout.
    canLaunch(dir) {
      if (!this.suppressor) return true;
      return !this.items.some((p) => p.dir === -dir);
    }
    speech(dir, color, lane) { this.launch(dir, color, lane, 'speech'); }
    shout(dir) {
      this.launch(dir, '#f5f1e6', 1, 'test');
      return true;
    }
    launch(dir, color, lane, kind) {
      if (kind === 'speech' && !this.canLaunch(dir)) return false;
      this.items.push({ dir, color, lane, kind, pos: dir > 0 ? 0 : 1 });
      return true;
    }
    step(dtMs, crossingMs) {
      const v = dtMs / crossingMs;
      this.arrived = [];
      const survivors = [];
      for (const p of this.items) {
        p.pos += p.dir * v;
        if (p.dir > 0 && p.pos >= 1) {
          this.arrived.push({ ...p, at: 1 });
          if (p.kind === 'test' && !this.suppressor) {
            // Far-end hybrid leaks: the shout comes back, 18.5 ms later real time.
            survivors.push({ dir: -1, color: p.color, lane: p.lane, kind: 'echo', pos: 1, dim: true });
          }
        } else if (p.dir < 0 && p.pos <= 0) {
          this.arrived.push({ ...p, at: 0 });
        } else {
          survivors.push(p);
        }
      }
      this.items = survivors;
    }
  };

  const api = {
    ROUTE_KM, SPEED_KM_S, REPEATERS, CALL_PAIRS,
    oneWayMs, roundTripMs, spanKm, rng, binomialTail, TasiSim, Pulses,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.TAT1 = api;
})(typeof window !== 'undefined' ? window : globalThis);
