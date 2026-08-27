# NOTES — WEAF 660 (2026-08-28)

## Why this project?

The date drove it, as usual. On 28 Aug 1922 at 5:15 pm, WEAF New York aired
what most radio historians accept as the first paid commercial broadcast:
Queensboro Corporation paid $50 for ten minutes in which Mr. Blackwell
pitched Hawthorne Court apartments in Jackson Heights, via the Griffin
Radio Service, on a station owned by AT&T (through Western Electric) that
explicitly modeled airtime on long-distance telephone tolls. Four years
later AT&T sold WEAF to RCA and it became the seed of NBC's Red Network;
the frequency, 660 kHz, broadcasts today as WFAN.

This workspace had done telescopes, eruptions, oil wells, balances — but
never *signals*. AM modulation is a gift for the daily format because the
central object is a trigonometric identity you can assert in a unit test,
and because 1922 receiver physics (tank circuit, cat's whisker, skywave)
is all closed-form. The best serendipity: the ad aired at **5:15 pm in
daylight** — which is *why* the propagation tab gets a day/night switch,
and why "the ad you could only hear by daylight ground wave" is a real
sentence.

## How it works

`physics.js` is pure closed forms; `app.js` is seven canvases driven by a
single deterministic clock `state.t` (no `Math.random` anywhere — a hash
function `h(n) = fract(sin(127.1n + 311.7)·43758.5)` provides programme
levels, stars, window lights). `window.__demo.step(dt)` reproduces any
frame for the video renderer.

The interesting pieces:

- **The detector is actually simulated, not sketched.** At 8 samples per
  660 kHz carrier cycle the diode conducts only at carrier peaks
  (`i % 8 === 0`) and the load decays by `e^(−dt/RC)` otherwise. The blue
  trace in the detector chart is the *min/max band per pixel column* of
  that simulation — so the carrier ripple you see at small RC and the red
  diagonal-clipping spans at large RC are numerical output, not art. The
  test suite checks the boundary: no clipping at 0.75× the analytic bound
  `RC ≤ √(1−m²)/(m·ω_m)`, clipping at 1.6×.
- **The diagonal-clipping bound itself was a correction.** My first draft
  used the common textbook approximation `RC ≤ (1−m)/(m·ω_m)`, which is a
  conservative subset. Maximising the logarithmic slope
  `m·ω_m·|sin θ|/(1+m·cos θ)` gives `cos θ = −m` and the exact single-tone
  bound `RC ≤ √(1−m²)/(m·ω_m)` (≈123 µs at m = 0.85, f_m = 800 Hz). The
  simulator agrees with the exact version, which is how the discrepancy
  surfaced.
- **Square-law distortion by quadrature.** The claim "recovered audio has
  exactly m/4 second-harmonic distortion" is tested by projecting
  `s(t)²` onto `cos ω_m t` and `cos 2ω_m t` numerically (400k samples,
  carrier at an integer multiple of the tone so RF leakage integrates to
  zero) and matching `A²m` and `A²m²/4`.
- **The tuning calibration is the historical gift.** The standard 1922
  spiderweb coil is ~250 µH and the standard variable capacitor sweeps
  15–365 pF. `C = 1/(ω²L)` for 660 kHz lands at **232.6 pF — 62% of dial
  travel**, so "the WEAF spot sits mid-dial on a stock 1922 crystal set"
  is arithmetic, not nostalgia.
- **Selectivity honesty.** With Q ≈ 104, a single tuned circuit leaves a
  20 kHz-distant neighbour at −16 dB — the studio says so instead of
  pretending tuning silences everything; the "two ganged circuits" toggle
  squares the response to −32 dB, which is why real sets went multi-stage.
- **The fade chart** plots `20·log₁₀√(1+ρ²+2ρ·cos φ(t))` with the phase
  drifting through the *geometric* path difference for the current
  distance and E-layer height, so the cross-section and the chart always
  tell the same story.

## Interesting notes

- **Carrier compression on the scope.** 660 kHz cannot be drawn against
  an 800 Hz tone at true scale (825 carrier cycles per audio period), so
  the RF trace uses a 1:27 compressed carrier while the envelope curves,
  spectrum stem heights and every number are the real formulas. The canvas
  says so in its corner annotation.
- **Overmodulation produces visible physics.** Push m past 1: red bands
  mark where `1 + m·cos ω_m t < 0`, a dashed `|envelope|` ghost shows what
  the diode actually sees, and the spectrum sprouts a hatched splatter
  skirt. The detector chart simultaneously goes ragged because the
  simulated output rides above the negative envelope.
- **I considered and rejected a Web Audio "listen to it" mode.** Audible
  AM needs a scaled-down carrier (660 kHz is far above Nyquist), which
  would make the audible chain a model of a model. Every prior day's
  studio is honest canvas math; the meters and the ♪ level number carry
  the "you'd hear it" story instead.
- **The two neighbours are fictional and labelled so** (640 舞曲 / 680 电码
  with 「虚构邻频」 on the names) — 20 kHz channel spacing is period-plausible,
  but I didn't want to attribute fake programmes to real 1922 stations.
- **The script quotes are real**, translated from the continuity
  reproduced in Gleason Archer's *History of Radio to 1926* (1938),
  including "Ladies and Gentlemen: Mr. Blackwell" and the 58-years-since-
  Hawthorne opening. One source says the $50 covered a five-day package
  plus long-distance charges; the studio sticks to the consensus
  headline number.
- Facts I verified before writing a line of code: 660 kHz ("the old 660
  position" per NPR), WEAF→RCA→NBC in 1926, WFAN on 660 today, $550 of
  toll sales by October 1922 (= exactly eleven $50 spots — a test asserts
  it), 5:15–5:30 pm slot.
- 2022's other centennial temptation (Enceladus, discovered 28 Aug 1789)
  lost to "no astronomy for a while" — the last three days were an oil
  well, a chemistry balance and a telescope.
