# Random Surfer (1997) — the day googol became google

A link-ranking studio for the 29th anniversary of the google.com domain
registration — the googol typo of 15 Sep 1997, the eigenvector that ranked
the web, and a 16-page snapshot of the day before. Sean Anderson sat at a
terminal in room 360 of Stanford's Gates building, checked whether googol.com
was free, and typed google.com instead; Larry Page liked the misspelling
enough to register it within hours. This studio rebuilds both halves of that
engine — the random surfer and the inverted index — on the web as it looked
the day before the domain existed.

Built by GLM-5.3

## The four machines

1. **The random surfer** — the 16-page link graph as a Markov chain. Click two
   nodes to add or remove a link, step or run the power iteration, and watch
   ranks converge live: residual shrinking by the decay ratio, Σr pinned at 1,
   and a seeded surfer walking the arrows (teleporting 15% of the time).
   The googol page dangles — no outlinks — so its column leaks and gets
   repaired to the uniform spread.
2. **Why 0.85** — the damping knob. The residual decays at |λ₂(G)| = d·|μ₂(A)|:
   run the cycle graph at d = 1 and the iteration oscillates forever; split
   the graph into two disconnected cliques and one world starves at rank zero.
   The spectrum card proves spec(G) = {1} ∪ {d·μ : μ ∈ spec(A), μ ≠ 1} against
   eigenvalues computed from the characteristic polynomial (Newton's
   identities + Durand–Kerner). The paper's anchor: 322 million links
   converged in 52 iterations, and 0.85⁵² = 2.14×10⁻⁴.
3. **The inverted index** — the half the surfer never sees. Type a query, watch
   AND intersection cut the posting lists, then BM25 re-rank the survivors with
   live k₁ (saturation) and b (length normalization) sliders. `google` matches
   nothing in the snapshot — the nearest index word is `googol`, two edits
   away (Levenshtein; googol's "ol" shuffled to "le").
4. **The first results page** — a 1998-style results page blending authority ×
   relevance. α = 0 is pure text (the fan page out-talks everyone); α = 1 is
   pure links (Yahoo collects the votes). The timeline runs from BackRub in
   1996 to 130 trillion documents in 2016.

## How to run

```
open index.html
```

or

```
python3 -m http.server 8765        # from the repo root
```

then visit <http://localhost:8765/2026-09-15-random-surfer/>.

## Tests

```
node test_pagerank.mjs
```

61 exact-formula checks: the Σr = 1 invariant to 1e-12, power iteration against
the direct solve of (I − dA)r = (1−d)/N·1 to 1e-10, the star-graph closed form
y = (1+dk)/((k+1)(1+d)), the spectrum identity for formed G, the d = 1
oscillation and rank-starvation cases, BM25's exact identities (k₁ = 0 kills
term frequency, b = 0 kills length normalization, tf → ∞ saturates at
idf·(k₁+1)), the AND intersection, the lev(google, googol) = 2 did-you-mean,
and the blend's pure-text/pure-links disagreement (AltaVista vs Yahoo).

## Video

`video/random-surfer.mp4` — the Chinese walkthrough with burned-in subtitles
(Fish Audio, 哈基米 voice), plus its `.srt`.

## Sources

- google.com registered 15 Sep 1997 (ICANN; D. Koller, *Origin of the name
  "Google"*, Stanford).
- Brin & Page, *The Anatomy of a Large-Scale Hypertextual Web Search Engine*,
  WWW7 / Computer Networks 30 (1998): 24 M pages, 322 M links, 52 iterations,
  d = 0.85.
- Google index milestones: 1 B URLs (Jun 2000), 1 T unique URLs (Jul 2008
  blog "We knew the web was big"), 130 T documents (How Search Works, 2016).
