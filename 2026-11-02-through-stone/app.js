'use strict';

// A deliberately small 2-D model: straight rays, one uniform material and a
// fixed incoming flux per direction. Values are illustrative, not field data.
(() => {
  const DETECTOR = {x: 500, y: 505};
  const TRIANGLE = [{x: 78, y: 530}, {x: 500, y: 75}, {x: 922, y: 530}];
  const VOID = {left: 545, right: 635, top: 240, bottom: 300};
  const ANGLES = Array.from({length: 17}, (_, i) => -48 + i * 6);
  const FLUX_PER_DAY = 90;
  const ATTENUATION = 0.0052;
  const NS = 'http://www.w3.org/2000/svg';
  let days = 30;
  let selected = ANGLES.indexOf(18);
  let revealed = false;

  const $ = selector => document.querySelector(selector);
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const vector = (a, b) => ({x: b.x - a.x, y: b.y - a.y});
  const formatAngle = angle => `${angle > 0 ? '+' : angle < 0 ? '−' : ''}${Math.abs(angle)}°`;
  const number = n => Math.round(n).toLocaleString('en-US');

  function geometry(angle) {
    const radians = angle * Math.PI / 180;
    const direction = {x: Math.sin(radians), y: -Math.cos(radians)};
    const exits = [];
    for (let i = 0; i < TRIANGLE.length; i++) {
      const a = TRIANGLE[i], b = TRIANGLE[(i + 1) % TRIANGLE.length];
      const side = vector(a, b), fromDetector = vector(DETECTOR, a);
      const denominator = cross(direction, side);
      if (Math.abs(denominator) < 1e-9) continue;
      const t = cross(fromDetector, side) / denominator;
      const u = cross(fromDetector, direction) / denominator;
      if (t >= 0 && u >= 0 && u <= 1) exits.push(t);
    }
    const exit = Math.min(...exits);
    let start = 0, end = exit;
    for (const [origin, component, low, high] of [
      [DETECTOR.x, direction.x, VOID.left, VOID.right],
      [DETECTOR.y, direction.y, VOID.top, VOID.bottom]
    ]) {
      if (Math.abs(component) < 1e-9) {
        if (origin < low || origin > high) end = -1;
      } else {
        const t1 = (low - origin) / component, t2 = (high - origin) / component;
        start = Math.max(start, Math.min(t1, t2));
        end = Math.min(end, Math.max(t1, t2));
      }
    }
    return {direction, exit, voidLength: Math.max(0, end - start)};
  }

  // Seed each directional bin independently. A longer exposure extends the
  // same sequence of trials, so the counts never jump backwards with time.
  function countArrivals(index, trials, probability) {
    let state = (0x9e3779b9 ^ Math.imul(index + 1, 0x85ebca6b)) >>> 0;
    let accepted = 0;
    for (let i = 0; i < trials; i++) {
      state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
      if ((state >>> 0) / 4294967296 < probability) accepted++;
    }
    return accepted;
  }

  function getData() {
    const trials = days * FLUX_PER_DAY;
    return ANGLES.map((angle, index) => {
      const path = geometry(angle);
      const solidProbability = Math.exp(-ATTENUATION * path.exit);
      const probability = Math.exp(-ATTENUATION * (path.exit - path.voidLength));
      return {...path, angle, count: countArrivals(index, trials, probability), reference: trials * solidProbability};
    });
  }

  function renderRays(data) {
    const rays = $('#rays');
    rays.replaceChildren();
    data.forEach((item, index) => {
      const line = document.createElementNS(NS, 'line');
      const outside = item.exit + 95;
      line.setAttribute('x1', DETECTOR.x + item.direction.x * outside);
      line.setAttribute('y1', DETECTOR.y + item.direction.y * outside);
      line.setAttribute('x2', DETECTOR.x);
      line.setAttribute('y2', DETECTOR.y);
      line.setAttribute('stroke', index === selected ? '#c5ffe0' : '#e1ffdf');
      line.setAttribute('stroke-opacity', index === selected ? '.95' : '.16');
      line.setAttribute('stroke-width', index === selected ? '3.5' : '1.5');
      if (index !== selected) line.setAttribute('stroke-dasharray', '5 9');
      rays.appendChild(line);
    });
    // Draw the selected ray last, above the others.
    rays.appendChild(rays.children[selected]);
    $('#cavity').setAttribute('opacity', revealed ? '1' : '0');
    $('#scene-angle').textContent = formatAngle(data[selected].angle);
  }

  function render() {
    const data = getData();
    const chart = $('#chart');
    const maximum = Math.max(...data.flatMap(d => [d.count, d.reference])) * 1.1;
    chart.replaceChildren();
    data.forEach((item, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-pressed', String(index === selected));
      button.setAttribute('aria-label', `${formatAngle(item.angle)}, ${number(item.count)} simulated counts, solid reference ${number(item.reference)}`);
      button.style.setProperty('--height', `${item.count / maximum * 100}%`);
      button.style.setProperty('--baseline', `${item.reference / maximum * 100}%`);
      const bar = document.createElement('span'), marker = document.createElement('span');
      bar.className = 'bar'; marker.className = 'marker';
      button.append(bar, marker);
      button.addEventListener('click', () => { selected = index; render(); $('#chart').children[index].focus(); });
      chart.appendChild(button);
    });
    const item = data[selected];
    const difference = Math.round(item.count - item.reference);
    $('#angle-value').textContent = formatAngle(item.angle);
    $('#count-value').textContent = number(item.count);
    $('#reference-value').textContent = number(item.reference);
    $('#difference-value').textContent = `${difference > 0 ? '+' : difference < 0 ? '−' : ''}${number(Math.abs(difference))}`;
    $('#selection-note').textContent = 'The line on each bar is the expected count if that direction were solid stone. Counts fluctuate.';
    renderRays(data);
  }

  document.querySelectorAll('[data-days]').forEach(button => button.addEventListener('click', () => {
    days = Number(button.dataset.days);
    document.querySelectorAll('[data-days]').forEach(other => other.setAttribute('aria-pressed', String(other === button)));
    render();
  }));
  $('#reveal').addEventListener('click', event => {
    revealed = !revealed;
    event.currentTarget.setAttribute('aria-pressed', String(revealed));
    event.currentTarget.innerHTML = `<span class="reveal-icon">◉</span> ${revealed ? 'Hide the space' : 'Reveal the hidden space'}`;
    render();
  });
  render();
})();
