'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('./model.js');

const PATH = ['augusta-victoria', 'boat-train', 'express-paris', 'victoria', 'canal-boat',
  'aden-mail', 'colombo-mail', 'penang-mail', 'singapore-mail', 'oceanic-hk',
  'oceanic-pacific', 'overland-limited', 'world-special'];

function firstDeparture(legId, now) {
  const leg = M.LEGS.find((l) => l.id === legId);
  return M.nextDepartures(leg, now, 3)[0];
}

function runChain(path, now = M.START, port = 'hoboken') {
  let misses = 0;
  const stamps = [];
  for (const legId of path) {
    const leg = M.LEGS.find((l) => l.id === legId);
    assert.equal(leg.from, port, `${legId} departs from ${port}`);
    const dep = firstDeparture(legId, now);
    misses += M.missedSailings(port, now, dep);
    const arr = dep + leg.duration;
    stamps.push({ legId, dep, arr });
    now = arr;
    port = leg.to;
  }
  return { stamps, finish: now, port, misses };
}

test('calendar helpers', () => {
  // Nov 14 1889 (day 0) is a Thursday; Nov 22 is a Friday.
  assert.equal(M.hoursToCivil(M.START).weekday, 'Thursday');
  assert.equal(M.hoursToCivil(8 * 24 + 2.5).weekday, 'Friday');
  const c = M.hoursToCivil(8 * 24 + 2.5);
  assert.deepEqual([c.mo, c.date, c.hh, c.mm], [11, 22, 2, 30]);
  // Minute carry across midnight: 194.499h → 2:29:60 rounds to 2:30 next day.
  assert.deepEqual([M.hoursToCivil(8 * 24 + 2.5).hh, M.hoursToCivil(8 * 24 + 2.5).mm], [2, 30]);
  // Round trip
  for (const [mo, d, hh, mm] of [[11, 14, 0, 0], [11, 30, 23, 59], [12, 31, 12, 0], [1, 7, 10, 55], [2, 28, 6, 30]]) {
    assert.deepEqual(
      (({ mo: m, date, hh: h, mm: mi }) => [m, date, h, mi])(M.hoursToCivil(M.civilToHours(mo, d, hh, mm))),
      [mo, d, hh, mm]);
  }
  assert.equal(M.formatLocal(M.START, -5), 'Thursday, November 14, 1889 · 9:40 a.m.');
  assert.equal(M.formatElapsed(M.NELLIE_TOTAL), '72d 6h 11m');
});

test('historical chain lands on the official record', () => {
  const run = runChain(PATH);
  assert.equal(run.port, 'hoboken');
  assert.equal(run.misses, 0);
  assert.ok(Math.abs(run.finish - M.START - M.NELLIE_TOTAL) < 0.5,
    `elapsed ${M.formatElapsed(run.finish - M.START)} vs official ${M.formatElapsed(M.NELLIE_TOTAL)}`);
  // Spot-check the printed itinerary against Chapter XVIII.
  const fmt = (h, tz) => M.formatShort(h, tz);
  assert.equal(fmt(run.stamps[0].arr, 0), 'Fri Nov 22 · 2:30 a.m.');
  assert.equal(fmt(run.stamps[3].arr, 2), 'Wed Nov 27 · 3:30 p.m.');
  assert.equal(fmt(run.stamps[9].dep, 8), 'Sat Dec 28 · 2:30 p.m.');
  assert.equal(fmt(run.stamps[11].arr, -6), 'Thu Jan 23 · 7:05 a.m.');
  assert.equal(M.formatLocal(run.finish, -5), 'Saturday, January 25, 1890 · 3:51 p.m.');
  const v = M.verdict(run.finish - M.START, run.misses, false);
  assert.equal(v.tier, 'record');
});

test('Etruria variant converges to the same mail boat, one steamer missed', () => {
  const run = runChain(['etruria', ...PATH.slice(1)]);
  assert.equal(run.port, 'hoboken');
  assert.ok(Math.abs(run.finish - M.START - M.NELLIE_TOTAL) < 0.5);
  assert.equal(run.misses, 1);
  assert.equal(M.verdict(run.finish - M.START, run.misses, false).tier, 'verne');
});

test('departures: daily trains, fixed sailings, charter', () => {
  // Boat trains run daily at 3:10; after 4:00 a.m. the next is tomorrow.
  const boat = M.LEGS.find((l) => l.id === 'boat-train');
  const dep = M.nextDepartures(boat, 8 * 24 + 4, 2);
  assert.equal(M.formatShort(dep[0], 0), 'Sat Nov 23 · 3:10 a.m.');
  assert.ok(dep[1] - dep[0] === 24);
  // The Victoria sails Mondays at 3:00 a.m. local (+1): next after Nov 25 04:00 UTC.
  const victoria = M.LEGS.find((l) => l.id === 'victoria');
  const vdeps = M.nextDepartures(victoria, 11 * 24 + 4, 3);
  assert.equal(M.formatShort(vdeps[0], 1), 'Mon Dec 2 · 3:00 a.m.');
  assert.ok(vdeps[1] - vdeps[0] === 7 * 24);
  // The World special books on demand, five hours out.
  const special = M.LEGS.find((l) => l.id === 'world-special');
  const sdeps = M.nextDepartures(special, 1000, 1);
  assert.ok(Math.abs(sdeps[0] - 1005) < 1e-9);
});

test('missed sailings are counted per steamer, not per train', () => {
  // Arrive Hong Kong Dec 27, leave Jan 4: the Dec 28 Oceanic sails without you.
  const arrived = 1050;
  const missed = M.missedSailings('hongkong', arrived, arrived + 3 * 24);
  assert.equal(missed, 1);
  // In London (rail legs only) nothing counts.
  assert.equal(M.missedSailings('london', 0, 100), 0);
});

test('date line: calendar steps back while the clock runs on', () => {
  const leg = M.LEGS.find((l) => l.id === 'oceanic-pacific');
  const dep = M.civilToHours(1, 7, 10, 55) - 9; // Yokohama local (+9)
  const arr = dep + leg.duration;
  assert.equal(M.formatShort(dep, 9), 'Tue Jan 7 · 10:55 a.m.');
  assert.equal(M.formatShort(arr, -8), 'Tue Jan 21 · 8:00 a.m.');
  // 14.58 real days elapsed, yet the two local calendars are 14 days apart.
  assert.ok(Math.abs(leg.duration - (14 * 24 + 14 + 5 / 60)) < 0.01);
});

test('stranded when the last Oceanic has gone', () => {
  // Arrive Hong Kong on Jan 12 (+8): all three Oceanic sailings are past.
  const now = M.civilToHours(1, 12, 12, 0) - 8;
  const opts = M.optionsAt('hongkong', now);
  assert.equal(opts.length, 0);
});

test('bisland tracks westbound and lands in New York', () => {
  let prev = M.bislandPosition(M.START).lon;
  for (let h = M.START; h <= 1861; h += 24) {
    const p = M.bislandPosition(h);
    assert.ok(p.lon >= -180 && p.lon <= 180 && p.lat >= -60 && p.lat <= 85);
    prev = p.lon;
  }
  const end = M.bislandPosition(1861);
  assert.ok(Math.abs(end.lon - M.PORTS.hoboken.lon) < 0.1);
  assert.ok(Math.abs(end.lat - M.PORTS.hoboken.lat) < 0.1);
  // Pacific leg must unwrap across the antimeridian, not cross the Atlantic.
  const mid = M.bislandPosition(380); // halfway SF → Yokohama
  assert.ok(mid.lon > 120 || mid.lon < -150, `mid-Pacific lon ${mid.lon}`);
  assert.ok(mid.lat > 30 && mid.lat < 55);
});

test('verdict tiers', () => {
  assert.equal(M.verdict(M.NELLIE_TOTAL, 0, false).tier, 'record');
  assert.equal(M.verdict(M.NELLIE_TOTAL + 1, 1, false).tier, 'verne');
  assert.equal(M.verdict(M.VERNE_TOTAL + 1, 2, false).tier, 'over');
  assert.equal(M.verdict(1000, 0, true).tier, 'stranded');
});
