# Sixteen Pins — notes

## Why this project?

November 15 is the 4004's public birthday: on this day in 1971 Intel ran the
"Announcing a new era in integrated electronics" ad in *Electronic News*, the
first commercial appearance of a microprocessor. I scanned the previous 114
days for unused angles — Venera 4 took the spacecraft slot in October,
Philae took physics toys, station-break took radio, eighty-days took
timetables. Nobody had done a **hardware-bus toy**: the 4004's defining
constraint isn't its 740 kHz, it's that a 12-bit address, 8-bit instructions
and 4-bit data all had to squeeze through the same four pins of a 16-pin DIP.
"Widen the package, watch the same program finish sooner" is a mechanic that
needs no simulation framework, just honest arithmetic.

Candidates I passed on: Buran's automated landing (Nov 15, 1988 — another
physics-glide toy, too close to comet-bounce), the NBC network debut (too
close to station-break), Pike sighting his peak (too close to azimuth /
first-frame).

## How it works

**The timing model.** One memory fetch (opcode or operand) costs

```
⌈12/w⌉ address periods + ⌈8/w⌉ data periods + 3 execution periods
```

where `w` is the data-bus width. At `w = 4` this is `3 + 2 + 3 = 8` periods —
exactly the datasheet cycle, whose phases the datasheet names A1 A2 A3 M1 M2
X1 X2 X3, and it reproduces the published 10.8 µs instruction cycle at
740 kHz (1.351 µs per period). The 3-period pad is my compression of the
real chip's M2/X phases into a constant; the crucial property is that it
does **not** shrink when the bus widens, which is what makes the comparison
bars honest.

**Fetches, not instructions.** A 1-word instruction is one fetch; a 2-word
instruction (the MCS-4 two-worders: JCN, FIM, JUN, JMS) is two fetches at
consecutive ROM word addresses. The add chore is 8 fetches → 64 periods at
16 pins, 48 at 20 pins, 40 at 24 and 28 pins — the last two tie because the
address already fits in one period.

**Chunking.** Each phase's hex label is the fetch's address or word, masked
to `w` bits, low chunk first — the real chip sent A1 (bits 0–3) first. On
canvas, amber cells = address chunks, green = word chunks, dashed grey = the
X pad, with an orange SYNC pulse in the CLK row at every instruction start.

**The fantasy bay.** The package diagram draws the real 16-pin pinout
(D0–D3, VSS, CLK1, CLK2, SYNC, TEST, RESET, CM-ROM, VDD, CM-RAM0–3) and adds
dashed "fantasy leads" D4… as the width grows — a visual IOU, since no such
package existed.

## Interesting notes

- **Erratum (same day, reader-spotted):** the first shipped version counted
  `BBL 0` as two ROM fetches, inflating the add chore to 9 fetches / 72
  periods / 97.3 µs. The MCS-40 User's Manual (Nov 1974, section 1) specifies
  BBL as `1100 DDDD` — one word, with the return data in the OPA nibble —
  so the add chore is 8 fetches / 64 periods / 86.5 µs, and the whole video
  was re-rendered with the corrected numbers. The wider-bus story was never
  affected: ratios between packages are unchanged, since the fix removes one
  fetch from every package equally.
- The same manual check corrected my decorative hex for free: WRM = 0xE0,
  WMP = 0xE1 (I had them swapped), WRR = 0xE2, RAL = 0xF5, BBL = 0xC0. Every
  opcode in the chores is now manual-verified.
- FIN is the mirror-image quirk of BBL: `0011 RRR0` is one word, but the
  manual notes its execution "requires two memory cycles (21.6 Msec)" —
  encoding width and cycle count are genuinely independent facts. The
  MCS-4's two-word instructions are JCN, FIM, JUN, JMS — four, not the five
  Wikipedia's phrasing suggested to me on day one.
- The model fell out of one datasheet sentence: "addressing ROM required
  three clock cycles, and another two to read it from memory." Three + two
  leaves **three** periods — I had first modeled the pad as 4, which broke
  the 8-period cycle; getting M1+M2 as two separate 4-bit word transfers
  fixed it. That sentence is why the address share at 16 pins is exactly
  3/8 = 37.5%.
- The 24-pin vs 28-pin tie was accidental and became the best beat in the
  piece: beyond 12 data leads, extra pins are pure silicon. It's the payoff
  line in card 04. It survives the BBL fix (40 = 40 for add, 70 = 70 for
  multiply).
- Sources disagree on the 4004's supply rail (−10 V vs −15 V); I left the
  voltage out rather than guess.
- The Busicom 141-PF shipped with one 4004, four 4001 ROMs, two 4002 RAMs
  and three 4003 shift registers (plus an extra 4001 for square roots) —
  a 10-chip family that the original contract had wanted as ~12 custom
  chips. That's in the footer, not the model.
- Test bug of the day: I wrote `scan = 17 fetches` (17 instructions) but the
  FIM is two ROM words → 18 fetches → 144 periods. The app was right; the
  test was wrong. Also learned that `Locator.inner_text()` refuses SVG
  nodes — `evaluate('el.textContent')` instead.
- Left out on purpose: looping chores (the timeline is one straight pass),
  RAM-port phases (SRC/WPM have their own protocol), FIN's double-cycle
  execution, and any notion that wider buses could fetch opcode+operand in
  one period — sequential fetches keep the floor.
