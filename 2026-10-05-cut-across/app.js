(() => {
  'use strict';
  const C = window.CutCore, $ = id => document.getElementById(id);
  const state = {cameraA:55, cameraB:135, playing:false, shot:'a', time:0};
  let manual = false, previous = 0;
  const actors = [{x:-1,name:'ADA',coat:'#a7b98a',skin:'#dfd9bd'}, {x:1,name:'JULES',coat:'#cf795a',skin:'#e5baa0'}];
  function order(angle) {
    if (C.cameraSide(angle) === 'axis') return 'ADA + JULES / ON AXIS';
    return C.projectActor(-1,angle).screenX < C.projectActor(1,angle).screenX ? 'ADA →  ← JULES' : 'JULES →  ← ADA';
  }
  function film(angle) {
    const projected = actors.map(a => ({...a,...C.projectActor(a.x,angle)})).sort((a,b) => b.depth-a.depth);
    const backdrop = `<defs><linearGradient id="wall-${angle}" x2="0" y2="1"><stop stop-color="#34433b"/><stop offset="1" stop-color="#283830"/></linearGradient></defs><rect width="760" height="360" fill="url(#wall-${angle})"/><path d="M0 280H760 M0 287H760" stroke="#64705b" opacity=".35"/><rect x="298" y="26" width="166" height="174" fill="#a8ae84" opacity=".15"/><path d="M310 26V200 M380 26V200 M450 26V200 M298 114H464" stroke="#17271e" stroke-width="6"/><path d="M0 354H760" stroke="#15271c" stroke-width="12"/><ellipse cx="380" cy="359" rx="260" ry="15" fill="#1c2b22"/>`;
    return backdrop + projected.map(a => {
      const px = 380+530*a.screenX, scale = a.scale*.88;
      const direction = C.cameraSide(angle) === 'axis' ? 0 : Math.sign(-a.x*Math.sin(angle*Math.PI/180));
      const face = direction === 0 ? '<path d="M-12 -17H-5 M5 -17H12" stroke="#3a3d30" stroke-width="2"/>' : `<path d="M${direction*27} -19 l${direction*14} 9 l${-direction*14} 6" fill="${a.skin}"/><path d="M${direction*16} -21h${direction*6}" stroke="#343a2e" stroke-width="2"/>`;
      return `<g transform="translate(${px.toFixed(3)} 335) scale(${scale.toFixed(4)})"><ellipse cy="28" rx="75" ry="8" fill="#111f17" opacity=".4"/><path d="M-78 48L-64 -71Q-59 -100 -20 -111L20 -111Q59 -100 64 -71L78 48Z" fill="${a.coat}"/><path d="M-22 -111L0 -75L22 -111L14 -128H-14Z" fill="${a.skin}"/><path d="M-33 -105L-8 -83L-19 -52 M33 -105L8 -83L19 -52" fill="none" stroke="#1e3424" stroke-opacity=".4" stroke-width="2"/><g transform="translate(0 -167)"><path d="M-31 1Q-42 -47 -10 -53Q33 -58 33 -13L29 8Z" fill="#222d25"/><ellipse cy="-12" rx="31" ry="40" fill="${a.skin}"/>${face}<path d="M-32 -21Q-39 -56 -3 -58Q23 -60 32 -37Q7 -34 -12 -40Q-20 -16 -32 -21" fill="#293226"/><circle cx="${-direction*21}" cy="-9" r="5" fill="${a.skin}"/></g><text x="0" y="-236" fill="${a.coat}" text-anchor="middle" font-family="monospace" font-size="11" letter-spacing="2">${a.name}${direction===0?'':direction>0?' →':' ←'}</text></g>`;
    }).join('') + '<rect x="10" y="10" width="740" height="340" fill="none" stroke="#d9d9b5" stroke-opacity=".07"/>';
  }
  function positionCamera(id, angle) {
    const point = C.cameraPoint(angle), x = 220+36*point.x, y = 196-36*point.y;
    $(id).setAttribute('transform',`translate(${x} ${y})`);
    // The chevron below the badge points from the camera toward the set.
    $(id).querySelector('path').setAttribute('transform',`rotate(${-angle+90})`);
    $(id === 'camera-a' ? 'sight-a':'sight-b').setAttribute('d',`M${x} ${y} L184 196 M${x} ${y} L256 196`);
  }
  let cachedB = null;
  const filmA = film(state.cameraA);
  $('frame-a').innerHTML = filmA;
  function render() {
    const result = C.continuity(state.cameraA,state.cameraB);
    document.body.classList.toggle('crossed',result==='crossed');
    document.body.classList.toggle('axis',result==='axis');
    $('camera-b-angle').value = Math.round(state.cameraB);
    $('angle-value').textContent = `${Math.round(state.cameraB)}°`;
    $('b-card-angle').textContent = `MOVABLE / ${Math.round(state.cameraB)}°`;
    positionCamera('camera-a',state.cameraA); positionCamera('camera-b',state.cameraB);
    if (cachedB !== state.cameraB) { $('frame-b').innerHTML = film(state.cameraB); cachedB = state.cameraB; }
    $('monitor').innerHTML = state.shot==='a' ? filmA : $('frame-b').innerHTML;
    $('monitor-label').textContent = `CAMERA ${state.shot.toUpperCase()}`;
    $('monitor').setAttribute('aria-label',`Camera ${state.shot.toUpperCase()}: ${order(state.shot==='a'?state.cameraA:state.cameraB)}`);
    $('order-a').textContent=order(state.cameraA); $('order-b').textContent=order(state.cameraB);
    $('shot-order').textContent=order(state.shot==='a'?state.cameraA:state.cameraB);
    $('select-a').classList.toggle('selected',state.shot==='a');$('select-b').classList.toggle('selected',state.shot==='b');
    $('select-a').setAttribute('aria-pressed',state.shot==='a');$('select-b').setAttribute('aria-pressed',state.shot==='b');
    $('play-cut').innerHTML = state.playing ? '<span aria-hidden="true">Ⅱ</span> Pause the cut' : '<span aria-hidden="true">▶</span> Play the cut';
    $('play-cut').setAttribute('aria-pressed',state.playing);$('play-light').classList.toggle('playing',state.playing);
    const frames = Math.floor(state.time*24), secs=Math.floor(frames/24);
    $('timecode').textContent = `${String(Math.floor(secs/60)).padStart(2,'0')}:${String(secs%60).padStart(2,'0')}:${String(frames%24).padStart(2,'0')}`;
    $('same-side').setAttribute('aria-pressed',state.cameraB===135);$('cross-line').setAttribute('aria-pressed',state.cameraB===225);
    const messages = {holds:['CONTINUITY HOLDS','Ada stays on the left. Jules stays on the right.','↔'],crossed:['SCREEN DIRECTION FLIPS','The cut swaps left and right. Nobody on the set moved.','⇄'],axis:['ON THE AXIS','The actors line up in depth. This view has no clear left–right order.','⋮']};
    $('status').textContent=messages[result][0];$('status-hint').textContent=messages[result][1];$('verdict-icon').textContent=messages[result][2];
  }
  function set(options={}) {
    if (Number.isFinite(options.cameraB)) state.cameraB=C.normalizeAngle(options.cameraB);
    if (typeof options.playing==='boolean') state.playing=options.playing;
    if (Number.isFinite(options.time)) state.time=Math.max(0,options.time);
    if (options.shot==='a'||options.shot==='b') state.shot=options.shot;
    render();
  }
  function tick(dt) {
    if (!state.playing || !Number.isFinite(dt) || dt<=0) return;
    state.time+=dt;state.shot=Math.floor((state.time+1e-8)/2)%2===0?'a':'b';render();
  }
  $('camera-b-angle').addEventListener('input',event=>set({cameraB:Number(event.target.value)}));
  $('same-side').addEventListener('click',()=>set({cameraB:135}));
  $('cross-line').addEventListener('click',()=>set({cameraB:225}));
  $('play-cut').addEventListener('click',()=>set({playing:!state.playing}));
  for (const shot of ['a','b']) $('select-'+shot).addEventListener('click',()=>set({shot,playing:false,time:shot==='a'?0:2}));
  $('reset').addEventListener('click',()=>set({cameraB:135,playing:false,shot:'a',time:0}));
  const stage=$('stage');let dragging=false;
  function drag(event) {
    const point=stage.createSVGPoint();point.x=event.clientX;point.y=event.clientY;
    const local=point.matrixTransform(stage.getScreenCTM().inverse());
    set({cameraB:Math.round(C.normalizeAngle(Math.atan2(196-local.y,local.x-220)*180/Math.PI))});
  }
  $('camera-b').addEventListener('pointerdown',event=>{dragging=true;$('camera-b').classList.add('dragging');stage.setPointerCapture(event.pointerId);drag(event);event.preventDefault();});
  stage.addEventListener('pointermove',event=>{if(dragging)drag(event);});
  function endDrag(){dragging=false;$('camera-b').classList.remove('dragging');}
  stage.addEventListener('pointerup',endDrag);stage.addEventListener('pointercancel',endDrag);stage.addEventListener('lostpointercapture',endDrag);
  function animate(timestamp) {if(!manual&&previous)tick(Math.min((timestamp-previous)/1000,.1));previous=timestamp;requestAnimationFrame(animate);}
  document.addEventListener('visibilitychange',()=>{previous=0;});
  window.cutAcross={getState:()=>({...state}),set,useManualClock:()=>{manual=true;},tick};
  render();requestAnimationFrame(animate);
})();
