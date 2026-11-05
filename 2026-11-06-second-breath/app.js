(() => {
  'use strict';
  const model = window.BoreModel;
  const $ = id => document.getElementById(id);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const state = {length: .65, mode: 1, phase: .55, playing: !reduced.matches, recording: false};
  const colors = {cylinder: '#b44d36', cone: '#25675c'};
  let audio, voices = [], sounding = null, soundTimer, soundToken = 0;

  function draw(kind) {
    const canvas = $(kind + '-canvas'), ctx = canvas.getContext('2d');
    const width = Math.max(1, canvas.clientWidth), height = Math.max(1, canvas.clientHeight);
    const logicalHeight = height * 1000 / width;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    }
    ctx.setTransform(dpr * width / 1000, 0, 0, dpr * width / 1000, 0, 0);
    ctx.clearRect(0, 0, 1000, logicalHeight);
    const left = 85, right = 918, cy = logicalHeight * .49, span = right - left;
    const radius = x => kind === 'cylinder' ? logicalHeight * .185 : x * logicalHeight * .303;
    const amplitude = logicalHeight * .146, labelFont = Math.max(16, 8000 / width);
    const color = colors[kind];
    ctx.strokeStyle = '#d7d6ca'; ctx.lineWidth = 1;
    ctx.setLineDash([4, 8]); ctx.beginPath();ctx.moveTo(42, cy);ctx.lineTo(955, cy);ctx.stroke();ctx.setLineDash([]);
    ctx.save();ctx.beginPath();ctx.moveTo(left, cy - radius(0));ctx.lineTo(right, cy - radius(1));ctx.lineTo(right, cy + radius(1));ctx.lineTo(left, cy + radius(0));ctx.closePath();ctx.clip();
    ctx.fillStyle = kind === 'cylinder' ? '#f0e6d9' : '#e3ebe0';ctx.fillRect(left, 0, span, logicalHeight);
    const oscillation = Math.cos(state.phase);
    for (let i = 0; i < 120; i++) {
      const x = (i + .5) / 120, p = model.pressure(kind, state.mode, x) * oscillation;
      ctx.fillStyle = p >= 0 ? `rgba(${kind === 'cylinder' ? '180,77,54' : '37,103,92'},${Math.abs(p) * .28})` : `rgba(92,119,151,${Math.abs(p) * .24})`;
      ctx.fillRect(left + span * i / 120, 0, span / 120 + 1, logicalHeight);
    }
    ctx.restore();
    ctx.strokeStyle = color;ctx.lineWidth = 2.4;ctx.beginPath();ctx.moveTo(left, cy - radius(0));ctx.lineTo(right, cy - radius(1));ctx.moveTo(left, cy + radius(0));ctx.lineTo(right, cy + radius(1));ctx.stroke();
    if (kind === 'cylinder') {
      ctx.lineWidth = 5;ctx.beginPath();ctx.moveTo(left, cy-radius(0));ctx.lineTo(left, cy+radius(0));ctx.stroke();
      ctx.fillStyle = '#b69055';ctx.fillRect(left-21, cy-radius(0)*.86, 10, radius(0)*1.72);
    } else {
      ctx.fillStyle = color;ctx.beginPath();ctx.arc(left, cy, 5, 0, Math.PI*2);ctx.fill();
    }
    // The dashed curves are pressure envelopes; the solid curve is one instant.
    for (const sign of [1, -1]) {
      ctx.strokeStyle = color + '55';ctx.lineWidth = 1.5;ctx.setLineDash([6, 6]);ctx.beginPath();
      for (let i = 0; i <= 180; i++) {
        const x = i / 180, px = left + x * span, py = cy - sign * model.pressure(kind, state.mode, x) * amplitude;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();ctx.setLineDash([]);
    }
    ctx.lineWidth = 3;ctx.strokeStyle = color;ctx.beginPath();
    for (let i = 0; i <= 180; i++) {
      const x = i / 180, px = left + x * span, py = cy - model.pressure(kind, state.mode, x) * oscillation * amplitude;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.stroke();
    for (const x of model.nodes(kind, state.mode)) {
      ctx.fillStyle = '#f8f6ee';ctx.strokeStyle = color;ctx.lineWidth = 2.2;ctx.beginPath();ctx.arc(left+x*span, cy, 6, 0, Math.PI*2);ctx.fill();ctx.stroke();
    }
    ctx.fillStyle = '#6d7168';ctx.font = labelFont+'px monospace';ctx.textAlign = 'left';ctx.fillText(kind === 'cylinder' ? 'REED / CLOSED' : 'VIRTUAL APEX', 46, labelFont+7);
    ctx.textAlign = 'right';ctx.fillText('OPEN END', 953, labelFont+7);
    const ruler = logicalHeight-28, dimension = Math.round(state.length*100)+' cm acoustic';
    ctx.strokeStyle = '#92988b';ctx.lineWidth = 1;ctx.beginPath();ctx.moveTo(left, ruler);ctx.lineTo(right, ruler);ctx.moveTo(left, ruler-7);ctx.lineTo(left, ruler+7);ctx.moveTo(right, ruler-7);ctx.lineTo(right, ruler+7);ctx.stroke();
    ctx.font=Math.max(17,8000/width)+'px monospace';const textWidth=ctx.measureText(dimension).width+25;
    ctx.fillStyle = '#f8f6ee';ctx.fillRect(501-textWidth/2, ruler-labelFont, textWidth, labelFont*2);ctx.fillStyle = '#6d7168';ctx.textAlign='center';ctx.fillText(dimension, 501, ruler+labelFont*.35);
  }

  function render() {
    $('length-value').textContent = Math.round(state.length*100) + ' cm';
    for (const kind of ['cylinder', 'cone']) {
      const hz = model.frequency(kind, state.length, state.mode), note = model.note(hz);
      $(kind+'-hz').textContent = Math.round(hz);
      $(kind+'-note').textContent = '≈ '+note.name;
      $(kind+'-note').title = `${note.cents >= 0 ? '+' : ''}${note.cents} cents from equal temperament (A4 = 440 Hz)`;
      $(kind+'-mode').textContent = state.mode === 1 ? '1st mode' : '2nd mode';
      const n = model.nodes(kind, state.mode).length;
      $(kind+'-nodes').textContent = `${n} interior pressure node${n === 1 ? '' : 's'}`;
      $(kind+'-ladder').replaceChildren(...Array.from({length:6}, (_, i) => {
        const ratio = i+1, allowed = kind === 'cone' || ratio%2 === 1, el = document.createElement('span');
        el.className = 'harmonic' + (!allowed ? ' absent' : '') + (ratio === model.ratio(kind, state.mode) ? ' active' : '');
        el.textContent = ratio+'×';el.setAttribute('aria-label', ratio+' times the low note'+(!allowed ? ', absent in the ideal cylinder' : ratio === model.ratio(kind, state.mode) ? ', selected' : ''));return el;
      }));
      draw(kind);
    }
    $('low').setAttribute('aria-pressed', state.mode === 1);
    $('overblow').setAttribute('aria-pressed', state.mode === 2);
    $('motion').setAttribute('aria-pressed', state.playing);
    $('motion').setAttribute('aria-label', state.playing ? 'Pause air animation' : 'Start air animation');
    $('motion').innerHTML = (state.playing ? 'Ⅱ' : '▷') + '<span>'+(state.playing ? 'Pause air' : 'Animate air')+'</span>';
    if (state.mode === 1) {
      $('cylinder-explanation').textContent = 'The reed end is closed; the far end is open. The lowest mode fits a quarter wavelength.';
      $('cone-explanation').textContent = 'The widening air column fits a half wavelength. At the same length, its low note is twice as high.';
      $('observation').replaceChildren(document.createTextNode('Same length, different low notes. Now try '));
      const next = document.createElement('button');next.type='button';next.id='try-next';next.textContent='the next resonance ↗';next.addEventListener('click', () => setMode(2));$('observation').appendChild(next);
    } else {
      $('cylinder-explanation').textContent = 'The next pattern has an interior pressure node. It skips 2× and resonates at 3× the low note: a twelfth.';
      $('cone-explanation').textContent = 'This pattern also has an interior pressure node, but at a different place. Its frequency is 2× the low note: an octave.';
      $('observation').textContent = 'A different shape changes which pattern fits. Cylinder: 1 → 3. Cone: 1 → 2.';
    }
  }
  function setMode(mode) {stopSound();state.mode=mode;render();}
  function stopSound() {
    soundToken++;clearTimeout(soundTimer);
    for (const {osc, gain} of voices) {try {gain.gain.cancelScheduledValues(audio.currentTime);gain.gain.setTargetAtTime(0, audio.currentTime, .01);osc.stop(audio.currentTime+.06);} catch (_) { /* Already ended. */ }}
    voices=[];sounding=null;
    for (const kind of ['cylinder','cone']) {$("hear-"+kind).innerHTML='<span aria-hidden="true">▷</span> Hear the leap';$('hear-'+kind).setAttribute('aria-pressed','false');}
    $('audio-status').textContent='Sound is off until you press play.';
  }
  async function hear(kind) {
    if (sounding === kind) {stopSound();return;}
    stopSound();sounding=kind;const token=soundToken;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw new Error('Audio unavailable');
      audio ||= new Audio();await audio.resume();
      if (token !== soundToken) return;
      if (audio.state !== 'running') throw new Error('Audio did not start');
      const start = audio.currentTime+.04;
      for (const [i, mode] of [1,2].entries()) {
        const osc=audio.createOscillator(),gain=audio.createGain(),when=start+i*.85;
        osc.type='sine';osc.frequency.value=model.frequency(kind,state.length,mode);
        gain.gain.setValueAtTime(0,when);gain.gain.linearRampToValueAtTime(.13,when+.04);gain.gain.setValueAtTime(.13,when+.55);gain.gain.linearRampToValueAtTime(0,when+.7);
        osc.connect(gain);gain.connect(audio.destination);osc.start(when);osc.stop(when+.72);voices.push({osc,gain});
      }
      $('hear-'+kind).innerHTML='<span aria-hidden="true">□</span> Stop tones';$('hear-'+kind).setAttribute('aria-pressed','true');
      $('audio-status').textContent=`${kind === 'cone' ? 'Cone' : 'Cylinder'}: low → ${kind === 'cone' ? 'octave' : 'twelfth'}. Two pure tones.`;
      soundTimer=setTimeout(stopSound,1700);
    } catch (_) {if(token===soundToken){stopSound();$('audio-status').textContent='Audio could not start in this browser. The diagrams still work.';}}
  }
  $('low').addEventListener('click', () => setMode(1));$('overblow').addEventListener('click', () => setMode(2));
  $('length').addEventListener('input', e => {stopSound();state.length=Number(e.target.value)/100;render();});
  $('reset').addEventListener('click', () => {stopSound();state.length=.65;$('length').value=65;render();});
  $('motion').addEventListener('click', () => {state.playing=!state.playing;render();});
  for (const kind of ['cylinder','cone']) $('hear-'+kind).addEventListener('click', () => hear(kind));
  reduced.addEventListener('change', e => {if(e.matches){state.playing=false;render();}});
  window.addEventListener('resize', () => {draw('cylinder');draw('cone');});
  document.addEventListener('visibilitychange', () => {if(document.hidden) stopSound();});
  window.secondBreath={state,setMode,setRecordingClock(enabled){state.recording=enabled;},advance(ms){if(state.playing){state.phase+=ms/1000*Math.PI*1.1;draw('cylinder');draw('cone');}},stopSound};
  let previous=performance.now();
  function tick(now) {if(!state.recording&&state.playing&&!document.hidden) window.secondBreath.advance(Math.min(80,now-previous));previous=now;requestAnimationFrame(tick);}
  render();requestAnimationFrame(tick);
})();
