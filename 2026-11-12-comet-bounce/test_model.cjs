/**
 * Unit tests for model.js (physics, gravity, collision, scenarios)
 */

const assert = require('assert');
const CometModel = require('./model.js');

console.log('--- Testing model.js ---');

// 1. Check constants and polygon
assert.strictEqual(typeof CometModel.G, 'number');
assert.strictEqual(typeof CometModel.OMEGA, 'number');
assert(CometModel.COMET_POLYGON.length >= 60, 'Polygon should have at least 60 vertices');

const xs = CometModel.COMET_POLYGON.map(p => p.x);
const ys = CometModel.COMET_POLYGON.map(p => p.y);
const minX = Math.min(...xs), maxX = Math.max(...xs);
const minY = Math.min(...ys), maxY = Math.max(...ys);

console.log(`Comet bounding box: X=[${minX}, ${maxX}]m, Y=[${minY}, ${maxY}]m`);
assert(minX < -1500 && maxX > 1300, 'Comet major axis should span ~3 km');
assert(minY < -800 && maxY > 800, 'Comet height should span ~1.8 km');

// 2. Test gravity calculation
const gAgilkia = CometModel.getGravity(780, 800);
console.log(`Gravity at Agilkia: ${Math.round(gAgilkia.mag * 1e6)} um/s^2`);
assert(gAgilkia.mag > 100e-6 && gAgilkia.mag < 600e-6, 'Surface gravity should be ~100-600 um/s^2');

const gCent = CometModel.getCentrifugal(1000, 500);
console.log(`Centrifugal accel at 1.1km: ${Math.round(gCent.mag * 1e6)} um/s^2`);
assert(gCent.mag > 0, 'Centrifugal acceleration should be positive');

const gCor = CometModel.getCoriolis(-0.3, 0.4);
assert(gCor.mag > 0, 'Coriolis acceleration should be non-zero for moving body');

// 3. Test escape speed
const vEsc = CometModel.getEscapeSpeed(780, 800);
console.log(`Escape speed at Agilkia: ${vEsc.toFixed(2)} m/s`);
assert(vEsc >= 0.4 && vEsc <= 1.2, 'Escape speed on 67P should be ~0.4 to 1.2 m/s');

// 4. Test terrain collision detection
const pOutside = { x: 780, y: 1200 };
const pInside = { x: 780, y: 700 };
const hit = CometModel.checkTerrainCollision(pOutside, pInside);
assert(hit !== null, 'Collision should be detected crossing terrain boundary');
console.log(`Terrain hit at x=${hit.x.toFixed(1)}, y=${hit.y.toFixed(1)}, normal=(${hit.nx.toFixed(2)}, ${hit.ny.toFixed(2)})`);
assert(hit.ny > 0, 'Normal vector on top terrain should point generally upward');

// 5. Test Nominal Scenario: should latch on first touchdown
const simNominal = new CometModel.Simulation(CometModel.Simulation.getPresets().nominal.config);
simNominal.simulateComplete(3600);
console.log(`Nominal scenario status: ${simNominal.status}, touchdowns: ${simNominal.touchdowns.length}`);
assert.strictEqual(simNominal.status, 'anchored', 'Nominal scenario must end with anchored status');
assert.strictEqual(simNominal.touchdowns.length, 1, 'Nominal scenario should anchor on exactly 1 touchdown');

// 6. Test Escape Scenario: should escape into space
const simEscape = new CometModel.Simulation(CometModel.Simulation.getPresets().escape.config);
simEscape.simulateComplete(7200);
console.log(`Escape scenario status: ${simEscape.status}, touchdowns: ${simEscape.touchdowns.length}`);
assert.strictEqual(simEscape.status, 'escaped', 'High speed scenario should escape');

// 7. Test Historical Scenario: should bounce and settle
const simHistorical = new CometModel.Simulation(CometModel.Simulation.getPresets().historical.config);
simHistorical.simulateComplete(7200);
console.log(`Historical scenario status: ${simHistorical.status}, touchdowns: ${simHistorical.touchdowns.length}, landed at x=${simHistorical.x.toFixed(1)}, y=${simHistorical.y.toFixed(1)}`);
assert(simHistorical.touchdowns.length >= 2, 'Historical scenario must have at least 2 touchdowns (the Great Bounce)');
assert(simHistorical.status === 'settled' || simHistorical.status === 'bounced', 'Historical scenario should settle or bounce');

// 8. Test Solar shadow calculation
const sunDirect = { x: 0, y: 1 }; // Sun directly overhead
const shadowTop = CometModel.isPointInShadow(780, 850, sunDirect);
assert.strictEqual(shadowTop, false, 'Plateau under overhead sun should not be in shadow');

// Signed segment distance: an edge midpoint is zero even far from vertices.
const altitudeSim = new CometModel.Simulation();
altitudeSim.polygon = [{x: 0, y: 0}, {x: 100, y: 0}, {x: 100, y: 100}, {x: 0, y: 100}];
assert(Math.abs(altitudeSim.getAltitude(50, 0)) < 1e-12);
assert.strictEqual(altitudeSim.getAltitude(50, -3), 3);
assert.strictEqual(altitudeSim.getAltitude(50, 4), -4);
assert.strictEqual(altitudeSim.getAltitude(103, 104), 5);

// Escape estimate matches the softened potential used by gravity.
const expectedEscape = Math.sqrt(2 * CometModel.G * Object.values(CometModel.LOBES).reduce(
  (sum, lobe) => sum + lobe.mass / Math.hypot(780 - lobe.x, 800 - lobe.y, lobe.softening), 0));
assert(Math.abs(vEsc - expectedEscape) < 1e-12);
assert(CometModel.getEscapeSpeed(10000, 10000) < vEsc);
assert.strictEqual(simHistorical.touchdowns.length, 3, 'Toy forcibly settles by third contact');

// Reserve is rechargeable and uses the disclosed toy power balance.
const reserve = new CometModel.Simulation();
reserve.status = 'settled';
reserve.x = 780; reserve.y = 850; reserve.batteryWh = 50;
reserve.step(60);
assert.strictEqual(reserve.solarPowerW, 32);
assert(Math.abs(reserve.batteryWh - (50 + 14 / 60)) < 1e-10);
reserve.x = 0; reserve.y = 0;
const beforeShadow = reserve.batteryWh;
reserve.step(60);
assert.strictEqual(reserve.solarPowerW, 1.5);
assert(Math.abs(reserve.batteryWh - (beforeShadow - 16.5 / 60)) < 1e-10);

console.log('✓ All model tests passed successfully!');
