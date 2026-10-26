const assert=require('node:assert/strict');
const {response,db,SLOW,WIDTH}=require('./model.js');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
for(const f of [0,100,1000,10000,15000]){close(response(f,0),1);close(db(f,0),0)}
// One wavelength of skew across the track must cancel exactly.
const angle=.4,firstNull=SLOW/(WIDTH*Math.tan(angle*Math.PI/180));
close(response(firstNull,angle),0);
close(response(firstNull/2,angle),2/Math.PI);
for(const f of [100,3000,10000]){close(response(f,angle),response(f,-angle));close(response(f,angle,SLOW*2),response(f/2,angle))}
assert.ok(db(1000,angle)>db(5000,angle));
console.log('PASS: perfect alignment, analytic cancellation and half-null amplitude, symmetry, speed scaling.');
