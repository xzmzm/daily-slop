/**
 * LHC First Beam 2008 - Main Application
 * Drives 4 closed-form benches:
 * 1. 27 km Sector-by-Sector Threading & BTV Phosphor Screen
 * 2. Relativistic Kinematics & Superconducting Dipoles
 * 3. RF Bucket Longitudinal Phase Space (Veksler-McMillan)
 * 4. CERN Control Room (CCC) Page 1 & Milestones
 */

import {
  C_LIGHT,
  M_PROTON_GEV,
  RING_CIRCUMFERENCE,
  BEND_RADIUS,
  lorentzGamma,
  relativisticBeta,
  speedDeficit,
  revolutionPeriod,
  revolutionFrequency,
  dipoleBField,
  dipoleCurrent,
  criticalFieldNbTi,
  rfBucketHalfHeightEnergyMeV,
  synchrotronTune,
  synchrotronFrequencyHz,
  trackLongitudinalTurn,
  phaseSlipFactor,
  peakLuminosity,
  storedBeamEnergyMegaJoules,
  ThreadingEngine,
  SECTORS,
} from './physics.js';

// Application State
const state = {
  activeTab: 'threading',
  threading: new ThreadingEngine(),
  continuousCirculation: false,
  circulationTimer: null,
  energyGeV: 450.0,
  cryoTempK: 1.90,
  vrfMV: 6.0,
  page1Mode: 'INJECTION PROBE BEAM',
  rfParticles: [],
  collisionAnimation: null,
  collisionParticles: [],
};

// DOM Elements cache
const dom = {};

function initDom() {
  dom.tabs = document.querySelectorAll('.nav-btn');
  dom.panes = document.querySelectorAll('.tab-pane');

  // Tab 1 Elements
  dom.svgRing = document.getElementById('svg-ring');
  dom.ringSectorsGroup = document.getElementById('ring-sectors');
  dom.ringPointsGroup = document.getElementById('ring-points');
  dom.ringBeamPath = document.getElementById('ring-beam-path');
  dom.ringBeamHead = document.getElementById('ring-beam-head');
  dom.btnBeam1 = document.getElementById('btn-beam-1');
  dom.btnBeam2 = document.getElementById('btn-beam-2');
  dom.canvasBtv = document.getElementById('canvas-btv');
  dom.badgeSectorStatus = document.getElementById('badge-sector-status');
  dom.lblSectorName = document.getElementById('lbl-sector-name');
  dom.lblScreenName = document.getElementById('lbl-screen-name');
  dom.lblSpotX = document.getElementById('lbl-spot-x');
  dom.lblSpotY = document.getElementById('lbl-spot-y');
  dom.lblAlignStatus = document.getElementById('lbl-align-status');
  dom.sliderCorrector = document.getElementById('slider-corrector');
  dom.valCorrector = document.getElementById('val-corrector');
  dom.btnAutoAlign = document.getElementById('btn-auto-align');
  dom.btnAdvanceSector = document.getElementById('btn-advance-sector');
  dom.btnResetThreading = document.getElementById('btn-reset-threading');
  dom.btnToggleCirculation = document.getElementById('btn-toggle-circulation');
  dom.cardTwinDots = document.getElementById('card-twin-dots');
  dom.lblTurnCount = document.getElementById('lbl-turn-count');

  // Tab 2 Elements
  dom.sliderEnergy = document.getElementById('slider-energy');
  dom.valEnergy = document.getElementById('val-energy');
  dom.badgeEnergy = document.getElementById('badge-energy');
  dom.valGamma = document.getElementById('val-gamma');
  dom.valBeta = document.getElementById('val-beta');
  dom.valDeficit = document.getElementById('val-deficit');
  dom.valTrev = document.getElementById('val-trev');
  dom.valBfield = document.getElementById('val-bfield');
  dom.valCurrent = document.getElementById('val-current');
  dom.energyPills = document.querySelectorAll('.pill-btn[data-energy]');
  dom.sliderTemp = document.getElementById('slider-temp');
  dom.valTemp = document.getElementById('val-temp');
  dom.badgeCryo = document.getElementById('badge-cryo');
  dom.cryoStatusBox = document.getElementById('cryo-status-box');
  dom.cryoStatusText = document.getElementById('cryo-status-text');

  // Tab 3 Elements
  dom.canvasRf = document.getElementById('canvas-rf');
  dom.sliderVrf = document.getElementById('slider-vrf');
  dom.valVrf = document.getElementById('val-vrf');
  dom.vrfPills = document.querySelectorAll('.pill-btn[data-vrf]');
  dom.btnInjectSpray = document.getElementById('btn-inject-spray');
  dom.btnResetBunch = document.getElementById('btn-reset-bunch');
  dom.valEta = document.getElementById('val-eta');
  dom.valBucketHeight = document.getElementById('val-bucket-height');
  dom.valSynchFreq = document.getElementById('val-synch-freq');

  // Tab 4 Elements
  dom.lblFillNum = document.getElementById('lbl-fill-num');
  dom.lblP1Energy = document.getElementById('lbl-p1-energy');
  dom.p1BeamStatus = document.getElementById('p1-beam-status');
  dom.lblB1Intensity = document.getElementById('lbl-b1-intensity');
  dom.lblB1Circ = document.getElementById('lbl-b1-circ');
  dom.lblB2Intensity = document.getElementById('lbl-b2-intensity');
  dom.lblB2Circ = document.getElementById('lbl-b2-circ');
  dom.p1ModeBtns = document.querySelectorAll('.p1-mode-btn');
  dom.lumAtlas = document.getElementById('lum-atlas');
  dom.lumCms = document.getElementById('lum-cms');
  dom.lumAlice = document.getElementById('lum-alice');
  dom.lumLhcb = document.getElementById('lum-lhcb');
  dom.canvasCollision = document.getElementById('canvas-collision');
  dom.btnFireCollision = document.getElementById('btn-fire-collision');
  dom.lblCollisionInfo = document.getElementById('lbl-collision-info');
}

// ----------------------------------------------------
// Tab 1: 27 km Threading & BTV Phosphor Screen
// ----------------------------------------------------
const RING_CENTER = 300;
const RING_RADIUS = 220;

// Sector angular positions around the ring (Point 1 ATLAS at top -PI/2)
const POINT_ANGLES = {
  1: -Math.PI / 2, // Top (ATLAS)
  2: -Math.PI / 4, // Top-Right (ALICE)
  3: 0,            // Right (Momentum cleaning)
  4: Math.PI / 4,  // Bottom-Right (RF)
  5: Math.PI / 2,  // Bottom (CMS)
  6: (3 * Math.PI) / 4, // Bottom-Left (Dump)
  7: Math.PI,      // Left (Betatron cleaning)
  8: (-3 * Math.PI) / 4, // Top-Left (LHCb)
};

function buildRingSvg() {
  dom.ringSectorsGroup.innerHTML = '';
  dom.ringPointsGroup.innerHTML = '';

  // Draw 8 Sectors
  SECTORS.forEach((sec, idx) => {
    const startAng = POINT_ANGLES[sec.startPt];
    const endAng = POINT_ANGLES[sec.endPt];

    // Sector arc path
    const x1 = RING_CENTER + RING_RADIUS * Math.cos(startAng);
    const y1 = RING_CENTER + RING_RADIUS * Math.sin(startAng);
    const x2 = RING_CENTER + RING_RADIUS * Math.cos(endAng);
    const y2 = RING_CENTER + RING_RADIUS * Math.sin(endAng);

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${x1} ${y1} A ${RING_RADIUS} ${RING_RADIUS} 0 0 1 ${x2} ${y2}`);
    path.setAttribute('class', 'ring-sector-arc');
    path.setAttribute('id', `sector-arc-${sec.id}`);
    dom.ringSectorsGroup.appendChild(path);
  });

  // Draw 8 Points
  const pointLabels = {
    1: 'Pt 1: ATLAS',
    2: 'Pt 2: ALICE (Inj)',
    3: 'Pt 3: Coll-P',
    4: 'Pt 4: RF Cav',
    5: 'Pt 5: CMS',
    6: 'Pt 6: Dump',
    7: 'Pt 7: Coll-B',
    8: 'Pt 8: LHCb (Inj)',
  };

  for (let pt = 1; pt <= 8; pt++) {
    const ang = POINT_ANGLES[pt];
    const px = RING_CENTER + RING_RADIUS * Math.cos(ang);
    const py = RING_CENTER + RING_RADIUS * Math.sin(ang);

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', px);
    circle.setAttribute('cy', py);
    circle.setAttribute('r', '8');
    circle.setAttribute('class', 'ring-point-marker');

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    const labelRadius = RING_RADIUS + 34;
    const lx = RING_CENTER + labelRadius * Math.cos(ang);
    const ly = RING_CENTER + labelRadius * Math.sin(ang) + 4;
    text.setAttribute('x', lx);
    text.setAttribute('y', ly);
    text.setAttribute('class', 'ring-point-label');
    text.textContent = pointLabels[pt];

    g.appendChild(circle);
    g.appendChild(text);
    dom.ringPointsGroup.appendChild(g);
  }
}

function updateRingDisplay() {
  const engine = state.threading;
  const currentIdx = engine.currentSectorIndex;

  SECTORS.forEach((sec, idx) => {
    const arc = document.getElementById(`sector-arc-${sec.id}`);
    if (!arc) return;
    arc.classList.remove('cleared', 'active');
    if (idx < currentIdx || engine.beamCirculating) {
      arc.classList.add('cleared');
    } else if (idx === currentIdx) {
      arc.classList.add('active');
    }
  });

  // Update Beam Flight Trail
  const curSec = engine.getCurrentSector();
  const targetPt = engine.beamCirculating ? 2 : curSec.endPt;
  const endAng = POINT_ANGLES[targetPt];
  const hx = RING_CENTER + RING_RADIUS * Math.cos(endAng);
  const hy = RING_CENTER + RING_RADIUS * Math.sin(endAng);
  dom.ringBeamHead.setAttribute('cx', hx);
  dom.ringBeamHead.setAttribute('cy', hy);
}

function renderBtvScreen() {
  const ctx = dom.canvasBtv.getContext('2d');
  const w = dom.canvasBtv.width;
  const h = dom.canvasBtv.height;
  const cx = w / 2;
  const cy = h / 2;

  ctx.clearRect(0, 0, w, h);

  // Background grid
  ctx.strokeStyle = 'rgba(57, 255, 20, 0.12)';
  ctx.lineWidth = 1;
  for (let x = 20; x < w; x += 20) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 20; y < h; y += 20) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Crosshairs & Scale Circles (1 mm = 30 pixels)
  const scale = 30.0;
  ctx.strokeStyle = 'rgba(57, 255, 20, 0.4)';
  ctx.beginPath();
  ctx.arc(cx, cy, scale * 1.0, 0, 2 * Math.PI); // 1 mm tolerance circle
  ctx.stroke();

  ctx.strokeStyle = 'rgba(57, 255, 20, 0.2)';
  ctx.beginPath();
  ctx.arc(cx, cy, scale * 2.0, 0, 2 * Math.PI); // 2 mm circle
  ctx.stroke();

  const spot = state.threading.getScreenSpot();

  if (state.threading.beamCirculating) {
    // Twin Dots Celebration Display! (Two side-by-side green spots from turn 1 and turn 2)
    const dot1X = cx - 24;
    const dot2X = cx + 24;
    [dot1X, dot2X].forEach((dotX) => {
      const grad = ctx.createRadialGradient(dotX, cy, 2, dotX, cy, 38);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.2, '#39ff14');
      grad.addColorStop(0.6, 'rgba(57, 255, 20, 0.4)');
      grad.addColorStop(1, 'rgba(57, 255, 20, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(dotX, cy, 38, 0, 2 * Math.PI);
      ctx.fill();
    });

    ctx.fillStyle = '#39ff14';
    ctx.font = '12px var(--font-mono)';
    ctx.fillText('TURN #1', dot1X - 22, cy + 50);
    ctx.fillText('TURN #2', dot2X - 22, cy + 50);
  } else if (state.threading.screenInserted) {
    // Single Beam Spot on fluorescent phosphor
    const spotPxX = cx + spot.x * scale;
    const spotPxY = cy + spot.y * scale;

    const grad = ctx.createRadialGradient(spotPxX, spotPxY, 2, spotPxX, spotPxY, 32);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.25, '#39ff14');
    grad.addColorStop(0.65, 'rgba(57, 255, 20, 0.35)');
    grad.addColorStop(1, 'rgba(57, 255, 20, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(spotPxX, spotPxY, 32, 0, 2 * Math.PI);
    ctx.fill();
  }

  // Update text readouts
  const curSec = state.threading.getCurrentSector();
  dom.lblSectorName.textContent = `${curSec.name} (${curSec.role})`;
  dom.lblScreenName.textContent = curSec.screenName;
  dom.lblSpotX.textContent = `${spot.x >= 0 ? '+' : ''}${spot.x.toFixed(2)} mm`;
  dom.lblSpotY.textContent = `${spot.y >= 0 ? '+' : ''}${spot.y.toFixed(2)} mm`;

  if (spot.inTolerance) {
    dom.lblAlignStatus.textContent = 'IN TOLERANCE (OK)';
    dom.lblAlignStatus.className = 'val status-tag ok';
    dom.badgeSectorStatus.textContent = `${curSec.id} ALIGNED`;
  } else {
    dom.lblAlignStatus.textContent = 'ALIGNMENT NEEDED';
    dom.lblAlignStatus.className = 'val status-tag warn';
    dom.badgeSectorStatus.textContent = `${curSec.id} PENDING`;
  }
}

function initThreadingEvents() {
  buildRingSvg();
  updateRingDisplay();
  renderBtvScreen();

  dom.sliderCorrector.addEventListener('input', (e) => {
    const kick = parseFloat(e.target.value);
    dom.valCorrector.textContent = `${kick >= 0 ? '+' : ''}${kick.toFixed(2)} mrad`;
    state.threading.applyCorrector(kick);
    renderBtvScreen();
  });

  dom.btnAutoAlign.addEventListener('click', () => {
    state.threading.autoAlign();
    dom.sliderCorrector.value = state.threading.correctorKickMrad;
    dom.valCorrector.textContent = `${state.threading.correctorKickMrad >= 0 ? '+' : ''}${state.threading.correctorKickMrad.toFixed(2)} mrad`;
    renderBtvScreen();
  });

  dom.btnAdvanceSector.addEventListener('click', () => {
    const res = state.threading.extractScreenAndAdvance();
    if (!res.success) {
      alert(res.reason);
      return;
    }

    if (res.circulating) {
      dom.cardTwinDots.classList.remove('hidden');
      dom.btnToggleCirculation.disabled = false;
      dom.btnAdvanceSector.disabled = true;
      dom.badgeSectorStatus.textContent = 'CIRCULATION ACHIEVED';
      dom.lblTurnCount.textContent = state.threading.turnsAchieved;
    } else {
      dom.sliderCorrector.value = 0.0;
      dom.valCorrector.textContent = '0.00 mrad';
    }

    updateRingDisplay();
    renderBtvScreen();
  });

  dom.btnResetThreading.addEventListener('click', () => {
    if (state.circulationTimer) {
      clearInterval(state.circulationTimer);
      state.circulationTimer = null;
      state.continuousCirculation = false;
    }
    state.threading.reset();
    dom.sliderCorrector.value = 0.0;
    dom.valCorrector.textContent = '0.00 mrad';
    dom.cardTwinDots.classList.add('hidden');
    dom.btnToggleCirculation.disabled = true;
    dom.btnToggleCirculation.textContent = '启动连续回旋测试';
    dom.btnAdvanceSector.disabled = false;
    updateRingDisplay();
    renderBtvScreen();
  });

  dom.btnToggleCirculation.addEventListener('click', () => {
    state.continuousCirculation = !state.continuousCirculation;
    if (state.continuousCirculation) {
      dom.btnToggleCirculation.textContent = '暂停回旋 (Pause)';
      state.circulationTimer = setInterval(() => {
        state.threading.stepTurns(100);
        dom.lblTurnCount.textContent = state.threading.turnsAchieved.toLocaleString();
      }, 50);
    } else {
      dom.btnToggleCirculation.textContent = '恢复回旋 (Resume)';
      if (state.circulationTimer) {
        clearInterval(state.circulationTimer);
        state.circulationTimer = null;
      }
    }
  });

  dom.btnBeam1.addEventListener('click', () => {
    dom.btnBeam1.classList.add('active');
    dom.btnBeam2.classList.remove('active');
    state.threading.setBeam(1);
    updateRingDisplay();
    renderBtvScreen();
  });

  dom.btnBeam2.addEventListener('click', () => {
    dom.btnBeam2.classList.add('active');
    dom.btnBeam1.classList.remove('active');
    state.threading.setBeam(2);
    updateRingDisplay();
    renderBtvScreen();
  });
}

// ----------------------------------------------------
// Tab 2: Relativistic Kinematics & Superconducting Dipoles
// ----------------------------------------------------
function updateRelativisticCalculations() {
  const E = state.energyGeV;
  const gamma = lorentzGamma(E);
  const beta = relativisticBeta(E);
  const deficit = speedDeficit(E);
  const Trev = revolutionPeriod(E);
  const B = dipoleBField(E);
  const I = dipoleCurrent(B);

  dom.valEnergy.textContent = `${E.toFixed(0)} GeV`;
  dom.badgeEnergy.textContent = E < 1000 ? `${E.toFixed(0)} GeV 注入` : `${(E / 1000).toFixed(1)} TeV 顶峰`;

  dom.valGamma.textContent = gamma > 1000 ? gamma.toFixed(1) : gamma.toFixed(2);
  dom.valBeta.textContent = beta.toFixed(7);
  dom.valDeficit.textContent = `${deficit < 10 ? deficit.toFixed(2) : deficit.toFixed(1)} m/s`;
  dom.valTrev.textContent = `${(Trev * 1e6).toFixed(2)} μs`;
  dom.valBfield.textContent = `${B.toFixed(3)} T`;
  dom.valCurrent.textContent = `${I.toFixed(1)} A`;

  // Update cryogenics
  const Bc2 = criticalFieldNbTi(state.cryoTempK);
  dom.valTemp.textContent = `${state.cryoTempK.toFixed(2)} K`;
  const isSuperconducting = state.cryoTempK < 9.2 && B < Bc2;

  if (isSuperconducting && Bc2 - B > 1.5) {
    dom.badgeCryo.textContent = `${state.cryoTempK.toFixed(2)} K SUPERFLUID`;
    dom.cryoStatusBox.innerHTML = `<span class="status-dot green"></span><span>超流氦态稳定：临界磁场 ${Bc2.toFixed(2)} T，高于工作磁场 ${B.toFixed(2)} T，裕度充足。</span>`;
  } else if (isSuperconducting) {
    dom.badgeCryo.textContent = `${state.cryoTempK.toFixed(2)} K 临界受限`;
    dom.cryoStatusBox.innerHTML = `<span class="status-dot green"></span><span>临界磁场 ${Bc2.toFixed(2)} T 贴近工作磁场 ${B.toFixed(2)} T，存在微弱失超风险！</span>`;
  } else {
    dom.badgeCryo.textContent = `${state.cryoTempK.toFixed(2)} K 失超 QUENCH!`;
    dom.cryoStatusBox.innerHTML = `<span class="status-dot red"></span><span>超导失超 (QUENCH)！工作磁场 ${B.toFixed(2)} T 超过临界极限 ${Bc2.toFixed(2)} T！</span>`;
  }
}

function initDipoleEvents() {
  updateRelativisticCalculations();

  dom.sliderEnergy.addEventListener('input', (e) => {
    state.energyGeV = parseFloat(e.target.value);
    dom.energyPills.forEach((p) => p.classList.remove('active'));
    updateRelativisticCalculations();
  });

  dom.energyPills.forEach((btn) => {
    btn.addEventListener('click', () => {
      dom.energyPills.forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      state.energyGeV = parseFloat(btn.dataset.energy);
      dom.sliderEnergy.value = state.energyGeV;
      updateRelativisticCalculations();
    });
  });

  dom.sliderTemp.addEventListener('input', (e) => {
    state.cryoTempK = parseFloat(e.target.value);
    updateRelativisticCalculations();
  });
}

// ----------------------------------------------------
// Tab 3: RF Bucket & Longitudinal Phase Space
// ----------------------------------------------------
function initRfParticles() {
  state.rfParticles = [];
  // 150 particles inside bunch with Gaussian distribution
  for (let i = 0; i < 150; i++) {
    const u1 = Math.random();
    const u2 = Math.random();
    const r = Math.sqrt(-2 * Math.log(u1 || 0.001));
    const theta = 2 * Math.PI * u2;
    const phi = r * Math.cos(theta) * 0.35;
    const delta = r * Math.sin(theta) * 0.00018;
    state.rfParticles.push({ phi, delta, trapped: true });
  }
}

function renderRfPhaseSpace() {
  const ctx = dom.canvasRf.getContext('2d');
  const w = dom.canvasRf.width;
  const h = dom.canvasRf.height;
  const cx = w / 2;
  const cy = h / 2;

  ctx.fillStyle = '#060a12';
  ctx.fillRect(0, 0, w, h);

  // Coordinate axes
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, cy);
  ctx.lineTo(w, cy);
  ctx.moveTo(cx, 0);
  ctx.lineTo(cx, h);
  ctx.stroke();

  // Grid tick marks (-pi, -pi/2, 0, pi/2, pi)
  ctx.fillStyle = '#64748b';
  ctx.font = '10px var(--font-mono)';
  [-Math.PI, -Math.PI / 2, Math.PI / 2, Math.PI].forEach((phi) => {
    const px = cx + (phi / Math.PI) * (w / 2 - 20);
    ctx.beginPath();
    ctx.moveTo(px, cy - 4);
    ctx.lineTo(px, cy + 4);
    ctx.stroke();
  });

  // Calculate Separatrix
  const deltaMax = rfBucketHalfHeightEnergyMeV(state.energyGeV, state.vrfMV) / (state.energyGeV * 1000.0);
  const deltaPxScale = (h / 2 - 30) / (deltaMax * 1.5 || 0.001);

  // Draw Separatrix Curve (Fish-shaped bucket)
  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  let first = true;
  for (let phi = -Math.PI; phi <= Math.PI; phi += 0.05) {
    const px = cx + (phi / Math.PI) * (w / 2 - 20);
    // Separatrix equation: delta(phi) = deltaMax * sqrt((1 + cos(phi)) / 2)
    const factor = Math.sqrt(Math.max(0, (1.0 + Math.cos(phi)) / 2.0));
    const py = cy - deltaMax * factor * deltaPxScale;
    if (first) {
      ctx.moveTo(px, py);
      first = false;
    } else {
      ctx.lineTo(px, py);
    }
  }
  for (let phi = Math.PI; phi >= -Math.PI; phi -= 0.05) {
    const px = cx + (phi / Math.PI) * (w / 2 - 20);
    const factor = Math.sqrt(Math.max(0, (1.0 + Math.cos(phi)) / 2.0));
    const py = cy + deltaMax * factor * deltaPxScale;
    ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(0, 240, 255, 0.04)';
  ctx.fill();
  ctx.stroke();

  // Track and render particles
  state.rfParticles.forEach((p) => {
    // 5 turns per render frame for visible motion
    for (let t = 0; t < 4; t++) {
      const step = trackLongitudinalTurn(p.phi, p.delta, state.energyGeV, state.vrfMV);
      p.phi = step.phi;
      p.delta = step.delta;
    }

    const px = cx + (p.phi / Math.PI) * (w / 2 - 20);
    const py = cy - p.delta * deltaPxScale;

    // Check if inside separatrix
    const factor = Math.sqrt(Math.max(0, (1.0 + Math.cos(p.phi)) / 2.0));
    const bound = deltaMax * factor;
    p.trapped = Math.abs(p.delta) <= bound;

    ctx.fillStyle = p.trapped ? '#38bdf8' : '#ef4444';
    ctx.beginPath();
    ctx.arc(px, py, 2, 0, 2 * Math.PI);
    ctx.fill();
  });

  // Update RF readouts
  const eta = phaseSlipFactor(state.energyGeV);
  const bucketHMeV = rfBucketHalfHeightEnergyMeV(state.energyGeV, state.vrfMV);
  const fs = synchrotronFrequencyHz(state.energyGeV, state.vrfMV);

  dom.valEta.textContent = `${(eta * 1e4).toFixed(2)} × 10⁻⁴`;
  dom.valBucketHeight.textContent = `± ${bucketHMeV.toFixed(0)} MeV`;
  dom.valSynchFreq.textContent = `${fs.toFixed(1)} Hz`;
}

function initRfEvents() {
  initRfParticles();
  renderRfPhaseSpace();

  dom.sliderVrf.addEventListener('input', (e) => {
    state.vrfMV = parseFloat(e.target.value);
    dom.valVrf.textContent = `${state.vrfMV.toFixed(1)} MV`;
    dom.vrfPills.forEach((p) => p.classList.remove('active'));
    renderRfPhaseSpace();
  });

  dom.vrfPills.forEach((btn) => {
    btn.addEventListener('click', () => {
      dom.vrfPills.forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      state.vrfMV = parseFloat(btn.dataset.vrf);
      dom.sliderVrf.value = state.vrfMV;
      dom.valVrf.textContent = `${state.vrfMV.toFixed(1)} MV`;
      renderRfPhaseSpace();
    });
  });

  dom.btnInjectSpray.addEventListener('click', () => {
    // Inject spray of 60 particles across full phase range
    for (let i = 0; i < 60; i++) {
      const phi = (Math.random() - 0.5) * 2 * Math.PI;
      const delta = (Math.random() - 0.5) * 0.0015;
      state.rfParticles.push({ phi, delta, trapped: true });
    }
    renderRfPhaseSpace();
  });

  dom.btnResetBunch.addEventListener('click', () => {
    initRfParticles();
    renderRfPhaseSpace();
  });

  // Continuous animation loop for RF bucket
  function rfLoop() {
    if (state.activeTab === 'bucket') {
      renderRfPhaseSpace();
    }
    requestAnimationFrame(rfLoop);
  }
  requestAnimationFrame(rfLoop);
}

// ----------------------------------------------------
// Tab 4: CERN LHC Page 1 & Milestones
// ----------------------------------------------------
function updatePage1() {
  const modesConfig = {
    'INJECTION PROBE BEAM': {
      energy: '450 GeV',
      b1Int: '1.15 × 10¹¹ p⁺',
      b2Int: '1.15 × 10¹¹ p⁺',
      lumAtlas: '0.00',
      lumCms: '0.00',
      lumAlice: '0.00',
      lumLhcb: '0.00',
    },
    'PREPARE RAMP': {
      energy: '450 GeV',
      b1Int: '3.23 × 10¹⁴ p⁺',
      b2Int: '3.23 × 10¹⁴ p⁺',
      lumAtlas: '0.00',
      lumCms: '0.00',
      lumAlice: '0.00',
      lumLhcb: '0.00',
    },
    'RAMPING': {
      energy: '3800 GeV',
      b1Int: '3.22 × 10¹⁴ p⁺',
      b2Int: '3.22 × 10¹⁴ p⁺',
      lumAtlas: '0.00',
      lumCms: '0.00',
      lumAlice: '0.00',
      lumLhcb: '0.00',
    },
    'FLAT TOP 7 TeV': {
      energy: '7000 GeV',
      b1Int: '3.20 × 10¹⁴ p⁺',
      b2Int: '3.20 × 10¹⁴ p⁺',
      lumAtlas: '0.00',
      lumCms: '0.00',
      lumAlice: '0.00',
      lumLhcb: '0.00',
    },
    'SQUEEZE β*': {
      energy: '7000 GeV',
      b1Int: '3.18 × 10¹⁴ p⁺',
      b2Int: '3.18 × 10¹⁴ p⁺',
      lumAtlas: '1.20 × 10³³',
      lumCms: '1.20 × 10³³',
      lumAlice: '1.00 × 10²⁹',
      lumLhcb: '4.00 × 10³¹',
    },
    'STABLE BEAMS': {
      energy: '7000 GeV',
      b1Int: '3.15 × 10¹⁴ p⁺',
      b2Int: '3.15 × 10¹⁴ p⁺',
      lumAtlas: '1.01 × 10³⁴',
      lumCms: '1.01 × 10³⁴',
      lumAlice: '1.20 × 10³⁰',
      lumLhcb: '4.00 × 10³²',
    },
  };

  const cfg = modesConfig[state.page1Mode] || modesConfig['INJECTION PROBE BEAM'];
  dom.lblP1Energy.textContent = cfg.energy;
  dom.p1BeamStatus.textContent = state.page1Mode;
  dom.lblB1Intensity.textContent = cfg.b1Int;
  dom.lblB2Intensity.textContent = cfg.b2Int;
  dom.lumAtlas.textContent = cfg.lumAtlas;
  dom.lumCms.textContent = cfg.lumCms;
  dom.lumAlice.textContent = cfg.lumAlice;
  dom.lumLhcb.textContent = cfg.lumLhcb;
}

function renderCollisionEvent() {
  const ctx = dom.canvasCollision.getContext('2d');
  const w = dom.canvasCollision.width;
  const h = dom.canvasCollision.height;
  const cx = w / 2;
  const cy = h / 2;

  ctx.fillStyle = '#04070e';
  ctx.fillRect(0, 0, w, h);

  // Concentric detector layers
  const layers = [
    { r: 25, color: '#334155', name: 'Tracker' },
    { r: 55, color: '#1e3a8a', name: 'ECAL' },
    { r: 75, color: '#854d0e', name: 'HCAL' },
    { r: 92, color: '#7c3aed', name: 'Solenoid' },
    { r: 105, color: '#475569', name: 'Muon' },
  ];

  layers.forEach((l) => {
    ctx.strokeStyle = l.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, l.r, 0, 2 * Math.PI);
    ctx.stroke();
  });

  // Render active collision particle tracks
  state.collisionParticles.forEach((p) => {
    ctx.strokeStyle = p.color;
    ctx.lineWidth = p.width;
    ctx.beginPath();
    ctx.moveTo(cx, cy);

    // Curved track in magnetic field
    const rEnd = p.maxRadius;
    const endX = cx + rEnd * Math.cos(p.angle + p.curve);
    const endY = cy + rEnd * Math.sin(p.angle + p.curve);
    const midX = cx + (rEnd * 0.5) * Math.cos(p.angle + p.curve * 0.3);
    const midY = cy + (rEnd * 0.5) * Math.sin(p.angle + p.curve * 0.3);

    ctx.quadraticCurveTo(midX, midY, endX, endY);
    ctx.stroke();

    // Hit marker
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(endX, endY, 3, 0, 2 * Math.PI);
    ctx.fill();
  });
}

function fireCollisionEvent() {
  state.collisionParticles = [];
  // Generate a Golden Channel Higgs H -> 4mu event
  const muonAngles = [0.35, 1.82, -1.25, -2.65];
  muonAngles.forEach((ang) => {
    state.collisionParticles.push({
      angle: ang,
      curve: (Math.random() - 0.5) * 0.4,
      maxRadius: 102, // Reaches outer muon chambers
      color: '#00f0ff',
      width: 2.5,
      type: 'muon',
    });
  });

  // Add low-energy hadron spray
  for (let i = 0; i < 20; i++) {
    state.collisionParticles.push({
      angle: Math.random() * 2 * Math.PI,
      curve: (Math.random() - 0.5) * 0.8,
      maxRadius: 45 + Math.random() * 30, // Stopped in ECAL/HCAL
      color: '#f59e0b',
      width: 1,
      type: 'hadron',
    });
  }

  dom.lblCollisionInfo.textContent =
    '对撞产物: 候选希格斯事件 H → 4μ (4 条高能缪子穿透至最外层缪子室，不变质量 125.09 GeV)';
  renderCollisionEvent();
}

function initPage1Events() {
  updatePage1();
  fireCollisionEvent();

  dom.p1ModeBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      dom.p1ModeBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.page1Mode = btn.dataset.mode;
      updatePage1();
    });
  });

  dom.btnFireCollision.addEventListener('click', () => {
    fireCollisionEvent();
  });
}

// ----------------------------------------------------
// Global Navigation & Demo Hooks
// ----------------------------------------------------
function initTabs() {
  dom.tabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      dom.tabs.forEach((b) => b.classList.remove('active'));
      dom.panes.forEach((p) => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPane = document.getElementById(`pane-${btn.dataset.tab}`);
      if (targetPane) targetPane.classList.add('active');
      state.activeTab = btn.dataset.tab;

      if (state.activeTab === 'threading') {
        renderBtvScreen();
        updateRingDisplay();
      } else if (state.activeTab === 'dipoles') {
        updateRelativisticCalculations();
      } else if (state.activeTab === 'bucket') {
        renderRfPhaseSpace();
      } else if (state.activeTab === 'page1') {
        updatePage1();
        renderCollisionEvent();
      }
    });
  });
}

// Expose demo API for video recording and automated tests
window.__demo = {
  state,
  selectTab(name) {
    const btn = document.querySelector(`.nav-btn[data-tab="${name}"]`);
    if (btn) btn.click();
  },
  autoAlign() {
    dom.btnAutoAlign.click();
  },
  advanceSector() {
    dom.btnAdvanceSector.click();
  },
  setEnergy(val) {
    state.energyGeV = val;
    dom.sliderEnergy.value = val;
    updateRelativisticCalculations();
  },
  fireCollision() {
    dom.btnFireCollision.click();
  },
};

// Application Startup
document.addEventListener('DOMContentLoaded', () => {
  initDom();
  initTabs();
  initThreadingEvents();
  initDipoleEvents();
  initRfEvents();
  initPage1Events();
});
