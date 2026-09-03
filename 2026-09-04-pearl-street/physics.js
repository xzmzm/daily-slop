// physics.js — the closed forms of the 110-volt mile.
// Every number the studio shows comes from here, so every number is testable.
//
// The whole lesson is one identity chain. A feeder of one-way length L, going
// AND coming back (2 L of copper), carries the load current I = P / V and is
// allowed a sag ΔV before the far lamps dim:
//
//     ΔV = I · R = (P/V) · 2ρL/A   →   A = 2ρLP / (ΔV·V)
//     m  = ρ_m · A · 2L            = 4 ρ ρ_m L² P / (ΔV·V²)
//
// Copper per delivered watt scales as 1/V². That one exponent is why Edison's
// district was a square mile, why the war of the currents went to
// transformers, and why the record line today is DC again — a million volts
// higher.

// Annealed copper at 20 °C: IACS standard 5.8×10⁷ S/m. 1882 copper was a
// little worse; the identity chain doesn't care.
export const RHO_CU = 1.7241e-8;   // Ω·m, electrical resistivity
export const CU_DENSITY = 8960;    // kg/m³, mass density
export const W_PER_HP = 745.7;     // W per mechanical horsepower (Lauffen's 300 hp)
export const SQ_MI = 2589988.11;   // m² in one square mile — the "First District"

// The lamp laws (classic incandescent scaling, per-unit of rated voltage):
// lumens go as V^3.4, life goes as V^−13. Dim is long-lived; bright is brief.
export const FLUX_EXP = 3.4;
export const LIFE_EXP = -13;

export function lampFlux(ratio) {
  return Math.pow(ratio, FLUX_EXP);
}

export function lampLife(ratio) {
  return Math.pow(ratio, LIFE_EXP);
}

// A lamp is just its hot filament resistance: P = V²/R, I = V/R.
export function lampPower(V, R) {
  return (V * V) / R;
}

export function lampCurrent(V, R) {
  return V / R;
}

// Current drawn by a load P at voltage V — amps are what the copper pays for.
export function loadCurrent(P, V) {
  return P / V;
}

// --- the feeder chain -------------------------------------------------------
// Cross-section that keeps the drop at ΔV for power P over one-way length L.
export function wireArea(P, L, V, dV) {
  return (2 * RHO_CU * L * P) / (dV * V);
}

// Wire diameter for a solid round conductor of area A.
export function wireDiameter(A) {
  return Math.sqrt((4 * A) / Math.PI);
}

// Copper mass of the loop: two conductors, each one-way L.
export function copperMass(P, L, V, dV) {
  return CU_DENSITY * wireArea(P, L, V, dV) * 2 * L;
}

// The same chain computed step by step (R → I → ΔV → m). The studio shows
// both and the tests hold them to each other — no hidden constants.
export function feederSteps(P, L, V, dV) {
  const A = wireArea(P, L, V, dV);
  const R = (2 * RHO_CU * L) / A;
  const I = loadCurrent(P, V);
  return {
    area: A,
    resistance: R,
    current: I,
    dropCheck: I * R,
    mass: CU_DENSITY * A * 2 * L,
    lossW: I * dV,
  };
}

// Loss fraction is the drop ratio — an identity, not an approximation:
// loss = I·ΔV, delivered = I·V, so loss/delivered = ΔV/V, and
// efficiency = V/(V+ΔV) = 1/(1 + ΔV/V).
export function lossFraction(dV, V) {
  return dV / V;
}

export function efficiency(dV, V) {
  return 1 / (1 + lossFraction(dV, V));
}

// Drop needed to reach length L on area A: invert the area formula.
export function dropForLength(P, L, V, A) {
  return (P / V) * ((2 * RHO_CU * L) / A);
}

// How far that area reaches before spending the whole ΔV budget.
export function reachPoint(P, A, dV, V) {
  return (A * dV * V) / (2 * RHO_CU * P);
}

// --- the street -------------------------------------------------------------
// A square mile is a circle of one radius; that radius is Edison's world.
export function districtRadius(area) {
  return Math.sqrt(area / Math.PI);
}

// Drop when the whole load P hangs at the far end of a loop of area A.
export function dropPointLoad(P, L, V, A) {
  return dropForLength(P, L, V, A);
}

// Drop when the same P is spread evenly along the street. Every metre of the
// go conductor carries only the current still ahead of it — and the return
// carries exactly the mirror image of that — so the integral of the triangle
// is half the rectangle:
//     ΔV = 2 · ∫₀ᴸ (ρ/A)·(P/V)·(1−x/L) dx = ρ·P·L / (A·V)
export function dropDistributed(P, L, V, A) {
  return (RHO_CU * P * L) / (A * V);
}

// --- the studio's own constants (fitted, like the Blue Bird's C_dA) ---------
export const PEARL_V = 110;          // volts at the lamp
export const PEARL_dV = 10;          // volts of allowed sag
export const PEARL_L = districtRadius(SQ_MI);   // ≈ 907.95 m: the square mile as a circle
export const PEARL_P = 100000;       // one Jumbo, 100 kW
export const JUMBO_T = 27;           // tonnes per dynamo
export const JUMBO_N = 6;            // dynamos at 257 Pearl Street
export const LAMPS_FULL = 6600;      // lamps the whole house could hold
export const LAMPS_W = PEARL_P * JUMBO_N / LAMPS_FULL;  // ≈ 90.9 W — an early carbon lamp
export const LAMP_N_FIRST = 106;     // lamps that lit at Drexel, Morgan & Co.

// Area fitted so the exact reach formula lands on the square mile.
export const PEARL_A = wireArea(PEARL_P, PEARL_L, PEARL_V, PEARL_dV);

// Presets: real lines, real voltages; the free parameter is fitted so the
// closed forms reproduce the documented number (each asserted in the tests).
export const PRESETS = [
  {
    id: "pearl",
    label: "1882 · 珍珠街 110 V",
    P: PEARL_P,
    L: PEARL_L,
    V: PEARL_V,
    dV: PEARL_dV,
    A: PEARL_A,          // fitted: lands reach = 907.95 m
    target: PEARL_L,
  },
  {
    id: "lauffen",
    label: "1891 · 劳芬—法兰克福 15 kV",
    P: 300 * W_PER_HP,   // 300 hp transmitted, IEEE milestone figure
    L: 175000,
    V: 15000,
    dV: 5000,            // η = 75 % → ΔV/V = 1/3 exactly
    A: 1.79996e-5,       // fitted: lands reach = 175 km (≈ 18 mm² copper)
    target: 175000,
  },
  {
    id: "changji",
    label: "2019 · 昌吉—古泉 ±1,100 kV",
    P: 6e9,              // per pole of the 12 GW bipolar line
    L: 3293000,
    V: 1.1e6,
    dV: 61933,           // fitted: lands reach = 3,293 km on the real 8×1,250 mm² bundle
    A: 0.01,             // 8 × JL1/G2A-1250/70 per pole, as built
    target: 3293000,
  },
];

// --- the reach ladder -------------------------------------------------------
// Documented lines on a log-log field: system voltage vs distance. kind drives
// the colour; the 1882 point is the star, the 2019 point is the epilogue.
export const LINES = [
  { y: 1882, V: 110, km: 0.9, kind: "dc", name: "珍珠街，纽约", note: "110 伏直流的一平方英里。铜说了算的半径。" },
  { y: 1891, V: 15000, km: 175, kind: "ac", name: "劳芬—法兰克福", note: "15 千伏三相，300 马力，效率 75%。输电第一次跑赢街区。" },
  { y: 1896, V: 11000, km: 42, kind: "ac", name: "尼亚加拉—布法罗", note: "瀑布的水替煤打工。电站从此搬到燃料旁边。" },
  { y: 1936, V: 287000, km: 435, kind: "ac", name: "胡佛坝—洛杉矶", note: "287 千伏，第一条超高压干线。" },
  { y: 2019, V: 1100000, km: 3293, kind: "hvdc", name: "昌吉—古泉", note: "±1,100 千伏直流，3,293 公里，12,000 兆瓦。最长的一条线又是直流。" },
];

// --- the timeline -----------------------------------------------------------
export const EVENTS = [
  {
    y: 1882, date: "1882-09-04", kind: "dc", star: true, title: "珍珠街合闸", short: "珍珠街",
    text: "下午三点，爱迪生在德雷塞尔-摩根公司——J.P. 摩根的办公室——拉下开关，106 盏灯亮起。当晚第一区 59 家客户、400 盏灯；站房里是六台 27 吨的「巨象」直流发电机，110 伏。",
  },
  {
    y: 1884, date: "1884", kind: "dc", title: "508 家客户", short: "508 家客户",
    text: "两年后：508 家客户、10,164 盏灯。但一平方英里的「第一区」没有变大——110 伏跑不出这个半径，还是铜说了算。",
  },
  {
    y: 1886, date: "1886-03-20", kind: "ac", title: "大巴灵顿的变压器", short: "变压器",
    text: "威廉·斯坦利在马萨诸塞州大巴灵顿演示变压器：500 伏升到 3,000 伏送出去，再降回来点灯。电压第一次可以批发，输电与配电从此分家。",
  },
  {
    y: 1890, date: "1890-01-02", kind: "fire", title: "大火", short: "大火",
    text: "珍珠街电站几乎烧光，只有 9 号巨象完好无损。抢修队连轴转了十一天让它重新合闸；五年后整座电站还是退役拆除了。",
  },
  {
    y: 1891, date: "1891-05-16", kind: "ac", title: "劳芬—法兰克福", short: "劳芬",
    text: "175 公里、15 千伏三相、300 马力、效率 75%——内卡河上的水电点亮法兰克福的展览。同一条公式，电压从 110 换成 15,000。",
  },
  {
    y: 1893, date: "1893-05-01", kind: "ac", title: "芝加哥世博会", short: "世博会",
    text: "西屋用特斯拉的多相交流点亮约二十万盏灯。直流的「一英里世界」在展场旁边显得很小。",
  },
  {
    y: 1896, date: "1896-11-16", kind: "ac", title: "尼亚加拉到布法罗", short: "尼亚加拉",
    text: "午夜，尼亚加拉的水电走完 42 公里抵达布法罗，11 千伏三相。瀑布替煤打工，输电把电站搬到了燃料旁边。",
  },
  {
    y: 2007, date: "2007-11-14", kind: "dc", title: "最后一根直流", short: "最后的直流",
    text: "联合爱迪生公司在东 40 街 10 号剪断曼哈顿最后一根直流馈线——爱迪生的 110 伏在这个城市里整整活了 125 年。",
  },
  {
    y: 2019, date: "2019", kind: "hvdc", title: "昌吉—古泉", short: "昌吉—古泉",
    text: "±1,100 千伏特高压直流投运：3,293 公里，12,000 兆瓦，世界最长。笑到最后的是直流——只是电压高了一万倍。",
  },
];

export function kindLabel(kind) {
  return {
    dc: "直流",
    ac: "交流",
    fire: "事故",
    hvdc: "特高压直流",
  }[kind];
}
