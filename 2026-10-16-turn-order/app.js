(() => {
  'use strict';
  const M = window.TurnModel, $ = id => document.getElementById(id);
  const state = {moves: M.presets.two(), angle: 90, progress: 2, playing: false, live: true};
  const colors = {x: '#ef947c', y: '#e2d78c', z: '#b3acf1'};
  const symbol = m => m.axis.toUpperCase() + (m.sign > 0 ? '+' : '−');
  const neat = n => (Math.abs(n) < .0005 ? 0 : n).toFixed(3).replace('-', '−');
  const rounded = n => Math.round(n < .01 ? 0 : n);
  const camera = M.multiply(M.turn('x', 23), M.turn('y', -33));
  const faces = [
    {normal:[0,0,1], u:[1,0,0], v:[0,1,0], color:'#ef947c', label:'FRONT', mark:'F'},
    {normal:[0,0,-1], u:[-1,0,0], v:[0,1,0], color:'#b96859', label:'BACK', mark:'B'},
    {normal:[0,1,0], u:[1,0,0], v:[0,0,-1], color:'#e2d78c', label:'TOP', mark:'T'},
    {normal:[0,-1,0], u:[1,0,0], v:[0,0,1], color:'#a49b67', label:'BOTTOM', mark:'D'},
    {normal:[1,0,0], u:[0,0,-1], v:[0,1,0], color:'#b3acf1', label:'RIGHT', mark:'R'},
    {normal:[-1,0,0], u:[0,0,1], v:[0,1,0], color:'#7d77b3', label:'LEFT', mark:'L'}
  ];
  const plus = (a,b) => a.map((v,i) => v+b[i]);
  const scale = (v,k) => v.map(x => x*k);
  function draw(canvas, q) {
    const rect = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = rect.width, h = rect.height;
    if (!w || !h) return;
    if (canvas.width !== Math.round(w*dpr) || canvas.height !== Math.round(h*dpr)) {
      canvas.width = Math.round(w*dpr); canvas.height = Math.round(h*dpr);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,w,h);
    const unit = Math.min(w/4.9, h/4.4), cx = w/2, cy = h*.47;
    const view = v => M.rotate(camera,v);
    const project = v => {const p=view(v); return [cx+p[0]*unit,cy-p[1]*unit,p[2]];};
    const line = (a,b,color,width=1) => {ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();};
    for(let i=-4;i<=4;i++) {
      line(project([i*.6,-1.8,-2.4]),project([i*.6,-1.8,2.4]),'#5b64822e');
      line(project([-2.4,-1.8,i*.6]),project([2.4,-1.8,i*.6]),'#5b64822e');
    }
    ctx.save();ctx.translate(cx,cy+unit*1.72);ctx.scale(1,.24);
    const shadow=ctx.createRadialGradient(0,0,0,0,0,unit*1.6);shadow.addColorStop(0,'#11162999');shadow.addColorStop(1,'#11162900');
    ctx.fillStyle=shadow;ctx.beginPath();ctx.arc(0,0,unit*1.6,0,Math.PI*2);ctx.fill();ctx.restore();
    // Fixed room axes are deliberately independent of the cube's pose.
    const origin=project([0,-1.8,0]);
    for (const [axis,v] of Object.entries({x:[2.15,-1.8,0],y:[0,.7,0],z:[0,-1.8,2.15]})) {
      const end=project(v);line(origin,end,colors[axis]+'b0',1.2);
      const dx=end[0]-origin[0],dy=end[1]-origin[1],a=Math.atan2(dy,dx);
      line(end,[end[0]-7*Math.cos(a-.4),end[1]-7*Math.sin(a-.4)],colors[axis]);
      line(end,[end[0]-7*Math.cos(a+.4),end[1]-7*Math.sin(a+.4)],colors[axis]);
      ctx.font='10px ui-monospace,monospace';ctx.fillStyle=colors[axis];ctx.fillText(axis.toUpperCase(),end[0]+7,end[1]-5);
    }
    const visible=faces.map(f=>({...f,n:view(M.rotate(q,f.normal))})).filter(f=>f.n[2]>.001).sort((a,b)=>a.n[2]-b.n[2]);
    for(const f of visible) {
      const point=(u,v)=>project(M.rotate(q,plus(f.normal,plus(scale(f.u,u),scale(f.v,v)))));
      const corners=[point(-1,-1),point(1,-1),point(1,1),point(-1,1)];
      ctx.beginPath();corners.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();
      ctx.fillStyle=f.color;ctx.fill();ctx.lineWidth=1.5;ctx.strokeStyle='#20263fc0';ctx.stroke();
      const center=point(0,0),u=point(1,0),v=point(0,1);
      ctx.save();ctx.transform(u[0]-center[0],u[1]-center[1],center[0]-v[0],center[1]-v[1],center[0],center[1]);
      ctx.strokeStyle='#252a4350';ctx.lineWidth=.012;ctx.strokeRect(-.86,-.86,1.72,1.72);
      ctx.fillStyle='#252a43';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='500 .83px Arial,sans-serif';ctx.fillText(f.mark,0,-.08);
      ctx.font='.13px ui-monospace,monospace';ctx.fillText(f.label,0,.53);
      // An off-center dot and north-pointing tick make all in-face rotations visible.
      ctx.beginPath();ctx.arc(-.68,-.67,.045,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.moveTo(.59,-.53);ctx.lineTo(.59,-.76);ctx.lineTo(.52,-.66);ctx.moveTo(.59,-.76);ctx.lineTo(.66,-.66);ctx.lineWidth=.022;ctx.strokeStyle='#252a43';ctx.stroke();ctx.restore();
    }
  }
  function render() {
    const reversed=state.moves.slice().reverse();
    const a=M.pose(state.moves,state.angle,state.progress),b=M.pose(reversed,state.angle,state.progress);
    const gap=M.distance(a,b),homeA=M.distance(a,M.identity()),homeB=M.distance(b,M.identity());
    draw($('cube-a'),a);draw($('cube-b'),b);
    $('order-a').textContent=state.moves.map(symbol).join(' → ') || 'START';
    $('order-b').textContent=reversed.map(symbol).join(' → ') || 'START';
    $('gap').textContent=rounded(gap);$('home-a').textContent=rounded(homeA)+'°';$('home-b').textContent=rounded(homeB)+'°';
    $('gap-fill').style.width=gap/1.8+'%';$('gap-symbol').textContent=gap<.01?'=':'≠';
    $('verdict').textContent=gap<.01?'The two poses line up.':'Same turns. Different destination.';
    $('timeline').max=Math.max(1,state.moves.length);$('timeline').value=state.progress;
    $('timeline').disabled=!state.moves.length;
    $('progress-label').textContent=state.progress.toFixed(state.progress%1?1:0)+' / '+state.moves.length;
    const finished=state.progress>=state.moves.length;
    $('step-label').textContent=!state.moves.length?'START / NO TURNS':(finished?'FINISH':state.progress===0?'START':'TURN '+Math.min(state.moves.length,Math.floor(state.progress)+1))+' / '+state.moves.length+' TURNS';
    $('play').innerHTML=state.playing?'Ⅱ <span>Pause turns</span>':'▶ <span>'+(finished?'Replay turns':'Play turns')+'</span>';
    $('play').setAttribute('aria-label',state.playing?'Pause turns':finished?'Replay turns':'Play turns');
    $('play').disabled=!state.moves.length;$('undo').disabled=!state.moves.length;$('clear').disabled=!state.moves.length;
    $('move-count').textContent=state.moves.length+' / 6';$('angle-value').textContent=state.angle+'°';
    document.querySelectorAll('[data-axis]').forEach(el=>el.disabled=state.moves.length>=6);
    $('sequence').replaceChildren(...(state.moves.length?state.moves.map((m,i)=>{
      const chip=document.createElement('span');chip.className='move-chip '+m.axis+(Math.floor(state.progress)===i&&!finished?' active':'');chip.textContent=symbol(m);return chip;
    }):[Object.assign(document.createElement('span'),{className:'empty-sequence',textContent:'Add a turn below ↓'})]));
    $('quaternion').textContent=a.map(neat).join(', ');
    let note;
    if(!state.moves.length)note='A clean start. Add turns around two different axes, then compare their order.';
    else if(state.angle===0)note='No angle, no turn. Both cubes stay exactly where they started.';
    else if(state.progress===0)note='The starting poses are identical. Press play and follow the face marked TOP.';
    else if(!finished)note='Both cubes follow one turn at a time. The colored room axes stay fixed while the marked faces move.';
    else if(state.moves.every(m=>m.axis===state.moves[0].axis))note='Turns around one axis add up in either order. Here, reversing the sequence gives the same pose.';
    else if(state.angle===180&&gap<.01)note='A useful exception: these half-turns around perpendicular room axes agree in either order. A quaternion and its negative describe the same pose.';
    else if(gap<.01)note='This sequence happens to agree in both orders. Try changing an axis, a sign, or the angle.';
    else if(state.moves.length===4&&homeA>.01&&state.moves[0].axis===state.moves[2].axis&&state.moves[1].axis===state.moves[3].axis&&state.moves[0].sign===-state.moves[2].sign&&state.moves[1].sign===-state.moves[3].sign)note='Forward, sideways, backward, back. The signed angles cancel on each axis, yet the cube does not come home. Turns remember their order.';
    else note=(state.moves.length===2?symbol(state.moves[0])+' then '+symbol(state.moves[1])+' is not '+symbol(state.moves[1])+' then '+symbol(state.moves[0])+'. ':'Reversing these turns changes the result. ')+(state.moves.length===2&&state.angle===90?'Both cubes are 120° from the start, but they are also 120° apart.':'The two final poses are '+rounded(gap)+'° apart.');
    $('observation').textContent=note;
  }
  function edit() {
    state.playing=false;state.progress=state.moves.length;
    document.querySelectorAll('[data-preset]').forEach(el=>el.setAttribute('aria-pressed',false));render();
  }
  document.querySelectorAll('[data-axis]').forEach(el=>el.addEventListener('click',()=>{if(state.moves.length<6){state.moves.push({axis:el.dataset.axis,sign:Number(el.dataset.sign)});edit();}}));
  document.querySelectorAll('[data-preset]').forEach(el=>el.addEventListener('click',()=>{state.moves=M.presets[el.dataset.preset]();state.angle=90;$('angle').value=90;edit();el.setAttribute('aria-pressed',true);}));
  $('undo').addEventListener('click',()=>{state.moves.pop();edit();});
  $('clear').addEventListener('click',()=>{state.moves=[];edit();});
  $('angle').addEventListener('input',e=>{state.angle=Number(e.target.value);edit();});
  $('timeline').addEventListener('input',e=>{state.playing=false;state.progress=Number(e.target.value);render();});
  $('home').addEventListener('click',()=>{state.playing=false;state.progress=0;render();});
  $('play').addEventListener('click',()=>{if(state.progress>=state.moves.length)state.progress=0;state.playing=!state.playing;render();});
  function advance(dt){if(state.playing){state.progress=Math.min(state.moves.length,state.progress+dt/1.3);if(state.progress>=state.moves.length)state.playing=false;render();}}
  let previous=performance.now();function tick(now){if(state.live)advance(Math.min(.1,(now-previous)/1000));previous=now;requestAnimationFrame(tick);}requestAnimationFrame(tick);
  new ResizeObserver(render).observe($('cube-a'));
  window.turnOrder={state,render,advance,setLive(value){state.live=value;},getStats(){const a=M.pose(state.moves,state.angle,state.progress),b=M.pose(state.moves.slice().reverse(),state.angle,state.progress);return{gap:M.distance(a,b),homeA:M.distance(a,M.identity()),homeB:M.distance(b,M.identity()),a,b};}};
  render();
})();
