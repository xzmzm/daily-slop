(function (root) {
  'use strict';
  const node = (id, x, y, name = '') => ({ id, x, y, name });
  const edge = (a, b, meters) => ({ id: a + b, a, b, meters });
  const MAPS = [
    { id: 'market', name: 'Market quarter', start: 'A',
      nodes: [node('A',150,105,'Post office'),node('B',440,105,'North gate'),node('C',745,105,'Bookshop'),node('D',150,285,'Orchard'),node('E',440,285,'Market square'),node('F',745,285,'Tea room'),node('G',150,465,'South gate'),node('H',440,465,'Florist'),node('I',745,465,'Clock tower')],
      edges: [edge('A','B',120),edge('B','C',140),edge('D','E',100),edge('E','F',110),edge('G','H',130),edge('H','I',120),edge('A','D',90),edge('D','G',110),edge('B','E',80),edge('E','H',100),edge('C','F',100),edge('F','I',90)] },
    { id: 'canal', name: 'Canal loop', start: 'A',
      nodes: [node('A',150,105,'Post office'),node('B',445,105,'Lock keeper'),node('C',745,105,'East bridge'),node('D',745,465,'Boat house'),node('E',445,465,'Willow walk'),node('F',150,465,'West bridge')],
      edges: [edge('A','B',120),edge('B','C',140),edge('C','D',180),edge('D','E',130),edge('E','F',110),edge('F','A',160)] },
    { id: 'gardens', name: 'Garden ends', start: 'A',
      nodes: [node('A',150,105,'Post office'),node('B',430,105,'Garden gate'),node('C',740,105,'Potting shed'),node('D',150,285,'Orchard'),node('E',430,285,'Fountain'),node('F',740,285,'Rose beds'),node('G',150,465,'Glasshouse'),node('H',430,465,'South gate'),node('I',740,465,'Apiary')],
      edges: [edge('A','B',120),edge('A','D',90),edge('D','E',110),edge('B','E',80),edge('B','C',130),edge('E','F',140),edge('D','G',100),edge('E','H',90),edge('H','I',120)] }
  ];
  function graphInfo(graph) {
    const adjacency = Object.fromEntries(graph.nodes.map(n => [n.id, []]));
    for (const e of graph.edges) {
      if (!adjacency[e.a] || !adjacency[e.b] || !Number.isFinite(e.meters) || e.meters <= 0) throw new Error('Invalid street');
      adjacency[e.a].push({ to: e.b, edge: e }); adjacency[e.b].push({ to: e.a, edge: e });
    }
    return { adjacency, odd: graph.nodes.filter(n => adjacency[n.id].length % 2).map(n => n.id), base: graph.edges.reduce((n,e) => n+e.meters,0) };
  }
  function shortestPaths(graph, start, adjacency) {
    const distance = Object.fromEntries(graph.nodes.map(n => [n.id, Infinity]));
    const previous = {}, remaining = new Set(graph.nodes.map(n => n.id));
    distance[start] = 0;
    while (remaining.size) {
      const at = [...remaining].reduce((a,b) => distance[a] <= distance[b] ? a : b);
      if (!Number.isFinite(distance[at])) throw new Error('The neighborhood must be connected');
      remaining.delete(at);
      for (const {to,edge:e} of adjacency[at]) {
        const d = distance[at] + e.meters;
        if (d < distance[to]) { distance[to] = d; previous[to] = { from: at, edge: e.id }; }
      }
    }
    function path(to) {
      const edges = [], nodes = [to];
      while (to !== start) { const p = previous[to]; edges.unshift(p.edge); nodes.unshift(p.from); to=p.from; }
      return {edges,nodes};
    }
    return {distance,path};
  }
  function solve(graph) {
    const { adjacency, odd, base } = graphInfo(graph);
    if (!adjacency[graph.start]) throw new Error('Missing post office');
    if (odd.length > 16) throw new Error('This small-map solver supports at most 16 odd junctions');
    // Check connectivity even when no duplication is needed.
    shortestPaths(graph,graph.start,adjacency);
    const paths = Object.fromEntries(odd.map(id => [id, shortestPaths(graph,id,adjacency)]));
    const memo = new Map([[0,{cost:0,pairs:[]}]]);
    function match(mask) {
      if (memo.has(mask)) return memo.get(mask);
      let i=0; while (!(mask & (1<<i))) i++;
      let best={cost:Infinity,pairs:[]};
      for (let j=i+1;j<odd.length;j++) if (mask & (1<<j)) {
        const tail=match(mask ^ (1<<i) ^ (1<<j));
        const cost=paths[odd[i]].distance[odd[j]]+tail.cost;
        if (cost<best.cost) best={cost,pairs:[[odd[i],odd[j]],...tail.pairs]};
      }
      memo.set(mask,best); return best;
    }
    const matching=match((1<<odd.length)-1);
    const pairs=matching.pairs.map(([a,b]) => ({a,b,meters:paths[a].distance[b],...paths[a].path(b)}));
    const duplicateCounts=Object.fromEntries(graph.edges.map(e => [e.id,0]));
    const copies=graph.edges.map(e => ({...e}));
    for (const pair of pairs) for (const id of pair.edges) {
      duplicateCounts[id]++; copies.push({...graph.edges.find(e => e.id === id)});
    }
    // Hierholzer's algorithm on the augmented multigraph. Each copy is distinct.
    const incident=Object.fromEntries(graph.nodes.map(n=>[n.id,[]]));
    copies.forEach((e,i)=>{incident[e.a].push(i);incident[e.b].push(i);});
    const used=new Set(), stack=[{node:graph.start,edge:null}], circuit=[];
    while(stack.length) {
      const top=stack[stack.length-1], choices=incident[top.node];
      while(choices.length && used.has(choices[choices.length-1])) choices.pop();
      if(!choices.length) circuit.push(stack.pop());
      else {const i=choices.pop(),e=copies[i];used.add(i);stack.push({node:e.a===top.node?e.b:e.a,edge:e.id});}
    }
    circuit.reverse();
    return {base,extra:matching.cost,total:base+matching.cost,odd,pairs,duplicateCounts,nodes:circuit.map(s=>s.node),edges:circuit.slice(1).map(s=>s.edge)};
  }
  function summarize(graph, walk) {
    if (!walk.length || walk[0] !== graph.start) throw new Error('A round must start at the post office');
    const counts=Object.fromEntries(graph.edges.map(e=>[e.id,0]));
    let distance=0,extra=0;
    for(let i=1;i<walk.length;i++) {
      const e=graph.edges.find(e=>(e.a===walk[i-1] && e.b===walk[i])||(e.b===walk[i-1] && e.a===walk[i]));
      if(!e) throw new Error('A leg must follow an existing street');
      distance+=e.meters; if(counts[e.id]++) extra+=e.meters;
    }
    const delivered=Object.values(counts).filter(n=>n>0).length;
    return {counts,distance,extra,delivered,current:walk[walk.length-1],complete:delivered===graph.edges.length && walk[walk.length-1]===graph.start};
  }
  const api={MAPS,graphInfo,solve,summarize};
  if(typeof module!=='undefined' && module.exports) module.exports=api;
  else root.Postman=api;
})(typeof window!=='undefined'?window:globalThis);
