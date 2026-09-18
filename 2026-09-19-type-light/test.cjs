'use strict';
const assert=require('node:assert/strict');
const C=require('./core.js');
let checks=0;
function test(name,fn){fn();checks++;console.log(`PASS ${name}`);}
const near=(a,b,eps=1e-9)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);
test('sRGB black and white',()=>{near(C.luminance(0,0,0),0);near(C.luminance(255,255,255),1);});
test('sRGB linearization',()=>{near(C.linear(128),.21586050011389926);near(C.linear(10),10/255/12.92);});
test('linear-light primary weights',()=>{near(C.luminance(255,0,0),.2126);near(C.luminance(0,255,0),.7152);near(C.luminance(0,0,255),.0722);});
test('exposure is a stop',()=>{near(C.tone(.2,1,1),.4);near(C.tone(.2,-1,1),.1);});
test('contrast pivots on 18% gray',()=>near(C.tone(.18,0,2),.18));
test('tone clips to display range',()=>{near(C.tone(1,2,2),1);near(C.tone(0,0,2),0);});
test('nearest level including ties and endpoints',()=>{assert.equal(C.nearest(.5,[0,1]),0);assert.equal(C.nearest(2,[0,.2,1]),2);assert.equal(C.nearest(-1,[0,1]),0);assert.equal(C.nearest(.18,[0,.2,1]),1);});
for(const mode of ['none','ordered','diffusion']){
 test(`${mode}: black stays black`,()=>assert.ok(C.quantize(new Array(64).fill(0),8,8,[0,.3,1],mode).every(i=>i===0)));
 test(`${mode}: white stays white`,()=>assert.ok(C.quantize(new Array(64).fill(1),8,8,[0,.3,1],mode).every(i=>i===2)));
 test(`${mode}: valid bounds and deterministic`,()=>{const values=Array.from({length:1024},(_,i)=>((i*7919)%1024)/1023),r=C.quantize(values,32,32,[0,.1,.3,.7,1],mode);assert.ok(r.every(i=>i<5));assert.deepEqual(r,C.quantize(values,32,32,[0,.1,.3,.7,1],mode));});
}
test('Bayer: half-tone occupies half the cells',()=>assert.equal(C.quantize(new Array(256).fill(.5),16,16,[0,1],'ordered').reduce((s,x)=>s+x,0),128));
test('Bayer: quarter-tone occupies a quarter',()=>assert.equal(C.quantize(new Array(256).fill(.25),16,16,[0,1],'ordered').reduce((s,x)=>s+x,0),64));
test('error diffusion preserves broad tone',()=>{const q=C.quantize(new Array(4096).fill(.3),64,64,[0,1],'diffusion');near(q.reduce((s,x)=>s+x,0)/q.length,.3,.015);});
test('diffusion does not wrap row edges',()=>assert.deepEqual([...C.quantize([.6,0,0,0],2,2,[0,1],'diffusion')],[1,0,0,0]));
test('one-cell and one-column images',()=>{assert.deepEqual([...C.quantize([.8],1,1,[0,1],'diffusion')],[1]);assert.equal(C.quantize([.2,.5,.8],1,3,[0,1],'diffusion').length,3);});
test('duplicate levels are safe',()=>assert.ok(C.quantize([.5,.7],2,1,[0,.5,.5,1],'ordered').every(Number.isFinite)));
test('export preserves spaces and line width',()=>assert.equal(C.textFromIndices(new Uint16Array([0,1,1,0]),2,[' ','@']),' @\n@ '));
test('invalid input is rejected',()=>{assert.throws(()=>C.quantize([.2],2,2,[0,1]),RangeError);assert.throws(()=>C.quantize([NaN],1,1,[0,1]),RangeError);assert.throws(()=>C.quantize([.5],1,1,[1,0]),RangeError);assert.throws(()=>C.quantize([.5],1,1,[0,1],'bad'),RangeError);assert.throws(()=>C.textFromIndices([0,1],3,[' ','@']),RangeError);});
console.log(`${checks} test groups passed.`);
