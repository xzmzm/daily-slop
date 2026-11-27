# Build notes

## Why this project?

Mariner 4 launched on 28 November 1964 and made the first close flyby of Mars the following July. After launch it had trouble with the star it steered by. Its Canopus sensor locked onto other things first, including stray light from the nearby Earth. It took more than a day of commanded "star hops" to get onto Canopus. Later, flecks of dust and paint drifting with the spacecraft kept knocking the lock off. The midcourse burn planned for 4 December was flown on 5 December. Contemporary reports say part of the fix was disabling the brightness gate, which had made the sensor start a new search whenever the signal went much brighter or dimmer than Canopus. Sources disagree on the details: Time talks about a wrong star held for days, and later accounts blame Earth-shine protection logic. I built the toy around the part they agree on. A sensor that measures nothing but brightness has to be told which bright thing to believe.

Other candidates for the date were the Grand Ole Opry's first broadcast (1925) and Magellan entering the Pacific (1520). I picked Mariner 4 because it reduces to a small control problem with one real trade-off.

## How it works

- **Geometry.** A sun-pointed spacecraft can only roll about the Sun line, so its sensor sweeps a fixed cone around the Sun. Each star gets a *cone angle* (angle from the Sun) and a *clock angle* (where it sits around the Sun line, measured from the projection of celestial north). The sensor cone is set to Canopus's cone angle, about 101° for the Sun of 30 Nov 1964 (RA 245.6°, Dec −21.6°). The catalog is about 60 bright stars with J2000 coordinates, and I ignored 1964 precession because it is only about half a degree.
- **The ring.** Stars within ±13° of that cone fall in the sensor's band. That gives 11 stars, and Canopus is the brightest by far. The next brightest is Achernar at 0.33× Canopus. Sirius is close on the sky but sits about 30° off the cone.
- **Signal.** Each star adds `10^(−0.4(m − m_Canopus))` times a parabolic slit response (±2.5° in roll). Earth-shine is a 28°-wide patch whose brightness falls off as `2.2 / (1 + day/0.6)²`. Dust events are seeded random spikes of 0.7–9× Canopus, each lasting about 17 minutes. A spike counts only while the slit is holding still.
- **Search.** The spacecraft rolls 360° in 72 minutes and stops on the first target whose brightness passes the gate. A roll override, or a lost lock, marks the current object to skip until the slit has moved 3° away.
- **Burn rule.** At the due time the lock must be on Canopus and unbroken for 0.4 days. If it isn't, the burn slips one day, and the third miss ends the run.

The four gate settings each fail differently with the default seed:

| Strategy | What happens |
| --- | --- |
| Normal gate, hands off | Earth-shine → Canopus, then dust trips the lock 7 times and the burn misses three windows |
| Normal, then **off** after Canopus | Burn fires on schedule on 4 Dec. This is the historical fix. |
| Off from the start | Holds Earth-shine for 3 days, then settles on Deneb |
| Wide (1/8–8×) | Earth-shine fades to 0.12×, and the sensor settles on Deneb |

## Interesting notes

- The first version of the search stopped only on targets more than 0.5° ahead, to avoid relocking the star it had just left. The search moves 2.88° per substep, which divides 360° almost exactly, so on every revolution the slit landed inside that 0.5° blind spot just before Canopus and skipped it. The sensor rolled forever. The fix was to skip by name (the object being left) rather than by angle.
- After that fix, a drop caused by noise near the gate edge produced hundreds of lock/unlock cycles a minute on the fading Earth-shine. The skip-by-name rule also stops that, because the sensor has to roll away before it can come back.
- At first a dust fleck also counted during the search roll, and it painted a fake 5× plateau across the roll map. Now flecks only count while the slit is holding still.
- With the gate off and enough roll overrides you can still walk round the ring to Canopus, but that takes 9 hops past dim stars and Earth-shine. The test checks that it works.
- Gate widths, the 13° band, Earth-shine and dust are all made up. They are tuned so the story's shape comes through. They are not measured Mariner 4 numbers.

Sources: [Mariner 4 (Wikipedia)](https://en.wikipedia.org/wiki/Mariner_4), [Caltech, "Alone in the Darkness"](https://www.caltech.edu/about/news/alone-darkness-mariner-4-mars-50-years-later-47324), [Time, 1965](https://content.time.com/time/subscriber/article/0,33009,841905-3,00.html).
