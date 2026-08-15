/*
 * loop-the-loop — engine
 *
 * The pure physics of a roller-coaster vertical loop. No DOM, no canvas
 * here — so it can be unit-tested (test_engine.js) and reasoned about alone.
 *
 * The whole lesson in three lines
 * ------------------------------
 *   At the crest of a loop of radius r the rail can only *push*, so the car
 *   stays on while  v² ≥ g·r  (normal force N = m(v²/r − g) ≥ 0).
 *   Released from rest at height H above the loop's lowest point, energy
 *   gives v_top² = 2g(H − 2r)  →  the circular loop demands  H ≥ 2.5r.
 *   Coulomb friction pays μ·g per metre of *horizontal* travel — the path's
 *   shape never enters (∫μmg·cosθ·ds = μmg·Δx) — so the exact bill is
 *   H ≥ 2.5r + μ·Δx.
 *
 * The rest of the file is machinery around those three lines:
 *   • track builders — Catmull-Rom splines for hills, analytic generators
 *     for the two loop eras: Prescott's 1898 circle and the 1976 clothoid
 *     teardrop (curvature small at the fast bottom, tight at the slow top),
 *   • constrained 1-D dynamics along arc length s (exact per-substep
 *     Coulomb solution, so friction can stop the car but never reverse it),
 *   • detachment — when N < 0 (side-friction era) or N < −upstop·g
 *     (modern upstop wheels hold about −1.5 g) the car goes ballistic and
 *     is re-attached inelastically when it falls back through the rail,
 *   • analyzeRun — a fast headless pass used by the UI's verdict panel
 *     and by the tests (will it loop? peak g? felt g at the crest?).
 *
 * Conventions
 *   • SI units, y up (the app flips for canvas), g = 9.81 m/s².
 *   • th(s) is the tangent angle (unwrapped: a full loop advances 2π).
 *   • kappa(s) is signed curvature, positive = turning left; the left
 *     normal n̂ = (−sinθ, cosθ) then always points to the centre of
 *     curvature, and the car always rides the +n̂ side of the rail
 *     (above crests, inside loops) — one uniform landing test.
 */

(function (global) {
  'use strict';

  const G = 9.81;
  const DETACH_EPS = 0.01;      // in g: |N| below this counts as contact lost
  const UPSTOP_G = 1.5;         // negative normal the upstop wheels can hold
  const DS = 0.04;              // rail sample spacing, metres
  const KAPPA_MAX = 0.35;       // curvature cap: radius ≥ 2.9 m (joint guard)
  const E_clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;

  // ── small helpers ───────────────────────────────────────────────────────

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  function lastPt(pts) { return pts[pts.length - 1]; }

  // Catmull-Rom through anchors (endpoints duplicated), sampled ~every ds.
  function catmull(anchors, ds) {
    const P = [anchors[0], ...anchors, anchors[anchors.length - 1]];
    const out = [];
    for (let i = 0; i < P.length - 3; i++) {
      const p0 = P[i], p1 = P[i + 1], p2 = P[i + 2], p3 = P[i + 3];
      const segLen = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      const n = Math.max(2, Math.ceil(segLen / ds));
      for (let j = 0; j < n; j++) {
        const t = j / n, t2 = t * t, t3 = t2 * t;
        out.push([
          0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t
            + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2
            + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t
            + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2
            + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
        ]);
      }
    }
    out.push([anchors[anchors.length - 1][0], anchors[anchors.length - 1][1]]);
    return out;
  }

  // ── loop generators ─────────────────────────────────────────────────────

  // Prescott, 1898: the honest circle. Enters at (cx, yBottom) moving +x,
  // turns a full CCW 2π, exits the same point moving +x.
  function circleLoop(cx, yBottom, r, ds) {
    ds = ds || DS;
    const n = Math.max(96, Math.ceil((2 * Math.PI * r) / ds));
    const cy = yBottom + r;
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const f = (i / n) * 2 * Math.PI;
      pts.push([cx + r * Math.sin(f), cy - r * Math.cos(f)]);
    }
    return pts;
  }

  // The 1976 clothoid teardrop (Stengel): curvature ramps from kLo at the
  // fast bottom to kHi at the slow crest. Parametrised by tangent angle φ,
  // ds = dφ/κ, marched with midpoint steps so the exit returns to entry
  // height. Same total turning (2π), very different g bill.
  function clothoidLoop(cx, yBottom, rTop, ratio, ds) {
    ratio = ratio || 4;
    ds = ds || DS;
    const kHi = 1 / rTop, kLo = kHi / ratio;
    const kOf = f => kLo + (kHi - kLo) * (1 - Math.cos(f)) / 2;
    // step in φ from the local curvature alone (dφ = κ·ds): the shape then
    // scales exactly with rTop, which matchTop's bisection relies on
    const TWO_PI = 2 * Math.PI;
    const pts = [[cx, yBottom]];
    let x = cx, y = yBottom, f = 0;
    while (f < TWO_PI) {
      const df = Math.min(kOf(f) * ds, TWO_PI - f);
      const fm = f + df / 2;
      const dsg = df / kOf(fm);
      x += Math.cos(fm) * dsg;
      y += Math.sin(fm) * dsg;
      f += df;
      pts.push([x, y]);
    }
    return pts;
  }

  function loopTopAbove(pts) {
    let top = pts[0][1];
    for (const p of pts) if (p[1] > top) top = p[1];
    return top - pts[0][1];
  }

  // Binary-search the clothoid rTop whose crest matches a target height,
  // so circle and teardrop keep the same silhouette for fair comparison.
  function clothoidMatchTop(cx, yBottom, topAbove, ratio, ds) {
    let lo = topAbove / 4.2, hi = topAbove / 1.7;
    let pts = clothoidLoop(cx, yBottom, (lo + hi) / 2, ratio, ds);
    let rTop = (lo + hi) / 2;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      pts = clothoidLoop(cx, yBottom, mid, ratio, ds);
      if (loopTopAbove(pts) > topAbove) hi = mid; else lo = mid;
      rTop = mid;
    }
    return { points: pts, rTop };
  }

  // ── track assembly ──────────────────────────────────────────────────────

  // parts: [{points}] concatenated into one rail; resampled tangents and
  // signed curvature along arc length. θ is unwrapped, so a full loop
  // advances θ by exactly 2π and every s maps to one (x, y, θ, κ).
  function buildTrack(parts, ds) {
    ds = ds || DS;
    const raw = [];
    for (const part of parts) {
      for (const p of part.points) {
        const last = raw[raw.length - 1];
        if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > ds * 0.35) {
          raw.push([p[0], p[1]]);
        }
      }
    }
    // resample the concatenated polyline at a uniform ds — parts arrive
    // with mixed spacings (metre-stepped stations, 4 cm splines), and every
    // later window (smoothing, curvature) counts samples, not metres
    const rawS = [0];
    for (let i = 1; i < raw.length; i++) {
      rawS.push(rawS[i - 1] + Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]));
    }
    const total = rawS[rawS.length - 1];
    const n = Math.max(64, Math.ceil(total / ds) + 1);
    const pts = new Array(n);
    {
      let seg = 0;
      for (let i = 0; i < n; i++) {
        const sv = Math.min(total, i * ds);
        while (seg < raw.length - 2 && rawS[seg + 1] < sv) seg++;
        const span = rawS[seg + 1] - rawS[seg] || 1e-9;
        const t = E_clamp((sv - rawS[seg]) / span, 0, 1);
        pts[i] = [
          raw[seg][0] + (raw[seg + 1][0] - raw[seg][0]) * t,
          raw[seg][1] + (raw[seg + 1][1] - raw[seg][1]) * t,
        ];
      }
    }
    const s = new Float64Array(n);
    for (let i = 1; i < n; i++) {
      s[i] = s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    }
    const th = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      th[i] = Math.atan2(b[1] - a[1], b[0] - a[0]);
    }
    for (let i = 1; i < n; i++) {
      let d = th[i] - th[i - 1];
      while (d > Math.PI) { th[i] -= 2 * Math.PI; d = th[i] - th[i - 1]; }
      while (d < -Math.PI) { th[i] += 2 * Math.PI; d = th[i] - th[i - 1]; }
    }

    // Curvature comes from a lightly blurred copy of the tangent field, but
    // the geometry itself is never re-marched: positions and headings stay
    // exact. (Re-marching a smoothed heading profile digs phantom dips at
    // tangent-continuous joints — e.g. a few centimetres below grade right
    // after the loop exit, precisely where speed peaks.) The blur turns any
    // residual tangent step at a part joint into a ~0.8 m transition curve
    // instead of a one-sample curvature spike; a circle's θ is linear, so
    // loops are untouched.
    const thSm = Float64Array.from(th);
    {
      const win = Math.max(2, Math.round(0.4 / ds / 2));
      for (let pass = 0; pass < 2; pass++) {
        const nxt = Float64Array.from(thSm);
        for (let i = 0; i < n; i++) {
          let acc = 0, cnt = 0;
          for (let j = Math.max(0, i - win); j <= Math.min(n - 1, i + win); j++) {
            acc += thSm[j]; cnt++;
          }
          nxt[i] = acc / cnt;
        }
        for (let i = 0; i < n; i++) thSm[i] = nxt[i];
      }
    }

    const kap = new Float64Array(n);
    for (let i = 1; i < n - 1; i++) {
      kap[i] = (thSm[i + 1] - thSm[i - 1]) / (s[i + 1] - s[i - 1]);
    }
    kap[0] = kap[1] || 0;
    kap[n - 1] = kap[n - 2] || 0;
    // three more 3-tap passes + a physical cap (|κ| ≤ 0.35, radius ≥ 2.9 m)
    let cur = Float64Array.from(kap);
    for (let pass = 0; pass < 3; pass++) {
      const nxt = Float64Array.from(cur);
      for (let i = 1; i < n - 1; i++) nxt[i] = (cur[i - 1] + cur[i] + cur[i + 1]) / 3;
      cur = nxt;
    }
    for (let i = 0; i < n; i++) cur[i] = E_clamp(cur[i], -KAPPA_MAX, KAPPA_MAX);

    let yMin = pts[0][1], yMax = pts[0][1], xMax = pts[0][0];
    for (const p of pts) {
      if (p[1] < yMin) yMin = p[1];
      if (p[1] > yMax) yMax = p[1];
      if (p[0] > xMax) xMax = p[0];
    }

    const idxAt = (sv) => {
      let lo = 0, hi = n - 1;
      if (sv <= s[0]) return 0;
      if (sv >= s[n - 1]) return n - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (s[mid] <= sv) lo = mid; else hi = mid;
      }
      return lo;
    };

    const lerpAt = (arr, sv) => {
      const i = idxAt(sv);
      if (i >= n - 1) return arr[n - 1];
      const span = s[i + 1] - s[i] || 1e-9;
      return arr[i] + (arr[i + 1] - arr[i]) * clamp((sv - s[i]) / span, 0, 1);
    };

    const indexNear = (x, y, hint, window) => {
      let best = -1, bestD = Infinity;
      const scan = (i) => {
        if (i < 0 || i >= n) return;
        const d = (pts[i][0] - x) * (pts[i][0] - x) + (pts[i][1] - y) * (pts[i][1] - y);
        if (d < bestD) { bestD = d; best = i; }
      };
      if (hint == null) {
        for (let i = 0; i < n; i++) scan(i);
      } else {
        for (let i = Math.max(0, hint - window); i <= Math.min(n - 1, hint + window); i++) scan(i);
      }
      return best;
    };

    return {
      pts, s, th, kap: cur, kapRaw: kap, n,
      length: s[n - 1],
      yMin, yMax, xMax,
      idxAt,
      posAt(sv) {
        const i = idxAt(sv);
        if (i >= n - 1) return [pts[n - 1][0], pts[n - 1][1]];
        const span = s[i + 1] - s[i] || 1e-9;
        const t = clamp((sv - s[i]) / span, 0, 1);
        return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t,
        pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t];
      },
      thetaAt: (sv) => lerpAt(th, sv),
      kappaAt: (sv) => lerpAt(cur, sv),
      indexNear,
      loop: null, // filled by the caller: {sEntry, sTop, r, rTop, topY, cx, y0}
    };
  }

  // ── the car ─────────────────────────────────────────────────────────────

  function makeState(track, s0, u0) {
    const p = track.posAt(s0);
    return {
      mode: 'track',              // 'track' | 'air'
      s: s0, u: u0 || 0,
      x: p[0], y: p[1], vx: 0, vy: 0,
      heat: 0, t: 0, felt: 0,
      result: null,               // 'finished' | 'stopped' | 'fell' | 'timeout'
      detachS: null, detachWhy: null,
      nearIdx: track.idxAt(s0), sidePrev: 0,
      airT: 0,
      substepCount: 0,
    };
  }

  // Advance by dt using substeps ≤ 1/720 s. On the rail the per-substep
  // Coulomb solution is exact: gravity moves u, friction (impulse FI) can
  // at most stop it — never reverse it — which kills stiction chatter.
  function stepState(track, st, dt, opts) {
    const o = opts || {};
    const mu = o.mu || 0;
    const upstop = o.upstop ? (o.upstop === true ? UPSTOP_G : o.upstop) : 0;
    const eps = o.detachEps == null ? DETACH_EPS : o.detachEps;
    const tMax = o.tMax == null ? 90 : o.tMax;
    const nSub = Math.max(1, Math.ceil(dt / (1 / 1440)));
    const dts = dt / nSub;

    for (let sub = 0; sub < nSub; sub++) {
      st.t += dts;
      st.substepCount++;

      if (st.mode === 'track') {
        // midpoint heading for the gravity work — second-order in the
        // energy exchange, and the Coulomb update below stays exact
        const thM = track.thetaAt(st.s + st.u * dts / 2);
        const th = track.thetaAt(st.s);
        const k = track.kappaAt(st.s);
        const Nraw = st.u * st.u * k + G * Math.cos(th);   // per-mass normal force
        st.felt = Nraw / G;

        if (Nraw < -Math.max(eps * G, upstop * G)) {
          // the rail can't pull: side-friction era loses it at N<0, upstop
          // wheels hold on until −upstop·g
          st.mode = 'air';
          st.detachS = st.s;
          st.detachWhy = Nraw < -upstop * G && upstop > 0 ? 'beyond upstop' : 'N < 0';
          st.vx = st.u * Math.cos(th);
          st.vy = st.u * Math.sin(th);
          st.felt = 0;
          st.sidePrev = 1e-3; // we were riding the +n̂ side
          st.airT = 0;
          continue;
        }

        const fricN = Math.max(0, Nraw);
        const uStar = st.u - G * Math.sin(thM) * dts;
        const FI = mu * fricN * dts;
        let u;
        if (Math.abs(uStar) <= FI) u = 0;
        else u = uStar - Math.sign(uStar) * FI;

        const dsStep = u * dts;
        st.heat += mu * fricN * Math.abs(dsStep);
        st.s += dsStep;
        st.u = u;

        const p = track.posAt(st.s);
        st.x = p[0]; st.y = p[1];
        st.nearIdx = track.idxAt(st.s);

        if (st.s >= track.length - 0.05) { st.result = 'finished'; return; }
        if (st.s <= 0.02) {
          st.s = 0.02;
          if (u <= 0) { st.u = 0; st.result = 'stopped'; return; }
        }
        if (u === 0) {
          // static hold: tangential gravity within the friction cone
          const sn = Math.sin(track.thetaAt(st.s));
          const cs = Math.cos(track.thetaAt(st.s));
          if (Math.abs(sn) <= mu * Math.max(0, cs) + 1e-9) {
            st.result = 'stopped'; return;
          }
        }
      } else {
        // ballistic
        st.vy -= G * dts;
        st.x += st.vx * dts;
        st.y += st.vy * dts;
        st.felt = 0;
        st.airT += dts;

        st.substepCount % 24 === 0
          ? (st.nearIdx = track.indexNear(st.x, st.y, null, 0))
          : (st.nearIdx = track.indexNear(st.x, st.y, st.nearIdx, 140));
        const i = st.nearIdx;
        if (i < 3 || i > track.n - 4) { st.result = 'fell'; return; } // off the ends
        const nx = -Math.sin(track.th[i]), ny = Math.cos(track.th[i]);
        const side = (st.x - track.pts[i][0]) * nx + (st.y - track.pts[i][1]) * ny;
        const vn = st.vx * nx + st.vy * ny;

        // land when we fall back through the rail from the riding side.
        // A minimum flight time keeps the test honest at the loop's
        // self-intersection, where entry and exit rails cross at a point.
        if (st.airT > 0.03 && st.sidePrev > 1e-3 && side <= 0 && vn < 0) {
          // fell back through the rail from the riding side: land, keep the
          // tangential component, pay the normal one as heat.
          const th = track.th[i];
          const vT = st.vx * Math.cos(th) + st.vy * Math.sin(th);
          const loss = 0.5 * vn * vn;
          st.heat += loss;
          st.mode = 'track';
          st.s = track.s[i];
          st.u = vT;
          const p = track.pts[i];
          st.x = p[0]; st.y = p[1];
          st.nearIdx = i;
          st.sidePrev = 0;
          st.airT = 0;
          continue;
        }
        st.sidePrev = side;

        if (st.y < track.yMin - 2.5) { st.result = 'fell'; return; }
      }

      if (st.t > tMax) { st.result = 'timeout'; return; }
    }
  }

  // Headless full run — powers the verdict panel and the tests. The car
  // always departs with the chain's final push (1.5 m/s): released from
  // rest on the near-flat crest, a friction setting as small as μ = 0.05
  // would statically hold it there — correct physics, no ride.
  function analyzeRun(track, s0, opts, probes) {
    const o = opts || {};
    const st = makeState(track, s0, o.u0 == null ? 1.5 : o.u0);
    const dt = o.dt || 1 / 240;
    const sTop = o.sTop != null ? o.sTop : (track.loop ? track.loop.sTop : null);
    const out = {
      state: st, completed: false, fell: false, result: null,
      peak: 0, min: 0, feltTop: null, detach: null, heat: 0, duration: 0,
    };
    let prevS = st.s, maxS = st.s;
    while (!st.result) {
      stepState(track, st, dt, { ...o, dt: undefined, tMax: o.tMax == null ? 60 : o.tMax });
      if (st.s > maxS) maxS = st.s;
      if (st.felt > out.peak) out.peak = st.felt;
      if (st.felt < out.min) out.min = st.felt;
      if (sTop != null && out.feltTop == null && prevS < sTop && st.s >= sTop) {
        out.feltTop = st.felt;
      }
      if (st.mode === 'air' && !out.detach) {
        out.detach = { s: st.detachS, x: st.x, y: st.y, why: st.detachWhy };
      }
      if (probes) probes(st);
      if (st.s < maxS - 1 && !out.rolledBack) out.rolledBack = true;
      prevS = st.s;
    }
    out.completed = st.result === 'finished';
    out.fell = st.result === 'fell';
    out.result = st.result;
    out.heat = st.heat;
    out.duration = st.t;
    return out;
  }

  // Energy ledger in "metres of head": PE = y, KE = v²/2g, heat/g.
  // Their sum is the release height, always (the ledger must balance).
  function energyHeads(track, st, datum) {
    const ke = st.mode === 'track'
      ? st.u * st.u / (2 * G)
      : (st.vx * st.vx + st.vy * st.vy) / (2 * G);
    return { pe: st.y - datum, ke, heat: st.heat / G };
  }

  // ── presets ─────────────────────────────────────────────────────────────

  // One layout: flat station → chain-lift crest at exactly y0 + H (the
  // release is where the descending side crosses that height — the moment
  // the lift lets go) → first drop → loop at loopX → runout with two
  // gentle crests → brake run. H is the release height above the loop's
  // lowest point (y0), i.e. the whole energy budget.
  function buildLayout(params) {
    const p = {
      shape: 'circle', r: 9, loopX: 88, H: 24, mu: 0.006, upstop: false,
      hillW: 20, hills: [{ dx: 36, h: 1.2 }, { dx: 64, h: 0.9 }],
      ...params,
    };
    const y0 = 2;

    const matched = p.shape === 'circle'
      ? null
      : clothoidMatchTop(p.loopX, y0, 2 * p.r, 4);
    const loopPts = matched ? matched.points : circleLoop(p.loopX, y0, p.r);
    const rTop = matched ? matched.rTop : p.r;
    const exitX = lastPt(loopPts)[0];

    // flat station platform, straight (no spline bulge to launch from);
    // ends exactly where the lift spline begins, so the two never overlap
    // and double back
    const station = [];
    for (let x = -6; x <= 12; x += 1) station.push([x, y0]);

    // The first drop is a single analytic cosine ease from the lift crest
    // to the loop entry: flat at both ends (tangent-continuous with the
    // crest and the circle), convex only near the crest where the car is
    // slow, concave through the valley where it is fast, curvature → 0 at
    // the flat exit. Splines kept wiggling here — a κ < 0 patch at 20 m/s
    // launches the car off the drop — so the drop is not a spline at all.
    const xDrop0 = 34, xDrop1 = p.loopX - 1.2;
    const drop = [];
    const nDrop = Math.ceil((xDrop1 - xDrop0) / DS);
    for (let i = 0; i <= nDrop; i++) {
      const u = i / nDrop;
      drop.push([xDrop0 + (xDrop1 - xDrop0) * u,
        y0 + p.H * (1 + Math.cos(Math.PI * u)) / 2]);
    }

    const parts = [
      { points: station },
      {
        points: catmull([
          [12, y0], [16, y0], [21, y0 + 0.3 * p.H], [27, y0 + p.H], [34, y0 + p.H],
        ], DS),
      },
      { points: drop },
      { points: loopPts },
      {
        // The runout is analytic cosine bumps: y = y0 + Σ hᵢ·½(1+cos πu),
        // flat at crest and base, never a millimetre below grade. A spline
        // here dips ~12 cm before every rise (the cubic's t² term), and a
        // car at 20 m/s detaches over that false crest at exactly rail
        // height — from where it can never re-attach cleanly.
        points: (() => {
          const w = p.hillW || 20;
          const xs = p.hills.map(h => exitX + h.dx);
          const out = [];
          const xEnd = exitX + p.hills[p.hills.length - 1].dx + w + 9;
          for (let x = exitX + 1.2; x <= xEnd; x += DS / 2) {
            let y = y0;
            for (let i = 0; i < p.hills.length; i++) {
              const u = (x - xs[i]) / w;
              if (Math.abs(u) < 1) {
                y += p.hills[i].h * 0.5 * (1 + Math.cos(Math.PI * u));
              }
            }
            out.push([x, y]);
          }
          return out;
        })(),
      },
    ];

    const track = buildTrack(parts);
    track.params = p;

    // loop bookkeeping: entry sample, crest sample, radii
    let iEntry = -1, iTop = -1, topY = -Infinity;
    for (let i = 0; i < track.n; i++) {
      if (track.pts[i][0] >= p.loopX - 1e-6 && iEntry < 0) iEntry = i;
    }
    for (let i = iEntry; i < track.n; i++) {
      const dx = track.pts[i][0] - p.loopX;
      if (dx > p.r + 12) break;
      if (track.pts[i][1] > topY) { topY = track.pts[i][1]; iTop = i; }
    }
    track.loop = {
      sEntry: track.s[iEntry], sTop: track.s[iTop],
      r: p.r, rTop, topY, cx: p.loopX, y0,
    };

    // release: where the *descending* branch of the first drop crosses
    // y0 + H — the car starts at rest exactly at that height, just past
    // the crest, already leaning downhill (a coaster released on the lift
    // slope would just roll back to the station, which it still can if
    // friction wins — see the 'friction' preset).
    const targetY = y0 + p.H;
    let sRelease = -1;
    for (let i = 1; i < track.n; i++) {
      if (track.pts[i][0] > 30 && track.pts[i][0] < 52
        && track.pts[i - 1][1] >= targetY && track.pts[i][1] < targetY) {
        const t = (targetY - track.pts[i - 1][1]) / (track.pts[i][1] - track.pts[i - 1][1] || 1e-9);
        sRelease = track.s[i - 1] + t * (track.s[i] - track.s[i - 1]);
        break;
      }
    }
    if (sRelease < 0) sRelease = track.loop.sEntry - 30;

    // the exact friction bill from release to crest: μ·Δx (path-independent!)
    const rel = track.posAt(sRelease);
    const muDX = track.pts[iTop][0] - rel[0];

    return {
      track, sRelease,
      loop: track.loop,
      mu: p.mu, upstop: p.upstop, shape: p.shape,
      needed: {
        base: p.shape === 'circle' ? 2.5 * p.r : (track.loop.topY - y0) + rTop / 2,
        muTerm: p.mu * muDX,
        muDX,
      },
    };
  }

  // Why upstop wheels (Miller, 1912) had to be invented: at 20 m/s almost
  // any crest outbids the rail — gravity wins wherever v²·|κ| > g. The
  // presets reflect the eras: modern layouts ship with upstops ON; the
  // side-friction demos ('short', 'airtime') ship without, and toggling
  // the wheels on is the rescue.
  const PRESETS = {
    // 1898, Prescott's patent year: the minimum-energy circle. μ = 0 so the
    // ledger reads exactly 2.5r — weightless at the crest, ~6 g at the bottom.
    prescott: {
      shape: 'circle', r: 9, loopX: 88, H: 2.5 * 9, mu: 0, upstop: true,
      hills: [{ dx: 36, h: 1.2 }, { dx: 64, h: 0.9 }],
    },
    // too short: ~−0.9 g at the crest. Side-friction wheels → detach, fall
    // back into the bowl and oscillate; upstop wheels → held through,
    // upside down, and it completes. (Just below 2.5 r the detach parabola
    // can still leap the loop's interior and land on the far rail — 2.05 r
    // is short enough that the apex can't clear the crest.)
    short: {
      shape: 'circle', r: 9, loopX: 88, H: 2.05 * 9, mu: 0, upstop: false,
      hills: [{ dx: 36, h: 1.2 }, { dx: 64, h: 0.9 }],
    },
    // 1976: same silhouette height, same release — the teardrop spends its
    // curvature where there is no speed, and the peak g drops by half.
    clothoid: {
      shape: 'clothoid', r: 9, loopX: 88, H: 2.5 * 9, mu: 0.004, upstop: true,
      hills: [{ dx: 36, h: 1.2 }, { dx: 64, h: 0.9 }],
    },
    // bunny hops taken at full speed: crests where gravity outbids the rail
    // (v²|κ| > g), so a side-friction train genuinely leaves the rails.
    airtime: {
      shape: 'circle', r: 9, loopX: 88, H: 26, mu: 0.004, upstop: false,
      hillW: 18, hills: [{ dx: 30, h: 1.6 }, { dx: 60, h: 1.2 }],
    },
    // the friction bill: μ·Δx ≈ μ·59 m of head — short by exactly that much.
    friction: {
      shape: 'circle', r: 9, loopX: 88, H: 2.55 * 9, mu: 0.05, upstop: true,
      hills: [{ dx: 36, h: 1.2 }, { dx: 64, h: 0.9 }],
    },
  };

  function buildPreset(name, overrides) {
    return buildLayout({ ...PRESETS[name], ...(overrides || {}) });
  }

  // ── exports ─────────────────────────────────────────────────────────────

  const API = {
    G, DS, DETACH_EPS, UPSTOP_G,
    catmull, circleLoop, clothoidLoop, clothoidMatchTop, loopTopAbove,
    buildTrack, buildLayout, buildPreset, PRESETS,
    makeState, stepState, analyzeRun, energyHeads,
    clamp,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  } else {
    global.LoopEngine = API;
  }
})(typeof window !== 'undefined' ? window : globalThis);
