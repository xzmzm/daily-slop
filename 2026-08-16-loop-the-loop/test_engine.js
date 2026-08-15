// test_engine.js — assertions for the loop-the-loop engine.
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

const G = E.G;
const R = 9;                      // reference loop radius, metres
const Y0 = 2;                     // loop entry grade

// ══════════════════════════════════════════════════════════════════════════
// §1 · circle loop geometry (Prescott, 1898)
// ══════════════════════════════════════════════════════════════════════════

{
  const pts = E.circleLoop(88, Y0, R);
  near('circle: starts at entry point', pts[0][0], 88, 1e-9);
  near('circle: entry height = yBottom', pts[0][1], Y0, 1e-9);
  let top = -Infinity;
  for (const p of pts) top = Math.max(top, p[1]);
  near('circle: crest is exactly 2r above entry', top - Y0, 2 * R, 1e-6);
  let maxRad = 0, minRad = Infinity;
  for (const p of pts) {
    const d = Math.hypot(p[0] - 88, p[1] - (Y0 + R));
    maxRad = Math.max(maxRad, d); minRad = Math.min(minRad, d);
  }
  near('circle: every point sits on radius r', maxRad, R, 1e-6);
  near('circle: min radius also r (not elliptical)', minRad, R, 1e-6);
  const t0 = Math.atan2(pts[1][1] - pts[0][1], pts[1][0] - pts[0][0]);
  near('circle: entry tangent horizontal (+x)', t0, 0, 0.005);
  const n = pts.length;
  const tEnd = Math.atan2(pts[n - 1][1] - pts[n - 2][1], pts[n - 1][0] - pts[n - 2][0]);
  near('circle: exit tangent also horizontal', Math.abs(tEnd), 0, 0.005);
  // entry climbs the far side: the second point is to the right and up
  ok('circle: climbs to the right of entry (CCW)', pts[1][0] > 88 && pts[1][1] > Y0);
  near('circle: circumference ≈ 2πr', (() => {
    let L = 0;
    for (let i = 1; i < n; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    return L;
  })(), 2 * Math.PI * R, 0.05);
}

// ══════════════════════════════════════════════════════════════════════════
// §2 · clothoid loop geometry (Stengel, 1976)
// ══════════════════════════════════════════════════════════════════════════

let CLO;
{
  const rTop = 8;
  const pts = E.clothoidLoop(88, Y0, rTop, 3);
  CLO = { pts, rTop };
  const n = pts.length;
  near('clothoid: exit returns to entry height', pts[n - 1][1], Y0, 0.15);
  ok('clothoid: exit is ahead of entry (teardrop leans forward)', pts[n - 1][0] > 88 + 1);
  const top = E.loopTopAbove(pts);
  between('clothoid: top height in (2·rTop, 3.45·rTop)', top / rTop, 2.0, 3.45);

  // curvature at crest vs entry, via the tangent-angle table
  const trk = E.buildTrack([{ points: pts }]);
  const iEntry = 0;
  let iTop = 0;
  for (let i = 0; i < trk.n; i++) if (trk.pts[i][1] > trk.pts[iTop][1]) iTop = i;
  const kEntry = Math.abs(trk.kap[iEntry + 40]);
  const kTop = Math.abs(trk.kap[iTop]);
  near('clothoid: crest curvature ≈ 1/rTop', kTop, 1 / rTop, 0.12);
  ok('clothoid: entry curvature much gentler than crest', kTop / kEntry > 2.2,
    `kTop/kEntry=${(kTop / kEntry).toFixed(2)}`);
  // curvature ramps monotonically through the first half (the pull-up)
  let mono = true, prev = -Infinity;
  for (let i = 5; i < iTop - 5; i += 4) {
    if (trk.kap[i] < prev - 1e-4) mono = false;
    prev = trk.kap[i];
  }
  ok('clothoid: curvature monotone up the first half', mono);

  // matchTop: same silhouette as a circle of radius R
  const m = E.clothoidMatchTop(88, Y0, 2 * R, 3);
  near('clothoidMatchTop: crest matches the circle', E.loopTopAbove(m.points), 2 * R, 0.01);
  ok('clothoidMatchTop: matched rTop < circle r', m.rTop < R);
}

// ══════════════════════════════════════════════════════════════════════════
// §3 · track table (arc length, tangents, curvature)
// ══════════════════════════════════════════════════════════════════════════

let LAY;
{
  LAY = E.buildPreset('prescott');
  const t = LAY.track;
  let mono = true;
  for (let i = 1; i < t.n; i++) if (t.s[i] <= t.s[i - 1]) mono = false;
  ok('table: arc length strictly increasing', mono);
  // unit-speed parametrisation: |dpos/ds| ≈ 1 everywhere in the interior
  let worst = 0;
  for (let i = 2; i < t.n - 2; i += 7) {
    const a = t.posAt(t.s[i] - 0.02), b = t.posAt(t.s[i] + 0.02);
    const speed = Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.04;
    worst = Math.max(worst, Math.abs(speed - 1));
  }
  near('table: |dpos/ds| = 1 (worst sample)', worst, 0, 0.02);
  // curvature inside the circular loop is 1/r
  const loop = t.loop;
  let kmin = Infinity, kmax = -Infinity;
  for (let sv = loop.sEntry + 3; sv < loop.sTop - 2; sv += 0.15) {
    const k = t.kappaAt(sv);
    kmin = Math.min(kmin, k); kmax = Math.max(kmax, k);
  }
  near('table: loop curvature ≈ 1/r (min)', kmin, 1 / R, 0.03);
  near('table: loop curvature ≈ 1/r (max)', kmax, 1 / R, 0.03);
  // total turning through the loop part: entry → crest is exactly half a
  // turn; entry → exit (tangent back to +x) is the full 2π
  const turn = t.thetaAt(loop.sTop) - t.thetaAt(loop.sEntry - 3);
  near('table: entry→crest advances tangent by π', turn, Math.PI, 0.1);
  {
    let sExit = null;
    for (let sv = loop.sTop; sv < t.length; sv += 0.05) {
      const a = t.thetaAt(sv) % (2 * Math.PI);
      if (sv > loop.sTop + 5 && Math.abs(a) < 0.02) { sExit = sv; break; }
    }
    ok('table: tangent returns to +x after the loop', sExit != null);
    if (sExit != null) {
      near('table: full loop advances tangent by 2π',
        t.thetaAt(sExit) - t.thetaAt(loop.sEntry - 3), 2 * Math.PI, 0.12);
    }
  }
  near('layout: release height above loop bottom = H', t.posAt(LAY.sRelease)[1] - Y0, 2.5 * R, 0.08);
  near('layout: needed base = 2.5r (circle)', LAY.needed.base, 2.5 * R, 1e-9);
  ok('layout: μ=0 → μ·Δx term is zero', LAY.needed.muTerm === 0);
}

// ══════════════════════════════════════════════════════════════════════════
// §4 · energy: conservation and the speed-height exchange
// ══════════════════════════════════════════════════════════════════════════

{
  const t = LAY.track;
  const st = E.makeState(t, LAY.sRelease, 0);
  const yRel = t.posAt(LAY.sRelease)[1];
  let worstE = 0, worstV = 0;
  const dt = 1 / 240;
  while (!st.result && st.t < 40) {
    E.stepState(t, st, dt, { mu: 0, upstop: true });
    const E0 = (yRel - t.yMin);
    const head = st.y - t.yMin + st.u * st.u / (2 * G);
    worstE = Math.max(worstE, Math.abs(head - E0) / E0);
    const v2expect = 2 * G * (yRel - st.y);
    if (st.mode === 'track') worstV = Math.max(worstV, Math.abs(st.u * st.u - v2expect) / (2 * G * (yRel - t.yMin)));
  }
  ok('energy: run finishes', st.result === 'finished', `result=${st.result}`);
  near('energy: head conserved to 0.2% (μ=0)', worstE, 0, 0.002);
  near('energy: v² = 2g·Δh to 0.4%', worstV, 0, 0.004);
}

// ══════════════════════════════════════════════════════════════════════════
// §5 · the 2.5r rule — the circle's exact price
// ══════════════════════════════════════════════════════════════════════════

{
  const run = E.analyzeRun(LAY.track, LAY.sRelease, { mu: 0, upstop: true });
  ok('2.5r: H = 2.5r completes the loop (μ=0)', run.completed, `result=${run.result}`);
  near('2.5r: felt g at the crest ≈ 0 (weightless)', run.feltTop, 0, 0.06);
  near('2.5r: peak felt g ≈ 6 at the loop bottom', run.peak, 6, 0.35);

  const layShort = E.buildPreset('short');
  const runShort = E.analyzeRun(layShort.track, layShort.sRelease, { mu: 0, upstop: false });
  ok('2.5r: short release never rounds the crest on the rail',
    runShort.feltTop == null || !!runShort.detach,
    `feltTop=${runShort.feltTop}`);
  // ...and whatever happens after the fall, it never *loops*: the detach
  // happens on the ascent, before the crest sample
  ok('2.5r: short release detaches on the loop', !!runShort.detach &&
    runShort.detach.s > layShort.loop.sEntry &&
    runShort.detach.s < layShort.loop.sTop,
    `detachS=${runShort.detach && runShort.detach.s.toFixed(1)} entry=${layShort.loop.sEntry.toFixed(1)} top=${layShort.loop.sTop.toFixed(1)}`);
  // cross-check the detach point against the closed-form N(s) = 0 crossing:
  // with μ = 0, v²(s) = 2g(y_rel − y(s)), so N(s) = 2g(y_rel−y)κ + g·cosθ
  {
    const t = layShort.track;
    const yRel = t.posAt(layShort.sRelease)[1];
    let sCross = null;
    let prevN = 0;
    for (let sv = layShort.loop.sEntry; sv < layShort.loop.sTop; sv += 0.05) {
      const p = t.posAt(sv);
      const N = 2 * G * (yRel - p[1]) * t.kappaAt(sv) + G * Math.cos(t.thetaAt(sv));
      if (sv > layShort.loop.sEntry + 0.1 && prevN > 0 && N <= 0) { sCross = sv; break; }
      prevN = N;
    }
    ok('2.5r: closed form has an N=0 crossing on the ascent', sCross != null);
    near('2.5r: detach matches the closed-form N=0 point',
      runShort.detach.s, sCross, 1.5);
  }

  // analytic minimum vs bisection on the actual integrator (μ = 0, no
  // upstops — with wheels on, nearly any height completes, which is the
  // upstop lesson of §9, not the 2.5r lesson of this section). The hills
  // are flattened so the loop is the only thing that can fail the run.
  let lo = 2.2 * R, hi = 2.8 * R, Hmin = 0;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    const l = E.buildPreset('prescott', { H: mid, hills: [{ dx: 26, h: 0.25 }, { dx: 46, h: 0.2 }] });
    const r = E.analyzeRun(l.track, l.sRelease, { mu: 0, upstop: false });
    if (r.completed && !r.detach) { hi = mid; Hmin = mid; } else lo = mid;
  }
  near('2.5r: simulated minimum release ≈ 2.5r', Hmin, 2.5 * R, 0.3);
}

// ══════════════════════════════════════════════════════════════════════════
// §6 · the μ·Δx theorem — friction bills horizontal metres only
// ══════════════════════════════════════════════════════════════════════════

{
  // The law is exact on gentle grades (v²κ ≪ g): friction pays μg per
  // metre of horizontal travel, whatever the shape. Two very different
  // profiles, same Δx, same bill.
  const mk = (anchors) => E.buildTrack([{ points: E.catmull(anchors, 0.04) }]);
  const A = mk([[0, 12], [60, 2.5], [120, 2]]);
  const B = mk([[0, 12], [40, 8], [80, 3], [120, 2]]);
  const mu = 0.03;
  const rA = E.analyzeRun(A, 0.05, { mu, upstop: true });
  const rB = E.analyzeRun(B, 0.05, { mu, upstop: true });
  ok('μΔx: track A finishes', rA.result === 'finished', `result=${rA.result}`);
  ok('μΔx: track B finishes', rB.result === 'finished', `result=${rB.result}`);
  near('μΔx: heat(A) = μg·Δx (gentle grades)', rA.heat / G, mu * 120, 0.15);
  near('μΔx: heat(B) = μg·Δx', rB.heat / G, mu * 120, 0.05);
  near('μΔx: same bill for different shapes', rA.heat, rB.heat, 0.5);

  // On the real preset the fast curves add a small surcharge on top of the
  // straight-rail bill (the friction normal carries v²κ too) — a few %.
  const lay = E.buildPreset('prescott', { mu: 0.05 });
  let lo = 2.2 * R, hi = 3.6 * R, Hmin = 0;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    const l = E.buildPreset('prescott', { H: mid, mu: 0.05 });
    const r = E.analyzeRun(l.track, l.sRelease, { mu: 0.05, upstop: true });
    if (r.completed) { hi = mid; Hmin = mid; } else lo = mid;
  }
  const analytic = 2.5 * R + 0.05 * lay.needed.muDX;
  near('μΔx: simulated minimum = 2.5r + μ·Δx (±5%)', Hmin, analytic, analytic * 0.05);
  ok('μΔx: curvature surcharge is small (≤ 5%)', Hmin - analytic < analytic * 0.05,
    `surcharge=${(Hmin - analytic).toFixed(2)}m`);
}

// ══════════════════════════════════════════════════════════════════════════
// §7 · rollback: the friction preset stalls and pays everything out
// ══════════════════════════════════════════════════════════════════════════

{
  const lay = E.buildPreset('friction');
  const run = E.analyzeRun(lay.track, lay.sRelease, { mu: 0.05, upstop: true, tMax: 120 });
  ok('rollback: friction preset never completes', !run.completed, `result=${run.result}`);
  ok('rollback: car rolls back', !!run.rolledBack);
  ok('rollback: everything dissipates (heat ≥ 90% of H)', run.heat / G >= 0.9 * 2.55 * R,
    `heat=${(run.heat / G).toFixed(2)}m, H=${(2.55 * R).toFixed(2)}m`);
  ok('rollback: and nothing left over (heat ≤ 105% of H)', run.heat / G <= 1.05 * 2.55 * R,
    `heat=${(run.heat / G).toFixed(2)}m`);
}

// ══════════════════════════════════════════════════════════════════════════
// §8 · ballistic flight and re-attachment
// ══════════════════════════════════════════════════════════════════════════

{
  const lay = E.buildPreset('short');
  const t = lay.track;
  const st = E.makeState(t, lay.sRelease, 0);
  const dt = 1 / 240;
  const air = [];
  while (!st.result && st.t < 30) {
    E.stepState(t, st, dt, { mu: 0, upstop: false });
    if (st.mode === 'air') air.push({ t: st.t, x: st.x, y: st.y });
    if (air.length > 400) break;
  }
  ok('ballistic: the short run goes airborne', air.length > 10);
  // first *contiguous* flight only (later flights are different parabolas),
  // checked against y = y₀ + vy₀·τ − ½gτ² with vy₀ from the detach state
  const firstFlight = [air[0]];
  for (let i = 1; i < air.length; i++) {
    if (air[i].t - air[i - 1].t > 2.5 / 240) break;
    firstFlight.push(air[i]);
  }
  const stA = E.makeState(t, lay.sRelease, 0);
  while (!stA.result && stA.mode === 'track') {
    E.stepState(t, stA, dt, { mu: 0, upstop: false });
  }
  const r0 = firstFlight[0];
  let worst = 0;
  for (const a of firstFlight) {
    const tau = a.t - r0.t;
    const yExpect = r0.y + stA.vy * tau - 0.5 * G * tau * tau;
    worst = Math.max(worst, Math.abs(a.y - yExpect));
  }
  near('ballistic: free-fall parabola to 2 cm', worst, 0, 0.02);
  ok('ballistic: felt g is 0 in the air', st.felt === 0 || st.mode === 'track');
  // with a whisker of friction the fallen car ends up somewhere honest:
  // it either settles in the bowl, or the crash landing leaves it just
  // enough tangential speed to limp out over the hills — either way the
  // landing itself is violent (the normal component is paid as heat)
  {
    const stS = E.makeState(t, lay.sRelease, 1.5); // the chain's final push
    while (!stS.result && stS.t < 45) {
      E.stepState(t, stS, dt, { mu: 0.004, upstop: false });
    }
    ok('ballistic: fallen run terminates honestly',
      stS.result === 'stopped' || stS.result === 'finished', `result=${stS.result}`);
    ok('ballistic: the crash landing is violent (heat ≥ 8 m of head)',
      stS.heat / G >= 8, `heat=${(stS.heat / G).toFixed(1)}m`);
  }

  // ledger invariance across the landing impact (heat absorbs ½v⊥²)
  const lay2 = E.buildPreset('airtime');
  const st2 = E.makeState(lay2.track, lay2.sRelease, 0);
  const yRel = lay2.track.posAt(lay2.sRelease)[1];
  let worstLedger = 0, hops = 0, wasAir = false;
  while (!st2.result && st2.t < 60) {
    E.stepState(lay2.track, st2, dt, { mu: 0.004, upstop: false });
    if (st2.mode === 'air' && !wasAir) hops++;
    wasAir = st2.mode === 'air';
    const heads = E.energyHeads(lay2.track, st2, lay2.track.yMin);
    worstLedger = Math.max(worstLedger,
      Math.abs(heads.pe + heads.ke + heads.heat - (yRel - lay2.track.yMin)));
  }
  ok('ballistic: airtime preset hops the hills', hops >= 1, `hops=${hops}`);
  ok('ballistic: ledger balances through landings', worstLedger < 0.15,
    `worst=${worstLedger.toFixed(4)}m`);
}

// ══════════════════════════════════════════════════════════════════════════
// §9 · upstop wheels — the 1976 rescue of a too-short loop
// ══════════════════════════════════════════════════════════════════════════

{
  const lay = E.buildPreset('short');
  const noWheels = E.analyzeRun(lay.track, lay.sRelease, { mu: 0, upstop: false });
  const wheels = E.analyzeRun(lay.track, lay.sRelease, { mu: 0, upstop: true });
  ok('upstop: without wheels the short loop is left mid-air', !!noWheels.detach,
    `detach=${noWheels.detach && noWheels.detach.why}`);
  ok('upstop: with wheels the same run completes', wheels.completed, `result=${wheels.result}`);
  between('upstop: held upside down at −0.6 g', wheels.min, -1.5, -0.1);
  ok('upstop: wheels run never detaches', !wheels.detach);

  // airtime hills: side-friction floats, upstops glue (both within −1.5 g)
  const layA = E.buildPreset('airtime');
  const hop = E.analyzeRun(layA.track, layA.sRelease, { mu: 0.004, upstop: false });
  const glued = E.analyzeRun(layA.track, layA.sRelease, { mu: 0.004, upstop: true });
  ok('upstop: side-friction train hops the crests', !!hop.detach);
  ok('upstop: hop happens after the loop (on the hills)',
    hop.detach && hop.detach.s > layA.loop.sTop);
  ok('upstop: upstop train stays glued on the same track', !glued.detach && glued.completed,
    `result=${glued.result}`);
  between('upstop: crest float is gentle (−1.5 g … −0.05 g)', glued.min, -1.5, -0.05);
}

// ══════════════════════════════════════════════════════════════════════════
// §10 · clothoid vs circle — same energy, half the g bill
// ══════════════════════════════════════════════════════════════════════════

{
  const circ = E.analyzeRun(LAY.track, LAY.sRelease, { mu: 0, upstop: true });
  const layClo = E.buildPreset('clothoid', { mu: 0 });
  const clo = E.analyzeRun(layClo.track, layClo.sRelease, { mu: 0, upstop: true });
  near('clothoid: same silhouette height as the circle',
    layClo.loop.topY - Y0, 2 * R, 0.05);
  ok('clothoid: completes at the same release', clo.completed, `result=${clo.result}`);
  ok('clothoid: peak g clearly below the circle', clo.peak < 0.85 * circ.peak,
    `circle=${circ.peak.toFixed(2)}g, clothoid=${clo.peak.toFixed(2)}g`);
  between('clothoid: crest has margin, not weightless', clo.feltTop, -0.1, 1.2);
  near('clothoid: needed base = top + rTop/2',
    layClo.needed.base, (layClo.loop.topY - Y0) + layClo.loop.rTop / 2, 1e-9);
}

// ══════════════════════════════════════════════════════════════════════════
// §11 · presets integrity
// ══════════════════════════════════════════════════════════════════════════

{
  for (const name of Object.keys(E.PRESETS)) {
    const lay = E.buildPreset(name);
    const run = E.analyzeRun(lay.track, lay.sRelease,
      { mu: lay.mu, upstop: lay.upstop, tMax: 60 });
    ok(`preset ${name}: builds and terminates`, !!run.result, `result=${run.result}`);
    ok(`preset ${name}: track is substantial`, lay.track.length > 200 &&
      lay.track.n > 3000);
  }
  const pres = E.analyzeRun(LAY.track, LAY.sRelease, { mu: 0, upstop: true });
  ok('preset prescott: the flagship completes', pres.completed);
  const speedTop = Math.sqrt(Math.max(0, 2 * G * (2.5 * R - 2 * R)));
  const vTop = Math.sqrt(G * R);
  near('preset prescott: analytic v_top = √(gr)',
    vTop, speedTop, 0.05 * vTop);
}

// ══════════════════════════════════════════════════════════════════════════

console.log('');
console.log(`${npass} passed, ${nfail} failed`);
process.exit(nfail ? 1 : 0);
