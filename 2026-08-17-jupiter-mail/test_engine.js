// test_engine.js — assertions for the jupiter-mail engine.
// Run with:  node test_engine.js
//
// Each test prints a one-line PASS / FAIL. Exit code 1 on any failure.

'use strict';

const E = require('./engine.js');

let npass = 0, nfail = 0;
function ok(name, cond, extra) {
  if (cond) { npass++; console.log('  PASS  ' + name); }
  else { nfail++; console.log('  FAIL  ' + name + (extra ? '   ' + extra : '')); }
}
function near(name, a, b, tol, extra) {
  const d = Math.abs(a - b);
  ok(name + `  (${a.toFixed(4)} vs ${b.toFixed(4)}, Δ=${d.toExponential(2)})`,
    d <= tol, extra);
}
function between(name, v, lo, hi) {
  ok(name + `  (${v.toFixed(4)} ∈ [${lo}, ${hi}])`, v >= lo && v <= hi);
}
function angDiff(a, b) { return Math.abs(((a - b + 540) % 360) - 180); }

// ══════════════════════════════════════════════════════════════════════════
// §1 · geography — the 1859 flight, in metres and bearings
// ══════════════════════════════════════════════════════════════════════════

{
  const d = E.townDistM('lafayette', 'crawfordsville') / 1000;
  near('geo: Lafayette→Crawfordsville ≈ 42 km (history: ~26 mi)', d, 41.9, 1.0);
  near('geo: bearing to Crawfordsville ≈ 178°', E.townBearing('lafayette', 'crawfordsville'), 178, 2.5);
  near('geo: Lafayette→Frankfort ≈ 34.5 km', E.townDistM('lafayette', 'frankfort') / 1000, 34.5, 1.0);
  near('geo: bearing to Frankfort ≈ 116°', E.townBearing('lafayette', 'frankfort'), 116, 2.5);
  near('geo: Lafayette→Indianapolis ≈ 94 km', E.townDistM('lafayette', 'indianapolis') / 1000, 94.2, 1.5);
  near('geo: bearing to Indianapolis ≈ 140°', E.townBearing('lafayette', 'indianapolis'), 140, 2.5);
  ok('geo: Lafayette projects to the origin', E.TOWNS.lafayette.x === 0 && E.TOWNS.lafayette.y === 0);
  ok('geo: east is +x (Frankfort), north is +y (Battle Ground)',
    E.TOWNS.frankfort.x > 0 && E.TOWNS.battleground.y > 0);
}

// ══════════════════════════════════════════════════════════════════════════
// §2 · ISA troposphere
// ══════════════════════════════════════════════════════════════════════════

{
  near('ISA: ρ(0) = 1.2250', E.isaDensity(0), 1.2250, 0.004);
  near('ISA: ρ(1000) = 1.1116', E.isaDensity(1000), 1.1116, 0.005);
  near('ISA: ρ(2000) = 1.0065', E.isaDensity(2000), 1.0065, 0.005);
  near('ISA: ρ(3000) = 0.9091', E.isaDensity(3000), 0.9091, 0.005);
  let mono = true;
  for (let z = 0; z < 3000; z += 100) if (E.isaDensity(z + 100) >= E.isaDensity(z)) mono = false;
  ok('ISA: density strictly decreases', mono);
}

// ══════════════════════════════════════════════════════════════════════════
// §3 · hydrogen lift — the altitude-independence theorem
// ══════════════════════════════════════════════════════════════════════════

{
  near('H2: 1 kg lifts 13.373 kg', E.K_LIFT, 13.373, 0.01);
  const l0 = E.netLiftN(48.5), l2500 = E.netLiftN(48.5) / (E.K_LIFT * 48.5 * E.G);
  near('H2: net lift of 48.5 kg H2 ≈ 6.35 kN', l0, 48.5 * 13.373 * E.G, 5);
  near('H2: lift at 2500 m equals lift at sea level (isothermal equilibrium)',
    E.netLiftN(48.5), l0, 1e-9);
  const V0 = E.envelopeVolume(48.5, 0), V25 = E.envelopeVolume(48.5, 2500);
  near('H2: envelope volume at launch ≈ 569 m³', V0, 569, 3);
  ok('H2: envelope swells with altitude instead of losing lift', V25 > V0 * 1.15);
  near('H2: volume ratio tracks the density ratio', V25 / V0, E.isaDensity(0) / E.isaDensity(2500), 0.002);
}

// ══════════════════════════════════════════════════════════════════════════
// §4 · the Ekman ladder — altitude is the rudder
// ══════════════════════════════════════════════════════════════════════════

{
  const sc = E.SCENARIOS['1859'];                 // geostrophic toward 190°, 9 m/s
  const s0 = E.windAt(50, sc), sTop = E.windAt(3000, sc), sMid = E.windAt(1500, sc);
  // toward-bearing of geostrophic wind itself:
  const geo = { bearing: sc.bearing, Ug: sc.Ug };
  near('wind: surface speed ≈ 0.2·Ug at 50 m (Ekman deficit)', s0.speed / sc.Ug, 0.2, 0.06);
  between('wind: surface veer (backed left of geostrophic) ∈ [30°, 50°]',
    (sc.bearing - s0.bearing + 360) % 360, 30, 50);
  near('wind: aloft speed ≈ Ug at 3000 m', sTop.speed / sc.Ug, 1.0, 0.06);
  between('wind: veer aloft ≤ 6°', angDiff(sc.bearing, sTop.bearing), 0, 6);
  ok('wind: hodograph overshoots geostrophic mid-layer (a real Ekman feature)',
    sMid.speed > 0.98 * sc.Ug);
  let speedMono = true, veerMono = true;
  let prevS = -1, prevB = -1;
  for (let z = 100; z <= 2000; z += 100) {
    const w = E.windAt(z, sc);
    if (w.speed <= prevS) speedMono = false;
    if (w.bearing <= prevB) veerMono = false;     // veers right (bearing → 190) with height
    prevS = w.speed; prevB = w.bearing;
  }
  ok('wind: speed freshens monotonically through the working band', speedMono);
  ok('wind: bearing veers monotonically toward geostrophic', veerMono);
  ok('wind: speed overshoot peaks near 2 km then relaxes toward Ug (true spiral)',
    E.windAt(2000, sc).speed > E.windAt(3000, sc).speed);

  const arc = E.steerArc(sc);
  between('arc: low edge (backed) ∈ [145°, 160°]', arc.lo, 145, 160);
  between('arc: high edge ≈ geostrophic', arc.hi, 185, 192);
  const targetB = E.townBearing('lafayette', 'crawfordsville');
  ok('arc: Crawfordsville (178°) is steerable on the 1859 day', arc.lo <= targetB && targetB <= arc.hi);
  const arcW = E.steerArc(E.SCENARIOS['westerly']);
  const frankB = E.townBearing('lafayette', 'frankfort');
  ok('arc: westerly day, Frankfort (116°) only near the top of the ladder',
    arcW.hi >= frankB && frankB - arcW.lo > 20);
}

// ══════════════════════════════════════════════════════════════════════════
// §5 · vertical dynamics — bag up, valve down, barge in between
// ══════════════════════════════════════════════════════════════════════════

{
  // initial free lift ≈ 15 kg → the ship climbs off release
  const st = E.makeState('1859');
  st.launched = true;
  for (let i = 0; i < 1200; i++) E.step(st, 0.5);      // 10 min
  ok('climb: free lift carries her up (z > 200 m after 10 min)', st.z > 200);
  between('climb: initial climb settles near 2.3 m/s terminal', st.vz, 1.6, 3.0);

  // one bag from a trimmed (neutral) ship: added mass makes her answer slowly
  const NEUTRAL_GAS = E.SHIP.dryKg / (E.K_LIFT - 1) + E.SHIP.ballastBags * E.SHIP.bagKg / (E.K_LIFT - 1);
  const st2 = E.makeState('1859');
  st2.launched = true;
  st2.z = 1200; st2.vz = 0;
  st2.gasKg = NEUTRAL_GAS;                        // exact neutral (z-independent)
  E.dropBallast(st2, 1);
  const t0 = st2.t;
  let tHit1 = -1;
  for (let i = 0; i < 400; i++) { E.step(st2, 0.5); if (tHit1 < 0 && st2.vz >= 1.0) tHit1 = st2.t - t0; }
  ok('sluggish: added mass delays 1 m/s of climb by > 5 s after a bag', tHit1 > 5);
  between('sluggish: but she does get to 1 m/s within 30 s', tHit1, 5, 30);
  between('climb: one-bag terminal ≈ 2.2–3.2 m/s', st2.vz, 2.2, 3.2);

  // valve → descend; gas is gone forever
  const st3 = E.makeState('1859');
  st3.launched = true;
  st3.z = 1500; st3.vz = 0;
  st3.valveOpen = true;
  const gas0 = st3.gasKg;
  for (let i = 0; i < 60; i++) E.step(st3, 0.5);       // 30 s of valving
  st3.valveOpen = false;
  const vented = gas0 - st3.gasKg;
  between('valve: 30 s of valve vents ≈ 9.6 kg (plus diffusion)', vented, 9.5, 10.1);
  ok('valve: she is descending after valving', st3.vz < -0.5);
  const gasA = st3.gasKg;
  for (let i = 0; i < 200; i++) E.step(st3, 0.5);
  ok('one-way: vented hydrogen never comes back', st3.gasKg < gasA);
  ok('one-way: ballast only decreases', st3.ballastBags <= E.SHIP.ballastBags);

  // bookkeeping identity (held aloft so she cannot land mid-run and freeze)
  const st4 = E.makeState('westerly');
  st4.launched = true;
  st4.z = 1500;
  E.dropBallast(st4, 3);
  st4.valveOpen = true;
  for (let i = 0; i < 100; i++) E.step(st4, 1);
  st4.valveOpen = false;
  near('books: gas + ballast stays consistent (Δgas+Δballast only)',
    st4.gasKg + st4.ballastKg, E.SHIP.gasKg0 + 17 * E.SHIP.bagKg - (0.32 * 100 + 0.0009 * 100), 0.02);

  // diffusion alone eats the free lift in well under an hour
  const st5 = E.makeState('1859');
  st5.launched = true;
  st5.gasKg -= 15 / E.K_LIFT;                          // trim to exactly neutral
  const zStart = 800; st5.z = zStart; st5.vz = 0;
  for (let i = 0; i < 3600; i++) E.step(st5, 1);       // one hour of pure leak
  ok('diffusion: a neutral ship sags below start after an hour of leak', st5.z < zStart - 50);
}

// ══════════════════════════════════════════════════════════════════════════
// §6 · drift — the balloon becomes the wind (τ = 45 s)
// ══════════════════════════════════════════════════════════════════════════

{
  const sc = E.SCENARIOS['1859'];
  const st = E.makeState('1859');
  st.launched = true;
  st.z = 1400; st.vz = 0;
  const NEUTRAL = E.SHIP.dryKg / (E.K_LIFT - 1) + E.SHIP.ballastBags * E.SHIP.bagKg / (E.K_LIFT - 1);
  st.gasKg = NEUTRAL + 0.14;                       // neutral, pre-centered for the 300 s leak
  for (let i = 0; i < 300; i++) E.step(st, 1);
  const w = E.windAt(st.z, sc);
  const vg = Math.hypot(st.vgx, st.vgy);
  const drB = (Math.atan2(st.vgx, st.vgy) / (Math.PI / 180) + 360) % 360;
  ok('drift: ground speed matches the local wind (<2% off)', Math.abs(vg - w.speed) / w.speed < 0.02);
  near('drift: drift bearing matches wind bearing', drB, w.bearing, 1.0);
  between('drift: ~1400 m on the 1859 day steers ≈ 174–181° (Crawfordsville line)', drB, 174, 181);
  ok('drift: she is moving, not parked', vg > 5);
}

// ══════════════════════════════════════════════════════════════════════════
// §7 · the trail rope — Wise's automatic ballast
// ══════════════════════════════════════════════════════════════════════════

{
  const NEUTRAL = E.SHIP.dryKg / (E.K_LIFT - 1) + E.SHIP.ballastBags * E.SHIP.bagKg / (E.K_LIFT - 1);
  // a 30-kg-heavy ship dropped into the rope band: the grounded rope carries
  // enough of its own weight (0.7 kg/m) to hold her at equilibrium z ≈ 17 m
  const a = E.makeState('1859');
  a.launched = true; a.z = 55; a.vz = -2; a.ropeOut = true;
  a.gasKg = NEUTRAL - 30 / (E.K_LIFT - 1);
  for (let i = 0; i < 240; i++) E.step(a, 0.5);
  ok('rope: a 30-kg-heavy ship stabilizes inside the band instead of landing',
    !a.landed && a.z > 2 && Math.abs(a.vz) < 1.2);
  const b = E.makeState('1859');
  b.launched = true; b.z = 55; b.vz = -2;
  b.gasKg = NEUTRAL - 30 / (E.K_LIFT - 1);
  for (let i = 0; i < 240; i++) E.step(b, 0.5);
  ok('rope: the same ship without it reaches the ground', b.landed);
  between('rope: Wise equilibrium ≈ ropeLen − heavy/0.7', a.z, 8, 28);

  // rope brakes ground speed (a 20-kg-heavy ship parked at its equilibrium)
  const c = E.makeState('gale');
  c.launched = true; c.z = 35; c.vz = 0; c.ropeOut = true;
  c.gasKg = NEUTRAL - 20 / (E.K_LIFT - 1);
  const w = E.windAt(35, E.SCENARIOS['gale']);
  c.vgx = w.e; c.vgy = w.n;                             // entering the band at wind speed
  const v0 = Math.hypot(c.vgx, c.vgy);
  for (let i = 0; i < 400; i++) E.step(c, 0.5);         // 200 s dragging
  const v1 = Math.hypot(c.vgx, c.vgy);
  ok('rope: drag bleeds ground speed (halved or better in 200 s)', v1 < 0.55 * v0);
  ok('rope: she stays aloft while dragging (equilibrium ≈ 31 m)', !c.landed && c.z > 20);
}

// ══════════════════════════════════════════════════════════════════════════
// §8 · landings — the mail bag's fates
// ══════════════════════════════════════════════════════════════════════════

{
  function dropIn(vz, x, y, t) {
    const st = E.makeState('1859');
    st.launched = true;
    st.x = x; st.y = y; st.z = 2; st.vz = vz; st.t = t;   // last 2 m: free lift can't save it
    for (let i = 0; i < 400 && !st.landed; i++) E.step(st, 0.05);
    return st;
  }
  const soft = dropIn(-1.8, E.TOWNS.crawfordsville.x, E.TOWNS.crawfordsville.y, 3000);
  ok('land: |vz| ≤ 2.5 is soft', soft.landed && soft.landed.soft && !soft.landed.wreck);
  const firm = dropIn(-3.5, E.TOWNS.crawfordsville.x, E.TOWNS.crawfordsville.y, 3000);
  ok('land: 2.5 < |vz| ≤ 4.5 is firm (no wreck penalty)', firm.landed && !firm.landed.soft && !firm.landed.wreck);
  const wreck = dropIn(-6.5, E.TOWNS.crawfordsville.x, E.TOWNS.crawfordsville.y, 3000);
  ok('land: |vz| > 4.5 wrecks the mail', wreck.landed && wreck.landed.wreck);

  const field = dropIn(-1.5, -9000, 40000, 3000);       // 20+ km from any dot on the map
  ok('land: 5 km+ from any town = a field (no depot)', field.landed && field.landed.townKey === null);

  const vSoft = E.verdict(soft);
  ok('verdict: delivered to Crawfordsville', vSoft.deliveredTown === 'Crawfordsville');
  ok('verdict: on target', vSoft.onTarget);
  ok('verdict: soft + before the train → no penalties beyond rail estimate',
    vSoft.nycHours === E.forwardHours(soft.x));
  const vLate = E.verdict(dropIn(-1.5, E.TOWNS.crawfordsville.x, E.TOWNS.crawfordsville.y, 8000));
  near('verdict: missing the evening train costs +10 h', vLate.nycHours, vSoft.nycHours + 10, 1e-3);
  const vWreck = E.verdict(wreck);
  ok('verdict: wreck adds +10 h', vWreck.nycHours >= vSoft.nycHours + 10);
  const vField = E.verdict(field);
  ok('verdict: a field adds +8 h', vField.nycHours >= E.forwardHours(field.x) + 8 - 1e-9);
  ok('verdict: unlanded state has no verdict', E.verdict(E.makeState('1859')) === null);

  // east progress pays: forwardHours is monotone decreasing and clamped
  ok('mail: every km east helps', E.forwardHours(10000) < E.forwardHours(0));
  near('mail: clamp low at 30 h (Indy railhead)', E.forwardHours(120000), 30, 1e-9);
  near('mail: clamp high at 54 h', E.forwardHours(-50000), 54, 1e-9);
}

// ══════════════════════════════════════════════════════════════════════════
// §9 · a scripted 1859 mission — replayed bit-for-bit
// ══════════════════════════════════════════════════════════════════════════

function fly1859() {
  const st = E.makeState('1859');
  st.launched = true;
  const sc = E.SCENARIOS['1859'];
  const T = E.TOWNS.crawfordsville;
  let valveUntil = -1e9, valveCool = 0, nextBag = 0, vented = 0, wantZ = 1400, lastPlan = -1e9;
  for (let i = 0; i < 7200 && !st.landed; i++) {
    const d = Math.hypot(T.x - st.x, T.y - st.y);
    if (d < 2600) {
      // arrival: rope out; valve down to ~3.4 m/s (residual cruise deficit
      // counts), then hold that rate; below the rope's catch the valve stays
      // open to punch out of the rope equilibrium and finish the touchdown
      st.ropeOut = true;
      st.valveOpen = st.z > 60 ? st.vz > -3.4 : st.vz > -0.8;
      if (st.vz < -4.2 && st.t >= nextBag && st.ballastBags > 0) {
        E.dropBallast(st, 1); nextBag = st.t + 15;     // arrest a runaway descent
      }
    } else {
      // the whole game in one loop: every 30 s, pick the altitude whose wind
      // best points at the town, then servo there with bursts and bags
      if (st.t - lastPlan >= 30) {
        lastPlan = st.t;
        const wantB = E.bearingDeg(T.x - st.x, T.y - st.y);
        let best = null;
        for (let a = 500; a <= 2600; a += 50) {
          const err = Math.abs(((E.windAt(a, sc).bearing - wantB + 540) % 360) - 180);
          if (!best || err < best.err) best = { z: a, err };
        }
        wantZ = best.z;
      }
      if (st.z > wantZ + 150 && st.vz > -0.5 && st.t >= valveCool) {
        valveUntil = st.t + 3; valveCool = st.t + 30;   // 3 s burst, 30 s latch
      }
      if (st.z < wantZ - 150 && st.vz < 0.5 && st.t >= nextBag && st.ballastBags > 2) {
        E.dropBallast(st, 1); nextBag = st.t + 40;
      }
      st.valveOpen = st.t < valveUntil;
    }
    E.step(st, 1);
  }
  return st;
}

{
  const st = fly1859();
  ok('mission: the scripted 1859 flight lands', !!st.landed);
  ok('mission: delivered to a town depot (≤5 km)', st.landed && st.landed.townKey !== null);
  const v = E.verdict(st);
  ok('mission: on target (Crawfordsville)', v.onTarget);
  ok('mission: soft enough to hand the bag over', v.tdVz <= 2.5 + 0.3);
  between('mission: flight lasts 40–120 min', v.flightMin, 40, 120);
  ok('mission: the mail makes the evening train', st.t <= E.TRAIN_S);
  between('mission: gas left after the descent plan (20–45 kg)', st.gasKg, 20, 45);

  const st2 = fly1859();
  ok('determinism: identical replay (state hash matches)',
    JSON.stringify(st2) === JSON.stringify(st));
}

// ══════════════════════════════════════════════════════════════════════════

console.log(`\n${npass} passed, ${nfail} failed`);
process.exit(nfail ? 1 : 0);
