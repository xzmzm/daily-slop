/**
 * 1839 Daguerreotype Studio Application
 * World Photography Day Interactive Simulation (19 August 1839)
 */

(function() {
  // DOM Elements
  const state = {
    currentTab: "workshop", // "workshop" | "inspector" | "dossier"
    step: 1, // 1: Polish, 2: Sensitize, 3: Expose, 4: Mercury, 5: Fix/Gild, 6: View
    
    // Step 1: Polish
    polishProgress: 0, // 0 to 100%
    polishQuality: 1.0, // decreases with circular strokes
    isBuffing: false,
    
    // Step 2: Sensitize (Iodine)
    sensitizeThicknessNm: 0,
    isSensitizing: false,
    sensitizeInterval: null,
    
    // Step 3: Camera & Exposure
    selectedScene: "boulevard",
    weather: "sun", // "sun", "hazy", "overcast"
    aperture: 14.0,
    exposureTimeSec: 0,
    targetExposureSec: 240,
    isExposing: false,
    neckClampOn: true,
    exposureEnergy: 0,
    
    // Step 4: Mercury Development
    mercuryTempC: 65.0,
    mercuryTimeSec: 0,
    isFuming: false,
    fumingInterval: null,
    lampLit: true,
    
    // Step 5: Fix & Gold Tone
    isFixed: false,
    isGoldToned: false,
    
    // Inspection & Tilt
    tiltAngleX: 0, // -30 to +30 deg
    tiltAngleY: 0, // -30 to +30 deg
    lightSourceAngle: 28, // deg where specular glare strikes
    ambientLux: 350,
    loupeActive: false,
    loupeX: 0.5,
    loupeY: 0.5,
    
    // Saved Plates
    gallery: []
  };

  // Canvas contexts
  let polishCanvas, polishCtx;
  let sensitizeCanvas, sensitizeCtx;
  let cameraCanvas, cameraCtx;
  let groundGlassCanvas, groundGlassCtx;
  let mercuryCanvas, mercuryCtx;
  let inspectCanvas, inspectCtx;
  let loupeCanvas, loupeCtx;

  // Offscreen pre-rendered layers for fast high-quality simulation
  let offscreenSceneCanvas, offscreenSceneCtx;
  let offscreenPlateCanvas, offscreenPlateCtx;

  window.addEventListener("DOMContentLoaded", () => {
    initCanvases();
    initUI();
    initAudioControls();
    loadDefaultPlate();
    requestAnimationFrame(renderLoop);
  });

  function initCanvases() {
    polishCanvas = document.getElementById("polishCanvas");
    polishCtx = polishCanvas ? polishCanvas.getContext("2d") : null;

    sensitizeCanvas = document.getElementById("sensitizeCanvas");
    sensitizeCtx = sensitizeCanvas ? sensitizeCanvas.getContext("2d") : null;

    cameraCanvas = document.getElementById("cameraCanvas");
    cameraCtx = cameraCanvas ? cameraCanvas.getContext("2d") : null;

    groundGlassCanvas = document.getElementById("groundGlassCanvas");
    groundGlassCtx = groundGlassCanvas ? groundGlassCanvas.getContext("2d") : null;

    mercuryCanvas = document.getElementById("mercuryCanvas");
    mercuryCtx = mercuryCanvas ? mercuryCanvas.getContext("2d") : null;

    inspectCanvas = document.getElementById("inspectCanvas");
    inspectCtx = inspectCanvas ? inspectCanvas.getContext("2d") : null;

    loupeCanvas = document.getElementById("loupeCanvas");
    loupeCtx = loupeCanvas ? loupeCanvas.getContext("2d") : null;

    offscreenSceneCanvas = document.createElement("canvas");
    offscreenSceneCanvas.width = 640;
    offscreenSceneCanvas.height = 480;
    offscreenSceneCtx = offscreenSceneCanvas.getContext("2d");

    offscreenPlateCanvas = document.createElement("canvas");
    offscreenPlateCanvas.width = 640;
    offscreenPlateCanvas.height = 480;
    offscreenPlateCtx = offscreenPlateCanvas.getContext("2d");
  }

  function initUI() {
    // Tab switching
    document.querySelectorAll(".tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.tab;
        switchTab(tab);
      });
    });

    // Step switching in Workshop
    document.querySelectorAll(".step-nav-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const stepNum = parseInt(btn.dataset.step, 10);
        goToStep(stepNum);
      });
    });

    // Step 1: Polish actions
    const polishArea = document.getElementById("polishArea");
    if (polishArea) {
      let lastX = 0, lastY = 0;
      const onMove = (e) => {
        if (!state.isBuffing) return;
        const rect = polishArea.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        const dx = x - lastX;
        const dy = y - lastY;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        if (dist > 3) {
          state.polishProgress = Math.min(100, state.polishProgress + dist * 0.12);
          // Check parallelism: horizontal buffing strokes are best
          const angle = Math.abs(Math.atan2(dy, dx));
          if (angle > 0.6) {
            state.polishQuality = Math.max(0.7, state.polishQuality - 0.001);
          }
          if (Math.random() < 0.25) DaguerreAudio.playBuff();
          lastX = x;
          lastY = y;
          updatePolishUI();
        }
      };

      polishArea.addEventListener("mousedown", (e) => {
        state.isBuffing = true;
        lastX = e.offsetX;
        lastY = e.offsetY;
      });
      window.addEventListener("mouseup", () => { state.isBuffing = false; });
      polishArea.addEventListener("mousemove", onMove);

      polishArea.addEventListener("touchstart", (e) => {
        state.isBuffing = true;
        const rect = polishArea.getBoundingClientRect();
        lastX = e.touches[0].clientX - rect.left;
        lastY = e.touches[0].clientY - rect.top;
      }, { passive: true });
      window.addEventListener("touchend", () => { state.isBuffing = false; });
      polishArea.addEventListener("touchmove", onMove, { passive: true });
    }

    const autoPolishBtn = document.getElementById("autoPolishBtn");
    if (autoPolishBtn) {
      autoPolishBtn.addEventListener("click", () => {
        state.polishProgress = 100;
        state.polishQuality = 1.0;
        DaguerreAudio.playBuff();
        updatePolishUI();
      });
    }

    // Step 2: Sensitizing actions
    const sensitizeSlider = document.getElementById("sensitizeSlider");
    if (sensitizeSlider) {
      sensitizeSlider.addEventListener("input", (e) => {
        state.sensitizeThicknessNm = parseFloat(e.target.value);
        updateSensitizeUI();
      });
    }

    const toggleFumingBtn = document.getElementById("toggleFumingBtn");
    if (toggleFumingBtn) {
      toggleFumingBtn.addEventListener("click", () => {
        state.isSensitizing = !state.isSensitizing;
        if (state.isSensitizing) {
          DaguerreAudio.playBoxSlide();
          toggleFumingBtn.textContent = "Close Fuming Box (Stop)";
          toggleFumingBtn.classList.add("btn-active");
          state.sensitizeInterval = setInterval(() => {
            if (state.sensitizeThicknessNm < 140) {
              state.sensitizeThicknessNm += 0.8;
              if (sensitizeSlider) sensitizeSlider.value = state.sensitizeThicknessNm;
              updateSensitizeUI();
            }
          }, 50);
        } else {
          DaguerreAudio.playBoxSlide();
          toggleFumingBtn.textContent = "Open Iodine Box (Fume)";
          toggleFumingBtn.classList.remove("btn-active");
          clearInterval(state.sensitizeInterval);
        }
      });
    }

    const optimalSensitizeBtn = document.getElementById("optimalSensitizeBtn");
    if (optimalSensitizeBtn) {
      optimalSensitizeBtn.addEventListener("click", () => {
        state.sensitizeThicknessNm = DaguerreEngine.OPTIMAL_AGI_THICKNESS_NM;
        if (sensitizeSlider) sensitizeSlider.value = state.sensitizeThicknessNm;
        DaguerreAudio.playBoxSlide();
        updateSensitizeUI();
      });
    }

    // Step 3: Exposure Controls
    const sceneSelect = document.getElementById("sceneSelect");
    if (sceneSelect) {
      sceneSelect.addEventListener("change", (e) => {
        state.selectedScene = e.target.value;
        const sc = DaguerreEngine.SCENES[state.selectedScene];
        if (sc) {
          state.targetExposureSec = sc.recommendedTimeSec;
          const expTimeInput = document.getElementById("targetExposureSec");
          if (expTimeInput) expTimeInput.value = state.targetExposureSec;
          state.aperture = sc.fNumber;
          const apInput = document.getElementById("apertureSelect");
          if (apInput) apInput.value = sc.fNumber;
        }
        updateSceneDetails();
      });
    }

    const neckClampToggle = document.getElementById("neckClampToggle");
    if (neckClampToggle) {
      neckClampToggle.addEventListener("change", (e) => {
        state.neckClampOn = e.target.checked;
      });
    }

    const weatherSelect = document.getElementById("weatherSelect");
    if (weatherSelect) {
      weatherSelect.addEventListener("change", (e) => {
        state.weather = e.target.value;
      });
    }

    const apertureSelect = document.getElementById("apertureSelect");
    if (apertureSelect) {
      apertureSelect.addEventListener("change", (e) => {
        state.aperture = parseFloat(e.target.value);
      });
    }

    const targetExposureSecInput = document.getElementById("targetExposureSec");
    if (targetExposureSecInput) {
      targetExposureSecInput.addEventListener("input", (e) => {
        state.targetExposureSec = parseFloat(e.target.value);
        document.getElementById("targetExposureVal").textContent = `${state.targetExposureSec} s (${(state.targetExposureSec/60).toFixed(1)} min)`;
      });
    }

    const lensCapBtn = document.getElementById("lensCapBtn");
    if (lensCapBtn) {
      lensCapBtn.addEventListener("click", () => {
        if (!state.isExposing) {
          // Start exposure
          state.isExposing = true;
          state.exposureTimeSec = 0;
          DaguerreAudio.playLensCap(true);
          lensCapBtn.textContent = "Replace Lens Cap (End Exposure)";
          lensCapBtn.classList.add("btn-danger");
        } else {
          // Stop exposure
          state.isExposing = false;
          DaguerreAudio.playLensCap(false);
          lensCapBtn.textContent = "Remove Lens Cap (Start Pose)";
          lensCapBtn.classList.remove("btn-danger");
          updateExposureSummary();
        }
      });
    }

    // Step 4: Mercury Fuming
    const tempSlider = document.getElementById("tempSlider");
    if (tempSlider) {
      tempSlider.addEventListener("input", (e) => {
        state.mercuryTempC = parseFloat(e.target.value);
        document.getElementById("tempVal").textContent = `${state.mercuryTempC.toFixed(0)}°C`;
        updateMercuryUI();
      });
    }

    const toggleMercuryBtn = document.getElementById("toggleMercuryBtn");
    if (toggleMercuryBtn) {
      toggleMercuryBtn.addEventListener("click", () => {
        state.isFuming = !state.isFuming;
        if (state.isFuming) {
          DaguerreAudio.playFlameHiss();
          toggleMercuryBtn.textContent = "Remove Plate from Vapor (Stop)";
          toggleMercuryBtn.classList.add("btn-active");
          state.fumingInterval = setInterval(() => {
            state.mercuryTimeSec += 0.5;
            updateMercuryUI();
          }, 100);
        } else {
          toggleMercuryBtn.textContent = "Place Plate Over Mercury Vapor";
          toggleMercuryBtn.classList.remove("btn-active");
          clearInterval(state.fumingInterval);
        }
      });
    }

    const autoDevelopBtn = document.getElementById("autoDevelopBtn");
    if (autoDevelopBtn) {
      autoDevelopBtn.addEventListener("click", () => {
        state.mercuryTempC = 65.0;
        state.mercuryTimeSec = 60;
        if (tempSlider) tempSlider.value = 65;
        document.getElementById("tempVal").textContent = "65°C";
        DaguerreAudio.playFlameHiss();
        updateMercuryUI();
      });
    }

    // Step 5: Fix & Tone
    const fixBathBtn = document.getElementById("fixBathBtn");
    if (fixBathBtn) {
      fixBathBtn.addEventListener("click", () => {
        state.isFixed = true;
        DaguerreAudio.playRinse();
        fixBathBtn.disabled = true;
        fixBathBtn.textContent = "✓ Plate Fixed with Sodium Thiosulfate";
        document.getElementById("fixStatus").textContent = "Unexposed yellow AgI dissolved. Deep specular mirror revealed!";
        document.getElementById("goldToneBtn").disabled = false;
      });
    }

    const goldToneBtn = document.getElementById("goldToneBtn");
    if (goldToneBtn) {
      goldToneBtn.addEventListener("click", () => {
        state.isGoldToned = true;
        DaguerreAudio.playRinse();
        goldToneBtn.disabled = true;
        goldToneBtn.textContent = "✓ Fizeau Gold Toned Applied";
        document.getElementById("goldStatus").textContent = "Gold chloride deposited. Shadows deepened, contrast doubled!";
      });
    }

    const finishPlateBtn = document.getElementById("finishPlateBtn");
    if (finishPlateBtn) {
      finishPlateBtn.addEventListener("click", () => {
        DaguerreAudio.playCaseSnap();
        saveCurrentPlateToGallery();
        switchTab("inspector");
      });
    }

    // Step 6 / Inspector Controls (Tilt & Loupe)
    const tiltSliderX = document.getElementById("tiltSliderX");
    if (tiltSliderX) {
      tiltSliderX.addEventListener("input", (e) => {
        state.tiltAngleX = parseFloat(e.target.value);
        document.getElementById("tiltValX").textContent = `${state.tiltAngleX > 0 ? "+" : ""}${state.tiltAngleX.toFixed(0)}°`;
      });
    }

    const tiltSliderY = document.getElementById("tiltSliderY");
    if (tiltSliderY) {
      tiltSliderY.addEventListener("input", (e) => {
        state.tiltAngleY = parseFloat(e.target.value);
        document.getElementById("tiltValY").textContent = `${state.tiltAngleY > 0 ? "+" : ""}${state.tiltAngleY.toFixed(0)}°`;
      });
    }

    const tiltPresetPositive = document.getElementById("tiltPresetPositive");
    if (tiltPresetPositive) {
      tiltPresetPositive.addEventListener("click", () => {
        state.tiltAngleX = 0;
        state.tiltAngleY = 0;
        if (tiltSliderX) tiltSliderX.value = 0;
        if (tiltSliderY) tiltSliderY.value = 0;
        document.getElementById("tiltValX").textContent = "0°";
        document.getElementById("tiltValY").textContent = "0°";
      });
    }

    const tiltPresetNegative = document.getElementById("tiltPresetNegative");
    if (tiltPresetNegative) {
      tiltPresetNegative.addEventListener("click", () => {
        state.tiltAngleX = 28;
        state.tiltAngleY = 15;
        if (tiltSliderX) tiltSliderX.value = 28;
        if (tiltSliderY) tiltSliderY.value = 15;
        document.getElementById("tiltValX").textContent = "+28°";
        document.getElementById("tiltValY").textContent = "+15°";
      });
    }

    // Interactive Drag to Tilt on Inspector Canvas
    if (inspectCanvas) {
      let isDraggingPlate = false;
      let startX = 0, startY = 0;
      let baseAngleX = 0, baseAngleY = 0;

      inspectCanvas.addEventListener("mousedown", (e) => {
        if (state.loupeActive) return;
        isDraggingPlate = true;
        startX = e.clientX;
        startY = e.clientY;
        baseAngleX = state.tiltAngleX;
        baseAngleY = state.tiltAngleY;
      });

      window.addEventListener("mouseup", () => { isDraggingPlate = false; });

      inspectCanvas.addEventListener("mousemove", (e) => {
        const rect = inspectCanvas.getBoundingClientRect();
        state.loupeX = (e.clientX - rect.left) / rect.width;
        state.loupeY = (e.clientY - rect.top) / rect.height;

        if (isDraggingPlate && !state.loupeActive) {
          const dx = e.clientX - startX;
          const dy = e.clientY - startY;
          state.tiltAngleX = Math.max(-45, Math.min(45, baseAngleX + dx * 0.25));
          state.tiltAngleY = Math.max(-45, Math.min(45, baseAngleY - dy * 0.25));
          if (tiltSliderX) tiltSliderX.value = state.tiltAngleX;
          if (tiltSliderY) tiltSliderY.value = state.tiltAngleY;
          document.getElementById("tiltValX").textContent = `${state.tiltAngleX > 0 ? "+" : ""}${state.tiltAngleX.toFixed(0)}°`;
          document.getElementById("tiltValY").textContent = `${state.tiltAngleY > 0 ? "+" : ""}${state.tiltAngleY.toFixed(0)}°`;
        }
      });

      // Touch events for mobile/tablet drag
      inspectCanvas.addEventListener("touchstart", (e) => {
        if (state.loupeActive) return;
        isDraggingPlate = true;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        baseAngleX = state.tiltAngleX;
        baseAngleY = state.tiltAngleY;
      }, { passive: true });

      window.addEventListener("touchend", () => { isDraggingPlate = false; });

      inspectCanvas.addEventListener("touchmove", (e) => {
        if (isDraggingPlate && !state.loupeActive) {
          const dx = e.touches[0].clientX - startX;
          const dy = e.touches[0].clientY - startY;
          state.tiltAngleX = Math.max(-45, Math.min(45, baseAngleX + dx * 0.25));
          state.tiltAngleY = Math.max(-45, Math.min(45, baseAngleY - dy * 0.25));
          if (tiltSliderX) tiltSliderX.value = state.tiltAngleX;
          if (tiltSliderY) tiltSliderY.value = state.tiltAngleY;
          document.getElementById("tiltValX").textContent = `${state.tiltAngleX > 0 ? "+" : ""}${state.tiltAngleX.toFixed(0)}°`;
          document.getElementById("tiltValY").textContent = `${state.tiltAngleY > 0 ? "+" : ""}${state.tiltAngleY.toFixed(0)}°`;
        }
      }, { passive: true });
    }

    const toggleLoupeBtn = document.getElementById("toggleLoupeBtn");
    if (toggleLoupeBtn) {
      toggleLoupeBtn.addEventListener("click", () => {
        state.loupeActive = !state.loupeActive;
        toggleLoupeBtn.classList.toggle("btn-active", state.loupeActive);
        toggleLoupeBtn.textContent = state.loupeActive ? "Loupe Active (Move over Plate)" : "Toggle 10x Watchmaker's Loupe";
      });
    }

    const downloadPlateBtn = document.getElementById("downloadPlateBtn");
    if (downloadPlateBtn) {
      downloadPlateBtn.addEventListener("click", () => {
        downloadInspectorPlate();
      });
    }
  }

  function initAudioControls() {
    const muteBtn = document.getElementById("muteBtn");
    if (muteBtn) {
      muteBtn.addEventListener("click", () => {
        const muted = DaguerreAudio.toggleMute();
        muteBtn.textContent = muted ? "🔇 Unmute Audio" : "🔊 Sound ON";
        muteBtn.classList.toggle("btn-muted", muted);
      });
    }
  }

  function switchTab(tab) {
    state.currentTab = tab;
    document.querySelectorAll(".tab-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.tab === tab);
    });
    document.querySelectorAll(".tab-content").forEach(c => {
      c.classList.toggle("active", c.id === `${tab}Tab`);
    });
  }

  function goToStep(stepNum) {
    state.step = stepNum;
    document.querySelectorAll(".step-nav-btn").forEach(b => {
      const s = parseInt(b.dataset.step, 10);
      b.classList.toggle("active", s === stepNum);
    });
    document.querySelectorAll(".workshop-step").forEach(s => {
      s.classList.toggle("active", s.id === `step${stepNum}`);
    });

    if (stepNum === 1) updatePolishUI();
    if (stepNum === 2) updateSensitizeUI();
    if (stepNum === 3) updateSceneDetails();
    if (stepNum === 4) updateMercuryUI();
  }

  function updatePolishUI() {
    const progressEl = document.getElementById("polishProgressVal");
    if (progressEl) progressEl.textContent = `${Math.round(state.polishProgress)}%`;
    const roughnessEl = document.getElementById("surfaceRoughnessVal");
    if (roughnessEl) {
      const ra = Math.max(0.015, (1.2 * (1 - state.polishProgress / 100))).toFixed(3);
      roughnessEl.textContent = `${ra} µm (${state.polishProgress >= 95 ? "Optical Mirror" : "Scratched & Cloudy"})`;
    }
    const nextBtn = document.getElementById("step1NextBtn");
    if (nextBtn) nextBtn.disabled = state.polishProgress < 85;
  }

  function updateSensitizeUI() {
    const res = DaguerreEngine.calculateSensitization(state.sensitizeThicknessNm);
    const colorBox = document.getElementById("sensitizeColorBox");
    if (colorBox) {
      colorBox.style.backgroundColor = res.color;
      colorBox.style.boxShadow = `0 0 16px ${res.color}88`;
    }
    const labelEl = document.getElementById("sensitizeColorLabel");
    if (labelEl) labelEl.textContent = `${res.label} (~${Math.round(res.thicknessNm)} nm)`;
    const speedEl = document.getElementById("sensitizeSpeedVal");
    if (speedEl) speedEl.textContent = `${Math.round(res.sensitivity * 100)}%`;

    const nextBtn = document.getElementById("step2NextBtn");
    if (nextBtn) nextBtn.disabled = state.sensitizeThicknessNm < 15;
  }

  function updateSceneDetails() {
    const sc = DaguerreEngine.SCENES[state.selectedScene];
    if (!sc) return;
    const titleEl = document.getElementById("sceneTitle");
    if (titleEl) titleEl.textContent = sc.title;
    const descEl = document.getElementById("sceneDesc");
    if (descEl) descEl.textContent = sc.description;

    const clampGroup = document.getElementById("neckClampGroup");
    if (clampGroup) {
      clampGroup.style.display = (state.selectedScene === "portrait") ? "block" : "none";
    }
  }

  function updateExposureSummary() {
    const lux = state.weather === "sun" ? 85000 : (state.weather === "hazy" ? 40000 : 15000);
    const sens = DaguerreEngine.calculateSensitization(state.sensitizeThicknessNm).sensitivity;
    const energy = DaguerreEngine.calculateExposureEnergy(lux, state.aperture, state.exposureTimeSec, sens);
    state.exposureEnergy = energy;
    const evalRes = DaguerreEngine.evaluateExposure(energy);

    const summaryEl = document.getElementById("exposureSummary");
    if (summaryEl) {
      summaryEl.innerHTML = `
        <strong>Exposure Completed:</strong> ${state.exposureTimeSec.toFixed(1)} s pose at f/${state.aperture}<br>
        <strong>Flux Index:</strong> ${Math.round(energy)} units (${evalRes.status})
      `;
    }
    const nextBtn = document.getElementById("step3NextBtn");
    if (nextBtn) nextBtn.disabled = state.exposureTimeSec < 5;
  }

  function updateMercuryUI() {
    const sens = DaguerreEngine.calculateSensitization(state.sensitizeThicknessNm).sensitivity;
    const latentStrength = Math.min(1.0, state.exposureEnergy / 500);
    const dev = DaguerreEngine.calculateDevelopment(state.mercuryTempC, state.mercuryTimeSec, latentStrength);

    const timeEl = document.getElementById("mercuryTimeVal");
    if (timeEl) timeEl.textContent = `${state.mercuryTimeSec.toFixed(0)} s`;

    const statusEl = document.getElementById("mercuryStatusVal");
    if (statusEl) {
      if (dev.isOverFogged) {
        statusEl.textContent = "Overheated / Fogged (Chalky grey haze across shadows)";
        statusEl.className = "text-danger";
      } else if (dev.isOptimal) {
        statusEl.textContent = "Peak Contrast & Sharpness (Optimal Amalgam Growth)";
        statusEl.className = "text-success";
      } else if (dev.isUnderDeveloped) {
        statusEl.textContent = "Under-developed (Latent image still faint)";
        statusEl.className = "text-warning";
      } else {
        statusEl.textContent = "Developing...";
        statusEl.className = "";
      }
    }

    const nextBtn = document.getElementById("step4NextBtn");
    if (nextBtn) nextBtn.disabled = state.mercuryTimeSec < 15;
  }

  function loadDefaultPlate() {
    // Populate an initial historical masterwork in the gallery
    state.gallery.push({
      id: "master_boulevard",
      title: "Boulevard du Temple (1838 Masterpiece)",
      date: "Spring 1838",
      scene: "boulevard",
      fNumber: 14.0,
      exposureSec: 480,
      sensitizeThicknessNm: 72,
      goldToned: true,
      fixed: true,
      amalgamMap: null
    });
    renderGalleryList();
  }

  function saveCurrentPlateToGallery() {
    const newPlate = {
      id: `plate_${Date.now()}`,
      title: `${DaguerreEngine.SCENES[state.selectedScene].title} (${new Date().toLocaleTimeString()})`,
      date: "August 19, 1839 Simulation",
      scene: state.selectedScene,
      fNumber: state.aperture,
      exposureSec: state.exposureTimeSec,
      sensitizeThicknessNm: state.sensitizeThicknessNm,
      goldToned: state.isGoldToned,
      fixed: state.isFixed,
      neckClampOn: state.neckClampOn
    };
    state.gallery.unshift(newPlate);
    renderGalleryList();
  }

  function renderGalleryList() {
    const listEl = document.getElementById("galleryList");
    if (!listEl) return;
    listEl.innerHTML = "";
    state.gallery.forEach((item, index) => {
      const div = document.createElement("div");
      div.className = `gallery-item ${index === 0 ? "selected" : ""}`;
      div.innerHTML = `
        <div class="gallery-item-title">${item.title}</div>
        <div class="gallery-item-meta">${item.date} · f/${item.fNumber} · ${item.exposureSec}s</div>
      `;
      div.addEventListener("click", () => {
        document.querySelectorAll(".gallery-item").forEach(el => el.classList.remove("selected"));
        div.classList.add("selected");
        // Load plate into inspector
        state.selectedScene = item.scene;
        state.aperture = item.fNumber;
        state.exposureTimeSec = item.exposureSec;
        state.sensitizeThicknessNm = item.sensitizeThicknessNm;
        state.isGoldToned = item.goldToned;
        state.isFixed = item.fixed;
        if (item.neckClampOn !== undefined) state.neckClampOn = item.neckClampOn;
        updateExposureSummary();
      });
      listEl.appendChild(div);
    });
  }

  // --- Main Animation & Render Loop ---
  let lastTimestamp = 0;
  function renderLoop(timestamp) {
    const dt = (timestamp - lastTimestamp) / 1000 || 0.016;
    lastTimestamp = timestamp;

    if (state.isExposing) {
      state.exposureTimeSec += dt;
      const progressEl = document.getElementById("poseProgressSec");
      if (progressEl) {
        progressEl.textContent = `${state.exposureTimeSec.toFixed(1)} s / ${state.targetExposureSec} s`;
      }
      const bar = document.getElementById("exposureProgressBar");
      if (bar) {
        const pct = Math.min(100, (state.exposureTimeSec / state.targetExposureSec) * 100);
        bar.style.width = `${pct}%`;
      }
      if (state.exposureTimeSec >= state.targetExposureSec) {
        state.isExposing = false;
        DaguerreAudio.playLensCap(false);
        const lensCapBtn = document.getElementById("lensCapBtn");
        if (lensCapBtn) {
          lensCapBtn.textContent = "Remove Lens Cap (Start Pose)";
          lensCapBtn.classList.remove("btn-danger");
        }
        updateExposureSummary();
      }
    }

    if (state.currentTab === "workshop") {
      if (state.step === 1 && polishCtx) renderPolishCanvas();
      if (state.step === 2 && sensitizeCtx) renderSensitizeCanvas();
      if (state.step === 3 && (cameraCtx || groundGlassCtx)) renderCameraStep(timestamp);
      if (state.step === 4 && mercuryCtx) renderMercuryStep(timestamp);
    } else if (state.currentTab === "inspector" && inspectCtx) {
      renderInspectorPlate(timestamp);
    }

    requestAnimationFrame(renderLoop);
  }

  // --- Canvas Rendering Functions ---

  function renderPolishCanvas() {
    const w = polishCanvas.width;
    const h = polishCanvas.height;
    polishCtx.clearRect(0, 0, w, h);

    // Render plate base: copper clad with pure silver
    const grad = polishCtx.createLinearGradient(0, 0, w, h);
    if (state.polishProgress < 30) {
      grad.addColorStop(0, "#8a7d75");
      grad.addColorStop(0.5, "#a69588");
      grad.addColorStop(1, "#7d6f66");
    } else {
      const p = (state.polishProgress - 30) / 70;
      grad.addColorStop(0, interpolateColor("#8a7d75", "#dce2ec", p));
      grad.addColorStop(0.5, interpolateColor("#a69588", "#f0f4fa", p));
      grad.addColorStop(1, interpolateColor("#7d6f66", "#c8d0dc", p));
    }
    polishCtx.fillStyle = grad;
    polishCtx.fillRect(10, 10, w - 20, h - 20);

    // Border bevel
    polishCtx.strokeStyle = "#4a3525";
    polishCtx.lineWidth = 4;
    polishCtx.strokeRect(10, 10, w - 20, h - 20);

    // Draw scratches that disappear as polishing proceeds
    const scratchCount = Math.max(0, Math.floor(60 * (1 - state.polishProgress / 100)));
    polishCtx.strokeStyle = "rgba(70, 60, 50, 0.4)";
    polishCtx.lineWidth = 1;
    for (let i = 0; i < scratchCount; i++) {
      const sy = 20 + ((i * 19) % (h - 40));
      polishCtx.beginPath();
      polishCtx.moveTo(20, sy);
      polishCtx.lineTo(w - 20, sy + (Math.sin(i) * 6));
      polishCtx.stroke();
    }

    // Mirror reflection highlight when polished
    if (state.polishProgress > 50) {
      const alpha = (state.polishProgress - 50) / 50 * 0.35;
      const refGrad = polishCtx.createLinearGradient(w * 0.2, 0, w * 0.8, h);
      refGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
      refGrad.addColorStop(0.5, `rgba(255, 255, 255, 0)`);
      refGrad.addColorStop(1, `rgba(255, 255, 255, ${alpha * 0.6})`);
      polishCtx.fillStyle = refGrad;
      polishCtx.fillRect(12, 12, w - 24, h - 24);
    }
  }

  function renderSensitizeCanvas() {
    const w = sensitizeCanvas.width;
    const h = sensitizeCanvas.height;
    sensitizeCtx.clearRect(0, 0, w, h);

    const res = DaguerreEngine.calculateSensitization(state.sensitizeThicknessNm);

    // Plate with thin-film color
    sensitizeCtx.fillStyle = res.color;
    sensitizeCtx.fillRect(15, 15, w - 30, h - 30);

    // Plate rim & clips
    sensitizeCtx.strokeStyle = "#8b5a2b";
    sensitizeCtx.lineWidth = 6;
    sensitizeCtx.strokeRect(15, 15, w - 30, h - 30);

    // Subtle metallic interference sheen gradient
    const sheen = sensitizeCtx.createLinearGradient(0, 0, w, h);
    sheen.addColorStop(0, "rgba(255,255,255,0.25)");
    sheen.addColorStop(0.4, "rgba(255,255,255,0.0)");
    sheen.addColorStop(0.7, "rgba(0,0,0,0.15)");
    sheen.addColorStop(1, "rgba(255,255,255,0.2)");
    sensitizeCtx.fillStyle = sheen;
    sensitizeCtx.fillRect(18, 18, w - 36, h - 36);

    // Iodine vapor wisps if actively fuming
    if (state.isSensitizing) {
      sensitizeCtx.fillStyle = "rgba(180, 100, 210, 0.25)";
      for (let i = 0; i < 6; i++) {
        const vx = 40 + (i * 80) + Math.sin(Date.now() / 300 + i) * 20;
        const vy = h - 30 - ((Date.now() / 20 + i * 40) % (h - 60));
        sensitizeCtx.beginPath();
        sensitizeCtx.arc(vx, vy, 25, 0, Math.PI * 2);
        sensitizeCtx.fill();
      }
    }
  }

  // Draw the ground-truth animated 1830s world onto an offscreen canvas
  function renderWorldScene(ctx, w, h, timeSec) {
    ctx.clearRect(0, 0, w, h);

    if (state.selectedScene === "boulevard") {
      // 1. Boulevard du Temple (Paris 1838)
      // Sky
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.45);
      skyGrad.addColorStop(0, "#d2e4f0");
      skyGrad.addColorStop(1, "#f2ede2");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h * 0.45);

      // Distant Haussmann-precursor Parisian facades
      ctx.fillStyle = "#cfc4b4";
      ctx.fillRect(40, h * 0.15, w - 80, h * 0.35);
      ctx.fillStyle = "#5c5044"; // Mansard roofs
      ctx.beginPath();
      ctx.moveTo(35, h * 0.15);
      ctx.lineTo(w - 35, h * 0.15);
      ctx.lineTo(w - 50, h * 0.08);
      ctx.lineTo(50, h * 0.08);
      ctx.closePath();
      ctx.fill();

      // Windows
      ctx.fillStyle = "#3c3833";
      for (let floor = 0; floor < 4; floor++) {
        for (let col = 0; col < 12; col++) {
          const wx = 60 + col * 42;
          const wy = h * 0.18 + floor * 30;
          ctx.fillRect(wx, wy, 16, 20);
        }
      }

      // Boulevard Street & Sidewalk
      const groundGrad = ctx.createLinearGradient(0, h * 0.45, 0, h);
      groundGrad.addColorStop(0, "#a0988c");
      groundGrad.addColorStop(1, "#665e54");
      ctx.fillStyle = groundGrad;
      ctx.fillRect(0, h * 0.45, w, h * 0.55);

      // Trees along Boulevard
      ctx.fillStyle = "#38452c";
      for (let t = 0; t < 5; t++) {
        const tx = 90 + t * 95;
        const ty = h * 0.52;
        // Trunk
        ctx.fillStyle = "#3e3226";
        ctx.fillRect(tx - 3, ty, 6, 60);
        // Foliage
        ctx.fillStyle = "#4a5a3a";
        ctx.beginPath();
        ctx.arc(tx, ty - 10, 24, 0, Math.PI * 2);
        ctx.arc(tx - 12, ty, 20, 0, Math.PI * 2);
        ctx.arc(tx + 12, ty, 20, 0, Math.PI * 2);
        ctx.fill();
      }

      // Historic Stationary Characters (The Shoe-Shiner & The Client)
      const heroX = 140;
      const heroY = h * 0.76;

      // Bootblack kneeling
      ctx.fillStyle = "#2d2822";
      ctx.fillRect(heroX - 10, heroY + 12, 22, 18); // Body
      ctx.fillStyle = "#e0c29e"; // Head
      ctx.beginPath();
      ctx.arc(heroX, heroY + 6, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#181410"; // Cap
      ctx.fillRect(heroX - 6, heroY, 12, 4);

      // Client standing upright with one foot on the box
      ctx.fillStyle = "#1e222a"; // Long topcoat
      ctx.fillRect(heroX + 16, heroY - 32, 16, 52);
      ctx.fillStyle = "#111"; // Top hat
      ctx.fillRect(heroX + 18, heroY - 48, 12, 16);
      ctx.fillRect(heroX + 14, heroY - 34, 20, 3);
      ctx.fillStyle = "#dfc09c"; // Face
      ctx.beginPath();
      ctx.arc(heroX + 24, heroY - 30, 6, 0, Math.PI * 2);
      ctx.fill();

      // Fast Moving Traffic (Omnibuses, horses, pedestrians)
      // Moving omnibus (crosses street in ~8s)
      const busCycle = (timeSec % 10) / 10;
      const busX = -120 + busCycle * (w + 240);
      const busY = h * 0.58;

      ctx.fillStyle = "#7a3020"; // Red omnibus
      ctx.fillRect(busX, busY, 70, 35);
      ctx.fillStyle = "#222"; // Wheels
      ctx.beginPath();
      ctx.arc(busX + 15, busY + 35, 10, 0, Math.PI * 2);
      ctx.arc(busX + 55, busY + 35, 10, 0, Math.PI * 2);
      ctx.fill();
      // Horses in front
      ctx.fillStyle = "#4a3320";
      ctx.fillRect(busX + 75, busY + 10, 40, 20);

      // Walking Pedestrians (cross in ~12s)
      for (let p = 0; p < 3; p++) {
        const pCycle = ((timeSec * 0.5 + p * 4) % 14) / 14;
        const px = w + 40 - pCycle * (w + 80);
        const py = h * 0.68 + p * 16;
        ctx.fillStyle = "#333";
        ctx.fillRect(px, py - 24, 8, 24);
        ctx.fillStyle = "#e0c29e";
        ctx.beginPath();
        ctx.arc(px + 4, py - 28, 4, 0, Math.PI * 2);
        ctx.fill();
      }

    } else if (state.selectedScene === "portrait") {
      // 2. Studio Portrait with Neck-Clamp (Appui-Tête)
      // Studio Drapery & Backdrop
      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, "#2c2622");
      bg.addColorStop(0.5, "#4a3c30");
      bg.addColorStop(1, "#1e1814");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Iron Neck-Clamp (Appui-Tête) behind the chair
      const cx = w * 0.5;
      const cy = h * 0.45;

      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(cx - 3, cy - 80, 6, 180); // Iron vertical pole
      ctx.fillRect(cx - 30, cy + 95, 60, 10); // Heavy cast-iron base
      if (state.neckClampOn) {
        // Clamp prongs holding occiput
        ctx.strokeStyle = "#555";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(cx, cy - 35, 26, Math.PI * 0.8, Math.PI * 2.2);
        ctx.stroke();
      }

      // Ornate Carved Armchair
      ctx.fillStyle = "#5c2e1a";
      ctx.fillRect(cx - 55, cy - 20, 110, 120);
      ctx.fillStyle = "#6a1b24"; // Velvet red cushion
      ctx.fillRect(cx - 45, cy - 10, 90, 100);

      // Sitter's Motion: If clamp is OFF, head drifts and wobbles!
      let wobbleX = 0, wobbleY = 0;
      if (!state.neckClampOn) {
        wobbleX = Math.sin(timeSec * 0.8) * 8 + Math.cos(timeSec * 2.1) * 4;
        wobbleY = Math.cos(timeSec * 0.6) * 6 + Math.sin(timeSec * 1.7) * 3;
      }

      const hx = cx + wobbleX;
      const hy = cy - 35 + wobbleY;

      // Frock Coat & Body
      ctx.fillStyle = "#15181c"; // Dark frock coat
      ctx.beginPath();
      ctx.moveTo(hx - 40, hy + 50);
      ctx.lineTo(hx + 40, hy + 50);
      ctx.lineTo(hx + 55, hy + 130);
      ctx.lineTo(hx - 55, hy + 130);
      ctx.closePath();
      ctx.fill();

      // White Cravat / Shirt collar
      ctx.fillStyle = "#e8e5db";
      ctx.beginPath();
      ctx.moveTo(hx - 12, hy + 38);
      ctx.lineTo(hx + 12, hy + 38);
      ctx.lineTo(hx, hy + 58);
      ctx.closePath();
      ctx.fill();

      // Head & Face
      ctx.fillStyle = "#d9b695";
      ctx.beginPath();
      ctx.ellipse(hx, hy, 22, 28, 0, 0, Math.PI * 2);
      ctx.fill();

      // Victorian Hair & Sideburns
      ctx.fillStyle = "#38291e";
      ctx.beginPath();
      ctx.arc(hx, hy - 14, 24, Math.PI * 0.8, Math.PI * 2.2);
      ctx.fill();
      ctx.fillRect(hx - 24, hy - 10, 8, 22); // Sideburn left
      ctx.fillRect(hx + 16, hy - 10, 8, 22); // Sideburn right

      // Eyes & Moustache
      ctx.fillStyle = "#2b2018";
      ctx.fillRect(hx - 12, hy - 3, 6, 3); // Left eye
      ctx.fillRect(hx + 6, hy - 3, 6, 3); // Right eye
      ctx.fillRect(hx - 10, hy + 12, 20, 5); // Moustache

    } else if (state.selectedScene === "notredame") {
      // 3. Notre-Dame Cathedral & Seine River
      // Bright Sunlit Sky
      const sky = ctx.createLinearGradient(0, 0, 0, h * 0.55);
      sky.addColorStop(0, "#a0c4e8");
      sky.addColorStop(0.7, "#d8e8f8");
      sky.addColorStop(1, "#f8f0e0");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h * 0.55);

      // Blazing Direct Sun (Solarization source)
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(w * 0.82, h * 0.15, 24, 0, Math.PI * 2);
      ctx.fill();

      // Notre-Dame Gothic Facade
      const nx = w * 0.28;
      const ny = h * 0.18;
      ctx.fillStyle = "#d2c5b0"; // Golden sandstone
      ctx.fillRect(nx, ny, 170, 160);

      // Twin Towers
      ctx.fillRect(nx + 10, ny - 65, 45, 65);
      ctx.fillRect(nx + 115, ny - 65, 45, 65);

      // Rose Window
      ctx.fillStyle = "#3a404a";
      ctx.beginPath();
      ctx.arc(nx + 85, ny + 45, 26, 0, Math.PI * 2);
      ctx.fill();

      // Gothic Portals (Triple doors)
      ctx.fillStyle = "#2a221a";
      ctx.beginPath();
      ctx.arc(nx + 35, ny + 135, 16, Math.PI, 0);
      ctx.arc(nx + 85, ny + 130, 20, Math.PI, 0);
      ctx.arc(nx + 135, ny + 135, 16, Math.PI, 0);
      ctx.fill();

      // Pont de la Tournelle (Bridge arches)
      ctx.fillStyle = "#9c9082";
      ctx.fillRect(0, h * 0.58, w, 30);
      ctx.fillStyle = "#332c25";
      for (let a = 0; a < 4; a++) {
        ctx.beginPath();
        ctx.arc(60 + a * 150, h * 0.64, 40, Math.PI, 0);
        ctx.fill();
      }

      // River Seine Surface (Flowing water)
      const river = ctx.createLinearGradient(0, h * 0.62, 0, h);
      river.addColorStop(0, "#4a6874");
      river.addColorStop(0.5, "#5d7c88");
      river.addColorStop(1, "#364e58");
      ctx.fillStyle = river;
      ctx.fillRect(0, h * 0.62, w, h * 0.38);

      // Sparkling Sun Glints on water
      ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
      for (let g = 0; g < 15; g++) {
        const gx = (w * 0.5 + (g * 31 + timeSec * 15) % (w * 0.45));
        const gy = h * 0.68 + (g * 17) % (h * 0.28);
        ctx.fillRect(gx, gy, 12 + Math.sin(timeSec + g) * 8, 3);
      }

      // Passing Coal Barge (Crosses river in ~25s)
      const bargeCycle = (timeSec % 30) / 30;
      const bx = -140 + bargeCycle * (w + 280);
      const by = h * 0.78;
      ctx.fillStyle = "#221c18";
      ctx.fillRect(bx, by, 90, 22);
      ctx.fillStyle = "#555";
      ctx.fillRect(bx + 15, by - 12, 10, 14); // Little steam pipe
    }
  }

  function renderCameraStep(timestamp) {
    const timeSec = timestamp / 1000;

    // 1. Render ground truth scene
    if (cameraCtx) {
      const cw = cameraCanvas.width;
      const ch = cameraCanvas.height;
      renderWorldScene(cameraCtx, cw, ch, timeSec);
    }

    // 2. Render Ground Glass screen inside Camera Obscura
    // Vertically inverted and laterally reversed optical projection!
    if (groundGlassCtx) {
      const gw = groundGlassCanvas.width;
      const gh = groundGlassCanvas.height;

      renderWorldScene(offscreenSceneCtx, 640, 480, timeSec);

      groundGlassCtx.save();
      groundGlassCtx.clearRect(0, 0, gw, gh);

      // Lens inversion transform
      groundGlassCtx.translate(gw, gh);
      groundGlassCtx.scale(-1, -1);

      // Draw projected image with ground-glass frosted vignette
      groundGlassCtx.drawImage(offscreenSceneCanvas, 0, 0, gw, gh);
      groundGlassCtx.restore();

      // Frosted ground-glass texture overlay
      groundGlassCtx.fillStyle = "rgba(230, 240, 220, 0.15)";
      groundGlassCtx.fillRect(0, 0, gw, gh);

      // Crosshair alignment lines on ground glass
      groundGlassCtx.strokeStyle = "rgba(0, 0, 0, 0.35)";
      groundGlassCtx.lineWidth = 1;
      groundGlassCtx.beginPath();
      groundGlassCtx.moveTo(gw * 0.5, 0);
      groundGlassCtx.lineTo(gw * 0.5, gh);
      groundGlassCtx.moveTo(0, gh * 0.5);
      groundGlassCtx.lineTo(gw, gh * 0.5);
      groundGlassCtx.stroke();
    }
  }

  function renderMercuryStep(timestamp) {
    const mw = mercuryCanvas.width;
    const mh = mercuryCanvas.height;
    mercuryCtx.clearRect(0, 0, mw, mh);

    // Amber / Ruby darkroom inspection window
    mercuryCtx.fillStyle = "#1e0e06";
    mercuryCtx.fillRect(0, 0, mw, mh);

    // Fuming Box 45-degree angled plate view
    const pw = mw - 40;
    const ph = mh - 40;

    // Latent image calculation
    const sens = DaguerreEngine.calculateSensitization(state.sensitizeThicknessNm).sensitivity;
    const latentStrength = Math.min(1.0, state.exposureEnergy / 500);
    const dev = DaguerreEngine.calculateDevelopment(state.mercuryTempC, state.mercuryTimeSec, latentStrength);

    // Plate background: golden AgI layer
    const plateGrad = mercuryCtx.createLinearGradient(20, 20, pw, ph);
    plateGrad.addColorStop(0, "#c49a45");
    plateGrad.addColorStop(1, "#9e782e");
    mercuryCtx.fillStyle = plateGrad;
    mercuryCtx.fillRect(20, 20, pw, ph);

    // Render emerging silver-mercury amalgam highlights
    if (dev.amalgamDensity > 0.02) {
      renderProcessedPlateToCanvas(offscreenPlateCtx, 640, 480, 0, false, dev.amalgamDensity, dev.backgroundFog);
      mercuryCtx.globalAlpha = Math.min(1.0, dev.amalgamDensity * 1.3);
      mercuryCtx.drawImage(offscreenPlateCanvas, 20, 20, pw, ph);
      mercuryCtx.globalAlpha = 1.0;
    }

    // Ruby glow from spirit lamp beneath
    const rubyGrad = mercuryCtx.createRadialGradient(mw * 0.5, mh - 10, 10, mw * 0.5, mh - 10, mw * 0.6);
    rubyGrad.addColorStop(0, "rgba(255, 60, 20, 0.45)");
    rubyGrad.addColorStop(1, "rgba(255, 60, 20, 0.0)");
    mercuryCtx.fillStyle = rubyGrad;
    mercuryCtx.fillRect(0, 0, mw, mh);
  }

  // --- Master Plate Image Synthesis Engine ---
  // Calculates pixel-level time integration, movement vanishing, and solarization
  function renderProcessedPlateToCanvas(ctx, w, h, tiltAngle, isInspector, amalgamBoost = 1.0, fogAmount = 0.0) {
    ctx.clearRect(0, 0, w, h);

    const totalExposure = Math.max(1, state.exposureTimeSec);
    const sc = DaguerreEngine.SCENES[state.selectedScene];
    if (!sc) return;

    // Background base
    ctx.fillStyle = state.isFixed ? "#121316" : "#b8923a"; // Fixed = dark silver mirror; Unfixed = yellow AgI
    ctx.fillRect(0, 0, w, h);

    // 1. Draw static background features
    if (state.selectedScene === "boulevard") {
      // Sky
      const skyAmalgam = 0.90 * amalgamBoost;
      ctx.fillStyle = `rgb(${Math.round(235 * skyAmalgam)}, ${Math.round(235 * skyAmalgam)}, ${Math.round(235 * skyAmalgam)})`;
      ctx.fillRect(0, 0, w, h * 0.45);

      // Buildings
      const bldgAmalgam = 0.65 * amalgamBoost;
      ctx.fillStyle = `rgb(${Math.round(210 * bldgAmalgam)}, ${Math.round(210 * bldgAmalgam)}, ${Math.round(210 * bldgAmalgam)})`;
      ctx.fillRect(40, h * 0.15, w - 80, h * 0.35);

      // Mansard roof
      const roofAmalgam = 0.30 * amalgamBoost;
      ctx.fillStyle = `rgb(${Math.round(180 * roofAmalgam)}, ${Math.round(180 * roofAmalgam)}, ${Math.round(180 * roofAmalgam)})`;
      ctx.beginPath();
      ctx.moveTo(35, h * 0.15);
      ctx.lineTo(w - 35, h * 0.15);
      ctx.lineTo(w - 50, h * 0.08);
      ctx.lineTo(50, h * 0.08);
      ctx.closePath();
      ctx.fill();

      // Windows
      ctx.fillStyle = "#0c0d0e";
      for (let floor = 0; floor < 4; floor++) {
        for (let col = 0; col < 12; col++) {
          ctx.fillRect(60 + col * 42, h * 0.18 + floor * 30, 16, 20);
        }
      }

      // Cobblestone street
      const streetAmalgam = 0.42 * amalgamBoost;
      ctx.fillStyle = `rgb(${Math.round(190 * streetAmalgam)}, ${Math.round(190 * streetAmalgam)}, ${Math.round(190 * streetAmalgam)})`;
      ctx.fillRect(0, h * 0.45, w, h * 0.55);

      // Trees
      for (let t = 0; t < 5; t++) {
        const tx = 90 + t * 95;
        const ty = h * 0.52;
        ctx.fillStyle = "#18191b";
        ctx.fillRect(tx - 3, ty, 6, 60);
        const folAmalgam = 0.35 * amalgamBoost;
        ctx.fillStyle = `rgb(${Math.round(180 * folAmalgam)}, ${Math.round(180 * folAmalgam)}, ${Math.round(180 * folAmalgam)})`;
        ctx.beginPath();
        ctx.arc(tx, ty - 10, 24, 0, Math.PI * 2);
        ctx.arc(tx - 12, ty, 20, 0, Math.PI * 2);
        ctx.arc(tx + 12, ty, 20, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. The Shoe-Shiner and Standing Client (Stayed for 240+ seconds)
      const heroVis = DaguerreEngine.calculateMovementIntegration(260, totalExposure);
      if (heroVis > 0.01) {
        const heroX = 140;
        const heroY = h * 0.76;
        ctx.save();
        ctx.globalAlpha = heroVis;

        // Bootblack
        const bbAmalgam = 0.50 * amalgamBoost;
        ctx.fillStyle = `rgb(${Math.round(200 * bbAmalgam)}, ${Math.round(200 * bbAmalgam)}, ${Math.round(200 * bbAmalgam)})`;
        ctx.fillRect(heroX - 10, heroY + 12, 22, 18);
        ctx.beginPath();
        ctx.arc(heroX, heroY + 6, 7, 0, Math.PI * 2);
        ctx.fill();

        // Client
        const clAmalgam = 0.75 * amalgamBoost;
        ctx.fillStyle = `rgb(${Math.round(225 * clAmalgam)}, ${Math.round(225 * clAmalgam)}, ${Math.round(225 * clAmalgam)})`;
        ctx.fillRect(heroX + 16, heroY - 32, 16, 52);
        ctx.fillRect(heroX + 18, heroY - 48, 12, 16);
        ctx.fillRect(heroX + 14, heroY - 34, 20, 3);
        ctx.beginPath();
        ctx.arc(heroX + 24, heroY - 30, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 3. Fast Moving Carriage (Stayed only 8 seconds -> Vanishes under long exposure!)
      const carriageVis = DaguerreEngine.calculateMovementIntegration(8, totalExposure);
      if (carriageVis > 0.01) {
        ctx.save();
        ctx.globalAlpha = carriageVis;
        ctx.fillStyle = "rgb(150, 150, 150)";
        ctx.fillRect(w * 0.45, h * 0.58, 70, 35);
        ctx.restore();
      }

      // 4. Pedestrians (12s -> Vanishes)
      const pedVis = DaguerreEngine.calculateMovementIntegration(12, totalExposure);
      if (pedVis > 0.01) {
        ctx.save();
        ctx.globalAlpha = pedVis;
        ctx.fillStyle = "rgb(130, 130, 130)";
        ctx.fillRect(w * 0.65, h * 0.68, 8, 24);
        ctx.restore();
      }

    } else if (state.selectedScene === "portrait") {
      const cx = w * 0.5;
      const cy = h * 0.45;

      // Studio drapery background
      const bgAmalgam = 0.25 * amalgamBoost;
      ctx.fillStyle = `rgb(${Math.round(180 * bgAmalgam)}, ${Math.round(180 * bgAmalgam)}, ${Math.round(180 * bgAmalgam)})`;
      ctx.fillRect(0, 0, w, h);

      // Chair
      const chairAmalgam = 0.35 * amalgamBoost;
      ctx.fillStyle = `rgb(${Math.round(190 * chairAmalgam)}, ${Math.round(190 * chairAmalgam)}, ${Math.round(190 * chairAmalgam)})`;
      ctx.fillRect(cx - 55, cy - 20, 110, 120);

      // Sitter
      const blurSigma = (!state.neckClampOn && totalExposure > 30) ? Math.min(14, totalExposure * 0.06) : 0;
      
      // If motion blur is present from lack of neck-clamp, draw smeared multi-pass impressions
      const passes = blurSigma > 0 ? 7 : 1;
      ctx.save();
      for (let p = 0; p < passes; p++) {
        const ox = (p - (passes - 1) / 2) * (blurSigma / 3);
        const oy = Math.sin(p) * (blurSigma / 4);
        ctx.globalAlpha = 1.0 / passes;

        const hx = cx + ox;
        const hy = cy - 35 + oy;

        // Frock coat
        ctx.fillStyle = "#161719";
        ctx.beginPath();
        ctx.moveTo(hx - 40, hy + 50);
        ctx.lineTo(hx + 40, hy + 50);
        ctx.lineTo(hx + 55, hy + 130);
        ctx.lineTo(hx - 55, hy + 130);
        ctx.closePath();
        ctx.fill();

        // Cravat
        const cravatAmalgam = 0.85 * amalgamBoost;
        ctx.fillStyle = `rgb(${Math.round(240 * cravatAmalgam)}, ${Math.round(240 * cravatAmalgam)}, ${Math.round(240 * cravatAmalgam)})`;
        ctx.beginPath();
        ctx.moveTo(hx - 12, hy + 38);
        ctx.lineTo(hx + 12, hy + 38);
        ctx.lineTo(hx, hy + 58);
        ctx.closePath();
        ctx.fill();

        // Face & Eyes
        const faceAmalgam = 0.78 * amalgamBoost;
        ctx.fillStyle = `rgb(${Math.round(230 * faceAmalgam)}, ${Math.round(230 * faceAmalgam)}, ${Math.round(230 * faceAmalgam)})`;
        ctx.beginPath();
        ctx.ellipse(hx, hy, 22, 28, 0, 0, Math.PI * 2);
        ctx.fill();

        // Hair
        ctx.fillStyle = "#1e1b18";
        ctx.beginPath();
        ctx.arc(hx, hy - 14, 24, Math.PI * 0.8, Math.PI * 2.2);
        ctx.fill();
      }
      ctx.restore();

    } else if (state.selectedScene === "notredame") {
      const nx = w * 0.28;
      const ny = h * 0.18;

      // Sky
      const skyAmalgam = 0.88 * amalgamBoost;
      ctx.fillStyle = `rgb(${Math.round(230 * skyAmalgam)}, ${Math.round(230 * skyAmalgam)}, ${Math.round(230 * skyAmalgam)})`;
      ctx.fillRect(0, 0, w, h * 0.55);

      // Blazing Sun (Check solarization reversal!)
      const evalExp = DaguerreEngine.evaluateExposure(state.exposureEnergy);
      if (evalExp.solarized) {
        // Overexposed solarized zone flips to dark metallic inversion!
        ctx.fillStyle = "#1a2228"; // Dark blue-grey solarization core
        ctx.beginPath();
        ctx.arc(w * 0.82, h * 0.15, 26, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#e8e5dc"; // Bright halo fringe around solarized sun
        ctx.lineWidth = 4;
        ctx.stroke();
      } else {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(w * 0.82, h * 0.15, 24, 0, Math.PI * 2);
        ctx.fill();
      }

      // Cathedral
      const cathAmalgam = 0.72 * amalgamBoost;
      ctx.fillStyle = `rgb(${Math.round(215 * cathAmalgam)}, ${Math.round(215 * cathAmalgam)}, ${Math.round(215 * cathAmalgam)})`;
      ctx.fillRect(nx, ny, 170, 160);
      ctx.fillRect(nx + 10, ny - 65, 45, 65);
      ctx.fillRect(nx + 115, ny - 65, 45, 65);

      // Rose window
      ctx.fillStyle = "#18191c";
      ctx.beginPath();
      ctx.arc(nx + 85, ny + 45, 26, 0, Math.PI * 2);
      ctx.fill();

      // River Seine & Bridge
      const riverAmalgam = 0.45 * amalgamBoost;
      ctx.fillStyle = `rgb(${Math.round(180 * riverAmalgam)}, ${Math.round(180 * riverAmalgam)}, ${Math.round(180 * riverAmalgam)})`;
      ctx.fillRect(0, h * 0.58, w, h * 0.42);

      // Passing barge (25s in multi-minute exposure -> vanished)
      const bargeVis = DaguerreEngine.calculateMovementIntegration(25, totalExposure);
      if (bargeVis > 0.01) {
        ctx.save();
        ctx.globalAlpha = bargeVis;
        ctx.fillStyle = "rgb(80, 80, 80)";
        ctx.fillRect(w * 0.35, h * 0.78, 90, 22);
        ctx.restore();
      }
    }

    // Apply chemical fogging if present
    if (fogAmount > 0.01) {
      ctx.fillStyle = `rgba(200, 200, 200, ${fogAmount})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  // Render the finished 3D-tilted Daguerreotype plate in the Inspector
  function renderInspectorPlate(timestamp) {
    const iw = inspectCanvas.width;
    const ih = inspectCanvas.height;
    inspectCtx.clearRect(0, 0, iw, ih);

    // 1. Draw ornate 19th-century embossed leather & velvet folding case
    // Outer Moroccan leather casing
    inspectCtx.fillStyle = "#2c1810";
    inspectCtx.fillRect(15, 15, iw - 30, ih - 30);

    // Embossed gold leaf border
    inspectCtx.strokeStyle = "#c89d3a";
    inspectCtx.lineWidth = 3;
    inspectCtx.strokeRect(25, 25, iw - 50, ih - 50);

    // Rich crimson velvet interior pad
    inspectCtx.fillStyle = "#5c121e";
    inspectCtx.fillRect(35, 35, iw - 70, ih - 70);

    // Stamped pinchbeck brass mat (Preserver frame)
    const matGrad = inspectCtx.createLinearGradient(45, 45, iw - 45, ih - 45);
    matGrad.addColorStop(0, "#d8a846");
    matGrad.addColorStop(0.5, "#f5cf74");
    matGrad.addColorStop(1, "#b5842c");
    inspectCtx.fillStyle = matGrad;
    inspectCtx.fillRect(45, 45, iw - 90, ih - 90);

    // Mat inner oval / arched cutout
    const pw = iw - 130;
    const ph = ih - 130;
    const px = 65;
    const py = 65;

    // 2. Synthesize Plate Image onto offscreen buffer
    renderProcessedPlateToCanvas(offscreenPlateCanvas, pw, ph, state.tiltAngleX, true, 1.0, 0.0);

    // 3. Compute Real-Time Specular Reflection & Positive/Negative Inversion
    // Total tilt angle from dark axis
    const totalTilt = Math.sqrt(state.tiltAngleX * state.tiltAngleX + state.tiltAngleY * state.tiltAngleY);
    const refl = DaguerreEngine.calculateReflection(0.5, totalTilt, state.ambientLux, state.isGoldToned);

    // Draw the plate inside the brass mat
    inspectCtx.save();
    inspectCtx.beginPath();
    inspectCtx.rect(px, py, pw, ph);
    inspectCtx.clip();

    // Draw base plate image
    inspectCtx.drawImage(offscreenPlateCanvas, px, py, pw, ph);

    // 4. Physical Specular Mirror Reflection Overlay
    // When tilted towards light source (high glare), specular mirror reflects bright white!
    if (refl.glareAmount > 0.02) {
      // Glare gradient reflecting the room lamp/window
      const glareGrad = inspectCtx.createLinearGradient(
        px + pw * 0.2 + state.tiltAngleX * 4,
        py + state.tiltAngleY * 4,
        px + pw * 0.8 + state.tiltAngleX * 4,
        py + ph + state.tiltAngleY * 4
      );

      const glareIntensity = refl.glareAmount * (state.isGoldToned ? 0.85 : 1.0);
      glareGrad.addColorStop(0, `rgba(255, 250, 240, ${glareIntensity * 0.95})`);
      glareGrad.addColorStop(0.5, `rgba(240, 230, 210, ${glareIntensity * 0.4})`);
      glareGrad.addColorStop(1, `rgba(255, 255, 255, ${glareIntensity * 0.85})`);

      // Invert shadows to blazing bright specular reflections!
      inspectCtx.globalCompositeOperation = refl.isNegativeMode ? "difference" : "screen";
      inspectCtx.fillStyle = glareGrad;
      inspectCtx.fillRect(px, py, pw, ph);
      inspectCtx.globalCompositeOperation = "source-over";
    }

    // Gold Toning Warmth / Contrast Tint
    if (state.isGoldToned) {
      inspectCtx.fillStyle = "rgba(180, 130, 50, 0.08)";
      inspectCtx.fillRect(px, py, pw, ph);
    }

    // Protective Cover Glass Sheen
    const glassGrad = inspectCtx.createLinearGradient(px, py, px + pw, py + ph);
    glassGrad.addColorStop(0, "rgba(255, 255, 255, 0.15)");
    glassGrad.addColorStop(0.4, "rgba(255, 255, 255, 0.0)");
    glassGrad.addColorStop(0.7, "rgba(255, 255, 255, 0.08)");
    glassGrad.addColorStop(1, "rgba(255, 255, 255, 0.22)");
    inspectCtx.fillStyle = glassGrad;
    inspectCtx.fillRect(px, py, pw, ph);

    inspectCtx.restore();

    // Mat inner bevel stroke
    inspectCtx.strokeStyle = "#8a5818";
    inspectCtx.lineWidth = 3;
    inspectCtx.strokeRect(px, py, pw, ph);

    // Update Status Indicator in Inspector
    const modeEl = document.getElementById("inspectorModeLabel");
    if (modeEl) {
      if (refl.isNegativeMode) {
        modeEl.innerHTML = `<span class="badge badge-negative">NEGATIVE INVERSION</span> (Polished mirror is reflecting bright light into your eyes, overpowering the matte amalgam!)`;
      } else {
        modeEl.innerHTML = `<span class="badge badge-positive">POSITIVE IMAGE</span> (Polished mirror is reflecting dark room/velvet, making shadows pitch black while amalgam glows!)`;
      }
    }

    // 5. Watchmaker's Loupe (10x Magnification) overlay if active
    if (state.loupeActive && loupeCtx) {
      renderLoupe(px, py, pw, ph);
    }
  }

  function renderLoupe(px, py, pw, ph) {
    const lw = loupeCanvas.width;
    const lh = loupeCanvas.height;
    loupeCtx.clearRect(0, 0, lw, lh);

    // Target center coordinates on the plate
    const targetX = px + state.loupeX * pw;
    const targetY = py + state.loupeY * ph;

    // Circular loupe frame
    loupeCtx.save();
    loupeCtx.beginPath();
    loupeCtx.arc(lw * 0.5, lh * 0.5, lw * 0.46, 0, Math.PI * 2);
    loupeCtx.clip();

    // Magnified view (8x zoom)
    const zoom = 6.0;
    const srcW = lw / zoom;
    const srcH = lh / zoom;
    const srcX = Math.max(px, Math.min(px + pw - srcW, targetX - srcW * 0.5));
    const srcY = Math.max(py, Math.min(py + ph - srcH, targetY - srcH * 0.5));

    loupeCtx.drawImage(inspectCanvas, srcX, srcY, srcW, srcH, 0, 0, lw, lh);

    // Microscopic amalgam crystal grain structure simulation
    loupeCtx.fillStyle = "rgba(255, 255, 255, 0.08)";
    for (let i = 0; i < 400; i++) {
      const gx = Math.random() * lw;
      const gy = Math.random() * lh;
      loupeCtx.fillRect(gx, gy, 1.5, 1.5);
    }

    // Loupe lens glass reflection
    const lensGrad = loupeCtx.createRadialGradient(lw * 0.35, lh * 0.35, 10, lw * 0.5, lh * 0.5, lw * 0.5);
    lensGrad.addColorStop(0, "rgba(255, 255, 255, 0.2)");
    lensGrad.addColorStop(0.8, "rgba(255, 255, 255, 0.0)");
    lensGrad.addColorStop(1, "rgba(0, 0, 0, 0.4)");
    loupeCtx.fillStyle = lensGrad;
    loupeCtx.fillRect(0, 0, lw, lh);

    loupeCtx.restore();

    // Brass Loupe Outer Bezel
    loupeCtx.strokeStyle = "#c89d3a";
    loupeCtx.lineWidth = 8;
    loupeCtx.beginPath();
    loupeCtx.arc(lw * 0.5, lh * 0.5, lw * 0.46, 0, Math.PI * 2);
    loupeCtx.stroke();
  }

  function downloadInspectorPlate() {
    const link = document.createElement("a");
    link.download = `daguerreotype_1839_${state.selectedScene}_${state.tiltAngleX}deg.png`;
    link.href = inspectCanvas.toDataURL("image/png");
    link.click();
  }

})();
