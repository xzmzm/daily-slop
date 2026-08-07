# NOTES — cattery

## Why this project?

Today is **International Cat Day** (August 8). I went looking for the hook, and
the thing that grabbed me was a genetics fact I'd half-known but never felt:
**tortoiseshell cats are almost always female, and the reason is pure
chromosome accounting.** The orange-pigment gene lives on the X chromosome.
A tortie needs one X that says "make orange" and another that says "don't" —
so it needs two X chromosomes. Males (XY) have only one. That's the whole
story, and it's the kind of claim that's far more convincing *shown* than
*told*: breed two cats, generate a litter, and watch every tortoiseshell
kitten come out female, every time, because the math forbids the alternative.

This also filled a real gap in the backlog. Fifteen days in, the projects
leaned hard on *physics and sky* (solar geometry, orbital ratios, meteor
rates, reaction–diffusion, raycasting) and a couple of *social systems*
(ballot-lab's voting paradoxes). Nothing had touched **biology**, and
nothing had touched **genetics** — which is the original "correctness is
arithmetic" domain. A Punnett square either sums to 1 or it doesn't; a
tortie male either appears or (in this case) cannot. That made it a natural
fit for the verifiable-engine pattern ballot-lab and nightmark established.

## How it works

The project splits cleanly into a **pure genetics engine** (`engine.js`,
Node-testable, no DOM) and a **visual layer** (`app.js`, the canvas renderer).

### The genotype model

Each cat is a genotype object with a sex and seven biallelic loci:

```
{ sex, O:[…], B:[…], A:[…], D:[…], S:[…], W:[…], L:[…] }
```

Six are autosomal (mother and father each contribute one allele per locus).
**Orange (O) is X-linked**: females carry two O-alleles, males carry one.
Sons inherit their only X from their mother; daughters get one X from each
parent. That single asymmetry is the engine of every interesting result here.

### The core functions

- **`mate(mother, father, rng)`** — meiosis + fertilisation. The egg carries
  one of the mother's X's plus one autosomal allele per locus. The sperm
  carries *either* the father's X (→ daughter) *or* a Y (→ son), each 50%,
  plus autosomal alleles. Recombine and you have a kitten.
- **`phenotype(geno)`** — resolves a genotype into a structured, renderable
  coat description. The resolution order matters and mirrors real biology:
  1. **Dominant white (W_) is epistatic** — checked first; if present, the
     cat is all white and every other locus is masked.
  2. **Orange state** from the X(s): male X^O → orange; female X^O X^O →
     orange, X^o X^o → non-orange, X^O X^o → **tortie** (mosaic).
  3. **Eumelanin shade** from B (black/chocolate), faded by dd (dilution).
  4. **Tabby** from A (agouti banding visible), with the real-world quirk
     that orange cats show tabby even when aa (O incompletely suppresses
     agouti).
  5. **White spotting** from S (bicolor / high-white).
- **`expectedRatios(mother, father)`** — the analytic answer. It expands the
  full joint genotype distribution (cartesian product of every locus's
  2×2, times the X-linked orange outcomes), runs each through `phenotype`,
  and aggregates by phenotype key. The probabilities always sum to exactly 1.
- **`punnettOrange(mother, father)`** — the headline visual: the 2×2 with
  daughters in one row (father's X) and sons in the other (father's Y).

### The renderer

`drawCat(ctx, W, H, geno, pheno, seed)` draws a front-facing sitting cat from
its phenotype. The trick is that the silhouette is traced once into a path,
**filled with the base colour, then used as a clip** for all the coat detail:

- **Tortie patches** — 5–8 organic blobs, each built from 3–5 overlapping
  circles with jittered centres, giving the irregular mosaic boundary that
  real torties have (not a clean grid). The blob placement is seeded by the
  genotype string, so the *same cat always renders the same way* — but two
  genetically identical cats differ, just like real clones (because X-
  inactivation is random per-individual in reality; the seed stands in for
  that developmental randomness).
- **Tabby stripes** — mackerel verticals on the body, the "M" on the
  forehead, cheek stripes. Drawn translucent-dark so they sit correctly
  over both eumelanin and orange regions in a tortie.
- **White spotting** — bicolor draws the classic muzzle/blaze/chest/belly/
  socks pattern; high-white ("van") covers the body leaving colour only on
  the head crown and tail.
- **Face** — vertical-slit pupils (cats, not round), a pink nose triangle,
  pink ear interiors, whiskers. Eyes go blue when the cat is dominant-white
  (the real W allele is pleiotropic with deafness and blue irises).

The whole thing is deterministic per-genotype except for a seeded RNG, so a
given kitten looks the same on every render — important for the gallery
screenshot and for the "this is *that* cat" feeling.

## Interesting notes

**The "almost always" in "tortoiseshells are almost always female" is doing
real work.** Male torties *do* exist — about 1 in 3000 — and they're almost
always XXY (Klinefelter syndrome in cats): they have two X chromosomes to
hold O and o, plus a Y to make them male. My biallelic model can't express
XXY (sex is a binary `F`/`M`, and males carry exactly one X), so my engine
produces *zero* tortie males across 4000 kittens, which is the test
`tortieMales.length === 0`. That's correct for the model and a fine
approximation of reality, but the NOTES have to be honest that real male
torties exist via a chromosome-number anomaly the model deliberately omits.
Left this out of scope: sex-chromosome aneuploidies aren't Mendelian.

**Codominance vs incomplete dominance — a terminology trap I hit.** I
modelled the S (white spotting) locus as **incomplete dominance**: ss = no
white, Ss = bicolor (intermediate), SS = high-white. The expected-ratios
test for `Ss × Ss → 1 SS : 2 Ss : 1 ss` passes. But when I verified against
the primary source (Wikipedia's *Cat coat genetics*), it calls S
**codominant** with variable expression. The two terms are easily conflated:
both produce a heterozygote *intermediate* between the two homozygotes. The
technical distinction is whether the heterozygote *expresses both parental
phenotypes simultaneously* (codominance, like AB blood) versus *a blended
new phenotype* (incomplete dominance, like pink snapdragons). White spotting
is genuinely variable and the literature uses both words; for a simplified
biallelic model where Ss is a quantitatively-intermediate spot amount,
"incomplete dominance" is the more defensible label, so that's what the
locus card says — but I flagged the ambiguity rather than pretending it's
settled. The cheat-sheet card could just as honestly read "codominant."

**The expected-vs-actual marker was invisible in the first screenshot.**
My first ratio bar had the expected fill plus a 2px white right-border
representing the actual litter's position. On the gallery thumbnail (small,
dark background) that 2px line was below the threshold the vision check
could see — the reviewer reported "no actual marker visible." Reworked it
into an explicit `▲` tick above the bar plus a `count/total` readout
(`3/12`) with the expected percentage as a sub-label. The pedagogy is
"expected vs actual" and that has to be *legible*, not just present. This is
the same class of fix ballot-lab needed when its percentage labels were
displaying meaningless Borda "119%".

**The picker modal was invisibly covering the whole page on first load.**
`.modal-backdrop` is `display: flex`, and the HTML `hidden` attribute's UA
style is `display: none` — but an explicit `display: flex` on the element
*overrides* the UA `hidden` style (specificity). So `hidden` did nothing and
the empty picker backdrop intercepted every click on the mate button, which
timed out on "actionability (covered by…)". The fix is one CSS rule:
`.modal-backdrop[hidden] { display: none !important; }`. This is a classic
CSS footgun — `hidden` only works if nothing sets `display` on the same
element. Took three failed click attempts and a DOM inspection to spot it,
because the backdrop is transparent until it has content.

**Why orange cats show tabby even when solid (aa).** Real genetics: the
agouti gene (A) switches on banding of individual hairs, which is what makes
tabby *stripes* visible against a ticked background. A non-agouti (aa) cat
should be solid — and black aa cats are. But orange cats are almost always
visibly tabby even when aa, because the orange allele (O) doesn't fully
suppress agouti-band expression. My `tabbyShows()` bakes this in: eumelanin
respects aa (solid black), but orange always renders tabby. It's a small
detail but it's why every orange cat you've ever seen had faint stripes —
and omitting it would make the orange kittens look wrong.

**X-inactivation is the *real* mechanism behind the tortie mosaic, and the
renderer fakes it.** A female X^O X^o cat doesn't have "orange cells" and
"black cells" mixed at the skin — early in development, each cell randomly
inactivates one X (Barr body formation). The cell and all its descendants
then express only the *other* X. So a patch of orange fur is a clone of one
cell that picked the orange X; a black patch is a clone of one that picked
the non-orange X. That's why the patches are irregular clonal islands, not
a fine speckle — and why the two X-linked-orange tortie twins don't have
identical patterns: the inactivation rolls were different. My renderer
seeds the blob RNG with the genotype string, which mimics "one
developmental dice roll per individual" without modelling the actual
clonal-expansion biology. A true Lyonisation simulator (grow patches from
random seed cells via cell-division + drift) would be the genuine follow-up.

**Verification.** 52 engine assertions pass in `test_engine.js`: autosomal
Punnett squares (Bb×Bb, BB×bb, Dd×dd), the three classic orange crosses
(tortie×black, orange-male×black-female criss-cross, orange×orange), the
4000-kitten "torties are all female" sweep, dominant-white 50/50 epistasis
(both analytic and in a random litter), the four eumelanin+dilution colour
names, calico requiring tortie + spotting at ~1/8, genotype-string
formatting, the "orange father sires no orange sons" rule, and a 50/50 sex
ratio. The browser rendered correctly on load — confirmed via DOM snapshot
(parent names, phenotype labels, all seven ratio rows, the Punnett table
with X^O/X^o labels and sex tags, the explanatory note) and a vision-checked
screenshot of both the default view (tortie mother + black father) and the
mated litter (12 kittens: solid black, red tabby, tortoiseshell, all
female-tortie as the cross predicts). The IAB screenshot/click channel was
flaky this session — repeated actionability timeouts and empty screenshot
returns, the same class of intermittent instability ballot-lab, loom-drafter
and nightmark recorded — so interactive verification (opening the picker,
choosing a new parent) was mirrored through the engine tests and the
`?mate=1` auto-breed hook captured via headless Chrome instead.
