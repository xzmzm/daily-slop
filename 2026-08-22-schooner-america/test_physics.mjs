import assert from "node:assert";
import { SailPhysics, HULL_PRESETS, SailingSimulation, KNOTS_TO_MS, MS_TO_KNOTS } from "./physics.js";

console.log("=== Testing 1851 Schooner America Physics Engine ===");

// Test 1: Apparent Wind Vector Kinematics
{
  // Boat heading North (0 rad), speed 6 knots (~3.08 m/s)
  // True wind from East (90 deg = PI/2 rad), speed 10 knots (~5.14 m/s)
  const tws = 10 * KNOTS_TO_MS;
  const twd = Math.PI * 0.5;
  const bspeed = 6 * KNOTS_TO_MS;
  const hdg = 0.0;

  const aw = SailPhysics.calculateApparentWind(tws, twd, bspeed, hdg);
  console.log(`Test 1: Apparent Wind on Beam Reach: AWS = ${aw.aws_knots.toFixed(2)} kts, AWA = ${aw.awa_deg.toFixed(1)} deg`);

  // On a beam reach with forward boat motion, apparent wind comes from forward of the beam (AWA < 90 deg)
  // AWS = sqrt(10^2 + 6^2) = sqrt(136) ~ 11.66 knots
  assert(Math.abs(aw.aws_knots - 11.66) < 0.2, "AWS calculation mismatch");
  assert(aw.awa_deg > 50 && aw.awa_deg < 65, "AWA angle mismatch");
  console.log("  ✓ Test 1 Passed: Apparent wind vector triangle verified.");
}

// Test 2: Equilibrium Speed and VMG Solver
{
  const america = HULL_PRESETS.america;
  const aurora = HULL_PRESETS.aurora;
  const tws = 14.0 * KNOTS_TO_MS;

  // Upwind close-hauled at 42 deg TWA
  const eqAmerica = SailPhysics.solveEquilibrium(america, tws, 42 * Math.PI / 180);
  const eqAurora = SailPhysics.solveEquilibrium(aurora, tws, 42 * Math.PI / 180);

  console.log(`Test 2: Upwind 42° TWA: America Speed = ${eqAmerica.speed_knots.toFixed(2)} kts (VMG ${eqAmerica.vmg_knots.toFixed(2)} kts)`);
  console.log(`                       Aurora Speed  = ${eqAurora.speed_knots.toFixed(2)} kts (VMG ${eqAurora.vmg_knots.toFixed(2)} kts, Irons: ${eqAurora.inIrons})`);

  // America should easily outsail Aurora upwind due to flat cotton sails & wave line bow
  assert(eqAmerica.speed_knots > eqAurora.speed_knots, "America should be faster than Aurora upwind");
  assert(eqAmerica.vmg_knots > 5.0, "America upwind VMG should be strong");
  console.log("  ✓ Test 2 Passed: America vs Aurora upwind advantage verified.");
}

// Test 3: Polar Envelope Generation
{
  const america = HULL_PRESETS.america;
  const polar = SailPhysics.generatePolarDiagram(america, 14.0);

  assert(polar.points.length > 50, "Polar diagram points generated");
  assert(polar.optimalUpwind.vmg > 0, "Optimal upwind VMG exists");
  console.log(`Test 3: Optimal Upwind for America: TWA = ${polar.optimalUpwind.twa_deg}°, Speed = ${polar.optimalUpwind.bspeed.toFixed(2)} kts, VMG = ${polar.optimalUpwind.vmg.toFixed(2)} kts`);
  console.log("  ✓ Test 3 Passed: Polar diagram envelope verified.");
}

// Test 4: Dynamic Sailing Simulator Step
{
  const sim = new SailingSimulation("america");
  sim.tws_knots = 15.0;
  sim.twd_deg = 0.0;     // Wind from North
  sim.heading_rad = Math.PI * 0.5; // Heading East (Beam Reach 90 deg TWA)

  for (let i = 0; i < 300; i++) {
    sim.update(0.1);
  }

  console.log(`Test 4: Beam Reach Simulation after 30s: Speed = ${sim.telemetry.speed_knots.toFixed(2)} kts, Heel = ${sim.telemetry.heel_deg.toFixed(1)}°`);
  assert(sim.telemetry.speed_knots > 8.0, "Simulation should accelerate boat past 8 knots on beam reach");
  console.log("  ✓ Test 4 Passed: 6-DOF dynamic simulator integration verified.");
}

console.log("=== All Physics Engine Tests Passed Successfully! ===");
