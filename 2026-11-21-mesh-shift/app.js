'use strict';

const school = survey.createSchool();
const canvas = document.querySelector('#transect');
const ctx = canvas.getContext('2d');
const tow = document.querySelector('#tow');
const phase = document.querySelector('#phase');
const chart = document.querySelector('#chart');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let mesh = 5;
let outcome;
let progress = 0;
let animation;

function updateResults() {
  outcome = survey.summarize(school, mesh);
  document.querySelector('#retained').textContent = outcome.retained;
  document.querySelector('#mean').textContent = outcome.mean === null ? '—' : outcome.mean.toFixed(1) + ' cm';
  const maxCount = Math.max(...outcome.bins.map(bin => bin.school));
  chart.replaceChildren(...outcome.bins.map(bin => {
    const item = document.createElement('div');
    item.className = 'bin';
    item.setAttribute('role', 'listitem');
    const range = `${bin.min}–${bin.min + 9}`;
    item.setAttribute('aria-label', `${range} cm, ${bin.sample} sampled out of ${bin.school} in the school`);
    item.innerHTML = `<div class="plot" aria-hidden="true">
      <div class="bar" style="height:${100 * bin.school / maxCount}%"></div>
      <div class="bar sample" style="height:${100 * bin.sample / maxCount}%"></div>
      </div><div class="bin-label" aria-hidden="true">${range} cm</div>
      <div class="bin-count" aria-hidden="true">${bin.sample} / ${bin.school}</div>`;
    return item;
  }));
}

function fishShape(x, y, length, color, opacity) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(length / 18, length / 18);
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-4, 0);
  ctx.lineTo(-10, -4);
  ctx.lineTo(-9, 0);
  ctx.lineTo(-10, 4);
  ctx.closePath();
  ctx.moveTo(-7, 0);
  ctx.quadraticCurveTo(-1, -7, 7, -3);
  ctx.quadraticCurveTo(14, 0, 7, 3);
  ctx.quadraticCurveTo(-1, 7, -7, 0);
  ctx.fill();
  ctx.fillStyle = '#193b40';
  ctx.beginPath();
  ctx.arc(7, -0.7, .9, 0, 2 * Math.PI);
  ctx.fill();
  ctx.restore();
}

function draw() {
  const { width, height } = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const pixelWidth = Math.max(1, Math.round(width * ratio));
  const pixelHeight = Math.max(1, Math.round(height * ratio));
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  ctx.setTransform(pixelWidth / width, 0, 0, pixelHeight / height, 0, 0);
  const water = ctx.createLinearGradient(0, 0, width * .7, height);
  water.addColorStop(0, '#184a4e');
  water.addColorStop(1, '#0a292f');
  ctx.fillStyle = water;
  ctx.fillRect(0, 0, width, height);

  ctx.lineWidth = 1;
  ctx.strokeStyle = '#93bdb41c';
  ctx.beginPath();
  for (let x = 19.5; x < width; x += 22) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let y = 16.5; y < height; y += 22) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();

  const edge = width * .72;
  const spacing = mesh * 2.6;
  ctx.fillStyle = '#acdacf12';
  ctx.fillRect(edge, 0, spacing * 2, height);
  ctx.save();
  ctx.beginPath();
  ctx.rect(edge, 0, spacing * 2, height);
  ctx.clip();
  ctx.strokeStyle = '#a7d8cc80';
  ctx.beginPath();
  for (let y = -spacing * 2; y < height + spacing * 2; y += spacing) {
    ctx.moveTo(edge, y);
    ctx.lineTo(edge + spacing * 2, y + spacing * 2);
    ctx.moveTo(edge, y);
    ctx.lineTo(edge + spacing * 2, y - spacing * 2);
  }
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#b6dbce';
  ctx.fillRect(edge, 0, 1, height);
  ctx.fillRect(edge + spacing * 2, 0, 1, height);

  const netEnd = edge + spacing * 2;
  outcome.fish.forEach((fish, i) => {
    const fromX = width * (.08 + ((i % 12) + fish.offsetX * .8) / 12 * .55);
    const y = height * (.12 + (Math.floor(i / 12) + fish.offsetY * .8) / 6 * .76);
    const toX = fish.retained
      ? edge - width * (.028 + ((i % 9) + fish.offsetX) * .027)
      : netEnd + 5 + (width - netEnd - 11) * (.22 + .73 * fish.offsetX);
    const travel = Math.max(0, Math.min(1, (progress - fish.offsetX * .32) / .68));
    const eased = travel * travel * (3 - 2 * travel);
    const x = fromX + (toX - fromX) * eased;
    const tailY = y + Math.sin(travel * Math.PI * 2) * (fish.offsetY - .5) * 11;
    const color = fish.retained ? '#f5a962' : '#80d6cf';
    fishShape(x, tailY, (8 + fish.length * .27) * Math.min(1, width / 520),
      travel > .82 ? color : '#b4dfd3', .66 + fish.offsetY * .32);
  });
}

function setPhase(message, button, busy = false) {
  phase.textContent = message;
  tow.disabled = busy;
  tow.firstChild.textContent = button + ' ';
  document.querySelector('#readout-label').textContent =
    progress === 1 ? 'Observed sample' : 'Projected sample';
}

function completeTow() {
  progress = 1;
  draw();
  setPhase('Tow complete', 'Replay tow');
}

tow.addEventListener('click', () => {
  progress = 0;
  setPhase('Tow underway', 'Towing…', true);
  if (reducedMotion.matches) {
    completeTow();
    return;
  }
  const start = performance.now();
  function tick(now) {
    progress = Math.min(1, (now - start) / 2150);
    if (progress === 1) {
      completeTow();
      return;
    }
    draw();
    animation = requestAnimationFrame(tick);
  }
  animation = requestAnimationFrame(tick);
});

for (const input of document.querySelectorAll('[name="mesh"]')) {
  input.addEventListener('change', () => {
    cancelAnimationFrame(animation);
    mesh = Number(input.value);
    progress = 0;
    setPhase('Ready to tow', 'Run tow');
    updateResults();
    draw();
  });
}

document.querySelector('#school-size').textContent = school.length;
updateResults();
new ResizeObserver(draw).observe(canvas);
draw();
