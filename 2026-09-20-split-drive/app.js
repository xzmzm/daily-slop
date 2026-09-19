/* Split Drive: a geometric experiment, not a vehicle-dynamics solver. */
(() => {
  'use strict';
  const C=window.SplitDriveCore, $=id=>document.getElementById(id);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const captureMode=new URLSearchParams(location.search).get('capture')==='1';
  const state={...C.DEFAULTS,paused:reduced.matches};
  let motion={time:0,angle:-.72,distance:0,phase:[0,0]}, solution=C.solve(state), last=null;
  const canvas=$('track-canvas'), ctx=canvas.getContext('2d');
  let width=900,height=400;
  const colors=['#6fd8cd','#edaa78'], names=['left','right'];
  const mono='"Liberation Mono",Consolas,monospace';
  function line(x1,y1,x2,y2,color,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
  function circle(x,y,r,color,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.arc(x,y,r,0,C.TAU);ctx.stroke();}
  function text(label,x,y,size=10,color='#718c97',align='center') {ctx.font=`${size}px ${mono}`;ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(label,x,y);}
  function rounded(context,x,y,w,h,r,fill,stroke) {context.beginPath();context.roundRect(x,y,w,h,r);if(fill){context.fillStyle=fill;context.fill();}if(stroke){context.strokeStyle=stroke;context.stroke();}}
  function background(){
    ctx.fillStyle='#13232d';ctx.fillRect(0,0,width,height);
    const glow=ctx.createRadialGradient(width*.5,height*.49,20,width*.5,height*.49,width*.5);
    glow.addColorStop(0,'#263c4144');glow.addColorStop(1,'#13232d00');ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);
    for(let x=0;x<width;x+=28)line(x,0,x,height,'#6c98a108');
    for(let y=0;y<height;y+=28)line(0,y,width,y,'#6c98a108');
    for(const [x,y] of [[18,18],[width-18,18],[18,height-18],[width-18,height-18]]){
      line(x-4,y,x+4,y,'#80999e44');line(x,y-4,x,y+4,'#80999e44');
    }
  }
  function arrow(x,y,angle,size,color){ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.beginPath();ctx.moveTo(-size,-size*.5);ctx.lineTo(0,0);ctx.lineTo(-size,size*.5);ctx.strokeStyle=color;ctx.lineWidth=1.4;ctx.stroke();ctx.restore();}
  function circularRoad(){
    const R=state.radius, scale=Math.min(width*.43/(R+2),height*.435/(R+2));
    const cx=width*.51,cy=height*.52,r=R*scale,half=(state.track/2+.68)*scale;
    const project=(x,y)=>[cx+x*scale,cy-y*scale];
    // Annular road, subdued alternate curbs, and a dashed center reference.
    circle(cx,cy,r,'#070f1466',half*2+9);
    circle(cx,cy,r,'#27343b',half*2);
    for(const edge of [r-half,r+half]){
      circle(cx,cy,edge,'#82918e55',1);
      for(let a=0;a<C.TAU;a+=Math.PI/28){
        ctx.beginPath();ctx.arc(cx,cy,edge,a,a+Math.PI/62);ctx.strokeStyle='#bdc0a942';ctx.lineWidth=3;ctx.stroke();
      }
    }
    ctx.setLineDash([9,12]);circle(cx,cy,r,'#8d9f9a44',1);ctx.setLineDash([]);
    // The two traces are the rear wheel centers, not the front-wheel envelopes.
    for(let side=0;side<2;side++){
      const rr=(R+(side===0?-1:1)*state.turn*state.track/2)*scale;
      circle(cx,cy,rr,colors[side]+'55',1);
      ctx.beginPath();const a=-motion.angle;
      ctx.arc(cx,cy,rr,a,a+state.turn*.85,state.turn<0);
      ctx.strokeStyle=colors[side];ctx.lineWidth=2;ctx.stroke();
    }
    for(let i=0;i<4;i++){
      const a=i*Math.PI/2+.3;
      arrow(cx+Math.cos(a)*r,cy-Math.sin(a)*r,-a-state.turn*Math.PI/2,6,'#d1d4be77');
    }
    // Outer engineering ticks and corner angle numerals.
    const ticks=r+half+15;
    for(let i=0;i<72;i++){
      const a=i*C.TAU/72,len=i%6===0?6:2;
      line(cx+Math.cos(a)*ticks,cy+Math.sin(a)*ticks,cx+Math.cos(a)*(ticks+len),cy+Math.sin(a)*(ticks+len),'#8ea19b35');
    }
    const inner=r-half-5;
    if(inner>30){
      circle(cx,cy,inner,'#547f7233');
      text('REAR AXLE RADIUS',cx,cy-22,Math.min(9,width/65),'#78928e');
      text(`${R.toFixed(1)}`,cx,cy+10,Math.min(35,width/16),'#dad7c3');
      text('METERS',cx,cy+29,8,'#78928e');
      line(cx-inner*.35,cy+42,cx+inner*.35,cy+42,'#45615d');
      text(state.locked?'AXLE LOCKED':'FREE TO DIFFER',cx,cy+57,Math.min(8,width/68),state.locked?colors[1]:colors[0]);
    }
    const phi=-.15,ri=(R-state.track/2)*scale,ro=(R+state.track/2)*scale;
    const [sx,sy]=[cx+Math.cos(phi)*ri,cy+Math.sin(phi)*ri];
    const [ex,ey]=[cx+Math.cos(phi)*ro,cy+Math.sin(phi)*ro];
    line(sx,sy,ex,ey,'#c3bc9588');
    text(`${state.track.toFixed(1)} m`,ex+13,ey+4,9,'#a9b9ac','left');
    const p=project(R*Math.cos(motion.angle),R*Math.sin(motion.angle));
    drawCar(p[0],p[1],motion.angle+state.turn*Math.PI/2,scale);
    if(width>560){text('TWO PATHS',width-25,63,8,'#77919a','right');text('ONE ARRIVAL',width-25,78,8,'#77919a','right');}
  }
  function straightRoad(){
    const scale=Math.min(43,height/7),cy=height*.52,road=(state.track+1.5)*scale;
    ctx.fillStyle='#09151b';ctx.fillRect(0,cy-road/2-4,width,road+8);
    ctx.fillStyle='#28343a';ctx.fillRect(0,cy-road/2,width,road);
    for(const y of [cy-road/2,cy+road/2]){
      line(0,y,width,y,'#83938666',2);
      for(let x=-20;x<width;x+=25)line(x,y,x+12,y,'#c9ceb95e',3);
    }
    ctx.setLineDash([13,15]);line(0,cy,width,cy,'#a3ad9844');ctx.setLineDash([]);
    names.forEach((_,i)=>line(0,cy+(i?1:-1)*state.track/2*scale,width,cy+(i?1:-1)*state.track/2*scale,colors[i]+'77',1));
    for(let x=width*.15;x<width;x+=width*.23)arrow(x,cy,0,7,'#c1c8ab77');
    const span=width/scale+5,world=(motion.distance+span*.35)%span-2;
    drawCar(world*scale,cy,0,scale);
    text('PARALLEL PATHS · EQUAL DISTANCE',width*.5,cy-road/2-26,Math.min(10,width/40),'#9cb1b2');
  }
  function wheel(x,y,steer,phase,color){
    ctx.save();ctx.translate(x,y);ctx.rotate(steer);ctx.lineWidth=.025;
    rounded(ctx,-.34,-.135,.68,.27,.075,'#090f12','#576568');
    ctx.save();ctx.beginPath();ctx.rect(-.27,-.115,.54,.23);ctx.clip();
    const offset=((phase*C.WHEEL_RADIUS)%.14+.14)%.14;
    for(let p=-.4+offset;p<.4;p+=.14){ctx.fillStyle='#9db3b044';ctx.fillRect(p,-.11,.026,.22);}
    ctx.restore();ctx.fillStyle=color;ctx.fillRect(-.05,-.15,.1,.035);ctx.restore();
  }
  function drawCar(x,y,heading,scale){
    ctx.save();ctx.translate(x,y);ctx.rotate(-heading);ctx.scale(scale,-scale);
    // Road-fixed rear axle origin; local +x is forward, +y is vehicle left.
    if(state.locked&&solution.mismatch>1e-6){
      for(let side=0;side<2;side++)for(let j=0;j<10;j++){
        const yy=(side? -1:1)*state.track/2, xx=-.6-j*.17;
        ctx.strokeStyle=`rgba(236,145,88,${(.5-j*.035)*Math.min(1,solution.mismatch/.7)})`;
        ctx.lineWidth=.025;ctx.beginPath();ctx.moveTo(xx,yy-.1);ctx.lineTo(xx-.11,yy+.1);ctx.stroke();
      }
    }
    const half=state.track*.34,bodyWidth=half*2;
    ctx.shadowColor='#00000088';ctx.shadowBlur=14;ctx.shadowOffsetY=4;
    rounded(ctx,-.68,-half,3.65,bodyWidth,.25,'#dedeca');ctx.shadowBlur=0;ctx.shadowOffsetY=0;
    ctx.lineWidth=.035;
    // Visible rear axle and differential, with colored half-shafts.
    for(let side=0;side<2;side++){
      line(0,0,0,(side?-1:1)*state.track/2,colors[side],.06);
      wheel(0,(side?-1:1)*state.track/2,0,motion.phase[side],colors[side]);
      const frontSpeed=Math.hypot(solution.ground[side],solution.yaw*C.WHEELBASE);
      wheel(C.WHEELBASE,(side?-1:1)*state.track/2,solution.angles[side],motion.time*frontSpeed/C.WHEEL_RADIUS,colors[side]);
    }
    rounded(ctx,.2,-half*.84,1.66,half*1.68,.17,'#4f676d');
    rounded(ctx,.54,-half*.76,.91,half*1.52,.16,'#afbcae');
    rounded(ctx,1.53,-half*.77,.35,half*1.54,.08,'#192f3b');
    rounded(ctx,.17,-half*.73,.29,half*1.46,.06,'#29434b');
    // Hood center stripe, headlights, rear lamps, wing mirrors.
    ctx.fillStyle='#8da8a2';ctx.fillRect(1.96,-.045,.75,.09);
    for(const yy of [-half*.68,half*.68]){
      rounded(ctx,2.72,yy-.1,.12,.2,.04,'#f6e9ae');
      rounded(ctx,-.66,yy-.07,.08,.14,.025,'#be7955');
      rounded(ctx,1.44,Math.sign(yy)*(half+.035)-.065,.18,.13,.05,'#b4c5b5');
    }
    circle(0,0,.13,state.locked?colors[1]:colors[0],.065);
    ctx.fillStyle='#182f38';ctx.beginPath();ctx.arc(0,0,.08,0,C.TAU);ctx.fill();
    if(state.locked)line(-.09,0,.09,0,colors[1],.045);
    ctx.restore();
  }
  function dial(element,phase,color){
    const d=element.getContext('2d');d.clearRect(0,0,64,64);d.save();d.translate(32,32);
    d.strokeStyle='#5f787266';d.lineWidth=1;d.beginPath();d.arc(0,0,28,0,C.TAU);d.stroke();
    for(let i=0;i<12;i++){const a=i*C.TAU/12;d.beginPath();d.moveTo(Math.cos(a)*24,Math.sin(a)*24);d.lineTo(Math.cos(a)*27,Math.sin(a)*27);d.stroke();}
    d.rotate(phase);d.strokeStyle='#80948c99';d.lineWidth=3;
    for(let i=0;i<3;i++){const a=i*C.TAU/3;d.beginPath();d.moveTo(0,0);d.lineTo(Math.cos(a)*18,Math.sin(a)*18);d.stroke();}
    d.fillStyle=color;d.beginPath();d.arc(19,0,4,0,C.TAU);d.fill();d.fillStyle='#c5ccb9';d.beginPath();d.arc(0,0,4,0,C.TAU);d.fill();d.restore();
  }
  function draw(){
    ctx.setTransform(canvas.width/width,0,0,canvas.height/height,0,0);background();
    if(state.turn)circularRoad();else straightRoad();
    names.forEach((name,i)=>dial($(`${name}-dial`),motion.phase[i],colors[i]));
    canvas.dataset.ready='true';
  }
  function controls(){
    for(const key of ['radius','track','speed'])$(key).value=String(state[key]);
    $('radius').disabled=state.turn===0;
    $('radius-value').textContent=state.turn?`${state.radius.toFixed(1)} m`:'∞ / straight';
    $('track-value').textContent=`${state.track.toFixed(1)} m`;
    $('speed-value').textContent=`${state.speed} km/h`;
    $('lock').setAttribute('aria-checked',String(state.locked));
    $('play').setAttribute('aria-pressed',String(state.paused));
    $('play').setAttribute('aria-label',state.paused?'Play animation':'Pause animation');
    $('play-icon').textContent=state.paused?'▶':'Ⅱ';$('play-text').textContent=state.paused?'Play':'Pause';
    document.querySelectorAll('[data-turn]').forEach(b=>{const active=Number(b.dataset.turn)===state.turn;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});
    $('run-label').textContent=state.turn===0?'STRAIGHT RUN':`${state.turn===1?'LEFT':'RIGHT'}-HAND BEND`;
    const max=Math.max(...solution.roadRPM,...solution.rpm,1)*1.13;
    names.forEach((name,i)=>{
      $(`${name}-rpm`).textContent=solution.rpm[i].toFixed(0);
      $(`${name}-role`).textContent=state.turn===0?'STRAIGHT':((i===0)===(state.turn===1)?'INSIDE':'OUTSIDE');
      $(`${name}-required`).style.width=`${solution.roadRPM[i]/max*100}%`;
      $(`${name}-delivered`).style.width=`${solution.rpm[i]/max*100}%`;
      const slip=solution.slip[i];
      $(`${name}-slip`).textContent=Math.abs(slip)<1e-8?(solution.v?'Rolling without slip':'Stationary'):`${slip>0?'+':''}${slip.toFixed(2)} m/s surface mismatch`;
      $(`${name}-lap`).innerHTML=solution.lap?`${solution.lap[i].toFixed(2)} <small>m</small>`:'—';
    });
    $('carrier-rpm').textContent=solution.carrier.toFixed(0);
    $('status-card').classList.toggle('warning',state.locked&&solution.mismatch>1e-8);
    $('status-tag').textContent=state.locked?'LOCKED AXLE':'OPEN DIFFERENTIAL';
    if(!solution.v){$('status-title').textContent='Stopped, not slipping.';$('status-copy').textContent='Set a forward speed to compare rolling speeds.';}
    else if(!state.turn){$('status-title').textContent='Same speed. Straight ahead.';$('status-copy').textContent='Equal rear-wheel paths need equal rolling speeds, locked or open.';}
    else if(state.locked){$('status-title').textContent='The road still needs a split.';$('status-copy').textContent=`Each rear tire must slide at ${solution.mismatch.toFixed(2)} m/s on this imposed path.`;}
    else{$('status-title').textContent='Different speeds. Same turn.';$('status-copy').textContent='Each wheel rolls the distance its own path needs.';}
    $('gap-copy').innerHTML=solution.gap===null?'No circular lap here. Both rear wheels cover the same distance.':`The outside wheel travels <strong id="lap-gap">${solution.gap.toFixed(2)} m</strong> farther per lap.`;
    $('surprise-note').textContent=state.turn?'Change the radius. The per-lap difference stays.':'Choose a bend to compare complete circles.';
  }
  function update(resetPosition=false){solution=C.solve(state);if(resetPosition)motion={time:0,angle:-.72,distance:0,phase:[0,0]};controls();draw();}
  function reset(){Object.assign(state,C.DEFAULTS,{paused:reduced.matches});update(true);}
  function resize(){const box=canvas.parentElement.getBoundingClientRect();width=Math.max(1,box.width);height=Math.max(1,box.height);const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);draw();}
  for(const key of ['radius','speed','track'])$(key).addEventListener('input',e=>{state[key]=Number(e.target.value);update();});
  document.querySelectorAll('[data-turn]').forEach(b=>b.addEventListener('click',()=>{state.turn=Number(b.dataset.turn);update(true);}));
  $('lock').addEventListener('click',()=>{state.locked=!state.locked;update();});
  $('play').addEventListener('click',()=>{state.paused=!state.paused;controls();});
  $('reset').addEventListener('click',reset);
  $('tight-turn').addEventListener('click',()=>{Object.assign(state,{turn:1,radius:3.5,locked:true});update(true);});
  function exportStudy(){
    const out=document.createElement('canvas');out.width=1440;out.height=900;const p=out.getContext('2d');
    p.fillStyle='#0e1922';p.fillRect(0,0,out.width,out.height);
    p.font='36px Georgia,serif';p.fillStyle='#eeeade';p.fillText('Split Drive — one turn, two speeds',45,65);
    p.font=`14px ${mono}`;p.fillStyle='#8da5a9';p.fillText(`2026-09-20 / ${state.locked?'LOCKED AXLE':'OPEN DIFFERENTIAL'} / ${state.speed} km/h / ${state.turn?'R = '+state.radius.toFixed(1)+' m':'STRAIGHT'} / track ${state.track.toFixed(1)} m`,45,99);
    const fit=Math.min(1350/canvas.width,600/canvas.height);p.drawImage(canvas,(1440-canvas.width*fit)/2,130,canvas.width*fit,canvas.height*fit);
    p.font=`25px ${mono}`;p.fillStyle=colors[0];p.fillText(`LEFT ${solution.rpm[0].toFixed(1)} rpm`,60,793);p.fillStyle='#eeeade';p.fillText(`CARRIER ${solution.carrier.toFixed(1)} rpm`,520,793);p.fillStyle=colors[1];p.fillText(`RIGHT ${solution.rpm[1].toFixed(1)} rpm`,1030,793);
    p.font=`13px ${mono}`;p.fillStyle='#9bafb0';p.fillText('Imposed-path kinematics; no tire-force, torque, or grip prediction. Built by GPT-6 Astra.',60,850);
    out.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='split-drive-study.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},'image/png');
  }
  $('export').addEventListener('click',exportStudy);
  document.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey||/INPUT|SELECT|TEXTAREA|BUTTON|A/.test(e.target.tagName)||e.target.isContentEditable)return;if(e.code==='Space'){e.preventDefault();$('play').click();}else if(e.key.toLowerCase()==='r')reset();});
  document.addEventListener('visibilitychange',()=>{last=null;});
  reduced.addEventListener('change',e=>{if(e.matches){state.paused=true;controls();}});
  function advance(seconds){if(!state.paused)motion=C.advance(motion,solution,seconds*C.TIME_SCALE);draw();}
  function frame(now){if(!document.hidden){const dt=last===null?0:Math.min(.1,Math.max(0,(now-last)/1000));last=now;if(!captureMode)advance(dt);}requestAnimationFrame(frame);}
  window.splitDrive={snapshot:()=>({state:{...state},solution:{...solution},motion:{...motion,phase:[...motion.phase]}}),advance,draw};
  new ResizeObserver(resize).observe(canvas.parentElement);resize();controls();requestAnimationFrame(frame);
})();
