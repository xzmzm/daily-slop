# October 29, 2026 — Out of Order

## Why this project?

October 29 led to UCLA's record of the first ARPANET message: the attempted LOGIN reached LO, then the receiving system crashed. I considered replaying the two-letter failure, but that would mostly be a scripted anecdote. The more useful interaction is making a receiver wait while later parts of a message are already sitting right there.

The existing collection includes remote-console relay arithmetic and a PageRank search experiment, but no packet reordering or receive buffer. This project uses the anniversary as a starting point and explicitly distinguishes its modern teaching model from 1969.

## How it works

Split at most 36 Unicode code points into up to six balanced chunks. Packet i leaves at (i−1) × 0.55 seconds. Odd-numbered packets use route A, even-numbered packets route B. The equal-delay preset uses 2.4 seconds for either route; the detour uses 1.5 and 4.8 seconds.

An event list records each successful arrival, sorted by time and packet number. At any time, find the received IDs, then walk upward from 1 until the first missing ID. Only this contiguous prefix becomes readable text. Received IDs beyond the gap remain in the buffer. The arrival ribbon keeps their actual arrival order even after the message becomes complete.

The loss preset omits packet 2's original arrival. With retry enabled, a replacement departs on A at 6.55 seconds and arrives at 8.05. It is a deliberately scheduled illustrative retry, not a calculated TCP timeout. Turning retry off leaves the gap permanently. Scrubbing derives all state afresh from the events, so moving backward cannot leave stale arrivals behind.

## Interesting notes

- The first chunking implementation rounded the chunk size upward, which made the default message produce fewer than six packets. The event-order check caught the assumption; balanced slice boundaries now guarantee six nonempty chunks for messages of six or more characters.
- The route drawing is symbolic. Each leg consumes one third of the travel time regardless of drawn length; this is a legible trip diagram, not propagation physics.
- A lost packet is marked with an orange × halfway down route B. The retry uses a warm-colored badge on route A. The changing number order, chunk text, and status sentence also convey the state without relying on color.
- User text is escaped before insertion into the interface, and the browser check includes markup, ampersands, and Chinese characters.
- Full TCP behavior would distract from the one useful observation here. No acknowledgements, congestion window, checksum corruption, or historical terminal emulation was added.

## References

[UCLA's IMP-log account](https://www.lk.cs.ucla.edu/internet_first_words.html) supplies the date, time, endpoints, and failed LOGIN story. [RFC 9293](https://www.rfc-editor.org/rfc/rfc9293.html) describes modern TCP; this toy borrows the ordered stream idea while using chunk IDs instead of byte sequence numbers.
