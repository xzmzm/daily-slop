# Station Break — notes

## Why this project?

On 30 October 1938, the night before Halloween, the Mercury Theatre on the
Air broadcast Orson Welles's version of *The War of the Worlds* on CBS. The
first two-thirds were staged as a live music broadcast interrupted by ever
more alarming news bulletins. CBS announced at 8:00 that it was a play, and
did not say so again until the station break around 8:40.

The detail that made this worth building: NBC's Chase and Sanborn Hour, with
Edgar Bergen and his dummy Charlie McCarthy, had far more listeners. When its
comedy sketch ended and a singer came on, around 8:12, some of that audience
turned the dial. They landed in the middle of a field report from a farm in
New Jersey, with no warning behind them and nearly half an hour to go before
the next one. A warning only reaches whoever is listening when it airs.

That makes a clean little scheduling puzzle: if you were CBS and could add
announcements, where would you put them? Other candidates for the date were
the 1961 Tsar Bomba test (too grim for a toy) and Snell's refraction law
(Snell died on 30 October 1626, but the gallery already has several optics
projects). Nothing in the gallery so far has been about audiences or timing.

## How it works

Time runs in minutes after 8:00. The hour has four parts: the opening
announcement and Welles's prologue (8:00–8:03), the fake live newscast
(8:03–8:40), the narrated second half, and Welles's goodnight at 8:58.

480 listeners come from a seeded random generator, in three groups:

- **Regulars** (32%) tune in at 8:00 and stay an exponential time, mean 45 min.
- **Dial-twisters** (42%) arrive at 12.4 ± 1.1 minutes, clipped to 10.5–16.
- **Drift-ins** (26%) arrive uniformly between 8:01 and 8:56.

The non-regulars stay for 4 minutes plus an exponential time with a mean of 28.

Each announcement lasts half a minute. A listener is **warned** at the first
announcement that overlaps their stay. A listener **believes** if, before
being warned, they hear `belief` minutes (default 8) of newscast. Announcement
minutes are cut out of that total. The exact crossing moment is found by
bisection, so the red part of each line starts in the right place.

**Best spot** searches a half-minute grid over the newscast: every slot for one
announcement and every pair for two. For three, it adds a third slot to the
best pair and then moves each slot in turn until nothing improves. On 480
listeners, the pair search takes about half a second.

## Interesting notes

- The result that makes the page worth having: **one** announcement at 8:17:30
  leaves 8% believing. **Three** evenly spaced, at 8:10, 8:20 and 8:30, leave
  15%. The 8:10 one airs just before the NBC crowd arrives, so it is wasted,
  and the 8:20 one comes too late for many of them at 8 minutes to belief.
- The search found 8:17:30 on its own, half a minute after the last
  dial-twister can arrive (16 minutes, from the clip). That is partly an
  artefact of the clipping: with an unclipped normal distribution, the best
  spot moves a little and never quite reaches zero NBC believers.
- My first version let the 8:40 break be dragged too. It made the newscast
  length depend on the break, so moving the break changed both the cause and
  the measurement. I fixed the break at 8:40, where the script puts it.
- The percentages are not history. The crowd sizes are invented, and research
  by Jefferson Pooley and Michael Socolow (2013), among others, shows the
  "nationwide panic" was largely built by newspapers the next morning. A
  ratings survey that night found few people tuned to CBS at all. The toy is
  about why the timing of a warning matters, not about how many people ran
  into the street.
- The on-air beats are paraphrased, not quoted. The script is still under
  copyright, and paraphrase is enough to tell you where you are.
