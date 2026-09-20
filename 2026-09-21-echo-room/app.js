/* UI and canvas rendering. All acoustics live in the independently tested core. */
(() => {
  'use strict';
  const C=EchoCore,$=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
  const canvas=$('#room'),ctx=canvas.getContext('2d'),plot=$('#timeline'),px=plot.getContext('2d');
  const capture=window.__ECHO_CAPTURE__===true||new URLSearchParams(location.search).has('capture');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let state=C.sanitize(C.PRESETS.gallery),list=[],mode='room',selected='-1,0',paused=reduced;
  let clock=.019,previous=0,audioContext=null,activeAudio=null,drag=null,scene={};
  const COLORS={direct:'#93debf',first:'#f4b17b',second:'#86aeca',dim:'#749198'};
  const name=p=>p.order===0?'Direct path':p.walls.map(w=>w[0].toUpperCase()+w.slice(1)).join(' → ');
  function fit(c) {
    const r=c.getBoundingClientRect(),d=Math.min(2,window.devicePixelRatio||1);
    const w=Math.max(1,Math.round(r.width*d)),h=Math.max(1,Math.round(r.height*d));
    if(c.width!==w||c.height!==h){c.width=w;c.height=h;}
    const g=c.getContext('2d');g.setTransform(d,0,0,d,0,0);return {w:r.width,h:r.height};
  }
  function roomLayout() {
    const {w,h}=fit(canvas),scale=Math.min((w-112)/state.width,(h-98)/state.depth);
    return {w,h,scale,x:(w-state.width*scale)/2,y:(h-state.depth*scale)/2+5,rw:state.width*scale,rh:state.depth*scale};
  }
  function locationOf(p){return {x:scene.x+p.x*scene.scale,y:scene.y+p.y*scene.scale};}
  function segment(g,points,color,width=1) {
    g.beginPath();points.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.strokeStyle=color;g.lineWidth=width;g.stroke();
  }
  function drawRoom() {
    scene=roomLayout();const {w,h,x,y,rw,rh,scale}=scene;
    ctx.clearRect(0,0,w,h);ctx.fillStyle='#101f26';ctx.fillRect(0,0,w,h);
    // Architectural grid, aligned to actual metres rather than canvas pixels.
    ctx.save();ctx.beginPath();ctx.rect(x,y,rw,rh);ctx.clip();
    ctx.fillStyle='#162a31';ctx.fillRect(x,y,rw,rh);
    for(let i=0;i<=state.width;i++)segment(ctx,[{x:x+i*scale,y},{x:x+i*scale,y:y+rh}],i%5?'#20363c':'#2b4449');
    for(let i=0;i<=state.depth;i++)segment(ctx,[{x,y:y+i*scale},{x:x+rw,y:y+i*scale}],i%5?'#20363c':'#2b4449');
    // Animated fronts: source and its four first images. Not a pressure field.
    if(clock>=0 && clock<.13)for(const p of list.filter(p=>p.order<=1)) {
      const image=locationOf({x:C.mirror(state.source.x,state.width,p.nx),y:C.mirror(state.source.y,state.depth,p.ny)});
      ctx.beginPath();ctx.arc(image.x,image.y,clock*C.C*scale,0,Math.PI*2);
      ctx.strokeStyle=p.order?'#f4b17b':'#93debf';ctx.globalAlpha=(p.order?.14*Math.sqrt(1-state.absorption):.24)*(mode==='direct'&&p.order?.1:1);ctx.lineWidth=1.5;ctx.stroke();
    }
    ctx.globalAlpha=1;
    const visible=list.filter(p=>p.order<=2||p.id===selected);
    for(const p of visible) {
      const highlight=p.id===selected,isDirect=p.order===0;
      const color=isDirect?COLORS.direct:p.order===1?COLORS.first:COLORS.second;
      ctx.globalAlpha=(isDirect?.8:highlight?.8:p.order===1?.22:.1)*(p.gain>0?1:.12)*(mode==='direct'&&!isDirect?.16:1);
      ctx.setLineDash(isDirect||highlight?[]:[3,5]);segment(ctx,p.points.map(locationOf),color,highlight?1.7:isDirect?1.5:1);
      ctx.setLineDash([]);
      if(highlight)for(const q of p.points.slice(1,-1)) {
        const v=locationOf(q);ctx.fillStyle=COLORS.first;ctx.fillRect(v.x-3,v.y-3,6,6);
      }
      if(clock>=0 && clock<=p.delay && p.gain>0 && (mode==='room'||isDirect)) {
        const v=locationOf(C.atDistance(p,clock*C.C));ctx.globalAlpha=highlight||isDirect?1:.45;
        ctx.shadowColor=color;ctx.shadowBlur=12;ctx.fillStyle=color;ctx.beginPath();ctx.arc(v.x,v.y,highlight||isDirect?3.4:2.2,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
      }
    }
    ctx.restore();
    // Double walls and material marks.
    ctx.lineWidth=3;ctx.strokeStyle='#506c70';ctx.strokeRect(x-3,y-3,rw+6,rh+6);
    ctx.strokeStyle='#adc4ba';ctx.lineWidth=1;ctx.strokeRect(x,y,rw,rh);
    ctx.globalAlpha=.2+state.absorption*.65;
    for(let i=8;i<rw;i+=11){segment(ctx,[{x:x+i,y:y-8},{x:x+i-4,y:y-4}],COLORS.direct);segment(ctx,[{x:x+i,y:y+rh+4},{x:x+i-4,y:y+rh+8}],COLORS.direct);}
    for(let i=8;i<rh;i+=11){segment(ctx,[{x:x-8,y:y+i},{x:x-4,y:y+i-4}],COLORS.direct);segment(ctx,[{x:x+rw+4,y:y+i},{x:x+rw+8,y:y+i-4}],COLORS.direct);}
    ctx.globalAlpha=1;
    // Dimension lines and room labels.
    const dimY=y+rh+23;segment(ctx,[{x,y:dimY},{x:x+rw,y:dimY}],'#425c61');
    for(const xx of [x,x+rw])segment(ctx,[{x:xx,y:dimY-4},{x:xx,y:dimY+4}],'#607b7c');
    ctx.font='10px monospace';ctx.textAlign='center';ctx.fillStyle='#9ab2b4';ctx.fillText(`${state.width.toFixed(1)} m`,x+rw/2,dimY+14);
    ctx.save();ctx.translate(x-23,y+rh/2);ctx.rotate(-Math.PI/2);ctx.fillText(`${state.depth.toFixed(1)} m`,0,0);ctx.restore();
    ctx.font='8px monospace';ctx.textAlign='right';ctx.fillStyle='#739397';ctx.fillText(`${list.length} PATHS / MAX ${C.ORDER} BOUNCES`,w-20,22);
    ctx.textAlign='left';ctx.fillText(paused?'VISUAL REPLAY PAUSED':'VISUAL REPLAY 0.06× · AUDIO REAL TIME',22,h-12);
    for(const key of ['source','listener']) {
      const p=locationOf(state[key]),el=$(`#${key}`);el.style.left=p.x+'px';el.style.top=p.y+'px';
      ctx.textAlign='center';ctx.font='9px monospace';ctx.fillStyle=key==='source'?COLORS.first:COLORS.direct;
      const yy=state[key].y>state.depth-.8?p.y-27:p.y+29;
      ctx.fillText(key==='source'?'SOURCE':'LISTENER',p.x,yy);
    }
  }
  function drawTimeline() {
    const {w,h}=fit(plot),left=23,right=w-24,bottom=h-24,maxMs=Math.ceil(Math.max(.12,list[list.length-1].delay)*10)*100;
    px.clearRect(0,0,w,h);px.lineWidth=1;px.font='8px monospace';px.textAlign='center';
    for(let i=0;i<=4;i++) {
      const x=left+(right-left)*i/4;segment(px,[{x,y:11},{x,y:bottom}],'#2c4148');
      px.fillStyle='#829da3';px.fillText(`${Math.round(maxMs*i/4)}${i===4?' ms':''}`,x,bottom+15);
    }
    const top=Math.max(...list.map(p=>p.gain),.01);
    for(const p of list) {
      const x=left+(right-left)*(p.delay*1000/maxMs),height=(h-36)*p.gain/top;
      px.globalAlpha=mode==='direct'&&p.order?.12:p.order>2?.38:.9;
      segment(px,[{x,y:bottom},{x,y:bottom-height}],p.order===0?COLORS.direct:p.id===selected?COLORS.first:COLORS.second,p.order===0?2.5:1.2);
      if(p.id===selected && p.gain>0){px.fillStyle=COLORS.first;px.beginPath();px.arc(x,bottom-height,2.5,0,Math.PI*2);px.fill();}
    }
    px.globalAlpha=1;
    const sweep=left+(right-left)*Math.max(0,clock)*1000/maxMs;
    if(sweep<=right){px.setLineDash([2,3]);segment(px,[{x:sweep,y:6},{x:sweep,y:bottom}],'#d7e7df66');px.setLineDash([]);}
    $('#replay-time').textContent=Math.max(0,clock*1000).toFixed(1)+' ms';
  }
  function redraw(){drawRoom();drawTimeline();}
  function sync(recalculate=true) {
    if(recalculate)list=C.paths(state);
    const st=C.stats(list);
    $('#dimensions').textContent=`${state.width.toFixed(1)} × ${state.depth.toFixed(1)} m`;
    for(const key of ['width','depth','absorption']) {
      const value=key==='absorption'?Math.round(state[key]*100):state[key];$('#'+key).value=value;
      $('#'+key+'-value').textContent=key==='absorption'?value+'%':value.toFixed(1)+' m';
    }
    for(const [id,value] of [['direct-ms',st.directMs],['reflection-ms',st.firstEchoMs],['gap-ms',st.gapMs]])$('#'+id).innerHTML=value.toFixed(1)+'<small>ms</small>';
    const options=list.filter(p=>p.order===1);
    if(!options.some(p=>p.id===selected))selected=options[0]?.id||'0,0';
    $('#path-select').replaceChildren(...options.map(p=>{const o=document.createElement('option');o.value=p.id;o.textContent=name(p)+' wall';return o;}));
    $('#path-select').value=selected;const path=list.find(p=>p.id===selected);
    $('#path-detail').textContent=path?`${path.length.toFixed(2)} m · ${(path.delay*1000).toFixed(1)} ms · 1 reflection`:'No reflected path';
    $$('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
    $('#pause').textContent=paused?'▶ Resume view':'Ⅱ Pause view';$('#pause').setAttribute('aria-pressed',String(paused));redraw();
  }
  function markCustom(){$$('[data-preset]').forEach(b=>b.setAttribute('aria-pressed','false'));}
  function preset(key) {
    state=C.sanitize(C.PRESETS[key]);clock=0;$$('[data-preset]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.preset===key)));sync();
  }
  function advance(dt) {
    if(!paused){clock+=Math.max(0,Math.min(1,dt))*.06;const end=Math.max(.16,list[list.length-1].delay)+.065;if(clock>end)clock=-.025;}
    redraw();
  }
  async function pulse(sound=true) {
    clock=0;paused=false;sync(false);
    if(!sound||capture){$('#audio-status').textContent=mode==='room'?'Pulse with reflections · real-time audio':'Direct pulse · reflected paths muted';return;}
    try {
      const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw Error('Web Audio is unavailable');
      audioContext ||= new Audio();await audioContext.resume();
      if(activeAudio){try{activeAudio.stop();}catch(_){}activeAudio.disconnect();}
      const data=C.synthesize(list,mode,audioContext.sampleRate),buffer=audioContext.createBuffer(1,data.length,audioContext.sampleRate);buffer.copyToChannel(data,0);
      activeAudio=audioContext.createBufferSource();activeAudio.buffer=buffer;activeAudio.connect(audioContext.destination);activeAudio.start();
      $('#audio-status').textContent=mode==='room'?'Playing: direct sound + modeled reflections.':'Playing: direct sound only, at the same gain.';
    }catch(e){$('#audio-status').textContent='Audio unavailable. The visual replay and WAV export still work.';}
  }
  function downloadAudio() {
    const b=C.wav(C.synthesize(list,mode)),url=URL.createObjectURL(new Blob([b],{type:'audio/wav'})),a=document.createElement('a');
    a.href=url;a.download=`echo-room-${mode}.wav`;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
  }
  $$('[data-preset]').forEach(b=>b.addEventListener('click',()=>preset(b.dataset.preset)));
  $$('[data-mode]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.mode;sync(false);$('#audio-status').textContent='Press Send a pulse to hear this comparison.';}));
  for(const key of ['width','depth','absorption'])$('#'+key).addEventListener('input',e=>{
    const value=Number(e.target.value);
    if(key==='absorption')state.absorption=value/100;
    else {const axis=key==='width'?'x':'y',ratio=value/state[key];state.source[axis]*=ratio;state.listener[axis]*=ratio;state[key]=value;}
    state=C.sanitize(state);markCustom();clock=0;sync();
  });
  $('#path-select').addEventListener('change',e=>{selected=e.target.value;sync(false);});
  $('#reset').addEventListener('click',()=>{mode='room';paused=reduced;preset('gallery');$('#audio-status').textContent='Sound starts only when you press play. Start at low volume.';});
  $('#pause').addEventListener('click',()=>{paused=!paused;sync(false);});$('#play').addEventListener('click',()=>pulse());$('#export').addEventListener('click',downloadAudio);
  for(const key of ['source','listener']) {
    const el=$('#'+key);
    el.addEventListener('pointerdown',e=>{drag={key,id:e.pointerId};el.setPointerCapture(e.pointerId);e.preventDefault();});
    el.addEventListener('pointermove',e=>{
      if(!drag||drag.key!==key||drag.id!==e.pointerId)return;
      const r=canvas.getBoundingClientRect();state[key]={x:(e.clientX-r.left-scene.x)/scene.scale,y:(e.clientY-r.top-scene.y)/scene.scale};state=C.sanitize(state);markCustom();clock=0;sync();
    });
    const release=()=>{drag=null;};el.addEventListener('pointerup',release);el.addEventListener('pointercancel',release);el.addEventListener('lostpointercapture',release);
    el.addEventListener('keydown',e=>{
      const moves={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(!moves[e.key])return;e.preventDefault();
      const [x,y]=moves[e.key],step=e.shiftKey?.5:.1;state[key].x+=x*step;state[key].y+=y*step;state=C.sanitize(state);markCustom();clock=0;sync();
    });
  }
  document.addEventListener('keydown',e=>{if(e.code==='Space'&&!e.repeat&&!['INPUT','SELECT','BUTTON','TEXTAREA','SUMMARY'].includes(e.target.tagName)){e.preventDefault();pulse();}});
  window.addEventListener('resize',redraw);document.addEventListener('visibilitychange',()=>{previous=0;});
  window.echoRoom={advance,preset,pulse,snapshot:()=>({state:structuredClone(state),mode,paused,clock,stats:C.stats(list),selected,paths:list.map(p=>({...p}))}),
    audioBase64:()=>{const u=new Uint8Array(C.wav(C.synthesize(list,mode)));let text='';for(let i=0;i<u.length;i+=8192)text+=String.fromCharCode(...u.subarray(i,i+8192));return btoa(text);},
    setClock:t=>{clock=t;redraw();}};
  sync();
  if(!capture)requestAnimationFrame(function frame(time){const dt=previous?Math.min(.06,(time-previous)/1000):0;previous=time;if(!document.hidden)advance(dt);requestAnimationFrame(frame);});
})();
