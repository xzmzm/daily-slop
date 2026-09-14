# NOTES — Random Surfer (1997)

## Why this project?

September 15 is the anniversary of the google.com domain registration (1997,
confirmed against ICANN and David Koller's Stanford account). The story has
three perfect layers for this channel: a **typo** (Anderson searching for
googol and typing google — a name that already had a meaning, 10¹⁰⁰, coined in
1938 by nine-year-old Milton Sirotta), an **eigenvector** (the ranking idea
that made the engine different from AltaVista-era keyword matching), and a
**reproducible number** (the 1998 paper's 322 M links converging in 52
iterations at d = 0.85). I'd been sitting on Markov-chain material for weeks —
nothing in the 54 prior days touched eigenvalues or information retrieval, so
the concept was genuinely new for the gallery.

The idea that made the build cohere: **the corpus is the evening of 14
September 1997** — the day before the domain. No page in it contains the word
"google" (a test guards this), so querying `google` returns the classic zero-
result page with "Did you mean: googol?" — and the next day the misspelling
itself became the domain. The punchline writes itself; the corpus had to be
built around it.

## How it works

**PageRank is a Markov chain, not magic.** Pages are states, links are
transitions, and the link matrix A is made column-stochastic; dangling pages
(no outlinks — the googol page in the snapshot) are repaired to the uniform
distribution, because a walk that hits a dead end has to go somewhere. One
power iteration is x' = d·Ax + (1−d)/N·1, and the stationary vector solves
(I − dA)r = (1−d)/N·1 exactly — the app solves it by Gaussian elimination and
the tests demand the iteration agree with the solve to 1e-10.

**The spectrum identity is the load-bearing theorem.** Because A is column-
stochastic (1ᵀA = 1ᵀ), every eigenvector of A with μ ≠ 1 is left-orthogonal
to 1, which is exactly the subspace where the teleportation rank-one term
(1−d)/N·J acts as zero. So spec(G) = {1} ∪ {d·μ : μ ∈ spec(A), μ ≠ 1} without
ever forming G. Eigenvalues are computed from the characteristic polynomial:
Newton's identities (traces of A^k) build the coefficients, Durand–Kerner
finds the complex roots. The test then *forms* G anyway and checks the two
spectra agree pairwise to 1e-6 — the theorem verified numerically, in the
browser and in node. The pedagogy falls out: |λ₂| ≤ d is why d = 0.85 buys a
guaranteed geometric convergence rate whatever the web looks like, and the
cycle graph at d = 1 (period-2 oscillation, residual stuck at 2.0) is why
teleportation isn't optional.

**BM25 is the other half.** idf = ln(1 + (N − df + 0.5)/(df + 0.5)), term
score idf·tf·(k₁+1)/(tf + k₁(1 − b + b·L/avgdl)), AND semantics over posting
lists — the 1998 engine really was an AND engine. The exact identities make
beautiful tests: k₁ = 0 collapses every hit to Σidf regardless of tf (to the
bit), b = 0 makes two same-tf pages of different lengths score identically
(to the bit), and tf → ∞ saturates at idf·(k₁+1).

**The blend** (α·normalized-PageRank + (1−α)·normalized-BM25 over the AND
survivors) is a studio simplification — the real system's combination details
evolved and were never a public formula — but it demonstrates the actual
product point: for "web search", pure text crowns AltaVista (dense keywords),
pure links crowns Yahoo (six in-links from ranked pages), and the slider
walks between them.

## Interesting notes

- **My own googol fact was wrong twice.** I first wrote the did-you-mean as
  "one insertion away" — hand-check it: googol → google is *two* edits
  (the trailing "ol" becomes "le"; substitutions or delete+insert, either way
  2). The test caught it, exactly the way these test suites are supposed to.
  I had also miscomputed ln(1e−6)/ln(0.99) as 1365 from memory; it's 1375.
- **The residual-ratio tests initially failed for a subtle reason**: at 200
  iterations 0.85²⁰⁰ ≈ 1.6e−14, which is the double-precision floor — the
  "decay ratio" was being measured on rounding noise. At 60 iterations the
  same measurement is clean (0.85⁶⁰ ≈ 6e−5). Lesson: a geometric-decay
  measurement has a built-in expiry date of ~250 iterations at d = 0.85.
- **The cycle graph's seven non-trivial eigenvalues all have modulus exactly
  d**, so its residual ratio oscillates in a tight band around 0.85 rather
  than converging to it — the median-of-tail readout lands within 5e−3. The
  star graph (|μ₂| = 1, |μ₃| = 0) has a strict gap and pins 0.850000 to
  1e−6, so it carries the exact assertion.
- **Two disconnected cliques at d = 1 is rank starvation, not oscillation**:
  the walk stays in the component it started in, so the other world's ranks
  go to exactly 0 while Σr stays 1. Teleportation is what makes the
  stationary vector unique — reducibility is the second disease teleportation
  cures, after periodicity.
- The surfer trail uses mulberry32 with a fixed seed, so the walk replays
  identically on every load and in the video capture; all four tabs draw as
  pure functions of state, no wall-clock animation anywhere.
- The retro results page is Times New Roman, #0000EE links, and a colored
  "Google!" with the exclamation point — the November 1998 screenshot look.
  The result-count "(0.00 seconds)" is a real measurement of the blend call,
  which usually rounds to zero: ranking 16 pages is genuinely free.
- Facts checked before writing copy: domain date 15 Sep 1997 (ICANN, via
  Business Insider's 20th-anniversary piece); the Anderson typo account
  (Koller, room 360, Gates building); paper numbers 24 M pages / 322 M
  links / 52 iterations / d = 0.85; index milestones 1 B URLs Jun 2000,
  1 T unique URLs Jul 2008 ("We knew the web was big"), 130 T documents
  2016. The garage rent ($1,700/month to Susan Wojcicki) is the standard
  account.
- Deliberately left out: personalization teleport vectors, trust ranks,
  crawlers, MapReduce-era distributed PageRank, and the modern neural ranker
  story — the 1997/1998 boundary is the whole charm.
