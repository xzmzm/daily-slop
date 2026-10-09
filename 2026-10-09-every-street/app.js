(() => {
  'use strict';
  const $=id=>document.getElementById(id), NS='http://www.w3.org/2000/svg';
  let graph=Postman.MAPS[0], best=Postman.solve(graph), walk=[graph.start], savedWalk=null;
  let mode='play', timer=null, solutionIndex=0, revealed=false;
  const meters=n=>n.toLocaleString('en-US');
  function svg(tag,attrs={},parent) {
    const el=document.createElementNS(NS,tag);
    for(const [k,v] of Object.entries(attrs)) el.setAttribute(k,v);
    if(parent) parent.append(el);return el;
  }
  function text(parent,x,y,value,cls) {const el=svg('text',{x,y,class:cls},parent);el.textContent=value;return el;}
  function tree(x,y,r=14) {const s=$('scenery');svg('circle',{cx:x,cy:y,r,class:'tree'},s);svg('path',{d:`M${x} ${y-6}v15m-5-10 5 5 5-7`,class:'tree-trunk'},s);}
  function house(x,y,w=43,h=29) {const s=$('scenery');svg('rect',{x,y,width:w,height:h,rx:2,class:'roof'},s);svg('path',{d:`M${x} ${y}l${w/2} ${h/2} ${w/2} ${-h/2}M${x+w/2} ${y+h/2}v${h/2}`,class:'roof-line'},s);}
  function scenery() {
    const s=$('scenery');s.replaceChildren();
    if(graph.id==='market') {
      [[211,155,170,81],[510,155,170,81],[211,342,170,70],[510,342,170,70]].forEach(([x,y,w,h])=>svg('rect',{x,y,width:w,height:h,rx:9,class:'block'},s));
      [[220,167],[286,167],[532,164],[599,164],[220,354],[286,354],[532,353],[599,353]].forEach(([x,y])=>house(x,y));
      [[97,207],[97,370],[791,207],[791,370],[340,65],[554,514]].forEach(([x,y])=>tree(x,y));
      text(s,294,220,'the old orchard','landmark');text(s,594,220,'books & tea','landmark');text(s,294,438,'Market Lane','landmark');text(s,594,437,'Clockmaker’s Row','landmark');
    } else if(graph.id==='canal') {
      svg('rect',{x:210,y:174,width:475,height:222,rx:75,fill:'#e1eaea',stroke:'#cbd9d3'},s);
      svg('rect',{x:217,y:181,width:461,height:208,rx:70,fill:'url(#water)',opacity:.65},s);
      svg('rect',{x:320,y:244,width:260,height:80,rx:40,fill:'#e5e9d7',stroke:'#ccd6bd'},s);
      [352,406,463,519,553].forEach((x,i)=>tree(x,281+(i%2?7:-8),13));
      text(s,448,361,'the long, slow canal','landmark');house(85,244,40,55);house(789,243,40,55);
      tree(277,63);tree(619,508);text(s,87,331,'west lock','landmark');text(s,810,331,'east lock','landmark');
    } else {
      svg('rect',{x:215,y:153,width:155,height:80,rx:9,class:'block'},s);house(236,170,60,36);tree(335,194);
      svg('circle',{cx:581,cy:393,r:66,fill:'#e8ebda',stroke:'#dce2cd'},s);
      for(let i=0;i<6;i++) tree(581+Math.cos(i*Math.PI/3)*43,393+Math.sin(i*Math.PI/3)*43,12);
      text(s,581,398,'rose garden','landmark');house(756,53,40,28);house(93,475,37,30);
      [[244,366],[289,399],[343,372],[775,209],[681,224]].forEach(([x,y])=>tree(x,y));
      text(s,287,446,'community plots','landmark');text(s,588,167,'Potting Lane','landmark');
    }
    text(s,graph.nodes[0].x,graph.nodes[0].y-42,'POST OFFICE','post-office-label');
  }
  function buildMap() {
    scenery();$('streets').replaceChildren();$('junctions').replaceChildren();
    const start=graph.nodes.find(n=>n.id===graph.start);
    $('postie').style.transition='none';$('postie').style.transform=`translate(${start.x}px,${start.y}px)`;
    $('postie').getBoundingClientRect();$('postie').style.transition='';
    $('district-name').textContent=graph.name;$('map-title').textContent=graph.name+' street map';
    $('map-caption').textContent=graph.edges.length+' streets · all two-way';$('street-count').textContent=graph.edges.length;
    const nodeById=Object.fromEntries(graph.nodes.map(n=>[n.id,n]));
    graph.edges.forEach(e=>{
      const a=nodeById[e.a],b=nodeById[e.b],d=`M${a.x} ${a.y}L${b.x} ${b.y}`;
      const g=svg('g',{'data-edge':e.id},$('streets'));
      svg('path',{d,class:'road-bed'},g);svg('path',{d,class:'road'},g);
      const hit=svg('path',{d,class:'road-hit','aria-hidden':'true'},g);
      hit.addEventListener('click',()=>{const at=walk[walk.length-1];if(at===e.a) step(e.b);else if(at===e.b) step(e.a);else explainNonAdjacent();});
      const x=(a.x+b.x)/2,y=(a.y+b.y)/2;
      const label=svg('g',{transform:`translate(${x} ${y})`,'pointer-events':'none'},g);
      svg('rect',{x:-21,y:-10,width:42,height:20,rx:4,class:'length-back'},label);
      text(label,0,3,e.meters+' m','length-text');
    });
    const {adjacency}=Postman.graphInfo(graph);
    graph.nodes.forEach(n=>{
      const g=svg('g',{class:'junction',transform:`translate(${n.x} ${n.y})`,role:'button',tabindex:0,'data-node':n.id,'aria-label':`${n.id}, ${n.name}. ${adjacency[n.id].length} streets meet here.`},$('junctions'));
      svg('circle',{r:27,class:'node-touch',fill:'transparent'},g);
      svg('circle',{r:30,class:'node-halo'},g);svg('circle',{r:18,class:'node'},g);
      const degree=adjacency[n.id].length;
      text(g,0,4,n.id,'letter');text(g,0,38,degree+(degree===1?' street':' streets'),'degree');
      g.addEventListener('click',()=>step(n.id));
      g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();step(n.id);}});
    });
  }
  function render() {
    const s=Postman.summarize(graph,walk),showOdd=$('odd-toggle').checked;
    const at=graph.nodes.find(n=>n.id===s.current),neighbors=Postman.graphInfo(graph).adjacency[s.current].map(e=>e.to);
    document.body.dataset.mode=mode;
    document.querySelectorAll('[data-map]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.map===graph.id));
    for(const e of graph.edges) {
      const el=document.querySelector(`[data-edge="${e.id}"]`),count=s.counts[e.id];
      const cls=count>1?'retraced':count?'visited':mode==='solution'&&best.duplicateCounts[e.id]?'future-repeat':'';
      el.querySelector('.road').setAttribute('class','road '+cls);
      el.querySelector('.length-text').setAttribute('class','length-text '+(count>1?'retraced':count?'visited':''));
    }
    document.querySelectorAll('[data-node]').forEach(el=>{
      const id=el.dataset.node,odd=best.odd.includes(id);
      el.classList.toggle('odd',showOdd&&odd);el.classList.toggle('available',mode==='play'&&neighbors.includes(id));
      el.querySelector('.degree').style.display=showOdd&&odd?'':'none';
      el.setAttribute('aria-disabled',mode==='solution'?'true':'false');
      el.setAttribute('aria-label',`${id}, ${graph.nodes.find(n=>n.id===id).name}${id===s.current?', you are here':neighbors.includes(id)?', next street':', not adjacent'}.`);
    });
    $('postie').style.transform=`translate(${at.x}px,${at.y}px)`;
    $('delivered-count').textContent=String(s.delivered).padStart(2,'0');
    $('progress-fill').style.width=(s.delivered/graph.edges.length*100)+'%';
    $('distance').textContent=meters(s.distance);$('extra').textContent=meters(s.extra);
    $('location').textContent=`At ${s.current} · ${at.name}`;$('move-count').textContent=(walk.length-1)+' legs';
    $('round-label').textContent=mode==='solution'?'THE SHORTEST ROUND':'YOUR MORNING ROUND';
    $('status').classList.toggle('complete',s.complete);
    if(s.complete) $('status').textContent=s.distance===best.total?`Home, every letter delivered. ${meters(s.distance)} m — a shortest possible round.`:`Home with every street covered. A shortest round saves ${meters(s.distance-best.total)} m.`;
    else if(s.delivered===graph.edges.length) $('status').textContent='Every street has its mail. Now bring the empty bag back to A.';
    else if(mode==='solution') $('status').textContent=timer?'Following an exact shortest route. Gold streets are walked more than once.':'Route paused. Resume whenever you’re ready.';
    else $('status').textContent='Every street gets mail. Your round ends back at A.';
    $('undo').disabled=mode!=='play'||walk.length<2;
    $('back').hidden=mode!=='solution';$('solution-detail').hidden=!revealed;
    $('solution-intro').hidden=mode==='solution';
    $('solution-intro').textContent=best.odd.length?'Some extra footsteps are unavoidable. The trick is knowing which ones.':'A clean loop might be enough. Can you deliver every street without doubling back?';
    $('solve').innerHTML=mode==='play'?'Show the shortest round <span>↗</span>':timer?'Pause the route <span>Ⅱ</span>':s.complete?'Replay the shortest round <span>↻</span>':'Resume the route <span>→</span>';
    $('best-distance').textContent=meters(best.total)+' m';
    $('best-explanation').textContent=best.odd.length?`${meters(best.base)} m of streets + ${meters(best.extra)} m of unavoidable retracing. Pair the ${best.odd.length} odd junctions along these paths:`:`${meters(best.base)} m of streets. Every junction has two streets, so one clean loop delivers everything.`;
    $('pairings').replaceChildren();best.pairs.forEach(p=>{const span=document.createElement('span');span.textContent=p.nodes.join(' → ')+' · '+meters(p.meters)+' m';$('pairings').append(span);});
    $('map-help').textContent=mode==='solution'?'Watch the letter move. Gold marks the streets this shortest round repeats.':s.complete?'A good morning’s work. Try another neighborhood, or compare the shortest round.':`You’re at ${s.current}. Next stop: ${neighbors.join(' or ')}. Choose a junction or the street itself.`;
  }
  function explainNonAdjacent() {if(mode==='play') $('status').textContent=`That street is out of reach. Choose a street connected to ${walk[walk.length-1]}.`;}
  function step(id) {
    if(mode!=='play') return false;
    const at=walk[walk.length-1];
    if(!graph.edges.some(e=>(e.a===at&&e.b===id)||(e.b===at&&e.a===id))) {explainNonAdjacent();return false;}
    walk.push(id);render();return true;
  }
  function stop() {if(timer!==null){clearInterval(timer);timer=null;}}
  function advance() {
    if(mode!=='solution')return;
    if(solutionIndex<best.nodes.length-1)walk.push(best.nodes[++solutionIndex]);
    if(solutionIndex>=best.nodes.length-1)stop();render();
  }
  function playSolution() {
    if(mode==='play'){savedWalk=walk.slice();mode='solution';revealed=true;walk=[graph.start];solutionIndex=0;}
    else if(timer){stop();render();return;}
    else if(solutionIndex===best.nodes.length-1){walk=[graph.start];solutionIndex=0;}
    timer=setInterval(advance,680);render();
  }
  function reset() {stop();mode='play';walk=[graph.start];savedWalk=null;solutionIndex=0;render();}
  function choose(id) {
    const next=Postman.MAPS.find(g=>g.id===id);if(!next)return;
    stop();graph=next;best=Postman.solve(graph);mode='play';walk=[graph.start];savedWalk=null;revealed=false;solutionIndex=0;
    buildMap();render();
  }
  document.querySelectorAll('[data-map]').forEach(b=>b.addEventListener('click',()=>choose(b.dataset.map)));
  $('undo').addEventListener('click',()=>{if(mode==='play'&&walk.length>1){walk.pop();render();}});
  $('reset').addEventListener('click',reset);$('solve').addEventListener('click',playSolution);
  $('back').addEventListener('click',()=>{stop();mode='play';walk=savedWalk||[graph.start];savedWalk=null;render();});
  $('odd-toggle').addEventListener('change',render);
  // Read-only inspection makes regression tests and deterministic recording possible.
  window.everyStreet={getState:()=>({map:graph.id,mode,walk:walk.slice(),running:timer!==null,solutionIndex,summary:Postman.summarize(graph,walk),best:JSON.parse(JSON.stringify(best))})};
  buildMap();render();
})();
