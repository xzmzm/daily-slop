'use strict';

const initialLoads = [8, 6, 4, 0, 8, 0, 4, 6];
const canvas = document.querySelector('#rig');
const rig = canvas.getContext('2d');
const plot = document.querySelector('#plot');
const graph = plot.getContext('2d');
const cabinet = document.querySelector('#cabins');
const selection = document.querySelector('#selection');
const slider = document.querySelector('#angle');
const degrees = document.querySelector('#degrees');
const turn = document.querySelector('#turn');
const torque = document.querySelector('#torque');
const direction = document.querySelector('#direction');
const peak = document.querySelector('#peak');
const verdict = document.querySelector('#verdict');
const cx = 520;
const cy = 368;
const rim = 297;
const radians = Math.PI / 180;

let loads = [...initialLoads];
let selected = null;
let angle = 0;
let frame = null;

const cabins = loads.map((_, index) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cabin';
  const letter = document.createElement('span');
  letter.textContent = String.fromCharCode(65 + index);
  letter.setAttribute('aria-hidden', 'true');
  const number = document.createElement('strong');
  number.setAttribute('aria-hidden', 'true');
  button.append(letter, number);
  button.addEventListener('click', () => selectCabin(index));
  cabinet.append(button);
  return { button, letter, number };
});

function path(ctx, points, color, width = 1) {
  ctx.beginPath();
  points.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function ring(x, y, radius, color, width, fill) {
  rig.beginPath();
  rig.arc(x, y, radius, 0, 2 * Math.PI);
  if (fill) {
    rig.fillStyle = fill;
    rig.fill();
  }
  rig.strokeStyle = color;
  rig.lineWidth = width;
  rig.stroke();
}

function drawRig() {
  rig.clearRect(0, 0, canvas.width, canvas.height);
  // Fixed tower and platform sit behind the revolving truss.
  path(rig, [[348, 741], [cx, cy], [692, 741]], '#bd8c9a', 5);
  path(rig, [[393, 642], [647, 642], [433, 553], [607, 553]], '#916a85', 2);
  path(rig, [[196, 742], [844, 742]], '#cf9fa9', 3);
  path(rig, [[260, 757], [780, 757]], '#66475f', 2);
  rig.setLineDash([6, 8]);
  path(rig, [[116, cy], [924, cy]], '#85617e', 1);
  path(rig, [[cx, 35], [cx, 713]], '#85617e', 1);
  rig.setLineDash([]);

  ring(cx, cy, rim, '#ddaa91', 4);
  ring(cx, cy, rim - 14, '#a87587', 2);
  ring(cx, cy, 62, '#a87587', 2);

  const point = (a, distance) => [cx + Math.sin(a) * distance, cy - Math.cos(a) * distance];
  for (let index = 0; index < 32; index++) {
    const phase = (angle + index * 11.25) * radians;
    const [x, y] = point(phase, rim);
    const major = index % 4 === 0;
    path(rig, [point(phase, 62), point(phase, major ? rim : rim - 15)],
      major ? '#c99394' : '#725269', major ? 2.4 : 1.2);
    if (major) {
      ring(x, y, 6, '#ebbd87', 1, '#ebbd87');
      const { button } = cabins[index / 4];
      button.style.left = `${x / canvas.width * 100}%`;
      button.style.top = `${(y + 8) / canvas.height * 100}%`;
    }
  }

  ring(cx, cy, 25, '#e0ab93', 3, '#4c304b');
  ring(cx, cy, 7, '#f3ca7b', 1, '#f3ca7b');
}

function moments() {
  return loads.reduce(({ side, top }, riders, index) => {
    const phase = index * 45 * radians;
    return {
      side: side + riders * Math.sin(phase),
      top: top + riders * Math.cos(phase),
    };
  }, { side: 0, top: 0 });
}

function momentAt({ side, top }, degrees) {
  return side * Math.cos(degrees * radians) + top * Math.sin(degrees * radians);
}

function drawPlot(load, maximum) {
  const w = plot.width;
  const h = plot.height;
  const scale = Math.max(10, Math.ceil(maximum / 5) * 5);
  const y = value => h / 2 - (h / 2 - 15) * value / scale;
  graph.clearRect(0, 0, w, h);
  for (let index = 0; index <= 4; index++) {
    const x = 1 + index * (w - 2) / 4;
    path(graph, [[x, 0], [x, h]], '#d5b6a5', 2);
  }
  path(graph, [[0, h / 2], [w, h / 2]], '#a47c8e', 2);

  const points = Array.from({ length: 121 }, (_, i) =>
    [5 + (w - 10) * i / 120, y(momentAt(load, 3 * i))]);
  graph.lineJoin = 'round';
  path(graph, points, '#7f3966', 4);
  const x = 5 + (w - 10) * angle / 360;
  path(graph, [[x, 0], [x, h]], '#9d5a6e', 2);
  graph.beginPath();
  graph.arc(x, y(momentAt(load, angle)), 8, 0, 2 * Math.PI);
  graph.fillStyle = '#692b55';
  graph.fill();
}

function render() {
  const load = moments();
  const maximum = Math.hypot(load.side, load.top);
  const balanced = maximum < 1e-9;
  const current = momentAt(load, angle);
  const stationary = Math.abs(current) < 0.05;
  const roundedAngle = Math.round(angle);
  const message = balanced ? 'Balanced through the entire turn.'
    : stationary ? 'Balanced here. Gravity still turns the wheel at other angles.'
    : 'Gravity pulls harder on one side of the axle.';

  if (verdict.textContent !== message) verdict.textContent = message;
  verdict.classList.toggle('solved', balanced);
  torque.textContent = stationary ? '0.0' : `${current > 0 ? '+' : '−'}${Math.abs(current).toFixed(1)}`;
  peak.textContent = maximum.toFixed(1);
  direction.textContent = stationary ? 'No turning force' : current > 0 ? 'Clockwise' : 'Counterclockwise';
  plot.setAttribute('aria-label', `Turning moment across a full revolution, peak ${maximum.toFixed(1)} rider times radius units`);
  slider.value = roundedAngle;
  slider.setAttribute('aria-valuetext', `${roundedAngle} degrees`);
  degrees.value = `${roundedAngle}°`;
  drawRig();
  drawPlot(load, maximum);
}

function updateCabins(message) {
  cabins.forEach(({ button, letter, number }, index) => {
    const count = loads[index];
    number.textContent = count;
    button.classList.toggle('empty', count === 0);
    button.setAttribute('aria-label', `Cabin ${letter.textContent}, ${count} riders`);
    button.setAttribute('aria-pressed', index === selected);
  });
  selection.textContent = message;
}

function selectCabin(index) {
  stopTurn();
  if (selected === null) {
    selected = index;
    updateCabins(`Cabin ${cabins[index].letter.textContent} selected. Pick a second cabin.`);
    return;
  }
  const first = selected;
  selected = null;
  if (first === index) {
    updateCabins('Select two cabins to swap their riders.');
    return;
  }

  [loads[first], loads[index]] = [loads[index], loads[first]];
  updateCabins(`Swapped cabins ${cabins[first].letter.textContent} and ${cabins[index].letter.textContent}.`);
  render();
}

function stopTurn() {
  if (frame !== null) cancelAnimationFrame(frame);
  frame = null;
  turn.textContent = 'Run one turn';
}

turn.addEventListener('click', () => {
  if (frame !== null) {
    stopTurn();
    return;
  }
  turn.textContent = 'Pause turn';
  const from = angle;
  const started = performance.now();
  const duration = 6000;
  function tick(now) {
    const progress = Math.min(1, (now - started) / duration);
    angle = progress === 1 ? from : (from + 360 * progress) % 360;
    render();
    if (progress < 1) frame = requestAnimationFrame(tick);
    else stopTurn();
  }
  frame = requestAnimationFrame(tick);
});

slider.addEventListener('input', () => {
  stopTurn();
  angle = Number(slider.value);
  render();
});

document.querySelector('#reset').addEventListener('click', () => {
  stopTurn();
  loads = [...initialLoads];
  selected = null;
  angle = 0;
  updateCabins('Select two cabins to swap their riders.');
  render();
});

cabinet.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || selected === null) return;
  selected = null;
  updateCabins('Select two cabins to swap their riders.');
});

updateCabins('Select two cabins to swap their riders.');
render();
