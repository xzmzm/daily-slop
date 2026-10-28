const $=s=>document.querySelector(s), M=PacketModel;
let run=M.create(),time=0,playing=!matchMedia('(prefers-reduced-motion: reduce)').matches,manual=false,last=0;
const esc=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function point(p){const nodes=p.lane?[[110,175],[270,270],[730,270],[890,175]]:[[110,175],[270,80],[730,80],[890,175]];const t=Math.max(0,Math.min(.99999,p.progress))*3,i=Math.floor(t),u=t-i;return[nodes[i][0]*(1-u)+nodes[i+1][0]*u,nodes[i][1]*(1-u)+nodes[i+1][1]*u];}
function render(){
 const state=M.at(run,time);$('#clock').textContent=`${time.toFixed(2).padStart(5,'0')} s`;$('#timeline').max=run.end;$('#timeline').value=time;$('#end-time').textContent=`${run.end.toFixed(1)} s`;
 $('#play').textContent=playing?'Ⅱ Pause':'▶ Play';$('#play').setAttribute('aria-label',playing?'Pause animation':'Play animation');
 document.querySelectorAll('[data-scene]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.scene===run.scenario));
 let visuals='';for(const p of run.packets){const progress=(time-p.departure)/p.duration;if(progress>=0&&progress<1&&(!p.lost||progress<.53)){const[x,y]=point({...p,progress});visuals+=`<g class="packet ${p.lane?'lane-b':''}" transform="translate(${x} ${y})"><rect x="-20" y="-17" width="40" height="34" rx="5"/><text text-anchor="middle" y="5">${p.id}</text></g>`;}if(p.lost&&progress>=.53&&time<6.55)visuals+='<text class="lost-mark" x="500" y="279" text-anchor="middle">×</text>';}
 if(run.scenario==='missing'&&run.retry&&run.packets.length>1&&time>=6.55&&time<8.05){const[x,y]=point({lane:0,progress:(time-6.55)/1.5});visuals+=`<g class="packet retry-packet" transform="translate(${x} ${y})"><rect x="-24" y="-17" width="48" height="34" rx="5"/><text y="5" text-anchor="middle">2↶</text></g>`;}
 $('#packets').innerHTML=visuals;
 $('#map-note').textContent=state.complete?'ALL PIECES HOME.':state.buffered.length?`WAITING FOR PIECE ${state.count+1}`:time<.1?'ONE MESSAGE. A FEW LITTLE TRIPS.':'';
 $('#arrival-count').textContent=`${state.arrivals.length} / ${run.packets.length}`;
 $('#arrival-strip').innerHTML=Array.from({length:run.packets.length},(_,i)=>{const e=state.arrivals[i];return e?`<div class="arrival ${e.id>state.count?'waiting':''}"><strong>${String(e.id).padStart(2,'0')}${e.retry?' ↶':''}</strong><span>${esc(run.packets[e.id-1].text)}</span></div>`:`<div class="arrival empty"><strong>··</strong><span>—</span></div>`;}).join('');
 $('#buffer-count').textContent=`${state.buffered.length} piece${state.buffered.length===1?'':'s'} waiting`;
 $('#message-output').innerHTML=`${esc(state.delivered)}<span class="unread">${'·'.repeat(Array.from(run.message.slice(state.delivered.length)).length)}</span>`;
 const status=state.complete?'Complete. Every piece is back in sequence.':state.buffered.length?`Piece ${state.count+1} is missing. Later pieces stay in the receiver’s buffer.`:time>6&&!run.retry&&run.scenario==='missing'?'No retry: the missing piece leaves the message unfinished.':'The receiver releases only an unbroken sequence, starting at piece 1.';
 if($('#status').textContent!==status)$('#status').textContent=status;
}
function send(scene=run.scenario){run=M.create($('#message').value,scene,$('#retry').checked);time=0;playing=!matchMedia('(prefers-reduced-motion: reduce)').matches;render();}
function advance(ms){if(playing){time=Math.min(run.end,time+ms/1000);if(time>=run.end)playing=false;}render();}
$('#play').onclick=()=>{if(time>=run.end)time=0;playing=!playing;render();};$('#restart').onclick=()=>{time=0;playing=true;render();};$('#timeline').oninput=e=>{time=+e.target.value;playing=false;render();};$('#send').onclick=()=>send();$('#message').onkeydown=e=>{if(e.key==='Enter')send();};$('#retry').onchange=()=>send();document.querySelectorAll('[data-scene]').forEach(b=>b.onclick=()=>send(b.dataset.scene));
function tick(now){if(!manual)advance(Math.min(now-last,100));last=now;requestAnimationFrame(tick);}requestAnimationFrame(tick);render();
window.packetTrip={advance,setRecordingClock(value){manual=value;},seek(value){time=Math.max(0,Math.min(run.end,value));render();},get state(){return {...M.at(run,time),time,playing,run};}};
