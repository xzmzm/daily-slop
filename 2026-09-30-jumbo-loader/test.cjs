const test = require('node:test');
const assert = require('node:assert');
const C = require('./core.js');

const {OEW, OEW_CG, MZFW, LEMAC, MAC} = C;

test('empty aeroplane sits at its published CG', () => {
  const {weight, cg} = C.compute([]);
  assert.strictEqual(weight, OEW);
  assert.ok(Math.abs(cg - OEW_CG) < 1e-9);
  const v = C.verdict([]);
  assert.strictEqual(v.kind, 'incomplete');
});

test('moment math matches a hand computation', () => {
  // one 18,000 lb machinery crate at station 620, nothing else
  const items = [{type: 'machinery', slot: 'm0'}];   // m0 = main deck STA 620
  const w = OEW + 18000;
  const cgStation = (OEW * (LEMAC + 24 / 100 * MAC) + 18000 * 620) / w;
  const expected = (cgStation - LEMAC) / MAC * 100;
  const {weight, cg} = C.compute(items);
  assert.strictEqual(weight, w);
  assert.ok(Math.abs(cg - expected) < 1e-9);
  assert.ok(cg < 13, 'heavy crate all the way forward must drag CG far forward');
});

test('forward limit tightens as weight rises', () => {
  assert.ok(C.fwdLimit(MZFW) - C.fwdLimit(OEW) > 5);
  assert.ok(C.aftLimit(MZFW) < C.aftLimit(OEW));
  assert.ok(C.fwdLimit(OEW + 1000) > C.fwdLimit(OEW));
});

test('every mission has a legal placement and a nose-heavy failure', () => {
  const solutions = {
    0: {machinery: ['m7', 'm8'], pallet: ['m4', 'l4', 'l5'], mail: ['l0']},
    1: {engine: ['m3'], machinery: ['m5', 'l5', 'm6', 'm7'], mail: ['l2', 'm8']},
    2: {gold: ['l3', 'm5', 'l6', 'm6'], flowers: ['m1', 'm4', 'l5'], mail: ['l0']},
  };
  for (const index of [0, 1, 2]) {
    const mission = C.MISSIONS[index];
    const items = mission.cargo.map(type => ({type, slot: null}));
    // all-forward must fail nose-heavy
    const forward = mission.cargo.map((type, i) => ({type, slot: C.SLOTS[i].id}));
    const fwdVerdict = C.verdict(forward);
    assert.strictEqual(fwdVerdict.kind, 'nose', `mission ${index} all-forward`);
    // the authored solution must dispatch
    for (const item of items) item.slot = solutions[index][item.type].pop();
    const v = C.verdict(items);
    assert.strictEqual(v.kind, 'ok', `mission ${index} solution: ${JSON.stringify(v)}`);
    const {payload} = C.compute(items);
    assert.ok(payload <= MZFW - OEW);
  }
});

test('sandbox can overload the zero-fuel weight', () => {
  const items = Array.from({length: 20}, () => ({type: 'machinery', slot: null}));
  items.forEach((item, i) => { item.slot = C.SLOTS[i % C.SLOTS.length].id; });
  const v = C.verdict(items);
  assert.strictEqual(v.kind, 'weight');
  assert.ok(v.message.includes('zero-fuel'));
});

test('cargo pulls the CG toward its own station', () => {
  for (const slot of C.SLOTS) {
    const pull = C.pullMAC(slot.station);
    const before = C.compute([]).cg;
    const after = C.compute([{type: 'machinery', slot: slot.id}]).cg;
    if (pull > before) assert.ok(after > before, `station ${slot.station}`);
    else assert.ok(after < before, `station ${slot.station}`);
  }
});

test('tail-heavy is reachable with everything stacked aft', () => {
  // mission-1 cargo all-aft: machinery 1740/1600, pallets 1530/1460/1390, mail 1320
  const items = [
    {type: 'machinery', slot: 'm8'}, {type: 'machinery', slot: 'm7'},
    {type: 'pallet', slot: 'l6'}, {type: 'pallet', slot: 'm6'}, {type: 'pallet', slot: 'l5'},
    {type: 'mail', slot: 'm5'},
  ];
  assert.strictEqual(C.verdict(items).kind, 'tail');
});
