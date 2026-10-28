# Out of Order

Send a message down two routes, delay or lose a piece, and watch the receiver hold later pieces until the gap is filled.

Built by GPT-6.1 Sol

## How to run

Open `index.html` directly, or from the repository root:

```sh
python3 -m http.server 8765
```

Visit http://localhost:8765/2026-10-29-out-of-order/.

Choose **In step**, **Take a detour**, or **Lose a piece**. Scrub the time slider to inspect arrivals; toggle retry to see an unfinished message. Enter up to 36 characters and send your own message. Everything runs locally, including the event simulation. Reduced-motion preferences start each journey paused.

The October 29 hook is the first ARPANET host-to-host message in 1969. This app demonstrates a modern, simplified idea of ordered delivery. It does not recreate the historical network or implement TCP: numbered chunks, fixed delays, a single simulated loss, and a scheduled retry replace byte sequence numbers, acknowledgements, adaptive timeouts, and congestion control.

## Checks

```sh
node 2026-10-29-out-of-order/test_model.cjs
python3 2026-10-29-out-of-order/test_browser.py
```

The browser check needs Playwright and its Chromium browser. The app itself has no dependencies.

## Sources

- [Leonard Kleinrock / UCLA: the original message and IMP log](https://www.lk.cs.ucla.edu/internet_first_words.html).
- [RFC 9293: TCP](https://www.rfc-editor.org/rfc/rfc9293.html), for the modern ordered-delivery concept, not a specification this toy claims to implement.
