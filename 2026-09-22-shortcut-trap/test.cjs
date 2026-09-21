'use strict';
const assert = require('node:assert/strict');
const {solve,evaluate} = require('./model.js');
let assertions=0, cases=0, samples=0;
function check(condition,message){assert.ok(condition,message);assertions++;}
function near(a,b,eps=1e-7){check(Math.abs(a-b)<eps,`${a} != ${b}`);}
const closed=solve(),open=solve({open:true}),opt=solve({open:true,policy:'coordinated'});
near(closed.average,65);assert.deepEqual(closed.flows,[2000,2000,0]);
near(open.average,80);near(open.delta,15);assert.deepEqual(open.flows,[0,0,4000]);assert.deepEqual(open.costs,[85,85,80]);
near(opt.average,64.6875);assert.deepEqual(opt.flows,[1750,1750,500]);near(opt.gap,22.5);
near(solve({demand:1000,open:true}).average,20);
near(solve({demand:4500,open:true}).average,90);
near(solve({demand:9000,open:true}).flows[2],0);
near(solve({demand:10000,open:true}).average,95);
for(let demand=1000;demand<=10000;demand+=100)for(let delay=0;delay<=40;delay++)for(const enabled of [false,true])for(const policy of ['selfish','coordinated']){
 const r=solve({demand,delay,open:enabled,policy});cases++;
 near(r.flows.reduce((a,b)=>a+b,0),demand);
 check(r.flows.every(v=>Number.isFinite(v)&&v>=0),'Invalid route flow');
 near(r.edges[0]+r.edges[2],demand);near(r.edges[1]+r.edges[3],demand);
 near(r.edges[0],r.edges[1]+r.edges[4]);near(r.edges[3],r.edges[2]+r.edges[4]);
 near(r.average,r.total/demand);
 if(!enabled)near(r.flows[2],0);
 if(policy==='selfish')near(r.gap,0);
 else {check(r.average<=solve({demand,delay,open:enabled}).average+1e-8,'Optimum worse than equilibrium');check(r.average<=r.baseline+1e-8,'Extra option worsened optimum');}
}
// Independent exhaustive simplex grid: include asymmetric route assignments.
for(const demand of [1000,3000,4000,4500,7000,10000])for(const delay of [0,7,20,40]){
 const opt=solve({demand,delay,open:true,policy:'coordinated'});
 for(let a=0;a<=80;a++)for(let b=0;b<=80-a;b++){
  const candidate=evaluate([demand*a/80,demand*b/80,demand*(80-a-b)/80],delay);
  check(candidate.average>=opt.average-1e-8,'Found a lower-cost feasible assignment');samples++;
 }
}
for(const bad of [{demand:0},{demand:NaN},{demand:Infinity},{demand:-1},{delay:-1},{delay:46},{policy:'magic'},{open:'yes'}]){assert.throws(()=>solve(bad));assertions++;}
console.log(JSON.stringify({status:'passed',scenario_cases:cases,independent_optimum_samples:samples,assertions},null,2));
