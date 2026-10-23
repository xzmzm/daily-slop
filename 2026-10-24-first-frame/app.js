/* A rectilinear camera looking at a sphere. Distances are kilometres. */
(() => {
'use strict';
const R=6371, rad=Math.PI/180;
const canvas=document.querySelector('#scene'), ctx=canvas.getContext('2d');
const state={altitude:105,fov:90,guide:false};
function geometry(h){return {dip:Math.acos(R/(R+h))/rad,distance:Math.sqrt(h*(2*R+h))};}
function rayHit(dx,dy,dz,h){
 const a=dx*dx+dy*dy+dz*dz,b=(R+h)*dy,c=h*(2*R+h),d=b*b-a*c;
 if(d<0)return null;
 const t=(-b-Math.sqrt(d))/a;
 return t>0?[t*dx,R+h+t*dy,t*dz]:null;
}
const W=800,H=360, buffer=document.createElement('canvas');buffer.width=W;buffer.height=H;
const bc=buffer.getContext('2d');
function hash(x,z){let n=Math.imul(x,374761393)^Math.imul(z,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;}
function field(x,z){const a=Math.floor(x),b=Math.floor(z);let u=x-a,v=z-b;u=u*u*(3-2*u);v=v*v*(3-2*v);return (hash(a,b)*(1-u)+hash(a+1,b)*u)*(1-v)+(hash(a,b+1)*(1-u)+hash(a+1,b+1)*u)*v;}
function noise(x,z){return field(x*.008,z*.008)*.62+field(x*.021+9,z*.021)*.25+field(x*.06,z*.06+7)*.13;}

function render(){
 const {altitude:h,fov,guide}=state,g=geometry(h),pitch=(g.dip+7)*rad;
 const cp=Math.cos(pitch),sp=Math.sin(pitch),scale=Math.tan(fov*rad/2);
 const image=bc.createImageData(W,H),pixels=image.data;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const u=(2*(x+.5)/W-1)*scale,v=(1-2*(y+.5)/H)*scale*H/W;
  const dy=-sp+v*cp,dz=cp+v*sp,hit=rayHit(u,dy,dz,h);
  const grain=hash(x+19,y+71)-0.5;
  let light;
  if(hit){
   const [px,py,pz]=hit;
   const sx=px,sz=pz;
   const cloud=noise(sx+420,sz-190),terrain=noise(sx*.33-200,sz*.38);
   const haze=Math.pow(1-Math.max(0,(-hit[0]*u-hit[1]*dy-hit[2]*dz)/(Math.hypot(u,dy,dz)*R)),2);
   light=cloud>.49?130+Math.min(100,(cloud-.49)*400):45+terrain*40+cloud*25;
   light+=haze*12;
  }else{
   const elevation=Math.atan2(dy,Math.hypot(u,dz))/rad;
   light=9+24*Math.exp(-Math.max(0,elevation+g.dip)/2.5);
  }
  const edge=Math.pow((x/W-.5)*2,2)+Math.pow((y/H-.5)*2,2);
  light=Math.max(0,Math.min(255,light+grain*15-edge*13));
  const i=(y*W+x)*4;pixels[i]=light;pixels[i+1]=light*1.02;pixels[i+2]=light*.94;pixels[i+3]=255;
 }
 bc.putImageData(image,0,0);ctx.drawImage(buffer,0,0,canvas.width,canvas.height);
 if(guide){
  // Tangent at the centre of the projected limb, not the local horizontal.
  const v=Math.tan(7*rad),yy=canvas.height/2-v/(2*scale)*canvas.width;
  ctx.strokeStyle='#e58252';ctx.lineWidth=2;ctx.setLineDash([10,9]);ctx.beginPath();ctx.moveTo(0,yy);ctx.lineTo(canvas.width,yy);ctx.stroke();ctx.setLineDash([]);
  ctx.font='13px monospace';ctx.fillStyle='#ffc29c';ctx.fillText('TANGENT AT CENTRE OF LIMB',22,yy-14);
 }
 document.querySelector('#alt-value').innerHTML=`${h.toLocaleString('en-US')} <small>km</small>`;
 document.querySelector('#stamp').textContent=`${h.toLocaleString('en-US')} KM`;
 document.querySelector('#fov-value').textContent=fov+'°';
 document.querySelector('#dip').textContent=g.dip.toFixed(2)+'°';
 document.querySelector('#distance').textContent=Math.round(g.distance).toLocaleString('en-US')+' km';
 document.querySelector('#observation').textContent=h<30?'The curve is subtle from an airliner. Widen the lens and use the tangent guide to find it.':h<180?'Space is close. The whole Earth is still much too big to fit in this frame.':h<2000?'Higher up, more of the surface slips into view. The horizon falls farther below horizontal.':'Now the planet can fit in a wide frame. Try a narrow lens: the crop changes, the Earth does not.';
 document.querySelectorAll('[data-alt]').forEach(b=>b.classList.toggle('active',+b.dataset.alt===h));
 document.querySelector('#guide').setAttribute('aria-pressed',guide);
 document.querySelector('#guide').textContent=guide?'− Hide tangent guide':'+ Show tangent guide';
}
const altitude=document.querySelector('#altitude');
function setAltitude(h){state.altitude=h;altitude.value=Math.log(h/10)/Math.log(3600)*1000;render();}
altitude.addEventListener('input',()=>{state.altitude=Math.round(10*Math.pow(3600,+altitude.value/1000));render();});
document.querySelectorAll('[data-alt]').forEach(b=>b.addEventListener('click',()=>setAltitude(+b.dataset.alt)));
document.querySelector('#fov').addEventListener('input',e=>{state.fov=+e.target.value;render();});
document.querySelector('#guide').addEventListener('click',()=>{state.guide=!state.guide;render();});
document.querySelector('#save').addEventListener('click',()=>{
 const card=document.createElement('canvas');card.width=1100;card.height=630;const c=card.getContext('2d');
 c.fillStyle='#eeeade';c.fillRect(0,0,1100,800);c.drawImage(canvas,50,40,1000,450);
 c.fillStyle='#272a23';c.font='30px monospace';c.fillText('FIRST FRAME / '+state.altitude.toLocaleString('en-US')+' KM',50,546);
 c.font='14px monospace';c.fillText(`${state.fov}° FIELD OF VIEW · PROCEDURAL EARTH · 24 OCT 2026`,50,584);
 const a=document.createElement('a');a.download=`first-frame-${state.altitude}km.png`;a.href=card.toDataURL('image/png');a.click();
});
window.firstFrame={state,geometry,rayHit,setAltitude,render};setAltitude(105);
})();
