// physics.js — the closed forms of the forward pass.
// Every number the studio shows comes from here, so every number is testable.
//
// The whole lesson is three exact machines:
//
//   1. The flight. In vacuum a pass is a parabola with release height h:
//        R  = (v cosθ / g) · (v sinθ + √(v² sin²θ + 2gh))
//        θ* = arctan( v / √(v² + 2gh) )      R* = (v/g)·√(v² + 2gh)
//      Air adds quadratic drag −k·v|v| (RK4); the spiral's low C_D is the
//      second half of the story — spin buys both stability and drag.
//
//   2. The spin. A spinning prolate spheroid is a gyroscope. The air applies
//      an overturning moment M_α·α; instead of tumbling, the axis precesses at
//      Ω = τ/(I_a ω) and the nose tracks the velocity. The artillery stability
//      factor s = I_a²ω² / (2 I_t M_α) crosses 1 at ~3 rev/s.
//
//   3. The score. The 1973 NFL passer rating: four stats → four components,
//      each clamped to [0, 2.375], summed, /6, ×100. A saturating linear
//      machine with a welded-on ceiling of 158.3.

export const G = 9.81;             // m/s²
export const MPH = 0.44704;        // m/s per mph
export const YD = 0.9144;          // m per yard
export const OZ = 0.028349523125;  // kg per ounce
export const IN = 0.0254;          // m per inch
export const RHO_AIR = 1.225;      // kg/m³, sea-level ISA

// --- the ball ---------------------------------------------------------------
// NFL rule book, mid-tolerance: long axis 11–11.25 in, short circumference
// 21–21.25 in, weight 14–15 oz. Modelled as a uniform-density prolate
// spheroid (semi-axes a > b = c) — real balls are a bladder in a shell, but
// the inertia ratios come out close.
export const BALL_M = 14.5 * OZ;              // 0.4111 kg
export const BALL_LEN = 11.125 * IN;          // 0.28258 m, long axis
export const BALL_CIRC = 21.125 * IN;         // short circumference
export const BALL_D = BALL_CIRC / Math.PI;    // 0.17073 m, minor diameter
export const A_SEMI = BALL_LEN / 2;           // 0.14129 m
export const B_SEMI = BALL_D / 2;             // 0.08536 m

// Spheroid moments of inertia (uniform density):
//   about the long axis:  I_a = (2/5) m b²
//   about a transverse axis: I_t = (1/5) m (a² + b²)
export const I_AXIAL = 0.4 * BALL_M * B_SEMI * B_SEMI;            // ≈ 1.198e-3 kg·m²
export const I_TRANS = 0.2 * BALL_M * (A_SEMI * A_SEMI + B_SEMI * B_SEMI); // ≈ 2.240e-3 kg·m²
export const REF_AREA = Math.PI * B_SEMI * B_SEMI;                // ≈ 0.02289 m²

// --- the flight -------------------------------------------------------------
export const CD_SPIRAL = 0.10;   // spin-stabilised, nose first (a sphere is ~0.45)
export const CD_TUMBLE = 0.75;  // end-over-end punt, crossflow

// Quadratic-drag coefficient k in a = −k·|v|·v (per metre).
export function dragK(cd) {
  return (0.5 * RHO_AIR * cd * REF_AREA) / BALL_M;
}

// Vacuum closed forms with release height h. Land at y = 0.
export function vacuumRange(v, angleRad, h) {
  const vz = v * Math.sin(angleRad);
  const vx = v * Math.cos(angleRad);
  return (vx / G) * (vz + Math.sqrt(vz * vz + 2 * G * h));
}

export function vacuumHangtime(v, angleRad, h) {
  const vz = v * Math.sin(angleRad);
  return (vz + Math.sqrt(vz * vz + 2 * G * h)) / G;
}

export function vacuumApex(v, angleRad, h) {
  const vz = v * Math.sin(angleRad);
  return h + (vz * vz) / (2 * G);
}

// The exact best angle and best range at release height h (h = 0 → 45°).
export function optimalAngle(v, h) {
  return Math.atan(v / Math.sqrt(v * v + 2 * G * h));
}

export function optimalRange(v, h) {
  return (v / G) * Math.sqrt(v * v + 2 * G * h);
}

// RK4 through quadratic drag. Returns landing range, hang time, apex and the
// trajectory sampled every ~1/30 s for the chart.
export function integrateFlight(v, angleRad, h, cd, dt = 1 / 240) {
  const k = dragK(cd);
  const acc = (s) => {
    const sp = Math.hypot(s.vx, s.vy);
    return { ax: -k * sp * s.vx, ay: -G - k * sp * s.vy };
  };
  let s = { x: 0, y: h, vx: v * Math.cos(angleRad), vy: v * Math.sin(angleRad) };
  let t = 0;
  let apex = h;
  const pts = [{ x: 0, y: h, t: 0 }];
  let nextSample = 1 / 30;
  while (s.y > 0 && t < 30) {
    const a1 = acc(s);
    const s2 = { x: s.x + 0.5 * dt * s.vx, y: s.y + 0.5 * dt * s.vy,
                 vx: s.vx + 0.5 * dt * a1.ax, vy: s.vy + 0.5 * dt * a1.ay };
    const a2 = acc(s2);
    const s3 = { x: s.x + 0.5 * dt * s2.vx, y: s.y + 0.5 * dt * s2.vy,
                 vx: s.vx + 0.5 * dt * a2.ax, vy: s.vy + 0.5 * dt * a2.ay };
    const a3 = acc(s3);
    const s4 = { x: s.x + dt * s3.vx, y: s.y + dt * s3.vy,
                 vx: s.vx + dt * a3.ax, vy: s.vy + dt * a3.ay };
    const a4 = acc(s4);
    const next = {
      x: s.x + (dt / 6) * (s.vx + 2 * s2.vx + 2 * s3.vx + s4.vx),
      y: s.y + (dt / 6) * (s.vy + 2 * s2.vy + 2 * s3.vy + s4.vy),
      vx: s.vx + (dt / 6) * (a1.ax + 2 * a2.ax + 2 * a3.ax + a4.ax),
      vy: s.vy + (dt / 6) * (a1.ay + 2 * a2.ay + 2 * a3.ay + a4.ay),
    };
    t += dt;
    if (next.y > apex) apex = next.y;
    if (t >= nextSample) {
      pts.push({ x: next.x, y: next.y, t });
      nextSample += 1 / 30;
    }
    if (next.y <= 0) {
      // linear interpolation to the exact ground crossing
      const f = s.y / (s.y - next.y);
      const xLand = s.x + f * (next.x - s.x);
      const tLand = t - dt + f * dt;
      pts.push({ x: xLand, y: 0, t: tLand });
      return { range: xLand, hang: tLand, apex, pts };
    }
    s = next;
  }
  return { range: s.x, hang: t, apex, pts };   // safety net, never hit in practice
}

// Golden-section search for the drag-optimal angle at a given speed.
export function optimalAngleDrag(v, h, cd) {
  let lo = 0.05, hi = Math.PI / 3;
  const phi = (Math.sqrt(5) - 1) / 2;
  let c = hi - phi * (hi - lo), d = lo + phi * (hi - lo);
  for (let i = 0; i < 40; i += 1) {
    if (integrateFlight(v, c, h, cd).range > integrateFlight(v, d, h, cd).range) {
      hi = d; d = c; c = hi - phi * (hi - lo);
    } else {
      lo = c; c = d; d = lo + phi * (hi - lo);
    }
  }
  return (lo + hi) / 2;
}

// Binary-search the release speed that lands a drag range of exactly target m
// (fixed angle). Used to fit the studio's presets to their documented throws.
export function fitSpeed(target, angleRad, h, cd) {
  let lo = 1, hi = 120;
  for (let i = 0; i < 60; i += 1) {
    const mid = 0.5 * (lo + hi);
    if (integrateFlight(mid, angleRad, h, cd).range < target) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}

// --- the gyroscope ----------------------------------------------------------
// Overturning-moment slope M_α (N·m per radian of yaw): the air tries to flip
// any ball whose nose is off the velocity. C_mα is the fitted aerodynamic
// constant (measured football values sit around 0.05–0.15).
export const CM_ALPHA = 0.08;

export function overturnSlope(v) {
  return 0.5 * RHO_AIR * v * v * REF_AREA * BALL_D * CM_ALPHA;
}

export const spinOmega = (rps) => 2 * Math.PI * rps;

export function angularMomentum(rps) {
  return I_AXIAL * spinOmega(rps);
}

// Artillery-style gyroscopic stability factor. s > 1 → the axis holds;
// s < 1 → the wobble grows into a tumble.
export function stabilityFactor(rps, v) {
  const w = spinOmega(rps);
  return (I_AXIAL * I_AXIAL * w * w) / (2 * I_TRANS * overturnSlope(v));
}

// Spin where s = 1 exactly: the edge of stability.
export function criticalSpin(v) {
  return Math.sqrt(2 * I_TRANS * overturnSlope(v)) / I_AXIAL;  // rad/s
}

export function criticalSpinRps(v) {
  return criticalSpin(v) / (2 * Math.PI);
}

// Precession rate of the spin axis under an overturning torque at yaw α.
// The nose does not fall — it circles at Ω = τ/(I_a ω).
export function precessionRate(alphaRad, rps, v) {
  const tau = overturnSlope(v) * alphaRad;
  return tau / (I_AXIAL * spinOmega(rps));
}

// --- the passer rating ------------------------------------------------------
// NFL, 1973, Don Smith (Pro Football Hall of Fame). Four components, each
// clamped to [0, 2.375], then rating = (Σ/6)·100 → max 158.3.
export const RATING_MAX_COMPONENT = 2.375;

export function clampComponent(x) {
  return Math.min(RATING_MAX_COMPONENT, Math.max(0, x));
}

export function ratingComponents({ att, comp, yds, td, int }) {
  const raw = [
    ((comp / att) * 100 - 30) / 20,        // completion %
    (yds / att - 3) / 4,                   // yards per attempt
    ((td / att) * 100) / 5,                // touchdown %
    RATING_MAX_COMPONENT - ((int / att) * 100) / 4,   // interception %
  ];
  const c = raw.map(clampComponent);
  const value = ((c[0] + c[1] + c[2] + c[3]) / 6) * 100;
  return { raw, c, value };
}

// Component baselines (raw = 1.0 each → rating 66.7) and ceilings (2.375):
export const RATING_BASE = { compPct: 50, ypa: 7.0, tdPct: 5.0, intPct: 5.5 };
export const RATING_CEIL = { compPct: 77.5, ypa: 12.5, tdPct: 11.875, intPct: 0 };

// Same formula on the four rate stats directly (what the sliders drive).
export function ratingFromRates({ compPct, ypa, tdPct, intPct }) {
  return ratingComponents({
    att: 100, comp: compPct, yds: ypa * 100, td: tdPct, int: intPct,
  });
}

// --- the throws (presets fitted to their targets, asserted in tests) --------
export const RELEASE_H = 1.9;   // m, a quarterback's release point

export const THROWS = [
  {
    id: "first",
    label: "1906 · 第一传 · 20 码",
    v: 17.582, angleDeg: 12, h: RELEASE_H,
    note: "Robinson → Schneider 的 20 码达阵：一记平射的小抛物线（速度是拟合值）。",
  },
  {
    id: "fiftyfive",
    label: "55 mph · 平射与吊射",
    v: 55 * MPH, angleDeg: 18, h: RELEASE_H,
    note: "同一记 55 mph：18 度平射 42 码，抬到 43 度就是下面的炸弹。",
  },
  {
    id: "bomb",
    label: "60 码炸弹 · 拟合弹速",
    v: 24.584, angleDeg: 42.9, h: RELEASE_H,
    note: "落点钉在 60 码线上：还是 55 mph，只是角度换成阻力最优。",
  },
];

export const FIRST_DOWN_YD = 20;   // where Schneider caught it

// --- the seasons (real stat lines, asserted in tests) -----------------------
export const RATING_PRESETS = [
  {
    id: "manning", label: "曼宁 2004 · 121.1",
    att: 497, comp: 336, yds: 4557, td: 49, int: 10,
    note: "336/497 · 4,557 码 · 49 TD · 10 INT —— 当时的历史单季纪录。",
  },
  {
    id: "rodgers", label: "罗杰斯 2011 · 122.5",
    att: 502, comp: 343, yds: 4643, td: 45, int: 6,
    note: "343/502 · 4,643 码 · 45 TD · 6 INT —— 单季历史最高。",
  },
  {
    id: "perfect", label: "完美一场 · 158.3",
    att: 10, comp: 10, yds: 250, td: 5, int: 0,
    note: "10 传 10 中 250 码 5 达阵 0 被截：四项全顶到 2.375。",
  },
  {
    id: "nightmare", label: "噩梦一场 · 0.0",
    att: 20, comp: 5, yds: 20, td: 0, int: 5,
    note: "四项全部封底：评分公式的地板和天花板一样是焊死的。",
  },
];

// --- the timeline -----------------------------------------------------------
export const EVENTS = [
  {
    y: 1905, date: "1905 秋", kind: "crisis", title: "十九人死亡", short: "死亡赛季",
    text: "1905 赛季，报纸统计的橄榄球死亡人数是 19 人，重伤 137 人。堆人的「飞楔」阵型把这项运动推到被取缔的边缘，哥伦比亚、西北等大学干脆停办了球队。",
  },
  {
    y: 1905, date: "1905-10-09", kind: "rule", title: "白宫会议", short: "白宫会议",
    text: "西奥多·罗斯福——儿子在哈佛校队打球——把哈佛、耶鲁、普林斯顿的教练请进白宫，要求他们改革。次年春天新规则落地：前传合法化、十码三档、设立中立区、禁飞楔。",
  },
  {
    y: 1906, date: "1906-09-05", kind: "game", star: true, title: "第一记合法前传", short: "第一传",
    text: "圣路易斯大学对卡罗尔学院，罗宾逊掷出第一记合法前传——没接住，按当年规则球权直接交给对方。随后他找到施奈德，20 码达阵。球队 22 比 0 获胜，教练科切姆斯是第一位系统使用前传的教练。",
  },
  {
    y: 1906, date: "1906 赛季", kind: "game", title: "圣路易斯 11–0", short: "11–0",
    text: "科切姆斯的球队整季 11 胜 0 负，总比分 407 比 11。前传第一年只是个安全补丁，没人想到它会变成这项运动的核心动作。",
  },
  {
    y: 1912, date: "1912", kind: "rule", title: "达阵 6 分 · 四档", short: "1912 定型",
    text: "达阵定为 6 分、增加第四档进攻、球场定长 100 码，不完整传球不再直接转交球权。现代橄榄球的骨架在这一年立起来，传球开始值得冒险。",
  },
  {
    y: 1934, date: "1934", kind: "ball", title: "球变细了", short: "1934 瘦球",
    text: "规则把球改细、两端改尖，专为让传球好投。今天规则书里的球：长轴 11–11.25 英寸、短周长 21–21.25 英寸、重 14–15 盎司——本页所有惯量都从这三行尺寸来。",
  },
  {
    y: 1973, date: "1973", kind: "stat", title: "传球者评分上线", short: "1973 评分",
    text: "名人堂的唐·史密斯受命设计一个能跨时代比较四分卫的数字：四项指标、各自封顶 2.375、加起来除以六乘一百。满分 158.3，天花板焊死。",
  },
  {
    y: 1978, date: "1978", kind: "rule", title: "五码撞人线", short: "1978 放开",
    text: "防守方只允许在开球线前五码内撞接球手。传球产量立刻起飞，联盟就此进入传球时代——1978 年之前的单季传球码数纪录此后再没被提起。",
  },
  {
    y: 2004, date: "2004", kind: "stat", title: "曼宁 121.1", short: "曼宁 121.1",
    text: "佩顿·曼宁 497 传 336 中、4,557 码、49 达阵、10 被截，评分 121.1——当时的历史单季纪录。",
  },
  {
    y: 2011, date: "2011", kind: "stat", title: "罗杰斯 122.5", short: "罗杰斯 122.5",
    text: "阿隆·罗杰斯 502 传 343 中、4,643 码、45 达阵、仅 6 被截，评分 122.5，把纪录又抬一格，至今仍是单季历史最高。",
  },
];

export function kindLabel(kind) {
  return {
    crisis: "危机", rule: "规则", game: "比赛", ball: "器械", stat: "数据",
  }[kind];
}
