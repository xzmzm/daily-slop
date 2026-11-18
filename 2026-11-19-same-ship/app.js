'use strict';

const WIDTH = 440;
const HEIGHT = 252;
const COURSES = [
  [[53, 125], [229, 138], [388, 112]],
  [[64, 142], [192, 155], [376, 131]],
  [[80, 160], [238, 169], [360, 151]],
  [[100, 177], [207, 183], [338, 173]],
  [[130, 194], [244, 196], [306, 191]],
];
// Number the pieces in repair order, from the waterline up.
const PLANKS = COURSES.slice(0, -1).reverse().flatMap((top, offset) => {
  const bottom = COURSES[COURSES.length - 1 - offset];
  return [0, 1].map(section => [top[section], top[section + 1], bottom[section + 1], bottom[section]]);
});
const TOTAL = PLANKS.length;

const progress = document.querySelector('#progress');
const next = document.querySelector('#next');
const back = document.querySelector('#back');
const reset = document.querySelector('#reset');
const repaired = document.querySelector('#repaired');
const rebuilt = document.querySelector('#rebuilt');

function line(ctx, points, color, width = 1) {
  ctx.beginPath();
  points.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function drawRig(ctx, lit) {
  const ink = lit ? '#b8caba' : '#6d8980';
  const rig = lit ? '#7f9b8d' : '#57756d';
  if (!lit) ctx.setLineDash([4, 5]);

  line(ctx, [[68, 126], [202, 35], [376, 114]], rig);
  line(ctx, [[202, 137], [202, 24]], ink, 2);
  line(ctx, [[197, 25], [167, 28], [196, 34]], ink);
  line(ctx, [[145, 52], [271, 50]], ink, 2);
  ctx.beginPath();
  ctx.moveTo(150, 54);
  ctx.lineTo(267, 52);
  ctx.quadraticCurveTo(257, 82, 274, 106);
  ctx.quadraticCurveTo(211, 94, 141, 108);
  ctx.quadraticCurveTo(158, 82, 150, 54);
  if (lit) {
    ctx.fillStyle = '#33504a';
    ctx.fill();
  }
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  line(ctx, [[149, 103], [131, 127]], rig);
  line(ctx, [[267, 102], [290, 129]], rig);
  ctx.setLineDash([]);
}

function drawPlank(ctx, points, index, kind) {
  const [a, b, c, d] = points;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(...a);
  ctx.lineTo(...b);
  ctx.lineTo(...c);
  ctx.lineTo(...d);
  ctx.closePath();

  if (kind === 'empty') {
    ctx.strokeStyle = '#7a968b';
    ctx.setLineDash([4, 5]);
    ctx.stroke();
    ctx.restore();
    return;
  }

  const old = kind === 'original';
  const shades = old
    ? ['#c28551', '#d59a60', '#dca56b', '#bc7a4d']
    : ['#90a88e', '#a8bea2', '#b4c9ac', '#87a088'];
  ctx.fillStyle = shades[index % shades.length];
  ctx.fill();
  ctx.strokeStyle = '#142b29';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.clip();

  const grain = old ? '#75492c' : '#4c6e58';
  ctx.globalAlpha = .43;
  for (const offset of [4, 8, 12]) {
    ctx.beginPath();
    ctx.moveTo(a[0] - 5, a[1] + offset);
    ctx.bezierCurveTo(a[0] + 46, a[1] + offset - 3, b[0] - 55, b[1] + offset + 4, b[0] + 3, b[1] + offset);
    ctx.strokeStyle = grain;
    ctx.lineWidth = .7;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = old ? '#30251a' : '#233b31';
  for (const [x, y] of [[a[0] + 13, (a[1] + d[1]) / 2], [b[0] - 11, (b[1] + c[1]) / 2]]) {
    ctx.beginPath();
    ctx.arc(x, y, 1.5, 0, 2 * Math.PI);
    ctx.fill();
  }
  ctx.restore();
}

function drawDock(canvas, stage, second) {
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.round(WIDTH * scale);
  canvas.height = Math.round(HEIGHT * scale);
  const ctx = canvas.getContext('2d');
  ctx.scale(canvas.width / WIDTH, canvas.height / HEIGHT);

  ctx.strokeStyle = '#254340';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= WIDTH; x += 20) {
    ctx.moveTo(x + .5, 0);
    ctx.lineTo(x + .5, HEIGHT);
  }
  for (let y = 0; y <= HEIGHT; y += 20) {
    ctx.moveTo(0, y + .5);
    ctx.lineTo(WIDTH, y + .5);
  }
  ctx.stroke();

  // The chart datum and scale sit under both hulls.
  ctx.setLineDash([3, 5]);
  line(ctx, [[20, 176], [420, 176]], '#68877c');
  ctx.setLineDash([]);
  line(ctx, [[29, 224], [411, 224]], '#648177');
  for (let x = 29; x <= 411; x += 19) {
    line(ctx, [[x, 224], [x, x % 38 === 29 ? 233 : 229]], '#82a094');
  }
  ctx.font = '10px monospace';
  ctx.fillStyle = '#b1c3b4';
  ctx.fillText('STERN', 29, 246);
  ctx.textAlign = 'right';
  ctx.fillText('BOW', 411, 246);

  drawRig(ctx, !second || stage === TOTAL);
  PLANKS.forEach((points, i) => {
    const moved = i < stage;
    const kind = second ? (moved ? 'original' : 'empty') : (moved ? 'fresh' : 'original');
    drawPlank(ctx, points, i, kind);
  });
  if (!second || stage === TOTAL) {
    line(ctx, COURSES[0], '#d9cfac', 2);
    line(ctx, COURSES[COURSES.length - 1], '#a2b9a3', 1.3);
  }
}

function setText(selector, text) {
  const element = document.querySelector(selector);
  if (element.textContent !== text) element.textContent = text;
}

function render() {
  const stage = progress.valueAsNumber;
  const oldA = TOTAL - stage;
  const useWood = document.querySelector('[name="criterion"]:checked').value === 'wood';

  drawDock(repaired, stage, false);
  drawDock(rebuilt, stage, true);
  setText('#repaired-count', `${oldA} / ${TOTAL}`);
  setText('#rebuilt-count', `${stage} / ${TOTAL}`);
  setText('#stage', `${stage} of ${TOTAL} replaced`);
  progress.setAttribute('aria-valuetext', `${stage} of ${TOTAL} planks replaced`);
  next.disabled = stage === TOTAL;
  back.disabled = reset.disabled = stage === 0;

  setText('#verdict-label', useWood ? 'The original wood points to' : 'History points to');
  if (!useWood) {
    setText('#verdict', 'Berth A');
    setText('#reason', stage === TOTAL
      ? 'A kept its place through every repair, even as its last original plank left.'
      : 'The ship in A is still the one undergoing repairs.');
  } else if (oldA === stage) {
    setText('#verdict', 'A tie');
    setText('#reason', 'Each berth holds four original planks.');
  } else {
    setText('#verdict', oldA > stage ? 'Berth A' : 'Berth B');
    setText('#reason', stage === TOTAL
      ? 'B is complete and holds every plank from the first ship.'
      : `That berth holds ${Math.max(oldA, stage)} of the ${TOTAL} original planks.`);
  }
}

function stepTo(stage) {
  progress.value = stage;
  render();
}

progress.addEventListener('input', render);
next.addEventListener('click', () => stepTo(progress.valueAsNumber + 1));
back.addEventListener('click', () => stepTo(progress.valueAsNumber - 1));
reset.addEventListener('click', () => stepTo(0));
document.querySelectorAll('[name="criterion"]').forEach(input => input.addEventListener('change', render));
render();
