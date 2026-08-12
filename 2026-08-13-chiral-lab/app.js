/*
 * chiral-lab — app
 *
 * Renders an object (violet "original") and its mirror image (cyan
 * "enantiomer") on one canvas, lets you drag-rotate the enantiomer to try to
 * superimpose it on the original, and shows — live — why you can (or can't):
 *
 *   • your RMSD     how far apart they are right now (drag to reduce it)
 *   • rotation floor the closest ANY turn can get (Kabsch, det +1)
 *   • with one flip ≈ 0 always (the improper map, det −1)
 *
 * Toggle "allow one reflection" and the enantiomer snaps perfectly onto the
 * original — the single move your wrist is physically incapable of.
 *
 * All the math lives in engine.js (ChiralLab). This file only does rendering
 * and interaction.
 */

(function () {
  "use strict";
  const E = window.ChiralLab;
  if (!E) return;

  // ── object catalog ────────────────────────────────────────────────────────
  // glyph + label for the picker; `make()` returns a generator result; `note`
  // is the one-line story shown under the picker.
  const CATALOG = [
    {
      key: "hand", glyph: "✋", label: "hand",
      make: () => E.hand(),
      chiral: true,
      note: "A real hand has a <b>front and a back</b> (the thumb is on one face). That depth is exactly what makes it chiral — a paper cutout you can flip is not.",
    },
    {
      key: "helix", glyph: "🧬", label: "helix",
      make: () => E.helix(90, 4, 0.6, 2.0, "right"),
      chiral: true,
      note: "A helix has a <b>twist sense</b>. DNA and protein α-helices are right-handed. The left-handed mirror is a different molecule you can never reach by turning.",
    },
    {
      key: "propeller", glyph: "🌀", label: "propeller",
      make: () => E.propeller(3, 1.0, 1.7),
      chiral: true,
      note: "Three blades with pitch. Push air one way and you get thrust; flip it and it pushes the other. A propeller's <b>handedness is its function</b>.",
    },
    {
      key: "tetra", glyph: "⚗", label: "molecule",
      make: () => E.tetrahedralMolecule(),
      chiral: true,
      note: "A carbon with <b>four different groups</b> at the tetrahedron's corners is a stereocentre — the canonical source of chirality in organic chemistry. The mirror is its <em>enantiomer</em>.",
    },
    {
      key: "snail", glyph: "🐚", label: "snail shell",
      make: () => E.snailShell(3.5, "right"),
      chiral: true,
      note: "Gastropod shells coil. <b>~90% of species go the same way</b> (dextral); the rare left-coiling (sinistral) ones are the snail lefties — a ~10% split that mirrors our own.",
    },
    {
      key: "F", glyph: "F", label: "flat F",
      make: () => E.flatF(),
      chiral: false,
      note: "A flat letter F. <b>Chiral in 2D</b> (no in-plane turn aligns its mirror) but <b>achiral in 3D</b> (flip it over). Toggle 2D mode and watch the floor jump.",
    },
  ];

  // ── DOM ───────────────────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const canvas = $("scene");
  const ctx = canvas.getContext("2d");
  const stage = $("stage");

  // ── state ─────────────────────────────────────────────────────────────────
  let current = CATALOG[0];
  let Pc = null;        // centred original cloud
  let E_mir = null;     // its mirror image (enantiomer), centred
  let edges = [];       // wireframe (index pairs into Pc)
  let groups = [];      // index ranges (for any per-group treatment)
  let boundR = 1;       // bounding radius of Pc (for fit + meter scale)

  let kabsch3 = null;   // {R, Rraw, rmsd, rmsdRaw, detRaw} for aligning E_mir → Pc
  let proc2d = null;    // {theta, rmsd} 2D optimum
  let U = E.identity(); // user's accumulated turn on the enantiomer (object space)
  let view = defaultView();
  let spinPhase = 0;

  let allowFlip = false;
  let plane2d = false;
  let spin = false;
  let dragging = false;
  let lastPt = null;

  function defaultView() {
    // A pleasant fixed 3D tilt; auto-spin adds to the y component.
    return E.multiply(E.fromAxisAngle([1, 0, 0], -0.52), E.fromAxisAngle([0, 1, 0], 0.62));
  }

  // ── load an object ────────────────────────────────────────────────────────
  function load(key) {
    current = CATALOG.find((c) => c.key === key) || CATALOG[0];
    const obj = current.make();
    Pc = E.center(obj.pts);
    E_mir = E.center(E.reflectCloud(Pc, E.reflect(E.PLANES.yz)));
    edges = obj.edges || [];
    groups = obj.groups || [];
    // bounding radius
    boundR = 1e-6;
    for (const p of Pc) boundR = Math.max(boundR, Math.hypot(p[0], p[1], p[2]));
    // precompute the two alignment floors
    kabsch3 = E.kabsch(Pc, E_mir);
    proc2d = E.procrustes2D(Pc, E_mir);
    U = E.identity();
    allowFlip = false; $("allowFlip").checked = false;
    // refresh picker highlight + note
    document.querySelectorAll(".obj").forEach((b) => b.classList.toggle("on", b.dataset.key === key));
    $("objNote").innerHTML = current.note;
    updateUI();
  }

  // ── current RMSD between original and (user-turned) enantiomer ────────────
  function currentRmsd() {
    if (allowFlip) return kabsch3.rmsdRaw;          // a flip aligns it → ~0
    const moved = E.rotate(E_mir, U);
    return E.rmsdRawPoints(Pc, moved);
  }
  function floorRmsd() {
    return plane2d ? proc2d.rmsd : kabsch3.rmsd;
  }

  // ── UI sync ───────────────────────────────────────────────────────────────
  function fmt(x) { return x < 1e-4 ? "0.000" : x.toFixed(3); }

  function updateUI() {
    const r = currentRmsd();
    const fl = floorRmsd();
    const isChiral = (plane2d ? proc2d.rmsd : kabsch3.rmsd) > 1e-6;

    $("kRmsd").textContent = fmt(r);
    $("kFloor").textContent = fmt(fl);
    $("kFlip").textContent = fmt(kabsch3.rmsdRaw);
    $("hudRmsd").textContent = fmt(r);
    $("hudFloor").textContent = fmt(fl);
    $("meterRmsd").textContent = fmt(r);

    const v = $("kVerdict");
    v.classList.remove("chiral", "achiral");
    if (allowFlip) { v.textContent = "aligned"; v.classList.add("achiral"); }
    else { v.textContent = isChiral ? "chiral" : "achiral"; v.classList.add(isChiral ? "chiral" : "achiral"); }

    // meter: map [0, boundR] → [0, 100]% of the track
    const span = Math.max(boundR, fl * 1.05, r);
    const pct = (x) => Math.max(0, Math.min(100, (x / span) * 100));
    $("meterYou").style.left = pct(r) + "%";
    $("meterFloor").style.left = pct(fl) + "%";
    $("meterFloor").style.display = allowFlip ? "none" : "block";

    // meter caption — the live pep talk
    const cap = $("meterCap");
    if (allowFlip) {
      cap.innerHTML = "one reflection and they <b>overlap exactly</b> — the single move a wrist cannot make.";
    } else if (!isChiral) {
      cap.innerHTML = "achiral: a turn <b>can</b> superimpose the mirror. Find it.";
    } else if (r <= fl + 1e-4) {
      cap.innerHTML = `that's the floor — <b>${fmt(fl)}</b>. No turn gets closer. Toggle the flip to finish it.`;
    } else {
      cap.innerHTML = `keep turning — the floor is <b>${fmt(fl)}</b>. You can't reach 0.`;
    }
  }

  // ── rendering ─────────────────────────────────────────────────────────────
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = stage.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
  }

  function project(p, V, w, h, scale, camDist) {
    const v = E.applyVec(V, p);
    const persp = camDist / (camDist - v[2]);
    return {
      x: w / 2 + v[0] * scale * persp,
      y: h / 2 - v[1] * scale * persp,
      z: v[2],
      persp,
    };
  }

  function drawCloud(cloud, transform, V, w, h, scale, camDist, color, alpha, glow, rad) {
    // transform points, project, depth-sort (far first), then draw
    const moved = E.rotate(cloud, transform);
    const pts = new Array(moved.length);
    for (let i = 0; i < moved.length; i++) pts[i] = project(moved[i], V, w, h, scale, camDist);
    const order = pts.map((_, i) => i).sort((a, b) => pts[a].z - pts[b].z);

    // edges first (behind the points), averaged depth
    if (edges.length) {
      for (const [a, b] of edges) {
        const pa = pts[a], pb = pts[b];
        const dm = (pa.z + pb.z) / 2;
        const fade = 0.35 + 0.65 * (dm + boundR) / (2 * boundR);
        ctx.strokeStyle = color;
        ctx.globalAlpha = alpha * 0.5 * Math.max(0.15, fade);
        ctx.lineWidth = Math.max(1, 1.6 * pa.persp);
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      }
    }
    // points
    ctx.fillStyle = color;
    ctx.shadowColor = glow ? color : "transparent";
    for (const i of order) {
      const p = pts[i];
      const fade = 0.4 + 0.6 * (p.z + boundR) / (2 * boundR);
      ctx.globalAlpha = alpha * Math.max(0.18, fade);
      ctx.shadowBlur = glow ? 8 * p.persp : 0;
      const rr = (rad || 2.6) * p.persp;
      ctx.beginPath();
      ctx.arc(p.x, p.y, rr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  function drawMirrorPlane(V, w, h, scale, camDist) {
    // a faint square in the yz-plane (the mirror: x → −x) so the reflection is legible
    const s = boundR * 1.25;
    const quad = [[0, -s, -s], [0, -s, s], [0, s, s], [0, s, -s]];
    const pr = quad.map((p) => project(p, V, w, h, scale, camDist));
    ctx.beginPath();
    ctx.moveTo(pr[0].x, pr[0].y);
    for (let i = 1; i < pr.length; i++) ctx.lineTo(pr[i].x, pr[i].y);
    ctx.closePath();
    ctx.strokeStyle = "rgba(232,181,58,.18)";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function frame() {
    if (spin) spinPhase += 0.0045;
    // build the shared view: tilt + optional auto-spin about y
    const V = spin
      ? E.multiply(E.fromAxisAngle([1, 0, 0], -0.52), E.fromAxisAngle([0, 1, 0], 0.62 + spinPhase))
      : E.multiply(E.fromAxisAngle([1, 0, 0], -0.52), E.fromAxisAngle([0, 1, 0], 0.62));
    view = V;

    const w = canvas.width, h = canvas.height;
    const camDist = 6;
    const scale = Math.min(w, h) * 0.34 / boundR;

    ctx.clearRect(0, 0, w, h);
    drawMirrorPlane(V, w, h, scale, camDist);

    // original (ghost, violet) — identity transform
    drawCloud(Pc, E.identity(), V, w, h, scale, camDist,
      "#a98bff", 0.32, true, 2.6);
    // enantiomer (cyan) — user turn U, OR the improper snap if allowFlip
    const enTransform = allowFlip ? kabsch3.Rraw : U;
    drawCloud(E_mir, enTransform, V, w, h, scale, camDist,
      "#54e3e0", 0.95, true, 3.0);

    // a soft tether line at each centroid showing how far apart they sit
    const c0 = project(E.applyVec(V, [0, 0, 0]), E.identity(), w, h, scale, camDist);
    const movedC = E.applyVec(enTransform, E.centroid(E_mir)); // 0, but kept for clarity
    void movedC; void c0;

    updateUI();
    requestAnimationFrame(frame);
  }

  // ── pointer / trackball ───────────────────────────────────────────────────
  function ptr(e) {
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX, y: t.clientY };
  }

  function onDown(e) {
    if (allowFlip) return; // locked while perfectly flipped
    dragging = true;
    lastPt = ptr(e);
    e.preventDefault();
  }
  function onMove(e) {
    if (!dragging) return;
    const p = ptr(e);
    const dx = (p.x - lastPt.x) * 0.01;
    const dy = (p.y - lastPt.y) * 0.01;
    lastPt = p;
    // 2D mode: only turn about the z-axis (in-plane)
    let dR;
    if (plane2d) {
      dR = E.fromAxisAngle([0, 0, 1], -dx);
    } else {
      dR = E.multiply(E.fromAxisAngle([0, 1, 0], dx), E.fromAxisAngle([1, 0, 0], dy));
    }
    U = E.multiply(dR, U); // world-frame turn, composed on the left
    e.preventDefault();
  }
  function onUp() { dragging = false; }

  stage.addEventListener("mousedown", onDown);
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
  stage.addEventListener("touchstart", onDown, { passive: false });
  window.addEventListener("touchmove", onMove, { passive: false });
  window.addEventListener("touchend", onUp);

  // ── controls ──────────────────────────────────────────────────────────────
  function buildPicker() {
    const el = $("picker");
    el.innerHTML = "";
    for (const c of CATALOG) {
      const b = document.createElement("button");
      b.className = "obj";
      b.dataset.key = c.key;
      b.innerHTML = `<span class="glyph">${c.glyph}</span>${c.label}`;
      b.addEventListener("click", () => load(c.key));
      el.appendChild(b);
    }
  }

  $("resetRot").addEventListener("click", () => { U = E.identity(); });
  $("bestBtn").addEventListener("click", () => {
    // snap the enantiomer to the closest any turn can get (the Kabsch proper R)
    if (plane2d) {
      U = E.fromAxisAngle([0, 0, 1], proc2d.theta);
    } else {
      U = kabsch3.R;
    }
  });
  $("allowFlip").addEventListener("change", (e) => {
    allowFlip = e.target.checked;
    $("modeBadge").textContent = allowFlip ? "reflection allowed — aligned" : "drag to turn the mirror";
  });
  $("plane2d").addEventListener("change", (e) => { plane2d = e.target.checked; });
  $("spinChk").addEventListener("change", (e) => { spin = e.target.checked; });

  // ── boot ──────────────────────────────────────────────────────────────────
  window.addEventListener("resize", resize);
  buildPicker();
  resize();
  load("hand");
  requestAnimationFrame(frame);
})();
