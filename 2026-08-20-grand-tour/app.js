/**
 * app.js - Main Controller and Interactive Canvas Renderer for Voyager 2 Grand Tour
 */

(function () {
  'use strict';

  const engine = window.GrandTourEngine;
  const audio = window.GrandTourAudio;

  // DOM Elements
  const canvas = document.getElementById('main-canvas');
  const ctx = canvas.getContext('2d');
  const chartCanvas = document.getElementById('speed-chart-canvas');
  const chartCtx = chartCanvas ? chartCanvas.getContext('2d') : null;

  const headerPhase = document.getElementById('header-phase');
  const headerDay = document.getElementById('header-day');
  const headerDate = document.getElementById('header-date');
  const muteBtn = document.getElementById('mute-btn');

  const tabBtns = document.querySelectorAll('.tab-btn');
  const encounterSelectorBox = document.getElementById('encounter-selector-box');
  const encounterBtns = document.querySelectorAll('.encounter-btn');
  const viewModeTitle = document.getElementById('view-mode-title');
  const viewModeDesc = document.getElementById('view-mode-desc');

  const playPauseBtn = document.getElementById('play-pause-btn');
  const speedBtns = document.querySelectorAll('.speed-btn');
  const timeSlider = document.getElementById('time-slider');
  const jumpBtns = document.querySelectorAll('.jump-btn');

  // Telemetry elements
  const dataDistAu = document.getElementById('data-dist-au');
  const dataDistKm = document.getElementById('data-dist-km');
  const dataSpeed = document.getElementById('data-speed');
  const dataSpeedEscape = document.getElementById('data-speed-escape');
  const dataLightTime = document.getElementById('data-light-time');
  const dataLightRound = document.getElementById('data-light-round');
  const dataRtgPower = document.getElementById('data-rtg-power');
  const dataRtgStatus = document.getElementById('data-rtg-status');

  const physicsCardContent = document.getElementById('physics-card-content');
  const sandboxControlsCard = document.getElementById('sandbox-controls-card');
  const inputInjectDv = document.getElementById('input-inject-dv');
  const valInjectDv = document.getElementById('val-inject-dv');
  const inputAimOffset = document.getElementById('input-aim-offset');
  const valAimOffset = document.getElementById('val-aim-offset');
  const sandboxOutcomeBox = document.getElementById('sandbox-outcome-box');
  const sandboxOutcomeTitle = document.getElementById('sandbox-outcome-title');
  const sandboxOutcomeDesc = document.getElementById('sandbox-outcome-desc');
  const runSandboxBtn = document.getElementById('run-sandbox-btn');

  const ledgerScGain = document.getElementById('ledger-sc-gain');
  const ledgerEnergyStolen = document.getElementById('ledger-energy-stolen');
  const ledgerPlanetSlow = document.getElementById('ledger-planet-slow');

  // Application State
  const state = {
    currentDay: 17897,      // Default to 49th Anniversary: August 20, 2026
    isPlaying: false,
    simSpeedDaysPerSec: 120, // Default 120 days/second
    activeTab: 'macro',     // 'macro' | 'encounter' | 'record' | 'sandbox'
    activeEncounter: 'JUPITER',
    zoom: 1.0,
    panX: 0,
    panY: 0,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    sandboxInjectDv: 9.5,
    sandboxAimOffset: 1.0,
    starField: [],
    lastFrameTime: performance.now(),
    particles: [],
    recordRotation: 0,
    cachedPolyline: engine.generateTrajectoryPolyline(300)
  };

  // Generate random starry background
  function initStarField(count = 180) {
    state.starField = [];
    for (let i = 0; i < count; i++) {
      state.starField.push({
        x: Math.random() * 2000 - 1000,
        y: Math.random() * 2000 - 1000,
        size: Math.random() * 1.5 + 0.5,
        brightness: Math.random() * 0.7 + 0.3,
        twinkleSpeed: Math.random() * 0.03 + 0.01,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  // Handle High-DPI canvas resizing
  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    if (chartCanvas) {
      const chartRect = chartCanvas.parentElement.getBoundingClientRect();
      chartCanvas.width = chartRect.width * dpr;
      chartCanvas.height = 140 * dpr;
      chartCtx.scale(dpr, dpr);
    }
  }

  // Setup Event Listeners
  function initEvents() {
    window.addEventListener('resize', resizeCanvas);

    // Audio Mute Button
    muteBtn.addEventListener('click', () => {
      audio.init();
      const muted = audio.toggleMute();
      muteBtn.textContent = muted ? '🔇' : '🔊';
    });

    // View Tabs
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        setTab(btn.dataset.tab);
        audio.playTelemetryBlip(1200, 0.03);
      });
    });

    // Encounter Planet Buttons
    encounterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        setEncounter(btn.dataset.planet);
        audio.playTelemetryBlip(1600, 0.03);
      });
    });

    // Playback Buttons
    playPauseBtn.addEventListener('click', () => {
      state.isPlaying = !state.isPlaying;
      playPauseBtn.textContent = state.isPlaying ? '⏸ PAUSE' : '▶ PLAY';
      playPauseBtn.style.background = state.isPlaying 
        ? 'linear-gradient(135deg, #dc2626, #991b1b)' 
        : 'linear-gradient(135deg, #2563eb, #1d4ed8)';
      audio.playTelemetryBlip(880, 0.04);
    });

    speedBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        speedBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.simSpeedDaysPerSec = parseFloat(btn.dataset.speed);
        audio.playTelemetryBlip(1400, 0.02);
      });
    });

    timeSlider.addEventListener('input', e => {
      state.currentDay = parseFloat(e.target.value);
      updateTelemetry();
    });

    jumpBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        jumpBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.currentDay = parseFloat(btn.dataset.day);
        timeSlider.value = state.currentDay;
        updateTelemetry();
        audio.playFlybyWhoosh(0.8);
      });
    });

    // Canvas Pan & Zoom
    canvas.addEventListener('mousedown', e => {
      state.isDragging = true;
      state.dragStartX = e.clientX - state.panX;
      state.dragStartY = e.clientY - state.panY;
    });

    window.addEventListener('mousemove', e => {
      if (state.isDragging) {
        state.panX = e.clientX - state.dragStartX;
        state.panY = e.clientY - state.dragStartY;
      }
    });

    window.addEventListener('mouseup', () => {
      state.isDragging = false;
    });

    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      state.zoom = Math.max(0.2, Math.min(10.0, state.zoom * zoomFactor));
    }, { passive: false });

    document.getElementById('zoom-in-btn').addEventListener('click', () => {
      state.zoom = Math.min(10.0, state.zoom * 1.25);
    });
    document.getElementById('zoom-out-btn').addEventListener('click', () => {
      state.zoom = Math.max(0.2, state.zoom / 1.25);
    });
    document.getElementById('reset-view-btn').addEventListener('click', () => {
      state.zoom = 1.0;
      state.panX = 0;
      state.panY = 0;
    });

    // Sandbox Controls
    inputInjectDv.addEventListener('input', e => {
      state.sandboxInjectDv = parseFloat(e.target.value);
      valInjectDv.textContent = `${state.sandboxInjectDv.toFixed(1)} km/s`;
      updateSandboxOutcome();
    });

    inputAimOffset.addEventListener('input', e => {
      state.sandboxAimOffset = parseFloat(e.target.value);
      const sign = state.sandboxAimOffset > 0 ? '+' : '';
      const side = state.sandboxAimOffset > 0 ? 'Trailing / Boost' : (state.sandboxAimOffset < 0 ? 'Leading / Brake' : 'Direct Collision');
      valAimOffset.textContent = `${sign}${state.sandboxAimOffset.toFixed(1)} (${side})`;
      updateSandboxOutcome();
    });

    runSandboxBtn.addEventListener('click', () => {
      audio.playThrusterPulse();
      updateSandboxOutcome();
    });
  }

  function setTab(tab) {
    state.activeTab = tab;
    tabBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    encounterSelectorBox.style.display = tab === 'encounter' ? 'flex' : 'none';
    sandboxControlsCard.style.display = tab === 'sandbox' ? 'flex' : 'none';
    physicsCardContent.style.display = tab === 'sandbox' ? 'none' : 'flex';

    if (tab === 'macro') {
      viewModeTitle.textContent = 'HELIOCENTRIC GRAND TOUR MAP';
      viewModeDesc.textContent = 'Patched-conic trajectory across Jupiter, Saturn, Uranus, and Neptune';
    } else if (tab === 'encounter') {
      viewModeTitle.textContent = `${engine.PLANETS[state.activeEncounter].name.toUpperCase()} GRAVITY ASSIST CHAMBER`;
      viewModeDesc.textContent = engine.PLANETS[state.activeEncounter].description;
    } else if (tab === 'record') {
      viewModeTitle.textContent = 'VOYAGER GOLDEN RECORD & DSN INTERSTELLAR LINK';
      viewModeDesc.textContent = '12-inch gold-plated copper phonograph record carrying greetings in 55 languages & Bach music';
      audio.playGoldenRecordMelody();
    } else if (tab === 'sandbox') {
      viewModeTitle.textContent = 'GRAVITY ASSIST INTERACTIVE FLIGHT PLANNER';
      viewModeDesc.textContent = 'Experiment with injection velocity and Jupiter aim point parameters';
    }
  }

  function setEncounter(planetKey) {
    state.activeEncounter = planetKey;
    encounterBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.planet === planetKey);
    });
    const p = engine.PLANETS[planetKey];
    viewModeTitle.textContent = `${p.name.toUpperCase()} GRAVITY ASSIST CHAMBER`;
    viewModeDesc.textContent = p.description;
    // Seek time to this encounter
    state.currentDay = p.flybyDay;
    timeSlider.value = state.currentDay;
    updateTelemetry();
  }

  function updateSandboxOutcome() {
    const res = engine.simulateCustomLaunch(state.sandboxInjectDv, state.sandboxAimOffset);
    if (!res.success) {
      sandboxOutcomeTitle.textContent = 'APOAPSIS SHORT OF JUPITER';
      sandboxOutcomeTitle.style.color = '#ef4444';
      sandboxOutcomeDesc.textContent = `Aphelion reaches only ${res.apoapsisAU.toFixed(2)} AU. Needs ≥8.8 km/s injection to cross Jupiter's orbit.`;
      sandboxOutcomeBox.style.background = 'rgba(239, 68, 68, 0.1)';
      sandboxOutcomeBox.style.borderColor = 'rgba(239, 68, 68, 0.3)';
    } else if (res.outcome === 'GRAND_TOUR_CORRIDOR') {
      sandboxOutcomeTitle.textContent = '🏆 GRAND TOUR CORRIDOR UNLOCKED';
      sandboxOutcomeTitle.style.color = '#10b981';
      sandboxOutcomeDesc.textContent = `Turn angle ${res.turnAngleDeg.toFixed(1)}° pumps speed to ${res.vPostJupiterKmS.toFixed(1)} km/s! Hits Saturn, Uranus, Neptune alignment.`;
      sandboxOutcomeBox.style.background = 'rgba(16, 185, 129, 0.15)';
      sandboxOutcomeBox.style.borderColor = 'rgba(16, 185, 129, 0.4)';
    } else if (res.outcome === 'SOLAR_SYSTEM_ESCAPE') {
      sandboxOutcomeTitle.textContent = '⚡ SOLAR SYSTEM ESCAPE';
      sandboxOutcomeTitle.style.color = '#38bdf8';
      sandboxOutcomeDesc.textContent = `Speed boosted to ${res.vPostJupiterKmS.toFixed(1)} km/s (> v_esc ${res.vEscAtJupKmS.toFixed(1)} km/s). Bound for interstellar space!`;
      sandboxOutcomeBox.style.background = 'rgba(56, 189, 248, 0.15)';
      sandboxOutcomeBox.style.borderColor = 'rgba(56, 189, 248, 0.4)';
    } else {
      sandboxOutcomeTitle.textContent = '🔥 GRAVITY BRAKE (INNER DIVER)';
      sandboxOutcomeTitle.style.color = '#f59e0b';
      sandboxOutcomeDesc.textContent = `Leading flyby dropped heliocentric speed to ${res.vPostJupiterKmS.toFixed(1)} km/s. Plunges toward inner solar system!`;
      sandboxOutcomeBox.style.background = 'rgba(245, 158, 11, 0.15)';
      sandboxOutcomeBox.style.borderColor = 'rgba(245, 158, 11, 0.4)';
    }
  }

  // Update Telemetry Displays
  function updateTelemetry() {
    const info = engine.trajectoryAtDay(state.currentDay);

    headerPhase.textContent = info.phase;
    headerDay.textContent = `Day ${Math.floor(info.day).toLocaleString()}`;
    headerDate.textContent = info.dateStr;

    dataDistAu.innerHTML = `${info.rAU.toFixed(2)} <span class="unit">AU</span>`;
    dataDistKm.textContent = `${(info.distKm / 1e9).toFixed(3)} billion km`;

    dataSpeed.innerHTML = `${info.speedKmS.toFixed(2)} <span class="unit">km/s</span>`;
    const isEscaping = info.speedKmS >= info.vEscKmS;
    dataSpeedEscape.textContent = `Escape: ${info.vEscKmS.toFixed(2)} km/s (${isEscaping ? 'Escaping' : 'Elliptical'})`;
    dataSpeedEscape.style.color = isEscaping ? 'var(--accent-green)' : 'var(--text-muted)';

    dataLightTime.textContent = info.lightTime.oneWayStr;
    dataLightRound.textContent = `Round-trip: ${info.lightTime.roundTripStr}`;

    dataRtgPower.innerHTML = `${info.rtgPowerWatts.toFixed(1)} <span class="unit">Watts</span>`;
    const pct = ((info.rtgPowerWatts / 470) * 100).toFixed(1);
    dataRtgStatus.textContent = `${pct}% of Launch (470 W)`;

    // Update jump button active states
    jumpBtns.forEach(btn => {
      const d = parseFloat(btn.dataset.day);
      btn.classList.toggle('active', Math.abs(d - state.currentDay) < 50);
    });

    // Update energy ledger values
    if (info.closePlanet && engine.PLANETS[info.closePlanet]) {
      const p = engine.PLANETS[info.closePlanet];
      ledgerScGain.textContent = `+${(p.speedAfterKmS - p.speedBeforeKmS).toFixed(1)} km/s`;
      ledgerEnergyStolen.textContent = '1.88 × 10¹¹ J';
      ledgerPlanetSlow.textContent = `~10⁻²⁴ m/s (${p.name} orbit)`;
    } else {
      ledgerScGain.textContent = '+15.2 km/s (Jupiter peak)';
      ledgerEnergyStolen.textContent = '1.88 × 10¹¹ J';
      ledgerPlanetSlow.textContent = '~10⁻²⁴ m/s (Jupiter)';
    }

    drawSpeedChart(info.rAU, info.speedKmS);
  }

  // Draw 2D Speed vs Distance Chart in Sidebar
  function drawSpeedChart(currentAU, currentSpeed) {
    if (!chartCtx) return;
    const w = chartCanvas.width / (window.devicePixelRatio || 1);
    const h = 140;

    chartCtx.clearRect(0, 0, w, h);

    // Coordinate transforms: r from 0 to 140 AU, v from 0 to 45 km/s
    const maxAU = 140;
    const maxV = 45;
    function xMap(r) { return 35 + (r / maxAU) * (w - 45); }
    function yMap(v) { return h - 20 - (v / maxV) * (h - 30); }

    // Grid lines
    chartCtx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    chartCtx.lineWidth = 1;
    [0, 30, 60, 90, 120].forEach(r => {
      const x = xMap(r);
      chartCtx.beginPath();
      chartCtx.moveTo(x, 10);
      chartCtx.lineTo(x, h - 20);
      chartCtx.stroke();
      chartCtx.fillStyle = '#64748b';
      chartCtx.font = '9px JetBrains Mono';
      chartCtx.fillText(`${r}`, x - 5, h - 8);
    });

    [10, 20, 30, 40].forEach(v => {
      const y = yMap(v);
      chartCtx.beginPath();
      chartCtx.moveTo(35, y);
      chartCtx.lineTo(w - 10, y);
      chartCtx.stroke();
      chartCtx.fillStyle = '#64748b';
      chartCtx.font = '9px JetBrains Mono';
      chartCtx.fillText(`${v}`, 10, y + 3);
    });

    // 1. Plot Solar Escape Velocity curve v_esc(r) = sqrt(2mu / r)
    chartCtx.beginPath();
    chartCtx.strokeStyle = '#ec4899';
    chartCtx.setLineDash([3, 3]);
    chartCtx.lineWidth = 1.5;
    for (let r = 1; r <= maxAU; r += 1) {
      const vEsc = engine.solarEscapeVelocity(r * engine.AU_KM);
      const x = xMap(r);
      const y = yMap(vEsc);
      if (r === 1) chartCtx.moveTo(x, y);
      else chartCtx.lineTo(x, y);
    }
    chartCtx.stroke();
    chartCtx.setLineDash([]);

    // 2. Plot Spacecraft Speed curve v(r) across 300 precomputed points
    chartCtx.beginPath();
    chartCtx.strokeStyle = '#00f2fe';
    chartCtx.lineWidth = 2;
    state.cachedPolyline.forEach((pt, i) => {
      const x = xMap(pt.rAU);
      const y = yMap(pt.speedKmS);
      if (i === 0) chartCtx.moveTo(x, y);
      else chartCtx.lineTo(x, y);
    });
    chartCtx.stroke();

    // 3. Mark the 4 flyby kicks with golden dots
    const flybys = [
      { r: 5.2, v: 25.4, name: 'J' },
      { r: 9.6, v: 24.3, name: 'S' },
      { r: 19.2, v: 21.4, name: 'U' },
      { r: 30.0, v: 26.6, name: 'N' }
    ];
    flybys.forEach(fb => {
      const fx = xMap(fb.r);
      const fy = yMap(fb.v);
      chartCtx.fillStyle = '#f59e0b';
      chartCtx.beginPath();
      chartCtx.arc(fx, fy, 3.5, 0, Math.PI * 2);
      chartCtx.fill();
    });

    // 4. Current probe position marker
    const curX = xMap(currentAU);
    const curY = yMap(currentSpeed);
    chartCtx.fillStyle = '#ffffff';
    chartCtx.beginPath();
    chartCtx.arc(curX, curY, 4.5, 0, Math.PI * 2);
    chartCtx.fill();
    chartCtx.strokeStyle = '#00f2fe';
    chartCtx.lineWidth = 2;
    chartCtx.stroke();
  }

  // Render Solar System Macro View
  function renderMacroView(w, h, timeInfo) {
    const cx = w / 2 + state.panX;
    const cy = h / 2 + state.panY;
    // Scale: 1 AU = 8.5px * zoom
    const scale = 8.5 * state.zoom;

    // Draw Sun with glowing corona
    const sunGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 22 * state.zoom);
    sunGrad.addColorStop(0, '#ffffff');
    sunGrad.addColorStop(0.2, '#fef08a');
    sunGrad.addColorStop(0.6, 'rgba(245, 158, 11, 0.4)');
    sunGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, 22 * state.zoom, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fffae0';
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(3, 4 * state.zoom), 0, Math.PI * 2);
    ctx.fill();

    // Draw Heliopause Boundary (~120 AU)
    ctx.strokeStyle = 'rgba(236, 72, 153, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(cx, cy, 119.7 * scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(236, 72, 153, 0.5)';
    ctx.font = '10px JetBrains Mono';
    ctx.fillText('HELIOPAUSE (119.7 AU)', cx + 119.7 * scale + 6, cy);

    // Draw Planetary Orbits & Planets
    const planetsToDraw = ['EARTH', 'JUPITER', 'SATURN', 'URANUS', 'NEPTUNE'];
    planetsToDraw.forEach(key => {
      const p = engine.PLANETS[key];
      const orbitR = p.aAU * scale;

      // Orbit circle
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, orbitR, 0, Math.PI * 2);
      ctx.stroke();

      // Planet position at current simulation day
      const pos = engine.planetPosition(key, state.currentDay);
      const px = cx + pos.xAU * scale;
      const py = cy + pos.yAU * scale;

      // Planet dot
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(px, py, Math.max(2.5, 4 * Math.sqrt(state.zoom)), 0, Math.PI * 2);
      ctx.fill();

      // Label
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px Outfit';
      ctx.fillText(p.name, px + 7, py + 3);
    });

    // Draw Full Grand Tour Trajectory Path
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    state.cachedPolyline.forEach((pt, i) => {
      const tx = cx + pt.xAU * scale;
      const ty = cy + pt.yAU * scale;
      if (i === 0) ctx.moveTo(tx, ty);
      else ctx.lineTo(tx, ty);
    });
    ctx.stroke();

    // Draw Current Spacecraft Position & Model
    const scX = cx + timeInfo.xAU * scale;
    const scY = cy + timeInfo.yAU * scale;

    // Trajectory engine glow pulse
    const scGlow = ctx.createRadialGradient(scX, scY, 1, scX, scY, 14);
    scGlow.addColorStop(0, '#00f2fe');
    scGlow.addColorStop(0.5, 'rgba(0, 242, 254, 0.4)');
    scGlow.addColorStop(1, 'rgba(0, 242, 254, 0)');
    ctx.fillStyle = scGlow;
    ctx.beginPath();
    ctx.arc(scX, scY, 14, 0, Math.PI * 2);
    ctx.fill();

    // Spacecraft Dish
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(scX, scY, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Spacecraft Direction Indicator / Velocity Vector
    const vMag = timeInfo.speedKmS;
    const vxNorm = timeInfo.velocityVector.x / vMag;
    const vyNorm = timeInfo.velocityVector.y / vMag;
    ctx.strokeStyle = '#ec4899';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(scX, scY);
    ctx.lineTo(scX + vxNorm * 22, scY + vyNorm * 22);
    ctx.stroke();

    // Label on Voyager 2
    ctx.fillStyle = '#00f2fe';
    ctx.font = 'bold 11px JetBrains Mono';
    ctx.fillText(`VOYAGER 2 (${timeInfo.rAU.toFixed(1)} AU)`, scX + 10, scY - 8);
  }

  // Render Encounter Close-up Chamber
  function renderEncounterView(w, h, timeInfo) {
    const p = engine.PLANETS[state.activeEncounter];
    const cx = w / 2;
    const cy = h / 2;

    // Draw Encounter Planet with procedural detail
    const planetRadius = 75;

    if (state.activeEncounter === 'JUPITER') {
      // Jupiter: Giant banded disk with Great Red Spot & Io
      const grad = ctx.createLinearGradient(cx - planetRadius, cy - planetRadius, cx + planetRadius, cy + planetRadius);
      grad.addColorStop(0, '#e0ae6f');
      grad.addColorStop(0.25, '#c98a4b');
      grad.addColorStop(0.45, '#e5be85');
      grad.addColorStop(0.7, '#ba7839');
      grad.addColorStop(1, '#e0ae6f');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, planetRadius, 0, Math.PI * 2);
      ctx.fill();

      // Great Red Spot
      ctx.fillStyle = '#d9534f';
      ctx.beginPath();
      ctx.ellipse(cx + 25, cy + 22, 16, 10, 0.1, 0, Math.PI * 2);
      ctx.fill();

      // Radiation Belt aura
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.2)';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(cx, cy, planetRadius * 1.5, 0, Math.PI * 2);
      ctx.stroke();

      // Moon Io with sulfur plume
      const ioX = cx - 140;
      const ioY = cy - 40;
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(ioX, ioY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px JetBrains Mono';
      ctx.fillText('Io (Active Volcanoes)', ioX - 35, ioY - 10);
    } else if (state.activeEncounter === 'SATURN') {
      // Saturn: Banded ball and rings
      ctx.fillStyle = '#e2c58e';
      ctx.beginPath();
      ctx.arc(cx, cy, planetRadius * 0.75, 0, Math.PI * 2);
      ctx.fill();

      // Rings
      ctx.strokeStyle = 'rgba(226, 197, 142, 0.8)';
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.ellipse(cx, cy, planetRadius * 2.1, planetRadius * 0.55, -0.35, 0, Math.PI * 2);
      ctx.stroke();

      // Cassini Division
      ctx.strokeStyle = '#050811';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, planetRadius * 1.85, planetRadius * 0.48, -0.35, 0, Math.PI * 2);
      ctx.stroke();
    } else if (state.activeEncounter === 'URANUS') {
      // Uranus: Aquamarine tilted globe with thin rings
      ctx.fillStyle = '#7ce8e2';
      ctx.beginPath();
      ctx.arc(cx, cy, planetRadius * 0.65, 0, Math.PI * 2);
      ctx.fill();

      // 98° tilted faint vertical rings
      ctx.strokeStyle = 'rgba(124, 232, 226, 0.4)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(cx, cy, planetRadius * 0.3, planetRadius * 1.6, 0.1, 0, Math.PI * 2);
      ctx.stroke();
    } else if (state.activeEncounter === 'NEPTUNE') {
      // Neptune: Deep azure globe with Great Dark Spot & Triton
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(cx, cy, planetRadius * 0.65, 0, Math.PI * 2);
      ctx.fill();

      // Great Dark Spot
      ctx.fillStyle = '#1d4ed8';
      ctx.beginPath();
      ctx.ellipse(cx - 15, cy - 10, 12, 7, 0.1, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw Hyperbolic Trajectory Curve
    ctx.strokeStyle = '#00f2fe';
    ctx.lineWidth = 3;
    ctx.beginPath();
    const hypRp = 120; // Visual closest approach distance
    ctx.moveTo(cx - 260, cy - 180);
    ctx.quadraticCurveTo(cx - hypRp, cy, cx + 220, cy + 190);
    ctx.stroke();

    // Periapsis closest approach point marker
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(cx - hypRp * 0.6, cy + 8, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 11px JetBrains Mono';
    ctx.fillText(`Closest Approach: ${(p.flybyRpKm).toLocaleString()} km`, cx - hypRp * 0.6 + 10, cy + 12);

    // Vector Triangle HUD in bottom-left corner
    const vtx = 40;
    const vty = h - 90;
    ctx.fillStyle = 'rgba(12, 18, 34, 0.85)';
    ctx.strokeStyle = '#1e2c4f';
    ctx.lineWidth = 1;
    ctx.fillRect(vtx, vty, 250, 80);
    ctx.strokeRect(vtx, vty, 250, 80);

    ctx.fillStyle = '#00f2fe';
    ctx.font = 'bold 11px JetBrains Mono';
    ctx.fillText('VELOCITY VECTOR ADDITION', vtx + 10, vty + 18);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px JetBrains Mono';
    ctx.fillText(`Inbound v_inf:  ${p.vInfInKmS} km/s`, vtx + 10, vty + 35);
    ctx.fillText(`Planet v_p:     ${p.orbSpeedKmS} km/s`, vtx + 10, vty + 50);
    ctx.fillText(`Speed Boost:    +${(p.speedAfterKmS - p.speedBeforeKmS).toFixed(1)} km/s`, vtx + 10, vty + 65);
  }

  // Render Golden Record View
  function renderRecordView(w, h) {
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(w, h) * 0.32;

    state.recordRotation += 0.005;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(state.recordRotation);

    // Golden Record Grooved Disk
    const goldGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, r);
    goldGrad.addColorStop(0, '#b45309');
    goldGrad.addColorStop(0.3, '#f59e0b');
    goldGrad.addColorStop(0.7, '#d97706');
    goldGrad.addColorStop(1, '#92400e');

    ctx.fillStyle = goldGrad;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    // Microgroove rings
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    for (let gr = r * 0.35; gr < r * 0.95; gr += 8) {
      ctx.beginPath();
      ctx.arc(0, 0, gr, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Center Spindle Hub
    ctx.fillStyle = '#050811';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d97706';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.06, 0, Math.PI * 2);
    ctx.fill();

    // Pulsar map 14 spokes
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 14; i++) {
      const angle = (i * Math.PI * 2) / 14;
      const len = r * (0.4 + (i % 3) * 0.15);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(angle) * len, Math.sin(angle) * len);
      ctx.stroke();
    }

    ctx.restore();

    // Phonograph tone arm & stylus
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx + r * 1.3, cy - r * 0.8);
    ctx.lineTo(cx + r * 0.6, cy + r * 0.2);
    ctx.stroke();

    ctx.fillStyle = '#ec4899';
    ctx.beginPath();
    ctx.arc(cx + r * 0.6, cy + r * 0.2, 5, 0, Math.PI * 2);
    ctx.fill();

    // Overlay Instructions
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 13px JetBrains Mono';
    ctx.textAlign = 'center';
    ctx.fillText('THE SOUNDS OF EARTH · BACH BRANDENBURG CONCERTO', cx, cy + r + 30);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px JetBrains Mono';
    ctx.fillText('Click audio icon or switch tabs to replay synthesized greetings', cx, cy + r + 48);
    ctx.textAlign = 'left';
  }

  // Render Sandbox Simulator View
  function renderSandboxView(w, h) {
    const cx = w / 2;
    const cy = h / 2;
    const scale = 22; // Scale for sandbox

    // Sun
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.fill();

    // Earth Orbit (1 AU)
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 1.0 * scale, 0, Math.PI * 2);
    ctx.stroke();

    // Jupiter Orbit (5.2 AU)
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 5.2044 * scale, 0, Math.PI * 2);
    ctx.stroke();

    // Compute and draw custom trajectory
    const res = engine.simulateCustomLaunch(state.sandboxInjectDv, state.sandboxAimOffset);
    ctx.strokeStyle = res.success ? '#00f2fe' : '#ef4444';
    ctx.lineWidth = 2.5;
    ctx.beginPath();

    const steps = 150;
    const earthX = cx + 1.0 * scale;
    const earthY = cy;
    ctx.moveTo(earthX, earthY);

    if (!res.success) {
      // Sub-Jupiter ellipse
      const a = (1.0 + res.apoapsisAU) / 2;
      for (let i = 0; i <= steps; i++) {
        const th = (i / steps) * Math.PI;
        const r = (1.0 * res.apoapsisAU) / (1 + 0.4 * Math.cos(th));
        const px = cx + Math.cos(th) * r * scale;
        const py = cy + Math.sin(th) * r * scale;
        ctx.lineTo(px, py);
      }
    } else {
      // Jupiter Encounter and Slingshot
      const jupX = cx + 5.2044 * scale * Math.cos(1.2);
      const jupY = cy + 5.2044 * scale * Math.sin(1.2);
      ctx.quadraticCurveTo(cx + 2.5 * scale, cy + 3.5 * scale, jupX, jupY);
      
      // Slingshot outbound vector
      const outAngle = 1.2 + (state.sandboxAimOffset >= 0 ? 0.8 : -0.8);
      const outDist = res.outcome === 'SOLAR_SYSTEM_ESCAPE' || res.outcome === 'GRAND_TOUR_CORRIDOR' ? 14.0 : 3.0;
      ctx.lineTo(cx + outDist * scale * Math.cos(outAngle), cy + outDist * scale * Math.sin(outAngle));
    }
    ctx.stroke();

    // Jupiter marker
    const jx = cx + 5.2044 * scale * Math.cos(1.2);
    const jy = cy + 5.2044 * scale * Math.sin(1.2);
    ctx.fillStyle = '#e0ae6f';
    ctx.beginPath();
    ctx.arc(jx, jy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '10px JetBrains Mono';
    ctx.fillText('Jupiter Encounter Point', jx + 10, jy);
  }

  // Main Animation / Render Loop
  function render(now) {
    const dt = (now - state.lastFrameTime) / 1000;
    state.lastFrameTime = now;

    if (state.isPlaying) {
      state.currentDay += state.simSpeedDaysPerSec * dt;
      if (state.currentDay > 18000) {
        state.currentDay = 0;
      }
      timeSlider.value = state.currentDay;
      updateTelemetry();
    }

    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    const timeInfo = engine.trajectoryAtDay(state.currentDay);

    // Clear Canvas
    ctx.fillStyle = '#050811';
    ctx.fillRect(0, 0, w, h);

    // Draw background stars
    state.starField.forEach(star => {
      const brightness = star.brightness + Math.sin(now * star.twinkleSpeed + star.phase) * 0.2;
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0.1, brightness)})`;
      ctx.beginPath();
      ctx.arc(w / 2 + star.x, h / 2 + star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    });

    // Render active tab view
    if (state.activeTab === 'macro') {
      renderMacroView(w, h, timeInfo);
    } else if (state.activeTab === 'encounter') {
      renderEncounterView(w, h, timeInfo);
    } else if (state.activeTab === 'record') {
      renderRecordView(w, h);
    } else if (state.activeTab === 'sandbox') {
      renderSandboxView(w, h);
    }

    requestAnimationFrame(render);
  }

  // Initialization
  function init() {
    initStarField();
    resizeCanvas();
    initEvents();
    updateTelemetry();
    updateSandboxOutcome();
    requestAnimationFrame(render);
  }

  // Public API for Playwright headless video rendering & programmatic testing
  window.__demo = {
    setDay: function (d) {
      state.currentDay = d;
      timeSlider.value = d;
      updateTelemetry();
    },
    setTab: function (t) {
      setTab(t);
    },
    setEncounter: function (pKey) {
      setEncounter(pKey);
    },
    setSpeed: function (s) {
      state.simSpeedDaysPerSec = s;
    },
    setPlaying: function (p) {
      state.isPlaying = p;
      playPauseBtn.textContent = p ? '⏸ PAUSE' : '▶ PLAY';
    },
    setSandbox: function (injectDv, aimOffset) {
      state.sandboxInjectDv = injectDv;
      state.sandboxAimOffset = aimOffset;
      inputInjectDv.value = injectDv;
      inputAimOffset.value = aimOffset;
      valInjectDv.textContent = `${injectDv.toFixed(1)} km/s`;
      valAimOffset.textContent = `${aimOffset.toFixed(1)}`;
      updateSandboxOutcome();
    },
    playRecordSound: function () {
      audio.playGoldenRecordMelody();
    },
    getState: function () {
      return {
        day: state.currentDay,
        tab: state.activeTab,
        encounter: state.activeEncounter,
        info: engine.trajectoryAtDay(state.currentDay)
      };
    }
  };

  // Run on DOM load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
