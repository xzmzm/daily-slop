/* DOM rendering is separate from the lock rules, so recording can step time. */
'use strict';
(() => {
  const { Lock, LIFT } = LockModel;
  const model = new Lock();
  const $ = id => document.getElementById(id);
  const waterY = h => 300 - 60 * h;
  const boatX = { lower: 165, chamber: 520, upper: 875 };
  let automatic = true;
  let last = performance.now();
  let lastGuide = '';

  function boatPosition() {
    let x = boatX[model.boat];
    if (model.moving) {
      let t = model.moving.elapsed / model.moving.duration;
      t = t * t * (3 - 2 * t);
      x = boatX[model.moving.from] + (boatX[model.moving.to] - boatX[model.moving.from]) * t;
    }
    const h = model.boat === 'chamber' ? model.level : model.height(model.boat);
    return { x, h };
  }
  function render() {
    const h = model.level, y = waterY(h), boat = boatPosition();
    $('chamber-water').setAttribute('y', y);
    $('chamber-water').setAttribute('height', 398 - y);
    $('chamber-waves').setAttribute('y', y + 13);
    $('chamber-waves').setAttribute('height', Math.max(0, 371 - y));
    $('chamber-line').setAttribute('d', `M356 ${y}H716`);
    $('level-marker').setAttribute('transform', `translate(0 ${y - 156})`);
    $('level-text').textContent = `+${h.toFixed(2)} m`;
    $('boat').setAttribute('transform', `translate(${boat.x} ${waterY(boat.h)})`);
    $('level').innerHTML = `${h.toFixed(2)} <small>m</small>`;
    $('admitted').innerHTML = `${Math.round(model.admitted)} <small>m³</small>`;
    const rise = boat.h - model.height(model.source);
    $('boat-rise').innerHTML = `${rise >= 0 ? '+' : '−'}${Math.abs(rise).toFixed(2)} <small>m</small>`;
    for (const side of ['lower', 'upper']) {
      const gate = $(`gate-${side}`), sluice = $(`sluice-${side}`);
      gate.setAttribute('aria-pressed', String(model.gates[side]));
      gate.querySelector('strong').innerHTML = model.gates[side] ? 'Close <b>↘</b>' : 'Open <b>↗</b>';
      $(`${side}-gate`).classList.toggle('open', model.gates[side]);
      $(`${side}-state`).textContent = model.gates[side] ? 'OPEN' : 'CLOSED';
      sluice.setAttribute('aria-pressed', String(model.sluices[side]));
      sluice.querySelector('strong').innerHTML = model.sluices[side] ? 'Close <b>×</b>' : side === 'lower' ? 'Drain <b>↓</b>' : 'Fill <b>↑</b>';
      $(`${side}-stream`).setAttribute('hidden', '');
      if (model.sluices[side] && model.gap(side) > 1e-8) $(`${side}-stream`).removeAttribute('hidden');
    }
    $('up').setAttribute('aria-pressed', String(model.direction === 'up'));
    $('down').setAttribute('aria-pressed', String(model.direction === 'down'));
    $('move').disabled = model.complete || !!model.moving;
    $('move').querySelector('span').textContent = model.complete ? 'Boat delivered ✓' : model.moving ? 'Boat moving…' : model.boat === 'chamber' ? 'Leave the chamber' : 'Enter the chamber';
    $('move').querySelector('b').textContent = model.direction === 'up' ? '→' : '←';
    document.querySelector('.desk').classList.toggle('finished', model.complete);
    const guide = model.guidance();
    const key = JSON.stringify(guide);
    // Change live text only at a step boundary, never on every animation frame.
    if (key !== lastGuide) {
      $('step').textContent = model.complete ? 'PASSAGE / COMPLETE' : `PASSAGE / 0${guide.step} OF 05`;
      $('hint-title').textContent = guide.title;
      $('hint').textContent = guide.text;
      document.querySelectorAll('.suggested').forEach(el => el.classList.remove('suggested'));
      if (guide.target) $(guide.target).classList.add('suggested');
      lastGuide = key;
    }
    $('scene-description').textContent = `The boat is ${model.moving ? 'moving' : 'in the ' + model.boat + (model.boat === 'chamber' ? '' : ' reach')}. Chamber level ${h.toFixed(2)} metres above the lower reach. ${guide.title}`;
  }
  function act(fn) {
    const result = fn();
    $('feedback').textContent = result.ok ? 'Gates for boats. Sluices for water.' : result.reason;
    $('feedback').classList.toggle('blocked', !result.ok);
    render();
    return result;
  }
  for (const side of ['lower', 'upper']) {
    $(`gate-${side}`).addEventListener('click', () => act(() => model.toggleGate(side)));
    $(`sluice-${side}`).addEventListener('click', () => act(() => model.toggleSluice(side)));
  }
  $('move').addEventListener('click', () => act(() => model.moveBoat()));
  function reset(direction = model.direction) {
    model.reset(direction);
    $('feedback').textContent = 'Try a gate before the levels match.';
    $('feedback').classList.remove('blocked');
    render();
  }
  $('up').addEventListener('click', () => reset('up'));
  $('down').addEventListener('click', () => reset('down'));
  $('reset').addEventListener('click', () => reset());
  function tick(dt) { model.tick(dt); render(); }
  function frame(now) {
    if (automatic) tick(Math.min(.1, (now - last) / 1000));
    last = now;
    requestAnimationFrame(frame);
  }
  window.lockTender = { model, render, tick, reset, boatPosition, pauseAutomatic() { automatic = false; } };
  render();
  requestAnimationFrame(frame);
})();
