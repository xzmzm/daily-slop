/**
 * Unit Tests for DaguerreEngine
 */
const assert = require("assert");
const DaguerreEngine = require("./engine.js");

console.log("Running DaguerreEngine tests...\n");

let passed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// 1. Sensitization & Thin-Film Interference
test("Bare silver (0-5nm) has minimal sensitivity", () => {
  const res = DaguerreEngine.calculateSensitization(0);
  assert.strictEqual(res.thicknessNm, 0);
  assert.strictEqual(res.label, "Bare Silver Mirror");
  assert(res.sensitivity <= 0.05);
});

test("Straw yellow (20nm) has low-medium sensitivity", () => {
  const res = DaguerreEngine.calculateSensitization(20);
  assert(res.thicknessNm === 20);
  assert(res.label.includes("Straw Yellow"));
  assert(res.sensitivity >= 0.25 && res.sensitivity <= 0.45);
});

test("Steel Lavender / Blue (72nm) reaches peak optimal sensitivity", () => {
  const res = DaguerreEngine.calculateSensitization(72);
  assert(res.label.includes("Optimal"));
  assert(res.sensitivity >= 0.95 && res.sensitivity <= 1.0);
});

test("Over-sensitization (>100nm) drops sensitivity and turns olive green", () => {
  const res = DaguerreEngine.calculateSensitization(110);
  assert(res.label.includes("Olive Green"));
  assert(res.sensitivity < 0.6);
});

// 2. Optical Energy & Exposure Evaluation
test("Calculate exposure energy scales inversely with f-number squared", () => {
  const e1 = DaguerreEngine.calculateExposureEnergy(50000, 16, 100, 1.0);
  const e2 = DaguerreEngine.calculateExposureEnergy(50000, 8, 100, 1.0);
  // f/8 lets in (16/8)^2 = 4x as much light as f/16
  assert(Math.abs(e2 / e1 - 4.0) < 0.001);
});

test("Exposure evaluation returns proper categories", () => {
  const under = DaguerreEngine.evaluateExposure(20);
  assert(under.status.includes("Underexposed"));
  assert(!under.solarized);

  const opt = DaguerreEngine.evaluateExposure(450);
  assert(opt.status.includes("Optimal"));
  assert(!opt.solarized);

  const solar = DaguerreEngine.evaluateExposure(2500);
  assert(solar.status.includes("Solarized"));
  assert(solar.solarized);
});

// 3. Movement Integration (Boulevard du Temple effect)
test("Fast moving carriage (5s in 240s exposure) is invisible", () => {
  const vis = DaguerreEngine.calculateMovementIntegration(5, 240);
  assert.strictEqual(vis, 0.0);
});

test("Stationary shoe-shiner (240s in 240s exposure) is fully visible", () => {
  const vis = DaguerreEngine.calculateMovementIntegration(240, 240);
  assert.strictEqual(vis, 1.0);
});

test("Partially stationary pedestrian (70s in 240s) leaves a ghostly translucent trace", () => {
  const vis = DaguerreEngine.calculateMovementIntegration(70, 240);
  assert(vis > 0.1 && vis < 0.5);
});

// 4. Mercury Development Kinetics
test("Mercury fuming at 65°C for 60s achieves optimal contrast without fogging", () => {
  const res = DaguerreEngine.calculateDevelopment(65, 60, 0.8);
  assert(res.isOptimal);
  assert(!res.isUnderDeveloped);
  assert(!res.isOverFogged);
  assert(res.contrast > 0.6);
});

test("Under-fuming (10s at 65°C) leaves plate underdeveloped", () => {
  const res = DaguerreEngine.calculateDevelopment(65, 10, 0.8);
  assert(res.isUnderDeveloped);
  assert(res.amalgamDensity < 0.4);
});

test("Overheating mercury to 85°C produces chalky fog", () => {
  const res = DaguerreEngine.calculateDevelopment(85, 90, 0.8);
  assert(res.isOverFogged);
  assert(res.backgroundFog > 0.1);
});

// 5. Positive / Negative Reflection Inversion
test("Zero tilt (reflecting dark velvet) renders shadows dark and highlights bright (Positive)", () => {
  const shadow = DaguerreEngine.calculateReflection(0.0, 0); // Shadow: bare mirror
  const highlight = DaguerreEngine.calculateReflection(1.0, 0); // Highlight: mercury amalgam
  assert(!shadow.isNegativeMode);
  assert(!highlight.isNegativeMode);
  assert(shadow.apparentBrightness < 0.1);
  assert(highlight.apparentBrightness > 0.35);
  assert(highlight.apparentBrightness > shadow.apparentBrightness * 4); // Clear positive contrast!
});

test("High tilt (reflecting light source glare) reverses contrast (Negative Inversion)", () => {
  const shadow = DaguerreEngine.calculateReflection(0.0, 35); // Mirror reflects glare
  const highlight = DaguerreEngine.calculateReflection(1.0, 35); // Amalgam scatters ambient
  assert(shadow.isNegativeMode);
  assert(shadow.apparentBrightness > highlight.apparentBrightness); // Mirror is now brighter than matte highlight!
});

test("Gold toning enhances contrast and protects shadows", () => {
  const resUntoned = DaguerreEngine.calculateReflection(0.0, 0, 300, false);
  const resToned = DaguerreEngine.calculateReflection(0.0, 0, 300, true);
  assert(resToned.specularComp <= resUntoned.specularComp); // Deeper black mirror reflection
});

// 6. Scenes verification
test("All 3 historical scenes are well-defined", () => {
  const keys = Object.keys(DaguerreEngine.SCENES);
  assert.strictEqual(keys.length, 3);
  assert(keys.includes("boulevard"));
  assert(keys.includes("portrait"));
  assert(keys.includes("notredame"));
  
  const b = DaguerreEngine.SCENES.boulevard;
  assert(b.elements.some(e => e.isHistoricalHero));
});

console.log(`\nAll ${passed} test suites passed successfully!`);
