// No Overlap — DOM controller. Builds the 1983 desktop from NoOverlapModel
// state and keeps it in sync: title clicks re-tile, sashes resize, zoom and
// the icon strip work, and the 1987 toggle lets windows overlap again.
(() => {
  'use strict';

  const M = NoOverlapModel;
  const state = M.initialState();

  const tiles = document.getElementById('tiles');
  const iconStrip = document.getElementById('icon-strip');
  const logList = document.getElementById('log');
  const els = {
    current: document.getElementById('r-current'),
    open: document.getElementById('r-open'),
    overlap: document.getElementById('r-overlap'),
    col: document.getElementById('r-col'),
    modeTile: document.getElementById('mode-tile'),
    modeOverlap: document.getElementById('mode-overlap'),
  };

  const pct = v => `${(v * 100).toFixed(2)}%`;

  function log(text) {
    const li = document.createElement('li');
    li.textContent = text;
    logList.appendChild(li);
    while (logList.children.length > 9) logList.removeChild(logList.firstChild);
    logList.classList.remove('quiet-initial');
  }

  // ---------- app contents ----------

  const DOS_ROWS = [
    ['COMMAND', 'COM', '17792', ' 3-08-83'],
    ['BASIC', 'COM', '16256', ' 3-08-83'],
    ['CHKDSK', 'COM', '6400', ' 3-08-83'],
    ['DISKCOPY', 'COM', '4448', ' 3-08-83'],
    ['EDLIN', 'COM', '4608', ' 3-08-83'],
    ['WIN', 'COM', '—', '11-10-83'],
  ];

  function dosContent() {
    const ul = document.createElement('ul');
    ul.className = 'dos-list';
    const path = document.createElement('li');
    path.className = 'dos-path';
    path.textContent = 'A:\\';
    ul.appendChild(path);
    for (const [name, ext, size, date] of DOS_ROWS) {
      const li = document.createElement('li');
      li.className = 'dos-row' + (name === 'WIN' ? ' dos-win' : '');
      li.innerHTML = `<b>${name}</b><i>${ext}</i><span>${size}</span><span>${date}</span>`;
      li.title = 'Nothing to run yet — Windows ships in 1985';
      ul.appendChild(li);
    }
    ul.addEventListener('click', e => {
      const row = e.target.closest('.dos-row');
      if (row) log('MS-DOS Executive: nothing to run yet — Windows ships 20 Nov 1985.');
    });
    return ul;
  }

  function clockContent() {
    const wrap = document.createElement('div');
    wrap.className = 'clock-face';
    wrap.innerHTML = '<b id="clock-time">--:--:--</b><span id="clock-date"></span>';
    const tick = () => {
      const now = new Date();
      const p = n => String(n).padStart(2, '0');
      const t = document.getElementById('clock-time');
      if (!t) return;
      t.textContent = `${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`;
      document.getElementById('clock-date').textContent =
        now.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
    };
    setInterval(tick, 1000);
    pendingClockTick = tick;      // run once once the window is mounted
    return wrap;
  }

  function notepadContent() {
    const ta = document.createElement('textarea');
    ta.className = 'notepad';
    ta.spellcheck = false;
    ta.value = 'Plaza Hotel, New York\n10 November 1983\n\nWindows announced today:\nwindows tile, they never overlap.\n$99. Ships November 1985.';
    return ta;
  }

  function calcContent() {
    const wrap = document.createElement('div');
    wrap.className = 'calc';
    wrap.innerHTML = '<output class="calc-display">0</output>';
    const keys = ['C', '÷', '×', '−', '7', '8', '9', '+', '4', '5', '6', '=', '1', '2', '3', '.', '0'];
    const c = { acc: null, op: null, disp: '0', fresh: true };
    const show = () => { wrap.querySelector('.calc-display').textContent = c.disp; };
    const apply = (a, b, op) => op === '+' ? a + b : op === '−' ? a - b : op === '×' ? a * b : b === 0 ? NaN : a / b;
    wrap.addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const k = btn.textContent;
      if (/[0-9]/.test(k)) {
        c.disp = c.fresh ? k : (c.disp === '0' ? k : c.disp + k);
        c.fresh = false;
      } else if (k === '.') {
        if (c.fresh) { c.disp = '0.'; c.fresh = false; }
        else if (!c.disp.includes('.')) c.disp += '.';
      } else if (k === 'C') {
        Object.assign(c, { acc: null, op: null, disp: '0', fresh: true });
      } else if (k === '=') {
        if (c.op !== null && c.acc !== null) {
          const r = apply(c.acc, parseFloat(c.disp), c.op);
          c.disp = Number.isFinite(r) ? String(Math.round(r * 1e8) / 1e8) : 'Error';
          Object.assign(c, { acc: null, op: null, fresh: true });
        }
      } else { // operator
        if (c.op !== null && c.acc !== null && !c.fresh) {
          const r = apply(c.acc, parseFloat(c.disp), c.op);
          c.acc = Number.isFinite(r) ? r : 0;
          c.disp = Number.isFinite(r) ? String(Math.round(r * 1e8) / 1e8) : 'Error';
        } else {
          c.acc = parseFloat(c.disp);
        }
        c.op = k;
        c.fresh = true;
      }
      show();
    });
    const grid = document.createElement('div');
    grid.className = 'calc-keys';
    for (const k of keys) {
      const b = document.createElement('button');
      b.textContent = k;
      if (/[÷×−+=]/.test(k)) b.className = 'calc-op';
      if (k === '=') b.classList.add('calc-eq');
      grid.appendChild(b);
    }
    wrap.appendChild(grid);
    return wrap;
  }

  function calendarContent() {
    const wrap = document.createElement('div');
    wrap.className = 'calendar';
    let html = '<div class="cal-title">NOVEMBER 1983</div><div class="cal-grid">';
    for (const d of ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']) html += `<i>${d}</i>`;
    for (let i = 0; i < 2; i++) html += '<i></i>';      // 1 Nov 1983 was a Tuesday
    for (let d = 1; d <= 30; d++) {
      html += d === 10 ? '<b class="cal-day">10</b>' : `<b>${d}</b>`;
    }
    html += '</div><span class="cal-note">Plaza Hotel — Windows announced</span>';
    wrap.innerHTML = html;
    return wrap;
  }

  const CONTENT = { dos: dosContent, clock: clockContent, notepad: notepadContent, calc: calcContent, calendar: calendarContent };
  let pendingClockTick = null;

  // ---------- rendering ----------

  function windowEl(app) {
    const win = document.createElement('section');
    win.className = 'win';
    win.id = `win-${app.id}`;
    win.dataset.id = app.id;
    const title = document.createElement('div');
    title.className = 'title';
    title.innerHTML =
      `<button class="sysbox" title="Icon" aria-label="Icon ${app.name}"></button>` +
      `<span class="title-name">${app.name}</span>` +
      `<button class="zoom-btn" title="Zoom" aria-label="Zoom ${app.name}">` +
      '<svg viewBox="0 0 14 12" aria-hidden="true"><rect x="1" y="4" width="12" height="7"/><path d="M7 0 L10 3 H4 Z"/></svg></button>';
    win.appendChild(title);
    const content = document.createElement('div');
    content.className = 'content';
    content.appendChild(CONTENT[app.id]());
    win.appendChild(content);
    return win;
  }

  function iconEl(app) {
    const btn = document.createElement('button');
    btn.className = 'iconified';
    btn.dataset.id = app.id;
    btn.innerHTML = `<span class="icon-art" aria-hidden="true"></span><span>${app.name}</span>`;
    return btn;
  }

  function render() {
    tiles.querySelectorAll('.win').forEach(el => el.remove());
    iconStrip.textContent = '';
    for (const app of M.APPS) {
      if (state.wins[app.id].iconified) continue;
      tiles.appendChild(windowEl(app));
    }
    for (const app of M.APPS) {
      if (state.wins[app.id].iconified) iconStrip.appendChild(iconEl(app));
    }
    renderPositions();
    if (pendingClockTick) { const t = pendingClockTick; pendingClockTick = null; t(); }
  }

  function renderPositions() {
    const mode = state.mode;
    tiles.classList.toggle('overlap-mode', mode === 'overlap');
    tiles.classList.toggle('zoomed', state.zoomed);
    document.getElementById('desk-sub').textContent =
      state.zoomed ? '/ 1.0 RULES · ZOOMED' : mode === 'overlap' ? '/ 2.0 RULES · OVERLAP' : '/ 1.0 RULES · TILE';
    const z = mode === 'overlap';
    const rects = z
      ? Object.fromEntries(M.floatRects(state).map(({ id, rect }) => [id, rect]))
      : M.tileRects(state).rects;
    for (const el of tiles.querySelectorAll('.win')) {
      const id = el.dataset.id;
      const r = rects[id];
      if (!r) continue;
      el.style.left = pct(r.l);
      el.style.top = pct(r.t);
      el.style.width = pct(r.w);
      el.style.height = pct(r.h);
      el.classList.toggle('current', id === state.currentId && (!z || M.zOf(state, id) === state.zTop));
      el.style.zIndex = z ? M.zOf(state, id) : '';
    }
    const clashing = new Set(M.overlapPairs(state).clashing);
    for (const el of tiles.querySelectorAll('.win')) {
      el.classList.toggle('clash', z && clashing.has(el.dataset.id));
    }
    // sashes (tile mode only)
    tiles.querySelectorAll('.sash').forEach(el => el.remove());
    for (const s of M.sashes(state)) {
      const el = document.createElement('div');
      el.className = `sash ${s.orient}`;
      el.dataset.kind = s.kind;
      el.dataset.index = s.index;
      if (s.orient === 'v') {
        el.style.left = pct(s.x);
        el.style.top = pct(s.y);
        el.style.height = pct(s.len);
      } else {
        el.style.left = pct(s.x);
        el.style.top = pct(s.y);
        el.style.width = pct(s.len);
      }
      tiles.appendChild(el);
    }
    // icon strip
    iconStrip.classList.toggle('has-icons', iconStrip.children.length > 0);
    // readouts
    const open = M.openIds(state);
    const atIcons = M.APPS.length - open.length;
    const pairs = M.overlapPairs(state).count;
    els.current.textContent = state.currentId ? (M.APPS.find(a => a.id === state.currentId) || M.APPS[0]).name : '—';
    els.open.innerHTML = `${open.length} tiled · <em>${atIcons} at the icons</em>`;
    els.overlap.innerHTML = mode === 'overlap'
      ? `<b>${pairs}</b> <em>pairs overlap</em>`
      : '0 <em>— tiles never overlap</em>';
    els.overlap.classList.toggle('clash-note', mode === 'overlap' && pairs > 0);
    els.col.textContent = `${Math.round(state.colFrac * 100)} %`;
    els.modeTile.setAttribute('aria-pressed', String(mode === 'tile'));
    els.modeOverlap.setAttribute('aria-pressed', String(mode === 'overlap'));
  }

  // ---------- interactions ----------

  let drag = null;   // active pointer drag

  function startDrag(e, onMove) {
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const box = tiles.getBoundingClientRect();
    drag = { el, box, startX: e.clientX, startY: e.clientY, onMove, moved: false };
  }

  function onPointerMove(e) {
    if (!drag) return;
    const dx = e.clientX - drag.startX, dy = e.clientY - drag.startY;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    drag.onMove(dx / drag.box.width, dy / drag.box.height, drag);
  }

  function endPointerDrag() {
    drag = null;
  }

  tiles.addEventListener('pointerdown', e => {
    const sashEl = e.target.closest('.sash');
    const winEl = e.target.closest('.win');
    if (sashEl) {
      const snap = {
        colFrac: state.colFrac, rowFrac: state.rowFrac,
        rightFracs: [...state.rightFracs], bottomFracs: [...state.bottomFracs],
      };
      startDrag(e, (dx, dy) => {
        Object.assign(state, { colFrac: snap.colFrac, rowFrac: snap.rowFrac });
        state.rightFracs = [...snap.rightFracs];
        state.bottomFracs = [...snap.bottomFracs];
        const kind = sashEl.dataset.kind;
        const d = kind === 'main-col' || kind === 'bottom' ? dx : dy;
        M.dragSash(state, kind, Number(sashEl.dataset.index), d);
        renderPositions();
      });
    } else if (winEl && state.mode === 'overlap' && e.target.closest('.title') && !e.target.closest('button')) {
      const id = winEl.dataset.id;
      const f = state.wins[id].float;
      const snap = { l: f.l, t: f.t };
      startDrag(e, (dx, dy) => {
        M.floatMove(state, id, snap.l + dx, snap.t + dy);
        renderPositions();
      });
    }
  });

  tiles.addEventListener('pointermove', onPointerMove);
  tiles.addEventListener('pointerup', endPointerDrag);
  tiles.addEventListener('pointercancel', endPointerDrag);

  // Clicks (separate from drags — click only fires when the pointer didn't move).
  tiles.addEventListener('click', e => {
    const winEl = e.target.closest('.win');
    if (!winEl) return;
    const id = winEl.dataset.id;
    if (e.target.closest('.sysbox')) {
      if (state.mode === 'tile' && !state.zoomed) {
        if (M.iconify(state, id)) {
          log(`${nameOf(id)} went to the icon strip. ${M.openIds(state).length} windows tiled.`);
          render();
        }
      } else {
        log(state.zoomed ? 'Click an icon below to bring a window back.' : 'No icon strip in 1987 rules.');
      }
      return;
    }
    if (e.target.closest('.zoom-btn')) {
      if (state.mode !== 'tile') { log('Zoom is a 1983 habit — 1987 windows overlap instead.'); return; }
      const on = !state.zoomed;
      if (M.setZoom(state, on)) {
        log(on
          ? `Zoom: ${nameOf(id)} fills the desktop; the rest wait at the icons.`
          : 'Zoom out — the desktop tiles again.');
        render();
      }
      return;
    }
    if (e.target.closest('.title') || e.target.closest('.content') && id !== state.currentId) {
      if (state.mode === 'overlap') {
        M.raise(state, id);
        renderPositions();
      } else if (id !== state.currentId) {
        M.makeCurrent(state, id);
        log(`${nameOf(id)} is the current window — the big tile.`);
        render();
      }
    }
  });

  iconStrip.addEventListener('click', e => {
    const btn = e.target.closest('.iconified');
    if (!btn) return;
    if (M.uniconify(state, btn.dataset.id)) {
      log(`${nameOf(btn.dataset.id)} is back and takes the big tile.`);
      render();
    }
  });

  els.modeTile.addEventListener('click', () => setMode('tile'));
  els.modeOverlap.addEventListener('click', () => setMode('overlap'));

  function setMode(mode) {
    if (state.mode === mode) return;
    const prev = state.mode;
    M.setMode(state, mode);
    if (mode === 'overlap') {
      const pairs = M.overlapPairs(state).count;
      log(`1987 rules: windows float and may overlap — ${pairs} pairs right now.`);
    } else {
      log('1983 rules: the desktop tiles itself. Every window gets its own rectangle.');
    }
    render();
  }

  document.getElementById('reset-sashes').addEventListener('click', () => {
    M.resetSashes(state);
    log('Sashes back to the factory split.');
    render();
  });

  function nameOf(id) {
    const app = M.APPS.find(a => a.id === id);
    return app ? app.name : id;
  }

  // ---------- test / video hooks ----------

  const api = {
    makeCurrent: id => { if (M.makeCurrent(state, id)) { log(`${nameOf(id)} is the current window — the big tile.`); render(); } },
    iconify: id => { if (M.iconify(state, id)) { log(`${nameOf(id)} went to the icon strip.`); render(); } },
    uniconify: id => { if (M.uniconify(state, id)) { log(`${nameOf(id)} is back and takes the big tile.`); render(); } },
    zoom: on => { if (M.setZoom(state, on)) { log(on ? `Zoom: ${nameOf(state.currentId)} fills the desktop.` : 'Zoom out — the desktop tiles again.'); render(); } },
    setMode,
    dragSash: (kind, index, d) => { M.dragSash(state, kind, index, d); renderPositions(); },
    floatMove: (id, l, t) => { if (M.floatMove(state, id, l, t)) { M.raise(state, id); renderPositions(); } },
    rects: () => {
      const r = state.mode === 'overlap'
        ? Object.fromEntries(M.floatRects(state).map(({ id, rect }) => [id, rect]))
        : M.tileRects(state).rects;
      return r;
    },
    pairs: () => M.overlapPairs(state),
    log,
  };
  window.NoOverlap = { state, api, model: M };

  render();
  log('10 Nov 1983, Plaza Hotel: Windows is announced. Five windows on one desktop, and none of them may overlap.');
})();
