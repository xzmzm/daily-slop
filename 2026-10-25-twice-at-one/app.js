/* The experiment is deliberately fixed to London's 25 October 2026 fold. */
(() => {
  const $ = id => document.getElementById(id);
  const fmt = m => `${String(Math.floor(m / 60) % 24).padStart(2,'0')}:${String(m % 60).padStart(2,'0')}`;
  function instant(minutes) {
    const utc = Math.max(0, Math.min(180, Math.round(minutes)));
    const first = utc < 60;
    return {utc, first, local: utc + (first ? 60 : 0), offset: first ? '+01:00' : '+00:00'};
  }
  let minutes = 30, playing = false, last = 0, accumulator = 0;
  function render(value = minutes) {
    minutes = instant(value).utc;
    const s = instant(minutes), x = 60 + s.local / 60 * 190, y = s.first ? 92 : 178;
    $('time').value = minutes;
    $('clock').textContent = fmt(s.local);
    $('utc').textContent = `${fmt(minutes)} UTC`;
    $('zone').textContent = s.first ? 'BST' : 'GMT';
    $('offset').textContent = `UTC ${s.offset}`;
    $('pass').textContent = s.first ? 'FIRST PASS' : minutes < 120 ? 'SECOND PASS' : 'PAST THE FOLD';
    $('pass').style.color = s.first ? 'var(--orange)' : 'var(--teal)';
    $('elapsed').textContent = `${minutes} min`;
    $('kl').textContent = fmt(minutes + 480);
    ['needle','dot','ghost','dot-label'].forEach(id => {
      const el = $(id);
      if (id === 'needle') {el.setAttribute('x1', x);el.setAttribute('x2', x);}
      else el.setAttribute(id === 'dot-label' ? 'x' : 'cx', x);
    });
    $('dot').setAttribute('cy',y);
    $('ghost').setAttribute('cy',s.first ? 178 : 92);
    $('ghost').style.display = s.local >= 60 && s.local < 120 ? '' : 'none';
    $('dot-label').setAttribute('y',y - 22);
    $('first').setAttribute('aria-pressed',minutes === 30);
    $('second').setAttribute('aria-pressed',minutes === 90);
    $('observation').textContent = minutes < 60 ? 'The first lap. London is one hour ahead of UTC; the second 01:30 is still an hour away.' : minutes < 120 ? 'The second lap. The clock has turned back; UTC and Kuala Lumpur kept moving forward.' : 'Past the fold. London clock labels are unique again. The extra hour is behind us.';
    return s;
  }
  function stop(){playing=false;$('play').textContent='▶ Play the night';}
  function select(m){stop();render(m);}
  $('time').addEventListener('input',e=>select(Number(e.target.value)));
  $('first').onclick=()=>select(30);
  $('second').onclick=()=>select(90);
  $('seam').onclick=()=>{select(58); playing=true;last=performance.now();accumulator=0;$('play').textContent='Ⅱ Pause';};
  $('play').onclick=()=>{if(playing) stop();else {if(minutes>=180)render(0);playing=true;last=performance.now();accumulator=0;$('play').textContent='Ⅱ Pause';}};
  function tick(now){if(playing){accumulator+=(now-last)/1000*3;last=now;if(accumulator>=1){const step=Math.floor(accumulator);accumulator-=step;render(minutes+step);if(minutes>=180)stop();}}requestAnimationFrame(tick);}
  window.twiceAtOne={instant,fmt,render,select,get minutes(){return minutes;}};
  render();requestAnimationFrame(tick);
})();
