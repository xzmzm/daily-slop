// physics.js — Carrington's Storm studio, exact closed forms.
// 1 September 1859, 11:18 a.m.: Richard Carrington, projecting the Sun onto
// a screen at Redhill, Surrey, watched two patches of white light flare over
// the great sunspot group, brighten, and fade in about five minutes — the
// first white-light flare ever recorded (Richard Hodgson saw it too, from
// Highgate). At 04:03 UT the next morning the plasma arrived: the fastest
// Sun–Earth transit on record, ~17.6 h, and the strongest geomagnetic storm
// in the history of the instrument — aurora over Cuba and Hawaii, telegraph
// keys sparking, batteries disconnected. Everything here is a formula you
// can check by hand: the light-vs-plasma race t = D/v, the dipole
// magnetopause r = (µ₀M²/32π²p)^⅙ whose sixth root swallows every pressure
// spike (64× pressure → exactly ½ the standoff), the Dessler–Parker–Sckopke
// ring-current ledger E ≈ 4×10¹³ J per nT of Dst, and the ground-current
// bookkeeping V = E·L, I = V/R that ran the Boston–Portland line on aurora
// alone.

// --- constants --------------------------------------------------------------
export const AU_KM = 1.496e8; // astronomical unit
export const C_KMS = 2.99792458e5; // km/s
export const MU0 = 4 * Math.PI * 1e-7; // T·m/A
export const DIPOLE_M = 7.84e22; // A·m² — Earth's magnetic dipole moment
export const RE_M = 6.371e6; // Earth radius, m
export const RE_KM = 6371;
export const GEO_RE = 42164 / 6371; // geosynchronous orbit, Earth radii (≈6.62)
export const L1_KM = 1.5e6; // Sun–Earth L1, upstream sentinels (ACE/DSCOVR)
export const HIROSHIMA_J = 6.3e13; // 15 kt TNT
export const L_SUN = 3.828e26; // W
export const WORLD_ELEC_W = 3.4e12; // ≈30,000 TWh/yr averaged — the human grid, W
export const DPS_J_PER_NT = 4e13; // J of ring-current energy per nT of Dst (Dessler–Parker–Sckopke)

// --- 1. the two messengers: light vs plasma ---------------------------------
// Photons bring the crochet (8 min 19 s); the CME brings the storm (~17.6 h).
export const tLightSeconds = () => AU_KM / C_KMS; // ≈ 499.0 s
export const transitHours = (vKmS) => AU_KM / vKmS / 3600;
export const speedForTransit = (hours) => AU_KM / (hours * 3600);
// minutes of warning from the L1 sentinels once the shock passes them
export const l1WarningMinutes = (vKmS) => L1_KM / vKmS / 60;
// how many photons crossed while the CME crawled: c/v
export const speedRatio = (vKmS) => C_KMS / vKmS;

// The 1859 anchors (UT hours counted from 1859-08-27 00:00):
//   CME launch ≈ 10:30 (estimated onset; the white-light peak came 11:18)
//   white-light flare peak 11:18, Sept 1  → 131.3 h
//   storm sudden commencement 04:03, Sept 2 → 148.05 h
// 148.05 − 130.5 = 17.55 h of transit; v = AU/17.55 h = 2368 km/s.
export const CARRINGTON_TRANSIT_H = 148.05 - 130.5; // 17.55 h (launch ≈ 10:30 UT)
export const CARRINGTON_V = speedForTransit(CARRINGTON_TRANSIT_H); // ≈ 2368 km/s
export const CME_LAUNCH_H = 130.5;
export const FLARE_H = 131.3; // 11:18 UT, 1 Sept 1859
export const SSC_H = 148.05; // 04:03 UT, 2 Sept 1859

// --- 2. the flare ledger ----------------------------------------------------
// Cliver & Dietrich (2013): a Carrington-class flare (~X45) radiates ~5×10³² erg.
export const FLARE_J = 5e25; // ≈ 5×10³² erg
export const FLARE_S = 300; // the white light came and went in ~5 minutes
export const flarePowerW = () => FLARE_J / FLARE_S;
export const flareFractionOfSun = () => flarePowerW() / L_SUN; // ≈ 4.4×10⁻⁴
export const flareHiroshimas = () => FLARE_J / HIROSHIMA_J; // ≈ 8×10¹¹
// The sunspot group, in millionths of a solar hemisphere (msh):
export const SUNSPOT_MSH = 2300; // the whole group, near the top of all records
export const SUNSPOT_FRAC_HEMI = SUNSPOT_MSH / 1e6; // 0.23% of one hemisphere
// 2300 msh → m² of Sun; equivalently ~9% of the disk's width, naked-eye at sunset
export const SUNSPOT_M2 = SUNSPOT_FRAC_HEMI * 2 * Math.PI * (6.957e8) ** 2;

// --- 3. the magnetopause: the sixth root that protects us -------------------
// Pressure balance at the equatorial nose: dipole field B = µ₀M/4πr³ pushed
// against solar-wind dynamic pressure p, B²/2µ₀ = p  ⇒
//     r = (µ₀M² / 32π²p)^⅙   ⇒   r ∝ p^(−1/6).
// The exponent is the whole lesson: 64× the pressure takes exactly half the
// standoff (64^⅙ = 2). A pure-dipole model — the real magnetopause sits
// ~30% further out thanks to magnetopause currents — but the −1/6 is exact.
export const standoffRe = (pNPa) =>
  Math.pow((MU0 * DIPOLE_M * DIPOLE_M) / (32 * Math.PI * Math.PI * pNPa * 1e-9), 1 / 6) / RE_M;
export const pressureForStandoffRe = (rRe) => {
  const rM = rRe * RE_M;
  return 1e9 * ((MU0 * DIPOLE_M * DIPOLE_M) / (32 * Math.PI * Math.PI * rM ** 6)); // nPa
};
// pressure that crushes the magnetopause to geosynchronous orbit (dipole-only)
export const P_AT_GEO = pressureForStandoffRe(GEO_RE);

// --- 4. the ring current: Dst as an energy meter (Dessler–Parker–Sckopke) ---
export const ringEnergyJ = (dstNt) => DPS_J_PER_NT * Math.abs(dstNt);
export const ringHiroshimas = (dstNt) => ringEnergyJ(dstNt) / HIROSHIMA_J;
export const ringGridHours = (dstNt) => ringEnergyJ(dstNt) / WORLD_ELEC_W / 3600;

// --- 5. ground currents: V = E·L, I = V/R -----------------------------------
// The storm's dB/dt drives a geoelectric field E (V/km — measured, not
// modeled: 21.66 V/km peak in Maine, March 1989). A line of length L in that
// field sees V = E·L; divide by the DC resistance of the loop for the current.
export const gicVolts = (eVkKm, lKm) => eVkKm * lKm;
export const gicAmps = (eVkKm, lKm, rOhms) => gicVolts(eVkKm, lKm) / rOhms;
// E scaled to |dH/dt| at the 1989 Maine calibration (21.66 V/km ≈ 1500 nT/hr)
export const E_PER_NTPERHR = 21.66 / 1500; // ≈ 0.0144 V/km per nT/hr
export const eFromDho = (nTperHour) => nTperHour * E_PER_NTPERHR;

// The 1859 Boston–Portland line: iron wire, ~170 km, ~1.85 kΩ loop.
// Aurora at the documented "battery off" cadence needs only ~100 mA-class
// currents — E ≈ 2 V/km does it, which is why the operators stayed on the air.
export const LINE_1859 = { lKm: 170, rOhms: 1850 };

// --- 6. aurora: how low did the sky burn ------------------------------------
// Equatorward boundary of the aurora (midnight, invariant magnetic latitude)
// vs |Dst| — historical pins, each an approximate epoch-corrected value:
//   Sept 1859: −1760 nT (Tsurutani est.) → ~18°  (Green et al. 2006)
//   May 1921:  −907 nT  → ~24°
//   Mar 1989:  −589 nT  → ~28°  (Caribbean sightings)
//   May 2024:  −412 nT  → ~27°  (photographed from Puerto Rico)
//   Oct 2003:  −383 nT  → ~33°
// Least squares on ln|Dst| (scatter is real: aurora cares about more than Dst).
export const AURORA_DATA = [
  { id: "1859", dst: -1760, mlat: 18 },
  { id: "1921", dst: -907, mlat: 24 },
  { id: "1989", dst: -589, mlat: 28 },
  { id: "2024", dst: -412, mlat: 27 },
  { id: "2003", dst: -383, mlat: 33 },
];
export const AURORA_FIT = (() => {
  const xs = AURORA_DATA.map((d) => Math.log(-d.dst));
  const ys = AURORA_DATA.map((d) => d.mlat);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < xs.length; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
  }
  const b = sxy / sxx;
  return { a: my - b * mx, b }; // Λ = a + b·ln|Dst|
})();
export const auroraMLat = (dstNt) => AURORA_FIT.a + AURORA_FIT.b * Math.log(Math.abs(dstNt));

// --- 7. the storm ladder (Dst in nT; E-field where measured) ----------------
export const STORMS = [
  {
    id: "1859", date: "1859-09-01/02", cn: "卡林顿风暴", cls: "X45 ≈",
    dst: -1760, dstRange: [-850, -1760], // Siscoe −850 … Tsurutani −1760
    eVkKm: null, note: "极光到哈瓦那与檀香山；电报拆掉电池照常收发",
  },
  {
    id: "1921", date: "1921-05-13/16", cn: "纽约铁路风暴", cls: "≈",
    dst: -907, dstRange: [-825, -907],
    eVkKm: null, note: "纽约中央铁路信号站起火；瑞典电话网瘫痪",
  },
  {
    id: "1989", date: "1989-03-13", cn: "魁北克大停电", cls: "X15",
    dst: -589, dstRange: [-589, -589],
    eVkKm: 21.66, // 1-min peak, Maine (Love et al. 2022)
    note: "魁北克 735 kV 电网 9 小时瘫痪；600 万人停电",
  },
  {
    id: "2024", date: "2024-05-10/11", cn: "盖农风暴", cls: "X8.7",
    dst: -412, dstRange: [-412, -412],
    eVkKm: 6.0, // measured peaks across US grids
    note: "32 年来最强；波多黎各拍到极光；电网基本无恙",
  },
  {
    id: "2003", date: "2003-10-29/31", cn: "万圣节风暴", cls: "X28+",
    dst: -383, dstRange: [-383, -383],
    eVkKm: 4.0, // order of measured values across N. America
    note: "极光进了佛罗里达；南非变压器烧损；SOHO 卫星受损",
  },
  {
    id: "2012", date: "2012-07-23", cn: "擦肩而过（未击中）", cls: "≈X?",
    dst: -1000, dstRange: [-600, -1200], // Baker et al.: Carrington-class
    eVkKm: null, missed: true,
    note: "STEREO-A 眼前穿过的卡林顿级 CME，地球差 9 天不在家",
  },
];

// --- 8. the 1859 replay model (parametric, hours from 1859-08-27 00:00 UT) --
// H(t): the combined Redhill-era magnetogram — storm of Aug 28/29, the
// crochet at 11:18 (with the light), the SSC, the main-phase crash, recovery.
// The bay shape e^(−d/τr) − e^(−d/τf) peaks at d* = τrτf·ln(τr/τf)/(τr−τf)
// with closed-form height, so `depth` is normalized to mean the actual minimum.
export const STORM1_SSC = 43.4; // Aug 28, 19:26 UT — the warm-up storm
const bayPeak = (tauR, tauF) => {
  const dStar = (tauR * tauF * Math.log(tauR / tauF)) / (tauR - tauF);
  return Math.exp(-dStar / tauR) - Math.exp(-dStar / tauF);
};
export const BAY_9 = bayPeak(9, 0.9);
export function dstTrace(tH, sscH = SSC_H, depth = 1600) {
  let h = 0;
  // storm 1 (Aug 28/29): modest bay (~−180 nT), aurora to ~25°
  const d1 = tH - STORM1_SSC;
  if (d1 > 0) h += (-210 / bayPeak(30, 1.2)) * (Math.exp(-d1 / 30) - Math.exp(-d1 / 1.2));
  // the crochet: with the light, not the plasma (~110 nT at Kew, ~1 h wide)
  const dC = tH - FLARE_H;
  if (dC > -1 && dC < 2) h += 110 * Math.exp(-((dC - 0.25) ** 2) / 0.12);
  // the main storm: SSC step, ~2.3 h crash to the Colaba minimum, ~9 h recovery
  const d2 = tH - sscH;
  if (d2 > 0) {
    h += 90 * Math.exp(-d2 / 2.5);
    h += (-depth / BAY_9) * (Math.exp(-d2 / 9) - Math.exp(-d2 / 0.9));
    const d3 = d2 - 13.5;
    if (d3 > 0) h += (-0.4 * depth / bayPeak(10, 0.8)) * (Math.exp(-d3 / 10) - Math.exp(-d3 / 0.8));
  }
  return h;
}
// dynamic pressure seen at Earth (nPa) — SSC spike then decay, second push
export function pressureTrace(tH, sscH = SSC_H) {
  let p = 1.6;
  const d1 = tH - STORM1_SSC;
  if (d1 > 0) p += 5 * Math.exp(-d1 / 8);
  const d2 = tH - sscH;
  if (d2 > 0) {
    p += 62 * Math.exp(-d2 / 3.5) + 7;
    const d3 = d2 - 13.5;
    if (d3 > 0) p += 18 * Math.exp(-d3 / 5);
  }
  return p;
}
// |dH/dt| in nT/hr — what the ground actually feels (drives GIC)
export function dhoTrace(tH, sscH = SSC_H, depth = 1600) {
  const dt = 1 / 60; // one minute
  return Math.abs(dstTrace(tH + dt, sscH, depth) - dstTrace(tH - dt, sscH, depth)) / (2 * dt);
}
// red-vs-green aurora: at low latitude the glow is high-altitude 630.0 nm O
export const AURORA_LINES = {
  green: { nm: 557.7, km: "100–250", who: " energetic electrons" },
  red: { nm: 630.0, km: "220–400", who: "soft electrons, deep-field glow" },
};

// --- formatting helpers (shared by app + tests) ------------------------------
export const fmt = (x, digits = 1) => (isFinite(x) ? x.toFixed(digits) : '—');
export const hhmm = (tH) => {
  const t = ((tH % 24) + 24) % 24;
  const hh = Math.floor(t), mm = Math.round((t - hh) * 60);
  return mm === 60 ? `${String(hh + 1).padStart(2, '0')}:00` : `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};
export const dayLabel = (tH) => {
  const d = Math.floor(tH / 24);
  return ["8月27日", "8月28日", "8月29日", "8月30日", "8月31日", "9月1日", "9月2日", "9月3日"][d] ?? "";
};

// --- presets ------------------------------------------------------------------
export const PRESETS = [
  {
    id: "replay1859", label: "1859 重放", note: "11:18 白光耀斑 → 17.6 小时后磁暴登陆",
    vKmS: CARRINGTON_V, depth: 1600,
  },
  {
    id: "slowCme", label: "慢速 CME 400 km/s", note: "普通太阳风的速度 → 四天半才到，风暴早就泄了劲",
    vKmS: 400, depth: 1600,
  },
  {
    id: "nearMiss", label: "2012 擦肩 3000 km/s", note: "比 1859 更快 —— 幸好地球不在家",
    vKmS: 3000, depth: 1900,
  },
  {
    id: "quebec", label: "1989 魁北克档", note: "Dst −589 nT 的现代版本：电网世纪课",
    vKmS: 1000, depth: 600,
  },
];

export const DEFAULTS = {
  vKmS: CARRINGTON_V, depth: 1600,
};
