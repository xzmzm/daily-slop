/**
 * 2026-11-12-comet-bounce - Interactive Application Controller
 * Handles 2D canvas visualization, user interaction, telemetry HUD,
 * and CIVA panoramic camera preview.
 */

(function () {
  'use strict';

  // Check model dependency
  if (typeof CometModel === 'undefined') {
    console.error('CometModel is required.');
    return;
  }

  // DOM Elements
  const canvas = document.getElementById('sim-canvas');
  const ctx = canvas.getContext('2d');
  const civaCanvas = document.getElementById('civa-canvas');
  const civaCtx = civaCanvas.getContext('2d');

  // Toolbar & Playback Controls
  const btnPlay = document.getElementById('btn-play');
  const playIcon = document.getElementById('play-icon');
  const playText = document.getElementById('play-text');
  const btnReset = document.getElementById('btn-reset');
  const btnRecenter = document.getElementById('btn-recenter');
  const btnDropMode = document.getElementById('btn-drop-mode');
  const speedButtons = document.querySelectorAll('.btn-speed');
  const timeScrubber = document.getElementById('time-scrubber');

  // HUD & Telemetry
  const hudTime = document.getElementById('hud-time');
  const hudStatus = document.getElementById('hud-status');
  const hudTouches = document.getElementById('hud-touches');
  const valAltitude = document.getElementById('val-altitude');
  const valSpeed = document.getElementById('val-speed');
  const valGravity = document.getElementById('val-gravity');
  const valEscape = document.getElementById('val-escape');
  const valSolarW = document.getElementById('val-solar-w');
  const valBatteryWh = document.getElementById('val-battery-wh');
  const barSolar = document.getElementById('bar-solar');
  const barBattery = document.getElementById('bar-battery');
  const captionSunlight = document.getElementById('caption-sunlight');
  const captionBattery = document.getElementById('caption-battery');
  const civaCaption = document.getElementById('civa-caption');

  // Presets & Hardware Toggles
  const presetButtons = document.querySelectorAll('.preset-btn');
  const checkHarpoons = document.getElementById('check-harpoons');
  const checkThruster = document.getElementById('check-thruster');
  const sliderRestitution = document.getElementById('slider-restitution');
  const sliderFriction = document.getElementById('slider-friction');
  const lblRestitution = document.getElementById('lbl-restitution');
  const lblFriction = document.getElementById('lbl-friction');

  // Simulation State
  let sim = null;
  let isPlaying = false;
  let timeScale = 25;
  let customDropMode = false;
  let currentPreset = 'historical';
  let initialConfig = null;

  // Viewport Camera State (Pan & Zoom)
  const camera = {
    x: 0,
    y: 200,
    zoom: 0.22, // pixels per meter
    isDragging: false,
    dragStart: { x: 0, y: 0 },
    camStart: { x: 0, y: 0 }
  };

  // Pre-generate background stars
  const stars = [];
  for (let i = 0; i < 160; i++) {
    stars.push({
      x: (Math.random() - 0.5) * 5000,
      y: (Math.random() - 0.5) * 5000,
      radius: Math.random() * 1.4 + 0.4,
      alpha: Math.random() * 0.7 + 0.3
    });
  }

  // Active dust outgassing particles in Hapi neck
  const dustParticles = [];
  for (let i = 0; i < 40; i++) {
    dustParticles.push({
      x: 40 + (Math.random() - 0.5) * 160,
      y: 390 + Math.random() * 40,
      vx: (Math.random() - 0.4) * 0.15,
      vy: 0.15 + Math.random() * 0.35,
      life: Math.random(),
      maxLife: 3 + Math.random() * 4
    });
  }

  /**
   * Initializes simulation with preset
   */
  function initSimulation(presetKey = 'historical') {
    currentPreset = presetKey;
    const presets = CometModel.Simulation.getPresets();
    const config = presets[presetKey] ? presets[presetKey].config : presets.historical.config;

    initialConfig = { ...config };
    sim = new CometModel.Simulation(initialConfig);

    // Sync UI controls with config
    checkHarpoons.checked = sim.harpoonsEnabled;
    checkThruster.checked = sim.thrusterEnabled;
    sliderRestitution.value = sim.restitution;
    sliderFriction.value = sim.friction;
    lblRestitution.textContent = Number(sim.restitution).toFixed(2);
    lblFriction.textContent = Number(sim.friction).toFixed(2);

    // Update preset active class
    presetButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.preset === presetKey);
    });

    timeScrubber.value = 0;
    updateTelemetryUI();
    renderCIVA();
  }

  /**
   * World to Canvas Coordinate Transformation
   */
  function worldToCanvas(wx, wy) {
    const cx = canvas.width / 2 + (wx - camera.x) * camera.zoom;
    const cy = canvas.height / 2 - (wy - camera.y) * camera.zoom; // Invert Y
    return { x: cx, y: cy };
  }

  function canvasToWorld(cx, cy) {
    const wx = (cx - canvas.width / 2) / camera.zoom + camera.x;
    const wy = -(cy - canvas.height / 2) / camera.zoom + camera.y;
    return { x: wx, y: wy };
  }

  // Pointer positions must use canvas backing pixels, not CSS pixels.
  function pointerToCanvas(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * canvas.width / rect.width,
      y: (event.clientY - rect.top) * canvas.height / rect.height
    };
  }

  function formatSimTime(seconds) {
    const total = Math.floor(seconds);
    const h = Math.floor(total / 3600);
    const m = Math.floor(total % 3600 / 60);
    const s = total % 60;
    return `T+${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  /**
   * Updates Telemetry HUD & Status Cards
   */
  function updateTelemetryUI() {
    if (!sim) return;

    hudTime.textContent = formatSimTime(sim.time);

    let statusText = sim.status.toUpperCase();
    hudStatus.textContent = statusText;
    hudStatus.className = 'hud-value status-badge';
    if (sim.status === 'anchored') {
      hudStatus.classList.add('anchored');
      hudStatus.textContent = 'ANCHORED (TOY)' ;
    } else if (sim.status === 'settled') {
      hudStatus.textContent = 'RESTING (TOY)' ;
    } else if (sim.status === 'escaped') {
      hudStatus.classList.add('escaped');
      hudStatus.textContent = 'ESCAPE FLAG (TOY)';
    } else if (sim.status === 'bounced') {
      hudStatus.textContent = 'IN REBOUND ARC';
    }

    hudTouches.textContent = sim.touchdowns.length;
    timeScrubber.value = Math.min(7200, Math.floor(sim.time));

    // Telemetry numerical values
    const currentAlt = sim.getAltitude(sim.x, sim.y);
    valAltitude.innerHTML = `${Math.max(0, Math.round(currentAlt))} <span class="unit">m</span>`;

    const speed = Math.hypot(sim.vx, sim.vy);
    valSpeed.innerHTML = `${speed.toFixed(2)} <span class="unit">m/s</span>`;

    const g = CometModel.getGravity(sim.x, sim.y);
    valGravity.innerHTML = `${Math.round(g.mag * 1e6)} <span class="unit">μm/s²</span>`;

    const vEsc = CometModel.getEscapeSpeed(sim.x, sim.y);
    valEscape.innerHTML = `${vEsc.toFixed(2)} <span class="unit">m/s</span>`;

    // Solar Power & Battery Gauges
    valSolarW.textContent = `${sim.solarPowerW.toFixed(1)} W`;
    const solarPercent = Math.min(100, Math.max(0, (sim.solarPowerW / 32.0) * 100));
    barSolar.style.width = `${solarPercent}%`;

    if (sim.isShadowed) {
      captionSunlight.textContent = 'Terrain shadow (2D toy)';
      captionSunlight.style.color = 'var(--accent-amber)';
      barSolar.style.backgroundColor = '#94a3b8';
    } else {
      captionSunlight.textContent = 'Direct Sunlight (Nominal Illumination)';
      captionSunlight.style.color = 'var(--text-dim)';
      barSolar.style.backgroundColor = 'var(--accent-amber)';
    }

    valBatteryWh.textContent = `${sim.batteryWh.toFixed(1)} Wh`;
    barBattery.style.width = `${sim.batteryWh}%`;
    const netW = sim.solarPowerW - 18;
    barBattery.style.backgroundColor = sim.batteryWh < 20 ? 'var(--accent-rose)' : 'var(--accent-sky)';
    captionBattery.textContent = netW < 0
      ? `Toy reserve: ${(-netW).toFixed(1)} W net drain (~${(sim.batteryWh / -netW).toFixed(1)} h at current input)`
      : `Toy rechargeable reserve: ${netW.toFixed(1)} W surplus${sim.batteryWh >= 100 ? ' (full)' : ' (charging)'}`;

  }

  /**
   * Renders the CIVA-P panoramic camera view
   */
  function renderCIVA() {
    const w = civaCanvas.width;
    const h = civaCanvas.height;
    civaCtx.clearRect(0, 0, w, h);

    // Deep space backdrop
    civaCtx.fillStyle = '#010307';
    civaCtx.fillRect(0, 0, w, h);

    if (sim.status === 'settled' && sim.isShadowed) {
      // Illustrative shadowed terrain, not a reconstruction of Abydos:
      // Dark looming jagged rock wall on the left/center
      civaCtx.fillStyle = '#1e293b';
      civaCtx.beginPath();
      civaCtx.moveTo(0, 0);
      civaCtx.lineTo(w * 0.65, 0);
      civaCtx.lineTo(w * 0.58, h * 0.25);
      civaCtx.lineTo(w * 0.72, h * 0.45);
      civaCtx.lineTo(w * 0.60, h * 0.75);
      civaCtx.lineTo(w * 0.85, h);
      civaCtx.lineTo(0, h);
      civaCtx.closePath();
      civaCtx.fill();

      // Rock texture & ridges
      civaCtx.strokeStyle = '#334155';
      civaCtx.lineWidth = 1.5;
      civaCtx.beginPath();
      civaCtx.moveTo(w * 0.1, h * 0.2);
      civaCtx.lineTo(w * 0.35, h * 0.35);
      civaCtx.lineTo(w * 0.25, h * 0.7);
      civaCtx.stroke();

      // Specular sun rim highlight at top edge of cliff
      civaCtx.strokeStyle = 'rgba(248, 250, 252, 0.7)';
      civaCtx.lineWidth = 2;
      civaCtx.beginPath();
      civaCtx.moveTo(w * 0.55, 0);
      civaCtx.lineTo(w * 0.58, h * 0.25);
      civaCtx.lineTo(w * 0.72, h * 0.45);
      civaCtx.stroke();

      // Distant stars in the open space wedge (right side)
      civaCtx.fillStyle = '#e2e8f0';
      civaCtx.fillRect(w * 0.82, h * 0.15, 1.5, 1.5);
      civaCtx.fillRect(w * 0.92, h * 0.30, 2, 2);
      civaCtx.fillRect(w * 0.78, h * 0.65, 1.5, 1.5);

      // Philae's tilted landing gear leg pointing into space!
      civaCtx.save();
      civaCtx.translate(w * 0.45, h * 0.85);
      civaCtx.rotate(-Math.PI / 5);

      // Strut
      civaCtx.strokeStyle = '#94a3b8';
      civaCtx.lineWidth = 3.5;
      civaCtx.beginPath();
      civaCtx.moveTo(0, 0);
      civaCtx.lineTo(12, -75);
      civaCtx.stroke();

      // Footpad & ice screw
      civaCtx.fillStyle = '#cbd5e1';
      civaCtx.beginPath();
      civaCtx.arc(12, -75, 7, 0, Math.PI * 2);
      civaCtx.fill();

      civaCtx.strokeStyle = '#38bdf8';
      civaCtx.lineWidth = 2;
      civaCtx.beginPath();
      civaCtx.moveTo(12, -75);
      civaCtx.lineTo(16, -86);
      civaCtx.stroke();

      civaCtx.restore();

      civaCaption.textContent = 'Illustrative shadowed resting view; not a real camera image or mapped landing site.';
    } else if (sim.status === 'anchored' || sim.status === 'settled') {
      // Nominal Agilkia view: flat, open, bright landscape
      civaCtx.fillStyle = '#334155';
      civaCtx.beginPath();
      civaCtx.moveTo(0, h * 0.6);
      civaCtx.lineTo(w * 0.3, h * 0.55);
      civaCtx.lineTo(w * 0.7, h * 0.62);
      civaCtx.lineTo(w, h * 0.58);
      civaCtx.lineTo(w, h);
      civaCtx.lineTo(0, h);
      civaCtx.closePath();
      civaCtx.fill();

      // Footpad latched into surface
      civaCtx.fillStyle = '#10b981';
      civaCtx.fillRect(w * 0.45, h * 0.75, 24, 6);
      civaCtx.strokeStyle = '#10b981';
      civaCtx.lineWidth = 2;
      civaCtx.strokeRect(w * 0.45, h * 0.75, 24, 6);

      civaCaption.textContent = 'Illustrative surface view; the toy does not reconstruct camera orientation or local terrain.';
    } else {
      // In flight / descent: comet horizon curved below
      civaCtx.fillStyle = '#1e293b';
      civaCtx.beginPath();
      civaCtx.arc(w / 2, h * 1.5, w * 0.8, Math.PI, 0);
      civaCtx.fill();

      civaCaption.textContent = sim.status === 'escaped' ? 'Illustrative view: toy comet-escape flag; not interstellar escape.' : 'Illustrative in-flight view, not CIVA/ROLIS telemetry.';
    }
  }

  /**
   * Main Render Loop
   */
  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Draw Starfield
    ctx.fillStyle = '#ffffff';
    for (const s of stars) {
      const sp = worldToCanvas(s.x, s.y);
      if (sp.x >= 0 && sp.x <= canvas.width && sp.y >= 0 && sp.y <= canvas.height) {
        ctx.globalAlpha = s.alpha;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, s.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1.0;

    // 2. Draw Sun Illumination Indicator & Rays
    const sunVec = CometModel.getSunVector(sim.time);
    const sunScreen = worldToCanvas(sunVec.x * 2400, sunVec.y * 2400);

    // Subtle sun direction rays
    const gradSun = ctx.createLinearGradient(
      sunScreen.x, sunScreen.y,
      canvas.width / 2, canvas.height / 2
    );
    gradSun.addColorStop(0, 'rgba(245, 158, 11, 0.15)');
    gradSun.addColorStop(1, 'rgba(245, 158, 11, 0.0)');
    ctx.fillStyle = gradSun;
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, 800, 0, Math.PI * 2);
    ctx.fill();

    // 3. Draw Active Dust Outgassing in Hapi Neck
    ctx.fillStyle = 'rgba(148, 163, 184, 0.35)';
    for (const p of dustParticles) {
      const pp = worldToCanvas(p.x, p.y);
      ctx.beginPath();
      ctx.arc(pp.x, pp.y, 2.0 * camera.zoom * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Draw Comet 67P Contact Binary
    const poly = CometModel.COMET_POLYGON;
    if (poly.length > 0) {
      // A. Shadow side / base comet fill
      ctx.beginPath();
      const p0 = worldToCanvas(poly[0].x, poly[0].y);
      ctx.moveTo(p0.x, p0.y);
      for (let i = 1; i < poly.length; i++) {
        const pt = worldToCanvas(poly[i].x, poly[i].y);
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.closePath();

      // Realistic basalt/organic dark gradient
      const cCenter = worldToCanvas(-100, 100);
      const gradComet = ctx.createRadialGradient(
        cCenter.x, cCenter.y, 100 * camera.zoom,
        cCenter.x, cCenter.y, 1800 * camera.zoom
      );
      gradComet.addColorStop(0, '#334155');
      gradComet.addColorStop(0.5, '#1e293b');
      gradComet.addColorStop(1, '#0f172a');
      ctx.fillStyle = gradComet;
      ctx.fill();

      // B. Illuminated terrain edge highlighting
      ctx.lineWidth = Math.max(1.5, 2.5 * camera.zoom);
      for (let i = 0; i < poly.length; i++) {
        const j = (i + 1) % poly.length;
        const ptA = poly[i];
        const ptB = poly[j];

        // Edge normal
        const ex = ptB.x - ptA.x;
        const ey = ptB.y - ptA.y;
        let nx = ey;
        let ny = -ex;
        const nlen = Math.hypot(nx, ny);
        if (nlen > 0) { nx /= nlen; ny /= nlen; }
        if (ptA.x * nx + ptA.y * ny < 0) { nx = -nx; ny = -ny; }

        // Dot product with sun vector
        const dotSun = nx * sunVec.x + ny * sunVec.y;
        const cA = worldToCanvas(ptA.x, ptA.y);
        const cB = worldToCanvas(ptB.x, ptB.y);

        ctx.beginPath();
        ctx.moveTo(cA.x, cA.y);
        ctx.lineTo(cB.x, cB.y);

        if (dotSun > 0.05) {
          // Illuminated by sun: bright golden/white rim
          ctx.strokeStyle = `rgba(254, 240, 138, ${Math.min(1.0, dotSun * 0.95 + 0.1)})`;
        } else {
          // Shadowed side: dark slate
          ctx.strokeStyle = 'rgba(71, 85, 105, 0.4)';
        }
        ctx.stroke();
      }

      // C. Geological Landmark Markers
      for (const [key, lm] of Object.entries(CometModel.LANDMARKS)) {
        const lp = worldToCanvas(lm.x, lm.y);
        ctx.fillStyle = key === 'agilkia' ? '#f59e0b' : (key === 'abydos' ? '#38bdf8' : '#94a3b8');
        ctx.beginPath();
        ctx.arc(lp.x, lp.y, 4, 0, Math.PI * 2);
        ctx.fill();

        // Label
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '10px ui-monospace, SFMono-Regular, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(lm.name, lp.x, lp.y - 8);
      }
    }

    // 5. Draw Flight Trajectory Trail
    if (sim.trajectory.length > 1) {
      ctx.lineWidth = 2.0;
      for (let i = 1; i < sim.trajectory.length; i++) {
        const pPrev = worldToCanvas(sim.trajectory[i - 1].x, sim.trajectory[i - 1].y);
        const pCurr = worldToCanvas(sim.trajectory[i].x, sim.trajectory[i].y);

        // Velocity color gradient
        const spd = sim.trajectory[i].speed;
        let strokeColor = '#38bdf8';
        if (spd > 0.7) strokeColor = '#f43f5e'; // High speed
        else if (spd > 0.35) strokeColor = '#f59e0b'; // Moderate speed
        else strokeColor = '#a855f7'; // Coasting near apogee

        ctx.strokeStyle = strokeColor;
        ctx.beginPath();
        ctx.moveTo(pPrev.x, pPrev.y);
        ctx.lineTo(pCurr.x, pCurr.y);
        ctx.stroke();
      }
    }

    // 6. Draw Touchdown Markers (Starbursts)
    for (const td of sim.touchdowns) {
      const tdp = worldToCanvas(td.x, td.y);
      ctx.save();
      ctx.translate(tdp.x, tdp.y);

      // Starburst rays
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-7, 0); ctx.lineTo(7, 0);
      ctx.moveTo(0, -7); ctx.lineTo(0, 7);
      ctx.moveTo(-5, -5); ctx.lineTo(5, 5);
      ctx.moveTo(-5, 5); ctx.lineTo(5, -5);
      ctx.stroke();

      // Center ring
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();

      // Touchdown number badge
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText(`T${td.number}`, 9, -5);
      ctx.restore();
    }

    // 7. Draw Philae Lander Sprite
    const landerPos = worldToCanvas(sim.x, sim.y);
    ctx.save();
    ctx.translate(landerPos.x, landerPos.y);
    ctx.rotate(-sim.attitudeRad);

    const landerScale = Math.max(0.65, Math.min(1.4, camera.zoom * 2.8));
    ctx.scale(landerScale, landerScale);

    // Cold-gas Thruster plume if active
    if (sim.thrusterEnabled && sim.status === 'descending') {
      ctx.fillStyle = 'rgba(56, 189, 248, 0.8)';
      ctx.beginPath();
      ctx.moveTo(-4, -12);
      ctx.lineTo(4, -12);
      ctx.lineTo(0, -26 - Math.random() * 8);
      ctx.closePath();
      ctx.fill();
    }

    // Lander main cube body
    ctx.fillStyle = '#0284c7';
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 1.5;
    ctx.fillRect(-8, -8, 16, 16);
    ctx.strokeRect(-8, -8, 16, 16);

    // Solar panel array cross
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(-12, -2, 4, 4);
    ctx.fillRect(8, -2, 4, 4);
    ctx.fillRect(-2, -12, 4, 4);
    ctx.fillRect(-2, 8, 4, 4);

    // Tripod Landing Gear
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2.0;

    // Leg 1 (Left)
    ctx.beginPath();
    ctx.moveTo(-6, 8);
    ctx.lineTo(-14, 18);
    ctx.stroke();
    // Leg 2 (Right)
    ctx.beginPath();
    ctx.moveTo(6, 8);
    ctx.lineTo(14, 18);
    ctx.stroke();
    // Leg 3 (Center)
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.lineTo(0, 20);
    ctx.stroke();

    // Footpads
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.arc(-14, 18, 2.5, 0, Math.PI * 2);
    ctx.arc(14, 18, 2.5, 0, Math.PI * 2);
    ctx.arc(0, 20, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Anchoring harpoon cables if latched
    if (sim.harpoonsEnabled && sim.status === 'anchored') {
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-14, 18); ctx.lineTo(-18, 28);
      ctx.moveTo(14, 18); ctx.lineTo(18, 28);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Animation & Update Step
   */
  let lastFrameTime = performance.now();
  function loop(now) {
    const deltaMs = Math.min(100, now - lastFrameTime);
    lastFrameTime = now;

    if (isPlaying && sim) {
      // Advance physics simulation by timeScale seconds
      const stepsToTake = Math.max(1, Math.round(timeScale * (deltaMs / 1000) * 10));
      const dtPerStep = (timeScale * (deltaMs / 1000)) / stepsToTake;

      for (let s = 0; s < stepsToTake; s++) {
        sim.step(dtPerStep);
      }

      // Update dust particles
      for (const p of dustParticles) {
        p.x += p.vx;
        p.y += p.vy;
        p.life += 0.02;
        if (p.life > p.maxLife) {
          p.x = 40 + (Math.random() - 0.5) * 160;
          p.y = 390 + Math.random() * 40;
          p.life = 0;
        }
      }

      updateTelemetryUI();
      renderCIVA();
    }

    render();
    requestAnimationFrame(loop);
  }

  /**
   * Event Listeners & User Interaction
   */

  // Play / Pause
  btnPlay.addEventListener('click', () => {
    isPlaying = !isPlaying;
    playIcon.textContent = isPlaying ? '⏸' : '▶';
    playText.textContent = isPlaying ? 'Pause' : 'Play';
  });

  // Reset
  btnReset.addEventListener('click', () => {
    sim.reset(initialConfig);
    updateTelemetryUI();
    renderCIVA();
    isPlaying = false;
    playIcon.textContent = '▶';
    playText.textContent = 'Play';
  });

  // Recenter Camera
  btnRecenter.addEventListener('click', () => {
    if (sim) {
      camera.x = sim.x;
      camera.y = sim.y;
      camera.zoom = 0.25;
    }
  });

  // Speed selector
  speedButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      speedButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      timeScale = parseInt(btn.dataset.speed, 10);
    });
  });

  // Scrubber input
  timeScrubber.addEventListener('input', (e) => {
    const targetTime = parseInt(e.target.value, 10);
    // Rewind / fast-forward simulation to targetTime
    // Rebuild from the same launch, retaining current hardware/slider choices.
    sim.reset({ ...initialConfig,
      harpoonsEnabled: checkHarpoons.checked,
      thrusterEnabled: checkThruster.checked,
      restitution: parseFloat(sliderRestitution.value),
      friction: parseFloat(sliderFriction.value)
    });
    if (targetTime > 0) {
      const dt = 1.0;
      const count = Math.floor(targetTime / dt);
      for (let i = 0; i < count; i++) {
        sim.step(dt);
      }
    }
    updateTelemetryUI();
    renderCIVA();
  });

  // Presets
  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset;
      initSimulation(preset);
      isPlaying = false;
      playIcon.textContent = '▶';
      playText.textContent = 'Play';
    });
  });

  // Subsystem Toggles
  checkHarpoons.addEventListener('change', (e) => {
    if (sim) sim.harpoonsEnabled = e.target.checked;
  });

  checkThruster.addEventListener('change', (e) => {
    if (sim) sim.thrusterEnabled = e.target.checked;
  });

  // Sliders
  sliderRestitution.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    lblRestitution.textContent = val.toFixed(2);
    if (sim) sim.restitution = val;
  });

  sliderFriction.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    lblFriction.textContent = val.toFixed(2);
    if (sim) sim.friction = val;
  });

  // Custom Drop Mode
  btnDropMode.addEventListener('click', () => {
    customDropMode = !customDropMode;
    btnDropMode.classList.toggle('active', customDropMode);
  });

  // Canvas Mouse Drag (Pan) & Custom Drop
  canvas.addEventListener('mousedown', (e) => {
    const pointer = pointerToCanvas(e);

    if (customDropMode) {
      // Launch a custom lander from click point
      const worldPos = canvasToWorld(pointer.x, pointer.y);
      // Aim velocity toward comet center with speed ~1.0 m/s
      const dx = -worldPos.x;
      const dy = 200 - worldPos.y;
      const dist = Math.hypot(dx, dy);
      const speed = 1.0;
      const vx = dist > 0 ? (dx / dist) * speed : 0;
      const vy = dist > 0 ? (dy / dist) * speed : -speed;

      initialConfig = {
        preset: 'custom',
        harpoonsEnabled: checkHarpoons.checked,
        thrusterEnabled: checkThruster.checked,
        restitution: parseFloat(sliderRestitution.value),
        friction: parseFloat(sliderFriction.value),
        x: worldPos.x,
        y: worldPos.y,
        vx,
        vy
      };
      currentPreset = 'custom';
      presetButtons.forEach(btn => btn.classList.remove('active'));
      sim.reset(initialConfig);
      isPlaying = true;
      playIcon.textContent = '⏸';
      playText.textContent = 'Pause';
      updateTelemetryUI();
      renderCIVA();
      return;
    }

    camera.isDragging = true;
    camera.dragStart = pointer;
    camera.camStart = { x: camera.x, y: camera.y };
  });

  window.addEventListener('mousemove', (e) => {
    if (camera.isDragging) {
      const pointer = pointerToCanvas(e);
      const dx = (pointer.x - camera.dragStart.x) / camera.zoom;
      const dy = (pointer.y - camera.dragStart.y) / camera.zoom;
      camera.x = camera.camStart.x - dx;
      camera.y = camera.camStart.y + dy; // invert Y
    }
  });

  window.addEventListener('mouseup', () => {
    camera.isDragging = false;
  });

  // Canvas Scroll (Zoom)
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.85;
    camera.zoom = Math.max(0.06, Math.min(1.6, camera.zoom * factor));
  }, { passive: false });

  // Expose global controller for tests & video recording
  window.CometApp = {
    getSim: () => sim,
    initSimulation,
    play: () => {
      isPlaying = true;
      playIcon.textContent = '⏸';
      playText.textContent = 'Pause';
    },
    pause: () => {
      isPlaying = false;
      playIcon.textContent = '▶';
      playText.textContent = 'Play';
    },
    setSpeed: (spd) => {
      timeScale = spd;
    },
    step: (dt) => {
      if (sim) {
        const subSteps = Math.max(1, Math.ceil(Math.abs(dt)));
        const d = dt / subSteps;
        for (let i = 0; i < subSteps; i++) {
          sim.step(d);
        }
        updateTelemetryUI();
        renderCIVA();
      }
    }
  };

  // Initial startup
  initSimulation('historical');
  requestAnimationFrame(loop);
})();
