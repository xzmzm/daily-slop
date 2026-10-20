# Break the Line — notes

## Why this project?

Today is 21 October, the anniversary of Trafalgar (1805). Nelson's 27 ships
attacked 33 French and Spanish ships in two columns, heading almost straight
at their line instead of forming a parallel line of their own. The leading
ships, *Victory* and *Royal Sovereign*, sailed for something like half an
hour under fire before any of their own guns could bear. The Combined fleet
lost 22 ships and the British lost none, though Nelson was killed.

The interesting question is why this was a gamble at all. Two rules of
18th-century naval warfare explain it. Guns point sideways, so a ship can
only hit what is abeam. And the side downwind of the fight can always leave.
That is why line-against-line battles so often ended with no ship taken:
whoever was losing turned away downwind. Cutting the line puts your ships on
the leeward side, where the enemy would have run.

Other candidates for the date: the 1879 carbon-filament lamp (too close to
the September Pearl Street project), the 1983 redefinition of the metre by
the speed of light, and the Guggenheim's 1959 opening. Trafalgar won because
nothing in the gallery has been a tactics model, and the trade-off fits two
buttons.

## How it works

Everything is in metres and seconds on a flat sea. Wind blows from the west,
so east is downwind. The Combined line is 12 ships, 220 m apart, sailing
north at 0.3 × wind speed. The British column is 8 ships, 250 m apart.

**Speed.** A small square-rigger polar gives speed as a fraction of the wind
by angle off the wind: 0.40 abeam, 0.48 at 120°, 0.46 at 150°, 0.42 dead
downwind. A head-on approach is a dead run.

**Aim.** The column starts 1 600 m west of the line (its turn point, for the
"stay off" doctrine). It is aimed so the leader reaches the gap at the centre
of their line, allowing for how far that line will have moved north by then.

**Who can shoot.** Each ship has two broadsides. Each one fires at the
nearest enemy that is
- within 1 200 m,
- within 25° of that side's beam,
- not hidden behind one of the shooter's own ships (any friendly hull within
  40 m of the line of fire masks it).

**How much it hurts.** Fire is expected value, not dice. A broadside does
`rate × dt × 0.9·e^(−d/450) × 4` hull points per step. The Combined rate is one
broadside per three minutes, and the British rate is a multiple of that
(2× by default). If the line of fire runs within 30° of the target's keel, it
is a rake: ×3 damage but ×0.6 hit chance, because the target is narrow.
Because the model has no randomness, the same settings always produce the
same battle, which keeps the tests and the video stable.

**Ending.** At 15 hull points a ship strikes and stops. A Combined ship below
half strength turns east and runs at dead-run speed, unless a British ship is
between 20 and 500 m to its east and within 350 m north or south. Once it is
more than 1 200 m from every British ship, it has escaped.

**After the turn.** British ships that reach their turn line (x = −300 m to
windward, or x = +100 m after cutting through) steer to lie beside the nearest
Combined ship still in the line, at that same offset.

## Interesting notes

- First tuning pass: a 45° gun arc let the head-on leader shoot back at the
  far ends of the enemy line, so it only spent 11 minutes silent. A real
  carriage gun could barely be trained, so 25° is closer, and the silent
  approach became 19 minutes at 3 knots.
- After the leader cut through, its guns went quiet for the rest of the
  battle. It had turned north exactly in the gap between two enemy ships,
  and neither was within 25° of its beam. The fix was the lay-alongside
  steering. Ships of the time did exactly this: they ran up beside one
  opponent.
- The decisive-versus-indecisive split comes almost entirely from the
  leeward block, not from range or gunnery. At 2× British rate, staying 300 m
  off still wrecks the enemy; they just leave. Of 12 ships, 11 escape and 1
  is taken.
- Doctrine beats angle. A shallow 20° cut still takes 10 ships, and a head-on
  approach that then stays 300 m off still lets most get away. The angle
  mostly sets the price, which is the leader's silent minutes. Wind sets it
  too: at 6 knots the walk-in is half as long.
- The lead ship has 130 hull points instead of 100, standing in for a
  three-decker like *Victory*. With 100 it was struck in the mêlée, which
  told the wrong story about 1805.
- Left out: the second column, the Combined van turning back, the swell,
  boarding, and dismasting. The fleets are scaled down.
