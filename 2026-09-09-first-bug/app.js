// app.js — 1947 Harvard Mark II First Bug Interactive Studio
import {
  RELAY_CONSTANTS,
  TAU_COIL,
  I_MAX,
  createRelayState,
  stepRelay,
  relayFullAdder,
  relayAnd,
  relayOr,
  relayNot,
  relayXor,
  simulatePanelFAddition,
  TIMELINE_EVENTS,
} from "./physics.js";

// Helper shorthand
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// ── 1 · Audio Synthesizer (Web Audio API) ────────────────────────────────────

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.userInteracted = false;
    window.addEventListener("pointerdown", () => { this.userInteracted = true; }, { once: true });
    window.addEventListener("keydown", () => { this.userInteracted = true; }, { once: true });
  }

  init() {
    if (!this.userInteracted) return;
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  playRelayClick(bounces = 2) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    // Primary sharp metallic impact
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.015);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.02);

    // Micro contact bounces
    for (let i = 1; i <= bounces; i++) {
      const bt = t + 0.003 * i;
      const bOsc = this.ctx.createOscillator();
      const bGain = this.ctx.createGain();
      bOsc.type = "sine";
      bOsc.frequency.setValueAtTime(1800, bt);
      bOsc.frequency.exponentialRampToValueAtTime(300, bt + 0.006);
      bGain.gain.setValueAtTime(0.15 / i, bt);
      bGain.gain.exponentialRampToValueAtTime(0.001, bt + 0.008);
      bOsc.connect(bGain);
      bGain.connect(this.ctx.destination);
      bOsc.start(bt);
      bOsc.stop(bt + 0.008);
    }
  }

  playRelayRelease() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    // Lower pitched spring back-clack
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(450, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.025);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.03);
  }

  playAlarmBuzzer() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // 1940s mechanical buzzer: 480 Hz with heavy distortion / square tone
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(480, t);

    // Modulation
    const mod = this.ctx.createOscillator();
    const modGain = this.ctx.createGain();
    mod.frequency.setValueAtTime(60, t); // 60 Hz line flutter
    modGain.gain.setValueAtTime(120, t);
    mod.connect(osc.frequency);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    mod.start(t);
    osc.start(t);
    mod.stop(t + 0.35);
    osc.stop(t + 0.35);
  }

  playTweezers() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(2400, t);
    osc.frequency.exponentialRampToValueAtTime(3200, t + 0.08);

    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.1);
  }
}

const sound = new SoundEngine();

// ── 2 · Global Application State ─────────────────────────────────────────────

const state = {
  currentTab: "bench",
  audio: true,
  videoMode: false,

  // Bench (Tab 1)
  relay: createRelayState(),
  hasMoth: true,
  snubberOn: true,
  tweezersActive: false,
  oscHistory: [], // [{ t, current, vContact }]
  oscT: 0,

  // Rack (Tab 2)
  rackOpA: 65,
  rackOpB: 10,
  rackMothOn70: true,
  rackClockTimer: null,
  rackRunning: false,
  rackResult: null,

  // Logic (Tab 3)
  activeGate: "adder",
  logicInputs: { a: 1, b: 1, cin: 0 },
};

// ── 3 · Tab Navigation ───────────────────────────────────────────────────────

function setTab(tabId) {
  state.currentTab = tabId;
  $$(".nav-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });
  $$(".tab-pane").forEach((pane) => {
    pane.classList.toggle("active", pane.id === `tab-${tabId}`);
  });

  if (tabId === "rack") {
    executeRackStep();
  } else if (tabId === "logic") {
    drawGateCanvas();
  }
}

$$(".nav-tab").forEach((btn) => {
  btn.addEventListener("click", () => setTab(btn.dataset.tab));
});

// Audio button
$("#btn-audio").addEventListener("click", () => {
  sound.init();
  state.audio = !state.audio;
  sound.enabled = state.audio;
  $("#audio-icon").textContent = state.audio ? "🔊" : "🔇";
  $("#audio-text").textContent = state.audio ? "Audio: ON" : "Audio: OFF";
  $("#btn-audio").classList.toggle("active", state.audio);
});

// ── 4 · Tab 1: Relay #70 Bench Canvas & Physics ──────────────────────────────

const relayCanvas = $("#relay-canvas");
const relayCtx = relayCanvas.getContext("2d");
const oscCanvas = $("#osc-canvas");
const oscCtx = oscCanvas.getContext("2d");

function toggleCoilPower(forceState = null) {
  const next = forceState !== null ? forceState : !state.relay.energized;
  if (next !== state.relay.energized) {
    state.relay.energized = next;
    state.relay.coilT = 0;
    if (next) {
      $("#btn-power-coil").classList.add("active");
      $("#btn-power-coil").innerHTML = `<span class="btn-icon">⚡</span> Power: 50V ON`;
    } else {
      $("#btn-power-coil").classList.remove("active");
      $("#btn-power-coil").innerHTML = `<span class="btn-icon">⚡</span> Power Coil (50V DC)`;
      sound.playRelayRelease();
    }
  }
}

$("#btn-power-coil").addEventListener("click", () => toggleCoilPower());

$("#btn-pulse-coil").addEventListener("click", () => {
  toggleCoilPower(true);
  setTimeout(() => toggleCoilPower(false), 25);
});

function toggleMoth(force = null) {
  const next = force !== null ? force : !state.hasMoth;
  state.hasMoth = next;
  state.rackMothOn70 = next;
  sound.playTweezers();

  // Animation visual feedback
  state.tweezersActive = true;
  setTimeout(() => { state.tweezersActive = false; }, 400);

  const btnText = next ? "Extract Moth (镊子夹出)" : "Insert Moth (放入飞蛾)";
  $("#moth-btn-text").textContent = btnText;
  $("#btn-toggle-moth").classList.toggle("btn-warning", next);
  $("#btn-toggle-moth").classList.toggle("btn-secondary", !next);
  $("#btn-rack-moth").textContent = `Moth on Relay #70: ${next ? "ON" : "OFF"}`;
  $("#btn-rack-moth").classList.toggle("btn-warning", next);
  $("#btn-rack-moth").classList.toggle("btn-outline", !next);

  // Re-run rack if open
  if (state.currentTab === "rack") executeRackStep();
}

$("#btn-toggle-moth").addEventListener("click", () => toggleMoth());
$("#btn-rack-moth").addEventListener("click", () => toggleMoth());

$("#btn-snubber").addEventListener("click", () => {
  state.snubberOn = !state.snubberOn;
  $("#btn-snubber").classList.toggle("active", state.snubberOn);
  $("#btn-snubber").textContent = `RC Snubber: ${state.snubberOn ? "ON" : "OFF"}`;
});

// Update Telemetry Meters
function updateTelemetry() {
  const r = state.relay;
  const volt = r.energized ? 50.0 : (r.current * 250);
  const currMa = r.current * 1000;
  const xMm = r.xMm;

  $("#m-volt").innerHTML = `${volt.toFixed(1)} <small>V</small>`;
  $("#m-curr").innerHTML = `${currMa.toFixed(1)} <small>mA</small>`;
  $("#m-gap").innerHTML = `${xMm.toFixed(2)} <small>mm</small>`;

  $("#bar-volt").style.width = `${Math.min(100, (volt / 50) * 100)}%`;
  $("#bar-curr").style.width = `${Math.min(100, (currMa / 200) * 100)}%`;
  $("#bar-gap").style.width = `${Math.min(100, (xMm / 1.2) * 100)}%`;

  const statusPill = $("#relay-state-pill");
  const mRes = $("#m-res");
  const mStatus = $("#m-contact-status");

  if (r.isClosed) {
    statusPill.className = "status-pill closed";
    statusPill.textContent = "STATUS: CLOSED & CONDUCTING";
    mRes.className = "meter-value val-success";
    mRes.innerHTML = `0.02 <small>Ω</small>`;
    mStatus.textContent = "CLOSED (SILVER CONTACT)";
    mStatus.style.color = "var(--color-cyan)";
  } else if (state.hasMoth && r.energized && xMm >= 0.55) {
    statusPill.className = "status-pill blocked";
    statusPill.textContent = "STATUS: FAULT (MOTH BLOCKED)";
    mRes.className = "meter-value val-danger";
    mRes.innerHTML = `&gt;100 <small>MΩ</small>`;
    mStatus.textContent = "BLOCKED BY MOTH TISSUE";
    mStatus.style.color = "var(--color-red)";
  } else {
    statusPill.className = "status-pill";
    statusPill.textContent = r.energized ? "STATUS: PULLING IN..." : "STATUS: RESTING";
    mRes.className = "meter-value";
    mRes.innerHTML = `∞ <small>Ω</small>`;
    mStatus.textContent = "OPEN (AIR GAP)";
    mStatus.style.color = "var(--text-secondary)";
  }
}

// Draw Relay Cross Section SVG-style on Canvas
function drawRelay() {
  const w = relayCanvas.width;
  const h = relayCanvas.height;
  relayCtx.clearRect(0, 0, w, h);

  // Background grid
  relayCtx.fillStyle = "#0c0f14";
  relayCtx.fillRect(0, 0, w, h);

  relayCtx.strokeStyle = "rgba(255, 255, 255, 0.03)";
  relayCtx.lineWidth = 1;
  for (let x = 0; x < w; x += 40) {
    relayCtx.beginPath();
    relayCtx.moveTo(x, 0);
    relayCtx.lineTo(x, h);
    relayCtx.stroke();
  }
  for (let y = 0; y < h; y += 40) {
    relayCtx.beginPath();
    relayCtx.moveTo(0, y);
    relayCtx.lineTo(w, y);
    relayCtx.stroke();
  }

  // 1. Heavy Bakelite Base / Enclosure
  relayCtx.fillStyle = "#221a14";
  relayCtx.fillRect(60, 420, 680, 50);
  relayCtx.fillStyle = "#18120e";
  relayCtx.fillRect(60, 460, 680, 10);
  // Brass terminals
  relayCtx.fillStyle = "#d4af37";
  relayCtx.fillRect(80, 430, 24, 30);
  relayCtx.fillRect(700, 430, 24, 30);

  // 2. Iron Core (E-shaped electromagnet)
  const coreX = 140;
  const coreY = 160;
  relayCtx.fillStyle = "#4a5568";
  relayCtx.strokeStyle = "#2d3748";
  relayCtx.lineWidth = 2;
  // Core back yoke
  relayCtx.fillRect(coreX, coreY, 50, 240);
  relayCtx.strokeRect(coreX, coreY, 50, 240);
  // Center pole
  relayCtx.fillRect(coreX + 50, coreY + 70, 120, 100);
  relayCtx.strokeRect(coreX + 50, coreY + 70, 120, 100);
  // Pole face (front)
  relayCtx.fillStyle = "#718096";
  relayCtx.fillRect(coreX + 170, coreY + 70, 10, 100);

  // 3. Copper Coil Bobbin around center pole
  const coilX = coreX + 60;
  const coilY = coreY + 55;
  const coilW = 100;
  const coilH = 130;
  const currentFactor = state.relay.current / I_MAX; // 0..1

  // Bobbin flanges
  relayCtx.fillStyle = "#1a202c";
  relayCtx.fillRect(coilX - 6, coilY - 10, 8, coilH + 20);
  relayCtx.fillRect(coilX + coilW - 2, coilY - 10, 8, coilH + 20);

  // Copper Wire Turns
  relayCtx.fillStyle = state.relay.energized ? "#d97736" : "#8c4a1b";
  relayCtx.fillRect(coilX + 2, coilY, coilW - 4, coilH);

  // Wire turn lines
  relayCtx.strokeStyle = state.relay.energized ? "#ffaa5e" : "#542c10";
  relayCtx.lineWidth = 2;
  for (let py = coilY + 6; py < coilY + coilH; py += 8) {
    relayCtx.beginPath();
    relayCtx.moveTo(coilX + 2, py);
    relayCtx.lineTo(coilX + coilW - 2, py);
    relayCtx.stroke();
  }

  // Coil magnetic glow when energized
  if (state.relay.energized && currentFactor > 0.1) {
    relayCtx.fillStyle = `rgba(255, 170, 51, ${0.15 * currentFactor})`;
    relayCtx.fillRect(coilX - 15, coilY - 15, coilW + 30, coilH + 30);
  }

  // 4. Armature Pivot & Blade
  // Armature is hinged at top right and pulled towards pole face
  const pivotX = 420;
  const pivotY = 120;
  const xDisplacement = (state.relay.xMm / RELAY_CONSTANTS.TRAVEL_MAX) * 48; // px displacement

  // Pivot bracket
  relayCtx.fillStyle = "#4a5568";
  relayCtx.beginPath();
  relayCtx.arc(pivotX, pivotY, 14, 0, Math.PI * 2);
  relayCtx.fill();
  relayCtx.stroke();
  relayCtx.fillStyle = "#a0aec0";
  relayCtx.beginPath();
  relayCtx.arc(pivotX, pivotY, 6, 0, Math.PI * 2);
  relayCtx.fill();

  // Armature Blade (Steel)
  relayCtx.save();
  relayCtx.translate(pivotX, pivotY);
  // Calculate angle based on xDisplacement
  const armAngle = (xDisplacement / 280) * 0.22; // radians
  relayCtx.rotate(-armAngle);

  // Steel lever arm
  relayCtx.fillStyle = "#cbd5e0";
  relayCtx.strokeStyle = "#4a5568";
  relayCtx.lineWidth = 2;
  relayCtx.fillRect(-12, 10, 24, 250);
  relayCtx.strokeRect(-12, 10, 24, 250);

  // Iron armature face plate (attracted to pole)
  relayCtx.fillStyle = "#718096";
  relayCtx.fillRect(-22, 100, 10, 80);

  // Moving Contact Arm (Brass strip protruding left)
  relayCtx.fillStyle = "#d4af37";
  relayCtx.fillRect(-70, 240, 60, 12);
  // Upper Silver Contact Stud (Moving)
  relayCtx.fillStyle = "#e2e8f0";
  relayCtx.strokeStyle = "#a0aec0";
  relayCtx.lineWidth = 1;
  relayCtx.fillRect(-68, 252, 20, 10);
  relayCtx.strokeRect(-68, 252, 20, 10);

  relayCtx.restore();

  // 5. Stationary Lower Contact Assembly (Fixed Anvil)
  const anvilX = 330;
  const anvilY = 380;
  // Stationary brass pillar
  relayCtx.fillStyle = "#d4af37";
  relayCtx.fillRect(anvilX, anvilY + 10, 40, 30);
  // Silver Contact Pad (Stationary)
  relayCtx.fillStyle = "#e2e8f0";
  relayCtx.strokeStyle = "#a0aec0";
  relayCtx.lineWidth = 1;
  relayCtx.fillRect(anvilX + 5, anvilY, 30, 10);
  relayCtx.strokeRect(anvilX + 5, anvilY, 30, 10);

  // 6. Return Leaf Spring
  relayCtx.strokeStyle = "#a0aec0";
  relayCtx.lineWidth = 3;
  relayCtx.beginPath();
  relayCtx.moveTo(pivotX + 12, pivotY + 30);
  relayCtx.quadraticCurveTo(pivotX + 50 + xDisplacement * 0.4, pivotY + 100, pivotX + 20, pivotY + 180);
  relayCtx.stroke();

  // 7. The Moth Artifact
  if (state.hasMoth) {
    const mothX = anvilX + 20;
    const mothY = anvilY - 6;

    relayCtx.save();
    relayCtx.translate(mothX, mothY);

    // Wings (spread out over contact)
    relayCtx.fillStyle = "rgba(141, 114, 86, 0.92)";
    relayCtx.beginPath();
    relayCtx.ellipse(-14, -4, 18, 10, -0.25, 0, Math.PI * 2);
    relayCtx.fill();
    relayCtx.beginPath();
    relayCtx.ellipse(14, -4, 18, 10, 0.25, 0, Math.PI * 2);
    relayCtx.fill();

    // Body
    relayCtx.fillStyle = "#3b2b1d";
    relayCtx.beginPath();
    relayCtx.ellipse(0, -2, 5, 12, Math.PI / 2, 0, Math.PI * 2);
    relayCtx.fill();

    // Head and antennae
    relayCtx.fillStyle = "#291e14";
    relayCtx.beginPath();
    relayCtx.arc(-8, -2, 3.5, 0, Math.PI * 2);
    relayCtx.fill();

    relayCtx.strokeStyle = "#291e14";
    relayCtx.lineWidth = 1.5;
    relayCtx.beginPath();
    relayCtx.moveTo(-10, -3);
    relayCtx.lineTo(-18, -9);
    relayCtx.moveTo(-10, -1);
    relayCtx.lineTo(-18, 5);
    relayCtx.stroke();

    relayCtx.restore();

    // Warning highlight on moth contact
    if (state.relay.energized && state.relay.xMm >= 0.55) {
      relayCtx.strokeStyle = "rgba(255, 77, 77, 0.8)";
      relayCtx.lineWidth = 2;
      relayCtx.setLineDash([4, 4]);
      relayCtx.strokeRect(anvilX - 10, anvilY - 24, 60, 44);
      relayCtx.setLineDash([]);
    }
  }

  // 8. Contact Spark / Arc (if clean contact and just closed or bouncing)
  if (!state.hasMoth && state.relay.isClosed) {
    relayCtx.fillStyle = "rgba(56, 217, 169, 0.9)";
    relayCtx.beginPath();
    relayCtx.arc(anvilX + 20, anvilY, 6, 0, Math.PI * 2);
    relayCtx.fill();
    relayCtx.fillStyle = "rgba(255, 255, 255, 0.9)";
    relayCtx.beginPath();
    relayCtx.arc(anvilX + 20, anvilY, 3, 0, Math.PI * 2);
    relayCtx.fill();
  }

  // 9. Tweezers Animation
  if (state.tweezersActive) {
    relayCtx.save();
    relayCtx.translate(anvilX + 15, anvilY - 30);
    relayCtx.strokeStyle = "#cbd5e0";
    relayCtx.lineWidth = 3;
    // Tweezer arms
    relayCtx.beginPath();
    relayCtx.moveTo(-15, -60);
    relayCtx.lineTo(-4, 0);
    relayCtx.moveTo(15, -60);
    relayCtx.lineTo(4, 0);
    relayCtx.stroke();
    relayCtx.restore();
  }

  // Diagnostic Labels
  relayCtx.fillStyle = "#8b949e";
  relayCtx.font = "11px var(--font-mono)";
  relayCtx.fillText("50V ELECTROMAGNET COIL", coreX + 45, coreY + 35);
  relayCtx.fillText("MOVABLE ARMATURE BLADE", pivotX - 40, pivotY - 15);
  relayCtx.fillText(state.hasMoth ? "RELAY #70 CONTACT GAP (MOTH TRAPPED)" : "RELAY #70 SILVER CONTACTS", anvilX - 60, anvilY + 55);
}

// Oscillograph Trace Renderer
function drawOscillograph() {
  const w = oscCanvas.width;
  const h = oscCanvas.height;
  oscCtx.clearRect(0, 0, w, h);

  // Oscilloscope background & grid
  oscCtx.fillStyle = "#070a0e";
  oscCtx.fillRect(0, 0, w, h);

  oscCtx.strokeStyle = "rgba(56, 217, 169, 0.1)";
  oscCtx.lineWidth = 1;
  for (let x = 0; x < w; x += 25) {
    oscCtx.beginPath();
    oscCtx.moveTo(x, 0);
    oscCtx.lineTo(x, h);
    oscCtx.stroke();
  }
  for (let y = 0; y < h; y += 25) {
    oscCtx.beginPath();
    oscCtx.moveTo(0, y);
    oscCtx.lineTo(w, y);
    oscCtx.stroke();
  }

  // Draw Traces if we have history
  if (state.oscHistory.length < 2) return;

  const len = state.oscHistory.length;
  const stepX = w / 150;

  // 1. Current Trace (Yellow)
  oscCtx.strokeStyle = "#ffaa33";
  oscCtx.lineWidth = 2;
  oscCtx.beginPath();
  for (let i = 0; i < len; i++) {
    const pt = state.oscHistory[i];
    const x = i * stepX;
    // Current: 0 to 0.2A -> y from h-20 to 30
    const y = (h - 20) - (pt.current / 0.2) * (h - 50);
    if (i === 0) oscCtx.moveTo(x, y);
    else oscCtx.lineTo(x, y);
  }
  oscCtx.stroke();

  // 2. Contact Conduction Voltage (Cyan)
  oscCtx.strokeStyle = "#38d9a9";
  oscCtx.lineWidth = 2;
  oscCtx.beginPath();
  for (let i = 0; i < len; i++) {
    const pt = state.oscHistory[i];
    const x = i * stepX;
    // 5V if open, 0V if closed
    const v = pt.isClosed ? 0 : 5;
    const y = (h - 20) - (v / 5) * (h - 70);
    if (i === 0) oscCtx.moveTo(x, y);
    else oscCtx.lineTo(x, y);
  }
  oscCtx.stroke();
}

// ── 5 · Tab 2: Panel F Rack & Dual Hardware Check ────────────────────────────

function initRackBay() {
  const bay = $("#relay-rack-bay");
  bay.innerHTML = "";

  for (let bit = 7; bit >= 0; bit--) {
    const relayNum = 64 + bit;
    const isRelay70 = relayNum === 70;
    const unit = document.createElement("div");
    unit.className = `rack-relay-unit ${isRelay70 ? "relay-70" : ""}`;
    unit.id = `rack-relay-${bit}`;
    unit.innerHTML = `
      <div class="relay-id-label">RELAY #${relayNum}</div>
      <div class="relay-bit-badge">BIT ${bit} <small>(2<sup>${bit}</sup>)</small></div>
      <div class="relay-mini-core">
        <div class="mini-coil-turns"></div>
      </div>
      <div class="relay-mini-contact"></div>
      <div class="relay-val-out" id="rack-val-${bit}">0</div>
      ${isRelay70 ? '<div class="moth-icon-mini" id="rack-moth-icon">🐛</div>' : ""}
    `;
    bay.appendChild(unit);
  }
}

function updateRackInputs() {
  const opA = parseInt($("#input-op-a").value, 10) || 0;
  const opB = parseInt($("#input-op-b").value, 10) || 0;
  state.rackOpA = Math.max(0, Math.min(255, opA));
  state.rackOpB = Math.max(0, Math.min(255, opB));

  $("#bin-op-a").textContent = `${state.rackOpA.toString(2).padStart(8, "0")}₂`;
  $("#bin-op-b").textContent = `${state.rackOpB.toString(2).padStart(8, "0")}₂`;
}

$("#input-op-a").addEventListener("input", () => {
  updateRackInputs();
  executeRackStep();
});
$("#input-op-b").addEventListener("input", () => {
  updateRackInputs();
  executeRackStep();
});

// Presets
$("#preset-1947").addEventListener("click", () => {
  $("#input-op-a").value = 65;
  $("#input-op-b").value = 10;
  updateRackInputs();
  executeRackStep();
});

$("#preset-clean").addEventListener("click", () => {
  $("#input-op-a").value = 12;
  $("#input-op-b").value = 15;
  updateRackInputs();
  executeRackStep();
});

$("#preset-ripple").addEventListener("click", () => {
  $("#input-op-a").value = 127;
  $("#input-op-b").value = 1;
  updateRackInputs();
  executeRackStep();
});

function executeRackStep() {
  updateRackInputs();
  const res = simulatePanelFAddition(state.rackOpA, state.rackOpB, state.rackMothOn70);
  state.rackResult = res;

  // Sound
  if (res.hasFault) {
    sound.playAlarmBuzzer();
  } else {
    sound.playRelayClick(1);
  }

  // Update Relays
  for (let bit = 0; bit < 8; bit++) {
    const el = $(`#rack-relay-${bit}`);
    const valEl = $(`#rack-val-${bit}`);
    const isSumHigh = res.bitsSum[bit] === 1;
    const isInputActive = res.bitsA[bit] === 1 || res.bitsB[bit] === 1;

    el.classList.toggle("active-coil", isInputActive);
    el.classList.toggle("active-contact", isSumHigh);
    el.classList.toggle("has-bug", bit === 6 && state.rackMothOn70 && ((res.operandA + res.operandB) & 64) !== 0);

    valEl.textContent = res.bitsSum[bit];
    valEl.className = `relay-val-out ${isSumHigh ? "high" : ""}`;
  }

  const mothIcon = $("#rack-moth-icon");
  if (mothIcon) {
    mothIcon.style.display = state.rackMothOn70 ? "block" : "none";
  }

  // Update Comparator
  $("#chk-expected").textContent = `${res.expectedValue} (${res.expectedValue.toString(2).padStart(8, "0")}₂)`;
  $("#chk-computed").textContent = `${res.computedValue} (${res.computedValue.toString(2).padStart(8, "0")}₂)`;

  const discRow = $("#chk-discrepancy-row");
  const tripBox = $("#trip-result-box");
  const alarmBox = $("#rack-alarm-indicator");
  const statusBadge = $("#machine-status-badge");

  if (res.hasFault) {
    discRow.style.display = "flex";
    $("#chk-discrepancy").textContent = `${res.discrepancy > 0 ? "+" : ""}${res.discrepancy} (Bit 6 Stored 0 instead of 1)`;
    tripBox.className = "trip-result-box";
    $("#trip-icon").textContent = "⚠️";
    $("#trip-title").textContent = "HALT: FAULT DETECTED AT RELAY #70 (PANEL F)";
    $("#trip-desc").textContent = "Dual arithmetic comparison failed. Accumulator bit 6 missing. Physical moth in Relay #70 preventing contact closure.";
    alarmBox.className = "alarm-box tripped";
    $("#alarm-text").textContent = "ALARM: CHECK CIRCUIT TRIPPED";
    statusBadge.className = "badge badge-red";
    statusBadge.textContent = "PANEL F: HALT (RELAY 70)";
  } else {
    discRow.style.display = "flex";
    $("#chk-discrepancy").textContent = "0 (Parity and dual arithmetic match)";
    tripBox.className = "trip-result-box pass";
    $("#trip-icon").textContent = "✓";
    $("#trip-title").textContent = "CHECK CIRCUIT: PASS";
    $("#trip-desc").textContent = "Arithmetic verification successful. Dual channels match, zero discrepancy across all 8 relay bit lines.";
    alarmBox.className = "alarm-box";
    $("#alarm-text").textContent = "CHECK CIRCUIT NORMAL";
    statusBadge.className = "badge badge-amber";
    statusBadge.textContent = "PANEL F: CHECK OK";
  }
}

$("#btn-clock-step").addEventListener("click", () => executeRackStep());

$("#btn-clock-run").addEventListener("click", () => {
  state.rackRunning = !state.rackRunning;
  const btn = $("#btn-clock-run");
  if (state.rackRunning) {
    btn.classList.add("btn-primary");
    btn.textContent = "⏸ Stop Clock";
    state.rackClockTimer = setInterval(() => {
      // Advance operand A slightly for demo animation
      $("#input-op-a").value = (state.rackOpA + 1) % 256;
      executeRackStep();
    }, 125);
  } else {
    btn.classList.remove("btn-primary");
    btn.textContent = "⏱ Auto Run (8 Hz)";
    clearInterval(state.rackClockTimer);
    state.rackClockTimer = null;
  }
});

// ── 6 · Tab 3: Relay Logic & Adder Schematic ─────────────────────────────────

const gateCanvas = $("#gate-canvas");
const gateCtx = gateCanvas.getContext("2d");

$$(".gate-tabs .btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    $$(".gate-tabs .btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.activeGate = btn.dataset.gate;
    updateGateControls();
    drawGateCanvas();
  });
});

function updateGateControls() {
  const container = $("#gate-inputs-container");
  container.innerHTML = "";

  const makeSwitch = (name, label, val) => {
    const b = document.createElement("button");
    b.className = `switch-toggle-btn ${val ? "on" : ""}`;
    b.innerHTML = `<span>Input ${label}:</span> <strong>${val ? "1 (50V)" : "0 (GND)"}</strong>`;
    b.addEventListener("click", () => {
      state.logicInputs[name] = state.logicInputs[name] ? 0 : 1;
      sound.playRelayClick(1);
      updateGateControls();
      drawGateCanvas();
    });
    return b;
  };

  if (state.activeGate === "not") {
    container.appendChild(makeSwitch("a", "A", state.logicInputs.a));
  } else if (state.activeGate === "adder") {
    container.appendChild(makeSwitch("a", "A", state.logicInputs.a));
    container.appendChild(makeSwitch("b", "B", state.logicInputs.b));
    container.appendChild(makeSwitch("cin", "Cin", state.logicInputs.cin));
  } else {
    container.appendChild(makeSwitch("a", "A", state.logicInputs.a));
    container.appendChild(makeSwitch("b", "B", state.logicInputs.b));
  }

  // Update output container
  const outContainer = $("#gate-output-container");
  outContainer.innerHTML = "";
  if (state.activeGate === "adder") {
    const res = relayFullAdder(state.logicInputs.a, state.logicInputs.b, state.logicInputs.cin);
    outContainer.innerHTML = `
      <div class="out-badge ${res.sum ? "high" : ""}">SUM: <strong>${res.sum}</strong></div>
      <div class="out-badge ${res.cout ? "high" : ""}">COUT: <strong>${res.cout}</strong></div>
    `;
  } else if (state.activeGate === "and") {
    const res = relayAnd(state.logicInputs.a, state.logicInputs.b);
    outContainer.innerHTML = `<div class="out-badge ${res ? "high" : ""}">OUT: <strong>${res}</strong></div>`;
  } else if (state.activeGate === "or") {
    const res = relayOr(state.logicInputs.a, state.logicInputs.b);
    outContainer.innerHTML = `<div class="out-badge ${res ? "high" : ""}">OUT: <strong>${res}</strong></div>`;
  } else if (state.activeGate === "not") {
    const res = relayNot(state.logicInputs.a);
    outContainer.innerHTML = `<div class="out-badge ${res ? "high" : ""}">OUT: <strong>${res}</strong></div>`;
  } else if (state.activeGate === "xor") {
    const res = relayXor(state.logicInputs.a, state.logicInputs.b);
    outContainer.innerHTML = `<div class="out-badge ${res ? "high" : ""}">OUT: <strong>${res}</strong></div>`;
  }
}

function drawGateCanvas() {
  const w = gateCanvas.width;
  const h = gateCanvas.height;
  gateCtx.clearRect(0, 0, w, h);

  gateCtx.fillStyle = "#0c0f14";
  gateCtx.fillRect(0, 0, w, h);

  // Schematic background
  gateCtx.strokeStyle = "rgba(255, 255, 255, 0.03)";
  gateCtx.lineWidth = 1;
  for (let x = 0; x < w; x += 30) {
    gateCtx.beginPath();
    gateCtx.moveTo(x, 0);
    gateCtx.lineTo(x, h);
    gateCtx.stroke();
  }
  for (let y = 0; y < h; y += 30) {
    gateCtx.beginPath();
    gateCtx.moveTo(0, y);
    gateCtx.lineTo(w, y);
    gateCtx.stroke();
  }

  const { a, b, cin } = state.logicInputs;

  if (state.activeGate === "and") {
    // Two NO contacts in series
    drawRelaySwitch(gateCtx, 220, 200, "Relay A", a, false);
    drawRelaySwitch(gateCtx, 460, 200, "Relay B", b, false);

    // Connecting wires
    const conducted = a && b;
    gateCtx.strokeStyle = "#5ce1e6";
    gateCtx.lineWidth = 3;
    // Power supply bus
    gateCtx.beginPath();
    gateCtx.moveTo(100, 200);
    gateCtx.lineTo(190, 200);
    gateCtx.stroke();

    gateCtx.strokeStyle = a ? "#5ce1e6" : "#444";
    gateCtx.beginPath();
    gateCtx.moveTo(270, 200);
    gateCtx.lineTo(430, 200);
    gateCtx.stroke();

    gateCtx.strokeStyle = conducted ? "#5ce1e6" : "#444";
    gateCtx.beginPath();
    gateCtx.moveTo(510, 200);
    gateCtx.lineTo(700, 200);
    gateCtx.stroke();

    // Bulb indicator
    drawBulb(gateCtx, 720, 200, conducted);
  } else if (state.activeGate === "or") {
    // Two NO contacts in parallel
    drawRelaySwitch(gateCtx, 340, 130, "Relay A", a, false);
    drawRelaySwitch(gateCtx, 340, 270, "Relay B", b, false);

    const conducted = a || b;
    gateCtx.strokeStyle = "#5ce1e6";
    gateCtx.lineWidth = 3;
    gateCtx.beginPath();
    gateCtx.moveTo(140, 200);
    gateCtx.lineTo(240, 200);
    gateCtx.lineTo(240, 130);
    gateCtx.lineTo(310, 130);
    gateCtx.moveTo(240, 200);
    gateCtx.lineTo(240, 270);
    gateCtx.lineTo(310, 270);
    gateCtx.stroke();

    gateCtx.strokeStyle = conducted ? "#5ce1e6" : "#444";
    gateCtx.beginPath();
    gateCtx.moveTo(390, 130);
    gateCtx.lineTo(490, 130);
    gateCtx.lineTo(490, 200);
    gateCtx.moveTo(390, 270);
    gateCtx.lineTo(490, 270);
    gateCtx.lineTo(490, 200);
    gateCtx.lineTo(680, 200);
    gateCtx.stroke();

    drawBulb(gateCtx, 700, 200, conducted);
  } else if (state.activeGate === "not") {
    // NC contact: energizing breaks connection
    drawRelaySwitch(gateCtx, 380, 200, "Relay A (NC)", a, true /* NC */);
    const conducted = !a;
    gateCtx.strokeStyle = "#5ce1e6";
    gateCtx.lineWidth = 3;
    gateCtx.beginPath();
    gateCtx.moveTo(180, 200);
    gateCtx.lineTo(350, 200);
    gateCtx.stroke();

    gateCtx.strokeStyle = conducted ? "#5ce1e6" : "#444";
    gateCtx.beginPath();
    gateCtx.moveTo(430, 200);
    gateCtx.lineTo(650, 200);
    gateCtx.stroke();

    drawBulb(gateCtx, 670, 200, conducted);
  } else if (state.activeGate === "xor") {
    // Form-C changeover logic
    drawRelaySwitch(gateCtx, 260, 140, "A (NO)", a, false);
    drawRelaySwitch(gateCtx, 460, 140, "B (NC)", b, true);
    drawRelaySwitch(gateCtx, 260, 280, "A (NC)", a, true);
    drawRelaySwitch(gateCtx, 460, 280, "B (NO)", b, false);

    const conducted = (a && !b) || (!a && b);
    gateCtx.strokeStyle = "#5ce1e6";
    gateCtx.lineWidth = 3;
    gateCtx.beginPath();
    gateCtx.moveTo(100, 210);
    gateCtx.lineTo(180, 210);
    gateCtx.lineTo(180, 140);
    gateCtx.lineTo(230, 140);
    gateCtx.moveTo(180, 210);
    gateCtx.lineTo(180, 280);
    gateCtx.lineTo(230, 280);
    gateCtx.stroke();

    gateCtx.strokeStyle = conducted ? "#5ce1e6" : "#444";
    gateCtx.beginPath();
    gateCtx.moveTo(510, 140);
    gateCtx.lineTo(580, 140);
    gateCtx.lineTo(580, 210);
    gateCtx.moveTo(510, 280);
    gateCtx.lineTo(580, 280);
    gateCtx.lineTo(580, 210);
    gateCtx.lineTo(720, 210);
    gateCtx.stroke();

    drawBulb(gateCtx, 740, 210, conducted);
  } else if (state.activeGate === "adder") {
    // 1-Bit Full Adder
    const res = relayFullAdder(a, b, cin);

    // Sum path
    gateCtx.fillStyle = "#a0aec0";
    gateCtx.font = "14px var(--font-mono)";
    gateCtx.fillText(`1-BIT FULL ADDER: A=${a}, B=${b}, Cin=${cin}`, 80, 45);

    drawRelaySwitch(gateCtx, 200, 130, "Relay A", a, false);
    drawRelaySwitch(gateCtx, 380, 130, "Relay B", b, false);
    drawRelaySwitch(gateCtx, 560, 130, "Relay Cin", cin, false);

    drawBulb(gateCtx, 760, 130, res.sum);
    gateCtx.fillStyle = "#e2e8f0";
    gateCtx.font = "12px var(--font-mono)";
    gateCtx.fillText("SUM LAMP", 740, 175);

    drawRelaySwitch(gateCtx, 290, 280, "Carry AB", a && b, false);
    drawRelaySwitch(gateCtx, 480, 280, "Carry Cin(A⊕B)", cin && (a ^ b), false);

    drawBulb(gateCtx, 760, 280, res.cout);
    gateCtx.fillText("COUT LAMP", 740, 325);

    // Connecting wires
    gateCtx.strokeStyle = res.sum ? "#5ce1e6" : "#444";
    gateCtx.lineWidth = 2.5;
    gateCtx.beginPath();
    gateCtx.moveTo(120, 130);
    gateCtx.lineTo(740, 130);
    gateCtx.stroke();

    gateCtx.strokeStyle = res.cout ? "#5ce1e6" : "#444";
    gateCtx.beginPath();
    gateCtx.moveTo(120, 280);
    gateCtx.lineTo(740, 280);
    gateCtx.stroke();
  }
}

function drawRelaySwitch(ctx, x, y, label, energized, isNC) {
  ctx.save();
  ctx.translate(x, y);

  // Relay box
  ctx.fillStyle = "#161b22";
  ctx.strokeStyle = energized ? "#d97736" : "#30363d";
  ctx.lineWidth = 2;
  ctx.fillRect(-45, -35, 90, 70);
  ctx.strokeRect(-45, -35, 90, 70);

  // Label
  ctx.fillStyle = energized ? "#ffaa5e" : "#8b949e";
  ctx.font = "11px var(--font-mono)";
  ctx.textAlign = "center";
  ctx.fillText(label, 0, -42);

  // Contacts
  const closed = isNC ? !energized : energized;
  ctx.fillStyle = "#cbd5e0";
  ctx.beginPath();
  ctx.arc(-25, 0, 4, 0, Math.PI * 2);
  ctx.arc(25, 0, 4, 0, Math.PI * 2);
  ctx.fill();

  // Moving blade
  ctx.strokeStyle = closed ? "#5ce1e6" : "#8b949e";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-25, 0);
  if (closed) {
    ctx.lineTo(25, 0);
  } else {
    ctx.lineTo(15, -16);
  }
  ctx.stroke();

  ctx.restore();
}

function drawBulb(ctx, x, y, lit) {
  ctx.save();
  ctx.translate(x, y);

  if (lit) {
    ctx.fillStyle = "rgba(92, 225, 230, 0.25)";
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = lit ? "#5ce1e6" : "#22272e";
  ctx.strokeStyle = lit ? "#a6f4f7" : "#444c56";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (lit) {
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ── 7 · Tab 4: 1947 Logbook & Timeline ────────────────────────────────────────

function initTimeline() {
  const stream = $("#timeline-stream");
  stream.innerHTML = "";

  TIMELINE_EVENTS.forEach((ev) => {
    const isHighlight = ev.tag === "bug";
    const node = document.createElement("div");
    node.className = `timeline-node ${isHighlight ? "highlight" : ""}`;
    node.innerHTML = `
      <div class="timeline-dot"></div>
      <div class="timeline-content">
        <div class="timeline-date-tag">${ev.date}${ev.time ? ` · ${ev.time}` : ""} [${ev.tag.toUpperCase()}]</div>
        <h5>${ev.title}</h5>
        <p>${ev.desc}</p>
      </div>
    `;
    stream.appendChild(node);
  });
}

// ── 8 · Main Physics Loop ───────────────────────────────────────────────────

let lastTime = performance.now();

function mainLoop(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;

  // Step Relay Physics at sub-millisecond fidelity
  const subSteps = 10;
  const subDt = dt / subSteps;
  const prevClosed = state.relay.isClosed;

  for (let i = 0; i < subSteps; i++) {
    state.relay = stepRelay(state.relay, subDt, state.hasMoth);
  }

  // Audio trigger on closing edge
  if (!prevClosed && state.relay.isClosed) {
    sound.playRelayClick(state.relay.bounceCount);
  }

  // Record oscillograph sample
  state.oscT += dt;
  if (state.oscHistory.length >= 150) {
    state.oscHistory.shift();
  }
  state.oscHistory.push({
    t: state.oscT,
    current: state.relay.current,
    isClosed: state.relay.isClosed,
  });

  // Render Visuals
  if (state.currentTab === "bench") {
    drawRelay();
    drawOscillograph();
    updateTelemetry();
  }

  requestAnimationFrame(mainLoop);
}

// ── 9 · Initialization ───────────────────────────────────────────────────────

initRackBay();
updateGateControls();
initTimeline();
executeRackStep();
requestAnimationFrame(mainLoop);

// ── 10 · Video Hook API (__demo) ─────────────────────────────────────────────

window.__demo = {
  setVideoMode(v) { state.videoMode = v; },
  setTab(tab) { setTab(tab); },
  powerRelay(on) { toggleCoilPower(on); },
  toggleMoth(has) { toggleMoth(has); },
  setRackOperands(a, b) {
    $("#input-op-a").value = a;
    $("#input-op-b").value = b;
    executeRackStep();
  },
  stepRack() { executeRackStep(); },
  setGate(gate) {
    state.activeGate = gate;
    $$(".gate-tabs .btn").forEach((b) => b.classList.toggle("active", b.dataset.gate === gate));
    updateGateControls();
    drawGateCanvas();
  },
  setGateInputs(a, b, cin = 0) {
    state.logicInputs.a = a;
    state.logicInputs.b = b;
    state.logicInputs.cin = cin;
    updateGateControls();
    drawGateCanvas();
  },
  tick(dt = 0.033) {
    for (let i = 0; i < 10; i++) {
      state.relay = stepRelay(state.relay, dt / 10, state.hasMoth);
    }
  },
  scrollToTop() { window.scrollTo({ top: 0, behavior: "instant" }); },
};
