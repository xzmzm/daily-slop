/* Independent physics checks. Run: node --test test.cjs */
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('./core.js');

function close(actual, expected, label, epsilon = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= epsilon,
    `${label}: ${actual} != ${expected}`);
}

test('Kepler’s third law reproduces the discovery and the solar system', () => {
  const {massMJ, distAU} = C.PRESETS.discovery;
  close(C.periodDays(distAU, massMJ), 4.2304, '51 Peg b period', 0.005);
  close(C.semiAmplitude(massMJ, distAU), 55.6, '51 Peg b velocity', 0.2);
  const j = C.PRESETS.jupiter;
  close(C.periodDays(j.distAU, j.massMJ), 4203, 'Jupiter period', 2);
  close(C.semiAmplitude(j.massMJ, j.distAU), 12.1, 'Jupiter velocity', 0.15);
  const e = C.PRESETS.earth;
  close(C.periodDays(e.distAU, e.massMJ), 354.4, 'Earth twin period', 0.5);
  close(C.semiAmplitude(e.massMJ, e.distAU), 0.0869, 'Earth twin velocity', 0.002);
});

test('velocity scales with mass, shrinks with distance, and obeys sin i', () => {
  const base = C.semiAmplitude(1, 1);
  close(C.semiAmplitude(2, 1), 2 * base, 'mass doubling', base * 2e-3);
  close(C.semiAmplitude(0.5, 1), base / 2, 'mass halving', base * 2e-3);
  close(C.semiAmplitude(1, 4), base / 2, 'a^3/2 period law halves the signal');
  for (const incl of [0, 15, 30, 45, 60, 75, 90]) {
    close(C.observedAmplitude(base, incl), base * Math.sin(incl * Math.PI / 180),
      `inclination ${incl}°`);
  }
  close(C.observedAmplitude(base, 30), base / 2, '30-degree half signal');
});

test('the star’s wobble circle is half an Earth radius wide for 51 Peg b', () => {
  const {massMJ, distAU} = C.PRESETS.discovery;
  close(C.wobbleRadiusKm(massMJ, distAU), 3233, 'discovery wobble', 3);
  // The same Jupiter shifted to 51 Peg (1.06 solar masses), not the Sun.
  close(C.wobbleRadiusKm(1, 5.2), 699900, 'Jupiter-sized wobble', 1500);
  close(C.wobbleRadiusKm(1, 5.2) / C.wobbleRadiusKm(C.PRESETS.discovery.massMJ, distAU),
    (5.2 / 0.0522) * (1 / 0.46), 'wobble grows with m·a', 0.2);
});

test('radial velocity peaks as the star crosses the mid-plane, not at the extremes', () => {
  const K = 55.6, P = 4.23;
  close(C.radialVelocity(K, 0, P), K, 'start of period');
  close(C.radialVelocity(K, P / 4, P), 0, 'quarter turn');
  close(C.radialVelocity(K, P / 2, P), -K, 'half turn');
  close(C.radialVelocity(K, P, P), K, 'full period');
  // Star offset is the integral of the velocity, projected on the sky.
  close(C.starOffset(0, P).y, 0, 'crossing at v max');
  close(C.starOffset(P / 4, P).y, 1, 'extreme at v zero');
  close(C.starOffset(0, P).x, -1, 'star opposite the planet');
  for (let i = 0; i < 24; i++) {
    const t = i / 24 * P;
    const v = C.radialVelocity(K, t, P), y = C.starOffset(t, P).y;
    close(v / K, Math.cos(2 * Math.PI * t / P), `velocity phase ${i}`);
    close(y, Math.sin(2 * Math.PI * t / P), `offset phase ${i}`);
  }
});

test('log sliders are monotonic, invertible, and cover the labelled ranges', () => {
  close(C.sliderToMass(0), C.MASS_MIN, 'mass slider floor', 1e-15);
  close(C.sliderToMass(C.SLIDER_MAX), C.MASS_MAX, 'mass slider ceiling', 1e-12);
  close(C.sliderToDist(0), C.DIST_MIN, 'distance slider floor', 1e-15);
  close(C.sliderToIncl(0), 0, 'tilt slider floor');
  close(C.sliderToIncl(C.SLIDER_MAX), 90, 'tilt slider ceiling');
  close(C.massToSlider(C.sliderToMass(137)), 137, 'mass round trip');
  close(C.distToSlider(C.sliderToDist(689)), 689, 'distance round trip');
  close(C.inclToSlider(C.sliderToIncl(313)), 313, 'tilt round trip');
  for (let s = 0; s < C.SLIDER_MAX; s += 97) {
    assert.ok(C.sliderToMass(s) < C.sliderToMass(s + 97), 'mass monotone');
    assert.ok(C.sliderToDist(s) < C.sliderToDist(s + 97), 'distance monotone');
    assert.ok(C.sliderToIncl(s) < C.sliderToIncl(s + 97), 'tilt monotone');
  }
  close(C.massToSlider(1), 819, 'one Jupiter sits on the tick', 1);
  close(C.massToSlider(1 / 317.83), 237, 'one Earth at its tick', 1);
  close(C.massToSlider(0.1 / 317.83), 4.8, '0.1 Earth mass just off the floor', 0.2);
});

test('mass lower limits and clamping behave', () => {
  close(C.massSinI(0.46, 90), 0.46, 'edge-on true mass');
  close(C.massSinI(0.46, 30), 0.23, 'thirty degrees');
  close(C.massSinI(0.46, 0), 0, 'face-on hides the planet');
  close(C.periodDays(99, 99), C.periodDays(C.DIST_MAX, C.MASS_MAX), 'clamped inputs');
  close(C.semiAmplitude(-1, -1), C.semiAmplitude(C.MASS_MIN, C.DIST_MIN), 'clamped velocity');
  assert.ok(Number.isFinite(C.wobbleRadiusKm(0.0003, 0.015)));
});
