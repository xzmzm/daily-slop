(()=>{'use strict';const $=s=>document.querySelector(s),M=SpillModel;
const state={vent:6,time:12,playing:false,live:true},reference=M.trajectory(0);let custom=M.trajectory(6);
const colors=['#d05c3d','#167c77'];
function canvas(id){const c=$(id),r=c.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);c.width=Math.round(r.width*d);c.height=Math.round(r.height*d);const ctx=c.getContext('2d');ctx.scale(d,d);return {c:ctx,w:r.width,h:r.height};}
function text(c,s,x,y,size=10,color='#617b72',align='left'){c.fillStyle=color;c.font=`${size}px Arial`;c.textAlign=align;c.fillText(s,x,y);}
function line(c,x,y,xx,yy,color,width=1){c.beginPath();c.moveTo(x,y);c.lineTo(xx,yy);c.strokeStyle=color;c.lineWidth=width;c.stroke();}
function chute(c,x,y,angle,vent,color,scale,t,landed){
 c.save();c.translate(x,y);c.scale(scale,scale);c.rotate(angle);const r=62,hole=r*Math.sqrt(vent/100);
 // Air paths rise relative to the descending canopy. At the crown they form a jet.
 if(!landed)for(let i=-2;i<=2;i++){const xx=i*22,shift=(t*22+i*7)%28;c.strokeStyle=color+'48';c.lineWidth=1;c.beginPath();c.moveTo(xx,36+shift);c.quadraticCurveTo(xx*1.2,12,xx*1.4,-3);c.stroke();}
 c.beginPath();c.moveTo(-r,0);c.bezierCurveTo(-r,-69,r,-69,r,0);c.quadraticCurveTo(0,-17,-r,0);c.fillStyle=color;c.fill();
 for(let i=-2;i<=2;i++){const xx=i*22;c.beginPath();c.moveTo(xx,0);c.quadraticCurveTo(xx*.8,-43,0,-52);c.strokeStyle='#fff5';c.lineWidth=1;c.stroke();}
 if(vent>0){c.beginPath();c.ellipse(0,-49,hole,Math.max(3,hole*.20),0,0,Math.PI*2);c.fillStyle='#dfebe4';c.fill();if(!landed){line(c,0,-56,0,-90,color,2);line(c,0,-90,-4,-83,color,2);line(c,0,-90,4,-83,color,2);}}
 for(let xx=-60;xx<=60;xx+=24)line(c,xx,0,xx*.17,79,'#536961',.8);
 c.fillStyle='#a77d50';c.fillRect(-14,77,28,23);for(let yy=80;yy<100;yy+=5)line(c,-14,yy,14,yy,'#755b3e',1);c.fillStyle='#233d3e';c.beginPath();c.arc(0,67,4,0,Math.PI*2);c.fill();line(c,0,71,0,80,'#233d3e',4);c.restore();
}
function drawSky(){const {c,w,h}=canvas('#sky'),top=142,bottom=h-48,range=bottom-top;
 c.setLineDash([2,5]);line(c,w/2,0,w/2,h,'#bacfc2');c.setLineDash([]);
 for(let level=0;level<=120;level+=30){const y=top+(120-level)/120*range;line(c,18,y,w-18,y,'#c7d9ce');text(c,level+' m',w/2+8,y-6,9);}
 const sc=Math.min(1,w/520);[reference,custom].forEach((track,i)=>{const s=M.at(track,state.time),x=w*(i?.75:.25),y=top+(120-s.height)/120*range;
 chute(c,x,y-85*sc,s.angle,state.vent*(i===1),colors[i],sc,state.time,s.height<.01);
 const tag=s.height<.01?'LANDED':`${s.height.toFixed(0)} m  /  ${s.v.toFixed(1)} m/s`;
 text(c,tag,x,h-15,10,colors[i],'center');
 });text(c,'120 m COMPARISON DROP · CANOPIES ALREADY OPEN',20,23,8);}
function drawChart(){const {c,w,h}=canvas('#chart'),mid=h/2,max=60;line(c,0,mid,w,mid,'#b9c5b9');
 [reference,custom].forEach((track,j)=>{c.beginPath();track.samples.forEach((s,i)=>{if(s.t>state.time)return;const x=s.t/30*w,y=mid-s.angle*180/Math.PI/max*(h/2-5);if(i===0)c.moveTo(x,y);else c.lineTo(x,y);});c.strokeStyle=colors[j];c.lineWidth=j?2:1.5;c.stroke();});
 line(c,state.time/30*w,0,state.time/30*w,h,'#8c9e90');text(c,'+60°',2,9,8);text(c,'−60°',2,h-2,8);}
function render(){drawSky();drawChart();$('#time').value=state.time;$('#time-value').value=state.time.toFixed(1)+' s';$('#play').textContent=state.playing?'Pause Ⅱ':state.time>=30?'Replay ↗':'Play descent ↗';}
function setVent(value){state.vent=Math.max(0,Math.min(20,Number(value)||0));custom=M.trajectory(state.vent);$('#vent').value=state.vent;$('#vent-value').innerHTML=state.vent+'<span>%</span>';$('#lane-vent').textContent=state.vent+'% vent area';document.querySelectorAll('[data-vent]').forEach(b=>b.setAttribute('aria-pressed',Number(b.dataset.vent)===state.vent));
 const speed=(custom.vt/reference.vt-1)*100,rock=(1-custom.rms/reference.rms)*100;const rockLabel=rock>99?rock.toFixed(1):rock.toFixed(0);
 $('#speed').textContent=custom.vt.toFixed(2)+' m/s';$('#speed-change').textContent=`${speed.toFixed(0)}% faster than sealed`;
 $('#rock').textContent=custom.rms.toFixed(1)+'° RMS';$('#rock-change').textContent=`${rockLabel}% less than sealed`;
 $('#observation').textContent=state.vent===0?'No cut, no difference. The two tracks sit on top of each other. Try a small vent.':`A ${state.vent}% opening gives ${rockLabel}% less rocking in this model, with ${speed.toFixed(0)}% more terminal speed. ${state.vent>=15?'A steadier ride can still be a faster arrival.':'The escape route through the crown makes the difference.'}`;render();}
function setTime(t){state.time=Math.max(0,Math.min(30,t));render();}
function advance(dt){if(!state.playing)return;setTime(state.time+dt);if(state.time>=30){state.playing=false;render();}}
$('#vent').addEventListener('input',e=>setVent(e.target.value));document.querySelectorAll('[data-vent]').forEach(b=>b.addEventListener('click',()=>setVent(b.dataset.vent)));
$('#time').addEventListener('input',e=>{state.playing=false;setTime(+e.target.value)});$('#reset').addEventListener('click',()=>{state.playing=false;setTime(0)});
$('#play').addEventListener('click',()=>{if(matchMedia('(prefers-reduced-motion: reduce)').matches){state.playing=false;setTime(30);return;}if(state.time>=30)state.time=0;state.playing=!state.playing;render();});
let last=performance.now();function tick(now){const dt=Math.min(.05,(now-last)/1000);last=now;if(state.live&&state.playing)advance(dt);requestAnimationFrame(tick);}requestAnimationFrame(tick);new ResizeObserver(render).observe($('.experiment'));window.addEventListener('resize',render);
window.spillHole={state,setVent,setTime,advance,render,setLive:v=>state.live=v,getStats:()=>({vent:state.vent,time:state.time,speed:custom.vt,rocking:custom.rms,referenceRocking:reference.rms,landing:custom.landing,left:M.at(reference,state.time),right:M.at(custom,state.time)})};setVent(6);
})();
