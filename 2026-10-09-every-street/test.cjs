const assert=require('node:assert/strict');
const {MAPS,solve,summarize,graphInfo}=require('./engine.js');

// Independent state-space shortest walk: (junction, delivered-street mask).
// This does not use odd matching or Euler circuits and checks global optimality.
function bruteMinimum(g){
  const full=(1<<g.edges.length)-1, distances=new Map(),queue=[{at:g.start,mask:0,cost:0}];
  distances.set(g.start+':0',0);
  while(queue.length){
    queue.sort((a,b)=>b.cost-a.cost);const s=queue.pop(),key=s.at+':'+s.mask;
    if(s.cost!==distances.get(key))continue;
    if(s.at===g.start&&s.mask===full)return s.cost;
    g.edges.forEach((e,i)=>{
      const to=e.a===s.at?e.b:e.b===s.at?e.a:null;if(!to)return;
      const mask=s.mask|(1<<i),cost=s.cost+e.meters,k=to+':'+mask;
      if(cost<(distances.get(k)??Infinity)){distances.set(k,cost);queue.push({at:to,mask,cost});}
    });
  }
}
for(const g of MAPS){
  const best=solve(g),s=summarize(g,best.nodes);
  assert(s.complete,g.id+' must finish at the depot with all streets served');
  assert.equal(s.distance,best.total);assert.equal(s.extra,best.extra);
  assert.equal(best.total,bruteMinimum(g),g.id+' must be globally shortest');
  assert.equal(best.odd.length%2,0);
  assert.equal(best.edges.length,best.nodes.length-1);
  best.edges.forEach((id,i)=>{const e=g.edges.find(e=>e.id===id);assert([e.a,e.b].includes(best.nodes[i])&&[e.a,e.b].includes(best.nodes[i+1]));});
  for(const n of g.nodes){
    const augmented=graphInfo(g).adjacency[n.id].length+g.edges.filter(e=>e.a===n.id||e.b===n.id).reduce((x,e)=>x+best.duplicateCounts[e.id],0);
    assert.equal(augmented%2,0,'every augmented degree is even');
  }
  console.log(g.id,JSON.stringify({streets:best.base,retracing:best.extra,total:best.total,odd:best.odd,pairs:best.pairs.map(p=>p.nodes.join('→'))}));
}
assert.equal(solve(MAPS[1]).extra,0);
const outAndBack=summarize(MAPS[0],['A','B','A']);
assert.equal(outAndBack.delivered,1);assert.equal(outAndBack.distance,240);assert.equal(outAndBack.extra,120);assert(!outAndBack.complete);
assert.throws(()=>summarize(MAPS[0],['A','I']),/existing street/);
assert.throws(()=>summarize(MAPS[0],['B']),/post office/);
const disconnected={nodes:[{id:'A'},{id:'B'}],edges:[],start:'A'};
assert.throws(()=>solve(disconnected),/connected/);
// A weighted bridge must be walked twice, even when a visual layout suggests a shortcut.
const bridge={nodes:[{id:'A'},{id:'B'},{id:'C'}],start:'A',edges:[{id:'AB',a:'A',b:'B',meters:7},{id:'BC',a:'B',b:'C',meters:19}]};
assert.equal(solve(bridge).total,52);assert(summarize(bridge,solve(bridge).nodes).complete);
console.log('All exact-route checks passed.');
