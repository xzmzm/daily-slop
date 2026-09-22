(() => {
  'use strict';
  const C = window.InkCore, $ = s => document.querySelector(s), canvas = $('#print');
  let state = C.normalize(), dragging = null, pending = false;
  const plates = [document.createElement('canvas'), document.createElement('canvas')];
  plates.forEach(p => { p.width = 900; p.height = 1100; });
  const circle = (ctx, x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
  const path = (ctx, d) => ctx.fill(new Path2D(d));
  function text(ctx, content, x, y, size, weight = 700, family = 'Arial') {
    ctx.font = `${weight} ${size}px ${family}`; ctx.fillText(content, x, y);
  }
  function registration(ctx) {
    ctx.lineWidth = 1.6;
    for (const [x, y] of [[34, 34], [866, 34], [34, 1066], [866, 1066]]) {
      ctx.beginPath();ctx.moveTo(x - 13, y);ctx.lineTo(x + 13, y);ctx.moveTo(x, y - 13);ctx.lineTo(x, y + 13);ctx.stroke();
      ctx.beginPath();ctx.arc(x, y, 7, 0, Math.PI * 2);ctx.stroke();
    }
  }
  function art(ctx, plate) {
    const a = plate === 'a';
    if (state.design === 'sun') {
      if (a) {
        path(ctx, 'M100 838V510A247 247 0 0 1 494 311L494 838Z');
        ctx.save();ctx.globalCompositeOperation = 'destination-out';
        path(ctx, 'M187 838V530A132 132 0 0 1 451 530V838Z');ctx.restore();
        path(ctx, 'M84 866Q302 701 525 828Q676 922 816 746V922H84Z');
        text(ctx, 'SUN', 81, 194, 133, 800);
        text(ctx, 'ROOM', 510, 980, 60, 800);
      } else {
        circle(ctx, 582, 398, 213);
        ctx.save();ctx.beginPath();ctx.rect(300, 520, 515, 230);ctx.clip();
        for (let y = 528; y < 750; y += 16) { ctx.beginPath();ctx.moveTo(302, y);ctx.bezierCurveTo(448, y-66, 635, y+81, 819, y-9);ctx.lineWidth=7;ctx.stroke(); }
        ctx.restore();
        circle(ctx, 155, 956, 15); circle(ctx, 202, 956, 15); circle(ctx, 249, 956, 15);
      }
    } else if (state.design === 'bloom') {
      if (a) {
        text(ctx, 'LATE', 81, 194, 133, 800);
        ctx.lineWidth = 17;ctx.beginPath();ctx.moveTo(450, 915);ctx.bezierCurveTo(480, 710, 392, 547, 458, 384);ctx.stroke();
        path(ctx, 'M454 713Q144 745 151 485Q402 463 454 713Z');
        path(ctx, 'M455 843Q734 865 767 597Q493 577 455 843Z');
        ctx.save();ctx.globalCompositeOperation = 'destination-out';ctx.lineWidth=4;
        for(let j=0;j<7;j++){ctx.beginPath();ctx.moveTo(196+j*25,532+j*18);ctx.lineTo(251+j*23,653+j*9);ctx.stroke();}ctx.restore();
        text(ctx, 'BLOOM', 452, 983, 62, 800);
      } else {
        for (let i=0;i<8;i++) { const angle=i*Math.PI/4; circle(ctx, 466+Math.cos(angle)*104, 370+Math.sin(angle)*104, 91); }
        ctx.save();ctx.globalCompositeOperation='destination-out';circle(ctx,466,370,54);ctx.restore();
        circle(ctx,200,938,16);circle(ctx,248,938,16);circle(ctx,296,938,16);
      }
    } else {
      if (a) {
        text(ctx, 'SLOW', 81, 194, 133, 800);
        for(let y=400;y<900;y+=94) path(ctx, `M83 ${y}Q245 ${y-131} 450 ${y}T816 ${y}V${y+48}Q632 ${y+179} 450 ${y+48}T83 ${y+48}Z`);
        text(ctx, 'TIDE', 591, 983, 62, 800);
      } else {
        circle(ctx,561,414,220);
        for(let i=0;i<3;i++)circle(ctx,155+i*47,962,15);
      }
    }
  }
  function buildPlate(plate, index) {
    const ctx = plates[index].getContext('2d'), ink = C.palettes[state.palette][plate];
    ctx.clearRect(0,0,900,1100);ctx.fillStyle=ink;ctx.strokeStyle=ink;ctx.lineCap='butt';
    art(ctx,plate);
    if (state.marks) registration(ctx);
    if (state.grain) {
      const random = C.seeded(plate === 'a' ? 203 : 811);
      ctx.save();ctx.globalCompositeOperation='destination-out';
      for(let i=0;i<16000;i++){ctx.globalAlpha=.1+random()*.4;const x=random()*900,y=random()*1100;ctx.fillRect(x,y,.5+random()*1.4,.5+random()*1.6);}ctx.restore();
    }
  }
  function render(target = canvas) {
    const ctx = target.getContext('2d');ctx.save();ctx.setTransform(target.width/900,0,0,target.height/1100,0,0);
    ctx.fillStyle=C.paper;ctx.fillRect(0,0,900,1100);
    ctx.globalCompositeOperation='multiply';
    if (state.view !== 'b') ctx.drawImage(plates[0],0,0);
    if (state.view !== 'a') {
      ctx.save();ctx.translate(450+state.x*5,550+state.y*5);ctx.rotate(state.rotation*Math.PI/180);ctx.translate(-450,-550);ctx.drawImage(plates[1],0,0);ctx.restore();
    }
    ctx.globalCompositeOperation='source-over';ctx.fillStyle='#3a4d43';
    text(ctx,'INK REGISTER     /     TWO-COLOR STUDIES',84,78,13,500);
    text(ctx,'23 — 09 — 2026',677,78,13,500);
    ctx.fillRect(84,1009,732,1);
    text(ctx,'A SMALL EDITION OF ONE',84,1040,13,500);
    const title=C.palettes[state.palette].name.toUpperCase();ctx.textAlign='right';text(ctx,`${title}  /  ${state.view==='both'?'A + B':'INK '+state.view.toUpperCase()}`,816,1040,13,500);ctx.textAlign='left';
    if(state.grain){const random=C.seeded(9123);for(let i=0;i<19000;i++){ctx.fillStyle=random()>.48?'#3b372710':'#fffdfa35';const x=random()*900,y=random()*1100;ctx.fillRect(x,y,.5+random(),.5+random());}}
    ctx.restore();
    canvas.setAttribute('aria-label',`${{sun:'Sun room',bloom:'Late bloom',tide:'Slow tide'}[state.design]}, ${C.palettes[state.palette].name}. ${state.view==='both'?'Both inks':`Ink ${state.view.toUpperCase()}`}. Ink B offset ${state.x.toFixed(1)} millimeters horizontally, ${state.y.toFixed(1)} vertically, rotated ${state.rotation.toFixed(1)} degrees. Drag or use arrow keys to move ink B.`);
  }
  function schedule() { if(!pending){pending=true;requestAnimationFrame(()=>{pending=false;render();});} }
  const signed = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1);
  function update({ rebuild = false } = {}) {
    state=C.normalize(state);
    const p=C.palettes[state.palette];document.documentElement.style.setProperty('--ink-a',p.a);document.documentElement.style.setProperty('--ink-b',p.b);
    $('#swatch-a').style.background=C.multiply(C.paper,p.a);$('#swatch-b').style.background=C.multiply(C.paper,p.b);$('#swatch-mix').style.background=C.multiply(C.paper,p.a,p.b);
    for(const [key,id,out,unit] of [['x','offset-x','x-value',' mm'],['y','offset-y','y-value',' mm'],['rotation','rotation','rotation-value','°']]){$('#'+id).value=state[key];$('#'+out).value=signed(state[key])+unit;}
    for(const [attr,value] of [['design',state.design],['palette',String(state.palette)],['view',state.view]]) document.querySelectorAll(`[data-${attr}]`).forEach(el=>{const active=el.dataset[attr]===value;el.setAttribute('aria-pressed',active);el.classList.toggle('selected',active);});
    $('#grain').checked=state.grain;$('#marks').checked=state.marks;
    $('#alignment').textContent=state.x===0&&state.y===0&&state.rotation===0?'Perfectly in register.':'A little off, just right.';
    if(rebuild){buildPlate('a',0);buildPlate('b',1);}schedule();
  }
  for(const key of ['design','palette','view']) document.querySelectorAll(`[data-${key}]`).forEach(button=>button.addEventListener('click',()=>{state[key]=key==='palette'?Number(button.dataset[key]):button.dataset[key];update({rebuild:key!=='view'});}));
  for(const [id,key] of [['offset-x','x'],['offset-y','y'],['rotation','rotation']]) $('#'+id).addEventListener('input',event=>{state[key]=Number(event.target.value);update();});
  for(const key of ['grain','marks']) $('#'+key).addEventListener('change',event=>{state[key]=event.target.checked;update({rebuild:true});});
  $('#align').addEventListener('click',()=>{Object.assign(state,{x:0,y:0,rotation:0});update();});
  $('#surprise').addEventListener('click',()=>{Object.assign(state,C.randomOffset(),{view:'both'});update();});
  // The sheet is rotated only by CSS, so use its inverse transform for dragging.
  function localPoint(event) {
    const rect=canvas.getBoundingClientRect(),angle=-Math.PI/180,dx=event.clientX-(rect.left+rect.width/2),dy=event.clientY-(rect.top+rect.height/2);
    return {x:dx*Math.cos(angle)+dy*Math.sin(angle),y:-dx*Math.sin(angle)+dy*Math.cos(angle)};
  }
  canvas.addEventListener('pointerdown',event=>{if(event.button!==0)return;const p=localPoint(event);dragging={id:event.pointerId,x:p.x,y:p.y,state:{...state}};canvas.setPointerCapture(event.pointerId);canvas.focus({preventScroll:true});if(state.view==='a'){state.view='both';update();}});
  canvas.addEventListener('pointermove',event=>{if(!dragging||dragging.id!==event.pointerId)return;const p=localPoint(event);Object.assign(state,C.offsetFromDrag(dragging.state,p.x-dragging.x,p.y-dragging.y,canvas.clientWidth,canvas.clientHeight));update();});
  function stop(event){if(dragging?.id===event.pointerId)dragging=null;}
  canvas.addEventListener('pointerup',stop);canvas.addEventListener('pointercancel',stop);canvas.addEventListener('lostpointercapture',stop);
  canvas.addEventListener('keydown',event=>{const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];if(!delta)return;event.preventDefault();const step=event.shiftKey?5:.2;state.x+=delta[0]*step;state.y+=delta[1]*step;if(state.view==='a')state.view='both';update();});
  $('#export').addEventListener('click',()=>{
    const out=document.createElement('canvas');out.width=1800;out.height=2200;render(out);$('#status').textContent='Pulling your print…';
    const filename=`ink-register-${state.design}-${C.palettes[state.palette].name.toLowerCase().replaceAll(' ','-')}-${state.view}.png`;
    out.toBlob(blob=>{if(!blob){$('#status').textContent='Could not make the print. Please try again.';return;}const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);$('#status').textContent='Print pulled. Your PNG is ready.';},'image/png');
  });
  window.inkRegister={getState:()=>({...state}),render};
  update({rebuild:true});
})();
