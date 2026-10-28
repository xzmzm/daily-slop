const assert=require('node:assert/strict');
const M=require('./model.js');
for(const scene of Object.keys(M.scenarios))for(const retry of [true,false]){
 const r=M.create('HELLO FROM THE OTHER SIDE',scene,retry);
 for(let t=0;t<=10;t+=.05){const s=M.at(r,t);assert.equal(s.delivered,r.packets.slice(0,s.count).map(p=>p.text).join(''));assert(s.buffered.every(id=>id>s.count));assert.equal(new Set(s.received).size,s.received.length);}
 const s=M.at(r,10);assert.equal(s.complete,scene!=='missing'||retry);
}
let r=M.create();assert.deepEqual(M.at(r,4.4).received,[1,3,5]);assert.equal(M.at(r,4.4).delivered,'HELL');assert.deepEqual(M.at(r,4.4).buffered,[3,5]);
r=M.create(undefined,'missing');assert.equal(M.at(r,8.04).count,1);assert.equal(M.at(r,8.05).count,6);assert.equal(M.at(r,8.05).delivered,r.message);
for(const message of ['A','AB','你好，远方的朋友！','<script>&"test','😀😃😄😁😆😅😂🤣😊😇','a'.repeat(80),'']){r=M.create(message);assert.equal(M.at(r,10).delivered,r.message);assert(Array.from(r.message).length<=36);assert(r.packets.length<=6);}
console.log('PASS: event ordering, buffered gaps, exact retry boundary, no-retry failure, Unicode, short/empty/long messages, complete reconstruction.');
