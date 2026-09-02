// physics.js — the closed forms of the salt mile.
// Every number the studio shows comes from here, so every number is testable.

export const W_PER_HP = 745.7;          // W per mechanical horsepower
export const MPH = 2.2369362920544;     // m/s → mph
export const MS = 1 / MPH;              // mph → m/s
export const G = 9.80665;               // m/s²
export const MILE = 1609.344;           // m, the measured mile
export const RHO0 = 1.225;              // kg/m³, ISA sea level
export const ISA_K = 2.25577e-5;        // ISA troposphere lapse constant (1/m)
export const ISA_N = 4.25588;           // ISA troposphere exponent

// ISA troposphere density: ρ(h) = ρ₀ (1 − k h)^n, valid for the slider's range.
export function airDensity(h) {
  const x = Math.max(0, 1 - ISA_K * Math.max(0, h));
  return RHO0 * Math.pow(x, ISA_N);
}

export function densityRatio(h) {
  return airDensity(h) / RHO0;
}

// Drag power P_d = ½ρ C_d A v³ → collect everything that multiplies v³.
export function aeroC(h, cd, area) {
  return 0.5 * airDensity(h) * cd * area;
}

// Rolling power P_r = μ m g v → the coefficient of v.
export function rollC(mu, mass) {
  return mu * mass * G;
}

// Power actually reaching the wheels. A supercharged engine roughly holds its
// rated output as the air thins; a normally-aspirated one breathes in
// proportion to air density.
export function wheelPower(cfg) {
  const breath = cfg.supercharged ? 1 : densityRatio(cfg.h);
  return cfg.pEngine * W_PER_HP * cfg.eta * breath;
}

// Cardano's exact root of a v³ + b v = P (P ≥ 0, a > 0).
// With q = −P/a the discriminant (q/2)² + (p/3)³ is ≥ 0, so there is exactly
// one real root and no case table is needed.
export function terminalSpeed(P, a, b) {
  if (a <= 0) return b > 0 ? P / b : Infinity;
  if (P <= 0) return 0;
  const halfQ = P / (2 * a);
  const cubed = Math.pow(b / (3 * a), 3);
  const disc = Math.sqrt(halfQ * halfQ + cubed);
  return Math.cbrt(halfQ + disc) + Math.cbrt(halfQ - disc);
}

// The discriminant itself, for the on-screen Cardano work-through.
export function cardanoDisc(P, a, b) {
  const halfQ = P / (2 * a);
  return Math.sqrt(halfQ * halfQ + Math.pow(b / (3 * a), 3));
}

export function requiredPower(v, a, b) {
  return a * v * v * v + b * v;
}

// Numeric cross-check for the exact root.
export function bisectSpeed(P, a, b) {
  let lo = 0;
  let hi = Math.max(1, Math.cbrt(P / Math.max(a, 1e-12)) + 1);
  for (let i = 0; i < 200; i += 1) {
    const mid = (lo + hi) / 2;
    if (requiredPower(mid, a, b) < P) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// The trap clock: one measured mile, elapsed seconds in, mph out.
export function mphFromSeconds(t) {
  return 3600 / t;
}

export function secondsFromMph(v) {
  return 3600 / v;
}

// The record rule: total distance over total time — a harmonic mean.
export function harmonicMean(v1, v2) {
  return 2 / (1 / v1 + 1 / v2);
}

// A steady wind w along the course. Ground speeds become v ∓ w; the harmonic
// mean of the two runs is v (1 − w²/v²): the linear term cancels, the
// quadratic residue is the honest, unavoidable cost of weather.
export function windRecord(vTrue, w) {
  return vTrue * (1 - (w / vTrue) * (w / vTrue));
}

export function wheelRpm(vMs, r) {
  return (vMs / (2 * Math.PI * r)) * 60;
}

export function rimG(vMs, r) {
  return (vMs * vMs) / r / G;
}

// The star of the day. Parameters are historical where history states them
// (2,300 hp supercharged 36.7-litre Rolls-Royce R, ~4.8 t, Bonneville at
// 1,282 m) and tuned where it doesn't (C_d·A, μ, η), so that the exact
// Cardano root lands on 301.129 mph. See NOTES for the fitting discussion.
export const BLUEBIRD = {
  pEngine: 2300,
  supercharged: true,
  eta: 0.90,
  h: 1282,
  cd: 0.534,
  area: 2.05,
  mass: 4830,
  mu: 0.015,
};

export function configSpeed(cfg) {
  return terminalSpeed(wheelPower(cfg), aeroC(cfg.h, cfg.cd, cfg.area), rollC(cfg.mu, cfg.mass));
}

// Presets: real cars, real record speeds; the aero/tyre parameters are fitted
// to land the Cardano root on the record (each is asserted in the tests).
export const PRESETS = [
  {
    id: "jamais",
    label: "1899 · 电动车 66",
    tab: "limit",
    cfg: { pEngine: 55, supercharged: false, eta: 0.85, h: 0, cd: 0.90, area: 2.10, mass: 1000, mu: 0.015 },
    target: 65.79,
  },
  {
    id: "sunbeam",
    label: "1927 · 代托纳 204",
    tab: "limit",
    cfg: { pEngine: 900, supercharged: false, eta: 0.88, h: 0, cd: 0.56, area: 2.00, mass: 3300, mu: 0.025 },
    target: 203.79,
  },
  {
    id: "bluebird",
    label: "1935 · 蓝鸟 301",
    tab: "mile",
    cfg: { ...BLUEBIRD },
    target: 301.129,
  },
  {
    id: "cobb47",
    label: "1947 · 科布 394",
    tab: "limit",
    cfg: { pEngine: 2600, supercharged: false, eta: 0.90, h: 1282, cd: 0.36, area: 1.35, mass: 4600, mu: 0.012 },
    target: 394.20,
  },
];

// The record ladder, absolute flying-mile/kih land speed records.
// kind drives the colour coding; thrustN is converted to an F·v "equivalent
// shaft power" at the record speed so jet and rocket cars can share the
// cube-law chart with the piston era.
export const RECORDS = [
  { y: 1898, date: "1898-12-18", place: "Achères, 法国", driver: "夏塞卢-拉博伯爵", car: "Jeantaud Duc Électrique", kind: "electric", powerHp: 40, mph: 39.24, note: "第一次官方陆地极速纪录就是电动车：39.24 mph。四个月后就被另一辆电动车抢走。" },
  { y: 1899, date: "1899-04-29", place: "Achères, 法国", driver: "卡米耶·热纳齐", car: "La Jamais Contente", kind: "electric", powerHp: 68, mph: 65.79, note: "人类第一次开过 100 km/h —— 一辆铝壳电动车。潘哈德们的汽油机还要再等十几年。" },
  { y: 1927, date: "1927-03-29", place: "Daytona Beach, 美国", driver: "亨利·塞格雷夫", car: "Sunbeam 1000 hp", kind: "piston", powerHp: 900, mph: 203.79, note: "两台 V12 凑出 900 马力，第一次突破 200 mph。同一条海滩后来属于坎贝尔一家。" },
  { y: 1933, date: "1933-02-22", place: "Daytona Beach, 美国", driver: "马尔科姆·坎贝尔", car: "Campbell-Railton Blue Bird", kind: "piston", powerHp: 2300, mph: 272.46, note: "劳斯莱斯 R 航空发动机上车的第一年。沙滩开始显得又颠又短了。" },
  { y: 1935, date: "1935-09-03", place: "Bonneville Salt Flats, 美国", driver: "马尔科姆·坎贝尔爵士（50 岁）", car: "Campbell-Railton Rolls-Royce Blue Bird", kind: "piston", powerHp: 2300, mph: 301.129, note: "今天的主角：36.7 升机械增压 R 型 V12，2,300 马力，27 英尺长。以 1.1 mph 的余量第一个冲过 300 mph。", star: true },
  { y: 1938, date: "1938-09-16", place: "Bonneville Salt Flats, 美国", driver: "乔治·伊斯顿", car: "Thunderbolt", kind: "piston", powerHp: 3500, mph: 357.50, note: "三轴八轮的钢铁教堂。同年三次改写纪录，最后被科布收走。" },
  { y: 1939, date: "1939-08-23", place: "Bonneville Salt Flats, 美国", driver: "约翰·科布", car: "Railton Mobil Special", kind: "piston", powerHp: 2400, mph: 369.74, note: "两台无散热器的狮式发动机（冰块冷却），二战前的最后一次纪录。" },
  { y: 1947, date: "1947-09-16", place: "Bonneville Salt Flats, 美国", driver: "约翰·科布", car: "Railton Mobil Special", kind: "piston", powerHp: 2500, mph: 394.20, note: "同一辆车战后复赛，394.20 mph，此后活塞车轮驱动的纪录再没高过 403。" },
  { y: 1964, date: "1964-07-17", place: "Lake Eyre, 澳大利亚", driver: "唐纳德·坎贝尔", car: "Bluebird-Proteus CN7", kind: "turbine", powerHp: 4450, mph: 403.10, note: "老坎贝尔的儿子。燃气涡轮 4,450 马力 —— 轮驱动的绝唱，此后纪录交给推力。" },
  { y: 1970, date: "1970-10-23", place: "Bonneville Salt Flats, 美国", driver: "加里·加贝利奇", car: "Blue Flame", kind: "rocket", powerHp: null, thrustN: 98000, mph: 622.407, note: "天然气过氧化氢火箭，22,000 磅推力。第一次冲破 1,000 km/h。" },
  { y: 1983, date: "1983-10-04", place: "Black Rock Desert, 美国", driver: "理查德·诺布尔", car: "Thrust 2", kind: "jet", powerHp: null, thrustN: 76000, mph: 633.468, note: "单台 Avon 涡轮喷气。诺布尔自己开，六年无人能破。" },
  { y: 1997, date: "1997-10-15", place: "Black Rock Desert, 美国", driver: "安迪·格林", car: "ThrustSSC", kind: "jet", powerHp: null, thrustN: 223000, mph: 763.035, note: "两台 Spey，223 kN 推力，Ma 1.016 —— 陆地上唯一的超音速纪录，保持至今。" },
];

// Equivalent shaft power of a thrust machine at its record speed: P = F·v.
// Unlike a piston engine's fixed shaft output, this grows with speed itself —
// the whole reason the record left the gearbox behind.
export function equivalentPowerHp(record) {
  if (record.powerHp != null) return record.powerHp;
  return (record.thrustN * record.mph * MS) / W_PER_HP;
}

export function kindLabel(kind) {
  return {
    electric: "电动",
    piston: "活塞发动机",
    turbine: "燃气涡轮",
    rocket: "火箭",
    jet: "喷气",
  }[kind];
}
