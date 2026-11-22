'use strict';

const goldenAngle = 180 * (3 - Math.sqrt(5));
const seedCount = 480;
const presets = {
  eight: { angle: 135, reading: '135° is three eighths of a turn. After eight seeds the direction repeats, leaving eight straight spokes.' },
  golden: { angle: goldenAngle, reading: 'At the golden angle, seeds spread across the disk. Trace a seed interval to see how the curves form.' },
  five: { angle: 144, reading: '144° is two fifths of a turn. After five seeds the direction repeats, leaving five straight spokes.' },
};
const traces = new Map([[21, '#80dabe'], [34, '#cfb8f3']]);

const canvas = document.querySelector('#head');
const pen = canvas.getContext('2d');
const slider = document.querySelector('#angle');
const degrees = document.querySelector('#degrees');
const reading = document.querySelector('#reading');
const buttons = document.querySelectorAll('[data-preset]');
const traceInputs = document.querySelectorAll('.trace input');

let angle = goldenAngle;

function draw() {
  const { width, height } = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  pen.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);

  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.42;
  const rotation = angle * Math.PI / 180;
  const points = Array.from({ length: seedCount }, (_, index) => {
    const r = radius * Math.sqrt((index + 0.5) / seedCount);
    const direction = index * rotation - Math.PI / 2;
    return [centerX + r * Math.cos(direction), centerY + r * Math.sin(direction), direction];
  });

  pen.lineWidth = 1;
  pen.strokeStyle = '#4d6550';
  pen.setLineDash([2, 5]);
  pen.beginPath();
  pen.arc(centerX, centerY, radius * 1.075, 0, 2 * Math.PI);
  pen.stroke();
  pen.setLineDash([]);

  const colors = ['#e4ad49', '#f6cb69', '#bc822d', '#eebd56', '#f7d68b'];
  points.forEach(([x, y, direction], index) => {
    const size = radius / Math.sqrt(seedCount) * (0.26 + 0.26 * index / seedCount);
    pen.fillStyle = colors[(index * 31 ^ index * 13 >> 3) % colors.length];
    pen.beginPath();
    pen.ellipse(x, y, 1.17 * size, 0.72 * size, direction + 0.48, 0, 2 * Math.PI);
    pen.fill();
  });

  const visible = [];
  for (const input of traceInputs) {
    if (!input.checked) continue;
    const step = Number(input.value);
    visible.push(step);
    pen.strokeStyle = traces.get(step);
    pen.lineWidth = Math.max(1, radius / 155);
    pen.globalAlpha = 0.8;
    pen.beginPath();
    for (let index = 64; index + step < seedCount; index++) {
      pen.moveTo(points[index][0], points[index][1]);
      pen.lineTo(points[index + step][0], points[index + step][1]);
    }
    pen.stroke();
    pen.globalAlpha = 1;
  }

  const detail = visible.length ? ` Connections shown at intervals of ${visible.join(' and ')} seeds.` : '';
  canvas.setAttribute('aria-label', `Simulated sunflower seed pattern. ${reading.textContent}${detail}`);
}

function selectAngle(presetName) {
  const preset = presets[presetName];
  angle = preset ? preset.angle : Number(slider.value);
  if (preset) slider.value = angle;
  degrees.textContent = `${presetName === 'golden' ? angle.toFixed(4) : Number(angle.toFixed(2))}°`;
  slider.setAttribute('aria-valuetext', `${degrees.textContent}${presetName === 'golden' ? ', golden angle' : ''}`);
  for (const button of buttons) {
    button.setAttribute('aria-pressed', String(button.dataset.preset === presetName));
  }
  reading.textContent = preset?.reading ?? 'Each seed turns by this angle. Try values close to a preset and watch the seed lines bend.';
  draw();
}

for (const button of buttons) {
  button.addEventListener('click', () => selectAngle(button.dataset.preset));
}
for (const input of traceInputs) input.addEventListener('change', draw);
slider.addEventListener('input', () => {
  const exactPreset = Number(slider.value) === 135 ? 'eight' : Number(slider.value) === 144 ? 'five' : '';
  selectAngle(exactPreset);
});
selectAngle('golden');
new ResizeObserver(draw).observe(canvas.parentElement);
