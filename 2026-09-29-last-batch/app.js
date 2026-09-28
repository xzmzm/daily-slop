(() => {
  'use strict';
  const C = BatchCore;
  const $ = id => document.getElementById(id);
  const state = {forecast: 'regular', q: 24, cost: 1, seed: 9292026, month: 1, days: [], revealed: 0, selected: -1, running: false, answer: false};
  let timer;
  const money = n => (n < -.005 ? '−' : '') + '$' + Math.abs(n).toFixed(2);
  const pmf = () => C.forecasts[state.forecast].pmf;
  const say = text => { $('announcement').textContent = text; };
  const svg = (tag, attrs, content = '') => `<${tag} ${Object.entries(attrs).map(([k,v])=>`${k}="${v}"`).join(' ')}>${content}</${tag}>`;

  function chart() {
    const probabilities = pmf(), max = Math.max(...probabilities), x = d => 19 + d * 15.45;
    let elements = svg('title', {}, `${C.forecasts[state.forecast].name}: average 24 customers. Your batch is ${state.q}.`) + svg('desc', {}, C.forecasts[state.forecast].description);
    elements += svg('line', {x1:12,y1:103,x2:768,y2:103,stroke:'#cacbbc'});
    probabilities.forEach((p,d) => {
      if (p > 0) elements += svg('rect', {x:x(d)-5.6,y:102-p/max*81,width:11.2,height:p/max*81,rx:1,fill:d<=state.q?'#77896f':'#c1c5b3'}, svg('title', {}, `${d} customers: ${(p*100).toFixed(1)}%`));
    });
    [0,12,24,36,48].forEach(d => { elements += svg('text', {x:x(d),y:124,'text-anchor':'middle',fill:'#696d60','font-size':11,'font-family':'monospace'},d); });
    elements += svg('line', {x1:x(state.q),y1:15,x2:x(state.q),y2:106,stroke:'#b44326','stroke-width':2,'stroke-dasharray':'4 3'});
    elements += svg('text', {x:x(state.q),y:10,'text-anchor':'middle',fill:'#a23a20','font-size':11,'font-family':'monospace'},`${state.q} baked`);
    $('forecast-chart').innerHTML = elements;
    $('forecast-description').textContent = C.forecasts[state.forecast].description;
  }

  function tray() {
    const canvas = $('bread-tray'), ctx = canvas.getContext('2d');
    const demand = state.selected < 0 ? null : state.days[state.selected];
    const result = demand === null ? null : C.outcome(state.q, demand, state.cost);
    ctx.clearRect(0,0,960,236);
    for (let i=0;i<48;i++) {
      const x = 40 + (i % 12)*80, y = 29 + Math.floor(i/12)*59;
      const baked = i < state.q, sold = result && i < result.sold;
      ctx.save();ctx.translate(x,y);ctx.rotate(((i*17)%9-4)*.015);
      if (!baked) {
        ctx.beginPath();ctx.ellipse(0,0,23,17,0,0,Math.PI*2);ctx.setLineDash([2,5]);ctx.strokeStyle='#5b6556';ctx.lineWidth=1;ctx.stroke();
      } else if (sold) {
        ctx.beginPath();ctx.ellipse(0,0,24,18,0,0,Math.PI*2);ctx.fillStyle='#6c916d';ctx.fill();
        ctx.beginPath();ctx.moveTo(-7,0);ctx.lineTo(-1,6);ctx.lineTo(10,-7);ctx.strokeStyle='#e0ebcc';ctx.lineWidth=2.4;ctx.lineCap='round';ctx.stroke();
      } else {
        ctx.beginPath();ctx.ellipse(0,3,27,19,0,0,Math.PI*2);ctx.fillStyle='#263024';ctx.fill();
        const gradient = ctx.createLinearGradient(-10,-18,10,17);
        gradient.addColorStop(0,'#f1cb87');gradient.addColorStop(.5,'#dfa55c');gradient.addColorStop(1,'#ba733c');
        ctx.beginPath();ctx.ellipse(0,0,26,18,0,0,Math.PI*2);ctx.fillStyle=gradient;ctx.fill();
        ctx.lineCap='round';ctx.lineWidth=3.5;ctx.strokeStyle='#f7da9b';
        [-10,1,12].forEach(v=>{ctx.beginPath();ctx.moveTo(v-3,-9);ctx.quadraticCurveTo(v+2,-3,v+3,5);ctx.stroke();});
        if (result) {ctx.beginPath();ctx.ellipse(0,0,28,20,0,0,Math.PI*2);ctx.strokeStyle='#efb472';ctx.lineWidth=1.2;ctx.stroke();}
      }
      ctx.restore();
    }
    $('tray-title').textContent = result ? `Morning ${String(state.selected+1).padStart(2,'0')}` : 'The morning batch';
    $('tray-note').textContent = result ? `${demand} customers · ${state.q} buns baked` : `${state.q} buns, ready for the doors to open`;
    $('bread-legend').textContent = result ? 'Sold' : 'Freshly baked';
    document.querySelector('.fresh-key').style.background = result ? '#6b916c' : '#dfac65';
    $('day-detail').textContent = result ? `${result.leftover} left · ${result.missed} missed · ${money(result.margin)} margin` : 'Every bun is one decision.';
    canvas.setAttribute('aria-label',result ? `Morning ${state.selected+1}: ${result.sold} sold, ${result.leftover} left over, ${result.missed} customers missed. Margin ${money(result.margin)}.` : `${state.q} fresh buns in 48 tray positions.`);
  }

  function metrics() {
    const data = state.revealed ? C.average(state.q,state.days.slice(0,state.revealed),state.cost) : C.expected(state.q,pmf(),state.cost);
    for (const key of ['sold','leftover','missed']) $(key).textContent = data[key].toFixed(1);
    $('margin').textContent = money(data.margin);
    $('result-label').textContent = state.revealed ? `PER MORNING · ${state.revealed}-DAY SAMPLE` : 'PER MORNING · FORECAST EXPECTATION';
    $('month-status').textContent = state.running ? `${state.revealed} of 30 mornings…` : state.revealed ? 'Pick a morning to inspect its tray.' : 'Open the bakery to reveal the month.';
  }

  function days() {
    $('days').innerHTML = Array.from({length:30},(_,i) => {
      const visible = i < state.revealed, d = state.days[i];
      const result = visible ? C.outcome(state.q,d,state.cost) : null;
      return `<button class="day ${visible?'revealed':''} ${visible&&d>state.q?'short':''} ${state.selected===i?'selected':''}" data-day="${i}" ${visible?'':'disabled'} aria-pressed="${state.selected===i}" aria-label="Morning ${i+1}${visible?`: ${d} customers, ${result.sold} sold, ${result.leftover} left, ${result.missed} missed`:': not yet open'}">${visible?`<span class="day-bar" style="height:${d/48*26}px"></span><span class="bake-mark" style="bottom:${15+state.q/48*26}px"></span>`:''}<span class="day-number">${i+1}</span></button>`;
    }).join('');
  }

  function answer() {
    const best = C.bestBatch(pmf(),state.cost), here = C.expected(state.q,pmf(),state.cost), gain = best.margin-here.margin;
    $('best-quantity').textContent = best.q;
    $('answer-reason').textContent = `At $3 a sale and ${money(state.cost)} to bake, an extra bun needs more than a ${(state.cost/3*100).toFixed(1)}% chance of selling to improve expected margin. ${best.q} buns earns ${money(best.margin)} per morning on average, with ${best.leftover.toFixed(1)} left over. ${gain<.005?'Your batch already reaches the best expected margin.':`That is ${money(gain)} more than your current batch.`}`;
    $('answer').hidden = !state.answer;
    $('reveal').setAttribute('aria-expanded',String(state.answer));
    $('reveal').innerHTML = `${state.answer?'The sweet spot':'Find the sweet spot'} <span aria-hidden="true">${state.answer?'−':'+'}</span>`;
  }

  function render() {
    $('quantity').value = state.q;$('quantity-value').value = state.q;
    $('cost').value = state.cost;$('cost-value').value = money(state.cost);
    $('month-number').textContent = `MONTH ${String(state.month).padStart(2,'0')}`;
    $('run').disabled = state.running;
    $('run').innerHTML = `${state.running?'The bakery is open…':state.revealed?'Replay these 30 mornings':'Open for 30 mornings'} <span aria-hidden="true">↗</span>`;
    document.querySelectorAll('[data-forecast]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.forecast===state.forecast)));
    chart();tray();metrics();days();answer();
  }

  function resetSample() {
    clearTimeout(timer);state.running=false;state.revealed=0;state.selected=-1;
    state.days=C.month(pmf(),state.seed);render();
  }

  function run() {
    clearTimeout(timer);state.running=true;state.revealed=0;state.selected=-1;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    function step() {
      state.revealed = reduced ? 30 : state.revealed+1;
      state.selected=state.revealed-1;state.running=state.revealed<30;render();
      if (state.running) timer=setTimeout(step,75);
      else say(`Thirty mornings complete. Average ${$('sold').textContent} sold, ${$('leftover').textContent} left over and ${$('missed').textContent} missed customers. Margin ${$('margin').textContent} per morning. Select a day to inspect it.`);
    }
    step();
  }

  $('quantity').addEventListener('input',e=>{state.q=Number(e.target.value);resetSample();});
  $('cost').addEventListener('input',e=>{state.cost=Number(e.target.value);resetSample();});
  document.querySelectorAll('[data-forecast]').forEach(b=>b.addEventListener('click',()=>{state.forecast=b.dataset.forecast;resetSample();say(`${C.forecasts[state.forecast].name}. Average demand remains 24 customers.`);}));
  $('run').addEventListener('click',run);
  $('new-month').addEventListener('click',()=>{state.month++;state.seed++;resetSample();say(`New month ${state.month}. Ready to open.`);});
  $('days').addEventListener('click',e=>{const button=e.target.closest('[data-day]');if(!button||button.disabled)return;state.selected=Number(button.dataset.day);tray();days();const current=$('days').querySelector(`[data-day="${state.selected}"]`);current.focus({preventScroll:true});say($('bread-tray').getAttribute('aria-label'));});
  $('reveal').addEventListener('click',()=>{state.answer=!state.answer;answer();});
  $('use-best').addEventListener('click',()=>{state.q=C.bestBatch(pmf(),state.cost).q;resetSample();say(`Batch set to ${state.q}. Replay the same month to compare.`);});
  window.lastBatch = {getState:()=>({...state,days:[...state.days]})};
  resetSample();
})();
