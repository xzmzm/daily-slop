/**
 * Burroughs Adding Machine (1888) - Mechanical Simulation Engine
 * Models the 9-column differential stop-rack, 4-phase cycle, tens-carry ripple,
 * hydraulic dashpot damping, and total/subtotal register clearance.
 */

export const NUM_COLUMNS = 9;
export const MAX_DIGIT = 9;

export const PHASES = {
  IDLE: 'IDLE',
  PULL: 'PULL',
  STRIKE: 'STRIKE',
  RETURN: 'RETURN',
  CARRY: 'CARRY'
};

export class BurroughsMechanism {
  constructor() {
    this.reset();
  }

  reset() {
    // 9 accumulator wheels (col 0 = 100M, col 8 = units)
    this.accumulator = new Array(NUM_COLUMNS).fill(0);
    // Keys currently depressed on keyboard (0 = none, 1..9 = key value)
    this.keyboard = new Array(NUM_COLUMNS).fill(0);
    // Position of each sector rack (0.0 to 9.0)
    this.rackPositions = new Array(NUM_COLUMNS).fill(0);
    // Pinion angles for smooth visual rotation (in radians)
    this.pinionAngles = new Array(NUM_COLUMNS).fill(0);
    // Carry latches primed during return stroke (col 0..8)
    this.carryPrimed = new Array(NUM_COLUMNS).fill(false);
    // Pinion mesh state: true = meshed with rack, false = unmeshed
    this.pinionsMeshed = false;

    // Control levers & keys
    this.repeatMode = false;
    this.totalMode = false;
    this.subtotalMode = false;
    this.nonAddMode = false;

    // Dashpot & physics parameters
    this.dashpotEnabled = true;
    this.dashpotViscosity = 1.0; // 0.0 (un-damped) to 1.0 (perfect oil damper)
    this.handleVelocity = 0;
    this.lastOverthrowError = null;

    // Cycle & animation state
    this.phase = PHASES.IDLE;
    this.handlePos = 0; // 0.0 (rest) to 1.0 (full pull)
    this.cycleProgress = 0; // 0.0 to 1.0 inside current phase
    this.carryColIndex = -1; // Column currently processing carry ripple

    // Paper audit listing tape
    this.paperTape = [
      { text: '1888 BURROUGHS', type: 'header' },
      { text: 'CALCULATING MACHINE', type: 'header' },
      { text: 'PATENT AUG 21 1888', type: 'header' },
      { text: '-------------------', type: 'sep' },
      { text: '         0.00 *', type: 'clear' }
    ];

    // Listeners for audio & UI events
    this.eventListeners = [];
  }

  on(eventName, callback) {
    this.eventListeners.push({ eventName, callback });
  }

  emit(eventName, data) {
    for (const l of this.eventListeners) {
      if (l.eventName === eventName) {
        l.callback(data);
      }
    }
  }

  /**
   * Press a key in a given column (0..8) with digit (1..9).
   * Pressing an already-down key pops it back up (toggles).
   */
  pressKey(col, digit) {
    if (this.phase !== PHASES.IDLE) return false;
    if (col < 0 || col >= NUM_COLUMNS) return false;
    if (digit < 1 || digit > 9) return false;

    const prev = this.keyboard[col];
    if (prev === digit) {
      this.keyboard[col] = 0;
      this.emit('keyRelease', { col, digit });
    } else {
      this.keyboard[col] = digit;
      this.emit('keyPress', { col, digit, prev });
    }
    return true;
  }

  /**
   * Set an entire number across columns (e.g. 1250)
   */
  setNumber(num) {
    if (this.phase !== PHASES.IDLE) return;
    const str = Math.floor(Math.abs(num)).toString();
    this.clearKeyboard();
    const offset = NUM_COLUMNS - str.length;
    for (let i = 0; i < str.length; i++) {
      const d = parseInt(str[i], 10);
      if (d > 0 && offset + i >= 0 && offset + i < NUM_COLUMNS) {
        this.keyboard[offset + i] = d;
      }
    }
    this.emit('keyboardUpdated');
  }

  clearKeyboard() {
    if (this.phase !== PHASES.IDLE) return;
    let hadKeys = false;
    for (let c = 0; c < NUM_COLUMNS; c++) {
      if (this.keyboard[c] !== 0) {
        this.keyboard[c] = 0;
        hadKeys = true;
      }
    }
    if (hadKeys) {
      this.emit('keyboardCleared');
    }
  }

  toggleRepeat() {
    if (this.phase !== PHASES.IDLE) return;
    this.repeatMode = !this.repeatMode;
    this.emit('modeChanged', { mode: 'repeat', active: this.repeatMode });
  }

  toggleTotal() {
    if (this.phase !== PHASES.IDLE) return;
    this.totalMode = !this.totalMode;
    if (this.totalMode) {
      this.subtotalMode = false;
      this.nonAddMode = false;
    }
    this.emit('modeChanged', { mode: 'total', active: this.totalMode });
  }

  toggleSubtotal() {
    if (this.phase !== PHASES.IDLE) return;
    this.subtotalMode = !this.subtotalMode;
    if (this.subtotalMode) {
      this.totalMode = false;
      this.nonAddMode = false;
    }
    this.emit('modeChanged', { mode: 'subtotal', active: this.subtotalMode });
  }

  toggleNonAdd() {
    if (this.phase !== PHASES.IDLE) return;
    this.nonAddMode = !this.nonAddMode;
    if (this.nonAddMode) {
      this.totalMode = false;
      this.subtotalMode = false;
    }
    this.emit('modeChanged', { mode: 'nonAdd', active: this.nonAddMode });
  }

  getAccumulatorValue() {
    let val = 0;
    for (let i = 0; i < NUM_COLUMNS; i++) {
      val = val * 10 + this.accumulator[i];
    }
    return val;
  }

  getKeyboardValue() {
    let val = 0;
    for (let i = 0; i < NUM_COLUMNS; i++) {
      val = val * 10 + this.keyboard[i];
    }
    return val;
  }

  formatValue(val, symbol = '') {
    const formatted = val.toLocaleString('en-US');
    return `${formatted.padStart(12, ' ')} ${symbol}`.trimStart();
  }

  /**
   * Start the operating handle stroke.
   */
  pullHandle(pullSpeed = 1.0) {
    if (this.phase !== PHASES.IDLE) return false;
    this.phase = PHASES.PULL;
    this.handlePos = 0;
    this.cycleProgress = 0;
    this.handleVelocity = pullSpeed;
    this.carryPrimed.fill(false);
    this.lastOverthrowError = null;

    // In Total/Subtotal mode, the accumulator is engaged on the DOWNSTROKE to rewind to zero stops
    if (this.totalMode || this.subtotalMode) {
      this.pinionsMeshed = true;
    } else {
      this.pinionsMeshed = false;
    }

    this.emit('cycleStart', {
      total: this.totalMode,
      subtotal: this.subtotalMode,
      nonAdd: this.nonAddMode,
      repeat: this.repeatMode
    });
    return true;
  }

  /**
   * Advance cycle state by dt seconds.
   */
  update(dt, timeScale = 1.0) {
    if (this.phase === PHASES.IDLE) return;

    const effectiveDt = dt * timeScale;

    switch (this.phase) {
      case PHASES.PULL:
        this._updatePull(effectiveDt);
        break;
      case PHASES.STRIKE:
        this._updateStrike(effectiveDt);
        break;
      case PHASES.RETURN:
        this._updateReturn(effectiveDt);
        break;
      case PHASES.CARRY:
        this._updateCarry(effectiveDt);
        break;
    }
  }

  _updatePull(dt) {
    const speed = 2.5 * (this.handleVelocity || 1.0);
    this.handlePos = Math.min(1.0, this.handlePos + dt * speed);
    this.cycleProgress = this.handlePos;

    for (let c = 0; c < NUM_COLUMNS; c++) {
      let targetDigit = 0;
      if (this.totalMode || this.subtotalMode) {
        targetDigit = this.accumulator[c];
      } else {
        targetDigit = this.keyboard[c];
      }
      this.rackPositions[c] = targetDigit * this.handlePos;
    }

    this.emit('ratchetUpdate', { handlePos: this.handlePos });

    if (this.handlePos >= 1.0) {
      this.phase = PHASES.STRIKE;
      this.cycleProgress = 0;
      this._executeStrike();
    }
  }

  _executeStrike() {
    let printedNum = 0;
    let symbol = '';

    if (this.totalMode) {
      printedNum = this.getAccumulatorValue();
      symbol = '*';
    } else if (this.subtotalMode) {
      printedNum = this.getAccumulatorValue();
      symbol = '◇';
    } else if (this.nonAddMode) {
      printedNum = this.getKeyboardValue();
      symbol = '#';
    } else {
      printedNum = this.getKeyboardValue();
      symbol = '';
    }

    const formattedLine = this.formatValue(printedNum, symbol);
    this.paperTape.push({
      text: formattedLine,
      value: printedNum,
      symbol,
      type: symbol === '*' ? 'total' : symbol === '◇' ? 'subtotal' : symbol === '#' ? 'nonadd' : 'entry'
    });

    this.emit('hammerStrike', { printedNum, symbol, formattedLine });

    if (this.totalMode) {
      this.pinionsMeshed = false;
      this.accumulator.fill(0);
    } else if (this.subtotalMode) {
      this.pinionsMeshed = true;
    } else if (this.nonAddMode) {
      this.pinionsMeshed = false;
    } else {
      this.pinionsMeshed = true;
    }
  }

  _updateStrike(dt) {
    this.cycleProgress += dt * 8.0;
    if (this.cycleProgress >= 1.0) {
      this.phase = PHASES.RETURN;
      this.cycleProgress = 0;
    }
  }

  _updateReturn(dt) {
    let returnRate = 2.0;
    if (!this.dashpotEnabled || this.dashpotViscosity < 0.15) {
      returnRate = 14.0;
    } else {
      returnRate = 1.8 / Math.max(0.2, this.dashpotViscosity);
    }

    const prevHandle = this.handlePos;
    this.handlePos = Math.max(0.0, this.handlePos - dt * returnRate);
    const deltaHandle = prevHandle - this.handlePos;

    for (let c = 0; c < NUM_COLUMNS; c++) {
      let targetDigit = 0;
      if (this.subtotalMode) {
        const lastEntry = this.paperTape[this.paperTape.length - 1];
        targetDigit = lastEntry.value.toString().padStart(NUM_COLUMNS, '0')[c] | 0;
      } else if (this.totalMode || this.nonAddMode) {
        targetDigit = 0;
      } else {
        targetDigit = this.keyboard[c];
      }

      this.rackPositions[c] = targetDigit * this.handlePos;

      if (this.pinionsMeshed && targetDigit > 0) {
        const teethAdvanced = targetDigit * deltaHandle;
        const prevAcc = this.accumulator[c];
        const newExact = prevAcc + teethAdvanced;
        this.pinionAngles[c] += teethAdvanced * (Math.PI * 2 / 10);

        if (Math.floor(newExact) >= 10 && prevAcc < 10) {
          this.carryPrimed[c] = true;
          this.emit('carryLatchPrimed', { col: c });
        }
      }
    }

    this.emit('dashpotFlow', {
      handlePos: this.handlePos,
      velocity: returnRate,
      viscosity: this.dashpotViscosity
    });

    if (this.handlePos <= 0.0) {
      this.handlePos = 0.0;
      this.rackPositions.fill(0);

      if (this.pinionsMeshed) {
        for (let c = 0; c < NUM_COLUMNS; c++) {
          if (!this.totalMode && !this.nonAddMode) {
            const add = this.keyboard[c];
            const sum = this.accumulator[c] + add;
            if (sum >= 10) {
              this.accumulator[c] = sum % 10;
              this.carryPrimed[c] = true;
            } else {
              this.accumulator[c] = sum;
            }
          }
        }
      }

      if (!this.dashpotEnabled || this.dashpotViscosity < 0.15) {
        this._applyMomentumOverthrow();
      }

      if (!this.repeatMode && !this.totalMode && !this.subtotalMode) {
        this.keyboard.fill(0);
        this.emit('keyboardCleared');
      }

      this.totalMode = false;
      this.subtotalMode = false;
      this.nonAddMode = false;

      const hasCarries = this.carryPrimed.some(p => p);
      if (hasCarries) {
        this.phase = PHASES.CARRY;
        this.cycleProgress = 0;
        this.carryColIndex = NUM_COLUMNS - 1;
      } else {
        this.phase = PHASES.IDLE;
        this.emit('cycleComplete', { accumulator: this.accumulator });
      }
    }
  }

  _applyMomentumOverthrow() {
    let errorHappened = false;
    for (let c = 0; c < NUM_COLUMNS; c++) {
      if (this.keyboard[c] > 3 && Math.random() < 0.65) {
        const extraTeeth = Math.floor(Math.random() * 2) + 1;
        this.accumulator[c] = (this.accumulator[c] + extraTeeth) % 10;
        errorHappened = true;
      }
    }
    if (errorHappened) {
      this.lastOverthrowError = 'Momentum Overthrow: Gear overshoot due to missing dashpot damping!';
      this.emit('overthrowOccurred', { message: this.lastOverthrowError });
    }
  }

  _updateCarry(dt) {
    this.cycleProgress += dt * 10.0;

    if (this.cycleProgress >= 1.0) {
      this.cycleProgress = 0;

      while (this.carryColIndex >= 0 && !this.carryPrimed[this.carryColIndex]) {
        this.carryColIndex--;
      }

      if (this.carryColIndex >= 0) {
        const c = this.carryColIndex;
        this.carryPrimed[c] = false;

        if (c > 0) {
          const targetCol = c - 1;
          const nextVal = this.accumulator[targetCol] + 1;
          this.emit('carryNudge', { fromCol: c, toCol: targetCol });
          if (nextVal >= 10) {
            this.accumulator[targetCol] = 0;
            this.carryPrimed[targetCol] = true;
          } else {
            this.accumulator[targetCol] = nextVal;
          }
        } else {
          this.emit('overflowChime');
        }
      }

      const remaining = this.carryPrimed.some(p => p);
      if (!remaining || this.carryColIndex < 0) {
        this.phase = PHASES.IDLE;
        this.carryColIndex = -1;
        this.emit('cycleComplete', { accumulator: this.accumulator });
      }
    }
  }
}
