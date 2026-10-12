// node tests.js — checks for the San José race-and-lift model.
const M = require("./mine.js");

let passed = 0, failed = 0;
function check(name, ok, detail = "") {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
}
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const within = (a, lo, hi) => a >= lo && a <= hi;

// A player that changes bits below 30% and otherwise watches.
function autopilot(state, until) {
  while (state.t < until && state.phase === "drill") {
    for (const k of ["A", "B", "C"]) {
      const p = state.plans[k];
      if (p.state === "drill" && p.bit < 0.3) M.changeBit(state, k);
    }
    M.simulate(state, state.t + 2, { reverse: false });
  }
  return state;
}

// ---- constants and helpers ----
check("hardness bands: 1 in soft, 1.5 and 1.35 in the hard bands",
  M.hardness(100) === 1 && M.hardness(200) === 1.5 && M.hardness(460) === 1.35 && M.hardness(700) === 1);
check("a bit trip costs more the deeper the hole",
  M.PLANS.B.trip(600) === 3.0 && M.PLANS.B.trip(200) < M.PLANS.B.trip(600) && M.PLANS.B.trip(600) < M.PLANS.C.trip(600));
check("the calendar lines up: note on day 17, last man up on day 69",
  M.dayOf(M.T.note) === 17 && M.dayOf(M.T.histLastUp) === 69);
check("Plan B broke through on Oct 9 at 08:05",
  M.fmtDate(M.T.histBreakthrough) === "Oct 9" && M.fmtClock(M.T.histBreakthrough) === "08:05");
check("González went down at 23:18 and Ávalos came up at 00:11",
  M.fmtClock(M.T.histGonzalezDown) === "23:18" && M.fmtClock(M.T.histFirstUp) === "00:11");
check("the real lift took 21 h 44 m",
  near((M.T.histLastUp - M.T.histFirstUp) * 60, 1304, 1));

// ---- rider list ----
const riders = M.riders();
check("33 riders: four fit, then weakest, foreman last",
  riders.length === 33 && riders[0].tag === "fit" && riders[3].tag === "fit" &&
  riders[4].tag === "priority" && riders[18].tag === "tough" && riders[32].tag === "foreman");
check("weakest riders get the longest checks and the lowest speed tolerance",
  riders[4].check > riders[0].check && riders[4].tol < riders[0].tol);

// ---- drilling discipline ----
{
  const s = M.create({ seed: 20101013 });
  M.simulate(s, 729, { reverse: false });
  check("before its spud date Plan B has drilled nothing",
    s.plans.B.state === "wait" && s.plans.B.depth === 0 && s.plans.A.depth > 0);
}
{
  const s = M.create({ seed: 20101013 });
  const bitBefore = s.plans.A.bit;
  M.simulate(s, 610, { reverse: false });
  check("drilling wears the bit", s.plans.A.bit < bitBefore && s.plans.A.depth > 0,
    `${s.plans.A.depth.toFixed(0)} m, bit ${(s.plans.A.bit * 100).toFixed(0)}%`);
}
{
  // neglect: run to Oct 12 with nobody changing bits
  const s = M.create({ seed: 42 });
  M.simulate(s, 1840, { reverse: false });
  check("a dull bit left downhole eventually breaks and must be fished",
    s.log.some((l) => l.text.includes("dull bit broke")) || s.plans.B.state === "fishing");
  check("neglected bits push the breakthrough about ten days past history",
    s.winner === "B" && s.t > M.T.histBreakthrough + 240, `t=${s.t.toFixed(0)} vs ${M.T.histBreakthrough}`);
}
{
  // off-target: a hole that arrives 20 m to the side misses the room
  const s = M.create({ seed: 1 });
  s.plans.A.state = s.plans.C.state = "off";
  s.plans.B.state = "drill";
  s.plans.B.depth = M.PLANS.B.breakDepth - 0.01;
  s.plans.B.dev = 20;
  M.step(s, 1, { reverse: false });
  check("a hole 20 m off line passes the workshop and is done",
    s.plans.B.state === "off" && s.phase === "drill");
}

// ---- the race ----
{
  const s = autopilot(M.create({ seed: 20101013 }), 2200);
  check("with fresh bits Plan B breaks through within a day of Oct 9",
    s.winner === "B" && within(s.t, M.T.histBreakthrough - 72, M.T.histBreakthrough + 72),
    `${M.fmtDate(s.t)} ${M.fmtClock(s.t)}`);
  check("the winning hole is straight enough", Math.abs(s.plans.B.dev) <= M.TOL,
    `${s.plans.B.dev.toFixed(1)} m off line`);
  check("the other two plans are halted mid-hole",
    s.plans.A.state === "halted" && s.plans.C.state === "halted" &&
    s.plans.A.depth < 702 && s.plans.C.depth < 597,
    `A ${s.plans.A.depth.toFixed(0)} m, C ${s.plans.C.depth.toFixed(0)} m`);
  check("Plan B needed about ten bits to get there",
    within(s.plans.B.bitsUsed, 6, 12), `${s.plans.B.bitsUsed} bits`);

  // ---- the lift ----
  const bt = s.t;
  while (s.phase === "ream") M.simulate(s, s.t + 1, { reverse: false });
  check("three days of reaming, then the rescue phase begins",
    s.phase === "rescue" && near(s.t - bt, M.REAM_HOURS, 0.1));
  let sawSnag = false;
  while (s.phase !== "done" && s.t < 3000) {
    if (s.rescue.snagged) sawSnag = true;
    M.step(s, 1 / 20, { reverse: s.rescue.snagged });
  }
  const r = s.rescue;
  check("all 33 come up", r.upCount === 33 && s.phase === "done");
  check("the lift finishes inside a day of the real 21 h 44 m",
    within(r.lastUpAt - r.firstUpAt, 12, 22), `${(r.lastUpAt - r.firstUpAt).toFixed(1)} h`);
  check("most of the cycle clock is travel, the rest is checks below",
    within(r.travelHours, 8, 12) && within(r.checkHours, 4, 6),
    `travel ${r.travelHours.toFixed(1)} h, checks ${r.checkHours.toFixed(1)} h`);
  check("the last man tops out on day 69", M.dayOf(r.lastUpAt) === 69,
    `${M.fmtDate(r.lastUpAt)} ${M.fmtClock(r.lastUpAt)}`);
  check("the log carries the real beats: Ávalos first, Urzúa last, González out",
    s.log.some((l) => l.text.includes("Ávalos")) &&
    s.log.some((l) => l.text.includes("Urzúa")) &&
    s.log.some((l) => l.text.includes("González comes up last")));
}

// ---- snags and nerves ----
{
  const s = autopilot(M.create({ seed: 20101013 }), 2200);
  M.simulate(s, s.t + 90, { reverse: false }); // into the rescue
  while (s.rescue.sub !== "ascend") M.step(s, 1 / 20, { reverse: false });
  s.rescue.snagAt = s.rescue.pos - 4;
  const before = s.rescue.pos;
  M.step(s, 0.5, { reverse: false });
  check("a snag stops the capsule dead until reverse is held",
    s.rescue.snagged && s.rescue.pos === before && s.rescue.snagHours > 0);
  while (s.rescue.snagged) M.step(s, 1 / 20, { reverse: true });
  check("backing off clears the snag",
    !s.rescue.snagged && s.rescue.reverseDist >= M.SNAG_BACK - 1e-6);
  while (s.phase !== "done" && s.t < 3000) M.step(s, 1 / 20, { reverse: s.rescue.snagged });
  check("the capsule still delivers everyone after a snag", s.rescue.upCount === 33);
}
{
  // push gear against a weak rider's nerves
  const s = autopilot(M.create({ seed: 42 }), 2200);
  M.simulate(s, s.t + 90, { reverse: false });
  s.rescue.gear = "push";
  let distress = false;
  while (s.phase !== "done" && s.t < 3000) {
    M.step(s, 1 / 20, { reverse: s.rescue.snagged });
    distress = distress || s.rescue.distressed;
  }
  check("pushing the winch past a weak rider's nerve forces an easing",
    distress && s.log.some((l) => l.text.includes("struggling in the dark")));
  check("gear caps: steady below standard below push",
    M.GEARS.steady < M.GEARS.standard && M.GEARS.standard < M.GEARS.push);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
