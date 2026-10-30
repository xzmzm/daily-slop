(() => {
  'use strict';
  const hidden = document.querySelector('#hidden-light');
  const stage = document.querySelector('#stage-light');
  const buttons = [...document.querySelectorAll('[data-cue]')];
  const cues = { vanish: [0, 45], appear: [85, 35], wash: [35, 100] };

  function render() {
    const actor = Number(hidden.value);
    const room = Number(stage.value);
    document.querySelector('#hidden-value').textContent = `${actor}%`;
    document.querySelector('#stage-value').textContent = `${room}%`;
    hidden.style.setProperty('--amount', `${actor}%`);
    stage.style.setProperty('--amount', `${room}%`);
    document.querySelector('.ghost').style.opacity = String(actor / 100 * 0.82);
    document.querySelector('.stage-darkness').style.opacity = String(0.72 - room / 100 * 0.63);
    document.querySelector('.ray').style.opacity = String(actor / 100 * 0.92);
    document.querySelector('.ray-virtual').style.opacity = String(actor / 100 * 0.75);
    document.querySelector('.diagram-ghost').style.opacity = String(actor / 100 * 0.9);
    document.querySelector('.hidden-actor').style.opacity = String(0.32 + actor / 100 * 0.68);
    const status = actor === 0 ? 'THE GHOST HAS VANISHED' : actor < 20 ? 'A FAINT APPARITION' : 'THE GHOST IS ON STAGE';
    document.querySelector('#stage-status').textContent = status;
    document.querySelector('#control-hint').textContent = actor === 0
      ? 'No light on the hidden actor, no reflection for the audience to see.'
      : room > actor + 35
        ? 'The bright room competes with the faint reflection. Try lighting the actor.'
        : 'Light on the hidden actor brings the ghost to life; the room still shows through.';
    for (const button of buttons) {
      const [a, b] = cues[button.dataset.cue];
      button.setAttribute('aria-pressed', String(actor === a && room === b));
    }
  }
  hidden.addEventListener('input', render);
  stage.addEventListener('input', render);
  for (const button of buttons) button.addEventListener('click', () => {
    const [a, b] = cues[button.dataset.cue];
    hidden.value = a;
    stage.value = b;
    render();
  });
  window.ghostLight = { render };
  render();
})();
