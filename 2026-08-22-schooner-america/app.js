/**
 * 1851 Schooner America Simulation Studio Controller
 */

import { SailingSimulation, HULL_PRESETS, DEG_TO_RAD, RAD_TO_DEG } from "./physics.js";
import { SeaRenderer } from "./renderer.js";
import { PolarRenderer } from "./polar.js";
import { SailingAudio } from "./audio.js";

class App {
  constructor() {
    // Canvas Elements
    this.seaCanvas = document.getElementById("sea-canvas");
    this.polarCanvas = document.getElementById("polar-canvas");

    // Engine & Renderers
    this.sim = new SailingSimulation("america");
    this.seaRenderer = new SeaRenderer(this.seaCanvas);
    this.polarRenderer = new PolarRenderer(this.polarCanvas);
    this.audio = new SailingAudio();

    // DOM UI Elements
    this.dom = {
      scenarioSelect: document.getElementById("scenario-select"),
      hullSelect: document.getElementById("hull-select"),
      audioBtn: document.getElementById("audio-toggle-btn"),
      toggleVectors: document.getElementById("toggle-vectors"),
      toggleStreamlines: document.getElementById("toggle-streamlines"),
      toggleWake: document.getElementById("toggle-wake"),
      toggleTelltales: document.getElementById("toggle-telltales"),
      statusBadge: document.getElementById("sail-status-badge"),

      rudderSlider: document.getElementById("rudder-slider"),
      rudderVal: document.getElementById("rudder-val"),
      btnPort: document.getElementById("btn-helm-port"),
      btnCenter: document.getElementById("btn-helm-center"),
      btnStbd: document.getElementById("btn-helm-stbd"),

      sheetSlider: document.getElementById("sheet-slider"),
      sheetVal: document.getElementById("sheet-val"),
      btnSheetIn: document.getElementById("btn-sheet-in"),
      btnSheetOut: document.getElementById("btn-sheet-out"),
      btnAutoTrim: document.getElementById("btn-auto-trim"),

      twsSlider: document.getElementById("tws-slider"),
      twsVal: document.getElementById("tws-val"),
      twdSlider: document.getElementById("twd-slider"),
      twdVal: document.getElementById("twd-val"),

      mSpeed: document.getElementById("m-speed"),
      mVmg: document.getElementById("m-vmg"),
      mAws: document.getElementById("m-aws"),
      mAwa: document.getElementById("m-awa"),
      mTwa: document.getElementById("m-twa"),
      mHeel: document.getElementById("m-heel"),
      mLeeway: document.getElementById("m-leeway"),
      mThrust: document.getElementById("m-thrust"),
      froudeBadge: document.getElementById("froude-badge"),
    };

    this.lastTime = performance.now();
    this.paused = false;

    this.bindEvents();
    this.handleResize();
    this.loadScenario("historic-1851");
    this.setupDemoAPI();

    // Start Main Loop
    requestAnimationFrame((ts) => this.loop(ts));
  }

  handleResize() {
    this.seaRenderer.resize();
    this.polarRenderer.resize();
  }

  bindEvents() {
    window.addEventListener("resize", () => this.handleResize());

    // Scenario Select
    this.dom.scenarioSelect.addEventListener("change", (e) => {
      this.loadScenario(e.target.value);
    });

    // Hull Select
    this.dom.hullSelect.addEventListener("change", (e) => {
      this.sim.setHull(e.target.value);
      this.polarRenderer.updatePolars(this.sim.tws_knots);
    });

    // Audio Toggle
    this.dom.audioBtn.addEventListener("click", () => {
      const isMuted = !this.audio.muted;
      this.audio.setMuted(isMuted);
      this.dom.audioBtn.querySelector(".btn-icon").textContent = isMuted ? "🔇" : "🔊";
      this.dom.audioBtn.querySelector(".btn-label").textContent = isMuted ? "Audio Off" : "Audio On";
    });

    // Toggles
    this.dom.toggleVectors.addEventListener("change", (e) => {
      this.seaRenderer.showVectors = e.target.checked;
    });
    this.dom.toggleStreamlines.addEventListener("change", (e) => {
      this.seaRenderer.showStreamlines = e.target.checked;
    });
    this.dom.toggleWake.addEventListener("change", (e) => {
      this.seaRenderer.showWake = e.target.checked;
    });
    this.dom.toggleTelltales.addEventListener("change", (e) => {
      this.seaRenderer.showTelltales = e.target.checked;
    });

    // Rudder / Helm
    this.dom.rudderSlider.addEventListener("input", (e) => {
      this.setRudder(parseFloat(e.target.value));
    });
    this.dom.btnPort.addEventListener("click", () => {
      this.setRudder(this.sim.rudder_rad * RAD_TO_DEG - 8);
    });
    this.dom.btnCenter.addEventListener("click", () => {
      this.setRudder(0);
    });
    this.dom.btnStbd.addEventListener("click", () => {
      this.setRudder(this.sim.rudder_rad * RAD_TO_DEG + 8);
    });

    // Sail Sheet Trim
    this.dom.sheetSlider.addEventListener("input", (e) => {
      this.sim.autoTrim = false;
      this.dom.btnAutoTrim.classList.remove("active");
      this.dom.btnAutoTrim.textContent = "Auto-Trim: OFF";
      this.sim.sheet_rad = parseFloat(e.target.value) * DEG_TO_RAD;
    });
    this.dom.btnSheetIn.addEventListener("click", () => {
      this.sim.autoTrim = false;
      this.dom.btnAutoTrim.classList.remove("active");
      this.dom.btnAutoTrim.textContent = "Auto-Trim: OFF";
      const cur = this.sim.sheet_rad * RAD_TO_DEG;
      this.sim.sheet_rad = Math.max(2, cur - 6) * DEG_TO_RAD;
      this.dom.sheetSlider.value = this.sim.sheet_rad * RAD_TO_DEG;
    });
    this.dom.btnSheetOut.addEventListener("click", () => {
      this.sim.autoTrim = false;
      this.dom.btnAutoTrim.classList.remove("active");
      this.dom.btnAutoTrim.textContent = "Auto-Trim: OFF";
      const cur = this.sim.sheet_rad * RAD_TO_DEG;
      this.sim.sheet_rad = Math.min(85, cur + 6) * DEG_TO_RAD;
      this.dom.sheetSlider.value = this.sim.sheet_rad * RAD_TO_DEG;
    });
    this.dom.btnAutoTrim.addEventListener("click", () => {
      this.sim.autoTrim = !this.sim.autoTrim;
      this.dom.btnAutoTrim.classList.toggle("active", this.sim.autoTrim);
      this.dom.btnAutoTrim.textContent = `Auto-Trim: ${this.sim.autoTrim ? "ON" : "OFF"}`;
    });

    // True Wind Speed & Direction
    this.dom.twsSlider.addEventListener("input", (e) => {
      this.sim.tws_knots = parseFloat(e.target.value);
      this.polarRenderer.updatePolars(this.sim.tws_knots);
    });
    this.dom.twdSlider.addEventListener("input", (e) => {
      this.sim.twd_deg = parseFloat(e.target.value);
    });

    // Keyboard controls
    window.addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
      if (e.key === "a" || e.key === "ArrowLeft") {
        this.setRudder(this.sim.rudder_rad * RAD_TO_DEG - 5);
      } else if (e.key === "d" || e.key === "ArrowRight") {
        this.setRudder(this.sim.rudder_rad * RAD_TO_DEG + 5);
      } else if (e.key === "w" || e.key === "ArrowUp") {
        this.dom.btnSheetIn.click();
      } else if (e.key === "s" || e.key === "ArrowDown") {
        this.dom.btnSheetOut.click();
      } else if (e.key === "t" || e.key === "T") {
        this.dom.btnAutoTrim.click();
      } else if (e.key === "m" || e.key === "M") {
        this.dom.audioBtn.click();
      } else if (e.key === " ") {
        this.paused = !this.paused;
      }
    });
  }

  setRudder(deg) {
    const clamped = Math.max(-30, Math.min(30, deg));
    this.sim.rudder_rad = clamped * DEG_TO_RAD;
    this.dom.rudderSlider.value = clamped;
    this.dom.rudderVal.textContent = `${clamped > 0 ? "+" : ""}${clamped.toFixed(1)}°`;
  }

  loadScenario(scenarioName) {
    if (scenarioName === "historic-1851") {
      // 1851 Regatta Start: 14kt NE breeze, America close-hauled heading ~005 deg
      this.sim.setHull("america");
      this.sim.tws_knots = 14.0;
      this.sim.twd_deg = 45.0; // NE wind
      this.sim.heading_rad = 5.0 * DEG_TO_RAD;
      this.sim.bspeed_ms = 4.8;
      this.sim.autoTrim = true;
      this.setRudder(0);
    } else if (scenarioName === "upwind-beat") {
      // 40° TWA close-hauled duel
      this.sim.setHull("america");
      this.sim.tws_knots = 16.0;
      this.sim.twd_deg = 0.0;
      this.sim.heading_rad = 40.0 * DEG_TO_RAD;
      this.sim.bspeed_ms = 5.2;
      this.sim.autoTrim = true;
      this.setRudder(0);
    } else if (scenarioName === "beam-reach") {
      // 90° TWA maximum sprint
      this.sim.setHull("america");
      this.sim.tws_knots = 18.0;
      this.sim.twd_deg = 0.0;
      this.sim.heading_rad = 90.0 * DEG_TO_RAD;
      this.sim.bspeed_ms = 6.8;
      this.sim.autoTrim = true;
      this.setRudder(0);
    } else if (scenarioName === "bow-wave-duel") {
      // Switch to Aurora to demonstrate Cod's head bow wave wall
      this.sim.setHull("aurora");
      this.sim.tws_knots = 16.0;
      this.sim.twd_deg = 0.0;
      this.sim.heading_rad = 60.0 * DEG_TO_RAD;
      this.sim.bspeed_ms = 3.5;
      this.sim.autoTrim = true;
      this.setRudder(0);
    } else if (scenarioName === "sail-stall-lab") {
      // Baggy flax sail stall test
      this.sim.setHull("aurora");
      this.sim.tws_knots = 15.0;
      this.sim.twd_deg = 0.0;
      this.sim.heading_rad = 42.0 * DEG_TO_RAD;
      this.sim.bspeed_ms = 2.0;
      this.sim.autoTrim = false;
      this.sim.sheet_rad = 10.0 * DEG_TO_RAD; // Over-sheeted -> stall!
      this.setRudder(0);
    }

    this.dom.scenarioSelect.value = scenarioName;
    this.dom.hullSelect.value = this.sim.hullKey;
    this.polarRenderer.updatePolars(this.sim.tws_knots);
  }

  updateHUD() {
    const telem = this.sim.telemetry;

    // Sliders & value displays
    this.dom.twsVal.textContent = `${telem.tws_knots.toFixed(1)} kts`;
    this.dom.twsSlider.value = telem.tws_knots;

    const twdDeg = Math.round(telem.twd_deg);
    const twdDirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
    const dirIdx = Math.floor(((twdDeg + 11.25) % 360) / 22.5);
    this.dom.twdVal.textContent = `${String(twdDeg).padStart(3, "0")}° (${twdDirs[dirIdx]})`;
    this.dom.twdSlider.value = twdDeg;

    this.dom.sheetVal.textContent = `${telem.sheet_deg.toFixed(1)}°`;
    this.dom.sheetSlider.value = telem.sheet_deg;

    // Telemetry Metrics
    this.dom.mSpeed.innerHTML = `${telem.speed_knots.toFixed(1)} <small>kts</small>`;
    this.dom.mVmg.innerHTML = `${telem.vmg_knots.toFixed(1)} <small>kts</small>`;
    this.dom.mAws.innerHTML = `${telem.aws_knots.toFixed(1)} <small>kts</small>`;
    this.dom.mAwa.textContent = `${Math.abs(telem.awa_deg).toFixed(0)}° ${telem.awa_deg >= 0 ? "STBD" : "PORT"}`;
    this.dom.mTwa.textContent = `${Math.abs(telem.twa_deg).toFixed(0)}°`;
    this.dom.mHeel.textContent = `${Math.abs(telem.heel_deg).toFixed(1)}°`;
    this.dom.mLeeway.textContent = `${Math.abs(telem.leeway_deg).toFixed(1)}°`;
    this.dom.mThrust.innerHTML = `${Math.round(telem.thrust)} <small>N</small>`;
    this.dom.froudeBadge.textContent = `Fr: ${telem.froudeNumber.toFixed(2)}`;

    // Status Badge
    const badge = this.dom.statusBadge;
    if (telem.inIrons) {
      badge.textContent = "IN IRONS (No Go Zone)";
      badge.className = "floating-badge status-irons";
    } else if (telem.isLuffing) {
      badge.textContent = "SAIL LUFFING (Backwinded)";
      badge.className = "floating-badge status-luffing";
    } else if (telem.stalled) {
      badge.textContent = "SAIL STALLED (Over-sheeted)";
      badge.className = "floating-badge status-stalled";
    } else {
      badge.textContent = "OPTIMAL AIRFOIL TRIM";
      badge.className = "floating-badge status-optimal";
    }
  }

  loop(timestamp) {
    const dt = Math.min((timestamp - this.lastTime) / 1000.0, 0.1);
    this.lastTime = timestamp;

    if (!this.paused) {
      this.sim.update(dt);
      this.seaRenderer.updateParticles(dt, this.sim);
      this.audio.update(this.sim.telemetry);
    }

    this.seaRenderer.render(this.sim);
    this.polarRenderer.render(this.sim);
    this.updateHUD();

    requestAnimationFrame((ts) => this.loop(ts));
  }

  setupDemoAPI() {
    window.__demo = {
      setHull: (key) => {
        this.sim.setHull(key);
        this.dom.hullSelect.value = key;
        this.polarRenderer.updatePolars(this.sim.tws_knots);
      },
      loadScenario: (name) => this.loadScenario(name),
      setWind: (speedKnots, dirDeg) => {
        this.sim.tws_knots = speedKnots;
        this.sim.twd_deg = dirDeg;
        this.polarRenderer.updatePolars(speedKnots);
      },
      setHeading: (deg) => {
        this.sim.heading_rad = deg * DEG_TO_RAD;
      },
      setRudder: (deg) => this.setRudder(deg),
      setSheet: (deg, autoTrim = false) => {
        this.sim.autoTrim = autoTrim;
        this.sim.sheet_rad = deg * DEG_TO_RAD;
        this.dom.btnAutoTrim.classList.toggle("active", autoTrim);
        this.dom.btnAutoTrim.textContent = `Auto-Trim: ${autoTrim ? "ON" : "OFF"}`;
      },
      getState: () => ({
        x: this.sim.x,
        y: this.sim.y,
        heading_deg: this.sim.heading_rad * RAD_TO_DEG,
        speed_knots: this.sim.telemetry.speed_knots,
        heel_deg: this.sim.telemetry.heel_deg,
      }),
      getTelemetry: () => this.sim.telemetry,
      toggleMute: (muted) => this.audio.setMuted(muted),
    };
  }
}

window.addEventListener("DOMContentLoaded", () => {
  window.app = new App();
});
