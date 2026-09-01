# NOTES — Eleven Days · 失踪的十一天

## Why this project?

Today is 2 September 2026 — a Wednesday, which happens to be the same weekday
name as 2 September 1752, the day the British Empire last used. That night,
Wednesday 2 September was followed by Thursday 14 September. When a date hook
literally re-lands on its own weekday 274 years later, you build the calendar
studio.

Scouting the date first: the other candidates were the first ATM (2 Sep 1969,
Chemical Bank) and the Great Fire of London (2 Sep 1666, its 360th). The ATM
is a mechanism story we've told variants of (Burroughs adder, WEAF's
transmitter bench); the fire is a spread simulation, cousin of the Vesuvius
day. Nobody in the 41 prior days had touched *calendar arithmetic*, and it's
the rare subject where the entire lesson is closed forms — integer formulas
you can check by hand against events that actually happened. That's exactly
this workspace's house style. Decision made.

## How it works

**The serial-day engine.** One integer per physical day, two functions to get
there: Hinnant's `days_from_civil` for the Gregorian calendar and its Julian
twin (era length 1461 instead of 146097). The epoch offset for the Julian
version (`−719470`) isn't copied from anywhere — it's derived in the test
suite from two anchors: Julian 0001-01-01 = Gregorian 0000-12-30, and
Julian 1582-10-04 = Gregorian 1582-10-14 (the papal ten days). Because both
serials describe the *same physical day*, the invariant "the seven-day week
never broke through any reform" is a one-line assertion: weekday computed
from either calendar's label must agree, for every sampled day 400–2400.

**The gap formula.** D(y) = ⌊y/100⌋ − ⌊y/400⌋ − 2. Verified against the
engine for every year 300–3000 at mid-September. It fails below y = 300
(the div-400 edge effect) — the app simply refuses to show a gap before 300.

**Three weekday methods.** Serial, Zeller's congruence, and Conway's
doomsday. Conway's century anchors come from the closed form
(5(c mod 4)+2) mod 7, and his Odd+11 shortcut is tested in the
Finklestein form `(anchor + 7 − t) mod 7` for every year 1500–2600. The
trainer shows all three agreeing on any date you type — three independent
machines reading the same week.

**Computus.** Western Easter via Meeus's anonymous Gregorian algorithm (the
1876/1882 algorithm the Church's own tables encode; the m-term is the pair
of lunar corrections behind the famous 1954/1981/2049/2076 exceptions).
Orthodox Easter via the classical Julian paschalia in one line — paschal
full moon = 21 March Julian + (19a+15) mod 30, then the next Sunday
*strictly* after — checked against nine published Orthodox dates including
the 2017 and 2025 East–West coincidences. No e-term needed: the engine
already knows weekdays.

**The September grid.** The subtlest thing in the build. First draft
rendered 30 cells for the serials spanning Gregorian Sept 1–30 — which
starts at *Julian 21 August* (the first eleven serials are August days,
because Gregorian 1 Sep = Julian 21 Aug at an 11-day gap). Second draft
tried to show 11 "∅ hole" cells for the missing dates — conceptually wrong
too: those dates were never attached to any physical day at all, so they
aren't holes in the timeline; the timeline simply skips them. The truth the
1752 printers actually produced: a 19-cell month, 1 and 2, then straight to
14–30. `september1752()` now returns exactly those 19 serials, and the test
asserts it.

## Interesting notes / dead ends

- **The Gregorian paschal full moon formula I dropped.** Meeus's book pairs
  his Easter algorithm with a PFM formula, month = ⌊(h+114)/31⌋,
  day = (h+114 mod 31)+1. It matched modern years (2024-03-26, 2026-04-03,
  both check out) but disagreed with the *tables* in early-cycle years —
  1592, 1595, 1598 put Easter on the naive PFM itself, and the four famous
  exception years need the week shift read backward. I wrote the fix-up,
  watched 1595 fall below 21 March, and concluded the h-formula is a
  "close-enough-for-Easter" companion, not the table's terminus. Rather
  than ship an unfaithful fact, I deleted the Gregorian PFM entirely and
  kept only the Julian paschalia's full moon, which is exact. The near-miss
  is documented in the git history of this file.

- **Washington's two birthdays.** My first test asserted
  gregorianToJulian(1732-02-22) = 1731-02-11 and the *engine* failed it —
  correctly. The calendar conversion gives 1732-02-11 (the Julian calendar
  has January-based years); the "1731" his contemporaries wrote is the
  old-style civil year that began 25 March. The engine was right, my
  history was conflated. The test now teaches the distinction.

- **Alaska's double Friday** needed real care. 6 October (Julian) and
  18 October 1867 (Gregorian) are the same physical day — of course they
  share a weekday; the "Friday followed by Friday" story is about the
  *date line*: Russian America sat on the Asian side, one day ahead of the
  sun, so its borrowed weekday was handed back during the same changeover.
  The test asserts the same-serial fact; the prose keeps the published
  account with its explanation.

- **Japan 1872** circulates in two versions ("2 December was followed by
  1 January" vs "31 December was"). The National Diet Library's version
  resolves it: the day the old calendar would have called 12th-month, 3rd
  day was instead named 1 January 1873 — so Meiji 5-12-2 = 2 December 1872,
  29 December days were abolished, and Japan's 1872 lasted 337 days.

- **The "calendar riots" are a myth** — no contemporary evidence anyone
  marched for the eleven days; the slogan comes from a stolen banner in
  Hogarth's 1755 print. What's documented is scarier: a full month's rent
  was charged for a 19-day September.

- **The 8765 port was already taken** by a leftover `http.server` from an
  earlier session (serving the wrong cwd — every request 404'd). Rather
  than fight it, today's runs used 8799. Check `lsof -nP -iTCP:8765 -sTCP:LISTEN`
  if the gallery server misbehaves; the culprit PID was 71178.

- **Headless Chrome caches module scripts across `--screenshot` runs**
  (it reuses a temp profile). A DOM dump showed five leading blanks in the
  September grid after I'd fixed the code — stale `cal.js`. `--disk-cache-size=1`
  plus a `?v=` bump fixes it. The CDN the Read tool uploads to also keys by
  filename, so "new" screenshots of the same name read as the old one —
  verify renders via `--dump-dom` and parse the DOM, not by re-eyeballing
  possibly-stale PNGs.

- Deliberately out of scope: the Revised Julian computus (1923, in use by
  some Orthodox churches — its Easter is the same as Julian's until 1600,
  then splits), the French Republican calendar, and the Unix `date`
  proleptic minefield. One day, one calendar night.

## The video

Rendered with the house Fish Audio workflow (`s2.1-pro-free`, 哈基米 voice,
1920×1080, burned-in subtitles, 231 s). The studio gained a `window.__demo`
API for the headless driver — tab switching, slider sweeping, a live
quiz-solve, and the tear-off button, whose eleven ghost pages fly with a
slowed-down stagger in video mode. Two render lessons worth keeping:

- **House conventions don't mix silently.** Cattery's frame pipeline names
  files `000000.png`; carrington's muxer expects `frame-%06d.png`. I had
  copied the capture helpers from one and the encoder from the other, and
  the first full encode died on "no file or sequence". One pattern line,
  and the finished frames were salvageable without re-calling the TTS API.
- **The click halo lingers.** After a click-hold block, later holds with
  `cursor=None` never touch the cursor element, so the orange ring stayed
  on screen through the narration that followed every click. The fix is a
  one-line ring-clear after any hold that showed click frames.

The title card also went through two rounds: the eyebrow wrapped with an
orphaned "TODAY", and decorative torn-page chips at the sheet's foot kept
colliding with the bottom caption — the chips lost the argument and left.
