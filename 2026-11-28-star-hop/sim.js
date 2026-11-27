// Star Hop — the sky and sensor model. Pure functions, no DOM; works in the browser and in Node.
(function (root) {
  const RAD = Math.PI / 180;

  // Bright stars, J2000 RA/Dec in degrees and visual magnitude. Precession to 1964 (~0.5°) is ignored.
  const STARS = [
    ['Sirius', 101.287, -16.716, -1.46], ['Canopus', 95.988, -52.696, -0.74],
    ['Rigil Kentaurus', 219.902, -60.834, -0.27], ['Arcturus', 213.915, 19.182, -0.05],
    ['Vega', 279.234, 38.784, 0.03], ['Capella', 79.172, 45.998, 0.08], ['Rigel', 78.634, -8.202, 0.13],
    ['Procyon', 114.825, 5.225, 0.34], ['Achernar', 24.429, -57.237, 0.46], ['Betelgeuse', 88.793, 7.407, 0.5],
    ['Hadar', 210.956, -60.373, 0.61], ['Altair', 297.696, 8.868, 0.77], ['Acrux', 186.65, -63.099, 0.77],
    ['Aldebaran', 68.98, 16.509, 0.85], ['Antares', 247.352, -26.432, 0.96], ['Spica', 201.298, -11.161, 0.97],
    ['Pollux', 116.329, 28.026, 1.14], ['Fomalhaut', 344.413, -29.622, 1.16], ['Deneb', 310.358, 45.28, 1.25],
    ['Mimosa', 191.93, -59.689, 1.25], ['Regulus', 152.093, 11.967, 1.35], ['Adhara', 104.656, -28.972, 1.5],
    ['Castor', 113.65, 31.888, 1.58], ['Shaula', 263.402, -37.104, 1.62], ['Gacrux', 187.791, -57.113, 1.63],
    ['Bellatrix', 81.283, 6.35, 1.64], ['Elnath', 81.573, 28.608, 1.65], ['Miaplacidus', 138.3, -69.717, 1.69],
    ['Alnilam', 84.053, -1.202, 1.69], ['Alnair', 332.058, -46.961, 1.73], ['Alnitak', 85.19, -1.943, 1.77],
    ['Alioth', 193.507, 55.96, 1.77], ['Dubhe', 165.932, 61.751, 1.79], ['Mirfak', 51.081, 49.861, 1.79],
    ['Wezen', 107.098, -26.393, 1.83], ['Regor', 122.383, -47.337, 1.83], ['Kaus Australis', 276.043, -34.385, 1.85],
    ['Avior', 125.628, -59.509, 1.86], ['Alkaid', 206.885, 49.313, 1.86], ['Sargas', 264.33, -42.998, 1.87],
    ['Menkalinan', 89.882, 44.947, 1.9], ['Atria', 252.166, -69.028, 1.91], ['Alhena', 99.428, 16.399, 1.93],
    ['Peacock', 306.412, -56.735, 1.94], ['Delta Velorum', 131.176, -54.708, 1.96], ['Mirzam', 95.675, -17.956, 1.98],
    ['Alphard', 141.897, -8.659, 1.98], ['Polaris', 37.955, 89.264, 1.98], ['Hamal', 31.793, 23.462, 2.0],
    ['Diphda', 10.897, -17.987, 2.04], ['Nunki', 283.816, -26.297, 2.05], ['Menkent', 211.671, -36.37, 2.06],
    ['Saiph', 86.939, -9.67, 2.06], ['Alpheratz', 2.097, 29.091, 2.06], ['Beta Gruis', 340.667, -46.885, 2.1],
    ['Suhail', 136.999, -43.433, 2.21], ['Aspidiske', 139.273, -59.275, 2.21], ['Naos', 120.896, -40.003, 2.25],
    ['Alpha Lupi', 220.482, -47.388, 2.3], ['Epsilon Centauri', 204.972, -53.466, 2.3], ['Eta Centauri', 218.877, -42.158, 2.35],
  ].map(([name, ra, dec, mag]) => ({ name, ra, dec, mag }));

  // The Sun as seen from Mariner 4 on 30 Nov 1964 (essentially as seen from Earth).
  const SUN = { ra: 245.6, dec: -21.6 };
  const CANOPUS_MAG = -0.74;
  const CONE_HALF = 13;  // sensor field half-height across the cone, degrees (toy: a tall slit)
  const SLIT_HALF = 2.5; // sensor field half-width along the roll direction, degrees (toy)
  const FLOOR = 0.06;    // weakest signal the sensor will lock on with the gate off, × Canopus

  const vec = (ra, dec) => [Math.cos(dec * RAD) * Math.cos(ra * RAD), Math.cos(dec * RAD) * Math.sin(ra * RAD), Math.sin(dec * RAD)];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => { const l = Math.hypot(...a); return a.map((x) => x / l); };
  const wrap = (deg) => ((deg % 360) + 360) % 360;
  const relBright = (mag) => Math.pow(10, -0.4 * (mag - CANOPUS_MAG));

  // Clock angle (roll) and cone angle (from the Sun line) of a sky direction.
  const S = vec(SUN.ra, SUN.dec);
  const E1 = norm(cross(cross(S, [0, 0, 1]), S)); // celestial north projected onto the roll plane
  const E2 = cross(S, E1);
  function sunFrame(v) {
    const cone = Math.acos(Math.max(-1, Math.min(1, dot(v, S)))) / RAD;
    const clock = wrap(Math.atan2(dot(v, E2), dot(v, E1)) / RAD);
    return { cone, clock };
  }

  const CANOPUS = sunFrame(vec(95.988, -52.696));
  const CONE = CANOPUS.cone; // sensor cone angle, set before launch to Canopus's angle from the Sun

  const SKY = STARS.map((s) => ({ ...s, ...sunFrame(vec(s.ra, s.dec)), bright: relBright(s.mag) }));
  // Objects the sensor can see at some roll: inside the cone band.
  const RING = SKY.filter((s) => Math.abs(s.cone - CONE) <= CONE_HALF).sort((a, b) => a.clock - b.clock);

  // Earth-shine: the near Earth's glare leaks in around one roll angle and fades as Mariner pulls away.
  const EARTH_CLOCK = 312;
  const earthGlow = (day) => 2.2 / Math.pow(1 + day / 0.6, 2);

  // Signal (× Canopus) the sensor sees when the spacecraft's roll puts the slit at sky clock angle `clock`.
  function signal(clock, day) {
    let total = 0;
    for (const s of RING) {
      const d = Math.abs(((clock - s.clock + 540) % 360) - 180);
      if (d < SLIT_HALF) total += s.bright * (1 - (d / SLIT_HALF) ** 2);
    }
    const de = Math.abs(((clock - EARTH_CLOCK + 540) % 360) - 180);
    if (de < 14) total += earthGlow(day) * (1 - de / 14);
    return total;
  }

  // Targets the search can stop on: stars in the ring plus the Earth-shine patch.
  function targets(day) {
    const list = RING.map((s) => ({ name: s.name, clock: s.clock, bright: signal(s.clock, day) }));
    list.push({ name: 'Earth-shine', clock: EARTH_CLOCK, bright: signal(EARTH_CLOCK, day) });
    return list.sort((a, b) => a.clock - b.clock);
  }

  const targetClock = (name) => (name === 'Earth-shine' ? EARTH_CLOCK : RING.find((s) => s.name === name).clock);

  // Would the sensor accept this object? With the gate on, only 1/gate .. gate × Canopus passes.
  function accepts(bright, gate) {
    if (bright < FLOOR) return false;
    if (gate === null) return true;
    return bright >= 1 / gate && bright <= gate;
  }

  // Roll search: rolling forward from `clock`, the first acceptable object.
  // `skip` names the object the roll is just leaving, so the search does not stop on it again at once.
  function nextLock(clock, day, gate, skip) {
    const list = targets(day);
    let best = null, bestGap = Infinity;
    for (const t of list) {
      const gap = wrap(t.clock - clock);
      if (t.name === skip) continue;
      if (gap < bestGap && accepts(t.bright, gate)) { best = t; bestGap = gap; }
    }
    return best ? { ...best, gap: bestGap } : null;
  }

  // Deterministic random numbers so a mission (and the video) replays the same.
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Dust and paint flecks drifting with the spacecraft: [day, extra signal × Canopus].
  function dustEvents(seed, days) {
    const r = rng(seed), out = [];
    let t = 1.1;
    while (t < days) {
      t += 0.25 + r() * 0.9;
      const peak = Math.exp(-0.4 + r() * 2.6); // 0.7 .. 9× Canopus
      out.push({ day: +t.toFixed(3), peak: +peak.toFixed(2) });
    }
    return out.filter((e) => e.day < days);
  }


  // ---- Mission ----------------------------------------------------------------------
  const LAUNCH_UTC = Date.UTC(1964, 10, 28, 14, 22);
  const SEARCH_START = 0.25;        // days after launch: Sun acquired, Canopus search begins
  const SEARCH_ROLL = 360 / 0.05;   // degrees per day while searching (one turn in 72 min)
  const UPLINK = 0.02;              // days from pressing a button to the command taking effect
  const DUST_LEN = 0.012;           // days a fleck stays in the sensor's view
  const STEADY = 0.4;               // days of unbroken Canopus lock needed before the burn (toy)
  const FIRST_BURN = 6.1;           // 4 Dec 1964, ~17:00 UTC
  const MAX_SLIPS = 3;
  const GATES = { off: null, wide: 8, normal: 2.5, tight: 1.3 };

  function createMission(opts = {}) {
    const seed = opts.seed ?? 1128;
    return {
      day: 0, roll: opts.startRoll ?? 250, mode: 'idle', locked: null, leaving: null, lockedSince: 0,
      gate: opts.gate ?? 'normal', pending: [], dust: dustEvents(seed + 7, 12), noise: rng(seed),
      samples: new Array(360).fill(null), log: [], losses: 0, canopusDays: 0,
      burnDue: FIRST_BURN, slips: 0, outcome: null, lastReading: 0,
    };
  }

  const dustAt = (m, day) => m.dust.reduce((sum, e) => sum + (day >= e.day && day < e.day + DUST_LEN ? e.peak : 0), 0);
  const gateValue = (m) => GATES[m.gate];

  function note(m, text) { m.log.push({ day: m.day, text }); }

  function startSearch(m, why) {
    m.mode = 'search'; m.leaving = m.locked; m.locked = null;
    if (why) note(m, why);
  }

  function lockOn(m, target) {
    m.mode = 'lock'; m.roll = target.clock; m.locked = target.name; m.lockedSince = m.day;
    note(m, `Lock: ${target.name} (${target.bright.toFixed(2)}× Canopus)`);
  }

  // Queue a ground command; it reaches the spacecraft UPLINK days later.
  function command(m, type, value) {
    if (m.outcome) return;
    m.pending.push({ at: m.day + UPLINK, type, value });
  }

  function apply(m, c) {
    if (c.type === 'gate') {
      m.gate = c.value;
      note(m, c.value === 'off' ? 'Brightness gate off' : `Brightness gate ${c.value} (1/${GATES[c.value]}–${GATES[c.value]}×)`);
    } else if (c.type === 'hop' && m.mode === 'lock') {
      startSearch(m, `Roll override: leaving ${m.locked}`);
    }
  }

  function substep(m, dt) {
    const prev = m.day;
    m.day += dt;
    for (const c of m.pending.filter((c) => c.at <= m.day)) apply(m, c);
    m.pending = m.pending.filter((c) => c.at > m.day);
    if (m.day < SEARCH_START) return;
    if (m.mode === 'idle') startSearch(m, 'Sun acquired, Canopus search begins');

    if (m.mode === 'search') {
      const move = SEARCH_ROLL * dt;
      const t = nextLock(m.roll, m.day, gateValue(m), m.leaving);
      if (t && t.gap <= move) lockOn(m, t);
      else {
        m.roll = wrap(m.roll + move);
        if (m.leaving && Math.abs(((m.roll - targetClock(m.leaving) + 540) % 360) - 180) > 3) m.leaving = null;
      }
    }

    // A fleck only matters while the slit holds still on it; during a roll it is swept past at once.
    const reading = (signal(m.roll, m.day) + (m.mode === 'lock' ? dustAt(m, m.day) : 0)) * (1 + 0.04 * (m.noise() - 0.5));
    m.lastReading = reading;
    m.samples[Math.floor(m.roll) % 360] = reading;

    if (m.mode === 'lock') {
      const g = gateValue(m);
      const fail = g === null ? reading < FLOOR : !accepts(reading, g);
      if (fail) {
        m.losses++;
        startSearch(m, `Lock lost on ${m.locked} (signal ${reading.toFixed(2)}×)`);
      } else if (m.locked === 'Canopus') m.canopusDays += m.day - Math.max(prev, SEARCH_START);
    }

    if (m.day >= m.burnDue && !m.outcome) {
      const steady = m.mode === 'lock' && m.locked === 'Canopus' && m.day - m.lockedSince >= STEADY;
      if (steady) {
        m.outcome = { ok: true, day: m.day, slips: m.slips };
        note(m, 'Midcourse burn fired on Canopus lock');
      } else if (m.slips + 1 >= MAX_SLIPS) {
        m.slips++;
        m.outcome = { ok: false, day: m.day, slips: m.slips };
        note(m, 'No steady Canopus lock: burn scrubbed for good (toy limit)');
      } else {
        m.slips++; m.burnDue += 1;
        note(m, 'No steady Canopus lock: midcourse burn slips a day');
      }
    }
  }

  function step(m, days) {
    while (days > 1e-9 && !m.outcome) {
      const dt = Math.min(days, 0.0004);
      substep(m, dt);
      days -= dt;
    }
  }

  // Calendar label for a mission day, UTC.
  function utc(day) {
    const d = new Date(LAUNCH_UTC + day * 86400000);
    const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()];
    const hh = String(d.getUTCHours()).padStart(2, '0'), mm = String(d.getUTCMinutes()).padStart(2, '0');
    return `${d.getUTCDate()} ${mon} ${hh}:${mm}`;
  }

  const api = { STARS, SKY, RING, SUN, CONE, CANOPUS, CONE_HALF, SLIT_HALF, FLOOR, EARTH_CLOCK,
    earthGlow, signal, targets, accepts, nextLock, dustEvents, rng, wrap, relBright,
    GATES, FIRST_BURN, STEADY, UPLINK, SEARCH_START, createMission, command, step, utc, dustAt };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.StarHop = api;
})(typeof window !== 'undefined' ? window : globalThis);
