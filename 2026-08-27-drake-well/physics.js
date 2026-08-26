// physics.js — Drake Well studio, exact closed forms.
// 27 Aug 1859: Edwin Drake's cable-tool well struck oil at 69.5 ft on Oil
// Creek, Titusville PA. Everything here is a formula you can check by hand:
// percussion energy per stroke, Darcy radial inflow, the hydrostatic rise,
// the Arps decline family, API gravity, and the 1859-61 price crash.

export const G = 9.80665;               // m/s²
export const FT_PER_M = 1 / 0.3048;
export const M_PER_FT = 0.3048;
export const BBL_PER_M3 = 6.28981077;   // 42-US-gallon barrels per cubic metre
export const DARCY_M2 = 9.869233e-13;   // one darcy in m²
export const J_PER_FT_LBF = 1.35582;

// --- 1 · cable-tool percussion drilling --------------------------------
//
// The steam engine rocks a walking beam that picks up the drill string and
// lets it fall. Each stroke delivers the free-fall energy E = m·g·h to the
// rock; rock fails when it has absorbed its specific energy S (J/m³), so
// the hole advances δ = η·E/(A·S) per stroke, A = πd²/4.

export const fallTimeM = (hM) => Math.sqrt((2 * hM) / G);

export function effectiveDropM(hM, strokesPerMin) {
  // A symmetric beam cycle of period T spends T/2 carrying the bit up, so
  // gravity only gets T/2 for the fall. Ask for a faster stroke than the
  // drop can finish and the cable snatches the bit mid-air: the effective
  // drop saturates at the distance gravity covers in T/2 — you cannot rush
  // gravity by running the engine faster.
  const halfCycle = 30 / strokesPerMin;
  return Math.min(hM, 0.5 * G * halfCycle * halfCycle);
}

export const holeAreaM2 = (diaM) => (Math.PI / 4) * diaM * diaM;

export const strokeEnergyJ = ({ massKg, dropM, strokesPerMin }) =>
  massKg * G * effectiveDropM(dropM, strokesPerMin);

export function penetrationPerStrokeM({ massKg, dropM, strokesPerMin, diaM, SE_Pa, eta }) {
  return (
    (eta * strokeEnergyJ({ massKg, dropM, strokesPerMin })) /
    (holeAreaM2(diaM) * SE_Pa)
  );
}

export function ropFtPerDay(p) {
  return penetrationPerStrokeM(p) * p.strokesPerMin * 1440 * FT_PER_M;
}

// Drake's string, calibrated: 250 kg dropping 0.9 m at 22 strokes/min on a
// 6-inch bit with η = 0.6 advances 3.02 ft/day in the 2.5 GPa shale.
export const DRAKE_RIG = {
  massKg: 250,
  dropM: 0.9,
  strokesPerMin: 22,
  diaM: 0.1524,   // 6-inch hole
  eta: 0.6,
};
export const DRAKE_ROP_TARGET_FT_PER_DAY = 3.0;

// The geologic column Drake actually met (feet below ground):
export const BEDROCK_FT = 32;      // cast-iron pipe driven to bedrock
export const OIL_SAND_FT = 59;     // first oil sand — drilling suddenly speeds up
export const STRIKE_FT = 69.5;     // 27 Aug 1859, Sunday
export const CREVICE_FT = 0.5;     // the bit dropped six inches into a crevice

export const LAYERS = [
  { id: "soil", from: 0, to: 6, SE: 1.1e9, label: "表土·砾石", color: "#6b5a3e" },
  { id: "gravel", from: 6, to: 32, SE: 5.0e9, label: "含水砾石层（必须先下套管）", color: "#4f6373" },
  { id: "shale", from: 32, to: 59, SE: 2.5e9, label: "页岩", color: "#3d4450" },
  { id: "oilsand", from: 59, to: 69.5, SE: 0.8e9, label: "第一油砂层", color: "#2e2a1c" },
  { id: "deep", from: 69.5, to: 84, SE: 3.2e9, label: "更深的岩层（1859 年无人问津）", color: "#33383f" },
];

export function layerAtFt(ft) {
  return LAYERS.find((l) => ft >= l.from && ft < l.to) || LAYERS[LAYERS.length - 1];
}

export function ropAtFt(ft, rig) {
  return ropFtPerDay({ ...rig, SE_Pa: layerAtFt(ft).SE });
}

// --- 2 · why the oil climbs the hole (hydrostatics) ---------------------
//
// The water pressure in the sand exceeds the weight of an oil column of the
// well's depth; the surplus pushes the oil up until ΔP = ρ_oil·g·h.

export function oilRiseFt(surplusKPa, sg) {
  return ((surplusKPa * 1000) / (sg * 1000 * G)) * FT_PER_M;
}

// Drake's oil stood a few feet from the derrick floor on its own.
export const DRAKE_SURPLUS_KPA = 160;   // → 65.4 ft of 0.82-SG oil in the hole
export const DRAKE_SG = 0.82;

// --- 3 · Darcy radial inflow (steady state) -----------------------------
//
//   q = 2π·k·h·(P_e − P_w) / (μ·ln(r_e/r_w))
//
// The logarithm is the protagonist: drainage radius 120 m against a 6-inch
// wellbore puts half the drawdown inside √(r_w·r_e) ≈ 3 m of the wall.

export const DRAKE_DARCY = {
  kD: 0.12,      // first-sand permeability
  hNetM: 4,      // net sand thickness
  dPkPa: 380,    // drawdown P_e − P_w
  muCp: 3.5,     // Pennsylvania crude at reservoir temperature
  reM: 120,      // drainage radius
  rwM: 0.0762,   // 6-inch wellbore radius
};

export function darcyInflowBblDay({ kD, hNetM, dPkPa, muCp, reM, rwM }) {
  const k = kD * DARCY_M2;
  const qM3s =
    (2 * Math.PI * k * hNetM * dPkPa * 1000) /
    (muCp * 1e-3 * Math.log(reM / rwM));
  return qM3s * 86400 * BBL_PER_M3;
}

// P(r) between wellbore and boundary (kPa above wellbore pressure).
export function pressureAtRkPa(rM, { dPkPa, reM, rwM }) {
  return (dPkPa * Math.log(rM / rwM)) / Math.log(reM / rwM);
}

// Radius at which half the drawdown has been spent: √(r_w·r_e), the
// geometric mean — the exact midpoint of a straight line on a log axis.
export function halfDrawdownRadiusM({ reM, rwM }) {
  return Math.sqrt(reM * rwM);
}

// --- 4 · Arps decline (1945) --------------------------------------------
//
//   q(t) = q_i·(1 + b·D_i·t)^(−1/b)
//
// b→0 exponential (solution-gas drive: new wells halve in months),
// b→1 harmonic (a strong water drive keeps the curve almost flat — Drake's
// well made ~1,000 gallons a day for three years). Cumulative production
// N(t) = ∫q dt has closed forms for every b.

export function arpsRate(qi, Di, b, tMonths) {
  if (b <= 1e-9) return qi * Math.exp(-Di * tMonths);
  return qi * Math.pow(1 + b * Di * tMonths, -1 / b);
}

export function arpsCum(qi, Di, b, tMonths) {
  if (b <= 1e-9) return (qi / Di) * (1 - Math.exp(-Di * tMonths));
  if (Math.abs(b - 1) <= 1e-9) return (qi / Di) * Math.log(1 + Di * tMonths);
  return (qi / (Di * (1 - b))) * (1 - Math.pow(1 + b * Di * tMonths, 1 - 1 / b));
}

// --- 5 · the 1859-61 price crash ----------------------------------------
//
// Drake's well flooded Oil Creek with wells: $20/bbl in 1859, 49 cents by
// 1861, when the Oil Creek Association tried to hold a $4 floor.

export const PRICE_1859 = 20;
export const PRICE_1861 = 0.49;
export const CRASH_MONTHS = 21;

export function oilPrice(tMonths) {
  if (tMonths <= 0) return PRICE_1859;
  if (tMonths >= CRASH_MONTHS) return PRICE_1861;
  return PRICE_1859 * Math.pow(PRICE_1861 / PRICE_1859, tMonths / CRASH_MONTHS);
}

// --- 6 · API gravity ----------------------------------------------------

export const apiFromSG = (sg) => 141.5 / sg - 131.5;
export const sgFromAPI = (api) => 141.5 / (api + 131.5);

export const CRUDES = [
  { id: "pa", name: "宾夕法尼亚特轻原油", api: 42, note: "1859 年的光：煤油的原料", color: "#e8c766" },
  { id: "wti", name: "西得克萨斯中间基 WTI", api: 39.6, note: "世界油价的基准", color: "#d9a83e" },
  { id: "brent", name: "布伦特 Brent", api: 38, note: "北海的基准油", color: "#c99a3a" },
  { id: "maya", name: "墨西哥玛雅重油", api: 22, note: "酸而重，炼厂才爱", color: "#7a5a20" },
  { id: "tar", name: "阿萨巴斯卡沥青", api: 8, note: "稠得能直接铺路", color: "#2b241a" },
  { id: "water", name: "淡水（参照物）", api: 10, note: "SG = 1 → 恰好 10 度", color: "#7fa8c9" },
];

// --- presets ------------------------------------------------------------

export const PRESETS = {
  drake: {
    id: "drake",
    label: "德雷克的真实钻井 · 1859",
    rig: { ...DRAKE_RIG },
    surplusKPa: DRAKE_SURPLUS_KPA,
    sg: DRAKE_SG,
    darcy: { ...DRAKE_DARCY },
    prod: { qi: 24, Di: 0.004, b: 1 },   // ~1,000 gal/day, flat for three years
    crudeId: "pa",
  },
  boom: {
    id: "boom",
    label: "1861 狂潮与崩盘",
    rig: { ...DRAKE_RIG, massKg: 320, strokesPerMin: 30 },
    surplusKPa: 300,
    sg: 0.84,
    darcy: { ...DRAKE_DARCY, kD: 0.9, dPkPa: 1200, muCp: 2.5 },
    prod: { qi: 250, Di: 0.16, b: 0.25 },
    crudeId: "pa",
  },
  giant: {
    id: "giant",
    label: "强水驱巨田 · 一百年后",
    rig: { ...DRAKE_RIG, massKg: 900, dropM: 1.4, strokesPerMin: 18, diaM: 0.3112 },
    surplusKPa: 90,
    sg: 0.86,
    darcy: { ...DRAKE_DARCY, kD: 1.8, hNetM: 12, dPkPa: 900, muCp: 1.8, reM: 400 },
    prod: { qi: 1200, Di: 0.02, b: 0.9 },
    crudeId: "brent",
  },
};
