// One Sphere — geometry for ten roof shells, either cut from one sphere
// (Utzon's 1961 solution) or drawn free-form (the 1957 competition sketch).
// Every shell is a fan of ribs leaving a pedestal ("pole"). In each shell's
// local frame the pole sits at the origin, the ribs leave it horizontally and
// bend upward toward +z; a rib is fixed by how fast it turns (its curvature).
(function (root) {
  const R = 75;           // sphere radius, m
  const SEG = 4.5;        // precast rib segment length, m
  const DEG = Math.PI / 180;

  // theta: how far the shell reaches from its pole (degrees of arc on the sphere)
  // half: half the fan angle; site: pedestal on the podium; heading 0 = hood opens north (+x)
  // lean: how far the first metre of the ridge rib leans back from vertical
  const SHELLS = [
    { id: 'A1', hall: 'Concert Hall', theta: 52, half: 22, site: [40, -30], heading: 0, lean: 10 },
    { id: 'A2', hall: 'Concert Hall', theta: 47, half: 20, site: [18, -30], heading: 0, lean: 12 },
    { id: 'A3', hall: 'Concert Hall', theta: 42, half: 17, site: [-2, -30], heading: 0, lean: 14 },
    { id: 'A4', hall: 'Concert Hall', theta: 32, half: 13, site: [-12, -30], heading: 180, lean: 10 },
    { id: 'B1', hall: 'Opera Theatre', theta: 49, half: 21, site: [34, 30], heading: 0, lean: 10 },
    { id: 'B2', hall: 'Opera Theatre', theta: 44, half: 18, site: [13, 30], heading: 0, lean: 12 },
    { id: 'B3', hall: 'Opera Theatre', theta: 39, half: 16, site: [-6, 30], heading: 0, lean: 14 },
    { id: 'B4', hall: 'Opera Theatre', theta: 30, half: 12, site: [-15, 30], heading: 180, lean: 10 },
    { id: 'R1', hall: 'Restaurant', theta: 32, half: 13, site: [-58, -66], heading: 0, lean: 12 },
    { id: 'R2', hall: 'Restaurant', theta: 27, half: 11, site: [-64, -66], heading: 180, lean: 8 },
  ];

  // Slice the sphere like an orange around its north pole: each shell gets an
  // azimuth band, with equal gaps between bands.
  const used = SHELLS.reduce((a, s) => a + 2 * s.half, 0);
  const gap = (360 - used) / SHELLS.length;
  let az = 0;
  SHELLS.forEach((s, i) => {
    s.index = i;
    s.center = az + s.half;      // azimuth of the shell's ridge rib on the sphere
    az += 2 * s.half + gap;
    s.L = R * s.theta * DEG;     // rib length, identical in both modes
    s.ribs = 2 * Math.round(s.half / 2) + 1; // ribs across the fan (odd: one ridge)
    s.bend = 0.24 + 0.035 * (i % 5); // free-form: how unevenly the ribs curl
  });

  // Curvature (1/m) at arc length s along the rib at fan position w ∈ [-1, 1].
  function curvature(shell, w, s, mode) {
    if (mode === 'sphere') return 1 / R;
    const m = 1 + 0.3 * (w * w - 1 / 3);
    return (m / R) * (1 + shell.bend * Math.cos(Math.PI * s / shell.L));
  }

  // Total angle the rib has turned after arc length s (integral of curvature).
  function turned(shell, w, s, mode) {
    if (mode === 'sphere') return s / R;
    const m = 1 + 0.3 * (w * w - 1 / 3);
    return (m / R) * (s + shell.bend * shell.L / Math.PI * Math.sin(Math.PI * s / shell.L));
  }

  // Rib profile (r outward, h upward) after arc length s.
  function profile(shell, w, s, mode) {
    if (mode === 'sphere') return [R * Math.sin(s / R), R * (1 - Math.cos(s / R))];
    const n = 40, ds = s / n;
    let r = 0, h = 0;
    for (let k = 0; k < n; k++) {      // Simpson on each sub-step
      const a = turned(shell, w, k * ds, mode), b = turned(shell, w, (k + .5) * ds, mode), c = turned(shell, w, (k + 1) * ds, mode);
      r += ds / 6 * (Math.cos(a) + 4 * Math.cos(b) + Math.cos(c));
      h += ds / 6 * (Math.sin(a) + 4 * Math.sin(b) + Math.sin(c));
    }
    return [r, h];
  }

  // Point on a shell in its local frame; u ∈ [0, 1] along the rib, w across the fan.
  function localPoint(shell, w, u, mode) {
    const [r, h] = profile(shell, w, u * shell.L, mode);
    const phi = w * shell.half * DEG;
    return [r * Math.cos(phi), r * Math.sin(phi), h];
  }

  // Grid of local points: rows along the rib (nu+1), columns across (nw+1).
  function mesh(shell, mode, nu = 14, nw = 8) {
    const pts = [];
    for (let i = 0; i <= nu; i++) {
      const row = [];
      for (let j = 0; j <= nw; j++) row.push(localPoint(shell, -1 + 2 * j / nw, i / nu, mode));
      pts.push(row);
    }
    return pts;
  }

  // ----- quaternions -----
  const qAxis = (ax, ang) => { const s = Math.sin(ang / 2); return [Math.cos(ang / 2), ax[0] * s, ax[1] * s, ax[2] * s]; };
  const qMul = (a, b) => [
    a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
    a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
    a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
    a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0]];
  function qSlerp(a, b, t) {
    let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
    if (d < 0) { b = b.map(x => -x); d = -d; }
    if (d > 0.9995) { const q = a.map((x, i) => x + (b[i] - x) * t); const n = Math.hypot(...q); return q.map(x => x / n); }
    const th = Math.acos(d), s = Math.sin(th);
    const ka = Math.sin((1 - t) * th) / s, kb = Math.sin(t * th) / s;
    return a.map((x, i) => ka * x + kb * b[i]);
  }
  function qRotate(q, v) {
    const [w, x, y, z] = q;
    const tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0]);
    return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)];
  }

  // Where a shell is at assembly progress t (0 = on the sphere, 1 = on the podium).
  // On the sphere the shell is flipped so its pole sits at (0,0,R), spun to its band;
  // on site it is stood up so the ridge rib leaves the pedestal almost vertically,
  // leaning back by lean, and bends forward over the open mouth.
  function placement(shell, t) {
    const onSphere = qMul(qAxis([0, 0, 1], shell.center * DEG), qAxis([1, 0, 0], Math.PI));
    const stand = qMul(qAxis([0, 1, 0], -(90 + shell.lean) * DEG), qAxis([1, 0, 0], Math.PI));
    const onSite = qMul(qAxis([0, 0, 1], shell.heading * DEG), stand);
    const q = qSlerp(onSphere, onSite, t);
    const lift = 28 * Math.sin(Math.PI * t);
    const off = [shell.site[0] * t, shell.site[1] * t, R * (1 - t) + lift];
    return { q, off };
  }
  const place = (p, pl) => { const v = qRotate(pl.q, p); return [v[0] + pl.off[0], v[1] + pl.off[1], v[2] + pl.off[2]]; };

  // Each shell flies in its own window, staggered by index.
  const STAGGER = 0.045;
  function shellT(shell, t) {
    const span = 1 - STAGGER * (SHELLS.length - 1);
    const x = Math.min(1, Math.max(0, (t - shell.index * STAGGER) / span));
    return x * x * (3 - 2 * x);
  }

  // Precast segments: every rib is cut into SEG-long pieces. Two pieces can share
  // a mould only if their curvature matches at both ends (radius to 0.5 m).
  function moulds(mode) {
    const keys = new Set();
    let segments = 0;
    for (const s of SHELLS) {
      const n = Math.ceil(s.L / SEG);
      for (let j = 0; j < s.ribs; j++) {
        const w = -1 + 2 * j / (s.ribs - 1);
        for (let k = 0; k < n; k++) {
          const a = 1 / curvature(s, w, k * SEG, mode), b = 1 / curvature(s, w, Math.min(s.L, (k + 1) * SEG), mode);
          keys.add(Math.round(a * 2) + ':' + Math.round(b * 2));
          segments++;
        }
      }
    }
    return { curves: keys.size, segments };
  }

  // Largest distance (m) between a shell's surface and the best sphere through its pole.
  function deviation(shell, mode) {
    let worst = 0;
    for (let j = 0; j <= 8; j++) for (let i = 0; i <= 14; i++) {
      const p = localPoint(shell, -1 + j / 4, i / 14, mode);
      worst = Math.max(worst, Math.abs(Math.hypot(p[0], p[1], p[2] - R) - R));
    }
    return worst;
  }

  const api = { R, SEG, SHELLS, curvature, profile, localPoint, mesh, placement, place, shellT, moulds, deviation, qRotate };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OneSphereModel = api;
})(typeof self !== 'undefined' ? self : this);
