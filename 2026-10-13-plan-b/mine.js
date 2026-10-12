// The San José rescue as a race and a lift: three drills trying to hit a
// workshop 622 m down, then a capsule cycling 33 riders up that hole.
// Time is counted in hours since the cave-in, 5 August 2010, 14:00.
(function (root) {
  "use strict";

  // ---- timeline anchors, hours since the collapse -------------------------
  const T = {
    collapse: 0,
    note: 17 * 24,               // Aug 22: "Estamos bien en el refugio, los 33"
    voice: 432,                  // Aug 23: first voice contact
    drillStart: 586,             // Aug 30 00:00, Plan A spuds in
    bStart: 730,                 // Sep 5, Plan B spuds in
    cStart: 1066,                // Sep 19, Plan C spuds in
    histBreakthrough: 1546 + 8 + 5 / 60, // Oct 9 08:05, Plan B reaches the workshop
    histTests: 1637,             // Oct 12 19:00, after three days of reaming
    histGonzalezDown: 1641.3,    // Oct 12 23:18
    histFirstUp: 1618 + 24 + 11 / 60, // Oct 13 00:11, Florencio Ávalos
    histLastUp: 1663.92,         // Oct 13 21:55, foreman Luis Urzúa
    histAllOut: 1666.53,         // Oct 14 00:32, rescuer Manuel González
  };

  // Rock harder than average in these depth bands (metres along the hole):
  // slower going, and it eats steel one and a half times faster.
  const HARD_BANDS = [[180, 260, 1.5], [430, 500, 1.35]];
  const hardness = (m) => {
    for (const [lo, hi, k] of HARD_BANDS) if (m >= lo && m < hi) return k;
    return 1;
  };

  const PLANS = {
    A: {
      key: "A", name: "Plan A", rig: "Strata 950",
      start: T.drillStart, breakDepth: 702,
      rop: 15.5, bitLife: 150, wander: 1.05,
      trip: (d) => 0.6 + d / 220, faultAt: Infinity, hue: "#6f9ec4", rgb: "111,158,196",
    },
    B: {
      key: "B", name: "Plan B", rig: "Schramm T130",
      start: T.bStart, breakDepth: 624,
      rop: 20.5, bitLife: 95, wander: 1.3,
      trip: (d) => 0.5 + d / 240, faultAt: Infinity, hue: "#e8a13a", rgb: "232,161,58",
    },
    C: {
      key: "C", name: "Plan C", rig: "RIG-421 oil rig",
      start: T.cStart, breakDepth: 597,
      rop: 21.5, bitLife: 115, wander: 6.8,
      trip: (d) => 0.9 + d / 170, faultAt: 11, hue: "#9bbf8d", rgb: "155,191,141",
    },
  };

  const TOL = 15;         // metres of lateral miss the workshop forgives
  const STEER_ROP = 0.55; // steering trades penetration for straightness
  const FAULT_HOURS = 36; // pulling, resizing and repositioning a wandered hole
  const REAM_HOURS = 82.9; // ream to 66 cm, case the top, rig the winch
  const TEST_HOURS = 4.3; // survey, capsule checks, the slow start
  const CAPSULE_DESCENT = 1.62; // m/s empty, about 6 min for 624 m
  const GEARS = { steady: 0.85, standard: 1.05, push: 1.3 };
  const SNAG_BACK = 20;   // metres of reverse travel that clears a snag

  // 33 riders in the real order: the four fittest first to prove the system
  // and report trouble, then the weakest, then the toughest, the foreman last.
  function riders() {
    const list = [];
    for (let i = 1; i <= 33; i++) {
      const tag = i <= 4 ? "fit" : i <= 18 ? "priority" : i < 33 ? "tough" : "foreman";
      list.push({
        n: i, tag,
        check: { fit: 4.5, priority: 8, tough: 6, foreman: 6.5 }[tag] / 60, // h at the bottom
        tol: { fit: 1.35, priority: 1.0, tough: 1.15, foreman: 1.2 }[tag],  // m/s before nerves go
      });
    }
    return list;
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gaussMaker(rng) {
    let spare = null;
    return function () {
      if (spare !== null) { const v = spare; spare = null; return v; }
      let u = 0, v = 0;
      while (u === 0) u = rng();
      while (v === 0) v = rng();
      const r = Math.sqrt(-2 * Math.log(u));
      spare = r * Math.sin(2 * Math.PI * v);
      return r * Math.cos(2 * Math.PI * v);
    };
  }

  const ANCHOR_MS = Date.UTC(2010, 7, 5, 14, 0);
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function dateAt(t) { return new Date(ANCHOR_MS + t * 3600 * 1000); }
  function fmtDate(t) {
    const d = dateAt(t);
    return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
  }
  function fmtClock(t) {
    const d = dateAt(t);
    return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  }
  // Day 0 is the day of the collapse; the famous numbers line up:
  // the note is Day 17, the last man up is Day 69.
  function dayOf(t) { return Math.floor(t / 24); }

  function create(opts) {
    const seed = (opts && opts.seed) || 20101013;
    const state = {
      t: T.drillStart, phase: "drill", seed,
      rng: mulberry32(seed), gauss: null,
      plans: {}, winner: null, reamLeft: REAM_HOURS,
      rescue: null, log: [],
    };
    state.gauss = gaussMaker(state.rng);
    for (const key of ["A", "B", "C"]) {
      const p = PLANS[key];
      state.plans[key] = {
        key, depth: 0, dev: 0, bit: 1, steer: false,
        state: "wait", faultLeft: 0, bitsUsed: 0, trippedFor: 0,
      };
    }
    log(state, T.collapse, "The ramp caves in. 33 men make for the refuge, 622 m down.");
    log(state, T.note, "A probe hole comes up with a note taped to the bit: Estamos bien en el refugio, los 33.");
    log(state, T.voice, "First voice contact, down a telephone line threaded into a paloma.");
    log(state, T.drillStart, "Plan A · " + PLANS.A.rig + " spuds in.");
    return state;
  }

  function log(state, t, text) {
    state.log.push({ t, text: `Day ${dayOf(t)} · ${fmtDate(t)} ${fmtClock(t)} — ${text}` });
    if (state.log.length > 400) state.log.shift();
  }

  function changeBit(state, key) {
    const p = state.plans[key];
    if (state.phase !== "drill" || (p.state !== "drill" && p.state !== "dull")) return;
    p.state = "trip";
    p.faultLeft = PLANS[key].trip(p.depth);
    p.trippedFor = p.faultLeft;
    p.bitsUsed++;
    log(state, state.t, `Plan ${key}: trip out ${Math.round(p.depth)} m of rods, new bit going in.`);
  }

  function setSteer(state, key, on) { state.plans[key].steer = !!on; }

  // ---- drilling -----------------------------------------------------------
  function stepDrill(state, dt) {
    let left = dt;
    while (left > 1e-9 && state.phase === "drill") {
      const h = Math.min(left, 0.25);
      left -= h;
      state.t += h;
      for (const key of ["A", "B", "C"]) {
        const plan = PLANS[key], p = state.plans[key];
        if (p.state === "wait") {
          if (state.t >= plan.start) {
            p.state = "drill";
            log(state, state.t, `Plan ${key} · ${plan.rig} spuds in.`);
          }
          continue;
        }
        if (p.state === "trip" || p.state === "fishing" || p.state === "fault") {
          p.faultLeft -= h;
          if (p.faultLeft <= 0) {
            if (p.state === "trip") { p.bit = 1; p.state = "drill"; }
            else if (p.state === "fishing") { p.bit = 1; p.state = "drill"; log(state, state.t, `Plan ${key}: broken tool fished out, drilling again.`); }
            else { p.dev *= 0.4; p.state = "drill"; log(state, state.t, `Plan ${key}: repositioned over the survey, drilling on.`); }
          }
          continue;
        }
        if (p.state === "off" || p.state === "halted") continue;

        // drilling (or limping on a dull bit)
        const hard = hardness(p.depth);
        let ropEff = plan.rop / 24;
        if (hard > 1) ropEff /= hard;
        if (p.state === "dull") ropEff *= 0.15;
        if (p.steer) ropEff *= STEER_ROP;
        let dm = ropEff * h;
        if (p.depth + dm >= plan.breakDepth) dm = plan.breakDepth - p.depth;
        p.depth += dm;

        p.bit -= (dm * hard) / plan.bitLife;
        if (p.bit <= 0 && p.state === "drill") {
          p.bit = 0; p.state = "dull";
          log(state, state.t, `Plan ${key}: the bit is gone — barely cutting.`);
        }
        if (p.state === "dull" && state.rng() < h * 0.08) {
          p.state = "fishing"; p.faultLeft = 30;
          log(state, state.t, `Plan ${key}: the dull bit broke downhole. Fishing it out.`);
          continue;
        }

        // deviation: a random walk in metres, σ = plan.wander per 100 m
        let sigma = (plan.wander / 10) * Math.sqrt(Math.max(dm, 0));
        if (p.steer) { sigma *= 0.35; p.dev *= Math.exp(-dm / 180); }
        p.dev += state.gauss() * sigma;

        if (p.dev > plan.faultAt && p.state !== "fault") {
          p.state = "fault"; p.faultLeft = FAULT_HOURS;
          log(state, state.t, `Plan ${key}: the hole has wandered ${p.dev.toFixed(0)} m off line — pulling to reposition.`);
          continue;
        }

        if (p.depth >= plan.breakDepth - 1e-9) {
          if (Math.abs(p.dev) <= TOL) {
            state.winner = key; state.phase = "ream"; state.reamLeft = REAM_HOURS;
            p.state = "won";
            for (const other of ["A", "B", "C"]) {
              if (other !== key && state.plans[other].state !== "wait") state.plans[other].state = "halted";
            }
            log(state, state.t, `Plan ${key} breaks through into the workshop, ${plan.breakDepth} m, ${Math.abs(p.dev).toFixed(1)} m off line.`);
            return;
          }
          p.state = "off";
          log(state, state.t, `Plan ${key} passed ${plan.breakDepth} m but missed the workshop by ${Math.abs(p.dev).toFixed(0)} m.`);
        }
      }
    }
  }

  // ---- reaming and the lift ----------------------------------------------
  function startRescue(state) {
    const depth = PLANS[state.winner].breakDepth;
    state.rescue = {
      depth, riders: riders(), n: 0, upCount: 0,
      sub: "tests", subLeft: TEST_HOURS,
      pos: 0, dir: 0, // dir: +1 descending, -1 ascending
      gear: "standard", reverseDist: 0,
      snagAt: null, snagged: false, snagHours: 0,
      sway: 0, distressed: false, distressLeft: 0,
      travelHours: 0, checkHours: 0, firstUpAt: null, lastUpAt: null,
    };
    log(state, state.t, "Hole surveyed, Fénix 2 strapped, winch tested.");
  }

  function legSnag(state, up) {
    if (state.rng() < (up ? 0.32 : 0.15))
      return 60 + state.rng() * (state.rescue.depth - 120);
    return null;
  }

  function stepRescue(state, dt) {
    const r = state.rescue;
    let left = dt;
    while (left > 1e-9 && r.sub !== "done") {
      const h = Math.min(left, 1 / 60);
      left -= h;
      state.t += h;
      const rider = r.riders[Math.min(r.n, 32)];

      if (r.sub === "tests") {
        r.subLeft -= h;
        if (r.subLeft <= 0) {
          r.sub = "gdesc"; r.dir = 1; r.pos = 0;
          log(state, state.t, "Rescuer Manuel González rides down to organise the queue below.");
        }
      } else if (r.sub === "gdesc" || r.sub === "descend") {
        if (r.snagged) {
          handleSnag(state, h);
        } else {
          const before = r.pos;
          r.pos += CAPSULE_DESCENT * h * 3600;
          r.travelHours += h;
          if (r.snagAt !== null && before < r.snagAt && r.pos >= r.snagAt) {
            r.pos = r.snagAt; r.snagged = true; r.reverseDist = 0; r.snagAt = null;
            log(state, state.t, "The capsule catches an edge. Hold reverse to back off.");
          } else if (r.pos >= r.depth) {
            r.pos = r.depth;
            r.sub = "load"; r.subLeft = rider.check; r.snagAt = null;
          }
        }
      } else if (r.sub === "load") {
        r.subLeft -= h;
        r.checkHours += h;
        if (r.subLeft <= 0) {
          r.sub = "ascend"; r.dir = -1;
          r.snagAt = legSnag(state, true);
          r.sway = 0; r.distressed = false;
        }
      } else if (r.sub === "ascend") {
        if (r.snagged) {
          handleSnag(state, h);
        } else {
          let v = Math.min(GEARS[r.gear], 1.8);
          if (r.distressed) {
            v = Math.min(v, rider.tol - 0.1);
            r.distressLeft -= h;
            if (r.distressLeft <= 0) { r.distressed = false; r.sway = 0.4; }
          } else if (v > rider.tol) {
            r.sway += 2.5 * (v - rider.tol) * 60 * h;
            if (r.sway >= 1) {
              r.distressed = true; r.distressLeft = 2 / 60;
              log(state, state.t, `Rider ${r.n + 1} is struggling in the dark — winch eased.`);
            }
          } else {
            r.sway = Math.max(0, r.sway - 0.5 * 60 * h);
          }
          const before = r.pos;
          r.pos -= v * h * 3600;
          r.travelHours += h;
          if (r.snagAt !== null && before > r.snagAt && r.pos <= r.snagAt) {
            r.pos = r.snagAt; r.snagged = true; r.reverseDist = 0; r.snagAt = null;
            log(state, state.t, "A guide wheel jams on the rough wall. Hold reverse.");
          } else if (r.pos <= 0) {
            r.pos = 0;
            r.upCount++;
            if (r.n === 0) { r.firstUpAt = state.t; log(state, state.t, "Florencio Ávalos steps out — the first of 33."); }
            if (r.n === 32) r.lastUpAt = state.t;
            r.sub = "unload"; r.subLeft = 1.5 / 60;
            if (r.n === 32) log(state, state.t, "Foreman Luis Urzúa, the last man. 33 of 33.");
            else if (rider.tag === "priority" && r.n % 5 === 0)
              log(state, state.t, `Rider ${r.n + 1} up — the medics take him straight to the tent.`);
          }
        }
      } else if (r.sub === "unload") {
        r.subLeft -= h;
        if (r.subLeft <= 0) {
          r.n++;
          if (r.n >= 33) { r.sub = "tail"; r.subLeft = 2.7; }
          else {
            r.sub = "descend"; r.dir = 1; r.pos = 0;
            r.snagAt = legSnag(state, false);
          }
        }
      } else if (r.sub === "tail") {
        r.subLeft -= h;
        if (r.subLeft <= 0) {
          r.sub = "done"; state.phase = "done";
          log(state, state.t, "González comes up last, 25 hours below.");
        }
      }
    }
  }

  function handleSnag(state, h) {
    const r = state.rescue;
    r.snagHours += h;
    if (state.input && state.input.reverse) {
      // back up against the direction of travel until the wheel comes free
      r.pos -= r.dir * 0.8 * h * 3600;
        r.pos = Math.max(0, Math.min(r.depth, r.pos));
      r.reverseDist += 0.8 * h * 3600;
      r.travelHours += h;
      if (r.reverseDist >= SNAG_BACK) {
        r.snagged = false;
        log(state, state.t, "Free. The capsule backs past the shelf and carries on.");
      }
    }
  }

  function step(state, dt, input) {
    state.input = input || state.input || { reverse: false };
    if (state.phase === "drill") {
      stepDrill(state, dt);
      if (state.phase === "ream") {
        log(state, state.t, "Reaming starts: 28 cm, then 41, then 66.");
      }
    } else if (state.phase === "ream") {
      const before = state.reamLeft;
      state.t += dt;
      state.reamLeft -= dt;
      if (before > REAM_HOURS / 2 && state.reamLeft <= REAM_HOURS / 2)
        log(state, state.t, "Halfway: the hole now swallows a 41 cm reamer.");
      if (before > 18 && state.reamLeft <= 18)
        log(state, state.t, "66 cm through. Only the first 56 m need steel casing.");
      if (state.reamLeft <= 0) {
        state.phase = "rescue";
        startRescue(state);
      }
    } else if (state.phase === "rescue") {
      stepRescue(state, dt);
    } else {
      state.t += dt;
    }
  }

  // Fixed-step driver for tests and video fast-forward: runs to `until`.
  function simulate(state, until, input) {
    let guard = 0;
    while (state.t < until && guard++ < 8e6) {
      step(state, Math.min(1 / 30, until - state.t), input);
    }
    return state;
  }

  const api = {
    T, PLANS, HARD_BANDS, TOL, GEARS, FAULT_HOURS, REAM_HOURS, TEST_HOURS, SNAG_BACK,
    hardness, riders, create, step, changeBit, setSteer, simulate,
    fmtDate, fmtClock, dayOf,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Mine = api;
})(typeof window !== "undefined" ? window : globalThis);
