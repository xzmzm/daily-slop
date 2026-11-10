/**
 * Sound Ranging App: UI, Canvas Rendering, Interaction & Audio
 */

(function () {
  'use strict';

  const model = window.SoundRangingModel;
  if (!model) {
    console.error('SoundRangingModel not loaded');
    return;
  }

  // Application State
  const state = {
    preset: 'standard',
    battery: { x: 450, y: 2800 },
    mics: JSON.parse(JSON.stringify(model.PRESETS.standard.mics)),
    tempC: 10,
    windSpeed: 2,
    windDirDeg: 45,
    correctionEnabled: true,
    noiseMs: 0,
    isArmistice: false,

    // Animation & Wavefront
    isAnimating: false,
    waveRadius: 0,
    maxWaveRadius: 5200,
    waveSpeed: 337,
    lastFrameTime: 0,
    pulseTime: 0,
    firedAt: Date.now(),

    // Dragging
    isDraggingBattery: false,
    hoveredItem: null,

    // Audio
    audioEnabled: false,
    audioCtx: null,

    // Calculated solution
    arrivalTimes: [],
    solution: null,
    hyperbolas: []
  };

  // DOM elements
  const mapCanvas = document.getElementById('map-canvas');
  const mapCtx = mapCanvas.getContext('2d');
  const tapeCanvas = document.getElementById('tape-canvas');
  const tapeCtx = tapeCanvas.getContext('2d');

  const correctionToggle = document.getElementById('correction-toggle');
  const tempSlider = document.getElementById('temp-slider');
  const tempVal = document.getElementById('temp-val');
  const windSpeedSlider = document.getElementById('wind-speed-slider');
  const windSpeedVal = document.getElementById('wind-speed-val');
  const windDirSlider = document.getElementById('wind-dir-slider');
  const windDirVal = document.getElementById('wind-dir-val');
  const compassNeedle = document.getElementById('compass-needle');
  const compassText = document.getElementById('compass-text');

  const truePosEl = document.getElementById('true-pos');
  const trueRangeEl = document.getElementById('true-range');
  const fixPosEl = document.getElementById('fix-pos');
  const fixSubEl = document.getElementById('fix-sub');
  const errorDistEl = document.getElementById('error-dist');
  const errorBadgeEl = document.getElementById('error-badge');
  const errorBannerEl = document.getElementById('error-banner');
  const timingTbody = document.getElementById('timing-tbody');
  const tapeStatusEl = document.getElementById('tape-status');

  const fireBtn = document.getElementById('fire-btn');
  const animBtn = document.getElementById('anim-btn');
  const soundBtn = document.getElementById('sound-btn');
  const resetBtn = document.getElementById('reset-btn');
  const presetBtns = document.querySelectorAll('.preset-btn');

  // Map coordinate conversion
  // Map dimensions: X from -2800m to +2800m (width 5600m), Y from -500m to 4100m (height 4600m)
  const mapBounds = {
    minX: -2800,
    maxX: 2800,
    minY: -500,
    maxY: 4100
  };

  function toScreenX(x) {
    return ((x - mapBounds.minX) / (mapBounds.maxX - mapBounds.minX)) * mapCanvas.width;
  }

  function toScreenY(y) {
    // Invert Y so positive Y (enemy territory) points UP on the canvas
    return mapCanvas.height - ((y - mapBounds.minY) / (mapBounds.maxY - mapBounds.minY)) * mapCanvas.height;
  }

  function toWorldX(sx) {
    return mapBounds.minX + (sx / mapCanvas.width) * (mapBounds.maxX - mapBounds.minX);
  }

  function toWorldY(sy) {
    return mapBounds.minY + ((mapCanvas.height - sy) / mapCanvas.height) * (mapBounds.maxY - mapBounds.minY);
  }

  // Audio synthesis: authentic deep muzzle thump (lowpass filtered noise + low sine sweep)
  function initAudio() {
    if (!state.audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        state.audioCtx = new AudioCtx();
      }
    }
    if (state.audioCtx && state.audioCtx.state === 'suspended') {
      state.audioCtx.resume();
    }
  }

  function playMuzzleBlast() {
    if (!state.audioEnabled || !state.audioCtx) return;
    try {
      const ctx = state.audioCtx;
      const now = ctx.currentTime;

      // Low sine burst
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(75, now);
      osc.frequency.exponentialRampToValueAtTime(22, now + 0.35);

      oscGain.gain.setValueAtTime(0.35, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(oscGain);

      // Lowpass noise thump
      const bufferSize = ctx.sampleRate * 0.5;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(90, now);
      filter.frequency.exponentialRampToValueAtTime(30, now + 0.4);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.4, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      noise.connect(filter);
      filter.connect(noiseGain);

      const master = ctx.createGain();
      master.gain.value = 0.4;
      oscGain.connect(master);
      noiseGain.connect(master);
      master.connect(ctx.destination);

      osc.start(now);
      noise.start(now);
      osc.stop(now + 0.5);
      noise.stop(now + 0.5);
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  // Compass text generator
  function compassDirectionText(deg) {
    const dirs = ['E', 'ENE', 'NE', 'NNE', 'N', 'NNW', 'NW', 'WNW', 'W', 'WSW', 'SW', 'SSW', 'S', 'SSE', 'SE', 'ESE'];
    const index = Math.round((deg % 360) / 22.5) % 16;
    return dirs[index];
  }

  // Update physical solution and timing calculations
  function updateSolution() {
    const cTrue = model.soundSpeed(state.tempC);
    state.waveSpeed = cTrue;

    // Wind components
    const rad = (state.windDirDeg * Math.PI) / 180;
    const wx = state.windSpeed * Math.cos(rad);
    const wy = state.windSpeed * Math.sin(rad);

    // Compute ground-truth arrival times at each microphone
    state.arrivalTimes = model.computeArrivalTimes(
      state.battery,
      state.mics,
      state.tempC,
      state.windSpeed,
      state.windDirDeg,
      state.noiseMs
    );

    // Solver configuration:
    // If atmospheric correction is enabled, use true temperature speed & wind vector.
    // If disabled, use uncorrected nominal speed (331.3 m/s at 0°C) and zero wind.
    let cCalc, wxCalc, wyCalc;
    if (state.correctionEnabled) {
      cCalc = cTrue;
      wxCalc = wx;
      wyCalc = wy;
    } else {
      cCalc = 331.3;
      wxCalc = 0;
      wyCalc = 0;
    }

    state.solution = model.solveTDOA(state.mics, state.arrivalTimes, cCalc, wxCalc, wyCalc);

    // Generate hyperbola curves for adjacent pairs
    state.hyperbolas = [];
    const colors = ['#e69f00', '#56b4e9', '#009e73', '#cc79a7'];
    for (let i = 0; i < state.mics.length - 1; i++) {
      const m1 = state.mics[i];
      const m2 = state.mics[i + 1];
      const deltaT = state.arrivalTimes[i + 1] - state.arrivalTimes[i];
      const hyp = model.sampleHyperbola(m1, m2, deltaT, cCalc);
      if (hyp) {
        hyp.color = colors[i % colors.length];
        state.hyperbolas.push(hyp);
      }
    }

    updateUI();
  }

  function updateUI() {
    // Atmospheric badges
    const cTrue = model.soundSpeed(state.tempC);
    tempVal.textContent = `${state.tempC} °C (${cTrue.toFixed(1)} m/s)`;
    windSpeedVal.textContent = `${state.windSpeed} m/s (${(state.windSpeed * 3.6).toFixed(1)} km/h)`;
    const dirTxt = compassDirectionText(state.windDirDeg);
    windDirVal.textContent = `${state.windDirDeg}° (${dirTxt})`;
    compassText.textContent = `Wind: ${state.windSpeed} m/s ${dirTxt}`;
    compassNeedle.style.transform = `rotate(${state.windDirDeg}deg)`;

    // Target readouts
    const dist = Math.hypot(state.battery.x, state.battery.y);
    const bearing = ((Math.atan2(state.battery.x, state.battery.y) * 180) / Math.PI + 360) % 360;
    truePosEl.textContent = `X: ${state.battery.x >= 0 ? '+' : ''}${Math.round(state.battery.x)}m, Y: +${Math.round(state.battery.y)}m`;
    trueRangeEl.textContent = `Range: ${Math.round(dist)}m (${Math.round(bearing).toString().padStart(2, '0')}°)`;

    if (state.solution && state.solution.success) {
      const fixX = Math.round(state.solution.x);
      const fixY = Math.round(state.solution.y);
      fixPosEl.textContent = `X: ${fixX >= 0 ? '+' : ''}${fixX}m, Y: +${fixY}m`;
      fixSubEl.textContent = `Residual RMS: ${(state.solution.residualRms * 1000).toFixed(2)} ms`;

      const err = Math.hypot(state.solution.x - state.battery.x, state.solution.y - state.battery.y);
      errorDistEl.textContent = `${err.toFixed(1)} m`;

      if (err < 15) {
        errorBannerEl.className = 'error-banner';
        errorBadgeEl.className = 'error-status status-good';
        errorBadgeEl.textContent = 'PINPOINT FIX';
      } else {
        errorBannerEl.className = 'error-banner drifted';
        errorBadgeEl.className = 'error-status status-drift';
        errorBadgeEl.textContent = `DRIFT: +${Math.round(err)}m`;
      }
    }

    // Populate timing table
    timingTbody.innerHTML = '';
    const cCalc = state.correctionEnabled ? cTrue : 331.3;
    state.mics.forEach((m, i) => {
      const tr = document.createElement('tr');
      const t = state.arrivalTimes[i];
      let deltaStr = '—';
      let offsetStr = '—';
      let pairStr = '—';
      if (i > 0) {
        const dt = t - state.arrivalTimes[i - 1];
        pairStr = `M${i} → M${i + 1}`;
        deltaStr = `${dt >= 0 ? '+' : ''}${(dt * 1000).toFixed(1)} ms`;
        const dd = dt * cCalc;
        offsetStr = `${dd >= 0 ? '+' : ''}${dd.toFixed(1)} m`;
      }
      tr.innerHTML = `
        <td><strong>${m.name}</strong> (M${i + 1})</td>
        <td>X: ${m.x >= 0 ? '+' : ''}${m.x}m, Y: ${m.y >= 0 ? '+' : ''}${m.y}m</td>
        <td><strong>${t.toFixed(4)} s</strong></td>
        <td>${pairStr}</td>
        <td>${deltaStr}</td>
        <td>${offsetStr}</td>
      `;
      timingTbody.appendChild(tr);
    });

    if (state.isArmistice) {
      tapeStatusEl.textContent = '11 November 1918, 11:00 AM · Hostilities Ceased · All Traces Flat';
      tapeStatusEl.style.color = '#10b981';
    } else {
      tapeStatusEl.textContent = `Battery Discharge Detected · 5 Traces Logged · Range ${Math.round(dist)}m`;
      tapeStatusEl.style.color = '#f59e0b';
    }
  }

  // Draw Tactical Map
  function renderMap() {
    const ctx = mapCtx;
    const w = mapCanvas.width;
    const h = mapCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#0c1117');
    bgGrad.addColorStop(1, '#111822');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Grid lines (every 500m)
    ctx.lineWidth = 1;
    for (let x = -2500; x <= 2500; x += 500) {
      ctx.strokeStyle = x === 0 ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.04)';
      ctx.beginPath();
      ctx.moveTo(toScreenX(x), 0);
      ctx.lineTo(toScreenX(x), h);
      ctx.stroke();
    }
    for (let y = 0; y <= 4000; y += 500) {
      ctx.strokeStyle = y === 0 ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.04)';
      ctx.beginPath();
      ctx.moveTo(0, toScreenY(y));
      ctx.lineTo(w, toScreenY(y));
      ctx.stroke();
    }

    // Range rings from center mic (0, 0)
    [1000, 2000, 3000, 4000].forEach(r => {
      const rx = (r / (mapBounds.maxX - mapBounds.minX)) * w;
      const ry = (r / (mapBounds.maxY - mapBounds.minY)) * h;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.ellipse(toScreenX(0), toScreenY(0), rx, ry, 0, Math.PI, 0, false);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.font = '10px var(--font-mono)';
      ctx.fillText(`${r / 1000} km`, toScreenX(0) + 6, toScreenY(r) + 12);
    });

    // Trenches / Front lines
    // Allied Front (y ~ 300)
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(toScreenX(-2700), toScreenY(250));
    ctx.lineTo(toScreenX(-800), toScreenY(350));
    ctx.lineTo(toScreenX(600), toScreenY(220));
    ctx.lineTo(toScreenX(2700), toScreenY(310));
    ctx.stroke();
    ctx.fillStyle = 'rgba(56, 189, 248, 0.6)';
    ctx.font = '11px var(--font-sans)';
    ctx.fillText('ALLIED FRONT LINE', toScreenX(-2600), toScreenY(340));

    // German Front (y ~ 1200)
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
    ctx.beginPath();
    ctx.moveTo(toScreenX(-2700), toScreenY(1150));
    ctx.lineTo(toScreenX(-400), toScreenY(1300));
    ctx.lineTo(toScreenX(1200), toScreenY(1180));
    ctx.lineTo(toScreenX(2700), toScreenY(1260));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.6)';
    ctx.fillText('GERMAN FRONT LINE (NO MAN’S LAND BETWEEN)', toScreenX(-2600), toScreenY(1380));

    // Acoustic Wavefront Animation
    if (state.waveRadius > 0 && !state.isArmistice) {
      const bx = toScreenX(state.battery.x);
      const by = toScreenY(state.battery.y);
      const scaleX = w / (mapBounds.maxX - mapBounds.minX);
      const scaleY = h / (mapBounds.maxY - mapBounds.minY);

      // Acoustic blast rings
      for (let ring = 0; ring < 3; ring++) {
        const radM = state.waveRadius - ring * 350;
        if (radM > 0) {
          const rX = radM * scaleX;
          const rY = radM * scaleY;
          const alpha = Math.max(0, 0.65 - (radM / state.maxWaveRadius) * 0.6);
          ctx.strokeStyle = `rgba(245, 158, 11, ${alpha})`;
          ctx.lineWidth = ring === 0 ? 3 : 1.5;
          ctx.beginPath();
          ctx.ellipse(bx, by, rX, rY, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    // Draw Hyperbolas
    state.hyperbolas.forEach(hyp => {
      if (!hyp.points || hyp.points.length < 2) return;
      ctx.strokeStyle = hyp.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      hyp.points.forEach((pt, idx) => {
        const sx = toScreenX(pt.x);
        const sy = toScreenY(pt.y);
        if (idx === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.stroke();

      // Hyperbola label near baseline
      const pMid = hyp.points[Math.min(15, hyp.points.length - 1)];
      ctx.fillStyle = hyp.color;
      ctx.font = '10px var(--font-mono)';
      ctx.fillText(`Δd=${hyp.deltaD >= 0 ? '+' : ''}${Math.round(hyp.deltaD)}m`, toScreenX(pMid.x) + 4, toScreenY(pMid.y));
    });

    // Baseline connecting microphones
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    state.mics.forEach((m, idx) => {
      const sx = toScreenX(m.x);
      const sy = toScreenY(m.y);
      if (idx === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    });
    ctx.stroke();

    // Microphones
    state.mics.forEach((m, idx) => {
      const sx = toScreenX(m.x);
      const sy = toScreenY(m.y);

      // Pulse circle if wavefront reached this mic
      const distToBattery = Math.hypot(m.x - state.battery.x, m.y - state.battery.y);
      if (state.waveRadius >= distToBattery && state.waveRadius <= distToBattery + 400 && !state.isArmistice) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx, sy, 16, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Mic post circle
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Center dot
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Label
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 11px var(--font-mono)';
      ctx.fillText(`M${idx + 1}`, sx - 8, sy + 18);
    });

    // Calculated fix
    if (state.solution && state.solution.success) {
      const fx = toScreenX(state.solution.x);
      const fy = toScreenY(state.solution.y);

      // Dashed error line from calculated fix to true battery
      const bx = toScreenX(state.battery.x);
      const by = toScreenY(state.battery.y);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.setLineDash([]);

      // Fix reticle
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(fx, fy, 10, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(fx - 14, fy);
      ctx.lineTo(fx + 14, fy);
      ctx.moveTo(fx, fy - 14);
      ctx.lineTo(fx, fy + 14);
      ctx.stroke();

      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 11px var(--font-mono)';
      ctx.fillText('FIX', fx + 12, fy - 8);
    }

    // True Battery (Draggable)
    const bx = toScreenX(state.battery.x);
    const by = toScreenY(state.battery.y);

    // Target reticle
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(bx, by, 12, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(bx - 18, by);
    ctx.lineTo(bx + 18, by);
    ctx.moveTo(bx, by - 18);
    ctx.lineTo(bx, by + 18);
    ctx.stroke();

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(bx, by, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fca5a5';
    ctx.font = 'bold 12px var(--font-sans)';
    ctx.fillText('GERMAN BATTERY', bx + 16, by + 4);
    ctx.font = '10px var(--font-mono)';
    ctx.fillText(`(${Math.round(state.battery.x)}m, ${Math.round(state.battery.y)}m)`, bx + 16, by + 18);
  }

  // Draw Galvanometer Tape
  function renderTape() {
    const ctx = tapeCtx;
    const w = tapeCanvas.width;
    const h = tapeCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // Cream / photographic paper background
    ctx.fillStyle = '#fdfbf2';
    ctx.fillRect(0, 0, w, h);

    // Vignette / paper edges
    const vGrad = ctx.createLinearGradient(0, 0, 0, h);
    vGrad.addColorStop(0, 'rgba(0,0,0,0.06)');
    vGrad.addColorStop(0.1, 'rgba(0,0,0,0)');
    vGrad.addColorStop(0.9, 'rgba(0,0,0,0)');
    vGrad.addColorStop(1, 'rgba(0,0,0,0.08)');
    ctx.fillStyle = vGrad;
    ctx.fillRect(0, 0, w, h);

    // Time window on tape:
    // Display arrival span: minimum arrival time tMin to tMax + margin
    const minT = Math.min(...state.arrivalTimes);
    const maxT = Math.max(...state.arrivalTimes);
    const tSpan = Math.max(3.0, (maxT - minT) + 1.2);
    const tStart = Math.max(0, minT - 0.4);
    const tEnd = tStart + tSpan;

    function timeToTapeX(t) {
      return 60 + ((t - tStart) / (tEnd - tStart)) * (w - 80);
    }

    // Tuning fork timing lines:
    // 100 Hz timing wheel casts line every 0.05s / 0.1s
    const firstTick = Math.ceil(tStart * 10) / 10;
    for (let t = firstTick; t <= tEnd; t += 0.05) {
      const isMajor = Math.abs(Math.round(t * 10) - t * 10) < 1e-4;
      const tx = timeToTapeX(t);

      ctx.strokeStyle = isMajor ? 'rgba(180, 80, 60, 0.45)' : 'rgba(180, 80, 60, 0.2)';
      ctx.lineWidth = isMajor ? 1.2 : 0.6;
      ctx.beginPath();
      ctx.moveTo(tx, 0);
      ctx.lineTo(tx, h);
      ctx.stroke();

      if (isMajor) {
        ctx.fillStyle = '#8f4233';
        ctx.font = '9px var(--font-mono)';
        ctx.fillText(`${t.toFixed(1)}s`, tx + 2, 12);
      }
    }

    // 5 Horizontal String Galvanometer Traces
    const rowHeight = (h - 24) / 5;
    const inkColor = '#241b14';

    state.mics.forEach((m, idx) => {
      const baseY = 20 + idx * rowHeight + rowHeight / 2;
      const tArr = state.arrivalTimes[idx];
      const arrX = timeToTapeX(tArr);

      // Label on the left
      ctx.fillStyle = '#423326';
      ctx.font = 'bold 11px var(--font-mono)';
      ctx.fillText(`M${idx + 1}`, 16, baseY + 4);

      // Continuous trace line with deflection
      ctx.strokeStyle = inkColor;
      ctx.lineWidth = 1.4;
      ctx.beginPath();

      const numPoints = 800;
      for (let p = 0; p <= numPoints; p++) {
        const x = 50 + (p / numPoints) * (w - 60);
        const t = tStart + ((x - 60) / (w - 80)) * (tEnd - tStart);

        let deflection = 0;
        if (state.isArmistice) {
          // In Armistice mode, past 11:00 AM there are NO deflections!
          deflection = (Math.sin(p * 0.4) * 0.2); // flat micro noise
        } else if (t >= tArr) {
          const dt = t - tArr;
          // Tucker hot-wire cooling & resonant string impulse:
          // Sharp initial deflection, then decaying oscillation at ~14 Hz
          const envelope = Math.exp(-dt * 4.5);
          const oscillation = Math.sin(dt * 2 * Math.PI * 14.0) - Math.cos(dt * 2 * Math.PI * 7.0) * 0.5;
          deflection = -envelope * oscillation * (rowHeight * 0.42);
        } else {
          // Ambient quiet baseline jitter
          deflection = Math.sin(p * 0.3 + idx) * 0.4;
        }

        const y = baseY + deflection;
        if (p === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Arrival marker / caliper line
      if (!state.isArmistice) {
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 2]);
        ctx.beginPath();
        ctx.moveTo(arrX, baseY - rowHeight * 0.45);
        ctx.lineTo(arrX, baseY + rowHeight * 0.45);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#b45309';
        ctx.font = '9px var(--font-mono)';
        ctx.fillText(`t=${tArr.toFixed(3)}s`, arrX + 3, baseY - 6);
      }
    });

    // Time scale label at bottom
    ctx.fillStyle = '#645244';
    ctx.font = '10px var(--font-sans)';
    ctx.fillText('100 Hz TUNING FORK TIME TICK MARKS (0.01s / 0.1s)', 60, h - 5);
  }

  // Animation Loop
  function tick(timestamp) {
    if (!state.lastFrameTime) state.lastFrameTime = timestamp;
    const dt = (timestamp - state.lastFrameTime) / 1000;
    state.lastFrameTime = timestamp;

    if (state.isAnimating && !state.isArmistice) {
      state.waveRadius += state.waveSpeed * dt * 0.75;
      if (state.waveRadius > state.maxWaveRadius) {
        state.waveRadius = 0;
      }
    }

    renderMap();
    renderTape();

    requestAnimationFrame(tick);
  }

  // Fire Battery event
  function fireBattery() {
    state.firedAt = Date.now();
    state.waveRadius = 1;
    state.isAnimating = true;
    animBtn.innerHTML = '<span class="btn-icon">⏸</span> Pause Wave';
    playMuzzleBlast();
    updateSolution();
  }

  // Preset switching
  function loadPreset(key) {
    const p = model.PRESETS[key];
    if (!p) return;

    state.preset = key;
    state.battery = { ...p.battery };
    state.mics = JSON.parse(JSON.stringify(p.mics));
    state.tempC = p.tempC;
    state.windSpeed = p.windSpeed;
    state.windDirDeg = p.windDirDeg;
    state.correctionEnabled = p.correctionEnabled;
    state.isArmistice = (key === 'armistice');

    // Update form elements
    correctionToggle.checked = state.correctionEnabled;
    tempSlider.value = state.tempC;
    windSpeedSlider.value = state.windSpeed;
    windDirSlider.value = state.windDirDeg;

    presetBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.preset === key);
    });

    state.waveRadius = state.isArmistice ? 0 : 1;
    updateSolution();
  }

  // Event Listeners
  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => loadPreset(btn.dataset.preset));
  });

  correctionToggle.addEventListener('change', () => {
    state.correctionEnabled = correctionToggle.checked;
    updateSolution();
  });

  tempSlider.addEventListener('input', () => {
    state.tempC = parseFloat(tempSlider.value);
    updateSolution();
  });

  windSpeedSlider.addEventListener('input', () => {
    state.windSpeed = parseFloat(windSpeedSlider.value);
    updateSolution();
  });

  windDirSlider.addEventListener('input', () => {
    state.windDirDeg = parseFloat(windDirSlider.value);
    updateSolution();
  });

  fireBtn.addEventListener('click', fireBattery);

  animBtn.addEventListener('click', () => {
    state.isAnimating = !state.isAnimating;
    animBtn.innerHTML = state.isAnimating
      ? '<span class="btn-icon">⏸</span> Pause Wave'
      : '<span class="btn-icon">▶</span> Animate Wave';
    if (state.isAnimating && state.waveRadius <= 0) {
      state.waveRadius = 1;
    }
  });

  soundBtn.addEventListener('click', () => {
    initAudio();
    state.audioEnabled = !state.audioEnabled;
    soundBtn.setAttribute('aria-pressed', state.audioEnabled.toString());
    soundBtn.innerHTML = state.audioEnabled
      ? '<span class="btn-icon">🔊</span> Audio: On'
      : '<span class="btn-icon">🔈</span> Audio: Off';
    if (state.audioEnabled) {
      playMuzzleBlast();
    }
  });

  resetBtn.addEventListener('click', () => {
    state.battery = { x: 450, y: 2800 };
    state.waveRadius = 1;
    updateSolution();
  });

  // Map mouse interactions
  mapCanvas.addEventListener('mousedown', e => {
    const rect = mapCanvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (mapCanvas.width / rect.width);
    const sy = (e.clientY - rect.top) * (mapCanvas.height / rect.height);
    const wx = toWorldX(sx);
    const wy = toWorldY(sy);

    // Check if clicked near battery
    const distToBat = Math.hypot(wx - state.battery.x, wy - state.battery.y);
    if (distToBat < 350) {
      state.isDraggingBattery = true;
    } else if (wy > 800) {
      // Reposition battery directly on field click
      state.battery.x = Math.max(mapBounds.minX + 300, Math.min(mapBounds.maxX - 300, wx));
      state.battery.y = Math.max(900, Math.min(mapBounds.maxY - 200, wy));
      state.waveRadius = 1;
      updateSolution();
    }
  });

  window.addEventListener('mousemove', e => {
    if (!state.isDraggingBattery) return;
    const rect = mapCanvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (mapCanvas.width / rect.width);
    const sy = (e.clientY - rect.top) * (mapCanvas.height / rect.height);
    const wx = toWorldX(sx);
    const wy = toWorldY(sy);

    state.battery.x = Math.max(mapBounds.minX + 300, Math.min(mapBounds.maxX - 300, wx));
    state.battery.y = Math.max(900, Math.min(mapBounds.maxY - 200, wy));
    state.waveRadius = 1;
    updateSolution();
  });

  window.addEventListener('mouseup', () => {
    if (state.isDraggingBattery) {
      state.isDraggingBattery = false;
    }
  });

  // Global API for testing & automated video recording
  window.SoundRanging = {
    state,
    model,
    api: {
      loadPreset,
      setBattery: (x, y) => {
        state.battery.x = x;
        state.battery.y = y;
        updateSolution();
      },
      setConditions: (tempC, windSpeed, windDirDeg, correction) => {
        if (tempC !== undefined) state.tempC = tempC;
        if (windSpeed !== undefined) state.windSpeed = windSpeed;
        if (windDirDeg !== undefined) state.windDirDeg = windDirDeg;
        if (correction !== undefined) state.correctionEnabled = correction;
        tempSlider.value = state.tempC;
        windSpeedSlider.value = state.windSpeed;
        windDirSlider.value = state.windDirDeg;
        correctionToggle.checked = state.correctionEnabled;
        updateSolution();
      },
      fire: fireBattery,
      update: updateSolution
    }
  };

  // Initialization
  loadPreset('standard');
  requestAnimationFrame(tick);
})();
