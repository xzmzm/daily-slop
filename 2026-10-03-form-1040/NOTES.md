# Notes — Form 1040, 1913

## Why this project?

October 3, 1913: Woodrow Wilson signed the Revenue Act of 1913, and with it
the first permanent peacetime federal income tax and the first Form 1040.
Candidates for the day included Sigma 7 (Oct 3, 1962) and Atlantis's maiden
flight (Oct 3, 1985), but the shelf already holds a lot of aerospace; the
index had nothing about tax, money, or marginal-vs-effective rates — a concept
half the internet still argues about every April. A schedule of six surtax
bands from 1913 is the cleanest possible classroom for it.

The last several days were physics benches (Nipkow discs, CD sampling, CG
loading), so a numbers-and-law project with an aged-paper aesthetic also gave
the gallery a change of texture.

## How it works

The 1913 schedule has two stacked parts, and the app keeps them as separate as
the act did:

- **Normal tax**: 1% of net income above the exemption ($3,000 single,
  $4,000 married).
- **Additional (surtax) tax**: 1% of the portion of net income over $20,000
  up to $50,000; 2% over $50,000–$75,000; 3% over $75,000–$100,000; 4%
  over $100,000–$250,000; 5% over $250,000–$500,000; 6% above $500,000.
  Combined top marginal: **7%**.

The quirk the whole page leans on: **the exemption only reduces the normal
tax.** The surtax thresholds apply to full net income. A single filer at
$23,000 pays 1% of $20,000 *plus* 1% of $3,000 — the $3,000 exemption does
not shave the surtax base. The original form says this out loud ("only $3,000
to be deducted for the purposes of the normal tax"), and the app's surtax
table deliberately never references line 4. Marriage at $23,000 saves exactly
1% of $1,000 = $10.

The marginal/effective split falls out of the same slices: marginal rate =
1% + the rate of the band containing the next dollar; effective rate =
total tax ÷ income. At $1,000,000 that's 7¢ vs 6¢ on the dollar.

**2026 comparison**: the same income × 33 (rough CPI factor, 1913→2026) is
run through tax-year 2026 numbers from Rev. Proc. 2025-32 — standard deduction
$16,100/$32,200, seven brackets from 10% to 37%. The deduction applies to the
whole schedule, which is exactly what 1913 *didn't* do; the panel is quietly
the second lesson.

**The warp**: a linear $0–$1M slider puts $3,000 (the whole story's pivot) at
0.3% of the track. Slider position and both chart x-axes use a shared cube-root
warp (income^(1/3)), which parks $3,000 at 14% and $125,000 at mid-track. The
sliced income bar's band widths are warped spans, so the bar and staircase
share one scale; the striped tail beyond your income reads as "scale to $1M"
rather than empty space (a first-draft flaw the screenshot pass caught).

## Interesting notes

- A boundary subtlety the video review caught: "marginal rate" is the *right*
  derivative. At income exactly $50,000, the over-$50,000 band has earned $0.00
  (its row shows zero, honestly), yet the next dollar already pays 3¢. The
  first `marginalAt` used strict `>` against the band floor and reported 2¢ at
  the exact threshold — true of the *last* dollar, false of the *next* one.
- Test-first bug: the very first version of `sliceTax` subtracted
  `max(income, from)` instead of `from` — every bracket's portion came out
  zero and the form showed $0.00 for millionaires. The node tests caught it in
  seconds; three of the test *expectations* were also wrong on first write
  (a 12-vs-0.12 slip, an income above the deduction called "under" it, and a
  hand-sum of the 1913 bands that dropped one). Lesson re-learned: when both
  the code and the test disagree with you, recompute by hand before deciding
  which one is wrong.
- The `$23,000 single filer → $230 total` example is the app's default state
  because it's the cleanest narrative number: every line of the form is
  nonzero, exactly one surtax band lights, and marginal (2%) vs effective
  (1%) differ by a clean factor of two.
- Personas are representative 1913 occupations, not historical people
  ($580 ≈ an industrial year's wage, $700 a schoolteacher's). The "2 in 100
  households" figure is the commonly cited share of households paying any
  income tax in the early years — Wikipedia phrases it as ~3% of the
  *population* subject to the tax; either way the dot grid's point survives.
- The 1913 form really did fit one page (plus instructions), really was due
  March 1, 1914, and really did threaten false filers with a $2,000 fine or
  a year in prison — all reproduced on the paper panel nearly verbatim.
- Left deliberately out: 1913 corporate tax, the tariff half of the act,
  state taxes, and any attempt at real historical CPI month-matching. The ×33
  factor is labeled approximate everywhere it appears.

## Sources

- Revenue Act of 1913 (Underwood–Simmons Tariff Act), sec. II — rates and
  schedule as described above.
- IRS, original Form 1040 for tax year 1913 (form layout, exemption wording,
  penalties).
- IRS Rev. Proc. 2025-32 / IRS newsroom release, tax-year 2026 brackets and
  standard deductions (10/12/22/24/32/35/37%; $16,100 single / $32,200 MFJ).
- CPI conversion ≈ ×33 (1913→2026), approximate by design.
