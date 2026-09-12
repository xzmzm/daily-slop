// ramac.js — closed-form model of the IBM 350 disk file (RAMAC, 1956).
// Documented IBM figures live in SPECS / TAPE_727 / anchor tables; everything
// else is derived here from first principles so the tests can pin it exactly.
// Sources for every constant are listed in NOTES.md.

// ---------------------------------------------------------------------------
// Documented specification
// ---------------------------------------------------------------------------
export const SPECS = {
  platters: 50,
  diskDiameterIn: 24,          // aluminium, 1/10 in thick, painted with iron oxide
  rpm: 1200,
  surfaces: 100,               // both sides of all 50 platters
  tracksPerSurface: 100,       // concentric tracks per surface
  charsPerTrack: 500,
  recordsPerTrack: 5,          // five 100-character records per track
  charsPerRecord: 100,
  dataBitsPerChar: 6,          // BCD character
  recordedBitsPerChar: 8,      // 6 data bits + 1 parity bit + 1 space bit
  charRatePerSec: 8800,        // sustained transfer rate
  arealDensityBitsPerSqIn: 2000,
  avgAccessMs: 600,            // IBM's documented average access time
  maxAccessMs: 800,            // IBM's documented worst case
  leaseSystemPerMonth: 3200,   // IBM 305 RAMAC system, USD/month (lease only)
  leaseDiskPerMonth: 650,      // IBM 350 disk unit, USD/month
  purchaseModel2: 36400,       // May 1958: 350 Model 2 purchase price
  weightTons: 1,               // the 350 unit shipped by cargo plane
};

export const REV_MS = 60_000 / SPECS.rpm;            // 50 ms per revolution
export const REVS_PER_SEC = SPECS.rpm / 60;          // 20
export const TOTAL_CHARS =
  SPECS.surfaces * SPECS.tracksPerSurface * SPECS.charsPerTrack;   // 5,000,000
export const CAPACITY_MB = (TOTAL_CHARS * SPECS.dataBitsPerChar) / 8 / 1e6;  // 3.75
export const BITS_PER_TRACK = SPECS.charsPerTrack * SPECS.recordedBitsPerChar; // 4000
export const CARDS_EQUIV = TOTAL_CHARS / 80;         // 62,500 eighty-column cards

// ---------------------------------------------------------------------------
// Recorded-band geometry, solved in closed form.
// Every track holds the same BITS_PER_TRACK bit cells (constant angular
// velocity), so the innermost track is the densest:
//   linear density  = BITS_PER_TRACK / (2·π·r_in)
//   track density   = 100 tracks / (r_out − r_in)
// Their product equals the documented areal density A, which rearranges to
//   r_in · (r_out − r_in) = BITS_PER_TRACK·100 / (2·π·A)  — a quadratic.
// ---------------------------------------------------------------------------
export const R_OUT = 11.5;   // 24 in platter with a half-inch rim margin (stated assumption)

export function bandRadii(rOut = R_OUT, bitsPerTrack = BITS_PER_TRACK,
                          tracks = SPECS.tracksPerSurface,
                          areal = SPECS.arealDensityBitsPerSqIn) {
  const k = (bitsPerTrack * tracks) / (2 * Math.PI * areal);
  const disc = Math.max(rOut * rOut - 4 * k, 0);
  const rIn = (rOut - Math.sqrt(disc)) / 2;   // smaller root: the wider band
  return { rIn, rOut, width: rOut - rIn };
}

export function arealFromGeometry(rIn, width) {
  const linear = BITS_PER_TRACK / (2 * Math.PI * rIn);   // bits per inch, innermost track
  const trackDensity = SPECS.tracksPerSurface / width;   // tracks per inch
  return linear * trackDensity;
}

export const BAND = bandRadii();
export const TRACK_PITCH_IN = BAND.width / SPECS.tracksPerSurface;   // centre-to-centre
export const BIT_CELL_IN = (2 * Math.PI * BAND.rIn) / BITS_PER_TRACK; // innermost track
export const BIT_AREA_SQIN = 1 / SPECS.arealDensityBitsPerSqIn;      // one 1956 bit

// ---------------------------------------------------------------------------
// Head-positioning model, calibrated to IBM's two documented totals
// (average 600 ms, maximum 0.8 s). The mechanism is one boom carrying two
// heads: it slides vertically to choose a surface and radially to choose a
// track. A fixed position-and-settle term dominates — the slow part was not
// the travel but bringing the head to rest. Rotational latency is uniform
// on [0, REV_MS].
// ---------------------------------------------------------------------------
export const SETTLE_MS = 487;
export const VERTICAL_FULL_MS = 170;
export const HORIZONTAL_FULL_MS = 90;

export function seekMs(dSurfaces, dTracks) {
  const ds = Math.abs(dSurfaces) / (SPECS.surfaces - 1);
  const dt = Math.abs(dTracks) / (SPECS.tracksPerSurface - 1);
  return SETTLE_MS + VERTICAL_FULL_MS * ds + HORIZONTAL_FULL_MS * dt;
}

export function accessMs(dSurfaces, dTracks, latencyMs) {
  return seekMs(dSurfaces, dTracks) + latencyMs;
}

// Exact mean of |X−Y| for two independent uniform integers in {0..n−1}.
export function meanAbsDiff(n) {
  return (n * n - 1) / (3 * n);
}

export function meanAccessMs() {
  return seekMs(meanAbsDiff(SPECS.surfaces), meanAbsDiff(SPECS.tracksPerSurface)) + REV_MS / 2;
}

export function maxAccessMs() {
  return seekMs(SPECS.surfaces - 1, SPECS.tracksPerSurface - 1) + REV_MS;
}

export function recordTransferMs(chars = SPECS.charsPerRecord) {
  return (chars / SPECS.charRatePerSec) * 1000;   // 100 chars ≈ 11.4 ms
}

// ---------------------------------------------------------------------------
// BCD character code (IBM six-bit): zone bits (B,A) + digit bits (8,4,2,1).
// 1–9 keep their digit value; A–I / J–R / S–Z take the 12-, 11- and 0-zone
// punches of the card code. Each character is recorded with a parity bit
// (odd total weight here) and a space bit — 8 cells per character.
// ---------------------------------------------------------------------------
export function bcdCode(ch) {
  const c = ch.charCodeAt(0);
  if (c >= 65 && c <= 73) return 0o61 + (c - 65);   // A..I  → 61₈..
  if (c >= 74 && c <= 82) return 0o41 + (c - 74);   // J..R  → 41₈..
  if (c >= 83 && c <= 90) return 0o22 + (c - 83);   // S..Z  → 22₈..   (0-zone, digit 2..9)
  if (c >= 49 && c <= 57) return c - 48;            // 1..9
  if (ch === '0') return 0o10;
  if (ch === ' ') return 0o20;
  return null;                                      // not on the RAMAC keypunch
}

export function encodeChar(ch) {
  const code = bcdCode(ch);
  if (code === null) return null;
  const bits = code.toString(2).padStart(6, '0').split('').map(Number);
  const parity = (bits.reduce((a, b) => a + b, 0) % 2 === 0) ? 1 : 0;  // odd parity
  return { ch, code, bits, parity, cells: [...bits, parity, 0] };
}

export function encodeMessage(text) {
  return [...text.toUpperCase()].map(encodeChar);
}

// ---------------------------------------------------------------------------
// The competition: IBM 727 tape (1953) — a reel held about as much as RAMAC
// and streamed faster, but sequentially. Average fetch = half a reel scan.
// ---------------------------------------------------------------------------
export const TAPE_727 = {
  charsPerSec: 15000,
  charsPerReel: 5_760_000,    // 2,400 ft × 200 chars/in
  cpi: 200,
  speedInPerSec: 75,
};

export function tapeMeanFetchMs(chars = TAPE_727.charsPerReel) {
  return ((chars / 2) / TAPE_727.charsPerSec) * 1000;
}

export const RAMAC_FETCH_MS = meanAccessMs() + recordTransferMs();
export const TAPE_FETCH_MS = tapeMeanFetchMs();
export const TAPE_TO_RAMAC = TAPE_FETCH_MS / RAMAC_FETCH_MS;

// NVMe anchor for the race: a 2026 datacentre SSD does a random 4 KiB read in
// ~100 µs end-to-end.
export const NVME_FETCH_MS = 0.1;

export const RACE_TECHS = [
  { id: 'tape', name: 'IBM 727 tape · 1953', fetchMs: TAPE_FETCH_MS, note: 'sequential — scan half a reel' },
  { id: 'ramac', name: 'IBM 350 RAMAC · 1956', fetchMs: RAMAC_FETCH_MS, note: 'random — any record' },
  { id: 'nvme', name: 'NVMe SSD · 2026', fetchMs: NVME_FETCH_MS, note: 'random — flash parallelism' },
];

export function recordsPerDay(fetchMs, hours = 8) {
  return (hours * 3600 * 1000) / fetchMs;
}

// ---------------------------------------------------------------------------
// Seventy-year curves. Anchors only; values between are log-linear.
// ---------------------------------------------------------------------------
// Areal density, bits per square inch — every anchor is documented.
export const DENSITY_ANCHORS = [
  { year: 1956, value: 2.0e3, label: 'IBM 350 — iron oxide paint' },
  { year: 1980, value: 1.2e7, label: 'IBM 3380 — 12 Mbit/in²' },
  { year: 2012, value: 1.0e12, label: 'Seagate HAMR demo — 1 Tbit/in²' },
  { year: 2015, value: 1.34e12, label: 'shipping 1.34 Tbit/in²' },
  { year: 2024, value: 2.4e12, label: 'Mozaic 3+ HAMR ships 30 TB' },
];

// Flagship single-drive capacity in MB. The two dips are real: the 1311 disk
// pack and the ST-506 traded capacity for removability and for the PC bay.
export const CAPACITY_ANCHORS = [
  { year: 1956, value: 3.75, label: 'IBM 350 — 50×24″ platters, 1 ton' },
  { year: 1962, value: 1.5, label: 'IBM 1311 pack — 2M chars, removable' },
  { year: 1973, value: 70, label: 'IBM 3340 Winchester — 70 MB module' },
  { year: 1980, value: 5, label: 'Seagate ST-506 — 5 MB, 5.25″' },
  { year: 2000, value: 75200, label: 'IBM 75GXP — 75 GB, 3.5″' },
  { year: 2007, value: 1.0e6, label: 'Hitachi 7K1000 — first 1 TB' },
  { year: 2024, value: 3.0e7, label: 'Seagate Exos M — 30 TB HAMR' },
];

// Storage price in USD per MB (purchase, nominal).
export const COST_ANCHORS = [
  { year: 1958, value: 36400 / 3.75, label: '350 Model 2 purchase — $36,400 / 3.75 MB' },
  { year: 1980, value: 1500 / 5, label: 'ST-506 — $1,500 / 5 MB' },
  { year: 2023, value: 175 / 8e6 * 1e3, label: '8 TB HDD — $175' },   // $/MB
  { year: 2026, value: 0.000015, label: 'mass-capacity HDD ≈ $0.015/GB' },
];

export function logInterp(anchors, year) {
  if (year <= anchors[0].year) return anchors[0].value;
  const last = anchors[anchors.length - 1];
  if (year >= last.year) return last.value;
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i], b = anchors[i + 1];
    if (year >= a.year && year <= b.year) {
      const t = (year - a.year) / (b.year - a.year);
      return Math.exp(Math.log(a.value) * (1 - t) + Math.log(b.value) * t);
    }
  }
  return last.value;
}

export const densityAt = (year) => logInterp(DENSITY_ANCHORS, year);
export const capacityAt = (year) => logInterp(CAPACITY_ANCHORS, year);
export const costPerMbAt = (year) => logInterp(COST_ANCHORS, year);
export const hundredDollarsBuysMb = (year) => 100 / costPerMbAt(year);

// Implied doubling time between two years on a log-linear anchor curve.
export function doublingTime(fromYear, toYear, at = densityAt) {
  const ratio = at(toYear) / at(fromYear);
  return ((toYear - fromYear) * Math.LN2) / Math.log(ratio);
}

// ---------------------------------------------------------------------------
// Translation fun: one 2 TB microSD (0.25 g) expressed in a given year's tech.
// ---------------------------------------------------------------------------
export const MICROSD_MB = 2.0e6;

export function translateYear(year) {
  const flagshipMb = capacityAt(year);
  const drives = MICROSD_MB / flagshipMb;
  const tons = drives * SPECS.weightTons;
  const lease = (drives * (SPECS.leaseDiskPerMonth + SPECS.leaseSystemPerMonth)) / 1000; // k$/month if 305+350 sets
  return { year, flagshipMb, drives, tons, leaseK: lease };
}

// ---------------------------------------------------------------------------
// Milestones for the timeline strip.
// ---------------------------------------------------------------------------
export const MILESTONES = [
  { date: '1952-01-15', text: 'Jacob Rabinow describes a rotating-disk file at the National Bureau of Standards' },
  { date: '1953-09-25', text: 'IBM 727 tape: 15,000 chars/s — fast, but strictly sequential' },
  { date: '1954-02-10', text: 'First random-access disk test bed reads and writes at IBM San José' },
  { date: '1956-06-01', text: 'Prototype 350 delivered to Zellerbach Paper, San Francisco' },
  { date: '1956-09-04', text: 'RAMAC 305 announced internally; public announcement 14 September 1956' },
  { date: '1957-04-01', text: 'Production shipments begin; a 350 crosses the Atlantic by DC-7 freighter' },
  { date: '1958-04-01', text: 'Brussels World\'s Fair: RAMAC answers visitors\' questions from its disks' },
  { date: '1958-05-01', text: '350 Model 2 offered for sale — $36,400, or $700 a month' },
  { date: '1960-08-25', text: 'RAMAC processes results at the Rome Olympics' },
  { date: '1961-06-01', text: 'IBM 1301: heads fly on an air bearing, never touching the disk' },
  { date: '1962-10-01', text: 'IBM 1311: the removable 14-inch disk pack era begins' },
  { date: '1973-03-01', text: 'IBM 3340 "Winchester" — sealed assembly, low-mass flying heads' },
  { date: '1980-06-01', text: 'Seagate ST-506 puts 5 MB in a PC bay' },
  { date: '2012-03-19', text: 'Seagate demonstrates 1 Tbit/in² HAMR in the lab' },
  { date: '2014-04-01', text: 'Shipping drives cross 1 Tbit/in²' },
  { date: '2024-01-17', text: 'Mozaic 3+ HAMR: 30 TB drives ramp to volume' },
  { date: '2026-01-01', text: '50 TB HAMR drives enter qualification for 2027' },
];
