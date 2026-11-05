const assert = require('node:assert/strict');
const m = require('./model.js');
const near = (a,b,t=1e-10) => assert.ok(Math.abs(a-b)<t, `${a} != ${b}`);
for (const length of [.4,.65,1]) {
  near(m.frequency('cone',length),2*m.frequency('cylinder',length));
  near(m.frequency('cylinder',length,2)/m.frequency('cylinder',length),3);
  near(m.frequency('cone',length,2)/m.frequency('cone',length),2);
  for (const kind of ['cylinder','cone']) {
    near(m.frequency(kind,length*2),m.frequency(kind,length)/2);
    for (let mode=1; mode<=5; mode++) {
      near(m.pressure(kind,mode,0),1);
      near(m.pressure(kind,mode,1),0);
      const nodes=m.nodes(kind,mode);
      assert.equal(nodes.length,mode-1);
      for (const x of nodes) {near(m.pressure(kind,mode,x),0);assert.ok(x>0&&x<1);}
      // A sampled sign change must agree with every analytically located interior node.
      let crossings=0, previous=m.pressure(kind,mode,.00001);
      for(let i=1;i<2000;i++) {const p=m.pressure(kind,mode,i/2000);if(p*previous<0)crossings++;if(Math.abs(p)>1e-12)previous=p;}
      assert.equal(crossings,mode-1);
    }
  }
}
near(m.frequency('cylinder',.65),131.92307692307693);
near(m.nodes('cylinder',2)[0],1/3);near(m.nodes('cone',2)[0],1/2);
assert.deepEqual(m.note(440),{name:'A4',cents:0});assert.equal(m.note(261.625565).name,'C4');
for (const bad of [0,-1,NaN,Infinity]) {assert.throws(()=>m.frequency('cone',bad),RangeError);assert.throws(()=>m.note(bad),RangeError);}
assert.throws(()=>m.frequency('triangle',1),RangeError);
assert.throws(()=>m.pressure('cone',1,-.1),RangeError);
assert.throws(()=>m.nodes('cone',1.5),RangeError);
console.log('PASS: ideal bore frequencies, octave/twelfth ratios, inverse length, boundary conditions, pressure nodes, pitch names, invalid inputs.');
