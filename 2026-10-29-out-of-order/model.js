(function(root){
  const scenarios = {even:{a:2.4,b:2.4,loss:false},detour:{a:1.5,b:4.8,loss:false},missing:{a:1.5,b:4.8,loss:true}};
  function create(message='HELLO FROM THE OTHER SIDE',scenario='detour',retry=true){
    const chars=Array.from(message.trim() || 'HELLO FROM THE OTHER SIDE').slice(0,36);
    const count=Math.min(6,chars.length), chunks=[];
    for(let i=0;i<count;i++) chunks.push(chars.slice(Math.floor(i*chars.length/count),Math.floor((i+1)*chars.length/count)).join(''));
    const config=scenarios[scenario] || scenarios.detour;
    const packets=chunks.map((text,i)=>({id:i+1,text,lane:i%2,departure:i*.55,duration:i%2?config.b:config.a,lost:config.loss&&i===1}));
    const events=packets.filter(p=>!p.lost).map(p=>({id:p.id,time:p.departure+p.duration,retry:false}));
    if(config.loss&&retry&&packets.length>1) events.push({id:2,time:8.05,retry:true});
    events.sort((a,b)=>a.time-b.time||a.id-b.id);
    return {message:chars.join(''),packets,events,scenario,retry,end:Math.max(9,...events.map(e=>e.time+1))};
  }
  function at(run,time){
    const arrivals=run.events.filter(e=>e.time<=time), received=new Set(arrivals.map(e=>e.id));
    let count=0; while(received.has(count+1)) count++;
    const delivered=run.packets.slice(0,count).map(p=>p.text).join('');
    const buffered=[...received].filter(id=>id>count).sort((a,b)=>a-b);
    return {arrivals,received:[...received],count,delivered,buffered,complete:count===run.packets.length};
  }
  root.PacketModel={create,at,scenarios};
  if(typeof module!=='undefined') module.exports=root.PacketModel;
})(typeof window!=='undefined'?window:globalThis);
