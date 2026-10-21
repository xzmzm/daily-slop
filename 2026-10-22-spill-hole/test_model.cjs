const assert=require('node:assert/strict');const M=require('./model.js');
const a=M.trajectory(0),b=M.trajectory(6),c=M.trajectory(20);
assert(b.vt>a.vt&&c.vt>b.vt);assert(b.rms<a.rms*.3&&c.rms<b.rms);
assert(c.landing<b.landing&&b.landing<a.landing);
assert.deepEqual(M.trajectory(0),a);
for(const v of [0,1,6,10,20]){const q=M.trajectory(v);assert(Math.abs(.5*M.RHO*q.dragArea*q.vt**2-M.MASS*M.G)<1e-9);let prev=120;for(const s of q.samples){assert(Number.isFinite(s.angle));assert(s.height<=prev+1e-9&&s.height>=0);assert(s.v>=0&&s.v<=q.vt);assert(Math.abs(s.angle)<Math.PI/3);prev=s.height;}
assert.equal(M.at(q,30).height,0);assert.equal(M.at(q,0).height,120);assert.equal(M.at(q,-1).t,0);assert.equal(M.at(q,40).t,30);assert(M.at(q,q.landing-.1).height>0);}
assert.equal(M.parameters(-10).p,0);assert.equal(M.parameters(90).p,.2);
console.log('Model passed: force balance, monotone descent, vent tradeoff, landing, deterministic traces, finite angles, bounds.');
