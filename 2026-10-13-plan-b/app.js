// Drawing and control for the Plan B lab. The model lives in mine.js.
(function () {
  "use strict";

  const canvas = document.getElementById("scene");
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;

  const SURFACE = 112;          // y of the desert floor
  const ROCK_TOP = 142;         // y where depth 0 starts
  const SCALE = 0.62;           // px per metre of depth
  const LATERAL = 3;            // lateral exaggeration for deviation drawing
  const Y = (m) => ROCK_TOP + m * SCALE;
  const PADS = { A: 205, B: 445, C: 795 };
  const WORKSHOP = { x: 600, w: 104, h: 34 };

  const DRILL_PACES = [3, 12, 36];        // game-hours per real second
  const RESCUE_PACES = [3.3, 8.3, 20];
  let drillPace = 1, rescuePace = 1;

  let state = Mine.create({ seed: (Date.now() / 1000) & 0xffff });
  const input = { reverse: false };
  let lastFrame = performance.now();
  let running = true;

  const $ = (id) => document.getElementById(id);
  const fmtHM = (h) => `${Math.floor(h)} h ${String(Math.round((h % 1) * 60)).padStart(2, "0")} m`;

  // ---- drawing helpers ----------------------------------------------------
  function rockBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, SURFACE);
    sky.addColorStop(0, "#1b1830");
    sky.addColorStop(0.7, "#4b3049");
    sky.addColorStop(1, "#8a5a3c");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, SURFACE);
    // a few Atacama stars
    ctx.fillStyle = "rgba(255,246,224,.8)";
    [[60, 22], [180, 38], [300, 14], [520, 30], [700, 18], [840, 40], [900, 12], [410, 46]].forEach(([x, y]) => {
      ctx.fillRect(x, y, 1.6, 1.6);
    });
    // desert floor
    ctx.fillStyle = "#6b4c33";
    ctx.fillRect(0, SURFACE, W, ROCK_TOP - SURFACE);
    ctx.fillStyle = "#7d5a3c";
    ctx.fillRect(0, SURFACE, W, 5);
    // rock body with strata
    const rock = ctx.createLinearGradient(0, ROCK_TOP, 0, H);
    rock.addColorStop(0, "#2c2015");
    rock.addColorStop(1, "#1a120a");
    ctx.fillStyle = rock;
    ctx.fillRect(0, ROCK_TOP, W, H - ROCK_TOP);
    ctx.strokeStyle = "rgba(0,0,0,.35)";
    ctx.lineWidth = 1;
    for (let y = ROCK_TOP + 34; y < H; y += 42) {
      ctx.beginPath();
      for (let x = 0; x <= W; x += 48) ctx.lineTo(x, y + Math.sin(x * 0.02 + y) * 3);
      ctx.stroke();
    }
    // hard bands
    ctx.fillStyle = "rgba(20,16,10,.5)";
    for (const [lo, hi] of Mine.HARD_BANDS) ctx.fillRect(0, Y(lo), W, (hi - lo) * SCALE);
    ctx.fillStyle = "rgba(214,196,160,.55)";
    ctx.font = "10px ui-monospace, Menlo, monospace";
    ctx.fillText("hard rock — slower, eats steel", 330, Y(180) - 4);
    // depth ruler
    ctx.fillStyle = "rgba(214,196,160,.5)";
    ctx.textAlign = "right";
    for (let d = 0; d <= 700; d += 100) {
      ctx.fillRect(34, Y(d), 8, 1);
      ctx.fillText(`${d}`, 30, Y(d) + 3);
    }
    ctx.textAlign = "left";
    ctx.save();
    ctx.translate(14, Y(350));
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("depth, metres", 0, 0);
    ctx.restore();
  }

  function drawCampHope() {
    // tents and a flag near the ramp portal
    ctx.fillStyle = "#c9bda1";
    for (const [x, s] of [[62, 1], [92, .8], [118, 1.15]]) {
      ctx.beginPath();
      ctx.moveTo(x - 11 * s, SURFACE);
      ctx.lineTo(x, SURFACE - 13 * s);
      ctx.lineTo(x + 11 * s, SURFACE);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = "#4a3b2a";
    ctx.beginPath();
    ctx.moveTo(146, SURFACE);
    ctx.lineTo(146, SURFACE - 22);
    ctx.stroke();
    ctx.fillStyle = "#d94a3a";
    ctx.fillRect(146, SURFACE - 22, 12, 5);
    ctx.fillStyle = "#3a4d8f";
    ctx.fillRect(146, SURFACE - 17, 12, 5);
    ctx.fillStyle = "rgba(214,196,160,.6)";
    ctx.font = "10px ui-monospace, Menlo, monospace";
    ctx.fillText("Camp Hope", 46, SURFACE + 12);
  }

  function drawRamp() {
    ctx.strokeStyle = "rgba(230,210,170,.28)";
    ctx.setLineDash([5, 6]);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(70, ROCK_TOP + 4);
    const pts = [[185, 240], [105, 330], [235, 400], [150, 462], [310, 505],
                 [WORKSHOP.x - WORKSHOP.w / 2 - 4, Y(622)]];
    for (const [x, y] of pts) ctx.lineTo(x, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(214,196,160,.5)";
    ctx.font = "10px ui-monospace, Menlo, monospace";
    ctx.fillText("the ramp — 5 km of tunnel from the portal", 80, ROCK_TOP + 22);
  }

  function workshopDots(rescued) {
    const n = 33;
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / 11), col = i % 11;
      const x = WORKSHOP.x - WORKSHOP.w / 2 + 9 + col * 8.6;
      const y = Y(622) - 9 + row * 8;
      const gone = i < rescued;
      ctx.fillStyle = gone ? "rgba(120,110,90,.35)" : "#ffd98a";
      ctx.beginPath();
      ctx.arc(x, y, 1.9, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawWorkshop(rescued, glow) {
    ctx.save();
    ctx.shadowColor = "rgba(232,161,58,.85)";
    ctx.shadowBlur = glow ? 22 : 10;
    ctx.fillStyle = "#332414";
    const x = WORKSHOP.x - WORKSHOP.w / 2, y = Y(622) - WORKSHOP.h / 2;
    roundRect(x, y, WORKSHOP.w, WORKSHOP.h, 7);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = "#e8a13a";
    ctx.lineWidth = 1.4;
    roundRect(x, y, WORKSHOP.w, WORKSHOP.h, 7);
    ctx.stroke();
    workshopDots(rescued);
    ctx.fillStyle = "rgba(255,217,138,.9)";
    ctx.font = "10px ui-monospace, Menlo, monospace";
    ctx.textAlign = "center";
    ctx.fillText("refuge · 622 m", WORKSHOP.x, y - 6);
    ctx.textAlign = "left";
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawDerrick(x, hue, label, active) {
    ctx.strokeStyle = active ? hue : "rgba(140,125,100,.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 12, SURFACE);
    ctx.lineTo(x, SURFACE - 30);
    ctx.lineTo(x + 12, SURFACE);
    ctx.moveTo(x - 6, SURFACE - 16);
    ctx.lineTo(x + 6, SURFACE - 16);
    ctx.stroke();
    if (active) {
      ctx.fillStyle = hue;
      ctx.fillRect(x - 3, SURFACE - 30, 6, 4);
    }
    ctx.fillStyle = active ? "rgba(214,196,160,.85)" : "rgba(214,196,160,.45)";
    ctx.font = "10px ui-monospace, Menlo, monospace";
    ctx.textAlign = "center";
    ctx.fillText(label, x, SURFACE + 12);
    ctx.textAlign = "left";
  }

  function header() {
    ctx.fillStyle = "rgba(255,250,240,.92)";
    ctx.font = "700 17px ui-monospace, Menlo, monospace";
    const d = Mine.fmtDate(state.t) + " " + Mine.fmtClock(state.t);
    ctx.fillText(`${d}  ·  Day ${Mine.dayOf(state.t)}`, 44, 30);
    ctx.font = "11px ui-monospace, Menlo, monospace";
    ctx.fillStyle = "rgba(255,250,240,.55)";
    ctx.fillText(hoursInto(state.t) + " since the cave-in · 33 below", 44, 46);
  }
  const hoursInto = (t) => {
    const h = Math.floor(t), d = Math.floor(t / 24);
    return `${d} d ${h % 24} h`;
  };

  // ---- drill phase --------------------------------------------------------
  function drawDrill() {
    rockBackground();
    drawCampHope();
    drawRamp();
    const won = state.winner;
    drawWorkshop(0, !!won);

    // the target zone: ±15 m of lateral miss, exaggerated like everything lateral
    ctx.strokeStyle = "rgba(232,161,58,.35)";
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.strokeRect(WORKSHOP.x - Mine.TOL * SCALE * LATERAL, Y(560),
      Mine.TOL * 2 * SCALE * LATERAL, Y(690) - Y(560));
    ctx.setLineDash([]);

    for (const key of ["A", "B", "C"]) {
      const plan = Mine.PLANS[key], p = state.plans[key];
      const active = ["drill", "dull", "trip", "fishing", "fault"].includes(p.state);
      drawDerrick(PADS[key], plan.hue, `${key} · ${plan.rig}`, active);

      const ex = WORKSHOP.x + p.dev * SCALE * LATERAL;
      const ey = Y(plan.breakDepth);
      const frac = Math.max(0, Math.min(1, p.depth / plan.breakDepth));
      const sx = PADS[key], sy = ROCK_TOP;

      // planned path (faint, per plan) then drilled part (solid)
      ctx.strokeStyle = p.state === "off"
        ? "rgba(150,120,90,.25)"
        : `rgba(${plan.rgb},.28)`;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.setLineDash([]);
      if (frac > 0.02) {
        ctx.strokeStyle = p.state === "off" ? "rgba(179,38,30,.5)" : plan.hue;
        ctx.lineWidth = p.state === "won" ? 4 : 2.4;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + (ex - sx) * frac, sy + (ey - sy) * frac);
        ctx.stroke();
        // the bit at the working face
        const bx = sx + (ex - sx) * frac, by = sy + (ey - sy) * frac;
        ctx.fillStyle = p.state === "dull" ? "#8a8f80" : "#fff6e0";
        ctx.beginPath();
        ctx.arc(bx, by, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = "10.5px ui-monospace, Menlo, monospace";
        ctx.fillStyle = "rgba(255,250,240,.8)";
        ctx.fillText(`${Math.round(p.depth)} m · ${p.dev >= 0 ? "+" : ""}${p.dev.toFixed(1)} m off`, bx + 8, by + 3);
      }
    }
    header();

    if (state.winner) {
      banner(`${state.winner} broke through`, `${Mine.PLANS[state.winner].breakDepth} m, into the workshop`);
    }
  }

  // ---- ream and rescue ----------------------------------------------------
  function shaftX() { return 470; }

  function drawReam() {
    rockBackground();
    drawCampHope();
    drawRamp();
    drawWorkshop(0, true);
    const key = state.winner;
    const done = 1 - state.reamLeft / Mine.REAM_HOURS;
    const x = shaftX();
    ctx.strokeStyle = Mine.PLANS[key].hue;
    ctx.lineWidth = 1.5 + done * 3;
    ctx.beginPath();
    ctx.moveTo(x, ROCK_TOP);
    ctx.lineTo(x, Y(Mine.PLANS[key].breakDepth));
    ctx.stroke();
    drawDerrick(x, Mine.PLANS[key].hue, `${key} hole`, true);
    header();
    const cm = Math.round(14 + done * 52);
    ctx.fillStyle = "rgba(255,250,240,.9)";
    ctx.font = "700 15px ui-monospace, Menlo, monospace";
    ctx.textAlign = "center";
    ctx.fillText(`reaming · ${cm} cm of 66 cm`, x, ROCK_TOP + 60);
    ctx.font = "11px ui-monospace, Menlo, monospace";
    ctx.fillStyle = "rgba(255,250,240,.6)";
    ctx.fillText(done > 0.85 ? "steel casing going into the top 56 m" : "bigger bit, same hole", x, ROCK_TOP + 78);
    ctx.textAlign = "left";
  }

  function drawCapsule(x, y, moving, snagged, distressed) {
    ctx.save();
    if (snagged) {
      ctx.shadowColor = "rgba(179,38,30,.9)";
      ctx.shadowBlur = 14 + Math.sin(state.t * 40) * 8;
    } else {
      ctx.shadowColor = "rgba(232,161,58,.75)";
      ctx.shadowBlur = 12;
    }
    ctx.fillStyle = distressed ? "#b3261e" : "#e8a13a";
    roundRect(x - 8, y - 21, 16, 42, 5);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = "rgba(30,20,10,.7)";
    ctx.lineWidth = 1.4;
    roundRect(x - 8, y - 21, 16, 42, 5);
    ctx.stroke();
    // spring-loaded guide wheels at each end
    ctx.strokeStyle = "#d8d1bc";
    ctx.beginPath();
    ctx.moveTo(x, y - 21); ctx.lineTo(x, y - 27);
    ctx.moveTo(x, y + 21); ctx.lineTo(x, y + 27);
    ctx.stroke();
    ctx.fillStyle = "#f4f0e4";
    for (const wy of [y - 28, y + 28]) {
      ctx.beginPath();
      ctx.arc(x, wy, 3.4, 0, Math.PI * 2);
      ctx.fill();
    }
    // a small window with the rider
    ctx.fillStyle = distressed ? "#ffb0a6" : "#3a2c1e";
    ctx.fillRect(x - 4, y - 6, 8, 12);
  }

  function drawRescue() {
    rockBackground();
    drawCampHope();
    drawRamp();
    const r = state.rescue;
    const key = state.winner, depth = r.depth;
    drawWorkshop(r.upCount, true);
    const x = shaftX();

    // casing in the top 56 m
    ctx.strokeStyle = "#8d949a";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(x, ROCK_TOP);
    ctx.lineTo(x, Y(56));
    ctx.stroke();
    // open rock below
    ctx.strokeStyle = "rgba(232,161,58,.5)";
    ctx.lineWidth = 3;
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.moveTo(x, Y(56));
    ctx.lineTo(x, Y(depth));
    ctx.stroke();
    ctx.setLineDash([]);

    // headframe and sheave
    ctx.strokeStyle = Mine.PLANS[key].hue;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(x - 17, SURFACE); ctx.lineTo(x, SURFACE - 38); ctx.lineTo(x + 17, SURFACE);
    ctx.moveTo(x - 9, SURFACE - 21); ctx.lineTo(x + 9, SURFACE - 21);
    ctx.stroke();
    ctx.fillStyle = "#1b1713";
    ctx.beginPath();
    ctx.arc(x, SURFACE - 38, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#f4f0e4";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    const a = (r.pos / 0.6) % (Math.PI * 2);
    ctx.moveTo(x + Math.cos(a) * 6, SURFACE - 38 + Math.sin(a) * 6);
    ctx.lineTo(x - Math.cos(a) * 6, SURFACE - 38 - Math.sin(a) * 6);
    ctx.stroke();
    // cable
    const cy0 = Math.max(ROCK_TOP + 34, Math.min(Y(depth) - 30, Y(r.pos)));
    ctx.strokeStyle = "rgba(244,240,228,.8)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, SURFACE - 38);
    ctx.lineTo(x, cy0 - 30);
    ctx.stroke();

    const cy = cy0;
    const moving = ["descend", "gdesc", "ascend"].includes(r.sub) && !r.snagged;
    drawCapsule(x, cy, moving, r.snagged, r.distressed);

    // depth ticks beside the shaft
    ctx.fillStyle = "rgba(214,196,160,.55)";
    ctx.font = "10px ui-monospace, Menlo, monospace";
    ctx.textAlign = "right";
    for (let d = 100; d <= 600; d += 100) ctx.fillText(`${d}`, x - 14, Y(d) + 3);
    ctx.textAlign = "left";

    // the crowd of rescued men on the surface
    for (let i = 0; i < r.upCount; i++) {
      const px = 560 + (i % 17) * 19, py = SURFACE - 6 - Math.floor(i / 17) * 3;
      ctx.fillStyle = "#f4e9c8";
      ctx.fillRect(px - 1, py - 5, 2, 5);
      ctx.beginPath();
      ctx.arc(px, py - 7, 1.7, 0, Math.PI * 2);
      ctx.fill();
    }
    if (r.upCount) {
      ctx.fillStyle = "rgba(214,196,160,.7)";
      ctx.fillText(`${r.upCount} up`, 560, SURFACE + 12);
    }
    // medical tent
    ctx.fillStyle = "#e6e0cf";
    ctx.beginPath();
    ctx.moveTo(660, SURFACE); ctx.lineTo(676, SURFACE - 15); ctx.lineTo(692, SURFACE);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#b3261e";
    ctx.fillRect(674, SURFACE - 11, 5, 2);

    header();
    ctx.fillStyle = "rgba(255,250,240,.92)";
    ctx.font = "700 15px ui-monospace, Menlo, monospace";
    ctx.fillText(`${r.upCount} / 33 up`, 44, 66);

    if (r.snagged) {
      ctx.fillStyle = "#b3261e";
      ctx.font = "700 16px ui-monospace, Menlo, monospace";
      ctx.textAlign = "center";
      ctx.fillText("SNAG — hold REVERSE", W / 2, ROCK_TOP + 46);
      ctx.textAlign = "left";
    }

    if (state.phase === "done") {
      const span = r.lastUpAt - r.firstUpAt;
      banner("33 of 33 up",
        `your lift ${fmtHM(span)} · history 21 h 44 m · day ${Mine.dayOf(r.lastUpAt)}`);
    }
  }

  function banner(title, sub) {
    ctx.fillStyle = "rgba(10,8,6,.82)";
    roundRect(W / 2 - 210, H / 2 - 52, 420, 84, 12);
    ctx.fill();
    ctx.strokeStyle = "#e8a13a";
    ctx.lineWidth = 1.6;
    roundRect(W / 2 - 210, H / 2 - 52, 420, 84, 12);
    ctx.stroke();
    ctx.fillStyle = "#ffd98a";
    ctx.font = "700 24px ui-monospace, Menlo, monospace";
    ctx.textAlign = "center";
    ctx.fillText(title, W / 2, H / 2 - 16);
    ctx.fillStyle = "rgba(255,250,240,.85)";
    ctx.font = "12.5px ui-monospace, Menlo, monospace";
    ctx.fillText(sub, W / 2, H / 2 + 10);
    ctx.textAlign = "left";
  }

  function draw() {
    if (state.phase === "drill") drawDrill();
    else if (state.phase === "ream") drawReam();
    else drawRescue();
  }

  // ---- panel --------------------------------------------------------------
  const RIG_STATE = {
    wait: "waiting", drill: "drilling", dull: "bit gone — limping",
    fishing: "fishing broken bit", fault: "pulled off line — repositioning",
    trip: "tripping", off: "off target", halted: "halted", won: "breakthrough",
  };

  function updateDrillPanel() {
    $("day-chip").textContent = `Day ${Mine.dayOf(state.t)} · ${Mine.fmtDate(state.t)}`;
    for (const key of ["A", "B", "C"]) {
      const k = key.toLowerCase(), p = state.plans[key];
      $(`${k}-depth`).textContent = `${Math.round(p.depth)} m`;
      const plan = Mine.PLANS[key];
      let rop = plan.rop / 24;
      const hard = Mine.hardness(p.depth);
      if (hard > 1) rop /= hard;
      if (p.state === "dull") rop *= 0.15;
      if (p.steer) rop *= 0.55;
      $(`${k}-rop`).textContent = ["drill", "dull"].includes(p.state)
        ? `${(rop * 24).toFixed(1)} m/day` : "—";
      const bar = $(`${k}-bit`);
      bar.style.width = `${Math.max(0, Math.min(1, p.bit)) * 100}%`;
      bar.style.background = p.bit > 0.4 ? "var(--ok)" : p.bit > 0.18 ? "var(--warn)" : "var(--bad)";
      const bitp = $(`${k}-bitp`);
      bitp.textContent = `${Math.max(0, Math.round(p.bit * 100))}%`;
      bitp.style.color = p.bit > 0.4 ? "" : p.bit > 0.18 ? "var(--warn)" : "var(--bad)";
      const dev = $(`${k}-dev`);
      dev.textContent = `${p.dev >= 0 ? "+" : ""}${p.dev.toFixed(1)} m`;
      dev.className = "v " + (Math.abs(p.dev) > 10 ? "bad" : Math.abs(p.dev) > 6 ? "warn" : "");
      $(`${k}-state`).textContent = p.state === "trip" || p.state === "fishing" || p.state === "fault"
        ? `${RIG_STATE[p.state]} · ${p.faultLeft.toFixed(1)} h` : RIG_STATE[p.state];
      $(`${k}-change`).disabled = !["drill", "dull"].includes(p.state);
      $(`${k}-steer`).setAttribute("aria-pressed", p.steer);
      $(`${k}-steer`).classList.toggle("on", p.steer);
    }
    const b = state.plans.B;
    const next = ["A", "B", "C"].map((k) => {
      const p = state.plans[k];
      if (p.state === "dull") return `Plan ${k} is destroying its dead bit downhole`;
      if (p.state === "drill" && p.bit < 0.25)
        return `Plan ${k}'s bit is at ${Math.round(p.bit * 100)}% — a trip now costs ${Mine.PLANS[k].trip(p.depth).toFixed(1)} h`;
      return null;
    }).filter(Boolean);
    $("status").textContent = next.length
      ? next.join(". ") + "."
      : `Three drills are racing for one room, ${Mine.dayOf(state.t) - 17} days after the note came up. Watch the bit bars: hard rock eats steel, and every change means pulling every rod back out of the hole.`;
  }

  function updateRescuePanel() {
    const r = state.rescue;
    if (!r) {
      $("r-clock").textContent = `${Mine.fmtDate(state.t)} ${Mine.fmtClock(state.t)}`;
      $("r-up").textContent = "0 / 33";
      $("r-pos").textContent = "reaming";
      $("r-span").textContent = "—";
      $("r-rider").textContent = "—";
      $("r-note").textContent = `The ${state.winner} hole is being reamed to 66 cm and cased in the top 56 m — ${state.reamLeft.toFixed(0)} h of work before the capsule can run.`;
      $("reverse").disabled = true;
      return;
    }
    $("r-clock").textContent = `${Mine.fmtDate(state.t)} ${Mine.fmtClock(state.t)}`;
    $("r-up").textContent = `${r.upCount} / 33`;
    $("r-pos").textContent = r.pos < 1 ? "surface" : r.pos > r.depth - 1 ? "workshop" : `${Math.round(r.pos)} m`;
    $("r-span").textContent = r.lastUpAt ? fmtHM(r.lastUpAt - r.firstUpAt)
      : r.firstUpAt ? fmtHM(state.t - r.firstUpAt) : "—";
    const rider = r.riders[Math.min(r.n, 32)];
    $("r-rider").textContent = state.phase === "done" ? "all out"
      : r.sub === "tests" || r.sub === "gdesc" ? "González, first rescuer down"
      : `${r.n + 1} of 33 · ${rider.tag}`;
    const gearV = Mine.GEARS[r.gear];
    let note = "";
    if (state.phase === "done") note = `Every man came up the same 66 cm hole. First to last: ${fmtHM(r.lastUpAt - r.firstUpAt)} — the real operation took 21 h 44 m.`;
    else if (r.snagged) note = "A wheel is caught on the wall. Hold REVERSE (or R) until the capsule backs off the shelf.";
    else if (r.distressed) note = "He is struggling in the dark. The winch eases until he settles.";
    else if (r.sub === "descend") note = "Empty capsule going down with food, water and letters.";
    else if (r.sub === "load") note = `Below: harness on, eyes covered, ${Math.ceil(r.subLeft * 60)} min of checks.`;
    else if (r.sub === "ascend") note = `Climbing at ${(rider.tol < gearV ? rider.tol : gearV).toFixed(2)} m/s — ${Math.round(r.pos)} m to go.`;
    else if (r.sub === "unload") note = "Handover at the collar. The tent takes him.";
    else if (r.sub === "tail") note = "The last rescuers are coming up.";
    else note = "Survey, strap checks, winch test — the operation starts slow on purpose.";
    $("r-note").textContent = note;
    const rev = $("reverse");
    rev.disabled = !r.snagged;
    rev.classList.toggle("down", input.reverse && r.snagged);
    document.querySelectorAll("#gear button").forEach((b) =>
      b.setAttribute("aria-pressed", b.dataset.gear === r.gear));
  }

  function updatePanel() {
    const drilling = state.phase === "drill";
    $("drill-panel").classList.toggle("hidden", !drilling);
    $("rescue-panel").classList.toggle("hidden", drilling);
    if (drilling) updateDrillPanel();
    else updateRescuePanel();
    $("loglines").textContent = state.log.slice(-3).map((l) => l.text).join("\n");
  }

  // ---- wiring -------------------------------------------------------------
  for (const key of ["A", "B", "C"]) {
    const k = key.toLowerCase();
    $(`${k}-change`).addEventListener("click", () => Mine.changeBit(state, key));
    $(`${k}-steer`).addEventListener("click", () => Mine.setSteer(state, key, !state.plans[key].steer));
  }
  document.querySelectorAll("#gear button").forEach((b) =>
    b.addEventListener("click", () => { if (state.rescue) state.rescue.gear = b.dataset.gear; }));
  for (const [id, setter] of [["pace-drill", (i) => (drillPace = i)], ["pace-rescue", (i) => (rescuePace = i)]]) {
    document.querySelectorAll(`#${id} button`).forEach((b) =>
      b.addEventListener("click", () => {
        setter(+b.dataset.pace);
        document.querySelectorAll(`#${id} button`).forEach((x) => x.setAttribute("aria-pressed", x === b));
      }));
  }
  const reverseDown = (down) => { input.reverse = down && state.rescue && state.rescue.snagged; };
  for (const ev of ["pointerdown"]) $("reverse").addEventListener(ev, (e) => { e.preventDefault(); reverseDown(true); });
  for (const ev of ["pointerup", "pointerleave", "pointercancel"]) $("reverse").addEventListener(ev, () => reverseDown(false));
  window.addEventListener("keydown", (e) => {
    if ((e.key === "r" || e.key === "R" || e.key === " ") && !e.repeat) { e.preventDefault(); reverseDown(true); }
  });
  window.addEventListener("keyup", (e) => {
    if (e.key === "r" || e.key === "R" || e.key === " ") reverseDown(false);
  });
  $("reset").addEventListener("click", () => {
    state = Mine.create({ seed: (Math.random() * 1e9) | 0 });
    input.reverse = false;
    updatePanel();
  });

  function paceNow() {
    if (state.phase === "drill") return DRILL_PACES[drillPace];
    if (state.rescue && state.rescue.snagged) return 0.004; // slow-mo to work the snag
    if (state.phase === "rescue" && state.rescue.n >= 31) return Math.min(RESCUE_PACES[rescuePace], 6);
    return RESCUE_PACES[rescuePace];
  }

  let live = true;

  function frame(now) {
    const dt = Math.min(0.1, (now - lastFrame) / 1000);
    lastFrame = now;
    if (running && live) Mine.step(state, dt * paceNow(), input);
    draw();
    updatePanel();
    requestAnimationFrame(frame);
  }

  // Interface for the video recorder: deterministic stepping with the page
  // clock paused (rAF frozen), the same calls a live player would make.
  window.planB = {
    get state() { return state; },
    newGame(seed) { state = Mine.create({ seed }); input.reverse = false; updatePanel(); draw(); },
    step(hours) { Mine.step(state, hours, input); draw(); updatePanel(); },
    setGear(g) { if (state.rescue) state.rescue.gear = g; updatePanel(); },
    setReverse(on) { input.reverse = !!on; },
    setLive(v) { live = !!v; },
    draw, updatePanel,
  };

  updatePanel();
  draw();
  requestAnimationFrame(frame);
})();
