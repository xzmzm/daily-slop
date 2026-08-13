(function () {
  "use strict";
  const E = window.TailGambit;
  const $ = (id) => document.getElementById(id);
  const canvas = $("scene");
  const ctx = canvas.getContext("2d");
  const scope = $("scope");
  const sctx = scope.getContext("2d");
  let species = "gecko", phase = "ready", startedAt = 0, releaseTime = null;
  let detachedAt = null, resolved = null, trial = 1, last = performance.now();
  const CONTACT = 2.4;
  const notes = {
    gecko: "A costly wager: the tail is a large energy store, but its vigorous decoy buys a broad timing window.",
    skink: "The bright tail advertises the disposable target. Fast fracture, fierce motion, and a narrower window.",
    anole: "Less energy is stored in the tail, but the gentler decoy asks for earlier commitment and patient regrowth.",
  };

  function fit(c, context) {
    const r = c.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    if (c.width !== Math.round(r.width*dpr) || c.height !== Math.round(r.height*dpr)) {
      c.width=Math.round(r.width*dpr); c.height=Math.round(r.height*dpr);
    }
    context.setTransform(dpr,0,0,dpr,0,0); return {w:r.width,h:r.height};
  }
  function lizard(context,x,y,scale,t,tailOn,alpha=1) {
    context.save(); context.translate(x,y); context.scale(scale,scale); context.globalAlpha=alpha;
    const moving=phase==="running" || phase==="resolved"; const gait=moving?Math.sin(t*11):0;
    context.strokeStyle="#080b08";context.lineCap="round";context.lineJoin="round";
    context.lineWidth=8; [[-12,-4,-31,-19-gait*3],[-7,7,-27,24+gait*3],[13,-4,31,-17+gait*3],[16,7,36,20-gait*3]].forEach(p=>{context.beginPath();context.moveTo(p[0],p[1]);context.lineTo(p[2],p[3]);context.stroke()});
    context.fillStyle=species==="skink"?"#3b8788":species==="anole"?"#76a548":"#a67c43";
    context.beginPath();context.ellipse(0,0,31,14,0,0,Math.PI*2);context.fill();
    context.beginPath();context.ellipse(30,-1,14,11,-.08,0,Math.PI*2);context.fill();
    context.fillStyle="#d8f065";context.beginPath();context.arc(36,-5,2.4,0,7);context.fill();
    context.fillStyle="#0d100c";context.beginPath();context.arc(36.5,-5,1,0,7);context.fill();
    if(tailOn){context.strokeStyle=species==="skink"?"#55b8ca":species==="anole"?"#6f9845":"#9c7240";context.lineWidth=11;context.beginPath();context.moveTo(-25,0);context.bezierCurveTo(-50,2+gait,-74,16-gait,-105,8);context.stroke()}
    context.restore();
  }
  function detachedTail(context,x,y,scale,age){
    context.save();context.translate(x,y);context.scale(scale,scale);context.strokeStyle=species==="skink"?"#55b8ca":species==="anole"?"#6f9845":"#9c7240";context.lineCap="round";context.lineWidth=11;
    context.beginPath();context.moveTo(0,0);for(let i=1;i<=8;i++){const px=-i*12, py=E.tailWave(i,age,species)*13;context.lineTo(px,py)}context.stroke();context.restore();
  }
  function predator(context,x,y,scale,open){
    context.save();context.translate(x,y);context.scale(scale,scale);context.fillStyle="#121512";
    context.beginPath();context.moveTo(4,-29);context.lineTo(-8,-7);context.quadraticCurveTo(-34,0,-12,12);context.lineTo(4,31);context.quadraticCurveTo(7,11,19,8);context.lineTo(45,21);context.lineTo(29,3);context.lineTo(48,-15);context.lineTo(17,-5);context.quadraticCurveTo(7,-10,4,-29);context.fill();
    context.strokeStyle="#ff7549";context.lineWidth=2;context.beginPath();context.moveTo(17,-5);context.lineTo(38,open?10:-1);context.stroke();context.fillStyle="#ff7549";context.beginPath();context.arc(16,-9,2.2,0,7);context.fill();context.restore();
  }
  function draw(now) {
    const {w,h}=fit(canvas,ctx); ctx.clearRect(0,0,w,h); let elapsed=0;
    if(phase==="running" || phase==="resolved") elapsed=Number.isFinite(window.__tailVideoClock)?window.__tailVideoClock:(now-startedAt)/1000;
    const progress=E.clamp(elapsed/CONTACT,0,1); const detach=releaseTime!==null && elapsed>=releaseTime+E.strategy(species).fractureDelay;
    const after=Math.max(0,elapsed-CONTACT); let lx=w*.71 + (phase==="resolved"?after*w*.16:0); if(!detach && phase==="resolved" && resolved?.outcome!=="escaped")lx=w*.71;
    const ly=h*.59; lizard(ctx,lx,ly,Math.min(w/880,1.08),elapsed,!detach,phase==="resolved"&&resolved?.outcome!=="escaped"?Math.max(.2,1-after*.65):1);
    if(detach) detachedTail(ctx,w*.71-34,ly,Math.min(w/880,1.08),elapsed-detachedAt);
    const px=w*(.07 + .53*progress); predator(ctx,px,h*.52,Math.min(w/820,1.1),progress>.82);
    ctx.strokeStyle="rgba(200,240,74,.24)";ctx.setLineDash([5,6]);ctx.beginPath();ctx.moveTo(w*.71,ly+42);ctx.lineTo(w*.71,h-35);ctx.stroke();ctx.setLineDash([]);
    drawScope(elapsed,detach);
    if(phase==="running"){
      $("timer").textContent=Math.max(0,CONTACT-elapsed).toFixed(2)+" s";$("timefill").style.width=(progress*100)+"%";
      if(elapsed>=CONTACT && !resolved) finish();
    }
    requestAnimationFrame(draw); last=now;
  }
  function drawScope(t,active){
    const {w,h}=fit(scope,sctx);sctx.clearRect(0,0,w,h);sctx.strokeStyle="#282d27";sctx.lineWidth=1;for(let y=15;y<h;y+=15){sctx.beginPath();sctx.moveTo(0,y);sctx.lineTo(w,y);sctx.stroke()}
    [0,1,2].forEach((seg,j)=>{sctx.strokeStyle=["#c8f04a","#71d5c2","#ff7549"][j];sctx.lineWidth=1.4;sctx.beginPath();for(let x=0;x<w;x++){const age=active?Math.max(0,t-(detachedAt||0)) + (x-w)/80:x/80;const y=h/2 + E.tailWave(seg,Math.max(0,age),species)*15;if(x===0)sctx.moveTo(x,y);else sctx.lineTo(x,y)}sctx.stroke()});
  }
  function start(){phase="running";startedAt=performance.now();if(Number.isFinite(window.__tailVideoClock))window.__tailVideoClock=0;releaseTime=null;detachedAt=null;resolved=null;$("result").hidden=true;$("prompt").textContent="Predator committed. Pick your moment.";$("startBtn").disabled=true;$("dropBtn").disabled=false;$("releaseMark").style.display="none";$("timefill").style.width="0"}
  function drop(){if(phase!=="running"||releaseTime!==null)return;releaseTime=Number.isFinite(window.__tailVideoClock)?window.__tailVideoClock:(performance.now()-startedAt)/1000;detachedAt=releaseTime+E.strategy(species).fractureDelay;$("dropBtn").disabled=true;$("prompt").textContent="Fracture muscles fired — the tail is separating.";$("releaseMark").style.display="block";$("releaseMark").style.left=(releaseTime/CONTACT*100)+"%"}
  function finish(){resolved=E.resolveStrike(releaseTime,CONTACT,species);phase="resolved";$("startBtn").disabled=false;$("startBtn").innerHTML="<span>▶</span> NEW STRIKE";$("dropBtn").disabled=true;const data={escaped:["ESCAPED","The predator takes the moving decoy. You keep the important end."],early:["TOO EARLY","The tail moved, but the predator had time to reacquire the body."],late:["TOO LATE","Fracture finished after contact. The gambit never opened."],missed:["BAD TRADE","The predator noticed the tail, but your timing left too little distraction."],caught:["CAUGHT","No tail was offered before contact."]}[resolved.outcome];$("resultTitle").textContent=data[0];$("resultText").textContent=data[1]+(Number.isFinite(resolved.lead)?` Lead: ${resolved.lead.toFixed(2)} s · decoy score: ${Math.round(resolved.score*100)}%` : "");$("result").hidden=false;$("prompt").textContent="The tail can keep moving after the lizard has gone."; trial++;$("trialNo").textContent=String(trial).padStart(2,"0")}
  function reset(){phase="ready";releaseTime=detachedAt=resolved=null;$("timer").textContent="READY";$("timefill").style.width="0";$("releaseMark").style.display="none";$("result").hidden=true;$("prompt").textContent="Start a strike, then shed as the predator commits.";$("startBtn").disabled=false;$("startBtn").innerHTML="<span>▶</span> START STRIKE";$("dropBtn").disabled=true}
  function setSpecies(key){species=key;document.querySelectorAll("[data-species]").forEach(b=>b.classList.toggle("on",b.dataset.species===key));$("speciesNote").textContent=notes[key];$("daySlider").max=E.strategy(key).regrowDays;$("daySlider").value=0;updateRecovery();reset()}
  function updateRecovery(){const day=+$("daySlider").value,r=E.recovery(day,species);$("dayLabel").textContent=`DAY ${day}`;[["Length",r.length],["Energy",r.energy],["Sprint",r.sprint]].forEach(([name,v])=>{$("bar"+name).style.width=(v*100)+"%";$("val"+name).textContent=Math.round(v*100)+"%"})}
  $("startBtn").onclick=start;$("dropBtn").onclick=drop;$("resetBtn").onclick=reset;$("daySlider").oninput=updateRecovery;$("speciesTabs").onclick=e=>{const b=e.target.closest("button[data-species]");if(b)setSpecies(b.dataset.species)};addEventListener("keydown",e=>{if(e.code==="Space"&&!e.repeat){e.preventDefault();drop()}});setSpecies("gecko");requestAnimationFrame(draw);
})();
