(() => {
  const get = id => document.getElementById(id);
  const chart = Coast.makeChart();
  const walks = new Map(Coast.spans.map(span => [span, Coast.walk(chart.shore, span * Coast.unitsPerKm)]));
  const paint = mountChart(get('terrain'), get('route'), chart);
  const reference = get('reference'), play = get('play'), step = get('step');
  const fill = get('progress-fill'), progressText = get('progress-text'), notes = get('notes');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let span = 12, walk = walks.get(span), position = null, playing = false, frame = 0;
  const km = units => (units / Coast.unitsPerKm).toFixed(1);

  function renderProgress() {
    const count = walk.pins.length - 1;
    const complete = position === count;
    play.querySelector('span').textContent = playing ? 'Pause walk' : complete ? 'Replay walk'
      : position === null ? 'Walk the coast' : 'Resume walk';
    play.classList.toggle('playing', playing);
    step.disabled = playing;
    fill.style.width = (position || 0) / count * 100 + '%';
    progressText.textContent = position === null ? 'Start at Gull Point' : complete ? 'Back at Gull Point'
      : 'Step ' + Math.floor(position) + ' of ' + count;
    const visualStep = reducedMotion.matches && position !== null ? Math.floor(position) : position;
    paint(walk, reference.checked ? walks.get(24) : null, visualStep);
  }

  function renderMeasurement() {
    const isReference = span === 24;
    if (isReference) reference.checked = false;
    reference.disabled = isReference;
    get('reference-key').hidden = !reference.checked;
    get('total').textContent = km(walk.length);
    get('breakdown').textContent = walk.fullSteps + ' full steps + ' + km(walk.remainder) + ' km to close';
    get('comparison').textContent = isReference ? 'This is the reference span.'
      : km(walk.length - walks.get(24).length) + ' km longer at this span.';
    const summary = 'At a ' + span + ' km span, Wren Island measures ' + km(walk.length) + ' km.';
    get('route').setAttribute('aria-label', summary + (reference.checked ? ' The dashed line shows the 24 km walk.' : ''));
    get('announcement').textContent = summary + (reference.checked ? ' Reference overlay on.' : '');
    renderProgress();
  }

  function stop() {
    cancelAnimationFrame(frame);
    playing = false;
  }

  document.querySelectorAll('[name="span"]').forEach(input => input.addEventListener('change', () => {
    stop();
    span = Number(input.value);
    walk = walks.get(span);
    position = null;
    renderMeasurement();
  }));
  reference.addEventListener('change', renderMeasurement);

  play.addEventListener('click', () => {
    if (playing) {
      stop();
      renderProgress();
      get('announcement').textContent = 'Paused. ' + progressText.textContent;
      return;
    }
    const count = walk.pins.length - 1;
    const seconds = Math.max(6, Math.min(16, count * .37));
    if (position === null || position === count) position = 0;
    const start = performance.now() - position / count * seconds * 1000;
    playing = true;
    get('announcement').textContent = 'Walking clockwise from step ' + Math.floor(position) + '.';
    function tick(now) {
      position = Math.min(count, Math.max(0, (now - start) / (seconds * 1000) * count));
      if (position === count) {
        stop();
        get('announcement').textContent = 'Walk complete. ' + km(walk.length) + ' kilometres.';
      } else frame = requestAnimationFrame(tick);
      renderProgress();
    }
    renderProgress();
    frame = requestAnimationFrame(tick);
  });

  step.addEventListener('click', () => {
    const count = walk.pins.length - 1;
    position = position === null || position === count ? 1 : Math.floor(position) + 1;
    renderProgress();
    get('announcement').textContent = progressText.textContent;
  });

  function pause() {
    if (playing) {
      stop();
      renderProgress();
    }
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  get('open-notes').addEventListener('click', () => {
    pause();
    notes.showModal();
  });
  notes.addEventListener('click', event => { if (event.target === notes) notes.close(); });
  renderMeasurement();
})();
