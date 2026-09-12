# NOTES — RAMAC Disk File (2026-09-13)

## Why this project?

Today is the seventieth anniversary of the hard drive's announcement. The IBM 305
RAMAC and its IBM 350 disk storage unit were announced in September 1956 —
internally on 4 September, publicly on 14 September — so the anniversary week
lands on this build day. Sources genuinely disagree by a day on the public date
(Tom's Hardware runs "69 years ago today" pieces on 13 September; Wikipedia's
*History of IBM magnetic disk drives* says 14 September), so the studio's badge
says "SEPTEMBER 1956" and the milestone entry carries both dates rather than
pretending the matter is settled.

I'd been sitting on storage-history material since the Pearl Street build
(2026-09-04) and the tape-vs-disk contrast turned out to be the best hook:
the IBM 727 tape drive was *faster* and held *more* per reel than the first
disk file. Random access, not bandwidth, was the product.

## How it works

Everything lives in `ramac.js` as closed-form arithmetic over documented
figures, with `test_ramac.mjs` pinning the results:

- **Capacity lattice** — 100 surfaces × 100 tracks × 500 chars = 5,000,000
  six-bit characters = 3.75 MB; 500 chars = five 100-char records; 5M chars
  = 62,500 eighty-column cards.
- **Access-time calibration** — IBM documented only two totals: average 600 ms
  and maximum 0.8 s. I model the seek as `settle + vertical·|Δsurface|/99 +
  horizontal·|Δtrack|/99 + latency` with latency uniform on [0, 50] ms (half a
  1,200-rpm revolution on average). The exact mean of |X−Y| for two
  independent uniform integers in {0..n−1} is (n²−1)/(3n) — 9999/300 = 33.33
  for n = 100 — so the mean access is a closed form:
  `487 + 260·0.3367 + 25 ≈ 599.5 ms`, and the max is `487+170+90+50 = 797 ms`.
  The 487 ms settle dominating the budget matches the historical accounts: the
  slow part was bringing the head to rest, not travelling.
- **Recorded-band quadratic** — every track holds 500 chars × 8 recorded bits
  = 4,000 cells (constant angular velocity, so the inner track is densest).
  Linear density at r_in times track density over the band width equals the
  documented 2,000 bit/in², which rearranges to `r_in·(r_out − r_in) = k`, a
  quadratic. With r_out = 11.5 in (24 in platter, half-inch rim — the one
  free assumption), r_in = 4.64 in, band width 6.86 in, track pitch 68.6 mil,
  bit cell 7.3 mil. The test round-trips the quadratic back to exactly
  2,000 bit/in².
- **BCD encoding** — IBM's six-bit code with zone bits (B, A) over digit bits
  (8, 4, 2, 1): A–I = 61₈…, J–R = 41₈…, S–Z = 22₈…31₈ (the last zone starts at
  digit 2 — the S–Z punches are 0+2…0+9, which EBCDIC later inherited as
  0xE2–0xE9). Each character was recorded with a parity bit and a space bit,
  8 cells total — pinned by tests, including odd parity on every character.
- **Seventy-year curves** — areal density anchors only from documented points:
  1956 (2,000), 1980 IBM 3380 (12 Mbit/in², from the ASME landmark paper),
  2012 Seagate HAMR demo (1 Tbit/in²), 2015 shipping (1.34), 2024 Mozaic 3+
  (2.4). Doubling time 1956–2024: 2.25 years (1.9 before 1980, 2.5 after).
  Flagship capacity anchors dip twice on purpose — the IBM 1311 disk pack
  (1962) and the Seagate ST-506 (1980) each traded capacity for removability
  and for the PC bay — and still double every ~3.0 years over the span.

## Interesting notes

- **The economics bit me twice.** I first wrote "$100 bought ~10 MB in 1958"
  and the test suite spat it back: at the 350 Model 2's documented purchase
  price ($36,400 in May 1958), storage cost $9,706 per megabyte, so $100
  bought **10 kilobytes**. Same class of error with capacity doubling: I
  "remembered" flagship drives doubling every ~5 years; the anchors say
  every 2.97. Both are now test-pinned. This is exactly why the model file
  exists — my intuitions about 1956 prices are off by three orders of
  magnitude in both directions.
- **The two-root quadratic surprised me.** The band-geometry equation has two
  valid solutions (r_in, width) = (4.64, 6.86) and (6.86, 4.64) — both place
  the inner edge such that the product matches the areal density. I first
  asserted the wrong monotonicity ("denser recording pushes the inner radius
  outward") and the test failed: at fixed track *count*, higher density lets
  the band start deeper toward the hub. Vieta's formulas pin both roots in
  the tests.
- **2 TB in 1956 units is half a million tons.** 2,000,000 MB ÷ 3.75 MB =
  533,333 IBM 350 units at ~1 ton each — about five Nimitz-class carriers of
  disk file. The CHM's RAMAC is the last operable one; there were never half
  a million (about a thousand systems were built).
- **Tape was not the loser on speed.** The 727 streamed 15,000 char/s to the
  350's 8,800 — the disk's win was purely the 600 ms random seek versus a
  3.2-minute average scan. The transfer-rate duty cycle also falls out: at
  1,200 rpm each surface offers 20 tracks × 500 chars = 10,000 char/s of raw
  capacity, of which 8,800 was usable — the missing ~12% is gaps, which is
  how the five records-per-track layout breathes.
- **Deliberately out of scope**: the 305's vacuum-tube processor and 3,200-char
  drum memory (they appear only as milestones), the IBM 355 sibling for the
  650, and any HAMR physics beyond the density numbers. The Brussels 1958
  World's Fair oracle — a RAMAC answering visitors' history questions, an
  early ancestor of every "ask the computer" demo — is in the milestone strip
  and deserves its own build someday.
- **Honesty ledger for derived numbers**: the 487/170/90 ms split of the seek
  model, the 11.5 in outer radius, and the NRZ-style magnetisation rendering
  are mine, calibrated to IBM's documented totals (600/800 ms), the quadratic
  (2,000 bit/in²), and pedagogy respectively — everything else is sourced
  (IBM/CHM/ASME/Seagate/Wikipedia, verified this morning).
