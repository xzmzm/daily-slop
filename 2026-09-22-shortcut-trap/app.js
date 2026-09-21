/* Original diagram and UI. Vehicle markers illustrate a solved assignment;
   they are not microscopic agents or a route-learning simulation. */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const defaults = {demand:4000, delay:0, open:false, policy:'selfish'};
  let state = {...defaults}, result, elapsed = 0, selected = -1;
  let paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const capture = window.__SHORTCUT_CAPTURE__ || new URLSearchParams(location.search).has('capture');
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const colors = ['#6a92a3','#428674','#c96340'];
  const names = ['Upper','Lower','Shortcut'];
  const curve = $('#curve'), network = $('#network');
  const N = [[100,235],[400,91],[400,379],[700,235]];
  const controls = [
    [N[0],[130,125],[266,91],N[1]],
    [N[1],[534,91],[670,125],N[3]],
    [N[0],[130,345],[266,379],N[2]],
    [N[2],[534,379],[670,345],N[3]],
    [N[1],[400,160],[400,310],N[2]]
  ];
  const routeEdges = [[0,1],[2,3],[0,4,3]];
  const paths = controls.map(points => {
    const samples = [], lengths = [0];
    for(let i=0;i<=180;i++){
      const t=i/180, u=1-t;
      const p=[0,1].map(k=>u*u*u*points[0][k]+3*u*u*t*points[1][k]+3*u*t*t*points[2][k]+t*t*t*points[3][k]);
      samples.push(p);
      if(i) lengths.push(lengths[i-1]+Math.hypot(p[0]-samples[i-1][0],p[1]-samples[i-1][1]));
    }
    return {samples,lengths,length:lengths.at(-1)};
  });
  function pointOn(edge,f){
    const p=paths[edge], target=Math.max(0,Math.min(.999999,f))*p.length;
    let lo=0,hi=p.lengths.length-1;
    while(hi-lo>1){const m=(lo+hi)>>1;if(p.lengths[m]<target)lo=m;else hi=m;}
    const a=p.samples[lo],b=p.samples[hi],t=(target-p.lengths[lo])/(p.lengths[hi]-p.lengths[lo]);
    return {x:a[0]+(b[0]-a[0])*t,y:a[1]+(b[1]-a[1])*t,angle:Math.atan2(b[1]-a[1],b[0]-a[0])};
  }
  function rounded(ctx,x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
  function text(ctx,s,x,y,size=11,color='#54644f',align='left',font='Arial'){
    ctx.font=`${size}px ${font}`;ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(s,x,y);
  }
  function trace(ctx,i){const p=controls[i];ctx.beginPath();ctx.moveTo(...p[0]);ctx.bezierCurveTo(...p[1],...p[2],...p[3]);}
  function drawMap(ctx,time){
    ctx.fillStyle='#e8ede0';ctx.fillRect(0,0,800,470);
    ctx.lineWidth=.65;ctx.strokeStyle='#dce3d4';
    for(let x=0;x<800;x+=25){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,470);ctx.stroke();}
    for(let y=0;y<470;y+=25){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(800,y);ctx.stroke();}
    // Small city blocks stay deliberately secondary to the mathematical roads.
    const blocks=[[161,195,53,68],[227,187,67,42],[222,245,70,48],[312,190,33,96],[455,184,43,45],[515,188,57,37],[515,250,64,38],[602,199,34,65],[313,315,31,27],[460,314,32,26]];
    for(const [x,y,w,h] of blocks){
      rounded(ctx,x+3,y+5,w,h,3,'#c5d0bb');rounded(ctx,x,y,w,h,3,'#d7dfce','#cbd6c0');
      ctx.strokeStyle='#c8d3bc';ctx.lineWidth=1;ctx.strokeRect(x+6,y+6,w-12,h-12);
    }
    for(let i=0;i<32;i++){
      const side=i%2, x=(side?460:180)+(i*53%155),y=145+(i*37%182);
      if((x>310&&x<490)||y<173)continue;
      ctx.beginPath();ctx.ellipse(x+2,y+3,7,4,0,0,Math.PI*2);ctx.fillStyle='#ccd6c1';ctx.fill();
      ctx.beginPath();ctx.arc(x,y,4+(i%3),0,Math.PI*2);ctx.fillStyle=i%2?'#b4c5a4':'#a9bd9c';ctx.fill();
    }
    text(ctx,'WEST PARK',259,320,8,'#a0ae94','center','monospace');
    text(ctx,'EAST QUARTER',548,163,8,'#a0ae94','center','monospace');
    ctx.lineCap='round';ctx.lineJoin='round';
    for(let i=0;i<5;i++){
      if(i===4&&!state.open){
        trace(ctx,i);ctx.lineWidth=20;ctx.strokeStyle='#d5dfca';ctx.stroke();
        trace(ctx,i);ctx.lineWidth=2;ctx.strokeStyle='#aabd9c';ctx.setLineDash([3,6]);ctx.stroke();ctx.setLineDash([]);continue;
      }
      trace(ctx,i);ctx.lineWidth=32;ctx.strokeStyle='#c4ceba';ctx.stroke();
      trace(ctx,i);ctx.lineWidth=27;ctx.strokeStyle=i===4?'#b79763':(i===0||i===3?'#8c8069':'#5e6a5c');ctx.stroke();
      trace(ctx,i);ctx.lineWidth=22;ctx.strokeStyle=i===4?'#a68a5b':(i===0||i===3?'#74735f':'#556053');ctx.stroke();
      trace(ctx,i);ctx.lineWidth=1;ctx.strokeStyle='#dfe2bd88';ctx.setLineDash([6,11]);ctx.stroke();ctx.setLineDash([]);
      if(selected>=0 && routeEdges[selected].includes(i)){
        trace(ctx,i);ctx.lineWidth=30;ctx.strokeStyle=colors[selected]+'66';ctx.stroke();
      }
      for(const f of [.23,.75]){
        const p=pointOn(i,f);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);ctx.strokeStyle='#ecebd18a';ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(-3,-3);ctx.lineTo(0,0);ctx.lineTo(-3,3);ctx.stroke();ctx.restore();
      }
    }
    result.flows.forEach((flow,r)=>{
      if(flow<.01)return;
      const count=Math.max(1,Math.round(flow/48)),edges=routeEdges[r];
      const weights=edges.map(e=>Math.max(10,result.times[e]));
      const total=weights.reduce((a,b)=>a+b,0);
      for(let i=0;i<count;i++){
        let travel=((time/(total*.14)+(i+.25)/count)%1)*total,e=0;
        while(e<edges.length-1&&travel>weights[e]){travel-=weights[e];e++;}
        const p=pointOn(edges[e],travel/weights[e]);
        ctx.save();ctx.globalAlpha=selected>=0&&selected!==r?.18:1;ctx.translate(p.x,p.y);ctx.rotate(p.angle);
        // Offset overlapping route samples to separate lanes without changing topology.
        const lane=(r-1)*4;
        rounded(ctx,-5,lane-2.5,10,5,1.5,'#25362935');
        rounded(ctx,-5,lane-3.5,10,5,1.3,colors[r]);ctx.fillStyle='#f6ecd2';ctx.fillRect(1,lane-3,1.7,4);ctx.restore();
      }
    });
    function roadLabel(x,y,i){
      const flexible=i===0||i===3;
      rounded(ctx,x-63,y-20,126,41,5,'#f6f7efd9','#ced8c3');
      text(ctx,`${result.times[i].toFixed(1)} min`,x,y-3,14,'#354532','center','monospace');
      text(ctx,flexible?`${fmt(result.edges[i])} drivers ÷ 100`:'fixed travel time',x,y+12,8,'#839076','center','monospace');
    }
    roadLabel(231,85,0);roadLabel(574,85,1);roadLabel(231,382,2);roadLabel(574,382,3);
    rounded(ctx,422,217,134,40,4,state.open?'#fbecd4ed':'#edf2e5ed',state.open?'#c9a36a':'#bbcca9');
    text(ctx,state.open?`A → B   ${state.delay} min`:'A → B   CLOSED',489,234,10,state.open?'#996433':'#7d936a','center','monospace');
    text(ctx,state.open?`${fmt(result.edges[4])} drivers`:'a road not yet built',489,248,8,'#8d967d','center','monospace');
    if(!state.open){ctx.strokeStyle='#9cb584';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(391,228);ctx.lineTo(409,241);ctx.moveTo(391,241);ctx.lineTo(409,228);ctx.stroke();}
    for(let i=0;i<4;i++){
      const [x,y]=N[i];ctx.beginPath();ctx.arc(x+1,y+3,19,0,Math.PI*2);ctx.fillStyle='#30452b20';ctx.fill();
      ctx.beginPath();ctx.arc(x,y,18,0,Math.PI*2);ctx.fillStyle=i===0?'#d8aa64':i===3?'#447761':'#f3f5e9';ctx.fill();ctx.strokeStyle=i===0?'#bd955f':i===3?'#365f4c':'#a6b598';ctx.lineWidth=1.5;ctx.stroke();
      text(ctx,['S','A','B','T'][i],x,y+5,14,i===3?'#fff4d8':'#3b4d36','center','monospace');
    }
    text(ctx,'START',100,277,9,'#7c8c6f','center','monospace');text(ctx,'FINISH',700,277,9,'#7c8c6f','center','monospace');
    text(ctx,'A',400,53,8,'#849676','center','monospace');text(ctx,'B',400,417,8,'#849676','center','monospace');
    text(ctx,'N',762,35,8,'#9aaa8d','center','monospace');ctx.strokeStyle='#a9b69c';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(762,64);ctx.lineTo(762,42);ctx.lineTo(758,49);ctx.moveTo(762,42);ctx.lineTo(766,49);ctx.stroke();
  }
  function fit(canvas){
    const r=canvas.getBoundingClientRect(), dpr=Math.min(2,devicePixelRatio||1);
    const w=Math.max(1,Math.round(r.width*dpr)),h=Math.max(1,Math.round(r.height*dpr));
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);return {ctx,w:r.width,h:r.height};
  }
  function draw(){
    const {ctx,w,h}=fit(network);ctx.clearRect(0,0,w,h);
    const scale=Math.min(w/800,h/470);ctx.save();ctx.translate((w-scale*800)/2,(h-scale*470)/2);ctx.scale(scale,scale);drawMap(ctx,elapsed);ctx.restore();
  }
  function drawCurve(){
    const {ctx,w,h}=fit(curve);ctx.clearRect(0,0,w,h);
    const l=34,r=w-16,t=23,b=h-25;
    const x=q=>l+(q-1000)/9000*(r-l), y=v=>b-(v-10)/95*(b-t);
    ctx.lineWidth=1;
    for(const v of [20,40,60,80,100]){ctx.strokeStyle='#d9dfcf';ctx.beginPath();ctx.moveTo(l,y(v));ctx.lineTo(r,y(v));ctx.stroke();text(ctx,String(v),l-8,y(v)+3,8,'#8c977f','right','monospace');}
    for(const q of [1000,4000,7000,10000])text(ctx,`${q/1000}k`,x(q),h-7,8,'#8c977f','center','monospace');
    text(ctx,'MIN',l,12,7,'#919c85','left','monospace');text(ctx,'DRIVERS',r,12,7,'#919c85','right','monospace');
    for(let q=1000;q<10000;q+=50){
      const a=TrafficModel.solve({demand:q,delay:state.delay,open:true}).average, c=45+q/200;
      ctx.fillStyle=a>c?'#d57b4b24':'#548a7412';ctx.fillRect(x(q),Math.min(y(a),y(c)),x(q+50)-x(q)+.6,Math.abs(y(a)-y(c)));
    }
    [false,true].forEach(open=>{
      ctx.beginPath();for(let q=1000;q<=10000;q+=50){const cost=TrafficModel.solve({demand:q,delay:state.delay,open}).average;q===1000?ctx.moveTo(x(q),y(cost)):ctx.lineTo(x(q),y(cost));}
      ctx.strokeStyle=open?'#bf6242':'#49786d';ctx.lineWidth=2;ctx.stroke();
    });
    const xx=x(state.demand);ctx.strokeStyle='#546b4f66';ctx.lineWidth=1;ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(xx,t);ctx.lineTo(xx,b);ctx.stroke();ctx.setLineDash([]);
    [false,true].forEach(open=>{const c=TrafficModel.solve({...state,policy:'selfish',open}).average;ctx.beginPath();ctx.arc(xx,y(c),4,0,Math.PI*2);ctx.fillStyle=open?'#bf6242':'#49786d';ctx.fill();ctx.strokeStyle='#f3f0e8';ctx.lineWidth=1.5;ctx.stroke();});
  }
  function update(){
    result=TrafficModel.solve(state);
    $('#average').textContent=result.average.toFixed(1);
    const delta=$('#delta'),d=result.delta;
    delta.className='delta'+(d>.001?' bad':d<-.001?' good':'');
    delta.textContent=!state.open?'The original two-road network.':Math.abs(d)<.001?`Same as closed: ${result.baseline.toFixed(1)} min.`:`${d>0?'+':'−'}${Math.abs(d).toFixed(1)} min / ${Math.abs(d/result.baseline*100).toFixed(1)}% ${d>0?'slower':'faster'} than closed`;
    $('#shortcut').setAttribute('aria-pressed',String(state.open));$('#shortcut-label').textContent=state.open?'Close the shortcut':'Open the shortcut';$('#shortcut-hint').textContent=state.open?'The A → B connection is open':'A new link from A to B';$('.switch-symbol').textContent=state.open?'−':'＋';
    $('#network-status').textContent=state.open?'SHORTCUT OPEN · ASSIGNMENT SOLVED':'TWO ROADS HOME';
    for(const key of ['demand','delay'])$('#'+key).value=state[key];
    $('#demand-value').textContent=fmt(state.demand);$('#delay-value').textContent=`${state.delay} min`;
    document.querySelectorAll('[data-policy]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.policy===state.policy)));
    $('#policy-note').textContent=state.policy==='selfish'?'Everyone takes their fastest route. No single driver can improve by switching.':'Minimizes the average for everyone. Some drivers could get there faster by ignoring this assignment.';
    $('#verdict-label').textContent=!state.open?'TRY THIS':state.policy==='coordinated'?'COLLECTIVE OPTIMUM':d>.01?'THE SHORTCUT TRAP':d<-.01?'THIS TIME, IT HELPS':'NO PENALTY HERE';
    $('#verdict').textContent=!state.open?'Open the connection between A and B. Does a faster road mean a faster trip?':state.policy==='coordinated'?`${fmt(result.flows[2])} drivers take the shortcut. The minimum average is ${result.average.toFixed(2)} min; it is not necessarily everyone's fastest individual route.`:d>.01?`Everyone chooses sensibly. Together, they arrive ${d.toFixed(1)} minutes later than with the road closed.`:d<-.01?'At this demand and link time, the extra route reduces travel time. The paradox needs the right conditions.':'The shortcut no longer worsens the commute. More road is not always bad, either.';
    result.flows.forEach((flow,i)=>{
      const unavailable=i===2&&!state.open;
      $('#flow-'+i).textContent=unavailable?'—':fmt(flow);$('#cost-'+i).textContent=unavailable?'closed':`${result.costs[i].toFixed(1)} min`;
      const el=$(`[data-route="${i}"]`);el.disabled=unavailable;el.setAttribute('aria-pressed',String(selected===i));el.setAttribute('aria-label',`${names[i]} route, ${unavailable?'closed':fmt(flow)+' drivers, '+result.costs[i].toFixed(1)+' minutes'}. Highlight on map.`);el.classList.toggle('selected',i===selected);
    });
    $('#explanation').textContent=state.open&&state.policy==='selfish'&&result.flows[2]>0?`At this assignment, the shortcut route takes ${result.costs[2].toFixed(1)} minutes. The upper and lower routes each take ${result.costs[0].toFixed(1)}. Changing roads alone cannot undo the congestion everyone creates.`:'A driver chooses a route, but that choice changes the time for other drivers too. Individual best choices and the lowest total travel time are different questions.';
    network.setAttribute('aria-label',`Directed network from S to T. Shortcut ${state.open?'open':'closed'}. Average ${result.average.toFixed(2)} minutes. Upper ${fmt(result.flows[0])}, lower ${fmt(result.flows[1])}, shortcut ${fmt(result.flows[2])} drivers.`);
    draw();drawCurve();
  }
  function set(p){state=TrafficModel.parameters({...state,...p});if(!state.open&&selected===2)selected=-1;update();}
  function readHash(){
    const p=new URLSearchParams(location.hash.slice(1));const next={...defaults};
    for(const [key,lo,hi] of [['demand',1000,10000],['delay',0,40]]){const v=Number(p.get(key));if(p.has(key)&&Number.isFinite(v))next[key]=Math.round(Math.max(lo,Math.min(hi,v))/(key==='demand'?100:1))*(key==='demand'?100:1);}
    next.open=p.get('open')==='1';next.policy=p.get('policy')==='coordinated'?'coordinated':'selfish';state=next;
  }
  $('#shortcut').addEventListener('click',()=>set({open:!state.open}));
  $('#reset').addEventListener('click',()=>{selected=-1;set(defaults);if(location.hash)history.replaceState(null,'',location.pathname+location.search);});
  ['demand','delay'].forEach(key=>$('#'+key).addEventListener('input',e=>set({[key]:Number(e.target.value)})));
  document.querySelectorAll('[data-policy]').forEach(b=>b.addEventListener('click',()=>set({policy:b.dataset.policy})));
  document.querySelectorAll('[data-route]').forEach(b=>b.addEventListener('click',()=>{selected=selected===Number(b.dataset.route)?-1:Number(b.dataset.route);update();}));
  function pauseButton(){$('#pause').textContent=paused?'Resume motion':'Pause motion';$('#pause').setAttribute('aria-pressed',String(paused));}
  $('#pause').addEventListener('click',()=>{paused=!paused;pauseButton();});
  function chartDemand(e){const r=curve.getBoundingClientRect(),q=1000+Math.max(0,Math.min(1,(e.clientX-r.left-34)/(r.width-50)))*9000;set({demand:Math.round(q/100)*100});}
  let dragging=false;curve.addEventListener('pointerdown',e=>{dragging=true;curve.setPointerCapture(e.pointerId);chartDemand(e);});curve.addEventListener('pointermove',e=>{if(dragging)chartDemand(e);});['pointerup','pointercancel'].forEach(t=>curve.addEventListener(t,()=>{dragging=false;}));
  $('#share').addEventListener('click',async()=>{
    const p=new URLSearchParams({...state,open:state.open?'1':'0'});const u=new URL(location.href);u.search='';u.hash=p.toString();history.replaceState(null,'',u.hash);
    try{await navigator.clipboard.writeText(u.href);$('#notice').textContent='Scenario link copied.';$('#share').textContent='Link copied ✓';}
    catch{$('#notice').textContent='Your scenario is in the address bar. Copy the address to share it.';$('#share').textContent='Copy the address bar ↗';}
  });
  $('#export').addEventListener('click',()=>{
    const c=document.createElement('canvas');c.width=1600;c.height=1180;const ctx=c.getContext('2d');ctx.fillStyle='#f3f0e8';ctx.fillRect(0,0,c.width,c.height);
    text(ctx,'SHORTCUT TRAP / 22 SEP 2026',64,57,18,'#77876a','left','monospace');text(ctx,'A shortcut. A longer commute.',64,130,50,'#27342f');
    ctx.save();ctx.translate(0,175);ctx.scale(2,2);drawMap(ctx,elapsed);ctx.restore();
    rounded(ctx,48,1018,1504,121,12,'#f9f8f2','#cbd5bf');
    text(ctx,`${result.average.toFixed(2)} min average`,78,1061,28,'#27342f');text(ctx,`${fmt(state.demand)} drivers · shortcut ${state.open?'open':'closed'} · link ${state.delay} min · ${state.policy}`,78,1095,17,'#75836c','left','monospace');text(ctx,`Closed-road baseline: ${result.baseline.toFixed(2)} min`,850,1061,21,'#75836c');
    c.toBlob(blob=>{if(!blob){$('#notice').textContent='Image export failed.';return;}const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='shortcut-trap.png';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);$('#notice').textContent='Scenario image saved.';},'image/png');
  });
  window.addEventListener('hashchange',()=>{readHash();update();});window.addEventListener('resize',()=>{draw();drawCurve();});
  window.shortcutTrap=Object.freeze({snapshot:()=>({...result,paused,selected,elapsed}),set,advance:dt=>{if(!Number.isFinite(dt)||dt<0)throw new RangeError('Invalid frame duration');if(!paused)elapsed+=dt;draw();},reset:()=>set(defaults)});
  readHash();update();pauseButton();let last=performance.now();
  function frame(now){const dt=Math.min(.1,(now-last)/1000);last=now;if(!paused){elapsed+=dt;draw();}requestAnimationFrame(frame);}
  if(!capture)requestAnimationFrame(frame);
})();
