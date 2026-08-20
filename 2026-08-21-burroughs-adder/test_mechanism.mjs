import { BurroughsMechanism, PHASES, NUM_COLUMNS } from './mechanism.js';

function assert(cond, msg) {
  if (!cond) throw new Error('Assertion failed: ' + msg);
}

console.log('Testing BurroughsMechanism...');

const mech = new BurroughsMechanism();

// Test 1: Basic addition 125 + 350 = 475
mech.setNumber(125);
assert(mech.keyboard[6] === 1 && mech.keyboard[7] === 2 && mech.keyboard[8] === 5, 'Keyboard set 125');

mech.pullHandle(1.0);
while (mech.phase !== PHASES.IDLE) {
  mech.update(0.05);
}
assert(mech.getAccumulatorValue() === 125, `Expected 125, got ${mech.getAccumulatorValue()}`);
assert(mech.keyboard.every(k => k === 0), 'Keyboard cleared after pull');

mech.setNumber(350);
mech.pullHandle(1.0);
while (mech.phase !== PHASES.IDLE) {
  mech.update(0.05);
}
assert(mech.getAccumulatorValue() === 475, `Expected 475, got ${mech.getAccumulatorValue()}`);

// Test 2: Tens carry ripple across 9 decades (99,999,999 + 1)
mech.reset();
for (let c = 1; c < NUM_COLUMNS; c++) {
  mech.accumulator[c] = 9;
}
mech.accumulator[0] = 0;
mech.keyboard[8] = 1;

mech.pullHandle(1.0);
while (mech.phase !== PHASES.IDLE) {
  mech.update(0.02);
}
assert(mech.getAccumulatorValue() === 100000000, `Expected 100,000,000 after cascade carry, got ${mech.getAccumulatorValue()}`);

// Test 3: Total clearing
mech.toggleTotal();
mech.pullHandle(1.0);
while (mech.phase !== PHASES.IDLE) {
  mech.update(0.05);
}
assert(mech.getAccumulatorValue() === 0, `Expected 0 after total clear, got ${mech.getAccumulatorValue()}`);
const lastTape = mech.paperTape[mech.paperTape.length - 1];
assert(lastTape.symbol === '*' && lastTape.value === 100000000, 'Printed total line with *');

// Test 4: Repeat mode multiplication (425 x 4 = 1700)
mech.setNumber(425);
mech.toggleRepeat();
for (let i = 0; i < 4; i++) {
  mech.pullHandle(1.0);
  while (mech.phase !== PHASES.IDLE) {
    mech.update(0.05);
  }
}
assert(mech.getAccumulatorValue() === 1700, `Expected 1700, got ${mech.getAccumulatorValue()}`);
assert(mech.keyboard[6] === 4 && mech.keyboard[7] === 2 && mech.keyboard[8] === 5, 'Keys remained down in repeat mode');

console.log('All mechanical engine tests passed successfully!');
