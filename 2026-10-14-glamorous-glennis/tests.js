// node tests.js — checks for the X-1 flight model.
const X = require("./x1.js");

let passed = 0, failed = 0;
function check(name, ok, detail = "") {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
}
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const deg = (r) => (r * 180) / Math.PI;

function fly(opts = {}) {
  const s = X.create({ seed: opts.seed });
  let mem = {}, gmin = 0, trimMax = 0;
  while (s.phase === "flying" && s.t < 900) {
    mem = X.autopilot(s, mem);
    if (opts.noTrim) s.trimRate = 0;
    X.step(s, 1 / 60);
    gmin = Math.min(gmin, s.gamma);
    trimMax = Math.max(trimMax, s.trim);
  }
  return { s, gmin, trimMax };
}

// ---- the atmosphere ----
check("speed of sound at sea level is 340 m/s (761 mph)",
  near(X.isa(0).a, 340.3, 0.3) && near(X.isa(0).a / X.MPH, 761, 1));
check("at 43,000 ft the air is −56.5 °C and sound is 295 m/s (660 mph)",
  near(X.isa(43000 * X.FT).T - 273.15, -56.5, 0.05) && near(X.isa(43000 * X.FT).a / X.MPH, 660, 1));
check("the stratosphere is isothermal: same Mach-1 speed at 40k and 45k ft",
  near(X.isa(40000 * X.FT).a, X.isa(45000 * X.FT).a, 1e-9));
check("Mach 1.06 at 43,000 ft is about 700 mph",
  near((1.06 * X.isa(43000 * X.FT).a) / X.MPH, 700, 5));
check("air at 43,000 ft is about a fifth as dense as at sea level",
  near(X.isa(43000 * X.FT).rho / X.isa(0).rho, 0.2, 0.03));

// ---- the transonic wall ----
check("drag coefficient quadruples between Mach 0.8 and 1.02",
  near(X.cd0(1.02) / X.cd0(0.8), 4, 0.01) && X.cd0(0.5) === X.cd0(0.79));
check("the drag peak eases past Mach 1",
  X.cd0(1.3) < X.cd0(1.02) && X.cd0(1.3) > X.cd0(0.8));
check("elevator authority collapses to 12% between Mach 0.88 and 0.94",
  X.elevatorAuthority(0.85) === 1 && near(X.elevatorAuthority(0.94), 0.12, 1e-9) && X.elevatorAuthority(0.99) === 0.12);
check("tuck builds from 0.87, peaks at 0.96 and plateaus supersonic",
  X.tuck(0.86) === 0 && near(X.tuck(0.96), 1, 1e-9) && near(X.tuck(1.2), 0.6, 1e-9));
check("buffet lives in the transonic band only",
  X.buffet(0.8) === 0 && X.buffet(0.93) === 1 && X.buffet(1.05) === 0);
check("the Machmeter stalls near .965 then jumps once the shock passes",
  X.indicatedMach(0.95, 0) === 0.95 && near(X.indicatedMach(0.995, 3), 0.965, 0.006) &&
  X.indicatedMach(1.01, 3) === 1.01);
check("Mach angle: 90° at Mach 1, 70.7° at 1.06, 30° at 2",
  near(deg(X.mu(1.0000001)), 90, 0.1) && near(deg(X.mu(1.06)), 70.7, 0.1) && near(deg(X.mu(2)), 30, 1e-9) && X.mu(0.9) === null);

// ---- the rocket ----
{
  const s = X.create();
  for (let i = 0; i < 4; i++) X.setChamber(s, i, true);
  s.gamma = 0.25;
  X.simulate(s, 400);
  const burn = s.events.find((e) => e.text.startsWith("propellant exhausted"));
  check("all four chambers drain the tanks in under three minutes",
    burn && near(burn.t, X.X1.fuel / (4 * X.X1.chamberFlow), 0.2), burn && `${burn.t.toFixed(1)} s`);
  X.setChamber(s, 0, true);
  check("a dry engine will not relight", X.chambersLit(s) === 0);
}
{
  const s = X.create();
  X.setChamber(s, 0, true);
  s.h = 0;
  const lo = X.forces(s).thrust;
  s.h = 43000 * X.FT;
  const hi = X.forces(s).thrust;
  check("one chamber makes 1,500 lbf at sea level and more in thin air",
    near(lo / 4.448, 1500, 1) && near(hi / 4.448, 1680, 15), `${(hi / 4.448).toFixed(0)} lbf at 43k ft`);
}
{
  const s = X.create();
  const W = (X.X1.dry + X.X1.fuel) * X.G;
  check("launch weight about 12,250 lb", near(W / 4.448, 12500, 300), `${(W / 4.448).toFixed(0)} lb`);
  check("drop state: 20,000 ft at 250 mph, about Mach 0.35",
    near(s.h / X.FT, 20000, 1) && near(s.v / X.MPH, 250, 0.01) && near(s.mach, 0.354, 0.005));
}

// ---- whole flights ----
{
  const { s, trimMax } = fly();
  check("Yeager's profile goes supersonic in level flight",
    s.outcome === "supersonic" && s.firstSupersonic && s.firstSupersonic.level);
  check("…peaking near Mach 1.06–1.07 above 40,000 ft",
    s.maxMach > 1.04 && s.maxMach < 1.1 && s.maxMachAlt / X.FT > 40000 && s.maxMachAlt / X.FT < 45000,
    `M ${s.maxMach.toFixed(3)} at ${(s.maxMachAlt / X.FT).toFixed(0)} ft`);
  check("…and holds it level for at least 15 s", s.levelSuper >= 15, `${s.levelSuper.toFixed(1)} s`);
  check("the profile needed nose-up trim near Mach 1", trimMax > 0.2, `max trim ${trimMax.toFixed(2)}`);
}
{
  const { s, gmin } = fly({ noTrim: true });
  check("stick alone cannot hold the nose: the X-1 tucks into a dive",
    s.outcome === "tuck" && deg(gmin) <= -40 && s.levelSuper === 0, `${s.outcome}, γ ${deg(gmin).toFixed(0)}°`);
}
{
  const a = fly({ seed: 7 }).s, b = fly({ seed: 7 }).s;
  check("same seed, same buffet, same flight", a.t === b.t && a.maxMach === b.maxMach);
}
{
  const s = X.create();
  X.simulate(s, 120);
  check("never lit: the X-1 sinks below the B-29 and waits for a chamber",
    s.phase === "flying" && s.h < X.DROP.h - 300 && s.maxMach < 0.6, `${(s.h / X.FT).toFixed(0)} ft`);
  X.setChamber(s, 0, true);
  X.simulate(s, 130);
  X.setChamber(s, 0, false);
  X.simulate(s, 400);
  check("a short burn then shutdown ends the flight subsonic",
    s.outcome === "subsonic" && s.maxMach < 0.9);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
