# Eleven Days · 失踪的十一天

A calendar-mechanics studio for the 274th anniversary of **2 September 1752** —
the last day the British Empire wrote in Julius Caesar's calendar. That
Wednesday night, eleven dates (3–13 September) were abolished: the next
morning was Thursday **14 September**. The seven-day week never paused;
only the numbers fell through the floor.

Built by GLM-5.3

Five rooms:

- **那一夜** — a tear-off wall calendar living the last Julian day; press
  「次日凌晨」 and eleven ghost pages (never printed) flutter off to reveal
  14 September. Beside it, the month exactly as the 1752 almanacs had to
  print it: a **19-day September** (1, 2, then 14–30), with red-letter
  Sundays — the origin of *red-letter day*.
- **儒略的慢性病** — why the surgery was needed: Caesar's 365¼-day year is
  11 min 14 s too long, so the equinox slides a day every 128 years
  (Nicaea 325 pinned it to 21 March; by 1582 it sat on the 11th). The drift
  chart plots both histories, and the gap has a closed form:
  **D(y) = ⌊y/100⌋ − ⌊y/400⌋ − 2** (10 days at the reform, 11 for Britain,
  13 today, 14 from the year 2100).
- **末日算法** — Conway's doomsday method worked out live for any date you
  type: the century anchor **(5(c mod 4)+2) mod 7**, the year part
  y' + ⌊y'/4⌋, his Odd+11 shortcut, and the mnemonic dates (4/4, 6/6, 8/8,
  10/10, 12/12, 5/9, 9/5, 7/11, 11/7, π-day 3/14…) — cross-checked against
  Zeller and the serial-day engine. Quiz mode keeps score.
- **复活节的齿轮** — the reason for the whole reform: Nicaea's Easter rule
  (first Sunday after the first full moon after the equinox). The 19-year
  Metonic wheel (235 lunations ≈ 19 years, short by 2 h 5 min per cycle),
  the Western (Meeus) and Orthodox (Julian paschalia) computus side by side,
  and the 2018–2034 table of their meetings and gaps.
- **化石清单** — the adoption timeline 1582→1923 (Spain, France, Protestant
  Germany, Britain, Sweden, Alaska, Japan, Russia, Greece — each pin shows
  the exact before/after computed from the engine) plus the living fossils:
  the 6 April UK tax year, Orthodox Christmas on 7 January, the October
  Revolution on 7 November, Sweden's 30 February 1712, Alaska's double
  Friday of 1867, Japan's 337-day 1872, Washington's two birthdays, and the
  Revised Julian calendar that won't diverge until 2800.

Everything on screen is computed at render time by a dual-calendar
serial-day engine (one integer per physical day, both calendars anchored so
the week provably never breaks). 31 `node --test` assertions pin the engine:
JS-Date agreement over 1583–2400, the conversion anchors of 1582/1752/1918,
the gap formula, three independent weekday methods, both Easter tables,
and the drift arithmetic.

## How to run

No build step, no dependencies:

```bash
open index.html            # or:
python3 -m http.server 8799 # then visit http://localhost:8799/2026-09-02-eleven-days/
```

Run the test suite:

```bash
node --test test_cal.mjs
```

## Video

`video/eleven-days.mp4` — the Chinese story video (1920×1080, burned-in
subtitles, matching `.srt`), narrated with Fish Audio's 哈基米 voice.

```bash
python3 video/render_fish_video.py   # reads FISH_AUDIO_API_KEY from ../.env
```
