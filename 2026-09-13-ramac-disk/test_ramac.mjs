import assert from 'node:assert/strict';
import {
  SPECS, REV_MS, REVS_PER_SEC, TOTAL_CHARS, CAPACITY_MB, BITS_PER_TRACK, CARDS_EQUIV,
  R_OUT, bandRadii, arealFromGeometry, BAND, TRACK_PITCH_IN, BIT_CELL_IN, BIT_AREA_SQIN,
  SETTLE_MS, seekMs, accessMs, meanAbsDiff, meanAccessMs, maxAccessMs, recordTransferMs,
  bcdCode, encodeChar, encodeMessage,
  TAPE_727, tapeMeanFetchMs, RAMAC_FETCH_MS, TAPE_FETCH_MS, TAPE_TO_RAMAC, NVME_FETCH_MS,
  recordsPerDay, DENSITY_ANCHORS, CAPACITY_ANCHORS, COST_ANCHORS,
  densityAt, capacityAt, costPerMbAt, hundredDollarsBuysMb, doublingTime,
  MICROSD_MB, translateYear, MILESTONES,
} from './ramac.js';

console.log('--- Running RAMAC Disk File Test Suite ---');

// 1. The capacity lattice: 100 surfaces × 100 tracks × 500 chars = 5,000,000.
console.log('Testing capacity lattice...');
{
  assert.equal(SPECS.surfaces * SPECS.tracksPerSurface * SPECS.charsPerTrack, 5_000_000);
  assert.equal(TOTAL_CHARS, 5_000_000);
  assert.equal(SPECS.platters * 2, SPECS.surfaces, '100 recording surfaces = both sides of 50 platters');
  assert.equal(SPECS.recordsPerTrack * SPECS.charsPerRecord, SPECS.charsPerTrack);
  assert.equal(BITS_PER_TRACK, 4000, '500 chars × 8 recorded bits');
  assert.ok(Math.abs(CAPACITY_MB - 3.75) < 1e-12, '5M six-bit chars = 3.75 MB');
  assert.equal(CARDS_EQUIV, 62_500, 'CHM: the 350 held the equivalent of 62,500 punched cards');
}

// 2. Rotation: 1,200 rpm = one 50 ms revolution, 20 revolutions per second,
//    and a 100-character record takes 11.36 ms to stream past the head.
console.log('Testing rotation arithmetic...');
{
  assert.ok(Math.abs(REV_MS - 50) < 1e-12);
  assert.equal(REVS_PER_SEC, 20);
  const transfer = recordTransferMs();
  assert.ok(Math.abs(transfer - 100 / 8800 * 1000) < 1e-12, '100-char record transfer = 11.36 ms');
}

// 3. Band geometry: the quadratic reproduces the documented areal density exactly.
console.log('Testing recorded-band quadratic...');
{
  assert.ok(Math.abs(arealFromGeometry(BAND.rIn, BAND.width) - SPECS.arealDensityBitsPerSqIn) / SPECS.arealDensityBitsPerSqIn < 1e-12,
    'geometry round-trips to 2,000 bit/in²');
  // monotonicity: a larger documented density pulls the inner radius inward
  // (same 100 tracks, same 4,000 cells — each cell may now be smaller)
  const denser = bandRadii(R_OUT, BITS_PER_TRACK, 100, 4000);
  assert.ok(denser.rIn < BAND.rIn, 'denser recording pulls the inner radius inward');
  assert.ok(denser.width > BAND.width, 'and widens the recorded band');
  // both roots satisfy r_in·W = k — Vieta — and the code keeps the wider band
  const k = (BITS_PER_TRACK * 100) / (2 * Math.PI * 2000);
  const otherRoot = R_OUT - BAND.rIn;
  assert.ok(Math.abs(BAND.rIn * otherRoot - k) < 1e-12, 'Vieta: r_in·W = k');
  assert.ok(BAND.rIn > 0 && BAND.width > 0);
  assert.ok(BIT_CELL_IN > 0.007 && BIT_CELL_IN < 0.008, `innermost bit cell ≈ 7.3 mil, got ${BIT_CELL_IN.toFixed(4)}`);
  assert.ok(TRACK_PITCH_IN > 0.068 && TRACK_PITCH_IN < 0.069, `track pitch ≈ 68.6 mil, got ${TRACK_PITCH_IN.toFixed(4)}`);
  assert.ok(Math.abs(BIT_AREA_SQIN - 1 / 2000) < 1e-15);
}

// 4. Head mechanics: calibrated so the mean over all random accesses is 600 ms
//    and the worst case is 0.8 s, IBM's two documented figures.
console.log('Testing access-time calibration...');
{
  assert.ok(Math.abs(meanAccessMs() - SPECS.avgAccessMs) < 2,
    `mean access ${meanAccessMs().toFixed(1)} ms ≈ 600 ms documented`);
  assert.ok(Math.abs(maxAccessMs() - SPECS.maxAccessMs) < 5,
    `max access ${maxAccessMs().toFixed(1)} ms ≈ 800 ms documented`);
  assert.ok(maxAccessMs() > meanAccessMs());
  // vertical travel dominates horizontal travel
  assert.ok(seekMs(99, 0) > seekMs(0, 99));
  assert.equal(seekMs(0, 0), SETTLE_MS, 'same address still pays the settle');
}

// 5. meanAbsDiff is exact: for n=100 the mean of |X−Y| is 9999/300 = 33.33.
console.log('Testing exact mean-absolute-difference formula...');
{
  assert.ok(Math.abs(meanAbsDiff(100) - 9999 / 300) < 1e-12);
  let sum = 0, n = 24;
  for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) sum += Math.abs(x - y);
  assert.ok(Math.abs(meanAbsDiff(n) - sum / (n * n)) < 1e-12, 'closed form matches brute force');
  // latency is uniform on [0, 50] → its mean is exactly half a revolution
  assert.ok(Math.abs(REV_MS / 2 - 25) < 1e-12);
}

// 6. BCD encoding: letters, digits, odd parity, eight cells per character.
console.log('Testing BCD character code...');
{
  assert.equal(bcdCode('A'), 0o61);   // 12-zone + 1
  assert.equal(bcdCode('I'), 0o71);
  assert.equal(bcdCode('J'), 0o41);   // 11-zone + 1
  assert.equal(bcdCode('S'), 0o22);   // 0-zone + 2
  assert.equal(bcdCode('Z'), 0o31);
  assert.equal(bcdCode('1'), 1);
  assert.equal(bcdCode('0'), 0o10);
  assert.equal(bcdCode(' '), 0o20);
  assert.equal(bcdCode('!'), null, 'characters off the keypunch are rejected');
  for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ') {
    const e = encodeChar(ch);
    assert.equal(e.cells.length, SPECS.recordedBitsPerChar, '6 data + parity + space = 8 cells');
    const weight = e.cells.reduce((a, b) => a + b, 0) - e.cells[7];
    assert.equal((weight) % 2, 1, `${ch}: odd parity with the check bit`);
    assert.equal(e.cells[7], 0, 'the space bit rides along as cell 8');
  }
  assert.equal(encodeMessage('RAMAC 305').length, 9);
  assert.equal(encodeMessage('ramac').map(e => e.ch).join(''), 'RAMAC', 'encoding uppercases');
}

// 7. A full record of 100 characters fits the track arithmetic.
console.log('Testing record arithmetic...');
{
  const msg = 'A'.repeat(100);
  const enc = encodeMessage(msg);
  assert.equal(enc.length, SPECS.charsPerRecord);
  const cells = enc.reduce((a, e) => a + e.cells.length, 0);
  assert.equal(cells, SPECS.charsPerRecord * SPECS.recordedBitsPerChar, '100 chars = 800 bit cells');
  assert.ok(cells < BITS_PER_TRACK, 'five records plus gaps fill the 4,000-cell track');
  const duty = (SPECS.charRatePerSec / (REVS_PER_SEC * SPECS.charsPerTrack));
  assert.ok(duty > 0.87 && duty < 0.89, `8,800 of 10,000 possible char/s ⇒ ${(100 - duty * 100).toFixed(1)}% of the track is gaps`);
}

// 8. Tape comparison: half a reel of IBM 727 tape vs one RAMAC access.
console.log('Testing tape-vs-disk arithmetic...');
{
  assert.equal(TAPE_727.charsPerReel, 2400 * 12 * TAPE_727.cpi, '2,400 ft × 200 cpi = 5.76M chars');
  assert.ok(Math.abs(TAPE_FETCH_MS - 192_000) < 1e-6, 'mean tape fetch = 192 s');
  assert.ok(RAMAC_FETCH_MS > 600 && RAMAC_FETCH_MS < 640, `RAMAC fetch ${RAMAC_FETCH_MS.toFixed(1)} ms`);
  assert.ok(TAPE_TO_RAMAC > 300 && TAPE_TO_RAMAC < 330, `tape is ~315× slower to a random record, got ${TAPE_TO_RAMAC.toFixed(0)}`);
  assert.ok(TAPE_727.charsPerSec > SPECS.charRatePerSec, 'tape streams faster than the disk — the win is the seek, not the speed');
}

// 9. Records per working day at each technology's fetch time.
console.log('Testing throughput arithmetic...');
{
  assert.ok(Math.abs(recordsPerDay(RAMAC_FETCH_MS) - 8 * 3600 * 1000 / RAMAC_FETCH_MS) < 1e-6);
  assert.ok(recordsPerDay(RAMAC_FETCH_MS) > 45_000 && recordsPerDay(RAMAC_FETCH_MS) < 50_000,
    `RAMAC updates ≈ 47k records in 8 h, got ${Math.round(recordsPerDay(RAMAC_FETCH_MS))}`);
  assert.ok(recordsPerDay(TAPE_FETCH_MS) < 160);
  assert.ok(recordsPerDay(NVME_FETCH_MS) > 1e8);
  assert.ok(recordsPerDay(RAMAC_FETCH_MS) / recordsPerDay(TAPE_FETCH_MS) > 300);
}

// 10. The seventy-year curves hit their anchors exactly.
console.log('Testing curve anchors and interpolation...');
{
  for (const a of DENSITY_ANCHORS) assert.ok(Math.abs(densityAt(a.year) / a.value - 1) < 1e-12);
  for (const a of CAPACITY_ANCHORS) assert.ok(Math.abs(capacityAt(a.year) / a.value - 1) < 1e-12);
  for (const a of COST_ANCHORS) assert.ok(Math.abs(costPerMbAt(a.year) / a.value - 1) < 1e-9);
  assert.ok(Math.abs(costPerMbAt(1958) - 36400 / 3.75) < 1e-9, '350 Model 2: $9,706/MB');
  // log-linear midpoint of a segment is the geometric mean of its endpoints
  const mid = densityAt(1996);   // 1980→2012 midpoint (18 y each)
  assert.ok(Math.abs(mid / Math.sqrt(1.2e7 * 1.0e12) - 1) < 1e-9);
  // clamping outside the anchor range
  assert.equal(densityAt(1900), DENSITY_ANCHORS[0].value);
  assert.equal(densityAt(2100), DENSITY_ANCHORS[DENSITY_ANCHORS.length - 1].value);
}

// 11. Doubling times: density doubled roughly every two years for 68 years.
console.log('Testing implied doubling times...');
{
  const kryder = doublingTime(1956, 2024);
  assert.ok(kryder > 2.1 && kryder < 2.5, `density doubling ≈ 2.3 yr, got ${kryder.toFixed(2)}`);
  const seg1 = doublingTime(1956, 1980);   // 2 k → 12 M bit/in²
  const seg2 = doublingTime(1980, 2024);   // 12 M → 2.4 T bit/in²
  assert.ok(seg1 > 1.7 && seg1 < 2.1, `1956–1980 doubling ${seg1.toFixed(2)} yr`);
  assert.ok(seg2 > 2.3 && seg2 < 2.7, `1980–2024 doubling ${seg2.toFixed(2)} yr`);
  const capacityDoubling = doublingTime(1956, 2024, capacityAt);
  assert.ok(capacityDoubling > 2.7 && capacityDoubling < 3.3,
    `drive capacity doubled every ~3 yr, got ${capacityDoubling.toFixed(2)}`);
  assert.ok(capacityDoubling > kryder, 'density outpaced flagship capacity — form factors shrank');
  assert.ok(Number.isNaN(doublingTime(1980, 1980)), 'no elapsed years, no doubling time');
}

// 12. Cost collapse: $100 of storage then and now.
console.log('Testing the economics...');
{
  const then = hundredDollarsBuysMb(1958);
  const now = hundredDollarsBuysMb(2026);
  assert.ok(then > 0.009 && then < 0.011, `$100 bought ~10 KB in 1958, got ${(then * 1000).toFixed(1)} KB`);
  assert.ok(now > 5e6 && now < 9e6, `$100 buys millions of MB today, got ${now.toExponential(2)}`);
  assert.ok(now / then > 4e8, `price per megabyte fell more than 400,000,000×, got ${(now / then).toExponential(1)}`);
}

// 13. Translation: one 2 TB microSD expressed in each era's flagship hardware.
console.log('Testing the translation widget...');
{
  const y1956 = translateYear(1956);
  assert.equal(y1956.drives, MICROSD_MB / 3.75);
  assert.ok(y1956.drives > 533_000 && y1956.drives < 534_000, '≈ 533,333 RAMAC units per 2 TB');
  assert.ok(y1956.tons > 500_000, 'at one ton each that is half a million tons');
  const y2024 = translateYear(2024);
  assert.ok(y2024.drives < 70, 'in 2024 a 2 TB microSD is a fraction of one flagship drive');
  assert.ok(translateYear(1973).drives > translateYear(2024).drives);
}

// 14. Milestone sanity: chronological, and the announcement anchors exist.
console.log('Testing milestone data...');
{
  assert.ok(MILESTONES.length >= 12);
  const dates = MILESTONES.map(m => m.date).slice().sort();
  assert.deepEqual(MILESTONES.map(m => m.date), dates, 'milestones are chronological');
  assert.ok(MILESTONES.some(m => m.text.includes('14 September 1956')));
  assert.ok(MILESTONES.some(m => m.text.includes('Brussels')));
  assert.ok(MILESTONES.some(m => m.text.includes('Rabinow')));
}

console.log('All RAMAC disk file tests passed.');
