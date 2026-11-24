(() => {
  const P = window.Perihelion;
  const manualClock = Boolean(window.__ftManualClock);
  const $ = (id) => document.getElementById(id);
  const canvas = $('orbit');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const SUN = { x: W / 2 + 40, y: H / 2 + 10 };
  const A_PX = 250;
  const E = P.MERCURY.e;
  const START = -Math.PI / 2 - 0.35;
  const MAX_YEARS = 1e6;
  const PLAY_SECONDS = 6;
  const GR = P.grAdvance();

  const state = {
    enabled: Object.fromEntries(P.SOURCES.map((s) => [s.id, true])),
    fix: 'none',
    vDist: 0.2,
    vMass: 0.5,
    years: 0,
    playing: false,
    phase: 0,
  };

  const fmt = (x, d = 2) => x.toFixed(d);
  const arcsec = (x) => `${fmt(x)}″`;

  // ---- Newtonian source list -------------------------------------------------
  const maxValue = P.SOURCES[0].value;
  const list = $('sources');
  for (const s of P.SOURCES) {
    const li = document.createElement('li');
    li.innerHTML = `<label><input type="checkbox" data-source="${s.id}" checked>
      <span>${s.name}</span><i class="bar" style="width:${Math.max(0.4, (s.value / maxValue) * 100)}%"></i>
      <span class="val">${fmt(s.value)}″</span></label>`;
    list.append(li);
  }
  list.addEventListener('change', (event) => {
    const id = event.target.dataset.source;
    if (!id) return;
    state.enabled[id] = event.target.checked;
    update();
  });

  // ---- Fixes ------------------------------------------------------------------
  function extra() {
    if (state.fix === 'gr') return GR;
    if (state.fix === 'entwurf') return P.ENTWURF;
    if (state.fix === 'vulcan') return P.vulcanAdvance(state.vMass, state.vDist);
    return 0;
  }

  function setFix(fix) {
    state.fix = fix;
    for (const b of document.querySelectorAll('[data-fix]')) b.setAttribute('aria-pressed', String(b.dataset.fix === fix));
    $('vulcan-controls').hidden = fix !== 'vulcan';
    update();
  }
  $('fixes').addEventListener('click', (event) => {
    const fix = event.target.closest('[data-fix]')?.dataset.fix;
    if (fix) setFix(fix);
  });
  $('v-dist').addEventListener('input', (e) => { state.vDist = Number(e.target.value); update(); });
  $('v-mass').addEventListener('input', (e) => { state.vMass = Number(e.target.value); update(); });

  function note(b) {
    const leftover = P.OBSERVED - b.newton;
    switch (state.fix) {
      case 'vulcan': {
        const need = P.vulcanMassFor(leftover, state.vDist);
        return `At ${fmt(state.vDist)} AU, Vulcan needs <b>${fmt(need)} Mercury masses</b> to close the gap. Le Verrier proposed it in 1859. Eclipse and transit hunts never found it.`;
      }
      case 'entwurf':
        return 'Einstein and Besso’s 1913 “Entwurf” theory gives about <b>18″</b>. That is less than half the gap, and Einstein never published the number.';
      case 'gr':
        return `General relativity adds 6πGM / c²a(1−e²) per orbit: <b>${fmt(GR)}″</b> a century. Einstein reported it on 18 Nov 1915. He submitted the final field equations a week later.`;
      default:
        return `Le Verrier found this leftover in 1859 (he made it 38″). Newcomb’s 1882 figure was 43″. Newtonian pulls alone leave ${arcsec(leftover)} unexplained.`;
    }
  }

  function budget() { return P.budget(state.enabled, extra()); }

  function update() {
    const b = budget();
    $('predicted').textContent = arcsec(b.predicted);
    $('gap').textContent = `${b.gap >= 0 ? '' : '−'}${arcsec(Math.abs(b.gap))}`;
    $('gap').parentElement.classList.toggle('closed', Math.abs(b.gap) <= P.OBSERVED_ERR);
    $('v-dist-out').textContent = `${fmt(state.vDist)} AU`;
    $('v-mass-out').textContent = `${fmt(state.vMass)} Mercury`;
    $('fix-note').innerHTML = note(b);
    $('years').value = String(state.years);
    $('years-out').textContent = `${Math.round(state.years).toLocaleString('en-US')} years`;
    draw();
  }

  // ---- Time ---------------------------------------------------------------------
  $('years').addEventListener('input', (e) => { state.years = Number(e.target.value); state.playing = false; update(); });
  $('play').addEventListener('click', () => {
    if (state.years >= MAX_YEARS) state.years = 0;
    state.playing = true;
  });

  function step(seconds) {
    state.phase += seconds * 1.4;
    if (state.playing) {
      state.years = Math.min(MAX_YEARS, state.years + (MAX_YEARS / PLAY_SECONDS) * seconds);
      if (state.years >= MAX_YEARS) state.playing = false;
      update();
    } else {
      draw();
    }
  }

  // ---- Drawing -------------------------------------------------------------------
  const stars = Array.from({ length: 160 }, (_, i) => {
    const r = Math.sin(i * 12.9898) * 43758.5453;
    const s = Math.sin(i * 78.233) * 12345.678;
    return { x: (r - Math.floor(r)) * W, y: (s - Math.floor(s)) * H, a: 0.15 + ((r * 7) % 1 + 1) % 1 * 0.5 };
  });

  const angleAt = (rate) => START - (rate * state.years / 100 / 3600) * Math.PI / 180;

  function ellipsePath(theta) {
    const c = A_PX * E;
    const b = A_PX * Math.sqrt(1 - E * E);
    ctx.beginPath();
    ctx.ellipse(SUN.x - c * Math.cos(theta), SUN.y - c * Math.sin(theta), A_PX, b, theta, 0, Math.PI * 2);
  }

  function ray(theta, color, dashed, label) {
    const r = A_PX * (1 - E);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.setLineDash(dashed ? [9, 7] : []);
    ctx.beginPath();
    ctx.moveTo(SUN.x, SUN.y);
    ctx.lineTo(SUN.x + Math.cos(theta) * (r + 40), SUN.y + Math.sin(theta) * (r + 40));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(SUN.x + Math.cos(theta) * r, SUN.y + Math.sin(theta) * r, 5, 0, Math.PI * 2);
    ctx.fill();
    if (label) {
      ctx.font = '15px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, SUN.x + Math.cos(theta) * (r + 62), SUN.y + Math.sin(theta) * (r + 62) + 5);
    }
    ctx.restore();
  }

  function mercuryPosition(theta) {
    const M = state.phase % (Math.PI * 2);
    let Ea = M;
    for (let i = 0; i < 8; i += 1) Ea -= (Ea - E * Math.sin(Ea) - M) / (1 - E * Math.cos(Ea));
    const nu = 2 * Math.atan2(Math.sqrt(1 + E) * Math.sin(Ea / 2), Math.sqrt(1 - E) * Math.cos(Ea / 2));
    const r = A_PX * (1 - E * Math.cos(Ea));
    return { x: SUN.x + r * Math.cos(theta - nu), y: SUN.y + r * Math.sin(theta - nu) };
  }

  function draw() {
    const b = budget();
    ctx.fillStyle = '#0a0c12';
    ctx.fillRect(0, 0, W, H);
    for (const s of stars) {
      ctx.fillStyle = `rgba(230,228,220,${s.a})`;
      ctx.fillRect(s.x, s.y, 1.6, 1.6);
    }

    const seen = angleAt(P.OBSERVED);
    const model = angleAt(b.predicted);

    // Faint rosette of where the model's orbit has been.
    if (state.years > 0) {
      ctx.strokeStyle = 'rgba(111,183,232,0.10)';
      ctx.lineWidth = 1;
      const span = (b.predicted * state.years / 100 / 3600) * Math.PI / 180;
      const count = Math.min(48, Math.ceil(span / 0.25));
      for (let i = 0; i < count; i += 1) {
        ellipsePath(START - (span * i) / count);
        ctx.stroke();
      }
    }

    ctx.strokeStyle = 'rgba(242,195,91,0.55)';
    ctx.setLineDash([9, 7]);
    ctx.lineWidth = 1.5;
    ellipsePath(seen);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = '#6fb7e8';
    ctx.lineWidth = 2;
    ellipsePath(model);
    ctx.stroke();

    // Gap wedge between the two perihelion directions.
    const gapDeg = (b.gap * state.years / 100 / 3600);
    if (Math.abs(gapDeg) > 0.05 && Math.abs(gapDeg) < 360) {
      ctx.fillStyle = 'rgba(224,114,74,0.22)';
      ctx.beginPath();
      ctx.moveTo(SUN.x, SUN.y);
      ctx.arc(SUN.x, SUN.y, 150, Math.min(seen, model), Math.max(seen, model));
      ctx.closePath();
      ctx.fill();
    }

    if (state.fix === 'vulcan') {
      const r = (state.vDist / P.MERCURY.a) * A_PX;
      ctx.strokeStyle = 'rgba(224,114,74,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(SUN.x, SUN.y, r, 0, Math.PI * 2);
      ctx.stroke();
      const va = state.phase * Math.pow(P.MERCURY.a / state.vDist, 1.5);
      ctx.fillStyle = '#e0724a';
      ctx.beginPath();
      ctx.arc(SUN.x + r * Math.cos(-va), SUN.y + r * Math.sin(-va), 3 + Math.sqrt(state.vMass) * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ray(seen, '#f2c35b', true, 'observed');
    ray(model, '#6fb7e8', false, Math.abs(gapDeg) > 6 ? 'model' : '');

    // Sun
    const glow = ctx.createRadialGradient(SUN.x, SUN.y, 2, SUN.x, SUN.y, 34);
    glow.addColorStop(0, '#fff6d8');
    glow.addColorStop(0.35, '#f7c95a');
    glow.addColorStop(1, 'rgba(247,201,90,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(SUN.x, SUN.y, 34, 0, Math.PI * 2);
    ctx.fill();

    const m = mercuryPosition(model);
    ctx.fillStyle = '#c9c4bb';
    ctx.beginPath();
    ctx.arc(m.x, m.y, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#e9e4d8';
    ctx.font = '18px Georgia, serif';
    ctx.textAlign = 'left';
    const turns = (P.OBSERVED * state.years / 100 / 3600);
    ctx.fillText(`Perihelion turned ${fmt(turns, 1)}° in ${Math.round(state.years).toLocaleString('en-US')} years`, 22, 34);
    ctx.fillStyle = Math.abs(b.gap) <= P.OBSERVED_ERR ? '#8fd18a' : '#e0724a';
    ctx.fillText(`Model is off by ${fmt(Math.abs(gapDeg), 1)}°`, 22, 60);
    ctx.fillStyle = '#9a98a0';
    ctx.font = '13px Georgia, serif';
    ctx.fillText('Orbit to scale; perihelion turn sped up by the time slider.', 22, H - 18);
  }

  // ---- Loop ----------------------------------------------------------------------
  let last = performance.now();
  function frame(now) {
    step(Math.min(0.1, (now - last) / 1000));
    last = now;
    requestAnimationFrame(frame);
  }

  window.__ft = {
    state: () => ({ ...budget(), fix: state.fix, years: state.years, playing: state.playing, vDist: state.vDist, vMass: state.vMass }),
    step,
    setYears(years) { state.years = years; update(); },
    setVulcan(dist, mass) {
      state.vDist = dist; state.vMass = mass;
      $('v-dist').value = String(dist); $('v-mass').value = String(mass);
      update();
    },
    vulcanNeeded: () => P.vulcanMassFor(P.OBSERVED - budget().newton, state.vDist),
  };

  update();
  if (!manualClock) requestAnimationFrame(frame);
})();
