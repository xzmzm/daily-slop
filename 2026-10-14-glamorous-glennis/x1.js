// Bell X-1 point-mass flight model — October 14, 1947.
// SI inside, feet / mph only at the edges. No DOM; runs in node and the page.
(function (root) {
  const G = 9.80665;
  const R_AIR = 287.05;
  const FT = 0.3048;
  const MPH = 0.44704;

  // Airframe: 130 ft² wing, 7,000 lb empty + pilot, ~5,300 lb of LOX and
  // diluted alcohol. XLR11: four 1,500 lbf chambers, on or off, no throttle.
  const X1 = {
    S: 12.08,            // m²
    dry: 3270,           // kg, airframe + Yeager
    fuel: 2290,          // kg, propellant at drop
    chamberThrust: 6672, // N at sea level (1,500 lbf)
    vacGain: 900,        // N extra per chamber as back-pressure vanishes
    chamberFlow: 3.42,   // kg/s per chamber (Isp ≈ 200 s)
    k: 0.075,            // induced-drag factor 1/(π e AR)
    clMax: 1.25,
    nMax: 4.5,
  };

  // The drop: B-29 at 20,000 ft and 250 mph indicated-ish.
  const DROP = { h: 20000 * FT, v: 250 * MPH, gamma: -2 * Math.PI / 180 };

  function isa(h) {
    let T, p;
    if (h < 11000) {
      T = 288.15 - 0.0065 * h;
      p = 101325 * Math.pow(T / 288.15, 5.25588);
    } else {
      T = 216.65;
      p = 22632.06 * Math.exp(-(h - 11000) / 6341.62);
    }
    return { T, p, rho: p / (R_AIR * T), a: Math.sqrt(1.4 * R_AIR * T) };
  }

  const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  const bump = (m, c, w) => Math.max(0, 1 - Math.abs(m - c) / w);

  // Zero-lift drag: flat, then the transonic wall, then the supersonic ease.
  function cd0(m) {
    if (m < 0.8) return 0.02;
    if (m < 1.02) return 0.02 + 0.06 * smooth((m - 0.8) / 0.22);
    return 0.08 - 0.022 * smooth((m - 1.02) / 0.3);
  }

  // Elevator authority: shock on the tail blanks the elevator from 0.88 up;
  // it only partly returns once the shock has settled past Mach 1.
  function elevatorAuthority(m) {
    if (m < 0.88) return 1;
    if (m < 0.94) return 1 - 0.88 * (m - 0.88) / 0.06;
    if (m < 1.03) return 0.12;
    return 0.12 + 0.28 * smooth((m - 1.03) / 0.07);
  }

  // Shock-induced nose-down load ("tuck"): builds from 0.87, peaks at 0.96 and
  // eases to a supersonic plateau as the lift centre settles aft. Plus buffet.
  const tuck = (m) =>
    m < 0.96 ? smooth((m - 0.87) / 0.09) : 1 - 0.4 * smooth((m - 0.96) / 0.1);
  const buffet = (m) => bump(m, 0.93, 0.08);

  // Cockpit Machmeter: the static port sits inside the shock system; the
  // needle stalls near .965 and then jumps once the shock moves past it.
  function indicatedMach(m, t) {
    if (m >= 0.965 && m < 1.0) return 0.965 + 0.005 * Math.sin(t * 11) * smooth((m - 0.965) / 0.01);
    return m;
  }

  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => {
      s ^= s << 13; s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }

  function create(opts = {}) {
    return {
      t: 0,
      h: DROP.h, v: DROP.v, gamma: DROP.gamma, x: 0,
      fuel: X1.fuel,
      chambers: [false, false, false, false],
      stick: 0,          // -1 nose down … +1 nose up (momentary)
      trim: 0,           // moving-stabilizer setting, -0.6 … +0.6
      trimRate: 0,       // -1, 0, +1 while the trim switch is held
      n: 1, mach: DROP.v / isa(DROP.h).a, buffet: 0,
      lastThrust: 0,
      maxMach: 0, maxMachAlt: 0,
      bestLevel: 0, bestLevelAlt: 0,
      levelSuper: 0,     // seconds above Mach 1 with the flight path within 6°
      firstSupersonic: null,
      phase: "flying",   // flying | done | lost
      outcome: null,
      events: [],
      rand: rng(opts.seed || 19471014),
    };
  }

  function log(s, text) {
    s.events.push({ t: s.t, text });
    if (s.events.length > 40) s.events.shift();
  }

  function chambersLit(s) {
    return s.fuel > 0 ? s.chambers.filter(Boolean).length : 0;
  }

  function setChamber(s, i, on) {
    if (s.phase !== "flying") return;
    if (on && s.fuel <= 0) return;
    if (s.chambers[i] === on) return;
    s.chambers[i] = on;
    log(s, `chamber ${i + 1} ${on ? "lit" : "off"}`);
  }

  function forces(s) {
    const air = isa(s.h);
    const m = s.v / air.a;
    const mass = X1.dry + s.fuel;
    const W = mass * G;
    const q = 0.5 * air.rho * s.v * s.v;
    const lit = chambersLit(s);
    const thrust = lit * (X1.chamberThrust + X1.vacGain * (1 - air.p / 101325));
    // Load factor from the pitch controls, capped by stall and structure.
    let n = 1 + 1.6 * (s.stick * elevatorAuthority(m) + s.trim) - 1.0 * tuck(m);
    const nStall = (X1.clMax * q * X1.S) / W;
    n = Math.max(-1.5, Math.min(n, nStall, X1.nMax));
    const cl = (n * W) / Math.max(1, q * X1.S);
    const drag = q * X1.S * (cd0(m) + X1.k * cl * cl);
    return { air, m, mass, W, q, thrust, drag, n, lit };
  }

  function step(s, dt) {
    if (s.phase !== "flying") return s;
    s.trim = Math.max(-0.6, Math.min(0.6, s.trim + s.trimRate * 0.12 * dt));
    const f = forces(s);
    const shake = buffet(f.m);
    const n = f.n + shake * 0.35 * (s.rand() - 0.5);
    const gammaDot = (G * (n - Math.cos(s.gamma))) / s.v;
    const vDot = (f.thrust - f.drag) / f.mass - G * Math.sin(s.gamma);

    s.v = Math.max(40, s.v + vDot * dt);
    s.gamma += gammaDot * dt;
    s.h += s.v * Math.sin(s.gamma) * dt;
    s.x += s.v * Math.cos(s.gamma) * dt;
    if (f.lit) s.lastThrust = s.t + dt;
    const burnt = f.lit * X1.chamberFlow * dt;
    const before = s.fuel;
    s.fuel = Math.max(0, s.fuel - burnt);
    s.t += dt;
    if (before > 0 && s.fuel === 0) log(s, "propellant exhausted — gliding");

    const air = isa(s.h);
    const m = s.v / air.a;
    const wasSuper = s.mach >= 1;
    s.mach = m;
    s.n = n;
    s.buffet = shake;
    if (m > s.maxMach) { s.maxMach = m; s.maxMachAlt = s.h; }
    const level = Math.abs(s.gamma) < (8 * Math.PI) / 180;
    if (m >= 1 && Math.abs(s.gamma) < (6 * Math.PI) / 180) s.levelSuper += dt;
    if (level && m > s.bestLevel) { s.bestLevel = m; s.bestLevelAlt = s.h; }
    if (!wasSuper && m >= 1) {
      const how = level ? " — level" : s.gamma > 0 ? " — climbing" : " — in a dive";
      log(s, `Mach 1 at ${Math.round(s.h / FT).toLocaleString("en-US")} ft${how}`);
      if (s.firstSupersonic == null) s.firstSupersonic = { t: s.t, h: s.h, level };
    }
    if (wasSuper && m < 1) log(s, "back below Mach 1");

    if (s.gamma < (-40 * Math.PI) / 180) {
      s.phase = "lost";
      s.outcome = "tuck";
      s.chambers = [false, false, false, false];
      log(s, "nose tucked past 40° down — dive unrecoverable at this Mach");
    } else if (s.h < 1500) {
      s.phase = "lost";
      s.outcome = "low";
      log(s, "below 5,000 ft — flight terminated");
    } else if (s.lastThrust > 0 && s.t - s.lastThrust > 25 && m < 0.9 || s.t > 30 && m < 0.75 && s.fuel === 0) {
      s.phase = "done";
      s.outcome = s.levelSuper > 0 ? "supersonic" : "subsonic";
      log(s, s.outcome === "supersonic" ? "glide home to Rogers Dry Lake" : "glide home — the wall held");
    }
    return s;
  }

  function simulate(s, until, dt = 1 / 60) {
    while (s.t < until && s.phase === "flying") step(s, dt);
    return s;
  }

  // Yeager's profile as a controller: two chambers for the climb, push over
  // near 42,000 ft, light the third, hold level with stick and then trim,
  // ease off at Mach 1.06 and shut everything down 14 s later.
  function autopilot(s, mem) {
    mem = mem || {};
    if (s.phase !== "flying") return mem;
    const hFt = s.h / FT;
    if (!mem.shutdown) {
      if (s.t > 1) setChamber(s, 0, true);
      if (s.t > 2.5) setChamber(s, 1, true);
      if (hFt > 41500 && mem.superAt == null) setChamber(s, 2, true);
    }
    let target;
    if (s.mach < 0.55 && hFt < 25000) target = 0.06;   // let the speed build
    else if (hFt < 38500) target = 0.2;                 // climb
    else if (hFt < 41500) target = 0.07;
    else target = (42500 - hFt) * 0.00004;              // level near 42,500 ft
    if (mem.shutdown) target = -0.09;                   // glide down
    const err = target - s.gamma;
    s.stick = Math.max(-1, Math.min(1, err * 7));
    // Trim chases whatever the stick cannot hold — that is the moving tail.
    const auth = elevatorAuthority(s.mach);
    s.trimRate = Math.abs(err) > 0.004 ? Math.sign(err) * (auth < 0.6 ? 1 : 0.3) : 0;
    if (!mem.shutdown && s.mach >= 1.06 && mem.superAt == null) {
      mem.superAt = s.t;
      setChamber(s, 2, false);
    }
    if (!mem.shutdown && mem.superAt != null && s.t - mem.superAt > 14) {
      mem.shutdown = true;
      for (let i = 0; i < 4; i++) setChamber(s, i, false);
    }
    return mem;
  }

  const api = {
    G, FT, MPH, X1, DROP, isa, cd0, elevatorAuthority, tuck, buffet, indicatedMach,
    create, step, simulate, forces, setChamber, chambersLit, autopilot,
    mu: (m) => (m > 1 ? Math.asin(1 / m) : null),
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.X1 = api;
})(typeof window !== "undefined" ? window : globalThis);
