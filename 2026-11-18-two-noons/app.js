'use strict';
// Two Noons: 18 November 1883, the day the US and Canadian railroads moved
// every station clock from local mean time to one of five standard meridians.
// Time is kept as Greenwich minutes since midnight (GMT) on that Sunday.

const T0 = 930, T1 = 1230;                    // 15:30 → 20:30 GMT
const ZONES = [
  { m: 60, name: 'INTERCOLONIAL' }, { m: 75, name: 'EASTERN' }, { m: 90, name: 'CENTRAL' },
  { m: 105, name: 'MOUNTAIN' }, { m: 120, name: 'PACIFIC' },
];
// City-centre longitudes (° W) and latitudes; `at` is where the label sits.
const CITIES = [
  ['halifax', 'Halifax', 63.57, 44.65, 'r'],
  ['saintjohn', 'Saint John', 66.06, 45.27, 't'],
  ['boston', 'Boston', 71.06, 42.36, 'r'],
  ['montreal', 'Montreal', 73.57, 45.50, 't'],
  ['newyork', 'New York', 74.006, 40.71, 't'],
  ['philadelphia', 'Philadelphia', 75.16, 39.95, 'r'],
  ['washington', 'Washington', 77.04, 38.90, 'b'],
  ['toronto', 'Toronto', 79.38, 43.65, 't'],
  ['pittsburgh', 'Pittsburgh', 80.00, 40.44, 'l'],
  ['detroit', 'Detroit', 83.05, 42.33, 't'],
  ['chicago', 'Chicago', 87.63, 41.88, 'l'],
  ['stlouis', 'St. Louis', 90.20, 38.63, 't'],
  ['neworleans', 'New Orleans', 90.07, 29.95, 'r'],
  ['minneapolis', 'Minneapolis', 93.27, 44.98, 't'],
  ['omaha', 'Omaha', 95.94, 41.26, 'l'],
  ['kansascity', 'Kansas City', 94.58, 39.10, 'b'],
  ['denver', 'Denver', 104.99, 39.74, 'r'],
  ['saltlake', 'Salt Lake City', 111.89, 40.76, 'l'],
  ['portland', 'Portland', 122.68, 45.52, 'r'],
  ['sanfrancisco', 'San Francisco', 122.42, 37.77, 'r'],
  ['losangeles', 'Los Angeles', 118.24, 34.05, 'r'],
].map(([id, name, lon, lat, at]) => makeTown(id, name, lon, lat, at));

function makeTown(id, name, lon, lat, at) {
  const zone = ZONES.reduce((a, z) => Math.abs(z.m - lon) < Math.abs(a.m - lon) ? z : a);
  return {
    id, name, lon, lat, at, zone,
    off: (zone.m - lon) * 4,                  // local minus standard, minutes (+ = set back)
    reset: 720 + zone.m * 4,                  // GMT minute of the zone's standard noon
    sunNoon: 720 + lon * 4,                   // GMT minute of local mean noon
  };
}

const S = { t: T0, playing: false, speed: 5, manual: false, selected: 'newyork', pin: null };
const $ = (id) => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, text) => {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (text != null) e.textContent = text;
  return e;
};

// ---------- time helpers ----------
const sunTime = (town, t) => t - town.lon * 4;
const stdTime = (town, t) => t - town.zone.m * 4;
const stationTime = (town, t) => (t < town.reset ? sunTime(town, t) : stdTime(town, t));
function hms(min) {
  const s = Math.round((((min % 1440) + 1440) % 1440) * 60);
  const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`;
}
const hm = (min) => hms(min).slice(0, 5);
function span(min) {                          // 3.97 → "3 min 58 s"
  const s = Math.round(Math.abs(min) * 60);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
}
function short(min) {                         // 3.97 → "−3:58"
  const s = Math.round(Math.abs(min) * 60);
  return `${min > 0 ? '−' : '+'}${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
const towns = () => (S.pin ? [...CITIES, S.pin] : CITIES);
const townById = (id) => towns().find((c) => c.id === id) || CITIES[5];

// ---------- map ----------
const W = 1000, H = 560, LON_E = 52.5, LON_W = 127.5, LAT_N = 48, LAT_S = 28, TOP = 44, BOT = 520;
const X = (lon) => (LON_W - lon) / (LON_W - LON_E) * W;
const Y = (lat) => TOP + (LAT_N - lat) / (LAT_N - LAT_S) * (BOT - TOP);
const LON = (x) => LON_W - x / W * (LON_W - LON_E);
const LAT = (y) => LAT_N - (y - TOP) / (BOT - TOP) * (LAT_N - LAT_S);

const map = $('map');
const M = {};
function buildMap() {
  map.textContent = '';
  ZONES.forEach((z, i) => {
    const x0 = X(z.m + 7.5), x1 = X(z.m - 7.5);
    map.append(el('rect', { x: x0, y: 0, width: x1 - x0, height: H, fill: i % 2 ? '#f5efe2' : '#ebe1cc' }));
  });
  for (let lat = 30; lat <= 45; lat += 5) {
    map.append(el('line', { x1: 0, x2: W, y1: Y(lat), y2: Y(lat), stroke: '#d8ccb4', 'stroke-width': 0.6 }));
    map.append(el('text', { x: 4, y: Y(lat) - 3, 'font-size': 9, fill: '#a79b84' }, `${lat}°N`));
  }
  M.zone = ZONES.map((z) => {
    const g = el('g');
    const x = X(z.m);
    const line = el('line', { x1: x, x2: x, y1: 34, y2: BOT + 4, stroke: '#7d7362', 'stroke-width': 1, 'stroke-dasharray': '4 4' });
    const name = el('text', { x, y: 14, 'text-anchor': 'middle', 'font-size': 10, 'font-weight': 700, 'letter-spacing': 1.2, fill: '#24201a' }, `${z.name} · ${z.m}°W`);
    const clock = el('text', { x, y: 29, 'text-anchor': 'middle', 'font-size': 11, 'font-family': 'ui-monospace, Menlo, monospace', fill: '#7d7362' });
    const foot = el('text', { x, y: BOT + 20, 'text-anchor': 'middle', 'font-size': 10, fill: '#7d7362' }, `noon at ${hm(720 + z.m * 4)} GMT`);
    g.append(line, name, clock, foot);
    map.append(g);
    return { line, clock, name, z };
  });
  // the sweeping line of local mean noon
  M.sun = el('g');
  M.sun.append(el('line', { x1: 0, x2: 0, y1: 40, y2: BOT, stroke: '#d99a1e', 'stroke-width': 3, opacity: 0.85 }));
  M.sun.append(el('circle', { cx: 0, cy: BOT + 8, r: 7, fill: '#d99a1e' }));
  M.sunLabel = el('text', { x: 10, y: BOT + 34, 'font-size': 10, fill: '#a26d0c', 'font-weight': 700 });
  M.sun.append(M.sunLabel);
  map.append(M.sun);
  M.towns = new Map();
  M.layer = el('g');
  map.append(M.layer);
  towns().forEach(addTownMark);
}

function addTownMark(c) {
  const x = X(c.lon), y = Y(c.lat);
  const g = el('g', { class: 'town', 'data-id': c.id, style: 'cursor:pointer' });
  const pulse = el('circle', { cx: x, cy: y, r: 6, fill: 'none', 'stroke-width': 2, opacity: 0 });
  const ring = el('circle', { cx: x, cy: y, r: 8.5, fill: 'none', stroke: '#24201a', 'stroke-width': 1.5, opacity: 0 });
  const dot = el('circle', { cx: x, cy: y, r: c.id === 'pin' ? 5.5 : 4.5, fill: '#24201a', stroke: '#fbf7ee', 'stroke-width': 1.5 });
  const pos = { r: [x + 9, y - 1, 'start'], l: [x - 9, y - 1, 'end'], t: [x, y - 20, 'middle'], b: [x, y + 15, 'middle'] }[c.at];
  const name = el('text', { x: pos[0], y: pos[1], 'text-anchor': pos[2], 'font-size': 9.5, 'letter-spacing': 0.6, fill: '#4a4336' }, c.name.toUpperCase());
  const clock = el('text', { x: pos[0], y: pos[1] + 12, 'text-anchor': pos[2], 'font-size': 11.5, 'font-weight': 700, 'font-family': 'ui-monospace, Menlo, monospace', fill: '#24201a' });
  const delta = el('text', { x: pos[0], y: pos[1] + 12, 'font-size': 10, 'font-weight': 700, 'font-family': 'ui-monospace, Menlo, monospace' });
  g.append(pulse, ring, dot, name, clock, delta);
  g.addEventListener('click', (e) => { e.stopPropagation(); select(c.id); });
  M.layer.append(g);
  M.towns.set(c.id, { g, pulse, ring, dot, clock, delta, pos });
}

map.addEventListener('click', (e) => {
  const p = map.createSVGPoint();
  p.x = e.clientX; p.y = e.clientY;
  const q = p.matrixTransform(map.getScreenCTM().inverse());
  if (q.y < TOP - 6 || q.y > BOT + 2) return;
  pin(LON(q.x), LAT(q.y));
});

function pin(lon, lat) {
  // pins snap to the nearest half degree, so the offsets come out in round minutes
  lon = Math.min(126.5, Math.max(53.5, Math.round(lon * 2) / 2));
  lat = Math.round(lat * 2) / 2;
  if (S.pin) M.towns.get('pin').g.remove();
  S.pin = makeTown('pin', 'Your pin', lon, lat, lon > 118 ? 'r' : 'l');
  addTownMark(S.pin);
  select('pin');
}

// ---------- clock faces ----------
function buildFace(svg) {
  svg.textContent = '';
  svg.append(el('circle', { cx: 60, cy: 60, r: 56, fill: '#fff', stroke: '#24201a', 'stroke-width': 2.5 }));
  for (let i = 0; i < 60; i++) {
    const a = i * Math.PI / 30, big = i % 5 === 0;
    const r0 = big ? 45 : 50;
    svg.append(el('line', { x1: 60 + Math.sin(a) * r0, y1: 60 - Math.cos(a) * r0, x2: 60 + Math.sin(a) * 53, y2: 60 - Math.cos(a) * 53, stroke: '#24201a', 'stroke-width': big ? 2.2 : 0.8 }));
  }
  svg.append(el('text', { x: 60, y: 30, 'text-anchor': 'middle', 'font-size': 12, 'font-family': 'Georgia, serif', fill: '#24201a' }, 'XII'));
  const hand = (len, w, color) => { const l = el('line', { x1: 60, y1: 60, x2: 60, y2: 60 - len, stroke: color, 'stroke-width': w, 'stroke-linecap': 'round' }); svg.append(l); return l; };
  const hands = { h: hand(28, 4.5, '#24201a'), m: hand(42, 3, '#24201a'), s: hand(46, 1.2, '#b8392b') };
  svg.append(el('circle', { cx: 60, cy: 60, r: 3.5, fill: '#b8392b' }));
  return hands;
}
function setFace(hands, min) {
  const m = ((min % 720) + 720) % 720;
  hands.h.setAttribute('transform', `rotate(${m / 2} 60 60)`);
  hands.m.setAttribute('transform', `rotate(${(m % 60) * 6} 60 60)`);
  hands.s.setAttribute('transform', `rotate(${Math.round((m * 60) % 60) * 6} 60 60)`);
}
const FACE = { sun: buildFace($('face-sun')), station: buildFace($('face-station')) };

// ---------- trace: station clock against GMT around the reset ----------
function drawTrace(c) {
  const svg = $('trace');
  svg.textContent = '';
  const ta = c.reset - 45, tb = c.reset + 45, ya = 690, yb = 750;   // clock 11:30 → 12:30
  const px = (t) => 36 + (t - ta) / (tb - ta) * 330;
  const py = (v) => 150 - (v - ya) / (yb - ya) * 140;
  const clip = el('clipPath', { id: 'trace-clip' });
  clip.append(el('rect', { x: 36, y: 4, width: 330, height: 150 }));
  svg.append(clip);
  for (const v of [690, 705, 720, 735, 750]) {
    svg.append(el('line', { x1: 36, x2: 366, y1: py(v), y2: py(v), stroke: v === 720 ? '#b8392b' : '#eee6d6', 'stroke-width': v === 720 ? 1 : 1, 'stroke-dasharray': v === 720 ? '3 3' : '' }));
    svg.append(el('text', { x: 2, y: py(v) + 3 }, hm(v)));
  }
  for (const t of [ta, c.reset, tb]) svg.append(el('text', { x: px(t), y: 166, 'text-anchor': 'middle' }, `${hm(t)} GMT`));
  const line = (f, a, b, attrs) => {
    let d = '';
    if (b <= a) return;
    for (let i = 0; i <= 60; i++) { const t = a + (b - a) * i / 60; d += `${i ? 'L' : 'M'}${px(t).toFixed(1)},${py(f(t)).toFixed(1)}`; }
    svg.append(el('path', { d, fill: 'none', 'clip-path': 'url(#trace-clip)', ...attrs }));
  };
  line((t) => sunTime(c, t), ta, tb, { stroke: '#d99a1e', 'stroke-width': 2, 'stroke-dasharray': '5 4' });
  const now = Math.max(ta, Math.min(tb, S.t));
  if (S.t > ta) {
    line((t) => sunTime(c, t), ta, Math.min(now, c.reset), { stroke: '#24201a', 'stroke-width': 2.5 });
    if (S.t >= c.reset) {
      svg.append(el('line', { x1: px(c.reset), x2: px(c.reset), y1: py(sunTime(c, c.reset)), y2: py(720), stroke: c.off > 0 ? '#b8392b' : '#2e5f8f', 'stroke-width': 2.5 }));
      line((t) => stdTime(c, t), c.reset, Math.max(c.reset, now), { stroke: '#24201a', 'stroke-width': 2.5 });
    }
  }
  // the moments the station clock reads 12:00:00
  const strikes = [];
  if (c.off > 0) strikes.push(c.sunNoon);
  strikes.push(c.reset);
  for (const t of strikes) if (t >= ta && S.t >= t) svg.append(el('circle', { cx: px(t), cy: py(720), r: 4.5, fill: '#b8392b', stroke: '#fff', 'stroke-width': 1.5 }));
  if (S.t >= ta && S.t <= tb) svg.append(el('line', { x1: px(S.t), x2: px(S.t), y1: 6, y2: 152, stroke: '#7d7362', 'stroke-width': 1 }));
}

// ---------- side panel ----------
function verdict(c) {
  const z = c.zone, zn = z.name[0] + z.name.slice(1).toLowerCase();
  const dist = Math.abs(c.lon - z.m).toFixed(2);
  const side = c.off > 0 ? 'east' : 'west';
  if (S.t < c.reset) {
    return c.off > 0
      ? `${dist}° ${side} of the ${z.m}° meridian, so the sun reaches noon here ${span(c.off)} before ${zn} noon (${hm(c.reset)} GMT). Then the station clock will be <b class="red">set back ${span(c.off)}</b>.`
      : `${dist}° ${side} of the ${z.m}° meridian, so ${zn} noon (${hm(c.reset)} GMT) arrives while the station clock still reads ${hms(sunTime(c, c.reset))}. It will <b class="blue">jump forward ${span(c.off)}</b>.`;
  }
  return c.off > 0
    ? `<b class="red">Set back ${span(c.off)}.</b> Noon struck twice: by the sun at ${hms(c.sunNoon - z.m * 4)} ${zn} time, then again by the railroad at ${hm(c.reset)} GMT.`
    : `<b class="blue">Jumped forward ${span(c.off)}.</b> The station clock never showed ${hms(sunTime(c, c.reset))}–11:59:59 today. The sun crosses this meridian at ${hms(c.sunNoon - z.m * 4)} ${zn} time.`;
}

function select(id) {
  S.selected = id;
  render();
}

// ---------- render ----------
function render() {
  const t = S.t;
  $('gmt-label').textContent = `${hms(t)} GMT · SUNDAY 18 NOV 1883`;
  $('time').value = t;
  const noonLon = (t - 720) / 4;
  M.sun.setAttribute('transform', `translate(${X(noonLon)} 0)`);
  M.sun.style.display = noonLon > LON_E && noonLon < LON_W ? '' : 'none';
  M.sunLabel.textContent = `local noon · ${noonLon.toFixed(1)}°W`;
  M.sunLabel.setAttribute('text-anchor', noonLon < 64 ? 'end' : 'start');
  M.sunLabel.setAttribute('x', noonLon < 64 ? -10 : 10);
  for (const zz of M.zone) {
    const v = t - zz.z.m * 4;
    const hot = Math.abs(t - (720 + zz.z.m * 4)) < 2.5;
    zz.clock.textContent = `${hms(v)}`;
    zz.clock.setAttribute('fill', hot ? '#b8392b' : '#7d7362');
    zz.clock.setAttribute('font-weight', hot ? 700 : 400);
    zz.line.setAttribute('stroke', hot ? '#b8392b' : '#7d7362');
    zz.line.setAttribute('stroke-width', hot ? 2.5 : 1);
  }
  let done = 0, twice = 0, skip = 0;
  for (const c of towns()) {
    const m = M.towns.get(c.id);
    const after = t >= c.reset, color = c.off > 0 ? '#b8392b' : '#2e5f8f';
    m.clock.textContent = hms(stationTime(c, t));
    m.dot.setAttribute('fill', after ? color : '#24201a');
    m.ring.setAttribute('opacity', c.id === S.selected ? 1 : 0);
    const since = t - c.reset;
    const p = since >= 0 && since < 6 ? since / 6 : -1;
    m.pulse.setAttribute('opacity', p < 0 ? 0 : 1 - p);
    m.pulse.setAttribute('r', 6 + 26 * Math.max(0, p));
    m.pulse.setAttribute('stroke', color);
    m.delta.textContent = after ? short(c.off) : '';
    m.delta.setAttribute('fill', color);
    const w = m.clock.getComputedTextLength ? m.clock.getComputedTextLength() : 56;
    const anchor = m.pos[2], gap = 5;
    m.delta.setAttribute('text-anchor', anchor === 'end' ? 'end' : 'start');
    m.delta.setAttribute('x', anchor === 'start' ? m.pos[0] + w + gap : anchor === 'end' ? m.pos[0] - w - gap : m.pos[0] + w / 2 + gap);
    if (c.id === 'pin') continue;
    if (after) { done++; if (c.off > 0) twice++; else skip++; }
  }
  $('st-reset').textContent = `${done} / ${CITIES.length}`;
  $('st-twice').textContent = twice;
  $('st-skip').textContent = skip;

  const c = townById(S.selected);
  $('town-name').textContent = c.name.toUpperCase();
  $('town-lon').textContent = `· ${c.lon.toFixed(2)}°W · ${c.zone.name.toLowerCase()} zone`;
  setFace(FACE.sun, sunTime(c, t));
  setFace(FACE.station, stationTime(c, t));
  $('sun-time').textContent = hms(sunTime(c, t));
  $('station-time').textContent = hms(stationTime(c, t));
  $('verdict').innerHTML = verdict(c);
  drawTrace(c);

  const list = $('towns');
  if (list.children.length !== towns().length) {
    list.textContent = '';
    for (const town of towns()) {
      const li = document.createElement('li');
      li.dataset.id = town.id;
      li.innerHTML = `<span>${town.id === 'pin' ? 'Your pin' : town.name}</span><span class="d"></span>`;
      li.addEventListener('click', () => select(town.id));
      list.append(li);
    }
  }
  for (const li of list.children) {
    const town = townById(li.dataset.id);
    const after = t >= town.reset;
    li.className = `${after ? (town.off > 0 ? 'back' : 'fwd') : ''} ${town.id === S.selected ? 'sel' : ''}`;
    li.lastChild.textContent = after ? short(town.off) : `at ${hm(town.reset)}`;
  }
  $('play').textContent = S.playing ? '❚❚ PAUSE' : t >= T1 ? '↺ RUN IT AGAIN' : '▶ RUN THE DAY';
  $('play').setAttribute('aria-pressed', S.playing);
  for (const b of $('speeds').children) b.classList.toggle('on', +b.dataset.speed === S.speed);
}

// ---------- controls ----------
function setTime(t) { S.t = Math.max(T0, Math.min(T1, t)); if (S.t >= T1) S.playing = false; render(); }
$('time').addEventListener('input', (e) => { S.playing = false; setTime(+e.target.value); });
$('play').addEventListener('click', () => {
  if (S.t >= T1) S.t = T0;
  S.playing = !S.playing;
  last = null;
  render();
});
for (const b of $('speeds').children) b.addEventListener('click', () => { S.speed = +b.dataset.speed; render(); });
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' && e.key !== ' ') return;
  if (e.key === ' ') { e.preventDefault(); $('play').click(); }
  else if (e.key === 'ArrowRight') setTime(S.t + 1);
  else if (e.key === 'ArrowLeft') setTime(S.t - 1);
});

let last = null;
function frame(now) {
  if (S.playing && !S.manual) {
    if (last != null) setTime(S.t + Math.min(0.1, (now - last) / 1000) * S.speed);
    last = now;
  } else last = null;
  requestAnimationFrame(frame);
}

window.Noons = {
  manual(on) { S.manual = !!on; },
  setTime,
  step(min) { setTime(S.t + min); },
  select,
  pin,
  play() { if (!S.playing) $('play').click(); },
  getState() {
    const c = townById(S.selected);
    const all = CITIES.filter((x) => S.t >= x.reset);
    return {
      t: S.t, playing: S.playing, speed: S.speed, selected: S.selected,
      reset: all.length, twice: all.filter((x) => x.off > 0).length, skip: all.filter((x) => x.off <= 0).length,
      town: { id: c.id, lon: c.lon, zone: c.zone.m, off: c.off, reset: c.reset, sun: sunTime(c, S.t), station: stationTime(c, S.t) },
    };
  },
  _cities: () => CITIES.map(({ id, lon, off, reset, zone }) => ({ id, lon, off, reset, zone: zone.m })),
};

buildMap();
render();
requestAnimationFrame(frame);
