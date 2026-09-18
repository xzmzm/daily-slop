/* Type Light — an entirely local, dependency-free ASCII darkroom. */
(() => {
  'use strict';
  const C = window.TypeLightCore;
  const $ = id => document.getElementById(id);
  const canvas = $('display'), ctx = canvas.getContext('2d');
  const sourceCanvas = document.createElement('canvas'), sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
  const sampleCanvas = document.createElement('canvas'), sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
  const printCanvas = document.createElement('canvas'), printCtx = printCanvas.getContext('2d');
  const alphabets = { classic: ' .:-=+*#%@', binary: ' @', extended: ' .,:;il!<>~+_-?][}{1%#@' };
  const palettes = {
    mint: { bg: '#111916', fg: '#c0f2b3', label: 'Phosphor' },
    amber: { bg: '#1c1710', fg: '#f4bc70', label: 'Warm amber' },
    paper: { bg: '#e9e5d7', fg: '#2e3928', label: 'Ink & paper' },
    color: { bg: '#111916', fg: '#c0f2b3', label: 'Source color' }
  };
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const defaults = { source: 'knot', columns: 132, charset: 'classic', dither: 'none', exposure: .8, contrast: 1.2, palette: 'mint', reveal: 50 };
  const state = { ...defaults, paused: reduceMotion.matches, time: .7 };
  let glyphs = [], levels = [], indices = new Uint16Array(), rows = 0, image = null, imageRevision = 0;
  let lastTime = null, lastDraw = -1000, dirty = true, mesh = [];
  const FONT = '14px "Liberation Mono",Consolas,monospace';
  const CELL_W = 9, CELL_H = 16;
  const report = text => { $('message').textContent = text; };
  const normalize = a => { const n = Math.hypot(...a) || 1; return a.map(v => v / n); };
  const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  const center = t => [(2 + .7*Math.cos(3*t))*Math.cos(2*t), (2 + .7*Math.cos(3*t))*Math.sin(2*t), .9*Math.sin(3*t)];
  function makeKnot() {
    const U = 144, V = 20, vertices = [];
    for (let u = 0; u < U; u++) {
      const t = u / U * Math.PI * 2, c = center(t), next = center(t + .001);
      const tangent = normalize(next.map((v, i) => v - c[i]));
      const n = normalize(cross(tangent, [0,0,1])), b = cross(tangent,n);
      for (let v = 0; v < V; v++) {
        const phi = v/V*Math.PI*2, normal = n.map((x, i) => x*Math.cos(phi) + b[i]*Math.sin(phi));
        vertices.push({ p: c.map((x, i) => x + normal[i]*.43), n: normal, hue: (.5 + .5*Math.sin(t*2 + .3)) });
      }
    }
    const faces = [];
    for (let u=0;u<U;u++) for(let v=0;v<V;v++) faces.push([u*V+v,((u+1)%U)*V+v,((u+1)%U)*V+(v+1)%V,u*V+(v+1)%V]);
    return { vertices, faces };
  }
  mesh = makeKnot();
  function rotate(p) {
    const ay = state.time*.23 + .5, ax = .55 + Math.sin(state.time*.14)*.22, az = -.2;
    const x = p[0]*Math.cos(ay) + p[2]*Math.sin(ay), z = -p[0]*Math.sin(ay) + p[2]*Math.cos(ay);
    const y = p[1]*Math.cos(ax) - z*Math.sin(ax), z2 = p[1]*Math.sin(ax) + z*Math.cos(ax);
    return [x*Math.cos(az)-y*Math.sin(az), x*Math.sin(az)+y*Math.cos(az), z2];
  }
  function drawKnot(w, h) {
    const scale = Math.min(w/8.2, h/6.6);
    const vertices = mesh.vertices.map(vertex => {
      const p = rotate(vertex.p), n = rotate(vertex.n), projection = 8/(8-p[2]*.35);
      return { x: w*.51 + p[0]*scale*projection, y: h*.51 - p[1]*scale*projection, z: p[2], n, hue: vertex.hue };
    });
    const faces = mesh.faces.map(ids => ({ ids, depth: ids.reduce((s, i) => s+vertices[i].z,0)/4 }));
    faces.sort((a,b)=>a.depth-b.depth);
    for (const face of faces) {
      const points = face.ids.map(i=>vertices[i]);
      const n = normalize([0,1,2].map(i=>points.reduce((s,p)=>s+p.n[i],0)/4));
      if (n[2] < -.12) continue;
      const lambert = Math.max(0, n[0]*-.37+n[1]*.55+n[2]*.748);
      const spec = Math.pow(Math.max(0,n[0]*-.2+n[1]*.3+n[2]*.932),36)*175;
      const rim = Math.pow(1-Math.max(0,n[2]),3)*.22;
      const shade = .16 + lambert*.8 + rim, mix=points[0].hue;
      const base = [126+mix*84, 196-mix*48, 161-mix*58];
      const rgb = base.map(v=>Math.round(C.clamp(v*shade+spec,0,255)));
      sourceCtx.fillStyle=`rgb(${rgb})`;
      sourceCtx.beginPath();
      sourceCtx.moveTo(points[0].x,points[0].y);
      for(let i=1;i<4;i++) sourceCtx.lineTo(points[i].x,points[i].y);
      sourceCtx.closePath();
      sourceCtx.fill();
      // A hairline in the face color closes antialiasing cracks between quads.
      sourceCtx.strokeStyle=sourceCtx.fillStyle; sourceCtx.lineWidth=.65; sourceCtx.stroke();
    }
  }
  function drawOrbits(w, h) {
    const orbs = [];
    for (let i=0;i<7;i++) {
      const a=i/7*Math.PI*2+state.time*.2;
      orbs.push({ x:w*.5+Math.cos(a)*w*.23, y:h*.5+Math.sin(a)*h*.24, z:Math.sin(a), r:h*(.09+.028*(1+Math.cos(a))), i });
    }
    orbs.push({x:w*.5,y:h*.5,z:0,r:h*.2,i:8});
    orbs.sort((a,b)=>a.z-b.z);
    for (const o of orbs) {
      const gr=sourceCtx.createRadialGradient(o.x-o.r*.35,o.y-o.r*.4,o.r*.01,o.x,o.y,o.r);
      gr.addColorStop(0,'#eff8dc'); gr.addColorStop(.22,o.i%2 ? '#d9b58a':'#acd9b8'); gr.addColorStop(.66,o.i%2 ? '#6b5740':'#53755e'); gr.addColorStop(1,'#101a14');
      sourceCtx.fillStyle=gr; sourceCtx.beginPath(); sourceCtx.arc(o.x,o.y,o.r,0,Math.PI*2);sourceCtx.fill();
    }
  }
  function drawSignal(w,h) {
    const g=sourceCtx.createLinearGradient(w*.12,0,w*.88,0);
    g.addColorStop(0,'#000'); g.addColorStop(1,'#fff');
    sourceCtx.fillStyle=g; sourceCtx.fillRect(w*.12,h*.19,w*.76,h*.18);
    for(let i=0;i<8;i++) {
      const x=w*(.16+i*.095), y=h*.6, r=h*.105;
      const gr=sourceCtx.createRadialGradient(x-r*.35,y-r*.4,0,x,y,r);
      gr.addColorStop(0,'white');gr.addColorStop(1,`hsl(${i*40},32%,${10+i*4}%)`);
      sourceCtx.fillStyle=gr;sourceCtx.beginPath();sourceCtx.arc(x,y,r,0,Math.PI*2);sourceCtx.fill();
    }
    sourceCtx.font=`${h*.055}px monospace`;sourceCtx.fillStyle='#96b886';sourceCtx.textAlign='center';sourceCtx.fillText(':-)    LIGHT IS THE ORIGINAL ALPHABET',w*.5,h*.85);
  }
  function calibrate() {
    const c=document.createElement('canvas');c.width=CELL_W;c.height=CELL_H;
    const context=c.getContext('2d',{willReadFrequently:true});
    const measured=Array.from(new Set(alphabets[state.charset])).map(glyph=>{
      context.clearRect(0,0,CELL_W,CELL_H);context.font=FONT;context.textBaseline='alphabetic';context.fillStyle='#fff';context.fillText(glyph,0,12);
      const pixels=context.getImageData(0,0,CELL_W,CELL_H).data;
      let ink=0;for(let i=3;i<pixels.length;i+=4)ink+=pixels[i]/255;
      return {glyph,ink:ink/(CELL_W*CELL_H)};
    }).sort((a,b)=>a.ink-b.ink);
    const max=measured[measured.length-1].ink||1;
    glyphs=measured.map(g=>g.glyph);levels=measured.map(g=>g.ink/max);
    $('glyph-ramp').replaceChildren();
    measured.forEach((g,i)=>{
      const el=document.createElement('div');el.className='glyph';el.title=`${g.glyph===' '?'Space':g.glyph}: ${(g.ink*100).toFixed(1)}% cell ink coverage`;
      const symbol=document.createElement('span');symbol.textContent=g.glyph===' '?'·':g.glyph;
      const bar=document.createElement('i'), fill=document.createElement('b');fill.style.width=`${levels[i]*100}%`;bar.append(fill);
      const label=document.createElement('small');label.textContent=g.glyph===' '?'SPACE':`${Math.round(g.ink*100)}%`;
      el.append(symbol,bar,label);$('glyph-ramp').append(el);
    });
    dirty=true;
  }
  function resize() {
    const rect=$('drop-zone').getBoundingClientRect();
    const dpr=Math.min(window.devicePixelRatio||1,2);
    canvas.width=Math.max(1,Math.round(rect.width*dpr));canvas.height=Math.max(1,Math.round(rect.height*dpr));
    rows=Math.max(1,Math.round(state.columns*CELL_W/CELL_H*rect.height/Math.max(1,rect.width)));
    printCanvas.width=state.columns*CELL_W;printCanvas.height=rows*CELL_H;
    sampleCanvas.width=state.columns;sampleCanvas.height=rows;
    sourceCanvas.width=720;sourceCanvas.height=Math.max(1,Math.round(720*rect.height/Math.max(1,rect.width)));
    $('grid-size').textContent=`${state.columns} × ${rows}`;dirty=true;
  }
  function drawSource() {
    const w=sourceCanvas.width,h=sourceCanvas.height;
    sourceCtx.fillStyle='#080e0b';sourceCtx.fillRect(0,0,w,h);
    if(state.source==='image'&&image) {
      const s=Math.min(w/image.width,h/image.height);sourceCtx.drawImage(image,(w-image.width*s)/2,(h-image.height*s)/2,image.width*s,image.height*s);
    } else if(state.source==='orbits')drawOrbits(w,h);
    else if(state.source==='signal')drawSignal(w,h);
    else drawKnot(w,h);
  }
  function render() {
    drawSource();
    sampleCtx.drawImage(sourceCanvas,0,0,state.columns,rows);
    const data=sampleCtx.getImageData(0,0,state.columns,rows).data;
    const values=new Float64Array(state.columns*rows);
    for(let p=0;p<values.length;p++)values[p]=C.tone(C.luminance(data[p*4],data[p*4+1],data[p*4+2]),state.exposure,state.contrast);
    indices=C.quantize(values,state.columns,rows,levels,state.dither);
    const pal=palettes[state.palette];
    printCtx.fillStyle=pal.bg;printCtx.fillRect(0,0,printCanvas.width,printCanvas.height);
    printCtx.font=FONT;printCtx.textBaseline='alphabetic';printCtx.fillStyle=pal.fg;
    for(let p=0;p<indices.length;p++) {
      const glyph=glyphs[indices[p]];if(glyph===' ')continue;
      if(state.palette==='color') {
        const max=Math.max(data[p*4],data[p*4+1],data[p*4+2],1),scale=235/max;
        printCtx.fillStyle=`rgb(${Math.round(data[p*4]*scale)},${Math.round(data[p*4+1]*scale)},${Math.round(data[p*4+2]*scale)})`;
      }
      printCtx.fillText(glyph,(p%state.columns)*CELL_W,Math.floor(p/state.columns)*CELL_H+12);
    }
    ctx.imageSmoothingEnabled=true;ctx.drawImage(printCanvas,0,0,canvas.width,canvas.height);
    if(state.reveal>0) {ctx.save();ctx.beginPath();ctx.rect(0,0,canvas.width*state.reveal/100,canvas.height);ctx.clip();ctx.drawImage(sourceCanvas,0,0,canvas.width,canvas.height);ctx.restore();}
    $('compare-line').style.left=`${state.reveal}%`;
    $('compare-line').style.display=state.reveal>0&&state.reveal<100?'block':'none';
    $('source-label').hidden=state.reveal<10;
    canvas.dataset.ready='true';canvas.dataset.cells=String(indices.length);dirty=false;
  }
  function syncControls() {
    for(const name of ['source','columns','charset','dither','exposure','contrast','reveal'])$(name).value=String(state[name]);
    $('columns-value').textContent=String(state.columns);$('reveal-value').textContent=`${state.reveal}%`;
    $('exposure-value').textContent=`${state.exposure>=0?'+':''}${state.exposure.toFixed(1)}`;$('contrast-value').textContent=`${state.contrast.toFixed(1)}×`;
    $('play-label').textContent=state.paused?'Play':'Pause';$('play-icon').textContent=state.paused?'▶':'Ⅱ';
    $('play').setAttribute('aria-label',state.paused?'Play animation':'Pause animation');$('play').setAttribute('aria-pressed',String(state.paused));
    $('play').disabled=state.source==='image'||state.source==='signal';
    $('source-name').textContent={knot:'TORUS KNOT',orbits:'ORBITAL STILL LIFE',signal:'TEST SIGNAL',image:'YOUR IMAGE'}[state.source];
    $('palette-name').textContent=palettes[state.palette].label;
    document.querySelectorAll('[data-palette]').forEach(b=>{const chosen=b.dataset.palette===state.palette;b.classList.toggle('selected',chosen);b.setAttribute('aria-pressed',String(chosen));});
    dirty=true;
  }
  function setSource(value) {state.source=value;state.paused=reduceMotion.matches||['image','signal'].includes(value);syncControls();}
  $('source').addEventListener('change',e=>setSource(e.target.value));
  for(const key of ['columns','exposure','contrast','reveal'])$(key).addEventListener('input',e=>{state[key]=Number(e.target.value);if(key==='columns')resize();syncControls();});
  $('charset').addEventListener('change',e=>{state.charset=e.target.value;calibrate();syncControls();});
  $('dither').addEventListener('change',e=>{state.dither=e.target.value;syncControls();});
  document.querySelectorAll('[data-palette]').forEach(button=>button.addEventListener('click',()=>{state.palette=button.dataset.palette;syncControls();}));
  $('play').addEventListener('click',()=>{state.paused=!state.paused;syncControls();});
  function reset() {imageRevision++;Object.assign(state,defaults,{paused:reduceMotion.matches,time:.7});image=null;$('source').querySelector('[value="image"]')?.remove();$('file').value='';calibrate();resize();syncControls();report('No uploads. Your images stay in this tab.');}
  $('reset').addEventListener('click',reset);
  $('experiment').addEventListener('click',()=>{state.charset='binary';state.dither='diffusion';state.reveal=0;calibrate();syncControls();});
  // Keep the experiment's scroll separate so video captures can click native controls without jumps.
  $('experiment').addEventListener('click',()=>document.querySelector('.studio').scrollIntoView({behavior:reduceMotion.matches?'instant':'smooth',block:'start'}));
  function download(blob,name) {const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function text() {if(dirty)render();return C.textFromIndices(indices,state.columns,glyphs);}
  $('save-text').addEventListener('click',()=>{download(new Blob([text()+'\n'],{type:'text/plain;charset=utf-8'}),'type-light.txt');report('Saved real, selectable ASCII text.');});
  $('save-png').addEventListener('click',()=>{if(dirty)render();printCanvas.toBlob(blob=>{if(blob){download(blob,'type-light.png');report('Saved the ASCII print — without the source reveal.');}else report('PNG export failed. Please try again.');},'image/png');});
  $('copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(text());report('ASCII copied. Paste it in a monospace font.');}catch{report('Clipboard is unavailable here. Use .txt to save instead.');}});
  async function loadImage(file) {
    if(!file)return;
    if(!file.type.startsWith('image/')){report('Please choose an image file.');return;}
    if(file.size>20*1024*1024){report('Please use an image smaller than 20 MB.');return;}
    const revision=++imageRevision,url=URL.createObjectURL(file),candidate=new Image();
    try {
      candidate.src=url;await candidate.decode();if(revision!==imageRevision)return;
      // Downsample before keeping the image, limiting repeated render work.
      const max=2048,scale=Math.min(1,max/Math.max(candidate.width,candidate.height));
      const local=document.createElement('canvas');local.width=Math.max(1,Math.round(candidate.width*scale));local.height=Math.max(1,Math.round(candidate.height*scale));local.getContext('2d').drawImage(candidate,0,0,local.width,local.height);image=local;
      if(!$('source').querySelector('[value="image"]')){const option=document.createElement('option');option.value='image';option.textContent='Your image';$('source').append(option);}
      setSource('image');report('Image opened locally. Nothing was sent anywhere.');
    }catch{if(revision===imageRevision)report('This image could not be decoded. Try PNG, JPEG, or WebP.');}finally{URL.revokeObjectURL(url);}
  }
  $('upload').addEventListener('click',()=>$('file').click());$('file').addEventListener('change',e=>loadImage(e.target.files[0]));
  let dragDepth=0;
  $('drop-zone').addEventListener('dragenter',e=>{e.preventDefault();dragDepth++;$('drop-zone').classList.add('drag-over');});
  $('drop-zone').addEventListener('dragover',e=>e.preventDefault());
  $('drop-zone').addEventListener('dragleave',()=>{if(--dragDepth<=0){dragDepth=0;$('drop-zone').classList.remove('drag-over');}});
  $('drop-zone').addEventListener('drop',e=>{e.preventDefault();dragDepth=0;$('drop-zone').classList.remove('drag-over');loadImage(e.dataTransfer.files[0]);});
  document.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey||/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName)||e.target.isContentEditable)return;if(e.code==='Space'&&!$('play').disabled){e.preventDefault();$('play').click();}else if(e.key.toLowerCase()==='r')reset();});
  document.addEventListener('visibilitychange',()=>{lastTime=null;});
  new ResizeObserver(resize).observe($('drop-zone'));
  function frame(now) {
    if(!document.hidden) {
      const dt=lastTime===null?0:Math.max(0,(now-lastTime)/1000);lastTime=now;
      const animated=!state.paused&&!['image','signal'].includes(state.source);
      if(animated)state.time+=Math.min(dt,.1);
      if((dirty||animated)&&now-lastDraw>=1000/30-1){render();lastDraw=now;}
    }
    requestAnimationFrame(frame);
  }
  window.typeLight={
    snapshot:()=>({...state,rows,glyphs:[...glyphs],levels:[...levels],cells:indices.length}),
    getText:text,
    renderAt:seconds=>{state.time=seconds;render();},
    printDataURL:()=>{if(dirty)render();return printCanvas.toDataURL('image/png');}
  };
  calibrate();resize();syncControls();render();requestAnimationFrame(frame);
})();
