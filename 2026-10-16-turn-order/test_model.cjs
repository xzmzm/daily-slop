const assert = require('node:assert/strict');
const M = require('./model.js');
const near = (a,b,eps=1e-6) => assert.ok(Math.abs(a-b)<eps, `${a} != ${b}`);
const vectorNear = (a,b) => a.forEach((v,i)=>near(v,b[i]));

// Right-handed, active rotations about fixed room axes.
vectorNear(M.rotate(M.turn('x',90),[0,1,0]),[0,0,1]);
vectorNear(M.rotate(M.turn('y',90),[0,0,1]),[1,0,0]);
vectorNear(M.rotate(M.turn('z',90),[1,0,0]),[0,1,0]);
const xy=M.presets.two(), yx=xy.slice().reverse();
const a=M.pose(xy),b=M.pose(yx);
vectorNear(M.rotate(a,[0,0,1]),[0,-1,0]);
vectorNear(M.rotate(b,[0,0,1]),[1,0,0]);
near(M.distance(a,b),120);
near(M.distance(a,M.identity()),120);
near(M.distance(b,M.identity()),120);
near(M.distance(M.pose(xy,180),M.pose(yx,180)),0);
near(M.distance(a,a.map(x=>-x)),0);
near(M.distance(M.pose(M.presets.loop()),M.identity()),120);
near(M.distance(M.pose(M.presets.one()),M.identity()),0);
near(M.distance(M.pose([],90),M.identity()),0);
near(M.distance(M.pose(xy,0),M.identity()),0);
near(M.distance(M.pose(xy,90,0),M.identity()),0);
near(M.distance(M.pose(xy,90,1),M.turn('x',90)),0);
near(M.distance(M.pose(xy,90,.5),M.turn('x',45)),0);

// Independent coordinate rotations verify composition, including negative turns.
function coordinateTurn(v,axis,degrees) {
  const [x,y,z]=v,c=Math.cos(degrees*Math.PI/180),s=Math.sin(degrees*Math.PI/180);
  if(axis==='x')return[x,c*y-s*z,s*y+c*z];
  if(axis==='y')return[c*x+s*z,y,-s*x+c*z];
  return[c*x-s*y,s*x+c*y,z];
}
let seed=4319;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
for(let i=0;i<240;i++) {
  const moves=Array.from({length:6},()=>({axis:['x','y','z'][Math.floor(random()*3)],sign:random()<.5?-1:1}));
  const angle=Math.floor(random()*13)*15;
  let v=[.3,-.7,.2];
  for(const m of moves)v=coordinateTurn(v,m.axis,m.sign*angle);
  const q=M.pose(moves,angle);
  vectorNear(M.rotate(q,[.3,-.7,.2]),v);
  near(Math.hypot(...q),1);
  const inverse=moves.slice().reverse().map(m=>({...m,sign:-m.sign}));
  near(M.distance(M.pose([...moves,...inverse],angle),M.identity()),0,1e-5);
}
console.log('Rotation checks passed: known poses, 120° separation, half-turn equivalence, scrubbing, 240 independent sequences and inverses.');
