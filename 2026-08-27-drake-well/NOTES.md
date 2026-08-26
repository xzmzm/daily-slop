# NOTES — Drake's Derrick (2026-08-27)

## Why this project?

Today is the 167th anniversary of the Drake Well: 27 Aug 1859, a Sunday
afternoon, Titusville PA. The anniversary machine in this repo has lately
been running through the history of physics and chemistry (Lavoisier's
balance yesterday, Galileo's tube the day before), and oil drilling is a
completely untouched domain — plus it's one of the rare anniversaries where
the "laboratory" is a wooden derrick and the instrument is a steam engine.
The story beats are irresistible: the self-appointed "Colonel", the salt-well
drillers who laughed and quit, the cast-iron pipe hammered to bedrock with a
white-oak ram, the bit dropping six inches into a crevice on a Saturday
evening, and Uncle Billy finding the hole standing in oil the next day.

## How it works

Everything on screen is driven by five closed forms, all in `physics.js`:

- **Percussion energy.** `δ = ηmgh/(AS)` per stroke; S is an *effective*
  specific energy. I calibrated S(shale) = 2.5 GPa so Drake's string
  (250 kg, 0.9 m drop, 22 strokes/min, 6-in bit, η = 0.6) lands on the
  historically reported ~3 ft/day. The punchline law is the cycle
  constraint: the beam spends T/2 lifting, so gravity only gets T/2 for the
  fall — the effective drop saturates at `½g(T/2)²`. At 240 strokes/min the
  rig makes 0.93× the progress of 22 strokes/min. Hurrying a cable tool
  actually slows you down; the test suite pins this.
- **The rise.** `h = ΔP/(ρg)` — with a 160 kPa surplus of water drive over
  the 0.82-SG oil column, the oil stands 65 ft up the 69.5-ft hole, which is
  exactly the historical "a few feet from the surface" that made the pump's
  job easy.
- **Darcy.** `q = 2πkhΔP/(μ ln(re/rw))`, defaults tuned to ~23.9 bbl/day ≈
  the well's ~1,000 gal/day. The tab draws P(r) on a log axis — a straight
  line whose midpoint is the geometric mean √(rw·re) ≈ 3 m: half the
  drawdown within three metres of a 120-m drainage radius. That's the
  "non-obvious law" of the day.
- **Arps.** `q = qi(1+bDi·t)^(−1/b)` with closed-form cumulative for b<1,
  b=1, and the b→0 limit; tests verify N'(t)=q(t) and the closed forms
  against trapezoid integration to 1e-6 relative.
- **API.** `141.5/SG − 131.5`; water is *exactly* 10° by construction, a
  nice anchor the tests pin at 1e-12.

## Interesting notes

- **The quote bug that broke Chrome but not `node --check`.** I nested ASCII
  double quotes inside double-quoted strings in the drilling log
  (`...是"找油"全都...`). The browser threw `missing ) after argument list`,
  while `node --check` had passed the same file — because Node checks `.js`
  as a CommonJS script, it... actually failed silently for me. Lesson: run
  the page, not just the parser. The fix was 「」-style brackets.
- **Hydrometer direction.** My first hydrometer floated *higher* on lighter
  crudes — exactly backwards. Archimedes: a *denser* (lower-API) liquid
  buoys the instrument higher. The redrawn version places the instrument so
  its own degree tick meets the liquid line, which makes the physics visible:
  in 8° tar the thing rides high out of the liquid; in 42° Penn-light it
  sinks deep. Clamping the stem length (`stemLen ≤ (lineY−jarTop)/(1−api/50)`)
  keeps very heavy crudes from spiking out through the top of the jar.
- **Time-lapse honesty.** The rig animates a steady 0.55 Hz visual cycle
  while the sim clock advances days per real second (ROP is computed per
  *day*, exactly as the formula reads). The stroke counter on the canvas is
  therefore illustrative; the depth, days, and ROP readouts are the real
  integration. This is the same "deterministic sim + decorative skin" split
  the Lavoisier balance used.
- **The crevice beat.** The well stops itself on Saturday evening, 26 Aug
  (engine auto-off, phase "收工过夜"), and only after a pause does the oil
  climb — mirroring the real gap between "drillers quit for the Sabbath" and
  "Uncle Billy sees oil". It's one second of dead air that makes the strike
  land, and it's my favourite detail in the build.
- **The boom derricks.** After `monthsSinceStrike > 6`, little derrick
  silhouettes appear on the far hills — the Oil Creek rush that took the
  price from $20 to 49¢ in 21 months. Nobody notices them on the first
  viewing; that's the point.
- Dead ends: I wanted a bailer animation (cable tools periodically pull the
  bit and drop a bailer tube to lift cuttings) but it doubled the state
  machine for little physics; cut. The 42-gallon barrel standard (1866) is
  mentioned only in the API tab's small print — a whole "barrel economics"
  tab felt like scope creep.
