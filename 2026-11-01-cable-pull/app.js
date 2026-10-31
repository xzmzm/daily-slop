(() => {
  'use strict';
  // The real bridge's 3,800-foot main span, converted to metres. The load
  // and cable sag are illustrative values for one cable, not bridge records.
  const SPAN_M = 3800 * 0.3048;
  const REFERENCE_SAG_M = 200;
  const svgNS = 'http://www.w3.org/2000/svg';
  const $ = id => document.getElementById(id);
  const sag = $('sag');
  const load = $('load');
  const cable = $('cable');
  const hangers = $('hangers');
  const buttons = document.querySelectorAll('[data-sag]');

  function cableY(t, dip) {
    return 112 + dip * 0.95 * (1 - (2 * t - 1) ** 2);
  }
  function horizontalPullMN(dip, distributedLoad) {
    return distributedLoad * SPAN_M ** 2 / (8 * dip) / 1000;
  }
  function prettyRatio(n) {
    return new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(n);
  }
  function render() {
    const dip = Number(sag.value);
    const distributedLoad = Number(load.value);
    $('sag-value').innerHTML = `${dip} <small>m</small>`;
    $('load-value').innerHTML = `${distributedLoad} <small>kN/m</small>`;
    $('pull-value').textContent = horizontalPullMN(dip, distributedLoad).toFixed(1);
    const ratio = REFERENCE_SAG_M / dip;
    $('comparison').textContent = ratio === 1
      ? 'This is the 200 m reference dip, with the current load.'
      : `That’s ${prettyRatio(ratio)}× the pull of a 200 m dip with the same load.`;
    buttons.forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.sag) === dip)));

    let path = '';
    for (let i = 0; i <= 80; i++) {
      const t = i / 80;
      path += `${i ? ' L' : 'M'}${(120 + 760 * t).toFixed(1)} ${cableY(t, dip).toFixed(1)}`;
    }
    cable.setAttribute('d', path);
    hangers.replaceChildren();
    for (let i = 1; i < 24; i++) {
      const t = i / 24;
      const line = document.createElementNS(svgNS, 'line');
      const x = 120 + 760 * t;
      line.setAttribute('x1', x); line.setAttribute('x2', x);
      line.setAttribute('y1', cableY(t, dip)); line.setAttribute('y2', 344);
      hangers.appendChild(line);
    }
    const centerY = cableY(.5, dip);
    $('sag-line').setAttribute('y2', centerY);
    $('sag-tick').setAttribute('y1', centerY);
    $('sag-tick').setAttribute('y2', centerY);
    $('sag-annotation').setAttribute('y', 112 + (centerY - 112) / 2 + 4);
    $('sag-annotation').textContent = `${dip} m dip`;
  }
  [sag, load].forEach(input => input.addEventListener('input', render));
  buttons.forEach(button => button.addEventListener('click', () => { sag.value = button.dataset.sag; render(); }));
  render();
})();
