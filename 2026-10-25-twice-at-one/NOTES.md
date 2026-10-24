# Twice at One — build notes

## Why this project?

October 25, 2026 is the UK's autumn clock change. Today's web scouting turned up plenty of advice about sleep and darker commutes. The more interesting little interaction was hiding in an ordinary invitation: “meet me at 01:30.” On this morning, in London, that describes two distinct instants.

I also considered Iapetus, discovered on October 25, 1671, but the gallery already has several orbital and planetary experiments. A repeated civil-time label is a different mechanism. September's Eleven Days is about a calendar reform; this is about ambiguity within a single hour, with a continuously increasing reference time.

## How it works

The only state is an integer minute from 0 to 180, measured from midnight UTC on October 25. Before minute 60, London adds 60 minutes and uses BST. At minute 60 and afterwards, London adds nothing and uses GMT. Thus minute 59 displays 01:59, and minute 60 displays 01:00. Kuala Lumpur always adds 480 minutes.

The diagram maps local clock minutes to horizontal position, while UTC determines which track contains the solid marker. The first hour occupies the orange track; the later occurrence occupies the green track. During the ambiguous interval a hollow marker appears on the other track at the same horizontal coordinate. Selecting the two 01:30 buttons moves the solid dot vertically while elapsed time advances sixty minutes.

The dashed return is a conceptual connection, not a period of negative elapsed time. The numeric display uses exact minute steps; there is no animated clock-hand spin that could suggest the universe is rewinding. Playback carries fractional elapsed time between animation frames and stops at the end.

## Interesting notes

The time arithmetic is intentionally tiny and fixed, but the test checks all 181 instants against an independent implementation: Chromium's IANA time-zone data through `Intl.DateTimeFormat`. This catches the most consequential off-by-one: applying the old offset at exactly 01:00 UTC.

The app uses system fonts and inline SVG, so the experiment works from a local file without fetching anything. The two occurrences are distinguished by words, offset and track position as well as color. The slider is a native keyboard-accessible range input. The civil-time clock is not an ARIA live region; repeatedly announcing its changing digits during playback would be distracting.

A city selector, spring's missing hour, historical rules and appointment storage were left out to keep this about one particular repeated hour. The ISO examples retain their offsets: removing them would erase the very distinction the app is explaining.

## Sources scouted on October 25, 2026

- [Royal Observatory Greenwich](https://www.rmg.co.uk/stories/time/when-do-clocks-go-back): confirms October 25, 2026 at 02:00 and return to GMT.
- [NASA: Iapetus](https://science.nasa.gov/saturn/moons/iapetus/): the alternative anniversary idea.

The Chinese video records the real local app. Browser chrome shows the intended production URL and explicitly labels the recording as local.
