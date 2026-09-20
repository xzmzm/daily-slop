/* Echo Room: planar image-source early reflections; no diffuse reverb tail. */
(function (root) {
  'use strict';
  const C = 343, ORDER = 10;
  const PRESETS = {
    gallery: {width:14, depth:9, absorption:0.16, source:{x:3.1,y:3.6}, listener:{x:10.4,y:5.5}},
    corridor:{width:26, depth:5, absorption:0.08, source:{x:3.2,y:2.1}, listener:{x:19.6,y:3.1}},
    studio:  {width:7, depth:5, absorption:0.78, source:{x:1.5,y:2.1}, listener:{x:5.3,y:3.2}}
  };
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const finite = (v,d)=>Number.isFinite(Number(v))?Number(v):d;
  const distance = (a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function sanitize(input={}) {
    const d=PRESETS.gallery;
    const width=clamp(finite(input.width,d.width),4,30), depth=clamp(finite(input.depth,d.depth),3,16);
    const point=(p,f)=>({x:clamp(finite(p?.x,f.x),.2,width-.2),y:clamp(finite(p?.y,f.y),.2,depth-.2)});
    return {width,depth,absorption:clamp(finite(input.absorption,d.absorption),0,1),source:point(input.source,d.source),listener:point(input.listener,d.listener)};
  }
  const fold = (x,size)=>{let r=((x%(2*size))+2*size)%(2*size);return r<=size?r:2*size-r;};
  const mirror = (x,size,tile)=>tile*size+(Math.abs(tile)%2?size-x:x);
  // Trace a straight segment through mirrored tiles, then fold it into the room.
  function trace(s,nx,ny) {
    const image={x:mirror(s.source.x,s.width,nx),y:mirror(s.source.y,s.depth,ny)};
    const from=s.listener, delta={x:image.x-from.x,y:image.y-from.y}, cuts=[];
    for(const [axis,size] of [['x',s.width],['y',s.depth]]) {
      if(Math.abs(delta[axis])<1e-12) continue;
      const lo=Math.min(from[axis],image[axis]),hi=Math.max(from[axis],image[axis]);
      for(let k=Math.floor(lo/size)+1;k*size<hi-1e-9;k++) {
        const t=(k*size-from[axis])/delta[axis];
        if(t>1e-9 && t<1-1e-9)cuts.push({t,axis});
      }
    }
    cuts.sort((a,b)=>a.t-b.t);
    // A ray hitting an exact corner has no unique specular normal: omit it.
    if(cuts.some((v,i)=>i && Math.abs(v.t-cuts[i-1].t)<1e-9))return null;
    const points=[{...from}], walls=[];
    for(const cut of cuts) {
      const p={x:fold(from.x+delta.x*cut.t,s.width),y:fold(from.y+delta.y*cut.t,s.depth)};
      points.push(p);walls.push(cut.axis==='x'?(p.x<s.width/2?'west':'east'):(p.y<s.depth/2?'north':'south'));
    }
    points.push({...s.source});points.reverse();walls.reverse();
    const order=Math.abs(nx)+Math.abs(ny),length=distance(image,from);
    if(cuts.length!==order)throw new Error('Image order does not match wall intersections');
    return {id:`${nx},${ny}`,nx,ny,order,points,walls,length,delay:length/C,
      gain:Math.pow(Math.sqrt(1-s.absorption),order)/Math.max(1,length)};
  }
  function paths(input,maxOrder=ORDER) {
    const s=sanitize(input), result=[],n=clamp(Math.floor(finite(maxOrder,ORDER)),0,16);
    for(let x=-n;x<=n;x++)for(let y=-n;y<=n;y++) {
      if(Math.abs(x)+Math.abs(y)>n)continue;
      const p=trace(s,x,y);if(p)result.push(p);
    }
    return result.sort((a,b)=>a.delay-b.delay || a.order-b.order || a.id.localeCompare(b.id));
  }
  function stats(list) {
    const direct=list.find(p=>p.order===0),reflection=list.find(p=>p.order>0);
    return {directMs:direct.delay*1000,firstEchoMs:reflection?.delay*1000 ?? 0,
      gapMs:reflection?(reflection.delay-direct.delay)*1000:0,
      lastMs:Math.max(...list.map(p=>p.delay))*1000,count:list.length,
      reflectedEnergy:list.filter(p=>p.order>0).reduce((n,p)=>n+p.gain*p.gain,0),directEnergy:direct.gain*direct.gain};
  }
  function atDistance(path,d) {
    d=Math.max(0,d);
    for(let i=1;i<path.points.length;i++) {
      const a=path.points[i-1],b=path.points[i],len=distance(a,b);
      if(d<=len && len>0)return {x:a.x+(b.x-a.x)*d/len,y:a.y+(b.y-a.y)*d/len};
      d-=len;
    }
    return {...path.points[path.points.length-1]};
  }
  function excitation(rate=44100) {
    const n=Math.round(rate*.024),a=new Float32Array(n);let seed=23719;
    for(let i=0;i<n;i++) {
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      const t=i/rate,envelope=Math.min(1,t/.0006)*Math.exp(-t*250);
      a[i]=((seed/4294967296*2-1)*.72+Math.sin(2*Math.PI*1300*t)*.28)*envelope;
    }
    const mean=a.reduce((n,x)=>n+x,0)/n;for(let i=0;i<n;i++)a[i]-=mean*Math.sin(Math.PI*i/(n-1))**2;
    return a;
  }
  // Direct time-domain convolution with a sparse impulse train. Fractional delays
  // use two-tap linear interpolation. Fixed gain: never normalize each preset.
  function synthesize(list,mode='room',rate=44100) {
    if(!Number.isInteger(rate)||rate<8000||rate>96000)throw new RangeError('Invalid sample rate');
    const audible=list.filter(p=>mode!=='direct'||p.order===0),source=excitation(rate);
    const end=Math.max(0,...audible.map(p=>p.delay))+.09;
    const out=new Float32Array(Math.ceil(end*rate)+source.length+2);
    for(const p of audible) {
      const offset=p.delay*rate,start=Math.floor(offset),f=offset-start;
      for(let j=0;j<source.length;j++) {
        const sample=source[j]*p.gain*.7;
        out[start+j]+=sample*(1-f);out[start+j+1]+=sample*f;
      }
    }
    // A fixed soft safety limiter, only active beyond +/- 0.9.
    for(let i=0;i<out.length;i++)if(Math.abs(out[i])>.9)out[i]=Math.sign(out[i])*(.9+.1*Math.tanh((Math.abs(out[i])-.9)*10));
    return out;
  }
  function wav(samples,rate=44100) {
    const b=new ArrayBuffer(44+samples.length*2),v=new DataView(b);
    const text=(off,s)=>{for(let i=0;i<s.length;i++)v.setUint8(off+i,s.charCodeAt(i));};
    text(0,'RIFF');v.setUint32(4,b.byteLength-8,true);text(8,'WAVE');text(12,'fmt ');v.setUint32(16,16,true);
    v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);
    text(36,'data');v.setUint32(40,samples.length*2,true);
    for(let i=0;i<samples.length;i++){const x=clamp(samples[i],-1,1);v.setInt16(44+i*2,Math.round(x*(x<0?32768:32767)),true);}
    return b;
  }
  const api={C,ORDER,PRESETS,clamp,sanitize,fold,mirror,trace,paths,stats,atDistance,excitation,synthesize,wav};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.EchoCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
