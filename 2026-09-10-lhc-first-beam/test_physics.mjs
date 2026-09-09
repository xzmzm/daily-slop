/**
 * Test Suite for LHC First Beam Physics Engine
 * 23 exact-formula assertions verifying relativistic kinematics,
 * superconducting bending fields, RF phase space bucket, luminosity, and threading.
 */

import assert from 'node:assert/strict';
import {
  C_LIGHT,
  M_PROTON_GEV,
  RING_CIRCUMFERENCE,
  BEND_RADIUS,
  lorentzGamma,
  relativisticBeta,
  beamSpeed,
  speedDeficit,
  beamMomentum,
  revolutionPeriod,
  revolutionFrequency,
  dipoleBField,
  dipoleCurrent,
  criticalFieldNbTi,
  synchrotronEnergyLossPerTurnKeV,
  phaseSlipFactor,
  rfBucketHalfHeightRelative,
  rfBucketHalfHeightEnergyMeV,
  synchrotronTune,
  synchrotronFrequencyHz,
  trackLongitudinalTurn,
  geometricLuminosityReduction,
  peakLuminosity,
  storedBeamEnergyMegaJoules,
  ThreadingEngine,
  SECTORS,
} from './physics.js';

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    process.exit(1);
  }
}

console.log('Running LHC First Beam physics assertions...\n');

// 1. Constants check
test('Invariant: Speed of light and ring circumference match CERN parameters', () => {
  assert.equal(C_LIGHT, 299792458);
  assert.equal(RING_CIRCUMFERENCE, 26658.883);
  assert.ok(Math.abs(BEND_RADIUS - 2803.928) < 0.01);
});

// 2. Lorentz Gamma at Injection (450 GeV)
test('Lorentz gamma at 450 GeV injection equals ~479.61', () => {
  const gamma = lorentzGamma(450.0);
  assert.ok(Math.abs(gamma - 479.61) < 0.05, `Expected ~479.61, got ${gamma}`);
});

// 3. Lorentz Gamma at Collision (7000 GeV)
test('Lorentz gamma at 7000 GeV equals ~7460.52', () => {
  const gamma = lorentzGamma(7000.0);
  assert.ok(Math.abs(gamma - 7460.52) < 0.1, `Expected ~7460.52, got ${gamma}`);
});

// 4. Relativistic Beta at Injection
test('Relativistic beta at 450 GeV is > 0.999997', () => {
  const beta = relativisticBeta(450.0);
  assert.ok(beta > 0.999997 && beta < 0.999998, `Beta: ${beta}`);
});

// 5. Relativistic Beta at 7000 GeV
test('Relativistic beta at 7000 GeV is > 0.999999990', () => {
  const beta = relativisticBeta(7000.0);
  assert.ok(beta > 0.999999990 && beta < 1.0, `Beta: ${beta}`);
});

// 6. Speed deficit from light speed
test('Speed deficit (c - v) at 7000 GeV is only ~2.69 m/s', () => {
  const deficit = speedDeficit(7000.0);
  assert.ok(Math.abs(deficit - 2.69) < 0.1, `Expected ~2.69 m/s, got ${deficit}`);
});

// 7. Relativistic Momentum
test('Beam momentum at 450 GeV is 449.999 GeV/c', () => {
  const p = beamMomentum(450.0);
  assert.ok(Math.abs(p - 449.999) < 0.01, `Expected ~449.999, got ${p}`);
});

// 8. Revolution Period
test('Revolution period around 26.659 km is ~88.925 microseconds', () => {
  const T = revolutionPeriod(450.0);
  const microsec = T * 1e6;
  assert.ok(Math.abs(microsec - 88.925) < 0.01, `Expected ~88.925 us, got ${microsec}`);
});

// 9. Revolution Frequency
test('Revolution frequency is ~11245.5 Hz (turns per second)', () => {
  const f = revolutionFrequency(7000.0);
  assert.ok(Math.abs(f - 11245.5) < 0.5, `Expected ~11245.5 Hz, got ${f}`);
});

// 10. Dipole Magnetic Field at 450 GeV Injection
test('Dipole bending field at 450 GeV is ~0.535 Tesla', () => {
  const B = dipoleBField(450.0);
  assert.ok(Math.abs(B - 0.5353) < 0.005, `Expected ~0.5353 T, got ${B}`);
});

// 11. Dipole Magnetic Field at 7000 GeV Top Energy
test('Dipole bending field at 7000 GeV reaches 8.327 Tesla', () => {
  const B = dipoleBField(7000.0);
  assert.ok(Math.abs(B - 8.3274) < 0.01, `Expected ~8.3274 T, got ${B}`);
});

// 12. Dipole Superconducting Current
test('Dipole current at 7000 GeV reaches nominal 11850 Amperes', () => {
  const B = dipoleBField(7000.0);
  const I = dipoleCurrent(B);
  assert.ok(Math.abs(I - 11850.0) < 5.0, `Expected ~11850 A, got ${I}`);
});

// 13. Superconducting Critical Field at 1.9 K
test('Nb-Ti critical magnetic field at 1.9 K is ~13.88 T (providing operating margin for 8.33 T)', () => {
  const Bc2_19K = criticalFieldNbTi(1.9);
  const Bc2_42K = criticalFieldNbTi(4.2);
  assert.ok(Bc2_19K > 13.5 && Bc2_19K < 14.2, `At 1.9K: ${Bc2_19K} T`);
  assert.ok(Bc2_42K > 11.0 && Bc2_42K < 12.0, `At 4.2K: ${Bc2_42K} T`);
  assert.ok(Bc2_19K > Bc2_42K + 2.0, '1.9 K provides significant critical margin');
});

// 14. Synchrotron Radiation Loss
test('Synchrotron radiation loss per proton per turn at 7 TeV is ~6.7 keV', () => {
  const lossKeV = synchrotronEnergyLossPerTurnKeV(7000.0);
  assert.ok(Math.abs(lossKeV - 6.7) < 0.5, `Expected ~6.7 keV, got ${lossKeV}`);
});

// 15. Slip Factor & Transition Energy
test('LHC is far above transition energy (eta > 0 at both 450 GeV and 7 TeV)', () => {
  const eta450 = phaseSlipFactor(450.0);
  const eta7000 = phaseSlipFactor(7000.0);
  assert.ok(eta450 > 3.1e-4 && eta450 < 3.25e-4, `eta450: ${eta450}`);
  assert.ok(eta7000 > 3.2e-4 && eta7000 < 3.25e-4, `eta7000: ${eta7000}`);
});

// 16. RF Bucket Half-Height at 450 GeV (6 MV RF)
test('RF bucket half-height energy at 450 GeV (6 MV) is ~387 MeV', () => {
  const dE = rfBucketHalfHeightEnergyMeV(450.0, 6.0);
  assert.ok(Math.abs(dE - 387.0) < 10.0, `Expected ~387 MeV, got ${dE}`);
});

// 17. RF Bucket Half-Height at 7000 GeV (16 MV RF)
test('RF bucket half-height energy at 7000 GeV (16 MV) is ~2492 MeV', () => {
  const dE = rfBucketHalfHeightEnergyMeV(7000.0, 16.0);
  assert.ok(Math.abs(dE - 2492.0) < 20.0, `Expected ~2492 MeV, got ${dE}`);
});

// 18. Synchrotron Tune & Frequency
test('Synchrotron tune at 450 GeV is ~0.0049 with frequency ~55 Hz', () => {
  const Qs = synchrotronTune(450.0, 6.0);
  const fs = synchrotronFrequencyHz(450.0, 6.0);
  assert.ok(Math.abs(Qs - 0.0049) < 0.0005, `Expected Qs ~0.0049, got ${Qs}`);
  assert.ok(Math.abs(fs - 55.1) < 2.0, `Expected fs ~55.1 Hz, got ${fs}`);
});

// 19. Longitudinal Symplectic Tracking Stability
test('Symplectic turn-by-turn tracking conserves phase space boundedness for small amplitudes', () => {
  let p = { phi: 0.2, delta: 0.0001 };
  for (let turn = 0; turn < 200; turn++) {
    p = trackLongitudinalTurn(p.phi, p.delta, 450.0, 6.0);
  }
  assert.ok(Math.abs(p.phi) < 0.5, `Phase stayed bounded: ${p.phi}`);
  assert.ok(Math.abs(p.delta) < 0.0003, `Delta stayed bounded: ${p.delta}`);
});

// 20. Geometric Luminosity Reduction Factor
test('Geometric crossing angle reduction factor F is ~0.839', () => {
  const F = geometricLuminosityReduction();
  assert.ok(Math.abs(F - 0.839) < 0.005, `Expected F ~0.839, got ${F}`);
});

// 21. Peak Nominal Collision Luminosity
test('Peak design luminosity reaches 1.01e34 cm^-2 s^-1', () => {
  const L = peakLuminosity(7000.0);
  const ratio = L / 1e34;
  assert.ok(Math.abs(ratio - 1.01) < 0.05, `Expected ~1.01e34, got ${L}`);
});

// 22. Stored Beam Energy at 7 TeV
test('Stored beam energy for 2808 bunches at 7 TeV equals ~362 MegaJoules', () => {
  const energyMJ = storedBeamEnergyMegaJoules(7000.0);
  assert.ok(Math.abs(energyMJ - 362.1) < 2.0, `Expected ~362.1 MJ, got ${energyMJ}`);
});

// 23. Sector Threading Engine State Machine
test('ThreadingEngine correctly walks through all 8 sectors to achieve beam circulation', () => {
  const engine = new ThreadingEngine();
  assert.equal(engine.currentSectorIndex, 0);
  assert.equal(engine.beamCirculating, false);

  // Auto align and advance through all sectors
  for (let s = 0; s < 7; s++) {
    engine.autoAlign();
    const res = engine.extractScreenAndAdvance();
    assert.equal(res.success, true);
    assert.equal(res.circulating, false);
    assert.equal(engine.currentSectorIndex, s + 1);
  }

  // Final sector (Sector 1-2 completing the 27 km loop)
  engine.autoAlign();
  const finalRes = engine.extractScreenAndAdvance();
  assert.equal(finalRes.success, true);
  assert.equal(finalRes.circulating, true);
  assert.equal(engine.beamCirculating, true);
  assert.equal(engine.turnsAchieved, 1);

  // Stepping turns
  engine.stepTurns(100);
  assert.equal(engine.turnsAchieved, 101);
});

console.log(`\nAll ${passed} assertions passed successfully!`);
