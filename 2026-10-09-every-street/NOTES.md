# Every Street — October 9, 2026

## Why this project?

The [UPU’s World Post Day page](https://www.upu.int/en/universal-postal-union/outreach-campaigns/world-post-day)
gave today a good excuse to make a little delivery route. October 9 is the
annual observance; the 2026 theme concerns the possibilities of one connected
postal network. I also scouted current science stories, but a whole-street
delivery puzzle felt more immediate and more playable within a small build.

The existing projects include balloon airmail, traffic equilibrium, and a
random surfer. This has a different question: every *street* needs service,
including the awkward dead ends, and the walker must return home. There are
no competing drivers, random visitors, or wind to steer. I wanted the user
to notice an unavoidable return trip before being told a theorem.

The [NIST definition of the Chinese postman problem](https://xlinux.nist.gov/dads/HTML/chinesePostman.html)
is the mathematical reference. The app uses its undirected, positive-weight,
closed-walk version. The maps and illustrations are original fictional districts.

## How it works

A map is a list of junctions and weighted, two-way street edges. Every move
must follow an existing edge. Counting edge visits gives both delivery
coverage and retracing: the first visit delivers that street, and every later
visit adds the full street length to the extra-distance counter.

The shortest route has three pieces:

1. Find junctions with odd degree. For each of these, Dijkstra’s algorithm
   computes the shortest paths to the other odd junctions.
2. Try every pairing of those junctions with a memoized bitmask recurrence.
   Pair the first remaining junction with each possible partner, solve the
   remainder, and retain the cheapest total. With at most six odd junctions
   in these maps, this is tiny. The implementation explicitly limits inputs
   to 16 odd junctions; it is not intended as a city-scale optimizer.
3. Duplicate each street on the selected pairing paths. All degrees are now
   even. Hierholzer’s algorithm follows and splices edge circuits, using a
   distinct identity for each copy, to produce the final closed walk.

The repeated paths are the cheapest parity correction, so their cost plus
the total original street length is a global optimum. Multiple different
walks may share that optimum. The side panel shows one answer, not a unique
official sequence that a player must imitate.

## Interesting notes

- The market contains 1,290 m of streets but needs a 1,680 m round. The
  optimal pairing is B–E–D (180 m) and F–I–H (210 m). Going around the bottom
  corner wins for the latter pair; pairing through the central square costs
  ten meters more. This is why visual proximity is not a safe shortcut.
- The canal is an 840 m simple cycle. It demonstrates the zero-retracing case
  without changing the rules. Garden ends has four dead ends, one reached
  by a two-street branch; 580 of its 1,560 m optimum is retracing.
- A second, independent solver in the tests searches all combinations of
  current location and covered-street bitmask. It agrees with the production
  solver on all three maps. This checks the optimality claim rather than
  merely checking that the displayed route follows itself.
- An early screenshot caught the envelope partway through its initial CSS
  transition from the SVG origin. Map initialization now places it before
  enabling transitions. Phone screenshots also exposed illegible scaled-down
  labels; those have separate larger SVG text and touch-target sizes.
- The route demonstration keeps a copy of the player’s walk. Changing maps
  cancels its interval, and returning to play restores the previous attempt.
  Pausing and resuming is checked with a controlled browser clock.
- Deliberately left out: map editing, street closures, scoring persistence,
  turn penalties, and a traveling-salesperson mode. One bag of letters is
  enough for today.

## Video

The walkthrough shows a deliberate out-and-back, the four odd market
junctions, the 1,680 m optimum, the clean canal loop, and the garden dead ends.
The shared Fish renderer now defaults to voice ID
`95d2e56952b446189d6160a821a08707`, as requested on this build. The spoken
opening names GPT-6 Astra as “GPT 六 Astra”.
