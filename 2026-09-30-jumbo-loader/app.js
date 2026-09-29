/* Renders the hangar, manifest and envelope chart around LoaderCore. */
(function () {
  'use strict';
  const C = window.LoaderCore;
  const $ = id => document.getElementById(id);
  const SVG = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs = {}, parent) => {
    const node = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (parent) parent.appendChild(node);
    return node;
  };

  // Deck geometry: body station 0..2100 maps across the drawing.
  const px = sta => 34 + sta * 0.43;
  const MAIN_Y = 136, LOWER_Y = 178;
  const chartX = mac => 52 + (mac - 10) / 28 * 388;
  const chartY = lb => 296 - (lb - 340000) / 200000 * 234;
  const kfmt = lb => `${Math.round(lb / 100) / 10}k`;

  const state = {mission: 0, items: [], selected: null, trail: [], dispatched: null};

  /* ---------- deck ---------- */
  function aircraft(deck) {
    const art = el('g', {id: 'aircraft'}, deck);
    // fuselage: nose tip at station 0, tail cone past the last slot
    const body = `M 34 166
      C 60 138, 120 126, 190 122 L 300 116 L 316 96
      C 360 82, 470 74, 560 74 L 640 74 C 690 74, 730 82, 760 96 L 788 122
      C 850 126, 900 132, 936 142 C 944 150, 940 158, 920 162
      L 700 178 C 620 182, 560 190, 520 200 L 300 200 C 180 198, 90 190, 48 178 Z`;
    el('path', {d: body, fill: 'rgba(28, 46, 76, .9)', stroke: '#9fc3ff', 'stroke-width': 2}, art);
    // flight-deck windows on the hump
    el('rect', {x: 372, y: 86, width: 34, height: 10, rx: 2, fill: '#0c1422', stroke: '#9fc3ff'}, art);
    // tail fin and stabiliser
    el('path', {d: 'M 770 108 L 852 30 L 900 30 L 862 116 Z', fill: 'rgba(28, 46, 76, .9)', stroke: '#9fc3ff', 'stroke-width': 2}, art);
    el('path', {d: 'M 872 150 L 950 128 L 952 136 L 886 158 Z', fill: 'rgba(28, 46, 76, .9)', stroke: '#9fc3ff', 'stroke-width': 1.5}, art);
    // wing edge-on plus two engine pods
    el('path', {d: 'M 560 196 L 770 196 L 786 202 L 566 202 Z', fill: 'rgba(28, 46, 76, .9)', stroke: '#9fc3ff', 'stroke-width': 1.5}, art);
    for (const cx of [618, 690]) {
      el('path', {d: `M ${cx} 206 q 26 4 34 16 l -44 6 q -10 -14 10 -22 Z`, fill: 'rgba(28, 46, 76, .95)', stroke: '#9fc3ff', 'stroke-width': 1.5}, art);
    }
    // landing gear (nose + two main bogies), purely illustrative positions
    const gear = (x, label) => {
      el('line', {x1: x, y1: 200, x2: x, y2: 288, stroke: '#9fc3ff', 'stroke-width': 2}, art);
      el('circle', {cx: x, cy: 292, r: 7, fill: '#0c1422', stroke: '#9fc3ff', 'stroke-width': 2}, art);
      const tag = el('text', {x, y: 316, class: 'gear-tag'}, art);
      tag.textContent = label;
    };
    gear(px(980), 'nose gear');
    gear(px(1290), 'main gear');
    gear(px(1365), '');
    el('line', {x1: 10, y1: 300, x2: 990, y2: 300, stroke: '#33507c', 'stroke-width': 2}, art);
    // the swinging nose: forward of station 620, hinged at its top edge
    const nose = el('g', {id: 'nose-door'}, art);
    el('path', {
      d: 'M 300 116 L 300 198 C 210 198, 110 190, 60 176 C 40 172, 34 168, 34 166 C 60 138, 120 126, 190 122 Z',
      fill: 'rgba(20, 34, 58, .95)', stroke: 'var(--accent)', 'stroke-width': 2,
    }, nose);
    return art;
  }

  function buildDeck() {
    const deck = $('deck');
    const svg = el('svg', {viewBox: '0 0 1000 330', role: 'group', 'aria-label': '747 freighter side view with cargo stations'});
    deck.appendChild(svg);
    const art = aircraft(svg);
    for (const slot of C.SLOTS) {
      const y = slot.deck === 'main' ? MAIN_Y : LOWER_Y;
      const g = el('g', {
        class: 'slot free', id: `slot-${slot.id}`, tabindex: 0, role: 'button',
        'data-slot': slot.id,
        'aria-label': `${slot.deck} deck station ${slot.station}, empty`,
      }, art);
      el('rect', {class: 'box', x: px(slot.station) - 23, y, width: 46, height: 26, rx: 4}, g);
      const tag = el('text', {x: px(slot.station), y: slot.deck === 'main' ? y - 6 : y + 40, class: 'station-tag'}, svg);
      tag.textContent = slot.station;
      g.addEventListener('click', () => onSlot(slot.id));
      g.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSlot(slot.id); }
      });
    }
    const plumb = el('g', {class: 'plumb', id: 'plumb', 'aria-hidden': 'true'}, art);
    el('line', {id: 'plumb-line', x1: 0, y1: 64, x2: 0, y2: 268}, plumb);
    el('polygon', {id: 'plumb-bob', points: ''}, plumb);
    const plumbText = el('text', {id: 'plumb-text', x: 0, y: 52, 'text-anchor': 'middle'}, plumb);
    plumbText.textContent = 'CG';
  }

  function paintSlots() {
    const bySlot = new Map(state.items.filter(i => i.slot).map(i => [i.slot, i]));
    for (const slot of C.SLOTS) {
      const g = document.getElementById(`slot-${slot.id}`);
      const y = slot.deck === 'main' ? MAIN_Y : LOWER_Y;
      const item = bySlot.get(slot.id);
      g.classList.toggle('loaded', !!item);
      g.classList.toggle('free', !item);
      g.classList.toggle('arm', !item && state.selected !== null);
      g.querySelectorAll('.item, text').forEach(node => node.remove());
      g.setAttribute('aria-label', item
        ? `${C.TYPES[item.type].name}, ${item.weightLabel} pounds, ${slot.deck} deck station ${slot.station}`
        : `${slot.deck} deck station ${slot.station}, empty`);
      if (item) {
        el('rect', {class: 'item', x: px(slot.station) - 23, y, width: 46, height: 26, rx: 4, fill: C.TYPES[item.type].color}, g);
        const label = el('text', {x: px(slot.station), y: y + 17}, g);
        label.textContent = item.weightLabel;
      }
    }
  }

  function paintPlumb() {
    const v = C.verdict(state.items);
    const {cg} = C.compute(state.items);
    const x = px(C.LEMAC + cg / 100 * C.MAC);
    const plumb = document.getElementById('plumb');
    plumb.classList.toggle('bad', !v.ok && v.kind !== 'incomplete');
    document.getElementById('plumb-line').setAttribute('x1', x);
    document.getElementById('plumb-line').setAttribute('x2', x);
    document.getElementById('plumb-bob').setAttribute('points', `${x - 7},270 ${x + 7},270 ${x},282`);
    const text = document.getElementById('plumb-text');
    text.setAttribute('x', x);
    text.textContent = `CG ${cg.toFixed(1)}`;
  }

  /* ---------- chart ---------- */
  function buildChart() {
    const svg = el('svg', {viewBox: '0 0 460 340', role: 'img', 'aria-label': 'Weight and balance envelope chart'});
    $('chart').appendChild(svg);
    // envelope polygon between the weight-dependent limits
    const pts = [
      [C.fwdLimit(C.OEW), C.OEW], [C.fwdLimit(C.MZFW), C.MZFW],
      [C.aftLimit(C.MZFW), C.MZFW], [C.aftLimit(C.OEW), C.OEW],
    ];
    el('polygon', {points: pts.map(([m, w]) => `${chartX(m)},${chartY(w)}`).join(' '),
      fill: 'rgba(122, 192, 96, .13)', stroke: '#7ac060', 'stroke-width': 1.5}, svg);
    el('line', {x1: 40, y1: chartY(C.MZFW), x2: 448, y2: chartY(C.MZFW), stroke: '#e2654f', 'stroke-dasharray': '6 4'}, svg);
    const mzfw = el('text', {x: 444, y: chartY(C.MZFW) - 6, 'text-anchor': 'end', class: 'axis-note hot'}, svg);
    mzfw.textContent = 'zero-fuel limit 526k lb';
    for (let mac = 12; mac <= 36; mac += 4) {
      el('line', {x1: chartX(mac), y1: 296, x2: chartX(mac), y2: 301, stroke: '#33507c'}, svg);
      const t = el('text', {x: chartX(mac), y: 316, 'text-anchor': 'middle', class: 'axis-note'}, svg);
      t.textContent = mac;
    }
    for (let lb = 360000; lb <= 520000; lb += 40000) {
      el('line', {x1: 44, y1: chartY(lb), x2: 49, y2: chartY(lb), stroke: '#33507c'}, svg);
      const t = el('text', {x: 40, y: chartY(lb) + 4, 'text-anchor': 'end', class: 'axis-note'}, svg);
      t.textContent = `${lb / 1000}k`;
    }
    const empty = el('circle', {cx: chartX(C.OEW_CG), cy: chartY(C.OEW), r: 3.5, fill: '#8aa3c4'}, svg);
    empty.setAttribute('aria-label', 'empty aeroplane');
    el('polyline', {id: 'trail', fill: 'none', stroke: 'rgba(240, 182, 76, .55)', 'stroke-width': 2}, svg);
    el('line', {id: 'cg-axis', y1: 62, y2: 296, stroke: 'rgba(219, 232, 251, .3)', 'stroke-dasharray': '3 4'}, svg);
    el('circle', {id: 'cg-dot', r: 6, stroke: '#0c1422', 'stroke-width': 2}, svg);
    const xLab = el('text', {x: 246, y: 334, 'text-anchor': 'middle', class: 'axis-note'}, svg);
    xLab.textContent = 'centre of gravity, %MAC';
    const yLab = el('text', {x: 12, y: 176, class: 'axis-note', transform: 'rotate(-90 12 176)', 'text-anchor': 'middle'}, svg);
    yLab.textContent = 'weight, lb';
  }

  function paintChart() {
    const {weight, cg} = C.compute(state.items);
    const v = C.verdict(state.items);
    const x = chartX(Math.min(38, Math.max(10, cg)));
    const y = chartY(Math.min(540000, Math.max(340000, weight)));
    const trail = document.getElementById('trail');
    trail.setAttribute('points', state.trail.map(([w, m]) => `${chartX(Math.min(38, Math.max(10, m)))},${chartY(Math.min(540000, Math.max(340000, w)))}`).join(' '));
    const axis = document.getElementById('cg-axis');
    axis.setAttribute('x1', x); axis.setAttribute('x2', x);
    const dot = document.getElementById('cg-dot');
    dot.setAttribute('cx', x); dot.setAttribute('cy', y);
    dot.setAttribute('fill', v.ok ? '#7ac060' : (v.kind === 'incomplete' ? '#f0b64c' : '#e2654f'));
  }

  /* ---------- manifest / readouts ---------- */
  function paintManifest() {
    const list = $('manifest');
    list.textContent = '';
    if (!state.items.length) {
      const note = document.createElement('li');
      note.className = 'empty-note';
      note.textContent = 'Ramp is empty — add cargo from the catalog below.';
      list.appendChild(note);
    }
    state.items.forEach((item, index) => {
      const li = document.createElement('li');
      const button = document.createElement('button');
      const info = C.TYPES[item.type];
      const slot = item.slot ? C.SLOTS.find(s => s.id === item.slot) : null;
      button.innerHTML = `<span class="swatch" style="background:${info.color}"></span>
        <span class="name">${info.name}${slot ? '' : (state.selected === index ? ' — pick a station' : '')}</span>
        ${slot ? `<span class="where">${slot.deck === 'main' ? 'main' : 'lower'} · STA ${slot.station}</span>` : ''}
        <span class="lb">${item.weightLabel} lb</span>`;
      if (state.selected === index && !item.slot) button.classList.add('selected');
      if (slot) button.classList.add('loaded');
      button.setAttribute('aria-label', slot
        ? `Unload ${info.name} from ${slot.deck} deck station ${slot.station}`
        : `Select ${info.name}, ${item.weightLabel} pounds`);
      button.addEventListener('click', () => {
        if (item.slot) unload(item);
        else selectItem(index);
      });
      li.appendChild(button);
      list.appendChild(li);
    });
    const sandbox = C.MISSIONS[state.mission].sandbox;
    $('catalog').hidden = !sandbox;
  }

  function paintReadouts() {
    const {weight, cg} = C.compute(state.items);
    const v = C.verdict(state.items);
    $('zfw').textContent = `${Math.round(weight).toLocaleString()} lb`;
    $('zfw').classList.toggle('bad', weight > C.MZFW);
    $('zfw-limit').textContent = `zero-fuel limit ${C.MZFW.toLocaleString()} lb · payload ${Math.round(weight - C.OEW).toLocaleString()} lb`;
    $('cg').textContent = `${cg.toFixed(1)} %MAC`;
    $('cg').classList.toggle('bad', v.kind === 'nose' || v.kind === 'tail');
    $('cg-limit').textContent = `legal band ${v.fwd !== undefined ? v.fwd.toFixed(1) : C.fwdLimit(weight).toFixed(1)}–${v.aft !== undefined ? v.aft.toFixed(1) : C.aftLimit(weight).toFixed(1)}`;
    const box = $('verdict');
    box.textContent = v.message;
    box.className = `verdict ${v.ok ? 'ok' : (v.kind === 'incomplete' ? '' : 'bad')}`;
  }

  function paintAll() {
    paintSlots();
    paintPlumb();
    paintManifest();
    paintReadouts();
    paintChart();
  }

  /* ---------- interactions ---------- */
  function selectItem(index) {
    state.selected = state.selected === index ? null : index;
    paintManifest();
    paintSlots();
  }
  function onSlot(slotId) {
    const occupant = state.items.find(i => i.slot === slotId);
    if (occupant) { unload(occupant); return; }
    if (state.selected === null) return;
    state.items[state.selected].slot = slotId;
    state.selected = null;
    afterChange();
  }
  function unload(item) {
    item.slot = null;
    afterChange();
  }
  function afterChange() {
    state.dispatched = null;
    document.getElementById('aircraft').classList.remove('taxi', 'rotate');
    const nose = document.getElementById('nose-door');
    nose.style.transform = 'rotate(-34deg)';
    $('door-state').textContent = 'NOSE DOOR OPEN';
    $('door-state').classList.remove('closed');
    state.trail.push([C.compute(state.items).weight, C.compute(state.items).cg]);
    if (state.trail.length > 80) state.trail.shift();
    paintAll();
  }

  function loadMission(index) {
    state.mission = index;
    state.items = C.MISSIONS[index].cargo.map(type => ({
      type, slot: null, weightLabel: kfmt(C.TYPES[type].weight),
    }));
    state.selected = null;
    state.trail = [[C.OEW, C.OEW_CG]];
    document.querySelectorAll('.mission').forEach(button => {
      button.setAttribute('aria-selected', String(Number(button.dataset.mission) === index));
    });
    $('mission-brief').textContent = C.MISSIONS[index].brief;
    afterChange();
  }

  document.querySelectorAll('.mission').forEach(button =>
    button.addEventListener('click', () => loadMission(Number(button.dataset.mission))));
  $('dispatch').addEventListener('click', () => {
    const v = C.verdict(state.items);
    state.dispatched = v;
    if (v.ok) {
      const nose = document.getElementById('nose-door');
      nose.style.transform = 'rotate(0deg)';
      $('door-state').textContent = 'NOSE DOOR CLOSED';
      $('door-state').classList.add('closed');
      const art = document.getElementById('aircraft');
      art.classList.add('taxi');
      art.style.transform = 'translateX(46px) rotate(-2.4deg)';
      art.style.transformOrigin = `${px(1330)}px 296px`;
    } else {
      document.getElementById('aircraft').classList.remove('taxi');
      document.getElementById('aircraft').style.transform = '';
    }
    paintReadouts();
  });
  $('unload').addEventListener('click', () => { loadMission(state.mission); });
  $('catalog-buttons').innerHTML = Object.entries(C.TYPES)
    .map(([key, info]) => `<button data-add="${key}">${info.name.toLowerCase()}</button>`).join('');
  $('catalog-buttons').addEventListener('click', e => {
    const button = e.target.closest('[data-add]');
    if (!button) return;
    state.items.push({type: button.dataset.add, slot: null, weightLabel: kfmt(C.TYPES[button.dataset.add].weight)});
    afterChange();
  });

  buildDeck();
  buildChart();
  loadMission(0);
  window.jumboLoader = {
    getState: () => ({
      mission: state.mission,
      items: state.items.map(({type, slot}) => ({type, slot})),
      selected: state.selected,
      trail: state.trail.map(([w, m]) => [w, m]),
      dispatched: state.dispatched && {...state.dispatched},
    }),
    loadMission,
    selectItem, onSlot,
  };
})();
