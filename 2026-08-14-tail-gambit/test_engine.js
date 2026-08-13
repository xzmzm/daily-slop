const assert = require("assert");
const E = require("./engine.js");
let n = 0;
function near(a,b,eps=1e-9){assert.ok(Math.abs(a-b)<=eps,`${a} != ${b}`);n++}
near(E.clamp(-2,0,1),0); near(E.clamp(.4,0,1),.4); near(E.clamp(2,0,1),1);
near(E.gaussian(3,3,.2),1); assert.ok(E.gaussian(2,3,.2)<1e-4);n++;
for(const key of Object.keys(E.STRATEGIES)){
  const s=E.strategy(key);near(E.motionEnvelope(0,key),s.vigor);assert.ok(E.motionEnvelope(s.decay,key)<E.motionEnvelope(0,key));n++;
  const idealRelease=2.4-s.optimalLead-s.fractureDelay;
  const ideal=E.resolveStrike(idealRelease,2.4,key);near(ideal.lead,s.optimalLead);near(ideal.timing,1);assert.equal(ideal.outcome,"escaped");n++;
  assert.equal(E.resolveStrike(2.5,2.4,key).outcome,"late");n++;
  assert.equal(E.resolveStrike(null,2.4,key).outcome,"caught");n++;
  const early=E.resolveStrike(.2,2.4,key);assert.ok(early.score<ideal.score);n++;
  const r0=E.recovery(0,key), r1=E.recovery(s.regrowDays,key);near(r0.length,0);near(r1.length,1);assert.ok(r1.energy>r0.energy);n++;assert.ok(r1.sprint>r0.sprint);n++;
  for(let d=0;d<s.regrowDays;d+=3){const a=E.recovery(d,key),b=E.recovery(d+1,key);assert.ok(b.length>=a.length&&b.energy>=a.energy&&b.sprint>=a.sprint);n++}
}
for(let i=0;i<5;i++) near(E.tailWave(i,-1,"gecko"),0);
assert.ok(Math.abs(E.tailWave(0,.05,"gecko")-E.tailWave(1,.05,"gecko"))>.1);n++;
console.log(`tail-gambit engine: ${n} assertions passed`);
