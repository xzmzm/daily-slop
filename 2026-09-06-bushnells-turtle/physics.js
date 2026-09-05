// physics.js — the closed forms of Bushnell's Turtle (1776).
// Every number the studio shows comes from here, so every number is testable.
//
// The whole lesson is four exact machines:
//
//   1. The trim. An oak barrel 10 ft × 6 ft × 3 ft modelled as an ellipsoid:
//        V = π/6 · L·W·H,  W = ρ_sw · g · V
//      Neutral trim needs the mass budget to equal the displaced water, and
//      the air pocket that survives is an identity worth the whole lesson:
//        V_air = M_dry/ρ_sw − V_solids = Σᵢ mᵢ·(ρᵢ−ρ_sw)/(ρ_sw·ρᵢ)
//      Every kilogram of iron keel buys ~0.85 L of air; every kilogram of
//      oak costs ~0.36 L. Dense ballast is what makes a wooden submarine
//      breathe. Dropping the 200 lb of releasable lead is the emergency blow:
//        v = √(2·m_lead·g / (ρ_sw · C_d · A_plan))
//
//   2. The crank. Drag = ½ρ(C_f(Re)·S + C_D·A_f)v² with the ITTC 1957 skin
//      friction line, so the steady hand-crank speed is a cube root:
//        v = (2·η·P / (ρ·C_tot))^(1/3)
//      The documented "~3 mph" needs ~1.45 kW of cranking — a sprint, not a
//      night's work. Ground speed subtracts the tide.
//
//   3. The air. The pocket is small, and the binding limit is the CO₂ you
//      exhale, not the O₂ you breathe:
//        V̇CO₂ = 0.85 · E/348.3 L/min  (E = 100 W rest + 4× crank watts)
//        t(3%) = 0.0296 · V_air / V̇CO₂  →  30.0 min at 56 W, the number the
//      history books quote as "~30 minutes of air".
//
//   4. The mission. One deterministic tide-gate simulation: c(t) is a
//      sinusoid, the Turtle tows, cranks, dives, drills until CO₂ forces the
//      abort, releases the clockwork charge, and runs for home before dawn
//      and before her operator's arms give out. Launch on the wrong side of
//      the tide and the river decides the night.

export const G = 9.81;             // m/s²
export const FT = 0.3048;          // m per foot
export const LB = 0.45359237;      // kg per pound
export const KN = 0.514444;        // m/s per knot
export const RHO_SW = 1025;        // kg/m³, seawater (the East River is brackish; see NOTES)
export const NU_SW = 1.2e-6;       // m²/s, estuarial kinematic viscosity at ~20 °C
export const P_ATM = 101325;       // Pa

// --- the hull ----------------------------------------------------------------
// Documented: about 10 ft long, 6 ft tall, 3 ft wide; two oak shells bound
// with wrought-iron hoops, brass works by the clockmaker Isaac Doolittle.
export const HULL_L = 10 * FT;     // 3.048 m
export const HULL_H = 6 * FT;      // 1.8288 m
export const HULL_W = 3 * FT;      // 0.9144 m
export const A_SEMI = HULL_L / 2;  // 1.524 m (length semi-axis)
export const B_SEMI = HULL_W / 2;  // 0.4572 m (width semi-axis)
export const C_SEMI = HULL_H / 2;  // 0.9144 m (height semi-axis)

export const V_ENV = (Math.PI / 6) * HULL_L * HULL_W * HULL_H;   // ≈ 2.6688 m³
export const M_DISPLACED = RHO_SW * V_ENV;                        // ≈ 2735.5 kg
export const LB_DISPLACED = M_DISPLACED / LB;                     // ≈ 6031 lb

// Wetted surface, Knud Thomsen's approximation with p = 1.6075
// (exact for a sphere, good to ~1% for any ellipsoid).
export function ellipsoidArea(a, b, c) {
  const p = 1.6075;
  const term = (a ** p * b ** p + a ** p * c ** p + b ** p * c ** p) / 3;
  return 4 * Math.PI * term ** (1 / p);
}
export const WETTED_S = ellipsoidArea(A_SEMI, B_SEMI, C_SEMI);    // ≈ 11.25 m²
export const A_FRONT = (Math.PI / 4) * HULL_W * HULL_H;           // ≈ 1.3129 m²
export const A_PLAN = (Math.PI / 4) * HULL_L * HULL_W;            // ≈ 2.1885 m²

// --- the mass budget ---------------------------------------------------------
// Documented: the 200 lb releasable lead and one operator. The oak/iron/brass
// split is a reconstruction fitted so the books close on the documented
// "~30 minutes of air while working" — which, through the identity below,
// pins the fixed ballast. See NOTES.md for the fit.
export const OAK_KG = 400;          // tarred oak shells, staves and framing
export const IRON_KG = 890;         // hoops + the fixed ballast keel
export const BRASS_KG = 130;        // Doolittle's propeller, pumps, valves
export const LEAD_KG = 200 * LB;    // 90.7185 kg, documented releasable ballast
export const OPERATOR_KG = 75;      // Sgt. Ezra Lee
export const M_DRY = OAK_KG + IRON_KG + BRASS_KG + LEAD_KG + OPERATOR_KG; // ≈ 1585.7 kg
export const RHO_OAK = 750, RHO_IRON = 7870, RHO_BRASS = 8500, RHO_LEAD = 11340, RHO_BODY = 1000;
export const V_SOLIDS = OAK_KG / RHO_OAK + IRON_KG / RHO_IRON + BRASS_KG / RHO_BRASS
  + LEAD_KG / RHO_LEAD + OPERATOR_KG / RHO_BODY;                  // ≈ 0.745 m³
export const BALLAST_NEUTRAL = M_DISPLACED - M_DRY;               // ≈ 1149.8 kg

// The air pocket at neutral trim — an identity, not a choice:
//   V_air = M_dry/ρ_sw − V_solids = Σᵢ mᵢ·(ρᵢ−ρ_sw)/(ρ_sw·ρᵢ)
export const V_AIR_M3 = M_DRY / RHO_SW - V_SOLIDS;                // ≈ 0.802 m³
export const V_AIR_L = V_AIR_M3 * 1000;                           // ≈ 802 L
// Per-kilogram exchange rates of the identity:
export const IRON_BUYS_L = 1000 * (1 / RHO_SW - 1 / RHO_IRON);    // ≈ +0.848 L/kg
export const OAK_COSTS_L = 1000 * (1 / RHO_SW - 1 / RHO_OAK);     // ≈ −0.358 L/kg

// --- machine 1 · the trim ----------------------------------------------------
// Water inside the hull adds mass without adding displacement — that is the
// whole trick of the bilge tank.
export function totalMass(ballastKg, leadDropped = false) {
  return M_DRY + ballastKg - (leadDropped ? LEAD_KG : 0);
}

// Net hydrostatic force when fully submerged (positive = sinks).
export function netForce(ballastKg, leadDropped = false) {
  return G * (totalMass(ballastKg, leadDropped) - M_DISPLACED);
}

// Steady vertical speed against quadratic drag on the planform area.
export const CD_VERT = 1.0;        // bluff body broadside to its own motion
export function steadyVertSpeed(force) {
  if (Math.abs(force) < 1e-9) return 0;
  const v = Math.sqrt((2 * Math.abs(force)) / (RHO_SW * CD_VERT * A_PLAN));
  return Math.sign(force) * v;
}
export const BLOW_SPEED = steadyVertSpeed(LEAD_KG * G);           // ≈ 0.891 m/s

// Gauge pressure at depth h (Pa) — the depth gauge reads ρgh.
export function gaugePa(h) { return RHO_SW * G * h; }

// Volume of the upright ellipsoid below height z ∈ [0, H] measured from the
// keel (exact: antiderivative of the elliptical slice area).
export function volumeBelow(z) {
  const c = C_SEMI, ab = Math.PI * A_SEMI * B_SEMI;
  const u = Math.max(-c, Math.min(c, z - c));
  return ab * (u - (u * u * u) / (3 * c * c) + (2 * c) / 3);
}

// Floating draft for a given total mass (bisection on the exact volume; null
// if the craft is too heavy to float).
export function draftForMass(m) {
  if (m >= M_DISPLACED) return null;
  if (m <= 0) return 0;
  let lo = 0, hi = HULL_H;
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    if (RHO_SW * volumeBelow(mid) < m) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// --- machine 2 · the crank ---------------------------------------------------
export const PROP_EFF = 0.65;      // brass Archimedean screw, 1776 tolerances
export const CD_FORM = 0.55;       // fitted: bluff oak barrel + turret + gear

// ITTC 1957 turbulent skin-friction line.
export function cfIttc(re) {
  return 0.075 / ((Math.log10(Math.max(re, 100)) - 2) ** 2);
}

// Total drag-area coefficient at speed v: form drag + skin friction at the
// live Reynolds number.
export function dragCA(v) {
  const re = (v * HULL_L) / NU_SW;
  return CD_FORM * A_FRONT + cfIttc(re) * WETTED_S;
}
export function dragAt(v) { return 0.5 * RHO_SW * dragCA(v) * v * v; }

// Closed form with a frozen skin-friction term (the lesson line).
export function steadySpeedFrozen(pCrank, cf) {
  const cTot = CD_FORM * A_FRONT + cf * WETTED_S;
  return ((2 * pCrank * PROP_EFF) / (RHO_SW * cTot)) ** (1 / 3);
}

// Steady speed: fixed-point iteration of the same cube root with the live
// Reynolds number (converges to machine precision in a handful of passes).
export function steadySpeed(pCrank) {
  let v = steadySpeedFrozen(pCrank, cfIttc((0.6 * HULL_L) / NU_SW));
  for (let i = 0; i < 24; i += 1) {
    v = steadySpeedFrozen(pCrank, cfIttc((v * HULL_L) / NU_SW));
  }
  return v;
}

// Crank watts needed to hold a given water speed (inverse of steadySpeed).
export function crankWattsFor(v) {
  return (0.5 * RHO_SW * dragCA(v) * v * v * v) / PROP_EFF;
}

export const CLAIM_MPH = 3;                     // the "~3 mph" period claim
export const CLAIM_MS = 3 * 0.44704;            // 1.3411 m/s
export const CLAIM_WATTS = crankWattsFor(CLAIM_MS);

// --- machine 3 · the air -----------------------------------------------------
// Metabolic watts: 100 W of resting burn plus 4× the crank watts delivered
// (muscle is ~25% efficient). A litre of O₂ releases ~20.9 kJ; RQ = 0.85.
export const REST_W = 100, CRANK_RATIO = 4, J_PER_L_O2 = 20900, RQ = 0.85;
export function metabolicW(pCrank) { return REST_W + CRANK_RATIO * pCrank; }
export function vo2Lpm(pCrank) { return metabolicW(pCrank) / 348.333; }   // L/min
export function vco2Lpm(pCrank) { return RQ * vo2Lpm(pCrank); }           // L/min

export const CO2_START = 0.0004, O2_START = 0.209;
export const CO2_ABORT = 0.03, CO2_DANGER = 0.05, O2_FLOOR = 0.15;

export function co2After(minutes, pCrank) {
  return CO2_START + (vco2Lpm(pCrank) * minutes) / V_AIR_L;
}
export function o2After(minutes, pCrank) {
  return Math.max(0, O2_START - (vo2Lpm(pCrank) * minutes) / V_AIR_L);
}
export function timeToCo2(pCrank, frac = CO2_ABORT) {
  return ((frac - CO2_START) * V_AIR_L) / vco2Lpm(pCrank);   // minutes
}
export function timeToO2(pCrank, frac = O2_FLOOR) {
  return ((O2_START - frac) * V_AIR_L) / vo2Lpm(pCrank);     // minutes
}

// The documented "~30 minutes of air" is the 56 W crank line; Lee started the
// Eagle run with only ~20 minutes left in the pocket.
export const SPEC_CRANK_W = 56;    // t(3%) lands on 30.0 min (asserted in tests)
export const AIR_PRESETS = [
  { id: "spec", w: SPEC_CRANK_W, label: "规格 · 三十分钟",
    note: "56 W 曲柄：二氧化碳到 3% 正好三十分钟——史书上那个数。" },
  { id: "drill", w: 130, label: "钻头 · 十六分钟",
    note: "顶着木钻 130 W：十六分钟就得撒手。" },
  { id: "rest", w: 0, label: "静坐 · 一个半小时",
    note: "不动 0 W：光坐着，这袋气也只够一个半小时。" },
];

// --- machine 4 · the mission -------------------------------------------------
// One deterministic tide gate. c(t) < 0 = adverse (pushes the Turtle back
// toward Manhattan); 2.1 kn at the surface, 45% of that at the 2 m running
// depth. Wall-clock hours are decimal (23.0 = 11 pm); the loop runs in
// mission-elapsed time so the night can cross midnight.
export const MISSION = {
  launchTowMin: 10,          // whaleboats tow the Turtle out (documented assist)
  distance: 2000,            // m, Whitehall slip → the Eagle's berth (reconstructed)
  towTo: 1400,               // m, where the whaleboats cast off
  towSpeed: 1.5,             // m/s
  diveAt: 1850,              // m, dive for the final run
  depthFactor: 0.45,         // current at 2 m vs the surface
  surfaceCrank: 110,         // W on the surface legs
  diveCrank: 90,             // W on the submerged run
  drillCrank: 130,           // W fighting the auger against the strap
  retreatCrank: 110,         // W going home
  fatigueMin: 240,           // four hours of cranking is all one man has
  tideAmpKn: 2.1,            // East River range for the night
  advMaxHour: 1.2,           // wall-clock hour of the strongest adverse current
  tidePeriodH: 12.4206,      // the M2 period
  dawnHour: 5.75,            // ~05:45, first light betrays a copper dome
  fuseMin: 40,               // clockwork on the released charge
  spottedMin: 8,             // into the drilling, the Governors Island sentry
  dt: 6,                     // s, fixed step — the sim is exactly repeatable
};

export function tideKn(hour) {
  return -MISSION.tideAmpKn * Math.cos(
    (2 * Math.PI * (hour - MISSION.advMaxHour)) / MISSION.tidePeriodH);
}
// The night's slack waters, wall-clock hours. The M2 period is 12.42 h, not
// 12, so a zero of the curve does not repeat at the same wall hour a day
// later — count quarter-periods from the adverse peak instead.
export const SLACKS = [MISSION.advMaxHour + (7 * MISSION.tidePeriodH) / 4,
  MISSION.advMaxHour + MISSION.tidePeriodH / 4];  // ≈ 22:56 and 04:18

export function simulateMission({ launchHour = 23 } = {}) {
  const ev = [];
  const track = [];
  const dtS = MISSION.dt;
  const dtH = dtS / 3600;
  const dtMin = dtS / 60;
  const dawnTau = (MISSION.dawnHour - launchHour + 24) % 24;
  let tau = 0, x = 0, co2 = CO2_START, crankMin = 0;
  let phase = "tow";          // tow → surface → dive → drill → retreat
  let released = false, releaseTau = 0, ashore = false, spent = false;
  const clock = () => fmtClock(launchHour + tau);
  const at = (kind, note) => ev.push({ t: tau, kind, x, co2, phase, note });

  at("launch", `${clock()} 从白厅滑道下水，捕鲸艇拖带出港。`);

  while (tau < dawnTau) {
    const cSurf = tideKn(launchHour + tau) * KN;     // m/s, + toward the ship
    const crank = phase === "dive" ? MISSION.diveCrank
      : phase === "drill" ? MISSION.drillCrank
      : phase === "retreat" ? MISSION.retreatCrank : MISSION.surfaceCrank;
    const arms = spent ? 0 : 1;                      // fatigue zeroes the crank
    const v = phase === "tow" ? MISSION.towSpeed : steadySpeed(crank) * arms;

    if (phase === "tow") {
      x += v * dtH * 3600;
      if (x >= MISSION.towTo) {
        x = MISSION.towTo;
        at("castoff", `${clock()} 解缆。从这里到「鹰」号还有 ${Math.round(MISSION.distance - x)} 米，得自己摇。`);
        phase = "surface";
      }
    } else if (phase === "surface") {
      crankMin += dtMin * arms;
      if (!spent && crankMin >= MISSION.fatigueMin) {
        spent = true;
        at("fatigue", `${clock()} 曲柄摇满四小时，胳膊先于气袋见底。只剩潮流摆布。`);
      }
      co2 += (0.0004 - co2) * (1 - Math.exp(-dtMin / 2));      // ventilators open
      x += (v + cSurf) * dtH * 3600;
      if (x >= MISSION.diveAt) {
        at("dive", `${clock()} 距船 ${Math.round(MISSION.distance - x)} 米，注水下潜。`);
        phase = "dive";
      }
    } else if (phase === "dive") {
      crankMin += dtMin;
      const cDep = cSurf * MISSION.depthFactor;
      x += (v + cDep) * dtH * 3600;
      co2 += (vco2Lpm(MISSION.diveCrank) * dtMin) / V_AIR_L;
      if (x >= MISSION.distance) {
        x = MISSION.distance;
        at("arrive", `${clock()} 抵达「鹰」号船底，抬头启动木钻。`);
        phase = "drill";
      } else if (co2 >= CO2_ABORT) {
        co2 = 0.01;                                // surface, vent, go again
        at("vent", `${clock()} 气袋到 3%，被迫上浮换气，再潜。`);
        phase = "surface";
      }
    } else if (phase === "drill") {
      crankMin += dtMin;
      co2 += (vco2Lpm(MISSION.drillCrank) * dtMin) / V_AIR_L;
      const arriveEv = ev.find((e) => e.kind === "arrive");
      if (!ev.some((e) => e.kind === "spotted")
          && (tau - arriveEv.t) * 60 >= MISSION.spottedMin) {
        at("spotted", `${clock()} 总督岛上的哨兵发现了水面上的铜穹顶，喊声顺水传开。`);
      }
      if (co2 >= CO2_ABORT) {
        at("abort", `${clock()} 二氧化碳到 3%，胸口的空气开始发烫——木钻还是咬不进舵铁的垫铁。撒手，上浮。`);
        at("release", `${clock()} 解脱火药桶，钟表引信走 ${MISSION.fuseMin} 分钟。`);
        released = true; releaseTau = tau;
        phase = "retreat";
      }
    } else if (phase === "retreat") {
      crankMin += dtMin * arms;
      if (!spent && crankMin >= MISSION.fatigueMin) {
        spent = true;
        at("fatigue", `${clock()} 曲柄摇满四小时，撤退只剩半条胳膊和半股潮。`);
      }
      co2 += (0.0004 - co2) * (1 - Math.exp(-dtMin / 2));
      x -= (v - cSurf) * dtH * 3600;               // adverse current now helps home
      if (!ashore && x <= 0) {
        ashore = true;
        at("ashore", `${clock()} 爬上白厅的石阶，浑身是泥。`);
      }
      x = Math.max(x, 0);
      if (released && (tau + dtH) * 60 >= releaseTau * 60 + MISSION.fuseMin) {
        at("boom", `${clock()} 身后一声闷响，水柱在「鹰」号旁炸起——火药桶按时起爆，离他 ${(Math.abs(MISSION.distance - x) / 1000).toFixed(1)} 公里。`);
        return finish("boom");
      }
    }
    track.push({ t: tau, x, phase, co2 });
    tau += dtH;
  }
  at("dawn", `${clock()} 天亮了——铜穹顶还漂在河面上，任务失败：未抵达。`);
  return finish("dawn");

  function finish(outcome) {
    const arriveEv = ev.find((e) => e.kind === "arrive");
    const boomEv = ev.find((e) => e.kind === "boom");
    return {
      outcome, events: ev, track,
      arrived: Boolean(arriveEv),
      arrivalHours: arriveEv ? arriveEv.t : null,
      abortCO2: ev.find((e) => e.kind === "abort")?.co2 ?? null,
      detonationKm: boomEv ? Math.abs(MISSION.distance - boomEv.x) / 1000 : null,
      ashoreBeforeBoom: ashore,
      crankMinutes: crankMin,
    };
  }
}

export function fmtClock(h) {
  const hh = Math.floor(((h % 24) + 24) % 24);
  const mm = Math.floor((h - Math.floor(h)) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export const LAUNCH_PRESETS = [
  { h: 23, id: "history", label: "史实 · 23:00 出发",
    note: "1776 年 9 月 6 日夜的实际航次：拖带、顶流约一个半小时、钻不进、放雷、抢在起爆前登岸。" },
  { h: 20, id: "early", label: "早潮 · 20:00 出发",
    note: "顺流出发，很快贴上船底——但撤退时潮水还没转向，起爆时人还被推在河上。" },
  { h: 1, id: "missed", label: "错过 · 01:00 出发",
    note: "顶着夜里最强的一股流出发：整夜被往上游推，胳膊先摇空，天亮也到不了。" },
];

// --- the timeline ------------------------------------------------------------
export const EVENTS = [
  {
    y: 1775, date: "1775", kind: "build", title: "耶鲁的木桶", short: "耶鲁木桶",
    text: "大卫·布什内尔从耶鲁毕业那年，在康涅狄格造出「海龟」：两扇橡木壳像桶一样箍起来，黄铜件出自钟表匠杜立特尔。它用手摇螺旋桨前进——这是螺旋桨推进水上的第一次记载，比实用化早了七十年。",
  },
  {
    y: 1775, date: "1775-11", kind: "trial", title: "冷夜萤火", short: "萤火熄灭",
    text: "秋天在长岛海峡试航。舱内仪表靠萤火菌的微光照明，十一月的一个冷夜萤火熄了，试航停摆过冬；原定艇长、布什内尔的弟弟又病倒，李军士接手。",
  },
  {
    y: 1776, date: "1776-09-06 夜", kind: "attack", star: true, title: "鹰之夜", short: "鹰之夜",
    text: "九月六日夜到七日凌晨，李军士乘「海龟」由捕鲸艇拖带接近白厅外的英舰队，顶流苦摇约两小时抵达旗舰「鹰」号船底。木钻咬不进舵铁垫铁，气尽放弃，释放火药桶；钟表引信半小时后在东河炸起冲天水柱。人类历史上第一次潜艇攻击。",
  },
  {
    y: 1776, date: "1776-10-05", kind: "attack", title: "第二次出击", short: "二度出击",
    text: "再袭曼哈顿外海的一艘巡防舰，被值更哨发现，被迫撤回。四天后，载着「海龟」的运输船在哈德逊河被英舰击沉。布什内尔声称后来打捞过它，最终下落成谜。",
  },
  {
    y: 1777, date: "1777-08-13", kind: "mine", title: "木桶鱼雷", short: "木桶鱼雷",
    text: "布什内尔改走漂流水雷路线。一只火药桶在黑角湾炸沉「地狱犬」号的补给纵帆船，三名水手丧生——他的武器第一次真正命中。",
  },
  {
    y: 1778, date: "1778-01", kind: "mine", title: "木桶之战", short: "木桶之战",
    text: "一队火药桶顺特拉华河漂向费城外的英舰队。英军朝河面开了一整天炮，霍普森写下讽刺诗《木桶之战》。英军无一损失——但也没人再敢小看河上漂来的任何东西。",
  },
  {
    y: 1824, date: "1824", kind: "death", title: "戴维·布什", short: "布什之谜",
    text: "布什内尔战后化名「戴维·布什」，在佐治亚当医生和法官，1824 年去世后身份才被揭开。华盛顿当年评价这项工作「是一次天才的努力」。",
  },
  {
    y: 1864, date: "1864-02-17", kind: "after", title: "八十八年后", short: "八十八年后",
    text: "南军的「亨利」号在查尔斯斯顿港用杆式水雷炸沉北方护卫舰「豪萨托尼克」号——潜艇第一次真正击沉军舰，自己也一同沉没。距「海龟」的首攻，八十八年。",
  },
];

export function kindLabel(kind) {
  return {
    build: "建造", trial: "试航", attack: "出击", mine: "水雷", death: "身后", after: "回响",
  }[kind];
}
