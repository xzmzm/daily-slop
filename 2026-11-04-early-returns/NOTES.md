# Early Returns — notes

## Why this project?

Today is the 74th anniversary of the 1952 US presidential election, the first one a computer helped call on television. The US midterms were yesterday, so election-night maps and "too early to call" banners are everywhere. On 4 November 1952 CBS borrowed a Remington Rand UNIVAC. At about 8:30 pm Eastern, with a small fraction of the vote counted, it projected 438 electoral votes for Eisenhower and 93 for Stevenson, with odds of 100 to 1. Polls had called the race close, so CBS didn't air it. After an input error, a rerun gave odds of 8 to 7 for Eisenhower, and CBS reported that. Eisenhower won 442 to 89, and late that night Charles Collingwood admitted on air that the machine had been right hours earlier.

The workspace already has *ballot-lab* (counting the same ballots six ways), but nothing about projecting a result from partial returns. The UNIVAC story contains the whole idea: the early count is a biased sample, and you correct it by comparing each place with itself.

## How it works

The table holds 48 states with their real 1952 electoral votes, a rounded 1948 Republican two-party share and a rounded 1952 one. Each state is split into ten reporting units: four city units with weight 1.6 and six rural ones with weight 0.6. City units sit 7 points more Democratic than the state, and rural ones 12.4 points more Republican, so the weighted mean stays on the table value. A seeded RNG adds ±1.5 points of noise, then each state is shifted back so its weighted shares match exactly.

Polls close at 7:30 pm in the Eastern zone, 8 pm Central, 9 pm Mountain and 10:30 pm Pacific (all in Eastern time). City units report 0.6 to 3.2 hours after closing, rural ones 1.1 to 5.5 hours.

At any moment:

- **Count so far** = Republican votes ÷ votes counted, nationally and per state.
- **Swing** for a reported unit = its 1952 share − its 1948 share. A state's swing is the vote-weighted mean of its reported units. A state with nothing in borrows the mean swing of its region (South or rest), and if the region has nothing yet it uses the national mean.
- **Projection** for a state = counted Republican votes + Σ over unreported units of `votes × (1948 share + state swing)`.
- **Odds**: 600 Monte Carlo draws. Each draw adds a shared national error `σ = sd(swings)/√n + 0.1` and a per-state error (2 points with returns, 2.5 without), both scaled by the fraction of the state still uncounted. The odds are the share of draws where Eisenhower reaches 266, printed as small-integer odds the way the teletype printed them.

At 8:30 pm 5.6 % of the vote is in, all from Eastern cities. The count says 48.1 % Eisenhower, with Stevenson leading states worth 87 electoral votes to 45. The measured swing is +5.5 points and the projection is 364 to 167, at 100 to 1.

## Interesting notes

- The projection at 8:30 (364) is well below UNIVAC's 438 and the final 442. Early returns come from the Northeast, where the 1948-to-1952 swing was small (Pennsylvania barely moved). The mountain West, which swung 15+ points, borrows that small swing until its own returns arrive. Even so, the projection never drops below 266 after 8 pm. I left the gap in instead of tuning it away, since it shows the limit of a regional fallback.
- My first odds formula used `2.2 × sd/√n + 0.4`, which only gave 13 to 2 at 8:30. That felt too cautious for a model whose projection never wavers. Tightening it to `1.0 × sd/√n + 0.1` gives 100 to 1. The odds depend a lot on that constant, so the page says the formula is invented.
- The typo took four tries. Multiplying all four Pennsylvania city units' 1948 Republican vote by ten sent the odds to 37 to 1 for *Stevenson*, far worse than the real 8 to 7. Limiting it to one precinct and trying each early state, New Jersey gives about 4 to 3 for Stevenson at 8:30, a near coin toss, and then recovers to 49 to 1 for Eisenhower by 9 pm as clean returns dilute the outlier. I couldn't hit 8 to 7 for Eisenhower exactly without inventing a gentler kind of typo, so I kept the extra zero.
- One bad precinct does so much damage because it enters the swing average with a −40 point swing while only a dozen units have reported. The standard deviation of swings at 8:30 jumps from 3.8 to 13.8 points, and the odds formula widens with it. A robust average (a median, or trimming outliers) would have shrugged it off.
- My first odds printer could produce "99 TO 10". It now picks the smallest denominator within 6 % of the true ratio, and switches to "N TO 1" above 10.
- Left out: third parties (the 1948 Dixiecrat vote makes Southern "swing" huge), the 1944 comparison Woodbury also used, turnout changes, and county-level geography.
