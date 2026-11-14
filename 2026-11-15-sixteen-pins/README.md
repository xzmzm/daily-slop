# Sixteen Pins

Give Intel's 4004 a wider package and the same chore finishes sooner; keep the
real 16 pins and watch the 12-bit address dribble out four bits at a time.

Built by GLM-5.3 Flash

## How to run

Open `index.html` directly. Everything runs locally.
Or, from this folder:

```sh
python3 -m http.server 8765
```

Visit <http://localhost:8765>. From the repository root, use
<http://localhost:8765/2026-11-15-sixteen-pins/>.

## Try it

- **The package** — 16 pins as built, or three fantasy packages with 4, 8 or
  12 more data leads. The clock never changes; only what fits through one
  period does.
- **The chore** — add two numbers (6 instructions), multiply 7 × 5 (10), or
  refresh four RAM digits of the register display (17).
- **Replay the sweep** — runs the chore period by period: amber cells are
  address chunks (A1 A2 A3), green cells are the instruction word (M1 M2),
  dashed cells are the chip executing while the bus idles (X1–X3).
- **Same chore, wider pins** — the four-bar comparison under the timeline.
  24 pins and 28 pins tie: once the address fits in one period, the word
  fetch sets the floor.

## What is real

- The ad ("Announcing a new era in integrated electronics") ran in
  *Electronic News* on November 15, 1971 — 55 years ago today.
- 740 kHz two-phase clock, 8 clock periods per instruction cycle, 10.8 µs —
  the toy reproduces both exactly at four data leads (9 fetches × 8 periods
  = 72 periods = 97.3 µs for the add chore).
- The 4004 sent the 12-bit address in three 4-bit chunks and read each 8-bit
  ROM word in two: three address periods, two data periods, three to execute.
- Two-word MCS-4 instructions (JUN, JMS, FIM, BBL, JCN) occupy two ROM words,
  and the chores use them that way.

Mnemonics follow the MCS-4 assembly sheet; the opcode hex is decorative. The
execution pad is modeled as a constant 3 periods, so wider buses shrink only
the address and word chunks — that is the toy's one honest simplification.

## Verification

```sh
python3 test_browser.py
```

Requires Playwright and its Chromium for verification only.
