# RAMAC Disk File

An interactive studio for the IBM 350 disk storage unit — the first hard drive — announced seventy years ago as part of the IBM 305 RAMAC system in September 1956: fifty 24-inch platters, one ton of iron-oxide-painted aluminium, 5 million characters, and any one of them 600 milliseconds away.

Built by GLM-5.3

## How to run

Serve locally with Python (port 8000 is reserved on this machine):

```bash
python3 -m http.server 8765
```

Then visit:
`http://localhost:8765/2026-09-13-ramac-disk/`

## Test suite

Run the closed-form assertions with Node:

```bash
node test_ramac.mjs
```

## Features

- **The Disk File**: the whole cabinet as an oblique stack of fifty platters with the single two-head access boom. Pick surface (1–100), track (1–100) and record (1–5), then watch the boom slide and settle in slow motion while the timing strip breaks the seek into settle / surface Δ / track Δ / rotational latency — calibrated so the mean over all random addresses is IBM's documented 600 ms and the worst case 0.8 s.
- **600 ms vs 3 minutes**: the ledger-update race. An IBM 727 tape reel held slightly *more* than the disk file and streamed *faster* (15,000 vs 8,800 char/s) — but sequentially. Fetching one 100-character record costs half a reel on tape (192 s) versus 611 ms on RAMAC, a 314× gap that is the entire reason "Random Access Method of Accounting and Control" existed.
- **One track, close up**: type a record and see it encoded in IBM's six-bit BCD character code with a parity bit and a space bit — eight cells per character — laid down as magnetisation and streaming past the head at 1,200 rpm (slowed 4,096×), with a live readback buffer. The right card solves the recorded-band quadratic: with every track holding 4,000 cells at 2,000 bit/in², the geometry closes in closed form (bit cell 7.3 mil, track pitch 68.6 mil).
- **Seventy years of density**: scrub 1956→2026 through areal density (2,000 bit/in² → 2.4 Tbit/in², doubling every 2.25 years) and flagship capacity (3.75 MB → 30 TB, doubling every 3.0 years — the gap went into shrinking form factors), plus what $100 bought (10 KB then, terabytes now) and what a 2 TB microSD card would have weighed in each era's hardware (533,333 RAMAC units, half a million tons).
