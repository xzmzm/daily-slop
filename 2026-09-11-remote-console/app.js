import {
  decimalToXS3,
  xs3ToDecimal,
  xs3NinesComplement,
  to4Bits,
  addXS3Digits,
  encodeBaudotString,
  to5Bits,
  generateSerialPulseTrain,
  simulateCurrentLoopWaveform,
  ComplexNumber,
  executeComplexOperation,
  simulateModelKAdder,
  calculateTransmissionMetrics
} from './cnc.js';

// --- Global Audio Engine (Web Audio API) ---
class VintageSoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playRelayClick() {
    if (!this.enabled || !this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(800, t);
      filter.Q.setValueAtTime(3, t);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.018);

      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.022);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.025);
    } catch (_) {}
  }

  playTeletypeStrike() {
    if (!this.enabled || !this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      // White noise burst + high click
      const bufferSize = this.ctx.sampleRate * 0.03;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.006));
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.03);

      noise.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start(t);
    } catch (_) {}
  }

  playBellDing() {
    if (!this.enabled || !this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, t); // A6 bell chime

      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.85);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.9);
    } catch (_) {}
  }
}

const sound = new VintageSoundEngine();

// --- DOM References ---
const soundToggleBtn = document.getElementById('soundToggleBtn');
const soundStatus = document.getElementById('soundStatus');
const navTabs = document.querySelectorAll('.nav-tab');
const tabPanes = document.querySelectorAll('.tab-pane');

// Setup Audio Button
soundToggleBtn.addEventListener('click', () => {
  sound.init();
  sound.enabled = !sound.enabled;
  soundStatus.textContent = sound.enabled ? 'AUDIO: ON' : 'AUDIO: OFF';
  soundToggleBtn.classList.toggle('active', sound.enabled);
});

// Setup Navigation Tabs
function switchTab(tabId) {
  navTabs.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  tabPanes.forEach(pane => {
    pane.classList.toggle('active', pane.id === tabId);
  });
  if (tabId === 'tab-complex') {
    drawArgandPlane();
  }
}

navTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    sound.init();
    switchTab(tab.dataset.tab);
  });
});

// ==========================================================================
// TAB 1: 250-Mile Teletype Network & Transmission Loop
// ==========================================================================

const calcInput = document.getElementById('calcInput');
const sendTelegraphBtn = document.getElementById('sendTelegraphBtn');
const paperContent = document.getElementById('paperContent');
const typedBuffer = document.getElementById('typedBuffer');
const presetBtns = document.querySelectorAll('.btn-preset');
const baudotCodeDisplay = document.getElementById('baudotCodeDisplay');
const scopeCanvas = document.getElementById('scopeCanvas');
const scopeCtx = scopeCanvas ? scopeCanvas.getContext('2d') : null;
const relayLedBar = document.getElementById('relayLedBar');
const cncStatusBadge = document.getElementById('cncStatusBadge');
const cncActionDetail = document.getElementById('cncActionDetail');
const lineStateDot = document.getElementById('lineStateDot');

// Init 16 simulated relay register LEDs in the rack summary
if (relayLedBar) {
  for (let i = 0; i < 16; i++) {
    const led = document.createElement('div');
    led.className = 'relay-led';
    led.id = `relayLed_${i}`;
    relayLedBar.appendChild(led);
  }
}

function flashRelayLeds(count = 5) {
  for (let i = 0; i < 16; i++) {
    const el = document.getElementById(`relayLed_${i}`);
    if (el) {
      if (Math.random() < 0.45) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    }
  }
}

function clearRelayLeds() {
  for (let i = 0; i < 16; i++) {
    const el = document.getElementById(`relayLed_${i}`);
    if (el) el.classList.remove('active');
  }
}

// Oscilloscope Live Drawing
let currentWaveform = [];
let waveformOffset = 0;

function drawScope() {
  if (!scopeCtx) return;
  const w = scopeCanvas.width;
  const h = scopeCanvas.height;

  scopeCtx.fillStyle = '#04080c';
  scopeCtx.fillRect(0, 0, w, h);

  // Grid lines
  scopeCtx.strokeStyle = 'rgba(22, 32, 44, 0.7)';
  scopeCtx.lineWidth = 1;
  for (let x = 0; x < w; x += 40) {
    scopeCtx.beginPath();
    scopeCtx.moveTo(x, 0);
    scopeCtx.lineTo(x, h);
    scopeCtx.stroke();
  }
  for (let y = 0; y < h; y += 22) {
    scopeCtx.beginPath();
    scopeCtx.moveTo(0, y);
    scopeCtx.lineTo(w, y);
    scopeCtx.stroke();
  }

  // 60 mA Reference line
  scopeCtx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
  scopeCtx.setLineDash([4, 4]);
  scopeCtx.beginPath();
  scopeCtx.moveTo(0, h * 0.25);
  scopeCtx.lineTo(w, h * 0.25);
  scopeCtx.stroke();
  scopeCtx.setLineDash([]);

  // Draw current loop trace (Cyan glow phosphor)
  scopeCtx.strokeStyle = '#38bdf8';
  scopeCtx.lineWidth = 2;
  scopeCtx.shadowColor = '#38bdf8';
  scopeCtx.shadowBlur = 6;
  scopeCtx.beginPath();

  if (currentWaveform.length > 1) {
    const stepX = w / Math.min(currentWaveform.length, 120);
    for (let i = 0; i < currentWaveform.length; i++) {
      const val = currentWaveform[i]; // 0 to 60 mA
      const y = h * 0.85 - (val / 60.0) * (h * 0.65);
      const x = i * stepX;
      if (i === 0) scopeCtx.moveTo(x, y);
      else scopeCtx.lineTo(x, y);
    }
  } else {
    // Idle line at 60 mA (neutral loop closed at idle)
    const y = h * 0.25;
    scopeCtx.moveTo(0, y);
    scopeCtx.lineTo(w, y);
  }
  scopeCtx.stroke();
  scopeCtx.shadowBlur = 0;
}

// Teletype Printing Logic
function appendPaperLine(text, isResult = false) {
  const line = document.createElement('div');
  line.className = 'paper-line' + (isResult ? ' result-line' : '');
  line.textContent = text;
  paperContent.appendChild(line);

  // Auto scroll
  const paper = document.getElementById('teletypePaper');
  paper.scrollTop = paper.scrollHeight;
}

let isTransmitting = false;

async function transmitEquation(expr) {
  if (isTransmitting) return;
  isTransmitting = true;
  sound.init();

  typedBuffer.textContent = '';
  calcInput.value = expr;

  // 1. Type expression into Hanover teletype buffer character by character
  for (let ch of expr) {
    typedBuffer.textContent += ch;
    sound.playTeletypeStrike();
    await new Promise(r => setTimeout(r, 65));
  }

  appendPaperLine(`> ${expr}`);
  typedBuffer.textContent = '';

  // 2. Encode to Baudot 5-bit
  const frames = encodeBaudotString(expr);
  baudotCodeDisplay.textContent = `TRANSMITTING: ${frames.length} CHARS`;

  // 3. Animate signal along 250-mile telegraph route
  cncStatusBadge.textContent = 'RECEIVING TELEGRAPH';
  cncStatusBadge.style.color = 'var(--cyan-accent)';
  cncActionDetail.textContent = 'Telegraph pulses traveling 250 miles along AT&T open copper wire...';
  lineStateDot.style.backgroundColor = 'var(--amber-glow)';

  // Pulse animation across the 4 segments
  const packets = ['packet1', 'packet2', 'packet3', 'packet4'];
  const wires = ['wire1', 'wire2', 'wire3', 'wire4'];

  for (let idx = 0; idx < packets.length; idx++) {
    const p = document.getElementById(packets[idx]);
    const w = document.getElementById(wires[idx]);
    if (p && w) {
      w.classList.add('active-wire');
      p.style.opacity = '1';
      p.style.left = '0%';
      // animate left 0 to 100%
      let start = performance.now();
      const dur = 100;
      await new Promise(resolve => {
        function step(now) {
          const progress = Math.min((now - start) / dur, 1.0);
          p.style.left = `${progress * 90}%`;
          if (progress < 1.0) requestAnimationFrame(step);
          else resolve();
        }
        requestAnimationFrame(step);
      });
      p.style.opacity = '0';
      w.classList.remove('active-wire');
      sound.playRelayClick(); // repeater relay transit click
    }
  }

  // 4. Update Oscilloscope waveform with the first few Baudot characters
  const sampleBits = [];
  for (let f of frames.slice(0, 3)) {
    sampleBits.push(...generateSerialPulseTrain(to5Bits(f.code)));
  }
  currentWaveform = simulateCurrentLoopWaveform(sampleBits, 22.0, 4);
  drawScope();

  // 5. Parse and execute Complex Calculation in NYC Bell Labs CNC
  cncStatusBadge.textContent = 'CNC RELAY COMPUTING';
  cncStatusBadge.style.color = 'var(--amber-glow)';
  cncActionDetail.textContent = 'Room 914: Energizing crossbar registers and Excess-3 adders...';

  // Parse equation of form (x1 + y1 i) op (x2 + y2 i)
  let parsed = parseComplexExpr(expr);
  let res;
  if (!parsed) {
    // Fallback default demo calculation
    parsed = {
      z1: new ComplexNumber(12, 5),
      z2: new ComplexNumber(8, -3),
      op: '*'
    };
  }

  // Flash relay LEDs while computing
  for (let step = 0; step < 6; step++) {
    flashRelayLeds();
    sound.playRelayClick();
    await new Promise(r => setTimeout(r, 60));
  }

  res = executeComplexOperation(parsed.z1, parsed.z2, parsed.op);

  clearRelayLeds();
  cncStatusBadge.textContent = 'TRANSMITTING RESULT';
  cncStatusBadge.style.color = 'var(--green-relay)';
  cncActionDetail.textContent = `Result computed: ${res.result.format(4)}. Sending Baudot code back to Hanover...`;

  // Return signal animation back from NYC to Hanover
  for (let idx = packets.length - 1; idx >= 0; idx--) {
    const p = document.getElementById(packets[idx]);
    const w = document.getElementById(wires[idx]);
    if (p && w) {
      w.classList.add('active-wire');
      p.style.opacity = '1';
      p.style.left = '90%';
      let start = performance.now();
      const dur = 80;
      await new Promise(resolve => {
        function step(now) {
          const progress = Math.min((now - start) / dur, 1.0);
          p.style.left = `${(1 - progress) * 90}%`;
          if (progress < 1.0) requestAnimationFrame(step);
          else resolve();
        }
        requestAnimationFrame(step);
      });
      p.style.opacity = '0';
      w.classList.remove('active-wire');
      sound.playRelayClick();
    }
  }

  // 6. Print result on Teletype paper
  const resultStr = `= ${res.result.format(4)}`;
  for (let ch of resultStr) {
    typedBuffer.textContent += ch;
    sound.playTeletypeStrike();
    await new Promise(r => setTimeout(r, 55));
  }

  appendPaperLine(resultStr, true);
  typedBuffer.textContent = '';
  sound.playBellDing(); // Carriage return chime!

  // Reset states
  baudotCodeDisplay.textContent = 'LINE IDLE · 60 mA NEUTRAL LOOP';
  cncStatusBadge.textContent = 'STANDBY / READY';
  cncStatusBadge.style.color = 'var(--green-relay)';
  cncActionDetail.textContent = `Completed operation: ${expr} -> ${res.result.format(4)}`;
  lineStateDot.style.backgroundColor = 'var(--cyan-accent)';
  isTransmitting = false;

  // Also sync Tab 3 values
  updateComplexTabInputs(parsed.z1, parsed.z2, parsed.op, res);
}

function parseComplexExpr(str) {
  try {
    // Regex for (x1 + y1 i) [op] (x2 + y2 i)
    // Clean string
    const clean = str.replace(/\s+/g, '').replace('=', '');
    const match = clean.match(/^\(([-+]?[0-9.]+)([-+][0-9.]+)i\)([\*\/\+-])\(([-+]?[0-9.]+)([-+][0-9.]+)i\)$/);
    if (match) {
      const z1 = new ComplexNumber(parseFloat(match[1]), parseFloat(match[2]));
      const op = match[3];
      const z2 = new ComplexNumber(parseFloat(match[4]), parseFloat(match[5]));
      return { z1, z2, op };
    }
  } catch (_) {}
  return null;
}

sendTelegraphBtn.addEventListener('click', () => {
  const val = calcInput.value.trim() || '(12 + 5i) * (8 - 3i) =';
  transmitEquation(val);
});

calcInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const val = calcInput.value.trim() || '(12 + 5i) * (8 - 3i) =';
    transmitEquation(val);
  }
});

presetBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const expr = btn.dataset.expr;
    calcInput.value = expr;
    transmitEquation(expr);
  });
});

// Initial scope draw
drawScope();

// ==========================================================================
// TAB 2: Excess-3 Relay Logic
// ==========================================================================

const digitAInput = document.getElementById('digitAInput');
const digitBInput = document.getElementById('digitBInput');
const valDigitA = document.getElementById('valDigitA');
const valDigitB = document.getElementById('valDigitB');
const dispDecA = document.getElementById('dispDecA');
const dispDecB = document.getElementById('dispDecB');
const dispXsA = document.getElementById('dispXsA');
const dispXsB = document.getElementById('dispXsB');
const dispCompB = document.getElementById('dispCompB');
const dispCompBPill = document.getElementById('dispCompBPill');
const opAddBtn = document.getElementById('opAddBtn');
const opSubBtn = document.getElementById('opSubBtn');
const carryInToggle = document.getElementById('carryInToggle');

const ladderCoilsContainer = document.getElementById('ladderCoilsContainer');
const step1Math = document.getElementById('step1Math');
const step2Math = document.getElementById('step2Math');
const step2Desc = document.getElementById('step2Desc');
const step3Math = document.getElementById('step3Math');
const xs3TableBody = document.getElementById('xs3TableBody');

let currentExcessOp = '+';

function updateExcess3Bench() {
  const da = parseInt(digitAInput.value, 10);
  const db = parseInt(digitBInput.value, 10);
  const cin = carryInToggle.checked ? 1 : 0;

  valDigitA.textContent = da;
  valDigitB.textContent = db;
  dispDecA.textContent = da;
  dispDecB.textContent = db;

  const xsA = decimalToXS3(da);
  const xsB = decimalToXS3(db);

  dispXsA.textContent = `${xsA} (${to4Bits(xsA).join('')}₂)`;
  dispXsB.textContent = `${xsB} (${to4Bits(xsB).join('')}₂)`;

  let operandB_XS = xsB;
  if (currentExcessOp === '-') {
    dispCompBPill.style.display = 'inline-block';
    const compXS = xs3NinesComplement(xsB);
    const compDec = xs3ToDecimal(compXS);
    dispCompB.textContent = `${compDec} (${to4Bits(compXS).join('')}₂)`;
    operandB_XS = compXS;
  } else {
    dispCompBPill.style.display = 'none';
  }

  // Calculate 1-digit addition
  const step = addXS3Digits(xsA, operandB_XS, cin);

  // Render 4-bit Relay Ladder Coils
  ladderCoilsContainer.innerHTML = '';
  const bitsA = to4Bits(xsA);
  const bitsB = to4Bits(operandB_XS);

  for (let bitIdx = 3; bitIdx >= 0; bitIdx--) {
    const bitCol = document.createElement('div');
    bitCol.className = 'bit-stage';

    const bA = bitsA[3 - bitIdx];
    const bB = bitsB[3 - bitIdx];

    bitCol.innerHTML = `
      <div class="bit-stage-title">BIT ${bitIdx} (2^${bitIdx})</div>
      <div class="relay-coil-box ${bA === 1 ? 'coil-energized' : ''}">
        COIL A${bitIdx}: ${bA}
      </div>
      <div class="relay-coil-box ${bB === 1 ? 'coil-energized' : ''}">
        COIL B${bitIdx}: ${bB}
      </div>
      <div class="contact-armature">
        ${bA === 1 || bB === 1 ? '⚡ Contacts Closed' : '○ Contacts Open'}
      </div>
    `;
    ladderCoilsContainer.appendChild(bitCol);
  }

  // Step 1: Raw sum
  const rawSum = step.rawSum;
  const raw4 = step.raw4Bit;
  const cout = step.carryOut;
  step1Math.innerHTML = `
    (A+3) + (B+3) + Cin = ${xsA} + ${operandB_XS} + ${cin} = <b>${rawSum}</b><br>
    Raw 4-Bit: <b>${raw4}</b> (${to4Bits(raw4).join('')}₂), Carry Out Cout = <b>${cout}</b>
  `;

  // Step 2: Stibitz Excess Correction
  if (cout === 1) {
    step2Math.innerHTML = `Cout = 1 ⇒ <b>Add +3</b> (0011₂): ${raw4} + 3 = <b>${step.correctedXS3}</b> (${to4Bits(step.correctedXS3).join('')}₂)`;
    step2Desc.innerHTML = 'Decimal sum was ≥ 10. Binary adder subtracted 16 instead of 10. Adding +3 restores the Excess-3 invariant!';
  } else {
    step2Math.innerHTML = `Cout = 0 ⇒ <b>Subtract 3</b> (-3 / +13 mod 16): ${raw4} - 3 = <b>${step.correctedXS3}</b> (${to4Bits(step.correctedXS3).join('')}₂)`;
    step2Desc.innerHTML = 'Decimal sum was &lt; 10. Two Excess-3 values added have Excess-6 (+6). Subtracting 3 restores the +3 bias!';
  }

  // Step 3: Result
  const resDigit = step.resultDigit;
  if (currentExcessOp === '+') {
    const totalDecimal = da + db + cin;
    step3Math.innerHTML = `XS-3 Code: <b>${step.correctedXS3}</b> ⇒ Digit: <b>${resDigit}</b> (Carry: ${cout})<br>Sum: <b>${da} + ${db}${cin ? ' + 1' : ''} = ${totalDecimal}</b>`;
  } else {
    step3Math.innerHTML = `XS-3 Code: <b>${step.correctedXS3}</b> ⇒ Digit: <b>${resDigit}</b> (Cout: ${cout})<br>9's Complement Difference Output`;
  }
}

// Populate Static XS-3 Table
function populateXS3Table() {
  if (!xs3TableBody) return;
  xs3TableBody.innerHTML = '';
  for (let d = 0; d <= 9; d++) {
    const bcd = d.toString(2).padStart(4, '0');
    const xs = decimalToXS3(d);
    const xsBin = to4Bits(xs).join('');
    const inv = xs3NinesComplement(xs);
    const invBin = to4Bits(inv).join('');
    const ninesComp = 9 - d;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${d}</strong></td>
      <td><code>${bcd}</code></td>
      <td><code style="color:var(--amber-glow); font-weight:bold;">${xsBin} (${xs})</code></td>
      <td><code style="color:var(--cyan-accent);">${invBin}</code></td>
      <td><strong>${ninesComp}</strong></td>
    `;
    xs3TableBody.appendChild(tr);
  }
}

digitAInput.addEventListener('input', () => {
  sound.playRelayClick();
  updateExcess3Bench();
});

digitBInput.addEventListener('input', () => {
  sound.playRelayClick();
  updateExcess3Bench();
});

carryInToggle.addEventListener('change', () => {
  sound.playRelayClick();
  updateExcess3Bench();
});

opAddBtn.addEventListener('click', () => {
  currentExcessOp = '+';
  opAddBtn.classList.add('active');
  opSubBtn.classList.remove('active');
  sound.playRelayClick();
  updateExcess3Bench();
});

opSubBtn.addEventListener('click', () => {
  currentExcessOp = '-';
  opSubBtn.classList.add('active');
  opAddBtn.classList.remove('active');
  sound.playRelayClick();
  updateExcess3Bench();
});

populateXS3Table();
updateExcess3Bench();

// ==========================================================================
// TAB 3: Complex Algebra & Argand Plane
// ==========================================================================

const z1Real = document.getElementById('z1Real');
const z1Imag = document.getElementById('z1Imag');
const z2Real = document.getElementById('z2Real');
const z2Imag = document.getElementById('z2Imag');
const z1PolarPreview = document.getElementById('z1PolarPreview');
const z2PolarPreview = document.getElementById('z2PolarPreview');
const opCalcBtns = document.querySelectorAll('.btn-op-calc');
const calcExecuteBtn = document.getElementById('calcExecuteBtn');
const cycleListContainer = document.getElementById('cycleListContainer');
const cycleTimingBadge = document.getElementById('cycleTimingBadge');
const complexResultVal = document.getElementById('complexResultVal');
const complexResultPolar = document.getElementById('complexResultPolar');
const argandCanvas = document.getElementById('argandCanvas');
const argandCtx = argandCanvas ? argandCanvas.getContext('2d') : null;

let currentCalcOp = '*';
let lastCalculatedResult = null;

function getZ1() {
  return new ComplexNumber(parseFloat(z1Real.value) || 0, parseFloat(z1Imag.value) || 0);
}

function getZ2() {
  return new ComplexNumber(parseFloat(z2Real.value) || 0, parseFloat(z2Imag.value) || 0);
}

function updatePolarPreviews() {
  const z1 = getZ1();
  const z2 = getZ2();
  z1PolarPreview.textContent = `r₁ = ${z1.magnitude().toFixed(2)}, θ₁ = ${z1.phaseDeg().toFixed(2)}°`;
  z2PolarPreview.textContent = `r₂ = ${z2.magnitude().toFixed(2)}, θ₂ = ${z2.phaseDeg().toFixed(2)}°`;
}

function executeAndRenderComplex() {
  sound.playRelayClick();
  const z1 = getZ1();
  const z2 = getZ2();
  updatePolarPreviews();

  let res;
  try {
    res = executeComplexOperation(z1, z2, currentCalcOp);
  } catch (err) {
    complexResultVal.textContent = 'ERROR: ' + err.message;
    return;
  }

  lastCalculatedResult = res;

  // Render cycles
  cycleListContainer.innerHTML = '';
  res.cycles.forEach(c => {
    const row = document.createElement('div');
    row.className = 'cycle-row';
    row.innerHTML = `
      <span class="cycle-desc">Step ${c.step}: ${c.desc}</span>
      <span class="cycle-detail">${c.detail}</span>
    `;
    cycleListContainer.appendChild(row);
  });

  cycleTimingBadge.textContent = `ESTIMATED RELAY TIME: ~${res.estimatedRelayTimeMs.toFixed(0)} ms`;
  complexResultVal.textContent = res.result.format(4);
  complexResultPolar.textContent = `Magnitude r = ${res.result.magnitude().toFixed(2)}, Phase θ = ${res.result.phaseDeg().toFixed(2)}°`;

  drawArgandPlane();
}

function updateComplexTabInputs(z1, z2, op, res) {
  z1Real.value = z1.real;
  z1Imag.value = z1.imag;
  z2Real.value = z2.real;
  z2Imag.value = z2.imag;
  currentCalcOp = op;

  opCalcBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.op === op);
  });

  lastCalculatedResult = res;
  updatePolarPreviews();

  if (res) {
    cycleListContainer.innerHTML = '';
    res.cycles.forEach(c => {
      const row = document.createElement('div');
      row.className = 'cycle-row';
      row.innerHTML = `
        <span class="cycle-desc">Step ${c.step}: ${c.desc}</span>
        <span class="cycle-detail">${c.detail}</span>
      `;
      cycleListContainer.appendChild(row);
    });
    cycleTimingBadge.textContent = `ESTIMATED RELAY TIME: ~${res.estimatedRelayTimeMs.toFixed(0)} ms`;
    complexResultVal.textContent = res.result.format(4);
    complexResultPolar.textContent = `Magnitude r = ${res.result.magnitude().toFixed(2)}, Phase θ = ${res.result.phaseDeg().toFixed(2)}°`;
  }
  drawArgandPlane();
}

function drawArgandPlane() {
  if (!argandCtx) return;
  const w = argandCanvas.width;
  const h = argandCanvas.height;
  const cx = w / 2;
  const cy = h / 2;

  argandCtx.fillStyle = '#06090d';
  argandCtx.fillRect(0, 0, w, h);

  const z1 = getZ1();
  const z2 = getZ2();
  const zout = lastCalculatedResult ? lastCalculatedResult.result : new ComplexNumber(0, 0);

  // Dynamic Scale
  const maxMag = Math.max(z1.magnitude(), z2.magnitude(), zout.magnitude(), 10);
  const scale = (Math.min(w, h) * 0.42) / maxMag;

  // Draw concentric magnitude circles
  argandCtx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  argandCtx.lineWidth = 1;
  const circleSteps = [0.25, 0.5, 0.75, 1.0];
  circleSteps.forEach(ratio => {
    const rad = maxMag * ratio * scale;
    argandCtx.beginPath();
    argandCtx.arc(cx, cy, rad, 0, Math.PI * 2);
    argandCtx.stroke();
  });

  // Coordinate Axes
  argandCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  argandCtx.lineWidth = 1.5;

  // Real Axis
  argandCtx.beginPath();
  argandCtx.moveTo(20, cy);
  argandCtx.lineTo(w - 20, cy);
  argandCtx.stroke();

  // Imag Axis
  argandCtx.beginPath();
  argandCtx.moveTo(cx, 20);
  argandCtx.lineTo(cx, h - 20);
  argandCtx.stroke();

  // Axis Labels
  argandCtx.font = '10px "SF Mono", monospace';
  argandCtx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  argandCtx.fillText('+Re (Real)', w - 75, cy - 8);
  argandCtx.fillText('+Im (Imaginary)', cx + 8, 30);

  // Vector Drawing Helper
  function drawVector(z, color, label) {
    const targetX = cx + z.real * scale;
    const targetY = cy - z.imag * scale; // invert Y for screen coords

    argandCtx.strokeStyle = color;
    argandCtx.fillStyle = color;
    argandCtx.lineWidth = 2.5;
    argandCtx.shadowColor = color;
    argandCtx.shadowBlur = 8;

    // Line
    argandCtx.beginPath();
    argandCtx.moveTo(cx, cy);
    argandCtx.lineTo(targetX, targetY);
    argandCtx.stroke();

    // Arrowhead
    const angle = Math.atan2(targetY - cy, targetX - cx);
    const arrowLen = 10;
    argandCtx.beginPath();
    argandCtx.moveTo(targetX, targetY);
    argandCtx.lineTo(
      targetX - arrowLen * Math.cos(angle - Math.PI / 7),
      targetY - arrowLen * Math.sin(angle - Math.PI / 7)
    );
    argandCtx.lineTo(
      targetX - arrowLen * Math.cos(angle + Math.PI / 7),
      targetY - arrowLen * Math.sin(angle + Math.PI / 7)
    );
    argandCtx.closePath();
    argandCtx.fill();

    // Label
    argandCtx.shadowBlur = 0;
    argandCtx.font = 'bold 11px "SF Mono", monospace';
    argandCtx.fillText(`${label} (${z.real.toFixed(1)}, ${z.imag.toFixed(1)}i)`, targetX + 8, targetY - 4);
  }

  // Draw Z1 (Cyan)
  drawVector(z1, '#38bdf8', 'Z₁');

  // Draw Z2 (Amber)
  drawVector(z2, '#ffb020', 'Z₂');

  // Draw Zout (Green)
  if (lastCalculatedResult) {
    drawVector(zout, '#10b981', 'Z_out');
  }
}

[z1Real, z1Imag, z2Real, z2Imag].forEach(inp => {
  inp.addEventListener('input', () => {
    updatePolarPreviews();
    drawArgandPlane();
  });
});

opCalcBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    sound.playRelayClick();
    opCalcBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentCalcOp = btn.dataset.op;
    executeAndRenderComplex();
  });
});

calcExecuteBtn.addEventListener('click', () => {
  executeAndRenderComplex();
});

executeAndRenderComplex();

// ==========================================================================
// TAB 4: 1937 Kitchen Table "Model K" & Timeline
// ==========================================================================

const toggleSwitchA = document.getElementById('toggleSwitchA');
const toggleSwitchB = document.getElementById('toggleSwitchB');
const toggleSwitchCin = document.getElementById('toggleSwitchCin');

const graphicRelayA = document.getElementById('graphicRelayA');
const graphicRelayB = document.getElementById('graphicRelayB');
const stateLabelA = document.getElementById('stateLabelA');
const stateLabelB = document.getElementById('stateLabelB');

const socketSum = document.getElementById('socketSum');
const statusSum = document.getElementById('statusSum');
const socketCarry = document.getElementById('socketCarry');
const statusCarry = document.getElementById('statusCarry');

let stateSwitchA = 0;
let stateSwitchB = 0;
let stateSwitchCin = 0;

function updateModelK() {
  const res = simulateModelKAdder(stateSwitchA, stateSwitchB, stateSwitchCin);

  // Switch labels
  toggleSwitchA.textContent = stateSwitchA ? '1 (ON)' : '0 (OFF)';
  toggleSwitchA.classList.toggle('switch-on', stateSwitchA === 1);

  toggleSwitchB.textContent = stateSwitchB ? '1 (ON)' : '0 (OFF)';
  toggleSwitchB.classList.toggle('switch-on', stateSwitchB === 1);

  toggleSwitchCin.textContent = stateSwitchCin ? '1 (ON)' : '0 (OFF)';
  toggleSwitchCin.classList.toggle('switch-on', stateSwitchCin === 1);

  // Relay A
  graphicRelayA.classList.toggle('energized', res.relayA_energized);
  stateLabelA.textContent = res.relayA_energized ? 'ENERGIZED (CLOSED)' : 'RELAXED (OPEN)';

  // Relay B
  graphicRelayB.classList.toggle('energized', res.relayB_energized);
  stateLabelB.textContent = res.relayB_energized ? 'ENERGIZED (CLOSED)' : 'RELAXED (OPEN)';

  // Bulbs
  socketSum.classList.toggle('bulb-lit', res.sumBulb === 1);
  statusSum.textContent = res.sumBulb === 1 ? 'LIT (1)' : 'OFF (0)';

  socketCarry.classList.toggle('bulb-lit', res.carryBulb === 1);
  statusCarry.textContent = res.carryBulb === 1 ? 'LIT (1)' : 'OFF (0)';
}

toggleSwitchA.addEventListener('click', () => {
  sound.playRelayClick();
  stateSwitchA = stateSwitchA === 0 ? 1 : 0;
  updateModelK();
});

toggleSwitchB.addEventListener('click', () => {
  sound.playRelayClick();
  stateSwitchB = stateSwitchB === 0 ? 1 : 0;
  updateModelK();
});

toggleSwitchCin.addEventListener('click', () => {
  sound.playRelayClick();
  stateSwitchCin = stateSwitchCin === 0 ? 1 : 0;
  updateModelK();
});

updateModelK();

// ==========================================================================
// Test Hooks & Automation API for Video / Playwright
// ==========================================================================

window.__demo = {
  switchTab,
  transmitEquation,
  setExcess3: (a, b, op = '+', cin = false) => {
    digitAInput.value = a;
    digitBInput.value = b;
    carryInToggle.checked = cin;
    currentExcessOp = op;
    opAddBtn.classList.toggle('active', op === '+');
    opSubBtn.classList.toggle('active', op === '-');
    updateExcess3Bench();
  },
  setComplex: (x1, y1, x2, y2, op = '*') => {
    z1Real.value = x1;
    z1Imag.value = y1;
    z2Real.value = x2;
    z2Imag.value = y2;
    currentCalcOp = op;
    opCalcBtns.forEach(b => b.classList.toggle('active', b.dataset.op === op));
    executeAndRenderComplex();
  },
  setModelK: (a, b, cin = 0) => {
    stateSwitchA = a ? 1 : 0;
    stateSwitchB = b ? 1 : 0;
    stateSwitchCin = cin ? 1 : 0;
    updateModelK();
  }
};
