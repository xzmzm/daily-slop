# NOTES — ballot-lab

## Why this project?

Two weeks in, the backlog leaned hard on *physics and sky*: solar geometry,
orbital ratios, meteor rates, reaction-diffusion, raycasting, fluid fizz. The
closest thing to a "systems" project was Feynman's-menu (a stopping-rule game)
and nothing had touched **social systems** — how groups decide things. Election
season is permanently in the air, so I went looking for a hook there.

The thing that grabbed me was a fact I'd half-known but never *felt*: **the
same ranked ballots elect different winners depending only on the counting
rule.** Not because of fraud, not because of a bug — because "who won?" is
genuinely undefined until you specify the function from ballots to winner.
That's Arrow's impossibility theorem in one sentence, and it's the kind of
claim that's much more convincing *shown* than *told*. So the whole project
became: take one fixed set of ballots, run every real voting system on them,
and let the disagreement speak for itself.

It's also the opposite of the generative-art projects here. There, you tweak
parameters until it looks nice; correctness is aesthetic. Here, correctness is
arithmetic: if my IRV says the winner is A and the hand-count says B, I have a
bug, full stop. That made the verification unusually satisfying.

## How it works

The data model is tiny. Each ballot is `{ count, ranking, approve }`:

- `ranking[i]` = the candidate index at rank `i` (rank 0 = first choice)
- `approve[c]` = whether that voter marks candidate `c` as acceptable

The six methods are pure functions of `(ballots, allCandidates)`. Each returns
a `winner`, a list of `rounds` (each round a tally + eliminations + elected),
and a `unit` saying what the tally numbers mean. Then a single `renderResults`
loop draws a card per method.

The key algorithms:

- **Plurality** — count first choices. One round.
- **Top-2 Runoff** — round 1 is first choices; keep the top two; round 2 is a
  head-to-head where each full ballot goes to whichever of the two it ranks
  higher.
- **IRV** — loop: count first choices among active candidates; if someone
  clears 50%, done; else eliminate the last-place candidate and repeat, with
  eliminated ballots flowing to their next *still-active* choice.
- **Borda** — rank `i` earns `N-1-i` points, times the ballot's count.
- **Condorcet** — build the pairwise matrix `m[a][b]` = voters ranking `a`
  over `b`; a candidate who beats every other head-to-head is the winner. The
  displayed "tally" is each candidate's *number of pairwise wins*, which is a
  clean way to rank them when no Condorcet winner exists.
- **Approval** — sum the `approve[c]` flags across all voters.

The **head-to-head matrix** is just `pairwise()` rendered as a grid: cell
`[a][b]` is how many voters rank `a` over `b`. The Condorcet winner's row is
all-green (beats everyone); the loser's row is all-red.

The **verdict** story panel is a rule cascade: it counts distinct winners, then
emits specific callouts when the data triggers them — *"the plurality winner
is the Condorcet loser"*, *"IRV eliminated the Condorcet winner in an early
round (center squeeze)"*, *"Borda disagrees with plurality"*. Each callout is
fired by a real check against the computed results, not hardcoded per preset.

## Interesting notes

**Designing an election that fails in the right way is the actual work.** You
can't just type random ballots and expect a paradox — most random elections
are won by the same candidate under every system, which is boring. The
"textbook race" preset took four attempts in a Python scratch file before it
had all three properties I wanted: plurality winner ≠ Condorcet winner,
plurality winner *is* the Condorcet loser, and the Condorcet winner gets
eliminated first under IRV. Each property requires a specific structural
tension in the ballots (a polarised front-runner with broad opposition, a
compromise candidate with shallow first-choice support). I hand-verified every
number in Python *before* writing a line of JS, because debugging a paradox
that was never there is a time sink.

**The approval UI I shipped first was wrong.** I initially rendered one
approval toggle per ballot row, toggling the *top-ranked* candidate only. But
approval voting is per-candidate, and my presets deliberately approve
non-top candidates (the center-squeeze preset has everyone approving B as
their *second* choice — that's the whole point). A single dot per row was
literally incapable of representing the data. Reworked the Approve cell to
render one labeled dot per candidate, so a voter can mark A and B acceptable
while leaving C blank. This also fixed the approval tallies, which had been
silently undercounting.

**The percentage lie.** My first renderer divided every tally by the voter
count and appended a percentage. For Plurality (43/100 = 43%) that's correct.
For Borda it printed `119/100 (119%)` — meaningless, because Borda points
aren't bounded by the voter count. For Condorcet it printed `2/100 (2%)` —
also meaningless, since "2 wins" is a count of opponents beaten, not a share
of the electorate. Added a `unit` field to each method result (`"votes"`,
`"points"`, `"wins"`, `"approvals"`) and only voter-share methods get a
percentage; the others show their unit label. Small fix, but the alternative
was a UI that confidently displayed nonsense.

**The center-squeeze blurb was lying.** My first draft said "the compromise
candidate *leads* on first prefs but is eliminated early." The designed preset
had B with the *fewest* first prefs (18) — that's literally why IRV eliminates
them. The sentence described a different paradox than the numbers showed.
Rewrote the blurb to match the actual structure: B is broadly approved (the
Condorcet winner, approved by all 100) but has shallow first-choice support,
so plurality never sees them and IRV cuts them in round one. The fix was to
stop writing the blurb from memory and start writing it from the tally.

**Cycle detection is just "no row is all-green."** A Condorcet cycle
(A>B>C>A) means no candidate beats everyone. The code doesn't special-case
cycles — `countCondorcet` returns `winner: null`, and the UI shows "no winner
(cycle)" with a distinct ↻ icon. The verdict panel's "no Condorcet winner —
the preferences contain a cycle" line fires off the same null check. The
interesting part is that *every individual ballot is a strict, rational
ranking*, yet the group is collectively intransitive. That's the
philosophically unsettling bit, and it falls out for free from the pairwise
matrix.

**Left out of scope:** weighted spatial models of voters (the political
science way to *generate* realistic elections rather than hand-tune them),
Smith set / Schwartz set computation for ranking candidates when there's no
Condorcet winner, monotonicity-failure demonstrations (where *ranking a
candidate higher* can actually cause them to *lose* under IRV — a real and
spooky pathology), and a "build your own paradox" solver that searches ballot
space for configurations maximizing disagreement between methods. That last
one is the genuinely interesting follow-up.

**Verification.** All 24 method×preset winner combinations (6 methods × 4
presets) are asserted against hand-computed expected values in a Node script,
and pass. Live-edit mutations (changing counts, toggling approvals, adding
ballots) were checked the same way. The browser itself rendered every number
correctly on first load after the unit fix — confirmed via DOM snapshot
reading back all six method cards. The IAB click/screenshot path was flaky this
session (repeated broker id-mismatches and click timeouts, the same class of
intermittent instability the loom-drafter NOTES recorded), so interactive
verification was mirrored in Node against the exact preset data rather than
trusted to the browser's synthetic clicks.
