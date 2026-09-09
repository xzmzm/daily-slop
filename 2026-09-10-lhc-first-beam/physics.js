/**
 * LHC First Beam Physics Engine
 * Closed-form relativistic kinematics, superconducting magnet electrodynamics,
 * RF bucket longitudinal dynamics, and sector threading optics.
 */

// Universal Physical Constants
export const C_LIGHT = 299792458; // Speed of light in vacuum (m/s)
export const M_PROTON_GEV = 0.938272088; // Proton rest mass (GeV/c^2)
export const E_CHARGE = 1.602176634e-19; // Elementary charge (Coulombs)

// LHC Machine Parameters
export const RING_CIRCUMFERENCE = 26658.883; // Circumference (m)
export const NUM_MAIN_DIPOLES = 1232; // Number of twin-aperture bending dipoles
export const DIPOLE_LENGTH = 14.3; // Effective magnetic length per dipole (m)
export const BEND_LENGTH = NUM_MAIN_DIPOLES * DIPOLE_LENGTH; // 17617.6 m
export const BEND_RADIUS = BEND_LENGTH / (2 * Math.PI); // rho = 2803.956 m
export const RF_FREQUENCY = 400.789e6; // Fundamental RF cavity frequency (Hz)
export const HARMONIC_NUMBER = 35640; // RF harmonic number = 2^3 * 3^4 * 5 * 11
export const ALPHA_C = 3.22e-4; // Momentum compaction factor
export const GAMMA_TRANSITION = Math.sqrt(1.0 / ALPHA_C); // gamma_tr approx 55.73

// Nominal Beam Parameters
export const NOMINAL_BUNCHES = 2808;
export const PROTONS_PER_BUNCH = 1.15e11;
export const CROSSING_ANGLE_RAD = 285e-6; // 285 microradians
export const BUNCH_LENGTH_SIGMA_Z = 0.0755; // 7.55 cm (m)
export const SIGMA_STAR_NOMINAL = 16.6e-6; // 16.6 microns at IP1/IP5 (m)

// 1. Relativistic Kinematics
export function lorentzGamma(energyGeV) {
  return energyGeV / M_PROTON_GEV;
}

export function relativisticBeta(energyGeV) {
  const gamma = lorentzGamma(energyGeV);
  if (gamma <= 1.0) return 0.0;
  return Math.sqrt(1.0 - 1.0 / (gamma * gamma));
}

export function beamSpeed(energyGeV) {
  return relativisticBeta(energyGeV) * C_LIGHT;
}

export function speedDeficit(energyGeV) {
  // Speed difference c - v (m/s)
  const gamma = lorentzGamma(energyGeV);
  // High-gamma approximation c*(1 - beta) ~ c / (2 * gamma^2)
  if (gamma > 100) {
    return C_LIGHT / (2 * gamma * gamma);
  }
  return C_LIGHT * (1.0 - relativisticBeta(energyGeV));
}

export function beamMomentum(energyGeV) {
  if (energyGeV <= M_PROTON_GEV) return 0.0;
  return Math.sqrt(energyGeV * energyGeV - M_PROTON_GEV * M_PROTON_GEV);
}

export function revolutionPeriod(energyGeV) {
  const beta = relativisticBeta(energyGeV);
  return RING_CIRCUMFERENCE / (beta * C_LIGHT);
}

export function revolutionFrequency(energyGeV) {
  return 1.0 / revolutionPeriod(energyGeV);
}

// 2. Magnetic Bending & Superconductivity
export function dipoleBField(energyGeV) {
  // B [T] = p [GeV/c] / (0.299792458 * rho [m])
  const p = beamMomentum(energyGeV);
  const qFactor = 0.299792458;
  return p / (qFactor * BEND_RADIUS);
}

export function dipoleCurrent(bTesla) {
  // Calibration: 11850 Amps at nominal design 8.3274 Tesla
  const nominalField = 8.3274;
  return (bTesla / nominalField) * 11850.0;
}

export function criticalFieldNbTi(tempK) {
  // Upper critical magnetic field for Nb-Ti alloy as function of temperature
  // Tc0 = 9.2 K, Bc2(0) = 14.5 T
  const Tc0 = 9.2;
  const Bc20 = 14.5;
  if (tempK >= Tc0) return 0.0;
  const ratio = tempK / Tc0;
  return Bc20 * (1.0 - ratio * ratio);
}

export function synchrotronEnergyLossPerTurnKeV(energyGeV) {
  // Classical proton radius rp = 1.5347e-18 m
  // U0 = (4*pi/3) * (rp / rho) * E * gamma^3
  const rp = 1.5347e-18;
  const gamma = lorentzGamma(energyGeV);
  const u0Joules = ((4 * Math.PI) / 3) * (rp / BEND_RADIUS) * (energyGeV * 1e9 * E_CHARGE) * Math.pow(gamma, 3);
  return (u0Joules / E_CHARGE) / 1000.0; // In keV
}

export function totalSynchrotronPowerWatts(energyGeV, bunches = NOMINAL_BUNCHES, ppb = PROTONS_PER_BUNCH) {
  const lossKeV = synchrotronEnergyLossPerTurnKeV(energyGeV);
  const frev = revolutionFrequency(energyGeV);
  const totalProtons = bunches * ppb;
  const lossPerTurnJ = lossKeV * 1000.0 * E_CHARGE;
  return totalProtons * frev * lossPerTurnJ;
}

// 3. Longitudinal Phase Space & RF Bucket
export function phaseSlipFactor(energyGeV) {
  const gamma = lorentzGamma(energyGeV);
  return ALPHA_C - 1.0 / (gamma * gamma);
}

export function rfBucketHalfHeightRelative(energyGeV, vRfMV) {
  // Relative momentum acceptance delta_max = (delta_p / p)
  // For stationary bucket (phi_s = 0 or pi) above transition:
  // delta_max = beta * sqrt( 2 * e * V_rf / (pi * beta^2 * E * h * eta) )
  const beta = relativisticBeta(energyGeV);
  const eta = phaseSlipFactor(energyGeV);
  if (eta <= 0 || beta <= 0) return 0.0;
  const eVrf_over_E = (vRfMV * 1e6) / (energyGeV * 1e9);
  return Math.sqrt((2.0 * eVrf_over_E) / (Math.PI * beta * beta * HARMONIC_NUMBER * eta));
}

export function rfBucketHalfHeightEnergyMeV(energyGeV, vRfMV) {
  const relDelta = rfBucketHalfHeightRelative(energyGeV, vRfMV);
  return relDelta * energyGeV * 1000.0; // In MeV
}

export function synchrotronTune(energyGeV, vRfMV, phiS = 0.0) {
  // Qs = sqrt( (h * eta * e * V_rf * cos(phi_s)) / (2 * pi * beta^2 * E) )
  const beta = relativisticBeta(energyGeV);
  const eta = phaseSlipFactor(energyGeV);
  const cosTerm = Math.abs(Math.cos(phiS));
  const eVrf_over_E = (vRfMV * 1e6) / (energyGeV * 1e9);
  return Math.sqrt((HARMONIC_NUMBER * eta * eVrf_over_E * cosTerm) / (2.0 * Math.PI * beta * beta));
}

export function synchrotronFrequencyHz(energyGeV, vRfMV, phiS = 0.0) {
  const Qs = synchrotronTune(energyGeV, vRfMV, phiS);
  const frev = revolutionFrequency(energyGeV);
  return Qs * frev;
}

export function trackLongitudinalTurn(phi, deltaRelative, energyGeV, vRfMV, phiS = 0.0) {
  // Symplectic tracking in (phi, delta = dE/E)
  const beta = relativisticBeta(energyGeV);
  const eta = phaseSlipFactor(energyGeV);
  const eVrf_over_E = (vRfMV * 1e6) / (energyGeV * 1e9);

  // Phase advance
  const dPhi = (2.0 * Math.PI * HARMONIC_NUMBER * eta * deltaRelative) / (beta * beta);
  let newPhi = phi + dPhi;

  // Wrap phase to [-pi, pi]
  while (newPhi > Math.PI) newPhi -= 2 * Math.PI;
  while (newPhi < -Math.PI) newPhi += 2 * Math.PI;

  // Energy kick
  const deltaKick = (eVrf_over_E / (beta * beta)) * (Math.sin(newPhi) - Math.sin(phiS));
  const newDelta = deltaRelative - deltaKick;

  return { phi: newPhi, delta: newDelta };
}

// 4. Luminosity & Beam Energy
export function geometricLuminosityReduction(thetaCRad = CROSSING_ANGLE_RAD, sigmaZ = BUNCH_LENGTH_SIGMA_Z, sigmaStar = SIGMA_STAR_NOMINAL) {
  // Piwinski reduction factor F = 1 / sqrt(1 + ((theta_c * sigma_z) / (2 * sigma_star))^2)
  const ratio = (thetaCRad * sigmaZ) / (2.0 * sigmaStar);
  return 1.0 / Math.sqrt(1.0 + ratio * ratio);
}

export function peakLuminosity(
  energyGeV,
  bunches = NOMINAL_BUNCHES,
  ppb = PROTONS_PER_BUNCH,
  sigmaStar = SIGMA_STAR_NOMINAL,
  thetaCRad = CROSSING_ANGLE_RAD,
  sigmaZ = BUNCH_LENGTH_SIGMA_Z
) {
  // L = (bunches * N^2 * f_rev) / (4 * pi * sigma*^2) * F
  const frev = revolutionFrequency(energyGeV);
  const F = geometricLuminosityReduction(thetaCRad, sigmaZ, sigmaStar);
  const numerator = bunches * (ppb * ppb) * frev;
  const denominator = 4.0 * Math.PI * (sigmaStar * sigmaStar);
  const lumM2 = (numerator / denominator) * F;
  return lumM2 * 1e-4; // Convert to cm^-2 s^-1
}

export function storedBeamEnergyJoules(energyGeV, bunches = NOMINAL_BUNCHES, ppb = PROTONS_PER_BUNCH) {
  const totalProtons = bunches * ppb;
  const energyPerProtonJoules = energyGeV * 1e9 * E_CHARGE;
  return totalProtons * energyPerProtonJoules;
}

export function storedBeamEnergyMegaJoules(energyGeV, bunches = NOMINAL_BUNCHES, ppb = PROTONS_PER_BUNCH) {
  return storedBeamEnergyJoules(energyGeV, bunches, ppb) / 1e6;
}

// 5. 8-Sector Ring Geography & Threading Model
export const SECTORS = [
  { id: 'S23', name: 'Sector 2-3', startPt: 2, endPt: 3, role: 'Momentum Collimation', screenName: 'BTV.3R2' },
  { id: 'S34', name: 'Sector 3-4', startPt: 3, endPt: 4, role: 'RF Cavities (400 MHz)', screenName: 'BTV.4L4' },
  { id: 'S45', name: 'Sector 4-5', startPt: 4, endPt: 5, role: 'CMS Experiment', screenName: 'BTV.5L5' },
  { id: 'S56', name: 'Sector 5-6', startPt: 5, endPt: 6, role: 'Beam Dump System', screenName: 'BTV.6R5' },
  { id: 'S67', name: 'Sector 6-7', startPt: 6, endPt: 7, role: 'Betatron Collimation', screenName: 'BTV.7L7' },
  { id: 'S78', name: 'Sector 7-8', startPt: 7, endPt: 8, role: 'LHCb Experiment & Beam 2 Inj', screenName: 'BTV.8R7' },
  { id: 'S81', name: 'Sector 8-1', startPt: 8, endPt: 1, role: 'ATLAS Experiment', screenName: 'BTV.1L1' },
  { id: 'S12', name: 'Sector 1-2', startPt: 1, endPt: 2, role: 'ALICE & Beam 1 Inj (TI2)', screenName: 'BTV.2L2' },
];

export class ThreadingEngine {
  constructor() {
    this.reset();
  }

  reset() {
    this.beam = 1; // 1 = Clockwise (Beam 1), 2 = Counter-Clockwise (Beam 2)
    this.energyGeV = 450.0; // Injection energy
    this.currentSectorIndex = 0; // 0..7
    this.screenInserted = true;
    this.correctorKickMrad = 0.0;
    this.beamCirculating = false;
    this.turnsAchieved = 0;
    this.sectorHistory = [];
    this.rfCaptured = false;
  }

  setBeam(b) {
    this.beam = b === 2 ? 2 : 1;
    this.reset();
    this.beam = b;
  }

  getCurrentSector() {
    return SECTORS[this.currentSectorIndex];
  }

  getScreenSpot() {
    // Spot position on the fluorescent screen (mm)
    // Depends on intrinsic injection error + corrector kick
    // Perfect alignment at kick = targetKick
    const rawOffsetX = Math.sin(this.currentSectorIndex * 1.7) * 2.5;
    const rawOffsetY = Math.cos(this.currentSectorIndex * 2.1) * 0.5;
    const correctedX = rawOffsetX + this.correctorKickMrad * 4.0;
    const correctedY = rawOffsetY;
    const intensity = this.screenInserted ? 1.0 : 0.0;
    return {
      x: correctedX,
      y: correctedY,
      sigmaX: 0.85,
      sigmaY: 0.72,
      intensity,
      inTolerance: Math.abs(correctedX) < 1.0 && Math.abs(correctedY) < 1.0,
    };
  }

  applyCorrector(kickMrad) {
    this.correctorKickMrad = kickMrad;
    return this.getScreenSpot();
  }

  autoAlign() {
    // Automatically find optimal kick to center the beam
    const rawOffsetX = Math.sin(this.currentSectorIndex * 1.7) * 2.5;
    this.correctorKickMrad = -rawOffsetX / 4.0;
    return this.getScreenSpot();
  }

  extractScreenAndAdvance() {
    if (!this.screenInserted) return false;
    const spot = this.getScreenSpot();
    if (!spot.inTolerance) {
      return { success: false, reason: 'Beam offset exceeds aperture tolerance (+/- 1.0 mm). Adjust corrector!' };
    }

    this.sectorHistory.push({
      sector: SECTORS[this.currentSectorIndex].id,
      name: SECTORS[this.currentSectorIndex].name,
      offsetMm: spot.x.toFixed(2),
    });

    if (this.currentSectorIndex === SECTORS.length - 1) {
      // Completed all 8 sectors! Circulation achieved!
      this.screenInserted = false;
      this.beamCirculating = true;
      this.turnsAchieved = 1;
      this.rfCaptured = true;
      return {
        success: true,
        circulating: true,
        message: 'FIRST TURN COMPLETE! Beam closed across all 27 km! Twin dots appear on monitor!',
      };
    }

    this.currentSectorIndex += 1;
    this.screenInserted = true;
    this.correctorKickMrad = 0.0;
    return {
      success: true,
      circulating: false,
      nextSector: SECTORS[this.currentSectorIndex].name,
    };
  }

  stepTurns(count = 1) {
    if (this.beamCirculating) {
      this.turnsAchieved += count;
    }
    return this.turnsAchieved;
  }
}
