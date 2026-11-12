(() => {
  'use strict';
  const M = window.LoopModel;
  const $ = id => document.getElementById(id);
  const size = 8;
  let board, initial, analysis, turns = 0, mode = 'rotate', selected = null, challenge = false;
  const paths = [
    ['M 50 0 A 50 50 0 0 0 100 50', 'M 50 100 A 50 50 0 0 0 0 50'],
    ['M 50 0 A 50 50 0 0 1 0 50', 'M 50 100 A 50 50 0 0 1 100 50'],
  ];
  const tiles = Array.from({length: size * size}, (_, i) => {
    const button = document.createElement('button');
    button.className = 'tile';
    button.dataset.tile = i;
    button.addEventListener('click', event => {
      if (mode === 'rotate') {
        board = M.rotate(board, i);
        turns++;
        selected = null;
        render();
      } else {
        const rect = button.getBoundingClientRect();
        const keyboard = event.detail === 0;
        const x = keyboard ? 50 : (event.clientX - rect.left) / rect.width * 100;
        const y = keyboard ? 0 : (event.clientY - rect.top) / rect.height * 100;
        const centers = board[i] === 0 ? [[100, 0], [0, 100]] : [[0, 0], [100, 100]];
        const distances = centers.map(([cx, cy]) => Math.abs(Math.hypot(x - cx, y - cy) - 50));
        const arc = distances[0] <= distances[1] ? 0 : 1;
        selected = analysis.segmentComponent[i * 2 + arc];
        render();
      }
    });
    button.addEventListener('keydown', event => {
      const offsets = {ArrowRight: 1, ArrowLeft: -1, ArrowDown: size, ArrowUp: -size};
      if (event.key in offsets) {
        event.preventDefault();
        tiles[(i + offsets[event.key] + tiles.length) % tiles.length].focus();
      }
    });
    $('board').append(button);
    return button;
  });

  function render() {
    analysis = M.analyze(board, size);
    tiles.forEach((button, i) => {
      button.setAttribute('aria-label', `Tile row ${Math.floor(i / size) + 1} column ${i % size + 1}, ${mode === 'rotate' ? 'rotate' : 'trace north arc'}`);
      button.classList.toggle('marked', challenge && i === 27 && board[27] === initial[27]);
      button.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true">${paths[board[i]].map((path, arc) => {
        const id = analysis.segmentComponent[i * 2 + arc];
        return `<path d="${path}" class="${analysis.components[id].closed ? 'loop' : ''} ${selected === id ? 'selected' : ''}"/>`;
      }).join('')}</svg>`;
    });
    $('loop-count').textContent = analysis.loops.length;
    $('longest').textContent = analysis.longestLoop;
    $('turns').textContent = turns;
    if (selected !== null && analysis.components[selected]) {
      const component = analysis.components[selected];
      $('thread-title').textContent = component.closed ? 'This thread comes home.' : 'This one leaves the field.';
      $('thread-detail').textContent = `${component.length} curved arcs · ${component.closed ? 'a closed circuit with no loose ends.' : 'an open path with two boundary ends.'} A tile can carry two different threads.`;
    } else {
      $('thread-title').textContent = 'Everything is connected. Just not to everything.';
      $('thread-detail').textContent = mode === 'trace' ? 'Tap a curve to highlight its full path. Keyboard activation traces the north arc.' : 'Switch to Trace, then tap a curve. Its whole path lights up—even when it visits a tile twice.';
    }
    const solved = challenge && [27, 28, 35, 36].every((tile, j) => board[tile] === [1, 0, 0, 1][j]);
    $('challenge-status').textContent = challenge ? (solved ? 'Loop closed! Four arcs, one little circuit. Keep exploring.' : 'Turn the orange-marked tile. The four center tiles can close a loop.') : 'Free play · every turn changes the connections.';
  }

  function load(next, isChallenge = false) {
    board = next.slice();
    initial = next.slice();
    turns = 0;
    selected = null;
    challenge = isChallenge;
    render();
  }
  function setMode(next) {
    mode = next;
    $('rotate-mode').setAttribute('aria-pressed', mode === 'rotate');
    $('trace-mode').setAttribute('aria-pressed', mode === 'trace');
    render();
  }
  $('rotate-mode').onclick = () => setMode('rotate');
  $('trace-mode').onclick = () => setMode('trace');
  $('challenge').onclick = () => { setMode('rotate'); load(M.createChallenge(), true); };
  $('reset').onclick = () => load(initial, challenge);
  $('seed-form').onsubmit = event => {
    event.preventDefault();
    $('seed').value = $('seed').value.trim() || 'november-13';
    load(M.createBoard($('seed').value, size));
  };
  $('shuffle').onclick = () => {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    $('seed').value = `field-${values[0].toString(36)}`;
    load(M.createBoard($('seed').value, size));
  };
  $('show-longest').onclick = () => {
    const longest = analysis.components.filter(component => component.closed).sort((a, b) => b.length - a.length)[0];
    if (longest) { selected = longest.id; setMode('trace'); }
    else { $('thread-title').textContent = 'No loops here. Yet.'; $('thread-detail').textContent = 'Try a rotation, or start the little challenge to close your first loop.'; }
  };
  load(M.createBoard($('seed').value, size));
  window.LoopApp = {getState: () => ({board: board.slice(), turns, mode, challenge, selected, loops: analysis.loops.length, longestLoop: analysis.longestLoop})};
})();
