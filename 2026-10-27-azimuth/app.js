const $=s=>document.querySelector(s), M=TapeModel;
const state={angle:.4,record:0,speed:M.SLOW,reference:false,playing:false,mystery:0};
let audio,master,osc,timer;
function err(){return state.reference?0:state.angle-state.record}
function canvas(id){const c=$(id),r=c.getBoundingClientRect(),d=devicePixelRatio||1;c.width=r.width*d;c.height=r.height*d;const g=c.getContext('2d');g.scale(d,d);return {g,w:r.width,h:r.height}}
function text(g,s,x,y,color='#71766f',size=10){g.fillStyle=color;g.font=`${size}px monospace`;g.fillText(s,x,y)}
function draw(){
  let {g,w,h}=canvas('#tape');g.fillStyle='#d4d9cd';g.fillRect(0,0,w,h);
  const top=49,bottom=h-49,cx=w*.46,vis=35*Math.PI/180,rec=Math.tan(state.record*vis),head=Math.tan((state.reference?state.record:state.angle)*vis);
  g.fillStyle='#b9baa9';g.fillRect(0,top,w,bottom-top);
  g.save();g.beginPath();g.rect(0,top,w,bottom-top);g.clip();
  for(let x=-200;x<w+200;x+=24){g.strokeStyle='#bd674b';g.lineWidth=7;g.beginPath();g.moveTo(x-(top-h/2)*rec,top);g.lineTo(x-(bottom-h/2)*rec,bottom);g.stroke()}
  g.fillStyle='#365e6533';g.beginPath();g.moveTo(cx-(top-h/2)*head-18,top-15);g.lineTo(cx-(top-h/2)*head+18,top-15);g.lineTo(cx-(bottom-h/2)*head+18,bottom+15);g.lineTo(cx-(bottom-h/2)*head-18,bottom+15);g.fill();
  g.strokeStyle='#284e56';g.lineWidth=5;g.beginPath();g.moveTo(cx-(top-h/2)*head,top);g.lineTo(cx-(bottom-h/2)*head,bottom);g.stroke();g.restore();
  text(g,'TAPE TRAVEL →',22,28);text(g,'GAP',cx-10,h-16,'#365e65');text(g,'PHASES ACROSS THE GAP',w-205,28);
  const baseX=w-170,amplitude=39;
  for(let i=0;i<7;i++){const y=top+13+i*(bottom-top-26)/6;const phase=(i/6-.5)*2*Math.PI*10000*M.WIDTH*Math.tan(err()*Math.PI/180)/state.speed;const x=baseX+Math.cos(phase)*amplitude,yy=y-Math.sin(phase)*9;g.strokeStyle='#365e65';g.lineWidth=1.5;g.beginPath();g.moveTo(baseX,y);g.lineTo(x,yy);g.stroke();g.fillStyle='#365e65';g.beginPath();g.arc(x,yy,3,0,7);g.fill()}
  ({g,w,h}=canvas('#response'));const left=46,right=w-24,topY=15,bottomY=h-32;const xFor=f=>left+Math.log(f/100)/Math.log(150)*(right-left),yFor=db=>topY+Math.min(48,-db)/48*(bottomY-topY);
  for(const db of [0,-12,-24,-36,-48]){const y=yFor(db);g.strokeStyle='#c7cbc0';g.lineWidth=1;g.beginPath();g.moveTo(left,y);g.lineTo(right,y);g.stroke();text(g,`${db}`,12,y+4)}
  for(const f of [100,1000,5000,15000])text(g,f<1000?`${f}`:`${f/1000}k`,xFor(f)-8,h-10);
  g.strokeStyle='#365e65';g.setLineDash([4,4]);g.beginPath();g.moveTo(left,topY);g.lineTo(right,topY);g.stroke();g.setLineDash([]);g.strokeStyle='#c55731';g.lineWidth=2;g.beginPath();
  for(let i=0;i<=600;i++){const f=100*Math.pow(150,i/600),x=xFor(f),y=yFor(M.db(f,err(),state.speed));i?g.lineTo(x,y):g.moveTo(x,y)}g.stroke();
}
function update(){
  $('#angle-value').textContent=`${state.angle>=0?'+':''}${state.angle.toFixed(3)}°`;
  for(const [id,f] of [['low',1000],['mid',5000],['high',10000]])$( '#'+id).textContent=`${M.db(f,err(),state.speed).toFixed(1)} dB`;
  const aligned=Math.abs(err())<.015;
  $('#status-tag').textContent=state.reference?'ALIGNED REFERENCE':aligned?'IN ALIGNMENT':'OUT OF ALIGNMENT';
  $('#status-title').textContent=aligned?'The top end is back.':'The top end disappears.';
  $('#status-copy').textContent=aligned?'The gap meets the recorded wavefront together. Short wavelengths survive the sum.':'Different parts of the gap read different phases. Turn the head until the orange curve reaches the dashed line.';
  $('#compare').setAttribute('aria-pressed',state.reference);$('#compare').textContent=state.reference?'Return to your adjustment':'Hold up an aligned reference';
  $('#listen').textContent=state.playing?'■ Stop listening':'▶ Listen to the tape';
  $('#slow').setAttribute('aria-pressed',state.speed===M.SLOW);$('#fast').setAttribute('aria-pressed',state.speed!==M.SLOW);
  if(audio&&state.playing)voice();draw();
}
function voice(){
  if(osc){osc.stop();osc.disconnect()}
  const n=80,real=new Float32Array(n),imag=new Float32Array(n);const fundamental=196;
  for(let i=1;i<n;i++)imag[i]=Math.pow(i,-.85)*M.response(fundamental*i,err(),state.speed);
  osc=audio.createOscillator();osc.setPeriodicWave(audio.createPeriodicWave(real,imag,{disableNormalization:true}));osc.frequency.value=fundamental;osc.connect(master);osc.start();
}
async function toggleAudio(){
  if(!audio){audio=new AudioContext();master=audio.createGain();master.gain.value=0;master.connect(audio.destination)}
  await audio.resume();state.playing=!state.playing;
  if(state.playing){voice();const pluck=()=>{const t=audio.currentTime;master.gain.cancelScheduledValues(t);master.gain.setTargetAtTime(.09,t,.015);master.gain.setTargetAtTime(.003,t+.09,.2)};pluck();timer=setInterval(pluck,650)}else{clearInterval(timer);master.gain.setTargetAtTime(0,audio.currentTime,.03)}update();
}
$('#angle').addEventListener('input',e=>{state.angle=+e.target.value;state.reference=false;update()});
$('#listen').onclick=toggleAudio;$('#compare').onclick=()=>{state.reference=!state.reference;update()};
for(const [id,speed] of [['slow',M.SLOW],['fast',M.SLOW*2]])$('#'+id).onclick=()=>{state.speed=speed;update()};
$('#new-tape').onclick=()=>{const choices=[-.175,.235,-.31,.085];state.record=choices[state.mystery++%choices.length];state.reference=false;$('#tape-note').textContent=`Mystery tape ${state.mystery} · recording angle hidden. Tune for the flattest response.`;update()};
window.addEventListener('resize',draw);window.addEventListener('pagehide',()=>{clearInterval(timer);if(audio)audio.close()});
window.azimuth={state,update,err};update();
