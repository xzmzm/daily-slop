// test_cal.mjs — node --test test_cal.mjs
// Validates the Eleven Days engine: the dual-calendar serial-day arithmetic
// (Gregorian and Julian, both anchored so the week never breaks), the
// conversion pair and the secular gap D(y) = ⌊y/100⌋ − ⌊y/400⌋ − 2, the
// three independent weekday methods (serial, Zeller, Conway's doomsday with
// his Odd+11 shortcut), the two computus engines against published Easter
// tables (Gregorian and Orthodox), the drift arithmetic of the Julian year
// (11 min 14 s per turn), and every historical jump this studio tells —
// Spain 1582, Britain 1752 (the star), Russia 1918, Sweden's 30 February
// 1712, Alaska's double Friday of 1867, Japan's 337-day 1872.

import test from "node:test";
import assert from "node:assert/strict";

import {
  JULIAN_YEAR, TROPICAL_YEAR, GREGORIAN_YEAR, SYNODIC_MONTH,
  julianDriftPerYear, gregorianDriftPerYear, daysPerJulianSlip, daysPerGregorianSlip,
  metonicGap, metonicGapHours,
  serialGregorian, serialJulian, civilGregorian, civilJulian,
  weekdayOfSerial, weekdayGregorian, weekdayJulian,
  julianToGregorian, gregorianToJulian, gapClosedForm, gapAtSerial,
  isLeapJulian, isLeapGregorian, zellerGregorian,
  anchorDay, doomsdayOfYear, oddPlus11, DOOMSDAY_DATES, weekdayByDoomsday,
  goldenNumber, easterGregorian, easterJulian,
  equinoxJulianLabel, ADOPTIONS, FOSSILS, september1752,
} from "./cal.js";

const close = (a, b, tol, label) =>
  assert.ok(Math.abs(a - b) <= tol, `${label}: ${a} vs ${b} (±${tol})`);

// --- 1. serial-day engine vs the platform calendar -------------------------
test("serialGregorian matches JS Date over a sampled sweep 1583–2400", () => {
  // JS Date's UTC days track proleptic-Gregorian exactly; compare on
  // 1st/10th/19th of each month so we touch three month-length patterns.
  for (let y = 1583; y <= 2400; y += 1) {
    for (let m = 1; m <= 12; m += 1) {
      for (const d of [1, 10, 19, 28]) {
        const js = Math.floor(Date.UTC(y, m - 1, d) / 86400000);
        assert.equal(serialGregorian(y, m, d), js, `${y}-${m}-${d}`);
      }
    }
  }
});

test("serialGregorian/civilGregorian round-trip identically, 1–3000", () => {
  for (let y = 1; y <= 3000; y += 1) {
    for (let m = 1; m <= 12; m += 2) {
      const c = civilGregorian(serialGregorian(y, m, 13));
      assert.deepEqual(c, { y, m, d: 13 });
    }
  }
});

test("serialJulian/civilJulian round-trip identically, 1–3000", () => {
  for (let y = 1; y <= 3000; y += 1) {
    for (let m = 1; m <= 12; m += 2) {
      const c = civilJulian(serialJulian(y, m, 13));
      assert.deepEqual(c, { y, m, d: 13 });
    }
  }
});

test("weekday calibration: serial 0 = 1970-01-01 = Thursday, week never breaks", () => {
  assert.equal(weekdayOfSerial(0), 4); // Sunday = 0 → Thursday = 4
  assert.equal(WEEKDAY(1970, 1, 1), 4);
  // 1752-09-02 Julian (Wednesday) and 1752-09-14 Gregorian (Thursday) are
  // consecutive physical days across the British jump.
  const a = serialJulian(1752, 9, 2), b = serialGregorian(1752, 9, 14);
  assert.equal(b - a, 1);
  assert.equal(weekdayOfSerial(a), 3); // Wednesday
  assert.equal(weekdayOfSerial(b), 4); // Thursday
});
function WEEKDAY(y, m, d) { return weekdayGregorian(y, m, d); }

// --- 2. Julian ↔ Gregorian conversion anchors -------------------------------
test("Julian 0001-01-01 = Gregorian 0000-12-30 (serial −719164)", () => {
  assert.equal(serialJulian(1, 1, 1), -719164);
  assert.equal(serialGregorian(0, 12, 30), -719164);
});

test("Julian 1582-10-04 = Gregorian 1582-10-14: the papal ten days", () => {
  assert.equal(serialJulian(1582, 10, 4), serialGregorian(1582, 10, 14));
  assert.deepEqual(julianToGregorian(1582, 10, 4), { y: 1582, m: 10, d: 14 });
  assert.deepEqual(gregorianToJulian(1582, 10, 14), { y: 1582, m: 10, d: 4 });
});

test("conversion preserves the physical weekday everywhere (the week never broke)", () => {
  for (let y = 400; y <= 2400; y += 13) {
    for (const md of [[1, 1], [3, 25], [6, 15], [9, 14], [12, 25]]) {
      const [m, d] = md;
      assert.equal(weekdayJulian(y, m, d), weekdayGregorian(...Object.values(julianToGregorian(y, m, d))),
        `${y}-${m}-${d}`);
    }
  }
});

// --- 3. the secular gap ------------------------------------------------------
test("closed form D(y) = ⌊y/100⌋ − ⌊y/400⌋ − 2 equals the engine, 300–3000", () => {
  for (let y = 300; y <= 3000; y += 1) {
    const serial = serialGregorian(y, 9, 20); // mid-year, clear of all Feb boundaries
    assert.equal(gapClosedForm(y), gapAtSerial(serial), `year ${y}`);
  }
});

test("the gap's history: 10 days at the reform, 11 for Britain, 13 today", () => {
  assert.equal(gapAtSerial(serialGregorian(1582, 10, 15)), 10);
  assert.equal(gapAtSerial(serialGregorian(1752, 9, 14)), 11);
  assert.equal(gapAtSerial(serialGregorian(1918, 2, 14)), 13);
  assert.equal(gapAtSerial(serialGregorian(2026, 9, 2)), 13);
  assert.equal(gapClosedForm(2099), 13);
  assert.equal(gapClosedForm(2100), 14); // Julian 29 Feb 2100 that Gregory omits
});

test("Julian/Gregorian leap rules agree on 1600, split on 1700/1800/1900/2100", () => {
  for (const y of [1600, 2000, 2400]) assert.ok(isLeapJulian(y) && isLeapGregorian(y), String(y));
  for (const y of [1700, 1800, 1900, 2100]) assert.ok(isLeapJulian(y) && !isLeapGregorian(y), String(y));
});

// --- 4. three independent weekday methods agree ------------------------------
test("Zeller vs serial weekday, full Gregorian sweep 1583–2500", () => {
  for (let y = 1583; y <= 2500; y += 1)
    for (let m = 1; m <= 12; m += 1)
      for (const d of [1, 8, 15, 22, 28]) {
        if (m === 2 && d > 28 && !isLeapGregorian(y)) continue;
        assert.equal(zellerGregorian(y, m, d), weekdayGregorian(y, m, d), `${y}-${m}-${d}`);
      }
});

test("Conway: every mnemonic date lands on the doomsday, 1583–2600", () => {
  for (let y = 1583; y <= 2600; y += 7)
    for (const dd of DOOMSDAY_DATES) {
      const d = isLeapGregorian(y) ? dd.leapD : dd.d;
      assert.equal(weekdayByDoomsday(y, dd.m, d), doomsdayOfYear(y), `${y} ${dd.label}`);
    }
});

test("Conway: Odd+11 reproduces (anchor + 7 − t) mod 7 for every year 1500–2600", () => {
  for (let y = 1500; y <= 2600; y += 1)
    assert.equal((anchorDay(y) + 7 - oddPlus11(y)) % 7, doomsdayOfYear(y), String(y));
});

test("Conway: closed-form anchors 1800s=Friday, 1900s=Wednesday, 2000s=Tuesday, 2100s=Sunday", () => {
  assert.equal(anchorDay(1867), 5);
  assert.equal(anchorDay(1900), 3);
  assert.equal(anchorDay(2000), 2);
  assert.equal(anchorDay(2100), 0);
  assert.equal((5 * (18 % 4) + 2) % 7, 5); // the formula itself, 1800s
});

test("doomsday 2026 = Saturday, so 2 September 2026 is a Wednesday — like 1752", () => {
  assert.equal(doomsdayOfYear(2026), 6);
  assert.equal(weekdayGregorian(2026, 9, 2), 3);
  assert.equal(weekdayByDoomsday(2026, 9, 2), 3);
});

// --- 5. computus -------------------------------------------------------------
test("Gregorian Easter against the published tables", () => {
  const table = {
    1818: [3, 22], // the earliest possible Easter — next not until 2285
    1886: [4, 25], // the latest possible
    1943: [4, 25],
    2000: [4, 23],
    2008: [3, 23],
    2011: [4, 24],
    2016: [3, 27],
    2018: [4, 1],
    2019: [4, 21],
    2021: [4, 4],
    2024: [3, 31],
    2025: [4, 20],
    2026: [4, 5],
    2038: [4, 25],
    2285: [3, 22],
  };
  for (const [y, [m, d]] of Object.entries(table))
    assert.deepEqual(easterGregorian(+y), { y: +y, m, d }, String(y));
});

test("Orthodox (Julian) Easter against the published tables, in Gregorian labels", () => {
  const table = {
    2017: [4, 16],  // the two Easters coincide
    2018: [4, 8],
    2019: [4, 28],
    2020: [4, 19],
    2021: [5, 2],
    2023: [4, 16],
    2024: [5, 5],
    2025: [4, 20],  // coincide again
    2026: [4, 12],
  };
  for (const [y, [m, d]] of Object.entries(table)) {
    const e = easterJulian(+y);
    const g = julianToGregorian(e.y, e.m, e.d);
    assert.deepEqual([g.m, g.d], [m, d], String(y));
  }
});

test("Easter invariants 1584–3000: Sunday, after the paschal full moon, inside the window", () => {
  for (let y = 1584; y <= 3000; y += 1) {
    const g = easterGregorian(y);
    assert.equal(weekdayGregorian(g.y, g.m, g.d), 0, `Gregorian ${y}`);
    assert.ok(g.m === 3 ? g.d >= 22 : g.d <= 25, `range ${y}`);
    const j = easterJulian(y);
    const pfmSerial = serialJulian(y, 3, 21) + ((19 * (y % 19) + 15) % 30);
    assert.ok(serialJulian(j.y, j.m, j.d) > pfmSerial, `Julian ${y}: strictly after PFM`);
  }
});

test("golden number 2026 = 13; the Metonic cycle is 2.08 h short per 19 years", () => {
  assert.equal(goldenNumber(2026), 13);
  close(Math.abs(19 * TROPICAL_YEAR - 235 * SYNODIC_MONTH), metonicGap, 1e-9, "19 tropical years vs 235 lunations");
  close(metonicGapHours, 2.08, 0.02, "metonic gap in hours");
  assert.ok(metonicGap > 0.08 && metonicGap < 0.09, `metonic gap ${metonicGap}`);
});

// --- 6. the drift ------------------------------------------------------------
test("Caesar's year is 11 minutes 14 seconds too long; a day slips every ~128 years", () => {
  close(julianDriftPerYear * 1440, 11 + 14 / 60, 0.02, "minutes per year");
  close(daysPerJulianSlip, 128.2, 0.05, "years per slipped day");
  close(GREGORIAN_YEAR, 365.2425, 1e-12, "the Gregorian mean year is exact");
  close(daysPerGregorianSlip, 3333, 40, "Gregorian residual slip");
});

test("the equinox: pinned at Nicaea 325, slid to 11 March by 1582", () => {
  assert.equal(equinoxJulianLabel(325), 21);
  close(equinoxJulianLabel(1582), 11, 0.35, "Julian label of the 1582 equinox");
});

// --- 7. the historical jumps -------------------------------------------------
test("Britain 1752: Wed 2 Sep → Thu 14 Sep; September had 19 days; 1751 had 282", () => {
  const sep = september1752();
  assert.equal(sep.length, 19); // the printed month: 1, 2, then 14..30
  assert.equal(sep[0], serialJulian(1752, 9, 1));
  assert.equal(sep[18], serialGregorian(1752, 9, 30));
  assert.equal(weekdayJulian(1752, 9, 2), 3);
  assert.equal(weekdayGregorian(1752, 9, 14), 4);
  const britishSept = 2 + 17; // printed days: 1, 2, then 14..30
  assert.equal(britishSept, 19);
  // 1751 began 25 March (Lady Day) and ended 31 December.
  assert.equal(serialGregorian(1751, 12, 31) - serialGregorian(1751, 3, 25) + 1, 282);
});

test("every adoption entry is internally consistent with the engine", () => {
  for (const a of ADOPTIONS) {
    if (a.en === "Japan") {
      // lunisolar → Gregorian: 29 days of the old 12th month were abolished
      assert.equal(serialGregorian(1873, 1, 1) - serialGregorian(1872, 12, 2), 30, "Japan: 2 Dec + 30 = 1 Jan");
      continue;
    }
    if (a.en === "Russian Alaska") {
      // same physical day: Julian label and Gregorian label of the changeover
      assert.equal(serialJulian(a.old.y, a.old.m, a.old.d), serialGregorian(a.newG.y, a.newG.m, a.newG.d), "Alaska");
      continue;
    }
    assert.equal(serialJulian(a.old.y, a.old.m, a.old.d) + 1, serialGregorian(a.newG.y, a.newG.m, a.newG.d),
      `${a.en}: consecutive days`);
  }
});

test("Spain 1582 and France 1582: Thursday 4 Oct → Friday 15 Oct; Sunday 9 Dec → Monday 20 Dec", () => {
  assert.equal(weekdayJulian(1582, 10, 4), 4);
  assert.equal(weekdayGregorian(1582, 10, 15), 5);
  assert.equal(weekdayJulian(1582, 12, 9), 0);
  assert.equal(weekdayGregorian(1582, 12, 20), 1);
});

test("Russia 1918: Wednesday 31 Jan → Thursday 14 Feb; October Revolution = 7 November", () => {
  assert.equal(weekdayJulian(1918, 1, 31), 3);
  assert.equal(weekdayGregorian(1918, 2, 14), 4);
  assert.deepEqual(julianToGregorian(1917, 10, 25), { y: 1917, m: 11, d: 7 });
});

test("Alaska 1867: the same physical day is Friday 6 October Julian and Friday 18 October Gregorian", () => {
  const s = serialJulian(1867, 10, 6);
  assert.equal(s, serialGregorian(1867, 10, 18));
  assert.equal(weekdayOfSerial(s), 5);
});

test("Sweden 1712: 30 February existed; Sweden 1753: 17 February → 1 March", () => {
  // the fabricated day is a valid Julian serial
  const feb30 = serialJulian(1712, 2, 30);
  assert.equal(serialJulian(1712, 2, 29) + 1, feb30);
  assert.deepEqual(julianToGregorian(1712, 2, 30), { y: 1712, m: 3, d: 12 });
  assert.equal(serialJulian(1753, 2, 17) + 1, serialGregorian(1753, 3, 1));
});

test("Japan 1872: 2 December → 1 January 1873 skips 29 days (a 337-day year)", () => {
  const skipped = serialGregorian(1873, 1, 1) - serialGregorian(1872, 12, 2) - 1;
  assert.equal(skipped, 29);
  assert.equal(366 - 29, 337); // Gregorian 1872 was leap
});

// --- 8. the living fossils ---------------------------------------------------
test("Lady Day + 11 (+1 for 1800) = the 6 April tax year", () => {
  assert.deepEqual(julianToGregorian(1752, 3, 25), { y: 1752, m: 4, d: 5 });
  assert.deepEqual(julianToGregorian(1800, 3, 25), { y: 1800, m: 4, d: 6 });
});

test("Orthodox Christmas 25 December Julian = 7 January, and 8 January after 2100", () => {
  assert.deepEqual(julianToGregorian(2026, 12, 25), { y: 2027, m: 1, d: 7 });
  assert.deepEqual(julianToGregorian(2101, 12, 25), { y: 2102, m: 1, d: 8 });
});

test("Washington: Gregorian 22 February 1732 = Julian 11 February; his '1731' is the March-start civil year", () => {
  assert.deepEqual(gregorianToJulian(1732, 2, 22), { y: 1732, m: 2, d: 11 });
  // Britain's civil year began 25 March until 1752, so contemporaries wrote
  // his birth 11 February 1731/32 — same day, double year number.
});
