(() => {
  const sim = window.PeckSim;
  const barkCanvas = document.getElementById('bark');
  const chartCanvas = document.getElementById('chart');
  const bctx = barkCanvas.getContext('2d');
  const cctx = chartCanvas.getContext('2d');
  const W = barkCanvas.width;
  const H = barkCanvas.height;
  const HIT_RADIUS = 30;
  const CHART_SPAN = 40;
  const STEP_MS = 240;
  const BREED_PAUSE_MS = 420;
  // The video renderer sets this and advances queued generations itself.
  const manualClock = Boolean(window.__peckManualClock);

  const seedParam = Number(new URLSearchParams(location.search).get('seed'));
  const seed = Number.isInteger(seedParam) && seedParam > 0 ? seedParam : 1859;

  let rng, moths, generation, history, barkKey = 'lichen', hunter = 'sharp';
  let queued = 0, timer = null, breeding = false, barkLayer = {};

  const shade = (tone, shift = 0) => {
    const t = Math.min(1, Math.max(0, tone + shift));
    const mix = (dark, pale) => Math.round(dark + (pale - dark) * t);
    return `rgb(${mix(24, 226)},${mix(21, 220)},${mix(20, 198)})`;
  };

  const barkTone = () => sim.BARK[barkKey];
  const living = () => moths.filter((moth) => moth.alive);
  const eaten = () => moths.filter((moth) => !moth.alive).length;

  function paintBark(key) {
    if (barkLayer[key]) return barkLayer[key];
    const layer = document.createElement('canvas');
    layer.width = W;
    layer.height = H;
    const ctx = layer.getContext('2d');
    const tone = sim.BARK[key];
    const texture = sim.makeRng(key === 'lichen' ? 11 : 12);
    ctx.fillStyle = shade(tone);
    ctx.fillRect(0, 0, W, H);
    ctx.lineCap = 'round';
    for (let i = 0; i < 1500; i += 1) {
      const x = texture() * W;
      const y = texture() * H;
      const length = 14 + texture() * 62;
      ctx.strokeStyle = shade(tone, (texture() - 0.5) * 0.2);
      ctx.lineWidth = 1 + texture() * 4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + (texture() - 0.5) * 12, y + length / 2, x + (texture() - 0.5) * 8, y + length);
      ctx.stroke();
    }
    for (let i = 0; i < 90; i += 1) {
      ctx.fillStyle = shade(tone, (texture() - 0.5) * 0.26);
      ctx.beginPath();
      ctx.ellipse(texture() * W, texture() * H, 5 + texture() * 22, 3 + texture() * 12, texture() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    barkLayer[key] = layer;
    return layer;
  }

  function place(tones) {
    const spots = [];
    return tones.map((tone) => {
      let x, y, tries = 0;
      do {
        x = 40 + rng() * (W - 80);
        y = 34 + rng() * (H - 68);
        tries += 1;
      } while (tries < 80 && spots.some((spot) => Math.hypot(spot.x - x, spot.y - y) < 62));
      spots.push({ x, y });
      return { tone, x, y, angle: (rng() - 0.5) * 1.1, alive: true };
    });
  }

  function drawMoth(moth) {
    bctx.save();
    bctx.translate(moth.x, moth.y);
    bctx.rotate(moth.angle);
    for (const side of [-1, 1]) {
      bctx.fillStyle = shade(moth.tone, -0.04);
      bctx.beginPath();
      bctx.moveTo(0, 0);
      bctx.quadraticCurveTo(side * 17, 1, side * 19, 9);
      bctx.quadraticCurveTo(side * 12, 17, 0, 12);
      bctx.closePath();
      bctx.fill();
      bctx.fillStyle = shade(moth.tone);
      bctx.beginPath();
      bctx.moveTo(0, -9);
      bctx.quadraticCurveTo(side * 16, -14, side * 33, -8);
      bctx.quadraticCurveTo(side * 28, 3, side * 21, 7);
      bctx.quadraticCurveTo(side * 9, 3, 0, 4);
      bctx.closePath();
      bctx.fill();
      bctx.fillStyle = shade(moth.tone, -0.09);
      for (const [dx, dy] of [[8, -5], [15, -6], [23, -6], [13, 0], [20, 1], [10, 9]]) {
        bctx.beginPath();
        bctx.arc(side * dx, dy, 1.3, 0, Math.PI * 2);
        bctx.fill();
      }
    }
    bctx.fillStyle = shade(moth.tone, -0.14);
    bctx.beginPath();
    bctx.ellipse(0, 1, 2.6, 10, 0, 0, Math.PI * 2);
    bctx.fill();
    bctx.restore();
  }

  function drawPeck(moth) {
    bctx.strokeStyle = 'rgba(163,52,31,.85)';
    bctx.lineWidth = 2;
    bctx.beginPath();
    bctx.moveTo(moth.x - 5, moth.y - 5);
    bctx.lineTo(moth.x + 5, moth.y + 5);
    bctx.moveTo(moth.x + 5, moth.y - 5);
    bctx.lineTo(moth.x - 5, moth.y + 5);
    bctx.stroke();
  }

  function drawTree() {
    bctx.drawImage(paintBark(barkKey), 0, 0);
    for (const moth of moths) (moth.alive ? drawMoth : drawPeck)(moth);
  }

  function drawChart() {
    const w = chartCanvas.width, h = chartCanvas.height;
    const left = 44, right = 8, top = 8, bottom = 24;
    const shown = history.slice(-CHART_SPAN);
    const firstGen = shown[0].generation;
    const span = Math.max(12, shown.length - 1);
    const xAt = (gen) => left + ((gen - firstGen) / span) * (w - left - right);
    const yAt = (tone) => top + (1 - tone) * (h - top - bottom);

    cctx.clearRect(0, 0, w, h);
    cctx.fillStyle = '#e4dac6';
    cctx.fillRect(left, top, w - left - right, h - top - bottom);

    cctx.fillStyle = 'rgba(42,36,28,.28)';
    for (const entry of shown) {
      for (const tone of entry.tones) {
        cctx.fillRect(xAt(entry.generation) - 1.5, yAt(tone) - 1.5, 3, 3);
      }
    }

    const line = (valueOf, color, width) => {
      cctx.strokeStyle = color;
      cctx.lineWidth = width;
      cctx.beginPath();
      shown.forEach((entry, i) => {
        const x = xAt(entry.generation), y = yAt(valueOf(entry));
        if (i === 0) cctx.moveTo(x, y);
        else {
          cctx.lineTo(x, yAt(valueOf(shown[i - 1])));
          cctx.lineTo(x, y);
        }
      });
      cctx.stroke();
    };
    line((entry) => entry.bark, '#2a241c', 2.5);
    cctx.lineJoin = 'round';
    cctx.strokeStyle = '#a3341f';
    cctx.lineWidth = 3;
    cctx.beginPath();
    shown.forEach((entry, i) => {
      const x = xAt(entry.generation), y = yAt(entry.mean);
      if (i === 0) cctx.moveTo(x, y);
      else cctx.lineTo(x, y);
    });
    cctx.stroke();

    cctx.fillStyle = '#6b6152';
    cctx.font = '13px Georgia, serif';
    cctx.textAlign = 'right';
    cctx.textBaseline = 'middle';
    cctx.fillText('pale', left - 6, yAt(0.95));
    cctx.fillText('dark', left - 6, yAt(0.05));
    cctx.textBaseline = 'alphabetic';
    cctx.textAlign = 'left';
    cctx.fillText(`gen ${firstGen}`, left, h - 6);
    cctx.textAlign = 'right';
    cctx.fillText(`gen ${firstGen + span}`, w - right, h - 6);
  }

  function setStatus(text) {
    document.getElementById('status').textContent = text;
  }

  function refresh(message) {
    const left = sim.MEALS - eaten();
    const flockMean = sim.mean(living().map((moth) => moth.tone));
    document.getElementById('gen').textContent = generation;
    document.getElementById('gap').textContent = Math.abs(flockMean - barkTone()).toFixed(2);
    setStatus(message || `Generation ${generation}. ${left} ${left === 1 ? 'peck' : 'pecks'} left.`);
    const busy = queued > 0 || breeding;
    document.getElementById('one').disabled = busy;
    document.getElementById('ten').disabled = busy;
    drawTree();
    drawChart();
  }

  function record() {
    history.push({
      generation,
      bark: barkTone(),
      mean: sim.mean(moths.map((moth) => moth.tone)),
      tones: moths.map((moth) => moth.tone),
    });
  }

  function nextGeneration() {
    const survivors = living().map((moth) => moth.tone);
    moths = place(sim.breed(survivors, rng));
    generation += 1;
    record();
  }

  function huntRest() {
    const tones = moths.map((moth) => moth.tone);
    const alive = moths.map((moth) => moth.alive);
    while (alive.filter((value) => !value).length < sim.MEALS) {
      const index = sim.chooseMeal(tones, alive, barkTone(), hunter, rng);
      alive[index] = false;
      moths[index].alive = false;
    }
  }

  function advanceQueue() {
    if (queued <= 0) return false;
    huntRest();
    nextGeneration();
    queued -= 1;
    refresh();
    return queued > 0;
  }

  function startQueue(count) {
    if (queued || breeding) return;
    queued = count;
    refresh();
    if (manualClock) return;
    const tick = () => {
      timer = advanceQueue() ? setTimeout(tick, STEP_MS) : null;
    };
    tick();
  }

  function reset() {
    clearTimeout(timer);
    timer = null;
    queued = 0;
    breeding = false;
    rng = sim.makeRng(seed);
    moths = place(sim.founders(rng));
    generation = 0;
    history = [];
    record();
    refresh();
  }

  function peck(event) {
    if (queued || breeding) return;
    const box = barkCanvas.getBoundingClientRect();
    const x = (event.clientX - box.left) * (W / box.width);
    const y = (event.clientY - box.top) * (H / box.height);
    let best = null, bestDistance = HIT_RADIUS;
    for (const moth of living()) {
      const distance = Math.hypot(moth.x - x, moth.y - y);
      if (distance < bestDistance) {
        best = moth;
        bestDistance = distance;
      }
    }
    if (!best) {
      setStatus(`Nothing there. ${sim.MEALS - eaten()} pecks left.`);
      return;
    }
    best.alive = false;
    if (eaten() < sim.MEALS) {
      refresh();
      return;
    }
    breeding = true;
    refresh('Full. The moths you missed are breeding.');
    const finish = () => {
      breeding = false;
      nextGeneration();
      refresh();
    };
    if (manualClock) finish();
    else timer = setTimeout(finish, BREED_PAUSE_MS);
  }

  function choose(attribute, value) {
    document.querySelectorAll(`[${attribute}]`).forEach((button) => {
      button.setAttribute('aria-pressed', String(button.getAttribute(attribute) === value));
    });
  }

  document.querySelectorAll('[data-bark]').forEach((button) => button.addEventListener('click', () => {
    barkKey = button.dataset.bark;
    choose('data-bark', barkKey);
    history[history.length - 1].bark = barkTone();
    refresh();
  }));
  document.querySelectorAll('[data-hunter]').forEach((button) => button.addEventListener('click', () => {
    hunter = button.dataset.hunter;
    choose('data-hunter', hunter);
  }));
  document.getElementById('one').addEventListener('click', () => startQueue(1));
  document.getElementById('ten').addEventListener('click', () => startQueue(10));
  document.getElementById('reset').addEventListener('click', reset);
  barkCanvas.addEventListener('click', peck);

  window.__peck = {
    advance: () => advanceQueue(),
    state: () => ({ generation, queued, eaten: eaten(), mean: sim.mean(living().map((m) => m.tone)), bark: barkTone() }),
    // Page coordinates of the living moth that stands out most, for scripted clicks.
    mostVisible: () => {
      const moth = living().sort((a, b) => Math.abs(b.tone - barkTone()) - Math.abs(a.tone - barkTone()))[0];
      const box = barkCanvas.getBoundingClientRect();
      return { x: box.left + moth.x * (box.width / W), y: box.top + moth.y * (box.height / H) };
    },
  };

  reset();
})();
