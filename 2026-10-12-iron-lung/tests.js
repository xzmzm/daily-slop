// node tests.js — checks for the negative-pressure lung model.
const L = require("./lung.js");

let passed = 0, failed = 0;
function check(name, ok, detail = "") {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
}
const near = (a, b, tol) => Math.abs(a - b) <= tol;
function run(c, seconds, opts) {
  const s = L.create(opts);
  for (let i = 0; i < seconds * 120; i++) L.step(s, 1 / 120, c);
  return s;
}
const weak = 0.1;

check("time constant R·C is 0.3 s", near(L.CHILD.R * L.CHILD.C, 0.3, 1e-9));
check("a long square pull fills C × pressure", near(L.tidalSquare(12, 10), 0.18, 1e-6));
check("a 1.2 s pull fills 98% of that", near(L.tidalSquare(12, 1.2) / 0.18, 1 - Math.exp(-4), 1e-9));
check("alveolar ventilation subtracts dead space each breath", near(L.alveolarVent(0.15, 20), 2.0, 1e-9));
check("same air moved, fast and shallow reaches less", L.alveolarVent(0.08, 40) < 0.6 * L.alveolarVent(0.16, 20));
check("PaCO2 = 0.863·VCO2/VA gives 40 mmHg at 2.37 L/min", near(L.paco2Target(2.373), 40, 0.05));
check("Severinghaus: 50% saturation near 27 mmHg", near(L.saturation(26.9), 50, 1));
check("Severinghaus: 97% near 100 mmHg", near(L.saturation(100), 97.5, 0.6));
check("room air alveolar O2 at PaCO2 40 is ~100 mmHg", near(L.alveolarO2(40), 99.7, 0.5));

const still = run({ motor: false, amp: 12, rate: 20, strength: weak, hand: false }, 90);
check("weak child, no pump: no countable breaths", L.breathRate(still) === 0);
check("weak child, no pump: respiratory failure", L.verdict(still) === "failing", still.paco2.toFixed(0));

const healthy = run({ motor: false, amp: 0, rate: 20, strength: 1, hand: false }, 120);
check("healthy child breathes alone at normal CO2", near(healthy.paco2, 40, 4), healthy.paco2.toFixed(1));
check("healthy child: 24 breaths a minute", near(L.breathRate(healthy), 24, 0.5));

const motor = run({ motor: true, amp: 12, rate: 20, strength: weak }, 120);
check("motor at −12 cmH2O, 20/min: tidal volume ≈ 170 mL", near(motor.lastVt, 0.172, 0.01), (motor.lastVt * 1000).toFixed(0));
check("motor: breath rate follows the pump", near(L.breathRate(motor), 20, 0.3));
check("motor: CO2 back near 40 mmHg", near(motor.paco2, 40, 3), motor.paco2.toFixed(1));
check("motor: saturation above 95%", L.saturation(motor.pao2) > 95);

const fast = run({ motor: true, amp: 8, rate: 40, strength: weak }, 120);
check("40/min at −8 moves about as much air as 20/min at −12",
  near(L.minuteVent(fast) / L.minuteVent(motor), 1, 0.08));
check("…but CO2 climbs: dead space eats the shallow breaths", fast.paco2 > 65, fast.paco2.toFixed(0));

const hard = run({ motor: true, amp: 25, rate: 20, strength: weak }, 120);
check("pulling −25 over-breathes the child", L.verdict(hard) === "overbreathed", hard.paco2.toFixed(0));

const s = run({ motor: true, amp: 12, rate: 20, strength: weak }, 90);
const ok0 = s.paco2;
for (let i = 0; i < 60 * 120; i++) L.step(s, 1 / 120, { motor: false, amp: 12, rate: 20, strength: weak, hand: false });
check("power cut: CO2 climbs within a minute", s.paco2 > ok0 + 30, `${ok0.toFixed(0)} → ${s.paco2.toFixed(0)}`);
for (let k = 0; k < 40; k++) {
  for (let i = 0; i < 120; i++) L.step(s, 1 / 120, { motor: false, amp: 12, strength: weak, hand: true });
  for (let i = 0; i < 180; i++) L.step(s, 1 / 120, { motor: false, amp: 12, strength: weak, hand: false });
}
check("hand pumping 1 s on, 1.5 s off rescues the child", L.verdict(s) === "breathing", s.paco2.toFixed(0));
check("hand pumping counts 24 breaths a minute", near(L.breathRate(s), 24, 0.5));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
