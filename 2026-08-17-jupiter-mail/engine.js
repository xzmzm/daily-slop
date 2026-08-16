/*
 * jupiter-mail — engine
 *
 * The pure physics of the first US airmail flight (Aug 17, 1859: John Wise,
 * balloon "Jupiter", Lafayette IN → Crawfordsville IN, 123 letters + 23
 * circulars bound for New York). No DOM, no canvas here — everything is
 * unit-testable in node (test_engine.js).
 *
 * The whole lesson in three lines
 * ------------------------------
 *   A free balloon has no rudder. ALTITUDE is the steering wheel: the wind
 *   veers and freshens with height (an idealized Ekman spiral), so the set
 *   of courses you can hold today is exactly the arc your wind ladder spans.
 *   A pressure-equilibrated gas balloon with gas mass mₕ has net lift
 *   (M_air/M_H2 − 1)·mₕ·g ≈ 13.4·mₕ·g — at EVERY altitude (envelope and
 *   air scale together); climbing swells the envelope, it does not change
 *   the lift. So the only way down is to vent gas, the only way up is to
 *   throw out sand — two one-way currencies, plus a slow diffusion leak.
 *
 * The rest of the file is machinery around those three lines:
 *   • ISA troposphere density (for envelope volume / added mass),
 *   • Ekman-spiral wind profile veered left of geostrophic at the surface,
 *   • vertical dynamics with quadratic drag and ½·(displaced air) added
 *     mass — the reason a balloon answers its controls like a barge,
 *   • horizontal drift that relaxes toward the local wind over ~45 s,
 *   • Wise's own trail rope: on the ground it offloads weight (self-
 *     stabilizing altitude) and drags (brakes ground speed),
 *   • landing classification + the mail's verdict — the flight is only
 *     leg one; the letters finish the trip by rail (1859-plausible
 *     estimates, clearly labelled as a game, not an archive).
 *
 * Conventions
 *   • SI units. x = metres EAST of Lafayette, y = metres NORTH, z = metres
 *     up. t in seconds from release. Bearings are degrees clockwise from
 *     north, and always the direction the wind blows TOWARD.
 *   • No randomness anywhere: step() is deterministic, so tests and the
 *     video renderer can replay flights exactly.
 */

(function (global) {
  'use strict';

  // ── constants ───────────────────────────────────────────────────────────

  const G = 9.80665;             // m/s²
  const DEG = Math.PI / 180;

  // ISA troposphere (needed for envelope volume and added mass, not lift).
  const ISA = { T0: 288.15, L: 0.0065, R: 287.058, P0: 101325 };

  // Gas: pure hydrogen in pressure equilibrium with the ambient air.
  const M_AIR = 28.964;          // g/mol
  const M_H2 = 2.016;            // g/mol
  const K_LIFT = M_AIR / M_H2 - 1;   // ≈ 13.373 kg of lift per kg of H2

  // Balloon "Jupiter", reconstructed plausible figures (see NOTES.md).
  const SHIP = {
    dryKg: 285,        // envelope + net + basket + gear + aeronaut + locked mail bag
    gasKg0: 48.5,      // hydrogen at launch
    ballastBags: 20,   // sandbags
    bagKg: 15,
    freeLiftKg: 15,    // implied lift margin at release → initial climb ≈ 2.3 m/s
    ventKgS: 0.32,     // valve: hydrogen per second while open (gone forever)
    diffusionKgS: 0.0009,  // ≈ 0.054 kg/min slow leak (free lift decays in ~20 min)
    cd: 0.55,          // drag coefficient of a rigged sphere
    addedMass: 0.5,    // potential-flow sphere: ½ of displaced air (the barge effect)
  };

  // Idealized Ekman spiral: geostrophic aloft, backed and slowed at surface.
  const EK = { z0: 150, delta: 1000, top: 3000 };

  const WIND_TAU = 45;           // s; ground speed relaxes toward local wind

  // Wise's trail rope (his own invention, 1830s essays).
  const ROPE = { len: 60, kgPerM: 0.7, brakeS: 12 };

  const TRAIN_S = 7200;          // the evening mail train, 2 h after release
  const NIGHTFALL_S = 10800;     // after this the aeronaut valves down at dusk
  const SOFT_TD = 2.5;           // touchdown |vz| limits, m/s
  const HARD_TD = 4.5;

  // ── geography ───────────────────────────────────────────────────────────
  // Real coordinates; x/y are metres from Lafayette (equirectangular, good
  // to <0.2 % at county scale).

  const ORIGIN = { lat: 40.4167, lon: -86.8753 };   // Lafayette courthouse
  const M_PER_DEG_LAT = 111190;
  const M_PER_DEG_LON = 111320 * Math.cos(ORIGIN.lat * DEG);

  const TOWNS = {
    lafayette:     { name: 'Lafayette',      lat: 40.4167, lon: -86.8753, rail: true  },
    battleground:  { name: 'Battle Ground',  lat: 40.5075, lon: -86.8425, rail: false },
    delphi:        { name: 'Delphi',         lat: 40.5825, lon: -86.6747, rail: true  },
    monticello:    { name: 'Monticello',     lat: 40.7456, lon: -86.7297, rail: false },
    dayton:        { name: 'Dayton',         lat: 40.3756, lon: -86.7758, rail: false },
    rossville:     { name: 'Rossville',      lat: 40.4160, lon: -86.5990, rail: false },
    frankfort:     { name: 'Frankfort',      lat: 40.2795, lon: -86.5108, rail: true  },
    crawfordsville:{ name: 'Crawfordsville', lat: 40.0403, lon: -86.8603, rail: true  },
    thorntown:     { name: 'Thorntown',      lat: 40.1295, lon: -86.6080, rail: false },
    lebanon:       { name: 'Lebanon',        lat: 40.0509, lon: -86.4695, rail: true  },
    zionsville:    { name: 'Zionsville',     lat: 39.9506, lon: -86.2600, rail: false },
    indianapolis:  { name: 'Indianapolis',   lat: 39.7684, lon: -86.1581, rail: true  },
  };
  for (const key of Object.keys(TOWNS)) {
    const t = TOWNS[key];
    t.x = (t.lon - ORIGIN.lon) * M_PER_DEG_LON;
    t.y = (t.lat - ORIGIN.lat) * M_PER_DEG_LAT;
  }

  function bearingDeg(e, n) {                    // of an (east, north) vector
    return (Math.atan2(e, n) / DEG + 360) % 360;
  }

  function townBearing(fromKey, toKey) {
    const a = TOWNS[fromKey], b = TOWNS[toKey];
    return bearingDeg(b.x - a.x, b.y - a.y);
  }

  function townDistM(fromKey, toKey) {
    const a = TOWNS[fromKey], b = TOWNS[toKey];
    return Math.hypot(b.x - a.x, b.y - a.y);
  }

  // Stylized Wabash River (real shape: SE past Delphi/Lafayette, then SW).
  const WABASH = [
    { lat: 40.700, lon: -86.900 }, { lat: 40.610, lon: -86.790 },
    { lat: 40.585, lon: -86.680 }, { lat: 40.520, lon: -86.700 },
    { lat: 40.470, lon: -86.820 }, { lat: 40.417, lon: -86.880 },
    { lat: 40.300, lon: -86.930 }, { lat: 40.150, lon: -87.000 },
    { lat: 39.980, lon: -87.080 },
  ].map(p => ({ x: (p.lon - ORIGIN.lon) * M_PER_DEG_LON, y: (p.lat - ORIGIN.lat) * M_PER_DEG_LAT }));

  // ── scenarios ───────────────────────────────────────────────────────────

  const SCENARIOS = {
    '1859': {
      key: '1859', label: '1859 · the real flight',
      bearing: 190, Ug: 9, target: 'crawfordsville',
      brief: 'Aug 17, 1859, 4:30 pm. The wind is from the NNE and no layer of it blows '
        + 'toward New York. Deliver the locked mail bag to the Crawfordsville postmaster '
        + '— and beat the evening train.',
    },
    'westerly': {
      key: 'westerly', label: 'westerly interlude',
      bearing: 122, Ug: 8, target: 'frankfort',
      brief: 'A what-if: a day of westerlies. Frankfort bears 116°, and only the top of '
        + 'the ladder points that far east. Ride it high, then get down before the county line.',
    },
    'gale': {
      key: 'gale', label: 'gale from the north',
      bearing: 190, Ug: 16, target: 'crawfordsville',
      brief: 'Same sky as 1859, twice the speed. The ground comes at you fast — the trail '
        + 'rope earns its keep today.',
    },
  };

  // ── atmosphere & gas ────────────────────────────────────────────────────

  function isaDensity(z) {
    const T = ISA.T0 - ISA.L * Math.max(0, z);
    const p = ISA.P0 * Math.pow(T / ISA.T0, G / (ISA.R * ISA.L));
    return p / (ISA.R * T);
  }

  function envelopeVolume(gasKg, z) {           // m³, gas at ambient p and T
    return gasKg / (isaDensity(z) * M_H2 / M_AIR);
  }

  function netLiftN(gasKg) {                    // (M_air/M_H2 − 1)·mₕ·g — z-independent
    return K_LIFT * gasKg * G;
  }

  // ── wind: idealized Ekman spiral ────────────────────────────────────────
  //   u(ζ) = U_g·(1 − e^{−ζ}cos ζ)   along the geostrophic direction
  //   v(ζ) = U_g·e^{−ζ}sin ζ         to its LEFT (surface wind is "backed")
  //   ζ = (z + z0)/δ
  // Returns the wind the balloon drifts with, in (east, north) m/s, plus
  // its toward-bearing and speed.

  function windAt(z, scenario) {
    const zeta = (Math.max(0, z) + EK.z0) / EK.delta;
    const u = scenario.Ug * (1 - Math.exp(-zeta) * Math.cos(zeta));
    const v = scenario.Ug * Math.exp(-zeta) * Math.sin(zeta);
    const b = scenario.bearing * DEG;
    const dirE = Math.sin(b), dirN = Math.cos(b);      // geostrophic unit vector
    const leftE = -Math.cos(b), leftN = Math.sin(b);   // 90° CCW = "left of" in NH
    const e = dirE * u + leftE * v;
    const n = dirN * u + leftN * v;
    const speed = Math.hypot(e, n);
    return { e, n, u, v, speed, bearing: bearingDeg(e, n) };
  }

  // The steerable arc: bearings spanned by the practical band [250 m, top].
  function steerArc(scenario) {
    let lo = 360, hi = 0;
    for (let z = 250; z <= EK.top; z += 50) {
      const b = windAt(z, scenario).bearing;
      lo = Math.min(lo, b); hi = Math.max(hi, b);
    }
    return { lo, hi };
  }

  // ── state & dynamics ────────────────────────────────────────────────────

  function makeState(scenarioKey) {
    const sc = SCENARIOS[scenarioKey];
    // gasKg0 = 48.5 kg H2 → net lift 13.373 × 48.5 = 648.6 kg-equivalent
    // against 285 dry + 300 sand + 48.5 gas = 633.5 kg → ≈ 15 kg free lift.
    return {
      scenarioKey, x: 0, y: 0, z: 0, vz: 0, vgx: 0, vgy: 0, t: 0,
      gasKg: SHIP.gasKg0, ballastBags: SHIP.ballastBags, ballastKg: SHIP.ballastBags * SHIP.bagKg,
      valveOpen: false, ropeOut: false, launched: false,
      landed: null,          // set on touchdown: {soft, tdVz, townKey, townDistM}
      track: [],             // breadcrumb, every 30 s of flight
      maxZ: 0,
    };
  }

  function dropBallast(st, bags) {
    const n = Math.min(bags || 1, st.ballastBags);
    st.ballastBags -= n;
    st.ballastKg -= n * SHIP.bagKg;
    return n;
  }

  // One deterministic physics step. dt is subdivided so the internal step
  // never exceeds 0.25 s (stiffness: quadratic drag + wind relaxation).
  function step(st, dt) {
    const sc = SCENARIOS[st.scenarioKey];
    let remaining = dt;
    while (remaining > 1e-9) {
      const h = Math.min(0.25, remaining);
      remaining -= h;
      stepInner(st, sc, h);
    }
  }

  function stepInner(st, sc, h) {
    if (st.landed) return;               // the mail is on a train; physics is over
    if (st.launched) st.t += h;

    // gas: valve + slow diffusion
    if (st.launched) {
      if (st.valveOpen) st.gasKg = Math.max(0, st.gasKg - SHIP.ventKgS * h);
      st.gasKg = Math.max(0, st.gasKg - SHIP.diffusionKgS * h);
    }
    // dusk rule: past nightfall the aeronaut gives up and valves down
    if (st.launched && st.t > NIGHTFALL_S) st.valveOpen = true;

    // vertical
    const rho = isaDensity(st.z);
    const V = envelopeVolume(Math.max(st.gasKg, 0.01), st.z);
    const r = Math.cbrt(3 * V / (4 * Math.PI));
    const area = Math.PI * r * r;
    let liftN = netLiftN(st.gasKg);
    let massKg = SHIP.dryKg + st.ballastKg + st.gasKg;
    let weightN = massKg * G;

    // trail rope on the ground carries part of itself → offload + brake
    let contact = 0;
    if (st.ropeOut && st.launched && st.z < ROPE.len) {
      contact = (ROPE.len - st.z) / ROPE.len;
      liftN += ROPE.kgPerM * (ROPE.len - st.z) * G;   // its ground weight is earth's problem
    }

    const mEff = massKg + SHIP.addedMass * rho * V;
    const dragN = 0.5 * rho * SHIP.cd * area * st.vz * Math.abs(st.vz);
    let az = (liftN - weightN - dragN) / mEff;
    st.vz += az * h;
    st.z += st.vz * h;

    // horizontal: relax toward the local wind, then the rope brakes you
    if (st.launched) {
      const w = windAt(st.z, sc);
      st.vgx += (w.e - st.vgx) * (1 - Math.exp(-h / WIND_TAU));
      st.vgy += (w.n - st.vgy) * (1 - Math.exp(-h / WIND_TAU));
      if (contact > 0) {
        const brake = Math.exp(-h * contact / ROPE.brakeS);
        st.vgx *= brake; st.vgy *= brake;
      }
      st.x += st.vgx * h;
      st.y += st.vgy * h;
      st.maxZ = Math.max(st.maxZ, st.z);
    }

    // breadcrumb every 30 s
    if (st.launched) {
      const last = st.track[st.track.length - 1];
      if (!last || st.t - last.t >= 30) {
        st.track.push({ t: st.t, x: st.x, y: st.y, z: st.z });
        if (st.track.length > 400) st.track.shift();
      }
    }

    // ground
    if (st.z <= 0) {
      st.z = 0;
      if (st.launched && st.vz <= 0) {
        touchdown(st);
      } else if (!st.launched) {
        st.vz = 0;
      }
    }
  }

  function touchdown(st) {
    const tdVz = st.vz;
    st.vz = 0; st.z = 0;
    // nearest town
    let best = null, bestD = Infinity;
    for (const key of Object.keys(TOWNS)) {
      const d = Math.hypot(TOWNS[key].x - st.x, TOWNS[key].y - st.y);
      if (d < bestD) { bestD = d; best = key; }
    }
    st.landed = {
      soft: Math.abs(tdVz) <= SOFT_TD,
      wreck: Math.abs(tdVz) > HARD_TD,
      tdVz: Math.abs(tdVz),
      townKey: bestD <= 5000 ? best : null,
      townDistM: bestD,
    };
  }

  // ── verdict: the mail's whole journey ───────────────────────────────────
  // Rail hours to New York are 1859-plausible GAME estimates (see NOTES),
  // monotone in eastward progress — the reward for an eastern landing.

  function forwardHours(eastM) {
    return clamp(48 - eastM / 6000, 30, 54);
  }

  function verdict(st) {
    const sc = SCENARIOS[st.scenarioKey];
    if (!st.landed) return null;
    const L = st.landed;
    const delivered = L.townKey !== null;
    let hours = forwardHours(st.x);
    let notes = [];
    if (!delivered) { hours += 8; notes.push('no depot within 5 km — a farmer carts the bag in (+8 h)'); }
    else if (TOWNS[L.townKey].rail) notes.push('handed to the ' + TOWNS[L.townKey].name + ' station agent');
    else notes.push('handed to the ' + TOWNS[L.townKey].name + ' postmaster (stage connection)');
    if (L.wreck) { hours += 10; notes.push('hard landing — the bag split, mail re-sorted (+10 h)'); }
    else if (!L.soft) notes.push('firm landing — the bag holds');
    else notes.push('soft landing — the bag is handed over undisturbed');
    if (st.t > TRAIN_S) { hours += 10; notes.push('the evening train was missed (+10 h, morning train)'); }
    else notes.push('the bag makes the evening train');
    const targetD = Math.hypot(TOWNS[sc.target].x - st.x, TOWNS[sc.target].y - st.y);
    return {
      deliveredTown: delivered ? TOWNS[L.townKey].name : 'a field',
      flightMin: st.t / 60,
      tdVz: L.tdVz, soft: L.soft, wreck: L.wreck,
      gasLeftKg: st.gasKg, bagsLeft: st.ballastBags, maxZm: st.maxZ,
      targetMissM: targetD,
      onTarget: targetD <= 5000,
      nycHours: hours, notes,
    };
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // ── exports ─────────────────────────────────────────────────────────────

  const API = {
    G, DEG, ISA, M_AIR, M_H2, K_LIFT, SHIP, EK, WIND_TAU, ROPE,
    TRAIN_S, NIGHTFALL_S, SOFT_TD, HARD_TD,
    TOWNS, ORIGIN, WABASH, SCENARIOS,
    bearingDeg, townBearing, townDistM,
    isaDensity, envelopeVolume, netLiftN,
    windAt, steerArc,
    makeState, dropBallast, step, verdict, forwardHours, clamp,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  } else {
    global.JupiterEngine = API;
  }
})(typeof window !== 'undefined' ? window : globalThis);
