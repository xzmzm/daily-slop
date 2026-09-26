/* core.js — the physics of adhesion railways, 1825 edition.
 *
 * Everything the UI shows is computed here so tests can pin it down:
 *  - cylinder tractive effort from bore × stroke × boiler pressure,
 *  - the adhesion ceiling  μ × weight-on-drivers,
 *  - train resistance      rolling + grade,
 *  - and the verdict: RUNS / SLIPS / STALLS (grip-limited vs pull-limited).
 */

'use strict';

const LB_PER_LONG_TON = 2240;
const MPH_PER_FPS = 3600 / 5280;

// Locomotion No. 1 (Stephenson, 1825) — the commonly cited figures.
// Cylinders 9¾ in bore × 24 in stroke, vertical, half-embedded in the
// single-flue boiler; four coupled 4-ft wheels; ~6½ long tons engine
// weight, all of it adhesive thanks to the coupling rods.
const LOCO = {
  engineTons: 6.5,
  adhesiveTons: 6.5,
  cylBoreIn: 9.75,
  cylStrokeIn: 24,
  driverCircumferenceIn: Math.PI * 48,
  boilerPsi: 50,
  cylinderEff: 0.85,
};

// Two double-acting cylinders: mean rail force ≈ 2 × eff × P × A × (stroke/circ).
function tractiveEffort(psi = LOCO.boilerPsi) {
  const area = Math.PI * (LOCO.cylBoreIn / 2) ** 2; // in²
  return (2 * LOCO.cylinderEff * psi * area * LOCO.cylStrokeIn)
    / LOCO.driverCircumferenceIn;
}

const TE0 = tractiveEffort(); // ≈ 1,009 lbf at 50 psi

const RAIL = {
  dry: { mu: 0.25, label: 'Dry rail' },
  wet: { mu: 0.15, label: 'Wet rail' },
  frost: { mu: 0.10, label: 'Frost' },
  leaves: { mu: 0.06, label: 'Leaves' },
};
const SAND_BOOST = 0.10; // sand lifts μ by this much, capped at dry
const MU_CAP = RAIL.dry.mu;

// Era-appropriate rolling resistance: iron tyre on iron rail, plain
// greased axle bearings, chaldron wagons — roughly 10 lbf per long ton
// (period estimates for 1820s stock run 8–15).
const ROLL_LB_PER_TON = 10;

// A loaded chaldron wagon: ~2.5 t of coal + ~1.2 t tare.
const WAGON_LONG_TONS = 3.7;
const COACH_LONG_TONS = 2.0; // "Experiment", a road-coach body on rails
const PASSENGER_LB = 160;

function muWithSand(condition, sand) {
  return sand
    ? Math.min(RAIL[condition].mu + SAND_BOOST, MU_CAP)
    : RAIL[condition].mu;
}

function trainTons(wagons, { coach = false, passengers = 0 } = {}) {
  return LOCO.engineTons
    + wagons * WAGON_LONG_TONS
    + (coach ? COACH_LONG_TONS : 0)
    + (passengers * PASSENGER_LB) / LB_PER_LONG_TON;
}

/* The one function that decides everything.
 * grade: fraction, +uphill / −downhill (0.01 = 1 in 100). */
function computeForces({ grade, wagons, condition = 'dry', sand = false,
                          coach = false, passengers = 0 }) {
  const tons = trainTons(wagons, { coach, passengers });
  const adhesion = muWithSand(condition, sand) * LOCO.adhesiveTons * LB_PER_LONG_TON;
  const rolling = tons * ROLL_LB_PER_TON;
  const gradeLb = tons * LB_PER_LONG_TON * grade;
  const demand = rolling + gradeLb; // lbf the rail must supply at steady speed

  const applied = Math.min(TE0, adhesion);
  let regime;
  if (demand <= 0) regime = 'coasting';           // gravity alone pulls it along
  else if (demand <= applied) regime = 'runs';    // grip and pull both suffice
  else if (adhesion >= TE0) regime = 'stalls';    // wheels hold, cylinders can't
  else regime = 'slips';                          // grip runs out first: wheelspin

  return { tons, adhesion, rolling, gradeLb, demand, applied, regime, TE0 };
}

/* Max loaded wagons a grade permits (verdict 'runs' boundary). */
function maxWagons(grade, { condition = 'dry', sand = false } = {}) {
  const adhesion = muWithSand(condition, sand) * LOCO.adhesiveTons * LB_PER_LONG_TON;
  const pull = Math.min(TE0, adhesion);
  const perTon = ROLL_LB_PER_TON + LB_PER_LONG_TON * grade;
  if (perTon <= 0) return Infinity;
  const gross = pull / perTon; // long tons, engine included
  return Math.max(0, Math.floor((gross - LOCO.engineTons) / WAGON_LONG_TONS + 1e-9));
}

// Speed dynamics: steam admission means the available pull sags with speed
// (v_half ≈ 8 mph), which caps the top speed somewhere near the 15 mph
// opening-day reporters clocked.
const V_HALF_MPH = 8;
const V_MAX_MPH = 15.5;

function tractiveAtSpeed(vMph) {
  return TE0 * V_HALF_MPH / (V_HALF_MPH + Math.max(0, vMph));
}

/* Advance one timestep. state: { v (mph), wheelTurns, slip, moving } */
function step(state, f, dt) {
  const massSlugs = (f.tons * LB_PER_LONG_TON) / 32.174;
  const wheelCircFt = Math.PI * 4; // 4-ft drivers
  let v = state.v; // mph

  if (f.regime === 'slips' || f.regime === 'stalls') {
    // Train grinds to a halt; the wheels still spin when grip failed first.
    v = Math.max(0, v - 6 * dt);
    const wheelMph = f.regime === 'slips' ? v + 9 : 0;
    state.wheelTurns += (wheelMph * MPH_PER_FPS / wheelCircFt) * dt;
    state.slip = f.regime === 'slips';
    state.moving = false;
  } else {
    // rolling + grade (grade is negative downhill, so it pushes) + windage
    const pull = f.regime === 'coasting' ? 0 : Math.min(tractiveAtSpeed(v), f.adhesion);
    const windage = 6 * v; // lbf — keeps the top end honest
    const netLbf = pull - (f.rolling + f.gradeLb) - windage;
    const vFps = Math.max(0, Math.min(V_MAX_MPH / MPH_PER_FPS,
      v / MPH_PER_FPS + (netLbf / massSlugs) * dt));
    v = vFps * MPH_PER_FPS;
    state.wheelTurns += (vFps / wheelCircFt) * dt;
    state.slip = false;
    state.moving = v > 0.05;
  }
  state.v = v;
  return state;
}

/* ---------- The 1825 line, schematic but in honest proportions ---------- */

// Distances after Tomlinson; elevations schematic. Through route ≈ 23.5 mi.
const ROUTE = {
  totalMiles: 23.5,
  points: [
    { mile: 0.0, elev: 300, name: 'Phoenix Pit' },
    { mile: 1.1, elev: 210, name: 'Gaunless' },
    { mile: 3.0, elev: 430, name: 'Brusselton summit' },
    { mile: 4.5, elev: 330, name: "Mason's Arms" },
    { mile: 13.0, elev: 135, name: 'Darlington' },
    { mile: 23.5, elev: 25, name: 'Stockton' },
  ],
  segments: [
    { from: 0.0, to: 1.1, mode: 'rope', label: 'Etherley banks — stationary engine & rope, 1 in 30½' },
    { from: 1.1, to: 1.7, mode: 'horse', label: 'Gaunless bridge — horses' },
    { from: 1.7, to: 4.5, mode: 'rope', label: 'Brusselton banks — rope, 1 in 33½' },
    { from: 4.5, to: 13.0, mode: 'loco', label: "Mason's Arms → Darlington — Locomotion No. 1, 8½ mi falling" },
    { from: 13.0, to: 23.5, mode: 'loco', label: 'Darlington → Stockton — near level, falling to the Tees' },
  ],
  // Opening-day milestones for the animated replay.
  events: [
    { mile: 0.0, title: 'Coal out', text: 'Twelve chaldrons of coal let down Etherley North Bank by rope, horses over the Gaunless, rope up Brusselton.' },
    { mile: 4.5, title: 'Locomotion couples on', text: 'The coach Experiment and 21 new wagons fitted with seats; 450–600 people aboard. Away at 10–12 mph.' },
    { mile: 8.6, title: '35-minute repair', text: 'A stop to mend the engine on the way to Darlington.' },
    { mile: 13.0, title: 'Darlington, 2 h out', text: 'Water, more riders: 31 vehicles, 550 passengers.' },
    { mile: 19.8, title: '3 h 7 min leg', text: 'The Stockton leg crawls — crowds, cheering, garden gates open.' },
    { mile: 23.3, title: 'A crushed foot', text: 'A rider clinging to a wagon falls near Stockton; the next wagon runs over his foot. The line’s first casualty.' },
    { mile: 23.5, title: 'Stockton', text: 'Arrival amid a cheering crowd — the first public steam-hauled passenger train is history.' },
  ],
};

function segmentAt(mile) {
  return ROUTE.segments.find(s => mile >= s.from && mile < s.to) || ROUTE.segments[ROUTE.segments.length - 1];
}

function elevAt(mile) {
  const p = ROUTE.points;
  for (let i = 0; i < p.length - 1; i++) {
    if (mile >= p[i].mile && mile <= p[i + 1].mile) {
      const t = (mile - p[i].mile) / (p[i + 1].mile - p[i].mile);
      return p[i].elev + t * (p[i + 1].elev - p[i].elev);
    }
  }
  return p[p.length - 1].elev;
}

const EXPORTS = {
  LB_PER_LONG_TON, LOCO, TE0, tractiveEffort, RAIL, ROLL_LB_PER_TON,
  WAGON_LONG_TONS, muWithSand, trainTons, computeForces, maxWagons,
  tractiveAtSpeed, step, ROUTE, segmentAt, elevAt, V_MAX_MPH,
};
if (typeof module !== 'undefined' && module.exports) module.exports = EXPORTS;
if (typeof window !== 'undefined') window.LOCO_CORE = EXPORTS;
