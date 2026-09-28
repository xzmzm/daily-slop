const {test} = require('node:test');
const assert = require('node:assert/strict');
const C = require('./core.js');
const close = (a,b) => assert.ok(Math.abs(a-b)<1e-8, `${a} != ${b}`);

test('three valid demand distributions share a mean but not a shape', () => {
  for (const {pmf} of Object.values(C.forecasts)) {
    close(pmf.reduce((a,b)=>a+b),1);close(C.mean(pmf),24);
    assert.equal(pmf.length,49);assert.ok(pmf.every(p=>p>=0));
  }
  assert.notDeepEqual(C.forecasts.regular.pmf,C.forecasts.split.pmf);
});
test('each morning conserves buns and customers, including empty and full trays', () => {
  for(let q=0;q<=48;q++) for(let d=0;d<=48;d++) {
    const day=C.outcome(q,d,1.25);
    assert.equal(day.sold+day.leftover,q);assert.equal(day.sold+day.missed,d);
    assert.equal(day.margin,3*day.sold-1.25*q);
    assert.ok(day.sold>=0 && day.leftover>=0 && day.missed>=0);
  }
  assert.deepEqual(C.outcome(0,24),{sold:0,leftover:0,missed:24,margin:0});
  assert.deepEqual(C.outcome(48,24),{sold:24,leftover:24,missed:0,margin:24});
});
test('expected results agree with a hand-computed two-point example', () => {
  const p=Array(49).fill(0);p[10]=.75;p[30]=.25;
  assert.deepEqual(C.expected(20,p),{sold:12.5,leftover:7.5,missed:2.5,margin:17.5});
});
test('marginal benefit equals price times next-bun sell probability minus cost', () => {
  for(const {pmf} of Object.values(C.forecasts)) for(let q=0;q<48;q++) {
    close(C.expected(q+1,pmf,1.25).margin-C.expected(q,pmf,1.25).margin,3*C.sellChance(q,pmf)-1.25);
  }
});
test('optimizer matches independent critical quantile across every cost setting', () => {
  for(const {pmf} of Object.values(C.forecasts)) for(let cost=.5;cost<=2.5;cost+=.25) {
    const threshold=(3-cost)/3;
    let cumulative=0;
    const q=pmf.findIndex(p=>(cumulative+=p)>=threshold-1e-10);
    assert.equal(C.bestBatch(pmf,cost).q,q);
  }
  assert.deepEqual(Object.values(C.forecasts).map(f=>C.bestBatch(f.pmf).q),[25,33,19]);
});
test('ties choose less waste, and raising bake costs never raises the optimum', () => {
  close(C.expected(19,C.forecasts.spike.pmf).margin,C.expected(20,C.forecasts.spike.pmf).margin);
  assert.equal(C.bestBatch(C.forecasts.spike.pmf).q,19);
  for(const {pmf} of Object.values(C.forecasts)) {
    let previous=48;
    for(let cost=.5;cost<=2.5;cost+=.25) {const q=C.bestBatch(pmf,cost).q;assert.ok(q<=previous);previous=q;}
  }
});
test('replay preserves customers; new month changes the seeded sample', () => {
  for(const {pmf} of Object.values(C.forecasts)) {
    const a=C.month(pmf,9292026),b=C.month(pmf,9292026),c=C.month(pmf,9292027);
    assert.deepEqual(a,b);assert.notDeepEqual(a,c);assert.equal(a.length,30);
    assert.ok(a.every(d=>pmf[d]>0));
    close(C.average(24,a).sold+C.average(24,a).leftover,24);
    close(C.average(24,a).sold+C.average(24,a).missed,a.reduce((s,d)=>s+d)/30);
  }
});
