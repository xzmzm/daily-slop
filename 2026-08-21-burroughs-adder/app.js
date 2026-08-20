/**
 * 1888 Burroughs Adding Machine Studio - Main Application Controller
 */

import { BurroughsMechanism, PHASES, NUM_COLUMNS } from './mechanism.js';
import { MechanicalAudio } from './audio.js';
import { BurroughsRenderer } from './renderer.js';

class BurroughsApp {
  constructor() {
    this.mech = new BurroughsMechanism();
    this.audio = new MechanicalAudio();

    this.canvas = document.getElementById('cutawayCanvas');
    this.renderer = new BurroughsRenderer(this.canvas, this.mech);

    this.timeScale = 1.0;
    this.isDraggingCrank = false;

    this._buildKeyboard();
    this._bindEvents();
    this._bindMechEvents();
    this._renderPaperTape();
    this._updateDialRegister();

    // Start animation loop
    this.lastTime = performance.now();
    requestAnimationFrame(this._loop.bind(this));

    // Expose demo API for automated testing and video rendering
    this._setupDemoAPI();
  }

  _buildKeyboard() {
    const container = document.getElementById('keyboardMatrix');
    container.innerHTML = '';

    // Standard Burroughs keyboard: 9 rows (digits 9 down to 1), 9 columns
    for (let digit = 9; digit >= 1; digit--) {
      for (let col = 0; col < NUM_COLUMNS; col++) {
        const btn = document.createElement('button');
        btn.className = 'key-btn';
        btn.dataset.col = col;
        btn.dataset.digit = digit;
        btn.textContent = digit;

        // Color banding
        const colGroup = Math.floor(col / 3);
        if (colGroup === 0 || colGroup === 2) {
          btn.classList.add('col-black');
        } else {
          btn.classList.add('col-ivory');
        }

        btn.addEventListener('click', () => {
          this.mech.pressKey(col, digit);
          this._updateKeyboardUI();
        });

        container.appendChild(btn);
      }
    }
  }

  _bindEvents() {
    // Crank pull button
    const pullBtn = document.getElementById('pullCrankBtn');
    pullBtn.addEventListener('click', () => this.pullHandle());

    // Crank visual dragging
    const crankVisual = document.getElementById('crankArmVisual');
    crankVisual.addEventListener('mousedown', (e) => {
      if (this.mech.phase !== PHASES.IDLE) return;
      this.isDraggingCrank = true;
      this.dragStartY = e.clientY;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDraggingCrank) return;
      const dy = e.clientY - this.dragStartY;
      if (dy > 60) {
        this.isDraggingCrank = false;
        this.pullHandle(Math.min(2.5, dy / 60));
      }
    });

    window.addEventListener('mouseup', () => {
      this.isDraggingCrank = false;
    });

    // Function keys
    document.getElementById('totalKey').addEventListener('click', () => {
      this.mech.toggleTotal();
      this._updateFunctionKeyUI();
    });

    document.getElementById('subtotalKey').addEventListener('click', () => {
      this.mech.toggleSubtotal();
      this._updateFunctionKeyUI();
    });

    document.getElementById('nonAddKey').addEventListener('click', () => {
      this.mech.toggleNonAdd();
      this._updateFunctionKeyUI();
    });

    const repeatLever = document.getElementById('repeatLever');
    repeatLever.addEventListener('click', () => {
      this.mech.toggleRepeat();
      this._updateFunctionKeyUI();
    });

    document.getElementById('clearKey').addEventListener('click', () => {
      this.mech.clearKeyboard();
      this.audio.playKeyRelease();
      this._updateKeyboardUI();
    });

    // Quick number input
    const quickInput = document.getElementById('quickNumInput');
    const quickEnter = document.getElementById('quickEnterBtn');
    const applyQuickNumber = () => {
      const val = parseInt(quickInput.value, 10);
      if (!isNaN(val) && val >= 0) {
        this.mech.setNumber(val);
        this._updateKeyboardUI();
        this.audio.playKeyPress(4, 5);
        quickInput.value = '';
      }
    };
    quickEnter.addEventListener('click', applyQuickNumber);
    quickInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') applyQuickNumber();
    });

    // Paper tape actions
    document.getElementById('tearTapeBtn').addEventListener('click', () => {
      this.mech.paperTape = [
        { text: '--- TORN TAPE ---', type: 'sep' },
        { text: '         0.00 *', type: 'clear' }
      ];
      this.audio.playHammerStrike();
      this._renderPaperTape();
    });

    document.getElementById('copyTapeBtn').addEventListener('click', () => {
      const text = this.mech.paperTape.map(l => l.text).join('\n');
      navigator.clipboard.writeText(text);
      alert('Paper audit listing copied to clipboard!');
    });

    // Column View Dropdown
    const colSelect = document.getElementById('colSelect');
    colSelect.addEventListener('change', (e) => {
      const col = parseInt(e.target.value, 10);
      this.renderer.setActiveColumn(col);
      this._highlightDial(col);
    });

    // Speed Controls
    const speedBtns = document.querySelectorAll('.speed-btn');
    speedBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        speedBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.timeScale = parseFloat(btn.dataset.speed);
      });
    });

    // Dashpot Viscosity Slider
    const viscSlider = document.getElementById('viscositySlider');
    const viscText = document.getElementById('viscosityValText');
    viscSlider.addEventListener('input', (e) => {
      const pct = parseInt(e.target.value, 10);
      this.mech.dashpotViscosity = pct / 100.0;
      if (pct === 100) {
        viscText.textContent = '100% (Castor Oil - Patent)';
      } else if (pct === 0) {
        viscText.textContent = '0% (Un-damped - Overthrow!)';
      } else {
        viscText.textContent = `${pct}% (Mineral Oil)`;
      }
    });

    // Checkboxes
    document.getElementById('showLabelsToggle').addEventListener('change', (e) => {
      this.renderer.showLabels = e.target.checked;
    });
    document.getElementById('showParticlesToggle').addEventListener('change', (e) => {
      this.renderer.showFlowParticles = e.target.checked;
    });

    // Audio toggle
    const soundBtn = document.getElementById('soundToggleBtn');
    soundBtn.addEventListener('click', () => {
      this.audio.enabled = !this.audio.enabled;
      soundBtn.classList.toggle('active', this.audio.enabled);
      soundBtn.querySelector('.state-text').textContent = this.audio.enabled ? 'ON' : 'OFF';
    });

    // Help Modal
    const modal = document.getElementById('helpModal');
    document.getElementById('helpModalBtn').addEventListener('click', () => {
      modal.classList.add('open');
    });
    document.getElementById('modalCloseBtn').addEventListener('click', () => {
      modal.classList.remove('open');
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('open');
    });

    // Scenario Buttons
    const scenarioBtns = document.querySelectorAll('.scenario-btn');
    scenarioBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        scenarioBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._loadScenario(btn.dataset.scenario);
      });
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;

      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        this.pullHandle();
      } else if (e.key.toLowerCase() === 't') {
        this.mech.toggleTotal();
        this._updateFunctionKeyUI();
      } else if (e.key.toLowerCase() === 's') {
        this.mech.toggleSubtotal();
        this._updateFunctionKeyUI();
      } else if (e.key.toLowerCase() === 'r') {
        this.mech.toggleRepeat();
        this._updateFunctionKeyUI();
      } else if (e.key.toLowerCase() === 'c') {
        this.mech.clearKeyboard();
        this.audio.playKeyRelease();
        this._updateKeyboardUI();
      }
    });

    window.addEventListener('resize', () => this.renderer.resize());
  }

  _bindMechEvents() {
    this.mech.on('keyPress', ({ col, digit }) => {
      this.audio.playKeyPress(col, digit);
      this._updateKeyboardUI();
      this.renderer.setActiveColumn(col);
      document.getElementById('colSelect').value = col;
    });

    this.mech.on('keyRelease', () => {
      this.audio.playKeyRelease();
      this._updateKeyboardUI();
    });

    this.mech.on('keyboardCleared', () => {
      this._updateKeyboardUI();
    });

    this.mech.on('ratchetUpdate', () => {
      this.audio.playRatchetClick();
    });

    this.mech.on('hammerStrike', () => {
      this.audio.playHammerStrike();
      this._renderPaperTape();
      this._updateDialRegister();
    });

    this.mech.on('carryLatchPrimed', () => {
      this.audio.playCarryTrip();
    });

    this.mech.on('carryNudge', ({ fromCol, toCol }) => {
      this.audio.playCarryNudge(toCol);
      this._updateDialRegister();
      this._highlightDial(toCol);
    });

    this.mech.on('overflowChime', () => {
      this.audio.playBellChime();
    });

    this.mech.on('dashpotFlow', ({ velocity, viscosity }) => {
      this.audio.setDashpotAudio(velocity, viscosity);
    });

    this.mech.on('cycleComplete', () => {
      this._updateDialRegister();
      this._updateKeyboardUI();
      this._updateFunctionKeyUI();
    });
  }

  pullHandle(speed = 1.0) {
    if (this.mech.phase !== PHASES.IDLE) return;
    this.mech.pullHandle(speed);
  }

  _updateKeyboardUI() {
    const keys = document.querySelectorAll('.key-btn');
    keys.forEach(k => {
      const col = parseInt(k.dataset.col, 10);
      const digit = parseInt(k.dataset.digit, 10);
      const isDown = (this.mech.keyboard[col] === digit);
      k.classList.toggle('down', isDown);
    });
  }

  _updateFunctionKeyUI() {
    document.getElementById('totalKey').classList.toggle('pressed', this.mech.totalMode);
    document.getElementById('subtotalKey').classList.toggle('pressed', this.mech.subtotalMode);
    document.getElementById('nonAddKey').classList.toggle('pressed', this.mech.nonAddMode);
    const rep = document.getElementById('repeatLever');
    rep.classList.toggle('active', this.mech.repeatMode);
    rep.querySelector('.toggle-ind').textContent = this.mech.repeatMode ? 'ON' : 'OFF';
  }

  _updateDialRegister() {
    const cells = document.querySelectorAll('.dial-cell');
    cells.forEach((cell, i) => {
      const val = this.mech.accumulator[i];
      cell.querySelector('.dial-num').textContent = val;
    });
  }

  _highlightDial(col) {
    const cells = document.querySelectorAll('.dial-cell');
    cells.forEach((cell, i) => {
      cell.classList.toggle('highlight', i === col);
    });
  }

  _renderPaperTape() {
    const tape = document.getElementById('paperTape');
    tape.innerHTML = '';
    this.mech.paperTape.forEach(line => {
      const div = document.createElement('div');
      div.className = line.type || 'entry';
      div.textContent = line.text;
      tape.appendChild(div);
    });

    const viewport = document.getElementById('tapeViewport');
    viewport.scrollTop = viewport.scrollHeight;
  }

  _loadScenario(name) {
    this.mech.clearKeyboard();
    this.mech.totalMode = false;
    this.mech.subtotalMode = false;
    this.mech.repeatMode = false;
    this._updateFunctionKeyUI();

    if (name === 'carry-cascade') {
      // 99,999,999 + 1
      for (let c = 1; c < NUM_COLUMNS; c++) {
        this.mech.accumulator[c] = 9;
      }
      this.mech.accumulator[0] = 0;
      this.mech.keyboard[NUM_COLUMNS - 1] = 1;
      this._updateDialRegister();
      this._updateKeyboardUI();
      // Set to slow motion so user can enjoy the ripple
      this.timeScale = 0.15;
      document.querySelectorAll('.speed-btn').forEach(b => b.classList.toggle('active', b.dataset.speed === '0.08'));
    } else if (name === 'repeat-mult') {
      // 425 x 4
      this.mech.setNumber(425);
      this.mech.repeatMode = true;
      this._updateFunctionKeyUI();
      this._updateKeyboardUI();
    } else if (name === 'dashpot-fail') {
      // Dashpot 0%
      this.mech.dashpotViscosity = 0.0;
      document.getElementById('viscositySlider').value = 0;
      document.getElementById('viscosityValText').textContent = '0% (Un-damped - Overthrow!)';
      this.mech.setNumber(87654);
      this._updateKeyboardUI();
    } else if (name === 'bank-ledger') {
      this.mech.setNumber(12550);
      this._updateKeyboardUI();
    }
  }

  _loop(time) {
    const dt = Math.min(0.1, (time - this.lastTime) / 1000);
    this.lastTime = time;

    this.mech.update(dt, this.timeScale);
    this.renderer.render(dt);

    // Update physical crank visual rotation
    const crankVisual = document.getElementById('crankArmVisual');
    if (crankVisual) {
      const angle = this.mech.handlePos * 38; // 0 to 38 deg forward
      crankVisual.style.transform = `rotate(${angle}deg)`;
    }

    requestAnimationFrame(this._loop.bind(this));
  }

  _setupDemoAPI() {
    window.__demo = {
      app: this,
      mech: this.mech,
      setNumber: (n) => {
        this.mech.setNumber(n);
        this._updateKeyboardUI();
      },
      pullHandle: (speed = 1.0) => this.pullHandle(speed),
      pressTotal: () => {
        this.mech.toggleTotal();
        this._updateFunctionKeyUI();
      },
      pressSubtotal: () => {
        this.mech.toggleSubtotal();
        this._updateFunctionKeyUI();
      },
      toggleRepeat: () => {
        this.mech.toggleRepeat();
        this._updateFunctionKeyUI();
      },
      clear: () => {
        this.mech.clearKeyboard();
        this._updateKeyboardUI();
      },
      setViscosity: (v) => {
        this.mech.dashpotViscosity = v;
        document.getElementById('viscositySlider').value = Math.round(v * 100);
      },
      setSpeed: (s) => {
        this.timeScale = s;
      },
      loadScenario: (name) => this._loadScenario(name),
      getState: () => ({
        phase: this.mech.phase,
        accumulator: [...this.mech.accumulator],
        accumulatorVal: this.mech.getAccumulatorValue(),
        keyboard: [...this.mech.keyboard],
        tapeCount: this.mech.paperTape.length
      })
    };
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.appInstance = new BurroughsApp();
});
