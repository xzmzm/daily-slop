# ballot-lab

Built by GLM-5.2

One hundred voters rank three candidates. Six real election systems count the
**same** ballots. Three of them report a different winner — and none of the
systems are buggy. That's the whole point.

**ballot-lab** is an interactive lab for *social choice theory*: the study of
how a group's individual preferences get aggregated into a single collective
decision, and why the rule you pick matters more than the votes themselves.

## What you can do

- **Watch the same ballots get counted six ways** — Plurality, Top-2 Runoff,
  Instant-Runoff (RCV), Borda, Condorcet, and Approval — each with a live
  per-round tally and a one-line explainer of where it's actually used.
- **Cycle four hand-tuned preset elections**, each engineered to expose a
  specific failure mode:
  - *The 2026 town race* — the plurality winner is the Condorcet **loser**;
    the Condorcet winner is eliminated first under IRV.
  - *Center squeeze* — the broadly acceptable compromise is approved by
    everyone but has too few first-choice votes to survive IRV.
  - *Condorcet cycle* — A beats B beats C beats A. The group is collectively
    intransitive, even though every voter is perfectly rational.
  - *Spoiler* — a third candidate splits a bloc and hands plurality to an
    opponent a majority actually opposes.
- **Edit any ballot live** — change a voter count, click a rank cell to cycle
    which candidate sits there, toggle approval dots per candidate. Every
    method's tally, the head-to-head matrix, and the verdict update instantly.
- **Read the head-to-head matrix** — who beats whom, straight from the
  rankings, with the Condorcet winner and loser flagged.
- **Read the verdict** — a running narrative that names the specific paradox
  the current ballots trigger.

## The core idea

The question *"who won this election?"* has no answer until you've chosen a
**counting rule**. The ballots are the input; the winner is a *function of the
rule*, not of the votes. Arrow's impossibility theorem (1951) proves no ranked
system can satisfy a short list of fairness criteria simultaneously — so the
disagreements between methods aren't bugs, they're mathematically unavoidable.

## How to run

No build step, no dependencies:

```
python3 -m http.server
```

then open <http://localhost:8000/2026-08-06-ballot-lab/>.

## The six methods at a glance

| Method | Counts | Used in |
| --- | --- | --- |
| Plurality | first-choice votes only | USA, UK, Canada, India |
| Top-2 Runoff | plurality, then top two fight a final round | France (president), Georgia |
| Instant-Runoff (IRV/RCV) | eliminate last place, transfer votes, repeat | Australia, Ireland, Alaska, NYC |
| Borda | rank = points (N−1 … 0) | Slovenia, Eurovision |
| Condorcet | pairwise head-to-head winner | the gold standard (rarely used directly) |
| Approval | mark all you accept | IEEE, Dartmouth alumni, pirates |
